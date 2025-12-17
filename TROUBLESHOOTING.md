# Troubleshooting Guide

Common issues and their solutions when setting up the Legislative Tracker.

---

## 🔴 Deployment Issues

### "Build failed" on Vercel

**Problem:** Vercel deployment fails with build errors.

**Solutions:**
1. Check that `package.json` has all required dependencies
2. Verify Node.js version compatibility
3. Check Vercel build logs for specific errors

```bash
# View deployment logs
vercel logs <deployment-url>
```

### Environment Variables Not Working

**Problem:** Functions work locally but fail in production.

**Solution:** 
Make sure environment variables are set in Vercel:

```bash
# Set each variable
vercel env add PLURAL_API_KEY
vercel env add AIRTABLE_API_KEY
vercel env add AIRTABLE_BASE_ID
vercel env add WEBHOOK_SECRET
vercel env add CRON_SECRET

# Verify they're set
vercel env ls
```

**Or via Dashboard:**
1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add each variable

---

## 🔴 API Connection Issues

### "Unauthorized" Error from Plural Policy API

**Problem:** 
```json
{
  "error": "Plural API error: 401 Unauthorized"
}
```

**Solutions:**
1. Verify your API key at https://open.pluralpolicy.com/accounts/profile/
2. Check if key is properly set in environment variables
3. Regenerate API key if needed

**Test manually:**
```bash
curl -H "X-API-KEY: your_key_here" \
  https://v3.openstates.org/jurisdictions
```

### "403 Forbidden" from Airtable

**Problem:**
```
Airtable connection failed: Forbidden
```

**Solutions:**
1. Check your Personal Access Token has correct scopes:
   - `data.records:read`
   - `data.records:write`
   - `schema.bases:read`

2. Verify token has access to your base:
   - Go to https://airtable.com/create/tokens
   - Edit your token
   - Add "Legislative Tracker" base under "Access"

3. Confirm Base ID is correct:
   - Should start with "app"
   - Get from: https://airtable.com/api → Select your base

### Rate Limit Errors

**Problem:**
```
Error 429: Too Many Requests
```

**Solutions:**

**For Plural Policy API:**
```javascript
// Add delays between requests
await new Promise(resolve => setTimeout(resolve, 1000));
```

**For Airtable (5 requests/second):**
```javascript
// Batch updates instead of individual creates
const updates = records.map(r => ({ id: r.id, fields: {...} }));
await base('Bills').update(updates);
```

---

## 🔴 Data Sync Issues

### Bills Not Appearing in Airtable

**Problem:** Function succeeds but no data in Airtable.

**Checklist:**
1. ✅ Tables exist with correct names (Bills, Legislators, Subjects, States)
2. ✅ Field names match exactly (case-sensitive)
3. ✅ Linked record fields allow multiple records
4. ✅ API key has write permissions

**Debug Steps:**
```bash
# Run test locally to see detailed logs
node test-sync.js

# Check Vercel function logs
vercel logs --follow
```

### Duplicate Records Being Created

**Problem:** Same bill appears multiple times.

**Solution:** The sync function should use `findOrCreateRecord` which checks for existing records. Verify:

1. "OpenStates ID" field exists in Bills table
2. Field is populated (check a few records)
3. Function is using correct search field

**Fix in code:**
```javascript
// Make sure this line exists
await findOrCreateRecord(
  'Bills',
  'OpenStates ID',  // ← Must match field name exactly
  bill.id,
  recordData
);
```

### Linked Records Not Working

**Problem:** Sponsors or Subjects fields are empty.

**Solution:** 

1. Ensure linked record fields are created in Airtable:
   - Bills table → "Sponsors" field → Linked to Legislators table
   - Bills table → "Subject Areas" field → Linked to Subjects table

2. Check that IDs are being returned:
```javascript
// Add logging
console.log('Sponsor IDs:', sponsorIds);
console.log('Subject IDs:', subjectIds);
```

3. Verify field names match:
```javascript
recordData: {
  'Sponsors': sponsorIds,  // ← Must match Airtable field name
  'Subject Areas': subjectIds,  // ← Must match Airtable field name
}
```

