# Core Usability Repair Run Log

Task 7 independent acceptance run for `codex/buyer-productization`.

- Date: 2026-05-30 00:06 CST
- Baseline: `1fc5eb4` (`fix: verify delivery asset protocol rendering`)
- Local app: `http://localhost:5177`
- metaso-p2p: `http://127.0.0.1:18091`
- Dev command:

```bash
VITE_METASO_P2P_BASE_URL=/metaso-p2p VITE_USE_AGGREGATOR_MOCK=false VITE_USE_WS_MOCK=false pnpm dev -- --host 127.0.0.1
```

Vite reported port `5176` in use and selected `5177`.

## Environment Checks

| Check | Result | Evidence |
| --- | --- | --- |
| metaso-p2p health | passed | `curl http://127.0.0.1:18091/healthz` returned `code: 0`, `status: ok`, `version: dev`. |
| metaso-p2p smoke | passed | `pnpm smoke:metaso-p2p` returned `ok: true`, list count `3`, service detail id `f6b810a...c1ai0`, online stats, and Socket.IO `heartbeatAck: true`. |
| Dev server | passed | Vite served `http://localhost:5177/` with real `/metaso-p2p` proxy settings and mocks disabled. |

## Browser Smoke

| Acceptance item | Status | Evidence |
| --- | --- | --- |
| Bot Hub loads real services | passed | In-app Browser showed real service cards including `Free Ecommerce Store Blueprint`, `Free Social Media Growth Plan`, and other metaso-p2p services. |
| Delivery route renders | passed | `/delivery` rendered `Delivery`, `Sessions`, `Delivered assets`, and `Delivery follow-up composer` sections. |
| Console crashes | passed | In-app Browser `tab.dev.logs({ levels: ['error'] })` returned `[]` for desktop and mobile Delivery checks. |
| Desktop layout | passed | At `1440x900`, `document.body.scrollWidth` was `1440`, matching viewport width; no obvious control overlap was observed. |
| Mobile layout | passed | At `390x844`, `document.body.scrollWidth` was `390`; Hub and Delivery remained readable with no horizontal overflow. |

## Chrome + Metalet

| Acceptance item | Status | Evidence |
| --- | --- | --- |
| Connect Metalet | passed | Chrome opened `http://localhost:5177/` already connected; header showed fallback identity `idq1zf...kgv0` with full title `idq1zfazvxaq69uw6txe3ewce30ewyhy9a7mzykgv0`. |
| Delivery hydration | passed with concerns | `/delivery` hydrated existing sessions and rendered encrypted historical rows without app console errors. |
| ECIES popup loop | passed with concerns | Five stale Metalet `EciesDecrypt` authorize tabs from 2026-05-29 15:37 UTC were already open. A fresh Delivery reload waited 5 seconds and the count stayed `5`; no new ECIES authorize tab was created during this run. |
| Socket reconnect | concern | Chrome Delivery showed a `WebSocket connection failed: timeout` banner while direct terminal Socket.IO probes with the same `globalMetaId` heartbeat-acked. This suggests a browser/proxy/session issue worth follow-up, not a terminal metaso-p2p outage. |

## Free Order Flow

| Step | Status | Evidence |
| --- | --- | --- |
| Choose real free service | passed | Used `Free Ecommerce Store Blueprint`, price `0 SPACE`, provider `Dan Mercier`. |
| Enter harmless request | passed | Entered `Task 7 harmless QA request: please return a short ecommerce store setup checklist for a fictional demo shop.` |
| Review | passed | Review step displayed provider, price, settlement, and request text. |
| Reach final chain confirmation | blocked_by_user_approval | `Confirm & pay` opened Metalet authorize URL with `actionName=CreatePin`, `chain=mvc`, and `/protocols/simplemsg` payload. The final irreversible chain write was not approved. |

Release-candidate end-to-end free-order criteria are not satisfied by this run because the required user-approved `createPin` broadcast was intentionally not approved.

