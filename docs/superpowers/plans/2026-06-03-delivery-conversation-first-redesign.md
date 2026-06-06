# Delivery Conversation-First Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Delivery so the left navigation is one long-running bot/provider conversation per peer, while order delivery remains available through read-only order tabs inside that conversation.

**Architecture:** Keep the current order/session/message/asset IndexedDB stores and add a derived conversation-first workspace model over them. Reuse the existing order-aware `buildDeliveryWorkspace()` logic internally for order thread derivation, then rewire the Delivery route and components so `All` is the default mixed timeline and order tabs are scoped read-only filters.

**Tech Stack:** Vite 5, React 18, TypeScript 5 strict, Tailwind CSS, zustand, IndexedDB, Vitest + Testing Library, Chrome + Metalet for final wallet-connected acceptance.

---

## Source Spec

Implement against:

```text
docs/superpowers/specs/2026-06-03-delivery-conversation-first-design.md
```

The product boundary is fixed:

- Left panel groups by bot/provider conversation, not order.
- `All` shows private chat and all delivery protocol messages in timestamp order.
- Order tabs are read-only filtered views.
- The composer renders only in `All`.
- Messages sent from `All` are ordinary private chat follow-ups with no order correlation.
- Explicit order correlation wins; unscoped protocol messages attach only when one active order is unambiguous; ambiguous multi-order messages remain only in `All`.
- New skill-service orders key by the `/protocols/skill-service-order` pin id
  (`orderPinId` or `serviceOrderPinId`). `paymentTxid` and legacy
  `orderReference` values are aliases/payment references only.
- Keep current IndexedDB stores; use additive selectors and compatibility only.

## Execution Rules

- Before implementation, run this branch preflight:

```bash
git status --short --branch
git switch codex/delivery-conversation-first || git switch -c codex/delivery-conversation-first
git status --short --branch
```

- Do not start implementation directly on `main`.
- Stop before implementation if `git status --short` shows unexpected tracked
  modifications. Pre-existing unrelated untracked files such as `.reasonix/`
  can remain untouched.
- Use one fresh subagent per task.
- Do not dispatch multiple implementation subagents at the same time; tasks touch overlapping Delivery files.
- After each task, run the task verification commands, commit only the files listed for that task, and post one Lisa Hahn development journal buzz for that commit.
- Commit messages use the repo format: `feat: ...`, `fix: ...`, `refactor: ...`, `docs: ...`, or `chore: ...`.
- Leave unrelated worktree changes such as `.reasonix/` untouched.

## File Map

Create:

- `src/delivery/conversationWorkspace.ts` - pure conversation-first selectors, tab selection, all/order message filtering, all/order asset filtering, and URL compatibility helpers.
- `tests/delivery/conversationWorkspace.test.ts` - selector unit coverage for one provider with many orders, `All` timeline, order tabs, ambiguous unscoped protocol messages, assets, aliases, and old links.
- `src/components/delivery/DeliveryConversationList.tsx` - provider conversation list replacing order rows in the left panel.
- `tests/components/delivery/DeliveryConversationList.test.tsx` - list rendering, empty states, selected provider behavior, sync banners.
- `src/components/delivery/DeliveryConversationHeader.tsx` - selected provider header with profile and aggregate counts.
- `tests/components/delivery/DeliveryConversationHeader.test.tsx` - provider summary and empty state tests.
- `src/components/delivery/DeliveryOrderTabs.tsx` - `All` plus read-only order tab controls.
- `tests/components/delivery/DeliveryOrderTabs.test.tsx` - tab labels, selection, counts, and no free-text composer inside tab component.

Modify:

- `src/order/payAndRequestStages.ts` - publish and use the
  `skill-service-order` pin id as the new order's canonical session key.
- `src/order/orderMessage.ts` - include the canonical order pin id in outbound
  order/request payloads when available.
- `src/delivery/orderStore.ts` - persist buyer orders, sessions, and messages
  with `orderPinId` as the canonical order correlation for new orders.
- `src/delivery/orderParser.ts` - parse `order pin id: <pinid>` and normalize
  explicit protocol ids to the order pin id when both ids are present.
- `src/delivery/protocol.ts` - expose protocol helpers for order pin id metadata
  if parser or message builders need one shared implementation point.
- `src/delivery/sessionGrouping.ts` - keep route/session compatibility aliases
  while preferring `orderPinId` for new grouped rows.
- `src/routes/Delivery.tsx` - select conversation and tab from URL, hydrate profiles by visible conversations, render the new hierarchy, and pass a null order correlation to the composer.
- `src/components/delivery/DeliveryWorkspaceHeader.tsx` - make it an order-tab summary surface that accepts `WorkspaceOrder | null` and a scoped title.
- `src/components/delivery/DeliveryStatusTimeline.tsx` - keep milestones for order tabs and support an `All` timeline mode that renders messages without order progress milestones.
- `src/components/delivery/DeliveryAssetLibrary.tsx` - add a scope label/count for `All` versus selected order.
- `src/components/delivery/DeliveryComposer.tsx` - keep current behavior but update disabled copy from "request" to conversation when route passes a provider conversation.
- `src/delivery/messageStore.ts` - keep compatibility APIs; adjust only if a test proves `appendOutgoingFollowUp` still writes an order correlation from an `All` send.
- `src/i18n/zh-CN.ts` - add buyer-facing conversation and tab labels.
- `tests/components/delivery/DeliveryPage.test.tsx` - update route integration expectations for provider left nav, tabs, `All` composer, order-tab no-composer, and old URL recovery.
- Existing component tests listed above - update only where prop types change.

## Data Types To Add

Task 1 owns these exact exported types in `src/delivery/conversationWorkspace.ts`:

```ts
import type { ParsedDeliveryAsset } from '@/delivery/assetParser'
import type { BuyerOrder, DeliveryAssetRecord, DeliverySessionRecord } from '@/delivery/domain'
import type { DeliveryMessage } from '@/delivery/messageStore'
import type { DeliveryWorkspace, WorkspaceOrder, WorkspaceOrderStatus } from '@/delivery/workspace'

export type DeliveryConversationTab =
  | { kind: 'all'; id: 'all' }
  | { kind: 'order'; id: string; orderCorrelationId: string; orderId: string }

export interface DeliveryOrderThread {
  id: string
  tabId: string
  orderId: string
  orderCorrelationId: string
  serviceLabel: string
  requestSummary: string
  status: WorkspaceOrderStatus
  lastActivityAt: number
  assetCount: number
  messageCount: number
  order: WorkspaceOrder
  messages: DeliveryMessage[]
  assets: ParsedDeliveryAsset[]
}

export interface DeliveryConversation {
  id: string
  providerGlobalMetaId: string
  providerChatPubkey?: string
  providerName?: string
  providerAvatarUrl?: string
  latestActivityAt: number
  lastMessage: DeliveryMessage | null
  messageCount: number
  activeOrderCount: number
  deliveredOrderCount: number
  assetCount: number
  messages: DeliveryMessage[]
  assets: ParsedDeliveryAsset[]
  orderThreads: DeliveryOrderThread[]
}

export interface DeliveryConversationWorkspace {
  walletGlobalMetaId: string
  conversations: DeliveryConversation[]
  orderWorkspace: DeliveryWorkspace
  totalCount: number
  activeOrderCount: number
  deliveredOrderCount: number
  assetCount: number
  latestActivityAt: number | null
}

export interface DeliveryConversationBuildInput {
  walletGlobalMetaId: string
  orders: BuyerOrder[]
  sessions: DeliverySessionRecord[]
  byPeer: Record<string, DeliveryMessage[]>
  assetsBySession: Record<string, DeliveryAssetRecord[]>
}
```

