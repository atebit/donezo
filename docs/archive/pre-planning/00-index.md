# Donezo (Minimal Monday Clone) – Pre‑Planning Index

This folder contains the pre-planning / codebase study outputs.

## Files

- `01-architecture-and-runtime.md`
  - High-level architecture, how data flows, and how to run the project locally.
- `02-feature-inventory-matrix.md`
  - What’s implemented end-to-end vs partial vs missing.
- `03-gaps-risks-and-debt.md`
  - Technical risks, security gaps, missing production-readiness items.
- `04-roadmap-next-steps.md`
  - Sequenced plan to continue building the minimal Monday clone.

## Executive Summary (quick read)

- The repo is a MERN-style app:
  - **Frontend:** CRA React + Redux + react-beautiful-dnd + Socket.IO client.
  - **Backend:** Express + MongoDB (native driver) + Socket.IO.
- The core “board” experience largely exists (groups + tasks + columns, drag/drop, realtime board updates).
- The biggest blockers to “minimal Monday clone” completion are:
  - **Auth correctness** (password check is missing in backend login).
  - **Local dev ergonomics** (backend has no `npm start` script; credentials/config are hardcoded).
  - **Data shape consistency** (task fields/column types are evolving; some column types appear in UI but are not fully supported).

