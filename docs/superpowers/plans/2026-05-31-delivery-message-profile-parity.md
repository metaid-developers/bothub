# Delivery Message/Profile Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. The user wants one fresh subagent per task or phase, with the controller reviewing and sending the same task subagent back for rework until it passes. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make BotHub Delivery behave like the caller-side private chat view in `idframework/demo-chat`: provider/counterparty messages decrypt reliably, profile names and avatars render throughout Delivery, and follow-up messages can be sent from the Delivery input box.

**Architecture:** Keep BotHub as a pure frontend React app using meta-socket for profile, private-chat history, and Socket.IO events. Reuse the existing Delivery store, IndexedDB cache, and ECDH AES crypto path; add the missing profile hydration and re-decryption loop so messages that arrived before a chat key was available can repair themselves after profile data loads.

**Tech Stack:** Vite 5, React 18, TypeScript 5 strict, Tailwind CSS, zustand, IndexedDB, socket.io-client, CryptoJS, Vitest + Testing Library, Chrome + Metalet for manual acceptance.

---

## 0. Scope And Non-Goals

This task is only the Delivery private-chat foundation:

- Decrypt provider/counterparty private simplemsg messages.
- Render provider/counterparty names and avatars in session list, header, and message bubbles.
- Make Delivery follow-up sending usable when the provider chat key is available from session, order, message, or fetched profile.
- Keep socket and history messages on the same normalize/decrypt/profile path.

Do not implement:

- Refunds.
- Ratings.
- Provider-side workflows.
- Rich delivered asset management beyond making decrypted messages and existing asset previews work.
- Any dedicated BotHub backend.

If an observed failure is caused by missing or broken meta-socket data, create an issue markdown file in:

```text
/Users/tusm/Documents/MetaID_Projects/meta-socket/issues/
```

Use a filename like `YYYY-MM-DD-bothub-delivery-profile-gap.md`, include the failing URL, expected shape, actual shape, and BotHub impact.

## 1. Reference Sources

Read these before coding:

- `docs/architecture/meta-socket-local-api.md`
- `src/routes/Delivery.tsx`
- `src/delivery/decrypt.ts`
- `src/delivery/deliverySync.ts`
- `src/delivery/messageStore.ts`
- `src/delivery/sessionGrouping.ts`
- `src/delivery/sendMessage.ts`
- `src/ws/privateChat.ts`
- `src/api/userProfile.ts`
- `src/wallet/metalet.ts`
- `/Users/tusm/Documents/MetaID_Projects/idframework/idframework/commands/FetchChatListCommand.js`
- `/Users/tusm/Documents/MetaID_Projects/idframework/idframework/commands/SendChatMessageCommand.js`

demo-chat behavior to preserve:

- Private text path is `/protocols/simplemsg`.
- Private text body uses `to`, `encrypt: 'ecdh'`, AES encrypted `content`, `contentType: 'text/plain'`, `timestamp`, and optional `replyPin`.
- Shared secret comes from `window.metaidwallet.common.ecdh({ externalPubKey })` when available. BotHub already wraps this in `src/wallet/metalet.ts`.
- Private decrypt uses the peer chat public key -> Metalet ECDH shared secret -> AES decrypt. Do not call ECIES for standard private simplemsg.
- Profile display fields come from chat payload `userInfo`/`fromUserInfo`/`createUserInfo` first, then cached store, then `/api/info/globalmetaid/:globalMetaId`.

## 2. Current Diagnosis

Several useful pieces already exist, but they do not yet close the user-visible gap:

- `src/delivery/decrypt.ts` no longer does ECIES fallback, which prevents the repeated Metalet ECIES popup.
- `src/delivery/deliverySync.ts` can fetch a peer profile if the private chat payload lacks a chat key.
- `src/routes/Delivery.tsx` can fetch a selected provider profile and apply profile fallback to display messages.
- However, if a message was first stored as ciphertext because the peer chat key was missing, `Delivery.tsx` later attaches the fetched key to the message object but does not re-run decryption. The UI can still show ciphertext even after the key is known.
- Session list avatar/name hydration is mostly selected-session driven. Non-selected visible sessions can continue showing initials and truncated IDs.
- `src/ws/privateChat.ts` normalizes common fields, but it should explicitly cover demo-chat/meta-socket variants such as `createUserInfo`, `receiveUserInfo`, `chat_public_key`, `chatPublicKeyPinId`, and alternate `from`/`to` aliases.
- `src/delivery/sendMessage.ts` should reuse the createPin response-lost handling from the order flow so a successful wallet broadcast with lost extension response does not look like a hard send failure.

## 3. File Plan

Create:

- `src/delivery/peerProfile.ts`  
  Small pure helpers for extracting and merging peer profile fields from private-chat user info and user profile API results.

- `src/delivery/decryptRetry.ts`  
  Store-aware helper that retries decrypting existing ciphertext messages after a peer chat key becomes available, then persists successful replacements to IndexedDB.