The file must also export:

```ts
export function buildDeliveryConversations(input: DeliveryConversationBuildInput): DeliveryConversationWorkspace
export function selectDeliveryConversation(workspace: DeliveryConversationWorkspace, conversationId: string | null): DeliveryConversation | null
export function selectDeliveryTab(conversation: DeliveryConversation | null, tabId: string | null): DeliveryConversationTab
export function selectOrderThread(conversation: DeliveryConversation | null, tab: DeliveryConversationTab): DeliveryOrderThread | null
export function messagesForConversation(conversation: DeliveryConversation | null, tab: DeliveryConversationTab): DeliveryMessage[]
export function assetsForConversation(conversation: DeliveryConversation | null, tab: DeliveryConversationTab): ParsedDeliveryAsset[]
export function resolveDeliveryRouteSelection(input: { workspace: DeliveryConversationWorkspace; conversationParam?: string | null; orderParam?: string | null; sessionParam?: string | null; walletGlobalMetaId: string }): { conversationId: string | null; tabId: string }
```

## Task 0: Canonical Skill-Service Order Pin Ids

**Owner:** Order identity subagent.

**Why this is first:** IDBots A2A now publishes a
`/protocols/skill-service-order` pin before sending the simplemsg order request.
The pin id is the unique order id. BotHub must adopt that id before building
conversation tabs, otherwise the new UI will be keyed by deprecated
`paymentTxid` or random `orderReference` values.

**Files:**

- Modify: `src/order/payAndRequestStages.ts`
- Modify: `src/order/orderMessage.ts`
- Modify: `src/delivery/orderStore.ts`
- Modify: `src/delivery/workspace.ts`
- Modify: `src/delivery/orderParser.ts`
- Modify: `src/delivery/protocol.ts` only if shared parsing/building helpers are needed.
- Modify: `src/delivery/sessionGrouping.ts`
- Modify: `tests/order/buildOrderPayload.test.ts`
- Modify: `tests/order/flow.test.ts`
- Modify: `tests/delivery/orderStore.test.ts`
- Modify: `tests/delivery/workspace.test.ts`
- Modify: `tests/delivery/orderParser.test.ts`
- Modify: `tests/delivery/protocol.test.ts`
- Modify: `tests/delivery/sessionGrouping.test.ts`

- [ ] **Step 1: Write failing canonical id tests**

Add focused tests proving these behaviors:

```ts
it('uses the skill-service-order pin id as the new order session key', async () => {
  // Mock payment tx/reference plus publish result.
  // The returned sessionKey/orderCorrelationId must equal serviceOrderPinId,
  // not paymentTxid and not the free-order random orderReference.
})
```

```ts
it('persists orderPinId as the buyer order and session correlation id', async () => {
  // persistPendingOrder({ orderPinId: 'order-pin-i0', paymentTxid: 'pay-tx' })
  // BuyerOrder.id, DeliverySessionRecord.orderCorrelationId, and the initial
  // order message orderCorrelationId all use 'order-pin-i0'.
  // paymentTxid remains available as payment reference metadata.
})
```

```ts
it('prefers orderPinId over paymentTxid and orderReference when deriving workspace rows', () => {
  // orderCorrelationIdFor(orderWithAllIds) === 'order-pin-i0'
  // orderCorrelationCandidates(orderWithAllIds) still contains legacy aliases.
})
```

```ts
it('parses order pin id metadata from protocol messages as the canonical id', () => {
  // A message containing both an old [ORDER_STATUS:pay-tx] tag and
  // "order pin id: order-pin-i0" resolves to 'order-pin-i0'.
})
```

```ts
it('keeps legacy paymentTxid and orderReference records routable when orderPinId is absent', () => {
  // Existing data without an order pin id still produces the same correlation
  // ids and session deep-link behavior as before.
})
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- tests/order/flow.test.ts tests/order/buildOrderPayload.test.ts tests/delivery/orderStore.test.ts tests/delivery/workspace.test.ts tests/delivery/orderParser.test.ts tests/delivery/protocol.test.ts tests/delivery/sessionGrouping.test.ts
```

Expected: failures show new orders still key by `paymentTxid` or
`orderReference`, and protocol parsing does not canonicalize `order pin id`.

- [ ] **Step 3: Implement canonical order identity**

Implementation rules:

- Publish or recover the `/protocols/skill-service-order` pin before creating
  the simplemsg order request, following the IDBots A2A order sequence.
- Set `serviceOrderPinId` or `orderPinId` from the published pin id.
- Use that pin id as `sessionKey`, `BuyerOrder.id` suffix,
  `BuyerOrder.orderPinId`, `DeliverySessionRecord.orderCorrelationId`,
  initial order-message `orderCorrelationId`, conversation tab id, and future
  URL `order` parameter.
- Keep `paymentTxid`, `paymentCommitTxid`, and `orderReference` as payment or
  legacy alias fields. Do not discard them.
- Update `orderCorrelationIdFor()` and any sibling helper to return
  `orderPinId` first, then legacy ids only when the pin id is absent.
- Include all aliases in correlation candidate matching so old protocol tags and
  stored assets still recover.
- Parse `order pin id: <pinid>`, `orderPinId`, and `serviceOrderPinId` metadata
  from inbound order/status/delivery/end/rating messages. When both a tag id and
  order pin id appear, normalize assignment to the order pin id.
- Do not publish an `orderId` field inside the `skill-service-order` content.
  The pin id of that record is the order id.
- Failed-to-send orders that never obtain a `skill-service-order` pin may keep
  the existing generated fallback id because no canonical order pin exists.

- [ ] **Step 4: Run canonical id tests**

Run:

