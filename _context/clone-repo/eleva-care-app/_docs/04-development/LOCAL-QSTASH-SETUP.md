# Local QStash Development Setup

## 🎯 Purpose

This guide helps you set up local QStash development to **prevent accidentally triggering production cron jobs** while testing locally.

## ⚠️ The Problem

When you run `pnpm build` locally with production QStash credentials, it:

1. Deletes all production QStash schedules
2. Recreates them with your local development URL
3. Production cron jobs start failing ❌

**Solution:** Use local QStash server + separate dev credentials

---

## 📋 Setup Steps

### **Step 1: Create Separate Dev Upstash Projects**

You should have already created:

- ✅ **Dev QStash project** (separate from production)
- ✅ **Dev Redis database** (separate from production)

If not, create them at [console.upstash.com](https://console.upstash.com)

### **Step 2: Local QStash Server (Auto-starts with `pnpm dev`)**

✅ **Good news!** The local QStash server now **automatically starts** when you run `pnpm dev`.

The server runs in parallel with Next.js using `concurrently`, so you don't need to manage it manually!

**What happens automatically:**

- Local QStash server starts on `http://localhost:8080`
- Provides default credentials for authentication
- Intercepts all QStash API calls
- Shuts down when you stop the dev server

**If you need to run it separately:**

```bash
# Start the local QStash server only
pnpm qstash:dev
```

**Expected output:**

```
QStash local development server running on http://localhost:8080
```

---

### **Step 3: Create `.env.local` File**

Create a new file `.env.local` in your project root:

```bash
# Copy your current production env as a template
cp _backup_env .env.local

# Edit the file
code .env.local  # or nano .env.local
```

### **Step 4: Update `.env.local` with Dev Credentials**

Replace these sections in `.env.local`:

#### **QStash Configuration** (Auto-configured!)

```bash
# Point to LOCAL QStash server (auto-starts with pnpm dev)
QSTASH_URL=http://127.0.0.1:8080

# Default credentials from local QStash server
# These are automatically provided when you run `pnpm dev`
QSTASH_TOKEN=eyJVc2VySUQiOiJkZWZhdWx0VXNlciIsIlBhc3N3b3JkIjoiZGVmYXVsdFBhc3N3b3JkIn0=
QSTASH_CURRENT_SIGNING_KEY=sig_7kYjw48mhY7kAjqNGcy6cr29RJ6r
QSTASH_NEXT_SIGNING_KEY=sig_5ZB6DVzB1wjE8S6rZ7eenA8Pdnhs
```

#### **Redis Configuration**

```bash
# Use DEV Redis instance
UPSTASH_REDIS_REST_URL=https://xxx-dev.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_dev_redis_token
```

#### **Application URL**

```bash
# Local development URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### **Other Services** (use test credentials)

```bash
# WorkOS (test keys)
WORKOS_API_KEY=your_workos_test_key
WORKOS_CLIENT_ID=your_workos_test_client_id
WORKOS_REDIRECT_URI=http://localhost:3000/api/auth/callback

# Stripe (ALWAYS test keys locally)
STRIPE_SECRET_KEY=sk_test_your_stripe_test_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_test_key
```

---

## 🚀 Using Local QStash

### **Single Command to Start Everything!**

```bash
pnpm dev
```

That's it! This automatically starts:

1. ✅ Local QStash server on `http://localhost:8080`
2. ✅ Next.js dev server on `http://localhost:3000`

Both run in parallel with color-coded output:

- **NEXT** (cyan) - Next.js logs
- **QSTASH** (magenta) - QStash server logs

### **How It Works**

1. Your app reads `QSTASH_URL=http://127.0.0.1:8080` from `.env.local`
2. All QStash API calls go to local server instead of production
3. Local QStash server logs all operations (visible in the terminal)
4. No production schedules are affected! ✅

### **Alternative: Run Services Separately**

If you prefer to run them separately:

```bash
# Terminal 1: Start local QStash only
pnpm qstash:dev

# Terminal 2: Start Next.js only
pnpm dev:only
```

---

## ✅ Verification Steps

### **1. Check QStash is Using Local Server**

When you run `pnpm build`, you should see:

```bash
🔄 Updating QStash schedules...
Using application base URL: http://localhost:3000
```

**NOT** `https://eleva.care` (that would be production!)

### **2. Check Your Environment**

```bash
# In your project root
node -e "require('dotenv').config({ path: '.env.local' }); console.log('QSTASH_URL:', process.env.QSTASH_URL)"
```

**Expected:** `QSTASH_URL: http://127.0.0.1:8080`

### **3. Check Local QStash Server Logs**

In Terminal 1 (where local QStash is running), you should see API calls:

```
POST /v2/schedules → Creating new schedule
GET /v2/schedules → Listing schedules
DELETE /v2/schedules/:id → Deleting schedule
```

---

## 🎨 Development Workflow

### **Starting Development**

```bash
# One command starts everything!
pnpm dev

# This runs in parallel:
# - Next.js dev server (cyan output)
# - Local QStash server (magenta output)
```

### **Testing Cron Jobs Locally**

You can trigger cron endpoints directly:

```bash
# Test appointment reminders
curl -X GET "http://localhost:3000/api/cron/appointment-reminders"

# Test payment processing
curl -X GET "http://localhost:3000/api/cron/process-expert-transfers"
```

### **Building Locally**

```bash
# This will update LOCAL QStash schedules only
pnpm build
```

The `postbuild` script runs `update-qstash-schedules.ts`, which:

- Connects to `http://127.0.0.1:8080` (local)
- Deletes existing schedules (in local QStash)
- Creates new schedules (in local QStash)
- **Production is untouched!** ✅

---

## 🔒 Security Best Practices

### **1. Never Commit `.env.local`**

Already in `.gitignore` - but double-check:

```bash
# Verify .env.local is ignored
git status .env.local
# Should show: "No such file or directory" or "nothing to commit"
```

### **2. Use Separate Encryption Keys**

Generate a NEW encryption key for dev data:

```bash
openssl rand -hex 32
```

Add to `.env.local`:

```bash
ENCRYPTION_KEY=your_new_dev_encryption_key_here
```

### **3. Use Test API Keys**

- ✅ **Stripe:** Always `sk_test_...` and `pk_test_...`
- ✅ **WorkOS:** Use test environment keys
- ✅ **Database:** Consider using separate dev database

---

## 🐛 Troubleshooting

### **Problem: "QStash client is not initialized"**

**Solution:** Check your `.env.local` has valid credentials:

```bash
cat .env.local | grep QSTASH_TOKEN
```

### **Problem: Local QStash server not responding**

**Solution:** Restart the server:

```bash
# Kill existing process
pkill -f qstash-cli

# Start fresh
npx @upstash/qstash-cli@latest dev
```

### **Problem: Production schedules were updated by mistake**

**Solution:**

1. Stop local dev server
2. Verify you're using `.env.local` with `QSTASH_URL=http://127.0.0.1:8080`
3. Redeploy production to recreate production schedules:
   ```bash
   # On production (Vercel)
   vercel --prod
   ```

### **Problem: Cron jobs not triggering locally**

Local QStash is for **schedule management** only. To test cron execution locally, trigger endpoints directly:

```bash
curl http://localhost:3000/api/cron/YOUR_ENDPOINT
```

---

## 📊 Architecture Overview

### **Production Environment**

```
Production App (Vercel)
    ↓
Production QStash → Production Schedules
    ↓
Production Redis → Production Data
```

### **Local Development Environment**

```
Local App (localhost:3000)
    ↓
Local QStash (localhost:8080) → Local Schedules
    ↓
Dev QStash (Upstash) → Dev Credentials
    ↓
Dev Redis (Upstash) → Dev Data
```

**Complete isolation! No cross-contamination! 🎉**

---

## 🚀 Deployment Workflow

When you're ready to deploy:

### **Option 1: Update Production Env Vars (Recommended)**

1. Test thoroughly with dev credentials
2. In Vercel/production, update env vars to point to "new" Upstash projects
3. Deploy
4. Production now uses WorkOS + new infrastructure

### **Option 2: Gradual Migration**

1. Keep production running (Clerk + old Upstash)
2. Test staging with WorkOS + new Upstash
3. Switch when confident
4. Update production env vars
5. Deploy

---

## 📝 Quick Reference

### **Environment Variables to Update**

| Variable                 | Production              | Local Development       |
| ------------------------ | ----------------------- | ----------------------- |
| `QSTASH_URL`             | (not set, uses default) | `http://127.0.0.1:8080` |
| `QSTASH_TOKEN`           | Prod token              | Dev token               |
| `UPSTASH_REDIS_REST_URL` | Prod Redis URL          | Dev Redis URL           |
| `NEXT_PUBLIC_APP_URL`    | `https://eleva.care`    | `http://localhost:3000` |
| `WORKOS_API_KEY`         | Prod key                | Test key                |
| `STRIPE_SECRET_KEY`      | `sk_live_...`           | `sk_test_...`           |

### **Key Commands**

```bash
# Start everything (QStash + Next.js)
pnpm dev

# Start only Next.js (no QStash)
pnpm dev:only

# Start only QStash
pnpm qstash:dev

# Build locally (updates local QStash only)
pnpm build

# Test cron endpoint
curl http://localhost:3000/api/cron/YOUR_ENDPOINT

# Check QStash status
curl http://127.0.0.1:8080/v2/schedules

# Update QStash schedules manually
pnpm qstash:update
```

---

## ✅ Checklist

Before starting development:

- [ ] Created separate Dev Upstash Redis database
- [ ] Created separate Dev QStash (or using dev project)
- [ ] Created `.env.local` file
- [ ] Set `QSTASH_URL=http://127.0.0.1:8080` in `.env.local`
- [ ] Added default QStash credentials (provided in template)
- [ ] Updated all credentials to use dev/test keys
- [ ] Installed dependencies (`pnpm install`)
- [ ] Verified `.env.local` is in `.gitignore`
- [ ] Started development (`pnpm dev` - auto-starts QStash + Next.js)
- [ ] Tested that production schedules are unchanged

---

## 📚 Additional Resources

- [Upstash QStash Docs](https://upstash.com/docs/qstash)
- [QStash Local Development](https://upstash.com/docs/qstash/quickstarts/nextjs)
- [Upstash Console](https://console.upstash.com)
- [Project Setup Guide](/docs/01-getting-started/SETUP.md)

---

**Last Updated:** 2025-11-06  
**Status:** ✅ Ready for use
