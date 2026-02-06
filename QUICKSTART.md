# 🚀 Quick Start Guide - Deriverse Analytics Trade Fetcher

## Prerequisites
- Node.js 16+ installed
- A Helius API key ([Get one here](https://www.helius.dev/))
- A Solana wallet address to analyze

## Installation & Setup (5 minutes)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment
```bash
# Copy the example file
cp .env.example .env

# Edit .env with your credentials
# HELIUS_API_KEY=your_actual_api_key
# TARGET_WALLET=your_wallet_address
```

### Step 3: Run the Fetcher
```bash
npm run fetch:trades
```

## What You'll See

```
🚀 Deriverse Analytics - Trade History Fetcher

🔗 Connected to Helius Devnet
📍 Target Wallet: 5XYZ...

🔍 Starting trade fetch for wallet: 5XYZ...
⚠️  Using conservative rate limiting (1 tx every 2s) to avoid API limits
   This will be slow but reliable. For faster fetching, upgrade your RPC plan.

📦 Batch 1: Found 12 signatures
   Processing transaction 1 of 12...
   Processing transaction 2 of 12...
   Processing transaction 3 of 12...
   ...
✅ No more transactions found

✅ Total trades fetched: 8
💾 Saved to: C:\...\data\history.json

📋 Sample Trades (first 3):

  [1] Signature: 5Xj8...
      Timestamp: 2026-02-03T12:34:56.000Z
      Market: SOL-PERP
      Side: LONG
      Size: 234898
      Price: 6058825

✨ Done!
```

**⚠️ Performance Note:** Free-tier RPC limits are strict. Expect ~30 transactions/minute (~2s per transaction). 100 transactions will take 3-4 minutes.

**Note:** If you see "⏳ Rate limited. Retrying..." messages, that's normal - the fetcher automatically handles rate limits with exponential backoff.

## Output File

Check `data/history.json` for the complete trading history:

```json
[
  {
    "signature": "5Xj8hM2p...",
    "timestamp": 1769855563,
    "market": "SOL-PERP",
    "side": "LONG",
    "size": "234898",
    "price": "6058825",
    "originalLog": "EgABAZIDAACusF8AAAA..."
  }
]
```

## Troubleshooting

### Error: "HELIUS_API_KEY not found"
→ Make sure you created the `.env` file and added your API key

### Error: "Invalid public key"
→ Check that your wallet address is valid (should be 32-44 characters)

### Error: "403 Forbidden: Batch requests are only available for paid plans"
→ **This has been FIXED!** The fetcher now uses individual API calls (not batch requests), making it fully compatible with free tier.
- If you still see this error, make sure you have the latest code
- The fetcher should use `getParsedTransaction` (singular), not `getParsedTransactions` (plural)

### "429 Too Many Requests" or Rate Limiting
→ **The fetcher handles this automatically!** You'll see:
```
⏳ Rate limited. Retrying in 2000ms... (Attempt 1/7)
⏳ Rate limited. Retrying in 4000ms... (Attempt 2/7)
```
The system uses exponential backoff and will retry up to 7 times.

**Current Settings (optimized for free tier):**
- Uses individual API calls (not batch requests - free tier compatible!)
- `BATCH_DELAY_MS = 2000` (2 second delay between requests)

**If rate limiting STILL persists:**
- Wait a few minutes - your daily quota might be exhausted
- Increase `BATCH_DELAY_MS` to 3000 or 5000 in `src/services/TradeFetcher.ts` (line 31)
- Try creating a new Helius API key
- **Recommended:** Upgrade to a paid Helius plan for much faster fetching

### No trades found
→ The wallet might not have any trading activity on Devnet yet

## Next Steps

✅ **Verify the data** - Open `data/history.json` to inspect the results  
✅ **Customize parsing** - Edit `src/services/TradeFetcher.ts` to adjust field extraction  
✅ **Build dashboard** - Use this data to power your analytics UI  
✅ **Add real-time updates** - Extend with WebSocket subscriptions  

## Need Help?

See [TRADE_FETCHER_README.md](./TRADE_FETCHER_README.md) for detailed documentation.
