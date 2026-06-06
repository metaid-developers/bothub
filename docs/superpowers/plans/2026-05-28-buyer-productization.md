# Buyer Productization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Each implementation task gets a fresh implementer subagent, then a fresh spec-review subagent, then a fresh code-quality review subagent. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn BotHub into a basic usable pure-frontend buyer-side product: live metaso-p2p service browsing, request/pay/order flow, Delivery session tracking, delivered asset preview/download, IndexedDB cache, history sync, and release-grade verification.

**Architecture:** Vite + React + TypeScript SPA talks directly to metaso-p2p through a same-origin Vite proxy in dev and configurable production base URLs. Metalet performs wallet identity, payment, encryption, and pin creation. Delivery normalizes local pending orders, HTTP private-chat history, and Socket.IO pushes into wallet-scoped IndexedDB stores and React views.

**Tech Stack:** Vite 5, React 18, TypeScript 5 strict, Tailwind CSS 3, Headless UI, Heroicons, React Router v6, TanStack Query v5, zustand, socket.io-client 4.8, IndexedDB, Vitest + Testing Library, Chrome + Metalet for manual acceptance.

---

## Source Documents

- Product design: `docs/architecture/buyer-productization-design.md`
- Local metaso-p2p API: `docs/architecture/metaso-p2p-local-api.md`
- Current architecture baseline: `docs/architecture/bothub-design.md`
- Historical implementation baseline: `docs/architecture/bothub-dev-plan.md`
- IDBots order payload reference: `/Users/tusm/Documents/MetaID_Projects/IDBots/IDBots/src/main/shared/orderMessage.js`
- IDBots A2A delivery rendering reference: `/Users/tusm/Documents/MetaID_Projects/IDBots/IDBots/src/renderer/components/cowork/A2AMessageItem.tsx`

## Execution Model

This work must be executed in subagent-driven mode.

Controller rules:

- Create or switch to a feature branch before coding, for example `codex/buyer-productization`.
- Dispatch exactly one fresh implementer subagent per task below.
- Do not dispatch parallel implementers. Tasks are intentionally ordered because several build on shared Delivery domain types.
- Provide the implementer only the task text, source document paths, and relevant file list. Do not rely on inherited conversation context.
- After the implementer reports done, run local verification in the controller workspace.
- Dispatch a fresh spec-review subagent for that task.
- If spec review finds issues, send the same implementer or a focused fix subagent to correct them, then re-run spec review.
- Only after spec review passes, dispatch a fresh code-quality review subagent.
- If code-quality review finds issues, send the implementer/fix subagent to correct them, then re-run code-quality review.
- Mark a task complete only after tests pass and both reviews pass.
- Commit each completed task using AGENTS.md rules. Commit message format: `feat: ...`, `fix: ...`, `refactor: ...`, `docs: ...`, or `chore: ...`.
- Before every commit, run `git status --short` and inspect the diff. Stage only task-owned files that the implementer changed and understands. Do not use broad `git add src`, `git add tests`, or `git add .`. Do not stage deletions unless the user explicitly says `commit`.
- After each commit, use the `metabot-post-buzz` skill with the Eric identity to publish a development journal entry.
- After all tasks pass, dispatch one final independent review subagent to inspect the whole implementation end to end.

Computer-use / Chrome acceptance rules:

- Use Chrome with the installed Metalet extension for manual acceptance when a task needs wallet/browser proof.
- Browser login/connection is allowed by the user's request.
- Do not approve, sign, or broadcast any Metalet transaction, `createPin`, payment, private-message write, key creation, or permission escalation through Computer Use without action-time user confirmation.
- Prefer free test services for flow preparation. A free service may still create an irreversible on-chain `/private/chat/simplemsg` pin, so stop before the final Metalet sign/broadcast step and ask the user.
- If a paid order is needed, stop before the Metalet payment confirmation and ask the user.
- Do not transmit sensitive data beyond the test request text needed for local acceptance.

## Baseline Facts

- Local metaso-p2p is available at `http://127.0.0.1:18091`.
- Recommended dev env uses Vite proxy and same-origin base:

```dotenv
VITE_METASO_P2P_BASE_URL=/metaso-p2p
VITE_USE_AGGREGATOR_MOCK=false
VITE_USE_WS_MOCK=false
```

- Vite proxy target:

```ts
server: {
  port: 5176,
  proxy: {
    '/metaso-p2p': {
      target: 'http://127.0.0.1:18091',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/metaso-p2p/, ''),
    },
  },
}
```

- Socket.IO must use `io(baseUrl, { path: '/socket/socket.io', query: { metaid, type: 'app' } })`, not `io(baseUrl + '/socket/socket.io')`.
- `pnpm build` currently fails with `TS18048` in `src/wallet/useWallet.ts` rehydrate handling. Fix this in Task 1.
- `pnpm test` currently passes: 19 files, 67 tests.
- Local metaso-p2p smoke already returns real data:
  - `GET /healthz` returns `code=0`
  - `GET /api/bot-hub/skill-service/list?size=3&chainName=mvc&sortBy=updated&order=desc` returns real services including `openagentkey-mock-starter-key`, `openagentkey-mock-starter-renewal`, and `free-weather-service`
  - `GET /socket/online/stats` returns `code=0`
  - Socket.IO must still be smoke-tested with a real client connection, `ping`, and `heartbeat_ack`; HTTP online stats alone is not sufficient.

## Planned File Map

Expected created files:

- `src/api/http.ts` — shared envelope fetch and base URL helpers.
- `src/api/privateChat.ts` — metaso-p2p private-chat history and conversation homes client.
- `src/delivery/db.ts` — IndexedDB facade and migrations.
- `src/delivery/domain.ts` — shared buyer order/session/message/asset types.
- `src/delivery/orderStore.ts` — pending/completed buyer order actions backed by IndexedDB.
- `src/delivery/protocol.ts` — protocol tag and `[DELIVERY]` parser.
- `src/delivery/assetParser.ts` — `metafile://` parser and media kind detection.
- `src/delivery/deliverySync.ts` — cache hydrate, history fetch, live merge orchestration.
- `src/components/delivery/SessionHeader.tsx`
- `src/components/delivery/DeliveryComposer.tsx`
- `src/components/delivery/DeliveredAssetsPanel.tsx`
- `src/components/delivery/AssetPreviewCard.tsx`
- `scripts/smoke-metaso-p2p.mjs`
- `docs/qa/metaso-p2p-private-chat-contract.md`
- `docs/qa/buyer-productization-acceptance.md`
- Tests mirroring each new module under `tests/`.

Expected modified files:

- `vite.config.ts`
- `.env.example`
- `README.md`
- `package.json` and `pnpm-lock.yaml` only if a test dependency such as `fake-indexeddb` is needed.
- `src/api/config.ts`
- `src/api/aggregator.ts`
- `src/api/queries.ts`
- `src/ws/socket.ts`
- `src/ws/useSocket.ts`
- `src/ws/privateChat.ts`
- `src/wallet/useWallet.ts`
- `src/order/flow.ts`
- `src/components/hub/RequestModal.tsx`
- `src/routes/Delivery.tsx`
- `src/components/delivery/MessageBubble.tsx`
- `src/components/delivery/MessageList.tsx`
- `src/components/delivery/SessionsList.tsx`
- `src/delivery/messageStore.ts`
- `src/delivery/sessionGrouping.ts`
- `src/delivery/messageDisplay.ts`
- `src/i18n/zh-CN.ts`

---

## Task 1: P0 Release Foundation and Local metaso-p2p Wiring

**Purpose:** Make the current app buildable and connectable to local real metaso-p2p data without CORS issues.

**Files:**

- Modify: `src/wallet/useWallet.ts`
- Modify: `vite.config.ts`
- Modify: `.env.example`
- Modify: `src/api/config.ts`
- Modify: `src/api/aggregator.ts`
- Modify: `src/ws/socket.ts`
- Test: `tests/wallet/useWallet.test.tsx`
- Test: `tests/api/aggregator.test.ts`
- Test: `tests/ws/socket.test.ts` (create if absent)

- [ ] **Step 1: Add failing tests for current gaps**

Add tests that prove:

- `useWallet` rehydrate callback handles `undefined` state without TypeScript errors.
- HTTP base `/metaso-p2p` produces `/metaso-p2p/api/bot-hub/...` URLs.
- `connectSocket` calls Socket.IO with base URL and `path: '/socket/socket.io'`.
- `buildSocketUrl` is removed or changed so it no longer encourages namespace-style Socket.IO usage.

Run:

```bash
pnpm test wallet api ws
pnpm build
```

Expected before implementation:

- Relevant new socket/config test fails.
- `pnpm build` fails on `src/wallet/useWallet.ts`.

- [ ] **Step 2: Fix wallet rehydrate typing**

In `src/wallet/useWallet.ts`, avoid mutating a maybe-undefined `state` directly. Use an early return:

```ts
onRehydrateStorage: () => (state) => {
  if (!state) return
  if (!state.identity?.globalMetaId?.trim()) {
    state.identity = null
    state.status = 'disconnected'
    state.errorMessage = null
  }
}
```

- [ ] **Step 3: Add Vite proxy**

In `vite.config.ts`, add the `/metaso-p2p` proxy from `docs/architecture/metaso-p2p-local-api.md`.

- [ ] **Step 4: Update env docs**

In `.env.example`, document local real-data mode:

```dotenv
VITE_METASO_P2P_BASE_URL=/metaso-p2p
VITE_USE_AGGREGATOR_MOCK=false
VITE_USE_WS_MOCK=false
```

Keep production example `https://api.idchat.io` as a commented option.

- [ ] **Step 5: Normalize HTTP base helpers**

In `src/api/config.ts`, add a helper that trims trailing slashes but preserves relative bases:

```ts
export function getNormalizedMetasoP2PBaseUrl(): string {
  return (import.meta.env.VITE_METASO_P2P_BASE_URL ?? '').replace(/\/+$/, '')
}
```

Use it from `src/api/aggregator.ts`.

- [ ] **Step 6: Fix Socket.IO connection**

In `src/ws/socket.ts`, replace:

```ts
io(`${baseUrl}/socket/socket.io`, { query: ... })
```

with:

```ts
io(baseUrl, {
  path: '/socket/socket.io',
  query: { metaid: globalMetaId, type: 'app' },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1_000,
  reconnectionDelayMax: RECONNECTION_DELAY_MAX_MS,
})
```

If `baseUrl` is relative (`/metaso-p2p`), confirm Socket.IO works with that base and path under Vite proxy. If it does not, add a documented `VITE_METASO_P2P_SOCKET_BASE_URL` override and test both paths.

- [ ] **Step 7: Verify**

Run:

```bash
pnpm test wallet api ws
pnpm build
pnpm test
```

Expected:

- All tests pass.
- `pnpm build` succeeds.

- [ ] **Step 8: Commit**

```bash
git status --short
# stage only task-owned changed files after inspecting the diff
git commit -m "fix: wire local metaso-p2p and restore production build"
```

Then post an Eric development-journal buzz.

---

## Task 2: P0 Real metaso-p2p Smoke Script and API Contract Fixtures

**Purpose:** Give every later task a reliable local verification command against the real metaso-p2p service.

**Files:**

- Create: `scripts/smoke-metaso-p2p.mjs`
- Create: `tests/fixtures/metaso-p2p/service-list-live-shape.json`
- Create: `tests/fixtures/metaso-p2p/service-detail-live-shape.json`
- Modify: `package.json`
- Modify: `README.md`
- Test: `tests/api/metasoP2PShape.test.ts`