- `tests/delivery/peerProfile.test.ts`  
  Unit tests for profile field extraction and avatar URL normalization behavior at the Delivery boundary.

- `tests/delivery/decryptRetry.test.ts`  
  Unit tests for retrying decrypt after profile fetch and avoiding unnecessary wallet prompts.

Modify:

- `src/ws/privateChat.ts`  
  Normalize more private-chat field spellings and user-info shapes.

- `tests/ws/privateChat.test.ts`  
  Add coverage for `createUserInfo`, `receiveUserInfo`, and chat-key spellings.

- `src/delivery/deliverySync.ts`  
  Use `peerProfile.ts` helpers and keep history/socket profile resolution behavior equivalent or better.

- `tests/delivery/deliverySync.test.ts`  
  Keep existing tests passing; add one regression if helper extraction changes behavior.

- `src/routes/Delivery.tsx`  
  Fetch profiles for selected and visible sessions that need name/avatar/chat key/decrypt repair, then call `retryDecryptPeerMessages` when a chat key arrives.

- `tests/components/delivery/DeliveryPage.test.tsx`  
  Prove profile fetch triggers re-decryption and session/profile display repairs.

- `src/delivery/sendMessage.ts`  
  Treat Chrome/Metalet response-lost createPin errors as indeterminate success with a local pending pin id, matching the order flow fix.

- `tests/delivery/sendMessage.test.ts`  
  Add response-lost follow-up test and keep explicit wallet failures as failures.

- `src/api/userProfile.ts`  
  Add only missing avatar URL normalization cases discovered while matching demo-chat. Do not broaden API behavior beyond profile fields.

- `tests/api/userProfile.test.ts`  
  Add avatar normalization tests for `/api/v1/users/avatar/accelerate/...`, `/users/avatar/accelerate/...`, and `file.metaid.io` content URLs if not already covered.

## 4. Implementation Tasks

### Task 1: Normalize Private-Chat Peer Profile Inputs

**Files:**

- Create: `src/delivery/peerProfile.ts`
- Create: `tests/delivery/peerProfile.test.ts`
- Modify: `src/ws/privateChat.ts`
- Modify: `tests/ws/privateChat.test.ts`
- Modify: `src/delivery/deliverySync.ts`

- [ ] **Step 1: Write tests for private chat field aliases**

Add tests to `tests/ws/privateChat.test.ts` proving `normalizePrivateChatItem()` handles at least:

```ts
expect(normalizePrivateChatItem({
  from: 'idqprovider',
  to: 'idqbuyer',
  content: 'cipher',
  timestamp: 1,
  path: '/protocols/simplemsg',
  encrypt: 'ecdh',
  createUserInfo: {
    globalmetaid: 'idqprovider',
    name: 'Provider Bot',
    avatarImage: 'metafile://'.concat('a'.repeat(64), 'i0.png'),
    chat_public_key: 'provider-chat-key',
  },
  receiveUserInfo: {
    globalMetaId: 'idqbuyer',
    chatPublicKey: 'buyer-chat-key',
  },
})).toEqual(expect.objectContaining({
  fromGlobalMetaId: 'idqprovider',
  toGlobalMetaId: 'idqbuyer',
  fromUserInfo: expect.objectContaining({
    name: 'Provider Bot',
    chatPublicKey: 'provider-chat-key',
  }),
  toUserInfo: expect.objectContaining({
    chatPublicKey: 'buyer-chat-key',
  }),
}))
```

Expected before implementation: at least one alias is missing or incomplete.

- [ ] **Step 2: Create peer profile helper tests**

Create `tests/delivery/peerProfile.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  mergePeerProfiles,
  peerProfileFromPrivateChatUserInfo,
  peerProfileFromUserProfile,
  peerProfileNeedsHydration,
} from '@/delivery/peerProfile'

describe('peerProfile helpers', () => {
  it('extracts display and chat key fields from private-chat userInfo aliases', () => {
    expect(peerProfileFromPrivateChatUserInfo({
      name: 'Provider Bot',
      avatarImage: 'metafile://'.concat('b'.repeat(64), 'i0.png'),
      chatpubkey: 'provider-key',
    })).toEqual(expect.objectContaining({
      name: 'Provider Bot',
      chatPubkey: 'provider-key',
      avatarUrl: expect.stringContaining('/api/v1/users/avatar/accelerate/'),
    }))
  })

  it('merges without overwriting useful earlier fields', () => {
    expect(mergePeerProfiles(
      { chatPubkey: 'key-1' },
      { chatPubkey: 'key-2', name: 'Profile Name' },
    )).toEqual({ chatPubkey: 'key-1', name: 'Profile Name' })
  })

  it('requires hydration when name, avatar, or chat key is missing', () => {
    expect(peerProfileNeedsHydration({ chatPubkey: 'key' })).toBe(true)
    expect(peerProfileNeedsHydration({
      chatPubkey: 'key',
      name: 'Provider',
      avatarUrl: 'https://cdn.example/avatar.png',
    })).toBe(false)
  })

  it('extracts fetched user profile fields', () => {
    expect(peerProfileFromUserProfile({
      name: 'Fetched Bot',
      avatarUrl: 'https://cdn.example/fetched.png',
      chatPubkey: 'fetched-key',
    })).toEqual({
      name: 'Fetched Bot',
      avatarUrl: 'https://cdn.example/fetched.png',
      chatPubkey: 'fetched-key',
    })
  })
})
```

