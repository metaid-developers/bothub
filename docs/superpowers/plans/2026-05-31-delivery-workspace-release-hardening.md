# Delivery Workspace V1 Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. The controller opens one fresh development subagent/session per task, reviews the result, and sends that same task agent back for rework until the task passes. Do not open a separate code-review subagent for every task. After all tasks pass, open one independent final acceptance subagent using Chrome/Computer Use + Metalet for the end-to-end run. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current Delivery Workspace V1 from a seeded-data prototype into a release-hardened buyer delivery workspace with green build gates, buyer-facing copy, real metaso-p2p readiness checks, and real Chrome + Metalet acceptance evidence.

**Architecture:** Keep BotHub as a pure frontend React app backed by Metalet, metaso-p2p HTTP/Socket.IO, and IndexedDB. Do not add a BotHub backend. Harden the existing order-centered Delivery workspace by fixing release gates, separating buyer UI from technical diagnostics, proving real data paths with mocks disabled, and keeping all unresolved metaso-p2p dependency gaps documented as issues under the metaso-p2p repo.

**Tech Stack:** Vite 5, React 18, TypeScript 5 strict, Tailwind CSS, zustand, IndexedDB, socket.io-client, Vitest + Testing Library, Chrome + Metalet, local/public metaso-p2p.

---

## 0. Current State And Non-Negotiables

Current repo state observed on 2026-05-31:

- Branch/worktree: `main` in `/Users/tusm/Documents/MetaID_Projects/bothub`.
- Latest Delivery workspace acceptance commit: `529018f docs: record delivery workspace acceptance`.
- `pnpm test`: passes, `402/402` tests across `56` files.
- `pnpm build`: fails because `tests/delivery/workspaceRecovery.test.ts` contains unused imports and an unused local variable.
- `pnpm lint`: fails for the same unused symbols.
- `git diff --check`: clean.
- Local metaso-p2p `http://127.0.0.1:18091` was not reachable in the controller verification run.
- Public `https://api.idchat.io/api/bot-hub/skill-service/list...` returned `502 Bad Gateway` in the controller verification run.
- `docs/superpowers/acceptance/2026-05-31-delivery-workspace-v1.md` is an acceptance note, not an implementation plan. Treat it as evidence plus a gap list, not as truth.

Non-negotiable gates for this hardening phase:

- No task is accepted if it breaks `pnpm test`, `pnpm build`, `pnpm lint`, or `git diff --check`.
- Every task that modifies code/docs must make one focused commit.
- After every commit, post an Eric development-journal buzz using the `metabot-post-buzz` skill, as required by `AGENTS.md`.
- Do not stage or commit unrelated untracked screenshots or `.playwright-mcp/` logs unless the task explicitly creates a new controlled QA artifact.
- Do not implement refunds, rating submission, provider-side features, or a BotHub backend.
- If a real blocker belongs to metaso-p2p, create an issue markdown file under `/Users/tusm/Documents/MetaID_Projects/metaso-p2p/issues/` with evidence.

## 1. Definition Of Done

This phase is complete only when all of the following are true:

- `pnpm test` passes.
- `pnpm build` passes.
- `pnpm lint` passes.
- `git diff --check` passes.
- Delivery normal buyer UI no longer exposes implementation copy such as `simplemsg`, `Socket.IO`, `metaso-p2p`, `chat key`, `ciphertext`, `session`, or raw English fallback labels.
- Technical details are still available for troubleshooting, but only behind an explicit diagnostic/details control.
- With mocks disabled, BotHub either loads real service data from metaso-p2p or records a current issue with exact failing URL, response, and impact.
- Free order flow is attempted with Chrome + Metalet and documented as passed or blocked with exact blocker evidence.
- Paid order flow is attempted up to the safe next step with Chrome + Metalet and documented as passed or blocked with exact blocker evidence.
- Delivery restores locally cached orders/assets after refresh/re-login.
- Real or verified metafile assets are used for at least one preview/download acceptance path, or a current metaso-p2p/file-service issue explains why this cannot be done.
- Acceptance docs distinguish:
  - automated gates
  - seeded/local cache acceptance
  - live metaso-p2p acceptance
  - Chrome + Metalet acceptance
  - unresolved external blockers

## 2. Source Documents

Read before starting Task 1:

- `AGENTS.md`
- `docs/superpowers/plans/2026-05-31-delivery-workspace-productization-v1.md`
- `docs/superpowers/acceptance/2026-05-31-delivery-workspace-v1.md`
- `docs/superpowers/plans/2026-05-31-delivery-message-profile-parity.md`
- `docs/architecture/metaso-p2p-local-api.md`
- `docs/qa/core-usability-repair-run-log.md`
- `/Users/tusm/Documents/MetaID_Projects/metaso-p2p/issues/2026-05-30-bothub-paid-service-missing-provider-chatpubkey.md`

