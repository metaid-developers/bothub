# Delivery Workspace V1 Acceptance Notes

**Date:** 2026-06-01
**Dev URL:** http://127.0.0.1:5177/
**Bothub revision checked:** `codex/delivery-workspace-release-hardening`
**Dev env:** `VITE_META_SOCKET_BASE_URL=/meta-socket`, `VITE_USE_AGGREGATOR_MOCK=false`, `VITE_USE_WS_MOCK=false`
**Local meta-socket:** http://127.0.0.1:18091
**Public idchat chat API:** https://api.idchat.io/chat-api/

## Automated Gates

| Check | Status | Evidence |
| --- | --- | --- |
| Unit/component suite | passed | Latest hardening gate `pnpm test`: 57 files / 431 tests passed on 2026-06-01. Existing React Router, FocusTrap, profile-offline, and act warnings remain. |
| Production build | passed | Latest hardening gate `pnpm build` completed. Vite reported the existing large-chunk warning. |
| Lint | passed | Latest hardening gate `pnpm lint` completed with `--max-warnings 0`. |
| Whitespace | passed | Latest hardening gate `git diff --check` completed with no whitespace errors. |
| Local meta-socket smoke | passed | `META_SOCKET_BASE_URL=http://127.0.0.1:18091 pnpm smoke:meta-socket` passed with skill-service list/detail, Socket.IO heartbeat, private-chat homes, and empty-history compatibility checks. |

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
| Local meta-socket health | passed | `curl http://127.0.0.1:18091/healthz` returned a healthy `meta-socket` envelope. |
| Local service list | passed | The restored MVC indexer returns real skill-service rows. A `size=10` list check returned paid service `metabot-ziwei-fortune-v2` plus multiple free services with native MVC metadata. |
| Local service detail | partially passed | Free service detail includes provider chat key and native MVC payment metadata. Paid service `metabot-ziwei-fortune-v2` includes provider chat key and `0.01 SPACE`, but its settlement fields are empty. |
| Public idchat chat API | passed | Current quick check: `https://api.idchat.io/chat-api/` returned HTTP 200 and identifies `service: group-chat`. |
| Public BotHub service list | blocked | Current quick check: `https://api.idchat.io/api/bot-hub/skill-service/list?...` returned HTTP 502, and `https://api.idchat.io/chat-api/api/bot-hub/skill-service/list?...` returned HTTP 404. Bothub should keep targeting native meta-socket `/api/bot-hub/*` routes, not `/chat-api/`. |
| Mock-disabled browser service list | passed locally | Chrome at `http://127.0.0.1:5177/` loaded real services from local meta-socket with mocks disabled. |
| Private-chat empty-history shape | passed | meta-socket returns `data.list: null` for an empty private-chat history; Bothub now normalizes this as an empty list and the smoke script treats it as compatible. |

## Chrome + Metalet Acceptance

| Check | Status | Evidence |
| --- | --- | --- |
| Connect real Metalet wallet | passed | Chrome connected the real Metalet identity `SunnyFung` / `idq1zf...kgv0`. |
| Real free order run | passed for buyer send | The user-approved Metalet `CreatePin` confirmation wrote tx `f49060769beb4644338e31577301390fd5827d372a60fdac763ad96db206fd75`; Bothub navigated to `/delivery?order=...02ac4091512dfc67492adb590b00db1eee575969a7d9a3042ae6d4b3d44e4ffa`, showed `等待接单`, `请求已发送`, and the free request record. |
| Free order provider visibility | pending confirmation/indexing | MVC RPC still reported the tx in mempool at block height `175627` with fee `0.00001175`; local meta-socket logs showed indexing through block `175625`, and private-chat history still returned `total: 0`, `list: null`. |
| Real paid native order safe-step | blocked externally | `紫微斗数算命 v2` review reached provider `BOT-009` and price `0.01 SPACE`, then stopped before wallet transfer with `Service payment address is missing` because the paid service detail has empty `settlementKind`, `paymentChain`, and `paymentAddress`. |
| Controlled final asset run | passed | In-app Playwright restored `Task 9 Controlled Delivery` from IndexedDB with a controlled wallet shim, one real image metafile pin, and video/audio/document/archive fallback records; UI showed 5 assets, preview/open/download/fallback controls, copy-one/copy-all buttons, and recovered after refresh. Screenshots: `/tmp/bothub-task9-controlled-assets.png`, `/tmp/bothub-task9-preview-dialog.png`, `/tmp/bothub-task9-copy-controls.png`, `/tmp/bothub-task9-refresh-recovery.png`. |

## Active Blockers

1. Paid native live acceptance is blocked by meta-socket/service data: paid service `metabot-ziwei-fortune-v2` returns `price: "0.01"` and `currency: "SPACE"` but empty `settlementKind`, `paymentChain`, and `paymentAddress`.
2. Free order provider-side visibility is not yet proven. The buyer send succeeded and the transaction is visible to MVC RPC, but it was still in mempool at the latest check and local meta-socket had not indexed the containing block.
3. Public `https://api.idchat.io/chat-api/` is healthy for idchat group/private chat, but public BotHub native `/api/bot-hub/*` routes are still not a usable production base URL.

## Related Issues

The active external blockers and prior maintainer triage are tracked in:

```text
/Users/tusm/Documents/MetaID_Projects/meta-socket/issues/2026-06-01-bothub-paid-service-payment-metadata-gap.md
/Users/tusm/Documents/MetaID_Projects/meta-socket/issues/2026-06-01-bothub-skill-service-availability-gap.md
/Users/tusm/Documents/MetaID_Projects/meta-socket/issues/2026-05-31-bothub-aggregator-readiness.md
/Users/tusm/Documents/MetaID_Projects/meta-socket/issues/issues-fixed-logs.md
```

## Release Readiness Conclusion

Bothub's frontend implementation for the delivery workspace release-hardening
plan is complete for the current scope: buyer-facing copy, order-focused
navigation, local recovery, asset preview/download, real local meta-socket
loading, free-order buyer send, and sanitized `createPin` diagnostics are all
covered.

Strict production release remains conditional on backend/runtime readiness:
paid services need valid settlement metadata, and the free order should be
rechecked after MVC confirmation and meta-socket block indexing catch up. No
Bothub backend was added.
