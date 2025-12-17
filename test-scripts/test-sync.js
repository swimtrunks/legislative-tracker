// test-sync.js
// Simple test script to verify your sync functions work locally

require('dotenv').config();

async function testSync() {
  console.log('🧪 Testing Legislative Tracker Sync...\n');

  // Test 1: Check environment variables
  console.log('✓ Checking environment variables...');
  const requiredEnvVars = [
    'PLURAL_API_KEY',
    'AIRTABLE_API_KEY',
    'AIRTABLE_BASE_ID',
    'WEBHOOK_SECRET',
  ];

  const missing = requiredEnvVars.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('❌ Missing environment variables:', missing.join(', '));
    process.exit(1);
  }
  console.log('✅ All environment variables set\n');

  // Test 2: Check Plural Policy API connection
  console.log('✓ Testing Plural Policy API connection...');
  try {
    const response = await fetch('https://v3.openstates.org/jurisdictions', {
      headers: {
        'X-API-KEY': process.env.PLURAL_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Connected! Found ${data.results.length} jurisdictions\n`);
  } catch (error) {
    console.error('❌ Plural Policy API connection failed:', error.message);
    process.exit(1);
  }

  // Test 3: Check Airtable connection
  console.log('✓ Testing Airtable connection...');
  try {
    const Airtable = require('airtable');
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
      .base(process.env.AIRTABLE_BASE_ID);

    // Try to list tables by attempting to access Bills table
    const records = await base('Bills')
      .select({ maxRecords: 1 })
      .firstPage();

    console.log(`✅ Connected! Bills table has ${records.length} records\n`);
  } catch (error) {
    console.error('❌ Airtable connection failed:', error.message);
    console.log('\n💡 Make sure you have created the Bills table in Airtable');
    console.log('   See AIRTABLE_SCHEMA.md for table structure\n');
    process.exit(1);
  }

  // Test 4: Fetch sample bill data
  console.log('✓ Fetching sample bill from California...');
  try {
    const response = await fetch(
      'https://v3.openstates.org/bills?jurisdiction=ca&per_page=1&include=sponsorships',
      {
        headers: {
          'X-API-KEY': process.env.PLURAL_API_KEY,
        },
      }
    );

    const data = await response.json();
    const bill = data.results[0];

    console.log(`✅ Fetched bill: ${bill.identifier} - ${bill.title}`);
    console.log(`   Status: ${bill.latest_action?.description || 'N/A'}`);
    console.log(`   Sponsors: ${bill.sponsorships?.length || 0}\n`);
  } catch (error) {
    console.error('❌ Failed to fetch bill data:', error.message);
    process.exit(1);
  }

  // Test 5: Test sync function (dry run)
  console.log('✓ Testing sync function (5 bills from CA)...');
  console.log('  This will actually sync data to Airtable...\n');

  try {
    // Import the sync function
    const syncBillsModule = await import('../api/sync-bills.js');
    
    // Create mock request/response objects
    const mockReq = {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.WEBHOOK_SECRET}`,
      },
      body: {
        state: 'ca',
        limit: 5,
      },
    };

    const mockRes = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        console.log(`📊 Sync Result (Status ${this.statusCode}):`);
        console.log(JSON.stringify(data, null, 2));
        return data;
      },
    };

    // Call the handler
    await syncBillsModule.default(mockReq, mockRes);

    console.log('\n✅ Sync test completed!');
    console.log('   Check your Airtable base to see the synced data.\n');
  } catch (error) {
    console.error('❌ Sync function failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  console.log('🎉 All tests passed!\n');
  console.log('Next steps:');
  console.log('1. Check your Airtable base for synced data');
  console.log('2. Deploy to Vercel: vercel --prod');
  console.log('3. Connect Framer to your Airtable base');
  console.log('\nFor help, see SETUP_GUIDE.md');
}

// Run tests
testSync().catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});
