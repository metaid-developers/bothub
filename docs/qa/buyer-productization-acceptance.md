# Buyer Productization Acceptance

This checklist is for the P4 buyer-side release candidate. It verifies the real metaso-p2p path, core buyer order preparation, Delivery hydration, and delivered asset handling without adding provider, refund, or rating scope.

## Local Prerequisites

- Local metaso-p2p is running at `http://127.0.0.1:18091`.
- Health check succeeds:

```bash
curl -sS http://127.0.0.1:18091/healthz
```

- Vite dev proxy maps `/metaso-p2p` to `http://127.0.0.1:18091`.
- Chrome has Metalet installed and already set up by the controller.
- Stop before approving any Metalet signing, broadcast, `createPin`, payment, key creation, or permission upgrade unless the controller explicitly approves that action.

## Environment

Recommended `.env.local` or `.env` values for local real-data QA:

```dotenv
VITE_METASO_P2P_BASE_URL=/metaso-p2p
VITE_USE_AGGREGATOR_MOCK=false
VITE_USE_WS_MOCK=false
VITE_METAFILE_ACCELERATE_CONTENT_BASE=https://file.metaid.io/metafile-indexer/api/v1/files/accelerate/content
VITE_METAFILE_CONTENT_BASE=https://file.metaid.io/metafile-indexer/api/v1/files/content
```

The default real metaso-p2p service is `http://127.0.0.1:18091`; the browser should use `/metaso-p2p` through the Vite proxy to avoid local CORS preflight issues.

## Automated Verification

Run:

```bash
pnpm smoke:metaso-p2p
pnpm test
pnpm build
```

`pnpm smoke:metaso-p2p` should pass against `http://127.0.0.1:18091`.

## Dev Server

Start the QA dev server with real metaso-p2p data and no mocks:

```bash
VITE_METASO_P2P_BASE_URL=/metaso-p2p VITE_USE_AGGREGATOR_MOCK=false VITE_USE_WS_MOCK=false pnpm dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5176`. Stop the dev server after the run unless the controller asks to keep it alive.

## Browser Smoke Checklist

- BotHub loads real service data from local metaso-p2p.
- Service list shows at least one available service.
- Service detail opens, preferably for `free-weather-service` when present.
- Pay & Request modal opens from the service detail.
- Request input and review step are usable for a free service.
- Delivery route renders the sessions column, timeline, session header, delivered assets region, and composer.
- Socket state is visible as connected or degraded without hiding cached/history data.
- Refresh keeps the app usable and does not lose locally cached Delivery layout state.

## Chrome + Metalet Acceptance

Use Chrome only for wallet-dependent checks:

- Open `http://127.0.0.1:5176` in Chrome.
- Connect Metalet.
- Confirm the app shows the connected wallet `globalMetaId` and address.
- Open a free-service detail and prepare a natural-language request.
- Reach the point where the app is ready to submit the free-service order.
- Stop before any Metalet signing, broadcast, `createPin`, payment confirmation, key creation, or permission upgrade.
- If a wallet or extension prompt asks only to connect the already configured wallet, that connection prompt is allowed for this acceptance run.

## Delivery Asset Acceptance

Use the dev-only injection hook or an equivalent test fixture after connecting a wallet in dev mode. Inject a provider private-chat message that contains:

```text
[DELIVERY:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa] {"result":"Here are files: metafile://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbi0.png metafile://cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccci0.mp4 metafile://ddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddi0.mp3 metafile://eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeei0.pdf"}
```

Check:

- Image, video, audio, and PDF asset cards appear in Delivered Assets.
- Image/video/audio previews render when the metafile content endpoint allows it.
- Preview failures fall back to a visible download card.
- Every asset keeps a download action.
- Refresh hydrates the session and asset metadata from local cache.
- The original provider message remains available in the timeline or as source context.

## Viewport Checks

- Desktop: verify `1440x900` or similar; service detail, modal, and Delivery layout do not overlap or clip primary controls.
- Mobile: verify `390x844` or similar; Bot Hub and Delivery stack in a usable order, modal content fits, and asset cards do not overflow horizontally.
- Confirm text in buttons, status chips, session rows, and asset cards remains readable at both sizes.

## Known Constraints / Not In Scope

- Refund UI is not part of this release candidate.
- Rating/review UI is not part of this release candidate.
- Provider-side dashboards, provider order management, and provider fulfillment tools are not part of this release candidate.
- Binary asset offline caching is not required; metadata persistence and preview/download fallback are required.
- Do not approve Metalet signing, broadcast, `createPin`, payment, key creation, or permission escalation during unattended QA.

## Run Log

