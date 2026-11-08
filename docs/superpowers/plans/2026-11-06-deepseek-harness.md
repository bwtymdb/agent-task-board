# DeepSeek Harness Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add read-only DeepSeek Harness sessions to the existing task board, including status, focus, alerts and daily AI summaries.

**Architecture:** Discover JSONL and Zstandard-compressed logs below `$DSH_HOME/sessions` or `%USERPROFILE%\.dsh\sessions`. Parse official event envelopes into existing `TaskItem` and `ConversationTurn` models, then reuse `ConnectorHub`, progress windows and AI caching. Never write Harness logs.

**Tech Stack:** Electron, React, TypeScript, Node.js 24 built-in Zstandard decoder, existing board connectors.

**Spec:** User-approved specification in the conversation: read-only DeepSeek Harness monitoring; fixture verification until a real Harness installation is available.

## Global Constraints

- Do not modify Harness data, credentials or profiles.
- Missing or unreadable Harness data must not affect existing platforms.
- Do not claim native rename, archive or session deep links without a verified interface.
- Use synthetic logs only; do not commit real conversation data.

## Review Focus

- Missing home directory shows a useful disconnected health message.
- Uncompressed and multi-frame compressed logs parse without data loss.
- Open turn maps yellow; approval/failure maps red; completed turn maps green.
- Only the final assistant response enters AI input.
- Invalid tails preserve the last valid snapshot and never produce a false green state.

---

### Task 1: Harness log parser and fixtures

**Files:**
- Create: `src/main/connectors/deepseek-harness.ts`
- Test: one-off `npx tsx` assertions using generated fixtures under ignored `release/`.

**Interfaces:**
- Produces: `DeepSeekHarnessConnector`, `readHarnessLog(filePath)`, `parseHarnessRecords(records, task)`.

- [ ] Write failing assertions for plain JSONL, compressed JSONL, title, final response and turn status.
- [ ] Run the assertions and confirm failure because the connector does not exist.
- [ ] Implement minimal discovery, decoding and event parsing.
- [ ] Re-run all parser assertions and confirm they pass.

### Task 2: Board integration

**Files:**
- Modify: `src/shared/types.ts`, `src/main/connectors/index.ts`, `src/main/store.ts`
- Modify: `src/main/open-target.ts`, `src/main/ipc.ts`, `src/renderer/src/App.tsx`, `src/renderer/src/components/TaskRow.tsx`, `src/renderer/src/components/ProgressWindow.tsx`
- Modify: `README.md`, `CHANGELOG.md`

**Interfaces:**
- Consumes: `DeepSeekHarnessConnector` from Task 1.
- Produces: platform `deepseek-harness`, optional `dshHome` setting and read-only progress integration.

- [ ] Add the connector to the hub without changing existing connector behavior.
- [ ] Add platform labels, filtering, aliases, progress and opening behavior.
- [ ] Update user documentation and changelog.
- [ ] Run `npm run lint && npm run build`.

### Task 3: Packaged verification

**Files:**
- Modify: `package.json`, `package-lock.json` through the standard version command only.

- [ ] Build the Windows installer with `npm run dist`.
- [ ] Install and launch it using a separate test user-data directory.
- [ ] Verify synthetic Harness sessions and existing platforms in the packaged app, then restore normal startup.
- [ ] Confirm no real credentials or session fixtures are tracked by Git.
