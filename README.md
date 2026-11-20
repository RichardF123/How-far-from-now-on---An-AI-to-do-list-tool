# Learning Mentor

[English](README.md) · [简体中文](README.zh-CN.md)

A Windows desktop companion for long-term learning, powered by **your own Codex agent**. Save learning notes and materials locally, discuss them in Codex, and sync evidence-based progress assessments and daily reports back to your desktop.

The repository name reflects the original to-do concept. The current product focuses on learning mentorship: it has no built-in chat, automatic daily tasks, or streak-based scoring.

![Learning Mentor with a synced daily report](docs/images/desktop.png)

*Actual application screenshot with synthetic test records. The assessment is a test fixture, not a validated measurement of a learner's ability.*

## Features

- Light Apple-inspired UI: compact desktop card, learning reports, and progress details.
- User-defined learning goals and editable initial assessment criteria.
- Local text records and file attachments, including backdated entries.
- STDIO MCP tools for Codex to read records and write assessments and reports.
- Evidence references across coverage, understanding, and independent application.
- Service-calculated progress, atomic review writes, idempotent receipts, and automatic UI refresh.
- Connection verification, pending/running states, cancellation of result acceptance, and retained previous assessments.
- Tray access and optional always-on-top mode.

**Platform:** Windows x64. This is an unsigned, early-stage MVP. This initial upload contains source; no prebuilt GitHub Release has been published.

## Quick start

Use **Node.js 24 LTS**. Dependencies require Node.js 22.12 or newer. In PowerShell:

```powershell
git clone https://github.com/RichardF123/How-far-from-now-on---An-AI-to-do-list-tool.git
cd How-far-from-now-on---An-AI-to-do-list-tool
npm ci
npm run setup:electron
npm start
```

`setup:electron` downloads the pinned Windows x64 Electron release from GitHub in chunks, verifies its SHA-256 hash against the checksums supplied with the Electron package, and retains the verified archive for packaging. GitHub release downloads must be reachable.

Create a learning direction, describe your intended outcome, review the three assessment criteria, and confirm. Choose **Record** to save a note or attach materials.

## Connect Codex

1. Open **Agent settings** and enable learning archive access. The MVP grants access to **all learning directions within this app for the current Windows user**; per-direction permissions are not implemented yet.
2. Copy the generated configuration into your Codex MCP settings or configuration file. Keep existing servers and reload the connection as required by your client.
3. In your Codex conversation, ask:

   > Call the learning_mentor verify_connection tool to verify the learning plugin connection.

4. Wait for **Read/write verified** in the app. Save a learning record, choose **Ask Codex to review**, and paste the copied request into Codex. Or ask directly:

   > Read my recent learning records, assess my progress using the agreed criteria, and sync an assessment and today's report to my desktop.

The generated configuration uses the app's Electron runtime in Node mode, so a portable build needs no separate Node.js installation. Copy the configuration again if you move the app folder.