```bash
npm test -- tests/order/flow.test.ts tests/order/buildOrderPayload.test.ts tests/delivery/orderStore.test.ts tests/delivery/workspace.test.ts tests/delivery/orderParser.test.ts tests/delivery/protocol.test.ts tests/delivery/sessionGrouping.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit and journal**

Run:

```bash
git add src/order/payAndRequestStages.ts src/order/orderMessage.ts src/delivery/orderStore.ts src/delivery/workspace.ts src/delivery/orderParser.ts src/delivery/protocol.ts src/delivery/sessionGrouping.ts tests/order/flow.test.ts tests/order/buildOrderPayload.test.ts tests/delivery/orderStore.test.ts tests/delivery/workspace.test.ts tests/delivery/orderParser.test.ts tests/delivery/protocol.test.ts tests/delivery/sessionGrouping.test.ts
git diff --cached --check
git commit -m "feat: use skill service order pin ids"
```

Post a Lisa Hahn buzz with commit hash, canonical order-id behavior, legacy
compatibility, and verification command.

## Task 1: Conversation Workspace Selectors

**Owner:** Selector subagent.

**Files:**

- Create: `src/delivery/conversationWorkspace.ts`
- Create: `tests/delivery/conversationWorkspace.test.ts`
- Modify: `src/delivery/workspace.ts` only to export helper types or pure helpers needed by the new selector.

- [ ] **Step 1: Write failing selector tests**

Create `tests/delivery/conversationWorkspace.test.ts` with fixtures mirroring `tests/delivery/workspace.test.ts`. Include these test cases:

Unless a test is explicitly about legacy data, order fixtures must include
`orderPinId` and use that pin id as the expected `orderCorrelationId`. Include
`paymentTxid` or `orderReference` only to prove they remain aliases.

```ts
it('groups multiple orders from one provider into one conversation with order tabs', () => {
  const workspace = buildDeliveryConversations({
    walletGlobalMetaId: SELF,
    orders: [
      order({ id: `${SELF}:${PROVIDER}:order-pin-1`, orderPinId: 'order-pin-1', paymentTxid: 'pay-tx-1', updatedAt: 10 }),
      order({ id: `${SELF}:${PROVIDER}:order-pin-2`, orderPinId: 'order-pin-2', paymentTxid: 'pay-tx-2', updatedAt: 20 }),
    ],
    sessions: [],
    byPeer: {
      [PROVIDER]: [
        message({ id: 'chat-1', content: 'Can I try this first?', orderCorrelationId: undefined, timestamp: 5 }),
        message({ id: 'status-1', content: '[ORDER_STATUS:order-pin-1] Working', orderCorrelationId: undefined, timestamp: 30 }),
        message({ id: 'delivery-2', content: '[DELIVERY:order-pin-2] Ready metafile://two.png', orderCorrelationId: undefined, timestamp: 40 }),
      ],
    },
    assetsBySession: {},
  })

  expect(workspace.conversations).toHaveLength(1)
  expect(workspace.conversations[0]?.providerGlobalMetaId).toBe(PROVIDER)
  expect(workspace.conversations[0]?.orderThreads.map((thread) => thread.orderCorrelationId)).toEqual(['order-pin-2', 'order-pin-1'])
  expect(workspace.conversations[0]?.messages.map((row) => row.id)).toEqual(['chat-1', 'status-1', 'delivery-2'])
})
```

Add these named tests with explicit assertions:

```ts
it('keeps ambiguous unscoped protocol messages only in All when multiple active orders exist', () => {
  const workspace = buildDeliveryConversations({
    walletGlobalMetaId: SELF,
    orders: [
      order({ id: `${SELF}:${PROVIDER}:order-pin-1`, orderPinId: 'order-pin-1', status: 'waiting', updatedAt: 10 }),
      order({ id: `${SELF}:${PROVIDER}:order-pin-2`, orderPinId: 'order-pin-2', status: 'waiting', updatedAt: 11 }),
    ],
    sessions: [],
    byPeer: {
      [PROVIDER]: [
        message({ id: 'unscoped-delivery', content: '[DELIVERY] Ready metafile://ambiguous.png', orderCorrelationId: undefined, timestamp: 12 }),
      ],
    },
    assetsBySession: {},
  })
  const conversation = workspace.conversations[0]!

  expect(messagesForConversation(conversation, { kind: 'all', id: 'all' }).map((row) => row.id)).toEqual(['unscoped-delivery'])
  expect(conversation.orderThreads.flatMap((thread) => thread.messages.map((row) => row.id))).not.toContain('unscoped-delivery')
  expect(assetsForConversation(conversation, { kind: 'all', id: 'all' }).map((asset) => asset.filename)).toEqual(['ambiguous.png'])
  expect(conversation.orderThreads.flatMap((thread) => thread.assets.map((asset) => asset.filename))).not.toContain('ambiguous.png')
})
```

```ts
it('assigns terminal and rating protocol messages to All and the explicit order tab', () => {
  const workspace = buildDeliveryConversations({
    walletGlobalMetaId: SELF,
    orders: [order({ id: `${SELF}:${PROVIDER}:order-pin-1`, orderPinId: 'order-pin-1' })],
    sessions: [],
    byPeer: {
      [PROVIDER]: [
        message({ id: 'end-1', content: '[ORDER_END:order-pin-1] Done', orderCorrelationId: undefined, timestamp: 20 }),
        message({ id: 'rating-1', content: '[NeedsRating:order-pin-1] Please rate', orderCorrelationId: undefined, timestamp: 21 }),
      ],
    },
    assetsBySession: {},
  })
  const conversation = workspace.conversations[0]!
  const orderTab = { kind: 'order' as const, id: 'order:order-pin-1', orderCorrelationId: 'order-pin-1', orderId: `${SELF}:${PROVIDER}:order-pin-1` }

  expect(messagesForConversation(conversation, { kind: 'all', id: 'all' }).map((row) => row.id)).toEqual(['end-1', 'rating-1'])
  expect(messagesForConversation(conversation, orderTab).map((row) => row.id)).toEqual(['end-1', 'rating-1'])
})
```

```ts
it('merges provider aliases only when chat pubkey and profile fields do not conflict', () => {
  const providerAddress = '1ProviderAddress'
  const providerCanonical = 'idqproviderCanonical'
  const workspace = buildDeliveryConversations({
    walletGlobalMetaId: SELF,
    orders: [
      order({
        id: `${SELF}:${providerAddress}:order-pin-1`,
        providerGlobalMetaId: providerAddress,
        providerChatPubkey: 'same-chat-key',
        providerName: 'Render Bot',
        orderPinId: 'order-pin-1',
        orderReference: 'legacy-ref-1',
      }),
    ],
    sessions: [],
    byPeer: {
      [providerCanonical]: [
        message({
          id: 'alias-chat',
          peerGlobalMetaId: providerCanonical,
          peerChatPubkey: 'same-chat-key',
          peerName: 'Render Bot',
          content: 'Alias side message',
          orderCorrelationId: undefined,
          timestamp: 30,
        }),
      ],
    },
    assetsBySession: {},
  })

  expect(workspace.conversations).toHaveLength(1)
  expect(workspace.conversations[0]?.id).toBe(providerCanonical)
  expect(workspace.conversations[0]?.messages.map((row) => row.id)).toContain('alias-chat')
})
```

```ts
it('does not merge provider aliases when profile fields conflict', () => {
  const providerAddress = '1ProviderAddress'
  const providerCanonical = 'idqproviderCanonical'
  const workspace = buildDeliveryConversations({
    walletGlobalMetaId: SELF,
    orders: [
      order({
        id: `${SELF}:${providerAddress}:order-pin-1`,
        providerGlobalMetaId: providerAddress,
        providerChatPubkey: 'same-chat-key',
        providerName: 'Render Bot',
        orderPinId: 'order-pin-1',
        orderReference: 'legacy-ref-1',
      }),
    ],
    sessions: [],
    byPeer: {
      [providerCanonical]: [
        message({
          id: 'conflicting-alias-chat',
          peerGlobalMetaId: providerCanonical,
          peerChatPubkey: 'same-chat-key',
          peerName: 'Different Bot',
          content: 'Conflicting alias side message',
          orderCorrelationId: undefined,
          timestamp: 30,
        }),
      ],
    },
    assetsBySession: {},
  })

  expect(workspace.conversations.map((conversation) => conversation.id).sort()).toEqual([
    providerAddress,
    providerCanonical,
  ].sort())
})
```

```ts
it('scopes assets to All or a selected order tab', () => {
  const workspace = buildDeliveryConversations({
    walletGlobalMetaId: SELF,
    orders: [
      order({ id: `${SELF}:${PROVIDER}:order-pin-1`, orderPinId: 'order-pin-1' }),
      order({ id: `${SELF}:${PROVIDER}:order-pin-2`, orderPinId: 'order-pin-2' }),
    ],
    sessions: [],
    byPeer: {
      [PROVIDER]: [
        message({ id: 'delivery-1', content: '[DELIVERY:order-pin-1] Ready metafile://one.png', orderCorrelationId: undefined, timestamp: 10 }),
        message({ id: 'delivery-2', content: '[DELIVERY:order-pin-2] Ready metafile://two.png', orderCorrelationId: undefined, timestamp: 11 }),
      ],
    },
    assetsBySession: {},
  })
  const conversation = workspace.conversations[0]!
  const orderOneTab = { kind: 'order' as const, id: 'order:order-pin-1', orderCorrelationId: 'order-pin-1', orderId: `${SELF}:${PROVIDER}:order-pin-1` }

  expect(assetsForConversation(conversation, { kind: 'all', id: 'all' }).map((asset) => asset.filename)).toEqual(['one.png', 'two.png'])
  expect(assetsForConversation(conversation, orderOneTab).map((asset) => asset.filename)).toEqual(['one.png'])
})
```

```ts
it('resolves old order and session URL params to conversation plus order tab', () => {
  const workspace = buildDeliveryConversations({
    walletGlobalMetaId: SELF,
    orders: [order({ id: `${SELF}:${PROVIDER}:order-pin-1`, orderPinId: 'order-pin-1', orderReference: 'legacy-ref-1' })],
    sessions: [],
    byPeer: {},
    assetsBySession: {},
  })

  expect(resolveDeliveryRouteSelection({
    workspace,
    conversationParam: null,
    orderParam: `${SELF}:${PROVIDER}:order-pin-1`,
    sessionParam: null,
    walletGlobalMetaId: SELF,
  })).toEqual({ conversationId: PROVIDER, tabId: 'order:order-pin-1' })

  expect(resolveDeliveryRouteSelection({
    workspace,
    conversationParam: null,
    orderParam: null,
    sessionParam: `${PROVIDER}:order-pin-1`,
    walletGlobalMetaId: SELF,
  })).toEqual({ conversationId: PROVIDER, tabId: 'order:order-pin-1' })
})
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- tests/delivery/conversationWorkspace.test.ts
```

Expected: fails because `@/delivery/conversationWorkspace` does not exist.

- [ ] **Step 3: Implement selectors**

Create `src/delivery/conversationWorkspace.ts` using these rules:

- Call `buildDeliveryWorkspace(input)` once for order rows, provider display
  fields, status, and asset recovery. Do not use `WorkspaceOrder.messages` as
  the source of truth for order-tab membership.
- Build order threads from `orderWorkspace.orders.filter((order) => order.orderCorrelationId)`.
- For new records, `order.orderCorrelationId` must be the
  `skill-service-order` pin id. Treat `paymentTxid` and `orderReference` only as
  aliases when matching legacy protocol tags, old session ids, or stored assets.
- Conversation `All` messages are the sorted union of all raw `input.byPeer`
  messages for the provider conversation plus any normalized explicit-order
  messages recovered by `buildDeliveryWorkspace()`.
- Order-thread messages must be assigned from raw messages with correlation
  provenance:
  - explicit `message.orderCorrelationId`,
  - explicit ids parsed from `[ORDER_STATUS:<id>]`, `[DELIVERY:<id>]`,
    `[ORDER_END:<id>]`, `[NeedsRating:<id>]`, parsed `[ORDER]` metadata, or
    known ids mentioned in message text,
  - `order pin id: <pinid>`, `orderPinId`, or `serviceOrderPinId` metadata,
  - unscoped protocol messages only when exactly one active order candidate
    exists for that provider conversation.
- If a message exposes both an old payment/reference tag and an order pin id,
  assign it to the order pin id thread.
- If two or more active order threads could receive an unscoped protocol
  message, keep that message in `All` only and exclude it from every order tab.
- For this selector, active order candidates are order threads whose status is
  not `completed`, `failed`, or `failed_to_send` and whose `createdAt`,
  `updatedAt`, or `lastActivityAt` is within 24 hours of the message timestamp.
  If the message timestamp cannot be normalized, infer only when the provider
  conversation has exactly one active order thread.
- Do not create an order tab for an uncorrelated historical row.
- Conversation `All` assets are the unique union of all workspace row assets for that provider.
- Order tab assets must follow the same provenance rule as order-tab messages:
  include assets parsed from messages assigned to that order thread plus stored
  assets whose `orderCorrelationId` or `sessionId` explicitly maps to that
  order. Do not copy `WorkspaceOrder.assets` wholesale into an order tab when
  those assets came from an unscoped ambiguous protocol message.
- Sort conversations by `latestActivityAt` descending, then `id` ascending.
- Sort order tabs by active status first, then `lastActivityAt` descending, then `id` ascending.
- Use the existing `parseSessionKey()` and `buildSessionId()` for URL compatibility.
- Alias merging rule: merge two peer ids into one conversation only when both
  sides expose the same non-empty `providerChatPubkey` or `peerChatPubkey` and
  non-empty profile fields do not conflict. Prefer an `idq...` globalMetaId as
  `conversation.id` when present; otherwise prefer the provider id from a
  stored order; otherwise use the most recent message peer id.

Use this helper shape:

```ts
function uniqueById<T>(items: T[], idFor: (item: T) => string): T[] {
  return Array.from(new Map(items.map((item) => [idFor(item), item])).values())
}