Use code references from the current repo, not old plan snippets, when implementation differs.

## 3. File Map

Expected files to touch during this phase:

- `tests/delivery/workspaceRecovery.test.ts`  
  Fix unused test symbols so build/lint gates pass.

- `src/i18n/zh-CN.ts`  
  Convert Delivery buyer-facing copy to Chinese product language. Keep technical terms out of normal UI.

- `src/components/delivery/DeliveryComposer.tsx`  
  Replace technical disabled states and `Fetch provider key` action with buyer-safe wording and a diagnostic-only path.

- `src/components/delivery/MessageBubble.tsx`  
  Hide decrypt/ciphertext implementation text behind diagnostics; convert visible labels to buyer-facing copy.

- `src/components/delivery/DeliveryStatusTimeline.tsx`  
  Ensure decrypt warnings and message details are buyer-friendly by default.

- `src/components/delivery/DeliveryWorkspaceHeader.tsx`  
  Remove legacy `session` aria labels and expose reserved refund/rating slots without looking like broken disabled features.

- `src/components/delivery/DeliveryOrderList.tsx`  
  Improve empty/sync states and avoid internal vocabulary.

- `src/routes/Delivery.tsx`  
  Keep order-centered layout; support order-focused URLs after checkout; ensure selected-order/profile/decrypt behavior still works.

- `src/order/flow.ts`  
  Add an order-focused Delivery path helper if needed.

- `src/components/hub/RequestModal.tsx`  
  Navigate to `?order=` after local order persistence when possible; keep recoverable failure navigation safe.

- `src/delivery/orderStore.ts`  
  Return enough persisted order/session metadata for order-focused navigation.

- `src/api/aggregator.ts`
- `src/api/aggregator.types.ts`
- `src/api/userProfile.ts`  
  Touch only if live metaso-p2p provider/profile data proves normalization gaps remain.

- `src/delivery/workspace.ts`
- `src/delivery/sessionGrouping.ts`
- `src/delivery/messageStore.ts`
- `src/delivery/deliverySync.ts`  
  Touch only if real/fixture messages prove order reconciliation or profile/decrypt recovery gaps remain.

- `src/delivery/assetParser.ts`
- `src/components/delivery/AssetPreviewCard.tsx`
- `src/components/delivery/AssetPreviewDialog.tsx`
- `src/components/delivery/DeliveryAssetLibrary.tsx`  
  Harden real metafile preview/download behavior.

- `tests/components/delivery/*.test.tsx`
- `tests/components/hub/RequestModal.test.tsx`
- `tests/order/flow.test.ts`
- `tests/api/aggregator.test.ts`
- `tests/api/userProfile.test.ts`
- `tests/delivery/*.test.ts`  
  Add or update tests alongside each code task.

- `docs/qa/delivery-workspace-release-hardening-run-log.md`  
  Create a truthful run log for this phase.

- `docs/superpowers/acceptance/2026-05-31-delivery-workspace-v1.md`  
  Update only after re-running acceptance. Do not leave false checked items.

Potential external issue files:

- `/Users/tusm/Documents/MetaID_Projects/metaso-p2p/issues/YYYY-MM-DD-bothub-<short-gap>.md`

## 4. Subagent Execution Protocol

For the controller:

- Open one fresh task subagent/session for each task below.
- Give that task agent only the relevant plan section plus the global rules.
- Review the exact diff, run the task-specific verification, and inspect screenshots/logs when applicable.
- If the task fails, send findings back to the same task agent for rework.
- Once accepted, require the task agent to commit only its touched files and post the Eric buzz journal.
- Move to the next task only after the previous task is accepted.
- After Task 8 is accepted, open one independent final acceptance subagent using Chrome/Computer Use + Metalet.

For every task agent:

- You are not alone in the codebase. Preserve unrelated changes and untracked artifacts.
- Do not revert edits from other agents.
- Keep changes scoped to the task.
- Use TDD where a behavior change is required.
- Commit with one of `feat`, `fix`, `refactor`, `docs`, or `chore`.
- After committing, post a detailed Eric development-journal buzz.

## 5. Tasks

### Task 1: Restore Release Gates

**Purpose:** Make the current repo buildable/lintable before product hardening continues.

**Files:**

- Modify: `tests/delivery/workspaceRecovery.test.ts`

- [ ] **Step 1: Reproduce the failures**

Run:

```bash
pnpm build
pnpm lint
```

Expected now:

- `pnpm build` fails on unused symbols in `tests/delivery/workspaceRecovery.test.ts`.
- `pnpm lint` fails on the same file.

- [ ] **Step 2: Remove unused symbols**

