# Brainstake Digital Signage - Production Deployment Guide

## System is Production Ready ✅

### Pre-Deployment Checklist

#### 1. Environment Variables (`.env.local`)
Create `.env.local` file in the signage directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://brainstake.signage.tech
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (get from Supabase Dashboard > Settings > API)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (get from Supabase Dashboard > Settings > API)

# Resend Email API (Optional - for notifications)
RESEND_API_KEY=re_xxxxxxxxxxxx
```

#### 2. Supabase Database Setup

**Single Migration - Run this entire file:**
```bash
# Run this in Supabase SQL Editor (single query)
c:\Users\user\Downloads\Brainstake_Digital_Signage_Platform\signage\supabase\schema_complete.sql
```

This creates:
- All tables (bookings, campaigns, ads, devices, locations, etc.)
- All RPC functions (player_feed, admin functions, payment functions)
- All RLS policies
- All grants and seed data

#### 3. Supabase Storage Buckets

Create these buckets in Supabase Dashboard > Storage:

**Bucket: `ads`** (Private)
- Used for: Customer ad uploads
- RLS Policy: Allow authenticated uploads, public reads for active bookings

**Bucket: `fallback_content`** (Public)
- Used for: Admin fallback/promotional content
- RLS Policy: Allow admin uploads, public reads

```sql
-- Run this in SQL Editor to create storage policies:
-- Ads bucket policies
insert into storage.buckets (id, name, public) values ('ads', 'ads', false);
insert into storage.buckets (id, name, public) values ('fallback_content', 'fallback_content', true);
```

#### 4. Build Test

```bash
cd signage
npm run build
```

Should complete without errors. If you see TypeScript errors, run:
```bash
npm run typecheck
```

#### 5. Verify CORS (Already Configured)

CORS headers are configured in `next.config.js` for `/api/device/*` routes. No action needed.

---

## Deployment Steps

### Option A: Vercel (Recommended)

1. Push code to GitHub
2. Connect repo to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Option B: Self-Hosted (Node.js Server)

```bash
# Build
cd signage
npm run build

# Start production server
npm start
```

### Option C: Docker

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Post-Deployment Verification

### Critical User Flows to Test

1. **Customer Registration & Login**
   - Sign up at `/auth/signup`
   - Confirm email (check Supabase Auth settings)
   - Login at `/auth/login`

2. **Customer Booking Flow**
   - Create campaign at `/dashboard/campaigns/new`
   - Upload ad content
   - Select location & dates
   - Submit for payment

3. **Payment Flow**
   - Customer submits payment proof at `/dashboard/payment/campaign/[id]`
   - Admin approves at `/admin/payments`
   - Booking becomes active

4. **Admin Assignment**
   - Admin assigns booking to device at `/admin/assign`
   - Set slots per day
   - Verify dates display correctly

5. **Ad Playback**
   - Device calls `/api/device/content?token=xxx`
   - Verify ads display in correct slots
   - Verify past-due ads don't show

6. **Admin Date Changes**
   - Change booking dates in `/admin/assign`
   - Verify no errors
   - Verify customer receives notification

---

## Production Checklist

### Security
- [ ] Environment variables set in production
- [ ] SUPABASE_SERVICE_ROLE_KEY never exposed to client
- [ ] CORS headers configured for device API
- [ ] RLS policies active on all tables

### Database
- [ ] `schema_complete.sql` executed successfully
- [ ] All RPC functions working (test with SQL Editor)
- [ ] Storage buckets created with policies
- [ ] Auto-complete job scheduled (optional):
  ```sql
  -- Run daily to mark expired bookings as completed
  SELECT cron.schedule('auto-complete-bookings', '0 0 * * *', 'SELECT public.mark_completed_bookings()');
  ```

### Monitoring
- [ ] Device heartbeats logging (check `devices.last_seen_at`)
- [ ] Failed pairing attempts monitored (`devices.pair_attempts`)
- [ ] Payment submissions tracked

### Backups
- [ ] Supabase daily backups enabled (automatic on paid plans)
- [ ] Critical data export procedure documented

---

## Troubleshooting

### Issue: "invalid input syntax for type uuid"
**Solution**: Database RPC caching issue. Already fixed by using direct SQL in API route.

### Issue: Past-due ads still showing
**Solution**: Run this SQL to update player functions:
```sql
-- Update player_feed with date checks
CREATE OR REPLACE FUNCTION public.player_feed(p_device_id uuid) ...
-- (Full function from schema_complete.sql)
```

### Issue: Build fails with TypeScript errors
**Solution**: 
```bash
npm run typecheck
# Fix any errors, then rebuild
```

### Issue: CORS errors on Android app
**Solution**: Already fixed in `next.config.js`. If issues persist, verify the API route returns proper headers.

---

## Contact & Support

- **Brand Color**: `#0f7b4a`
- **Default Phone**: `+263 772 123 456` (update in `/admin/contact-settings`)
- **Database**: Single file `schema_complete.sql` for complete setup

## System Status: ✅ PRODUCTION READY

All critical fixes completed:
- ✅ Admin date updates working
- ✅ Past-due ad filtering implemented
- ✅ Single migration file consolidated
- ✅ CORS configured for Android app
- ✅ RPC caching issues bypassed