function sortMessagesAsc(messages: DeliveryMessage[]): DeliveryMessage[] {
  return [...messages].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp
    return a.id.localeCompare(b.id)
  })
}

function tabIdForOrderCorrelation(orderCorrelationId: string): string {
  return `order:${orderCorrelationId.trim()}`
}
```

- [ ] **Step 4: Run selector tests**

Run:

```bash
npm test -- tests/delivery/conversationWorkspace.test.ts tests/delivery/workspace.test.ts tests/delivery/sessionGrouping.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit and journal**

Run:

```bash
git add src/delivery/conversationWorkspace.ts tests/delivery/conversationWorkspace.test.ts src/delivery/workspace.ts
git diff --cached --check
git commit -m "feat: add delivery conversation selectors"
```

Post a Lisa Hahn buzz with commit hash, selector behavior, and verification command.

## Task 2: Conversation List Components

**Owner:** Left-nav UI subagent.

**Files:**

- Create: `src/components/delivery/DeliveryConversationList.tsx`
- Create: `tests/components/delivery/DeliveryConversationList.test.tsx`
- Modify: `src/i18n/zh-CN.ts`

- [ ] **Step 1: Write failing component tests**

Create `tests/components/delivery/DeliveryConversationList.test.tsx` with these cases:

```ts
it('renders one provider row with aggregate order and asset counts', () => {
  render(
    <DeliveryConversationList
      conversations={[
        conversation({
          providerName: 'Render Bot',
          activeOrderCount: 2,
          assetCount: 3,
          lastMessage: message({ content: 'latest reply', timestamp: 30 }),
        }),
      ]}
      selectedConversationId="idqprovider"
      walletConnected
      syncStatus="ready"
      onSelectConversation={vi.fn()}
    />,
  )

  const list = screen.getByRole('list', { name: '服务方会话' })
  expect(within(list).getByText('Render Bot')).toBeInTheDocument()
  expect(within(list).getByText('latest reply')).toBeInTheDocument()
  expect(within(list).getByText('2 个进行中')).toBeInTheDocument()
  expect(within(list).getByText('3 个成果')).toBeInTheDocument()
  expect(screen.queryByText('Image Render')).not.toBeInTheDocument()
})
```

