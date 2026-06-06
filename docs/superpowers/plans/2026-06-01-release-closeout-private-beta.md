# Bothub Release Closeout Private Beta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. The controller opens one fresh development session/subagent per task, reviews the result, and sends the same task session back for rework until accepted. Do not open a separate code-review subagent for every task. After all tasks pass, open one independent final acceptance session using Chrome/Computer Use + Metalet for the end-to-end run. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gap between the completed Delivery Workspace V1 hardening branch and a small local/private buyer-flow beta that ordinary users can try with Metalet.

**Architecture:** Keep BotHub as a pure frontend React app backed by Metalet, metaso-p2p HTTP/Socket.IO, and IndexedDB. Do not add a BotHub backend. This phase is an integration and release-readiness pass: merge the completed hardening branch, switch private-chat reads to metaso-p2p's canonical routes with compatibility fallback, remove remaining buyer-visible technical/English product copy, and re-run real wallet acceptance against local metaso-p2p.

**Tech Stack:** Vite 5, React 18, TypeScript 5 strict, Tailwind CSS, zustand, IndexedDB, socket.io-client, Vitest + Testing Library, Chrome + Metalet, local/staging metaso-p2p.

---

## 0. Current State

Observed before writing this plan on 2026-06-01:

- Main worktree: `/Users/tusm/Documents/MetaID_Projects/bothub`
- Main branch: `main`
- Main `HEAD`: `7288438 docs: add delivery workspace release hardening plan`
- Implementation worktree: `/Users/tusm/.config/superpowers/worktrees/bothub/codex-delivery-workspace-release-hardening`
- Implementation branch: `codex/delivery-workspace-release-hardening`
- Implementation `HEAD`: `8a7a6ab docs: narrow private chat endpoint requirements`
- Implementation branch is clean.
- Main worktree has many unrelated untracked Playwright screenshots/logs. Do not stage them unless a task explicitly creates a controlled QA artifact.
- Fresh verification on the implementation branch passed:
  - `pnpm test`: 57 files / 437 tests passed
  - `pnpm build`: passed, with the existing Vite large chunk warning
  - `pnpm lint`: passed
  - `git diff --check`: passed
  - `METASO_P2P_BASE_URL=http://127.0.0.1:18091 METASO_P2P_PRIVATE_CHAT_METAID=idq1zfazvxaq69uw6txe3ewce30ewyhy9a7mzykgv0 METASO_P2P_PRIVATE_CHAT_OTHER_METAID=idq14hmv23j5fnlx4ccnmvlyldjd38xjsechzwg9xz pnpm smoke:metaso-p2p`: passed
- Local metaso-p2p `http://127.0.0.1:18091` is currently healthy and returns real BotHub skill-service rows.
- metaso-p2p has added canonical private-chat routes:
  - `GET /api/private-chat/homes/:metaId`
  - `GET /api/private-chat/messages`
  - `GET /api/private-chat/messages/by-index`
  - `GET /api/private-chat/paths`
- BotHub implementation branch still reads private chat through the historical compatibility routes in `src/api/privateChat.ts`:
  - `GET /api/group-chat/chat/homes/:metaId`
  - `GET /api/group-chat/private-chat-list`
- No production/staging metaso-p2p base URL has been assigned and verified yet.

## 1. Release Definition

This phase is complete only when all of the following are true:

- `codex/delivery-workspace-release-hardening` has been merged back into `main` with `git merge --no-ff`.
- `main` passes:
  - `pnpm test`
  - `pnpm build`
  - `pnpm lint`
  - `git diff --check`
  - local `pnpm smoke:metaso-p2p` against `http://127.0.0.1:18091`
- BotHub uses canonical `/api/private-chat/*` routes by default and falls back to legacy `/api/group-chat/*` only for compatibility.
- Normal buyer UI no longer exposes avoidable English/platform terms such as `Services`, `Search services`, `Pay & Request`, `Unknown Bot`, `Socket.IO`, `chat pubkey`, `CreatePin`, or raw transport vocabulary.
- Provider/service names and descriptions coming from chain data may remain in their original language.
- With mocks disabled, the Hub loads real services from local metaso-p2p.
- Chrome + Metalet acceptance proves at least:
  - wallet connect
  - one real free order buyer send
  - one native paid order buyer send up to approved payment/order PIN
  - Delivery navigation to the selected order
  - IndexedDB refresh recovery
  - AI_Sunny or another online provider reply appears or is recorded as a provider/runtime blocker with evidence
  - asset preview/open/download/copy behavior still works
