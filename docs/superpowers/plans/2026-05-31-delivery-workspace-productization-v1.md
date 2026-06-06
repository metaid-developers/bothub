# Delivery Workspace Productization V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. The user wants one fresh subagent per task or phase, with the controller reviewing and sending the same task subagent back for rework until it passes. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn BotHub Delivery from a private-message debug surface into an order-centered digital-delivery workspace where ordinary buyers can see request progress, manage delivered assets, and recover previous deliveries after login.

**Architecture:** Keep BotHub as a pure frontend React app backed by metaso-p2p, Socket.IO, Metalet, and IndexedDB. Build a derived Delivery workspace model over the existing orders/sessions/messages/assets stores, then replace the current session/message-first layout with buyer-facing order list, progress timeline, asset library, and sync/recovery states. Preserve the repaired private-chat/profile/decrypt pipeline from `2026-05-31-delivery-message-profile-parity.md`.

**Tech Stack:** Vite 5, React 18, TypeScript 5 strict, Tailwind CSS, zustand, IndexedDB, socket.io-client, CryptoJS, Vitest + Testing Library, Chrome + Metalet for real manual acceptance.

---

## 0. Product Direction

BotHub is the **caller/buyer-side order tool** for users who do not want to install IDBots, configure LLMs, or understand A2A internals. The Delivery tab should not feel like a private chat console. It should answer four ordinary-user questions:

- What did I request?
- What is the current status?
- What did the provider deliver?
- Can I still find, preview, download, or send a follow-up later?

The current code now has the necessary low-level foundation:

- profile hydration and decrypt retry live in `src/routes/Delivery.tsx` and `src/delivery/decryptRetry.ts`
- private-chat history/socket merge lives in `src/delivery/deliverySync.ts`
- local order/session/message/asset cache lives in `src/delivery/db.ts` and `src/delivery/messageStore.ts`
- basic asset parsing and cards live in `src/delivery/assetParser.ts`, `src/components/delivery/DeliveredAssetsPanel.tsx`, and `src/components/delivery/AssetPreviewCard.tsx`

This plan builds the next layer: **Delivery Workspace Productization V1**.

## 1. Scope

Implement:

- Order-centered Delivery workspace model.
- Buyer-friendly left order list, selected order summary, status timeline, and asset library.
- First-class asset management for images, video, audio, documents, archives, and unknown files.
- Persisted delivery recovery after page refresh and later wallet login.
- Clear sync, empty, failed, and partial states.
- Real Chrome + Metalet free-order acceptance path.

Do not implement:

- Refund execution.
- Rating submission.
- Provider-side workflows.
- Dedicated BotHub backend.
- Bulk zip generation or local file downloads beyond normal browser links.
- New metaso-p2p APIs unless real testing proves an interface is missing or broken.

If an observed failure is caused by missing or broken metaso-p2p data, create an issue markdown file in:

```text
/Users/tusm/Documents/MetaID_Projects/metaso-p2p/issues/
```

Use a filename like `YYYY-MM-DD-bothub-delivery-workspace-gap.md`, include:

- failing URL or socket payload
- expected shape
- actual shape
- BotHub impact
- reproduction steps

## 2. Reference Sources

Read these before coding:

- `docs/architecture/metaso-p2p-local-api.md`
- `docs/superpowers/plans/2026-05-31-delivery-message-profile-parity.md`
- `src/routes/Delivery.tsx`
- `src/components/WalletHydrator.tsx`
- `src/components/delivery/SessionsList.tsx`
- `src/components/delivery/SessionHeader.tsx`
- `src/components/delivery/MessageList.tsx`
- `src/components/delivery/MessageBubble.tsx`
- `src/components/delivery/DeliveredAssetsPanel.tsx`
- `src/components/delivery/AssetPreviewCard.tsx`
- `src/delivery/domain.ts`
- `src/delivery/db.ts`
- `src/delivery/orderStore.ts`
- `src/delivery/messageStore.ts`
- `src/delivery/sessionDisplay.ts`
- `src/delivery/sessionGrouping.ts`
- `src/delivery/deliverySync.ts`
- `src/delivery/protocol.ts`
- `src/delivery/orderParser.ts`
- `src/delivery/assetParser.ts`
- `src/i18n/zh-CN.ts`

Design reference:

- The UI is an operational workspace, not a landing page.
- Prioritize dense but readable information, restrained surfaces, stable dimensions, and obvious workflow states.
- Avoid marketing hero copy, decorative gradients, nested cards, or explanatory in-app text about technical implementation.

## 3. Current Diagnosis

Useful pieces exist, but the product shape is still low:

- `DeliveryPage` is session/message-first. It shows `Sessions`, a private-message area, and `Delivered assets`, which exposes technical implementation rather than buyer workflow.
- The page title/subtitle still says `Private simplemsg sessions delivered over metaso-p2p Socket.IO.`, which is debug/developer copy.
- Empty state is wallet/session oriented, not buyer-outcome oriented.
- Local `BuyerOrder` rows are loaded, but the visible workspace is mostly derived from `byPeer` sessions. A pending order with no provider reply can feel thin or invisible unless it has a message-derived session.
- Assets are parsed and persisted, but the asset area is a passive list. There is no filter, preview modal, copy-link action, selected asset state, or clear "download/open" affordance.
- Session status exists, but the center panel is a chat log. It does not present a buyer-readable progress timeline.
- Sync is happening in `WalletHydrator`, but Delivery does not clearly show "loading saved deliveries", "syncing history", "partial sync failed", or "last synced" states.
- Tests mostly prove infrastructure behavior, not the product-level buyer experience.

## 4. File Plan

Create:

- `src/delivery/workspace.ts`  
  Pure selectors that merge orders, sessions, messages, and stored assets into buyer-facing workspace orders. This file owns the buyer-facing workspace status union, asset totals, selected-order resolution, and fallback behavior for order-only/session-only cases.

- `tests/delivery/workspace.test.ts`  
  Unit tests for order/session/message/asset merging and product status derivation.

- `src/delivery/syncStatusStore.ts`  
  Small Zustand store for Delivery hydration/sync UI state: `idle`, `hydrating`, `syncing`, `partial`, `ready`, `error`, plus `lastSyncedAt` and failed peer count.

- `tests/delivery/syncStatusStore.test.ts`  
  Unit tests for sync state transitions.

- `src/delivery/workspaceRecovery.ts`  
  Small route-facing IndexedDB loader for persisted `BuyerOrder[]`, `DeliverySessionRecord[]`, and per-session assets needed by the workspace. This keeps recovery explicit instead of hiding it inside UI code.

- `tests/delivery/workspaceRecovery.test.ts`  
  Tests for order-only, session-only, stored-asset, and selected-order reload recovery boundaries.

- `src/components/delivery/DeliveryOrderList.tsx`  
  Buyer-facing order/request list that replaces the current session-list mental model.

- `tests/components/delivery/DeliveryOrderList.test.tsx`

- `src/components/delivery/DeliveryStatusTimeline.tsx`  
  Buyer-facing progress timeline for selected order, backed by existing messages.

- `tests/components/delivery/DeliveryStatusTimeline.test.tsx`

- `src/components/delivery/DeliveryAssetLibrary.tsx`  
  Asset workspace with filters, selected asset preview, copy/open/download actions, and empty/failed preview states.

- `src/components/delivery/AssetPreviewDialog.tsx`  
  Focused preview dialog for image/video/audio/document/other assets. Keep it simple and accessible.

- `tests/components/delivery/DeliveryAssetLibrary.test.tsx`
- `tests/components/delivery/AssetPreviewDialog.test.tsx`

- `src/components/delivery/DeliveryWorkspaceHeader.tsx`  
  Selected-order summary header: provider, service, status, asset count, last activity, and reserved slots for later refund/rating.

- `tests/components/delivery/DeliveryWorkspaceHeader.test.tsx`

Modify:

- `src/routes/Delivery.tsx`  
  Use `workspace.ts` selectors, render the new order-centered layout, expose sync state, and keep existing profile/decrypt/follow-up behavior.

- `tests/components/delivery/DeliveryPage.test.tsx`  
  Replace/extend current layout tests with buyer-facing workspace tests.

- `src/components/WalletHydrator.tsx`  
  Update `syncStatusStore` during hydrate/history sync.

- `src/components/delivery/DeliveryComposer.tsx`  
  Keep follow-up behavior, but fit copy and disabled states into the order workspace. Allow reply pin to be optional for order-only rows; never invent a fake reply pin.

- `src/components/delivery/AssetPreviewCard.tsx`  
  Add optional action callbacks and compact/full modes if needed by `DeliveryAssetLibrary`.

- `src/delivery/sessionDisplay.ts`  
  Reuse asset/status helpers from `workspace.ts` where appropriate, or leave as compatibility helpers if the route no longer depends on old session display.

- `src/i18n/zh-CN.ts`  
  Replace technical Delivery copy with buyer-facing Chinese product UI copy. Keep English nav labels only if the surrounding app already does.

- `tests/i18n/index.test.ts`  
  Update if new typed translation keys need coverage.

## 5. Product Acceptance Criteria

The final implementation must satisfy all of these:

- A connected buyer sees a list of previous and current requests, even if a request has no provider reply yet.
- Selecting an order shows provider, service name, request summary, price/payment reference when available, current status, and latest activity.
- Status is understandable without reading raw private messages.
- Delivered files are visually prominent and grouped by type.
- Images render inline and can open in a larger preview.
- Video/audio can play inline or in the preview dialog.
- Documents/archives/unknown files have clear file cards and download/open actions.
- Copying one asset link and all asset links works with `navigator.clipboard` when available.
- Refreshing the page after a delivered asset still restores the selected order and stored assets from IndexedDB after wallet login.
- Socket/history sync issues are visible but do not erase local cached deliveries.
- Delivery still supports follow-up messages using the repaired provider chat key logic.
- UI does not contain implementation copy such as `simplemsg`, `Socket.IO`, `metaso-p2p`, `chat key`, or `ciphertext` in normal buyer states. Technical details can stay behind explicit diagnostic controls for decrypt failures.

## 6. Implementation Tasks

### Task 1: Build The Order-Centered Workspace Model

**Files:**

- Create: `src/delivery/workspace.ts`
- Create: `tests/delivery/workspace.test.ts`
- Create: `src/delivery/workspaceRecovery.ts`
- Create: `tests/delivery/workspaceRecovery.test.ts`
- Modify: `src/delivery/sessionDisplay.ts` only if needed to avoid duplicate status/asset logic

- [ ] **Step 1: Write failing tests for workspace derivation**

Create `tests/delivery/workspace.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  buildDeliveryWorkspace,
  selectWorkspaceOrder,
  type WorkspaceOrder,
} from '@/delivery/workspace'
import type {
  BuyerOrder,
  DeliveryAssetRecord,
  DeliverySessionRecord,
} from '@/delivery/domain'
import type { DeliveryMessage } from '@/delivery/messageStore'

const SELF = 'idqbuyer'
const PROVIDER = 'idqprovider'

function order(overrides: Partial<BuyerOrder> = {}): BuyerOrder {
  return {
    id: `${SELF}:${PROVIDER}:order-1`,
    walletGlobalMetaId: SELF,
    providerGlobalMetaId: PROVIDER,
    providerChatPubkey: 'provider-key',
    providerName: 'Render Bot',
    providerAvatarUrl: 'https://cdn.example/render.png',
    serviceId: 'svc-image',
    serviceName: 'Image Render',
    skillName: 'render-image',
    outputType: 'image',
    rawRequest: 'Make a product image',
    displaySummary: 'Make a product image',
    price: '0',
    currency: 'SPACE',
    settlementKind: 'native',
    paymentChain: 'mvc',
    orderReference: 'order-1',
    status: 'waiting',
    createdAt: 10,
    updatedAt: 10,
    ...overrides,
  }
}

function session(overrides: Partial<DeliverySessionRecord> = {}): DeliverySessionRecord {
  return {
    id: `${SELF}:${PROVIDER}:order-1`,
    walletGlobalMetaId: SELF,
    providerGlobalMetaId: PROVIDER,
    providerChatPubkey: 'provider-key',
    providerName: 'Render Bot',
    providerAvatarUrl: 'https://cdn.example/render.png',
    orderCorrelationId: 'order-1',
    serviceId: 'svc-image',
    serviceLabel: 'Image Render',
    status: 'delivered',
    lastMessageId: 'delivery-1',
    lastActivityAt: 50,
    assetCount: 1,
    unreadCount: 0,
    ...overrides,
  }
}

function message(overrides: Partial<DeliveryMessage> = {}): DeliveryMessage {
  return {
    id: 'delivery-1',
    peerGlobalMetaId: PROVIDER,
    peerChatPubkey: 'provider-key',
    peerName: 'Render Bot',
    peerAvatarUrl: 'https://cdn.example/render.png',
    fromGlobalMetaId: PROVIDER,
    toGlobalMetaId: SELF,
    content: '[DELIVERY:order-1] Done metafile://image.png',
    rawContent: '[DELIVERY:order-1] Done metafile://image.png',
    encryption: 'plain',
    contentType: 'text/plain',
    orderCorrelationId: 'order-1',
    timestamp: 50,
    ...overrides,
  }
}

function asset(overrides: Partial<DeliveryAssetRecord> = {}): DeliveryAssetRecord {
  return {
    id: `${SELF}:${PROVIDER}:order-1:metafile://image.png`,
    walletGlobalMetaId: SELF,
    sessionId: `${SELF}:${PROVIDER}:order-1`,
    messageId: 'delivery-1',
    orderCorrelationId: 'order-1',
    uri: 'metafile://image.png',
    pinId: 'image',
    filename: 'image.png',
    extension: 'png',
    kind: 'image',
    mimeType: 'image/png',
    previewUrl: 'https://file.example/image-preview',
    downloadUrl: 'https://file.example/image',
    fallbackUrl: 'https://file.example/image-fallback',
    createdAt: 50,
    ...overrides,
  }
}

describe('delivery workspace', () => {
  it('keeps an order visible before provider replies arrive', () => {
    const workspace = buildDeliveryWorkspace({
      walletGlobalMetaId: SELF,
      orders: [order()],
      sessions: [],
      byPeer: {},
      assetsBySession: {},
    })

    expect(workspace.orders).toHaveLength(1)
    expect(workspace.orders[0]).toMatchObject({
      id: `${SELF}:${PROVIDER}:order-1`,
      providerName: 'Render Bot',
      serviceLabel: 'Image Render',
      requestSummary: 'Make a product image',
      status: 'waiting',
      assetCount: 0,
    })
  })

  it('keeps stored assets visible even when the live message list is empty after reload', () => {
    const workspace = buildDeliveryWorkspace({
      walletGlobalMetaId: SELF,
      orders: [order()],
      sessions: [session()],
      byPeer: {},
      assetsBySession: { [`${SELF}:${PROVIDER}:order-1`]: [asset()] },
    })

    expect(workspace.orders[0]).toMatchObject({
      id: `${SELF}:${PROVIDER}:order-1`,
      assetCount: 1,
      status: 'delivered',
    })
    expect(workspace.orders[0]?.assets[0]?.filename).toBe('image.png')
  })

  it('resolves selected order id after a URL reload', () => {
    const workspace = buildDeliveryWorkspace({
      walletGlobalMetaId: SELF,
      orders: [
        order({ orderReference: 'order-1', id: `${SELF}:${PROVIDER}:order-1`, updatedAt: 10 }),
        order({ orderReference: 'order-2', id: `${SELF}:${PROVIDER}:order-2`, updatedAt: 20 }),
      ],
      sessions: [],
      byPeer: {},
      assetsBySession: {},
    })

    expect(selectWorkspaceOrder(workspace, `${SELF}:${PROVIDER}:order-1`)?.orderCorrelationId).toBe(
      'order-1',
    )
  })

  it('merges session, messages, and stored assets into one selected order', () => {
    const workspace = buildDeliveryWorkspace({
      walletGlobalMetaId: SELF,
      orders: [order()],
      sessions: [session()],
      byPeer: { [PROVIDER]: [message()] },
      assetsBySession: { [`${SELF}:${PROVIDER}:order-1`]: [asset()] },
    })

    const selected = selectWorkspaceOrder(workspace, `${SELF}:${PROVIDER}:order-1`)

    expect(selected).toMatchObject({
      id: `${SELF}:${PROVIDER}:order-1`,
      status: 'delivered',
      assetCount: 1,
      messageCount: 1,
      providerName: 'Render Bot',
    })
    expect(selected?.assets[0]?.filename).toBe('image.png')
  })

  it('keeps session-only deliveries visible when order cache is missing', () => {
    const workspace = buildDeliveryWorkspace({
      walletGlobalMetaId: SELF,
      orders: [],
      sessions: [session()],
      byPeer: { [PROVIDER]: [message()] },
      assetsBySession: { [`${SELF}:${PROVIDER}:order-1`]: [asset()] },
    })

    expect(workspace.orders[0]).toEqual(expect.objectContaining({
      serviceLabel: 'Image Render',
      status: 'delivered',
      requestSummary: expect.any(String),
      assetCount: 1,
    }))
  })

  it('sorts active and recent work above old completed work', () => {
    const waiting = order({ orderReference: 'order-2', id: `${SELF}:${PROVIDER}:order-2`, updatedAt: 100 })
    const delivered = order({ orderReference: 'order-1', status: 'delivered', updatedAt: 80 })

    const workspace = buildDeliveryWorkspace({
      walletGlobalMetaId: SELF,
      orders: [delivered, waiting],
      sessions: [],
      byPeer: {},
      assetsBySession: {},
    })

    expect(workspace.orders.map((item: WorkspaceOrder) => item.orderCorrelationId)).toEqual([
      'order-2',
      'order-1',
    ])
  })
})
```

Run:

```bash
pnpm test -- tests/delivery/workspace.test.ts
```

Expected: fails because `src/delivery/workspace.ts` does not exist.

- [ ] **Step 2: Implement the workspace model**

Create `src/delivery/workspace.ts` with focused pure helpers:

```ts
import type {
  BuyerOrder,
  DeliveryAssetRecord,
  DeliverySessionRecord,
} from '@/delivery/domain'
import { buildSessionId } from '@/delivery/domain'
import type { DeliveryMessage } from '@/delivery/messageStore'
import {
  deliveryAssetsForSession,
  deriveSessionStatus,
} from '@/delivery/sessionDisplay'
import {
  buildSessionKey,
  messagesForSession as resolveMessagesForSession,
} from '@/delivery/sessionGrouping'