In `tests/delivery/workspaceRecovery.test.ts`:

- remove unused imports `getOrdersForWallet` and `getSessionsForWallet`
- remove unused local `sessionId` in the test named `delivered asset in IndexedDB is visible when no live socket message arrives`

Do not change test behavior.

- [ ] **Step 3: Verify gates**

Run:

```bash
pnpm test
pnpm build
pnpm lint
git diff --check
```

Expected:

- all commands exit `0`
- `pnpm test` still reports `402/402`

- [ ] **Step 4: Commit and buzz**

Commit:

```bash
git add tests/delivery/workspaceRecovery.test.ts
git commit -m "fix: restore delivery workspace release gates"
```

Post Eric buzz describing:

- build/lint were failing because of unused test symbols
- the fix was test-only
- `pnpm test`, `pnpm build`, `pnpm lint`, and `git diff --check` passed

### Task 2: Remove Buyer-Visible Technical Copy

**Purpose:** Make Delivery feel like a buyer product, not a private-chat/debug console.

**Files:**

- Modify: `src/i18n/zh-CN.ts`
- Modify: `src/components/delivery/DeliveryComposer.tsx`
- Modify: `src/components/delivery/MessageBubble.tsx`
- Modify: `src/components/delivery/DeliveryStatusTimeline.tsx`
- Modify: `src/components/delivery/DeliveryWorkspaceHeader.tsx`
- Modify: `src/components/delivery/DeliveryOrderList.tsx` if needed
- Modify: `tests/components/delivery/DeliveryPage.test.tsx`
- Modify: `tests/components/delivery/DeliveryComposer.test.tsx`
- Modify: `tests/components/delivery/MessageBubble.test.tsx`
- Modify: `tests/components/delivery/DeliveryStatusTimeline.test.tsx`
- Modify: `tests/components/delivery/DeliveryWorkspaceHeader.test.tsx`

- [ ] **Step 1: Add failing buyer-copy tests**

Extend `tests/components/delivery/DeliveryPage.test.tsx` with a test that renders the disconnected Delivery page and asserts normal visible text does not contain banned terms:

```ts
expect(screen.queryByText(/simplemsg|Socket\.IO|metaso-p2p|chat key|ciphertext|session/i)).not.toBeInTheDocument()
expect(screen.queryByText(/Wallet not connected|Connect wallet to reply|Message provider/i)).not.toBeInTheDocument()
```

Add component-level tests for:

