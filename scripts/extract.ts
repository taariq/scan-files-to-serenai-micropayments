// ABOUTME: Extracts documents from ZIP archives and runs OCR processing
// ABOUTME: Outputs extracted text to cached directory for upload

import { readdirSync, existsSync, mkdirSync, readFileSync, rmSync } from 'fs'
import { join, basename } from 'path'
import { execSync, exec } from 'child_process'
import { promisify } from 'util'
import pg from 'pg'
import { config } from 'dotenv'
import pLimit from 'p-limit'
import { parseExtractedFile } from './upload.js'

const execAsync = promisify(exec)

const { Pool } = pg

// Load environment variables
config()

export interface ExtractOptions {
  dryRun?: boolean
  uploadImmediately?: boolean  // Upload to database after each extraction
  concurrency?: number  // Number of files to process concurrently (default: 4)
}

// Database pool for uploading (initialized on first use)
let dbPool: pg.Pool | null = null

// Separate upload concurrency limiter to prevent overwhelming database
// (OCR can run at 20 workers, but DB uploads limited to 2 concurrent connections)
const uploadLimit = pLimit(2)

async function getDbPool(): Promise<pg.Pool> {
  if (!dbPool) {
    dbPool = new Pool({
      connectionString: process.env.SERENDB_CONNECTION_STRING,
      max: 2,  // Maximum 2 connections in pool
      connectionTimeoutMillis: 30000,  // 30 second connection timeout
      idleTimeoutMillis: 60000,  // Close idle connections after 60 seconds
      query_timeout: 30000  // 30 second query timeout
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

// Recursively collect all files in a directory
function collectFiles(dir: string, filter: (file: string) => boolean): string[] {
  const files: string[] = []
  const entries = readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, filter))
    } else if (entry.isFile() && filter(entry.name)) {
      files.push(fullPath)
    }
  }

  return files
}

async function processZipFile(zipPath: string, outputDir: string, options: ExtractOptions = {}): Promise<void> {
  const zipName = basename(zipPath, '.zip')
  const tempDir = join(outputDir, `.temp_${zipName}_${Date.now()}`)
  const limit = pLimit(options.concurrency || 4)

  try {
    // Step 1: Extract entire ZIP to temp directory using Python (more compatible)
    console.log(`  Unzipping ${zipName}...`)
    mkdirSync(tempDir, { recursive: true })

    // Use Python's zipfile module which handles various ZIP formats better
    const pythonScript = `
import zipfile
import sys
import os

zip_path = sys.argv[1]
extract_to = sys.argv[2]

try:
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        # Extract all files, handling absolute paths and special characters
        for member in zip_ref.namelist():
            # Remove leading slashes and handle absolute paths
            cleaned_name = member.lstrip('/')
            if cleaned_name:
                target_path = os.path.join(extract_to, cleaned_name)
                # Create directory structure
                os.makedirs(os.path.dirname(target_path), exist_ok=True)
                # Extract file
                if not member.endswith('/'):
                    with zip_ref.open(member) as source:
                        with open(target_path, 'wb') as target:
                            target.write(source.read())
    print('Success')
except Exception as e:
    print(f'Error: {e}', file=sys.stderr)
    sys.exit(1)
`

    execSync(`python3 -c '${pythonScript.replace(/'/g, "'\\''")}' "${zipPath}" "${tempDir}"`, {
      stdio: 'pipe',
      maxBuffer: 1024 * 1024 * 100 // 100MB buffer for large ZIPs
    })

    // Step 2: Collect all PDF and image files
    const files = collectFiles(tempDir, (name) =>
      name.endsWith('.pdf') || name.endsWith('.jpg') || name.endsWith('.png')
    )

    console.log(`  Found ${files.length} files to process with ${options.concurrency || 4} workers`)

    // Step 3: Process all files in parallel
    const operations = files.map(filePath =>
      limit(async () => {
        const relativePath = filePath.substring(tempDir.length + 1)
        const outputTextFile = join(outputDir, `${zipName}_${relativePath}.txt`)

        // Skip if already processed (resume capability)
        if (existsSync(outputTextFile)) {
          console.log(`⊙ Skipping (already processed): ${basename(outputTextFile)}`)
          return
        }

        // Run OCR on file
        await processFile(filePath, outputTextFile, options)
      })
    )

    await Promise.all(operations)

  } finally {
    // Step 4: Clean up temp directory
    if (existsSync(tempDir)) {
      console.log(`  Cleaning up temp directory...`)
      rmSync(tempDir, { recursive: true, force: true })
    }
  }
}

export async function processFile(inputPath: string, outputPath: string, options: ExtractOptions = {}): Promise<void> {
  // Skip if already processed (resume capability)
  if (existsSync(outputPath)) {
    console.log(`⊙ Skipping (already processed): ${outputPath}`)
    return
  }

  try {
    // Use OCRmyPDF with balanced speed/quality settings:
    // --force-ocr: Force OCR on all images for consistency
    // --language eng: Use English language model
    // --sidecar: Extract text to separate file
    // Note: Removed --deskew, --clean, --oversample for 2-3x speed improvement
    const command = `ocrmypdf --force-ocr --language eng --sidecar "${outputPath}" "${inputPath}" /dev/null`
    await execAsync(command, { maxBuffer: 1024 * 1024 * 10 }) // 10MB buffer
    console.log(`✓ Extracted: ${outputPath}`)

    // Upload immediately if option is enabled
    if (options.uploadImmediately) {
      try {
        const filename = outputPath.split('/').pop()!
        // Use uploadLimit to prevent overwhelming database with concurrent connections
        await uploadLimit(() => uploadFileToDatabase(outputPath, filename))
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
  const args = process.argv.slice(2)
  let sourceDir = './uploads'
  let outputDir = './extracted'
  let uploadImmediately = false
  let concurrency = 4

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--uploadImmediately') {
      uploadImmediately = true
    } else if (arg === '--concurrency') {
      concurrency = parseInt(args[++i], 10)
    } else if (i === 0 && !arg.startsWith('--')) {
      sourceDir = arg
    } else if (i === 1 && !arg.startsWith('--')) {
      outputDir = arg
    }
  }

  console.log('Starting document extraction and upload...')
  console.log(`Concurrency: ${concurrency} workers`)
  console.log(`Upload immediately: ${uploadImmediately}`)

  const processed = await extractDocuments(sourceDir, outputDir, {
    uploadImmediately,
    concurrency
  })
  console.log(`\nCompleted! Processed ${processed.length} archives.`)
}