- [ ] **Step 1: Add fixture-based shape tests**

Create fixture tests that assert real local response shape without depending on live service availability:

```ts
import listEnvelope from '../fixtures/metaso-p2p/service-list-live-shape.json'

it('matches skill-service list v1 shape', () => {
  expect(listEnvelope.code).toBe(0)
  expect(Array.isArray(listEnvelope.data.list)).toBe(true)
  expect(listEnvelope.data.schemaVersion).toBe('botHubSkillService.v1')
  expect(listEnvelope.data.list[0]).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      serviceName: expect.any(String),
      providerGlobalMetaId: expect.any(String),
      paymentAddress: expect.any(String),
    }),
  )
})
```

- [ ] **Step 2: Add smoke script**

`scripts/smoke-metaso-p2p.mjs` should:

- Read `METASO_P2P_BASE_URL`, default `http://127.0.0.1:18091`.
- Read `METASO_P2P_SMOKE_METAID`, default `bothub-smoke-metaid`.
- Check `/healthz`.
- Fetch `/api/bot-hub/skill-service/list?size=3&chainName=mvc&sortBy=updated&order=desc`.
- Fetch detail for the first returned service id with `?chainName=mvc`.
- Check `/socket/online/stats`.
- Use `socket.io-client` to connect to `METASO_P2P_BASE_URL` with:

```js
io(baseUrl, {
  path: '/socket/socket.io',
  transports: ['websocket', 'polling'],
  query: { metaid: smokeMetaid, type: 'app' },
})
```

- After socket `connect`, emit `ping`, wait for `heartbeat_ack`, then disconnect cleanly.
- Print compact JSON summary.
- Exit non-zero on network failure, non-zero `code`, empty list, missing detail provider, socket connect failure, or missing `heartbeat_ack`.

- [ ] **Step 3: Add package script**

In `package.json`:

```json
"smoke:metaso-p2p": "node scripts/smoke-metaso-p2p.mjs"
```

- [ ] **Step 4: Update README local development section**

Document:

```bash
pnpm smoke:metaso-p2p
VITE_METASO_P2P_BASE_URL=/metaso-p2p
VITE_USE_AGGREGATOR_MOCK=false
VITE_USE_WS_MOCK=false
pnpm dev
```

- [ ] **Step 5: Verify**

Run:

```bash
pnpm test api
pnpm smoke:metaso-p2p
pnpm build
```

Expected:

- Fixture tests pass offline.
- Smoke script reports at least one real service.
- Smoke script proves Socket.IO can connect on `path: '/socket/socket.io'` and receive `heartbeat_ack`.
- Build remains green.

- [ ] **Step 6: Commit**

```bash
git status --short
# stage only task-owned changed files after inspecting the diff
git commit -m "chore: add local metaso-p2p smoke verification"
```

Then post an Eric development-journal buzz.

---

## Task 2A: P0 Private Chat History Contract Spike

**Purpose:** Verify private-chat history identity parameters and payload shape before Delivery persistence and sync tasks build on assumptions.

**Files:**

- Modify: `scripts/smoke-metaso-p2p.mjs`
- Create: `docs/qa/metaso-p2p-private-chat-contract.md`
- Create: `tests/fixtures/metaso-p2p/private-chat-homes-live-shape.json`
- Create: `tests/fixtures/metaso-p2p/private-chat-list-live-shape.json`
- Test: `tests/api/metasoP2PShape.test.ts`

- [ ] **Step 1: Add private-chat fixtures and shape tests**

Fixtures should match the local API doc samples:

```text
GET /api/group-chat/chat/homes/1JzFmwf498bXRyFiJTrxikSP7xh9iZ3JrX
GET /api/group-chat/private-chat-list?metaId=1JzFmwf498bXRyFiJTrxikSP7xh9iZ3JrX&otherMetaId=idq160rca8swdygt7hn59em03nqhr96zmjd4yd668z&cursor=&size=5
```

Tests must assert:

- Both endpoints return `code = 0`.
- Homes response contains a list-like conversation payload, or document if local data returns an empty but valid list.
- Private-chat list returns `data.list`.
- Each private-chat row can be normalized into the existing `PrivateChatItem` shape or the exact differences are documented in `docs/qa/metaso-p2p-private-chat-contract.md`.

- [ ] **Step 2: Extend smoke script with optional private-chat contract check**

Add env vars:

```bash
METASO_P2P_PRIVATE_CHAT_METAID=1JzFmwf498bXRyFiJTrxikSP7xh9iZ3JrX
METASO_P2P_PRIVATE_CHAT_OTHER_METAID=idq160rca8swdygt7hn59em03nqhr96zmjd4yd668z
```

When both are set, `pnpm smoke:metaso-p2p` must:

- Fetch `chat/homes/:metaid`.
- Fetch `private-chat-list`.
- Print whether `metaId` is address-like/local-metaid/global-metaid according to observed data.
- Print whether HTTP private messages match the Socket.IO `PrivateChatItem` field names used by `src/ws/privateChat.ts`.
- Exit non-zero if the endpoint returns non-zero `code` or if the list shape is unusable.

Default behavior may skip private-chat live checks when env vars are absent, but the task must run them with the known local sample before completion.

- [ ] **Step 3: Document contract result**

`docs/qa/metaso-p2p-private-chat-contract.md` must record:

- Exact local URLs tested.
- Whether `metaId` currently expects wallet MVC address, local metaid, or globalMetaId.
- Whether `otherMetaId` currently expects provider globalMetaId or another identity.
- Whether `/api/group-chat/chat/homes/:metaid` is reliable enough as conversation discovery.
- Whether HTTP private-chat rows can share `src/ws/privateChat.ts` normalization.
- Remaining uncertainty, if any, and how Task 10 should handle it.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm test api ws
METASO_P2P_PRIVATE_CHAT_METAID=1JzFmwf498bXRyFiJTrxikSP7xh9iZ3JrX METASO_P2P_PRIVATE_CHAT_OTHER_METAID=idq160rca8swdygt7hn59em03nqhr96zmjd4yd668z pnpm smoke:metaso-p2p
pnpm build
```

- [ ] **Step 5: Commit**

Run `git status --short`, inspect the diff, stage only task-owned changed files, then commit:

```bash
git commit -m "chore: verify local private chat history contract"
```

Then post an Eric development-journal buzz.

---

## Task 3: P1 IndexedDB Foundation and Delivery Domain Types

**Purpose:** Create the local persistence layer before adding pending orders, assets, and history sync.

**Files:**

- Create: `src/delivery/domain.ts`
- Create: `src/delivery/db.ts`
- Test: `tests/delivery/db.test.ts`
- Test: `tests/delivery/domain.test.ts`
- Modify: `package.json` and `pnpm-lock.yaml` only if `fake-indexeddb` is added for tests.

- [ ] **Step 1: Write domain type tests**

Test deterministic id helpers:

```ts
expect(buildSessionId({
  walletGlobalMetaId: 'idq-user',
  providerGlobalMetaId: 'idq-provider',
  orderCorrelationId: 'abc',
})).toBe('idq-user:idq-provider:abc')
```

Required helpers:

- `buildOrderId(walletGlobalMetaId, providerGlobalMetaId, orderCorrelationId)`
- `buildSessionId({ walletGlobalMetaId, providerGlobalMetaId, orderCorrelationId })`
- `buildAssetId(sessionId, uri)`
- `normalizeOrderCorrelationId(value)`

- [ ] **Step 2: Define domain types**

Create `src/delivery/domain.ts` with exported types from `buyer-productization-design.md`:

- `BuyerOrder`
- `BuyerOrderStatus`
- `DeliverySessionRecord`
- `DeliverySessionStatus`
- `DeliveryMessageRecord`
- `DeliveryAssetRecord`
- `DeliverySyncState`

Do not move UI-only `DeliveryMessage` yet; later tasks can migrate incrementally.

- [ ] **Step 3: Write IndexedDB tests**

Tests must cover:

- Opening DB creates stores `orders`, `sessions`, `messages`, `assets`, `syncState`.
- `putOrder` then `getOrdersForWallet`.
- `putSession` then `getSessionsForWallet`.
- `putMessage` de-dupes by id.
- `putAsset` de-dupes by id.
- `clearWalletData(walletGlobalMetaId)` removes only that wallet's rows.

- [ ] **Step 4: Implement small IndexedDB facade**

`src/delivery/db.ts` should expose:

```ts
export const DELIVERY_DB_NAME = 'bothub-buyer-v1'
export const DELIVERY_DB_VERSION = 1

export function openDeliveryDb(): Promise<IDBDatabase>
export async function putOrder(order: BuyerOrder): Promise<void>
export async function getOrdersForWallet(walletGlobalMetaId: string): Promise<BuyerOrder[]>
export async function putSession(session: DeliverySessionRecord): Promise<void>
export async function getSessionsForWallet(walletGlobalMetaId: string): Promise<DeliverySessionRecord[]>
export async function putMessage(message: DeliveryMessageRecord): Promise<void>
export async function getMessagesForSession(sessionId: string): Promise<DeliveryMessageRecord[]>
export async function putAsset(asset: DeliveryAssetRecord): Promise<void>
export async function getAssetsForSession(sessionId: string): Promise<DeliveryAssetRecord[]>
export async function putSyncState(state: DeliverySyncState): Promise<void>
export async function clearWalletData(walletGlobalMetaId: string): Promise<void>
```

Keep implementation dependency-free unless testing IndexedDB requires `fake-indexeddb`.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm test delivery
pnpm build
```

- [ ] **Step 6: Commit**

```bash
git status --short
# stage only task-owned changed files after inspecting the diff
git commit -m "feat: add indexeddb delivery persistence foundation"
```

Then post an Eric development-journal buzz.

---

## Task 4: P1 Pending Order Persistence and Immediate Delivery Session

**Purpose:** After Pay & Request, the buyer immediately sees a pending Delivery session that survives refresh.

**Files:**

- Create: `src/delivery/orderStore.ts`
- Modify: `src/order/flow.ts`
- Modify: `src/components/hub/RequestModal.tsx`
- Modify: `src/delivery/messageStore.ts`
- Modify: `src/delivery/sessionGrouping.ts`
- Modify: `src/routes/Delivery.tsx`
- Test: `tests/delivery/orderStore.test.ts`
- Test: `tests/order/flow.test.ts`
- Test: `tests/components/hub/RequestModal.test.tsx` if absent, otherwise extend existing component tests.

- [ ] **Step 1: Add failing tests**

Tests must prove:

- A free order creates `BuyerOrder.status = 'pending_provider'`.
- A paid order records `paymentTxid` and `orderPinId`.
- `RequestModal` calls pending-order persistence before navigating to Delivery.
- Delivery session list includes a pending session even if no provider message exists.

- [ ] **Step 2: Return complete order metadata from `executePayAndRequest`**

Extend result minimally:

```ts
export interface ExecutePayAndRequestResult {
  paymentTxid: string
  paymentCommitTxid: string
  orderReference: string
  orderPinId: string
  sessionKey: string
  orderPayload: string
  displaySummary: string
}
```

Keep existing callers working.

- [ ] **Step 3: Implement `orderStore`**

Expose:

```ts
export async function persistPendingOrder(input: {
  wallet: WalletIdentity
  service: SkillServiceCore
  provider: ProviderInfo
  prompt: string
  result: ExecutePayAndRequestResult
}): Promise<{ order: BuyerOrder; session: DeliverySessionRecord; message: DeliveryMessageRecord }>
```

