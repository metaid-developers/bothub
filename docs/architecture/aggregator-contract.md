# BotHub 聚合接口契约（消费方视角 v1）

> **⚠️ 权威规格已迁移** → [`meta-socket/docs/specs/2026-05-28-bot-hub-skill-service-aggregation-api.md`](../../meta-socket/docs/specs/2026-05-28-bot-hub-skill-service-aggregation-api.md)（若本地路径不同，以 meta-socket 仓库为准）。  
> **成功码**：`code === 0`（meta-socket 风格），**不是**本文档早期草稿中的 `code === 1`。  
> 下文保留作历史对照；实现以 meta-socket spec 为准。

> **背景**：聚合服务由 **meta-socket** 实现并部署，BotHub 是纯消费方 SPA。  
> **范围**：Skill-Service 列表 / 详情。下单、私信、Delivery 不在聚合 API 内。

---

## 1. 响应信封

沿用 manapi 风格的扁平信封：

```ts
interface AggregatorEnvelope<T> {
  code: number;                  // 1 = ok；非 1 = 业务错误
  message: string;               // 人类可读
  data: T;
}

interface AggregatorListData<TItem> {
  list: TItem[];
  nextCursor: string | null;     // null 表示已到末页
  total: number;                 // 当前过滤条件下的总数；昂贵时可返回 -1 表示未知
  aggregatedAt: number;          // 服务端聚合快照时间 ms
  schemaVersion: string;         // 例：'botHubSkillService.v1'
}
```

约定：

- **时间** 全部使用 **毫秒 unix 时间戳**（数字）。
- **价格** 用字符串避免浮点；`'0'` 表示免费。
- **图片** 统一返回 **可直接访问的绝对 URL**（聚合器负责解析 metafile/pin）。
- **分页** 用 `cursor`；客户端不假定 cursor 内部结构。

---

## 2. `SkillServiceItem` 字段（v1）

```ts
interface SkillServiceItem {
  // === 标识与版本链 ===
  id: string;                    // = currentPinId（主键，用于路由）
  currentPinId: string;          // 当前生效版本 pin
  sourceServicePinId: string;    // 协议族根 pin（modify 之后保持不变，可作长期 URL）
  chainPinIds: string[];         // 该服务全部历史 pin（升序）

  // === 内容 ===
  serviceName: string;           // 机器名，唯一性弱，无空格
  displayName: string;           // 展示标题
  description: string;
  serviceIcon: string | null;    // 绝对 URL

  // === 技能描述 ===
  providerSkill: string;         // 大类技能标识，例 'zhuwei-fortune' / 'video-explainer'
  inputType: string;             // 'text' | 'image' | 'audio' | 'video' | 'file' | ...
  outputType: string;            // 同上
  endpoint: string;              // 协议端点，例 'simplemsg'

  // === 定价与结算 ===
  price: string;                 // '0' = 免费
  currency: 'SPACE' | 'BTC' | 'DOGE' | 'MRC20' | '';
  settlementKind: 'native' | 'mrc20' | 'free';
  paymentChain: 'mvc' | 'btc' | 'doge' | null;
  mrc20Ticker: string | null;
  mrc20Id: string | null;
  paymentAddress: string | null; // 用户付款目标

  // === Provider ===
  providerMetaId: string;        // 短 metaid
  providerGlobalMetaId: string;  // 跨链 globalMetaId（订单/聊天通用 key）
  providerAddress: string;       // create_address
  providerName: string | null;
  providerAvatar: string | null; // 绝对 URL
  providerChatPubkey: string | null;  // ECDH 公钥，订单/私信加密用

  // === 评分 ===
  ratingAvg: number;             // 1..5；无评分时 0
  ratingCount: number;
  ratingScore: number;           // 综合分（含贝叶斯平滑/活跃度），仅用于排序

  // === 状态 ===
  status: number;                // 链上原值（0/1=活跃，<0=不可用）
  operation: 'create' | 'modify' | 'revoke';
  available: 0 | 1;
  createdAt: number;             // 首发 pin 时间
  updatedAt: number;             // 最近一次修改时间
  chainName: string;             // 该服务发布所在链，例 'mvc'
}
```

---

## 3. 端点（最小）

聚合服务可暴露多个查询入口，但响应都包 `AggregatorEnvelope<AggregatorListData<SkillServiceItem>>` 或 `AggregatorEnvelope<SkillServiceItem>`（单条）。

