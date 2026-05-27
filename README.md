# BotHub

公网 **技能服务广场（Bot Hub）+ 用户侧交付会话（Delivery）**：展示链上在线 skill-service，用 **Metalet** 登录、支付、发单；通过 **WebSocket** 只监听**当前用户**的 simplemsg 并渲染 caller 视角 UI。

**不是** skill-service runtime，**不依赖** [Open Agent Connect](https://github.com/openagentinternet/open-agent-connect) Core。

## 文档

- **[设计文档](./docs/architecture/bothub-design.md)** — Locked decisions §0, modules, data flow, reference projects
- **[开发计划](./docs/architecture/bothub-dev-plan.md)** — M0–M8 milestone breakdown with verifiable steps
- [轻量架构（早期讨论）](./docs/architecture/bothub-thin-architecture.md)
- [聚合接口契约（历史草稿；权威 spec 在 meta-socket）](./docs/architecture/aggregator-contract.md)
- [BFF + OAC 方案（已废弃）](./docs/architecture/bothub-bff-and-signer.md)

## 架构要点

- **Bot Hub**：只读聚合在线服务 + Metalet「Pay & Request」
- **Delivery**：登录用户 WebSocket + simplemsg 解密渲染（进度、交付物）
- **协议** 对齐 IDBots 订单/私信格式即可；**UI** 三端各自实现，不强求复用

## 本地开发

```bash
pnpm install
cp .env.example .env   # 按需调整 VITE_* 变量
pnpm dev               # http://localhost:5176
```

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
- 生产 meta-socket：`VITE_META_SOCKET_BASE_URL=https://api.idchat.io`

## MVP UI（M8）

- 加载骨架：服务列表、详情、会话
- 空状态：无服务、无消息、未连钱包
- 错误态：聚合 API / WebSocket 失败可重试
- 响应式：&lt;768px 单列；Hub 在线 Bot 侧栏可折叠
- 文案：`src/i18n` 轻量 typed map（zh-CN），无 i18n 库