This should:

- Store `BuyerOrder`.
- Store `DeliverySessionRecord` with status `pending`.
- Store an outgoing order message record from the plaintext order payload.
- Use wallet globalMetaId and provider globalMetaId in every row.

- [ ] **Step 4: Wire RequestModal**

After `executePayAndRequest` succeeds and before navigation:

```ts
await persistPendingOrder({ wallet, service, provider, prompt, result })
useMessageStore.getState().hydrateFromDb(wallet.globalMetaId)
navigate(buildDeliverySessionPath(result.sessionKey))
```

If persisting fails, do not hide order success. Show a warning in Delivery later; do not make user pay again.

- [ ] **Step 5: Hydrate pending sessions in Delivery**

Add `hydrateFromDb(walletGlobalMetaId)` to `messageStore`, or create a small delivery view store that loads sessions/messages from DB. Keep changes scoped; do not redesign the whole UI yet.

- [ ] **Step 6: Verify**

Run:

```bash
pnpm test order delivery components/hub
pnpm build
```

Manual:

- With mock payment/wallet tests, confirm pending session route is generated.
- Do not perform real paid Metalet payment in this task.

- [ ] **Step 7: Commit**

```bash
git status --short
# stage only task-owned changed files after inspecting the diff
git commit -m "feat: persist pending buyer orders into delivery"
```

Then post an Eric development-journal buzz.

---

## Task 5: P2 Delivery Protocol Parser

**Purpose:** Normalize provider messages into order status, delivery result, completion, rating reservation, plain text, and asset candidates.

**Files:**

- Create: `src/delivery/protocol.ts`
- Create: `src/delivery/assetParser.ts`
- Modify: `src/api/config.ts`
- Modify: `src/vite-env.d.ts`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `src/delivery/messageDisplay.ts`
- Modify: `src/delivery/orderParser.ts` only if shared helpers are needed.
- Test: `tests/delivery/protocol.test.ts`
- Test: `tests/delivery/assetParser.test.ts`

- [ ] **Step 1: Add parser tests**

Cover:

```ts
parseDeliveryProtocol('[ORDER_STATUS:abcd] generating video')
parseDeliveryProtocol('[DELIVERY] {"result":"done metafile://abc123i0.png"}')
parseDeliveryProtocol('[ORDER_END:abcd] complete')
parseDeliveryProtocol('[NeedsRating:abcd]')
parseMetafileUri('metafile://abc123i0.mp4')
extractMetafileAssets('Here metafile://abc123i0.png and metafile://abc123i0.png')
```

Expected:

- Known protocol tag is captured and stripped.
- Order correlation id is captured when present.
- Delivery JSON `result` is extracted.
- Duplicate metafile URIs are removed.
- Image/video/audio/document/archive/other kind detection works.

- [ ] **Step 2: Implement protocol parser**

Export:

```ts
export type DeliveryProtocolKind =
  | 'plain'
  | 'order_status'
  | 'delivery'
  | 'order_end'
  | 'needs_rating'

export interface ParsedDeliveryProtocol {
  kind: DeliveryProtocolKind
  orderCorrelationId: string
  displayText: string
  rawText: string
  deliveryResult: string
  structuredPayload: Record<string, unknown> | null
}

export function parseDeliveryProtocol(content: string): ParsedDeliveryProtocol
```

- [ ] **Step 3: Implement asset parser**

Use IDBots behavior as reference but keep the module framework-neutral:

```ts
export interface ParsedDeliveryAsset {
  uri: string
  pinId: string
  extension: string | null
  filename: string
  kind: 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other'
  mimeType?: string
  previewUrl: string
  downloadUrl: string
  fallbackUrl: string
}
```

Configurable file bases should come from env helpers, defaulting to IDBots-compatible `https://file.metaid.io/metafile-indexer/api/v1/files/accelerate/content` and normal content fallback.

Add env names to `.env.example` and `src/vite-env.d.ts` if the repo declares typed Vite env values:

```dotenv
VITE_METAFILE_ACCELERATE_CONTENT_BASE=https://file.metaid.io/metafile-indexer/api/v1/files/accelerate/content
VITE_METAFILE_CONTENT_BASE=https://file.metaid.io/metafile-indexer/api/v1/files/content
```

- [ ] **Step 4: Wire message variant**

Update `getMessageVariant` to distinguish:

- `order`
- `status`
- `delivery`
- `completion`
- `rating_reserved`
- `system`
- `text`