Add tests for disconnected empty state, connected empty state, partial sync banner, and `onSelectConversation`.

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- tests/components/delivery/DeliveryConversationList.test.tsx
```

Expected: fails because the component does not exist.

- [ ] **Step 3: Implement `DeliveryConversationList`**

Implement props:

```ts
interface DeliveryConversationListProps {
  conversations: DeliveryConversation[]
  selectedConversationId: string | null
  walletConnected: boolean
  syncStatus: DeliverySyncUiStatus
  failedPeerCount?: number
  onSelectConversation: (conversationId: string) => void
}
```

Use `PeerAvatar`, restrained list styling from `DeliveryOrderList`, and labels:

- `delivery.workspace.conversations`: `服务方会话`
- `delivery.workspace.noConversationsTitle`: `还没有服务方会话`
- `delivery.workspace.noConversationsHint`: `私聊或下单后，和服务方的沟通与交付会保存在这里。`

The button `aria-label` must be the provider name or provider globalMetaId. The list must not render one row per order.

- [ ] **Step 4: Run component tests**

Run:

```bash
npm test -- tests/components/delivery/DeliveryConversationList.test.tsx tests/components/delivery/DeliveryOrderList.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Commit and journal**

Run:

```bash
git add src/components/delivery/DeliveryConversationList.tsx tests/components/delivery/DeliveryConversationList.test.tsx src/i18n/zh-CN.ts
git diff --cached --check
git commit -m "feat: add delivery conversation list"
```

Post a Lisa Hahn buzz with commit hash, UI scope, and verification command.

## Task 3: Header, Tabs, And Timeline Views

**Owner:** Center-panel UI subagent.

**Files:**

- Create: `src/components/delivery/DeliveryConversationHeader.tsx`
- Create: `tests/components/delivery/DeliveryConversationHeader.test.tsx`
- Create: `src/components/delivery/DeliveryOrderTabs.tsx`
- Create: `tests/components/delivery/DeliveryOrderTabs.test.tsx`
- Modify: `src/components/delivery/DeliveryStatusTimeline.tsx`
- Modify: `tests/components/delivery/DeliveryStatusTimeline.test.tsx`
- Modify: `src/components/delivery/DeliveryWorkspaceHeader.tsx`
- Modify: `tests/components/delivery/DeliveryWorkspaceHeader.test.tsx`
- Modify: `src/i18n/zh-CN.ts`

- [ ] **Step 1: Write failing tests for conversation header and tabs**

`DeliveryConversationHeader` test cases:

```ts
it('summarizes the selected provider conversation', () => {
  render(<DeliveryConversationHeader conversation={conversation({ providerName: 'Render Bot', activeOrderCount: 2, assetCount: 4 })} />)

  expect(screen.getByText('Render Bot')).toBeInTheDocument()
  expect(screen.getByText('2 个进行中')).toBeInTheDocument()
  expect(screen.getByText('4 个成果')).toBeInTheDocument()
})
```

`DeliveryOrderTabs` test cases:

```ts
it('renders All plus one tab per order and reports selection', () => {
  const onSelectTab = vi.fn()
  render(
    <DeliveryOrderTabs
      conversation={conversationWithTwoOrders()}
      selectedTabId="all"
      onSelectTab={onSelectTab}
    />,
  )

  expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true')
  fireEvent.click(screen.getByRole('tab', { name: /Image Render/ }))
  expect(onSelectTab).toHaveBeenCalledWith('order:order-pin-1')
})
```

Add a test that `DeliveryOrderTabs` renders no textbox or free-text input.

- [ ] **Step 2: Write failing tests for All timeline mode**

Extend `tests/components/delivery/DeliveryStatusTimeline.test.tsx`:

```ts
it('renders an All conversation timeline without progress milestones', () => {
  render(
    <DeliveryStatusTimeline
      order={null}
      messages={[
        message({ id: 'chat-1', content: 'Can I try this first?', orderCorrelationId: undefined, timestamp: 1 }),
        message({ id: 'delivery-1', content: '[DELIVERY:order-pin-1] Ready', orderCorrelationId: 'order-pin-1', timestamp: 2 }),
      ]}
      selfGlobalMetaId="idqbuyer"
      mode="all"
    />,
  )

  expect(screen.getByText('Can I try this first?')).toBeInTheDocument()
  expect(screen.getByText('[DELIVERY:order-pin-1] Ready')).toBeInTheDocument()
  expect(screen.queryByText('交付进度')).not.toBeInTheDocument()
})
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
npm test -- tests/components/delivery/DeliveryConversationHeader.test.tsx tests/components/delivery/DeliveryOrderTabs.test.tsx tests/components/delivery/DeliveryStatusTimeline.test.tsx
```

Expected: new component imports fail and timeline `mode` prop is unsupported.

- [ ] **Step 4: Implement center-panel components**

Implement `DeliveryConversationHeader` with props:

```ts
interface DeliveryConversationHeaderProps {
  conversation: DeliveryConversation | null
}
```

Implement `DeliveryOrderTabs` with props:

```ts
interface DeliveryOrderTabsProps {
  conversation: DeliveryConversation | null
  selectedTabId: string
  onSelectTab: (tabId: string) => void
}
```

Update `DeliveryStatusTimelineProps` to:

```ts
interface DeliveryStatusTimelineProps {
  order: WorkspaceOrder | null
  messages?: DeliveryMessage[]
  selfGlobalMetaId: string
  mode?: 'order' | 'all'
}
```

Rules:

- `mode="order"` keeps the current milestone behavior.
- `mode="all"` renders only message bubbles from `messages`, hides progress milestones, and keeps decrypt diagnostics behavior.
- `DeliveryWorkspaceHeader` remains the order action header and continues to show disabled `评价` and `退款` buttons.

- [ ] **Step 5: Run center-panel tests**

Run:

```bash
npm test -- tests/components/delivery/DeliveryConversationHeader.test.tsx tests/components/delivery/DeliveryOrderTabs.test.tsx tests/components/delivery/DeliveryStatusTimeline.test.tsx tests/components/delivery/DeliveryWorkspaceHeader.test.tsx
```

Expected: all tests pass.

- [ ] **Step 6: Commit and journal**

Run:

```bash
git add src/components/delivery/DeliveryConversationHeader.tsx tests/components/delivery/DeliveryConversationHeader.test.tsx src/components/delivery/DeliveryOrderTabs.tsx tests/components/delivery/DeliveryOrderTabs.test.tsx src/components/delivery/DeliveryStatusTimeline.tsx tests/components/delivery/DeliveryStatusTimeline.test.tsx src/components/delivery/DeliveryWorkspaceHeader.tsx tests/components/delivery/DeliveryWorkspaceHeader.test.tsx src/i18n/zh-CN.ts
git diff --cached --check
git commit -m "feat: add delivery conversation tabs"
```

Post a Lisa Hahn buzz with commit hash, read-only tab behavior, and verification command.

## Task 4: Rewire Delivery Route Selection And Composer Boundary

**Owner:** Route integration subagent.

**Files:**

- Modify: `src/routes/Delivery.tsx`
- Modify: `src/delivery/messageStore.ts`
- Modify: `tests/delivery/messageStore.test.ts`
- Modify: `tests/components/delivery/DeliveryPage.test.tsx`
- Modify: `tests/components/delivery/DeliveryComposer.test.tsx`

- [ ] **Step 1: Write failing route integration tests**

Before adding the route tests, extend the test mock setup in
`tests/components/delivery/DeliveryPage.test.tsx`:

- add `appendOutgoingFollowUp: vi.fn().mockResolvedValue(undefined)` to
  `mocks.messageState`,
- expose it through the `@/delivery/messageStore` mock,
- mock `@/delivery/sendMessage` so `sendDeliveryFollowUp` resolves
  `{ pinId: 'pin-follow-up', encryptedContent: 'encrypted-follow-up' }`.

Update `tests/components/delivery/DeliveryPage.test.tsx` with these cases:

```ts
it('renders one left-nav row per provider and puts orders into tabs', () => {
  mocks.walletState.identity = connectedWallet
  mocks.walletState.status = 'connected'
  mocks.messageState.byPeer = {
    idqprovider: [
      deliveryMessage({ id: 'chat-1', peerGlobalMetaId: 'idqprovider', content: 'hello', timestamp: 1 }),
      deliveryMessage({ id: 'order-pin-1', peerGlobalMetaId: 'idqprovider', content: '[ORDER] one\\norder pin id: order-pin-1', orderCorrelationId: 'order-pin-1', timestamp: 2 }),
      deliveryMessage({ id: 'order-pin-2', peerGlobalMetaId: 'idqprovider', content: '[ORDER] two\\norder pin id: order-pin-2', orderCorrelationId: 'order-pin-2', timestamp: 3 }),
    ],
  }

  renderDeliveryPage('/delivery')

  const conversationList = screen.getByRole('list', { name: '服务方会话' })
  expect(within(conversationList).getAllByRole('button')).toHaveLength(1)
  expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument()
  expect(screen.getAllByRole('tab').length).toBe(3)
})
```

```ts
it('shows the composer only in All and hides it on order tabs', () => {
  mocks.walletState.identity = connectedWallet
  mocks.walletState.status = 'connected'
  mocks.messageState.byPeer = {
    idqprovider: [
      deliveryMessage({ id: 'order-pin-1', peerGlobalMetaId: 'idqprovider', content: '[ORDER_STATUS:order-pin-1] Working', orderCorrelationId: 'order-pin-1', timestamp: 1 }),
    ],
  }

  const view = renderDeliveryPage('/delivery?conversation=idqprovider')
  expect(screen.getByRole('textbox', { name: '补充需求或询问进度' })).toBeInTheDocument()

  view.rerender(
    <MemoryRouter initialEntries={['/delivery?conversation=idqprovider&order=order-pin-1']} future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <DeliveryPage />
    </MemoryRouter>,
  )
  expect(screen.queryByRole('textbox', { name: '补充需求或询问进度' })).not.toBeInTheDocument()
})
```

