# BotHub Implementation Plan

> **For agentic workers:** Steps use `- [ ]` checkboxes. Follow `AGENTS.md` (Commit and Merge Rules, Behavioral Guidelines). For each completed step that produces a working unit, commit per the rules. Don't fix pre-existing bugs not related to your task.

**Goal:** Build a static React SPA that lets a Metalet-authenticated user browse the meta-socket skill-service aggregator, pay & request a service, and view caller-side delivery messages in real time.

**Architecture:** Vite + React + TS SPA. Talks directly to `meta-socket` HTTP (`/api/bot-hub/skill-service/*`) and Socket.IO (`/socket/socket.io`). All wallet operations go through Metalet (`window.metaidwallet.*`). No BotHub backend in MVP.

**Tech Stack:** Vite 5, React 18, TypeScript 5 (strict), Tailwind CSS 3, Headless UI, Heroicons, React Router v6, TanStack Query v5, zustand, socket.io-client 4.8, Vitest + Testing Library. Package manager: **pnpm**.

**Subagent UI rule:** When implementing any user-visible UI (M3, M4, M6–M8), subagents **must** apply the `frontend-design` skill and follow the approved design mockup (dark dashboard, Bot Hub + Delivery two-column layout). Do **not** copy OAC `shared.css` aesthetics wholesale — invent a distinctive BotHub look informed by the mockup.

**Reference repos (read before guessing):**
- UI / GigSquare: `/Users/tusm/Documents/MetaID_Projects/IDBots/IDBots`
- Wallet: `/Users/tusm/Documents/MetaID_Projects/metalet-extension-next`
- API + WS: `/Users/tusm/Documents/MetaID_Projects/meta-socket`

**Spec & design references:**
- `meta-socket/docs/specs/2026-05-28-bot-hub-skill-service-aggregation-api.md`
- `bothub/docs/architecture/bothub-design.md`
- `IDBots/src/main/shared/orderMessage.js` (order payload contract)

---

## Pre-flight

- [x] Decisions D1–D14 locked — see `bothub-design.md` §0.
- [x] **`VITE_META_SOCKET_BASE_URL`** → `https://api.idchat.io` (production meta-socket; override in `.env.local` for staging).
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

## Out-of-scope for first release (do NOT do)

Per AGENTS.md #2 (Simplicity First) and #3 (Surgical Changes), the following are explicitly excluded:

- Push notifications, service worker, PWA install.
- Multi-wallet support beyond Metalet.
- Refund initiation, rating submission UI, service publishing.
- Provider profile page beyond the side panel.
- File upload from the user into a service request.
- Sessions history backfill via HTTP (WS-only is enough for v1).
- BotHub backend service (proxy, JWT, analytics) — add only if R1/R3 force it.

---

## Plan execution

**Mode: Subagent-Driven** (confirmed). Dispatch one milestone per subagent; review between milestones. Use `superpowers:subagent-driven-development`.

Each UI milestone prompt must include: "Read `bothub-design.md`, use `frontend-design` skill, reference design mockup, read IDBots GigSquare for fields only."