Expected before implementation: module does not exist.

- [ ] **Step 3: Implement `src/delivery/peerProfile.ts`**

Use a pure module:

```ts
import { normalizeAvatarUrl, type UserProfile } from '@/api/userProfile'
import type { PrivateChatUserInfo } from '@/ws/privateChat'

export interface PeerProfile {
  chatPubkey?: string
  name?: string
  avatarUrl?: string
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

export function mergePeerProfiles(...profiles: Array<PeerProfile | undefined>): PeerProfile {
  const merged: PeerProfile = {}
  for (const profile of profiles) {
    if (!profile) continue
    merged.chatPubkey ||= clean(profile.chatPubkey)
    merged.name ||= clean(profile.name)
    merged.avatarUrl ||= clean(profile.avatarUrl)
  }
  return merged
}

export function peerProfileNeedsHydration(profile: PeerProfile | undefined): boolean {
  return !clean(profile?.chatPubkey) || !clean(profile?.name) || !clean(profile?.avatarUrl)
}

export function peerProfileFromPrivateChatUserInfo(info: PrivateChatUserInfo | undefined): PeerProfile {
  if (!info) return {}
  return {
    chatPubkey: clean(info.chatPublicKey) || clean(info.chatPubkey) || clean(info.chatpubkey),
    name: clean(info.name),
    avatarUrl: normalizeAvatarUrl(
      clean(info.avatarUrl) || clean(info.avatarImage) || clean(info.avatar),
      clean(info.avatarId) || clean(info.avatarPinId),
    ),
  }
}

export function peerProfileFromUserProfile(profile: UserProfile | undefined): PeerProfile {
  if (!profile) return {}
  return {
    chatPubkey: clean(profile.chatPubkey),
    name: clean(profile.name),
    avatarUrl: clean(profile.avatarUrl),
  }
}
```

- [ ] **Step 4: Expand `normalizePrivateChatItem()` user info aliases**

In `src/ws/privateChat.ts`, keep the current public shape but normalize more raw variants into `fromUserInfo` and `toUserInfo`:

```ts
const createUserInfo = normalizeUserInfo(row.createUserInfo ?? row.create_user_info)
const receiveUserInfo = normalizeUserInfo(
  row.receiveUserInfo ?? row.receive_user_info ?? row.targetUserInfo ?? row.target_user_info,
)
const fromUserInfo = normalizeUserInfo(
  row.fromUserInfo ?? row.from_user_info ?? row.userInfo ?? row.user_info,
) ?? createUserInfo
const toUserInfo = normalizeUserInfo(row.toUserInfo ?? row.to_user_info) ?? receiveUserInfo
```

Also add accepted global/meta/chat/avatar spellings only where tests prove they are needed. Do not invent unrelated fields.

- [ ] **Step 5: Replace duplicate Delivery profile helper code**

In `src/delivery/deliverySync.ts`, replace local `PeerProfile`, `mergePeerProfiles`, `peerProfileFromUserInfo`, and `peerProfileFromUserProfile` implementations with imports from `src/delivery/peerProfile.ts`.

Do not change the resolution order:

1. private chat payload userInfo
2. in-memory messages
3. IndexedDB sessions/orders
4. fetched profile API

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm vitest run tests/ws/privateChat.test.ts tests/delivery/peerProfile.test.ts tests/delivery/deliverySync.test.ts
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/delivery/peerProfile.ts tests/delivery/peerProfile.test.ts src/ws/privateChat.ts tests/ws/privateChat.test.ts src/delivery/deliverySync.ts tests/delivery/deliverySync.test.ts
git commit -m "fix: normalize delivery peer profiles"
```

Post an Eric development-journal buzz after the commit.

### Task 2: Retry Decryption After Profile Chat Key Hydration

**Files:**

- Create: `src/delivery/decryptRetry.ts`
- Create: `tests/delivery/decryptRetry.test.ts`
- Modify: `src/delivery/messageStore.ts` only if a tiny exported selector/action is needed

- [ ] **Step 1: Write the failing retry-decrypt tests**

Create `tests/delivery/decryptRetry.test.ts`. Use fake IndexedDB like `tests/delivery/deliverySync.test.ts`.
Import `buildSessionId` from `@/delivery/domain` for DB assertions instead of hard-coding session ids.

Core test:

```ts
it('replaces stored ciphertext after a fetched profile provides the peer chat key', async () => {
  vi.mocked(decryptIncoming).mockResolvedValue({
    plaintext: 'decrypted provider reply',
  })

  await persistDeliveryMessage({
    walletGlobalMetaId: SELF,
    message: {
      id: 'pin-encrypted',
      peerGlobalMetaId: PEER,
      fromGlobalMetaId: PEER,
      toGlobalMetaId: SELF,
      content: 'U2FsdGVkX1+ciphertext',
      rawContent: 'U2FsdGVkX1+ciphertext',
      encryption: 'ecdh',
      contentType: 'text/plain',
      timestamp: 1,
      pinId: 'pin-encrypted',
      decryptError: 'missing key',
    },
  })
  await useMessageStore.getState().hydrateFromDb(SELF)

  const result = await retryDecryptPeerMessages({
    walletIdentity: wallet,
    peerGlobalMetaId: PEER,
    peerProfile: {
      chatPubkey: 'provider-chat-key',
      name: 'Provider Bot',
      avatarUrl: 'https://cdn.example/provider.png',
    },
  })

  expect(result).toEqual({ attempted: 1, updated: 1 })
  expect(useMessageStore.getState().messagesForSession(PEER, SELF)).toEqual([
    expect.objectContaining({
      content: 'decrypted provider reply',
      rawContent: 'U2FsdGVkX1+ciphertext',
      decryptError: undefined,
      peerChatPubkey: 'provider-chat-key',
      peerName: 'Provider Bot',
      peerAvatarUrl: 'https://cdn.example/provider.png',
    }),
  ])
  const sessionId = buildSessionId({
    walletGlobalMetaId: SELF,
    providerGlobalMetaId: PEER,
  })
  expect(await getMessagesForSession(sessionId)).toEqual([
    expect.objectContaining({
      content: 'decrypted provider reply',
      rawContent: 'U2FsdGVkX1+ciphertext',
      decryptStatus: 'decrypted',
      decryptError: undefined,
    }),
  ])
})
```

Also add tests:

- No chat key -> `{ attempted: 0, updated: 0 }`.
- Plain messages are not retried.
- Failed retry keeps old ciphertext and records debug, but does not throw. Cover both forms:
  - `decryptIncoming()` resolves `{ plaintext: rawContent, error: 'wallet ecdh failed' }`.
  - `decryptIncoming()` rejects with an exception.

Expected before implementation: module does not exist.

- [ ] **Step 2: Implement `src/delivery/decryptRetry.ts`**

Implementation shape:

```ts
import { decryptIncoming } from '@/delivery/decrypt'
import { persistDeliveryMessage, useMessageStore, type DeliveryMessage } from '@/delivery/messageStore'
import type { PeerProfile } from '@/delivery/peerProfile'
import type { WalletIdentity } from '@/wallet/types'

export interface RetryDecryptPeerMessagesResult {
  attempted: number
  updated: number
}

function looksEncrypted(message: DeliveryMessage): boolean {
  const raw = message.rawContent.trim()
  const encryption = message.encryption.trim().toLowerCase()
  if (!raw) return false
  if (message.content !== message.rawContent && !message.decryptError) return false
  return (
    Boolean(message.decryptError) ||
    encryption === 'ecdh' ||
    raw.startsWith('U2FsdGVkX1') ||
    (raw.length >= 32 && !/\s/.test(raw))
  )
}

