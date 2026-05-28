# meta-socket 本机真实数据对接文档

> 面向 Bothub 开发 AI。本文记录当前这台 Mac 上已经启动并同步过真实 MVC 链上数据的 meta-socket 服务，用于 Bothub 本地开发联调。

## 1. 当前服务状态

- 服务地址：`http://127.0.0.1:18091`
- HTTP API 前缀：`/api`
- Socket.IO 主路径：`/socket/socket.io`
- Socket.IO 兼容路径：`/socket.io`
- 健康检查：`GET http://127.0.0.1:18091/healthz`
- 本轮同步范围：MVC `170726 -> 175046`
- 最新核对时间：`2026-05-28 19:22 CST`
- 最新日志确认：目标块高 `175046` 已完成解析，服务随后继续跟到 `175052`
- 本地启动方式：`launchctl` 后台服务，label 为 `com.codex.meta-socket.mvc30d.18091`
- 本地数据目录：`/tmp/meta-socket-mvc-30d-pebble`
- 日志文件：`/tmp/meta-socket-mvc-30d.err`

停止本机服务：

```bash
launchctl remove com.codex.meta-socket.mvc30d.18091
```

注意：块 `174983` 曾出现一次 `CatchPins error`，原因是某个 transaction output script 超过当前解析器限制。因此 30 天数据整体可用于 Bothub 联调，但该块的数据可能缺失。

## 2. Bothub 本地环境配置

Bothub 当前配置读取 `VITE_META_SOCKET_BASE_URL`。联调真实本地数据时建议在 `.env.local` 使用：

```dotenv
VITE_META_SOCKET_BASE_URL=http://127.0.0.1:18091
VITE_USE_AGGREGATOR_MOCK=false
VITE_USE_WS_MOCK=false
```

如果浏览器前端从 `http://127.0.0.1:5176` 直接请求 `http://127.0.0.1:18091`，会遇到跨端口 CORS 限制；当前 meta-socket 未对 `OPTIONS` 预检返回 CORS 头。推荐在 Vite dev server 做本地代理，例如把 `/meta-socket` 代理到 `http://127.0.0.1:18091`，前端 env 使用同源路径：

```dotenv
VITE_META_SOCKET_BASE_URL=/meta-socket
```

代理方向示例：

```ts
server: {
  port: 5176,
  proxy: {
    '/meta-socket': {
      target: 'http://127.0.0.1:18091',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/meta-socket/, ''),
    },
  },
}
```

如果 Bothub 跑在 Docker 容器内，容器访问宿主机应使用 `http://host.docker.internal:18091`，而不是 `127.0.0.1`。

## 3. BotHub Skill-Service HTTP API

### 3.1 列表

```http
GET /api/bot-hub/skill-service/list
```

可直接打开的真实数据 URL：

```text
http://127.0.0.1:18091/api/bot-hub/skill-service/list?size=20&chainName=mvc&sortBy=updated&order=desc
```

重要：此接口真实分页参数是 `size` + `cursor`，不是 `page` + `pageSize`。如果传 `page=1&pageSize=5`，服务会忽略它们并按默认 `size=20` 返回。

支持 query：

| 参数 | 说明 |
| --- | --- |
| `size` | 每页数量，默认 20，最大 100 |
| `cursor` | 上一页返回的 `data.nextCursor` |
| `keyword` | 按服务名、展示名、描述、provider 等关键词过滤 |
| `currency` | 例如 `SPACE`、`BTC`、`DOGE`、`MRC20` |
| `chainName` | 例如 `mvc` |
| `outputType` | 输出类型过滤，例如 `text` |
| `providerGlobalMetaId` | Provider 过滤 |
| `sortBy` | `rating`、`updated`、`price` |
| `order` | `desc` 或 `asc` |
| `includeInactive` | `true` / `false`，默认 false |

成功响应：

```ts
interface SkillServiceListEnvelope {
  code: 0
  message: ''
  data: {
    list: SkillServiceListItem[]
    nextCursor: string
    total: null
    aggregatedAt: number
    schemaVersion: 'botHubSkillService.v1'
  }
  processingTime: number
}
```

已验证返回的真实服务包括：

- `openagentkey-mock-starter-key`
- `openagentkey-mock-starter-renewal`
- `free-weather-service`
- `token-stats-service`
- `weibo-hot-trend-service`

### 3.2 详情

```http
GET /api/bot-hub/skill-service/detail/:serviceId
```

可直接打开的真实数据 URL：

```text
http://127.0.0.1:18091/api/bot-hub/skill-service/detail/de703c3c1bd5e99f1040f1b1c79d18d40027b52855f0050fcadcea6243673a8ei0?chainName=mvc
```

