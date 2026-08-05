# DeckRecall contribution guide

- Keep DeckRecall independent from the 周克儿工具箱 repository; integration belongs in a future, explicit adapter.
- Every user-facing string, diagnostic code, and activity-log code must have entries in both `locales/en-US.json` and `locales/zh-CN.json`.
- Backend methods must never accept filesystem paths from the UI. Extend only the fixed allowlist in `Plugin._tracked` and add tests before tracking another file.
- Any restore action must capture an undo point before writing and verify archive hashes before replacing a file.
- Use GPT-5.6 Sol with High reasoning for architecture, permissions, snapshots, rollback and security work; use GPT-5.6 Terra with Medium reasoning for routine UI, translation and small fixes.
