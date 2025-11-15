// ABOUTME: Tests for document extraction and OCR processing
// ABOUTME: Validates unzipping, file discovery, and OCR execution

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { extractDocuments } from './extract'
import * as childProcess from 'child_process'

describe('Document Extraction', () => {
  const testOutputDir = './test-extracted'
  const fixturesDir = './tests/fixtures'

  beforeEach(() => {
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true })
    }
    mkdirSync(testOutputDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true })
    }
    vi.restoreAllMocks()
  })

  it('should create output directory if it does not exist', async () => {
    const nonExistentDir = './test-new-dir'
    if (existsSync(nonExistentDir)) {
      rmSync(nonExistentDir, { recursive: true })
    }

    await extractDocuments(fixturesDir, nonExistentDir, { dryRun: true })
    expect(existsSync(nonExistentDir)).toBe(true)

    // Cleanup
    rmSync(nonExistentDir, { recursive: true })
  })

  it('should find zip files in source directory', async () => {
    const zipFiles = await extractDocuments(fixturesDir, testOutputDir, { dryRun: true })
    expect(zipFiles.length).toBeGreaterThan(0)
    expect(zipFiles.every(f => f.endsWith('.zip'))).toBe(true)
  })

  it('should extract and process files from zip archive', async () => {
    // Mock execSync for Python unzip
    const execSyncSpy = vi.spyOn(childProcess, 'execSync').mockImplementation((command: any) => {
      // Simulate unzipping by creating a test file
      const tempDirMatch = String(command).match(/\.temp_test_archive_\d+/)
      if (tempDirMatch) {
        const tempDir = join(testOutputDir, tempDirMatch[0])
        mkdirSync(tempDir, { recursive: true })
        writeFileSync(join(tempDir, 'test_document.pdf'), 'dummy pdf content')
      }
      return Buffer.from('')
    })

    // Mock execAsync for OCR
    const execAsync = await import('util').then(m => m.promisify)
    vi.mock('child_process', async () => {
      const actual = await vi.importActual('child_process')
      return {
        ...actual,
        exec: (cmd: string, opts: any, cb: any) => {
          // Simulate OCR by creating output text file
          const outputMatch = cmd.match(/--sidecar "([^"]+)"/)
          if (outputMatch) {
            writeFileSync(outputMatch[1], 'Test Document\f')
          }
          cb(null, { stdout: '', stderr: '' })
        }
      }
    })

    const zipFiles = await extractDocuments(fixturesDir, testOutputDir, { dryRun: false })

    expect(zipFiles.length).toBe(1)
    expect(zipFiles[0]).toContain('test_archive.zip')
    expect(execSyncSpy).toHaveBeenCalled()
  })
})
