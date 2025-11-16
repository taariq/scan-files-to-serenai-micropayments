// ABOUTME: Vercel serverless function for query cost estimation using EXPLAIN
// ABOUTME: Returns estimated number of rows for a SQL query

import type { VercelRequest, VercelResponse } from '@vercel/node'
import pg from 'pg'

const { Pool } = pg

const FORBIDDEN_OPERATIONS = [
  'DROP',
  'DELETE',
  'UPDATE',
  'INSERT',
  'ALTER',
  'CREATE',
  'TRUNCATE',
  'GRANT',
  'REVOKE'
]

function validateQuery(query: string): void {
  const upperQuery = query.trim().toUpperCase()

  for (const operation of FORBIDDEN_OPERATIONS) {
    const regex = new RegExp(`\\b${operation}\\b`)
    if (regex.test(upperQuery)) {
      throw new Error(`Forbidden SQL operation: ${operation}`)
    }
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { query } = req.body

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query parameter is required' })
  }

  // Validate query
  try {
    validateQuery(query)
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Query validation failed'
    })
  }

  // Check for database connection string
  if (!process.env.SERENDB_CONNECTION_STRING) {
    return res.status(500).json({
      error: 'Database connection not configured'
    })
  }

  let pool: pg.Pool | null = null

  try {
    // Create database connection
    pool = new Pool({
      connectionString: process.env.SERENDB_CONNECTION_STRING
    })

    // Execute EXPLAIN query
    const explainQuery = `EXPLAIN (FORMAT JSON) ${query}`
    const result = await pool.query(explainQuery)

    // Parse EXPLAIN output to get row estimate
    const plan = result.rows[0]['QUERY PLAN'][0]
    const estimatedRows = plan?.Plan?.['Plan Rows'] || 0

    return res.status(200).json({
      success: true,
      estimatedRows: estimatedRows,
      query: query
    })
  } catch (error) {
    console.error('Failed to estimate query cost:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to estimate cost'
    })
  } finally {
    // Clean up pool connection
    if (pool) {
      await pool.end()
    }
  }
}