- Acceptance docs clearly separate:
  - local/private beta readiness
  - strict production readiness
  - unresolved metaso-p2p/runtime blockers

## 2. Non-Goals

- Do not implement refunds.
- Do not implement rating submission.
- Do not implement provider-side features.
- Do not add a BotHub backend.
- Do not invent mock production evidence.
- Do not point production BotHub at idchat `/chat-api/` as a substitute for metaso-p2p.
- Do not clean unrelated untracked screenshots/logs unless the user explicitly asks.

## 3. Source Documents

Read before starting Task 1:

- `AGENTS.md`
- `docs/superpowers/plans/2026-05-31-delivery-workspace-release-hardening.md`
- `docs/superpowers/acceptance/2026-05-31-delivery-workspace-v1.md` from the implementation branch
- `docs/qa/delivery-workspace-release-hardening-run-log.md` from the implementation branch
- `/Users/tusm/Documents/MetaID_Projects/metaso-p2p/issues/issues-fixed-logs.md`
- `/Users/tusm/Documents/MetaID_Projects/metaso-p2p/docs/BOTHUB_METASO_P2P_ENDPOINT.md` if present
- `docs/architecture/metaso-p2p-local-api.md`

Use the current code as the source of truth when implementation differs from older docs.

## 4. File Map

Expected files to touch:

- `src/api/privateChat.ts`
  Switch default private-chat reads to canonical `/api/private-chat/*`; keep legacy route fallback for local or older metaso-p2p compatibility.

- `tests/api/privateChat.test.ts`
  Cover canonical route usage, legacy fallback, `data.list: null`, and non-404/405 error behavior.

- `scripts/smoke-metaso-p2p.mjs`
  Smoke canonical private-chat routes first; optionally verify legacy compatibility only as a fallback/reporting detail.

- `src/i18n/zh-CN.ts`
  Replace remaining buyer-visible English and technical copy with ordinary Chinese product language.

- `src/components/hub/RequestModal.tsx`
  Replace remaining checkout modal English and technical failure text with buyer-safe copy. Keep diagnostics in dev-only details.

- `src/components/hub/ServiceCard.tsx`
- `src/components/hub/ServiceDetailPanel.tsx`
- `src/components/hub/ServicesPanel.tsx`
- `src/components/hub/FiltersBar.tsx`
- `src/components/WalletConnectButton.tsx`
- `src/components/delivery/*`
  Touch only where remaining normal-state copy is hardcoded outside `zh-CN.ts`.

- `tests/components/hub/*.test.tsx`
- `tests/components/delivery/*.test.tsx`
- `tests/smoke.test.tsx`
- `tests/i18n/index.test.ts`
  Update expectations for buyer-facing Chinese copy.

- `.env.example`
- `README.md`
- `docs/architecture/metaso-p2p-local-api.md`
  Update only if runtime/env guidance is stale after canonical route work.

- `docs/qa/release-closeout-private-beta-run-log.md`
  Create a factual run log for this closeout phase.

- `docs/superpowers/acceptance/2026-06-01-release-closeout-private-beta.md`
  Create the final acceptance note for this phase.

Potential external files:

- `/Users/tusm/Documents/MetaID_Projects/metaso-p2p/issues/YYYY-MM-DD-bothub-<short-gap>.md`
  Create only if a blocker belongs to metaso-p2p and is not already covered.

## 5. Subagent Execution Protocol

For the controller:

- Open one fresh task session/subagent for each task.
- Give the task agent the global rules plus only the relevant task section.
- Review the exact diff after every task.
- Run the task-specific verification before accepting.
- If the task fails, send findings back to that same task agent for rework.
- Only move to the next task after the previous task is accepted.
- After every accepted task that modifies code/docs, require a focused commit and an Eric development-journal buzz.
- After Task 6 is accepted, open one independent final acceptance session using Chrome/Computer Use + Metalet.

