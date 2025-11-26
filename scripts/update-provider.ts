// ABOUTME: Updates provider information on x402 gateway
// ABOUTME: Allows updating provider name, wallet address, and connection string (email is immutable)

import dotenv from 'dotenv'

dotenv.config()

export interface ProviderUpdate {
    name?: string
    walletAddress?: string
    connectionString?: string
}

export function validateEnvironment(requiredVars: string[]): void {
    const missing = requiredVars.filter(varName => !process.env[varName])

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
    }
}

export async function updateProvider(updates: ProviderUpdate): Promise<void> {
    validateEnvironment(['X402_GATEWAY_URL', 'X402_API_KEY'])

    const gatewayUrl = process.env.X402_GATEWAY_URL!
    const apiKey = process.env.X402_API_KEY!

    // Use the new update endpoint on serenai-x402.vercel.app
    const updateUrl = gatewayUrl.replace('x402.serendb.com', 'serenai-x402.vercel.app')

    console.log('Updating provider information...')

    const response = await fetch(`${updateUrl}/api/providers/update`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Update failed: ${error}`)
    }

    const result = await response.json()

    console.log('\n✓ Provider updated successfully!')
    console.log('Updated fields:', Object.keys(updates).join(', '))

    return result
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2)

    if (args.length === 0) {
        console.error('Error: Please provide at least one field to update.')
        console.error('Usage: pnpm update-provider [--name <name>] [--wallet <address>] [--connection <string>]')
        console.error('\nNote: Email cannot be changed after registration.')
        console.error('\nExamples:')
        console.error('  pnpm update-provider --name "New Provider Name"')
        console.error('  pnpm update-provider --wallet 0x1234...5678')
        process.exit(1)
    }

    const updates: ProviderUpdate = {}

    for (let i = 0; i < args.length; i += 2) {
        const flag = args[i]
        const value = args[i + 1]

        if (!value) {
            console.error(`Error: Missing value for ${flag}`)
            process.exit(1)
        }

        switch (flag) {
            case '--name':
                updates.name = value
                break
            case '--wallet':
                updates.walletAddress = value
                break
            case '--connection':
                updates.connectionString = value
                break
            default:
                console.error(`Error: Unknown flag ${flag}`)
                console.error('Valid flags: --name, --wallet, --connection')
                process.exit(1)
        }
    }

    updateProvider(updates)
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Update failed:', err)
            process.exit(1)
        })
}