Do not redesign UI yet; simple display is enough in this task.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm test delivery
pnpm build
```

- [ ] **Step 6: Commit**

```bash
git status --short
# stage only task-owned changed files after inspecting the diff
git commit -m "feat: parse delivery protocol messages and metafile assets"
```

Then post an Eric development-journal buzz.

---

## Task 6: P2 Delivery Workspace Layout

**Purpose:** Make Delivery look and behave like a product workspace rather than a basic chat page.

**Files:**

- Create: `src/components/delivery/SessionHeader.tsx`
- Create: `src/components/delivery/DeliveredAssetsPanel.tsx` (simple placeholder backed by current store; Task 8 enriches it)
- Modify: `src/routes/Delivery.tsx`
- Modify: `src/components/delivery/SessionsList.tsx`
- Modify: `src/components/delivery/MessageList.tsx`
- Modify: `src/components/delivery/MessageBubble.tsx`
- Modify: `src/i18n/zh-CN.ts`
- Test: `tests/components/delivery/SessionHeader.test.tsx`
- Test: `tests/components/delivery/SessionsList.test.tsx`
- Test: `tests/components/delivery/MessageBubble.test.tsx`

- [ ] **Step 1: Use frontend skill**

The implementer must use the available frontend UI/design skill before editing UI files. Match the approved mockup direction: dark, dense, work-focused, no marketing hero, no nested cards.

- [ ] **Step 2: Add component tests**

Tests must assert:

- Session header renders provider/service/status.
- Sessions list displays status and asset count.
- Status/delivery/completion messages render distinct accessible labels.
- Empty selected session state remains useful.

- [ ] **Step 3: Restructure Delivery layout**

Desktop:

```text
Sessions column | Main timeline column | Delivered Assets panel
```

Mobile:

```text
Session selector
Session header
Timeline
Delivered Assets
Composer placeholder (Task 7)
```

Keep stable dimensions and avoid text overlap.

- [ ] **Step 4: Add session status presentation**

Map statuses:

- `pending` -> "Waiting for provider"
- `active` -> "In progress"
- `delivering` -> "Delivering"
- `delivered` -> "Delivered"
- `completed` -> "Completed"
- `failed` -> "Needs attention"

- [ ] **Step 5: Upgrade message bubbles**

Use `parseDeliveryProtocol`:

- Status messages should be compact timeline events.
- Delivery messages should show result text plus asset previews placeholder.
- Order messages remain collapsible.
- Decryption errors remain visible as diagnostics.

- [ ] **Step 6: Verify**

Run:

```bash
pnpm test components/delivery delivery
pnpm build
```

Manual browser check with mock data:

- Delivery has no overlapping text at desktop and mobile widths.
- Sessions/timeline/assets regions are visible.

- [ ] **Step 7: Commit**

```bash
git status --short
# stage only task-owned changed files after inspecting the diff
git commit -m "feat: redesign delivery workspace for buyer sessions"
```

Then post an Eric development-journal buzz.

---

## Task 7: P2 Delivery Follow-up Composer

**Purpose:** Let the buyer continue a provider conversation from Delivery without starting a new paid order.

**Files:**

- Create: `src/components/delivery/DeliveryComposer.tsx`
- Create: `src/delivery/sendMessage.ts`
- Modify: `src/routes/Delivery.tsx`
- Modify: `src/delivery/messageStore.ts`
- Modify: `src/delivery/sessionGrouping.ts`
- Test: `tests/delivery/sendMessage.test.ts`
- Test: `tests/components/delivery/DeliveryComposer.test.tsx`

- [ ] **Step 1: Add tests for follow-up send**

Mock Metalet and assert:

- Empty message is blocked.
- Provider chat pubkey missing disables send.
- Sending uses ECDH/encryption path consistent with existing order flow.
- `createPin` uses `/private/chat/simplemsg`.
- Optimistic outgoing message is stored with `direction = 'outgoing'`.

- [ ] **Step 2: Implement send module**

`src/delivery/sendMessage.ts`:

```ts
export async function sendDeliveryFollowUp(input: {
  wallet: WalletIdentity
  providerGlobalMetaId: string
  providerChatPubkey: string
  content: string
  replyPin?: string
  metalet: Pick<PayAndRequestMetalet, 'ecdh' | 'createPin'>
}): Promise<{ pinId: string; encryptedContent: string }>
```

Reuse crypto helpers from `src/order/privateChatCrypto.ts`.

- [ ] **Step 3: Implement composer UI**

Required behavior:

- Multiline input with send button.
- Disabled when wallet disconnected, no session selected, no provider key, or sending.
- Error state preserves typed content.
- Success clears input and appends optimistic local message.

- [ ] **Step 4: Provider chat pubkey resolution**

Use best available source:

1. Session/order stored provider chat pubkey.
2. Last incoming message `fromUserInfo.chatPublicKey`.
3. Service detail cache if selected from just-created order.

If none exists, composer is disabled with a short reason.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm test delivery components/delivery
pnpm build
```

Manual:

- In Chrome, connect Metalet and confirm composer becomes enabled for a session with provider key.
- Do not send sensitive real content.

- [ ] **Step 6: Commit**

```bash
git status --short
# stage only task-owned changed files after inspecting the diff
git commit -m "feat: add buyer follow-up composer in delivery"
```

Then post an Eric development-journal buzz.

---

## Task 8: P3 Asset Preview Cards and Delivered Assets Panel

**Purpose:** Make images, video, audio, and attachments visible/manageable as digital deliverables.

**Files:**

- Create: `src/components/delivery/AssetPreviewCard.tsx`
- Modify: `src/components/delivery/DeliveredAssetsPanel.tsx`
- Modify: `src/components/delivery/MessageBubble.tsx`
- Modify: `src/delivery/assetParser.ts`
- Modify: `src/i18n/zh-CN.ts`
- Test: `tests/components/delivery/AssetPreviewCard.test.tsx`
- Test: `tests/components/delivery/DeliveredAssetsPanel.test.tsx`

- [ ] **Step 1: Add rendering tests**

Tests must cover:

- Image asset renders `<img>`.
- Video asset renders `<video controls playsInline>`.
- Audio asset renders `<audio controls>`.
- Unknown/document asset renders download-focused card.
- Download link uses `downloadUrl`, `target="_blank"`, and `rel="noopener noreferrer"`.
- Broken preview keeps download visible.

- [ ] **Step 2: Implement preview card**

Keep component small and deterministic:

```tsx
export function AssetPreviewCard({ asset }: { asset: DeliveryAssetRecord | ParsedDeliveryAsset }) {
  // render by asset.kind
}
```

Use IDBots fallback strategy:

- image: try accelerated preview, fallback to normal content URL on error.
- video/audio: render source; if preview fails, keep fallback download.
- other: no inline preview.

- [ ] **Step 3: Wire assets into MessageBubble**

When a message parses assets:

- Show previews below delivery/result text.
- Avoid duplicate asset cards in one message.
- Keep message text readable if preview fails.

