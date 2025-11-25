// ABOUTME: Uploads extracted document content to SerenDB
// ABOUTME: Handles document metadata, page content, and duplicate detection

import { readdirSync, readFileSync, statSync } from 'fs'
import { join, resolve } from 'path'
import pg from 'pg'
import { config } from 'dotenv'

const { Pool } = pg

// Load environment variables from repo root
config()

// Validate required environment variables
if (!process.env.SERENDB_CONNECTION_STRING) {
  console.error('Error: SERENDB_CONNECTION_STRING environment variable is required')
  console.error('Please set it in your .env file or environment.')
  console.error('Example: SERENDB_CONNECTION_STRING=postgresql://user:password@host:5432/dbname')
  process.exit(1)
}

export interface UploadOptions {
  dryRun?: boolean
}

export interface UploadResult {
  uploaded: number
  skipped: number
  files: string[]
}

export interface ParsedDocument {
  originalZip: string
  sourceFile: string
  pages: string[]
}

export function parseExtractedFile(filename: string, content: string): ParsedDocument {
  // Filename format: {originalZip}_{sourceFile}.txt
  // Example: test_archive_test_document.pdf.txt -> originalZip="test_archive", sourceFile="test_document.pdf"

  // Remove .txt extension
  const withoutTxt = filename.replace(/\.txt$/, '')

  // Find the last underscore before a simple filename with extension
  // Look for pattern: _{filename}.{ext} where ext is pdf/jpg/png
  const match = withoutTxt.match(/^(.+)_([^_]+\.(pdf|jpg|png))$/i)

  let originalZip: string
  let sourceFile: string

  if (match) {
    originalZip = match[1]
    sourceFile = match[2]
  } else {
    // Fallback: split on first underscore
    const firstUnderscore = withoutTxt.indexOf('_')
    if (firstUnderscore > 0) {
      originalZip = withoutTxt.substring(0, firstUnderscore)
      sourceFile = withoutTxt.substring(firstUnderscore + 1)
    } else {
      originalZip = 'unknown'
      sourceFile = withoutTxt
    }
  }

  // Split content into pages (using form-feed character from pdftotext)
  // Form-feed (\f) is the standard page separator from pdftotext
  const pages = content
    .split('\f')
    .map(p => p.trim())
    .filter(p => p.length > 0)

  return {
    originalZip,
    sourceFile,
    pages
  }
}

/**
 * Recursively find all .txt files in directory tree
 */
function findTextFiles(dir: string): string[] {
  const results: string[] = []

  try {
    const entries = readdirSync(dir)

    for (const entry of entries) {
      const fullPath = join(dir, entry)

      try {
        const stat = statSync(fullPath)

        if (stat.isDirectory()) {
          // Recursively search subdirectories
          results.push(...findTextFiles(fullPath))
        } else if (stat.isFile() && entry.endsWith('.txt')) {
          results.push(fullPath)
        }
      } catch (err) {
        console.warn(`Warning: Could not access ${fullPath}:`, err)
        continue
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err)
  }

  return results
}

export async function uploadDocuments(
  inputDir: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  // Find all extracted text files (including nested directories)
  const txtFiles = findTextFiles(inputDir)

  if (options.dryRun) {
    return {
      uploaded: 0,
      skipped: 0,
      files: txtFiles
    }
  }

  // Connect to database
  // Remove SSL mode from connection string if present, we'll handle it explicitly
  const connectionString = process.env.SERENDB_CONNECTION_STRING!
    .replace(/[?&]sslmode=[^&]*/g, '')
    .replace(/[?&]channel_binding=[^&]*/g, '')

  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  })

  let uploaded = 0
  let skipped = 0
  const totalFiles = txtFiles.length
  const startTime = Date.now()

  console.log(`Found ${totalFiles} files to process\n`)

  try {
    for (let i = 0; i < txtFiles.length; i++) {
      const filePath = txtFiles[i]
      const filename = filePath.split('/').pop()!
      const content = readFileSync(filePath, 'utf-8')

      const parsed = parseExtractedFile(filename, content)

      // Check if document already exists
      const existingDoc = await pool.query(
        'SELECT id FROM documents WHERE source_file = $1',
        [parsed.sourceFile]
      )

      if (existingDoc.rows.length > 0) {
        skipped++

        // Show progress every 100 files
        if ((uploaded + skipped) % 100 === 0) {
          const processed = uploaded + skipped
          const percent = ((processed / totalFiles) * 100).toFixed(1)
          const rate = (processed / (Date.now() - startTime) * 1000).toFixed(1)
          const remaining = Math.ceil((totalFiles - processed) / parseFloat(rate))

          console.log(`Progress: ${processed}/${totalFiles} (${percent}%) | Uploaded: ${uploaded} | Skipped: ${skipped} | Rate: ${rate}/sec | ETA: ${remaining}s`)
        }
        continue
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

      uploaded++

      // Show progress every 100 files
      if ((uploaded + skipped) % 100 === 0) {
        const processed = uploaded + skipped
        const percent = ((processed / totalFiles) * 100).toFixed(1)
        const rate = (processed / (Date.now() - startTime) * 1000).toFixed(1)
        const remaining = Math.ceil((totalFiles - processed) / parseFloat(rate))

        console.log(`Progress: ${processed}/${totalFiles} (${percent}%) | Uploaded: ${uploaded} | Skipped: ${skipped} | Rate: ${rate}/sec | ETA: ${remaining}s`)
      }
    }
  } finally {
    await pool.end()
  }

  return {
    uploaded,
    skipped,
    files: txtFiles
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const inputDir = process.argv[2] || resolve(process.cwd(), 'extracted')

  console.log('Starting document upload to SerenDB...')
  const result = await uploadDocuments(inputDir)
  console.log(`\nCompleted! Uploaded ${result.uploaded}, Skipped ${result.skipped}`)
}