export async function retryDecryptPeerMessages(input: {
  walletIdentity: WalletIdentity
  peerGlobalMetaId: string
  peerProfile: PeerProfile
  pushDebug?: (line: string) => void
}): Promise<RetryDecryptPeerMessagesResult> {
  const walletGlobalMetaId = input.walletIdentity.globalMetaId.trim()
  const peerGlobalMetaId = input.peerGlobalMetaId.trim()
  const peerChatPubKey = input.peerProfile.chatPubkey?.trim() ?? ''
  if (!walletGlobalMetaId || !peerGlobalMetaId || !peerChatPubKey) {
    return { attempted: 0, updated: 0 }
  }

  const messages = useMessageStore.getState().byPeer[peerGlobalMetaId] ?? []
  let attempted = 0
  let updated = 0

  for (const message of messages) {
    if (!looksEncrypted(message)) continue
    attempted += 1
    try {
      const result = await decryptIncoming({
        content: message.rawContent,
        protocol: '/protocols/simplemsg',
        encryption: message.encryption,
        peerChatPubKey,
        messageId: message.id,
      })
      if (result.error) {
        input.pushDebug?.(
          `[decrypt] retry failed for ${peerGlobalMetaId.slice(0, 8)}…: ${result.error}`,
        )
        continue
      }
      if (!result.plaintext || result.plaintext === message.rawContent) continue

      const next: DeliveryMessage = {
        ...message,
        content: result.plaintext,
        peerChatPubkey: peerChatPubKey,
        peerName: input.peerProfile.name?.trim() || message.peerName,
        peerAvatarUrl: input.peerProfile.avatarUrl?.trim() || message.peerAvatarUrl,
        decryptError: undefined,
      }
      useMessageStore.getState().append(next)
      await persistDeliveryMessage({ walletGlobalMetaId, message: next })
      updated += 1
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      input.pushDebug?.(`[decrypt] retry failed for ${peerGlobalMetaId.slice(0, 8)}…: ${detail}`)
    }
  }

  return { attempted, updated }
}
```

Keep this helper small. It should not fetch profiles itself.

- [ ] **Step 3: Run focused tests**

Run:

```bash
pnpm vitest run tests/delivery/decryptRetry.test.ts tests/delivery/decrypt.test.ts tests/delivery/messageStore.test.ts
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/delivery/decryptRetry.ts tests/delivery/decryptRetry.test.ts src/delivery/messageStore.ts
git commit -m "fix: retry delivery decrypt after profile hydration"
```

Post an Eric development-journal buzz after the commit.

### Task 3: Hydrate Delivery Profiles And Trigger Re-Decrypt From The Route

**Files:**

- Modify: `src/routes/Delivery.tsx`
- Modify: `tests/components/delivery/DeliveryPage.test.tsx`

- [ ] **Step 1: Add tests for route-level profile hydration**

In `tests/components/delivery/DeliveryPage.test.tsx`, mock `retryDecryptPeerMessages`:

```ts
vi.mock('@/delivery/decryptRetry', () => ({
  retryDecryptPeerMessages: vi.fn().mockResolvedValue({ attempted: 1, updated: 1 }),
}))
```

Add a test where:

- wallet is connected
- selected session has a ciphertext message with `decryptError`
- `fetchUserProfileByGlobalMetaId()` resolves `{ name, avatarUrl, chatPubkey }`

Expected assertions:

```ts
expect(fetchUserProfileByGlobalMetaId).toHaveBeenCalledWith(peerGlobalMetaId)
expect(retryDecryptPeerMessages).toHaveBeenCalledWith(expect.objectContaining({
  walletIdentity: mocks.walletState.identity,
  peerGlobalMetaId,
  peerProfile: expect.objectContaining({ chatPubkey: 'profile-key' }),
}))
```

Add a second test for visible session profile hydration:

- two sessions in `byPeer`
- both lack `peerName` and `peerAvatarUrl`
- route fetches profile for the visible sessions, not only the selected one
- after fetch resolves, names/images appear in the sessions list

Expected before implementation: selected fetch may happen, but retry decrypt will not be called and non-selected profile fetch will likely not happen.

- [ ] **Step 2: Add tests that prevent profile request storms**

Add a test where `fetchUserProfileByGlobalMetaId()` rejects for a peer and then the route re-renders with the same `byPeer` state.

Expected assertions:

```ts
expect(fetchUserProfileByGlobalMetaId).toHaveBeenCalledTimes(1)
expect(retryDecryptPeerMessages).not.toHaveBeenCalled()
```

Also add a test where `fetchUserProfileByGlobalMetaId()` resolves `{}`. The route should not refetch the same peer repeatedly in the same mounted page session.

Add a third test for manual retry:

- first profile request resolves `{}`
- user clicks `Fetch provider key`
- route performs one additional network request for that peer

Expected assertion:

```ts
expect(fetchUserProfileByGlobalMetaId).toHaveBeenCalledTimes(2)
```

This is a runtime requirement, not only a test-stability guard.

- [ ] **Step 3: Refactor profile fetching into one guarded callback**

In `src/routes/Delivery.tsx`, replace `fetchSelectedProviderProfile` with a peer-id based helper:

First update the React import to include `useRef`:

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
```

```ts
const providerProfileRequestsRef = useRef<Set<string>>(new Set())
const providerProfileAttemptedRef = useRef<Set<string>>(new Set())

const fetchProviderProfile = useCallback(async (
  providerGlobalMetaId: string,
  options: { force?: boolean } = {},
) => {
  const peer = providerGlobalMetaId.trim()
  const force = options.force === true
  if (
    !peer ||
    providerProfileRequestsRef.current.has(peer) ||
    (!force && (providerProfiles[peer] || providerProfileAttemptedRef.current.has(peer)))
  ) {
    return providerProfiles[peer]
  }

  providerProfileRequestsRef.current.add(peer)
  providerProfileAttemptedRef.current.add(peer)
  setProviderProfileLoading((current) => ({ ...current, [peer]: true }))
  try {
    const profile = await fetchUserProfileByGlobalMetaId(peer)
    setProviderProfiles((current) => ({ ...current, [peer]: profile }))
    if (identity && profile.chatPubkey?.trim()) {
      void retryDecryptPeerMessages({
        walletIdentity: identity,
        peerGlobalMetaId: peer,
        peerProfile: {
          chatPubkey: profile.chatPubkey,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
        },
      }).catch((error) => {
        console.warn('Could not retry delivery decrypt.', error)
      })
    }
    return profile
  } catch (error) {
    console.warn('Could not fetch provider profile.', error)
    return undefined
  } finally {
    providerProfileRequestsRef.current.delete(peer)
    setProviderProfileLoading((current) => ({ ...current, [peer]: false }))
  }
}, [identity, providerProfiles])
```

