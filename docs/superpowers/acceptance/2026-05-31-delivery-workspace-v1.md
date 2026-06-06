# Delivery Workspace V1 Acceptance Notes

**Date:** 2026-06-01
**Dev URL:** http://127.0.0.1:5177/
**Bothub revision checked:** `codex/delivery-workspace-release-hardening`
**Dev env:** `VITE_METASO_P2P_BASE_URL=/metaso-p2p`, `VITE_USE_AGGREGATOR_MOCK=false`, `VITE_USE_WS_MOCK=false`
**Local metaso-p2p:** http://127.0.0.1:18091
**Production/staging metaso-p2p:** not assigned in this acceptance note; BotHub must not use idchat `/chat-api/` as its backend.

## Automated Gates

| Check | Status | Evidence |
| --- | --- | --- |
| Unit/component suite | passed | Latest hardening gate `pnpm test`: 57 files / 437 tests passed on 2026-06-01. Existing React Router, FocusTrap, profile-offline, and act warnings remain. |
| Production build | passed | Latest hardening gate `pnpm build` completed. Vite reported the existing large-chunk warning. |
| Lint | passed | Latest hardening gate `pnpm lint` completed with `--max-warnings 0`. |
| Whitespace | passed | Latest hardening gate `git diff --check` completed with no whitespace errors. |
| Local metaso-p2p smoke | passed | `METASO_P2P_BASE_URL=http://127.0.0.1:18091 METASO_P2P_PRIVATE_CHAT_METAID=idq1zfazvxaq69uw6txe3ewce30ewyhy9a7mzykgv0 METASO_P2P_PRIVATE_CHAT_OTHER_METAID=idq14hmv23j5fnlx4ccnmvlyldjd38xjsechzwg9xz pnpm smoke:metaso-p2p` passed with skill-service list/detail, Socket.IO heartbeat, and AI_Sunny canonical private-chat history. |

## Seeded/Local Cache Acceptance

| Check | Status | Evidence |
| --- | --- | --- |
| Delivery empty state with no connected wallet | passed | In-app Browser at `/delivery` showed `我的交付`, wallet-gated copy, `还没有收到成果`, and no normal-state technical terms. Screenshot: `/tmp/bothub-task8-delivery-empty.png`. |
| Cached order restored from IndexedDB | passed | Controlled Playwright run seeded one wallet, order, session, message, and asset, then reloaded `/delivery`; UI showed `Controlled Asset Delivery`, `Task 8 Provider`, `已交付`, and `1 个成果`. Screenshot: `/tmp/bothub-task8-seeded-order-playwright.png`. |
| Controlled real metafile asset restored | passed | Seeded record used `metafile://b081b32c2891f0e2b2b8dccc22b3256ebf54957aaa43053f712d90646f377ed6i0.png`; UI showed the real pin-derived file, image type, `打开`, `下载`, `预览`, `复制链接`, and `复制全部链接`. |
| Asset preview/open/download/copy controls | passed | Controlled Playwright run opened the preview dialog, found `打开` and `下载` links, found one `复制链接` button, and found one `复制全部链接` button. Screenshot: `/tmp/bothub-task8-seeded-actions-playwright.png`. |
| Mobile delivery layout | passed | Controlled Playwright run at `390x844` showed `我的交付`, the restored service, `成果库`, and asset actions without normal-state technical terms. Screenshot: `/tmp/bothub-task8-mobile-seeded-playwright.png`. |
| Desktop delivery layout | passed | Controlled Playwright run at `1280x720` showed the restored service, timeline, message record, and asset library. Screenshot: `/tmp/bothub-task8-seeded-order-playwright.png`. |

## Live Metaso-P2P Acceptance

| Check | Status | Evidence |
| --- | --- | --- |
| Local metaso-p2p health | passed | `curl http://127.0.0.1:18091/healthz` returned a healthy `metaso-p2p` envelope. |
| Local service list | passed | The restored MVC indexer returns real skill-service rows. A `size=10` list check returned paid service `metabot-ziwei-fortune-v2` plus multiple free services with native MVC metadata. |
| Local service detail | passed | Free service detail includes provider chat key and native MVC payment metadata. After the metaso-p2p payment metadata fix, paid service `metabot-ziwei-fortune-v2` includes provider chat key, `0.01 SPACE`, `settlementKind: "native"`, `paymentChain: "mvc"`, and `paymentAddress: "125DQu9dBCXksYWg7HnmnmU3TpBNqnMsZF"`. |
| idchat probe | informational only | Historical checks showed idchat `/chat-api/` is a group-chat compatibility surface, not a BotHub backend. It is not a Bothub release dependency. |
| Production/staging metaso-p2p service list | blocked externally | No non-local metaso-p2p base URL has been assigned and verified for native `/api/bot-hub/*`, private-chat history routes, and `/socket/socket.io`. Bothub should target metaso-p2p only; required public/staging deployment ownership is tracked in metaso-p2p. |
| Mock-disabled browser service list | passed locally | Chrome at `http://127.0.0.1:5177/` loaded real services from local metaso-p2p with mocks disabled. |
| Private-chat empty-history shape | passed | metaso-p2p returns `data.list: null` for an empty private-chat history; Bothub now normalizes this as an empty list and the smoke script treats it as compatible. |

## Chrome + Metalet Acceptance

