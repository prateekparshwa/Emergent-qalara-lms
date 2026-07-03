# Qalara LMS — Product Requirements Document

## Original Problem Statement
Build a B2B web app called "Qalara LMS" (Qalara Lead Management System) — an AI buyer-intelligence and outreach platform used internally by Qalara, an Indian export marketplace connecting global wholesale buyers of home décor, textiles, kitchenware and lifestyle goods with Indian artisan producers.

## User Personas
1. **Editor (Qalara internal, `@qalara.com`)** — Full access. Uploads, edits, assigns leads, sends outreach.
2. **Viewer (any other Google account)** — Read-only demo mode. Sees the platform but every mutation is disabled with "Demo mode — read only" tooltip.

## Architecture
- **Backend**: FastAPI + Motor (MongoDB). All routes prefixed `/api`. Session-based auth (Emergent Google OAuth, `session_token` httpOnly cookie, 7-day expiry, plus `Authorization: Bearer` fallback).
- **Frontend**: React 19 + React Router 7 + Tailwind + shadcn/ui. Global `AuthProvider`, protected `AppShell` layout, hash-based `AuthCallback` for OAuth exchange.
- **Design language**: Cabinet Grotesk (headings) + Satoshi (body), white bg + teal `#0d9488` primary + amber `#f59e0b` secondary. Neumorphic "clay & crisp" cards, subtle grain texture.

## Data Model (implemented, foundation)
- **users**: `user_id, email, name, picture, role, created_at, updated_at`
- **user_sessions**: `user_id, session_token, expires_at, created_at`
- **buyers**: `id, organization, website, email, contact_name, designation, country, business_type, org_size, purchase_potential (HIGH/MEDIUM/LOW/UNKNOWN), potential_rationale, account_manager, am_notes[], sources_from_india, segment (directory/discover), enrichment, enrichment_updated_at, moodboard, outreach_status (NONE/DRAFTED/SENT/REPLIED/QUOTED), outreach_emails[], lead_score, created_at, updated_at`
- **settings**: single `qalara_profile` document with about, categories, producer_base, moqs, export_markets, certifications, value_props.

## What's been implemented — 2026-02-XX (v0.1 Foundation)
- Emergent Google Auth end-to-end (login, callback, `/api/auth/me`, logout, 401 on expired/invalid session).
- Domain-based role assignment (`@qalara.com` → editor, else viewer).
- Buyers + settings collections with idempotent seeding (5 sample buyers, 1 Qalara profile).
- App shell: sidebar (Dashboard, Discover, Outreach, Impact, Settings), top bar (avatar, name, role badge, sign-out).
- "Coming Soon" placeholder pages with role-aware disabled primary buttons + tooltip for viewers.
- Sign-in split screen with artisan imagery, dedicated `/signed-out` page.
- All interactive elements carry `data-testid` per design guidelines.

## Prioritized Backlog

### P0 — Next milestone (Discover module)
- Buyers table (search, filter by country/purchase_potential/segment/AM, sort).
- Buyer detail drawer/page (all fields, inline edit for editors).
- CSV upload for buyers (editor only).
- AM notes threaded UI.

### P1 — Enrichment & Outreach
- Buyer enrichment job (web scrape + LLM summary → `enrichment` JSON).
- Lead score computation (0–100) from enrichment + profile fit.
- Outreach module: AI-drafted email + moodboard per buyer; approve → send via SMTP/Resend; status tracking.

### P2 — Dashboard & Impact
- Dashboard KPIs: pipeline by stage, weekly outreach velocity, reply/quote rates.
- Impact page: artisan clusters engaged, purchase potential converted, region breakdown.
- Settings page CRUD for `qalara_profile`.

### P2 — Platform hardening
- Audit log for buyer edits.
- Bulk operations (assign, tag, email).
- Real email delivery status webhooks.
