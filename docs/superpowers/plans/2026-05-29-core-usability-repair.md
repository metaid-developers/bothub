# BotHub Core Usability Repair Development Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Each task should be executed by a fresh subagent, then reviewed by the controller before the next task starts. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current pure-frontend BotHub usable for the caller/buyer path: Metalet login, Pay & Request, private simplemsg delivery, Delivery history, follow-up input, and user identity display.

**Architecture:** Keep BotHub as a Vite + React + TypeScript SPA with no dedicated BotHub backend. Align wallet, private-chat encryption, and simplemsg publishing with `idframework/demo-chat`; align order payload, status tags, and delivery artifact interpretation with IDBots. meta-socket remains the HTTP and Socket.IO boundary for service discovery, private-chat history, and live delivery updates.

**Tech Stack:** Vite 5, React 18, TypeScript 5 strict, Tailwind CSS, React Router, TanStack Query, zustand, IndexedDB, socket.io-client, CryptoJS, Vitest + Testing Library, Chrome + Metalet for manual acceptance.

---

## 0. Why This Repair Exists

This is not a small UI polish round. The previous M9-M13 / P0-P4 productization work created useful scaffolding and tests, but the current branch is not yet a usable buyer product in a real wallet environment.

Current completion read:

- Bot Hub list/detail UI: medium completion. Real meta-socket service browsing is present.
- Pay & Request: low-to-medium completion. The detail modal path exists, but list card buttons are hard disabled and the real simplemsg write path is not aligned with demo-chat/IDBots.
- Delivery: low completion for real use. Layout, cache, and asset components exist, but decryption, session hydration, composer send, and wallet prompts are not reliable.
- Chrome + Metalet acceptance: not actually proven. The previous acceptance doc says wallet-dependent checks were blocked before approval; many checks were mock/static/no-signature checks.

The repair objective is therefore to turn the existing scaffold into a real caller-side MVP, not to add more peripheral features.

## 1. Evidence and Reference Sources

Bothub files already inspected:

- `src/delivery/decrypt.ts`
- `src/delivery/sendMessage.ts`
- `src/delivery/deliverySync.ts`
- `src/delivery/messageStore.ts`
- `src/delivery/orderStore.ts`
- `src/order/flow.ts`
- `src/order/privateChatCrypto.ts`
- `src/components/hub/ServiceCard.tsx`
- `src/components/hub/ServiceDetailPanel.tsx`
- `src/components/hub/RequestModal.tsx`
- `src/components/delivery/DeliveryComposer.tsx`
- `src/routes/Delivery.tsx`
- `src/wallet/metalet.ts`
- `src/wallet/useWallet.ts`
- `src/wallet/types.ts`
- `src/ws/socket.ts`
- `src/ws/useSocket.ts`
- `src/api/privateChat.ts`

demo-chat / IDFramework references:

- `/Users/tusm/Documents/MetaID_Projects/idframework/demo-chat/chat.html`
- `/Users/tusm/Documents/MetaID_Projects/idframework/demo-chat/chat.js`
- `/Users/tusm/Documents/MetaID_Projects/idframework/idframework/components/id-chat-input-box.js`
- `/Users/tusm/Documents/MetaID_Projects/idframework/idframework/components/id-connect-button.js`
- `/Users/tusm/Documents/MetaID_Projects/idframework/idframework/stores/chat/simple-talk.js`
- `/Users/tusm/Documents/MetaID_Projects/idframework/idframework/commands/SendChatMessageCommand.js`
- `/Users/tusm/Documents/MetaID_Projects/idframework/idframework/commands/FetchUserInfoCommand.js`

IDBots references:

- `/Users/tusm/Documents/MetaID_Projects/IDBots/IDBots/src/main/shared/orderMessage.js`
- `/Users/tusm/Documents/MetaID_Projects/IDBots/IDBots/src/main/services/serviceOrderProtocols.js`
- `/Users/tusm/Documents/MetaID_Projects/IDBots/IDBots/src/main/services/metaWebCrypto.ts`
- `/Users/tusm/Documents/MetaID_Projects/IDBots/IDBots/src/main/main.ts` around `gigSquare:sendOrder`
- `/Users/tusm/Documents/MetaID_Projects/IDBots/IDBots/src/renderer/components/gigSquare/GigSquareOrderModal.tsx`
- `/Users/tusm/Documents/MetaID_Projects/IDBots/IDBots/src/renderer/components/cowork/A2AMessageItem.tsx`

Local meta-socket reference:

