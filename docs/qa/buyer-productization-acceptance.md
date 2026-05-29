# Buyer Productization Acceptance

This checklist is for the P4 buyer-side release candidate. It verifies the real meta-socket path, core buyer order preparation, Delivery hydration, and delivered asset handling without adding provider, refund, or rating scope.

## Local Prerequisites

- Local meta-socket is running at `http://127.0.0.1:18091`.
- Health check succeeds:

```bash
curl -sS http://127.0.0.1:18091/healthz
```

- Vite dev proxy maps `/meta-socket` to `http://127.0.0.1:18091`.
- Chrome has Metalet installed and already set up by the controller.
- Stop before approving any Metalet signing, broadcast, `createPin`, payment, key creation, or permission upgrade unless the controller explicitly approves that action.

## Environment

Recommended `.env.local` or `.env` values for local real-data QA:

```dotenv
VITE_META_SOCKET_BASE_URL=/meta-socket
VITE_USE_AGGREGATOR_MOCK=false
VITE_USE_WS_MOCK=false
VITE_METAFILE_ACCELERATE_CONTENT_BASE=https://file.metaid.io/metafile-indexer/api/v1/files/accelerate/content
VITE_METAFILE_CONTENT_BASE=https://file.metaid.io/metafile-indexer/api/v1/files/content
```

The default real meta-socket service is `http://127.0.0.1:18091`; the browser should use `/meta-socket` through the Vite proxy to avoid local CORS preflight issues.

## Automated Verification

Run:

```bash
pnpm smoke:meta-socket
pnpm test
pnpm build
```

`pnpm smoke:meta-socket` should pass against `http://127.0.0.1:18091`.

## Dev Server

Start the QA dev server with real meta-socket data and no mocks:

```bash
VITE_META_SOCKET_BASE_URL=/meta-socket VITE_USE_AGGREGATOR_MOCK=false VITE_USE_WS_MOCK=false pnpm dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5176`. Stop the dev server after the run unless the controller asks to keep it alive.

## Browser Smoke Checklist

- BotHub loads real service data from local meta-socket.
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
| meta-socket smoke | `pnpm smoke:meta-socket` | passed | `ok: true` against `http://127.0.0.1:18091`; service list/detail and Socket.IO heartbeat passed. Private-chat live check was skipped because `META_SOCKET_PRIVATE_CHAT_METAID` and `META_SOCKET_PRIVATE_CHAT_OTHER_METAID` were unset. |
| Unit/component tests | `pnpm test` | passed | 40 test files / 192 tests passed. Existing React Router future-flag and React `act(...)` warnings were observed. |
| Production build | `pnpm build` | passed | TypeScript build and Vite production build completed successfully. |
| Browser smoke | Browser at `http://localhost:5177` | passed | `5176` was already occupied by another local Vite process, so this worktree used Vite's fallback port `5177`. Real services loaded from local meta-socket; Delivery route rendered sessions, timeline empty state, assets region, and composer. Pay & Request remained disabled before wallet connection, as expected. |
| Chrome + Metalet | Wallet connection and free-order preparation | attempted / blocked before approval | Chrome opened BotHub and real services loaded. Clicking `连接钱包` opened the Metalet authorize page for `localhost:5177`, but Chrome automation blocked extension-page inspection by URL policy. No signing, broadcast, `createPin`, payment, key creation, or permission upgrade was approved. |
| Delivery assets | Dev-only provider message injection | passed | A seeded dev wallet and injected provider message produced 4 delivered assets: image, video, audio, and PDF. Preview fallbacks remained visible and every asset kept a `Download` action. Refresh preserved the session and asset metadata from local cache. |
| Desktop viewport | `1440x900` | passed | Delivery asset view had no horizontal overflow; `document.body.scrollWidth` equaled viewport width. |
| Mobile viewport | `390x844` | passed | Delivery asset view had no horizontal overflow; asset cards and download actions remained reachable. |
