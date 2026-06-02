# Release Closeout Private Beta Acceptance

Checked from Bothub `main` with public meta-socket follow-up on 2026-06-02 CST.

## Automated Gates

| Item | Status | Evidence |
| --- | --- | --- |
| `pnpm test` | passed | 57 files / 440 tests passed. |
| `pnpm build` | passed | TypeScript and Vite build passed with the existing large-chunk warning. |
| `pnpm lint` | passed | ESLint completed with `--max-warnings 0`. |
| `git diff --check` | passed | No whitespace errors in verified diffs. |

## Meta-Socket Runtime

| Item | Status | Evidence |
| --- | --- | --- |
| Health and BotHub list/detail smoke | passed | `META_SOCKET_BASE_URL=http://127.0.0.1:18091 pnpm smoke:meta-socket` passed; skill-service list returned `count: 3`. |
| Canonical private chat routes | passed | Smoke used `/api/private-chat/homes/...` and `/api/private-chat/messages?...`; both route modes were `canonical`. |
| Production/staging meta-socket base URL | passed | `https://socket.metaid.io/healthz` returned HTTP 200, service `meta-socket`, status `ok`, version `c416816`, with browser-compatible CORS headers. |
| Public meta-socket smoke | passed | `META_SOCKET_BASE_URL=https://socket.metaid.io META_SOCKET_PRIVATE_CHAT_METAID=... META_SOCKET_PRIVATE_CHAT_OTHER_METAID=... pnpm smoke:meta-socket` passed with skill-service list/detail, Socket.IO heartbeat, and canonical private-chat routes. |

## Browser UI Copy Smoke

| Item | Status | Evidence |
| --- | --- | --- |
| Real services with mocks disabled | passed | In-app Browser at `http://[::1]:5177/` loaded real services from local meta-socket. |
| Public meta-socket browser smoke | passed | In-app Browser at `http://localhost:5176/` with `VITE_META_SOCKET_BASE_URL=https://socket.metaid.io` loaded real services including `紫微斗数算命 v2` and `Free Ecommerce Store Blueprint`; no service-loading error was visible. |
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
| Public meta-socket endpoint | passed | The previous non-local endpoint blocker is resolved by `https://socket.metaid.io`; smoke and browser checks passed against that root URL. |
| Chrome + Metalet acceptance | blocked externally | Manual Metalet authorization and a stable Codex Chrome Extension backend are required to finish real wallet acceptance. |
| Strict production readiness | blocked externally | Public meta-socket endpoint readiness is passed; real Chrome + Metalet free/paid order acceptance still has not completed. |

## Final Decision

| Item | Status | Evidence |
| --- | --- | --- |
| Local implementation readiness | passed | The plan's Bothub-side code/docs work and local non-wallet verification are complete. |
| Full private buyer-flow beta readiness | blocked externally | Real Chrome + Metalet free/paid order acceptance has not completed. |
| Production readiness | blocked externally | The non-local meta-socket base URL is now available and verified; production readiness still depends on real Chrome + Metalet free/paid order acceptance. |