- `DeliveryComposer` wallet disconnected state uses Chinese buyer copy.
- `DeliveryComposer` missing provider key state does not show `Provider chat key unavailable` or `Fetch provider key`.
- `MessageBubble` decrypt-failed default state does not show `ciphertext`, `Unable to decrypt`, or raw encrypted content until the user opens technical details.
- `DeliveryWorkspaceHeader` null state does not use aria label `No delivery session selected`.

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
pnpm test -- tests/components/delivery/DeliveryPage.test.tsx tests/components/delivery/DeliveryComposer.test.tsx tests/components/delivery/MessageBubble.test.tsx tests/components/delivery/DeliveryStatusTimeline.test.tsx tests/components/delivery/DeliveryWorkspaceHeader.test.tsx
```

Expected:

- new tests fail on current English/technical copy

- [ ] **Step 3: Replace normal UI copy**

Use buyer-facing Chinese copy. Suggested replacements:

- `Wallet not connected` -> `连接钱包后查看交付`
- `Connect wallet to reply` -> `连接钱包后可继续沟通`
- `Message provider` -> `补充需求或询问进度`
- `Send` -> `发送`
- `Provider chat key unavailable` -> `暂时无法发送，正在补全对方资料`
- `Fetch provider key` -> only show as `重试同步资料` inside a diagnostic/details area
- `Unknown service` -> `历史交付`
- `No delivery session selected` -> `选择一个请求查看交付`
- `Could not decrypt` default copy -> `这条交付记录暂时无法显示，已保留原始记录`

Keep technical terms only under an explicit details control labeled `技术详情`.

- [ ] **Step 4: Re-run focused tests**

Run:

```bash
pnpm test -- tests/components/delivery/DeliveryPage.test.tsx tests/components/delivery/DeliveryComposer.test.tsx tests/components/delivery/MessageBubble.test.tsx tests/components/delivery/DeliveryStatusTimeline.test.tsx tests/components/delivery/DeliveryWorkspaceHeader.test.tsx
```

Expected:

- all focused tests pass

- [ ] **Step 5: Full gates**

Run:

```bash
pnpm test
pnpm build
pnpm lint
git diff --check
```

- [ ] **Step 6: Commit and buzz**

Commit:

```bash
git add src/i18n/zh-CN.ts src/components/delivery tests/components/delivery
git commit -m "fix: polish delivery buyer-facing copy"
```

Post Eric buzz with before/after summary and verification commands.

### Task 3: Make Checkout Navigate To Order-Centered Delivery

**Purpose:** After Pay & Request, the user should land on a selected order, not an internal session URL.

**Files:**

- Modify: `src/order/flow.ts`
- Modify: `src/components/hub/RequestModal.tsx`
- Modify: `src/delivery/orderStore.ts` if return shape needs metadata
- Modify: `tests/components/hub/RequestModal.test.tsx`
- Modify: `tests/order/flow.test.ts`
- Modify: `tests/components/delivery/DeliveryPage.test.tsx` if selected order URL behavior needs coverage

- [ ] **Step 1: Add failing tests for `?order=` navigation**

In `tests/components/hub/RequestModal.test.tsx`, update/add tests so successful checkout expects:

```ts
expect(navigate).toHaveBeenCalledWith('/delivery?order=idqbuyer%3Aidqprovider%3Aorder-ref-1')
```

For paid order, use payment txid as the correlation id:

```ts
expect(navigate).toHaveBeenCalledWith('/delivery?order=idqbuyer%3Aidqprovider%3Apaid-txid-1')
```

For recoverable failed broadcast, the `Open Delivery` button should also navigate to the persisted order id when persistence succeeded.

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```bash
pnpm test -- tests/components/hub/RequestModal.test.tsx tests/order/flow.test.ts
```

Expected:

- tests fail because current helper returns `/delivery?session=...`

- [ ] **Step 3: Implement order path helper**

In `src/order/flow.ts`, add a helper without removing session compatibility:

```ts
export function buildDeliveryOrderPath(orderId: string): string {
  return `/delivery?order=${encodeURIComponent(orderId)}`
}
```

Keep `buildDeliverySessionPath()` for old URLs and historical tests that still need compatibility.

- [ ] **Step 4: Navigate after persistence**

In `RequestModal`, use the result from `persistPendingOrder()`:

```ts
const persisted = await persistPendingOrder(...)
navigate(buildDeliveryOrderPath(persisted.order.id))
```

If persistence fails after the order was actually sent, fall back to the existing session path and keep the warning log.

For `PayAndRequestBroadcastError`, use the result from `persistFailedToSendOrder()` to set a recoverable order path, not only a recoverable session key.

- [ ] **Step 5: Re-run focused tests**

Run:

```bash
pnpm test -- tests/components/hub/RequestModal.test.tsx tests/order/flow.test.ts tests/components/delivery/DeliveryPage.test.tsx
```

- [ ] **Step 6: Full gates**

Run:

```bash
pnpm test
pnpm build
pnpm lint
git diff --check
```

- [ ] **Step 7: Commit and buzz**

Commit:

```bash
git add src/order/flow.ts src/components/hub/RequestModal.tsx src/delivery/orderStore.ts tests/components/hub/RequestModal.test.tsx tests/order/flow.test.ts tests/components/delivery/DeliveryPage.test.tsx
git commit -m "fix: route checkout to selected delivery order"
```

Only include files actually changed.

### Task 4: Re-Verify Real metaso-p2p Service Readiness

**Purpose:** Stop relying on stale blocked notes. Re-check current local and public metaso-p2p behavior with mocks disabled, then fix BotHub normalization only if current live data proves a frontend gap.

**Files:**

- Modify: `src/api/aggregator.ts` only if live data requires normalization changes
- Modify: `src/api/aggregator.types.ts` only if live schema includes missing typed fields
- Modify: `src/api/userProfile.ts` only if profile fallback still misses chat keys/avatar/name
- Modify: `tests/api/aggregator.test.ts`
- Modify: `tests/api/userProfile.test.ts`
- Create/modify: `docs/qa/delivery-workspace-release-hardening-run-log.md`
- Potential create: `/Users/tusm/Documents/MetaID_Projects/metaso-p2p/issues/YYYY-MM-DD-bothub-aggregator-readiness.md`

- [ ] **Step 1: Record current listener state**

Run:

```bash
lsof -nP -iTCP -sTCP:LISTEN | rg "(18091|5176|vite|metaso-p2p)" || true
curl -sS -i http://127.0.0.1:18091/healthz || true
curl -sS -i 'https://api.idchat.io/api/bot-hub/skill-service/list?size=3&chainName=mvc&sortBy=updated&order=desc&includeInactive=true' || true
```

Write the result into `docs/qa/delivery-workspace-release-hardening-run-log.md`.

- [ ] **Step 2: Run metaso-p2p smoke**

Run:

```bash
METASO_P2P_BASE_URL=http://127.0.0.1:18091 pnpm smoke:metaso-p2p
```

If local metaso-p2p is down:

- do not mark live acceptance as passed
- record the exact failure
- check whether public metaso-p2p can be used for this task

- [ ] **Step 3: Inspect provider chat key data**

Run a small Node probe against whichever metaso-p2p endpoint is available:

```bash
node <<'NODE'
const base = process.env.METASO_P2P_BASE_URL || 'http://127.0.0.1:18091'
async function json(path) {
  const res = await fetch(base + path)
  const text = await res.text()
  try { return { status: res.status, json: JSON.parse(text) } }
  catch { return { status: res.status, text: text.slice(0, 500) } }
}
const list = await json('/api/bot-hub/skill-service/list?size=20&chainName=mvc&sortBy=updated&order=desc&includeInactive=true')
console.log('LIST', JSON.stringify(list).slice(0, 1200))
const items = list.json?.data?.list || []
for (const item of items.slice(0, 5)) {
  const id = item.id || item.currentPinId || item.sourceServicePinId
  if (!id) continue
  const detail = await json(`/api/bot-hub/skill-service/detail/${encodeURIComponent(id)}?chainName=mvc`)
  const provider = detail.json?.data?.provider || {}
  console.log(JSON.stringify({
    service: item.displayName || item.name || item.serviceName,
    id,
    price: item.price,
    listChatPubkey: item.providerChatPubkey || item.chatPubkey,
    provider: {
      metaid: provider.metaid,
      globalMetaId: provider.globalMetaId,
      name: provider.name,
      avatar: provider.avatar,
      chatPubkey: provider.chatPubkey || provider.providerChatPubkey || provider.chatPublicKey || provider.chat_pubkey,
    },
    detailStatus: detail.status,
    detailCode: detail.json?.code,
  }))
}
NODE
```

- [ ] **Step 4: Fix frontend normalization only if needed**

If current detail/list/profile data has chat key/name/avatar fields but BotHub misses them:

- add the exact field spelling to `aggregator.types.ts`
- normalize it in `aggregator.ts` or `userProfile.ts`
- add tests using the observed payload shape

If current metaso-p2p still lacks required fields or is unavailable:

- create an issue in `/Users/tusm/Documents/MetaID_Projects/metaso-p2p/issues/`
- include failing URL, expected shape, actual shape, BotHub impact, and reproduction
- do not fake success in BotHub

- [ ] **Step 5: Verify with mocks disabled**

Start or reuse Vite with:

```bash
VITE_METASO_P2P_BASE_URL=/metaso-p2p VITE_USE_AGGREGATOR_MOCK=false VITE_USE_WS_MOCK=false pnpm dev -- --host 127.0.0.1
```

Open the assigned port and verify:

- Bot Hub service list loads real services, or an honest error is visible
- service detail includes orderability data when available
- no mock-only service names are used as live evidence

- [ ] **Step 6: Full gates and commit**

Run:

```bash
pnpm test
pnpm build
pnpm lint
git diff --check
```

Commit:

```bash
git add src/api tests/api docs/qa/delivery-workspace-release-hardening-run-log.md
git commit -m "fix: verify delivery live service readiness"
```

Only include `src/api`/`tests/api` if changed. If only docs were changed, use:

```bash
git add docs/qa/delivery-workspace-release-hardening-run-log.md
git commit -m "docs: record delivery live service readiness"
```

Post Eric buzz.

### Task 5: Harden Free And Paid Order Flows

**Purpose:** Make Pay & Request behavior reliable and understandable for real buyers.

**Files:**

- Modify: `src/order/payAndRequestStages.ts` only if tests reveal a real issue
- Modify: `src/order/flow.ts`
- Modify: `src/components/hub/RequestModal.tsx`
- Modify: `src/delivery/orderStore.ts`
- Modify: `tests/order/flow.test.ts`
- Modify: `tests/components/hub/RequestModal.test.tsx`
- Modify: `docs/qa/delivery-workspace-release-hardening-run-log.md`
- Potential create: `/Users/tusm/Documents/MetaID_Projects/metaso-p2p/issues/YYYY-MM-DD-bothub-order-flow-gap.md`

- [ ] **Step 1: Add/confirm tests for free flow**

`tests/order/flow.test.ts` must prove:

- free service does not call `metalet.transfer`
- free service does call `metalet.ecdh`
- free service does call `metalet.createPin` at `/protocols/simplemsg`
- result contains `orderReference`, `sessionKey`, `orderPayload`, and `displaySummary`

- [ ] **Step 2: Add/confirm tests for paid native flow**

`tests/order/flow.test.ts` must prove:

- paid native service calls `metalet.transfer` before `metalet.createPin`
- transfer task uses expected chain/currency/address/amount
- `paymentTxid` is used as the order correlation id
- if transfer succeeds but `createPin` fails, `PayAndRequestBroadcastError.partial` contains enough data for local recovery

- [ ] **Step 3: Add/confirm RequestModal recovery tests**

`tests/components/hub/RequestModal.test.tsx` must prove:

- successful free order persists a pending order and navigates to `?order=`
- successful paid order persists a pending order with payment reference
- payment succeeded but broadcast failed persists `failed_to_send`
- free broadcast failed persists `failed_to_send`
- buyer-facing error copy is not raw `Payment succeeded but...` English unless deliberately localized

- [ ] **Step 4: Implement minimal fixes**

Do not redesign checkout. Fix only what tests prove is wrong.

Important rules:

- Do not open the payment prompt if provider chat key is missing.
- Free order should skip payment and go straight to encrypted order broadcast.
- Paid native order should pay, then broadcast, then persist/navigate.
- MRC20 unsupported state must be buyer-facing and explicit.
- If payment succeeds but broadcast fails, persist local recovery state.

- [ ] **Step 5: Manual Chrome + Metalet attempt**

Using Chrome with Metalet:

- connect wallet if needed
- run one free service order if real services are available
- run one paid native service attempt up to the wallet confirmation point, if a paid native service is available
- the user has already authorized wallet confirmations for this project, but still record exactly what was clicked and whether the wallet prompt completed

If no real service is available:

- record this as an external blocker
- create/update a metaso-p2p issue if the API is the blocker

- [ ] **Step 6: Full gates and commit**

Run:

```bash
pnpm test
pnpm build
pnpm lint
git diff --check
```

Commit:

```bash
git add src/order src/components/hub/RequestModal.tsx src/delivery/orderStore.ts tests/order tests/components/hub/RequestModal.test.tsx docs/qa/delivery-workspace-release-hardening-run-log.md
git commit -m "fix: harden delivery order checkout flow"
```

Only include files actually changed. Post Eric buzz.

### Task 6: Harden Real Asset Preview And Management

**Purpose:** Make delivered images, video, audio, and attachments manageable with real URLs, not just seeded mock cards.

**Files:**

- Modify: `src/delivery/assetParser.ts`
- Modify: `src/components/delivery/AssetPreviewCard.tsx`
- Modify: `src/components/delivery/AssetPreviewDialog.tsx`
- Modify: `src/components/delivery/DeliveryAssetLibrary.tsx`
- Modify: `tests/delivery/assetParser.test.ts`
- Modify: `tests/components/delivery/AssetPreviewCard.test.tsx`
- Modify: `tests/components/delivery/AssetPreviewDialog.test.tsx`
- Modify: `tests/components/delivery/DeliveryAssetLibrary.test.tsx`
- Modify: `docs/qa/delivery-workspace-release-hardening-run-log.md`
- Potential create: `/Users/tusm/Documents/MetaID_Projects/metaso-p2p/issues/YYYY-MM-DD-bothub-metafile-preview-gap.md`

- [ ] **Step 1: Add asset parser tests for observed real forms**

Cover:

- `metafile://<pinid>.png`
- `metafile://<pinid>.mp4`
- `metafile://<pinid>.wav`
- `metafile://<pinid>.pdf`
- direct `https://file.metaid.io/metafile-indexer/api/v1/files/accelerate/content/<pinid>` links
- punctuation around URLs
- duplicate asset references

