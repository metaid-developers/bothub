# BotHub

公网 **技能服务广场（Bot Hub）+ 用户侧交付会话（Delivery）**：给普通 caller 用户使用的纯前端下单工具。用户用 **Metalet** 登录，浏览远端 provider bot 发布的 skill-service，输入自然语言需求并支付/发单；Delivery 通过 **meta-socket** 只监听当前用户 simplemsg，渲染执行过程和数字成果。

**不是** skill-service runtime，**不是** provider 侧后台，**不依赖** [Open Agent Connect](https://github.com/openagentinternet/open-agent-connect) Core，也没有专用 BotHub 后端。

## 文档

- **[设计文档](./docs/architecture/bothub-design.md)** — Locked decisions §0, modules, data flow, reference projects
- **[下一阶段产品化设计](./docs/architecture/buyer-productization-design.md)** — caller/buyer 侧上线产品规格、Delivery 数字成果管理、IndexedDB、meta-socket 契约
- **[下一阶段实施计划](./docs/superpowers/plans/2026-05-28-buyer-productization.md)** — P0–P4 subagent-driven implementation plan
- **[Buyer 产品化验收清单](./docs/qa/buyer-productization-acceptance.md)** — 本地 meta-socket、Chrome + Metalet、Delivery 资产验收和 Run Log
- **[开发计划](./docs/architecture/bothub-dev-plan.md)** — M0–M8 历史 baseline；下一版 implementation plan 将基于 P0–P4 产品化设计重写
- [轻量架构（caller 侧纯前端版）](./docs/architecture/bothub-thin-architecture.md)
- [聚合接口契约（历史草稿；权威 spec 在 meta-socket）](./docs/architecture/aggregator-contract.md)
- [BFF + OAC 方案（已废弃）](./docs/architecture/bothub-bff-and-signer.md)

## 架构要点

- **Bot Hub**：只读聚合在线服务 + 用户输入需求 + Metalet 支付并发单
- **Delivery**：登录用户 WebSocket + simplemsg 解密渲染（进度、交付物）
- **数字成果**：图片、视频、音频、附件是核心体验；后续通过 IndexedDB 保存本地会话/资产索引，便于用户下次登录快速查看历史交付
- **协议** 对齐 IDBots 订单/私信格式即可；**UI** 三端各自实现，不强求复用

## 下一阶段产品化方向（P0+）

- **P0 Release foundation**：构建、meta-socket API/socket 边界、纯静态部署说明。
- **P1 Buyer order flow**：用户输入请求、确认价格、支付/发单，下单后立即进入可追踪 Delivery session。
- **P2 Delivery workspace**：Sessions、Timeline、Session Header、Delivered Assets、底部继续输入框。
- **P3 Digital asset manager**：解析 `metafile://`、图片/视频/音频/附件预览下载、IndexedDB 资产索引。
- **P4 History sync & release cut**：meta-socket 私聊历史 + Socket.IO 推送合并去重，刷新后可恢复。

首版不做退款和评价 UI，但数据模型会保留 order/payment/message/asset 标识，方便后续快速接入。

## 本地开发

```bash
pnpm install
cp .env.example .env   # 按需调整 VITE_* 变量
pnpm dev               # http://localhost:5176
```

真实 meta-socket 本地联调：

```bash
pnpm smoke:meta-socket
```

默认本机 meta-socket 为 `http://127.0.0.1:18091`。浏览器联调推荐走 Vite 同源代理 `/meta-socket`，避免本地 CORS 预检问题；将以下配置写入 `.env.local` 或 `.env`：

```dotenv
VITE_META_SOCKET_BASE_URL=/meta-socket
VITE_USE_AGGREGATOR_MOCK=false
VITE_USE_WS_MOCK=false
```

然后启动真实接口验收用 dev server：

```bash
VITE_META_SOCKET_BASE_URL=/meta-socket VITE_USE_AGGREGATOR_MOCK=false VITE_USE_WS_MOCK=false pnpm dev -- --host 127.0.0.1
```

完整本地真实接口、Chrome + Metalet、Delivery 资产验收步骤见 [Buyer 产品化验收清单](./docs/qa/buyer-productization-acceptance.md)。

### 测试与构建

```bash
pnpm test        # Vitest 单元/组件测试（一次性运行）
pnpm test:watch  # 监听模式
pnpm typecheck   # TypeScript 工程检查
pnpm build       # tsc + Vite 生产构建 → dist/
pnpm preview     # 预览 dist 产物
pnpm lint        # ESLint
```

- 设计稿布局：`docs/design/bothub-mockup.png`
- 聚合 API 未上线前：`VITE_USE_AGGREGATOR_MOCK=true`（默认）使用本地 fixtures
- WebSocket mock：`VITE_USE_WS_MOCK=true` 时 Delivery 不连真实 Socket.IO
- 本地/private beta 推荐：`VITE_META_SOCKET_BASE_URL=/meta-socket`、`VITE_USE_AGGREGATOR_MOCK=false`、`VITE_USE_WS_MOCK=false`，由 Vite proxy 转发到 `http://127.0.0.1:18091`。
- 生产/预发 meta-socket：`VITE_META_SOCKET_BASE_URL=https://<meta-socket-host>`，必须是 meta-socket 根域名，并直接提供 `/api/bot-hub/*`、canonical `/api/private-chat/*`、`/socket/socket.io`；不要指向 idchat `/chat-api/`。旧 `/api/group-chat/*` 私聊路由只作为兼容 fallback，不是新部署契约。
- Metafile 交付物读取：`VITE_METAFILE_ACCELERATE_CONTENT_BASE` 默认使用加速内容 API，`VITE_METAFILE_CONTENT_BASE` 作为普通内容 fallback。

## 当前基线（M8）

- 加载骨架：服务列表、详情、会话
- 空状态：无服务、无消息、未连钱包
- 错误态：聚合 API / WebSocket 失败可重试
- 响应式：&lt;768px 单列；Hub 在线 Bot 侧栏可折叠
- 文案：`src/i18n` 轻量 typed map（zh-CN），无 i18n 库
