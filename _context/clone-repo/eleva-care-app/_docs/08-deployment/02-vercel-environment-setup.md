# 🔧 Vercel Environment Variables Setup

## 🚨 **Missing Novu Configuration**

Your production deployment is missing the Novu API key. Here's how to fix it:

### **1. Get Your Novu API Key**

1. Go to [Novu Dashboard](https://dashboard.novu.co)
2. Navigate to **Settings** → **API Keys**
3. Copy your **Secret Key** (starts with `nv_...`)

### **2. Add to Vercel Environment Variables**

#### **Option A: Via Vercel Dashboard**

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your `eleva-care-app` project
3. Go to **Settings** → **Environment Variables**
4. Add these variables:

```bash
# Required Novu Variables
NOVU_SECRET_KEY=nv_your_secret_key_here
NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER=your_app_identifier_here

# Optional (if using EU region)
NOVU_BASE_URL=https://eu.api.novu.co
NOVU_SOCKET_URL=https://eu.ws.novu.co

# For admin notifications
NOVU_ADMIN_SUBSCRIBER_ID=admin
```

#### **Option B: Via Vercel CLI**

```bash
# Set the Novu secret key
vercel env add NOVU_SECRET_KEY

# Set the application identifier
vercel env add NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER

# Optional: Set region URLs if using EU
vercel env add NOVU_BASE_URL
vercel env add NOVU_SOCKET_URL
```

### **3. Redeploy**

After adding the environment variables:

```bash
# Trigger a new deployment
vercel --prod

# Or push a commit to trigger automatic deployment
git commit --allow-empty -m "trigger redeploy for env vars"
git push origin main
```

## 🔍 **Verify Setup**

### **Check Environment Variables**

```bash
# List all environment variables
vercel env ls

# Should show:
# NOVU_SECRET_KEY (Production)
# NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER (Production, Preview, Development)
```

### **Test After Deployment**

```bash
# Test the health check endpoint
curl https://eleva.care/api/healthcheck

# Look for:
# "hasNovu": true
```

## 🎯 **Environment Variable Mapping**

| **Variable**                              | **Required** | **Environment** | **Purpose**                   |
| ----------------------------------------- | ------------ | --------------- | ----------------------------- |
| `NOVU_SECRET_KEY`                         | ✅ Yes       | Production      | API authentication            |
| `NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER` | ✅ Yes       | All             | App identifier                |
| `NOVU_BASE_URL`                           | ⚠️ Optional  | All             | API endpoint (defaults to US) |
| `NOVU_SOCKET_URL`                         | ⚠️ Optional  | All             | WebSocket endpoint            |
| `NOVU_ADMIN_SUBSCRIBER_ID`                | ⚠️ Optional  | All             | Admin notifications           |

## 🚨 **Security Notes**

- ✅ **NOVU_SECRET_KEY**: Server-side only (not public)
- ✅ **NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER**: Public (client-side accessible)
- ⚠️ Never commit API keys to your repository
- ⚠️ Use different keys for development/production

## 🔄 **After Setup**

Once the environment variables are configured and deployed:

1. **Payouts will work**: ✅ Stripe payouts will continue to process
2. **Notifications will work**: ✅ Novu notifications will be sent
3. **Dashboard activity**: ✅ You'll see activity in Novu dashboard
4. **Logs will show**: `[Novu] Successfully triggered workflow: user-lifecycle`

---

**The payout itself worked correctly (€238 was processed), you just need to fix the notification system by adding the missing environment variables!** 🎯