Avoid calling this callback directly for every render. Effects below should gate calls.

Notes:

- `providerProfileAttemptedRef` intentionally prevents repeated same-page retries for failed or empty profiles.
- The manual `Fetch provider key` action must call `fetchProviderProfile(peer, { force: true })`. The `force` option bypasses a cached empty profile and the attempted guard, but it still respects an in-flight request.
- This route-level fetch only needs to hydrate the current page view and trigger decrypt repair. It does not have to persist profile-only updates when no message changes. If a decrypt retry succeeds, persistence happens through `retryDecryptPeerMessages()`.

- [ ] **Step 4: Fetch profile for selected session when needed**

Keep the current selected-session behavior, but include decrypt repair as a reason:

```ts
const selectedHasDecryptGap = messages.some(
  (message) =>
    message.peerGlobalMetaId === selectedSessionDetails?.peerGlobalMetaId &&
    (message.decryptError || (message.content === message.rawContent && message.encryption.toLowerCase() === 'ecdh')),
)

useEffect(() => {
  const peer = selectedSessionDetails?.peerGlobalMetaId.trim()
  if (!peer || providerProfiles[peer]) return
  const needsChatKey = !selectedProviderChatPubkey
  const needsDisplayProfile = !hasDisplayProfile(selectedSessionDetails)
  if (!needsChatKey && !needsDisplayProfile && !selectedHasDecryptGap) return
  void fetchProviderProfile(peer)
}, [
  fetchProviderProfile,
  providerProfiles,
  selectedHasDecryptGap,
  selectedProviderChatPubkey,
  selectedSessionDetails,
])
```

- [ ] **Step 5: Fetch profiles for visible sessions conservatively**

Add an effect that hydrates visible sessions lacking display profile, capped to avoid request storms:

```ts
useEffect(() => {
  if (!walletConnected) return
  const missingPeers = displaySessions
    .filter((session) => !providerProfiles[session.peerGlobalMetaId])
    .filter((session) => !hasDisplayProfile(session) || !session.providerChatPubkey?.trim())
    .map((session) => session.peerGlobalMetaId)
    .slice(0, 12)

  for (const peer of missingPeers) {
    void fetchProviderProfile(peer)
  }
}, [displaySessions, fetchProviderProfile, providerProfiles, walletConnected])
```

The `fetchProviderProfile()` guard above must prevent retry storms when a profile request fails or returns no useful fields. Keep the implementation understandable.

- [ ] **Step 6: Keep manual fetch button behavior**

Update `DeliveryComposer` props call site:

```tsx
onFetchProviderKey={
  selectedSessionDetails
    ? () => {
        void fetchProviderProfile(selectedSessionDetails.peerGlobalMetaId, { force: true })
      }
    : undefined
}
```

- [ ] **Step 7: Run focused tests**

Run:

```bash
pnpm vitest run tests/components/delivery/DeliveryPage.test.tsx tests/delivery/decryptRetry.test.ts tests/delivery/deliverySync.test.ts
```

Expected: all pass. The existing FocusTrap warnings are acceptable only if they already existed and tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/routes/Delivery.tsx tests/components/delivery/DeliveryPage.test.tsx
git commit -m "fix: hydrate delivery profiles in view"
```

Post an Eric development-journal buzz after the commit.

### Task 4: Tighten Avatar URL Parity With demo-chat

**Files:**

- Modify: `src/api/userProfile.ts`
- Modify: `tests/api/userProfile.test.ts`
- Optionally modify: `src/components/delivery/PeerAvatar.tsx`
- Optionally modify: `tests/components/delivery/MessageBubble.test.tsx`

- [ ] **Step 1: Add avatar normalization tests**

Add tests in `tests/api/userProfile.test.ts` for these inputs:

```ts
const pinId = `${'c'.repeat(64)}i0`
const expected = `/meta-socket/api/v1/users/avatar/accelerate/${pinId}?process=thumbnail`

expect(normalizeAvatarUrl(`/api/v1/users/avatar/accelerate/${pinId}?process=thumbnail`))
  .toBe(expected)

expect(normalizeAvatarUrl(`/users/avatar/accelerate/${pinId}?process=thumbnail`))
  .toBe(expected)

expect(normalizeAvatarUrl(`https://file.metaid.io/metafile-indexer/content/${pinId}`))
  .toBe(expected)