**MCP connectivity does not wake a conversation or schedule model execution.** You initiate reviews in your Codex session. The app does not modify Codex configuration, read its chat database, or import chat history. New tools may require a client reload or a new conversation. See the [Codex MCP documentation](https://developers.openai.com/codex/mcp/).

## How reviews work

```mermaid
sequenceDiagram
    participant User
    participant Desktop
    participant Codex
    participant Core as Local learning core
    User->>Desktop: Save a note or file
    Desktop->>Core: Persist record
    User->>Codex: Request review
    Codex->>Core: Read criteria and record snapshot through MCP
    Codex->>Core: Read evidence and submit assessment and report
    Core->>Core: Validate references and calculate progress
    Core-->>Desktop: Save together and refresh
```

The goal's confirmed criteria cover **content coverage, understanding, and independent application**. MVP weights are fixed at **20% / 30% / 50%**. Levels `unknown`, `emerging`, `developing`, and `demonstrated` map to **0 / 25% / 60% / 100%** satisfaction. The service computes the weighted total; the UI rounds to the nearest five percentage points and labels it approximate.

Unknown means **not yet supported by evidence**, not an inability. All-unknown assessments show **Awaiting assessment**, not 0%. These are initial product rules, not scientifically calibrated educational measurements. References improve traceability but cannot guarantee the agent's interpretation is correct.

New records do not automatically increase progress. A review uses a fixed snapshot; later records remain pending. Duplicate writes return the original receipt. Report-only reviews do not change the last assessment timestamp. Silence and missing records do not automatically lower progress.

## Files and local data

- Up to **10 files per record**, **10 MB per file**.
- Text, Markdown, and supported code formats can be read through the paginated evidence tool.
- Images, PDFs, and unsupported formats are stored but **not parsed**. Add a text explanation if needed.
- Default data location: `%APPDATA%\LearningMentor`, containing `learning.sqlite` and imported `attachments/`.
- `LEARNING_MENTOR_DATA` selects a separate data directory for development or isolated tests.

Records stay local until your authorized Codex agent reads them. Its model provider then processes the material according to that agent's configuration. The desktop app has no built-in model API or cloud sync.

The renderer uses sandboxing, context isolation, a restricted preload API, and CSP. The local adapter uses an authenticated loopback endpoint and a random per-start token stored in a Windows-user-restricted directory, **not yet an OS credential vault**. Do not share runtime connection files or the data directory. Revoking access blocks subsequent MCP calls. This cannot isolate data from administrators or malicious software running as the same Windows user.

## Architecture

```text
React UI → Electron IPC → Local learning core → SQLite snapshot + attachments
                                 ↑
Your Codex → STDIO MCP adapter → Authenticated loopback business endpoint
```

The MVP uses **Electron + React + sql.js**. An earlier design considered Tauri; Electron was selected for this runnable implementation. Business rules are separate from the UI and MCP transport.

sql.js keeps SQLite in memory. Mutations create a candidate database, write and flush a temporary file, then atomically replace the persisted snapshot before publishing results. This suits a small personal archive, not high-volume workloads. Attachment files and database updates are coordinated separately; they are not one cross-filesystem transaction.

| Path | Purpose |
| --- | --- |
| `src/core.cjs` | Records, snapshots, scoring, validation, persistence, receipts |
| `src/mcp.cjs` | MCP tools and agent workflow instructions |
| `src/bridge.cjs` | Authenticated local business endpoint |
| `src/main.cjs`, `src/preload.cjs` | Desktop lifecycle and restricted IPC |
| `src/ui/` | React interface and styles |
| `scripts/` | Build, runtime installation, packaging, desktop verification |
| `test/` | Core and official MCP SDK integration tests |

## Test and package

```powershell
npm test
npm run test:desktop
npm run package
```

Portable output: `release/LearningMentor-win32-x64/LearningMentor.exe`. Keep the **entire folder**, not just the executable. Closing the window hides it to the tray; choose **Exit** in the tray menu to stop the service. Title-bar controls provide compact mode and always-on-top.

Tests cover persistence/restart, evidence restrictions, idempotency, cancellation, goal-version conflicts, snapshots, report-only writes, revoked access, and local authorization. The desktop test starts a real Electron window, writes a review through an MCP client while it is running, and checks the refreshed UI. Tests use isolated temporary data.

Screenshots and diagnostic artifacts go to ignored `artifacts/`. Dependencies, build outputs, runtime credentials, SQLite data, and user-imported materials must not be committed.

## Limitations

- Manual review initiation; no scheduled or automatic agent execution.
- Fixed weights and a small initial rubric; existing goals cannot yet be edited or archived.
- App-wide local authorization; no per-direction grants or remote MCP.
- No PDF extraction, OCR, repository connector, cross-device sync, or built-in chat.
- No automatic backup/restore workflow or signed installer. Exit the app before backing up its complete data directory manually.
- The local core stops when the app exits.

Future work includes assessment calibration, goal version editing, finer permissions, richer material parsing, and more agent hosts.