- [ ] **Step 2: Add preview fallback tests**

Component tests should prove:

- image preview falls back from accelerate URL to content URL on error
- video/audio cards do not collapse layout if media fails
- document/archive cards offer open/download without pretending inline preview exists
- copy one link and copy all links still work
- all visible labels are Chinese buyer-facing copy

- [ ] **Step 3: Implement minimal fixes**

Keep the current asset model. Add only the fallback/error state needed for reliable previews.

If browser CORS prevents media playback but direct open/download works:

- show a buyer-facing fallback such as `预览暂不可用，可打开文件`
- keep `打开` / `下载` visible
- record the CORS evidence in the QA log

- [ ] **Step 4: Verify with at least one real asset**

Use one of:

- real delivery message with `metafile://`
- a known real metafile URL from local/public metaso-p2p history
- a controlled test record inserted into IndexedDB that points to a real accessible metafile URL

Do not mark real asset acceptance as passed with only fake `https://preview.example` URLs.

- [ ] **Step 5: Full gates and commit**

Run:

```bash
pnpm test
pnpm build
pnpm lint
git diff --check
```

Commit:

```bash
git add src/delivery/assetParser.ts src/components/delivery/AssetPreviewCard.tsx src/components/delivery/AssetPreviewDialog.tsx src/components/delivery/DeliveryAssetLibrary.tsx tests/delivery/assetParser.test.ts tests/components/delivery/AssetPreviewCard.test.tsx tests/components/delivery/AssetPreviewDialog.test.tsx tests/components/delivery/DeliveryAssetLibrary.test.tsx docs/qa/delivery-workspace-release-hardening-run-log.md
git commit -m "fix: harden delivery asset previews"
```