For task agents:

- You are not alone in the codebase. Preserve unrelated changes and untracked artifacts.
- Do not revert edits from other agents.
- Keep changes scoped to the assigned task.
- Use TDD for behavior changes.
- Commit with one of `feat`, `fix`, `refactor`, `docs`, or `chore`.
- After every commit, post a detailed Eric development-journal buzz using the `metabot-post-buzz` skill.

## 6. Tasks

### Task 1: Merge Delivery Release-Hardening Branch Into Main

**Purpose:** Make the completed implementation branch the actual mainline before doing release-closeout work.

**Files:**

- Modify through merge: all files changed by `codex/delivery-workspace-release-hardening`
- Preserve untracked: `.playwright-mcp/*`, `bothub-delivery-*.png`, `task8-delivery-assets-*.png`

- [ ] **Step 1: Verify source branch state**

Run:

```bash
git -C /Users/tusm/.config/superpowers/worktrees/bothub/codex-delivery-workspace-release-hardening status --short --branch --untracked-files=all
git -C /Users/tusm/.config/superpowers/worktrees/bothub/codex-delivery-workspace-release-hardening log -1 --oneline
```

Expected:

- branch is `codex/delivery-workspace-release-hardening`
- no tracked changes
- `HEAD` is the implementation closeout commit or newer

- [ ] **Step 2: Re-run source branch gates**

Run from the implementation worktree:

```bash
pnpm test
pnpm build
pnpm lint
git diff --check
METASO_P2P_BASE_URL=http://127.0.0.1:18091 METASO_P2P_PRIVATE_CHAT_METAID=idq1zfazvxaq69uw6txe3ewce30ewyhy9a7mzykgv0 METASO_P2P_PRIVATE_CHAT_OTHER_METAID=idq14hmv23j5fnlx4ccnmvlyldjd38xjsechzwg9xz pnpm smoke:metaso-p2p
```

Expected:

- all commands exit `0`
- Vite large chunk warning is acceptable
- React Router/FocusTrap test warnings are acceptable only if tests pass

- [ ] **Step 3: Verify main worktree before merge**

Run:

```bash
cd /Users/tusm/Documents/MetaID_Projects/bothub
git status --short --branch --untracked-files=all
```

Expected:

- branch is `main`
- tracked files are clean
- unrelated untracked QA screenshots/logs may exist and must remain unstaged

- [ ] **Step 4: Merge with a no-fast-forward merge commit**

Run:

```bash
git merge --no-ff codex/delivery-workspace-release-hardening -m "feat: merge delivery workspace release hardening"
```

If conflicts occur:

- resolve by preserving the implementation branch behavior unless the current main plan doc would be lost
- do not stage unrelated untracked files
- run `git diff --check`
- complete the merge commit

- [ ] **Step 5: Run merged-main gates**

Run from main:

```bash
pnpm test
pnpm build
pnpm lint
git diff --check
METASO_P2P_BASE_URL=http://127.0.0.1:18091 METASO_P2P_PRIVATE_CHAT_METAID=idq1zfazvxaq69uw6txe3ewce30ewyhy9a7mzykgv0 METASO_P2P_PRIVATE_CHAT_OTHER_METAID=idq14hmv23j5fnlx4ccnmvlyldjd38xjsechzwg9xz pnpm smoke:metaso-p2p
```

Expected:

- all commands exit `0`

- [ ] **Step 6: Post Eric buzz for the merge commit**

Post a development journal that includes:

- merged branch name
- merge commit hash
- gate results
- local metaso-p2p smoke result
- note that unrelated untracked QA artifacts were not staged

### Task 2: Switch Private Chat Reads To Canonical Metaso-P2P Routes

**Purpose:** Align Bothub with the new metaso-p2p private-chat contract before release, while keeping legacy compatibility as a fallback.

**Files:**

- Modify: `src/api/privateChat.ts`
- Modify: `tests/api/privateChat.test.ts`
- Modify: `scripts/smoke-metaso-p2p.mjs`
- Optional docs: `docs/architecture/metaso-p2p-local-api.md`
- Optional docs: `docs/qa/release-closeout-private-beta-run-log.md`

- [ ] **Step 1: Write canonical route tests**