| Check | Status | Evidence |
| --- | --- | --- |
| Connect real Metalet wallet | passed | Chrome connected the real Metalet identity `SunnyFung` / `idq1zf...kgv0`. |
| Real free order run | passed for buyer send | The user-approved Metalet `CreatePin` confirmation wrote tx `f49060769beb4644338e31577301390fd5827d372a60fdac763ad96db206fd75`; Bothub navigated to `/delivery?order=...02ac4091512dfc67492adb590b00db1eee575969a7d9a3042ae6d4b3d44e4ffa`, showed `等待接单`, `请求已发送`, and the free request record. |
| Free order provider visibility | pending confirmation/indexing | MVC RPC still reported the tx in mempool at block height `175627` with fee `0.00001175`; local metaso-p2p logs showed indexing through block `175625`, and private-chat history still returned `total: 0`, `list: null`. |
| Real paid native order run | passed for buyer send | The user-approved Metalet transfer paid `0.01000000 SPACE` to `125DQu9dBCXksYWg7HnmnmU3TpBNqnMsZF` in tx `be6aba9e7a2e0b2eadb4a9630de7cb8f624865c25031a9dfbcccd29b0925806d`; the user-approved order PIN wrote `/protocols/simplemsg` tx `bef7f0e1bbc693bd3264f7620344c02b72e77c8d27d5303411f9fac55e0f83f0`; Bothub navigated to the paid Delivery order, showed `等待接单`, `请求已发送`, and the `0.01 SPACE` request record. |
| Paid order provider visibility | pending confirmation/indexing | Payment tx `be6aba9e...5806d` and order PIN tx `bef7f0e1...83f0` were still in mempool at height `175635`; RPC tip was `175636`; local metaso-p2p private-chat history for buyer/provider still returned `total: 0`, `list: null`. |
| AI_Sunny online provider run | passed after backend alias fix and frontend hydration hardening | A real free order to AI_Sunny service `e9a7064693dfdcbea381c8355c3c91c0ba3947abee816287774729c432378e61i0` produced buyer pin `5d429d59f5c984735d897be27f197abff44dc55fc757a8f2d22031241b6179c7i0`, and IDChat showed AI_Sunny's `[ORDER_STATUS:...]` reply. metaso-p2p now returns AI_Sunny detail with canonical provider `idq14hmv23j5fnlx4ccnmvlyldjd38xjsechzwg9xz` plus payment address `1GrqX7K9jdnUor8hAoAfDx99uFH2tT75Za`; canonical private-chat query returns `total: 57`, including reply pins `42c3f0...`, `2f26...`, and `0299...`. Bothub regression and controlled UI checks prove canonical-provider replies merge back into the address-keyed order without creating a separate `历史交付` row. |
| Controlled final asset run | passed | In-app Playwright restored `Task 9 Controlled Delivery` from IndexedDB with a controlled wallet shim, one real image metafile pin, and video/audio/document/archive fallback records; UI showed 5 assets, preview/open/download/fallback controls, copy-one/copy-all buttons, and recovered after refresh. Screenshots: `/tmp/bothub-task9-controlled-assets.png`, `/tmp/bothub-task9-preview-dialog.png`, `/tmp/bothub-task9-copy-controls.png`, `/tmp/bothub-task9-refresh-recovery.png`. |

## Active Blockers

1. Free and paid provider-side visibility for the earlier Dan/BOT order txs is not yet proven through metaso-p2p history. Buyer sends succeeded and the transactions were visible to MVC RPC during the run, but those specific order histories still need a fresh confirmed-history check if they are used as release evidence.
2. A production/staging metaso-p2p base URL has not yet been assigned and verified. This must be provided by metaso-p2p; BotHub should not use idchat `/chat-api/`.

## Related Issues

The resolved backend gap, remaining public-route gap, and prior maintainer
triage are tracked in:

```text
/Users/tusm/Documents/MetaID_Projects/metaso-p2p/issues/2026-06-01-bothub-paid-service-payment-metadata-gap.md
/Users/tusm/Documents/MetaID_Projects/metaso-p2p/issues/2026-06-01-bothub-ai-sunny-provider-chat-identity-gap.md
/Users/tusm/Documents/MetaID_Projects/metaso-p2p/issues/2026-06-01-bothub-production-metaso-p2p-endpoint-gap.md
/Users/tusm/Documents/MetaID_Projects/metaso-p2p/issues/2026-06-01-bothub-skill-service-availability-gap.md
/Users/tusm/Documents/MetaID_Projects/metaso-p2p/issues/2026-05-31-bothub-aggregator-readiness.md
/Users/tusm/Documents/MetaID_Projects/metaso-p2p/issues/issues-fixed-logs.md
```

## Release Readiness Conclusion

Bothub's frontend implementation for the delivery workspace release-hardening
plan is complete for the current scope: buyer-facing copy, order-focused
navigation, local recovery, asset preview/download, real local metaso-p2p
loading, free-order buyer send, and sanitized `createPin` diagnostics are all
covered.

The plan is ready for local/private buyer-flow beta against the restored local
metaso-p2p runtime: real service loading, wallet connect, free buyer send, paid
native payment, order PIN broadcast, Delivery recovery, and an external
AI_Sunny provider response all have live evidence.

Strict production release remains conditional on backend/runtime readiness: a
metaso-p2p-owned production/staging deployment must expose native BotHub,
private-chat history, and Socket.IO routes; provider-side visibility should be
available through metaso-p2p for the earlier Dan/BOT order txs if those flows
remain part of launch evidence; and no Bothub backend was added.