- `docs/architecture/meta-socket-local-api.md`

## 2. Diagnosis

### 2.1 Delivery ECIES popup storm

Current `src/delivery/decrypt.ts` tries ECDH first, then falls back to `metalet.eciesDecrypt()`. For private simplemsg, demo-chat and IDBots use ECDH shared secret plus AES. ECIES is for other private-note style data, not normal `/protocols/simplemsg` chat messages.

That fallback explains the repeated Metalet popup:

```text
["Decrypt an encrypted message with ECIES algorithm"]
```

The same history/socket messages are reprocessed during hydration and live merge. When ECDH fails or the peer key is missing, Bothub repeatedly asks the wallet to ECIES-decrypt content that is not ECIES.

### 2.2 Private simplemsg protocol is not aligned

demo-chat and IDBots write private text messages to:

```text
/protocols/simplemsg
```

Bothub currently writes orders and follow-up messages to:

```text
/private/chat/simplemsg
```

This likely prevents provider listeners and meta-socket history from treating the outgoing message as standard IDChat simplemsg.

demo-chat also uses:

- `body.to = targetGlobalMetaId`
- `body.encrypt = 'ecdh'`
- `body.content = AES encrypted plaintext`
- `body.contentType = 'text/plain'`
- `body.timestamp = Date.now()` in demo-chat-compatible browser sends. IDBots has some second-level helper payloads, but Bothub should choose the demo-chat browser convention for user-side sends and keep tests explicit.
- `body.replyPin = '' | pinId`

Bothub should match this unless meta-socket explicitly documents a different browser-BotHub contract.

### 2.3 Wallet adapter is too thin

Bothub only exposes top-level `window.metaidwallet.ecdh`, but demo-chat uses:

```js
window.metaidwallet.common.ecdh({ externalPubKey })
```

Bothub should support both forms, prefer the demo-chat-compatible path when available, and keep a test for fallback behavior.

Bothub also only stores `globalMetaId` and addresses. It does not fetch or store the logged-in user's profile name/avatar, so the top-right header cannot render the user identity like demo-chat.

### 2.4 Pay & Request is visibly disabled

`src/components/hub/ServiceCard.tsx` currently renders the card-level `Pay & Request` button as hard disabled with a title saying the payment flow ships later. This makes the main marketplace feel broken even when a service is orderable.

The detail panel has a modal path, but the list button should either open the request flow directly or open detail and focus the request action. After login, free services must send the order without payment; paid services must call Metalet payment before order send.

### 2.5 Delivery composer depends on fragile session data

The composer requires `session.providerChatPubkey`. If the selected session came from history where the peer chat key was absent, or if the pending order did not persist the key correctly, the input stays disabled.

This is why the bottom input can appear present but unusable. The repair should resolve provider chat key from all available sources: pending order, service detail provider, private-chat item `fromUserInfo` / `toUserInfo`, and user profile lookup by globalMetaId.

### 2.6 Delivery status and artifact UI exist but are not backed by reliable sync

Asset parsing and IndexedDB storage are present, but they depend on decrypted content and correct session correlation. If decryption fails or outgoing orders are not standard simplemsg, Delivery cannot reliably group progress, final delivery, and assets.

## 3. Non-Goals for This Repair

- No provider-side UI or service publishing.
- No refund UI implementation.
- No rating submission UI implementation.
- No dedicated BotHub backend.
- No new dynamic request-form builder.
- No broad visual redesign beyond what is needed to make existing controls usable.

Refund and rating fields should remain reserved in domain types and parser logic where already present, but the user workflow is out of scope.

## 4. Target Behavior

### 4.1 Login

- User connects Metalet.
- Bothub stores wallet identity, including globalMetaId and chain addresses.
- Bothub fetches the user's profile from meta-socket `/api/info/globalmetaid/:globalMetaId` or compatible fallback.
- Header shows avatar and name when available; otherwise a stable fallback avatar/short id.
- No private-message decrypt prompt appears just because the user logs in.

### 4.2 Pay & Request

- Card-level and detail-level `Pay & Request` are usable after wallet connection and service/provider preflight.
- Free service:
  - Skip transfer.
  - Generate an order reference.
  - Encrypt the IDBots-compatible order payload.
  - Create a `/protocols/simplemsg` pin.
  - Persist a pending Delivery session immediately.
  - Navigate to `/delivery?session=...`.
- Paid service:
  - Call Metalet transfer using service payment fields.
  - Use returned payment txid/commit txid in the order payload.
  - Send the same standard private simplemsg.
  - Persist and navigate to Delivery.
