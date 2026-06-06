# Delivery Conversation-First Redesign Acceptance

Checked on 2026-06-03 CST from branch `codex/delivery-conversation-first`.

## Scope

- Worktree: `/Users/tusm/.config/superpowers/worktrees/bothub/codex-delivery-conversation-first`
- Branch: `codex/delivery-conversation-first`
- Browser acceptance: passed against `http://localhost:5176/delivery`

## Product Change Summary

- Delivery left navigation is provider conversation-first instead of one row per order.
- The selected provider conversation has an `All` tab that shows the complete provider timeline.
- Order tabs remain available as read-only filtered views inside the provider conversation.
- The composer is available only on `All`; order tabs do not show free-text chat.
- The delivered asset library is scoped to the selected provider, and further scoped to the selected order tab when applicable.
- Skill-service-order pin ids are treated as canonical order ids while preserving `paymentTxid` and legacy `orderReference` compatibility.

## Verification

| Command | Result | Notes |
| --- | --- | --- |
| `npm test` | passed | 62 test files, 513 tests passed. |
| `npm run typecheck` | passed | `tsc -b --noEmit` exited 0. |
| `npm run lint` | passed | `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0` exited 0. |
| `npm run build` | passed with warning | Production build completed; Vite warned that `dist/assets/index-Ca2PQVFr.js` is 542.17 kB after minification. |
| `npm run smoke:metaso-p2p` | passed | Default `http://127.0.0.1:18091` smoke passed with health `ok`, service count 3, detail schema `botHubSkillServiceDetail.v1`, Socket.IO heartbeat ack, and private-chat checks skipped because metaids were not provided. |
| `METASO_P2P_BASE_URL=https://so.metaid.io npm run smoke:metaso-p2p` | not run | Default local smoke passed, so the documented public endpoint fallback was not needed. |
| Browser acceptance on `/delivery` | passed | In-app Browser verified the no-wallet state with public metaso-p2p config. Terminal Playwright then seeded a connected wallet, two orders for one provider, and mixed private/order messages; it verified one provider conversation row, `All` plus two order tabs, All-only composer, read-only order tabs, scoped asset labels, and no page errors. |

## Browser Acceptance

- Dev server: `http://localhost:5176/delivery` with `VITE_METASO_P2P_BASE_URL=https://so.metaid.io`, `VITE_USE_AGGREGATOR_MOCK=false`, and `VITE_USE_WS_MOCK=false`.
- In-app Browser verified the baseline route loaded, showed `我的交付`, `服务方会话`, disabled `All`, `成果库`, and the disconnected composer placeholder.
- Terminal Playwright used a temporary `/tmp/bothub-playwright` install plus seeded IndexedDB/sessionStorage to verify the connected conversation-first flow.
- Temporary screenshots were captured during the Playwright run as `/tmp/bothub-delivery-conversation-first-all.png` and `/tmp/bothub-delivery-conversation-first-alpha.png`; these `/tmp` artifacts are not part of the repository and may no longer exist after cleanup.

## Known Warnings

- `npm test` emitted React Router v7 future-flag warnings in router-backed component tests.
- `npm test` emitted `There are no focusable elements inside the <FocusTrap />` warnings in request modal tests.
- `npm test` emitted mocked `profile offline` warnings in Delivery profile fallback tests.
- `npm test` emitted React `act(...)` warnings in Delivery and filter debounce tests.
- `npm run build` emitted the Vite chunk-size warning for the main JavaScript bundle.
