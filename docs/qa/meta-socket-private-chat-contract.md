# Meta-Socket Private Chat Contract Spike

Task 2A sampled the local meta-socket service at `http://127.0.0.1:18091` on `2026-05-28` for the HTTP private-chat history contract.

## Exact Local URLs Tested

```text
http://127.0.0.1:18091/api/group-chat/chat/homes/1JzFmwf498bXRyFiJTrxikSP7xh9iZ3JrX
http://127.0.0.1:18091/api/group-chat/private-chat-list?metaId=1JzFmwf498bXRyFiJTrxikSP7xh9iZ3JrX&otherMetaId=idq160rca8swdygt7hn59em03nqhr96zmjd4yd668z&cursor=&size=5
```

Both endpoints returned `code === 0`.

## Identity Parameter Observations

`metaId=1JzFmwf498bXRyFiJTrxikSP7xh9iZ3JrX` behaves as the current user's wallet MVC address. In the returned message rows it appears as `fromGlobalMetaId`, `from`, and `fromAddress`, so the local compatibility layer currently treats this address as the sender identity/globalMetaId for this data set.

`otherMetaId=idq160rca8swdygt7hn59em03nqhr96zmjd4yd668z` behaves as the peer/provider globalMetaId-like identity. In message rows it appears as `toGlobalMetaId` and `to`; `toAddress` is empty.

The spike did not prove that `metaId` always accepts every identity form. Task 10 should keep accepting the wallet address for the local history fetch path unless a wider identity resolver proves that a local metaid or globalMetaId is required for newer data.

## Conversation Discovery

`GET /api/group-chat/chat/homes/:metaid` returned a valid list-like payload:

```ts
{
  code: 0,
  data: {
    list: [
      {
        metaId: string,
        globalMetaId: string,
        lastMessage: PrivateChatItemLike
      }
    ]
  }
}
```

For the sampled account, `data.list.length === 1` and `lastMessage` was populated. This makes the endpoint usable as conversation discovery for the sampled local database. The contract should still tolerate an empty `data.list` as a valid "no conversations found" response because that is the natural list shape and the endpoint can succeed without rows.

## Private Message Row Normalization

`GET /api/group-chat/private-chat-list` returned:

```ts
{
  code: 0,
  data: {
    total: number,
    nextCursor: string,
    nextTimestamp: number,
    list: PrivateChatItemLike[]
  }
}
```

Each sampled row already has the core `src/ws/privateChat.ts` `PrivateChatItem` fields:

- `fromGlobalMetaId`
- `toGlobalMetaId`
- `content`
- `timestamp`

Rows also include compatible optional fields: `from`, `to`, `txId`, `pinId`, `protocol`, `contentType`, `encryption`, `chain`, `blockHeight`, and `index`. The local HTTP rows can therefore share the existing `isPrivateChatItem` normalization contract without a separate HTTP-only mapper for the sampled shape.

Known field difference: HTTP rows include `fromAddress` and `toAddress`, which are not part of `PrivateChatItem`. They are harmless extras for the current type guard.

## Remaining Uncertainty For Task 10

Task 10 should:

- Treat `data.list` as the only required message container and fail closed on non-zero `code`.
- Keep the UI/history path tolerant of empty `homes.data.list`.
- Decide whether to retain or drop HTTP-only extras such as `fromAddress` and `toAddress`.
- Verify identity selection from the logged-in wallet/profile: the local sample uses an MVC wallet address as `metaId`, while peers may be globalMetaId-like strings.
- Confirm pagination semantics beyond the first page, especially whether `nextTimestamp` or `nextCursor` is the stable cursor for subsequent history loads.