- If payment succeeds but order message fails, preserve a recoverable local order row with a clear retry path.

### 4.3 Delivery

- Delivery hydrates cached sessions without asking Metalet to decrypt already-known failures repeatedly.
- Incoming standard private simplemsg decrypts through ECDH/AES only.
- Missing peer key shows a non-blocking decrypt-unavailable state and keeps raw content hidden from casual view unless expanded.
- Session list and timeline are still usable if one message fails to decrypt.
- Bottom composer can send follow-up text to the provider using the same `/protocols/simplemsg` path and encryption as demo-chat.
- Delivered image/video/audio/file assets render and remain available after refresh.

## 5. Implementation Tasks

### Task 1: Wallet and Profile Adapter Parity

**Purpose:** Make Bothub's wallet layer match the Metalet surfaces used by demo-chat and expose enough profile data for the header.

**Files:**

- Modify: `src/wallet/types.ts`
- Modify: `src/wallet/metalet.ts`
- Modify: `src/wallet/useWallet.ts`
- Modify: `src/components/WalletConnectButton.tsx`
- Create: `src/api/userProfile.ts`
- Test: `tests/wallet/metalet.test.ts`
- Test: `tests/wallet/useWallet.test.tsx`
- Test: `tests/api/userProfile.test.ts`
- Test: `tests/components/WalletConnectButton.test.tsx`

- [ ] **Step 1: Add failing adapter tests**

Cover:

- `metalet.ecdh()` uses `window.metaidwallet.common.ecdh` when present.
- Falls back to `window.metaidwallet.ecdh` only when `common.ecdh` is unavailable.
- Wallet identity can carry `name`, `avatar`, `metaid`, and `profileUpdatedAt`.
- Profile client returns provider/user chat key candidates: `chatpubkey`, `chatPubkey`, `chatPublicKey`, and `pubkey`.
- Profile client accepts legacy `/api/info/*` success envelope with `code === 1`.
- Avatar normalization handles `metafile://`, `/content/:pin`, and already absolute URLs.

- [ ] **Step 2: Implement wallet/profile adapter**

Add optional fields to `WalletIdentity`:

```ts
metaid?: string
name?: string
avatar?: string
avatarUrl?: string
chatPubkey?: string
chatPublicKey?: string
```

Add `common?: { ecdh?: ... }` to `MetaletWalletApi`.

Create `fetchUserProfileByGlobalMetaId(globalMetaId)` using `getNormalizedMetaSocketBaseUrl()` and `/api/info/globalmetaid/:globalMetaId`. Keep the legacy `code === 1` handling local to this client, because skill-service/private-chat APIs use `code === 0`.

The normalized profile type must expose:

```ts
interface UserProfile {
  metaid?: string
  globalMetaId?: string
  name?: string
  avatar?: string
  avatarUrl?: string
  chatPubkey?: string
}
```

`chatPubkey` should be resolved from all known spellings. This is required by Delivery, not just by header display.

- [ ] **Step 3: Hydrate profile on connect and restore**

After `getGlobalMetaid()`, fetch profile best-effort. Failure should not block login.

Persist only non-sensitive display profile fields with the wallet identity.

- [ ] **Step 4: Update header rendering**

`WalletConnectButton` should show:

- avatar image or initial
- display name when available
- shortened globalMetaId as secondary text/title
- disconnect action

- [ ] **Step 5: Verify**

Run:

```bash
pnpm test wallet api components/WalletConnectButton
pnpm build
```

- [ ] **Step 6: Commit**

```bash
git status --short
git add src/wallet/types.ts src/wallet/metalet.ts src/wallet/useWallet.ts src/components/WalletConnectButton.tsx src/api/userProfile.ts tests/wallet/metalet.test.ts tests/wallet/useWallet.test.tsx tests/api/userProfile.test.ts tests/components/WalletConnectButton.test.tsx
git commit -m "fix: align metalet wallet profile adapter"
```

Post an Eric development-journal buzz after the commit.

### Task 2: Private Simplemsg Crypto Without ECIES Popups

**Purpose:** Stop the wallet decrypt popup loop and make incoming simplemsg decryption match demo-chat/IDBots.

**Files:**

- Modify: `src/delivery/decrypt.ts`
- Modify: `src/delivery/deliverySync.ts`
- Modify: `src/ws/privateChat.ts`
- Modify: `src/order/privateChatCrypto.ts` if tests expose a parity mismatch
- Test: `tests/delivery/decrypt.test.ts`
- Test: `tests/delivery/deliverySync.test.ts`
- Test: `tests/ws/useSocket.test.ts`