Add tests proving:

- `listPrivateChatHomes(metaId)` calls `/api/private-chat/homes/:metaId`
- `listPrivateChatHistory(params)` calls `/api/private-chat/messages?...`
- `data.list: null` normalizes to `[]`
- canonical `404` or `405` falls back to the legacy `/api/group-chat/...` route
- canonical non-404 failures do not silently fallback and hide real server errors

Suggested test cases:

```ts
it('loads private chat homes from canonical metaso-p2p route', async () => {
  // fetch mock returns code 0 with data.list []
  // expect first fetch URL to contain /api/private-chat/homes/
})

it('falls back to legacy homes route only when canonical route is missing', async () => {
  // first fetch: 404
  // second fetch: code 0 with data.list []
  // expect second URL to contain /api/group-chat/chat/homes/
})

it('loads private chat history from canonical messages route', async () => {
  // expect URL pathname /api/private-chat/messages
})
```

- [ ] **Step 2: Run tests and confirm they fail**

Run:

```bash
pnpm vitest run tests/api/privateChat.test.ts
```

Expected:

- new canonical route tests fail because the implementation still uses legacy routes

- [ ] **Step 3: Implement canonical-first fetch helper**

In `src/api/privateChat.ts`, add a small helper instead of duplicating fallback code:

```ts
async function fetchPrivateChatEnvelope(
  canonicalPath: string,
  legacyPath: string,
): Promise<ApiEnvelope<unknown>> {
  const baseUrl = getNormalizedMetasoP2PBaseUrl()
  const canonicalResponse = await fetch(`${baseUrl}${canonicalPath}`)
  if (canonicalResponse.ok || ![404, 405].includes(canonicalResponse.status)) {
    return (await canonicalResponse.json()) as ApiEnvelope<unknown>
  }
  const legacyResponse = await fetch(`${baseUrl}${legacyPath}`)
  return (await legacyResponse.json()) as ApiEnvelope<unknown>
}
```

Then use:

- canonical homes: `/api/private-chat/homes/${encodedMetaId}`
- legacy homes: `/api/group-chat/chat/homes/${encodedMetaId}`
- canonical messages: `/api/private-chat/messages?${query}`
- legacy messages: `/api/group-chat/private-chat-list?${query}`

Keep the parser behavior unchanged.

- [ ] **Step 4: Switch smoke script to canonical routes**

In `scripts/smoke-metaso-p2p.mjs`:

- use `/api/private-chat/homes/:metaId`
- use `/api/private-chat/messages?...`
- preserve the output fields so acceptance docs stay readable
- if fallback is included in the smoke script, clearly label it as fallback, not the primary contract

- [ ] **Step 5: Run focused verification**

Run:

```bash
pnpm vitest run tests/api/privateChat.test.ts
METASO_P2P_BASE_URL=http://127.0.0.1:18091 METASO_P2P_PRIVATE_CHAT_METAID=idq1zfazvxaq69uw6txe3ewce30ewyhy9a7mzykgv0 METASO_P2P_PRIVATE_CHAT_OTHER_METAID=idq14hmv23j5fnlx4ccnmvlyldjd38xjsechzwg9xz pnpm smoke:metaso-p2p
```

Expected:

- tests pass
- smoke output shows canonical private-chat route compatibility

- [ ] **Step 6: Run full gates**

Run:

```bash
pnpm test
pnpm build
pnpm lint
git diff --check
```

Expected:

- all commands exit `0`

- [ ] **Step 7: Commit and buzz**

Run:

```bash
git add src/api/privateChat.ts tests/api/privateChat.test.ts scripts/smoke-metaso-p2p.mjs docs/architecture/metaso-p2p-local-api.md docs/qa/release-closeout-private-beta-run-log.md
git commit -m "fix: use canonical private chat routes"
```

Only add docs files if touched.

Post Eric buzz with:

- canonical route change
- fallback rule
- smoke command result
- test/build/lint status

### Task 3: Polish Buyer-Facing Hub And Checkout Copy

**Purpose:** Remove remaining product-facing English/technical copy for ordinary buyer users, without rewriting service data that comes from providers.

**Files:**

