# Release Closeout Private Beta Run Log

Checked from Bothub `main` at `15eeb19` on 2026-06-02 00:52 CST.
Local dev server was started with:

```bash
VITE_METASO_P2P_BASE_URL=/metaso-p2p VITE_USE_AGGREGATOR_MOCK=false VITE_USE_WS_MOCK=false pnpm dev -- --host 127.0.0.1
```

Vite reported `http://localhost:5177/`; in the Codex in-app Browser the
reachable URL was `http://[::1]:5177/`.

## Automated Gates

| Command | Result | Evidence |
| --- | --- | --- |
| `pnpm test` | passed | 57 files / 440 tests passed. Existing React Router and local diagnostic warnings were observed. |
| `pnpm build` | passed | TypeScript build and Vite production build completed. Vite reported the existing large-chunk warning for `dist/assets/index-0MEgXZqy.js`. |
| `pnpm lint` | passed | ESLint completed with `--max-warnings 0`. |
| `git diff --check` | passed | No whitespace errors before recording this run-log evidence. |

## Local Metaso-P2P Smoke

| Check | Result | Evidence |
| --- | --- | --- |
| `pnpm smoke:metaso-p2p` | passed | `baseUrl: http://127.0.0.1:18091`, health `ok`, skill-service list `count: 3`, Socket heartbeat ack `true`. |
| Canonical private chat | passed | Smoke used `/api/private-chat/homes/...` and `/api/private-chat/messages?...`; `routeMode.homes` and `routeMode.privateChatList` were both `canonical`. Homes returned `count: 6`; messages returned `count: 5`. |

## Public Metaso-P2P Follow-Up

Metaso-p2p was later deployed at `https://so.metaid.io`.

| Check | Result | Evidence |
| --- | --- | --- |
| Health | passed | `curl https://so.metaid.io/healthz` returned HTTP 200 with service `metaso-p2p`, status `ok`, version `c416816`, and CORS `Access-Control-Allow-Origin: *`. |
| Skill-service list | passed | `curl https://so.metaid.io/api/bot-hub/skill-service/list` returned HTTP 200 and real service rows including `紫微斗数算命 v2` and `Free Ecommerce Store Blueprint`. |
| Full smoke | passed | `METASO_P2P_BASE_URL=https://so.metaid.io METASO_P2P_PRIVATE_CHAT_METAID=idq1zfazvxaq69uw6txe3ewce30ewyhy9a7mzykgv0 METASO_P2P_PRIVATE_CHAT_OTHER_METAID=idq14hmv23j5fnlx4ccnmvlyldjd38xjsechzwg9xz pnpm smoke:metaso-p2p` returned `ok: true`, skill-service `count: 3`, Socket heartbeat ack `true`, `routeMode.homes: canonical`, and `routeMode.privateChatList: canonical`. |
| Browser direct endpoint | passed | Dev server started with `VITE_METASO_P2P_BASE_URL=https://so.metaid.io VITE_USE_AGGREGATOR_MOCK=false VITE_USE_WS_MOCK=false`; In-app Browser at `http://localhost:5176/` loaded real services and showed no service-loading error. Screenshot: `/tmp/bothub-public-metaso-p2p-home.png`. |

## Browser UI Copy Smoke

| Check | Result | Evidence |
| --- | --- | --- |
| Hub real services | passed | In-app Browser at `http://[::1]:5177/` loaded real service cards, including `紫微斗数算命 v2`, free beta services, and Chinese buyer CTA `下单请求`. Screenshot: `/tmp/bothub-release-closeout-hub.png`. |
| Buyer-safe normal copy | passed | Visible normal state had no `Socket.IO`, `chat pubkey`, `CreatePin`, `Pay & Request`, `Unknown Bot`, `No chat pubkey`, `/api/`, or `/chat-api/`. Provider-authored service names/descriptions remained in their original language. |
| Delivery wallet-gated state | passed | `/delivery` showed `我的交付`, wallet-gated copy, `成果库`, and `还没有收到成果` without raw transport terms. Screenshot: `/tmp/bothub-release-closeout-delivery-empty.png`. |
| Browser console | passed | In-app Browser `tab.dev.logs({ levels: ['error'] })` returned `[]` for the Delivery smoke page. |

## Chrome + Metalet Acceptance

Task 6 attempted Chrome + Metalet from the user's Chrome profile.

| Check | Result | Evidence |
| --- | --- | --- |
| Codex Chrome Extension connectivity | partially blocked | The first Chrome connection succeeded and opened `http://localhost:5177/`; later, after the Metalet authorization tab opened, Browser automation timed out and a recovery attempt only listed the in-app Browser backend. Extension and native-host checks still passed locally. |
| Metalet authorization | blocked externally | Clicking `连接钱包` opened a Metalet authorization page at `chrome-extension://lbjapbcmmceacocpimbpbidpgmlmoaao/popup.html#/authorize?...host=localhost%3A5177...`. Browser security policy blocked automation from controlling the extension page, so the user must manually approve it. |
| Wallet connect result | blocked externally | After waiting, the BotHub page still showed `连接中…`; no connected wallet identity was visible to BotHub during the automated acceptance window. |
| Free order buyer send | not run | Blocked behind wallet connection. |
| Paid native order buyer send | not run | Blocked behind wallet connection. |
| Provider reply / AI_Sunny check | not run | Blocked behind wallet connection and real order creation. |
| Follow-up composer | not run | Blocked behind wallet connection and selected real order. |

## Asset Acceptance

Task 5 used a controlled IndexedDB seed in a temporary Playwright Chromium
context with a stubbed wallet bridge. The image asset used the real metafile pin
`b081b32c2891f0e2b2b8dccc22b3256ebf54957aaa43053f712d90646f377ed6i0`.
Video, audio, document, and archive assets used controlled metafile-style URIs
to verify fallback cards and actions.

| Check | Result | Evidence |
| --- | --- | --- |
| Cached order restores | passed | `/delivery?order=...release-closeout-assets` showed `Release Closeout Controlled Assets`, provider `AI_Sunny`, status `已交付`, and `5 个成果`. Screenshot: `/tmp/bothub-release-closeout-assets-desktop.png`. |
| Image preview/open/download | passed | The first preview control opened a dialog with `打开` and `下载` actions. Screenshot: `/tmp/bothub-release-closeout-assets-preview.png`. |
| Video/audio/document/archive fallback | passed | Asset library rendered fallback cards with `预览暂不可用，可打开文件`; UI exposed 5 open links and 5 download links. |
| Copy one/copy all | passed | `复制链接` copied the real image content URL; `复制全部链接` copied 5 download URLs and included the real image pin URL. |
| Refresh recovery | passed | After reload the selected order, `已交付`, and `5 个成果` were restored from IndexedDB. Screenshot: `/tmp/bothub-release-closeout-assets-refresh.png`. |
| Mobile viewport | passed | At `390x844`, the asset view still showed the order and `5 个成果`; `document.body.scrollWidth` equaled `390`, so no horizontal overflow was observed. Screenshot: `/tmp/bothub-release-closeout-assets-mobile.png`. |

## Remaining Blockers

- The non-local metaso-p2p endpoint blocker is resolved by
  `https://so.metaid.io`; smoke and browser checks passed against it.
- Chrome + Metalet real free/paid order acceptance is blocked externally until
  the Metalet extension authorization can be manually approved and the Codex
  Chrome Extension backend is available again.

## Final Readiness Decision

Local automated, local/public metaso-p2p, Browser UI, and controlled asset
acceptance passed. The real Chrome + Metalet buyer-flow acceptance did not
complete, so this run does not yet prove the full private buyer-flow beta.
