# Technical Documentation: Chadwick WorkGuru Dashboard

This document provides an overview of the technical architecture, database schema, and synchronization patterns used in the WorkGuru Dashboard.

## Architecture Overview

The system is built with **Next.js 15+ (App Router)** and **Drizzle ORM**, communicating with a **PostgreSQL** database.

- **Frontend**: Tailwind CSS 4 + Shadcn UI (Manual integration for stability).
- **Backend**: Next.js Server Actions for data mutations and sync orchestration.
- **Sync Layer**: A modular service that pulls data from the WorkGuru API (v1) and performs ID-based upserts.
- **Security**: AES-256-CBC encryption for sensitive API keys stored in the database.

## Database Schema (Drizzle)

The schema is defined in `src/db/schema.ts`.

### Core Models
- `clients`: Maps to WorkGuru Clients.
- `projects`: Primary entity, including budget/actual hours and delivery risk fields.
- `tasks`: Project-specific tasks for granular labor tracking.
- `timeEntries`: Individual labor entries.
- `displayStages`: Dynamic humand-friendly stages (Engineering, Production, etc.).
- `stageMappings`: Link raw WorkGuru statuses to `displayStages`.

### Relationships
- `Project` belongs to `Client`.
- `Project` has many `Tasks` and `TimeEntries`.
- `TimeEntry` belongs to `Project` and (optionally) `Task`.

## Synchronization Patterns

The `SyncService` (`src/lib/sync.ts`) handles the integration:
- **ID-Based Upsert**: Every record uses `workguruId` as a unique constraint to prevent duplicates.
- **Incremental Logic**: Designed to pull data updated since the last sync (currently set to full fetch for initial seeding).
- **Validation**: Every sync event is logged in `sync_logs` for auditability.

## Extension Guide

### Adding a New Model
1. Define the table in `src/db/schema.ts`.
2. Run `npx drizzle-kit push` (via `cmd /c` on this environment) to update the database.
3. Update `src/db/index.ts` if adding complex relations.

### Modifying Risk Logic
Update `src/lib/risk.ts`. Current risk is calculated based on:
`Utilization = Remaining Hours / (Remaining Business Days * Capacity)`

### Updating UI Components
The dashboard uses custom-styled components in `src/app/page.tsx` for visual excellence. For new components, follow the **Slate + Shadcn** design tokens.

---
**Version**: 1.0.0
**Lead AI Architect**: Antigravity