- Modify: `src/i18n/zh-CN.ts`
- Modify: `src/components/hub/RequestModal.tsx`
- Optional modify: `src/components/hub/ServiceCard.tsx`
- Optional modify: `src/components/hub/ServiceDetailPanel.tsx`
- Optional modify: `src/components/hub/ServicesPanel.tsx`
- Optional modify: `src/components/hub/FiltersBar.tsx`
- Optional modify: `src/components/WalletConnectButton.tsx`
- Tests: `tests/components/hub/*.test.tsx`
- Tests: `tests/smoke.test.tsx`
- Tests: `tests/i18n/index.test.ts`

- [ ] **Step 1: Inventory remaining normal UI copy**

Run:

```bash
rg -n "Services|Search services|Pay & Request|Unknown Bot|No chat pubkey|Socket\\.IO|CreatePin|Provider|Price|Settlement|Broadcasting|Encrypting|Confirm &|Request failed|Loading services|Online bots" src tests
```

Classify each hit:

- normal buyer UI: must be localized/simplified
- diagnostic/details-only: can remain if hidden behind explicit details
- provider chain data/test fixture: may remain
- test expectation: update after UI copy changes

- [ ] **Step 2: Write/adjust tests for buyer copy**

Add or update tests to assert:

- main Hub heading is buyer-facing Chinese, for example `服务广场` or `可下单服务`
- service search placeholder is Chinese
- CTA button is Chinese, for example `下单请求`
- checkout modal labels are Chinese
- wallet-required copy does not mention Socket.IO
- missing provider chat key copy does not mention `chat pubkey`

Run:

```bash
pnpm vitest run tests/components/hub tests/smoke.test.tsx tests/i18n/index.test.ts
```

Expected:

- updated tests fail before implementation if they assert new copy

- [ ] **Step 3: Update `zh-CN.ts` copy**

Suggested replacements:

```ts
nav: {
  botHub: '服务广场',
  delivery: '我的交付',
},
wallet: {
  requiredChat: '连接 Metalet 钱包后即可接收交付消息',
},
hub: {
  servicesTitle: '可下单服务',
  servicesSubtitle: '选择远端 Bot 服务，填写需求后即可发起请求。',
  searchServices: '搜索服务',
  searchPlaceholder: '搜索服务、能力或服务方…',
  onlineBots: '在线服务方',
  onlineBotsEmpty: '服务加载后会显示在线服务方',
  selectServiceTitle: '选择服务',
  selectServiceHint: '选择一个服务查看价格、服务方和下单入口。',
  serviceDetail: '服务详情',
  closeDetail: '关闭服务详情',
  loadingServices: '正在加载服务',
  loadingDetail: '正在加载服务详情',
  noServicesTitle: '没有找到服务',
  noServicesHint: '可以清空筛选或换个关键词。',
  servicesError: '暂时无法加载服务',
  detailError: '暂时无法加载服务详情',
  payRequest: '下单请求',
  pricing: '价格',
  price: '价格',
  settlement: '结算方式',
  paymentChain: '支付网络',
  unknownBot: '未知服务方',
  providerFallback: '未知服务方',
  noChatPubkey: '服务方暂时无法接单',
}
```

Keep terms like `MRC20`, `SPACE`, `BTC`, `DOGE`, and provider service names unchanged when they are domain data.

- [ ] **Step 4: Replace hardcoded RequestModal English**

In `src/components/hub/RequestModal.tsx`, replace normal UI strings such as:

- `Pay & Request`
- `Describe what you need from the provider`
- `Your request (required)`
- `Review`
- `Provider`
- `Price`
- `Settlement`
- `Confirm & pay`
- `Checking wallet`
- `Payment`
- `Encrypting order`
- `Broadcasting to chain`
- `Order sent. Opening delivery…`
- `Close`
- `Try again`
- `Open Delivery`

with buyer-facing Chinese.

Keep dev diagnostics available only behind `<details>` and only in `import.meta.env.DEV` paths.

- [ ] **Step 5: Run focused UI tests**

Run:

```bash
pnpm vitest run tests/components/hub tests/smoke.test.tsx tests/i18n/index.test.ts
```

Expected:

- tests pass

- [ ] **Step 6: Browser smoke normal UI**

Run dev server with mocks disabled:

```bash
VITE_METASO_P2P_BASE_URL=/metaso-p2p VITE_USE_AGGREGATOR_MOCK=false VITE_USE_WS_MOCK=false pnpm dev -- --host 127.0.0.1
```

Open the served URL and check:

- Hub title and filters are Chinese
- visible CTA is Chinese
- service names/descriptions can remain provider-authored language
- no visible normal-state `Socket.IO`, `chat pubkey`, `CreatePin`, or raw endpoint names

- [ ] **Step 7: Run full gates**

Run:

```bash
pnpm test
pnpm build
pnpm lint
git diff --check
```

- [ ] **Step 8: Commit and buzz**

Run:

```bash
git add src/i18n/zh-CN.ts src/components/hub/RequestModal.tsx src/components/hub src/components/WalletConnectButton.tsx tests/components/hub tests/smoke.test.tsx tests/i18n/index.test.ts
git commit -m "fix: polish buyer-facing service copy"
```

Only add files actually touched.

Post Eric buzz with:

- copy areas changed
- tests and browser smoke performed
- any intentionally remaining provider-authored English

### Task 4: Refresh Runtime Configuration And Release Docs

**Purpose:** Make the deploy/runtime contract clear enough for a development session, local beta, or future staging deployment.

**Files:**

- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/architecture/metaso-p2p-local-api.md`
- Create: `docs/qa/release-closeout-private-beta-run-log.md` if not already created
- Optional create: `docs/deployment/bothub-private-beta.md`

- [ ] **Step 1: Check current env docs**

Run:

```bash
sed -n '1,200p' .env.example
sed -n '1,220p' docs/architecture/metaso-p2p-local-api.md
rg -n "VITE_METASO_P2P_BASE_URL|VITE_USE_AGGREGATOR_MOCK|VITE_USE_WS_MOCK|chat-api|private-chat|group-chat" README.md docs .env.example
```

- [ ] **Step 2: Update runtime guidance**

Document these rules:

- local private beta:

```dotenv
VITE_METASO_P2P_BASE_URL=/metaso-p2p
VITE_USE_AGGREGATOR_MOCK=false
VITE_USE_WS_MOCK=false
```

- local Vite proxy target is `http://127.0.0.1:18091`
- production/staging must provide a metaso-p2p root base URL, not idchat `/chat-api/`
- canonical private-chat routes are `/api/private-chat/*`
- legacy `/api/group-chat/*` routes are compatibility fallback only
- mocks are development-only and not release evidence

- [ ] **Step 3: Add release run-log skeleton**

Create or update `docs/qa/release-closeout-private-beta-run-log.md` with sections:

```markdown
# Release Closeout Private Beta Run Log

## Automated Gates

## Local Metaso-P2P Smoke

## Browser UI Copy Smoke

## Chrome + Metalet Acceptance

## Asset Acceptance

## Remaining Blockers

## Final Readiness Decision
```

- [ ] **Step 4: Verify docs**

Run:

```bash
git diff --check
```

- [ ] **Step 5: Commit and buzz**

Run:

```bash
git add .env.example README.md docs/architecture/metaso-p2p-local-api.md docs/qa/release-closeout-private-beta-run-log.md docs/deployment/bothub-private-beta.md
git commit -m "docs: clarify private beta runtime contract"
```

Only add docs files actually touched.

Post Eric buzz with:

- env contract
- canonical API notes
- staging/production blocker if still present

### Task 5: Final Local Mainline Gate And UI Acceptance

**Purpose:** Prove the main branch is locally usable before asking a real wallet session to spend money or write pins.

**Files:**

- Modify docs only if recording run results:
  - `docs/qa/release-closeout-private-beta-run-log.md`

- [ ] **Step 1: Run full automated gate**

Run:

```bash
pnpm test
pnpm build
pnpm lint
git diff --check
METASO_P2P_BASE_URL=http://127.0.0.1:18091 METASO_P2P_PRIVATE_CHAT_METAID=idq1zfazvxaq69uw6txe3ewce30ewyhy9a7mzykgv0 METASO_P2P_PRIVATE_CHAT_OTHER_METAID=idq14hmv23j5fnlx4ccnmvlyldjd38xjsechzwg9xz pnpm smoke:metaso-p2p
```

