# Prowider — Mini Lead Distribution System

**Assignment Submission** | Full Stack Developer Role

---

## Live Demo

🔗 **[https://prowider-lead-distribution.vercel.app](https://prowider-lead-distribution.vercel.app)**
> *(Replace with your actual Vercel URL before submitting)*

**Key pages to test:**
- [`/request-service`](https://prowider-lead-distribution.vercel.app/request-service) — Customer lead form
- [`/dashboard`](https://prowider-lead-distribution.vercel.app/dashboard) — Real-time provider dashboard
- [`/test-tools`](https://prowider-lead-distribution.vercel.app/test-tools) — Webhook & concurrency testing

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL (Neon) |
| ORM | Prisma |
| Real-time | Server-Sent Events (SSE) |
| Deployment | Vercel |

---

## What's Built

Every feature in the assignment spec is implemented:

| Requirement | Status | Implementation |
|---|---|---|
| Customer service enquiry form | ✅ | `/request-service` |
| Duplicate phone + service prevention | ✅ | DB-level `UNIQUE(phone, serviceId)` constraint |
| Mandatory provider assignment rules | ✅ | Hardcoded per-service rules, applied before fair pool |
| Fair round-robin allocation | ✅ | Persisted `poolIndex` in `allocation_states` table |
| Monthly quota enforcement (10 leads) | ✅ | Skips providers at quota during allocation |
| Exactly 3 providers per lead | ✅ | Enforced in allocation engine |
| Real-time dashboard updates | ✅ | SSE — dashboard auto-refreshes on new lead |
| Webhook: quota reset | ✅ | `POST /api/webhook/quota-reset` with secret header |
| Webhook idempotency | ✅ | `webhook_events` table with unique key constraint |
| Concurrency safety | ✅ | `SERIALIZABLE` transaction + `SELECT FOR UPDATE` |
| Bulk lead generation (concurrency test) | ✅ | `/api/test-tools/bulk-leads` |
| Test tools panel | ✅ | `/test-tools` |

---

## Allocation Algorithm

Each new lead is assigned to **exactly 3 providers** using a two-phase approach.

**Phase 1 — Mandatory assignment** (per service rules):
- Service 1 → Provider 1 always assigned
- Service 2 → Provider 5 always assigned
- Service 3 → Provider 1 + Provider 4 always assigned

**Phase 2 — Fair pool (round-robin)** fills remaining slots:
- Service 1 pool: `[P2, P3, P4]`
- Service 2 pool: `[P6, P7, P8]`
- Service 3 pool: `[P2, P3, P5, P6, P7, P8]`

The round-robin position (`poolIndex`) is stored in the `allocation_states` table — one row per service. After each lead, the index advances and is saved. This means the fair distribution survives server restarts and is never random.

**Example — Service 1 (needs 1 fair slot per lead):**
```
Lead 1  →  P1 (mandatory) + P2 (fair, index=0)  →  poolIndex saved as 1
Lead 2  →  P1 (mandatory) + P3 (fair, index=1)  →  poolIndex saved as 2
Lead 3  →  P1 (mandatory) + P4 (fair, index=2)  →  poolIndex saved as 0 (wraps)
Lead 4  →  P1 (mandatory) + P2 (fair, index=0)  →  cycle repeats
```

If a mandatory provider is at monthly quota (10 leads), they are skipped and the fair pool fills their slot instead.

---

## Concurrency Handling

**The problem:** Two simultaneous lead submissions could both read the same `poolIndex`, select the same fair-pool provider, and corrupt the allocation state.

**The solution:** The entire allocation logic runs inside a PostgreSQL `SERIALIZABLE` transaction with a `SELECT FOR UPDATE` on the `allocation_states` row for the relevant service. This row-level lock forces concurrent transactions to queue — the second request blocks until the first commits, then reads the already-updated `poolIndex`.

Result:
- No duplicate provider assignments across concurrent leads
- Pool index always advances correctly
- Provider `currentCount` never exceeds monthly quota

This was tested with the "Generate 10 Concurrent Leads" button in `/test-tools`, which fires 10 simultaneous requests via `Promise.all`.

---

## Webhook Idempotency

The `webhook_events` table has a `UNIQUE` constraint on `idempotencyKey`. Every webhook call must supply this key.

**Flow:**
1. Request arrives with `idempotencyKey`
2. Check if key exists in `webhook_events` — if yes, return the cached response immediately, no quota reset performed
3. If key is new, reset quota and insert the key in the same atomic transaction
4. If two identical keys race simultaneously, the one that loses the insert gets a `P2002` (unique constraint violation), which is caught and handled as an idempotent success

This can be verified on `/test-tools` → "Fire Webhook ×3 (Same Key)". The operation log will show the first call as processed and the remaining two as `idempotent: true`.

---

## Database Schema

Six tables:

```
services          — 3 rows (seeded)
providers         — 8 rows (seeded), stores currentCount + monthlyQuota
leads             — customer submissions, UNIQUE(phone, serviceId)
lead_assignments  — join table: which providers received which lead
allocation_states — 3 rows (one per service), stores persisted poolIndex
webhook_events    — idempotency store, UNIQUE(idempotencyKey)
```

---

## Project Structure

```
prowider/
├── prisma/
│   ├── schema.prisma          # All 6 models with constraints
│   └── seed.ts                # Seeds services, providers, allocation states
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── leads/route.ts                  # POST: create lead + allocate
│   │   │   ├── providers/route.ts              # GET: dashboard data
│   │   │   ├── services/route.ts               # GET: service list for form dropdown
│   │   │   ├── sse/route.ts                    # GET: SSE event stream
│   │   │   ├── webhook/quota-reset/route.ts    # POST: idempotent quota reset
│   │   │   └── test-tools/bulk-leads/route.ts  # POST: concurrent lead generation
│   │   ├── dashboard/page.tsx                  # Provider dashboard (SSE client)
│   │   ├── request-service/page.tsx            # Customer enquiry form
│   │   ├── test-tools/page.tsx                 # Webhook + concurrency testing panel
│   │   ├── layout.tsx / page.tsx / globals.css
│   ├── components/Navbar.tsx
│   ├── lib/
│   │   ├── allocation.ts      # Core allocation engine (SERIALIZABLE TX + round-robin)
│   │   ├── prisma.ts          # Prisma client singleton
│   │   └── sse.ts             # SSE client registry + broadcaster
│   └── types/index.ts
├── .env.example
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## Local Setup

**Prerequisites:** Node.js 18+, PostgreSQL 14+ (or a free [Neon](https://neon.tech) cloud DB)

```bash
# 1. Install dependencies
npm install

# 2. Set environment variables
cp .env.example .env.local
# Fill in DATABASE_URL in .env.local

# 3. Push schema and seed data
npx prisma db push
npm run db:seed

# 4. Start development server
npm run dev
# → http://localhost:3000
```

---

## Deploying to Vercel + Neon (Free)

**Step 1 — Create a Neon PostgreSQL database**
1. Sign up at [neon.tech](https://neon.tech) → New Project
2. Copy the **pooled connection string**

**Step 2 — Deploy to Vercel**
```bash
npm i -g vercel
vercel
```
Or: push to GitHub → import at [vercel.com/new](https://vercel.com/new)

**Step 3 — Set environment variables in Vercel dashboard**
```
DATABASE_URL                  = <your Neon connection string>
WEBHOOK_SECRET                = prowider-webhook-secret-2024
NEXT_PUBLIC_WEBHOOK_SECRET    = prowider-webhook-secret-2024
```

**Step 4 — Run migrations on production DB**
```bash
DATABASE_URL="<your-neon-url>" npx prisma migrate deploy
DATABASE_URL="<your-neon-url>" npm run db:seed
```

---

## API Reference

### `POST /api/leads`
```json
{
  "name": "Rahul Sharma",
  "phone": "9876543210",
  "city": "Mumbai",
  "serviceId": 1,
  "description": "Need home cleaning service"
}
```
Returns `409` if the same phone + service combination already exists.

### `GET /api/providers`
Returns all 8 providers with their quota stats and assigned leads.

### `GET /api/sse`
SSE stream. Emits `LEAD_CREATED` and `QUOTA_RESET` events to all connected dashboard clients.

### `POST /api/webhook/quota-reset`
Header required: `x-webhook-secret: prowider-webhook-secret-2024`
```json
{
  "idempotencyKey": "any-unique-string",
  "providerId": 3
}
```
Omit `providerId` to reset all 8 providers simultaneously.

---

## Test Scenarios (for reviewer)

| Scenario | Steps | Expected Result |
|---|---|---|
| Duplicate lead | Submit same phone + service twice from `/request-service` | Second submission returns error: "A lead for this phone number and service already exists" |
| Mandatory assignment | Submit any Service 1 lead | Provider 1 always appears in the assignment |
| Fair distribution | Submit 6 consecutive Service 1 leads | Fair pool cycles: P2 → P3 → P4 → P2 → P3 → P4 |
| Quota enforcement | Generate 10+ leads for one service via Test Tools | Dashboard shows providers hitting quota; skipped when full |
| Real-time update | Open `/dashboard` in Tab A, submit lead in Tab B | Dashboard in Tab A updates within ~1–2 seconds, no refresh |
| Webhook idempotency | Test Tools → "Fire Webhook ×3 (Same Key)" | Log shows 1 processed + 2 idempotent responses |
| Concurrency | Test Tools → "Generate 10 Concurrent Leads" | All succeed, allocation is correct, no quota violations |
| Persistence after restart | Submit leads, restart server, submit more | Round-robin continues from where it left off |

---

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon pooled URL recommended) | Yes |
| `WEBHOOK_SECRET` | Validates `x-webhook-secret` header on webhook endpoint | Yes |
| `NEXT_PUBLIC_WEBHOOK_SECRET` | Exposes secret to browser for test-tools panel | Yes |#   p r o w i d e r - l e a d - s y s t e m  
 