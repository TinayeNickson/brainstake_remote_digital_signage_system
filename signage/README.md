# Brainstake — Digital Signage System

A production-shaped platform for selling, scheduling, and playing advertisements
on a network of digital screens. Built on Next.js 14 (App Router) and Supabase
(Postgres + Auth + Storage), with Resend for receipt email.

---

## What's in the box

- **Customer flow** — register, upload an ad, pick location / duration / days /
  slots, get a real-time quote, upload proof of payment, receive a receipt.
- **Accountant flow** — queue of submitted payments, view proof, approve or
  reject, auto-generated receipt + email on approval.
- **Admin flow** — manage locations (pricing + capacity), devices, security
  guards (1:1 with devices), assign approved ads to specific screens, and
  **manage user roles**.
- **Player** — a fullscreen web player per device that fetches its schedule,
  rotates ads honoring duration and slots-per-day weighting, and heartbeats
  back to the server on every poll.

---

## Roles & how sign-up works

Brainstake has three roles:

| Role | Default for new sign-ups? | What they can do |
|---|---|---|
| `customer`   | **yes** | Upload ads, book slots, pay, view receipts. |
| `accountant` | no | Verify payments. Also sees customer data. |
| `admin`      | no | Everything, plus manage locations, devices, guards, and user roles. |

**Every new account is a `customer`.** This is enforced at three layers so
nobody can self-promote:

1. Schema default — `profiles.role user_role not null default 'customer'`
2. The `handle_new_user()` trigger inserts without specifying role, so the
   default applies.
3. Row-Level Security — the `profiles_self_update` policy's `WITH CHECK` pins
   `role` to the caller's current role. A user cannot change their own role
   even through the anon client.

Only admins can change roles, through **`/admin/users`** in the UI. That page
POSTs to `/api/admin/users` which re-checks the caller's role and uses the
service-role key to update the row. An admin cannot demote themselves — the
route rejects it — so the system always has at least one admin.

---

## Branding

Brainstake uses a deep editorial green (`#0f7b4a`, deep variant `#0a2e1f`)
with a soft mint tint (`#d9ecde`). The palette is defined once in
[`src/app/globals.css`](./src/app/globals.css) as CSS variables and mirrored
in [`tailwind.config.ts`](./tailwind.config.ts) as the `brand` token, so:

- `bg-brand`, `text-brand`, `border-brand`, `bg-brand-soft`, `bg-brand-deep`
  are all available inline.
- `.btn-primary`, `.input:focus`, and the Nav live-dot all draw from the
  CSS variables, so changing `:root { --brand: ... }` rebrands the entire
  app without touching components.

The wordmark and icon live in [`src/components/BrandMark.tsx`](./src/components/BrandMark.tsx),
and the animated signage-network visualization used on login/register is
[`src/components/SignageHero.tsx`](./src/components/SignageHero.tsx).

---

## Architecture

```
┌────────────┐   cookies   ┌──────────────────┐
│  Browser   │ ──────────▶ │  Next.js (RSC)   │
│  (customer,│             │  /app, /api/*    │
│ accountant,│             └────────┬─────────┘
│   admin)   │                      │ service-role (API routes only)
└─────┬──────┘                      │    anon (RLS enforced)
      │ HLS/img                     ▼
┌─────▼──────┐  feed poll  ┌──────────────────┐
│   Player   │ ──────────▶ │   Supabase       │
│  (screen)  │             │  Postgres        │
└────────────┘             │  Auth · Storage  │
                           └──────────────────┘
```

**The database is the source of truth.** Every rule that involves money or
slot availability lives in a Postgres function, not in TypeScript:

- `quote_price(...)` — pricing
- `location_daily_availability(...)` — what's left on each date
- `create_booking_atomic(...)` — the **only** way to create a booking; locks
  the location row with `SELECT … FOR UPDATE` before checking and inserting,
  so two concurrent customers cannot overbook the same slot.
- `approve_payment(payment_id)` — atomically flips booking → active, inserts
  receipt with a generated `RCT-YYYYMM-000000` number.

Row-Level Security is on for every table. Customers see their own rows,
accountants/admins see everything, and only the server-defined functions can
create bookings or approve payments.

Storage has two buckets:

- `ad-media` — **public read** (screens need the URL), owner-only write.
- `payment-proofs` — **private**; served to staff through short-lived signed URLs.

---

## Setup

### 1. Database

Open the Supabase SQL editor for your project and run
[`supabase/schema.sql`](./supabase/schema.sql). This creates all tables,
enums, indexes, RLS policies, stored procedures, and storage buckets.

### 2. Environment

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # server-only
NEXT_PUBLIC_SITE_URL=http://localhost:3000