- [ ] **Step 1: Add failing tests**

Cover:

- `decryptIncoming()` must not call `eciesDecrypt()` for standard private simplemsg.
- ECDH failure returns `{ plaintext: content, error }` without prompting ECIES.
- Already plain content is not sent to any wallet decrypt API.
- Same failed message is not re-decrypted in a tight hydration loop.
- `protocol: '/protocols/simplemsg'` and `encrypt/encryption: 'ecdh'` both route to ECDH.
- A live meta-socket fixture with only `from` and `to` fields, and no `fromGlobalMetaId`/`toGlobalMetaId`, is accepted after normalization and reaches Delivery.

- [ ] **Step 2: Change decrypt policy**

Use protocol-aware rules:

- `/protocols/simplemsg` with `encrypt === 'ecdh'` or `encryption === 'ecdh'`: ECDH/AES only.
- Empty encryption but ciphertext-like content and peer key available: try ECDH once.
- Plain text / order/status/delivery tags: return as plain.
- No ECIES fallback for chat. If future ECIES note content is needed, add an explicit mode instead of fallback.

- [ ] **Step 3: Cache shared secrets and failures**

Keep cache in a small module-local or store-level helper:

- shared secret by peer chat pubkey
- decrypt result by message id or raw content hash
- failed decrypt marker to avoid repeated wallet prompts or repeated expensive attempts

Do not persist shared secrets to IndexedDB.

- [ ] **Step 4: Improve private-chat item normalization**

Normalize fields from meta-socket/demo-chat/IDBots shapes:

- `protocol` / `path`
- `encrypt` / `encryption`
- `fromGlobalMetaId` / `from` / `createGlobalMetaId` / `globalMetaId`
- `toGlobalMetaId` / `to` / `receiveGlobalMetaId` / `targetGlobalMetaId`
- `fromUserInfo.chatPublicKey | chatpubkey | chatPubkey`
- `toUserInfo.chatPublicKey | chatpubkey | chatPubkey`
- wallet self aliases: globalMetaId and MVC address

Add an explicit `normalizePrivateChatItem(raw)` helper that accepts live meta-socket payloads that only provide `from`/`to`, then returns the internal `fromGlobalMetaId`/`toGlobalMetaId` shape before Delivery filtering. Keep `isPrivateChatItem()` as a type guard or compatibility wrapper over the normalized result. Otherwise valid socket pushes can be dropped before decryption.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm test delivery ws
pnpm build
```

Manual after implementation:

- Connect Metalet.
- Open Delivery.
- Confirm no ECIES decrypt prompt appears during initial history hydration.

- [ ] **Step 6: Commit**

```bash
git status --short
git add src/delivery/decrypt.ts src/delivery/deliverySync.ts src/ws/privateChat.ts src/order/privateChatCrypto.ts tests/delivery/decrypt.test.ts tests/delivery/deliverySync.test.ts tests/ws/useSocket.test.ts
git commit -m "fix: decrypt simplemsg without ecies prompts"
```

Post an Eric development-journal buzz after the commit.

### Task 3: Standard Simplemsg Send Path for Orders and Follow-Ups

**Purpose:** Make Bothub send exactly the private message shape provider bots and meta-socket expect.

**Files:**

- Modify: `src/order/flow.ts`
- Modify: `src/delivery/sendMessage.ts`
- Create: `src/order/payAndRequestStages.ts`
- Modify: `src/order/privateChatCrypto.ts` only if required by parity tests
- Test: `tests/order/flow.test.ts`
- Test: `tests/delivery/sendMessage.test.ts`

- [ ] **Step 1: Add failing parity tests**

Assert both order and follow-up createPin payloads use:

```ts
metaidData.path === '/protocols/simplemsg'
metaidData.contentType === 'application/json'
metaidData.encryption === '0'
JSON.parse(metaidData.body).to === providerGlobalMetaId
JSON.parse(metaidData.body).encrypt === 'ecdh'
JSON.parse(metaidData.body).contentType === 'text/plain'
typeof JSON.parse(metaidData.body).timestamp === 'number'
```

Also assert timestamp uses millisecond precision like demo-chat (`Date.now()`), not seconds.

- [ ] **Step 2: Introduce staged order flow**

`executePayAndRequest()` currently hides payment, encryption, and broadcast behind one promise. That makes it impossible to recover when payment succeeds but `createPin` fails. Refactor the order flow into explicit stages while keeping a composed public helper:

```ts
export interface PayAndRequestPaymentResult {
  paymentTxid: string
  paymentCommitTxid: string
  orderReference: string
}

