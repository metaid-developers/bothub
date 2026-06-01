# Delivery Workspace V1 Acceptance Notes

**Date:** 2026-06-01
**Dev URL:** http://localhost:5177/
**Bothub revision:** `09eefb3`
**Dev env:** `VITE_META_SOCKET_BASE_URL=/meta-socket`, `VITE_USE_AGGREGATOR_MOCK=false`, `VITE_USE_WS_MOCK=false`
**Local meta-socket:** http://127.0.0.1:18091
**Public meta-socket:** https://api.idchat.io

## Automated Gates

| Check | Status | Evidence |
| --- | --- | --- |
| Unit/component suite | passed | `pnpm test`: 56 files / 427 tests passed on 2026-06-01. Existing React Router, FocusTrap, profile-offline, and act warnings remain. |
| Production build | passed | `pnpm build` completed. Vite reported the existing large-chunk warning for `dist/assets/index-DS6QwvM7.js`. |
| Lint | passed | `pnpm lint` completed with `--max-warnings 0`. |
| Whitespace | passed | `git diff --check` completed with no whitespace errors. |

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
| Local meta-socket health | blocked | `curl http://127.0.0.1:18091/healthz` failed with connection refused on 2026-06-01. |
| Public service list | blocked | `curl https://api.idchat.io/api/bot-hub/skill-service/list?size=3&chainName=mvc&sortBy=updated&order=desc` returned `HTTP/1.1 502 Bad Gateway`. |
| Public smoke script | blocked | `META_SOCKET_BASE_URL=https://api.idchat.io pnpm smoke:meta-socket` failed at `/healthz` with HTTP 502. |
| Local smoke script | blocked | `META_SOCKET_BASE_URL=http://127.0.0.1:18091 pnpm smoke:meta-socket` failed at `/healthz` because fetch could not connect. |
| Mock-disabled service list in browser | blocked | In-app Browser at `/` showed `Could not load services` and `Failed to execute 'json' on 'Response': Unexpected end of JSON input`; no mock service names were used as live evidence. Screenshot: `/tmp/bothub-task8-desktop.png`. |
| Live service detail | blocked | Not reachable because live service list is unavailable. |
| Live Pay & Request modal | blocked | Not reachable because no live service detail can be selected with mocks disabled. |

## Chrome + Metalet Acceptance

| Check | Status | Evidence |
| --- | --- | --- |
| Connect real Metalet wallet | not run | Reserved for Task 9 independent Chrome + Metalet acceptance. |
| Real free order run | blocked | Dependent on live service list/detail availability; current meta-socket checks are blocked. |
| Real paid native order run | blocked | Dependent on live service list/detail availability; current meta-socket checks are blocked. |
| Real provider-delivered asset run | blocked | Dependent on a live provider order; controlled real-metafile local-cache acceptance passed above. |

## Active Blockers

1. Local meta-socket is not listening on `127.0.0.1:18091`.
2. Public `https://api.idchat.io` currently returns `502 Bad Gateway`.
3. Real Chrome + Metalet order acceptance needs a healthy live service list/detail payload before any wallet prompts or payments should be attempted.

## Related Issue

The active external blocker is tracked in:

```text
/Users/tusm/Documents/MetaID_Projects/meta-socket/issues/2026-05-31-bothub-aggregator-readiness.md
```