```

Use the existing test setup style: `vi.stubEnv('VITE_META_SOCKET_BASE_URL', '/meta-socket/')`, so expected URLs should start with `/meta-socket`.

- [ ] **Step 2: Implement only missing URL cases**

In `normalizeAvatarUrl()`:

- Keep `metafile://` -> `/api/v1/users/avatar/accelerate/:pinId?process=thumbnail`.
- Treat bare `/api/v1/...`, `/users/avatar/accelerate/...`, `/metafile-indexer/...`, and `/files/content/...` paths as meta-socket-relative URLs.
- Convert `file.metaid.io/metafile-indexer/content/:pinId` and `file.metaid.io/metafile-indexer/api/v1/files/content/:pinId` to the local accelerated avatar thumbnail when a pin id is present.
- Continue returning `undefined` for placeholder `/content/` values.

Do not add decorative avatar placeholders or change Delivery layout here.

- [ ] **Step 3: Optional PeerAvatar hardening**

Only if tests or real UI show image layout issues:

```tsx
<img
  loading="lazy"
  decoding="async"
  referrerPolicy="no-referrer"
  ...
/>
```

Do not change styles unless there is a visible overlap or sizing bug.

- [ ] **Step 4: Run focused tests**

Run:

```bash
pnpm vitest run tests/api/userProfile.test.ts tests/components/delivery/SessionHeader.test.tsx tests/components/delivery/SessionsList.test.tsx tests/components/delivery/MessageBubble.test.tsx
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/api/userProfile.ts tests/api/userProfile.test.ts src/components/delivery/PeerAvatar.tsx tests/components/delivery/MessageBubble.test.tsx
git commit -m "fix: normalize delivery avatar urls"
```

Only include optional files if actually changed. Post an Eric development-journal buzz after the commit.

### Task 5: Make Delivery Follow-Up Sending Match The Repaired Order Broadcast Semantics

**Files:**

- Modify: `src/delivery/sendMessage.ts`
- Modify: `tests/delivery/sendMessage.test.ts`
- Optionally modify: `src/components/delivery/DeliveryComposer.tsx`
- Optionally modify: `tests/components/delivery/DeliveryComposer.test.tsx`

- [ ] **Step 1: Add tests for response-lost follow-up handling**

In `tests/delivery/sendMessage.test.ts`, add:

```ts
it('treats Chrome response-lost createPin errors as pending follow-up success', async () => {
  const metalet = {
    ecdh: vi.fn().mockResolvedValue({ sharedSecret: 'shared-secret' }),
    createPin: vi.fn().mockRejectedValue(
      new Error('A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received'),
    ),
  }

  const result = await sendDeliveryFollowUp({
    wallet,
    providerGlobalMetaId: PROVIDER,
    providerChatPubkey: 'provider-chat-key',
    content: 'Please send the source files.',
    metalet,
  })

  expect(result.pinId).toMatch(/^local-follow-up:/)
  expect(result.encryptedContent).toBeTruthy()
})
```

Also add or keep explicit negative tests:

- user rejection still throws `DeliveryFollowUpError` or the original wallet error
- insufficient balance still throws
- timeout still throws `broadcast_failed`

- [ ] **Step 2: Reuse `isCreatePinTransportResponseLostError()`**

In `src/delivery/sendMessage.ts`, import:

```ts
import { isCreatePinTransportResponseLostError } from '@/order/pinResult'
```

Change the catch around `createPin`:

```ts
  } catch (err) {
    if (isCreatePinTransportResponseLostError(err)) {
      return { pinId: createLocalFollowUpId(), encryptedContent }
    }
    if (err instanceof WalletResponseTimeoutError) {
      throw new DeliveryFollowUpError(err.message, 'broadcast_failed')
    }
    throw err
  }
```

Keep true wallet failures as failures.

- [ ] **Step 3: Verify payload remains demo-chat-compatible**

Keep `buildPrivateMessagePayload()` output:

```json
{
  "to": "<provider globalMetaId>",
  "timestamp": 123,
  "content": "<AES ciphertext>",
  "contentType": "text/plain",
  "encrypt": "ecdh",
  "replyPin": "<optional last pin>"
}
```

Keep createPin path `/protocols/simplemsg`.

- [ ] **Step 4: Optional composer UX**

Only if tests show the composer stays disabled after profile hydration, add a test and fix in `DeliveryComposer` so external `providerChatPubkey` always wins over stale `session.providerChatPubkey`.

This already appears implemented; do not touch it unless a test fails.

- [ ] **Step 5: Run focused tests**

Run:

```bash
pnpm vitest run tests/delivery/sendMessage.test.ts tests/components/delivery/DeliveryComposer.test.tsx tests/order/pinResult.test.ts
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/delivery/sendMessage.ts tests/delivery/sendMessage.test.ts src/components/delivery/DeliveryComposer.tsx tests/components/delivery/DeliveryComposer.test.tsx
git commit -m "fix: keep delivery follow-ups pending on response loss"
```