export interface PreparedPayAndRequest {
  service: SkillServiceCore
  provider: ProviderInfo
  prompt: string
  payment: PayAndRequestPaymentResult
  orderPayload: string
  encryptedContent: string
  simplemsgBody: string
  sessionKey: string
  displaySummary: string
}

export class PayAndRequestBroadcastError extends PayAndRequestError {
  partial: PreparedPayAndRequest
}
```

Required stage boundaries:

- `validatePayAndRequestInput(...)`
- `executeServicePayment(...)`
- `prepareEncryptedOrderMessage(...)`
- `broadcastPreparedOrder(...)`
- `executePayAndRequest(...)` as the composed compatibility wrapper

If payment succeeded and broadcast fails, throw `PayAndRequestBroadcastError` with enough `partial` context for `RequestModal` to persist a recoverable local `failed_to_send` order.

- [ ] **Step 3: Use wallet ECDH adapter**

Both `executePayAndRequest()` and `sendDeliveryFollowUp()` should call the adapter from Task 1. Do not reach into `window.metaidwallet` directly from components.

- [ ] **Step 4: Change createPin path**

Replace `/private/chat/simplemsg` with `/protocols/simplemsg`.

- [ ] **Step 5: Normalize txid/pin id extraction**

Keep support for `pinId`, `txids`, `txId`, and reveal txid-like shapes if Metalet returns variant structures. The order correlation should prefer:

1. paid payment txid
2. free synthetic order reference
3. order message txid as fallback only if needed

- [ ] **Step 6: Add partial-failure tests**

Cover:

- paid transfer succeeds, ECDH succeeds, createPin fails -> `PayAndRequestBroadcastError.partial.payment.paymentTxid` is present.
- free order createPin fails -> partial order has `orderReference`.
- `RequestModal` can persist `failed_to_send` using the partial context in Task 4.

- [ ] **Step 7: Verify**

Run:

```bash
pnpm test order delivery
pnpm build
```

- [ ] **Step 8: Commit**

```bash
git status --short
git add src/order/flow.ts src/order/payAndRequestStages.ts src/delivery/sendMessage.ts src/order/privateChatCrypto.ts tests/order/flow.test.ts tests/delivery/sendMessage.test.ts
git commit -m "fix: send orders through standard simplemsg"
```

Post an Eric development-journal buzz after the commit.

### Task 4: Enable Pay & Request End-to-End

**Purpose:** Make every visible Pay & Request entry point usable, with clear free and paid behavior.

**Files:**

- Modify: `src/components/hub/ServiceCard.tsx`
- Modify: `src/components/hub/ServicesPanel.tsx`
- Modify: `src/components/hub/ServiceDetailPanel.tsx`
- Modify: `src/components/hub/RequestModal.tsx`
- Modify: `src/order/flow.ts`
- Modify: `src/order/payAndRequestStages.ts`
- Modify: `src/delivery/orderStore.ts`
- Modify: `src/delivery/messageStore.ts`
- Test: `tests/components/hub/ServiceCard.test.tsx`
- Test: `tests/components/hub/ServicesPanel.test.tsx`
- Test: `tests/components/hub/RequestModal.test.tsx`
- Test: `tests/order/flow.test.ts`
- Test: `tests/delivery/orderStore.test.ts`

- [ ] **Step 1: Add failing UI tests**

Cover:

- Service card button is not hard disabled when `onRequest` exists.
- Clicking card-level `Pay & Request` opens the request flow or service detail request flow.
- Wallet missing state gives a connect-required message, not a dead button.
- Free service calls no transfer and navigates to Delivery after `createPin`.
- Paid service calls transfer before encryption/broadcast.
- If payment succeeds but createPin fails, local recoverable order status is stored.
- Paid native preflight passes the exact service payment address, amount, chain, and currency into the Metalet transfer prompt.

- [ ] **Step 2: Add explicit request entry contract**

Prefer this component contract:

```ts
onRequest?: (service: SkillServiceListItem) => void
```

Do not overload card selection. Card click can still select/open details; button click should stop propagation and start request intent.

- [ ] **Step 3: Ensure detail data is available**

If a list item does not include the provider chat pubkey or full payment fields, load service detail before opening `RequestModal`.

- [ ] **Step 4: Improve preflight**

Before payment:

- wallet connected
- prompt non-empty and <= 4000 chars
- provider globalMetaId present
- provider chat pubkey present
- paid native service has payment address
- MRC20 service has mrc20 id and payment address
- MRC20 transfer support is verified against the current Metalet API shape before enabling MRC20 paid checkout. If not verified, disable MRC20 paid checkout with a clear unsupported-state message instead of exposing a broken payment path.

Preflight failures should be shown before any transfer.

- [ ] **Step 5: Persist pending and failure states**

Use existing IndexedDB order/session stores. Add missing status values if needed:

- `sending`
- `waiting`
- `failed_to_send`

Delivery should render the pending/failed row even if the provider has not replied.

For the partial-failure path from Task 3:

- catch `PayAndRequestBroadcastError`
- persist `paymentTxid` or `orderReference`
- persist `orderPayload`, `displaySummary`, service/provider identity, and provider chat pubkey
- mark order/session as `failed_to_send`
- show "payment succeeded but order message failed" with retry/resume action

Retry must reuse the existing payment context and must not trigger a second paid transfer.

- [ ] **Step 6: Verify**

Run:

```bash
pnpm test components/hub delivery order
pnpm build
```

Manual:

- Connect Metalet.
- Confirm card-level Pay & Request is clickable.
- Free service reaches the final Metalet createPin prompt after review.
- Paid service reaches the payment prompt before order send.
- Paid prompt fields match the selected service's payment address, amount, chain, and currency.
- MRC20 paid services are either verified through Metalet transfer or explicitly disabled with a clear message.

- [ ] **Step 7: Commit**

```bash
git status --short
git add src/components/hub/ServiceCard.tsx src/components/hub/ServicesPanel.tsx src/components/hub/ServiceDetailPanel.tsx src/components/hub/RequestModal.tsx src/order/flow.ts src/order/payAndRequestStages.ts src/delivery/orderStore.ts src/delivery/messageStore.ts tests/components/hub/ServiceCard.test.tsx tests/components/hub/ServicesPanel.test.tsx tests/components/hub/RequestModal.test.tsx tests/order/flow.test.ts tests/delivery/orderStore.test.ts
git commit -m "fix: enable pay request buyer flow"
```

Post an Eric development-journal buzz after the commit.

### Task 5: Delivery Session Hydration and Composer Reliability

**Purpose:** Make Delivery usable after login, refresh, history sync, and pending-order creation.

**Files:**

- Modify: `src/routes/Delivery.tsx`
- Modify: `src/delivery/messageStore.ts`
- Modify: `src/delivery/sessionGrouping.ts`
- Modify: `src/delivery/sessionDisplay.ts`
- Modify: `src/api/userProfile.ts`
- Modify: `src/components/delivery/DeliveryComposer.tsx`
- Modify: `src/components/delivery/SessionsList.tsx`
- Modify: `src/components/delivery/SessionHeader.tsx`
- Modify: `src/components/delivery/MessageBubble.tsx`
- Test: `tests/api/userProfile.test.ts`
- Test: `tests/delivery/sessionGrouping.test.ts`
- Test: `tests/delivery/messageStore.test.ts`
- Test: `tests/components/delivery/DeliveryComposer.test.tsx`
- Test: `tests/components/delivery/MessageBubble.test.tsx`

- [ ] **Step 1: Add failing tests for real failure modes**

Cover:

- A pending order session renders even with no provider reply.
- Hydrating from IndexedDB does not lose provider chat pubkey.
- Composer enables when provider key exists in order/session/message/profile fallback.
- Composer stays disabled with a clear actionable reason only when no key can be resolved.
- Failed decrypt message does not mark the whole session unusable.
- `fetchUserProfileByGlobalMetaId()` returns `chatPubkey` when meta-socket exposes any known chat key spelling.

- [ ] **Step 2: Introduce provider key resolver**

Create or keep local helper logic that resolves provider chat pubkey in this order:

1. selected session `providerChatPubkey`
2. persisted pending order/provider record
3. newest message peer info
4. provider profile lookup by globalMetaId

If no key exists, show a retry/fetch key action if feasible.

This resolver must use the normalized `chatPubkey` from Task 1. Do not assume profile lookup is only for name/avatar.

- [ ] **Step 3: Separate decrypt failure from order failure**

`deriveSessionStatus()` currently can mark a session `failed` because one message has `decryptError`. Change this so decrypt failure is a message-level warning unless the provider explicitly sends a failed order status.

- [ ] **Step 4: Make raw/decrypt-failed states user-safe**

Message bubble should show:

- "Unable to decrypt this message" with retry/technical details.
- Pin/tx id copy if available.
- No repeated wallet prompt.
- Raw ciphertext only behind an explicit details/expand affordance.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm test delivery components/delivery
pnpm build
```