Post Eric buzz.

### Task 7: Reconcile Delivery History Into Product Orders

**Purpose:** Reduce `Unknown service` / orphaned conversation behavior and make historical delivery records useful after refresh.

**Files:**

- Modify: `src/delivery/workspace.ts`
- Modify: `src/delivery/sessionGrouping.ts` if order correlation matching is incomplete
- Modify: `src/delivery/messageStore.ts` if persisted records lack useful display/profile fields
- Modify: `src/delivery/deliverySync.ts` if history merge drops usable messages
- Modify: `tests/delivery/workspace.test.ts`
- Modify: `tests/delivery/sessionGrouping.test.ts`
- Modify: `tests/delivery/messageStore.test.ts`
- Modify: `tests/delivery/deliverySync.test.ts`
- Modify: `tests/components/delivery/DeliveryPage.test.tsx`

- [ ] **Step 1: Add tests for order/message reconciliation**

Tests should cover:

- order-only row remains visible before provider reply
- provider reply with matching `orderCorrelationId` updates the same workspace order
- provider reply with `[DELIVERY:<orderRef>]` matches the order even if raw payload lacks a separate `orderCorrelationId` field
- paid provider reply with payment txid matches the paid order
- session-only historical messages show a buyer-safe fallback label such as `历史交付`, not `Unknown service`
- missing provider profile does not prevent viewing locally cached assets

