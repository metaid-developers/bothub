# Delivery Workspace V1 Acceptance Notes

**Date:** 2026-06-01
**Dev URL:** http://localhost:5177/
**Bothub revision checked:** `96675d3`
**Dev env:** `VITE_META_SOCKET_BASE_URL=/meta-socket`, `VITE_USE_AGGREGATOR_MOCK=false`, `VITE_USE_WS_MOCK=false`
**Local meta-socket:** http://127.0.0.1:18091
**Public idchat chat API:** https://api.idchat.io/chat-api/

## Automated Gates

| Check | Status | Evidence |
| --- | --- | --- |
| Unit/component suite | passed | Final Task 9 gate `pnpm test`: 56 files / 427 tests passed on 2026-06-01. Existing React Router, FocusTrap, profile-offline, and act warnings remain. |
| Production build | passed | Final Task 9 gate `pnpm build` completed. Vite reported the existing large-chunk warning for `dist/assets/index-DS6QwvM7.js`. |
| Lint | passed | Final Task 9 gate `pnpm lint` completed with `--max-warnings 0`. |
| Whitespace | passed | Final Task 9 gate `git diff --check` completed with no whitespace errors. |

## Seeded/Local Cache Acceptance

| Check | Status | Evidence |
| --- | --- | --- |
| Delivery empty state with no connected wallet | passed | In-app Browser at `/delivery` showed `我的交付`, wallet-gated copy, `还没有收到成果`, and no normal-state technical terms. Screenshot: `/tmp/bothub-task8-delivery-empty.png`. |
| Cached order restored from IndexedDB | passed | Controlled Playwright run seeded one wallet, order, session, message, and asset, then reloaded `/delivery`; UI showed `Controlled Asset Delivery`, `Task 8 Provider`, `已交付`, and `1 个成果`. Screenshot: `/tmp/bothub-task8-seeded-order-playwright.png`. |
| Controlled real metafile asset restored | passed | Seeded record used `metafile://b081b32c2891f0e2b2b8dccc22b3256ebf54957aaa43053f712d90646f377ed6i0.png`; UI showed the real pin-derived file, image type, `打开`, `下载`, `预览`, `复制链接`, and `复制全部链接`. |
| Asset preview/open/download/copy controls | passed | Controlled Playwright run opened the preview dialog, found `打开` and `下载` links, found one `复制链接` button, and found one `复制全部链接` button. Screenshot: `/tmp/bothub-task8-seeded-actions-playwright.png`. |
| Mobile delivery layout | passed | Controlled Playwright run at `390x844` showed `我的交付`, the restored service, `成果库`, and asset actions without normal-state technical terms. Screenshot: `/tmp/bothub-task8-mobile-seeded-playwright.png`. |
| Desktop delivery layout | passed | Controlled Playwright run at `1280x720` showed the restored service, timeline, message record, and asset library. Screenshot: `/tmp/bothub-task8-seeded-order-playwright.png`. |

## Live Meta-Socket Acceptance

| Check | Status | Evidence |
| --- | --- | --- |
| Local meta-socket health | passed | Endpoint correction check on 2026-06-01: `curl http://127.0.0.1:18091/healthz` returned HTTP 200 with `service: meta-socket`, `status: ok`, and `version: dev`. |
| Local service list | blocked | `curl http://127.0.0.1:18091/api/bot-hub/skill-service/list?size=3&chainName=mvc&sortBy=updated&order=desc` returned `code: 0` but an empty `data.list`; `META_SOCKET_BASE_URL=http://127.0.0.1:18091 pnpm smoke:meta-socket` therefore failed with `skill-service list returned an empty list`. |
| Public idchat chat API | passed | `curl https://api.idchat.io/chat-api/`, `/chat-api/health`, and `/chat-api/status` returned HTTP 200; the root payload identifies `service: group-chat`. |
| Public BotHub service list | blocked | `https://api.idchat.io/api/bot-hub/skill-service/list?...` still returned `HTTP/1.1 502 Bad Gateway`; `https://api.idchat.io/chat-api/api/bot-hub/skill-service/list?...` and `https://api.idchat.io/chat-api/bot-hub/skill-service/list?...` returned 404, so the idchat `/chat-api/` prefix does not expose the BotHub aggregator route. |
| Public smoke script | blocked | `META_SOCKET_BASE_URL=https://api.idchat.io/chat-api pnpm smoke:meta-socket` failed at `/chat-api/healthz` with HTTP 404; the smoke script targets native meta-socket `/healthz` and `/api/bot-hub/*` endpoints. |
| Mock-disabled service list in browser | blocked | Current terminal checks show no usable live service list: local returns an empty list, and public BotHub aggregator paths return 502/404. No mock service names were used as live evidence. |
| Live service detail | blocked | Not reachable because no live service id is available from the current local/public service lists. |
| Live Pay & Request modal | blocked | Not reachable because no live service detail can be selected with mocks disabled. |

## Chrome + Metalet Acceptance

| Check | Status | Evidence |
| --- | --- | --- |
| Connect real Metalet wallet | blocked | Chrome opened `http://localhost:5177/`, but `window.metaidwallet`, `window.metalet`, and `window.ethereum` were absent; clicking `连接钱包` showed `Metalet wallet extension is not installed`. Screenshots: `/tmp/bothub-task9-chrome-service-blocked.png`, `/tmp/bothub-task9-chrome-wallet-blocked.png`. |
| Real free order run | blocked | No live free service could be selected: local BotHub service list returned an empty list, public BotHub aggregator paths returned 502/404, and the Chrome profile lacked Metalet injection. |
| Real paid native order run | blocked | No paid service could be selected because live service list/detail is unavailable, and real Chrome wallet connection is blocked by missing Metalet injection. |
| Controlled final asset run | passed | In-app Playwright restored `Task 9 Controlled Delivery` from IndexedDB with a controlled wallet shim, one real image metafile pin, and video/audio/document/archive fallback records; UI showed 5 assets, preview/open/download/fallback controls, copy-one/copy-all buttons, and recovered after refresh. Screenshots: `/tmp/bothub-task9-controlled-assets.png`, `/tmp/bothub-task9-preview-dialog.png`, `/tmp/bothub-task9-copy-controls.png`, `/tmp/bothub-task9-refresh-recovery.png`. |

## Active Blockers

1. Local meta-socket is listening and healthy, but its BotHub skill-service list currently returns an empty list.
2. Public `https://api.idchat.io/chat-api/` is healthy for idchat group-chat endpoints, but it does not expose BotHub `/api/bot-hub/*` aggregation paths.
3. The Chrome profile reachable to Codex does not expose Metalet on `localhost:5177`, so real wallet prompts cannot be accepted in this run.
4. Real Chrome + Metalet order acceptance needs a healthy live service list/detail payload before any wallet prompts or payments should be attempted.

## Related Issue

The active external blocker is tracked in:

```text
/Users/tusm/Documents/MetaID_Projects/meta-socket/issues/2026-05-31-bothub-aggregator-readiness.md
```
