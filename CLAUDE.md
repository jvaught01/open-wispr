# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Open Wispr is an Electron desktop app (macOS/Windows/Linux) that provides voice-to-text transcription using Groq's Whisper API. Users hold a global hotkey to record, and the transcribed text is either typed into the active application or copied to clipboard.

## Commands

- `npm run dev` — Start Vite dev server + Electron in development mode (hot-reload for renderer)
- `npm run build` — TypeScript check + Vite build + electron-builder (produces platform installer)
- `npm run build:win` — Windows-specific build via `scripts/build-win.js`
- `tsc --noEmit` — Type-check without building

No test framework is configured.

## Architecture

**Two-process Electron app:**

- `electron/main.ts` — Main process. Manages two BrowserWindows (main settings window + floating overlay), system tray, global hotkey registration, and all persistent storage via `electron-store`. Handles hotkey-hold detection by polling OS modifier state (AppleScript/JXA on macOS, PowerShell on Windows). Text output uses clipboard + simulated paste keystroke.
- `electron/preload.ts` — Defines the `window.electron` bridge API. All IPC channels are typed here.
- `src/` — Renderer (React + Tailwind). Entry at `src/main.tsx`, routing between main and overlay is hash-based (`#overlay`).

**Renderer structure:**

- `src/App.tsx` — Top-level router. `#overlay` hash renders `RecordingOverlay`, otherwise renders the main `Overlay` (dashboard) with onboarding gate.
- `src/components/` — UI components (settings panel, history, dictionary, waveform, onboarding flow)
- `src/hooks/useRecording.ts` — MediaRecorder hook, converts captured audio to 16kHz mono WAV before sending to API
- `src/services/groq.ts` — Groq API calls: Whisper transcription + LLaMA sentiment analysis
- `src/services/postProcessing.ts` — AI-powered text cleanup (filler removal, punctuation, grammar) via Groq LLaMA 3.3, plus a local `quickCleanup` fallback
- `src/stores/settings.ts` — Zustand store (partially used; main settings flow is via IPC)

**Key data flow:** Hotkey pressed → main process signals overlay via IPC → overlay starts MediaRecorder → hotkey released → main process signals stop → audio converted to WAV → sent to Groq Whisper → post-processed → pasted into active app via simulated Cmd/Ctrl+V.

## Build & Config

- Vite + `vite-plugin-electron` bundles both main and renderer processes
- Path alias: `@/` → `src/`
- Electron main process output goes to `dist-electron/`, renderer to `dist/`
- macOS entitlements require: audio input, Apple Events (for simulated keystrokes), JIT
- App icons live in `assets/{macos,windows,linux}/`