export interface WorkspaceOrder {
  id: string
  sessionId: string
  /** UI grouping key in the existing format: providerGlobalMetaId[:orderCorrelationId]. */
  sessionKey: string
  providerGlobalMetaId: string
  providerChatPubkey?: string
  providerName?: string
  providerAvatarUrl?: string
  serviceId?: string
  serviceLabel: string
  requestSummary: string
  rawRequest?: string
  outputType?: BuyerOrder['outputType']
  priceLabel?: string
  paymentReference?: string
  orderCorrelationId: string | null
  status: WorkspaceOrderStatus
  assetCount: number
  messageCount: number
  unreadCount: number
  createdAt: number
  updatedAt: number
  lastActivityAt: number
  messages: DeliveryMessage[]
  assets: ReturnType<typeof deliveryAssetsForSession>
  source: 'order' | 'session' | 'merged'
}

export type WorkspaceOrderStatus =
  | 'sending'
  | 'waiting'
  | 'active'
  | 'delivering'
  | 'delivered'
  | 'completed'
  | 'failed'
  | 'failed_to_send'

export interface DeliveryWorkspace {
  walletGlobalMetaId: string
  orders: WorkspaceOrder[]
  totalCount: number
  activeCount: number
  deliveredCount: number
  assetCount: number
  latestActivityAt: number | null
}

export function buildDeliveryWorkspace(input: {
  walletGlobalMetaId: string
  orders: BuyerOrder[]
  sessions: DeliverySessionRecord[]
  byPeer: Record<string, DeliveryMessage[]>
  assetsBySession: Record<string, DeliveryAssetRecord[]>
}): DeliveryWorkspace {
  // Implement by creating one map keyed by session/order id.
  // 1. Seed from orders.
  // 2. Merge sessions over matching orders.
  // 3. Add session-only rows.
  // 4. For each row, resolve messages/assets/status.
  // 5. Sort active waiting/in-progress first, then newest activity.
}

export function selectWorkspaceOrder(
  workspace: DeliveryWorkspace,
  selectedId: string | null | undefined,
): WorkspaceOrder | null {
  const target = selectedId?.trim()
  if (target) {
    const match = workspace.orders.find((order) => order.id === target)
    if (match) return match
  }
  return workspace.orders[0] ?? null
}
```

Implementation notes:

- Use `buildSessionId()` for both order and session ids so existing IndexedDB keys stay valid.
- Keep `sessionId` and `sessionKey` separate:
  - `sessionId` is the IndexedDB id built by `buildSessionId({ walletGlobalMetaId, providerGlobalMetaId, orderCorrelationId })`, currently shaped like `wallet:provider:order`.
  - `sessionKey` is the UI/grouping key built by `buildSessionKey(providerGlobalMetaId, orderCorrelationId)`, currently shaped like `provider[:order]`.
  - Use `sessionId` for `assetsBySession`, persisted sessions, DB lookups, and `?order=` ids.
  - Use `sessionKey` only for `messagesForSession()` / legacy `?session=` compatibility / composer adapter compatibility.
- Prefer session status if a session exists, because provider messages/assets are fresher than local order creation state.
- Use `deriveSessionStatus(messages, walletGlobalMetaId)` only when messages exist and the persisted session/order status is missing or stale.
- Normalize existing `BuyerOrderStatus`, persisted `DeliverySessionRecord.status`, and derived message status into the `WorkspaceOrderStatus` union above. Do not create new persisted status enum values in this task.
- `priceLabel` should be empty for free orders when `price` is `0`, otherwise `${price} ${currency}`.
- `paymentReference` should prefer `paymentTxid`, then `paymentCommitTxid`, then `orderReference`, then `orderPinId`.
- For session-only rows, `requestSummary` can be the first outgoing order text, the session service label, or a short fallback like `Delivery request`.

- [ ] **Step 3: Write workspace recovery tests**

Create `tests/delivery/workspaceRecovery.test.ts` using the existing fake IndexedDB setup style from `tests/delivery/db.test.ts` and `tests/delivery/messageStore.test.ts`.

Required tests:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { getOrdersForWallet, getSessionsForWallet, putOrder, putSession, putAsset } from '@/delivery/db'
import { loadDeliveryWorkspaceRecords } from '@/delivery/workspaceRecovery'
```

Test cases:

- order-only row: `putOrder()` then `loadDeliveryWorkspaceRecords(SELF)` returns that order and no sessions/assets.
- session-only row: `putSession()` then loader returns that session even without an order.
- assets without live messages: `putSession()` + `putAsset()` returns `assetsBySession[session.id]`.
- selected order reload contract: build a workspace from loaded records and `selectWorkspaceOrder(workspace, orderId)` finds the same row.

Expected before implementation: fails because `workspaceRecovery.ts` does not exist.

- [ ] **Step 4: Implement `workspaceRecovery.ts`**

Create `src/delivery/workspaceRecovery.ts`:

```ts
import {
  getAssetsForSession,
  getOrdersForWallet,
  getSessionsForWallet,
} from '@/delivery/db'
import type {
  BuyerOrder,
  DeliveryAssetRecord,
  DeliverySessionRecord,
} from '@/delivery/domain'

export interface DeliveryWorkspaceRecords {
  orders: BuyerOrder[]
  sessions: DeliverySessionRecord[]
  assetsBySession: Record<string, DeliveryAssetRecord[]>
}

export async function loadDeliveryWorkspaceRecords(
  walletGlobalMetaId: string,
): Promise<DeliveryWorkspaceRecords> {
  const wallet = walletGlobalMetaId.trim()
  if (!wallet) return { orders: [], sessions: [], assetsBySession: {} }

  const [orders, sessions] = await Promise.all([
    getOrdersForWallet(wallet),
    getSessionsForWallet(wallet),
  ])
  const assetGroups = await Promise.all(
    sessions.map(async (session) => [session.id, await getAssetsForSession(session.id)] as const),
  )
  return {
    orders,
    sessions,
    assetsBySession: Object.fromEntries(assetGroups.filter(([, assets]) => assets.length > 0)),
  }
}
```

This is intentionally small. Do not duplicate workspace derivation here.

- [ ] **Step 5: Run focused tests**

```bash
pnpm test -- tests/delivery/workspace.test.ts tests/delivery/workspaceRecovery.test.ts tests/delivery/sessionDisplay.test.ts tests/delivery/sessionGrouping.test.ts tests/delivery/db.test.ts
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/delivery/workspace.ts tests/delivery/workspace.test.ts src/delivery/workspaceRecovery.ts tests/delivery/workspaceRecovery.test.ts src/delivery/sessionDisplay.ts
git commit -m "feat: derive delivery workspace orders"
```

After committing, post an Eric development journal with `metabot-post-buzz`.

### Task 2: Add Sync And Recovery UI State

**Files:**

- Create: `src/delivery/syncStatusStore.ts`
- Create: `tests/delivery/syncStatusStore.test.ts`
- Modify: `src/components/WalletHydrator.tsx`
- Modify: `tests/components/WalletHydrator.test.tsx` if it exists; otherwise add coverage in `tests/components/delivery/DeliveryPage.test.tsx`

- [ ] **Step 1: Write store tests**

Create `tests/delivery/syncStatusStore.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDeliverySyncStatusStore } from '@/delivery/syncStatusStore'

describe('delivery sync status store', () => {
  beforeEach(() => {
    useDeliverySyncStatusStore.getState().reset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('tracks hydration, syncing, ready, and last synced timestamp', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1000)
    useDeliverySyncStatusStore.getState().startHydrating('idqbuyer')
    expect(useDeliverySyncStatusStore.getState()).toMatchObject({
      walletGlobalMetaId: 'idqbuyer',
      status: 'hydrating',
      failedPeerCount: 0,
    })

    useDeliverySyncStatusStore.getState().startSyncing()
    expect(useDeliverySyncStatusStore.getState().status).toBe('syncing')

    useDeliverySyncStatusStore.getState().finishSync({ failedPeerCount: 0 })
    expect(useDeliverySyncStatusStore.getState()).toMatchObject({
      status: 'ready',
      lastSyncedAt: 1000,
      failedPeerCount: 0,
    })
  })

  it('keeps cached delivery usable when history sync is partial', () => {
    useDeliverySyncStatusStore.getState().startHydrating('idqbuyer')
    useDeliverySyncStatusStore.getState().startSyncing()
    useDeliverySyncStatusStore.getState().finishSync({ failedPeerCount: 2 })

    expect(useDeliverySyncStatusStore.getState()).toMatchObject({
      status: 'partial',
      failedPeerCount: 2,
    })
  })

  it('records unrecoverable sync errors without clearing the wallet id', () => {
    useDeliverySyncStatusStore.getState().startHydrating('idqbuyer')
    useDeliverySyncStatusStore.getState().failSync(new Error('network down'))

    expect(useDeliverySyncStatusStore.getState()).toMatchObject({
      walletGlobalMetaId: 'idqbuyer',
      status: 'error',
      errorMessage: 'network down',
    })
  })
})
```

- [ ] **Step 2: Implement the store**

Create `src/delivery/syncStatusStore.ts`:

```ts
import { create } from 'zustand'

export type DeliverySyncUiStatus =
  | 'idle'
  | 'hydrating'
  | 'syncing'
  | 'ready'
  | 'partial'
  | 'error'

interface DeliverySyncStatusState {
  walletGlobalMetaId: string | null
  status: DeliverySyncUiStatus
  failedPeerCount: number
  errorMessage: string | null
  lastSyncedAt: number | null
  startHydrating: (walletGlobalMetaId: string) => void
  startSyncing: () => void
  finishSync: (input: { failedPeerCount: number }) => void
  failSync: (error: unknown) => void
  reset: () => void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Delivery sync failed')
}

export const useDeliverySyncStatusStore = create<DeliverySyncStatusState>()((set, get) => ({
  walletGlobalMetaId: null,
  status: 'idle',
  failedPeerCount: 0,
  errorMessage: null,
  lastSyncedAt: null,
  startHydrating: (walletGlobalMetaId) =>
    set({
      walletGlobalMetaId: walletGlobalMetaId.trim() || null,
      status: 'hydrating',
      failedPeerCount: 0,
      errorMessage: null,
    }),
  startSyncing: () => set({ status: 'syncing', errorMessage: null }),
  finishSync: ({ failedPeerCount }) =>
    set({
      status: failedPeerCount > 0 ? 'partial' : 'ready',
      failedPeerCount,
      errorMessage: null,
      lastSyncedAt: Date.now(),
    }),
  failSync: (error) =>
    set({
      status: 'error',
      errorMessage: errorMessage(error),
    }),
  reset: () =>
    set({
      walletGlobalMetaId: null,
      status: 'idle',
      failedPeerCount: 0,
      errorMessage: null,
      lastSyncedAt: null,
    }),
}))
```

- [ ] **Step 3: Wire the store into `WalletHydrator`**

Modify `src/components/WalletHydrator.tsx`:

- Call `startHydrating(gmid)` before `hydrateDeliveryForWallet()`.
- Call `startSyncing()` before `syncKnownPrivateChatHistory()`.
- Call `finishSync({ failedPeerCount: summary.failedPeers.length })` when history sync resolves.
- Call `failSync(error)` when hydration or history sync throws.
- Call `reset()` when wallet disconnects.

Important:

- Do not block socket connection on sync UI state.
- Do not clear cached Delivery rows when sync fails.
- Keep existing `console.warn` statements or replace them with equivalent warnings; do not swallow evidence.

- [ ] **Step 4: Add a DeliveryPage test for sync state rendering placeholder**

If `WalletHydrator` has no test harness, add a small route-level test later in Task 3 after the page consumes this store. Do not overbuild test plumbing here.

- [ ] **Step 5: Run tests**

```bash
pnpm test -- tests/delivery/syncStatusStore.test.ts tests/components/delivery/DeliveryPage.test.tsx tests/ws/useSocket.test.ts
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/delivery/syncStatusStore.ts tests/delivery/syncStatusStore.test.ts src/components/WalletHydrator.tsx tests/components/delivery/DeliveryPage.test.tsx
git commit -m "feat: track delivery sync status"
```

After committing, post an Eric development journal with `metabot-post-buzz`.

### Task 3: Replace Session List With Buyer Order List

**Files:**

- Create: `src/components/delivery/DeliveryOrderList.tsx`
- Create: `tests/components/delivery/DeliveryOrderList.test.tsx`
- Modify: `src/routes/Delivery.tsx`
- Modify: `tests/components/delivery/DeliveryPage.test.tsx`
- Modify: `src/i18n/zh-CN.ts`

- [ ] **Step 1: Write component tests**

Create `tests/components/delivery/DeliveryOrderList.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DeliveryOrderList } from '@/components/delivery/DeliveryOrderList'
import type { WorkspaceOrder } from '@/delivery/workspace'

function workspaceOrder(overrides: Partial<WorkspaceOrder> = {}): WorkspaceOrder {
  return {
    id: 'self:provider:order-1',
    sessionId: 'self:provider:order-1',
    sessionKey: 'idqprovider:order-1',
    providerGlobalMetaId: 'idqprovider',
    providerName: 'Render Bot',
    providerAvatarUrl: 'https://cdn.example/render.png',
    serviceId: 'svc-image',
    serviceLabel: 'Image Render',
    requestSummary: 'Make a hero image',
    rawRequest: 'Make a hero image',
    outputType: 'image',
    priceLabel: '',
    paymentReference: 'order-1',
    orderCorrelationId: 'order-1',
    status: 'waiting',
    assetCount: 0,
    messageCount: 1,
    unreadCount: 0,
    createdAt: 10,
    updatedAt: 10,
    lastActivityAt: 10,
    messages: [],
    assets: [],
    source: 'merged',
    ...overrides,
  }
}

describe('DeliveryOrderList', () => {
  it('renders buyer request cards instead of technical sessions', () => {
    render(
      <DeliveryOrderList
        orders={[workspaceOrder()]}
        selectedOrderId="self:provider:order-1"
        walletConnected
        syncStatus="ready"
        onSelectOrder={vi.fn()}
      />,
    )

    const list = screen.getByRole('list', { name: '我的请求' })
    expect(within(list).getByText('Image Render')).toBeInTheDocument()
    expect(within(list).getByText('Render Bot')).toBeInTheDocument()
    expect(within(list).getByText('Make a hero image')).toBeInTheDocument()
    expect(within(list).getByText('等待接单')).toBeInTheDocument()
    expect(screen.queryByText(/simplemsg|Socket.IO|Sessions/i)).not.toBeInTheDocument()
  })

  it('selects an order', async () => {
    const onSelectOrder = vi.fn()
    render(
      <DeliveryOrderList
        orders={[workspaceOrder()]}
        selectedOrderId={null}
        walletConnected
        syncStatus="ready"
        onSelectOrder={onSelectOrder}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /Image Render/ }))

    expect(onSelectOrder).toHaveBeenCalledWith('self:provider:order-1')
  })

  it('shows a recovery-oriented empty state when the wallet is connected but no orders exist', () => {
    render(
      <DeliveryOrderList
        orders={[]}
        selectedOrderId={null}
        walletConnected
        syncStatus="ready"
        onSelectOrder={vi.fn()}
      />,
    )

    expect(screen.getByText('还没有交付记录')).toBeInTheDocument()
    expect(screen.getByText('在 Bot Hub 下单后，交付进度和成果会保存在这里。')).toBeInTheDocument()
  })

  it('shows local cache while history sync is partial', () => {
    render(
      <DeliveryOrderList
        orders={[workspaceOrder()]}
        selectedOrderId="self:provider:order-1"
        walletConnected
        syncStatus="partial"
        failedPeerCount={2}
        onSelectOrder={vi.fn()}
      />,
    )

    expect(screen.getByText('已显示本地记录，2 个会话同步失败')).toBeInTheDocument()
  })
})
```

Expected before implementation: fails because component and Chinese strings do not exist.

- [ ] **Step 2: Implement `DeliveryOrderList`**

Create `src/components/delivery/DeliveryOrderList.tsx`.

Design requirements:

- Label the list as `我的请求`.
- Cards should be compact and scannable:
  - provider avatar/name
  - service name
  - one-line request summary
  - buyer-facing status pill
  - asset count
  - last activity time
- Do not include terms `session`, `simplemsg`, `Socket.IO`, `metaso-p2p`, or `chat key`.
- Keep dimensions stable; long service/request text must truncate rather than resize the layout.
- Use existing `PeerAvatar`.
- Use existing `t()` keys, not hard-coded production copy, except test helper text.
- Avoid dynamic `t(\`...\`)` calls if TypeScript cannot prove the key union. A small status-label map in the component or `workspace.ts` is acceptable and easier to type.

Suggested status copy:

```ts
const STATUS_LABELS: Record<WorkspaceOrderStatus, I18nKey> = {
  sending: 'delivery.workspace.status.sending',
  waiting: 'delivery.workspace.status.waiting',
  active: 'delivery.workspace.status.active',
  delivering: 'delivery.workspace.status.delivering',
  delivered: 'delivery.workspace.status.delivered',
  completed: 'delivery.workspace.status.completed',
  failed: 'delivery.workspace.status.failed',
  failed_to_send: 'delivery.workspace.status.failed_to_send',
}
```

Add matching keys in `src/i18n/zh-CN.ts`.

- [ ] **Step 3: Integrate workspace model into `DeliveryPage`**

Modify `src/routes/Delivery.tsx`:

- Load persisted records with `loadDeliveryWorkspaceRecords(selfGlobalMetaId)`.
- Keep this state local to the route, for example:

```ts
const [workspaceRecords, setWorkspaceRecords] = useState<DeliveryWorkspaceRecords>({
  orders: [],
  sessions: [],
  assetsBySession: {},
})
```

- Refresh `workspaceRecords` after the initial `hydrateFromDb()` promise resolves and whenever the connected wallet changes. If live socket messages update in-memory `byPeer` before persisted records refresh, `workspace.ts` must still derive the visible status/assets from current messages and merged asset maps.
- Merge stored assets from `workspaceRecords.assetsBySession` with `useMessageStore().assetsBySession` before calling the selector.
- Use `buildDeliveryWorkspace({ walletGlobalMetaId, orders: workspaceRecords.orders, sessions: workspaceRecords.sessions, byPeer, assetsBySession: mergedAssetsBySession })`.
- Replace `selectedSession` URL param with `order` URL param:

```ts
const ORDER_PARAM = 'order'
```

- Keep backward compatibility:
  - If the URL has old `session`, map it to an order id once and replace the URL with `order`.
  - Tests should prove old links do not break.
- `selectedWorkspaceOrder` should drive:
  - header
  - timeline/messages
  - asset library
  - composer session data

- Preserve the repaired profile/decrypt behavior from the previous plan:
  - visible workspace orders still trigger provider profile hydration when name/avatar/provider key is missing
  - selected `?order=` still triggers decrypt retry for ciphertext messages once the fetched provider chat key is available
  - provider profile fallback still flows into message bubbles, order list, header, timeline, and composer
  - follow-up sending uses the resolved provider chat key from order, session, message, or fetched profile
  - no standard private simplemsg path should call ECIES

Do not remove the old `SessionsList` file in this task. It may still be useful in tests or later cleanup. Deletions should wait for explicit user approval before commit if they are not necessary.

- [ ] **Step 4: Add route-level tests**

Update `tests/components/delivery/DeliveryPage.test.tsx` to prove:

- connected buyer with order-only IndexedDB row sees it in the order list
- selected `?order=` is preserved after refresh
- legacy `?session=` redirects or resolves to the same selection
- normal page copy does not show `Private simplemsg sessions delivered over metaso-p2p Socket.IO.`
- selected `?order=` whose provider profile lacks display fields calls `fetchUserProfileByGlobalMetaId()` and renders the returned provider name/avatar
- selected `?order=` with encrypted provider message calls `retryDecryptPeerMessages()` after provider profile returns a chat key
- visible non-selected orders with missing provider names/avatars are hydrated conservatively, preserving the existing request-storm guard
- order-only workspace row with provider chat key keeps the composer enabled when wallet is connected

- [ ] **Step 5: Run tests**

```bash
pnpm test -- tests/delivery/workspace.test.ts tests/components/delivery/DeliveryOrderList.test.tsx tests/components/delivery/DeliveryPage.test.tsx
pnpm typecheck
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/delivery/DeliveryOrderList.tsx tests/components/delivery/DeliveryOrderList.test.tsx src/routes/Delivery.tsx tests/components/delivery/DeliveryPage.test.tsx src/i18n/zh-CN.ts
git commit -m "feat: show delivery orders workspace"
```

After committing, post an Eric development journal with `metabot-post-buzz`.

### Task 4: Add Selected Order Header And Progress Timeline

**Files:**

- Create: `src/components/delivery/DeliveryWorkspaceHeader.tsx`
- Create: `tests/components/delivery/DeliveryWorkspaceHeader.test.tsx`
- Create: `src/components/delivery/DeliveryStatusTimeline.tsx`
- Create: `tests/components/delivery/DeliveryStatusTimeline.test.tsx`
- Modify: `src/routes/Delivery.tsx`
- Modify: `src/components/delivery/DeliveryComposer.tsx`
- Modify: `tests/components/delivery/DeliveryComposer.test.tsx`
- Modify: `src/delivery/messageStore.ts`
- Modify: `tests/delivery/messageStore.test.ts`
- Modify: `src/components/delivery/MessageBubble.tsx` only if timeline needs shared rendering
- Modify: `src/i18n/zh-CN.ts`

- [ ] **Step 1: Write header tests**

Create `tests/components/delivery/DeliveryWorkspaceHeader.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DeliveryWorkspaceHeader } from '@/components/delivery/DeliveryWorkspaceHeader'
import type { WorkspaceOrder } from '@/delivery/workspace'

function order(overrides: Partial<WorkspaceOrder> = {}): WorkspaceOrder {
  return {
    id: 'self:provider:order-1',
    sessionId: 'self:provider:order-1',
    sessionKey: 'idqprovider:order-1',
    providerGlobalMetaId: 'idqprovider',
    providerName: 'Render Bot',
    providerAvatarUrl: 'https://cdn.example/render.png',
    serviceLabel: 'Image Render',
    requestSummary: 'Make a product hero image',
    rawRequest: 'Make a product hero image',
    priceLabel: '10 SPACE',
    paymentReference: 'txid-1',
    orderCorrelationId: 'order-1',
    status: 'delivered',
    assetCount: 2,
    messageCount: 4,
    unreadCount: 0,
    createdAt: 1000,
    updatedAt: 2000,
    lastActivityAt: 3000,
    messages: [],
    assets: [],
    source: 'merged',
    ...overrides,
  }
}

describe('DeliveryWorkspaceHeader', () => {
  it('summarizes selected order for a buyer', () => {
    render(<DeliveryWorkspaceHeader order={order()} />)

    expect(screen.getByText('Image Render')).toBeInTheDocument()
    expect(screen.getByText('Render Bot')).toBeInTheDocument()
    expect(screen.getByText('Make a product hero image')).toBeInTheDocument()
    expect(screen.getByText('已交付')).toBeInTheDocument()
    expect(screen.getByText('2 个成果')).toBeInTheDocument()
    expect(screen.getByText('10 SPACE')).toBeInTheDocument()
  })

  it('keeps refund and rating as reserved non-actions for now', () => {
    render(<DeliveryWorkspaceHeader order={order({ status: 'completed' })} />)

    expect(screen.getByText('评价')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('退款')).toHaveAttribute('aria-disabled', 'true')
  })

  it('renders a useful empty state', () => {
    render(<DeliveryWorkspaceHeader order={null} />)

    expect(screen.getByText('选择一个请求查看交付进度')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Implement `DeliveryWorkspaceHeader`**

Implementation notes:

- Use `PeerAvatar`.
- Present the selected order as the workspace context, not a chat recipient.
- Include reserved refund/rating buttons as disabled controls only when an order exists.
- Do not wire real refund/rating behavior.
- Keep button labels short and disabled state visually quiet.

- [ ] **Step 3: Write timeline tests**

Create `tests/components/delivery/DeliveryStatusTimeline.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DeliveryStatusTimeline } from '@/components/delivery/DeliveryStatusTimeline'
import type { DeliveryMessage } from '@/delivery/messageStore'
import type { WorkspaceOrder } from '@/delivery/workspace'

function message(overrides: Partial<DeliveryMessage> = {}): DeliveryMessage {
  return {
    id: 'order-message',
    peerGlobalMetaId: 'idqprovider',
    fromGlobalMetaId: 'idqbuyer',
    toGlobalMetaId: 'idqprovider',
    content: '[ORDER] Make image',
    rawContent: '[ORDER] Make image',
    encryption: 'plain',
    contentType: 'text/plain',
    orderCorrelationId: 'order-1',
    timestamp: 1000,
    ...overrides,
  }
}

function order(overrides: Partial<WorkspaceOrder> = {}): WorkspaceOrder {
  return {
    id: 'self:provider:order-1',
    sessionId: 'self:provider:order-1',
    sessionKey: 'idqprovider:order-1',
    providerGlobalMetaId: 'idqprovider',
    serviceLabel: 'Image Render',
    requestSummary: 'Make image',
    orderCorrelationId: 'order-1',
    status: 'delivered',
    assetCount: 1,
    messageCount: 3,
    unreadCount: 0,
    createdAt: 1000,
    updatedAt: 2000,
    lastActivityAt: 3000,
    messages: [
      message(),
      message({
        id: 'status-1',
        fromGlobalMetaId: 'idqprovider',
        toGlobalMetaId: 'idqbuyer',
        content: '[STATUS:order-1] Provider started',
        timestamp: 2000,
      }),
      message({
        id: 'delivery-1',
        fromGlobalMetaId: 'idqprovider',
        toGlobalMetaId: 'idqbuyer',
        content: '[DELIVERY:order-1] Ready metafile://image.png',
        timestamp: 3000,
      }),
    ],
    assets: [],
    source: 'merged',
    ...overrides,
  }
}