Expected:

- all commands exit `0`

- [ ] **Step 2: Start local app**

Run:

```bash
VITE_METASO_P2P_BASE_URL=/metaso-p2p VITE_USE_AGGREGATOR_MOCK=false VITE_USE_WS_MOCK=false pnpm dev -- --host 127.0.0.1
```

Record the actual URL Vite serves.

- [ ] **Step 3: In-app Browser smoke**

Using the in-app Browser:

- open the local app URL
- verify real service cards load
- open `/delivery`
- verify empty wallet-gated state
- verify visible normal-state copy is buyer-safe
- check console for app errors

No wallet or payment action is required in this task.

- [ ] **Step 4: Seeded asset recovery check**

If a helper already exists from previous acceptance, reuse it. Otherwise use the existing controlled Playwright seeding pattern from the hardening run-log.

Verify:

- cached order restores after refresh
- image asset preview/open/download works
- video/audio/document/archive fallback cards are usable
- copy-one and copy-all controls work
- mobile viewport does not overlap controls

- [ ] **Step 5: Record evidence**

Append to `docs/qa/release-closeout-private-beta-run-log.md`:

- gate output summary
- dev URL
- smoke result
- screenshots paths if generated
- any warnings that remain

- [ ] **Step 6: Commit docs if changed and buzz**

Run:

```bash
git add docs/qa/release-closeout-private-beta-run-log.md
git commit -m "docs: record release closeout local gate"
```

Skip commit if no docs changed.

Post Eric buzz if committed.

### Task 6: Independent Chrome + Metalet Buyer-Flow Acceptance

**Purpose:** Prove the private beta flow with the real browser extension and real local metaso-p2p.

**Files:**

- Create: `docs/superpowers/acceptance/2026-06-01-release-closeout-private-beta.md`
- Modify: `docs/qa/release-closeout-private-beta-run-log.md`

- [ ] **Step 1: Open a fresh acceptance session**

Use a separate acceptance session/subagent with Chrome or Computer Use + Metalet.

Required context:

- local app URL from Task 5
- local metaso-p2p base URL
- permission to use Metalet test funds already granted by user in this project context
- do not enter passwords; user handles any prompt that requires manual intervention

- [ ] **Step 2: Connect wallet**

Verify:

- Metalet connect succeeds
- header shows user avatar/name when available
- no repeated decrypt prompts appear on Delivery load

Record:

- displayed wallet name
- globalMetaId prefix
- screenshot path

- [ ] **Step 3: Free order buyer send**

Use a real free service from local metaso-p2p.

Flow:

- open service detail
- click Chinese CTA
- enter a realistic buyer request in the input box
- approve Metalet CreatePin when prompted
- verify app navigates to `/delivery?order=...`
- verify Delivery shows selected order and request record
- refresh and verify recovery

Record:

- service id/name
- buyer order pin/tx if visible
- Delivery order id
- any provider reply if it appears

- [ ] **Step 4: Paid native order buyer send**

Use a real low-cost native paid service only if:

- amount is visible
- receiver/payment address is visible or documented in the detail payload
- provider chat key exists

Flow:

- open paid service detail
- enter request
- approve Metalet transfer
- approve order CreatePin
- verify app navigates to Delivery
- verify paid request record includes price/payment reference

Record:

- payment txid
- order pin txid
- amount/currency
- receiver
- any mempool/indexing status

If a safe paid service is unavailable, mark as blocked with exact evidence.

- [ ] **Step 5: Provider reply / AI_Sunny check**

Prefer AI_Sunny or any online provider known to reply.

Verify:

- provider reply appears in metaso-p2p private-chat history
- Bothub Delivery merges provider reply into the selected order, not a separate `历史交付` row
- encrypted records use buyer-safe fallback if not decryptable
- no raw ciphertext appears in normal UI

Record:

- provider canonical globalMetaId
- private-chat query evidence
- UI evidence

- [ ] **Step 6: Follow-up composer check**

In a selected Delivery order:

- type a short follow-up
- send through Metalet
- approve CreatePin
- verify outgoing message appears optimistically or after refresh
- verify failure path saves recoverable state if Metalet response is lost