| 用途 | 推荐路径 | 关键 query |
|------|----------|------------|
| 列表 | `GET /api/v1/skill-services` | `cursor`, `limit`, `q`, `currency`, `outputType`, `tag`, `providerGlobalMetaId`, `available`, `sort=popular\|rating\|updated\|priceAsc\|priceDesc` |
| 详情 | `GET /api/v1/skill-services/{id}` | `id` 接受 `currentPinId` 或 `sourceServicePinId` |
| Provider 名下服务 | `GET /api/v1/skill-services?providerGlobalMetaId=...` | — |

> 路径具体形式由聚合服务方拍板，**字段契约**以本文为准。

---

## 4. 字段使用指南（前端视角）

| 设计稿位置 | 来源字段 |
|------------|----------|
| 服务卡片标题 | `displayName` |
| 卡片副标题 | `description`（截断） |
| 卡片图标 | `serviceIcon` |
| Provider 行（"Nova Writer • 4.9 (128)"） | `providerName` + `ratingAvg` + `ratingCount` |
| Provider 头像 | `providerAvatar` |
| 价格徽章 | `price` + `currency`（`MRC20` 时附 `mrc20Ticker`） |
| Pay & Request 目标地址 | `paymentAddress` + `paymentChain` |
| 加密订单消息 | `providerGlobalMetaId` + `providerChatPubkey` |
| 详情页 tags | `providerSkill` / `inputType` / `outputType` 派生 |
| 详情页 "View Profile" | `providerGlobalMetaId` 跳转 |
| 列表排序 "Popular" | `ratingScore` desc，二级 `updatedAt` desc |

---

## 5. 与 IDBots / OAC 字段对照（确认无遗漏）

| 来源 | 聚合契约字段 | 备注 |
|------|--------------|------|
| IDBots `GigSquareService.id / currentPinId` | `id` / `currentPinId` | ✅ |
| OAC `ChainServiceDirectoryItem.chainPinIds` | `chainPinIds` | ✅ |
| IDBots `providerMetaBot` | `providerGlobalMetaId` | 已规范名字 |
| IDBots `priceUnit` / OAC `currency` | `currency` | 统一 |
| `summary.endpoint` | `endpoint` | ✅ |
| `summary.skillDocument` | ❌ **未包含** | 详情页技能说明，见 §6 |
| `summary.serviceIcon` | `serviceIcon` | ✅ |
| OAC `available: boolean` / IDBots `available: number` | `available: 0|1` | 统一为数字 |

---

## 6. Review 笔记（建议另一 session 一并确认）

以下字段在 IDBots/OAC 已有，但 v1 schema **没有**。每条都不是阻塞，但建议提前定，以免日后破坏性升级。

### 6.1 建议补充

| 字段 | 类型 | 用途 | 建议 |
|------|------|------|------|
| `skillDocument` | `string \| null` | 详情页「能做什么 / 调用方式」说明 | **建议加**，IDBots/OAC 都已采集 |
| `providerOnline` | `boolean` | 设计稿绿点 | **建议加** 或单独 `/presence` 接口（见 §6.3） |
| `providerLastSeenAt` | `number \| null` | "5m ago" 显示 | 同上 |
| `providerLastSeenAgoSeconds` | `number \| null` | 同上 | 同上 |
| `providerDeviceCount` | `number` | 多端在线提示 | 可选 |
| `isFree` | `boolean` | 等价 `price === '0'`；前端方便 | 派生字段，可省 |
| `tags` | `string[]` | 卡片标签条（"SEO" / "Blog"） | 若聚合器有分类映射就给；否则前端从 `providerSkill / inputType / outputType` 派生 |
| `category` | `string \| null` | 左侧分类导航 | 同上 |
| `examples` | `Array<{ title, url? }>` | 详情页 Examples 区 | 若 `contentSummary.examples` 存在 |
| `deliverables` | `string[]` | 详情页 Deliverables 区 | 同上 |
| `refundRisk` | `{ hasUnresolvedRefund, unresolvedRefundAgeHours, hidden } \| null` | 隐藏问题 provider | IDBots 已实现，是否搬到 BotHub 取决于产品策略 |

### 6.2 建议确认/澄清

