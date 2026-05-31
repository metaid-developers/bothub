# Delivery Workspace Release Hardening Run Log

Task 4 live meta-socket readiness re-check for `codex/delivery-workspace-release-hardening`.

- Date checked: 2026-05-31 22:11 CST / 2026-05-31 14:11 UTC
- Bothub revision: `ac5a113`
- meta-socket revision: `dfe28c4`
- Requested dev command:

```bash
VITE_META_SOCKET_BASE_URL=/meta-socket VITE_USE_AGGREGATOR_MOCK=false VITE_USE_WS_MOCK=false pnpm dev -- --host 127.0.0.1
```

Vite reported port `5176` in use and served the checked app at `http://localhost:5177/`.

## Listener And Endpoint Checks

| Check | Result | Evidence |
| --- | --- | --- |
| Listener scan | local meta-socket not listening | `lsof -nP -iTCP -sTCP:LISTEN | rg "(18091|5176|vite|meta-socket)" || true` returned only `node 27845 ... TCP [::1]:5176 (LISTEN)`. |
| Local health | failed | `curl -sS -i http://127.0.0.1:18091/healthz || true` returned `curl: (7) Failed to connect to 127.0.0.1 port 18091 after 0 ms: Couldn't connect to server`. |
| Public service list | failed | `curl -sS -i 'https://api.idchat.io/api/bot-hub/skill-service/list?size=3&chainName=mvc&sortBy=updated&order=desc&includeInactive=true' || true` returned `HTTP/1.1 502 Bad Gateway` from `nginx/1.29.1`. |

## Smoke Check

```bash
META_SOCKET_BASE_URL=http://127.0.0.1:18091 pnpm smoke:meta-socket
```

Result: failed with exit code `1`.

```text
$ node scripts/smoke-meta-socket.mjs
[smoke:meta-socket] smoke failed: healthz request failed (http://127.0.0.1:18091/healthz): fetch failed
[ELIFECYCLE] Command failed with exit code 1.
```

Live acceptance is not passed because the required local service was unavailable.

## Provider Chat Key Probe

The Task 4 provider-chat-key probe was run against both candidate endpoints because neither endpoint was proven available.

```text
BASE http://127.0.0.1:18091
LIST {"ok":false,"error":"fetch failed"}
BASE https://api.idchat.io
LIST {"ok":true,"status":502,"text":"<html>\r\n<head><title>502 Bad Gateway</title></head>\r\n<body>\r\n<center><h1>502 Bad Gateway</h1></center>\r\n<hr><center>nginx/1.29.1</center>\r\n</body>\r\n</html>\r\n"}
```

No real service list or detail payload was available, so this run does not prove any current frontend normalization gap in `src/api/aggregator.ts`, `src/api/aggregator.types.ts`, or `src/api/userProfile.ts`.

## Mock-Disabled Browser Check

Checked `http://localhost:5177/` with:

- `VITE_META_SOCKET_BASE_URL=/meta-socket`
- `VITE_USE_AGGREGATOR_MOCK=false`
- `VITE_USE_WS_MOCK=false`

Browser-visible outcome:

- The Hub page rendered normally.
- The service list did not load real services.
- The UI showed an honest alert: `Could not load services`.
- The alert detail was `Failed to execute 'json' on 'Response': Unexpected end of JSON input`.
- No mock-only service names were used as live evidence.
- Screenshot captured at `/tmp/bothub-task4-mock-disabled-error.png`.

Vite proxy evidence:

```text
10:10:56 PM [vite] http proxy error: /api/bot-hub/skill-service/list?sortBy=rating&order=desc
Error: connect ECONNREFUSED 127.0.0.1:18091
    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1705:16)

10:10:57 PM [vite] http proxy error: /api/bot-hub/skill-service/list?sortBy=rating&order=desc
Error: connect ECONNREFUSED 127.0.0.1:18091
    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1705:16) (x2)
```

Browser console logs only showed existing React Router future-flag warnings; no app crash was observed.

## API Change Decision

No API source or test files were changed in this Task 4 pass.

Reason: live local and public meta-socket endpoints did not return usable list/detail/profile payloads. Without a current payload shape, changing BotHub normalization would be speculative.

## Verification Commands