If sending would create too much repeated chain noise, run once only and document the reason.

- [ ] **Step 7: Asset management check**

Use either:

- real provider-delivered assets, or
- controlled real metafile assets restored from IndexedDB

Verify:

- preview
- open
- download
- copy link
- copy all links
- refresh recovery
- mobile viewport

- [ ] **Step 8: Create final acceptance note**

Create `docs/superpowers/acceptance/2026-06-01-release-closeout-private-beta.md` with tables:

- Automated gates
- Local metaso-p2p
- Browser UI copy smoke
- Chrome + Metalet
- Asset management
- Remaining blockers
- Final decision

Use these statuses only:

- `passed`
- `blocked externally`
- `blocked in Bothub`
- `not run`

Do not mark production release as passed unless a non-local metaso-p2p base URL is assigned and verified.

- [ ] **Step 9: Run final full gate**

Run:

```bash
pnpm test
pnpm build
pnpm lint
git diff --check
METASO_P2P_BASE_URL=http://127.0.0.1:18091 METASO_P2P_PRIVATE_CHAT_METAID=idq1zfazvxaq69uw6txe3ewce30ewyhy9a7mzykgv0 METASO_P2P_PRIVATE_CHAT_OTHER_METAID=idq14hmv23j5fnlx4ccnmvlyldjd38xjsechzwg9xz pnpm smoke:metaso-p2p
```

- [ ] **Step 10: Commit and buzz**

Run:

```bash
git add docs/qa/release-closeout-private-beta-run-log.md docs/superpowers/acceptance/2026-06-01-release-closeout-private-beta.md
git commit -m "docs: record release closeout acceptance"
```

Post Eric buzz with:

- free order result
- paid order result
- provider reply result
- asset result
- final readiness decision

### Task 7: Final Readiness Decision And Cleanup Proposal

**Purpose:** Give the user a clear go/no-go decision and a clean next-step choice.

**Files:**

- Modify docs only if a final status summary is missing:
  - `docs/superpowers/acceptance/2026-06-01-release-closeout-private-beta.md`

- [ ] **Step 1: Verify repo state**

Run:

```bash
git status --short --branch --untracked-files=all
git log --oneline --decorate -15
git branch -vv
git worktree list --porcelain
```

Expected:

- `main` contains the merged implementation
- tracked files are clean
- unrelated untracked screenshots/logs are not staged

- [ ] **Step 2: Decide readiness category**

Use exactly one:

- `Ready for local/private buyer-flow beta`
- `Not ready: Bothub blocker remains`
- `Not ready: metaso-p2p/runtime blocker remains`

Production readiness requires:

- assigned non-local metaso-p2p base URL
- `METASO_P2P_BASE_URL=<non-local> pnpm smoke:metaso-p2p` passes
- Chrome + Metalet acceptance passes against that endpoint or its intended deployment proxy

- [ ] **Step 3: Report branch/worktree cleanup recommendation**

If `codex/delivery-workspace-release-hardening` is fully merged:

- recommend removing the extra worktree and branch only after user approval
- do not delete worktrees or branches in this task unless explicitly requested

- [ ] **Step 4: Final user report**

Report:

- commit list created in this phase
- Eric buzz status for each commit
- gate results
- local metaso-p2p smoke result
- free order result
- paid order result
- provider reply result
- asset result
- production/staging blocker status
- whether private beta can start

## 7. Metaso-P2P Issue Rule

If a blocker belongs to metaso-p2p and is not already covered, create:

```text
/Users/tusm/Documents/MetaID_Projects/metaso-p2p/issues/YYYY-MM-DD-bothub-<short-gap>.md
```

Template:

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

## 8. Final Output For Development Session

At the end of this plan, the development session should return:

```markdown
## Summary

- Private beta readiness:
- Production readiness:
- Main commit:
- Acceptance doc:

## Gates

- pnpm test:
- pnpm build:
- pnpm lint:
- git diff --check:
- smoke:metaso-p2p:

## Real Flows

- Wallet connect:
- Free order:
- Paid order:
- Provider reply:
- Asset management:

## Remaining Blockers

- Bothub:
- metaso-p2p/runtime:
- provider availability:

## Suggested Next Step

...
```
