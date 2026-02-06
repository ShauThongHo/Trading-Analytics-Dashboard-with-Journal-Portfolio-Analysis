# Deriverse 交易分析仪表板

[English](./README.md) | [中文](./README.zh-CN.md)

> **Solana 交易分析仪表板 - 集成交易日志与投资组合分析**

一个全面的 TypeScript 解决方案，用于从 Solana 区块链获取、解码和分析交易历史，具有严格的类型安全和精确的事件解析。

## 🎯 项目概述

本项目提供强大的基础设施：
- ✅ 从 Solana Devnet 获取完整交易历史
- ✅ 无需 IDL 即可解码 Anchor 事件日志（手动 Base64 解码）
- ✅ **通过 quoteAmount/size 公式计算单位价格**
- ✅ **严格的事件类型系统（TradeEvent | FeeEvent | OrderMgmtEvent）**
- ✅ 处理 Solana u64/i64 类型的 BigInt 值
- ✅ **价格合理性过滤（SOL 价格范围 1-5000 USDC）**
- ✅ 导出符合 UI 要求的格式化 JSON

## 📁 项目结构

```
Trading-Analytics-Dashboard/
├── src/
│   ├── types/
│   │   └── trade.ts              # 事件类型定义（TradeEvent、FeeEvent 等）
│   ├── services/
│   │   └── TradeFetcher.ts       # 核心获取、解码及价格计算逻辑
│   ├── scripts/
│   │   ├── run-fetch.ts          # 主执行脚本
│   │   ├── test-final-parser.ts  # 带价格测试的解析器验证
│   │   └── decode-history.ts     # 使用新逻辑重新解码历史记录
│   └── index.ts                  # 模块导出
│
├── data/
│   ├── .gitkeep                  # 在 git 中保留目录
│   └── history.json              # 生成的交易历史（已忽略）
│
├── .env.example                  # 环境变量模板
├── .gitignore                    # Git 忽略规则
├── package.json                  # 依赖项和脚本
├── tsconfig.json                 # TypeScript 配置
├── README.md                     # 英文文档
├── README.zh-CN.md               # 本文件（中文文档）
├── QUICKSTART.md                 # 快速入门指南
└── TRADE_FETCHER_README.md       # 详细技术文档
```

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境
```bash
cp .env.example .env
# 编辑 .env 文件，填入您的 Helius API 密钥和目标钱包地址
```

### 3. 运行交易获取器
```bash
npm run fetch:trades
```

详细设置说明请参阅 [QUICKSTART.md](./QUICKSTART.md)。

## 📚 文档

- **[QUICKSTART.md](./QUICKSTART.md)** - 5 分钟快速上手
- **[TRADE_FETCHER_README.md](./TRADE_FETCHER_README.md)** - 架构深度解析
- **[RATE_LIMIT_CONFIG.md](./RATE_LIMIT_CONFIG.md)** - 根据您的 RPC 方案调整速率限制
- **[DATA_MAPPING_CORRECTED.md](./DATA_MAPPING_CORRECTED.md)** - ✅ 字段映射修正与转换说明

## 🔧 可用脚本

| 命令 | 说明 |
|---------|-------------|
| `npm run fetch:trades` | 获取完整交易历史并保存到 data/history.json |
| `npm run build` | 将 TypeScript 编译为 JavaScript |
| `npm run test:parser` | 测试解析器逻辑和价格计算验证 |
| `npm run decode:history` | 使用更新的逻辑重新解码现有 history.json |

## 🏗️ 架构

### 数据流

```
Solana Devnet
    ↓
Helius RPC API（兼容免费套餐）
    ↓
TradeFetcher.fetchAllTrades()
    ↓
分页循环（getSignaturesForAddress）
    ↓
单笔交易获取（getParsedTransaction）
    ↓
日志提取和 Base64 解码
    ↓
事件类型检测（0x12/0x13=交易，0x17=手续费）
    ↓
字段解析（orderId、size、quoteAmount、timestamp）
    ↓
单位价格计算（price = quoteAmount / size）
    ↓
价格合理性过滤（1-5000 范围）
    ↓
ParsedEvent 数组（TradeEvent | FeeEvent）
    ↓
JSON 导出（严格格式匹配 UI）
    ↓
data/history.json
```

### 核心组件

#### 1. **TradeFetcher 服务** (`src/services/TradeFetcher.ts`)
- 管理与 Solana RPC 的连接（兼容免费套餐）
- 实现获取所有交易的分页功能
- 手动解码 Base64 Anchor 事件
- **通过 quoteAmount/size 公式计算单位价格**
- **过滤不合理的价格（1-5000 USDC 范围）**
- **返回严格类型的 ParsedEvent[]（TradeEvent | FeeEvent）**

