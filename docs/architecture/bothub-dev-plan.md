# BotHub Implementation Plan

> **For agentic workers:** Steps use `- [ ]` checkboxes. Follow `AGENTS.md` (Commit and Merge Rules, Behavioral Guidelines). For each completed step that produces a working unit, commit per the rules. Don't fix pre-existing bugs not related to your task.

**Goal:** Build a static React SPA for ordinary caller-side users who do not want to install IDBots, run Codex, or configure LLM/runtime tools: they browse remote skill-service providers, submit a manual request with Metalet, and manage delivered digital assets.

**Architecture:** Vite + React + TS SPA. Talks directly to `meta-socket` HTTP (`/api/bot-hub/skill-service/*`) and Socket.IO (`/socket/socket.io`). All wallet operations go through Metalet (`window.metaidwallet.*`). No BotHub backend in MVP.

**Tech Stack:** Vite 5, React 18, TypeScript 5 (strict), Tailwind CSS 3, Headless UI, Heroicons, React Router v6, TanStack Query v5, zustand, socket.io-client 4.8, Vitest + Testing Library. Package manager: **pnpm**.

**Subagent UI rule:** When implementing any user-visible UI (M3, M4, M6–M13), subagents **must** apply the `frontend-design` skill and follow the approved design mockup (dark dashboard, Bot Hub + Delivery two-column layout). Do **not** copy OAC `shared.css` aesthetics wholesale — invent a distinctive BotHub look informed by the mockup.

**Reference repos (read before guessing):**
- UI / GigSquare: `/Users/tusm/Documents/MetaID_Projects/IDBots/IDBots`
- A2A delivery rendering: `/Users/tusm/Documents/MetaID_Projects/IDBots/IDBots/src/renderer/components/cowork/A2AMessageItem.tsx`
- Wallet: `/Users/tusm/Documents/MetaID_Projects/metalet-extension-next`
- API + WS: `/Users/tusm/Documents/MetaID_Projects/meta-socket`

**Spec & design references:**
- `meta-socket/docs/specs/2026-05-28-bot-hub-skill-service-aggregation-api.md`
- `bothub/docs/architecture/bothub-design.md`
- `IDBots/src/main/shared/orderMessage.js` (order payload contract)

---

## Pre-flight

- [x] Decisions D1–D14 locked — see `bothub-design.md` §0.
- [x] **`VITE_META_SOCKET_BASE_URL`** → environment-specific meta-socket deployment URL; override in `.env.local` for local/staging. The target must expose native `/api/bot-hub/*`, private-chat history routes, and `/socket/socket.io`; do not use idchat `/chat-api/` as the BotHub backend.
- [x] **CORS** — will allow BotHub origin when API ships; not a blocker for MVP.
- [x] **Mock-first** — until aggregator is live, `VITE_USE_AGGREGATOR_MOCK=true` (default in dev) serves fixtures matching the frozen spec. Flip to `false` to hit real HTTP.
- [x] **Design mockup** — layout reference: `docs/design/bothub-mockup.png` (three-column Bot Hub + Delivery sessions/chat).

---

## M0: Project skeleton

**Files (create):**
- `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.cjs`
- `index.html`
- `src/main.tsx`, `src/App.tsx`, `src/styles/globals.css`
- `.eslintrc.cjs`, `.prettierrc`, `.gitignore`
- `tests/setup.ts`, `vitest.config.ts`

- [x] **Step 1–7:** M0 scaffold complete (Vite + React + TS + Tailwind + Router + Query + zustand deps + smoke tests).

**Verify:** `pnpm dev` shows a page with header + two-link nav; `pnpm test` passes; `pnpm typecheck` (= `tsc --noEmit`) clean.

**Commit:** `chore: scaffold vite react-ts project with tailwind, router, query, zustand`

---

## M1: Metalet wallet adapter

**Files (create):**
- `src/wallet/types.ts`
- `src/wallet/metalet.ts`
- `src/wallet/useWallet.ts`
- `tests/wallet/metalet.test.ts`
- `tests/wallet/useWallet.test.tsx`

**Files (modify):**
- `src/App.tsx` — add a "Connect Wallet" button in `AppShell`.

