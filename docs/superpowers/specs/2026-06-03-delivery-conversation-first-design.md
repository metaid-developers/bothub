# Delivery Conversation-First Redesign

## Status

Approved direction from product discussion on 2026-06-03. This spec replaces
the order-centered Delivery workspace direction as the target product shape.
Implementation still needs a separate plan.

## Goal

Delivery should feel like a long-running conversation with each provider bot,
not a list of separate order sessions. A user opens one bot/provider thread and
sees all private chat, order requests, status updates, and delivery messages in
one chronological timeline. Orders remain first-class, but as filters and
delivery summaries inside that bot conversation.

This better matches the actual transport: private chat and order delivery both
use `/protocols/simplemsg`, and users often need to talk with a bot before,
during, and after paid or free service requests.

## Non-Goals

- Do not split one provider into multiple left-nav sessions just because the
  user placed multiple orders.
- Do not turn order tabs into separate chat rooms.
- Do not add new provider-side runtime behavior.
- Do not require a BotHub backend.
- Do not require metaso-p2p changes unless current history/socket payloads
  cannot expose peer, message, order, or asset data reliably.
- Do not implement refund or rating execution in this redesign; keep reserved
  UI/action slots and data hooks only.

## Product Model

### Primary Entity: Bot Conversation

Left navigation is a list of bot/provider conversations. One row represents one
peer identity, with profile, latest message, unread/sync state, active order
count, and asset count.

Conversation identity should prefer the provider `globalMetaId`. If historical
payloads use aliases for the same provider, such as address identity and
canonical globalMetaId, merge only when profile/chat pubkey evidence is strong
and non-conflicting.

### Secondary Entity: Order Thread

Each conversation derives zero or more order threads. An order thread is the
existing order-aware grouping concept. For new skill-service orders, the
`/protocols/skill-service-order` pin id is the canonical order id and must be
stored and routed as `orderPinId` or `serviceOrderPinId`.

`paymentTxid` and old random `orderReference` values are compatibility aliases
and payment references, not the primary order id. Legacy records that do not
have an order pin id still resolve through `paymentTxid`, `orderReference`, or a
protocol tag id.

Order threads are used for:

- top tabs inside the selected conversation,
- status/progress cards,
- order-specific asset filtering,
- reserved refund/rating actions,
- deep links to a specific order view.

They are not used as the left navigation entity.

## Layout

### Left Panel

Replace `DeliveryOrderList` as the primary left panel with a provider
conversation list:

- bot avatar/name,
- latest message preview,
- latest activity time,
- active/delivered/failed order indicators,
- total delivered asset count.

The left panel should not show one row per order.

### Center Panel

The selected provider conversation shows:

- provider header with profile and sync/decrypt state,
- a tab row: `All` followed by order tabs,
- timeline content,
- composer only when `All` is selected.

`All` is the default and shows every message with the selected provider in
timestamp order. Private chat, `[ORDER]`, `[ORDER_STATUS]`, `[DELIVERY]`,
`[ORDER_END]`, and `NeedsRating` all stay visible in one stream.

Order tabs are read-only filtered views. They do not show the composer. Users
who want to continue talking with the bot return to `All`.

### Right Panel

Keep the delivered asset library. Its data source follows the current tab:

- `All`: all assets from the selected bot conversation.
- order tab: assets associated with that order thread.

When an order tab is selected, the right panel should make it clear that the
asset list is scoped to that order. When `All` is selected, it is the full asset
history with that bot.

## Message Assignment

Every message belongs to exactly one provider conversation. A message may also
belong to zero or one order thread.

Order-thread assignment uses a hybrid rule:

1. Explicit correlation wins. Use persisted `orderCorrelationId`,
   `[ORDER_STATUS:<id>]`, `[DELIVERY:<id>]`, `[ORDER_END:<id>]`,
   `[NeedsRating:<id>]`, parsed `[ORDER]` metadata, `order pin id: <pinid>`,
   `orderPinId`, `serviceOrderPinId`, or known ids mentioned in message text.
   If both a payment/reference id and an order pin id are present, normalize to
   the order pin id.
2. If no explicit id exists, assign protocol-like order messages to a single
   active order when timing makes the match unambiguous.
3. If multiple orders are active and the message has no explicit id, leave it
   only in `All`.
4. Plain private chat stays only in `All` unless it explicitly mentions a known
   order id.

This supports multiple parallel orders without forcing ambiguous messages into
the wrong order.

## Sending Messages

The composer exists only in `All`.

Messages sent from `All` are ordinary private chat follow-ups to the provider.
BotHub does not inject order metadata, hidden prefixes, or synthetic order
context into the outbound message.

Order tabs are read-only. They can expose order actions, but not free-text chat.

## IndexedDB Compatibility

Keep existing persisted tables where possible:

- `orders` remains the authoritative local record for buyer-initiated requests.
- `messages` remains message-level history.
- `assets` remains asset-level history.
- existing `sessions` records remain readable as compatibility data.

Add or derive a conversation-first workspace model rather than deleting current
records. The first implementation should prefer derived selectors over a
destructive migration:

- derive conversations from `messages`, `orders`, and historical `sessions`,
- derive order threads inside each conversation using current correlation logic,
- keep current session ids as aliases for asset recovery,
- write new skill-service orders with the `skill-service-order` pin id as the
  canonical `orderCorrelationId`, session/order suffix, tab id, and URL `order`
  parameter,
- write any new follow-up message against the provider conversation and no order
  correlation unless the inbound protocol later provides one.

If a schema addition is needed, use additive fields or stores only. Do not
delete existing order/session/message/asset data.

## Data Selectors

Create conversation-first selectors that replace the route's direct dependency
on `WorkspaceOrder[]`:

- `buildDeliveryConversations(input): DeliveryConversationWorkspace`
- `selectConversation(workspace, conversationId)`
- `selectOrderThread(conversation, orderCorrelationId)`
- `messagesForConversation(conversation, filter)`
- `assetsForConversation(conversation, filter)`

The existing `buildDeliveryWorkspace()` logic can be reused internally for
order-thread derivation, but it should no longer drive the left navigation.

## UI Components

Expected component changes:

- Replace or wrap `DeliveryOrderList` with `DeliveryConversationList`.
- Add `DeliveryConversationHeader`.
- Add `DeliveryOrderTabs`.
- Update `MessageList` or route filtering so it supports `all` and
  `order:<correlation>` views.
- Keep `DeliveryAssetLibrary`, but drive it from the selected conversation and
  tab filter.
- Update `DeliveryWorkspaceHeader` and `DeliveryStatusTimeline` into
  order-tab-only surfaces or compact order cards.
- Keep `DeliveryComposer`, but render it only for `All`.

## Deep Links

Support both current and future links:

- `?conversation=<providerGlobalMetaId>` selects a provider conversation.
- `?conversation=<providerGlobalMetaId>&order=<orderCorrelationId>` opens the
  provider conversation and selects an order tab. For new skill-service orders,
  `<orderCorrelationId>` is the `skill-service-order` pin id.
- Existing `?order=` or `?session=` links should resolve to the corresponding
  provider conversation and order tab when possible.

## Metaso-P2P Requirements

Current BotHub should implement this from existing private-chat history,
Socket.IO messages, provider profile lookup, and local order records unless
live validation proves one of those sources is missing required fields.

Ask metaso-p2p for changes only if live validation proves one of these is
missing or unreliable:

- stable peer identity for both directions of a private chat,
- provider profile/chat pubkey aliases,
- message timestamp and pin/tx identifiers,
- `skill-service-order` pin path and pin id for new service orders,
- historical page coverage for a selected wallet,
- order protocol payloads needed to recover correlation ids.

Any backend gap should be documented in a metaso-p2p issue with failing URL or
payload, expected shape, actual shape, BotHub impact, and reproduction steps.

## Testing

Unit coverage should prove:

- multiple orders with the same provider produce one conversation and multiple
  order tabs,
- `All` includes private chat plus all order protocol messages in timestamp
  order,
- order tabs include explicitly correlated messages and unambiguous inferred
  protocol messages,
- ambiguous unscoped messages remain only in `All`,
- the composer is available only in `All`,
- asset library scopes correctly for `All` and order tabs,
- existing order/session deep links still recover to the new conversation view,
- new skill-service order tabs key by `skill-service-order` pin id while
  `paymentTxid` and `orderReference` continue to work for legacy data,
- persisted assets survive reload even when live messages have not hydrated yet.

Component coverage should prove:

- left navigation rows are providers, not orders,
- order tabs render inside the selected provider conversation,
- switching tabs filters timeline and assets without changing the selected
  provider,
- order tabs are read-only and expose no free-text composer.

Manual acceptance should include a Chrome + Metalet connected-wallet run with:

- one provider and multiple orders,
- at least one ordinary private chat message,
- at least one delivered asset,
- `All` showing the full mixed timeline,
- an order tab showing only that order's relevant messages/assets,
- refresh recovery from IndexedDB and metaso-p2p history.

## Implementation Notes

This is a product-shape replacement, not a small refactor. Implement it in
phases:

1. Build the conversation-first selectors and tests.
2. Add the provider conversation list and URL selection compatibility.
3. Add order tabs and read-only filtered order views.
4. Rewire asset library scoping.
5. Update IndexedDB recovery/deep links.
6. Run real wallet-connected browser acceptance.

Avoid speculative styling changes outside Delivery. Keep current visual language
unless a component must change to support the new hierarchy.
