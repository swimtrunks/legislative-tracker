# Legislative Tracker Setup Guide

Complete step-by-step guide to set up automated bill tracking from Plural Policy API → Airtable → Framer.

---

## Prerequisites

1. **Plural Policy API Key**
   - Sign up at https://open.pluralpolicy.com/accounts/signup/
   - Navigate to your profile to get your API key
   - Free tier includes sufficient requests for most use cases

2. **Airtable Account**
   - Sign up at https://airtable.com
   - Free plan works for development

3. **Vercel Account**
   - Sign up at https://vercel.com
   - Free tier includes serverless functions and cron jobs

4. **Framer Account**
   - Sign up at https://framer.com
   - Upgrade to a paid plan for CMS features

---

## Step 1: Set Up Airtable Base

### 1.1 Create a New Base
1. Go to https://airtable.com
2. Click "Create a base" → "Start from scratch"
3. Name it "Legislative Tracker"

### 1.2 Create Tables
Follow the schema in `AIRTABLE_SCHEMA.md` to create these tables:
- Bills (main table)
- States
- Legislators
- Subjects
- Committees (optional)
- Sessions (optional)

**Pro Tip:** Use Airtable's "Duplicate Base" feature if someone shares a template.

### 1.3 Get Your Credentials
1. **Personal Access Token:**
   - Go to https://airtable.com/create/tokens
   - Click "Create new token"
   - Name it "Legislative Tracker"
   - Add scopes:
     - `data.records:read`
     - `data.records:write`
     - `schema.bases:read`
   - Add access to your "Legislative Tracker" base
   - Copy the token (you'll only see it once!)

2. **Base ID:**
   - Go to https://airtable.com/api
   - Click on "Legislative Tracker"
   - Your Base ID is in the URL: `appXXXXXXXXXXXXXX`

---

## Step 2: Deploy Serverless Functions to Vercel

### 2.1 Install Vercel CLI
```bash
npm install -g vercel
```

### 2.2 Clone/Download This Project
```bash
cd legislative-tracker
npm install
```

### 2.3 Set Up Environment Variables
1. Create a `.env` file locally (for testing):
```bash
cp .env.example .env
```

2. Fill in your credentials:
```env
PLURAL_API_KEY=your_plural_api_key
AIRTABLE_API_KEY=your_airtable_token
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
WEBHOOK_SECRET=generate_random_string_here
CRON_SECRET=generate_another_random_string_here
```

**Generate random secrets:**
```bash
# On Mac/Linux
openssl rand -base64 32
# Or use: https://www.random.org/strings/
```

### 2.4 Deploy to Vercel
```bash
# Login to Vercel
vercel login

# Deploy
vercel

# Follow prompts:
# - Link to existing project? No
# - Project name: legislative-tracker
# - Directory: ./
```

### 2.5 Set Environment Variables in Vercel
```bash
vercel env add PLURAL_API_KEY
# Paste your key when prompted

vercel env add AIRTABLE_API_KEY
# Paste your token

vercel env add AIRTABLE_BASE_ID
# Paste your base ID

vercel env add WEBHOOK_SECRET
# Paste your secret

vercel env add CRON_SECRET
# Paste your cron secret
```

### 2.6 Deploy to Production
```bash
vercel --prod
```

Your functions will be available at:
- `https://legislative-tracker-sand.vercel.app/api/sync-bills`
- `https://legislative-tracker-sand.vercel.app/api/scheduled-sync`

---

## Step 3: Test the Sync Function

### 3.1 Manual Trigger via API
```bash
curl -X POST https://legislative-tracker-sand.vercel.app/api/sync-bills \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
  -d '{"state": "ca", "limit": 10}'
```

Expected response:
```json
{
  "success": true,
  "message": "Successfully synced 10 of 10 bills for ca",
  "synced": 10,
  "total": 10
}
```

### 3.2 Check Airtable
1. Go to your Airtable base
2. Check the "Bills" table
3. You should see California bills populated
4. Check "Legislators" and "Subjects" tables too

### 3.3 Test More States
```bash
# Texas
curl -X POST https://your-project.vercel.app/api/sync-bills \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
  -d '{"state": "tx", "limit": 50}'

# New York
curl -X POST https://your-project.vercel.app/api/sync-bills \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
  -d '{"state": "ny", "limit": 50}'
```

---

## Step 4: Set Up Automated Syncing

The `scheduled-sync.js` function is already configured to run daily at 2 AM UTC.

### 4.1 Verify Cron is Set Up
Check `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/scheduled-sync",
      "schedule": "0 2 * * *"
    }
  ]
}
```

### 4.2 Customize Sync Schedule (Optional)
Edit the cron schedule in `vercel.json`:
- `0 2 * * *` - Daily at 2 AM
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 0` - Weekly on Sunday at midnight

### 4.3 Monitor Cron Execution
1. Go to https://vercel.com/dashboard
2. Select your project
3. Click "Deployments"
4. Check "Functions" tab for execution logs

---

## Step 5: Connect Airtable to Framer

### Option A: If Framer Has Native Airtable Support

1. **In Framer:**
   - Open your project
   - Go to CMS settings
   - Click "Connect External CMS"
   - Select "Airtable"

2. **Connect Your Base:**
   - Enter Airtable credentials
   - Select "Legislative Tracker" base
   - Map tables:
     - Bills → Bills CMS Collection
     - Legislators → Legislators CMS Collection
     - States → States CMS Collection
     - Subjects → Subjects CMS Collection

3. **Set Up Dynamic Pages:**
   - Create a CMS Collection page for States
   - Create a CMS Collection page for Bills
   - Connect data fields to your design

---

### Option B: If No Native Support (Use Sync Script)

Create a simple sync script to push Airtable data to Framer's CMS API:

```javascript
// sync-to-framer.js
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

async function syncToFramer() {
  // Get all bills from Airtable
  const bills = await base('Bills').select().all();
  
  // Push to Framer CMS API
  for (const bill of bills) {
    await fetch('https://api.framer.com/v1/cms/items', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FRAMER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        collectionId: 'bills',
        fields: {
          title: bill.fields['Title'],
          billId: bill.fields['Bill ID'],
          status: bill.fields['Current Status'],
          // ... map other fields
        },
      }),
    });
  }
}