- [ ] **Step 4: Implement DeliveredAssetsPanel**

For selected session:

- Group all assets.
- Show count by kind.
- Show compact grid/list responsive layout.
- Empty state says no delivered assets yet.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm test components/delivery delivery
pnpm build
```

Manual:

- Inject a mock Delivery message with image/video/audio/document metafiles and check rendering.

- [ ] **Step 6: Commit**

```bash
git status --short
# stage only task-owned changed files after inspecting the diff
git commit -m "feat: render and manage delivered asset previews"
```

Then post an Eric development-journal buzz.

---

## Task 9: P3 Persist Parsed Assets and Session Status

**Purpose:** Persist parsed assets and derived status so refresh returns users to a useful Delivery view.

**Files:**

- Modify: `src/delivery/messageStore.ts`
- Modify: `src/delivery/db.ts`
- Modify: `src/delivery/sessionGrouping.ts`
- Modify: `src/delivery/protocol.ts`
- Modify: `src/components/delivery/DeliveredAssetsPanel.tsx`
- Test: `tests/delivery/messageStore.test.ts`
- Test: `tests/delivery/sessionGrouping.test.ts`
- Test: `tests/delivery/db.test.ts`

- [ ] **Step 1: Add failing persistence tests**

Tests must prove:

- Appending a `[DELIVERY]` message stores parsed assets.
- Session asset count updates.
- `[ORDER_END]` marks session completed.
- `[NeedsRating]` stores rating-reserved signal but does not render rating UI.
- Refresh/hydrate reads session assets from IndexedDB.

- [ ] **Step 2: Add normalize-and-persist pipeline**

Create or extend a function:

```ts
export async function persistDeliveryMessage(input: {
  walletGlobalMetaId: string
  message: DeliveryMessage
}): Promise<void>
```

It should:

- Parse protocol.
- Derive session id.
- Upsert message record.
- Upsert asset records.
- Update session status/assetCount/lastActivity.

- [ ] **Step 3: Wire live Socket path**

In `src/ws/useSocket.ts`, after decrypting private chat:

- Append to UI store.
- Persist through the new pipeline.
- If persistence fails, keep UI message and debug-log the cache error.

- [ ] **Step 4: Wire pending order path**

Ensure Task 4 pending order message goes through the same persistence format where possible.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm test delivery ws components/delivery
pnpm build
```

- [ ] **Step 6: Commit**

```bash
git status --short
# stage only task-owned changed files after inspecting the diff
git commit -m "feat: persist delivery assets and derived session status"
```

Then post an Eric development-journal buzz.

---

## Task 10: P4 Private Chat History API Client

**Purpose:** Fetch current wallet's prior private chat sessions/messages from local metaso-p2p.

**Prerequisite:** Task 2A must be complete. Use `docs/qa/metaso-p2p-private-chat-contract.md` as the source of truth for observed local identity parameters and response shape.

**Files:**

- Create: `src/api/privateChat.ts`
- Test: `tests/api/privateChat.test.ts`
- Modify: `src/ws/privateChat.ts` if shared types should move.
- Modify: `tests/fixtures/` with private-chat and homes samples.

- [ ] **Step 1: Add fixtures**

Use shapes from `docs/architecture/metaso-p2p-local-api.md`:

- `GET /api/group-chat/chat/homes/:metaid`
- `GET /api/group-chat/private-chat-list?metaId=&otherMetaId=&cursor=&size=20`
- `GET /api/group-chat/private-chat-list-by-index?metaId=&otherMetaId=&startIndex=0&size=20`

Do not depend on live service in unit tests.

- [ ] **Step 2: Implement private chat API client**

Expose:

```ts
export interface PrivateChatHistoryParams {
  metaId: string
  otherMetaId: string
  cursor?: string
  size?: number
  timestamp?: number
}

export async function listPrivateChatHomes(metaId: string): Promise<PrivateChatHome[]>
export async function listPrivateChatHistory(params: PrivateChatHistoryParams): Promise<PrivateChatHistoryPage>
```

Use `/api/group-chat/...` under `getNormalizedMetasoP2PBaseUrl()`.

- [ ] **Step 3: Identity resolution helper**

Add:

```ts
export function resolvePrivateChatMetaId(identity: WalletIdentity): string {
  return identity.mvcAddress || identity.globalMetaId
}
```

Reason: local metaso-p2p samples use an address-like value for `metaId`; if later contract changes, only this helper should change.

- [ ] **Step 4: Add error handling**

Use the shared envelope handler if possible, but remember `/api/info/*` legacy success code does not apply here. Private-chat endpoints should use `code=0`.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm test api ws
pnpm build
```

Optional live check:

```bash
curl -sS 'http://127.0.0.1:18091/api/group-chat/chat/homes/1JzFmwf498bXRyFiJTrxikSP7xh9iZ3JrX' | head -c 500
```

- [ ] **Step 6: Commit**

```bash
git status --short
# stage only task-owned changed files after inspecting the diff
git commit -m "feat: add metaso-p2p private chat history client"
```

Then post an Eric development-journal buzz.

---

## Task 11: P4 History Sync, Cache Hydration, and Live Merge

**Purpose:** On wallet connect, render cached Delivery immediately, then merge metaso-p2p history and Socket.IO live messages without duplicates.

**Files:**

- Create: `src/delivery/deliverySync.ts`
- Modify: `src/ws/useSocket.ts`
- Modify: `src/delivery/messageStore.ts`
- Modify: `src/routes/Delivery.tsx`
- Modify: `src/App.tsx` if wallet-connect lifecycle belongs there.
- Test: `tests/delivery/deliverySync.test.ts`
- Test: `tests/delivery/messageStore.test.ts`
- Test: `tests/ws/privateChat.test.ts`

- [ ] **Step 1: Add sync tests**

Test flow:

1. IndexedDB has cached session/message/asset.
2. `hydrateDeliveryForWallet` loads cache before network history.
3. History returns duplicate message by `pinId`.
4. Socket push returns same message by `pinId`.
5. Final store has one message and correct asset count.

- [ ] **Step 2: Implement sync module**

Expose:

```ts
export async function hydrateDeliveryForWallet(identity: WalletIdentity): Promise<void>
export async function syncKnownPrivateChatHistory(identity: WalletIdentity): Promise<void>
export async function mergePrivateChatItem(input: {
  item: PrivateChatItem
  selfGlobalMetaId: string
  walletIdentity: WalletIdentity
}): Promise<void>
```

- [ ] **Step 3: Wire wallet lifecycle**

On wallet connected:

- Hydrate cache.
- Start socket.
- Start background history sync.

On wallet disconnect:

- Disconnect socket.
- Keep local DB data, but clear in-memory selected session if appropriate.

- [ ] **Step 4: Add sync state**

Persist per-wallet/per-peer cursor or timestamp in `syncState`. Do not over-optimize; first release can fetch recent pages with conservative `size=50`.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm test delivery ws api
pnpm build
pnpm smoke:metaso-p2p
```

