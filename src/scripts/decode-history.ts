/**
 * Decode History.json - 使用 Final Parser 逻辑重新解码所有记录
 */

import { Buffer } from 'buffer';
import * as fs from 'fs';
import * as path from 'path';

// 解析单个 log
function parseLog(log: string, blockTime: number): any {
  try {
    const buffer = Buffer.from(log, 'base64');
    if (buffer.length < 16) return null;

    const discriminator = buffer.readUInt8(0);

    // CASE A: FEE / TRANSFER (Discriminator 0x17)
    if (discriminator === 0x17) {
      const rawFee = buffer.readBigUInt64LE(8);
      const fee = Number(rawFee) / 1_000_000; // 6 decimals (USDC)

      return {
        action: "FEE",
        side: "UNKNOWN",
        size: "0",
        price: "0",
        fee: fee.toFixed(6),
        timestamp: blockTime
      };
    }

    // CASE B: TRADE (Buffer Length >= 40)
    if (buffer.length >= 40) {
      // 1. Timestamp
      let timestamp = blockTime;
      if (buffer.length >= 48) {
        const tsRaw = buffer.readBigInt64LE(buffer.length - 8);
        const ts = Number(tsRaw);
        if (ts > 1577836800 && ts < 1893456000) timestamp = ts;
      } else if (buffer.length >= 40) {
        const tsRaw = buffer.readUInt32LE(buffer.length - 4);
        if (tsRaw > 1577836800 && tsRaw < 1893456000) timestamp = tsRaw;
      }

      // 2. Size (Bytes 16-24)
      const rawSize = buffer.readBigUInt64LE(16);
      const size = Number(rawSize) / 1_000_000_000; // 9 decimals (SOL)

      // 3. Quote Amount (Bytes 24-32) - This is TOTAL USDC value, not unit price
      const rawQuoteAmount = buffer.readBigUInt64LE(24);
      const quoteAmount = Number(rawQuoteAmount) / 1_000_000;   // 6 decimals (USDC)

      // 4. Calculate Unit Price: price = quoteAmount / size
      let finalPrice = "0";
      if (size > 0) {
        finalPrice = (quoteAmount / size).toFixed(2);
      }

      // 5. Side
      let side = "UNKNOWN";
      if (discriminator === 0x12 || discriminator === 0x0A) side = "LONG";
      if (discriminator === 0x13 || discriminator === 0x0B) side = "SHORT";

      return {
        action: "TRADE",
        side,
        size: size.toFixed(9),
        price: finalPrice, // Calculated unit price
        fee: "0",
        timestamp
      };
    }

    return null;
  } catch (e) {
    return null;
  }
}

// 主函数
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  解码 History.json - 使用 Final Parser 逻辑');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 读取 history.json
  const historyPath = path.join(process.cwd(), 'data', 'history.json');
  
  if (!fs.existsSync(historyPath)) {
    console.error('❌ 找不到 data/history.json');
    process.exit(1);
  }

  const rawData = fs.readFileSync(historyPath, 'utf-8');
  const oldRecords = JSON.parse(rawData);

  console.log(`📂 读取到 ${oldRecords.length} 条记录\n`);

  // 重新解码所有记录
  const newRecords = [];
  let tradeCount = 0;
  let feeCount = 0;
  let errorCount = 0;

  for (let i = 0; i < oldRecords.length; i++) {
    const old = oldRecords[i];
    
    if (!old.originalLog) {
      console.log(`⚠️  记录 ${i + 1}: 缺少 originalLog，跳过`);
      errorCount++;
      continue;
    }

    // 使用 final parser 逻辑重新解码
    const parsed = parseLog(old.originalLog, old.timestamp || 0);

    if (parsed) {
      const newRecord = {
        signature: old.signature,
        timestamp: parsed.timestamp,
        market: "SOL-PERP",
        action: parsed.action,
        side: parsed.side,
        size: parsed.size,
        price: parsed.price,
        fee: parsed.fee,
        originalLog: old.originalLog
      };

      newRecords.push(newRecord);

      if (parsed.action === "TRADE") {
        tradeCount++;
        console.log(`✅ [${i + 1}] TRADE - Side: ${parsed.side}, Size: ${parsed.size}, Price: ${parsed.price}`);
      } else if (parsed.action === "FEE") {
        feeCount++;
        console.log(`💰 [${i + 1}] FEE - Amount: ${parsed.fee}`);
      }
    } else {
      console.log(`❌ [${i + 1}] 解析失败`);
      errorCount++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  解码统计');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  总记录数: ${oldRecords.length}`);
  console.log(`  TRADE 事件: ${tradeCount}`);
  console.log(`  FEE 事件: ${feeCount}`);
  console.log(`  解析失败: ${errorCount}`);
  console.log(`  成功率: ${((newRecords.length / oldRecords.length) * 100).toFixed(1)}%`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // 保存新文件
  const outputPath = path.join(process.cwd(), 'data', 'history-decoded.json');
  const json = JSON.stringify(newRecords, null, 2);
  fs.writeFileSync(outputPath, json, 'utf-8');

  console.log(`💾 已保存到: ${outputPath}`);
  
  // 显示前3条记录作为样本
  if (newRecords.length > 0) {
    console.log('\n📋 前3条记录预览:\n');
    newRecords.slice(0, 3).forEach((record, idx) => {
      console.log(`${idx + 1}. ${record.action} - ${record.side}`);
      console.log(`   Size: ${record.size}, Price: ${record.price}, Fee: ${record.fee}`);
      console.log(`   Timestamp: ${record.timestamp} (${new Date(record.timestamp * 1000).toISOString()})`);
      console.log('');
    });
  }
}

main().catch(console.error);
