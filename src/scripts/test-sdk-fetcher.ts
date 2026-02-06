/**
 * SDK-based Fetcher Test
 * Tests the new @deriverse/kit integrated TradeFetcher
 */

import TradeFetcher from "../services/TradeFetcher-sdk";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config();

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  SDK-Integrated TradeFetcher Test');
    console.log('═══════════════════════════════════════════════════════════\n');

    const rpcUrl = process.env.HELIUS_API_KEY 
        ? `https://devnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
        : 'https://api.devnet.solana.com';
    
    const walletAddress = process.env.TARGET_WALLET || '8dTL91USuAWNcEZ9en5Pbq6JJJN9AQ9v1nGcce73G5BT';

    console.log(`🔗 RPC: ${rpcUrl.includes('helius') ? 'Helius Devnet' : 'Public Devnet'}`);
    console.log(`📍 Wallet: ${walletAddress}\n`);

    const fetcher = new TradeFetcher(rpcUrl, walletAddress);

    const startTime = Date.now();
    const outputPath = path.join(process.cwd(), "data", "history-sdk.json");
    
    await fetcher.fetchAndSave(outputPath);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Test completed in ${elapsed}s`);
    console.log(`📁 Output: ${outputPath}`);

    // Read and display sample
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  Sample Output (first 2 events)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    data.slice(0, 2).forEach((event: any, idx: number) => {
        console.log(`${idx + 1}. ${event.type} Event`);
        if (event.type === 'TRADE') {
            console.log(`   Order: ${event.tradeAction} ${event.amount} @ ${event.price}`);
            console.log(`   Type: ${event.orderType} | Role: ${event.role} | Side: ${event.orderSide}`);
        } else if (event.type === 'FEE') {
            console.log(`   Fee Amount: ${event.amount} USDC`);
        }
        console.log('');
    });

    console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
});
