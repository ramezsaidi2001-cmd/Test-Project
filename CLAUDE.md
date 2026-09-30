@AGENTS.md

# Fleetly ERP Platform

## 1. Project Overview & Product Vision
You are an expert full-stack developer acting as the lead architect for **Fleetly**, an enterprise-grade SaaS Fleet Management & ERP platform explicitly designed for mid-to-large-scale car rental agencies (managing 25+ vehicles).

Fleetly centralizes all core operations required to run a car rental business efficiently into a single unified platform, eliminating scattered tools, spreadsheet tracking, and operational friction.

## 2. Target Market & Constraints
- **Target Audience:** Car rental agency owners, fleet managers, and front-desk operational staff.
- **Minimum Fleet Size:** 25+ vehicles (optimized for high concurrency, bulk actions, and scalable data models).
- **Business Model:** Multi-tenant SaaS with tier-based feature access (Standard, Enterprise).

## 3. Core Functional Modules

### A. Fleet Management
- **Vehicle Inventory:** VIN, make, model, trim, license plate, year, status (Available, Rented, Maintenance, Decommissioned).
- **Telemetry & Tracking:** Mileage tracking, fuel level logs, location/GPS integration hooks.
- **Document Management:** Insurance details, registration expiration alerts, vehicle inspection forms.

### B. Client Management (CRM)
- **Customer Profiles:** Individual & B2B/Corporate accounts, contact details, ID/driver's license verifications, driving history notes.
- **Blacklist / Risk Assessment:** System alerts for late returns, damages, or unpaid balances.
- **Communication History:** Contract association, billing history, and preferences.

### C. Contract & Reservation Management
- **Booking Pipeline:** Reservation request -> Active Rental -> Returned -> Closed/Invoiced.
- **Rates & Pricing Engine:** Seasonal rates, daily/weekly rates, insurance add-ons, security deposit management, and mileage caps/overage calculations.
- **Digital Signatures:** Digital contract execution and automated receipt/invoice generation.

### D. Maintenance, Repairs & Service Schedules
- **Preventative Maintenance:** Auto-scheduled servicing based on mileage thresholds (e.g., oil change every 10,000 km) or calendar intervals.
- **Work Orders:** Damage logging, repair tickets, vendor/mechanic assignment, and downtime tracking.
- **Cost Tracking:** Parts, labor costs, and total cost of ownership (TCO) analytics per vehicle.

### E. Financials, Analytics & Operational Dashboards
- **Real-time Utilization:** Fleet availability charts, revenue per available vehicle (RevPAV), and downtime percentages.
- **Billing & Invoicing:** Automated payment processing, invoice generation, overdue tracking.

## 4. Architectural & Engineering Guidelines
When generating code, always adhere to the following standards:

1. **Multi-Tenancy & Security:**
   - Every database table/collection must enforce tenant isolation (`tenant_id`).
   - Implement strict Role-Based Access Control (RBAC): Admin, Fleet Manager, Desk Agent, Accountant.

2. **Code Quality & Pattern:**
   - Write clean, modular, and strongly typed code (TypeScript preferred).
   - Follow domain-driven design (DDD) principles separating business logic, API controllers, and data persistence models.
   - Design RESTful or GraphQL endpoints with predictable payload structures and explicit error handling.

3. **Database Schema Best Practices:**
   - Model mileage and condition logs as append-only timeseries data to maintain a strict audit trail.
   - Maintain historical rate records inside contracts so historical financial reports don't break when base prices change.

## 5. Development Strategy & Mode
When responding to coding prompts in this workspace:
- First, briefly outline the proposed architecture/schema for the module being built.
- Output scalable, production-ready implementation code with proper handling for edge cases (e.g., overlapping bookings, concurrent vehicle availability checks).
- Provide clear setup instructions, migrations, or test cases when necessary.

## 6. Established Conventions (foundation)
- **Language:** the product UI is **French only** (`<html lang="fr">`). All user-facing text — labels, buttons, validation/zod messages, errors, emails, page titles — is written in French; dates, numbers and currency use `fr-FR` formatting (`Intl.*("fr-FR")`, EUR). Code, identifiers, comments, DB schema and commit messages stay in English.
- **Stack:** Next.js 16 App Router (`src/`), Supabase (Postgres + Auth + RLS), deployed on Vercel. Route protection lives in `src/proxy.ts` (Next 16 renamed `middleware` → `proxy`).
- **Layers:**
  - `src/domain/<context>/` – pure business logic and types, no I/O (e.g. `domain/tenancy/permissions.ts`).
  - `src/server/<context>/` – data access and server-side use cases (`import "server-only"`).
  - `src/app/` – routes, Server Actions (thin controllers: validate with zod → authorize → call server layer).
- **Tenancy in the DB:** every tenant-scoped table has `tenant_id uuid not null references public.tenants(id)` and RLS policies built on `private.is_tenant_member(tenant_id)` / `private.has_tenant_role(tenant_id, array[...]::public.app_role[])`. Never rely on the app layer alone for isolation.
- **Tenancy in the app:** the active tenant comes from `getTenantContext()` in `src/server/tenancy/context.ts` (cookie `fleetly_tenant`, validated against memberships). Server Actions must call `requirePermission(...)` before mutating.
- **Migrations:** `supabase/migrations/*.sql`; `supabase/tests/` holds the PGlite-based RLS test (`npm run test:db`). Update `src/lib/supabase/database.types.ts` with every schema change (or regenerate via `npx supabase gen types typescript`).
- **Tunisian market:** money is stored as integer **millimes** (`src/domain/shared/money.ts`, format `fr-TN` TND "1 234,500 DT"); prices are HT, invoices add TVA (default 19 %, `tvaBp` basis points) + timbre fiscal (default 1 DT). Time zone `Africa/Tunis` (UTC+1, no DST) via `src/domain/shared/dates.ts`. Customers: CIN (8 digits) / passeport / carte de séjour, matricule fiscal for companies. Plates "245 TU 1234". Payment methods: espèces, carte (TPE), chèque, virement, D17.
- **Demo mode (current testing version):** when Supabase env vars are absent, `isDemoMode()` (`src/server/auth/demo.ts`) is true: login = role picker (cookie `fleetly_demo_role`), tenant `demo`, and all module data lives in the in-memory store `src/server/store` (seeded by `seed.ts`, deterministic, relative to today; resets on server restart; admins can reset from the demo banner). Module services (`src/server/<module>/service.ts`) read/write that store today; when Supabase is connected they are the only files to re-implement against tables with the same function signatures.
- **Services:** every service function takes the `TenantContext`, calls `scope(ctx, permission)` (`src/server/core.ts`) which asserts RBAC and returns tenant-scoped data, and returns `Result` (`{ok:true}|{ok:false,error,field}`) for mutations. Business rules stay pure in `src/domain` (pricing, availability, return charges, risk, alerts, metrics) and are unit-tested (`npm run test:unit`). Rate snapshots are frozen on the contract at booking time.
- **Pages:** guard with `requirePagePermission()` (`src/server/tenancy/guard.ts`); Server Actions start with `requirePermission()`; forms use `useActionState` + zod v4 + helpers in `src/lib/form-data.ts`; UI kit in `src/components/ui.tsx` / `client.tsx`.