- [ ] **Step 2: Confirm failures**

Run:

```bash
pnpm test -- tests/delivery/workspace.test.ts tests/delivery/sessionGrouping.test.ts tests/delivery/messageStore.test.ts tests/delivery/deliverySync.test.ts tests/components/delivery/DeliveryPage.test.tsx
```

- [ ] **Step 3: Implement minimal reconciliation fixes**

Preferred behavior:

- Use order id/correlation id/payment txid as the primary join key.
- Use provider globalMetaId as a secondary grouping key.
- Use parsed protocol tags (`[ORDER_STATUS:<id>]`, `[DELIVERY:<id>]`, `[ORDER_END:<id>]`) to recover missing correlation ids.
- Do not collapse unrelated orders from the same provider into one record.
- If a message cannot be associated with a known order, show it as a historical delivery row with safe fallback service copy.

- [ ] **Step 4: Re-run focused tests**

Run:

```bash
pnpm test -- tests/delivery/workspace.test.ts tests/delivery/sessionGrouping.test.ts tests/delivery/messageStore.test.ts tests/delivery/deliverySync.test.ts tests/components/delivery/DeliveryPage.test.tsx
```

- [ ] **Step 5: Full gates and commit**

Run:

```bash
pnpm test
pnpm build
pnpm lint
git diff --check
```

Commit:

```bash
git add src/delivery tests/delivery tests/components/delivery/DeliveryPage.test.tsx
git commit -m "fix: reconcile delivery history into orders"
```

Post Eric buzz.

### Task 8: Truthful Acceptance Documentation

**Purpose:** Replace the current over-optimistic acceptance note with evidence that distinguishes what passed, what is seeded, and what is externally blocked.

**Files:**

- Modify: `docs/superpowers/acceptance/2026-05-31-delivery-workspace-v1.md`
- Modify: `docs/qa/delivery-workspace-release-hardening-run-log.md`
- Optional create: `docs/qa/delivery-workspace-release-hardening-screenshots.md`

- [ ] **Step 1: Re-run automated gates**

Run:

```bash
pnpm test
pnpm build
pnpm lint
git diff --check
```

Paste command summaries into `docs/qa/delivery-workspace-release-hardening-run-log.md`.

- [ ] **Step 2: Re-run real metaso-p2p checks**

Record:

- local metaso-p2p health result
- public metaso-p2p list/detail result
- `pnpm smoke:metaso-p2p` result
- whether mocks were enabled or disabled

- [ ] **Step 3: Re-run browser checks**

With mocks disabled where possible:

- Bot Hub service list
- service detail
- Pay & Request modal
- Delivery empty state
- Delivery with cached/seeded order
- Delivery with real or controlled real asset URL
- mobile viewport around `390x844`
- desktop viewport around `1280x720` or larger

Capture screenshots only if they are newly generated for this task. Do not commit old untracked screenshots from prior sessions unless the controller explicitly approves.

- [ ] **Step 4: Update acceptance note truthfully**

Use four tables:

1. Automated gates
2. Seeded/local cache acceptance
3. Live metaso-p2p acceptance
4. Chrome + Metalet acceptance

For every row, status must be one of:

- `passed`
- `failed`
- `blocked`
- `not run`

Do not use `[x]` for blocked items.

- [ ] **Step 5: Full gates and commit**

Run:

```bash
pnpm test
pnpm build
pnpm lint
git diff --check
```

Commit:

```bash
git add docs/superpowers/acceptance/2026-05-31-delivery-workspace-v1.md docs/qa/delivery-workspace-release-hardening-run-log.md docs/qa/delivery-workspace-release-hardening-screenshots.md
git commit -m "docs: update delivery release acceptance evidence"
```

Only include screenshot doc if created. Post Eric buzz.

### Task 9: Independent Chrome + Metalet Final Acceptance

**Purpose:** Get a fresh final validation from an agent that did not implement Tasks 1-8.

**Owner:** Controller opens a new independent acceptance subagent/session.

**Tools:**

- Chrome browser with Metalet extension
- `computer-use:computer-use` if extension UI buttons must be clicked
- In-app Browser or Playwright for non-wallet page inspection

**Files:**

- Modify: `docs/qa/delivery-workspace-release-hardening-run-log.md`
- Modify: `docs/superpowers/acceptance/2026-05-31-delivery-workspace-v1.md` only if final acceptance changes status
- Potential create: `/Users/tusm/Documents/MetaID_Projects/metaso-p2p/issues/YYYY-MM-DD-bothub-final-acceptance-gap.md`

- [ ] **Step 1: Start known dev server**

Use:

```bash
VITE_METASO_P2P_BASE_URL=/metaso-p2p VITE_USE_AGGREGATOR_MOCK=false VITE_USE_WS_MOCK=false pnpm dev -- --host 127.0.0.1
```

If local metaso-p2p is unavailable, record it and use the configured public endpoint only if it is healthy.

- [ ] **Step 2: Connect wallet**

In Chrome:

- open the local BotHub URL
- connect Metalet
- approve extension prompts when required
- record displayed wallet name/avatar/globalMetaId behavior

- [ ] **Step 3: Free order run**

If a real free service is available:

- open service detail
- enter a buyer request in the request input
- click Pay & Request
- approve wallet ECDH/createPin prompts
- verify Delivery opens selected order
- refresh page
- reconnect if needed
- verify order is restored

If no real free service is available:

- record blocker
- include exact service list/detail evidence
- create/update metaso-p2p issue if API readiness is the blocker

- [ ] **Step 4: Paid native order run**

If a real paid native service is available:

- open service detail
- enter a buyer request
- start Pay & Request
- approve payment only if the amount and receiver are visible and reasonable for test
- continue through order broadcast
- verify recovery behavior if broadcast fails

If paid services are unavailable or missing required provider/payment fields:

- record exact blocker
- create/update metaso-p2p issue if needed

- [ ] **Step 5: Delivery asset run**

Verify at least one of:

- real delivered asset from provider
- controlled real metafile asset restored from IndexedDB

Check:

- image preview/open/download
- video/audio preview or fallback
- document/archive open/download
- copy one link
- copy all links
- refresh recovery

- [ ] **Step 6: Final gate**

Run:

```bash
pnpm test
pnpm build
pnpm lint
git diff --check
```

- [ ] **Step 7: Commit final acceptance docs and buzz**

If docs changed:

```bash
git add docs/qa/delivery-workspace-release-hardening-run-log.md docs/superpowers/acceptance/2026-05-31-delivery-workspace-v1.md
git commit -m "docs: record delivery final acceptance"
```

Post Eric buzz.

## 6. Metaso-p2p Issue Template

When a blocker belongs to metaso-p2p, create:

```text
/Users/tusm/Documents/MetaID_Projects/metaso-p2p/issues/YYYY-MM-DD-bothub-<short-gap>.md
```

Use this template:

```markdown
# Bothub <short problem>

## Summary

One-paragraph product impact.

## Environment

- Bothub commit:
- metaso-p2p base URL:
- Date/time:
- Wallet/globalMetaId if relevant:

## Reproduction

1.
2.
3.

## Expected

Exact response shape or behavior BotHub needs.

## Actual

Exact response/status/payload observed.

## Evidence

Commands, URLs, screenshots, or payload snippets.

## BotHub Impact

What user flow is blocked or degraded.

## Acceptance Criteria

- [ ] ...
```

Do not commit changes in the metaso-p2p repo unless the user explicitly asks the BotHub agent to do so.

## 7. Final Report Format

At the end of this phase, the controller should report:

- commits created
- Eric buzz status for each commit
- automated gate results
- live metaso-p2p status
- free order status
- paid order status
- asset preview status
- remaining blockers, grouped by `Bothub` vs `metaso-p2p` vs `provider availability`
- whether the app is ready for a small private beta

