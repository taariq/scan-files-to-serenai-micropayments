// ABOUTME: Extracts documents from ZIP archives and runs OCR processing
// ABOUTME: Outputs extracted text to cached directory for upload

import { readdirSync, existsSync, mkdirSync, createReadStream, createWriteStream, readFileSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { Parse } from 'unzipper'
import { pipeline } from 'stream/promises'
import pg from 'pg'
import { config } from 'dotenv'
import { parseExtractedFile } from './upload.js'

const { Pool } = pg

// Load environment variables
config()

export interface ExtractOptions {
  dryRun?: boolean
  uploadImmediately?: boolean  // Upload to database after each extraction
}

// Database pool for uploading (initialized on first use)
let dbPool: pg.Pool | null = null

async function getDbPool(): Promise<pg.Pool> {
  if (!dbPool) {
    dbPool = new Pool({
      connectionString: process.env.SERENDB_CONNECTION_STRING
    })
  }
  return dbPool
}

async function uploadFileToDatabase(filePath: string, filename: string): Promise<void> {
  const pool = await getDbPool()
  const content = readFileSync(filePath, 'utf-8')
  const parsed = parseExtractedFile(filename, content)

  // Check if document already exists
  const existingDoc = await pool.query(
    'SELECT id FROM documents WHERE source_file = $1',
    [parsed.sourceFile]
  )

  if (existingDoc.rows.length > 0) {
    console.log(`  ⊘ Already in database: ${parsed.sourceFile}`)
    return
  }

  // Insert document
  const docResult = await pool.query(
    `INSERT INTO documents (source_file, original_zip, total_pages)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [parsed.sourceFile, parsed.originalZip, parsed.pages.length]
  )

  const documentId = docResult.rows[0].id

  // Insert pages
  for (let i = 0; i < parsed.pages.length; i++) {
    await pool.query(
      `INSERT INTO pages (document_id, page_number, content_text)
       VALUES ($1, $2, $3)`,
      [documentId, i + 1, parsed.pages[i]]
    )
  }

  console.log(`  ✓ Uploaded to database: ${parsed.sourceFile} (${parsed.pages.length} pages)`)
}

export async function extractDocuments(
  sourceDir: string,
  outputDir: string,
  options: ExtractOptions = {}
): Promise<string[]> {
  // Create output directory if it doesn't exist
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  // Find all zip files
  const zipFiles = readdirSync(sourceDir)
    .filter(f => f.endsWith('.zip'))
    .map(f => join(sourceDir, f))

  if (options.dryRun) {
    return zipFiles
  }

  // Process each zip file
  for (const zipPath of zipFiles) {
    console.log(`Processing ${zipPath}...`)
    await processZipFile(zipPath, outputDir, options)
  }

  // Close database connection if it was opened
  if (dbPool) {
    await dbPool.end()
    dbPool = null
  }

  return zipFiles
}

async function processZipFile(zipPath: string, outputDir: string, options: ExtractOptions = {}): Promise<void> {
  const zipName = zipPath.split('/').pop()!.replace('.zip', '')
  const pendingOperations: Promise<void>[] = []

  return new Promise((resolve, reject) => {
    createReadStream(zipPath)
      .pipe(Parse())
      .on('entry', (entry) => {
        const fileName = entry.path
        const type = entry.type // 'Directory' or 'File'

        if (type === 'Directory') {
          entry.autodrain()
          return
        }

        // Only process PDF and image files
        const isPdf = fileName.endsWith('.pdf')
        const isImage = fileName.endsWith('.jpg') || fileName.endsWith('.png')

        if (!isPdf && !isImage) {
          entry.autodrain()
          return
        }

        // Extract file to output directory
        const extractedPath = join(outputDir, fileName)
        const outputTextFile = join(outputDir, `${zipName}_${fileName}.txt`)

        // Skip if already processed (resume capability)
        if (existsSync(outputTextFile)) {
          console.log(`⊙ Skipping (already processed): ${outputTextFile}`)
          entry.autodrain()
          return
        }

        const extractedDir = extractedPath.substring(0, extractedPath.lastIndexOf('/'))

        if (!existsSync(extractedDir)) {
          mkdirSync(extractedDir, { recursive: true })
        }

        // Track this operation
        const operation = (async () => {
          try {
            await pipeline(entry, createWriteStream(extractedPath))

            // Run OCR on extracted file
            await processFile(extractedPath, outputTextFile, options)
          } catch (err) {
            console.error(`Failed to extract ${fileName}:`, err)
            entry.autodrain()
          }
        })()

        pendingOperations.push(operation)
      })
      .on('finish', async () => {
        // Wait for all pending operations to complete
        await Promise.all(pendingOperations)
        resolve()
      })
      .on('error', (err) => reject(err))
  })
}

export async function processFile(inputPath: string, outputPath: string, options: ExtractOptions = {}): Promise<void> {
  // Skip if already processed (resume capability)
  if (existsSync(outputPath)) {
    console.log(`⊙ Skipping (already processed): ${outputPath}`)
    return
  }

  try {
    // Use OCRmyPDF with quality-enhancing options:
    // --force-ocr: Force OCR on all images
    // --deskew: Straighten tilted images
    // --clean: Remove background noise and artifacts
    // --language eng: Explicitly set English language model
    // --oversample 300: Ensure at least 300 DPI for OCR quality
    // --sidecar: Extract text to separate file
    const command = `ocrmypdf --force-ocr --deskew --clean --language eng --oversample 300 --sidecar "${outputPath}" "${inputPath}" /dev/null`
    execSync(command, { stdio: 'pipe' })
    console.log(`✓ Extracted: ${outputPath}`)

    // Upload immediately if option is enabled
    if (options.uploadImmediately) {
      try {
        const filename = outputPath.split('/').pop()!
        await uploadFileToDatabase(outputPath, filename)
      } catch (uploadError) {
        console.error(`  ✗ Upload failed for ${outputPath}:`, uploadError)
      }
    }
  } catch (error) {
    console.error(`✗ Failed to process ${inputPath}:`, error)
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const sourceDir = process.argv[2] || './uploads'
  const outputDir = process.argv[3] || './extracted'

  console.log('Starting document extraction and upload...')
  const processed = await extractDocuments(sourceDir, outputDir, { uploadImmediately: true })
  console.log(`\nCompleted! Processed ${processed.length} archives.`)
}
