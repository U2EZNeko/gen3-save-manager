const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const ENCOUNTER_RATES_DIR = path.join(DATA_DIR, 'encounter-rates');
const locationDataPath = path.join(ENCOUNTER_RATES_DIR, 'location-data.json');

// Parse encounter string (e.g., "Wild (Viridian Forest, Level 3 - 5) - 40%")
function parseEncounterString(encounterText, game) {
  if (!encounterText || !encounterText.trim()) return null;
  
  const encounters = [];
  // Split by newlines to handle multiple encounters
  const lines = encounterText.split('\n').map(l => l.trim()).filter(l => l);
  
  for (const line of lines) {
    const encounter = {
      game: game,
      method: '',
      location: '',
      level: null,
      rate: null,
      raw: line
    };
    
    // Parse different encounter types
    if (line.includes('Wild')) {
      encounter.method = 'Wild';
      // Extract location and level
      const wildMatch = line.match(/Wild\s*\(([^)]+)\)/);
      if (wildMatch) {
        const locationPart = wildMatch[1];
        // Extract level range
        const levelMatch = locationPart.match(/Level\s*(\d+)\s*-\s*(\d+)/);
        if (levelMatch) {
          encounter.level = { min: parseInt(levelMatch[1]), max: parseInt(levelMatch[2]) };
          encounter.location = locationPart.replace(/Level\s*\d+\s*-\s*\d+/, '').replace(/,\s*$/, '').trim();
        } else {
          const singleLevelMatch = locationPart.match(/Level\s*(\d+)/);
          if (singleLevelMatch) {
            const level = parseInt(singleLevelMatch[1]);
            encounter.level = { min: level, max: level };
            encounter.location = locationPart.replace(/Level\s*\d+/, '').replace(/,\s*$/, '').trim();
          } else {
            encounter.location = locationPart;
          }
        }
      }
      // Extract rate
      const rateMatch = line.match(/(\d+)%/);
      if (rateMatch) {
        encounter.rate = parseInt(rateMatch[1]);
      }
    } else if (line.includes('Special')) {
      encounter.method = 'Special';
      encounter.location = line.replace('Special', '').replace(/[()]/g, '').trim();
    } else if (line.includes('Evolve')) {
      encounter.method = 'Evolution';
      encounter.location = line;
    } else if (line.includes('Trade')) {
      encounter.method = 'Trade';
      encounter.location = line;
    } else if (line.includes('Breed')) {
      encounter.method = 'Breeding';
      encounter.location = line;
    } else {
      encounter.method = 'Other';
      encounter.location = line;
    }
    
    encounters.push(encounter);
  }
  
  return encounters.length > 0 ? encounters : null;
}

// Parse the location data into structured format
function parseEncounterData() {
  console.log('Parsing encounter data...');
  
  if (!fs.existsSync(locationDataPath)) {
    console.error(`Location data file not found: ${locationDataPath}`);
    console.error('Please run download-encounter-data.js first');
    process.exit(1);
  }
  
  const rawData = JSON.parse(fs.readFileSync(locationDataPath, 'utf8'));
  const { headers, data } = rawData;
  
  console.log(`Parsing ${data.length} Pokemon entries...`);
  
  const encounterData = {
    metadata: {
      ...rawData.metadata,
      parsedAt: new Date().toISOString()
    },
    pokemon: {}
  };
  
  // Game column mapping
  const gameColumns = {
    'ruby': 'RUBY (R)',
    'sapphire': 'SAPPHIRE (S)',
    'emerald': 'EMERALD (E)',
    'firered': 'FIRERED (FR)',
    'leafgreen': 'LEAFGREEN (LG)'
  };
  
  for (const row of data) {
    const natDex = parseInt(row.NAT);
    if (isNaN(natDex) || natDex < 1 || natDex > 386) continue; // Only Gen 1-3
    
    const pokemonName = row.NAME;
    if (!pokemonName) continue;
    
    const pokemonData = {
      natDex: natDex,
      frlgDex: row.FRLG ? parseInt(row.FRLG) : null,
      rseDex: row.RSE ? parseInt(row.RSE) : null,
      name: pokemonName,
      encounters: {}
    };
    
    // Parse encounters for each game
    for (const [gameKey, columnName] of Object.entries(gameColumns)) {
      const encounterText = row[columnName];
      if (encounterText && encounterText.trim()) {
        const encounters = parseEncounterString(encounterText, gameKey);
        if (encounters) {
          pokemonData.encounters[gameKey] = encounters;
        }
      }
    }
    
    encounterData.pokemon[natDex] = pokemonData;
  }
  
  // Save parsed data
  const parsedPath = path.join(ENCOUNTER_RATES_DIR, 'encounters-parsed.json');
  fs.writeFileSync(parsedPath, JSON.stringify(encounterData, null, 2), 'utf8');
  console.log(`\nSaved parsed encounter data to ${parsedPath}`);
  console.log(`Parsed ${Object.keys(encounterData.pokemon).length} Pokemon with encounter data`);
  
  // Create index by name for quick lookup
  const nameIndex = {};
  for (const [dex, data] of Object.entries(encounterData.pokemon)) {
    const nameLower = data.name.toLowerCase();
    if (!nameIndex[nameLower]) {
      nameIndex[nameLower] = [];
    }
    nameIndex[nameLower].push(parseInt(dex));
  }
  
  const indexPath = path.join(ENCOUNTER_RATES_DIR, 'name-index.json');
  fs.writeFileSync(indexPath, JSON.stringify(nameIndex, null, 2), 'utf8');
  console.log(`Saved name index to ${indexPath}`);
  
  return encounterData;
}

// Run the parser
if (require.main === module) {
  parseEncounterData();
}

module.exports = { parseEncounterData, parseEncounterString };

