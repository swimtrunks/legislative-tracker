// test-airtable-linking.js
// Manual test to verify Airtable linked record fields work

// Load .env if present so users can run this test by creating a .env from env.example
try {
  require('dotenv').config();
} catch (e) {
  // ignore if dotenv isn't installed; we'll still rely on process.env
}

const Airtable = require('airtable');

// Helpful guard: Airtable client throws a generic error when the API key is missing.
// Check early and print a clear instruction.
if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
  console.error('\nERROR: Missing Airtable environment variables.');
  console.error('Set AIRTABLE_API_KEY and AIRTABLE_BASE_ID before running this script.');
  console.error('\nOptions:');
  console.error('  1) Export them inline:');
  console.error("     AIRTABLE_API_KEY=your_key AIRTABLE_BASE_ID=your_base node test-airtable-linking.js");
  console.error('  2) Create a .env file from env.example and run `npm install dotenv` then run the script.');
  process.exit(1);
}

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

async function testLinking() {
  try {
    console.log('Testing Airtable linked record fields...\n');
    
    // Step 1: Get an existing legislator ID
    console.log('Step 1: Finding a legislator...');
    const legislators = await base('Legislators').select({ maxRecords: 1 }).firstPage();
    
    if (legislators.length === 0) {
      console.log('❌ No legislators found! Create at least one legislator first.');
      return;
    }
    
    const legislatorId = legislators[0].id;
    console.log(`✓ Found legislator: ${legislators[0].fields['Full Name']} (${legislatorId})`);
    
    // Step 2: Get an existing subject ID
    console.log('\nStep 2: Finding a subject...');
    const subjects = await base('Subjects').select({ maxRecords: 1 }).firstPage();
    
    if (subjects.length === 0) {
      console.log('❌ No subjects found! Create at least one subject first.');
      return;
    }
    
    const subjectId = subjects[0].id;
    console.log(`✓ Found subject: ${subjects[0].fields['Subject Name']} (${subjectId})`);
    
    // Step 3: Try to create a test bill with linked records
    console.log('\nStep 3: Creating test bill with linked records...');
    
    const testBillData = {
      'Bill ID': 'TEST-001',
      'Title': 'Test Bill for Linking',
      'State': 'CA',
      'OpenStates ID': 'test-bill-' + Date.now(),
      'Sponsors': [legislatorId],  // Array of IDs
      'Subject Areas': [subjectId], // Array of IDs
    };
    
    console.log('Attempting to create with data:', JSON.stringify(testBillData, null, 2));
    
    const newBill = await base('Bills').create(testBillData);
    console.log(`✓ Success! Created test bill: ${newBill.id}`);
    
    // Step 4: Verify the links were created
    console.log('\nStep 4: Verifying linked records...');
    const createdBill = await base('Bills').find(newBill.id);
    console.log('Sponsors:', createdBill.fields['Sponsors']);
    console.log('Subject Areas:', createdBill.fields['Subject Areas']);
    
    // Clean up
    console.log('\nCleaning up test bill...');
    await base('Bills').destroy(newBill.id);
    console.log('✓ Test bill deleted');
    
    console.log('\n✅ ALL TESTS PASSED! Linked records work correctly.');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    
    if (error.message.includes('Unknown field name')) {
      console.log('\n💡 FIX: The field name doesn\'t match. Check spelling and capitalization.');
    } else if (error.message.includes('not an array of record IDs')) {
      console.log('\n💡 FIX: The field type is wrong. Make sure it\'s "Link to another record" with "Allow multiple records" checked.');
    } else if (error.message.includes('INVALID_MULTIPLE_CHOICE_OPTIONS')) {
      console.log('\n💡 FIX: One of your other fields is a Single Select without the required options.');
    }
    
    console.log('\nFull error:', error);
  }
}

testLinking();