- [x] **Step 1–5:** M1 complete — wallet types, metalet adapter, zustand persist, header layout (left tabs Bot Hub/Delivery, right connect wallet).

**Verify:**
- `pnpm test wallet` passes.
- Manual: open `pnpm dev` with Metalet installed → click Connect → shows your gmid; refresh → still shown.

**Commit:** `feat: add metalet wallet adapter and useWallet store`

---

## M2: Aggregator API types + client

**Files (create):**
- `src/api/aggregator.types.ts` — `SkillServiceItem`, `ProviderInfo`, `ListResponse`, `DetailResponse`, `Envelope<T>`.
- `src/api/aggregator.ts` — `listServices(params)`, `getServiceDetail(id, params?)`.
- `src/api/queries.ts` — `useServicesQuery`, `useServiceDetailQuery` (TanStack Query hooks).
- `src/api/config.ts` — read `import.meta.env.VITE_META_SOCKET_BASE_URL`.
- `tests/api/aggregator.test.ts` — uses `msw` (or fetch-mock) to verify list & detail parse + error envelope.
- `tests/fixtures/aggregator/list.json`, `detail.json`, `error-40400.json`.

**Files (modify):**
- `src/main.tsx` — wrap app in `<QueryClientProvider>`.
- `.env.example` — add `VITE_META_SOCKET_BASE_URL`.

- [x] **M2 complete** — types, client, mock, queries, tests (commit `ab3151c`).

**Verify:** `pnpm test api` green. Manual: with `VITE_META_SOCKET_BASE_URL=https://staging.example` and a live aggregator, a simple debug route logs the list.

**Commit:** `feat: aggregator api types, client, and react query hooks`

---

## M3: Bot Hub list UI

> **Subagent:** Use `frontend-design` skill. Layout = design mockup (left Online Bots, center service grid, filters top). Reference IDBots `GigSquareView.tsx` for field mapping only — not colors/fonts.

**Files (create):**
- `src/routes/BotHub.tsx` — page shell.
- `src/components/hub/ServicesPanel.tsx` — middle column.
- `src/components/hub/ServiceCard.tsx`.
- `src/components/hub/FiltersBar.tsx` — keyword/currency/outputType/sort.
- `src/components/hub/OnlineBotsSidebar.tsx` — left column (skeleton; data later).
- `src/lib/format.ts` — `formatPrice`, `formatRelativeTime`, `formatAddress`.
- `tests/components/hub/ServiceCard.test.tsx` — renders all designed fields from a fixture item.
- `tests/components/hub/FiltersBar.test.tsx` — controlled state changes call `onChange`.

**Files (modify):**
- `src/App.tsx` — route `/` to `BotHub`.

- [x] **Step 1:** static layout matching the mockup left→middle (`OnlineBotsSidebar` + `ServicesPanel`), Tailwind grid. Right panel (detail) is M4.
- [x] **Step 2:** `ServiceCard` renders: `serviceIcon`, `displayName`, `description` (line-clamp-2), provider row (avatar + name + `providerSkill` chip), price + currency badge, rating ⭐.
- [x] **Step 3:** `FiltersBar` controlled component → emits `{ keyword, currency, outputType, sortBy, order }`. Debounce keyword 300ms.
- [x] **Step 4:** wire `useServicesQuery` infinite scroll (cursor). Show skeleton on initial load, "load more" sentinel at the bottom.
- [x] **Step 5:** `OnlineBotsSidebar` for now is a static placeholder listing top providers from current page's items (group by `providerGlobalMetaId`). Real online status deferred (R4 in design).

**Verify:**
- `pnpm test components/hub` green.
- Manual: `pnpm dev` shows the Hub with mocked data; filter + sort + load more all work.

**Commit:** `feat: bot hub list ui with filters, sort, and cursor pagination`

---

## M4: Service detail panel

**Files (create):**
- `src/components/hub/ServiceDetailPanel.tsx` — right column.
- `src/components/hub/ProviderProfile.tsx`.
- `tests/components/hub/ServiceDetailPanel.test.tsx`.

**Files (modify):**
- `src/routes/BotHub.tsx` — manage `selectedServiceId` state; show panel on right when set.
- `src/components/hub/ServiceCard.tsx` — `onClick` selects the service.