RESEND_API_KEY=<resend-api-key>                # optional in dev
[email protected]
```

### 3. Install & run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

### 4. Seed the first admin

Register a normal account at `/register` (it'll be a customer), then in the
Supabase SQL editor promote it exactly once:

```sql
update profiles set role = 'admin' where email = '[email protected]';
```

After that, sign in and go to **`/admin/users`** to manage every other role
from the UI.

---

## Using the system

### Customer

1. Register at `/register`.
2. `/dashboard/new` — upload image/video, pick location, duration, days, slots.
   Price updates live; the server re-validates it before accepting the booking.
3. Redirected to `/dashboard/payment/<booking-id>` — pick method, upload proof.
4. Wait for approval. Receipt appears under `/dashboard/receipts`, also emailed.

### Accountant

1. `/accountant` — queue filtered by pending / approved / rejected.
2. Click **View proof ↗** to open the signed URL of the uploaded proof.
3. Approve → booking becomes `active`, receipt issued, email sent.
   Reject → prompt for a reason, customer can re-submit.

### Admin

- `/admin` — approved ads only, with placement status.
- `/admin/locations` — CRUD, set `price_15s`, `price_30s`, `max_slots_per_day`.
- `/admin/guards` — CRUD.
- `/admin/devices` — CRUD; the form only lists guards not yet assigned to a
  device, enforcing the 1:1 rule at the UI layer too.
- `/admin/assign` — pick a screen for each active booking. Only screens in the
  booking's location are offered.
- `/admin/users` — promote customers to accountant or admin. Has filter chips
  per role and a search box.

### Player (screen side)

Open `/player/<device-id>` in a browser on the screen itself. The page:

- polls `/api/player/<device-id>/feed` every 30 s (also updates `last_seen_at`),
- builds a round-robin playlist where each ad appears `slots_per_day` times
  per cycle,
- plays images for their configured duration (15 s / 30 s), plays videos through,
- shows a discreet **Standby** card when nothing is scheduled for today.

The player is a plain web page — no Electron, no native wrapper. Any Chromium
in kiosk mode works.

---

## API surface

All non-public routes require an authenticated session cookie. Role gating
happens inside the route via `requireRole(...)`.

| Method | Route | Role | Purpose |
|---|---|---|---|
| POST | `/api/pricing/quote` | any auth | Server-side price calc |
| GET  | `/api/availability` | any auth | Remaining slots per date |
| POST | `/api/bookings/create` | customer | Atomic booking via RPC |
| POST | `/api/payments/submit` | customer | Attach proof, submit |
| POST | `/api/payments/:id/approve` | accountant/admin | Approve + receipt + email |
| POST | `/api/payments/:id/reject` | accountant/admin | Reject with reason |
| POST | `/api/admin/locations` (+ PATCH) | admin | Location CRUD |
| POST | `/api/admin/guards` (+ PATCH) | admin | Guard CRUD |
| POST | `/api/admin/devices` (+ PATCH) | admin | Device CRUD |
| POST | `/api/admin/assign` | admin | Attach booking → device |
| PATCH| `/api/admin/users` | admin | Change user role |
| GET  | `/api/player/:deviceId/feed` | public | Screen schedule + heartbeat |

---

## Operational notes

- **Completing bookings.** Call `select public.mark_completed_bookings();`
  daily. This flips `active` bookings whose `end_date` has passed to `completed`.
- **Device authentication.** The player identifies itself by its UUID in the
  URL. That's fine for a demo; for production, swap in a rotating device token
  and require it on the feed endpoint.
- **Receipt numbering.** `receipt_seq` starts at 1000 and produces
  `RCT-YYYYMM-<6-digit seq>` via `generate_receipt_number()`. Atomic under
  concurrent approvals.
- **Email failures.** `approve_payment` commits the booking + receipt inside
  the transaction. Email is sent *after* the commit; if Resend is down, the
  user still sees the receipt in their portal.
- **Concurrency.** `create_booking_atomic` takes a row lock on `locations`
  before the capacity check. Two customers racing for the last slot are
  serialized; the loser gets a clean 409.

---

## Project layout

```
supabase/schema.sql           — complete DB: tables, RLS, procedures, storage
src/lib/                      — supabase clients, auth, pricing, email, types
src/app/                      — Next.js App Router
  page.tsx                    — landing
  login/, register/           — auth pages (Brainstake-themed)
  dashboard/                  — customer flow (new, payment, receipts)
  accountant/                 — approval queue
  admin/                      — locations, devices, guards, assign, approved ads, users
  player/[deviceId]/          — fullscreen screen-side player
  api/                        — server routes
src/components/
  BrandMark.tsx               — Brainstake wordmark + icon
  SignageHero.tsx             — animated screen-network panel on auth pages
  Nav.tsx, DaySelector.tsx    — app chrome
src/middleware.ts             — Supabase cookie refresh
```