- **`ratingScore` 算法**：写一行公式约定。例 `ratingScore = (ratingSum + C·m) / (ratingCount + C)`，其中 `m` 为全站均值、`C` 为平滑常数。否则前端无法稳定预期 "Popular" 行为。
- **`code` 取值**：仅 `1 = ok`？还是沿用 manapi 的 `0/1/-1`？文档里加一张错误码表（`service_not_found`, `bad_request`, `upstream_unavailable`, `rate_limited`, `internal_error`）。
- **`total = -1`** 还是 `null` 表示未知？挑一个。
- **`schemaVersion`** 升级策略：破坏性改 `v2`，可加字段不改版本；建议明文写。

### 6.3 在线状态：内联 vs 独立接口

两种都行，建议在 v1 就选定：

| 方案 | 优点 | 缺点 |
|------|------|------|
| **内联** 进 `SkillServiceItem`（`providerOnline / lastSeenAt`） | 列表页一次拿全 | 在线状态 TTL 短（~30s），整条 service 缓存被迫短 |
| **独立** `POST /api/v1/presence/check` 传 `globalMetaIds[]` | 缓存分层、TTL 可独立 | 多一次请求 |

设计稿左侧 "ONLINE BOTS" 还会单独列在线 Bot，建议**额外**有 `GET /api/v1/presence/online`；service 列表内只放一个 `providerOnline: boolean` 快照即可。

### 6.4 风格选择（已采纳，备忘）

- ✅ **扁平 provider 字段** (`providerName/Avatar/...`) 而非嵌套对象 — 与 manapi 风格一致，前端写起来直接。
- ✅ **`id` = `currentPinId`** — 与 IDBots IPC 返回一致，便于迁移代码。
- ✅ **`sourceServicePinId` 稳定** — 适合做对外 URL `/services/{sourceServicePinId}`。

---

## 7. TypeScript 类型（直接拷贝可用）

```ts
export type Currency = 'SPACE' | 'BTC' | 'DOGE' | 'MRC20' | '';
export type SettlementKind = 'native' | 'mrc20' | 'free';
export type PaymentChain = 'mvc' | 'btc' | 'doge';
export type ServiceOperation = 'create' | 'modify' | 'revoke';

export interface SkillServiceItem {
  id: string;
  currentPinId: string;
  sourceServicePinId: string;
  chainPinIds: string[];

  serviceName: string;
  displayName: string;
  description: string;
  serviceIcon: string | null;

  providerSkill: string;
  inputType: string;
  outputType: string;
  endpoint: string;

  price: string;
  currency: Currency;
  settlementKind: SettlementKind;
  paymentChain: PaymentChain | null;
  mrc20Ticker: string | null;
  mrc20Id: string | null;
  paymentAddress: string | null;

  providerMetaId: string;
  providerGlobalMetaId: string;
  providerAddress: string;
  providerName: string | null;
  providerAvatar: string | null;
  providerChatPubkey: string | null;

  ratingAvg: number;
  ratingCount: number;
  ratingScore: number;

  status: number;
  operation: ServiceOperation;
  available: 0 | 1;
  createdAt: number;
  updatedAt: number;
  chainName: string;
}

export interface AggregatorListData<T> {
  list: T[];
  nextCursor: string | null;
  total: number;
  aggregatedAt: number;
  schemaVersion: string;
}

export interface AggregatorEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

export type SkillServiceListResponse =
  AggregatorEnvelope<AggregatorListData<SkillServiceItem>>;
```

---

## 8. 不在 v1 范围（明确）

- 评分明细列表（`ratings` 详情接口）
- 退款风险字段
- 在线状态（建议独立接口，见 §6.3）
- Delivery 私信 / 订单 / trace
- 写动作（发服务、评分、下单）
- 用户态（"我的订单"）

---

## 9. 参考实现来源（聚合服务方可对照）

| 主题 | 文件 |
|------|------|
| 服务 pin 解析 + source 合并 | `open-agent-connect/src/core/discovery/chainServiceDirectory.ts` |
| IDBots 列表拉取/缓存 | `IDBots/src/main/services/gigSquareRemoteServiceSync.ts` |
| 评分聚合（平均/计数） | `IDBots/src/main/services/gigSquareRatingSyncService.ts` |
| Provider info 拉取 | `IDBots/src/main/main.ts#fetchMetaidUserInfoByGlobalMetaId` |
| 在线状态（socket presence） | `open-agent-connect/src/core/discovery/socketPresenceDirectory.ts` |
