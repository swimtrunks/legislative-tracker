# Airtable Base Schema for Legislative Tracker

This document describes the Airtable base structure needed for the legislative tracker.

## Tables to Create in Airtable

### 1. Bills (Main Table)
- **Bill ID** (Single line text) - Primary field
- **OpenStates ID** (Single line text)
- **Title** (Long text)
- **Summary** (Long text)
- **Full Text** (Long text)
- **Classification** (Single select: Bill, Resolution, Constitutional Amendment, Joint Resolution)
- **State** (Single line text)
- **Current Status** (Single select: Introduced, In Committee, Passed House, Passed Senate, Enacted, Vetoed, Failed)
- **Latest Action** (Long text)
- **Latest Action Date** (Date)
- **Introduction Date** (Date)
- **Chamber of Origin** (Single select: House, Senate, Joint)
- **Source URL** (URL)
- **Sponsors** (Link to Legislators table - Allow linking to multiple records)
- **Subject Areas** (Link to Subjects table - Allow linking to multiple records)
- **Slug** (Formula: LOWER(SUBSTITUTE({Bill ID}, " ", "-")))

### 2. States
- **State Name** (Single line text) - Primary field
- **Abbreviation** (Single line text)
- **Legislature Type** (Single line text)
- **Session Info** (Long text)
- **Slug** (Formula: LOWER({Abbreviation}))
- **Bills** (Link to Bills table)

### 3. Legislators
- **Full Name** (Single line text) - Primary field
- **First Name** (Single line text)
- **Last Name** (Single line text)
- **OpenStates ID** (Single line text)
- **Party** (Single select: Democratic, Republican, Independent, Other)
- **Chamber** (Single select: House, Senate)
- **District** (Single line text)
- **State** (Single line text)
- **Photo URL** (URL)
- **Biography** (Long text)
- **Contact Email** (Email)
- **Slug** (Formula: LOWER(SUBSTITUTE({Full Name}, " ", "-")))
- **Sponsored Bills** (Link to Bills table)

### 4. Subjects
- **Subject Name** (Single line text) - Primary field
- **Category** (Single select: Health, Economy, Education, Environment, Justice, Transportation, Other)
- **Description** (Long text)
- **Slug** (Formula: LOWER(SUBSTITUTE({Subject Name}, " ", "-")))
- **Bills** (Link to Bills table)

### 5. Committees (Optional)
- **Committee Name** (Single line text) - Primary field
- **Committee Type** (Single select: Standing, Special, Joint, Conference)
- **Chamber** (Single select: House, Senate, Joint)
- **State** (Single line text)
- **Description** (Long text)
- **Chair** (Link to Legislators table)
- **Members** (Link to Legislators table - Allow linking to multiple records)

### 6. Sessions (Optional)
- **Session Name** (Single line text) - Primary field
- **State** (Link to States table)
- **Start Date** (Date)
- **End Date** (Date)
- **Year** (Number)
- **Type** (Single select: Regular, Special)
- **Is Active** (Checkbox)

## Views to Create

### Bills Table Views
1. **All Bills** - Grid view with all fields
2. **Active Bills** - Filter: Status is not "Enacted" or "Failed"
3. **Recent Bills** - Sort by "Latest Action Date" descending
4. **By State** - Group by "State"
5. **By Status** - Group by "Current Status"

### Legislators Table Views
1. **All Legislators** - Grid view
2. **By State** - Group by "State"
3. **By Party** - Group by "Party"

## Airtable API Setup

1. **Get your API Key:**
   - Go to https://airtable.com/account
   - Generate a Personal Access Token with scopes:
     - `data.records:read`
     - `data.records:write`
     - `schema.bases:read`

2. **Get your Base ID:**
   - Go to https://airtable.com/api
   - Select your base
   - The Base ID is in the URL: `https://airtable.com/[BASE_ID]/api/docs`

3. **Test the API:**
   ```bash
   curl "https://api.airtable.com/v0/[BASE_ID]/Bills?maxRecords=1" \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

## Connecting Framer to Airtable

### Method 1: Native Airtable Integration
1. In Framer, go to your CMS settings
2. Click "Add CMS"
3. Select "Airtable"
4. Enter your Airtable credentials
5. Map your Airtable tables to Framer CMS collections

### Method 2: Using Framer's API
If Framer doesn't have native Airtable support, you can:
1. Create a simple API endpoint that reads from Airtable
2. Use Framer's "External API" CMS source
3. Point it to your API endpoint

## Rate Limits & Considerations

- **Airtable Rate Limits:** 5 requests per second per base
- **Plural Policy API:** Check their documentation for current limits
- **Vercel Free Tier:** 
  - 100GB bandwidth
  - 100 hours of serverless function execution
  - Cron jobs available on all plans

## Maintenance

- Monitor your Vercel function logs for errors
- Check Airtable record counts to ensure data is syncing
- Update the CRON_SECRET if you suspect it's been compromised
- Regularly review and clean up old data if needed
