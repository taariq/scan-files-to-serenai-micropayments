# Migration Guide: Coinbase x402 Protocol

This guide helps existing users migrate from the old deposit-based x402 protocol to the new Coinbase x402 protocol with EIP-3009 authorization signatures.

## What Changed

### Old Protocol (Deposit-Based)
- Users deposited USDC to gateway
- Gateway tracked balances per agent wallet
- Queries deducted from balance
- HTTP 402 returned deposit URL when balance insufficient

### New Protocol (EIP-3009 Authorization)
- No deposits required
- Per-query USDC authorization signatures
- Gateway settles payment per transaction
- HTTP 402 returns PaymentRequirements
- Automatic credit system for failed queries

## Breaking Changes

### 1. MCP Server API Changes

**Removed**:
- `check_balance` tool (balance concept no longer exists)
- `get_deposit_instructions` tool (deposits deprecated)
- `getBalance()` method in X402Client

**Updated**:
- `execute_query` tool now handles automatic EIP-3009 signing
- Returns `PaymentRequirementsResponse` when payment needed
- Returns `SettlementResponse` with transaction hash on success

### 2. Environment Variables

**New Required Variable**:
```bash
# Agent wallet private key for automatic payment signing
AGENT_PRIVATE_KEY=0x...  # 64-character hex with 0x prefix
```

**Changed Headers**:
- `Authorization: Bearer <apiKey>` → `x-api-key: <apiKey>`

### 3. Payment Flow

**Old Flow**:
1. Query → Check balance → Deduct → Execute
2. If insufficient: Return deposit URL

**New Flow**:
1. Query → HTTP 402 + PaymentRequirements
2. Sign EIP-3009 authorization
3. Retry with X-PAYMENT header
4. Gateway settles payment and executes query

## Migration Steps

### Step 1: Update Dependencies

```bash
cd mcp-server
pnpm install  # Gets ethers@^6.13.0 for EIP-3009 signing
pnpm build
```

### Step 2: Create Agent Wallet

1. Create a new Ethereum wallet on Base network
2. Fund with USDC (start with $5-10 for testing)
3. Export private key securely

**Using ethers.js**:
```typescript
import { Wallet } from 'ethers'

// Create new wallet
const wallet = Wallet.createRandom()
console.log('Address:', wallet.address)
console.log('Private Key:', wallet.privateKey)  // Store securely!
```

**Using Coinbase Wallet**:
1. Create new wallet in app
2. Go to Settings → Show private key
3. Copy and store securely

### Step 3: Update Environment Variables

Add to `.env`:
```bash
# Agent wallet private key (REQUIRED for automatic payments)
AGENT_PRIVATE_KEY=0x...
```

Update Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):
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
        "AGENT_PRIVATE_KEY": "0x..."  // ADD THIS
      }
    }
  }
}
```

### Step 4: Restart MCP Server

```bash
# Rebuild if needed
pnpm --filter @scan-files/mcp-server build

# Restart Claude Desktop to reload MCP server
```

### Step 5: Test Query

In Claude Desktop:
```
Query the database for 10 documents
```

Expected behavior:
1. MCP server receives query
2. Gateway returns HTTP 402 + PaymentRequirements
3. Server signs EIP-3009 authorization
4. Gateway settles payment on Base
5. Query executes and results returned

Check logs for:
```
✓ Agent wallet configured for automatic EIP-3009 payment signing
```

## Troubleshooting

### Error: "AGENT_PRIVATE_KEY not set"

**Symptom**: Queries return PaymentRequirements JSON instead of executing

**Solution**: Add `AGENT_PRIVATE_KEY` to environment variables and restart

### Error: "Insufficient USDC balance"

**Symptom**: Payment fails with insufficient funds

**Solution**:
1. Check agent wallet balance on [BaseScan](https://basescan.org)
2. Transfer USDC to agent wallet
3. USDC contract on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

### Error: "Invalid signature"

**Symptom**: Payment rejected by gateway

**Solution**:
- Verify `AGENT_PRIVATE_KEY` format (must start with `0x`)
- Ensure private key matches wallet address
- Check network (must be Base mainnet, chainId 8453)

### Queries Return 402 Every Time

**Symptom**: Queries never execute, always return payment requirements

**Possible Causes**:
1. `AGENT_PRIVATE_KEY` not set → Add to environment
2. Agent wallet has no USDC → Fund wallet
3. Private key incorrect → Verify matches agent wallet
4. Network mismatch → Ensure Base mainnet

## Manual Payment Signing (Without AGENT_PRIVATE_KEY)

If you prefer not to store private keys in MCP config:

### Step 1: Get PaymentRequirements

Query returns:
```json
{
  "paymentRequired": true,
  "paymentRequirements": {
    "x402Version": 1,
    "accepts": [{
      "scheme": "eip3009",
      "network": "base-mainnet",
      "maxAmountRequired": "10000",  // USDC smallest units (0.01 USDC)
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "payTo": "0x...",  // Provider wallet
      "resource": "query",
      "maxTimeoutSeconds": 3600
    }]
  }
}
```

### Step 2: Sign Authorization

```typescript
import { Wallet } from 'ethers'

const wallet = new Wallet(privateKey)

const domain = {
  name: 'USD Coin',
  version: '2',
  chainId: 8453,
  verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
}

const types = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' }
  ]
}

const authorization = {
  from: wallet.address,
  to: paymentRequirement.payTo,
  value: paymentRequirement.maxAmountRequired,
  validAfter: '0',
  validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
  nonce: '0x' + crypto.randomBytes(32).toString('hex')
}

const signature = await wallet.signTypedData(domain, types, authorization)
```

### Step 3: Retry Query with X-PAYMENT Header

```typescript
const xPayment = {
  x402Version: 1,
  scheme: 'eip3009',
  network: 'base-mainnet',
  payload: {
    authorization,
    signature
  }
}

const xPaymentEncoded = Buffer.from(JSON.stringify(xPayment)).toString('base64')

// Retry query with header
fetch(gatewayUrl, {
  headers: {
    'x-api-key': apiKey,
    'X-PAYMENT': xPaymentEncoded
  },
  // ... rest of request
})
```

## Benefits of New Protocol

1. **No Deposits**: Agent wallet holds USDC directly, no gateway deposits
2. **Fair Billing**: Credit system refunds failed queries automatically
3. **On-Chain Settlement**: Every payment visible on BaseScan
4. **EIP-3009 Standard**: Uses Coinbase USDC's native authorization
5. **Better UX**: Automatic payment signing with optional manual flow

## Rollback (If Needed)

If you need to temporarily revert to old protocol:

```bash
# Restore old x402-client.ts
mv mcp-server/src/x402-client.ts mcp-server/src/x402-client.ts.new
mv mcp-server/src/x402-client.ts.backup mcp-server/src/x402-client.ts

# Rebuild
pnpm --filter @scan-files/mcp-server build

# Remove AGENT_PRIVATE_KEY from config
```

**Note**: The old protocol will eventually be deprecated. Plan to migrate permanently.

## Support

- **GitHub Issues**: [Migration Issues](https://github.com/taariq/scan-files-to-serenai-micropayments/issues)
- **x402 Spec**: [github.com/serenorg/serenai-x402](https://github.com/serenorg/serenai-x402)
- **EIP-3009**: [eips.ethereum.org/EIPS/eip-3009](https://eips.ethereum.org/EIPS/eip-3009)
