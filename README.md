# Legislative Tracker - Automated Sync System

> Sync legislative data from Plural Policy API → Airtable → Framer

![Architecture Diagram](https://via.placeholder.com/800x200/4A5568/FFFFFF?text=Plural+Policy+API+→+Vercel+Functions+→+Airtable+→+Framer)

## 🎯 What This Does

This project provides a complete serverless infrastructure to:
1. **Fetch** legislative data from the Plural Policy API (50 states + DC + Puerto Rico)
2. **Transform** and normalize the data
3. **Store** it in Airtable (your CMS backend)
4. **Sync** automatically every day via cron jobs
5. **Display** in Framer using native Airtable integration

## ✨ Features

- ✅ Automated daily syncing of bills from all 50 states
- ✅ Tracks bills, legislators, committees, and subjects
- ✅ Handles related data (sponsors, subjects) with proper linking
- ✅ Categorizes bills by topic automatically
- ✅ Serverless architecture (no servers to manage)
- ✅ Free tier friendly (Vercel + Airtable free plans work)
- ✅ Comprehensive error handling and logging

## 🏗️ Architecture

```
┌─────────────────┐
│ Plural Policy   │
│     API         │ ← Source of legislative data
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│ Vercel Function │
│  /api/sync-bills│ ← Transform & validate data
└────────┬────────┘
         │ Airtable API
         ▼
┌─────────────────┐
│   Airtable      │
│   (CMS Backend) │ ← Store normalized data
└────────┬────────┘
         │ Read-only access
         ▼
┌─────────────────┐
│     Framer      │
│  (Frontend)     │ ← Display beautiful UI
└─────────────────┘
```

## 📦 What's Included

```
legislative-tracker/
├── api/
│   ├── sync-bills.js          # Manual trigger endpoint
│   └── scheduled-sync.js      # Automated daily sync
├── package.json               # Dependencies
├── vercel.json                # Vercel config + cron jobs
├── .env.example               # Environment variables template
├── SETUP_GUIDE.md            # Complete setup instructions
├── AIRTABLE_SCHEMA.md        # Database schema
└── README.md                 # This file
```

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone <your-repo>
cd legislative-tracker
npm install
```

### 2. Get API Keys
- **Plural Policy API:** https://open.pluralpolicy.com/accounts/profile/
- **Airtable Token:** https://airtable.com/create/tokens
- **Airtable Base ID:** Create a base, then get ID from https://airtable.com/api

### 3. Set Up Environment
```bash
cp .env.example .env
# Fill in your API keys
```

### 4. Deploy to Vercel
```bash
vercel login
vercel
vercel --prod
```

### 5. Test It
```bash
curl -X POST https://your-project.vercel.app/api/sync-bills \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
  -d '{"state": "ca", "limit": 10}'
```

**📖 For detailed instructions, see [SETUP_GUIDE.md](./SETUP_GUIDE.md)**

## 🗄️ Data Schema

### Bills Table (Main)
| Field | Type | Description |
|-------|------|-------------|
| Bill ID | Text | e.g., "HB 123" |
| Title | Text | Bill title |
| Status | Select | Current status |
| State | Text | Two-letter code |
| Sponsors | Link | → Legislators |
| Subjects | Link | → Subjects |

### Legislators Table
| Field | Type | Description |
|-------|------|-------------|
| Full Name | Text | Legislator name |
| Party | Select | Political party |
| State | Text | Home state |
| Sponsored Bills | Link | → Bills |

**📖 For complete schema, see [AIRTABLE_SCHEMA.md](./AIRTABLE_SCHEMA.md)**

## ⚙️ Configuration

### Sync Frequency
Edit `vercel.json` to change how often data syncs:

```json
{
  "crons": [
    {
      "path": "/api/scheduled-sync",
      "schedule": "0 2 * * *"  // Daily at 2 AM UTC
    }
  ]
}
```

**Cron Schedule Examples:**
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 0` - Weekly on Sunday
- `0 8 * * 1-5` - Weekdays at 8 AM

### States to Sync
Edit `api/scheduled-sync.js` to customize which states sync:

```javascript
const states = [
  'ca', 'ny', 'tx', // Only sync these states
  // ... or keep all 50 states
];
```

### Bills Per State
Adjust the limit parameter:

```javascript
body: JSON.stringify({ state, limit: 100 }) // Sync 100 bills per state
```

## 🔌 API Endpoints

### POST /api/sync-bills
Manually trigger a sync for a specific state.

**Request:**
```bash
curl -X POST https://your-project.vercel.app/api/sync-bills \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
  -d '{"state": "ca", "limit": 50}'
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully synced 50 of 50 bills for ca",
  "synced": 50,
  "total": 50
}
```

### POST /api/scheduled-sync
Triggered automatically by Vercel Cron or manually for full sync.

**Response:**
```json
{
  "message": "Scheduled sync completed",
  "successCount": 48,
  "failedCount": 2,
  "results": { ... }
}
```

## 🔗 Connecting to Framer

### Option 1: Native Integration
1. In Framer, go to CMS
2. Click "Connect External Source"
3. Select "Airtable"
4. Enter your credentials
5. Map tables to CMS collections

### Option 2: Custom Sync Script
If Framer doesn't support Airtable natively, use the sync-to-framer script (see SETUP_GUIDE.md).

## 💰 Cost

| Service | Free Tier | Cost if Upgraded |
|---------|-----------|------------------|
| Plural Policy API | ✅ Yes | Usually free |
| Airtable | 1,200 records | $10/month (Plus) |
| Vercel | 100 GB bandwidth | $20/month (Pro) |
| Framer | No free CMS | $5-20/month |
| **Total** | **~$0-5/month** | **~$35-50/month** |

Most small/medium projects work fine on free tiers!

## 🐛 Troubleshooting

### "Unauthorized" Error
- Check your `WEBHOOK_SECRET` or `CRON_SECRET` is correct
- Verify authorization header in request

### No Data in Airtable
- Check Vercel function logs: `vercel logs`
- Verify Airtable credentials are correct
- Test Airtable API manually with curl

### Function Timeout
- Reduce `limit` parameter (fewer bills per request)
- Process states in smaller batches
- Upgrade Vercel plan for longer execution time

### Framer Not Showing Data
- Refresh CMS connection in Framer
- Check field mappings are correct
- Verify Airtable has data

## 📊 Monitoring

### View Logs
```bash
# Real-time logs
vercel logs --follow

# Or in Vercel Dashboard:
# https://vercel.com/dashboard → Your Project → Logs
```

### Check Sync Status
```bash
# Trigger manual sync and see response
curl -X POST https://your-project.vercel.app/api/sync-bills \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
  -d '{"state": "ca", "limit": 1}'
```

### Airtable API Usage
Monitor at: https://airtable.com/account

## 🛠️ Development

### Run Locally
```bash
# Install dependencies
npm install

# Start Vercel dev server
vercel dev

# Or use Node directly
node api/sync-bills.js
```

### Test Individual Functions
```javascript
// test.js
require('dotenv').config();
const handler = require('./api/sync-bills').default;

handler({
  method: 'POST',
  headers: { authorization: `Bearer ${process.env.WEBHOOK_SECRET}` },
  body: { state: 'ca', limit: 5 }
}, {
  status: (code) => ({
    json: (data) => console.log(code, data)
  })
});
```

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

MIT License - feel free to use this for personal or commercial projects.

## 🙏 Credits

- **Plural Policy** for providing free legislative data
- **Airtable** for flexible database platform
- **Vercel** for serverless hosting
- **Framer** for beautiful website building

## 📚 Resources

- [Plural Policy API Docs](https://docs.openstates.org/api-v3/)
- [Airtable API Reference](https://airtable.com/api)
- [Vercel Functions](https://vercel.com/docs/functions)
- [Framer CMS](https://www.framer.com/developers/)

---

Built with ❤️ for transparent government
