import { TradeFetcher } from '../services/TradeFetcher';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Deriverse Analytics - Trade History Fetcher\n');

  // Validate environment variables
  const heliusApiKey = process.env.HELIUS_API_KEY;
  const targetWallet = process.env.TARGET_WALLET;

  if (!heliusApiKey) {
    console.error('❌ Error: HELIUS_API_KEY not found in environment variables');
    console.error('Please set it in your .env file');
    process.exit(1);
  }

  if (!targetWallet) {
    console.error('❌ Error: TARGET_WALLET not found in environment variables');
    console.error('Please set it in your .env file');
    process.exit(1);
  }

  // Initialize Helius Devnet connection
  const rpcUrl = `https://devnet.helius-rpc.com/?api-key=${heliusApiKey}`;

  console.log('🔗 Connected to Helius Devnet');
  console.log(`📍 Target Wallet: ${targetWallet}\n`);

  try {
    // Create fetcher instance
    const fetcher = new TradeFetcher(rpcUrl, targetWallet);

    // Fetch all trades
    console.log('⏳ Fetching trading history...\n');
    const startTime = Date.now();
    
    const trades = await fetcher.fetchAllTrades();
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`\n✅ Fetch completed in ${duration}s`);
    console.log(`📊 Total trades found: ${trades.length}`);

    // Save to JSON
    const outputPath = path.join(process.cwd(), 'data', 'history.json');
    await fetcher.saveToFile(trades, outputPath);

    // Display sample trades
    if (trades.length > 0) {
      console.log('\n📋 Sample Trades (first 3):');
      trades.slice(0, 3).forEach((trade, idx) => {
        console.log(`\n  [${idx + 1}] Signature: ${trade.signature.slice(0, 20)}...`);
        console.log(`      Timestamp: ${new Date(trade.timestamp * 1000).toISOString()}`);
        console.log(`      Market: ${trade.market}`);
        console.log(`      Side: ${trade.side}`);
        console.log(`      Size: ${trade.size}`);
        console.log(`      Price: ${trade.price}`);
      });
    }

    console.log('\n✨ Done!');

  } catch (error) {
    console.error('\n❌ Error occurred during execution:');
    console.error(error);
    process.exit(1);
  }
}

// Execute
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