```ts
it('sends All follow-ups without order correlation', async () => {
  mocks.walletState.identity = connectedWallet
  mocks.walletState.status = 'connected'
  mocks.messageState.byPeer = {
    idqprovider: [
      deliveryMessage({ id: 'order-pin-1', peerGlobalMetaId: 'idqprovider', peerChatPubkey: 'provider-key', content: '[ORDER_STATUS:order-pin-1] Working', orderCorrelationId: 'order-pin-1', timestamp: 1 }),
    ],
  }

  renderDeliveryPage('/delivery?conversation=idqprovider')
  fireEvent.change(screen.getByRole('textbox', { name: '补充需求或询问进度' }), { target: { value: 'Please also send source files.' } })
  fireEvent.click(screen.getByRole('button', { name: '发送' }))

  await waitFor(() =>
    expect(mocks.messageState.appendOutgoingFollowUp).toHaveBeenCalledWith(expect.objectContaining({
      session: expect.objectContaining({ peerGlobalMetaId: 'idqprovider', orderCorrelationId: null }),
    })),
  )
})
```

Add an old URL recovery test for `/delivery?session=idqprovider:order-pin-1`.

Add a protocol coverage route test:

```ts
it('shows ORDER_END and NeedsRating in All and the matching order tab', () => {
  mocks.walletState.identity = connectedWallet
  mocks.walletState.status = 'connected'
  mocks.messageState.byPeer = {
    idqprovider: [
      deliveryMessage({ id: 'end-1', peerGlobalMetaId: 'idqprovider', content: '[ORDER_END:order-pin-1] Done', orderCorrelationId: undefined, timestamp: 1 }),
      deliveryMessage({ id: 'rating-1', peerGlobalMetaId: 'idqprovider', content: '[NeedsRating:order-pin-1] Please rate', orderCorrelationId: undefined, timestamp: 2 }),
    ],
  }

  const view = renderDeliveryPage('/delivery?conversation=idqprovider')
  expect(screen.getByText('[ORDER_END:order-pin-1] Done')).toBeInTheDocument()
  expect(screen.getByText('[NeedsRating:order-pin-1] Please rate')).toBeInTheDocument()

  view.rerender(
    <MemoryRouter initialEntries={['/delivery?conversation=idqprovider&order=order-pin-1']} future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <DeliveryPage />
    </MemoryRouter>,
  )
  expect(screen.getByText('[ORDER_END:order-pin-1] Done')).toBeInTheDocument()
  expect(screen.getByText('[NeedsRating:order-pin-1] Please rate')).toBeInTheDocument()
})
```

Add a DB persistence unit test in `tests/delivery/messageStore.test.ts`:

```ts
it('persists All follow-ups in the uncorrelated provider conversation', async () => {
  const wallet = {
    globalMetaId: SELF,
    mvcAddress: '1Buyer',
    btcAddress: 'bc1buyer',
    dogeAddress: 'Dbuyer',
  }

  await useMessageStore.getState().appendOutgoingFollowUp({
    wallet,
    session: {
      sessionKey: 'idqpeer',
      peerGlobalMetaId: 'idqpeer',
      providerChatPubkey: 'provider-key',
      peerName: 'Provider',
      peerAvatarUrl: 'https://cdn.example/provider.png',
      orderCorrelationId: null,
      serviceLabel: null,
    },
    content: 'Plain follow-up',
    rawContent: 'encrypted-follow-up',
    pinId: 'pin-follow-up',
  })

  const sessionId = `${SELF}:idqpeer:uncorrelated`
  expect(await getSessionsForWallet(SELF)).toEqual([
    expect.objectContaining({ id: sessionId, orderCorrelationId: undefined }),
  ])
  expect(await getMessagesForSession(sessionId)).toEqual([
    expect.objectContaining({ id: 'pin-follow-up', orderCorrelationId: undefined }),
  ])
})
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- tests/components/delivery/DeliveryPage.test.tsx tests/components/delivery/DeliveryComposer.test.tsx tests/delivery/messageStore.test.ts
```

Expected: failures show the route is still order-centered and composer appears for selected orders.

- [ ] **Step 3: Rewire `DeliveryPage`**

Apply these route changes:

- Replace `buildDeliveryWorkspace()` route dependency with `buildDeliveryConversations()`.
- Read `conversation`, `order`, and legacy `session` params.
- Resolve selection through `resolveDeliveryRouteSelection()`.
- Select `selectedConversation`, `selectedTab`, and `selectedOrderThread`.
- Left aside renders `DeliveryConversationList`.
- Center panel renders `DeliveryConversationHeader`, `DeliveryOrderTabs`, and:
  - `All`: `DeliveryStatusTimeline mode="all"` with `messagesForConversation(selectedConversation, selectedTab)`.
  - order tab: `DeliveryWorkspaceHeader order={selectedOrderThread?.order || null}` plus `DeliveryStatusTimeline mode="order" order={selectedOrderThread?.order || null}`.
- Right panel assets come from `assetsForConversation(selectedConversation, selectedTab)`.
- Composer renders only when `selectedTab.kind === 'all'`.
- Composer session is built from selected conversation and uses `orderCorrelationId: null`.
- Provider key resolution uses selected conversation messages and all same-provider orders.
- Visible profile hydration loops over `workspace.conversations`, not `workspace.orders`.

Use these param constants:

```ts
const CONVERSATION_PARAM = 'conversation'
const ORDER_PARAM = 'order'
const SESSION_PARAM = 'session'
```

When selecting a conversation, set `conversation` and delete `order` and `session`.
When selecting an order tab, set `conversation`, set `order` to the thread correlation id, and delete `session`.
When selecting `All`, keep `conversation`, delete `order`, delete `session`.

- [ ] **Step 4: Adjust `messageStore` only for proved correlation leakage**

If the route test shows `appendOutgoingFollowUp` persists an order correlation despite receiving `orderCorrelationId: null`, change only this block in `appendOutgoingFollowUp`:

```ts
const sessionId = buildSessionId({
  walletGlobalMetaId,
  providerGlobalMetaId,
  orderCorrelationId: session.orderCorrelationId,
})
```

to preserve null as uncorrelated:

```ts
const orderCorrelationId = session.orderCorrelationId?.trim() || null
const sessionId = buildSessionId({
  walletGlobalMetaId,
  providerGlobalMetaId,
  orderCorrelationId,
})
```

and write `orderCorrelationId: orderCorrelationId || undefined` in the persisted session/message.

- [ ] **Step 5: Run route tests**

Run:

```bash
npm test -- tests/components/delivery/DeliveryPage.test.tsx tests/components/delivery/DeliveryComposer.test.tsx tests/delivery/messageStore.test.ts tests/delivery/conversationWorkspace.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit and journal**

Run:

```bash
git add src/routes/Delivery.tsx src/delivery/messageStore.ts tests/delivery/messageStore.test.ts tests/components/delivery/DeliveryPage.test.tsx tests/components/delivery/DeliveryComposer.test.tsx
git diff --cached --check
git commit -m "feat: rewire delivery around conversations"
```

Post a Lisa Hahn buzz with commit hash, route behavior, composer boundary, and verification command.

## Task 5: Asset Library Scope And Compatibility Cleanup

**Owner:** Asset and compatibility subagent.

**Files:**

- Modify: `src/components/delivery/DeliveryAssetLibrary.tsx`
- Modify: `tests/components/delivery/DeliveryAssetLibrary.test.tsx`
- Modify: `tests/components/delivery/AssetPreviewDialog.test.tsx` only if scope labels affect queries.
- Modify: `src/components/delivery/AssetPreviewCard.tsx` only if type compatibility with `ParsedDeliveryAsset` and `DeliveryAssetRecord` breaks after Task 4.
- Modify: `src/i18n/zh-CN.ts`

- [ ] **Step 1: Write failing asset scope tests**

Extend `DeliveryAssetLibrary` tests:

```ts
it('shows an All scope label for all provider assets', () => {
  render(<DeliveryAssetLibrary assets={[asset({ filename: 'one.png' }), asset({ filename: 'two.png' })]} scopeLabel="全部成果" />)

  expect(screen.getByText('全部成果')).toBeInTheDocument()
  expect(screen.getByText('2 个成果')).toBeInTheDocument()
})
```

```ts
it('shows an order scope label for a selected order tab', () => {
  render(<DeliveryAssetLibrary assets={[asset({ filename: 'one.png' })]} scopeLabel="当前订单成果" />)

  expect(screen.getByText('当前订单成果')).toBeInTheDocument()
  expect(screen.getByText('1 个成果')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- tests/components/delivery/DeliveryAssetLibrary.test.tsx
```

Expected: fails because `scopeLabel` is unsupported.

- [ ] **Step 3: Implement scoped asset library**

Change props to:

```ts
interface DeliveryAssetLibraryProps {
  assets: ParsedDeliveryAsset[]
  scopeLabel?: string
}
```

Render `scopeLabel` under the `成果库` heading when present. Keep existing filters, preview, copy one link, and copy all links behavior unchanged.

- [ ] **Step 4: Run asset tests**

Run:

```bash
npm test -- tests/components/delivery/DeliveryAssetLibrary.test.tsx tests/components/delivery/AssetPreviewCard.test.tsx tests/components/delivery/AssetPreviewDialog.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Commit and journal**

Run:

```bash
git add src/components/delivery/DeliveryAssetLibrary.tsx tests/components/delivery/DeliveryAssetLibrary.test.tsx tests/components/delivery/AssetPreviewDialog.test.tsx src/components/delivery/AssetPreviewCard.tsx src/i18n/zh-CN.ts
git diff --cached --check
git commit -m "feat: scope delivery asset library"
```

Post a Lisa Hahn buzz with commit hash, asset scoping behavior, and verification command.

## Task 6: End-To-End Verification And Release Notes

**Owner:** Final integration subagent.

**Files:**

- Modify: `docs/superpowers/acceptance/2026-06-03-delivery-conversation-first-redesign.md`

This task is docs-only. If verification exposes a code defect, stop this task,
create a targeted fix task with exact files and tests, commit and journal that
fix separately, then restart Task 6 from Step 1.

- [ ] **Step 1: Run focused Delivery suite**

Run:

```bash
npm test -- tests/order/flow.test.ts tests/order/buildOrderPayload.test.ts tests/delivery/orderStore.test.ts tests/delivery/orderParser.test.ts tests/delivery/protocol.test.ts tests/delivery/conversationWorkspace.test.ts tests/delivery/workspace.test.ts tests/delivery/sessionGrouping.test.ts tests/delivery/messageStore.test.ts tests/components/delivery/DeliveryPage.test.tsx tests/components/delivery/DeliveryConversationList.test.tsx tests/components/delivery/DeliveryConversationHeader.test.tsx tests/components/delivery/DeliveryOrderTabs.test.tsx tests/components/delivery/DeliveryStatusTimeline.test.tsx tests/components/delivery/DeliveryWorkspaceHeader.test.tsx tests/components/delivery/DeliveryAssetLibrary.test.tsx tests/components/delivery/DeliveryComposer.test.tsx
```

Expected: all listed suites pass.

- [ ] **Step 2: Run full local verification**

Run:

```bash
npm test
npm run typecheck
npm run build
npm run smoke:metaso-p2p
```

Expected: all commands pass.

If `npm run smoke:metaso-p2p` or browser acceptance proves the current
metaso-p2p payloads are missing required fields, do not change BotHub to guess
around the missing backend data. Document the backend gap in a metaso-p2p issue
with failing URL or socket payload, expected shape, actual shape, BotHub impact,
and reproduction steps.

- [ ] **Step 3: Start dev server for browser acceptance**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: Vite prints a local URL such as `http://127.0.0.1:5173/`. Keep the server running for browser checks.

- [ ] **Step 4: Browser acceptance with Chrome and Metalet**

Using Chrome with Metalet connected:

1. Open `/delivery`.
2. Confirm the left panel title is `服务方会话`.
3. Confirm a provider with multiple orders appears as one row.
4. Confirm `All` is selected by default.
5. Confirm `All` shows ordinary private chat plus order and delivery protocol messages in chronological order.
6. Confirm the composer is visible in `All`.
7. Select an order tab.
8. Confirm the composer is hidden.
9. Confirm the timeline and asset library only show that order's relevant messages/assets.
10. Refresh the page.
11. Confirm IndexedDB recovery restores the same provider and order tab.

Record evidence in:

```text
docs/superpowers/acceptance/2026-06-03-delivery-conversation-first-redesign.md
```

Use this format:

```md
# Delivery Conversation-First Redesign Acceptance

- Date:
- Branch:
- Commit:
- Dev URL:
- Wallet:
- Scenario:
- Result:
- Evidence:
- Notes:
```

- [ ] **Step 5: Stop dev server and inspect worktree**

Run:

```bash
git status --short
```

Expected: only intentional files from verification are changed.

- [ ] **Step 6: Commit and journal**

Run:

```bash
git add docs/superpowers/acceptance/2026-06-03-delivery-conversation-first-redesign.md
git diff --cached --check
git commit -m "docs: record delivery conversation acceptance"
```

Post a Lisa Hahn buzz with commit hash, commands run, browser acceptance result,
and any remaining risks.

## Final Review Gate

After all tasks are complete:

1. Run a final code-review subagent over the full branch.
2. Confirm no order-centered left-nav behavior remains in Delivery.
3. Confirm every order tab is read-only.
4. Confirm every `All` send persists with no order correlation.
5. Confirm `git status --short` has only unrelated pre-existing untracked files.
6. Use `superpowers:finishing-a-development-branch` for merge or PR closeout.

Do not merge into `main` without explicit user approval. When merging completed work into `main`, use:

```bash
git merge --no-ff codex/delivery-conversation-first
```