- [x] **Step 1:** `ServiceDetailPanel` takes `serviceId`, calls `useServiceDetailQuery`, renders: header (icon + name + rating + provider), description (full), pricing block (price/currency/settlement), provider profile (name/avatar/chatPubkey indicator). No examples/deliverables (not in v1 schema).
- [x] **Step 2:** "Pay & Request" button — disabled if wallet not connected (with tooltip).
- [x] **Step 3:** ESC + clicking outside closes the panel; URL reflects state via search param (`?service=<id>`) for shareable links.

**Verify:** clicking a card opens panel with all fields from spec; closing clears URL param.

**Commit:** `feat: bot hub service detail panel with shareable url state`

---

## M5: Order builder + Pay & Request flow

**Files (create):**
- `src/order/buildOrderPayload.ts` — port of `IDBots/src/main/shared/orderMessage.js` to TS.
- `src/order/orderMessage.ts` — `extractOrderRawRequest`, `extractOrderDisplaySummary`, `validateOrderRawRequest`, regexes.
- `src/order/flow.ts` — `executePayAndRequest({ service, prompt, wallet }) → { paymentTxid, orderReference, orderPinId }`.
- `src/components/hub/RequestModal.tsx` — prompt textarea + summary + price confirm + progress.
- `tests/order/buildOrderPayload.test.ts` — snapshots for free / native SPACE / native BTC / MRC20.
- `tests/order/flow.test.ts` — mocked Metalet + aggregator; verifies happy path + payment failure rollback.
- `tests/fixtures/order/*.txt` — golden order strings copied from IDBots-output samples.

**Files (modify):**
- `src/components/hub/ServiceDetailPanel.tsx` — wire "Pay & Request" → open modal.