---

## 🔴 Function Execution Issues

### Function Timeout

**Problem:**
```
Error: Function execution timed out
```

**Solutions:**

1. **Increase timeout in vercel.json:**
```json
{
  "functions": {
    "api/sync-bills.js": {
      "maxDuration": 60  // Increase from 10 to 60 seconds
    }
  }
}
```

2. **Reduce bills per request:**
```javascript
// In your trigger
{ "state": "ca", "limit": 25 }  // Instead of 100
```

3. **Process in batches:**
```javascript
// Split large syncs
const states = ['ca', 'ny', 'tx'];
for (const state of states) {
  await syncBills(state, 25);
  await new Promise(r => setTimeout(r, 5000)); // 5 sec delay
}
```

4. **Upgrade Vercel plan:**
   - Free: 10 second max
   - Hobby: 10 second max
   - Pro: 60 second max
   - Enterprise: 900 second max

### Memory Limit Exceeded

**Problem:**
```
Error: Function exceeded memory limit
```

**Solutions:**

1. Process fewer records at once
2. Clear variables after use:
```javascript
let bills = await fetchBills();
// Process bills
bills = null; // Free memory
```

3. Use streaming for large datasets
4. Upgrade Vercel plan (Pro: 3008 MB)

---

## 🔴 Cron Job Issues

### Scheduled Sync Not Running

**Problem:** Daily sync isn't triggering automatically.

**Checklist:**
1. ✅ Deployed to production (not preview)
2. ✅ `vercel.json` contains cron config
3. ✅ `CRON_SECRET` environment variable is set
4. ✅ Vercel plan supports cron jobs (all plans do)

**Verify Cron Setup:**
```bash
# Check vercel.json
cat vercel.json

# Should contain:
{
  "crons": [{
    "path": "/api/scheduled-sync",
    "schedule": "0 2 * * *"
  }]
}

# Deploy and check
vercel --prod
```

**View Cron Logs:**
1. Go to Vercel Dashboard
2. Select your project
3. Click "Deployments" → "Functions"
4. Look for `/api/scheduled-sync` executions

### Cron Schedule Not Working

**Problem:** Cron runs at wrong time or not at all.

**Solution:** Verify cron syntax:

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6)
│ │ │ │ │
* * * * *
```

**Examples:**
- `0 2 * * *` - 2 AM daily
- `0 */6 * * *` - Every 6 hours
- `0 8 * * 1-5` - 8 AM on weekdays
- `0 0 * * 0` - Midnight on Sunday

**Test Cron Syntax:** https://crontab.guru/

---

## 🔴 Framer Integration Issues

### Airtable Data Not Showing in Framer

**Problem:** Framer CMS shows empty or won't connect.

**Solutions:**

**If using native Airtable integration:**
1. Verify Airtable credentials in Framer
2. Check base ID is correct
3. Ensure tables have data
4. Click "Refresh" in Framer CMS settings

**If Airtable integration isn't available:**
1. Export Airtable to CSV
2. Import CSV into Framer CMS
3. Set up periodic exports/imports

**Or create sync script:**
```javascript
// sync-airtable-to-framer.js
const bills = await getFromAirtable();
await pushToFramerCMS(bills);
```

### Field Mapping Issues

**Problem:** Data appears but fields are wrong.

**Solution:** 
1. Check field name mapping in Framer
2. Ensure data types match (text, number, date, etc.)
3. Verify linked records are properly connected

**Mapping Example:**
```
Airtable Field → Framer CMS Field
"Bill ID"      → billId
"Title"        → title
"Sponsors"     → sponsors (linked records)
```

---

## 🔴 Data Quality Issues

### Missing or Incomplete Data

**Problem:** Some bills have empty fields.

**Explanation:** This is normal! Not all bills have all data in the API.

**Handle gracefully:**
```javascript
recordData: {
  'Title': bill.title || 'Untitled Bill',
  'Summary': bill.abstracts?.[0]?.abstract || 'No summary available',
  'Latest Action': bill.latest_action?.description || 'No actions recorded',
}
```

### Incorrect Status Detection

**Problem:** Bill status shows wrong value.

**Solution:** Update the `determineStatus` function:
```javascript
function determineStatus(bill) {
  const action = bill.latest_action?.description?.toLowerCase() || '';
  
  // Add more keywords
  if (action.includes('governor approved')) return 'Enacted';
  if (action.includes('to governor')) return 'Awaiting Signature';
  // ... add more cases
  
  return 'Introduced';
}
```

---

## 🔴 Performance Issues

### Slow Sync Times

**Problem:** Syncing takes too long.

**Optimizations:**

1. **Parallel processing:**
```javascript
// Sync multiple states at once
await Promise.all([
  syncBills('ca', 50),
  syncBills('tx', 50),
  syncBills('ny', 50),
]);
```

2. **Batch Airtable updates:**
```javascript
// Instead of creating one at a time
const recordsToCreate = bills.map(bill => ({ fields: {...} }));
await base('Bills').create(recordsToCreate);
```

3. **Cache API responses:**
```javascript
import { kv } from '@vercel/kv';

