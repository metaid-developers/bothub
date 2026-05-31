# Delivery Workspace V1 Acceptance Notes

**Date:** 2026-05-31
**URL:** http://localhost:5176/
**Wallet:** idq1zfazvxaq69uw6txe3ewce30ewyhy9a7mzykgv0
**Meta-socket:** https://api.idchat.io

## Acceptance Checklist

### Automated Gates
- [x] Tests: 402/402 pass across 56 test files
- [x] git diff --check: clean

### Live Provider Delivery
- Status: **blocked** (aggregator API not deployed, no live service to order from)
- Historical private chat data synced successfully from api.idchat.io
- Some messages undecrypted due to missing provider chat keys (expected)

### Seeded Asset Library UI Acceptance
- [x] Demo Provider appears in order list as "Demo Image/Video Render"
- [x] Selected order shows header with provider, service, status (已交付)
- [x] Progress timeline shows milestones (请求已发送 → 服务处理中 → 成果已交付)
- [x] 4 assets in 成果库: image, video, document, archive
- [x] Filter by type works (图片, 视频, 文档, 压缩包)
- [x] Preview dialog opens for image/video (content blocked by cross-origin on test URLs)
- [x] Copy all links works
- [x] Refresh → reconnect wallet → orders and assets restored from IndexedDB

### Sync States
- [x] Partial sync warning displayed when some peers fail
- [x] Local cached records remain visible during sync failure
- [x] "同步失败，本地记录仍可查看" shown when history sync errors occur

### Layout & Copy
- [x] Page title: "我的交付"
- [x] Order list labeled "我的请求"
- [x] No technical copy (simplemsg, Socket.IO, meta-socket) in normal states
- [x] Empty state: "还没有收到成果"

### Known Issues
- [x] Preview unavailable on mock URLs (not a bug - test data limitation)
- [x] Real service ordering blocked on aggregator deployment
- [x] Historical private chat messages may show as "Unknown service" when order correlation is missing

## Remaining Blockers
1. Aggregator API deployment for live service browsing/ordering
2. Provider delivery for end-to-end live acceptance
3. Real metafile:// assets for preview verification

## Screenshots
Captured manually by user (not committed per plan instructions).