syncToFramer();
```

---

## Step 6: Build Your Framer Site

### 6.1 Create Page Structure
```
Home Page (/)
├── State Selection Grid
│
State Page (/state/[state-slug])
├── List of Bills for that State
├── Filters (Status, Subject, etc.)
│
Bill Detail Page (/bill/[bill-slug])
├── Full Bill Information
├── Sponsors
├── Timeline of Actions
```

### 6.2 Add Components
- **State Card Component** - Clickable state selector
- **Bill Card Component** - Shows bill summary
- **Sponsor Card Component** - Shows legislator info
- **Status Badge Component** - Visual status indicator
- **Search/Filter Component** - Filter bills

### 6.3 Connect CMS Data
1. Drag a CMS Collection to your page
2. Connect it to "Bills" collection
3. Style the repeating elements
4. Add filters and sorting

---

## Step 7: Ongoing Maintenance

### Monitor Sync Health
```bash
# Check Vercel logs
vercel logs --follow

# Or in dashboard:
# https://vercel.com/dashboard → Your Project → Logs
```

### Update Data Manually
```bash
# Trigger full sync
curl -X POST https://your-project.vercel.app/api/scheduled-sync \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Handle Errors
Common issues:
- **Airtable rate limit** - Add delays between batches
- **API key expired** - Regenerate and update in Vercel
- **Missing data** - Check Plural Policy API response format

---

## Optimization Tips

### 1. Reduce Airtable API Calls
```javascript
// Batch updates
const updates = bills.map(bill => ({
  id: bill.id,
  fields: { ... }
}));

await base('Bills').update(updates);
```

### 2. Add Caching
```javascript
// Use Redis or Vercel KV
import { kv } from '@vercel/kv';

const cached = await kv.get(`bills:${state}`);
if (cached) return cached;
```

### 3. Implement Webhooks
Instead of polling, set up webhooks from Plural Policy (if available) to trigger syncs only when data changes.

### 4. Add Error Notifications
```javascript
// Send email on sync failure
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

if (failed.length > 0) {
  await resend.emails.send({
    from: 'alerts@yourdomain.com',
    to: 'you@email.com',
    subject: 'Legislative Tracker Sync Failed',
    text: `${failed.length} states failed to sync`,
  });
}
```

---

## Troubleshooting

### Function Timeout
If sync takes too long:
1. Reduce the number of bills per request
2. Process states in smaller batches
3. Upgrade Vercel plan for longer function duration

### Airtable Limits
Free tier limits:
- 1,200 records per base
- 5 requests/second

Solutions:
- Upgrade to Airtable Plus ($10/month)
- Archive old bills periodically
- Add delays between requests

### Data Not Showing in Framer
1. Check Airtable has data
2. Verify CMS connection in Framer
3. Refresh Framer CMS sync
4. Check field mappings

---

## Security Best Practices

1. **Never commit `.env` file**
2. **Rotate API keys periodically**
3. **Use strong webhook secrets**
4. **Monitor for unusual API usage**
5. **Enable Vercel deployment protection**

---

## Cost Breakdown

- **Plural Policy API:** Free tier (sufficient for most use cases)
- **Airtable:** Free tier or Plus $10/month
- **Vercel:** Free tier (includes cron jobs)
- **Framer:** $5-20/month depending on plan

**Total:** $15-30/month for a fully automated system

---

## Next Steps

1. ✅ Complete setup following this guide
2. ✅ Test with one state
3. ✅ Expand to multiple states
4. ✅ Build Framer UI
5. ✅ Set up monitoring
6. 🎉 Launch your legislative tracker!

---

## Support & Resources

- **Plural Policy Docs:** https://docs.openstates.org/
- **Airtable API:** https://airtable.com/api
- **Vercel Docs:** https://vercel.com/docs
- **Framer Docs:** https://www.framer.com/developers/

For issues, check GitHub Issues or reach out to the community forums.