#### 2. **类型定义** (`src/types/trade.ts`)
```typescript
// 联合类型系统
type ParsedEvent = TradeEvent | FeeEvent | OrderMgmtEvent;

// 基础事件（公共字段）
interface BaseEvent {
  type: string;
  instrument: string;
  signature: string;
  timestamp: number;
  originalLog: string;
}

// 交易事件
interface TradeEvent extends BaseEvent {
  type: "TRADE";
  orderId: string;
  amount: string;       // 格式化：SOL 数量 "0.02"
  price: string;        // 单位价格："76.18" USDC
  orderType: string;    // "Market"
  orderSide: "Bid" | "Ask";
  role: string;         // "Taker"
  tradeAction: "Buy" | "Sell";
}

// 手续费事件
interface FeeEvent extends BaseEvent {
  type: "FEE";
  orderId: "N/A";
  amount: string;       // 手续费金额："0.000761" USDC
}
```

#### 3. **运行脚本** (`src/scripts/run-fetch.ts`)
- 带进度日志的 CLI 界面
- 环境变量验证
- BigInt 安全的 JSON 序列化
- **显示格式化的交易摘要（"卖出 0.02 @ 76.18"）**
- TRADE 和 FEE 事件的示例输出

## 🔐 环境变量

创建 `.env` 文件：

```env
HELIUS_API_KEY=你的_helius_api_密钥
TARGET_WALLET=你的_solana_钱包地址
```

## 📊 输出格式

获取器生成 `data/history.json`，包含严格格式的事件：

### TradeEvent 结构（交易事件）
```json
{
  "type": "TRADE",
  "instrument": "SOL/USDC",
  "orderId": "6273814",
  "amount": "0.02",
  "price": "76.18",
  "orderType": "Market",
  "orderSide": "Ask",
  "role": "Taker",
  "tradeAction": "Sell",
  "signature": "4bKNcHAtzkmoaezyZjp61fF8hCNXTVg1YUKqURfnHsB1bq...",
  "timestamp": 1770348400,
  "originalLog": "EwAAAAEAAAAWu18AAAAAAAAtMQEAAAAAkD8XAAAAAA..."
}
```

### FeeEvent 结构（手续费事件）
```json
{
  "type": "FEE",
  "instrument": "SOL/USDC",
  "orderId": "N/A",
  "amount": "0.000761",
  "signature": "4bKNcHAtzkmoaezyZjp61fF8hCNXTVg1YUKqURfnHsB1bq...",
  "timestamp": 1770348400,
  "originalLog": "FwAAAAAAAAD5AgAAAAAAAAAAAAAAAAAA"
}
```

## 🧪 测试

使用价格计算验证测试解析器：

```bash
npm run test:parser
```

验证内容包括：
- Base64 到 Buffer 的转换
- 事件类型检测（0x12/0x13/0x17）
- 字段提取（orderId、size、quoteAmount）
- **单位价格计算（quoteAmount / size）**
- 动态时间戳读取
- 价格合理性过滤

使用更新的逻辑重新解码现有历史：
```bash
npm run decode:history
```

## 🎯 核心特性

### 1. 分页支持
使用签名批处理（每次请求 20 个签名）获取**完整**交易历史。

### 2. 手动日志解码与价格计算
无需 IDL 即可解码 Anchor 事件：

**Buffer 布局：**
- **字节 0**：事件标识符
  - `0x12` = LONG/Bid/买入
  - `0x13` = SHORT/Ask/卖出
  - `0x17` = 手续费事件
- **字节 8-16**：订单 ID（u64，小端序）
- **字节 16-24**：交易数量/大小（u64，÷1e9 转换为 SOL）
- **字节 24-32**：Quote 金额 - **总 USDC 价值**（u64，÷1e6 转换为 USDC）
- **最后 8/4 字节**：时间戳（i64 或 u32，取决于缓冲区长度）

**⚠️ 关键发现：**
字节 24-32 包含**总报价金额**（不是单位价格）。

**价格计算公式：**
```typescript
const size = rawSize / 1_000_000_000;       // 转换为 SOL
const quoteAmount = rawQuote / 1_000_000;   // 转换为 USDC
const unitPrice = quoteAmount / size;        // 计算单位价格
```

示例：
- 原始 size：`20000000` → `0.02 SOL`
- 原始 quote：`1523600` → `1.5236 USDC`
- 单位价格：`1.5236 / 0.02 = 76.18 USDC/SOL`

### 3. 价格合理性过滤
过滤不合理的价格以确保数据质量：
```typescript
if (unitPrice < 1 || unitPrice > 5000) {
  return null; // 拒绝不合理的价格
}
```