Run before handing this Task 4 pass back for controller review:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm test` | passed | 56 test files / 409 tests passed. Existing React Router and test harness warnings were observed. |
| `pnpm build` | passed | TypeScript build and Vite production build completed. Vite reported the existing large-chunk warning for the app bundle. |
| `pnpm lint` | passed | ESLint completed with `--max-warnings 0`. |
| `git diff --check` | passed | No whitespace errors in the Bothub diff. |
| `git -C /Users/tusm/Documents/MetaID_Projects/meta-socket diff --check` | passed | No whitespace errors in the meta-socket issue diff. |

## Follow-Up

A meta-socket issue was created at:

```text
/Users/tusm/Documents/MetaID_Projects/meta-socket/issues/2026-05-31-bothub-aggregator-readiness.md
```

Task 4 is ready for controller review as a docs/evidence-only pass. It does not mark real meta-socket acceptance as passed.

## Task 5 Order Flow Hardening

Task 5 checked free and paid checkout behavior from the order flow through the Hub request modal.

- Date checked: 2026-05-31 22:23 CST / 2026-05-31 14:23 UTC
- Bothub base revision: `7a3682d`
- Task state: uncommitted worker diff for controller review

### Automated Coverage Added Or Confirmed

The Task 5 pass added or tightened tests proving:

- Free orders do not call `metalet.transfer`.
- Free orders call `metalet.ecdh`.
- Free orders call `metalet.createPin` at `/protocols/simplemsg`.
- Free order results expose `orderReference`, `sessionKey`, `orderPayload`, and `displaySummary`.
- Paid native orders call transfer before broadcast.
- Paid native transfer uses the expected chain, currency, address, and atomic amount.
- Paid native `paymentTxid` remains the order correlation id.
- Paid transfer success plus broadcast failure exposes a `PayAndRequestBroadcastError.partial` with local recovery data.
- RequestModal pending persistence navigates successful free and paid orders to an order-centered `?order=` Delivery URL.
- RequestModal failed broadcast recovery calls `persistFailedToSendOrder` for paid and free failures.
- RequestModal no longer shows the raw `Payment succeeded but...` paid recovery copy.

The first Task 5 test run intentionally failed after adding the stricter tests:

```text
Test Files  2 failed | 54 passed (56)
Tests       6 failed | 406 passed (412)
```

The failures were the expected red tests for missing provider-key preflight, paid MRC20 unsupported-state copy, and raw paid broadcast recovery copy.

After the minimal implementation pass, the same command passed:

```bash
pnpm test -- tests/order/flow.test.ts tests/components/hub/RequestModal.test.tsx
```

```text
Test Files  56 passed (56)
Tests       412 passed (412)
```

### Implementation Notes

Task 5 changed checkout behavior only where tests proved a gap:

- RequestModal blocks checkout before wallet/payment prompts when the provider has no chat public key.
- RequestModal blocks paid MRC20 checkout before wallet/payment prompts with explicit buyer-facing copy.
- Paid broadcast recovery copy now says the payment went through and avoids the raw `Payment succeeded but...` phrase.
- The order-flow MRC20 unsupported error uses the same buyer-facing copy as the modal.

### Manual Chrome And Metalet Attempt

Manual Chrome + Metalet order execution was blocked externally and was not faked.

Reason: Task 4 already proved that no real service list/detail payload was available:

- local `127.0.0.1:18091` was not listening
- `META_SOCKET_BASE_URL=http://127.0.0.1:18091 pnpm smoke:meta-socket` failed on `/healthz`
- public `https://api.idchat.io` returned `502 Bad Gateway`
- mock-disabled Vite showed `Could not load services`

Because there was no real service to select, this Task 5 pass did not click through a Chrome + Metalet free or paid order. The existing meta-socket issue remains the active external blocker:

```text
/Users/tusm/Documents/MetaID_Projects/meta-socket/issues/2026-05-31-bothub-aggregator-readiness.md
```

No new meta-socket issue was created because the order-flow manual blocker is the same aggregator readiness outage already recorded in Task 4.

### Task 5 Verification Commands

Run before handing this Task 5 pass back for controller review:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm test -- tests/order/flow.test.ts tests/components/hub/RequestModal.test.tsx` | passed | 56 test files / 412 tests passed. Existing React Router, FocusTrap, profile-offline, and act warnings were observed. |
| `pnpm build` | passed | TypeScript build and Vite production build completed. Vite reported the existing large-chunk warning for the app bundle. |
| `pnpm lint` | passed | ESLint completed with `--max-warnings 0`. |
| `git diff --check` | passed | No whitespace errors in the Bothub diff. |

Task 5 verification completed at 2026-05-31 22:25 CST / 2026-05-31 14:25 UTC.
