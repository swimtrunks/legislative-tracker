// api/sync-bills.js
// Vercel Serverless Function to sync bills from Plural Policy API to Airtable

import Airtable from 'airtable';

// Initialize Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

// Plural Policy API configuration
const PLURAL_API_KEY = process.env.PLURAL_API_KEY;
const PLURAL_API_BASE = 'https://v3.openstates.org';

// Helper function to fetch from Plural Policy API
async function fetchFromPluralAPI(endpoint, params = {}) {
  const url = new URL(`${PLURAL_API_BASE}${endpoint}`);
  
  // Handle 'include' parameter specially - needs to be added multiple times, not comma-separated
  Object.keys(params).forEach(key => {
    const value = params[key];
    
    if (Array.isArray(value)) {
      // Add each array item as a separate parameter (for id, include, etc.)
      value.forEach(item => url.searchParams.append(key, item));
    } else if (key === 'include' && typeof value === 'string') {
      // If include is a comma-separated string, split it
      value.split(',').forEach(item => url.searchParams.append(key, item.trim()));
    } else {
      // Regular parameter
      url.searchParams.append(key, value);
    }
  });
  
  console.log(`Calling Plural API: ${url.toString()}`);
  
  const response = await fetch(url.toString(), {
    headers: {
      'X-API-KEY': PLURAL_API_KEY,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Plural API Error Response: ${errorText}`);
    throw new Error(`Plural API error: ${response.status} ${response.statusText} - ${errorText}`);
  }
  
  return response.json();
}

// Helper function to find or create a record in Airtable
async function findOrCreateRecord(tableName, searchField, searchValue, recordData) {
  try {
    // Search for existing record
    const records = await base(tableName)
      .select({
        filterByFormula: `{${searchField}} = '${searchValue}'`,
        maxRecords: 1,
      })
      .firstPage();
    
    if (records.length > 0) {
      // Update existing record
      await base(tableName).update(records[0].id, recordData);
      return records[0].id;
    } else {
      // Create new record
      const newRecord = await base(tableName).create(recordData);
      return newRecord.id;
    }
  } catch (error) {
    console.error(`Error in findOrCreateRecord for ${tableName}:`, error);
    throw error;
  }
}

// Sync legislators/sponsors with enhanced data from People API
async function syncLegislators(people) {
  const legislatorIds = [];
  
  if (people.length === 0) {
    return legislatorIds;
  }
  
  try {
    // Extract all unique person IDs
    const personIds = [...new Set(people.map(p => p.id).filter(Boolean))];
    
    if (personIds.length === 0) {
      console.log('No valid person IDs to fetch');
      return legislatorIds;
    }
    
    console.log(`Fetching full details for ${personIds.length} unique legislators...`);
    
    // Chunk the IDs to avoid URL length limits and reduce timeout risk
    // API might have pagination limits, so fetch in chunks of 10
    const chunkSize = 10;
    const peopleMap = new Map();
    
    for (let i = 0; i < personIds.length; i += chunkSize) {
      const chunk = personIds.slice(i, i + chunkSize);
      console.log(`Fetching chunk ${Math.floor(i/chunkSize) + 1}/${Math.ceil(personIds.length/chunkSize)} (${chunk.length} legislators)...`);
      
      try {
        const peopleResponse = await fetchFromPluralAPI('/people', {
          id: chunk
        });
        
        // Add to map
        if (peopleResponse.results) {
          peopleResponse.results.forEach(person => {
            peopleMap.set(person.id, person);
          });
        }
      } catch (chunkError) {
        console.error(`Error fetching chunk starting at index ${i}:`, chunkError.message);
        // Continue with other chunks
      }
    }
    
    console.log(`Received full details for ${peopleMap.size}/${personIds.length} legislators`);
    
    // Now process each person
    for (const person of people) {
      try {
        // Get full person data from map, or use basic data if not found
        const fullPersonData = peopleMap.get(person.id) || person;
        
        // Get district - could be number or text, convert to string
        let district = '';
        if (fullPersonData.current_role?.district) {
          district = String(fullPersonData.current_role.district);
        }
        
        // Extract office information (phone, address, etc.)
        const officeInfo = extractOfficeInfo(fullPersonData);
        
        // Build record data - only include fields if they have values
        const recordData = {
          'Full Name': fullPersonData.name || '',
          'OpenStates ID': fullPersonData.id || '',
        };
        
        // Add name components if available
        if (fullPersonData.given_name) {
          recordData['First Name'] = fullPersonData.given_name;
        }
        if (fullPersonData.family_name) {
          recordData['Last Name'] = fullPersonData.family_name;
        }
        
        // Add district
        if (district) {
          recordData['District'] = district;
        }
        
        // Add image if available
        if (fullPersonData.image) {
          recordData['Photo URL'] = fullPersonData.image;
        }
        
        // Add biography if available
        if (fullPersonData.biography) {
          recordData['Biography'] = fullPersonData.biography;
        }
        
        // Add email - can come from top level or contact_details
        if (fullPersonData.email) {
          recordData['Contact Email'] = fullPersonData.email;
        }
        
        // Add party from top level (not current_role)
        if (fullPersonData.party) {
          recordData['Party'] = fullPersonData.party;
        }
        
        // Add chamber from current_role.org_classification
        if (fullPersonData.current_role?.org_classification) {
          recordData['Chamber'] = fullPersonData.current_role.org_classification;
        }
        
        // Add state from jurisdiction
        if (fullPersonData.jurisdiction?.name) {
          recordData['State'] = fullPersonData.jurisdiction.name;
        }
        
        // Add title from current_role
        if (fullPersonData.current_role?.title) {
          recordData['Title'] = fullPersonData.current_role.title;
        }
        
        // Add office information
        if (officeInfo.phone) {
          recordData['Phone'] = officeInfo.phone;
        }
        if (officeInfo.address) {
          recordData['Office Address'] = officeInfo.address;
        }
        
        // Add all links
        if (officeInfo.links && officeInfo.links.length > 0) {
          recordData['Links'] = officeInfo.links.join('\n');
        }
        
        const recordId = await findOrCreateRecord(
          'Legislators',
          'OpenStates ID',
          fullPersonData.id,
          recordData
        );
        
        legislatorIds.push(recordId);
      } catch (error) {
        console.error(`Error syncing legislator ${person.name}:`, error);
      }
    }
  } catch (error) {
    console.error('Error batch fetching legislators:', error);
    // Fall back to basic data for all
    for (const person of people) {
      try {
        const recordData = {
          'Full Name': person.name || '',
          'OpenStates ID': person.id || '',
        };
        
        if (person.given_name) recordData['First Name'] = person.given_name;
        if (person.family_name) recordData['Last Name'] = person.family_name;
        
        const recordId = await findOrCreateRecord(
          'Legislators',
          'OpenStates ID',
          person.id,
          recordData
        );
        
        legislatorIds.push(recordId);
      } catch (innerError) {
        console.error(`Error syncing legislator ${person.name}:`, innerError);
      }
    }
  }
  
  return legislatorIds;
}

// Helper function to extract office information
function extractOfficeInfo(person) {
  const info = {
    phone: null,
    address: null,
    links: [],
  };
  
  // Extract phone and address from offices array
  if (person.offices && Array.isArray(person.offices) && person.offices.length > 0) {
    // Get first office (usually capitol/main office)
    const office = person.offices[0];
    
    if (office.voice) {
      info.phone = office.voice;
    }
    if (office.address) {
      info.address = office.address;
    }
  }
  
  // Extract all links from links array
  if (person.links && Array.isArray(person.links)) {
    info.links = person.links
      .map(link => link.url)
      .filter(url => url); // Remove any empty/null URLs
  }
  
  return info;
}

// Sync a single state
async function syncState(jurisdiction) {
  try {
    const recordData = {
      'State Name': jurisdiction.name || '',
    };
    
    // Extract state abbreviation from ID using regex
    // "ocd-jurisdiction/country:us/state:nc/government" -> "nc"
    let abbr = null;
    if (jurisdiction.id) {
      const match = jurisdiction.id.match(/\/state:([a-z]{2})\//i);
      if (match) {
        abbr = match[1].toUpperCase();
      }
    }
    
    if (abbr) {
      recordData['Abbreviation'] = abbr;
    }
    
    // Only add Legislature Type if it exists
    if (jurisdiction.legislature_name) {
      recordData['Legislature Type'] = jurisdiction.legislature_name;
    }
    
    // Only add Session Info if it exists
    if (jurisdiction.legislative_sessions?.[0]) {
      recordData['Session Info'] = JSON.stringify(jurisdiction.legislative_sessions[0]);
    }
    
    const recordId = await findOrCreateRecord(
      'States',
      'Abbreviation',
      abbr || jurisdiction.name,
      recordData
    );
    
    return recordId;
  } catch (error) {
    console.error(`Error syncing state ${jurisdiction.name}:`, error);
    return null;
  }
}

// Helper to format subject names nicely
function formatSubjectName(subject) {
  console.log(`[FORMAT] Input subject: "${subject}"`);
  
  // Handle different formats:
  // "PUBLIC_SAFETY" -> "Public Safety"
  // "Lawenforcement" -> "Law Enforcement"
  // "CaliforniaScienceandHealth" -> "California Science And Health"
  
  let formatted = subject;
  
  // First, handle underscore-separated (PUBLIC_SAFETY)
  if (formatted.includes('_')) {
    formatted = formatted
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    console.log(`[FORMAT] After underscore split: "${formatted}"`);
  }
  // Handle camelCase or PascalCase (add space before capital letters)
  else {
    // Add space before capital letters (except first character)
    formatted = formatted
      .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase: lawEnforcement -> law Enforcement
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2'); // PascalCase: LAWEnforcement -> LAW Enforcement
    
    console.log(`[FORMAT] After regex: "${formatted}"`);
    
    // Capitalize first letter, keep rest as is for now
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }
  
  // Handle special cases where words are joined without proper casing
  // "Lawenforcement" -> "Law Enforcement"
  const commonWords = {
    'lawenforcement': 'Law Enforcement',
    'publicsafety': 'Public Safety',
    'racialandidentityprofiling': 'Racial And Identity Profiling',
    'foodvendorsandfacilities': 'Food Vendors And Facilities',
    'enforcementactivities': 'Enforcement Activities',
    'preapprenticeshipprathway': 'Pre-Apprenticeship Pathway',
    'peaceofficers': 'Peace Officers',
    'confidentialityofrecords': 'Confidentiality Of Records',
    'sexualassaultforensicevid': 'Sexual Assault Forensic Evidence',
    'californiascienceandhealth': 'California Science And Health',
    'economicdevelopment': 'Economic Development',
    'industrystrategies': 'Industry Strategies',
    'equitablecleanenergysup': 'Equitable Clean Energy Supply'
  };
  
  const lowerFormatted = formatted.toLowerCase();
  if (commonWords[lowerFormatted]) {
    console.log(`[FORMAT] Found in dictionary: "${commonWords[lowerFormatted]}"`);
    return commonWords[lowerFormatted];
  }
  
  console.log(`[FORMAT] Final output: "${formatted}"`);
  return formatted;
}

// Sync subjects/topics
async function syncSubjects(subjects) {
  const subjectIds = [];
  
  for (const subject of subjects) {
    try {
      const formattedName = formatSubjectName(subject);
      
      const recordData = {
        'Subject Name': formattedName, // Now "Public Safety" instead of "PUBLIC_SAFETY"
        'Category': categorizeSubject(subject),
      };
      
      const recordId = await findOrCreateRecord(
        'Subjects',
        'Subject Name',
        formattedName, // Use formatted name for searching too
        recordData
      );
      
      subjectIds.push(recordId);
    } catch (error) {
      console.error(`Error syncing subject ${subject}:`, error);
    }
  }
  
  return subjectIds;
}

// Helper to categorize subjects
function categorizeSubject(subject) {
  const categories = {
    'Health': ['health', 'healthcare', 'medical', 'hospital', 'medicare', 'medicaid'],
    'Education': ['education', 'school', 'university', 'teacher', 'student'],
    'Environment': ['environment', 'climate', 'energy', 'pollution', 'conservation'],
    'Economy': ['tax', 'budget', 'finance', 'economy', 'business', 'commerce'],
    'Justice': ['crime', 'criminal', 'justice', 'court', 'police', 'prison'],
    'Transportation': ['transportation', 'highway', 'road', 'transit', 'vehicle'],
  };
  
  const subjectLower = subject.toLowerCase();
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => subjectLower.includes(keyword))) {
      return category;
    }
  }
  
  return 'Other';
}

// Sync bills
async function syncBills(state, limit = 50) {
  try {
    console.log(`Fetching bills for ${state}...`);
    
    // Format jurisdiction properly (needs to be lowercase state code)
    const jurisdiction = state.toLowerCase();
    
    // Fetch bills from Plural Policy API
    // Note: 'include' will be split into separate parameters by fetchFromPluralAPI
    const billsResponse = await fetchFromPluralAPI('/bills', {
      jurisdiction: jurisdiction,
      per_page: limit,
      include: 'sponsorships,abstracts', // Will be split into separate params
    });
    
    const bills = billsResponse.results || [];
    console.log(`Found ${bills.length} bills to sync`);
    
    let syncedCount = 0;
    
    for (const bill of bills) {
      try {
        // Sync related data first
        let sponsorIds = [];
        if (bill.sponsorships && bill.sponsorships.length > 0) {
          const sponsors = bill.sponsorships
            .map(s => s.person)
            .filter(Boolean);
          sponsorIds = await syncLegislators(sponsors);
        }
        
        let subjectIds = [];
        if (bill.subject && bill.subject.length > 0) {
          subjectIds = await syncSubjects(bill.subject);
        }
        
        // Prepare bill data for Airtable
        // Important: Date fields must be null (not empty string) if no value
        const recordData = {
          'Bill ID': bill.identifier || '',
          'Title': bill.title || '',
          'Summary': bill.abstracts?.[0]?.abstract || '',
          'OpenStates ID': bill.id || '',
          'Source URL': bill.openstates_url || '',
          'Latest Action': bill.latest_action_description || '', // Note: latest_action_description not latest_action.description
        };
        
        // Add Slug - bill ID with spaces removed (e.g., "AB 284" -> "AB284")
        if (bill.identifier) {
          recordData['Slug'] = bill.identifier.replace(/\s+/g, '');
        }
        
        // Only add Classification if it has a value
        if (bill.classification?.[0]) {
          recordData['Classification'] = bill.classification[0];
        }
        
        // State is always uppercase
        recordData['State'] = state.toUpperCase();
        
        // Only add Current Status if not empty
        const status = determineStatus(bill);
        if (status) {
          recordData['Current Status'] = status;
        }
        
        // Only add date fields if they have actual values
        // Normalize dates to handle both "2020-01-15" and "2025-02-19T05:00:00+00:00" formats
        if (bill.latest_action_date) {
          recordData['Latest Action Date'] = normalizeDate(bill.latest_action_date);
        }
        if (bill.first_action_date) {
          recordData['Introduction Date'] = normalizeDate(bill.first_action_date);
        }
        
        // Add Chamber field - extract from from_organization object
        if (bill.from_organization?.classification) {
          recordData['Chamber'] = bill.from_organization.classification;
        }
        
        // Only add linked records if they exist and field exists in Airtable
        // Filter out any undefined/null values
        
        if (sponsorIds.length > 0) {
          const validSponsorIds = sponsorIds.filter(id => id != null);
          console.log(`Sponsors for ${bill.identifier}: ${validSponsorIds.length} valid IDs out of ${sponsorIds.length}`);
          console.log(`Sponsor IDs type check:`, validSponsorIds.map(id => typeof id));
          console.log(`Sponsor IDs values:`, validSponsorIds);
          if (validSponsorIds.length > 0) {
            recordData['Sponsors'] = validSponsorIds.slice(0, 10);
          }
        }
        if (subjectIds.length > 0) {
          const validSubjectIds = subjectIds.filter(id => id != null);
          console.log(`Subjects for ${bill.identifier}: ${validSubjectIds.length} valid IDs out of ${subjectIds.length}`);
          console.log(`Subject IDs type check:`, validSubjectIds.map(id => typeof id));
          console.log(`Subject IDs values:`, validSubjectIds);
          if (validSubjectIds.length > 0) {
            recordData['Subject Areas'] = validSubjectIds.slice(0, 10);
          }
        }
        
        console.log(`Attempting to create/update bill ${bill.identifier} WITHOUT linked records (temporarily disabled)`);
        console.log(`Record data for ${bill.identifier}:`, JSON.stringify(recordData, null, 2).substring(0, 500));
        
        await findOrCreateRecord(
          'Bills',
          'OpenStates ID',
          bill.id,
          recordData
        );
        
        syncedCount++;
        console.log(`Synced: ${bill.identifier} - ${bill.title}`);
      } catch (error) {
        console.error(`Error syncing bill ${bill.identifier}:`, error);
      }
    }
    
    return { success: true, synced: syncedCount, total: bills.length };
  } catch (error) {
    console.error('Error in syncBills:', error);
    throw error;
  }
}

// Helper to normalize dates to YYYY-MM-DD format
function normalizeDate(dateString) {
  if (!dateString) return null;
  
  // Handle ISO 8601 format: "2025-02-19T05:00:00+00:00"
  // Also handles simple format: "2020-01-15"
  
  try {
    // Extract just the date part (YYYY-MM-DD) from any format
    const match = dateString.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) {
      return match[1]; // Returns "2025-02-19"
    }
    
    // If no match, try parsing as Date and formatting
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      // Format as YYYY-MM-DD
      return date.toISOString().split('T')[0];
    }
    
    // If all else fails, return original
    return dateString;
  } catch (error) {
    console.error(`Error normalizing date: ${dateString}`, error);
    return dateString;
  }
}

// Helper to determine bill status
function determineStatus(bill) {
  // Use latest_action_description not latest_action.description
  if (!bill.latest_action_description) return 'Introduced';
  
  const action = bill.latest_action_description.toLowerCase();
  
  if (action.includes('signed') || action.includes('enacted')) return 'Enacted';
  if (action.includes('vetoed')) return 'Vetoed';
  if (action.includes('failed') || action.includes('died')) return 'Failed';
  if (action.includes('passed') && action.includes('senate')) return 'Passed Senate';
  if (action.includes('passed') && action.includes('house')) return 'Passed House';
  if (action.includes('committee')) return 'In Committee';
  
  return 'Introduced';
}

// Main handler for Vercel
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Verify webhook secret for security
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const { state, states, limit } = req.body;
    
    // Support both single state and multiple states
    let statesToSync = [];
    if (states && Array.isArray(states)) {
      statesToSync = states;
    } else if (state) {
      statesToSync = [state];
    } else {
      return res.status(400).json({ error: 'State or states parameter is required' });
    }
    
    const results = [];
    let totalSynced = 0;
    let totalBills = 0;
    
    for (const currentState of statesToSync) {
      try {
        console.log(`\n=== Syncing state: ${currentState} ===`);
        
        // Sync the state jurisdiction first
        const jurisdictionData = await fetchFromPluralAPI(`/jurisdictions/${currentState}`);
        await syncState(jurisdictionData);
        
        // Sync bills for the state
        const result = await syncBills(currentState, limit || 50);
        
        results.push({
          state: currentState,
          success: true,
          synced: result.synced,
          total: result.total,
        });
        
        totalSynced += result.synced;
        totalBills += result.total;
        
        console.log(`✓ Completed ${currentState}: ${result.synced}/${result.total} bills`);
      } catch (stateError) {
        console.error(`Error syncing state ${currentState}:`, stateError);
        results.push({
          state: currentState,
          success: false,
          error: stateError.message,
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      message: `Synced ${totalSynced} of ${totalBills} bills across ${statesToSync.length} state(s)`,
      totalStates: statesToSync.length,
      totalSynced,
      totalBills,
      results,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