describe('DeliveryStatusTimeline', () => {
  it('renders buyer-readable progress milestones', () => {
    render(<DeliveryStatusTimeline order={order()} selfGlobalMetaId="idqbuyer" />)

    expect(screen.getByText('请求已发送')).toBeInTheDocument()
    expect(screen.getByText('服务处理中')).toBeInTheDocument()
    expect(screen.getByText('成果已交付')).toBeInTheDocument()
    expect(screen.queryByText(/simplemsg|ciphertext|chat key/i)).not.toBeInTheDocument()
  })

  it('keeps technical decrypt details behind explicit diagnostics', () => {
    render(
      <DeliveryStatusTimeline
        order={order({
          status: 'active',
          messages: [
            message({
              id: 'failed',
              fromGlobalMetaId: 'idqprovider',
              content: 'U2FsdGVkX1cipher',
              rawContent: 'U2FsdGVkX1cipher',
              encryption: 'ecdh',
              decryptError: 'missing peer key',
            }),
          ],
        })}
        selfGlobalMetaId="idqbuyer"
      />,
    )

    const alert = screen.getByRole('status', { name: '交付记录需要同步' })
    expect(within(alert).getByText('有消息暂时无法解密，已保留原始记录。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看技术细节' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Implement `DeliveryStatusTimeline`**

Implementation notes:

- Build a short milestone list from `order.status`, `order.messages`, and `order.assets`.
- Show at most the key milestones first:
  - request sent
  - provider acknowledged/started when a provider text/status exists
  - delivery received when assets or delivery protocol exists
  - completed/needs attention when applicable
- Include a collapsible "消息记录" section below the timeline using existing `MessageBubble` for detailed chat history.
- Keep follow-up composer below the timeline, not inside the timeline component.
- The normal timeline should hide raw ciphertext and implementation terms.

- [ ] **Step 5: Integrate header/timeline into `DeliveryPage`**

Modify `src/routes/Delivery.tsx`:

- Replace `SessionHeader` with `DeliveryWorkspaceHeader`.
- Replace `MessageList` with `DeliveryStatusTimeline`.
- Keep old components available for tests until cleanup is explicitly requested.
- Preserve `DeliveryComposer` behavior and pass a session-compatible adapter derived from selected `WorkspaceOrder`.

- [ ] **Step 6: Define safe composer reply-pin behavior for order-only rows**

Before integrating the adapter, update `tests/components/delivery/DeliveryComposer.test.tsx`:

```tsx
it('sends a follow-up from an order-only session without inventing a reply pin', async () => {
  // Build a session-like object whose lastMessage is undefined/null.
  // Mock sendDeliveryFollowUp and assert replyPin is undefined.
  // Assert the composer is enabled when wallet, providerGlobalMetaId, and providerChatPubkey exist.
})
```

Then modify `DeliveryComposer` props so it uses a purpose-built minimal input type instead of `EnrichedDeliverySession`:

```ts
import type { DeliveryMessage } from '@/delivery/messageStore'

export interface ComposerSessionInput {
  sessionKey: string
  peerGlobalMetaId: string
  providerChatPubkey?: string
  peerName?: string
  peerAvatarUrl?: string
  orderCorrelationId: string | null
  serviceLabel: string | null
  lastMessage?: DeliveryMessage
}
```

`DeliveryComposer` should not require `status`, `assetCount`, or `messageCount`. Those belong to workspace display components, not follow-up sending.

Also update the message-store boundary so the composer does not need to fake a `DeliverySession`:

```ts
export interface FollowUpSessionInput {
  sessionKey: string
  peerGlobalMetaId: string
  providerChatPubkey?: string
  peerName?: string
  peerAvatarUrl?: string
  orderCorrelationId: string | null
  serviceLabel: string | null
}
```

Then change:

```ts
appendOutgoingFollowUp: (input: {
  wallet: WalletIdentity
  session: FollowUpSessionInput
  content: string
  rawContent: string
  pinId: string
}) => Promise<void>
```

`appendOutgoingFollowUp()` currently only needs these fields. Do not keep `session: DeliverySession` if `DeliverySession.lastMessage` remains required.

Use:

```ts
replyPin: session.lastMessage?.pinId,
```

Do not create a synthetic/fake pin id for order-only rows. If no previous pin exists, follow-up should still create a normal private simplemsg without `replyPin`.

- [ ] **Step 7: Integrate header/timeline into `DeliveryPage`**

Suggested adapter:

```ts
const composerSession = selectedOrder
  ? {
      sessionKey: selectedOrder.sessionKey,
      peerGlobalMetaId: selectedOrder.providerGlobalMetaId,
      providerChatPubkey: selectedOrder.providerChatPubkey,
      peerName: selectedOrder.providerName,
      peerAvatarUrl: selectedOrder.providerAvatarUrl,
      orderCorrelationId: selectedOrder.orderCorrelationId,
      serviceLabel: selectedOrder.serviceLabel,
      lastMessage: selectedOrder.messages[selectedOrder.messages.length - 1],
    }
  : null
```

Do not duplicate persisted message creation logic.

- [ ] **Step 8: Add integration regressions for parity preservation**

Extend `tests/components/delivery/DeliveryPage.test.tsx` to prove after the order-workspace migration:

- fetched provider profile populates `DeliveryWorkspaceHeader`, `DeliveryOrderList`, and `DeliveryComposer`
- decrypt retry still runs for the selected order when the selected order has encrypted messages and the fetched profile returns `chatPubkey`
- follow-up sending uses the provider chat key resolved from fetched profile when the persisted order/session lacks it
- no ECIES wallet method is invoked for standard simplemsg decrypt/follow-up paths

- [ ] **Step 9: Run tests**

```bash
pnpm test -- tests/components/delivery/DeliveryWorkspaceHeader.test.tsx tests/components/delivery/DeliveryStatusTimeline.test.tsx tests/components/delivery/DeliveryPage.test.tsx tests/components/delivery/MessageBubble.test.tsx tests/components/delivery/DeliveryComposer.test.tsx tests/delivery/decryptRetry.test.ts tests/delivery/sendMessage.test.ts tests/delivery/messageStore.test.ts
```

Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add src/components/delivery/DeliveryWorkspaceHeader.tsx tests/components/delivery/DeliveryWorkspaceHeader.test.tsx src/components/delivery/DeliveryStatusTimeline.tsx tests/components/delivery/DeliveryStatusTimeline.test.tsx src/components/delivery/DeliveryComposer.tsx tests/components/delivery/DeliveryComposer.test.tsx src/delivery/messageStore.ts tests/delivery/messageStore.test.ts src/routes/Delivery.tsx tests/components/delivery/DeliveryPage.test.tsx src/i18n/zh-CN.ts
git commit -m "feat: add delivery order timeline"
```

After committing, post an Eric development journal with `metabot-post-buzz`.

### Task 5: Build The Delivery Asset Library

**Files:**

- Create: `src/components/delivery/DeliveryAssetLibrary.tsx`
- Create: `src/components/delivery/AssetPreviewDialog.tsx`
- Create: `tests/components/delivery/DeliveryAssetLibrary.test.tsx`
- Create: `tests/components/delivery/AssetPreviewDialog.test.tsx`
- Modify: `src/components/delivery/AssetPreviewCard.tsx`
- Modify: `tests/components/delivery/AssetPreviewCard.test.tsx`
- Modify: `src/routes/Delivery.tsx`
- Modify: `src/i18n/zh-CN.ts`

- [ ] **Step 1: Write asset library tests**

Create `tests/components/delivery/DeliveryAssetLibrary.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DeliveryAssetLibrary } from '@/components/delivery/DeliveryAssetLibrary'
import type { ParsedDeliveryAsset } from '@/delivery/assetParser'

function asset(overrides: Partial<ParsedDeliveryAsset> = {}): ParsedDeliveryAsset {
  const kind = overrides.kind ?? 'image'
  const extension = overrides.extension ?? '.png'
  const filename = overrides.filename ?? `asset${extension}`
  return {
    uri: `metafile://asset${extension}`,
    pinId: `asset-${kind}`,
    extension,
    filename,
    kind,
    mimeType: overrides.mimeType,
    previewUrl: `https://preview.example/${filename}`,
    downloadUrl: `https://download.example/${filename}`,
    fallbackUrl: `https://fallback.example/${filename}`,
    ...overrides,
  }
}

describe('DeliveryAssetLibrary', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('groups and filters delivered assets', async () => {
    render(
      <DeliveryAssetLibrary
        assets={[
          asset({ kind: 'image', filename: 'image.png', extension: '.png' }),
          asset({ kind: 'video', filename: 'clip.mp4', extension: '.mp4' }),
          asset({ kind: 'document', filename: 'brief.pdf', extension: '.pdf' }),
        ]}
      />,
    )

    expect(screen.getByText('3 个成果')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '图片 1' }))

    expect(screen.getByText('image.png')).toBeInTheDocument()
    expect(screen.queryByText('clip.mp4')).not.toBeInTheDocument()
    expect(screen.queryByText('brief.pdf')).not.toBeInTheDocument()
  })

  it('copies one link and all links', async () => {
    render(
      <DeliveryAssetLibrary
        assets={[
          asset({ filename: 'image.png', downloadUrl: 'https://download.example/image.png' }),
          asset({ kind: 'audio', filename: 'voice.mp3', extension: '.mp3', downloadUrl: 'https://download.example/voice.mp3' }),
        ]}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: '复制全部链接' }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://download.example/image.png\nhttps://download.example/voice.mp3',
    )

    const imageCard = screen.getByRole('article', { name: 'image.png' })
    await userEvent.click(within(imageCard).getByRole('button', { name: '复制链接' }))
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith('https://download.example/image.png')
  })

  it('does not crash when clipboard is unavailable or rejects', async () => {
    Object.assign(navigator, { clipboard: undefined })
    render(<DeliveryAssetLibrary assets={[asset({ filename: 'image.png' })]} />)

    await userEvent.click(screen.getByRole('button', { name: '复制全部链接' }))

    expect(screen.getByText('复制失败，请手动打开链接。')).toBeInTheDocument()
  })

  it('opens an image preview dialog from a card', async () => {
    render(<DeliveryAssetLibrary assets={[asset({ filename: 'image.png' })]} />)

    await userEvent.click(screen.getByRole('button', { name: '预览 image.png' }))

    expect(screen.getByRole('dialog', { name: 'image.png' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'image.png' })).toBeInTheDocument()
  })

  it('shows a buyer-facing empty state', () => {
    render(<DeliveryAssetLibrary assets={[]} />)

    expect(screen.getByText('还没有收到成果')).toBeInTheDocument()
    expect(screen.getByText('Provider 完成交付后，图片、视频、音频和附件会显示在这里。')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Write preview dialog tests**

Create `tests/components/delivery/AssetPreviewDialog.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AssetPreviewDialog } from '@/components/delivery/AssetPreviewDialog'
import type { ParsedDeliveryAsset } from '@/delivery/assetParser'

const imageAsset: ParsedDeliveryAsset = {
  uri: 'metafile://image.png',
  pinId: 'image',
  extension: '.png',
  filename: 'image.png',
  kind: 'image',
  mimeType: 'image/png',
  previewUrl: 'https://preview.example/image.png',
  downloadUrl: 'https://download.example/image.png',
  fallbackUrl: 'https://fallback.example/image.png',
}

describe('AssetPreviewDialog', () => {
  it('renders image preview and actions', () => {
    render(<AssetPreviewDialog asset={imageAsset} open onClose={vi.fn()} />)

    expect(screen.getByRole('dialog', { name: 'image.png' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'image.png' })).toHaveAttribute(
      'src',
      'https://preview.example/image.png',
    )
    expect(screen.getByRole('link', { name: '下载' })).toHaveAttribute(
      'href',
      'https://download.example/image.png',
    )
  })

  it('closes with the close button', async () => {
    const onClose = vi.fn()
    render(<AssetPreviewDialog asset={imageAsset} open onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: '关闭预览' }))

    expect(onClose).toHaveBeenCalled()
  })

  it('renders nothing when closed', () => {
    render(<AssetPreviewDialog asset={imageAsset} open={false} onClose={vi.fn()} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Extend `AssetPreviewCard` without breaking existing callers**

Modify `src/components/delivery/AssetPreviewCard.tsx`:

- Add optional props:

```ts
interface AssetPreviewCardProps {
  asset: Asset
  mode?: 'compact' | 'full'
  onPreview?: (asset: Asset) => void
  onCopyLink?: (asset: Asset) => void
}
```

- Keep existing default behavior when only `asset` is passed.
- Add `aria-label` to each article using the filename.
- Add optional buttons:
  - `预览 <filename>`
  - `复制链接`
  - existing download link
- Use existing media fallback behavior.

- [ ] **Step 4: Implement `DeliveryAssetLibrary`**

Requirements:

- Show asset count and kind filters.
- Default filter is all.
- Filters:
  - all
  - image
  - video
  - audio
  - document
  - archive
  - other
- Hide filters with zero count except `全部`.
- Copy all links writes newline-separated download URLs to clipboard.
- Copy single link writes the selected asset download URL.
- If `navigator.clipboard` is unavailable, show a small inline failure text. Do not throw.
- If `navigator.clipboard.writeText()` rejects, show the same inline failure text and keep the assets usable.
- Open preview dialog for previewable assets. For non-previewable assets, dialog can show file metadata and download/open actions.

- [ ] **Step 5: Replace old assets panel in `DeliveryPage`**

Modify `src/routes/Delivery.tsx`:

- Replace `DeliveredAssetsPanel` with `DeliveryAssetLibrary`.
- Pass `selectedOrder.assets`.
- Keep `DeliveredAssetsPanel` file for backward compatibility unless explicit cleanup is requested.

- [ ] **Step 6: Run tests**

```bash
pnpm test -- tests/components/delivery/DeliveryAssetLibrary.test.tsx tests/components/delivery/AssetPreviewDialog.test.tsx tests/components/delivery/AssetPreviewCard.test.tsx tests/components/delivery/DeliveryPage.test.tsx tests/delivery/assetParser.test.ts tests/delivery/messageStore.test.ts
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/delivery/DeliveryAssetLibrary.tsx src/components/delivery/AssetPreviewDialog.tsx tests/components/delivery/DeliveryAssetLibrary.test.tsx tests/components/delivery/AssetPreviewDialog.test.tsx src/components/delivery/AssetPreviewCard.tsx tests/components/delivery/AssetPreviewCard.test.tsx src/routes/Delivery.tsx tests/components/delivery/DeliveryPage.test.tsx src/i18n/zh-CN.ts
git commit -m "feat: add delivery asset library"
```

After committing, post an Eric development journal with `metabot-post-buzz`.

### Task 6: Polish The Workspace Layout, Copy, And Mobile Flow

**Files:**

- Modify: `src/routes/Delivery.tsx`
- Modify: `src/components/delivery/DeliveryOrderList.tsx`
- Modify: `src/components/delivery/DeliveryWorkspaceHeader.tsx`
- Modify: `src/components/delivery/DeliveryStatusTimeline.tsx`
- Modify: `src/components/delivery/DeliveryAssetLibrary.tsx`
- Modify: `src/components/delivery/DeliveryComposer.tsx`
- Modify: `src/i18n/zh-CN.ts`
- Modify: component tests as needed

- [ ] **Step 1: Add product-copy regression tests**

In `tests/components/delivery/DeliveryPage.test.tsx`, add:

```ts
it('uses buyer-facing delivery copy instead of implementation copy', () => {
  render(<DeliveryPage />)

  expect(screen.getByRole('heading', { name: '我的交付' })).toBeInTheDocument()
  expect(screen.queryByText(/simplemsg|Socket.IO|metaso-p2p|chat key|ciphertext/i)).not.toBeInTheDocument()
})
```

Adjust the harness to connected or disconnected state depending on existing test setup.

- [ ] **Step 2: Update copy**

Update `src/i18n/zh-CN.ts` Delivery keys. Suggested copy:

```ts
delivery: {
  title: '我的交付',
  subtitle: '查看请求进度，预览和保存 Provider 交付的数字成果。',
  workspace: {
    orders: '我的请求',
    currentOrder: '当前请求',
    progress: '交付进度',
    assets: '成果库',
    messages: '消息记录',
    noOrdersTitle: '还没有交付记录',
    noOrdersHint: '在 Bot Hub 下单后，交付进度和成果会保存在这里。',
    noSelectedTitle: '选择一个请求查看交付进度',
    noSelectedHint: '左侧会显示你发起过的请求和最新状态。',
    syncHydrating: '正在恢复本地交付记录…',
    syncSyncing: '正在同步最新交付…',
    syncPartial: '已显示本地记录，{count} 个会话同步失败',
    syncError: '同步失败，本地记录仍可查看',
    status: {
      pending: '等待接单',
      sending: '发送中',
      waiting: '等待接单',
      active: '处理中',
      delivering: '交付中',
      delivered: '已交付',
      completed: '已完成',
      failed: '需要处理',
      failed_to_send: '发送失败',
    },
  },
}
```

The current `t()` helper does not support interpolation. Either:

- keep `syncPartialPrefix` / `syncPartialSuffix` keys, or
- build the count string in the component.

Do not introduce an i18n library for this task.

- [ ] **Step 3: Polish responsive layout**

Requirements:

- Desktop:
  - left column: order list
  - center column: selected order header + timeline + composer
  - right column: asset library
- Mobile:
  - order list appears first
  - selected order context follows
  - asset library must appear before long message log when assets exist
  - composer remains reachable without covering content
- Avoid nested cards. Use panels/dividers/full-height columns.
- Stable minimum heights:
  - order list cards should not jump when status text changes
  - asset cards should keep fixed aspect ratio
  - composer height should stay stable while disabled/sending

- [ ] **Step 4: Reduce debug affordances in normal states**

Keep decrypt-failed diagnostics, but move them behind explicit details:

- Normal buyer timeline should say `有消息暂时无法解密，已保留原始记录。`
- Details button can reveal technical pin/tx/decrypt text.
- Normal page should not show raw ciphertext unless the user opens details.

- [ ] **Step 5: Run visual and test checks**

```bash
pnpm test -- tests/components/delivery/DeliveryPage.test.tsx tests/components/delivery/DeliveryOrderList.test.tsx tests/components/delivery/DeliveryWorkspaceHeader.test.tsx tests/components/delivery/DeliveryStatusTimeline.test.tsx tests/components/delivery/DeliveryAssetLibrary.test.tsx tests/i18n/index.test.ts
pnpm typecheck
```

Then run the app and inspect desktop/mobile:

```bash
pnpm dev
```

Use Browser or Playwright screenshots at:

- desktop: `1280x720`
- mobile: `390x844`

Acceptance:

- no overlapping text
- no clipped buttons
- no implementation copy in normal states
- asset library is visible and useful

- [ ] **Step 6: Commit**

```bash
git add src/routes/Delivery.tsx src/components/delivery/DeliveryOrderList.tsx src/components/delivery/DeliveryWorkspaceHeader.tsx src/components/delivery/DeliveryStatusTimeline.tsx src/components/delivery/DeliveryAssetLibrary.tsx src/components/delivery/DeliveryComposer.tsx tests/components/delivery/DeliveryPage.test.tsx tests/components/delivery/DeliveryOrderList.test.tsx tests/components/delivery/DeliveryWorkspaceHeader.test.tsx tests/components/delivery/DeliveryStatusTimeline.test.tsx tests/components/delivery/DeliveryAssetLibrary.test.tsx tests/components/delivery/DeliveryComposer.test.tsx src/i18n/zh-CN.ts tests/i18n/index.test.ts
git commit -m "feat: polish delivery workspace ux"
```

After committing, post an Eric development journal with `metabot-post-buzz`.

### Task 7: Add Product-Level Persistence And Recovery Tests

**Files:**

- Modify: `tests/delivery/messageStore.test.ts`
- Modify: `tests/delivery/workspace.test.ts`
- Modify: `tests/components/delivery/DeliveryPage.test.tsx`
- Modify: `src/routes/Delivery.tsx`
- Modify: `src/delivery/workspace.ts`
- Modify: `src/delivery/messageStore.ts` only if tests reveal a real persistence gap

- [ ] **Step 1: Write recovery tests**

Add tests proving:

- order-only request is visible after wallet login and `getOrdersForWallet()`.
- delivered asset saved in IndexedDB is visible after `hydrateFromDb()` even when no live socket message arrives in that page session.
- if history sync fails, cached assets are still visible and an unobtrusive sync warning appears.
- selected order remains selected after page reload when URL has `?order=...`.

Use existing fake IndexedDB patterns from `tests/delivery/messageStore.test.ts` and `tests/components/delivery/DeliveryPage.test.tsx`.

- [ ] **Step 2: Fix only real gaps**

Likely fixes may include:

- `DeliveryPage` needs state for persisted `DeliverySessionRecord[]`, not just grouped in-memory sessions.
- `buildDeliveryWorkspace()` needs to use `assetsBySession` records even if no matching live message is in `byPeer`.
- `hydrateFromDb()` may need to preserve session metadata that currently only lives in IndexedDB.

Do not rewrite the whole store. Keep the smallest change that makes recovery work.

- [ ] **Step 3: Run persistence tests**

```bash
pnpm test -- tests/delivery/messageStore.test.ts tests/delivery/workspace.test.ts tests/components/delivery/DeliveryPage.test.tsx tests/delivery/db.test.ts
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add tests/delivery/messageStore.test.ts tests/delivery/workspace.test.ts tests/components/delivery/DeliveryPage.test.tsx src/routes/Delivery.tsx src/delivery/workspace.ts src/delivery/messageStore.ts
git commit -m "fix: restore delivery workspace from cache"
```

After committing, post an Eric development journal with `metabot-post-buzz`.

### Task 8: Real Chrome + Metalet Acceptance

**Files:**

- Create or modify only if evidence must be recorded:
  - `docs/superpowers/acceptance/2026-05-31-delivery-workspace-v1.md`
  - `/Users/tusm/Documents/MetaID_Projects/metaso-p2p/issues/YYYY-MM-DD-bothub-delivery-workspace-gap.md`

- [ ] **Step 1: Run automated gates**

```bash
pnpm test -- tests/delivery tests/components/delivery tests/ws/privateChat.test.ts tests/api/privateChat.test.ts tests/order/flow.test.ts
pnpm typecheck
pnpm build
git diff --check
```

Expected:

- tests pass
- typecheck passes
- build passes
- diff check has no output

- [ ] **Step 2: Confirm local metaso-p2p**

```bash
curl -s http://127.0.0.1:18091/healthz
```

Expected shape:

```json
{"code":0,"data":{"service":"metaso-p2p","status":"ok","version":"dev"}}
```

If the port changed, find the real listener with `lsof -nP -iTCP -sTCP:LISTEN | rg meta-sock`.

- [ ] **Step 3: Start BotHub dev server**

Use an available port:

```bash
pnpm dev -- --host 127.0.0.1 --port 5175
```

If 5175 is busy, use the next available port and record the URL.

- [ ] **Step 4: Use Chrome + Metalet for real acceptance**

Use `computer-use:computer-use` or Chrome automation with the user's authorization.

Required path:

1. Open BotHub local URL in Chrome.
2. Connect Metalet.
3. Confirm the header shows user avatar/name/globalMetaId enough to identify the logged-in wallet.
4. Choose a free service in Bot Hub.
5. Enter a real prompt in the request input.
6. Submit Pay & Request.
7. Approve Metalet confirmations as needed. The user has authorized wallet operations for this project, but if the automation cannot click a wallet dialog, ask the user to click the visible confirmation.
8. Confirm Delivery opens or can be opened manually.
9. Confirm the new request appears in `我的请求`.
10. Confirm selected order header shows provider/service/request/status.
11. Wait for provider reply or history sync.
12. Confirm provider/counterparty messages decrypt when the profile chat key is available.
13. If the provider delivers files, confirm assets appear in `成果库`.
14. Preview at least one image/video/audio/document when available.
15. Copy one asset link and all asset links.
16. Refresh the page.
17. Reconnect/hydrate if needed.
18. Confirm the order and assets are restored from IndexedDB.
19. Send a follow-up message from the composer.
20. Confirm the outgoing follow-up remains visible after refresh.

If no provider delivers assets during the test window:

- Do not fake product acceptance.
- Record that the order/progress/follow-up path passed but delivered-asset live acceptance is blocked on provider delivery.
- Keep component/IndexedDB asset tests as the asset rendering evidence.
- Then run the seeded IndexedDB asset acceptance fallback below so Chrome still exercises the new asset library UI.

- [ ] **Step 4b: Seed IndexedDB asset acceptance fallback when live delivery has no files**

This fallback is only for UI acceptance of the asset library. It must be labeled as seeded data in the acceptance notes and must not be used to claim provider live asset delivery passed.

In the browser devtools console, Playwright page context, or a small temporary script executed against the app origin, seed one selected wallet's local Delivery DB with:

- one `DeliverySessionRecord`
- one provider delivery `DeliveryMessageRecord`
- at least four `DeliveryAssetRecord`s:
  - image
  - video or audio
  - document
  - archive/other

Prefer calling the app's existing IndexedDB facade from page context if it is importable in the dev environment. If not, write directly to IndexedDB using the same DB/store names from `src/delivery/db.ts`:

```js
const dbName = 'bothub-buyer-v1'
const wallet = '<connected wallet globalMetaId>'
const provider = '<provider globalMetaId from the tested service or a clearly marked seeded provider>'
const sessionId = `${wallet}:${provider}:seeded-assets`
```

After seeding:

1. Refresh Delivery.
2. Select the seeded order/session.
3. Confirm `成果库` shows the seeded assets.
4. Filter to image and document.
5. Open the image preview dialog.
6. Copy one link and all links.
7. Refresh again and confirm the seeded assets restore from IndexedDB.

Acceptance notes must separate:

- `Live provider delivery`: passed / blocked
- `Seeded asset-library UI acceptance`: passed / failed

- [ ] **Step 5: Capture screenshots**

Capture:

- desktop Delivery workspace with selected order
- desktop asset library with at least one asset or the best available state
- mobile Delivery workspace
- mobile asset library/timeline

Use filenames:

```text
bothub-delivery-workspace-desktop.png
bothub-delivery-workspace-assets.png
bothub-delivery-workspace-mobile.png
```

Do not commit screenshots unless the user explicitly wants them committed.

- [ ] **Step 6: Record acceptance notes**

Create `docs/superpowers/acceptance/2026-05-31-delivery-workspace-v1.md` only after real acceptance is attempted.

Include:

- local URL
- wallet identity used, shortened
- service/provider used
- free or paid order
- confirmations clicked
- pass/fail checklist
- screenshots paths
- metaso-p2p issues filed, if any
- remaining blockers

- [ ] **Step 7: Commit acceptance notes if created**

```bash
git add docs/superpowers/acceptance/2026-05-31-delivery-workspace-v1.md
git commit -m "docs: record delivery workspace acceptance"
```

After committing, post an Eric development journal with `metabot-post-buzz`.

## 7. Verification Commands For The Whole Plan

Run these before claiming completion:

```bash
pnpm test -- tests/delivery tests/components/delivery tests/ws/privateChat.test.ts tests/api/privateChat.test.ts tests/order/flow.test.ts
pnpm typecheck
pnpm build
git diff --check
```

Also perform real Chrome + Metalet acceptance from Task 8.

## 8. Final Implementation Completion Criteria

The implementation is complete only when:

- All automated gates pass.
- Delivery page uses buyer-facing `我的交付` workspace copy.
- Order list shows order-only, session-only, and merged orders.
- Selected order header and timeline make status understandable without reading raw messages.
- Asset library supports filtering, preview, copy link, open/download, and empty states.
- IndexedDB restores previous orders/assets after refresh and login.
- Sync failures are visible but do not hide local cached deliveries.
- Follow-up composer still sends through the repaired private simplemsg ECDH path.
- Chrome + Metalet free-order acceptance is attempted and recorded.
- Any metaso-p2p gaps discovered during real testing are documented under `/Users/tusm/Documents/MetaID_Projects/metaso-p2p/issues/`.

## 9. Handoff Prompt For The Next Development Session

```text
请在 /Users/tusm/Documents/MetaID_Projects/bothub 的 main worktree 上执行 docs/superpowers/plans/2026-05-31-delivery-workspace-productization-v1.md。

开发模式：每个 task 用一个新的 subagent 实现；controller 负责验收。如果某个 task 不合格，让同一个 task 的 subagent 继续返工直到通过，不需要再为同一个 task 额外开 code-review subagent。每个 task 通过后按 AGENTS.md 小提交，并用 Eric 通过 metabot-post-buzz 发开发日记。

不要新开分支或 worktree。当前策略是 main 分支、主 worktree 单线推进。

优先目标：把 Delivery 从私聊日志改成买家视角的订单交付工作台。不要实现退款/评价/provider 侧功能，但 UI 架构要为后续退款和评价预留位置。最后必须用 Chrome + Metalet 做真实 free-order 验收；如果需要点钱包确认，用户已授权可以直接点，自动化点不了时再让用户人工点击。
```
