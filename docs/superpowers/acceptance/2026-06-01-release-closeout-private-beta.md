# Release Closeout Private Beta Acceptance

Checked from Bothub `main` through `3221ecb` on 2026-06-02 CST.

## Automated Gates

| Item | Status | Evidence |
| --- | --- | --- |
| `pnpm test` | passed | 57 files / 440 tests passed. |
| `pnpm build` | passed | TypeScript and Vite build passed with the existing large-chunk warning. |
| `pnpm lint` | passed | ESLint completed with `--max-warnings 0`. |
| `git diff --check` | passed | No whitespace errors in verified diffs. |

## Local Meta-Socket

| Item | Status | Evidence |
| --- | --- | --- |
| Health and BotHub list/detail smoke | passed | `META_SOCKET_BASE_URL=http://127.0.0.1:18091 pnpm smoke:meta-socket` passed; skill-service list returned `count: 3`. |
| Canonical private chat routes | passed | Smoke used `/api/private-chat/homes/...` and `/api/private-chat/messages?...`; both route modes were `canonical`. |
| Production/staging meta-socket base URL | blocked externally | No non-local meta-socket deployment base URL has been assigned and verified. Do not use idchat `/chat-api/` as a substitute. |

## Browser UI Copy Smoke

| Item | Status | Evidence |
| --- | --- | --- |
| Real services with mocks disabled | passed | In-app Browser at `http://[::1]:5177/` loaded real services from local meta-socket. |
| Buyer-safe visible copy | passed | Hub and Delivery normal states showed Chinese buyer copy and no visible `Socket.IO`, `chat pubkey`, `CreatePin`, raw `/api/`, or `/chat-api/` terms. |
| Delivery wallet-gated state | passed | `/delivery` showed the wallet-required empty state and asset area without console errors. |

## Chrome + Metalet

| Item | Status | Evidence |
| --- | --- | --- |
| Chrome page open | passed | Chrome opened `http://localhost:5177/` and loaded the live Hub page. |
| Metalet authorization | blocked externally | Clicking `连接钱包` opened a Metalet `chrome-extension://.../authorize?...host=localhost%3A5177...` page. Browser policy blocks automation from controlling that extension page; manual approval is required. |
| Wallet connect | blocked externally | BotHub remained at `连接中…` during the automated acceptance window, and the Codex Chrome Extension backend later became unavailable for this session. |
| Free order buyer send | not run | Blocked behind wallet connection. |
| Paid native order buyer send | not run | Blocked behind wallet connection. |
| Provider reply / AI_Sunny check | not run | Blocked behind real order creation. |
| Follow-up composer | not run | Blocked behind wallet connection and selected real order. |

## Asset Management

| Item | Status | Evidence |
| --- | --- | --- |
| Controlled IndexedDB restore | passed | Seeded Delivery restored `Release Closeout Controlled Assets`, provider `AI_Sunny`, status `已交付`, and `5 个成果`. |
| Preview/open/download/copy | passed | Image preview dialog opened; all 5 assets exposed open/download links; copy-one and copy-all copied expected URLs. |
| Refresh and mobile recovery | passed | Refresh preserved the selected delivered order and assets; `390x844` mobile viewport had no horizontal overflow. |

## Remaining Blockers

| Item | Status | Evidence |
| --- | --- | --- |
| Bothub frontend local gates | passed | No Bothub code blocker found in automated, local meta-socket, Browser UI, or controlled asset checks. |
| Chrome + Metalet acceptance | blocked externally | Manual Metalet authorization and a stable Codex Chrome Extension backend are required to finish real wallet acceptance. |
| Strict production readiness | blocked externally | Requires an assigned non-local meta-socket root base URL and smoke/Chrome acceptance against that endpoint. |

## Final Decision

| Item | Status | Evidence |
| --- | --- | --- |
| Local implementation readiness | passed | The plan's Bothub-side code/docs work and local non-wallet verification are complete. |
| Full private buyer-flow beta readiness | blocked externally | Real Chrome + Metalet free/paid order acceptance has not completed. |
| Production readiness | blocked externally | Non-local meta-socket base URL and production/staging acceptance are not yet available. |