- [ ] **Step 1:** port `orderMessage.js` to TS. Keep function names. Replace `export const` with `export const` — no behavior changes. **Do not add features.** (AGENTS.md #2 Simplicity First.)
- [ ] **Step 2:** generate fixtures: run the JS version (Node script) over 4 sample inputs (free / native SPACE / native BTC / MRC20) and save outputs as `.txt`. Snapshot tests compare TS output byte-for-byte.
- [ ] **Step 3:** `flow.ts`:
  - validate prompt; throw on too-long / empty.
  - if `service.price === '0'`: skip payment; `orderReference = generateRandomHex(32)`; no txid.
  - else: call `metalet.transfer(...)` with chain-specific params; collect `paymentTxid` (+ `commitTxid` if mrc20).
  - build payload via `buildOrderPayload`.
  - call `metalet.eciesEncrypt({ message })` with `recipientPubKey = service.provider.chatPubkey`.
  - call `metalet.createPin({ path: '/private/chat/simplemsg', ... })`.
  - return `{ paymentTxid, orderReference, orderPinId }`.
- [ ] **Step 4:** `RequestModal` — controlled `prompt` (textarea, 4000 char cap with counter), confirm step shows resolved price + currency + provider name, calls `flow` on confirm, shows step status (paying → encrypting → broadcasting → done).
- [ ] **Step 5:** on success, navigate to `/delivery?session=<providerGmid>:<paymentTxid|orderReference>`.

**Verify:**
- `pnpm test order` green (4 fixtures match).
- Manual e2e: with Metalet on testnet, place a free order against a test provider; confirm pin shows up on chain.

**Commit:** `feat: pay & request flow with order payload builder mirroring idbots`

---

## M6: Socket.IO connection + Delivery skeleton

**Files (create):**
- `src/ws/socket.ts` — `connectSocket(metaid)`, heartbeat loop, reconnect.
- `src/ws/envelope.ts` — parse `{M, C, D}` payloads.
- `src/ws/privateChat.ts` — type guard + handler for `WS_SERVER_NOTIFY_PRIVATE_CHAT`.
- `src/ws/useSocket.ts` — zustand store: `{ socket, status }`.
- `src/delivery/messageStore.ts` — `{ byPeer: Record<gmid, Message[]>, append(msg) }`, persisted to sessionStorage.
- `src/delivery/decrypt.ts` — `decryptIncoming({ content, encryption })` via Metalet.
- `src/routes/Delivery.tsx` — empty layout: sessions sidebar | message area | (right: empty).
- `src/components/delivery/SessionsList.tsx` — left column.
- `src/components/delivery/MessageList.tsx` — middle column.
- `src/components/delivery/MessageBubble.tsx`.
- `tests/ws/envelope.test.ts`
- `tests/ws/privateChat.test.ts`
- `tests/delivery/messageStore.test.ts`

**Files (modify):**
- `src/App.tsx` — start socket when wallet connected; teardown on disconnect.

- [ ] **Step 1:** `socket.ts` connects to `${BASE}/socket/socket.io?metaid=${gmid}&type=app`, sets up `socket.on('message')`, sends `socket.emit('ping')` every 30s. Reconnect with exponential backoff capped at 30s.
- [ ] **Step 2:** envelope parser strictly typed; only accept `C === 0` and known `M` values.
- [ ] **Step 3:** on `WS_SERVER_NOTIFY_PRIVATE_CHAT`, ignore if `D.toGlobalMetaId !== wallet.identity.globalMetaId`. Otherwise: decrypt → store. Failures logged to a debug channel but **never** drop the raw payload (per R6 in design).
- [ ] **Step 4:** `messageStore` keys by `peerGlobalMetaId`; messages sorted by `timestamp asc`.
- [ ] **Step 5:** Delivery route renders sessions (one per peer) → click → message list shows text bubbles. No order parsing yet — that's M7.

**Verify:**
- `pnpm test ws delivery` green.
- Manual: log in, send yourself a test simplemsg via another client, see it appear in Delivery in <30s.

**Commit:** `feat: socket.io connection and delivery skeleton with private chat`

---

## M7: Session grouping + order-aware rendering

**Files (create):**
- `src/delivery/sessionGrouping.ts` — pure functions to group messages into Sessions keyed by `peerGmid + serviceId? + orderReference?`.
- `src/delivery/orderParser.ts` — detect `[ORDER]` prefix; extract `serviceId`, `skillName`, `paymentTxid`, `orderReference`, `displaySummary`.
- `src/components/delivery/MessageBubble.tsx` — variants: `text`, `order`, `system`.
- `tests/delivery/sessionGrouping.test.ts`
- `tests/delivery/orderParser.test.ts`

**Files (modify):**
- `src/components/delivery/SessionsList.tsx` — show last message + service name (when known) per session.
- `src/components/delivery/MessageList.tsx` — render bubbles via type-dispatched components.

- [ ] **Step 1:** parser consumes the same format produced by `buildOrderPayload`. Inverse function with shared regex constants from `order/orderMessage.ts`.
- [ ] **Step 2:** session grouping rule:
  - Start a new session on outgoing `[ORDER]` (we sent it).
  - Provider responses with matching `orderReference` or `paymentTxid` go to that session.
  - Free-form messages without order metadata go to a peer-default session.
- [ ] **Step 3:** `MessageBubble` for `order` shows summary + prompt (collapsible) + price; for `text` shows plain text. (Progress / asset variants → M8.)

**Verify:** local fixtures for sessions with order + reply pairs render correctly grouped; tests cover the grouping rules.

**Commit:** `feat: order-aware session grouping and message bubbles`

---

## M8: Polish & MVP cut

**Files (create):**
- `src/components/common/EmptyState.tsx`
- `src/components/common/ErrorBoundary.tsx`
- `src/i18n/zh-CN.ts` + `src/i18n/index.ts` (tiny — no library; just a typed map)

**Files (modify):**
- All UI to use `t('...')` strings.

- [x] **Step 1:** loading skeletons across list, detail, sessions.
- [x] **Step 2:** empty states: "no services found", "no messages yet", "wallet not connected".
- [x] **Step 3:** error toasts for aggregator/MS WS failures; "retry" button.
- [x] **Step 4:** basic responsive: 1-column under 768px; collapsible sidebar.
- [x] **Step 5:** README updates (run dev / test / build).

**Verify:**
- `pnpm test` all green.
- `pnpm build` produces `dist/` under 500KB gzipped (target, not hard).
- Manual e2e checklist (in design §10) passes against staging.

**Commit:** `feat: mvp polish - loading, empty, error states, basic i18n, responsive`

---

## Productization Phase: Caller Tool + A2A Delivery Viewer

The first releasable product is **not** a provider runtime and not a generic A2A developer console. It is a caller-side ordering tool for ordinary users:

1. connect Metalet,
2. find a remote provider skill-service,
3. type a plain-language request,
4. pay/send the order,
5. track execution in Delivery,
6. preview/download delivered digital assets,
7. return later and quickly find previous deliverables.

Refunds and ratings remain out of the first release UI, but all order/session/asset records must preserve enough identifiers to add those flows next.

---

## M9: Release foundation + meta-socket boundary hardening

**Goal:** Make the app buildable, deployable as a pure SPA, and explicit about every meta-socket boundary before touching larger UI work.

**Files (create):**
- `src/api/privateChat.ts` — HTTP client for `/group-chat/private-chat-list` and `/group-chat/private-chat-list-by-index`.
- `src/api/userInfo.ts` — HTTP client for `/api/info/globalmetaid/:globalMetaId`.
- `src/api/metafile.ts` — shared constants/helpers for `file.metaid.io` content URLs.
- `tests/api/privateChat.test.ts`
- `tests/api/userInfo.test.ts`

**Files (modify):**
- `src/wallet/useWallet.ts` — fix TypeScript rehydrate undefined-state build failure.
- `src/api/config.ts` — centralize base URL, mock flags, and production/staging env validation.
- `.env.example` — document production, staging, and mock modes.
- `README.md` — document pure frontend deployment and meta-socket dependencies.

- [ ] **Step 1:** Fix `useWallet` rehydrate guard so `pnpm build` passes.
- [ ] **Step 2:** Add `privateChat.ts` types that mirror `meta-socket/docs/IDCHAT_API_CONTRACT.md` PrivateMessage shape.
- [ ] **Step 3:** Add `userInfo.ts` for provider/user profile hydration.
- [ ] **Step 4:** Add API tests for success envelope, error envelope, empty history, and cursor/index params.
- [ ] **Step 5:** Add deployment notes: static hosting, required env vars, no BotHub backend, CORS expectation.

**Verify:**
- `pnpm test api wallet`
- `pnpm build`
- Manual: set `VITE_USE_AGGREGATOR_MOCK=false` and confirm list/detail requests target `VITE_META_SOCKET_BASE_URL`.

**Commit:** `fix: harden meta-socket api boundary and build readiness`

---

## M10: Pay & Request product flow

**Goal:** Turn Pay & Request into a clear user-facing order flow that always opens a trackable Delivery session, including before the provider replies.

**Files (create):**
- `src/order/pendingOrderStore.ts` — wallet-scoped pending order store backed by IndexedDB once M12 lands; temporary localStorage is acceptable only inside this milestone if M12 follows immediately.
- `src/order/orderIdentity.ts` — derives stable `{ sessionKey, orderId, paymentTxid, orderReference }`.
- `tests/order/pendingOrderStore.test.ts`
- `tests/order/orderIdentity.test.ts`

**Files (modify):**
- `src/components/hub/RequestModal.tsx`
- `src/order/flow.ts`
- `src/routes/Delivery.tsx`
- `src/delivery/sessionGrouping.ts`
- `src/i18n/zh-CN.ts`

- [ ] **Step 1:** Redesign `RequestModal` into three states: request input → payment/send confirmation → result.
- [ ] **Step 2:** Keep the plain-language request textarea mandatory for first release; show examples as placeholder/help text, not as hard-coded service forms.
- [ ] **Step 3:** Add preflight checks for provider globalMetaId, provider chat pubkey, payment address, settlement fields, wallet connection, and prompt length.
- [ ] **Step 4:** Before broadcasting, create a pending order record with service/provider identity, prompt summary, createdAt, and status `sending`.
- [ ] **Step 5:** On `createPin` success, mark pending order `waiting`, append an optimistic outgoing order message, and navigate to `/delivery?session=...`.
- [ ] **Step 6:** If payment succeeds but simplemsg publishing fails, preserve the pending order with status `failed_to_send` and show a retry path.
- [ ] **Step 7:** Delivery must render pending sessions even when no provider reply has arrived.

**Verify:**
- `pnpm test order delivery`
- Manual: free order creates a Delivery session immediately.
- Manual: simulated send failure leaves a recoverable pending order instead of an empty screen.

**Commit:** `feat: make pay request create trackable delivery sessions`

---

## M11: Delivery workspace redesign

**Goal:** Replace the current skeleton with the product surface from the design: sessions, order context, execution timeline, and bottom input for continuing the conversation.

**Files (create):**
- `src/components/delivery/DeliveryLayout.tsx`
- `src/components/delivery/DeliveryHeader.tsx`
- `src/components/delivery/SessionCard.tsx`
- `src/components/delivery/Timeline.tsx`
- `src/components/delivery/Composer.tsx`
- `src/components/delivery/OrderSummaryPanel.tsx`
- `src/delivery/sendMessage.ts` — encrypts and publishes follow-up simplemsg through Metalet.
- `tests/components/delivery/SessionCard.test.tsx`
- `tests/components/delivery/Composer.test.tsx`
- `tests/delivery/sendMessage.test.ts`

**Files (modify):**
- `src/routes/Delivery.tsx`
- `src/components/delivery/SessionsList.tsx`
- `src/components/delivery/MessageList.tsx`
- `src/components/delivery/MessageBubble.tsx`
- `src/delivery/messageStore.ts`
- `src/i18n/zh-CN.ts`

- [ ] **Step 1:** Introduce `DeliveryLayout` with left Sessions and main workspace. Keep responsive single-column under 768px.
- [ ] **Step 2:** Replace list rows with `SessionCard`: service name, provider avatar/name, last message, timestamp, status, unread/new marker.
- [ ] **Step 3:** Add `DeliveryHeader`: selected service/order title, provider identity, status, and icon buttons for info/assets/more. Buttons can open lightweight panels or disabled placeholders if data is not ready.
- [ ] **Step 4:** Upgrade `MessageBubble`: avatars, sender names, timestamps, txid/pinId copy affordance, markdown-safe rendering, order/system/status variants.
- [ ] **Step 5:** Add `OrderSummaryPanel`: prompt summary, price/currency, paymentTxid/orderReference, service/provider, current status.
- [ ] **Step 6:** Add `Composer`: user can type a follow-up message in Delivery; encrypt to provider chat pubkey and publish `/private/chat/simplemsg` via Metalet.
- [ ] **Step 7:** Add local archive/unarchive state for sessions. Do not delete chain/history data.

**Verify:**
- `pnpm test components/delivery delivery`
- Manual: pending order, text reply, and order bubble all render in the redesigned workspace.
- Manual: follow-up message publishes an outgoing simplemsg and appears optimistically.

**Commit:** `feat: redesign delivery workspace with follow-up messaging`

---

## M12: Digital asset parsing, preview, and IndexedDB cache

**Goal:** Make digital deliverables the center of the product: parse provider delivery messages, preview/download media, and persist an asset index for fast return visits.

**Files (create):**
- `src/delivery/messageParser.ts` — parses `text`, `order`, `status`, `delivery`, `asset`, `system`.
- `src/delivery/assetParser.ts` — parses `metafile://...`, extensions, media kind, preview/download URLs.
- `src/delivery/deliveryDb.ts` — typed IndexedDB facade with migrations.
- `src/components/delivery/DeliveredAssetsPanel.tsx`
- `src/components/delivery/AssetCard.tsx`
- `src/components/delivery/MediaPreview.tsx`
- `tests/delivery/messageParser.test.ts`
- `tests/delivery/assetParser.test.ts`
- `tests/delivery/deliveryDb.test.ts`
- `tests/components/delivery/AssetCard.test.tsx`

**Files (modify):**
- `src/delivery/messageStore.ts`
- `src/components/delivery/MessageBubble.tsx`
- `src/routes/Delivery.tsx`
- `src/i18n/zh-CN.ts`
- `package.json` — add a small IndexedDB helper only if native IndexedDB ergonomics become noisy; prefer no dependency if the facade stays simple.

- [ ] **Step 1:** Port the relevant parsing concepts from IDBots `A2AMessageItem.tsx`: `[DELIVERY:<txid>]`, `[ORDER_STATUS:<txid>]`, `[ORDER_END:<txid>]`, `[NeedsRating:<txid>]`, and `metafile://...`.
- [ ] **Step 2:** `assetParser` resolves kind: `image`, `video`, `audio`, `download`; derive `sourceUrl`, `fallbackUrl`, `fileName`, `pinId`.
- [ ] **Step 3:** `messageParser` extracts delivery result text and all asset references from the renderable content.
- [ ] **Step 4:** `deliveryDb` stores wallet-scoped sessions, messages, assets, pending orders, archive state, and schema version.
- [ ] **Step 5:** On app start/login, hydrate Delivery from IndexedDB before network sync.
- [ ] **Step 6:** Add `DeliveredAssetsPanel` under or beside the timeline. It aggregates assets by selected session, not only by latest message.
- [ ] **Step 7:** Add previews: image `<img>`, video `<video controls>`, audio `<audio controls>`, generic file card with download/open button.
- [ ] **Step 8:** Add fallback behavior for CORS/preview failures: show filename, pinId, copy URI, and download/open URL.

**Verify:**
- `pnpm test delivery components/delivery`
- Manual: inject messages containing image/video/audio/plain metafile URIs and confirm previews/cards appear.
- Manual: refresh after assets arrive; Delivery shows cached sessions/assets before live sync completes.

**Commit:** `feat: render and persist digital delivery assets`

---

## M13: History sync, completion states, and release checklist

**Goal:** Make Delivery reliable after refresh, reconnect, and time gaps by merging meta-socket history with IndexedDB and live Socket.IO pushes.

**Files (create):**
- `src/delivery/historySync.ts`
- `src/delivery/sessionStatus.ts`
- `src/delivery/messageDedupe.ts`
- `tests/delivery/historySync.test.ts`
- `tests/delivery/sessionStatus.test.ts`
- `tests/delivery/messageDedupe.test.ts`
- `docs/release/manual-checklist.md`

**Files (modify):**
- `src/routes/Delivery.tsx`
- `src/ws/useSocket.ts`
- `src/delivery/messageStore.ts`
- `src/delivery/deliveryDb.ts`
- `src/components/common/WsErrorBanner.tsx`
- `README.md`

- [ ] **Step 1:** Add `messageDedupe` using `pinId || txId || localClientId`.
- [ ] **Step 2:** Add `historySync` that fetches private chat history for known peers/orders and merges with IndexedDB records.
- [ ] **Step 3:** Add session status derivation:
  - `sending` for local pending orders before order pin success,
  - `waiting` after order sent but no provider reply,
  - `in_progress` when status/progress/provider text arrives,
  - `delivered` when delivery assets or `[ORDER_END]` arrive,
  - `failed` for local send failures or explicit provider failure text.
- [ ] **Step 4:** Sync live Socket.IO messages through the same parser/dedupe/persistence pipeline as HTTP history.
- [ ] **Step 5:** Show sync state in Delivery: cached, syncing, synced, failed.
- [ ] **Step 6:** Add manual release checklist covering wallet connect, list/detail, free order, paid order, follow-up message, provider reply, asset delivery, refresh recovery, offline/reconnect, archive/unarchive.
- [ ] **Step 7:** Update README with production readiness notes and known limitations.

**Verify:**
- `pnpm test`
- `pnpm build`
- Manual checklist in `docs/release/manual-checklist.md` completed against staging meta-socket.

**Commit:** `feat: sync delivery history and define release checklist`

---

## Out-of-scope for first release (do NOT do)

Per AGENTS.md #2 (Simplicity First) and #3 (Surgical Changes), the following are explicitly excluded:

- Push notifications, service worker, PWA install.
- Multi-wallet support beyond Metalet.
- Refund initiation, rating submission UI, service publishing. Preserve data needed for refunds/ratings, but do not ship the flows yet.
- Provider profile page beyond the side panel.
- File upload from the user into a service request.
- BotHub backend service (proxy, JWT, analytics) — add only if R1/R3 force it.
- Provider-side runtime, provider dashboard, service publish/modify/revoke UI.

---

## Plan execution

**Mode: Subagent-Driven** (confirmed). Dispatch one milestone per subagent; review between milestones. Use `superpowers:subagent-driven-development`.

Each UI milestone prompt must include: "Read `bothub-design.md`, use `frontend-design` skill, reference design mockup, read IDBots GigSquare for fields only."
