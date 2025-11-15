# Scan Files to SerenAI Micropayments

Query document databases using AI agents with micropayments powered by [SerenAI](https://serendb.com) and x402.

This application demonstrates how to:
- Extract and index document content using OCR
- Store searchable content in SerenDB (PostgreSQL-compatible)
- Expose database queries through x402 payment-gated endpoints
- Enable AI agents to query data via MCP with automatic micropayments

## Quick Start

### 1. Fork and Clone

```bash
git clone https://github.com/YOUR_USERNAME/scan-files-to-serenai-micropayments.git
cd scan-files-to-serenai-micropayments
pnpm install
```

### 2. Set Up SerenDB Account

1. Sign up at [console.serendb.com/signup](https://console.serendb.com/signup)
2. Create a new database
3. Copy your connection string from the console

### 3. Set Up Wallets

You'll need **two wallets** on Base network:

**Provider Wallet** (receives payments):
1. Install [Coinbase Wallet](https://www.coinbase.com/wallet) or another Base-compatible wallet
2. Switch to **Base network** (Ethereum L2)
3. Copy your wallet address (starts with `0x`)
4. This wallet receives query payments - no funding required

**Agent Wallet** (pays for queries):
1. Create a separate wallet for the AI agent
2. Fund with USDC on Base network (for automatic payments)
3. Keep the private key secure - it will be used by MCP server
4. Recommended: Use a dedicated wallet for testing with small amounts

**Why Base?** Lower transaction fees (~$0.002 or less than a cent at 0.027 gwei) compared to Ethereum mainnet.

### 4. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```bash
# Your SerenDB connection string
SERENDB_CONNECTION_STRING=postgresql://user:password@host:5432/dbname

# x402 gateway (leave as-is)
X402_GATEWAY_URL=https://x402.serendb.com

# You'll get these after registration in step 6
X402_PROVIDER_ID=
X402_API_KEY=

# Provider wallet (receives payments) - from step 3
PROVIDER_WALLET_ADDRESS=0x...

# Agent wallet private key (OPTIONAL - for automatic payments)
# WARNING: Store securely! This gives full control over agent wallet
# Required for MCP server to automatically sign EIP-3009 payments
# If not set, queries will require manual payment signing
# AGENT_PRIVATE_KEY=0x...
```

### 5. Upload and Process Documents

1. Place your PDF/image files in [uploads/](uploads/)
2. Extract text and upload to database:

```bash
pnpm extract  # Extract text from documents using OCR
pnpm upload   # Upload extracted content to SerenDB
```

**Tip:** Run `pnpm backup` to create database snapshots for later restoration.

### 6. Register with x402 Gateway

Register your database as a payment-gated data provider:

```bash
pnpm register
```

This will:
- Register your provider with x402 gateway
- Return `X402_PROVIDER_ID` and `X402_API_KEY`
- Update your `.env` file automatically

### 7. Install MCP Server for AI Queries

The MCP server lets Claude Desktop query your database with automatic micropayments.

See detailed instructions: [mcp-server/INSTALLATION.md](mcp-server/INSTALLATION.md)

**Quick install:**

```bash
cd mcp-server
pnpm install
pnpm build
```

Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "scan-files": {
      "command": "node",
      "args": ["/full/path/to/mcp-server/dist/index.js"],
      "env": {
        "X402_GATEWAY_URL": "https://x402.serendb.com",
        "X402_PROVIDER_ID": "your-provider-id",
        "X402_API_KEY": "your-api-key",
        "AGENT_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

**Security Note**: `AGENT_PRIVATE_KEY` enables automatic EIP-3009 payment signing. Without it, queries will return payment requirements for manual signing. The agent wallet must be funded with USDC on Base.

Restart Claude Desktop and test:
```
Query the database for all documents
```

## Architecture

```
┌─────────────────┐
│  Claude Desktop │
└────────┬────────┘
         │ MCP Protocol
┌────────▼────────┐
│   MCP Server    │
└────────┬────────┘
         │ HTTP + x402
┌────────▼────────┐      ┌──────────────┐
│ x402 Gateway    │◄────►│  SerenDB     │
└────────┬────────┘      └──────────────┘
         │ Payment Flow
┌────────▼────────┐
│  Base Network   │
└─────────────────┘
```

## How Micropayments Work

The Coinbase x402 protocol uses EIP-3009 authorization signatures for per-query payments:

1. **Query Request**: Claude Desktop sends SQL query via MCP server
2. **HTTP 402 Response**: Gateway returns PaymentRequirements with cost estimate
3. **EIP-3009 Signing**: MCP server signs USDC transfer authorization using agent wallet
4. **X-PAYMENT Header**: Signed authorization sent as base64-encoded header
5. **Settlement**: Gateway verifies signature and settles USDC transfer on Base
6. **Query Execution**: Database query executes and results returned
7. **Provider Payment**: Provider receives USDC in their wallet

**Credit System**: If a paid query fails (e.g., invalid SQL after payment), the gateway issues a credit that automatically applies to the next query, ensuring fair billing.

**Cost**: ~$0.01 per 1000 rows + ~$0.01 Base network fee = ~$0.02 total per query

## Development Commands

```bash
# Document processing
pnpm extract        # Extract text from documents
pnpm upload         # Upload to database
pnpm backup         # Create database backup

# Provider setup
pnpm register       # Register with x402 gateway

# Web interface (optional)
cd web
pnpm dev           # Start SolidJS development server

# MCP server
cd mcp-server
pnpm build         # Build MCP server
pnpm test          # Run tests
```

## Project Structure

```
scan-files-to-serenai-micropayments/
├── docs/
│   └── Documents/           # Upload your documents here
├── scripts/
│   ├── extract.ts           # OCR and text extraction
│   ├── upload.ts            # Upload to SerenDB
│   ├── register-provider.ts # Register with x402
│   └── backup.ts            # Database backup/restore
├── mcp-server/              # MCP server for Claude Desktop
│   ├── src/
│   │   ├── index.ts         # Server entry point
│   │   ├── x402-client.ts   # x402 gateway client
│   │   └── tools/           # MCP tool implementations
│   └── INSTALLATION.md      # Detailed MCP setup guide
└── web/                     # SolidJS web interface (optional)
```

## Customization

This codebase is designed to be forked and customized:

1. **Different Documents**: Use any PDFs/images you want to scan and query
2. **Custom Schema**: Modify [scripts/schema.sql](scripts/schema.sql) for your data model
3. **Query Tools**: Add custom MCP tools in [mcp-server/src/tools/](mcp-server/src/tools/)
4. **Web UI**: Build custom interfaces in [web/](web/) using SolidJS

## Pricing

- **Query Cost**: $0.01 per 1000 rows (base price)
- **Provider Markup**: 1.5x (configurable)
- **Network Fees**: ~$0.01 per transaction on Base

**Example**: Querying 5000 rows costs ~$0.075 + ~$0.01 network fee = ~$0.085 total

## Security

**Environment Variables**:
- Never commit `.env` files with real credentials
- Use environment variables for all secrets
- Add `.env` to `.gitignore` (already configured)

**Agent Wallet Private Key**:
- `AGENT_PRIVATE_KEY` gives full control over agent wallet
- Store securely - treat like a password
- Use a dedicated wallet for AI agents (not your main wallet)
- Fund with small amounts of USDC for testing
- Consider hardware wallet or secure key management for production

**General**:
- Wallet addresses are public - only use addresses you control
- MCP server runs locally (not exposed publicly)
- x402 gateway validates all queries (read-only SELECT only)
- Provider wallet doesn't need funding (receives payments only)

## Tech Stack

- **Frontend**: SolidJS (optional web interface)
- **Database**: SerenDB (PostgreSQL-compatible)
- **Payments**: x402 protocol on Base (Ethereum L2)
- **AI Integration**: Model Context Protocol (MCP)
- **OCR**: open-source text extraction tools

## Resources

- **SerenDB Console**: [console.serendb.com](https://console.serendb.com)
- **x402 Spec**: [github.com/serenorg/serenai-x402](https://github.com/serenorg/serenai-x402)
- **MCP Docs**: [modelcontextprotocol.io](https://modelcontextprotocol.io)
- **Base Network**: [base.org](https://base.org)

## Support

- **Issues**: [github.com/YOUR_USERNAME/scan-files-to-serenai-micropayments/issues](https://github.com/YOUR_USERNAME/scan-files-to-serenai-micropayments/issues)
- **SerenDB Support**: [console.serendb.com/support](https://console.serendb.com/support)

## License

Apache License 2.0 - see [LICENSE](LICENSE) for details.