### 4. 动态时间戳读取
适应不同的缓冲区长度：
- 48+ 字节：从最后 8 字节读取 64 位时间戳
- 40 字节：从最后 4 字节读取 32 位时间戳

### 5. 严格类型系统
联合类型确保编译时安全：
```typescript
type ParsedEvent = TradeEvent | FeeEvent | OrderMgmtEvent;
```

### 6. BigInt 处理
安全序列化 Solana 的 u64/i64 类型：
```typescript
const bigIntReplacer = (key: string, value: any) =>
  typeof value === 'bigint' ? value.toString() : value;

JSON.stringify(trades, bigIntReplacer, 2);
```

### 7. 错误容错
优雅处理：
- 缺失的交易数据
- 无法解析的日志
- **自动重试与指数退避**（2s → 128s，重试 7 次）
- **速率限制保护**（调用之间延迟 2 秒）
- **兼容免费套餐**（单次 API 调用，无批量请求）

## 🔍 故障排除

| 问题 | 解决方案 |
|-------|----------|
| "Cannot convert BigInt to number" | 在 JSON.stringify 中使用 `bigIntReplacer` |
| "Invalid public key" | 验证 TARGET_WALLET 是有效的 Solana 地址 |
| **429 请求过多** | **已包含自动重试（最多 7 次指数退避）。如果持续出现，将 `BATCH_SIZE` 减少到 1-2** |
| **403 批量请求错误** | **使用单次调用（兼容免费套餐）。无需操作** |
| 未找到交易 | 检查钱包是否有 Devnet 活动；查看控制台日志 |
| **价格不合理** | **自动过滤（1-5000 范围）。如需调整，修改 `parseLog()` 中的过滤器** |
| **显示价格为 0** | **除零错误（size=0）。解析器为无效交易返回 null** |
| 获取速度慢 | 免费套餐正常（每 2 秒 3 笔交易）。升级到付费计划以提高速度 |

## 📈 性能

**当前设置（针对免费套餐优化）：**
- **兼容免费套餐**：使用单次 RPC 调用（非批量请求）
- **签名批处理**：每批 20 个签名
- **交易获取**：单次 `getParsedTransaction` 调用（BATCH_SIZE=3）
- **速率限制**：2 秒延迟 + 指数退避（自动重试最多 7 次：2s→4s→8s→16s→32s→64s→128s）
- **内存**：高效流式处理，不在内存中保留完整历史
- **价格过滤**：拒绝 1-5000 USDC 范围之外的价格

**典型速度（免费套餐）：**
- **约 90 笔交易/分钟**（每 2 秒 3 笔交易）
- 小型钱包（<50 笔交易）：**30-40 秒**
- 中型钱包（50-100 笔交易）：**1-2 分钟**
- 大型钱包（100-500 笔交易）：**3-10 分钟**

**最近性能：**
- 12.93 秒获取 11 个事件（0.85 事件/秒）
- 100% 解析成功率
- 输出中 0 个不合理价格

**加速方法：** 升级到付费 RPC 计划，然后在 `TradeFetcher.ts` 中调整：
- 将 `BATCH_SIZE` 增加到 10-50
- 将 `DELAY_MS` 减少到 500-1000ms

## 🚧 路线图

- [x] 实现从 quoteAmount/size 公式计算价格
- [x] 严格的事件类型系统（TradeEvent | FeeEvent | OrderMgmtEvent）
- [x] 价格合理性过滤（1-5000 范围）
- [x] 动态时间戳读取（64 位 / 32 位）
- [x] 手续费事件检测和解析
- [x] 方向/操作映射（Bid/买入，Ask/卖出）
- [ ] OrderMgmtEvent 实现（新建/取消订单）
- [ ] 支持其他市场类型（SOL/USDC 之外）
- [ ] 添加实时 WebSocket 订阅
- [ ] 实现数据验证和异常检测
- [ ] 构建 React 可视化仪表板
- [ ] 添加基于 IDL 的解码支持
- [ ] 实现历史数据缓存
- [ ] 添加投资组合分析功能（盈亏跟踪、统计）

## 🛠️ 技术栈

- **TypeScript** - 类型安全开发
- **@solana/web3.js** - Solana 区块链交互
- **Node.js Buffer** - 二进制数据处理
- **dotenv** - 环境配置

## 📝 许可证

MIT

## 🤝 贡献

欢迎贡献！在提交 PR 之前，请先阅读 [TRADE_FETCHER_README.md](./TRADE_FETCHER_README.md) 中的代码结构。

## 📞 支持

详细技术文档请参阅：
- [TRADE_FETCHER_README.md](./TRADE_FETCHER_README.md) - 架构和实现细节
- [QUICKSTART.md](./QUICKSTART.md) - 设置演练

---

**为 Deriverse Analytics 构建** - 用数据驱动的洞察力赋能交易者