支持 query：

| 参数 | 说明 |
| --- | --- |
| `chainName` | 建议传 `mvc`，避免跨链同 ID 歧义 |
| `idType` | `auto`、`currentPinId`、`sourceServicePinId`，默认 `auto` |

成功响应：

```ts
interface SkillServiceDetailEnvelope {
  code: 0
  message: ''
  data: {
    service: SkillServiceDetail
    provider: {
      metaid: string
      globalMetaId: string
      address: string
      name: string
      avatar: string
      chatPubkey: string
    }
    aggregatedAt: number
    schemaVersion: 'botHubSkillServiceDetail.v1'
  }
  processingTime: number
}
```

## 4. IDChat 兼容 HTTP API

这些接口主要用于验证 meta-socket 对 IDChat 前端兼容面的覆盖情况。因为本轮只同步 30 天数据，较早的 user init、profile、group create 等元数据可能缺失；近期聊天消息、Bothub skill-service 数据已经有真实返回。

### 4.1 用户信息

```http
GET /api/info/metaid/:metaid
GET /api/info/address/:address
GET /api/info/globalmetaid/:globalMetaId
```

同一组接口也挂在 meta-file-system 兼容前缀下：

```http
GET /metafile-indexer/api/info/metaid/:metaid
GET /metafile-indexer/api/info/address/:address
GET /metafile-indexer/api/info/globalmetaid/:globalMetaId
```

注意：`/api/info/*` 是兼容 meta-file-system 的 legacy 风格，成功码使用 `code === 1`；Bothub skill-service 接口成功码是 `code === 0`。

### 4.2 群聊

```http
GET /api/group-chat/group-chat-list-v2?groupId=&cursor=&size=20
GET /api/group-chat/group-chat-list-by-index?groupId=&startIndex=0&size=20
GET /api/group-chat/group-info?groupId=
GET /api/group-chat/group-person?metaId=&groupId=
GET /api/group-chat/group-user-role?groupId=&metaId=
GET /api/group-chat/group-member-list?groupId=&cursor=&size=20
GET /api/group-chat/search-group-members?groupId=&query=&size=20
GET /api/group-chat/group-list?metaId=&cursor=&size=20
GET /api/group-chat/group-join-control-list?groupId=
GET /api/group-chat/user/latest-chat-info-list?metaId=
GET /api/group-chat/search-users?query=
```

已验证有真实数据的群聊消息 URL：

```text
http://127.0.0.1:18091/api/group-chat/group-chat-list-v2?groupId=396809572f936c66979755477b15ae9adfe9fae119bdabb8f3ffb9a362a176d0i0&cursor=&size=5
```

当前该样例返回 `code=0`，`data.total=422`，消息内容为链上加密内容。

以下 group-chat 路由当前是空 stub，能返回成功信封但不提供真实业务数据：

```http
GET /api/group-chat/community/:communityId/auth/info
GET /api/group-chat/community/auths/:metaId
GET /api/group-chat/community/metaname/:address
GET /api/group-chat/community/ens/:address
GET /api/group-chat/community/:communityId/person/info
GET /api/group-chat/community/:communityId/persons
GET /api/group-chat/community/:communityId/announcements
GET /api/group-chat/group-channel-list
GET /api/group-chat/group-metaid-join-list
GET /api/group-chat/channel-chat-list-v3
GET /api/group-chat/channel-chat-list-by-index
```

### 4.3 私聊

```http
GET /api/group-chat/private-chat-list?metaId=&otherMetaId=&cursor=&size=20
GET /api/group-chat/private-chat-list-by-index?metaId=&otherMetaId=&startIndex=0&size=20
GET /api/group-chat/private-group-paths?metaId=
GET /api/group-chat/chat/homes/:metaid
```

已验证有真实数据的私聊消息 URL：

```text
http://127.0.0.1:18091/api/group-chat/private-chat-list?metaId=1JzFmwf498bXRyFiJTrxikSP7xh9iZ3JrX&otherMetaId=idq160rca8swdygt7hn59em03nqhr96zmjd4yd668z&cursor=&size=5
```

已验证有真实数据的会话列表 URL：

```text
http://127.0.0.1:18091/api/group-chat/chat/homes/1JzFmwf498bXRyFiJTrxikSP7xh9iZ3JrX
```

### 4.4 社区

```http
GET /api/group-chat/community/list?page=1&pageSize=20
GET /api/group-chat/community/:communityId
```

这里使用的是 `page` + `pageSize`，不同于 skill-service 的 `cursor` 分页。

## 5. Socket.IO 对接

### 5.1 正确连接方式