Only include optional files if actually changed. Post an Eric development-journal buzz after the commit.

### Task 6: Integration Verification And Real Chrome + Metalet Acceptance

**Files:**

- Modify docs only if acceptance findings need to be recorded.
- Create meta-socket issue docs only if meta-socket is missing required data.

- [ ] **Step 1: Run full automated verification**

Run:

```bash
pnpm vitest run
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Expected: all pass.

- [ ] **Step 2: Confirm local meta-socket is healthy**

Run:

```bash
curl -sS http://127.0.0.1:18091/healthz
```

Expected:

```json
{"code":0,"data":{"service":"meta-socket","status":"ok","version":"dev"}}
```

If not healthy, do not rewrite BotHub to work around it. Record the environment issue.

- [ ] **Step 3: Start or reuse the BotHub dev server**

If no dev server is running:

```bash
pnpm dev --host 127.0.0.1 --port 5177
```

Use another port if 5177 is occupied.

- [ ] **Step 4: Chrome + Metalet manual acceptance**

Use Chrome with the Metalet extension. The user has authorized wallet usage, but still require action-time human confirmation for any final wallet confirmation that spends funds or writes on-chain.

Acceptance checks:

1. Open `http://127.0.0.1:5177`.
2. Connect Metalet.
3. Go to Delivery.
4. Confirm the right-top account shows avatar/name/globalMetaId.
5. Confirm the session list starts replacing initials/truncated IDs with real names and avatars for visible sessions.
6. Select a known private session that previously showed ciphertext.
7. Confirm no repeated Metalet ECIES popup appears.
8. Confirm provider/counterparty message text decrypts when a profile chat key is available.
9. Confirm session header and incoming message bubble show the same provider name/avatar.
10. Type a short follow-up in the Delivery composer.
11. Let Metalet show the createPin authorization for `/protocols/simplemsg`.
12. Ask for or wait for human action-time confirmation before clicking the final wallet confirm.
13. After confirmation, confirm the composer clears and an outgoing message appears.
14. Query meta-socket history to verify the follow-up is present:

```bash
curl -sS 'http://127.0.0.1:18091/api/group-chat/private-chat-list?metaId=<buyer-metaid-or-address>&otherMetaId=<provider-globalMetaId>&size=5'
```

Expected:

- Latest or near-latest item has `/protocols/simplemsg` path/protocol.
- `from`/`fromGlobalMetaId` is the buyer.
- `to`/`toGlobalMetaId` is the provider.
- It contains `encrypt: "ecdh"` either in the parsed content or normalized item.

- [ ] **Step 5: Browser visual sanity**

Use Browser/Playwright or Computer Use screenshots for:

- Desktop Delivery viewport.
- Mobile/narrow Delivery viewport.

Check:

- No overlapping text.
- Session list remains scrollable.
- Avatar images do not stretch.
- Composer remains reachable.
- Decrypt failure state still gives useful technical details when a message truly cannot decrypt.

- [ ] **Step 6: Final commit if docs were updated**

If only code tasks were already committed and no docs changed, no extra commit is required.

If acceptance notes or meta-socket issue docs were added:

```bash
git add <changed-docs>
git commit -m "docs: record delivery profile acceptance"
```

Post an Eric development-journal buzz after the commit.

## 5. Final Done Criteria

This task is done only when all are true:

- `pnpm vitest run` passes.
- `pnpm typecheck` passes.
- `pnpm lint` passes.
- `pnpm build` passes.
- No standard private simplemsg flow calls `metalet.eciesDecrypt`.
- Historical Delivery messages that first stored as ciphertext are retried after profile chat key hydration.
- Session list, session header, and incoming message bubbles use fetched profile names and avatars where meta-socket provides them.
- Delivery composer can send a follow-up using the resolved provider chat key.
- Chrome + Metalet acceptance has been attempted and recorded. If blocked, the blocker is explicit and reproducible.
- Every commit has an Eric development-journal buzz.

## 6. Suggested Handoff Prompt For The Next Session

Use this prompt in the new development session:

```text
请在 /Users/tusm/Documents/MetaID_Projects/bothub 的 main worktree 上执行 docs/superpowers/plans/2026-05-31-delivery-message-profile-parity.md。

开发模式：每个 Task 新开一个 subagent 实现；主 session 负责验收。如果不合格，把同一个 task subagent 叫回来返工，直到通过。不要额外开分支/额外 worktree，除非我另外要求。

每个独立 task 完成后按 AGENTS.md 提交，并用 Eric 通过 metabot-post-buzz 发开发日记。不要提交无关未跟踪截图或 .playwright-mcp。

优先完成 P0：Delivery 对方消息解密、头像/profile 渲染、输入框 follow-up 发送。最后用 Chrome + Metalet 做真实验收；涉及钱包最终确认时，在动作发生前让我确认。
```