Manual:

- Start dev server with local metaso-p2p env.
- Connect wallet.
- Delivery should show cached data first if present and not duplicate live/history rows.

- [ ] **Step 6: Commit**

```bash
git status --short
# stage only task-owned changed files after inspecting the diff
git commit -m "feat: sync delivery cache with private chat history"
```

Then post an Eric development-journal buzz.

---

## Task 12: P4 Product QA, Chrome + Metalet Acceptance, and Release Docs

**Purpose:** Prove the product works end to end enough for a basic buyer-side release candidate.

**Files:**

- Create: `docs/qa/buyer-productization-acceptance.md`
- Modify: `README.md`
- Modify: `.env.example` if any env variables changed after implementation.
- Modify: UI files only for small acceptance fixes found during QA.
- Test: no new unit tests required unless QA finds a bug.

- [ ] **Step 1: Create acceptance checklist doc**

Document:

- Local metaso-p2p service prerequisites.
- `.env.local` values.
- `pnpm smoke:metaso-p2p`.
- `pnpm dev`.
- Chrome + Metalet login check.
- Free-service order path.
- Delivery pending session check.
- Socket connected/degraded indicators.
- Asset message injection check.
- Refresh/hydration check.
- Mobile and desktop visual checks.

- [ ] **Step 2: Run automated verification**

Run:

```bash
pnpm test
pnpm build
pnpm smoke:metaso-p2p
```

- [ ] **Step 3: Start dev server**

Run:

```bash
VITE_METASO_P2P_BASE_URL=/metaso-p2p VITE_USE_AGGREGATOR_MOCK=false VITE_USE_WS_MOCK=false pnpm dev -- --host 127.0.0.1
```

Do not leave the server running after the task is complete unless the user asks.

- [ ] **Step 4: Browser smoke with local Browser or Chrome**

Use Browser for basic UI:

- Open `http://127.0.0.1:5176`.
- Confirm real services load from local metaso-p2p.
- Open service detail for `free-weather-service` if present.
- Confirm Pay & Request modal opens.
- Confirm Delivery layout renders.

- [ ] **Step 5: Chrome + Metalet acceptance**

Use Computer Use / Chrome only for wallet-dependent checks:

- Open `http://127.0.0.1:5176` in Chrome.
- Connect Metalet.
- Confirm globalMetaId/address appears.
- Prepare a free-service order flow if available, but stop before any Metalet signing or broadcast.
- If Metalet asks to sign, broadcast `createPin`, grant new permissions, create keys, or confirm any payment, stop and ask the user before confirming.
- If a browser or extension permission prompt appears during wallet connection, it is allowed by the user's request unless it asks to save passwords, create keys, or perform payment.

- [ ] **Step 6: Asset acceptance**

Use dev-only injection or test fixture to display a provider message containing:

```text
[DELIVERY:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa] {"result":"Here are files: metafile://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbi0.png metafile://cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccci0.mp4 metafile://ddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddi0.mp3 metafile://eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeei0.pdf"}
```

Confirm:

- Asset cards render.
- Downloads remain visible even if previews fail.
- Refresh preserves asset metadata.

- [ ] **Step 7: Fix only release-blocking QA issues**

Allowed fixes:

- Broken build/test.
- Broken local metaso-p2p wiring.
- Wallet connect UI impossible to use.
- Delivery asset preview/download unusable.
- Severe responsive layout overlap.

Do not add refund/rating UI or provider features.

- [ ] **Step 8: Final independent review subagent**

After all tasks and QA fixes:

- Dispatch a fresh review subagent.
- Ask it to review code against `buyer-productization-design.md`, this implementation plan, and current diff since `ac3a4bb`.
- Require findings first, with file/line references.
- Fix any P0/P1 severity issues through a fresh fix subagent and rerun relevant tests.

- [ ] **Step 9: Commit**

```bash
git status --short
# stage only task-owned changed files after inspecting the diff
git commit -m "docs: add buyer productization acceptance checklist"
```

If QA fixes changed code, use the appropriate `fix:` or `feat:` commit instead of combining unrelated changes.

Then post an Eric development-journal buzz.

---

## Final Completion Criteria

The full plan is complete only when:

- All tasks, including Task 2A, are checked off.
- Every implementation task has implementer, spec-review, and code-quality review records in the thread.
- The final independent review subagent has approved or all findings have been resolved.
- `pnpm test` passes.
- `pnpm build` passes.
- `pnpm smoke:metaso-p2p` passes against `http://127.0.0.1:18091`.
- Chrome + Metalet acceptance has been attempted and documented.
- No provider-side feature, refund UI, or rating UI was added.
- Working tree is clean.