Manual:

- Open Delivery after login.
- Existing sessions render.
- Composer can send a follow-up in an order session that has a provider key.

- [ ] **Step 6: Commit**

```bash
git status --short
git add src/routes/Delivery.tsx src/delivery/messageStore.ts src/delivery/sessionGrouping.ts src/delivery/sessionDisplay.ts src/api/userProfile.ts src/components/delivery/DeliveryComposer.tsx src/components/delivery/SessionsList.tsx src/components/delivery/SessionHeader.tsx src/components/delivery/MessageBubble.tsx tests/api/userProfile.test.ts tests/delivery/sessionGrouping.test.ts tests/delivery/messageStore.test.ts tests/components/delivery/DeliveryComposer.test.tsx tests/components/delivery/MessageBubble.test.tsx
git commit -m "fix: make delivery sessions and composer usable"
```

Post an Eric development-journal buzz after the commit.

### Task 6: Delivery Asset and Order Protocol Verification

**Purpose:** Keep the existing asset work, but verify it against the corrected decrypt/session pipeline and IDBots protocol tags.

**Files:**

- Modify: `src/delivery/protocol.ts`
- Modify: `src/delivery/assetParser.ts`
- Modify: `src/delivery/messageDisplay.ts`
- Modify: `src/delivery/sessionDisplay.ts`
- Modify: `src/components/delivery/DeliveredAssetsPanel.tsx`
- Modify: `src/components/delivery/AssetPreviewCard.tsx`
- Test: `tests/delivery/protocol.test.ts`
- Test: `tests/delivery/assetParser.test.ts`
- Test: `tests/components/delivery/DeliveredAssetsPanel.test.tsx`