| Check | Command / Area | Status | Notes |
| --- | --- | --- | --- |
| Task 7 run log | `docs/qa/core-usability-repair-run-log.md` | recorded | Independent Task 7 acceptance run on 2026-05-30 CST using local dev server `http://localhost:5177`, real metaso-p2p, in-app Browser, and Chrome with installed Metalet. |
| Task 7 metaso-p2p smoke | `pnpm smoke:metaso-p2p` | passed | `ok: true` against `http://127.0.0.1:18091`; list count 3, service detail, online stats, and Socket.IO heartbeat passed. Private-chat live check skipped because the optional env pair was unset. |
| Task 7 Browser smoke | In-app Browser at `http://localhost:5177` | passed | Real services rendered; Delivery route rendered sessions/assets/composer without console errors. Desktop `1440x900` and mobile `390x844` checks had no horizontal overflow. |
| Task 7 Chrome + Metalet | Chrome at `http://localhost:5177` | passed with concerns | Chrome was already connected to Metalet; header showed fallback identity `idq1zf...kgv0`. Delivery hydration produced no app console errors. Five stale Metalet `EciesDecrypt` authorize tabs from an earlier run were present, but refresh did not create new ECIES tabs. |
| Task 7 free order preflight | Free Ecommerce Store Blueprint | blocked_by_user_approval | Request entry and review worked. `Confirm & pay` opened a Metalet `CreatePin` authorize page for `/protocols/simplemsg` on MVC. The irreversible chain write was not approved, so release-candidate end-to-end order criteria are not satisfied by this run. |
| Task 7 paid order preflight | Token消耗统计查询 (`0.0001 SPACE`) | blocked_real_data | A real paid service opened and reviewed, but `Confirm & pay` stopped in-app with `Provider chat public key is not available`; no Metalet transfer prompt appeared. A sampled list of paid details found no provider chat public key, so paid transfer preflight remains unproven on current real data. |
| Task 7 follow-up composer | Delivery with existing real sessions | blocked_real_data | Existing hydrated sessions had no resolvable provider chat key, leaving composer disabled with `Provider chat key unavailable`. No follow-up `createPin` prompt was reached. |
| Task 7 fixture / asset recovery | Dev injection hook / equivalent fixture | blocked_tooling | The expected `window.__bothubInjectWsMessage` hook was absent in the Chrome page context, and the Chrome automation sandbox did not expose page `indexedDB`/`localStorage` for manual fixture injection. No test fixture was added because the blocker was manual tooling/data, not deterministic product logic. |
| Task 7 socket identity | HTTP + Socket.IO direct probes | observed | Logged-in wallet `globalMetaId` `idq1zfazvxaq69uw6txe3ewce30ewyhy9a7mzykgv0` returned 6 private-chat homes and Socket.IO heartbeat ack. `bothub-smoke-metaid` also connected and heartbeat-acked but had 0 homes. Current code sends `globalMetaId` in the Socket.IO `metaid` query. |
| metaso-p2p smoke | `pnpm smoke:metaso-p2p` | passed | `ok: true` against `http://127.0.0.1:18091`; service list/detail and Socket.IO heartbeat passed. Private-chat live check was skipped because `METASO_P2P_PRIVATE_CHAT_METAID` and `METASO_P2P_PRIVATE_CHAT_OTHER_METAID` were unset. |
| Unit/component tests | `pnpm test` | passed | 40 test files / 192 tests passed. Existing React Router future-flag and React `act(...)` warnings were observed. |
| Production build | `pnpm build` | passed | TypeScript build and Vite production build completed successfully. |
| Browser smoke | Browser at `http://localhost:5177` | passed | `5176` was already occupied by another local Vite process, so this worktree used Vite's fallback port `5177`. Real services loaded from local metaso-p2p; Delivery route rendered sessions, timeline empty state, assets region, and composer. Pay & Request remained disabled before wallet connection, as expected. |
| Chrome + Metalet | Wallet connection and free-order preparation | attempted / blocked before approval | Chrome opened BotHub and real services loaded. Clicking `连接钱包` opened the Metalet authorize page for `localhost:5177`, but Chrome automation blocked extension-page inspection by URL policy. No signing, broadcast, `createPin`, payment, key creation, or permission upgrade was approved. |
| Delivery assets | Dev-only provider message injection | passed | A seeded dev wallet and injected provider message produced 4 delivered assets: image, video, audio, and PDF. Preview fallbacks remained visible and every asset kept a `Download` action. Refresh preserved the session and asset metadata from local cache. |
| Desktop viewport | `1440x900` | passed | Delivery asset view had no horizontal overflow; `document.body.scrollWidth` equaled viewport width. |
| Mobile viewport | `390x844` | passed | Delivery asset view had no horizontal overflow; asset cards and download actions remained reachable. |
