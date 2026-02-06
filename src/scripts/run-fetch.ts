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
    
    const events = await fetcher.fetchAllTrades();
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`\n✅ Fetch completed in ${duration}s`);
    console.log(`📊 Total events found: ${events.length}`);

    // Save to JSON
    const outputPath = path.join(process.cwd(), 'data', 'history.json');
    await fetcher.saveToFile(events, outputPath);

    // Display sample events
    if (events.length > 0) {
      console.log('\n📋 Sample Events (first 3):');
      events.slice(0, 3).forEach((event, idx) => {
        console.log(`\n${idx + 1}. ${event.type} Event`);
        console.log(`   Signature: ${event.signature.substring(0, 8)}...`);
        console.log(`   Timestamp: ${new Date(event.timestamp * 1000).toISOString()}`);
        if (event.type === 'TRADE') {
          console.log(`   Order: ${event.tradeAction} ${event.amount} @ ${event.price}`);
        } else if (event.type === 'FEE') {
          console.log(`   Fee Amount: ${event.amount} USDC`);
        }
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