- [ ] **Step 1: Add IDBots protocol fixtures**

Cover:

- `[ORDER_STATUS:<txid>]`
- `[DELIVERY:<txid>]`
- `[NeedsRating:<txid>]`
- `[ORDER_END:<txid>]`
- plain `metafile://...`
- image/video/audio/pdf attachment variants
- realistic generated-result filenames from IDBots-style delivery, including extension-bearing `metafile://<pin>.png`, `.jpg`, `.mp4`, `.mp3`, `.wav`, `.zip`, and extensionless file links

- [ ] **Step 2: Verify session correlation**

Provider messages with an order txid should attach to the order session, not only the provider peer bucket.

- [ ] **Step 3: Verify asset persistence after refresh**

Hydrate stored assets for a selected session without requiring live socket/history.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm test delivery components/delivery
pnpm build
```

Manual:

- Inject or receive provider messages containing image/video/audio/file metafile URIs.
- Confirm previews/downloads stay available after refresh.

- [ ] **Step 5: Commit**

```bash
git status --short
git add src/delivery/protocol.ts src/delivery/assetParser.ts src/delivery/messageDisplay.ts src/delivery/sessionDisplay.ts src/components/delivery/DeliveredAssetsPanel.tsx src/components/delivery/AssetPreviewCard.tsx tests/delivery/protocol.test.ts tests/delivery/assetParser.test.ts tests/components/delivery/DeliveredAssetsPanel.test.tsx
git commit -m "fix: verify delivery asset protocol rendering"
```

Post an Eric development-journal buzz after the commit.

### Task 7: Real Chrome + Metalet Acceptance

**Purpose:** Prove the app is actually usable with the installed Metalet extension and local meta-socket.

**Files:**

- Modify: `docs/qa/buyer-productization-acceptance.md`
- Create: `docs/qa/core-usability-repair-run-log.md`
- Optional modify: test fixtures only if manual findings require deterministic regression coverage.

- [ ] **Step 1: Start local app with real meta-socket**

Use:

```bash
VITE_META_SOCKET_BASE_URL=/meta-socket VITE_USE_AGGREGATOR_MOCK=false VITE_USE_WS_MOCK=false pnpm dev -- --host 127.0.0.1
```

Use a free port if the default is occupied.

- [ ] **Step 2: Browser smoke**

Using the in-app Browser:

- Bot Hub loads real services.
- Delivery route renders without console crashes.
- Desktop and mobile widths have no control overlap.

- [ ] **Step 3: Chrome + Metalet login**

Using Chrome/Computer Use:

- Connect Metalet.
- Confirm header shows avatar/name or fallback identity.
- Open Delivery.
- Confirm no ECIES decrypt popup loop occurs during hydration.

- [ ] **Step 4: Free order flow**

Use a real free service.

- Enter a harmless test request.
- Review.
- Proceed until the final Metalet createPin/sign/broadcast confirmation.
- Stop and ask the controller/user before approving the irreversible chain write.

Release-candidate acceptance requires at least one user-approved free order to complete the whole loop:

1. approve the free `createPin`
2. confirm `/protocols/simplemsg` is written
3. confirm meta-socket indexes or pushes it
4. confirm Delivery shows the pending order after refresh

If the user does not approve the free chain write, record the QA row as `blocked_by_user_approval` and do not claim release criteria are satisfied. A stopped-at-confirmation run proves only preflight, not product usability.

- [ ] **Step 5: Paid order preflight**

Use a paid service only up to the payment confirmation screen.

- Confirm transfer prompt appears before order broadcast.
- Do not approve payment unless the user explicitly confirms at action time.

- [ ] **Step 6: Follow-up composer**

In a session with provider key:

- Type a follow-up.
- Proceed until final createPin/sign confirmation.
- Stop and ask before approving chain write.

If approved, verify the outgoing follow-up is persisted locally, then reconciles with history/socket without duplicating.

- [ ] **Step 7: History and asset recovery**

After any approved write or injected fixture:

- Refresh the app.
- Delivery restores sessions/assets from IndexedDB.
- Socket reconnects.
- No duplicate messages appear.

- [ ] **Step 8: Socket identity check**

Using the logged-in wallet, verify which identity meta-socket expects for Socket.IO query and private-chat history:

- `globalMetaId`
- MVC address
- profile `metaid`

Keep the implementation accepting the currently documented MVC-address history path, but record the observed Socket.IO behavior. If Socket.IO does not reliably deliver by `globalMetaId`, add a tested resolver before claiming live Delivery push support.

- [ ] **Step 9: Commit QA docs**

```bash
git status --short
git add docs/qa/buyer-productization-acceptance.md docs/qa/core-usability-repair-run-log.md
git commit -m "docs: record core usability repair acceptance"
```

Post an Eric development-journal buzz after the commit.

## 6. Protocol Decisions and Known Risks

- **Provider readiness:** This repair does not implement the full IDBots PING/PONG provider-readiness handshake. The first release uses meta-socket service discovery plus provider chat pubkey as the orderability signal. If a stronger online proof is available through meta-socket online stats, add it as a small follow-up. For paid orders, the UI should avoid implying guaranteed provider availability unless readiness is verified.
- **MRC20 paid checkout:** Enable only after a real Metalet parameter-shape check. If the current extension requires fields beyond `genesis/paymentAddress/amount`, keep MRC20 paid services disabled with an explicit reason and document the blocker.
- **Socket identity:** Local HTTP history samples use MVC address as `metaId`; Socket examples show `globalMetaId-or-metaid`. Task 7 must record which identity works for live pushes and the code should centralize that resolver so it can be changed without touching Delivery logic.

## 7. Global Verification Gates

Every task must pass its scoped tests before commit. After Task 7:

```bash
pnpm test
pnpm lint
pnpm build
pnpm smoke:meta-socket
```

Then dispatch a final independent review subagent to inspect:

- demo-chat parity for login/private simplemsg/decrypt/send
- IDBots parity for order payload/status/delivery tags
- no ECIES popup path for Delivery simplemsg
- Pay & Request free/paid behavior
- one complete user-approved free order loop, or an explicit `blocked_by_user_approval` QA record if the user declined chain write approval
- IndexedDB persistence and refresh recovery
- user profile rendering
- residual refund/rating extension points

## 8. Release Criteria

The repair is done only when all of these are true:

- User can connect Metalet and see identity in the header.
- Delivery login/hydration does not trigger repeated ECIES decrypt prompts.
- User can click Pay & Request from the marketplace after login.
- At least one real free service order has been approved, written as `/protocols/simplemsg`, observed through meta-socket or local cache, and restored in Delivery after refresh. If the user declines write approval, release completion must remain blocked.
- Paid service reaches Metalet payment before order broadcast.
- Orders and follow-ups publish standard `/protocols/simplemsg`.
- Delivery session list, timeline, composer, and asset panel are usable with real or approved test data.
- Refresh restores cached delivery sessions/assets before live sync finishes.
- QA docs record what was actually proven and what still requires user-approved chain writes.