## Paid Order Preflight

| Step | Status | Evidence |
| --- | --- | --- |
| Find real paid service | passed | Used `Token消耗统计查询`, price `0.0001 SPACE`, service id `940569ba432081bf3b7accfd5ef728daa58e1c78f792f2a8bd8d0779fa8c0464i0`. |
| Enter and review request | passed | Request entry and review modal worked. |
| Transfer prompt appears before order broadcast | blocked_real_data | `Confirm & pay` stopped in-app with `Provider chat public key is not available`; no Metalet transfer prompt appeared. |
| Paid service data audit | concern | A sampled scan of paid detail records found `hasKey: false` for paid services, so current real data did not provide a paid service that could reach payment confirmation. |

## Follow-Up Composer

| Step | Status | Evidence |
| --- | --- | --- |
| Session with provider key | blocked_real_data | Existing hydrated sessions rendered with composer disabled and reason `Provider chat key unavailable`. |
| Type follow-up and reach createPin | not run | No eligible session with provider chat key was available. No chain write was approved. |

## History And Asset Recovery

| Step | Status | Evidence |
| --- | --- | --- |
| Approved write or injected fixture | blocked_tooling | No chain write was approved. The expected dev-only `window.__bothubInjectWsMessage` hook returned missing in Chrome page context. Chrome automation did not expose page `indexedDB` or `localStorage`, so an equivalent manual fixture injection was not performed. |
| Refresh restores sessions/assets | partially observed | Existing real Delivery sessions restored after refresh; no new asset fixture was injected in this run. |
| No duplicate messages | not proven for new data | Existing session list did not visibly duplicate during refresh, but no approved write or injected asset fixture was available for the Task 7 duplicate check. |

## Socket Identity Check

Observed with logged-in wallet identity:

```text
globalMetaId: idq1zfazvxaq69uw6txe3ewce30ewyhy9a7mzykgv0
```

| Probe | Result |
| --- | --- |
| `GET /api/group-chat/chat/homes/{globalMetaId}` | `code: 0`, `count: 6`; rows used `globalMetaId` and `lastMessage` fields. |
| `GET /api/group-chat/private-chat-list?metaId={globalMetaId}&otherMetaId=17EtGx2eejs4NW4QSwiCJFR6wrNGBnERLV` | `code: 0`, `count: 5`; sample row addressed `to: idq1zfazvxaq69uw6txe3ewce30ewyhy9a7mzykgv0`. |
| Socket.IO query `{ metaid: globalMetaId, type: 'app' }` | connected and received `heartbeat_ack`. |
| Socket.IO query `{ metaid: bothub-smoke-metaid, type: 'app' }` | connected and received `heartbeat_ack`, but HTTP homes count was `0`. |

Current code sends `globalMetaId` in the Socket.IO `metaid` query. Private-chat HTTP history worked with the logged-in `globalMetaId` in this run. MVC address and profile `metaid` could not be compared because the Chrome automation surface did not expose the full Metalet identity object beyond the public `globalMetaId` shown in the app header.

## Verification Commands

Run before commit:

```bash
pnpm test delivery components/delivery
pnpm build
pnpm lint
pnpm smoke:metaso-p2p
```

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm test delivery components/delivery` | passed | 20 test files / 140 tests passed. Existing React Router future-flag warnings were observed. |
| `pnpm build` | passed | TypeScript project build and Vite production build completed. |
| `pnpm lint` | failed | Existing source lint failures: `src/api/aggregator.ts` violates `react-hooks/rules-of-hooks`, `src/delivery/assetParser.ts` has `no-useless-escape`, and fast-refresh warnings exist in `FiltersBar.tsx`, `main.tsx`, and `BotHub.tsx`. These were not introduced by this docs-only Task 7 run. |
| `pnpm smoke:metaso-p2p` | passed | `ok: true` against `http://127.0.0.1:18091`; private-chat live check skipped because optional env pair was unset. |
