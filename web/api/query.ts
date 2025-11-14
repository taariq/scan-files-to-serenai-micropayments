// ABOUTME: Vercel serverless API proxy for x402 gateway queries
// ABOUTME: Adds provider authentication and SQL validation for browser-based demo

import type { VercelRequest, VercelResponse } from '@vercel/node'

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

function validateQuery(query: string): { valid: boolean; error?: string } {
  const upperQuery = query.trim().toUpperCase()

  for (const operation of FORBIDDEN_OPERATIONS) {
    const regex = new RegExp(`\\b${operation}\\b`)
    if (regex.test(upperQuery)) {
      return {
        valid: false,
        error: `Forbidden SQL operation: ${operation}`
      }
    }
  }

  return { valid: true }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { walletAddress, query } = req.body

    // Validate inputs
    if (!walletAddress || typeof walletAddress !== 'string') {
      return res.status(400).json({ error: 'walletAddress is required' })
    }

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query is required' })
    }

    // Validate query for forbidden operations
    const validation = validateQuery(query)
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error })
    }

    // Get provider credentials from environment
    const gatewayUrl = process.env.X402_GATEWAY_URL
    const providerId = process.env.X402_PROVIDER_ID
    const apiKey = process.env.X402_API_KEY

    if (!gatewayUrl || !providerId || !apiKey) {
      return res.status(500).json({
        error: 'Server configuration error: Missing x402 credentials'
      })
    }

    // Call x402 gateway with provider credentials
    const response = await fetch(`${gatewayUrl}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-Provider-ID': providerId
      },
      body: JSON.stringify({
        sql: query,
        agentWallet: walletAddress,
        providerId: providerId
      })
    })

    // Forward the response
    const data = await response.json()

    if (response.ok) {
      return res.status(200).json(data)
    } else if (response.status === 402) {
      return res.status(402).json(data)
    } else {
      return res.status(response.status).json(data)
    }
  } catch (error) {
    console.error('Query proxy error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}