推荐 Bothub 使用 base URL + `path` option 的方式连接，不要把 `/socket/socket.io` 拼到 URL 参数里。

```ts
import { io } from 'socket.io-client'

const socket = io('http://127.0.0.1:18091', {
  path: '/socket/socket.io',
  transports: ['websocket', 'polling'],
  query: {
    metaid: '<current-user-global-metaid-or-metaid>',
    type: 'app', // 或 'pc'
  },
})

socket.on('connect', () => {
  socket.emit('ping')
})

socket.on('heartbeat_ack', () => {
  // server heartbeat ack
})

socket.on('message', (envelope) => {
  // envelope = { M, C, D }
})
```

当前 Bothub 的 `src/ws/socket.ts` 需要特别注意：`io(`${baseUrl}/socket/socket.io`, ...)` 容易被 Socket.IO client 当成 namespace，而不是 Engine.IO path。建议改为：

```ts
const socket = io(baseUrl, {
  path: '/socket/socket.io',
  query: { metaid: globalMetaId, type: 'app' },
  transports: ['websocket', 'polling'],
  reconnection: true,
})
```

### 5.2 心跳与连接限制

- 客户端应每 30 秒左右 `socket.emit('ping')`
- 服务端收到后返回 `heartbeat_ack`
- 服务端会断开 35 秒内未 ping 的连接
- 每个 metaid 最多 `pc` 3 个连接、`app` 3 个连接

### 5.3 推送 envelope

Socket 消息统一从 `message` 事件进入：

```ts
interface SocketEnvelope {
  M: string
  C: number
  D: unknown
}
```

当前已实现的事件类型：

| `M` | 说明 |
| --- | --- |
| `WS_SERVER_NOTIFY_PRIVATE_CHAT` | 私聊消息推送，按 `metaid` 定向发送 |
| `WS_SERVER_NOTIFY_GROUP_CHAT` | 群聊消息推送，按 `group:<groupId>` room 广播 |
| `WS_SERVER_NOTIFY_GROUP_ROLE` | 群角色变化，定向用户并尝试 room 广播 |

已验证项：

- Socket.IO 主路径 `/socket/socket.io` 可以连接
- 兼容路径 `/socket.io` 可以完成 Engine.IO handshake
- 客户端连接后发送 `ping` 可以收到 `heartbeat_ack`

限制项：

- 当前代码没有看到完整的客户端 join group room 入口，因此群聊 room 广播链路可能还不能被 Bothub 直接消费。
- 当前 ZMQ/mempool 实时订阅仍是占位，真实数据主要来自 RPC confirmed block 扫描；新消息会在新区块确认并被扫描后进入本地库和 Socket 推送链路。
- skill-service 聚合器当前不产生 Socket 推送，Bothub 服务列表请用 HTTP 拉取。

### 5.4 在线状态接口

```http
GET /socket/online/stats
GET /socket/online/list?page=1&size=20
```

示例：

```text
http://127.0.0.1:18091/socket/online/stats
```

## 6. 推荐给 Bothub 开发 AI 的对接顺序

1. 先关闭 mock：`VITE_USE_AGGREGATOR_MOCK=false`。
2. 处理 CORS：优先加 Vite proxy，把 `VITE_META_SOCKET_BASE_URL` 设为同源 `/meta-socket`。
3. 用 `/api/bot-hub/skill-service/list?size=20&chainName=mvc&sortBy=updated&order=desc` 替换 fixture 列表源。
4. 用 `/api/bot-hub/skill-service/detail/:serviceId?chainName=mvc` 替换 fixture 详情源。
5. 修正 Socket.IO 连接方式：`io(baseUrl, { path: '/socket/socket.io', ... })`。
6. 先验收 Socket 连接、心跳和私聊 `message` envelope；群聊 room 推送作为后续项。
7. 如果需要完整 IDChat profile 或 group metadata，不要只依赖当前 30 天数据，需要扩大同步起点到更早块高。

## 7. 快速 curl 验证

```bash
curl -sS http://127.0.0.1:18091/healthz

curl -sS 'http://127.0.0.1:18091/api/bot-hub/skill-service/list?size=2&chainName=mvc&sortBy=updated&order=desc'

curl -sS 'http://127.0.0.1:18091/api/bot-hub/skill-service/detail/de703c3c1bd5e99f1040f1b1c79d18d40027b52855f0050fcadcea6243673a8ei0?chainName=mvc'

curl -sS 'http://127.0.0.1:18091/api/group-chat/group-chat-list-v2?groupId=396809572f936c66979755477b15ae9adfe9fae119bdabb8f3ffb9a362a176d0i0&cursor=&size=2'

curl -sS 'http://127.0.0.1:18091/socket/online/stats'
```