const cached = await kv.get(`bills:${state}`);
if (cached && Date.now() - cached.timestamp < 3600000) {
  return cached.data; // Use 1-hour cache
}
```

4. **Selective syncing:**
Only sync bills that changed:
```javascript
if (bill.updated_at > lastSyncTime) {
  await syncBill(bill);
}
```

---

## 🆘 Getting Help

### Enable Debug Logging

Add this to your functions:
```javascript
console.log('DEBUG:', {
  state,
  billCount: bills.length,
  firstBill: bills[0]?.identifier,
  sponsorCount: sponsorIds.length,
});
```

### Check Logs

```bash
# Vercel logs
vercel logs --follow

# Or filter by function
vercel logs --follow --filter=/api/sync-bills
```

### Common Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| `UNKNOWN_FIELD_NAME` | Field doesn't exist | Check Airtable schema |
| `INVALID_REQUEST_BODY` | Wrong data format | Verify JSON structure |
| `NOT_FOUND` | Record doesn't exist | Check IDs are correct |
| `INVALID_PERMISSIONS` | No access | Update API key permissions |

### Test Individual Components

**Test API Connection:**
```bash
node -e "
  fetch('https://v3.openstates.org/jurisdictions', {
    headers: {'X-API-KEY': 'YOUR_KEY'}
  }).then(r => r.json()).then(console.log)
"
```

**Test Airtable:**
```javascript
const Airtable = require('airtable');
const base = new Airtable({apiKey: 'YOUR_KEY'}).base('YOUR_BASE_ID');
base('Bills').select({maxRecords: 1}).firstPage().then(console.log);
```

---

## 📞 Still Stuck?

1. **Review logs carefully** - Most errors have clear messages
2. **Check the SETUP_GUIDE.md** - Step-by-step instructions
3. **Search GitHub Issues** - Someone may have had the same problem
4. **Ask the community:**
   - Vercel Discord
   - Airtable Community
   - Plural Policy GitHub Issues

---

## ✅ Verification Checklist

Before asking for help, verify:

- [ ] All environment variables are set
- [ ] API keys are valid and have correct permissions
- [ ] Airtable tables exist with correct names
- [ ] Field names match exactly (case-sensitive)
- [ ] Function is deployed to production
- [ ] Logs show detailed error messages
- [ ] Test script (`test-sync.js`) passes

---

## 🔧 Quick Fixes

| Issue | Quick Fix |
|-------|-----------|
| Missing tables | Run `AIRTABLE_SCHEMA.md` setup again |
| Wrong permissions | Regenerate API keys with full access |
| Timeout | Reduce `limit` parameter to 25 |
| Duplicates | Verify "OpenStates ID" field exists |
| No data | Check if API returns results: `curl https://v3.openstates.org/bills?jurisdiction=ca&per_page=1 -H "X-API-KEY: YOUR_KEY"` |

---

Remember: Most issues are configuration problems, not code bugs. Double-check your setup before debugging code!
