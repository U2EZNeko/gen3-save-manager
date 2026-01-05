const fs = require('fs');
const path = require('path');

// Use global fetch if available (Node.js 18+), otherwise use node-fetch
let fetch;
if (typeof globalThis.fetch === 'function') {
  fetch = globalThis.fetch;
} else {
  try {
    fetch = require('node-fetch');
  } catch (e) {
    console.error('fetch not available. Please use Node.js 18+ or install node-fetch');
    process.exit(1);
  }
}

const DATA_DIR = path.join(__dirname, '..', 'data');
const ENCOUNTER_RATES_DIR = path.join(DATA_DIR, 'encounter-rates');

// Create directory
if (!fs.existsSync(ENCOUNTER_RATES_DIR)) {
  fs.mkdirSync(ENCOUNTER_RATES_DIR, { recursive: true });
}

// Google Sheets export URL
// Sheet ID: 1d4uhbr4L0JrwK8Sa64aEWZVBKsVtU7BpwU0Yfw_23kk
// The sheet has multiple tabs - we'll try different GIDs
const SHEET_ID = '1d4uhbr4L0JrwK8Sa64aEWZVBKsVtU7BpwU0Yfw_23kk';
// Try common GIDs - 0 is usually first sheet, or we can try without GID
const GID_OPTIONS = [
  '0', // First sheet
  '', // No GID (first sheet)
  '1591130084', // The GID from the URL (overview)
];

// Species name to ID mapping (Gen 1-3)
const SPECIES_NAMES = {};
for (let i = 1; i <= 386; i++) {
  // We'll need to map names to IDs - this will be done during parsing
}

// Parse CSV line
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Parse CSV content
function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = parseCSVLine(lines[0]);
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || values.every(v => !v.trim())) continue;
    
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    data.push(row);
  }
  
  return { headers, data };
}

// Download a specific sheet by GID
async function downloadSheet(gid, name) {
  const gidParam = gid ? `&gid=${gid}` : '';
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv${gidParam}`;
  console.log(`\nFetching ${name} from: ${url}`);
  
  const response = await fetch(url);
  if (!response.ok) {
    console.warn(`Failed to fetch ${name}: ${response.status} ${response.statusText}`);
    return null;
  }
  
  const csvText = await response.text();
  console.log(`Downloaded ${csvText.length} characters`);
  
  // Save raw CSV
  const rawCsvPath = path.join(ENCOUNTER_RATES_DIR, `${name}-raw.csv`);
  fs.writeFileSync(rawCsvPath, csvText, 'utf8');
  
  // Parse CSV
  const { headers, data } = parseCSV(csvText);
  console.log(`Parsed ${data.length} rows with ${headers.length} columns`);
  
  if (data.length > 0 && headers.length > 0) {
    console.log('First few headers:', headers.filter(h => h).slice(0, 5).join(', '));
    console.log('Sample row:', Object.values(data[0]).filter(v => v).slice(0, 5).join(', '));
  }
  
  return { headers, data, csvText };
}

// Download and parse Google Sheets data
async function downloadEncounterData() {
  console.log('Downloading Gen 3 encounter data from Google Sheets...');
  
  try {
    // Try downloading different sheets
    const sheets = [];
    
    // Try GID 0 (first sheet)
    const sheet0 = await downloadSheet('0', 'sheet-0');
    if (sheet0) sheets.push({ name: 'sheet-0', ...sheet0 });
    
    // Try without GID
    const sheetNoGid = await downloadSheet('', 'sheet-no-gid');
    if (sheetNoGid) sheets.push({ name: 'sheet-no-gid', ...sheetNoGid });
    
    // Try the GID from URL
    const sheetOverview = await downloadSheet('1591130084', 'overview');
    if (sheetOverview) sheets.push({ name: 'overview', ...sheetOverview });
    
    // Find the sheet with actual Pokemon data (should have many rows and Pokemon names)
    let locationSheet = null;
    for (const sheet of sheets) {
      // Look for sheets with Pokemon data (many rows, likely has "Bulbasaur" or species names)
      if (sheet.data.length > 100) {
        // Check if it has Pokemon-like data
        const sampleRow = sheet.data[0];
        const rowValues = Object.values(sampleRow).map(v => String(v).toLowerCase());
        if (rowValues.some(v => v.includes('bulbasaur') || v.includes('pokemon') || v.match(/^\d+$/))) {
          locationSheet = sheet;
          console.log(`\nFound location sheet: ${sheet.name} with ${sheet.data.length} rows`);
          break;
        }
      }
    }
    
    if (!locationSheet && sheets.length > 0) {
      // Use the largest sheet
      locationSheet = sheets.reduce((max, s) => s.data.length > max.data.length ? s : max);
      console.log(`\nUsing largest sheet: ${locationSheet.name} with ${locationSheet.data.length} rows`);
    }
    
    if (locationSheet) {
      // Save the location sheet data
      const structuredPath = path.join(ENCOUNTER_RATES_DIR, 'location-data.json');
      fs.writeFileSync(structuredPath, JSON.stringify({
        metadata: {
          source: 'Google Sheets - Gen 3 Location Sheet',
          sheetId: SHEET_ID,
          downloadedAt: new Date().toISOString(),
          sheetName: locationSheet.name
        },
        headers: locationSheet.headers,
        data: locationSheet.data
      }, null, 2), 'utf8');
      console.log(`\nSaved location data to ${structuredPath}`);
    }
    
    console.log('\nEncounter data download complete!');
    console.log(`Downloaded ${sheets.length} sheet(s). Check the data files to identify the correct structure.`);
    
  } catch (error) {
    console.error('Error downloading encounter data:', error);
    throw error;
  }
}

// Run the download
if (require.main === module) {
  downloadEncounterData().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { downloadEncounterData };

