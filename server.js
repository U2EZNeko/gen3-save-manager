const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const PK3Parser = require('./parsers/pk3-parser');
const PK4Parser = require('./parsers/pk4-parser');
const PK6Parser = require('./parsers/pk6-parser');
const PK7Parser = require('./parsers/pk7-parser');
const SAV3Parser = require('./parsers/sav3-parser');
const multer = require('multer');
const archiver = require('archiver');

// Gen 3 box constants
const COUNT_BOX = 14;
const COUNT_SLOTSPERBOX = 30;

// Species name lookup (Gen 1-3)
// Simple mapping for common Pokemon names
const SPECIES_NAMES = {
  1: 'Bulbasaur', 2: 'Ivysaur', 3: 'Venusaur', 4: 'Charmander', 5: 'Charmeleon', 6: 'Charizard',
  7: 'Squirtle', 8: 'Wartortle', 9: 'Blastoise', 10: 'Caterpie', 11: 'Metapod', 12: 'Butterfree',
  13: 'Weedle', 14: 'Kakuna', 15: 'Beedrill', 16: 'Pidgey', 17: 'Pidgeotto', 18: 'Pidgeot',
  19: 'Rattata', 20: 'Raticate', 21: 'Spearow', 22: 'Fearow', 23: 'Ekans', 24: 'Arbok',
  25: 'Pikachu', 26: 'Raichu', 27: 'Sandshrew', 28: 'Sandslash', 29: 'Nidoran♀', 30: 'Nidorina',
  31: 'Nidoqueen', 32: 'Nidoran♂', 33: 'Nidorino', 34: 'Nidoking', 35: 'Clefairy', 36: 'Clefable',
  37: 'Vulpix', 38: 'Ninetales', 39: 'Jigglypuff', 40: 'Wigglytuff', 41: 'Zubat', 42: 'Golbat',
  43: 'Oddish', 44: 'Gloom', 45: 'Vileplume', 46: 'Paras', 47: 'Parasect', 48: 'Venonat',
  49: 'Venomoth', 50: 'Diglett', 51: 'Dugtrio', 52: 'Meowth', 53: 'Persian', 54: 'Psyduck',
  55: 'Golduck', 56: 'Mankey', 57: 'Primeape', 58: 'Growlithe', 59: 'Arcanine', 60: 'Poliwag',
  61: 'Poliwhirl', 62: 'Poliwrath', 63: 'Abra', 64: 'Kadabra', 65: 'Alakazam', 66: 'Machop',
  67: 'Machoke', 68: 'Machamp', 69: 'Bellsprout', 70: 'Weepinbell', 71: 'Victreebel', 72: 'Tentacool',
  73: 'Tentacruel', 74: 'Geodude', 75: 'Graveler', 76: 'Golem', 77: 'Ponyta', 78: 'Rapidash',
  79: 'Slowpoke', 80: 'Slowbro', 81: 'Magnemite', 82: 'Magneton', 83: "Farfetch'd", 84: 'Doduo',
  85: 'Dodrio', 86: 'Seel', 87: 'Dewgong', 88: 'Grimer', 89: 'Muk', 90: 'Shellder',
  91: 'Cloyster', 92: 'Gastly', 93: 'Haunter', 94: 'Gengar', 95: 'Onix', 96: 'Drowzee',
  97: 'Hypno', 98: 'Krabby', 99: 'Kingler', 100: 'Voltorb', 101: 'Electrode', 102: 'Exeggcute',
  103: 'Exeggutor', 104: 'Cubone', 105: 'Marowak', 106: 'Hitmonlee', 107: 'Hitmonchan', 108: 'Lickitung',
  109: 'Koffing', 110: 'Weezing', 111: 'Rhyhorn', 112: 'Rhydon', 113: 'Chansey', 114: 'Tangela',
  115: 'Kangaskhan', 116: 'Horsea', 117: 'Seadra', 118: 'Goldeen', 119: 'Seaking', 120: 'Staryu',
  121: 'Starmie', 122: 'Mr. Mime', 123: 'Scyther', 124: 'Jynx', 125: 'Electabuzz', 126: 'Magmar',
  127: 'Pinsir', 128: 'Tauros', 129: 'Magikarp', 130: 'Gyarados', 131: 'Lapras', 132: 'Ditto',
  133: 'Eevee', 134: 'Vaporeon', 135: 'Jolteon', 136: 'Flareon', 137: 'Porygon', 138: 'Omanyte',
  139: 'Omastar', 140: 'Kabuto', 141: 'Kabutops', 142: 'Aerodactyl', 143: 'Snorlax', 144: 'Articuno',
  145: 'Zapdos', 146: 'Moltres', 147: 'Dratini', 148: 'Dragonair', 149: 'Dragonite', 150: 'Mewtwo',
  151: 'Mew',
  // Gen 2
  152: 'Chikorita', 153: 'Bayleef', 154: 'Meganium', 155: 'Cyndaquil', 156: 'Quilava', 157: 'Typhlosion',
  158: 'Totodile', 159: 'Croconaw', 160: 'Feraligatr', 161: 'Sentret', 162: 'Furret', 163: 'Hoothoot',
  164: 'Noctowl', 165: 'Ledyba', 166: 'Ledian', 167: 'Spinarak', 168: 'Ariados', 169: 'Crobat',
  170: 'Chinchou', 171: 'Lanturn', 172: 'Pichu', 173: 'Cleffa', 174: 'Igglybuff', 175: 'Togepi',
  176: 'Togetic', 177: 'Natu', 178: 'Xatu', 179: 'Mareep', 180: 'Flaaffy', 181: 'Ampharos',
  182: 'Bellossom', 183: 'Marill', 184: 'Azumarill', 185: 'Sudowoodo', 186: 'Politoed', 187: 'Hoppip',
  188: 'Skiploom', 189: 'Jumpluff', 190: 'Aipom', 191: 'Sunkern', 192: 'Sunflora', 193: 'Yanma',
  194: 'Wooper', 195: 'Quagsire', 196: 'Espeon', 197: 'Umbreon', 198: 'Murkrow', 199: 'Slowking',
  200: 'Misdreavus', 201: 'Unown', 202: 'Wobbuffet', 203: 'Girafarig', 204: 'Pineco', 205: 'Forretress',
  206: 'Dunsparce', 207: 'Gligar', 208: 'Steelix', 209: 'Snubbull', 210: 'Granbull', 211: 'Qwilfish',
  212: 'Scizor', 213: 'Shuckle', 214: 'Heracross', 215: 'Sneasel', 216: 'Teddiursa', 217: 'Ursaring',
  218: 'Slugma', 219: 'Magcargo', 220: 'Swinub', 221: 'Piloswine', 222: 'Corsola', 223: 'Remoraid',
  224: 'Octillery', 225: 'Delibird', 226: 'Mantine', 227: 'Skarmory', 228: 'Houndour', 229: 'Houndoom',
  230: 'Kingdra', 231: 'Phanpy', 232: 'Donphan', 233: 'Porygon2', 234: 'Stantler', 235: 'Smeargle',
  236: 'Tyrogue', 237: 'Hitmontop', 238: 'Smoochum', 239: 'Elekid', 240: 'Magby', 241: 'Miltank',
  242: 'Blissey', 243: 'Raikou', 244: 'Entei', 245: 'Suicune', 246: 'Larvitar', 247: 'Pupitar',
  248: 'Tyranitar', 249: 'Lugia', 250: 'Ho-Oh', 251: 'Celebi',
  // Gen 3
  252: 'Treecko', 253: 'Grovyle', 254: 'Sceptile', 255: 'Torchic', 256: 'Combusken', 257: 'Blaziken',
  258: 'Mudkip', 259: 'Marshtomp', 260: 'Swampert', 261: 'Poochyena', 262: 'Mightyena', 263: 'Zigzagoon',
  264: 'Linoone', 265: 'Wurmple', 266: 'Silcoon', 267: 'Beautifly', 268: 'Cascoon', 269: 'Dustox',
  270: 'Lotad', 271: 'Lombre', 272: 'Ludicolo', 273: 'Seedot', 274: 'Nuzleaf', 275: 'Shiftry',
  276: 'Taillow', 277: 'Swellow', 278: 'Wingull', 279: 'Pelipper', 280: 'Ralts', 281: 'Kirlia',
  282: 'Gardevoir', 283: 'Surskit', 284: 'Masquerain', 285: 'Shroomish', 286: 'Breloom', 287: 'Slakoth',
  288: 'Vigoroth', 289: 'Slaking', 290: 'Nincada', 291: 'Ninjask', 292: 'Shedinja', 293: 'Whismur',
  294: 'Loudred', 295: 'Exploud', 296: 'Makuhita', 297: 'Hariyama', 298: 'Azurill', 299: 'Nosepass',
  300: 'Skitty', 301: 'Delcatty', 302: 'Sableye', 303: 'Mawile', 304: 'Aron', 305: 'Lairon',
  306: 'Aggron', 307: 'Meditite', 308: 'Medicham', 309: 'Electrike', 310: 'Manectric', 311: 'Plusle',
  312: 'Minun', 313: 'Volbeat', 314: 'Illumise', 315: 'Roselia', 316: 'Gulpin', 317: 'Swalot',
  318: 'Carvanha', 319: 'Sharpedo', 320: 'Wailmer', 321: 'Wailord', 322: 'Numel', 323: 'Camerupt',
  324: 'Torkoal', 325: 'Spoink', 326: 'Grumpig', 327: 'Spinda', 328: 'Trapinch', 329: 'Vibrava',
  330: 'Flygon', 331: 'Cacnea', 332: 'Cacturne', 333: 'Swablu', 334: 'Altaria', 335: 'Zangoose',
  336: 'Seviper', 337: 'Lunatone', 338: 'Solrock', 339: 'Barboach', 340: 'Whiscash', 341: 'Corphish',
  342: 'Crawdaunt', 343: 'Baltoy', 344: 'Claydol', 345: 'Lileep', 346: 'Cradily', 347: 'Anorith',
  348: 'Armaldo', 349: 'Feebas', 350: 'Milotic', 351: 'Castform', 352: 'Kecleon', 353: 'Shuppet',
  354: 'Banette', 355: 'Duskull', 356: 'Dusclops', 357: 'Tropius', 358: 'Chimecho', 359: 'Absol',
  360: 'Wynaut', 361: 'Snorunt', 362: 'Glalie', 363: 'Spheal', 364: 'Sealeo', 365: 'Walrein',
  366: 'Clamperl', 367: 'Huntail', 368: 'Gorebyss', 369: 'Relicanth', 370: 'Luvdisc', 371: 'Bagon',
  372: 'Shelgon', 373: 'Salamence', 374: 'Beldum', 375: 'Metang', 376: 'Metagross', 377: 'Regirock',
  378: 'Regice', 379: 'Registeel', 380: 'Latias', 381: 'Latios', 382: 'Kyogre', 383: 'Groudon',
  384: 'Rayquaza', 385: 'Jirachi', 386: 'Deoxys'
};

function getSpeciesName(speciesId) {
  return SPECIES_NAMES[speciesId] || `Species${speciesId}`;
}

// Convert National Dex ID to Gen 3 internal species ID
// Based on PKHeX.Core/PKM/Util/Conversion/SpeciesConverter.cs GetInternal3
function convertNationalToInternal3(nationalSpecies) {
  const FirstUnalignedNational3 = 252; // Legal.MaxSpeciesID_2 + 1
  const FirstUnalignedInternal3 = 277;
  
  // Table3NationalToInternal from SpeciesConverter.cs (exact copy from PKHeX source)
  // This is the delta table: difference between national ID and internal ID
  const Table3NationalToInternal = [
    25, 25, 25, 25, 25, 25, 25, 25,
    25, 25, 25, 25, 25, 25, 25, 25, 25, 25,
    25, 25, 25, 25, 25, 25, 28, 28, 31, 31,
    112, 112, 112, 28, 28, 21, 21, 77, 77, 77,
    11, 11, 11, 77, 77, 77, 39, 39, 52, 21,
    15, 15, 20, 52, 78, 78, 78, 49, 49, 28,
    28, 42, 42, 73, 73, 48, 51, 51, 12, 12,
    -7, -7, 17, 17, -3, 26, 26, -19, 4, 4,
    4, 13, 13, 25, 25, 45, 43, 11, 11, -16,
    -16, -15, -15, -25, -25, 43, 43, 43, 43, -21,
    -21, 34, -35, 24, 24, 6, 6, 12, 53, 17,
    0, -15, -15, -22, -22, -22, 7, 7, 7, 12,
    -45, 24, 24, 24, 24, 24, 24, 24, 24, 24,
    27, 27, 22, 22, 22, 24, 24,
  ];
  
  if (nationalSpecies < FirstUnalignedNational3) {
    // Gen 1-2 Pokemon: National Dex ID = internal ID
    return nationalSpecies;
  }
  
  const shift = nationalSpecies - FirstUnalignedNational3;
  if (shift < 0 || shift >= Table3NationalToInternal.length) {
    // Out of range - might already be internal ID or invalid
    // If it's > 386, it's definitely not a Gen 3 Pokemon, return as-is but it will be rejected
    // If it's < 277, it might already be an internal ID (Gen 1-2), return as-is
    return nationalSpecies;
  }
  
  const delta = Table3NationalToInternal[shift];
  const internal = nationalSpecies + delta;
  
  // Validate result (internal IDs for Gen 3 start at 277, max is 386)
  if (internal >= FirstUnalignedInternal3 && internal <= 386) {
    return internal;
  }
  
  // Conversion produced invalid result - this shouldn't happen with valid Gen 3 Pokemon
  // Return the original, but it will be rejected by validation (must be 1-386)
  return nationalSpecies;
}

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.raw({ limit: '128kb', type: 'application/octet-stream' }));

app.use(express.static('public'));

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 256 * 1024 } // 256KB max (Gen 3 saves are 128KB, but allow some buffer)
});

// Default folder path - user can change this
const DEFAULT_PK3_FOLDER = path.join(__dirname, 'pk3-files');

// Path to the folders configuration file
const FOLDERS_CONFIG_PATH = path.join(__dirname, 'folders-config.json');

// Load folders from JSON file or initialize with defaults
function loadFolders() {
  if (fs.existsSync(FOLDERS_CONFIG_PATH)) {
    try {
      const data = fs.readFileSync(FOLDERS_CONFIG_PATH, 'utf8');
      const folders = JSON.parse(data);
      return folders;
    } catch (error) {
      console.error('Error loading folders config:', error);
      // Fall back to defaults if file is corrupted
      return getDefaultFolders();
    }
  } else {
    // Initialize with default folders
    const defaultFolders = getDefaultFolders();
    saveFolders(defaultFolders);
    return defaultFolders;
  }
}

// Get default folders configuration
function getDefaultFolders() {
  return [
    { id: 'db1', name: 'Database 1', path: path.join(__dirname, 'pk3-files') }
  ];
}

// Save folders to JSON file
function saveFolders(folders) {
  try {
    fs.writeFileSync(FOLDERS_CONFIG_PATH, JSON.stringify(folders, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving folders config:', error);
    throw error;
  }
}

// Available Pokemon database folders
let PK3_DATABASES = loadFolders();

// Ensure all database directories exist
PK3_DATABASES.forEach(db => {
  if (!fs.existsSync(db.path)) {
    fs.mkdirSync(db.path, { recursive: true });
  }
});

// Helper function to get folder path from database ID
function getFolderPath(dbId) {
  const db = PK3_DATABASES.find(d => d.id === dbId);
  return db ? db.path : DEFAULT_PK3_FOLDER;
}

// API endpoint to get available databases
app.get('/api/databases', (req, res) => {
  // Reload folders to get latest state
  PK3_DATABASES = loadFolders();
  res.json(PK3_DATABASES.map(db => ({
    id: db.id,
    name: db.name,
    exists: fs.existsSync(db.path),
    fileCount: fs.existsSync(db.path) 
      ? fs.readdirSync(db.path).filter(f => {
          const lower = f.toLowerCase();
          return lower.endsWith('.pk3') || lower.endsWith('.pk4') || lower.endsWith('.pk5') || lower.endsWith('.pk6') || lower.endsWith('.pk7');
        }).length 
      : 0,
    path: db.path
  })));
});

// API endpoint to add a new folder
app.post('/api/databases', express.json(), (req, res) => {
  try {
    const { name, folderPath } = req.body;
    
    if (!name || !folderPath) {
      return res.status(400).json({ error: 'Name and folder path are required' });
    }
    
    // Validate folder path (must be absolute or relative to project root)
    let resolvedPath;
    if (path.isAbsolute(folderPath)) {
      resolvedPath = folderPath;
    } else {
      resolvedPath = path.join(__dirname, folderPath);
    }
    
    // Check if folder already exists in the list
    const existing = PK3_DATABASES.find(db => db.path === resolvedPath);
    if (existing) {
      return res.status(400).json({ error: 'Folder already exists in the database list' });
    }
    
    // Generate a unique ID
    const maxId = PK3_DATABASES.reduce((max, db) => {
      const match = db.id.match(/^db(\d+)$/);
      if (match) {
        const num = parseInt(match[1]);
        return Math.max(max, num);
      }
      return max;
    }, 0);
    const newId = `db${maxId + 1}`;
    
    // Create the folder if it doesn't exist
    if (!fs.existsSync(resolvedPath)) {
      fs.mkdirSync(resolvedPath, { recursive: true });
    }
    
    // Add to database list
    const newFolder = {
      id: newId,
      name: name,
      path: resolvedPath
    };
    
    PK3_DATABASES.push(newFolder);
    saveFolders(PK3_DATABASES);
    
    res.json({ success: true, folder: newFolder });
  } catch (error) {
    console.error('Error adding folder:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to reorder folders (must come before /:id route to avoid route conflict)
app.put('/api/databases/reorder', express.json(), (req, res) => {
  try {
    const { folderIds } = req.body;
    
    if (!folderIds || !Array.isArray(folderIds)) {
      return res.status(400).json({ error: 'folderIds array is required' });
    }
    
    // Validate that all IDs exist and match current folders
    const currentIds = PK3_DATABASES.map(db => db.id);
    if (folderIds.length !== currentIds.length || 
        !folderIds.every(id => currentIds.includes(id))) {
      return res.status(400).json({ error: 'Invalid folder IDs provided' });
    }
    
    // Reorder folders based on the provided order
    const reorderedFolders = folderIds.map(id => 
      PK3_DATABASES.find(db => db.id === id)
    ).filter(Boolean);
    
    PK3_DATABASES = reorderedFolders;
    saveFolders(PK3_DATABASES);
    
    res.json({ success: true, folders: PK3_DATABASES });
  } catch (error) {
    console.error('Error reordering folders:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to update a folder's name and/or path
app.put('/api/databases/:id', express.json(), (req, res) => {
  try {
    const folderId = req.params.id;
    const { name, folderPath } = req.body;
    
    const folder = PK3_DATABASES.find(db => db.id === folderId);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Check if at least one field is being updated
    if (name === undefined && folderPath === undefined) {
      return res.status(400).json({ error: 'At least one field (name or folderPath) must be provided' });
    }
    
    let updated = false;
    
    // Update the name if provided
    if (name !== undefined && name !== null) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return res.status(400).json({ error: 'Name cannot be empty' });
      }
      if (trimmedName !== folder.name) {
        folder.name = trimmedName;
        updated = true;
      }
    }
    
    // Update the path if provided
    if (folderPath !== undefined && folderPath !== null) {
      const trimmedPath = folderPath.trim();
      if (!trimmedPath) {
        return res.status(400).json({ error: 'Folder path cannot be empty' });
      }
      
      // Validate folder path (must be absolute or relative to project root)
      let resolvedPath;
      if (path.isAbsolute(trimmedPath)) {
        resolvedPath = path.normalize(trimmedPath);
      } else {
        resolvedPath = path.normalize(path.join(__dirname, trimmedPath));
      }
      
      // Normalize the existing path for comparison
      const existingPath = path.normalize(folder.path);
      
      // Only update if the path actually changed
      if (resolvedPath !== existingPath) {
        // Check if the new path is already used by another folder
        const existing = PK3_DATABASES.find(db => {
          if (db.id === folderId) return false;
          return path.normalize(db.path) === resolvedPath;
        });
        if (existing) {
          return res.status(400).json({ error: 'Folder path is already used by another database' });
        }
        
        folder.path = resolvedPath;
        updated = true;
      }
    }
    
    // Only save if something actually changed
    if (updated) {
      saveFolders(PK3_DATABASES);
      console.log(`[Database Update] Updated folder ${folderId}: name="${folder.name}", path="${folder.path}"`);
    }
    
    res.json({ success: true, folder: folder, updated: updated });
  } catch (error) {
    console.error('Error updating folder:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to recursively find all Pokemon files (.pk3, .pk4, .pk5, .pk6, .pk7) in a directory
function findPokemonFilesRecursive(dirPath, fileList = []) {
  if (!fs.existsSync(dirPath)) {
    return fileList;
  }
  
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      try {
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Recursively search subdirectories
          findPokemonFilesRecursive(fullPath, fileList);
        } else if (stat.isFile()) {
          const lower = item.toLowerCase();
          // Find all Pokemon file formats: Gen 3 (.pk3), Gen 4 (.pk4), Gen 5 (.pk5), Gen 6 (.pk6), Gen 7 (.pk7)
          if (lower.endsWith('.pk3') || lower.endsWith('.pk4') || lower.endsWith('.pk5') || lower.endsWith('.pk6') || lower.endsWith('.pk7')) {
            fileList.push(fullPath);
          }
        }
      } catch (statError) {
        // Silently skip files that can't be accessed
      }
    }
  } catch (readError) {
    // Silently skip directories that can't be read
  }
  
  return fileList;
}

// API endpoint to scan and move PK3 files
app.post('/api/databases/scan-and-move', express.json(), (req, res) => {
  try {
    const { sourceFolder, targetDbId } = req.body;
    
    if (!sourceFolder || !targetDbId) {
      return res.status(400).json({ error: 'Source folder and target database are required' });
    }
    
    // Validate source folder
    let sourcePath;
    if (path.isAbsolute(sourceFolder)) {
      sourcePath = sourceFolder;
    } else {
      sourcePath = path.join(__dirname, sourceFolder);
    }
    
    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ error: 'Source folder does not exist' });
    }
    
    // Validate target database
    const targetDb = PK3_DATABASES.find(db => db.id === targetDbId);
    if (!targetDb) {
      return res.status(404).json({ error: 'Target database not found' });
    }
    
    // Ensure target folder exists
    if (!fs.existsSync(targetDb.path)) {
      fs.mkdirSync(targetDb.path, { recursive: true });
    }
    
    // Recursively find all Pokemon files (.pk3, .pk4, .pk5, .pk6, .pk7)
    const pk3Files = findPokemonFilesRecursive(sourcePath);
    const timestamp = new Date().toLocaleString();
    console.log(`[Folder Scanner] Found ${pk3Files.length} Pokemon file(s) in source folder [${timestamp}]`);
    
    if (pk3Files.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No Pokemon files found in source folder',
        filesMoved: 0,
        filesSkipped: 0,
        errors: []
      });
    }
    
    // Move files to target database
    let filesMoved = 0;
    let filesSkipped = 0;
    const errors = [];
    
    console.log(`[Folder Scanner] Processing ${pk3Files.length} file(s)... [${timestamp}]`);
    
    for (const filePath of pk3Files) {
      try {
        const filename = path.basename(filePath);
        let targetPath = path.join(targetDb.path, filename);
        
        // Check if file already exists in target
        if (fs.existsSync(targetPath)) {
          // Compare file sizes to see if they're the same
          const sourceStats = fs.statSync(filePath);
          const targetStats = fs.statSync(targetPath);
          
          if (sourceStats.size === targetStats.size) {
            // Same file, skip it
            filesSkipped++;
            continue;
          } else {
            // Different file with same name, rename it
            const ext = path.extname(filename);
            const baseName = path.basename(filename, ext);
            let counter = 1;
            do {
              const newFilename = `${baseName}_${counter}${ext}`;
              targetPath = path.join(targetDb.path, newFilename);
              counter++;
            } while (fs.existsSync(targetPath));
          }
        }
        
        // Move the file (use copy + delete for cross-device support)
        try {
          // Copy the file first (works across drives)
          fs.copyFileSync(filePath, targetPath);
          
          // Verify the copy was successful
          if (!fs.existsSync(targetPath)) {
            throw new Error('Copy verification failed - target file does not exist');
          }
          
          // Delete the source file
          fs.unlinkSync(filePath);
          
          // Final verification
          if (fs.existsSync(targetPath) && !fs.existsSync(filePath)) {
            filesMoved++;
          } else {
            throw new Error(`File move verification failed - target exists: ${fs.existsSync(targetPath)}, source removed: ${!fs.existsSync(filePath)}`);
          }
        } catch (moveError) {
          // If copy succeeded but delete failed, try to clean up the target
          if (fs.existsSync(targetPath) && !fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(targetPath);
            } catch (cleanupError) {
              // Silently handle cleanup errors
            }
          }
          throw new Error(`Failed to move file: ${moveError.message}`);
        }
      } catch (error) {
        const filename = path.basename(filePath);
        console.error(`[Folder Scanner] Error moving file ${filename}: ${error.message}`);
        errors.push({
          file: filePath,
          error: error.message
        });
      }
    }
    
    const responseData = {
      success: true,
      message: `Moved ${filesMoved} file(s) to ${targetDb.name}`,
      filesMoved: filesMoved,
      filesSkipped: filesSkipped,
      totalFound: pk3Files.length,
      errors: errors
    };
    
    res.json(responseData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to remove a folder
app.delete('/api/databases/:id', (req, res) => {
  try {
    const folderId = req.params.id;
    const folder = PK3_DATABASES.find(db => db.id === folderId);
    
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Check if folder has content
    if (fs.existsSync(folder.path)) {
      const files = fs.readdirSync(folder.path);
      const pkFiles = files.filter(f => {
        const lower = f.toLowerCase();
        return lower.endsWith('.pk3') || lower.endsWith('.pk4') || lower.endsWith('.pk5') || lower.endsWith('.pk6') || lower.endsWith('.pk7');
      });
      
      if (pkFiles.length > 0) {
        return res.status(400).json({ 
          error: `Cannot remove folder: it contains ${pkFiles.length} Pokemon file(s). Please remove all files first.`,
          fileCount: pkFiles.length
        });
      }
      
      // Check for any files (not just .pk3)
      if (files.length > 0) {
        return res.status(400).json({ 
          error: `Cannot remove folder: it contains ${files.length} file(s). Please remove all files first.`,
          fileCount: files.length
        });
      }
    }
    
    // Remove from database list
    PK3_DATABASES = PK3_DATABASES.filter(db => db.id !== folderId);
    saveFolders(PK3_DATABASES);
    
    res.json({ success: true, message: 'Folder removed successfully' });
  } catch (error) {
    console.error('Error removing folder:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get all .pk3 files from the folder
app.get('/api/pokemon', (req, res) => {
  const dbId = req.query.db || req.query.folder; // Support both 'db' and 'folder' for backward compatibility
  const folderPath = dbId ? getFolderPath(dbId) : DEFAULT_PK3_FOLDER;
  
  console.log(`[API] /api/pokemon called with dbId: ${dbId}, folderPath: ${folderPath}`);
  
  if (!fs.existsSync(folderPath)) {
    console.error(`[API] Folder not found: ${folderPath}`);
    return res.status(404).json({ error: 'Folder not found' });
  }

  try {
    console.log(`[API] Reading folder: ${folderPath}`);
    // Use recursive search to find all Pokemon files in subdirectories too
    const allFilePaths = findPokemonFilesRecursive(folderPath);
    console.log(`[API] Found ${allFilePaths.length} Pokemon files`);
    
    const files = allFilePaths.map(filePath => {
      const stats = fs.statSync(filePath);
      return {
        filename: path.basename(filePath),
        path: filePath,
        size: stats.size,
        modified: stats.mtime
      };
    });

    console.log(`[API] Filtered to ${files.length} Pokemon files`);
    
    if (files.length === 0) {
      console.warn(`[API] No Pokemon files found in ${folderPath}`);
      return res.json([]);
    }

    // Parse each Pokemon file
    const pokemon = files.map(file => {
      try {
        const buffer = fs.readFileSync(file.path);
        const lower = file.filename.toLowerCase();
        let pokemonData;
        
        if (lower.endsWith('.pk3')) {
          pokemonData = PK3Parser.parse(buffer, file.filename);
        } else if (lower.endsWith('.pk4') || lower.endsWith('.pk5')) {
          pokemonData = PK4Parser.parse(buffer, file.filename);
        } else if (lower.endsWith('.pk6')) {
          pokemonData = PK6Parser.parse(buffer, file.filename);
        } else if (lower.endsWith('.pk7')) {
          pokemonData = PK7Parser.parse(buffer, file.filename);
        } else {
          throw new Error('Unsupported file format');
        }
        
        // Validate that we got valid data
        if (!pokemonData || !pokemonData.species) {
          throw new Error('Parser returned invalid data: missing species');
        }
        
        // Get file stats again to include creation date
        const fileStats = fs.statSync(file.path);
        return {
          ...pokemonData,
          filename: file.filename,
          fileCreated: fileStats.birthtime || fileStats.mtime, // Use birthtime (creation) or mtime (modified) as fallback
          fileModified: fileStats.mtime
        };
      } catch (error) {
        console.error(`Error parsing ${file.filename}:`, error.message);
        return {
          filename: file.filename,
          error: error.message
        };
      }
    });

    // Log summary
    const validCount = pokemon.filter(p => !p.error && p.species).length;
    const errorCount = pokemon.filter(p => p.error).length;
    console.log(`[API] Parsed ${files.length} files: ${validCount} valid, ${errorCount} errors`);
    
    if (validCount === 0 && errorCount > 0) {
      console.error(`[API] All ${errorCount} files failed to parse. First 3 errors:`, 
        pokemon.filter(p => p.error).slice(0, 3).map(p => `${p.filename}: ${p.error}`));
    }

    console.log(`[API] Sending ${pokemon.length} Pokemon objects to client`);
    res.json(pokemon);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get a specific Pokemon file
app.get('/api/pokemon/:filename', (req, res) => {
  const dbId = req.query.db || req.query.folder;
  const folderPath = dbId ? getFolderPath(dbId) : DEFAULT_PK3_FOLDER;
  const filename = req.params.filename;
  const filePath = path.join(folderPath, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    const buffer = fs.readFileSync(filePath);
    
    // If raw=true, return the raw file data
    if (req.query.raw === 'true') {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.send(buffer);
      return;
    }
    
    const lower = filename.toLowerCase();
    let pokemonData;
    if (lower.endsWith('.pk3')) {
      pokemonData = PK3Parser.parse(buffer);
    } else if (lower.endsWith('.pk4') || lower.endsWith('.pk5')) {
      pokemonData = PK4Parser.parse(buffer, filename);
    } else if (lower.endsWith('.pk6')) {
      pokemonData = PK6Parser.parse(buffer, filename);
    } else if (lower.endsWith('.pk7')) {
      pokemonData = PK7Parser.parse(buffer, filename);
    } else {
      return res.status(400).json({ error: 'Unsupported file format' });
    }
    
    res.json(pokemonData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get raw .pk3 file data
app.get('/api/pokemon/file/:filename', (req, res) => {
  const dbId = req.query.db || req.query.folder;
  const folderPath = dbId ? getFolderPath(dbId) : DEFAULT_PK3_FOLDER;
  const filename = req.params.filename;
  const filePath = path.join(folderPath, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    const buffer = fs.readFileSync(filePath);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to update a Pokemon's ball
app.post('/api/pokemon/update-ball', express.json(), (req, res) => {
  try {
    const { filename, db, newBall } = req.body;
    
    if (!filename || newBall === undefined) {
      return res.status(400).json({ error: 'Missing filename or newBall' });
    }
    
    // Validate ball ID is in valid range (0-15 for 4-bit value)
    const ballId = parseInt(newBall);
    if (isNaN(ballId) || ballId < 0 || ballId > 15) {
      return res.status(400).json({ error: `Invalid ball ID: ${newBall} (must be 0-15)` });
    }
    
    console.log(`[Ball Update] Request: filename=${filename}, requestedBall=${ballId}`);
    
    const dbId = db || 'db1';
    const folderPath = getFolderPath(dbId);
    
    if (!folderPath) {
      return res.status(404).json({ error: 'Database not found' });
    }
    
    const filePath = path.join(folderPath, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Preserve file timestamps (modification time, access time, and birthtime if available)
    const stats = fs.statSync(filePath);
    const originalMtime = stats.mtime;
    const originalAtime = stats.atime;
    const originalBirthtime = stats.birthtime;
    
    // Read the file
    let buffer = fs.readFileSync(filePath);
    
    // Determine format and update ball
    const lowerFilename = filename.toLowerCase();
    let updated = false;
    
    if (lowerFilename.endsWith('.pk3')) {
      // PK3: Ball is in origins field at offset 0x46 (bits 11-14)
      // Need to handle encryption/decryption
      // Determine format: 100 bytes could be PKHeX export or party format
      let isPKHeXExport = false;
      let dataOffset = 0;
      
      if (buffer.length === 100) {
        // Check if it's PKHeX export (species at 0x20 is valid) or party format (encrypted)
        const speciesAt20 = buffer.readUInt16LE(0x20);
        isPKHeXExport = (speciesAt20 >= 1 && speciesAt20 <= 386);
        dataOffset = isPKHeXExport ? 0x20 : 0;
      } else if (buffer.length === 80) {
        // Raw 80-byte stored format
        isPKHeXExport = false;
        dataOffset = 0;
      } else {
        throw new Error(`Invalid PK3 file size: ${buffer.length} bytes (expected 80 or 100)`);
      }
      
      // Check if encrypted (PKHeX exports are already decrypted)
      const needsDecryption = !isPKHeXExport && PK3Parser.checkIfEncrypted(buffer, dataOffset);
      let workingBuffer = Buffer.from(buffer);
      
      if (needsDecryption) {
        // Decrypt: for party/raw format, dataOffset is 0 (Pokemon data starts at beginning)
        workingBuffer = PK3Parser.decryptPK3(workingBuffer, 0);
      }
      
      // Update ball in origins field (offset 0x46 in decrypted data)
      // For PKHeX exports: origins is at 0x20 + 0x46 = 0x66
      // For raw/party files: origins is at 0x46 (after decryption, data starts at 0)
      // IMPORTANT: Origins field is in Block D (0x44-0x4F), which gets shuffled during encryption
      // We need to update it BEFORE encryption, then after encryption, find Block D and update it there too
      const originsOffset = dataOffset + 0x46;
      if (originsOffset + 2 > workingBuffer.length) {
        throw new Error(`Invalid PK3 file: origins offset ${originsOffset} out of bounds (buffer size: ${workingBuffer.length})`);
      }
      
      const origins = workingBuffer.readUInt16LE(originsOffset);
      const oldBall = (origins >> 11) & 0xF;
      console.log(`[Ball Update] File: ${filename}, Old Ball ID: ${oldBall}, Requested Ball ID: ${ballId}`);
      
      // Clear bits 11-14 and set new ball (ball is in bits 11-14)
      const clearedOrigins = origins & ~(0xF << 11);
      const ballValue = ballId & 0xF; // Ensure we only use 4 bits (0-15)
      const newOrigins = clearedOrigins | (ballValue << 11);
      workingBuffer.writeUInt16LE(newOrigins, originsOffset);
      
      // Verify the write before encryption
      const verifyOrigins = workingBuffer.readUInt16LE(originsOffset);
      const verifyBall = (verifyOrigins >> 11) & 0xF;
      console.log(`[Ball Update] File: ${filename}, Verified Ball ID (before encryption): ${verifyBall}, Expected: ${ballValue}`);
      
      if (verifyBall !== ballValue) {
        throw new Error(`Ball write verification failed: expected ${ballValue}, got ${verifyBall}`);
      }
      
      // Store PID for finding Block D after encryption
      const pid = workingBuffer.readUInt32LE(dataOffset + 0x00);
      
      // Re-encrypt if needed (only for files that were encrypted)
      if (needsDecryption) {
        // Extract the 80-byte stored data for encryption
        // After decryption, the stored data is at the start (0x00-0x4F for 80-byte files)
        // For party format (100 bytes), the stored data is the first 80 bytes
        // CRITICAL: Create a proper copy to avoid any buffer reference issues
        const storedData = Buffer.alloc(80);
        if (workingBuffer.length < 80) {
          throw new Error(`Invalid PK3 data: workingBuffer too short (${workingBuffer.length} bytes, expected at least 80)`);
        }
        workingBuffer.copy(storedData, 0, 0, 80);
        
        // Verify the stored data has valid structure before encryption
        // Check that PID and OID are present (at offsets 0x00 and 0x04)
        const pid = storedData.readUInt32LE(0x00);
        const oid = storedData.readUInt32LE(0x04);
        
        if (pid === 0 || oid === 0) {
          throw new Error('Invalid PK3 data: PID or OID is zero, cannot encrypt');
        }
        
        // Verify moves are in valid range before encryption (sanity check)
        // Moves are at offsets 0x2C, 0x2E, 0x30, 0x32 (Block B)
        const move1 = storedData.readUInt16LE(0x2C);
        const move2 = storedData.readUInt16LE(0x2E);
        const move3 = storedData.readUInt16LE(0x30);
        const move4 = storedData.readUInt16LE(0x32);
        
        // Moves should be 0 (no move) or between 1-354 (valid move IDs for Gen 3)
        const validMoveRange = (move) => move === 0 || (move >= 1 && move <= 354);
        if (!validMoveRange(move1) || !validMoveRange(move2) || !validMoveRange(move3) || !validMoveRange(move4)) {
          console.warn(`Warning: Invalid move values before encryption - Move1: ${move1}, Move2: ${move2}, Move3: ${move3}, Move4: ${move4}`);
        }
        
        // Encrypt using SAV3Parser's encryptPKM method
        // This will shuffle blocks and XOR encrypt the data correctly
        const SAV3Parser = require('./parsers/sav3-parser');
        const tempSave = new SAV3Parser(Buffer.alloc(128 * 1024));
        const encrypted = tempSave.encryptPKM(storedData);
        
        // Verify moves after encryption (they should still be valid after shuffle/XOR)
        // After encryption, the blocks are shuffled, so we need to decrypt to check
        // But for now, just verify the encrypted data has the right checksum
        const encryptedChecksum = encrypted.readUInt16LE(0x1C);
        let calculatedChecksum = 0;
        for (let i = 0x20; i < 0x50; i += 2) {
          calculatedChecksum += encrypted.readUInt16LE(i);
        }
        calculatedChecksum = calculatedChecksum & 0xFFFF;
        
        if (encryptedChecksum !== calculatedChecksum) {
          console.warn(`Warning: Checksum mismatch after encryption - stored: ${encryptedChecksum}, calculated: ${calculatedChecksum}`);
        }
        
        // Reconstruct the file
        if (buffer.length === 100) {
          // Party format: encrypted stored data (80 bytes) + party data (20 bytes)
          // IMPORTANT: Copy party data from ORIGINAL buffer, not workingBuffer
          // The party data was never decrypted/encrypted, so it should remain unchanged
          const result = Buffer.alloc(100);
          encrypted.copy(result, 0, 0, 80); // Copy encrypted stored data
          buffer.copy(result, 80, 80, 100); // Copy party data from original (unchanged)
          workingBuffer = result;
        } else {
          // Raw 80-byte file - replace with encrypted version
          workingBuffer = encrypted;
        }
        
        // CRITICAL: After encryption, blocks are shuffled, so Block D (which contains origins at 0x46)
        // might be in a different position. We need to find Block D and update the ball there.
        // Block D is 12 bytes. After encryption, we need to find which physical block position
        // contains logical Block D (block index 3).
        const SIZE_3HEADER = 32; // 0x20
        const SIZE_3BLOCK = 12;
        const BlockPositionInvert = [
          0, 1, 2, 4, 3, 5, 6, 7, 12, 18, 13, 19, 8, 10, 14, 20, 16, 22, 9, 11, 15, 21, 17, 23,
          0, 1, 2, 4, 3, 5, 6, 7, // duplicates
        ];
        const sv = BlockPositionInvert[pid % 24];
        const BlockPosition = [
          0, 1, 2, 3, 0, 1, 3, 2, 0, 2, 1, 3, 0, 3, 1, 2, 0, 2, 3, 1, 0, 3, 2, 1,
          1, 0, 2, 3, 1, 0, 3, 2, 2, 0, 1, 3, 3, 0, 1, 2, 2, 0, 3, 1, 3, 0, 2, 1,
          1, 2, 0, 3, 1, 3, 0, 2, 2, 1, 0, 3, 3, 1, 0, 2, 2, 3, 0, 1, 3, 2, 0, 1,
          1, 2, 3, 0, 1, 3, 2, 0, 2, 1, 3, 0, 3, 1, 2, 0, 2, 3, 1, 0, 3, 2, 1, 0,
          0, 1, 2, 3, 0, 1, 3, 2, 0, 2, 1, 3, 0, 3, 1, 2, 0, 2, 3, 1, 0, 3, 2, 1,
          1, 0, 2, 3, 1, 0, 3, 2, // duplicates
        ];
        const index = sv * 4;
        
        // Find which physical block position contains Block D (logical block 3)
        // BlockPosition[index + destBlock] tells us which logical block is at each physical position
        let blockDOffset = -1;
        for (let destBlock = 0; destBlock < 4; destBlock++) {
          const logicalBlockIndex = BlockPosition[index + destBlock];
          if (logicalBlockIndex === 3) {
            // This physical block position contains logical Block D
            blockDOffset = SIZE_3HEADER + (SIZE_3BLOCK * destBlock);
            break;
          }
        }
        
        if (blockDOffset >= 0 && blockDOffset + 0x02 + 2 <= workingBuffer.length) {
          // Origins field is at offset 0x02 within Block D (0x46 - 0x44 = 0x02)
          const originsOffsetInBlock = blockDOffset + 0x02;
          const encryptedOrigins = workingBuffer.readUInt16LE(originsOffsetInBlock);
          const encryptedBall = (encryptedOrigins >> 11) & 0xF;
          console.log(`[Ball Update] File: ${filename}, Ball ID in encrypted Block D (offset ${originsOffsetInBlock}): ${encryptedBall}, Expected: ${ballValue}`);
          
          if (encryptedBall !== ballValue) {
            // Update the ball in the encrypted Block D
            const clearedEncryptedOrigins = encryptedOrigins & ~(0xF << 11);
            const newEncryptedOrigins = clearedEncryptedOrigins | (ballValue << 11);
            workingBuffer.writeUInt16LE(newEncryptedOrigins, originsOffsetInBlock);
            
            // Verify the update
            const verifyEncryptedOrigins = workingBuffer.readUInt16LE(originsOffsetInBlock);
            const verifyEncryptedBall = (verifyEncryptedOrigins >> 11) & 0xF;
            console.log(`[Ball Update] File: ${filename}, Verified Ball ID in encrypted Block D: ${verifyEncryptedBall}, Expected: ${ballValue}`);
            
            if (verifyEncryptedBall !== ballValue) {
              throw new Error(`Ball update in encrypted Block D failed: expected ${ballValue}, got ${verifyEncryptedBall}`);
            }
          }
        } else {
          console.warn(`[Ball Update] File: ${filename}, Could not find Block D after encryption (blockDOffset: ${blockDOffset}, buffer length: ${workingBuffer.length})`);
        }
      }
      
      updated = true;
      // Update buffer reference
      buffer = workingBuffer;
    } else if (lowerFilename.endsWith('.pk4') || lowerFilename.endsWith('.pk5')) {
      // PK4/PK5: Ball offset depends on format
      const isPKHeXExport = buffer.length === 236;
      const dataOffset = isPKHeXExport ? 0x20 : 0;
      
      // Determine if DPPt or HGSS (check file size or other indicators)
      // For simplicity, try both offsets
      let ballOffset = dataOffset + 0x83; // DPPt
      if (ballOffset >= buffer.length) {
        ballOffset = dataOffset + 0x86; // HGSS
      }
      
      if (ballOffset < buffer.length) {
        buffer[ballOffset] = newBall;
        updated = true;
      }
    } else if (lowerFilename.endsWith('.pk6') || lowerFilename.endsWith('.pk7')) {
      // PK6/PK7: Ball at 0xDC
      const isPKHeXExport = buffer.length === 260;
      const dataOffset = isPKHeXExport ? 0x20 : 0;
      const ballOffset = dataOffset + 0xDC;
      
      if (ballOffset < buffer.length) {
        buffer[ballOffset] = newBall;
        updated = true;
      }
    }
    
    if (!updated) {
      return res.status(400).json({ error: 'Could not update ball for this file format' });
    }
    
    // Write the file back
    fs.writeFileSync(filePath, buffer);
    
    // Restore original file timestamps (modification and access time)
    fs.utimesSync(filePath, originalAtime, originalMtime);
    
    // Note: birthtime (creation time) cannot be restored via fs.utimesSync
    // On Windows, the birthtime is preserved automatically when using fs.writeFileSync
    // On Unix systems, birthtime is typically immutable
    
    res.json({ success: true, message: 'Ball updated successfully' });
  } catch (error) {
    console.error(`Error updating ball for ${req.body.filename}:`, error);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: error.message || 'Unknown error occurred' });
  }
});

// Evolution chain mapping (Gen 1-3, simple forward evolution only)
// Maps species ID to its evolution (if it can evolve)
const EVOLUTION_CHAIN = {
  // Gen 1
  1: 2,    // Bulbasaur -> Ivysaur
  2: 3,    // Ivysaur -> Venusaur
  4: 5,    // Charmander -> Charmeleon
  5: 6,    // Charmeleon -> Charizard
  7: 8,    // Squirtle -> Wartortle
  8: 9,    // Wartortle -> Blastoise
  10: 11,  // Caterpie -> Metapod
  11: 12,  // Metapod -> Butterfree
  13: 14,  // Weedle -> Kakuna
  14: 15,  // Kakuna -> Beedrill
  16: 17,  // Pidgey -> Pidgeotto
  17: 18,  // Pidgeotto -> Pidgeot
  19: 20,  // Rattata -> Raticate
  21: 22,  // Spearow -> Fearow
  23: 24,  // Ekans -> Arbok
  25: 26,  // Pikachu -> Raichu
  27: 28,  // Sandshrew -> Sandslash
  29: 30,  // Nidoran♀ -> Nidorina
  30: 31,  // Nidorina -> Nidoqueen
  32: 33,  // Nidoran♂ -> Nidorino
  33: 34,  // Nidorino -> Nidoking
  35: 36,  // Clefairy -> Clefable
  37: 38,  // Vulpix -> Ninetales
  39: 40,  // Jigglypuff -> Wigglytuff
  41: 42,  // Zubat -> Golbat
  43: 44,  // Oddish -> Gloom
  44: 45,  // Gloom -> Vileplume
  46: 47,  // Paras -> Parasect
  48: 49,  // Venonat -> Venomoth
  50: 51,  // Diglett -> Dugtrio
  52: 53,  // Meowth -> Persian
  54: 55,  // Psyduck -> Golduck
  56: 57,  // Mankey -> Primeape
  58: 59,  // Growlithe -> Arcanine
  60: 61,  // Poliwag -> Poliwhirl
  61: 62,  // Poliwhirl -> Poliwrath
  63: 64,  // Abra -> Kadabra
  64: 65,  // Kadabra -> Alakazam
  66: 67,  // Machop -> Machoke
  67: 68,  // Machoke -> Machamp
  69: 70,  // Bellsprout -> Weepinbell
  70: 71,  // Weepinbell -> Victreebel
  72: 73,  // Tentacool -> Tentacruel
  74: 75,  // Geodude -> Graveler
  75: 76,  // Graveler -> Golem
  77: 78,  // Ponyta -> Rapidash
  79: 80,  // Slowpoke -> Slowbro
  81: 82,  // Magnemite -> Magneton
  84: 85,  // Doduo -> Dodrio
  86: 87,  // Seel -> Dewgong
  88: 89,  // Grimer -> Muk
  90: 91,  // Shellder -> Cloyster
  92: 93,  // Gastly -> Haunter
  93: 94,  // Haunter -> Gengar
  96: 97,  // Drowzee -> Hypno
  98: 99,  // Krabby -> Kingler
  100: 101, // Voltorb -> Electrode
  102: 103, // Exeggcute -> Exeggutor
  104: 105, // Cubone -> Marowak
  109: 110, // Koffing -> Weezing
  111: 112, // Rhyhorn -> Rhydon
  116: 117, // Horsea -> Seadra
  118: 119, // Goldeen -> Seaking
  120: 121, // Staryu -> Starmie
  129: 130, // Magikarp -> Gyarados
  133: 134, // Eevee -> Vaporeon (and others, but we'll use first evolution)
  134: 135, // Vaporeon (no further evolution)
  136: 137, // Jolteon (no further evolution)
  137: 138, // Flareon (no further evolution)
  138: 139, // Porygon -> Porygon2
  140: 141, // Omanyte -> Omastar
  147: 148, // Dratini -> Dragonair
  148: 149, // Dragonair -> Dragonite
  
  // Gen 2
  152: 153, // Chikorita -> Bayleef
  153: 154, // Bayleef -> Meganium
  155: 156, // Cyndaquil -> Quilava
  156: 157, // Quilava -> Typhlosion
  158: 159, // Totodile -> Croconaw
  159: 160, // Croconaw -> Feraligatr
  161: 162, // Sentret -> Furret
  163: 164, // Hoothoot -> Noctowl
  165: 166, // Ledyba -> Ledian
  167: 168, // Spinarak -> Ariados
  170: 171, // Chinchou -> Lanturn
  172: 173, // Pichu -> Pikachu
  173: 174, // Cleffa -> Clefairy
  174: 175, // Igglybuff -> Jigglypuff
  175: 176, // Togepi -> Togetic
  177: 178, // Natu -> Xatu
  179: 180, // Mareep -> Flaaffy
  180: 181, // Flaaffy -> Ampharos
  183: 184, // Marill -> Azumarill
  187: 188, // Hoppip -> Skiploom
  188: 189, // Skiploom -> Jumpluff
  190: 191, // Aipom -> Ambipom (Gen 4, but included for completeness)
  193: 194, // Yanma -> Yanmega (Gen 4)
  194: 195, // Wooper -> Quagsire
  198: 199, // Murkrow -> Honchkrow (Gen 4)
  200: 201, // Misdreavus -> Mismagius (Gen 4)
  204: 205, // Pineco -> Forretress
  206: 207, // Dunsparce -> Dudunsparce (Gen 9, but included)
  207: 208, // Gligar -> Gliscor (Gen 4)
  209: 210, // Snubbull -> Granbull
  211: 212, // Qwilfish -> Overqwil (Gen 8)
  213: 214, // Shuckle (no evolution)
  215: 216, // Heracross (no evolution)
  216: 217, // Sneasel -> Weavile (Gen 4)
  218: 219, // Teddiursa -> Ursaring
  220: 221, // Slugma -> Magcargo
  223: 224, // Remoraid -> Octillery
  225: 226, // Houndour -> Houndoom
  228: 229, // Phanpy -> Donphan
  231: 232, // Tyrogue -> Hitmonlee/Hitmonchan/Hitmontop
  233: 234, // Larvitar -> Pupitar
  234: 235, // Pupitar -> Tyranitar
  236: 237, // Elekid -> Electabuzz
  238: 239, // Magby -> Magmar
  239: 240, // Miltank (no evolution)
  240: 241, // Blissey (no evolution)
  
  // Gen 3
  252: 253, // Treecko -> Grovyle
  253: 254, // Grovyle -> Sceptile
  255: 256, // Torchic -> Combusken
  256: 257, // Combusken -> Blaziken
  258: 259, // Mudkip -> Marshtomp
  259: 260, // Marshtomp -> Swampert
  261: 262, // Poochyena -> Mightyena
  263: 264, // Zigzagoon -> Linoone
  265: 266, // Wurmple -> Silcoon/Cascoon
  266: 267, // Silcoon -> Beautifly
  267: 268, // Cascoon -> Dustox
  269: 270, // Lotad -> Lombre
  270: 271, // Lombre -> Ludicolo
  273: 274, // Seedot -> Nuzleaf
  274: 275, // Nuzleaf -> Shiftry
  276: 277, // Taillow -> Swellow
  278: 279, // Wingull -> Pelipper
  280: 281, // Ralts -> Kirlia
  281: 282, // Kirlia -> Gardevoir
  283: 284, // Surskit -> Masquerain
  285: 286, // Shroomish -> Breloom
  287: 288, // Slakoth -> Vigoroth
  288: 289, // Vigoroth -> Slaking
  290: 291, // Nincada -> Ninjask/Shedinja
  291: 292, // Ninjask (no further evolution)
  293: 294, // Whismur -> Loudred
  294: 295, // Loudred -> Exploud
  296: 297, // Makuhita -> Hariyama
  298: 299, // Azurill -> Marill
  299: 300, // Nosepass -> Probopass (Gen 4)
  300: 301, // Skitty -> Delcatty
  301: 302, // Sableye (no evolution)
  302: 303, // Mawile (no evolution)
  304: 305, // Aron -> Lairon
  305: 306, // Lairon -> Aggron
  307: 308, // Meditite -> Medicham
  309: 310, // Electrike -> Manectric
  310: 311, // Plusle (no evolution)
  311: 312, // Minun (no evolution)
  312: 313, // Volbeat (no evolution)
  313: 314, // Illumise (no evolution)
  314: 315, // Roselia -> Roserade (Gen 4)
  315: 316, // Gulpin -> Swalot
  316: 317, // Carvanha -> Sharpedo
  317: 318, // Wailmer -> Wailord
  318: 319, // Numel -> Camerupt
  319: 320, // Torkoal (no evolution)
  320: 321, // Spoink -> Grumpig
  321: 322, // Spinda (no evolution)
  322: 323, // Trapinch -> Vibrava
  323: 324, // Vibrava -> Flygon
  324: 325, // Cacnea -> Cacturne
  325: 326, // Swablu -> Altaria
  326: 327, // Zangoose (no evolution)
  327: 328, // Seviper (no evolution)
  328: 329, // Lunatone (no evolution)
  329: 330, // Solrock (no evolution)
  331: 332, // Barboach -> Whiscash
  332: 333, // Corphish -> Crawdaunt
  333: 334, // Baltoy -> Claydol
  334: 335, // Lileep -> Cradily
  335: 336, // Anorith -> Armaldo
  336: 337, // Feebas -> Milotic
  337: 338, // Castform (no evolution)
  338: 339, // Kecleon (no evolution)
  339: 340, // Shuppet -> Banette
  340: 341, // Duskull -> Dusclops
  341: 342, // Dusclops -> Dusknoir (Gen 4)
  342: 343, // Tropius (no evolution)
  343: 344, // Chimecho (no evolution)
  344: 345, // Absol (no evolution)
  345: 346, // Wynaut -> Wobbuffet
  346: 347, // Snorunt -> Glalie
  347: 348, // Spheal -> Sealeo
  348: 349, // Sealeo -> Walrein
  349: 350, // Clamperl -> Huntail/Gorebyss
  350: 351, // Relicanth (no evolution)
  351: 352, // Luvdisc (no evolution)
  352: 353, // Bagon -> Shelgon
  353: 354, // Shelgon -> Salamence
  354: 355, // Beldum -> Metang
  355: 356, // Metang -> Metagross
  356: 357, // Regirock (no evolution)
  357: 358, // Regice (no evolution)
  358: 359, // Registeel (no evolution)
  359: 360, // Latias (no evolution)
  360: 361, // Latios (no evolution)
  361: 362, // Kyogre (no evolution)
  362: 363, // Groudon (no evolution)
  363: 364, // Rayquaza (no evolution)
  364: 365, // Jirachi (no evolution)
  365: 366, // Deoxys (no evolution)
  366: 367, // Turtwig -> Grotle (Gen 4)
  367: 368, // Grotle -> Torterra (Gen 4)
  368: 369, // Chimchar -> Monferno (Gen 4)
  369: 370, // Monferno -> Infernape (Gen 4)
  370: 371, // Piplup -> Prinplup (Gen 4)
  371: 372, // Prinplup -> Empoleon (Gen 4)
  372: 373, // Starly -> Staravia (Gen 4)
  373: 374, // Staravia -> Staraptor (Gen 4)
  374: 375, // Bidoof -> Bibarel (Gen 4)
  375: 376, // Kricketot -> Kricketune (Gen 4)
  376: 377, // Shinx -> Luxio (Gen 4)
  377: 378, // Luxio -> Luxray (Gen 4)
  378: 379, // Budew -> Roselia (Gen 4)
  379: 380, // Roserade (Gen 4, no further evolution)
  380: 381, // Cranidos -> Rampardos (Gen 4)
  381: 382, // Shieldon -> Bastiodon (Gen 4)
  382: 383, // Burmy -> Wormadam/Mothim (Gen 4)
  383: 384, // Combee -> Vespiquen (Gen 4)
  384: 385, // Pachirisu (Gen 4, no evolution)
  385: 386, // Buizel -> Floatzel (Gen 4)
  386: 387, // Cherubi -> Cherrim (Gen 4)
  387: 388, // Shellos -> Gastrodon (Gen 4)
  388: 389, // Ambipom (Gen 4, no further evolution)
  389: 390, // Drifloon -> Drifblim (Gen 4)
  390: 391, // Buneary -> Lopunny (Gen 4)
  391: 392, // Mismagius (Gen 4, no further evolution)
  392: 393, // Honchkrow (Gen 4, no further evolution)
  393: 394, // Glameow -> Purugly (Gen 4)
  394: 395, // Chingling -> Chimecho (Gen 4)
  395: 396, // Stunky -> Skuntank (Gen 4)
  396: 397, // Bronzor -> Bronzong (Gen 4)
  397: 398, // Bonsly -> Sudowoodo (Gen 4)
  398: 399, // Mime Jr. -> Mr. Mime (Gen 4)
  399: 400, // Happiny -> Chansey (Gen 4)
  400: 401, // Chatot (Gen 4, no evolution)
  401: 402, // Spiritomb (Gen 4, no evolution)
  402: 403, // Gible -> Gabite (Gen 4)
  403: 404, // Gabite -> Garchomp (Gen 4)
  404: 405, // Munchlax -> Snorlax (Gen 4)
  405: 406, // Riolu -> Lucario (Gen 4)
  406: 407, // Hippopotas -> Hippowdon (Gen 4)
  407: 408, // Skorupi -> Drapion (Gen 4)
  408: 409, // Croagunk -> Toxicroak (Gen 4)
  409: 410, // Carnivine (Gen 4, no evolution)
  410: 411, // Finneon -> Lumineon (Gen 4)
  411: 412, // Mantyke -> Mantine (Gen 4)
  412: 413, // Snover -> Abomasnow (Gen 4)
  413: 414, // Weavile (Gen 4, no further evolution)
  414: 415, // Magnezone (Gen 4, no further evolution)
  415: 416, // Lickilicky (Gen 4, no further evolution)
  416: 417, // Rhyperior (Gen 4, no further evolution)
  417: 418, // Tangrowth (Gen 4, no further evolution)
  418: 419, // Electivire (Gen 4, no further evolution)
  419: 420, // Magmortar (Gen 4, no further evolution)
  420: 421, // Togekiss (Gen 4, no further evolution)
  421: 422, // Yanmega (Gen 4, no further evolution)
  422: 423, // Leafeon (Gen 4, no further evolution)
  423: 424, // Glaceon (Gen 4, no further evolution)
  424: 425, // Gliscor (Gen 4, no further evolution)
  425: 426, // Mamoswine (Gen 4, no further evolution)
  426: 427, // Porygon-Z (Gen 4, no further evolution)
  427: 428, // Gallade (Gen 4, no further evolution)
  428: 429, // Probopass (Gen 4, no further evolution)
  429: 430, // Dusknoir (Gen 4, no further evolution)
  430: 431, // Froslass (Gen 4, no further evolution)
  431: 432, // Rotom (Gen 4, no evolution)
  432: 433, // Uxie (Gen 4, no evolution)
  433: 434, // Mesprit (Gen 4, no evolution)
  434: 435, // Azelf (Gen 4, no evolution)
  435: 436, // Dialga (Gen 4, no evolution)
  436: 437, // Palkia (Gen 4, no evolution)
  437: 438, // Heatran (Gen 4, no evolution)
  438: 439, // Regigigas (Gen 4, no evolution)
  439: 440, // Giratina (Gen 4, no evolution)
  440: 441, // Cresselia (Gen 4, no evolution)
  441: 442, // Phione (Gen 4, no evolution)
  442: 443, // Manaphy (Gen 4, no evolution)
  443: 444, // Darkrai (Gen 4, no evolution)
  444: 445, // Shaymin (Gen 4, no evolution)
  445: 446, // Arceus (Gen 4, no evolution)
};

// Helper function to get evolution for a species
function getEvolution(speciesId) {
  return EVOLUTION_CHAIN[speciesId] || null;
}

// API endpoint to evolve a single Pokemon
app.post('/api/pokemon/evolve', express.json(), (req, res) => {
  try {
    const { filename, db } = req.body;
    
    if (!filename) {
      return res.status(400).json({ error: 'Missing filename' });
    }
    
    const dbId = db || 'db1';
    const folderPath = getFolderPath(dbId);
    
    if (!folderPath) {
      return res.status(404).json({ error: 'Database not found' });
    }
    
    const filePath = path.join(folderPath, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Preserve file timestamps
    const stats = fs.statSync(filePath);
    const originalMtime = stats.mtime;
    const originalAtime = stats.atime;
    const originalBirthtime = stats.birthtime;
    
    // Read and parse the file
    let buffer = fs.readFileSync(filePath);
    const lowerFilename = filename.toLowerCase();
    
    let pokemon;
    if (lowerFilename.endsWith('.pk3')) {
      pokemon = PK3Parser.parse(buffer, filename);
    } else if (lowerFilename.endsWith('.pk4') || lowerFilename.endsWith('.pk5')) {
      pokemon = PK4Parser.parse(buffer, filename);
    } else if (lowerFilename.endsWith('.pk6')) {
      pokemon = PK6Parser.parse(buffer, filename);
    } else if (lowerFilename.endsWith('.pk7')) {
      pokemon = PK7Parser.parse(buffer, filename);
    } else {
      return res.status(400).json({ error: 'Unsupported file format' });
    }
    
    if (pokemon.error || !pokemon.species) {
      return res.status(400).json({ error: `Invalid Pokemon file: ${pokemon.error || 'missing species'}` });
    }
    
    // Check if Pokemon can evolve
    const evolvedSpecies = getEvolution(pokemon.species);
    if (!evolvedSpecies) {
      return res.status(400).json({ error: `Pokemon #${pokemon.species} cannot evolve further` });
    }
    
    // Update species in buffer
    const format = lowerFilename.endsWith('.pk3') ? 'pk3' : 
                   lowerFilename.endsWith('.pk4') || lowerFilename.endsWith('.pk5') ? 'pk4' :
                   lowerFilename.endsWith('.pk6') ? 'pk6' : 'pk7';
    
    // Determine data offset and species offset
    let dataOffset = 0;
    let speciesOffset = 0;
    let needsEncryption = false;
    
    if (format === 'pk3') {
      // PK3: Check if PKHeX export (100 bytes) or raw (80 bytes)
      // PKHeX exports have species at 0x20 in header (already decrypted, National Dex format)
      // Encrypted files have species at dataOffset + 0x20 after decryption (internal ID format)
      const isPKHeXExport = buffer.length === 100 && buffer.readUInt16LE(0x20) >= 1 && buffer.readUInt16LE(0x20) <= 386;
      dataOffset = isPKHeXExport ? 0x20 : 0x00;
      
      let workingBuffer = Buffer.from(buffer);
      let isEncrypted = false;
      
      if (!isPKHeXExport) {
        // For non-PKHeX exports, check if encrypted
        const pidAtOffset = workingBuffer.readUInt32LE(dataOffset + 0x00);
        if (pidAtOffset === 0 || pidAtOffset > 0xFFFFFFFF) {
          // PID is invalid, try to decrypt
          try {
            const testDecrypted = PK3Parser.decryptPK3(workingBuffer, dataOffset);
            const testPid = testDecrypted.readUInt32LE(dataOffset + 0x00);
            if (testPid !== 0 && testPid <= 0xFFFFFFFF) {
              isEncrypted = true;
              workingBuffer = testDecrypted;
            }
          } catch (e) {
            // Decryption failed, assume already decrypted
          }
        } else {
          // Check if species is valid (if not, might be encrypted)
          const speciesAt20 = workingBuffer.readUInt16LE(dataOffset + 0x20);
          if (speciesAt20 === 0 || speciesAt20 > 386) {
            try {
              const testDecrypted = PK3Parser.decryptPK3(workingBuffer, dataOffset);
              const testSpecies = testDecrypted.readUInt16LE(dataOffset + 0x20);
              if (testSpecies >= 1 && testSpecies <= 386) {
                isEncrypted = true;
                workingBuffer = testDecrypted;
              }
            } catch (e) {
              // Decryption failed
            }
          }
        }
      }
      
      // Determine what species ID to write
      let speciesToWrite = evolvedSpecies;
      if (!isPKHeXExport) {
        // For encrypted/raw files: convert National Dex to internal ID for Gen 3 Pokemon
        if (evolvedSpecies >= 252 && evolvedSpecies <= 386) {
          speciesToWrite = convertNationalToInternal3(evolvedSpecies);
        }
      }
      // For PKHeX exports: write National Dex ID directly (PKHeX stores National Dex)
      
      // Species offset depends on file format:
      // - PKHeX export: species is at absolute offset 0x20 (in header)
      // - Encrypted/raw: species is at dataOffset + 0x20 (Block A after decryption)
      if (isPKHeXExport) {
        speciesOffset = 0x20; // Absolute offset in PKHeX export header
      } else {
        speciesOffset = dataOffset + 0x20; // Block A offset after decryption
      }
      
      // Write species to buffer
      if (speciesOffset + 2 > workingBuffer.length) {
        return res.status(400).json({ error: 'Invalid file structure: species offset out of bounds' });
      }
      
      const oldSpeciesValue = workingBuffer.readUInt16LE(speciesOffset);
      workingBuffer.writeUInt16LE(speciesToWrite, speciesOffset);
      const newSpeciesValue = workingBuffer.readUInt16LE(speciesOffset);
      
      console.log(`[Evolve] ${filename}: isPKHeXExport=${isPKHeXExport}, isEncrypted=${isEncrypted}, dataOffset=0x${dataOffset.toString(16)}, speciesOffset=0x${speciesOffset.toString(16)}`);
      console.log(`[Evolve] Old species at offset: ${oldSpeciesValue}, Writing: ${speciesToWrite}, New species at offset: ${newSpeciesValue}`);
      
      // If file was encrypted, re-encrypt it using SAV3Parser's proven method
      if (isEncrypted) {
        const pokemonData = workingBuffer.slice(dataOffset, dataOffset + 80);
        
        // Use SAV3Parser's encryptPKM method which properly handles checksums
        // Create a minimal SAV3Parser instance just to use its encryptPKM method
        const dummySaveBuffer = Buffer.alloc(128 * 1024); // Allocate space for a save file
        const savParser = new SAV3Parser(dummySaveBuffer);
        const encrypted = savParser.encryptPKM(pokemonData);
        
        // Reconstruct buffer with encrypted data
        const result = Buffer.from(buffer);
        encrypted.copy(result, dataOffset, 0, 80);
        if (buffer.length > 80) {
          // Preserve party data if present
          buffer.copy(result, 80, 80, buffer.length);
        }
        buffer = result;
      } else {
        // For PKHeX exports, we also need to update checksum if it exists
        // PKHeX exports might have checksum at 0x1C in the header
        if (isPKHeXExport) {
          // Recalculate checksum for PKHeX export format
          // Checksum is sum of bytes 0x20-0x4F (data blocks)
          let checksum = 0;
          for (let i = 0x20; i < 0x50 && i + 2 <= workingBuffer.length; i += 2) {
            checksum += workingBuffer.readUInt16LE(i);
          }
          checksum = checksum & 0xFFFF;
          workingBuffer.writeUInt16LE(checksum, 0x1C);
        }
        buffer = workingBuffer;
      }
    } else if (format === 'pk4') {
      // PK4/PK5: Check for PKHeX export header
      const size = buffer.length;
      const maxSpecies = lowerFilename.endsWith('.pk5') ? 649 : 493;
      if (size > 136 && size <= 220) {
        // Check for header offsets
        if (buffer.readUInt16LE(0x24) >= 1 && buffer.readUInt16LE(0x24) <= maxSpecies) {
          dataOffset = 0x1C;
        } else if (buffer.readUInt16LE(0x28) >= 1 && buffer.readUInt16LE(0x28) <= maxSpecies) {
          dataOffset = 0x20;
        } else {
          dataOffset = 0x00;
        }
      } else {
        dataOffset = 0x00;
      }
      speciesOffset = dataOffset + 0x08;
    } else if (format === 'pk6' || format === 'pk7') {
      // PK6/PK7: Check for PKHeX export header
      const size = buffer.length;
      const maxSpecies = format === 'pk6' ? 721 : 807;
      if (size > 232) {
        // Check for header offsets
        if (buffer.readUInt16LE(0x24) >= 1 && buffer.readUInt16LE(0x24) <= maxSpecies) {
          dataOffset = 0x1C;
        } else if (buffer.readUInt16LE(0x28) >= 1 && buffer.readUInt16LE(0x28) <= maxSpecies) {
          dataOffset = 0x20;
        } else {
          dataOffset = 0x00;
        }
      } else {
        dataOffset = 0x00;
      }
      speciesOffset = dataOffset + 0x08;
    }
    
    // Write new species ID (little-endian, 16-bit)
    if (speciesOffset + 2 > buffer.length) {
      return res.status(400).json({ error: 'Invalid file structure: species offset out of bounds' });
    }
    
    buffer.writeUInt16LE(evolvedSpecies, speciesOffset);
    
    // Write back to file
    fs.writeFileSync(filePath, buffer);
    
      // Restore timestamps
      fs.utimesSync(filePath, originalAtime, originalMtime);
      if (originalBirthtime) {
        try {
          fs.utimesSync(filePath, originalAtime, originalBirthtime);
        } catch (e) {
          // Birthtime restoration may fail on some systems, ignore
        }
      }
      
      // Rename file to reflect new species
      // Filename format: "### ★ - SPECIESNAME - NATURE [IVSUM] - PID.pk3" or "### - SPECIESNAME - NATURE [IVSUM] - PID.pk3"
      let newFilename = filename;
      try {
        // Re-read and parse the file to get the new species name
        const updatedBuffer = fs.readFileSync(filePath);
        let evolvedPokemon;
        if (lowerFilename.endsWith('.pk3')) {
          evolvedPokemon = PK3Parser.parse(updatedBuffer, filename);
        } else if (lowerFilename.endsWith('.pk4') || lowerFilename.endsWith('.pk5')) {
          evolvedPokemon = PK4Parser.parse(updatedBuffer, filename);
        } else if (lowerFilename.endsWith('.pk6')) {
          evolvedPokemon = PK6Parser.parse(updatedBuffer, filename);
        } else if (lowerFilename.endsWith('.pk7')) {
          evolvedPokemon = PK7Parser.parse(updatedBuffer, filename);
        }
        
        // Get species name from lookup table (parser might return "Loading...")
        const newSpeciesName = getSpeciesName(evolvedSpecies);
        
        // Try to match the filename pattern
        const filenameMatch = filename.match(/^(\d+)(\s★)?\s-\s([^-]+)\s-\s([^-]+)\s\[(\d+)\]\s-\s([A-F0-9]+)\.(pk3|pk4|pk5|pk6|pk7)$/i);
        if (filenameMatch) {
          const [, oldSpeciesNum, shinyStar, oldSpeciesName, nature, ivSum, pid, ext] = filenameMatch;
          
          // Update with new species number and name
          const newSpeciesNum = String(evolvedSpecies).padStart(3, '0');
          newFilename = `${newSpeciesNum}${shinyStar || ''} - ${newSpeciesName} - ${nature} [${ivSum}] - ${pid}.${ext}`;
          
          // If the new filename is different, rename the file
          if (newFilename !== filename) {
            const newFilePath = path.join(folderPath, newFilename);
            // Check if target file already exists
            if (fs.existsSync(newFilePath)) {
              // Append a number to make it unique
              let counter = 1;
              let uniqueFilename = newFilename;
              const nameWithoutExt = newFilename.replace(/\.(pk3|pk4|pk5|pk6|pk7)$/i, '');
              const fileExt = newFilename.match(/\.(pk3|pk4|pk5|pk6|pk7)$/i)?.[1] || 'pk3';
              while (fs.existsSync(path.join(folderPath, uniqueFilename))) {
                uniqueFilename = `${nameWithoutExt}_${counter}.${fileExt}`;
                counter++;
              }
              newFilename = uniqueFilename;
            }
            
            fs.renameSync(filePath, path.join(folderPath, newFilename));
            console.log(`[Evolve] Renamed file: ${filename} -> ${newFilename}`);
          }
        } else {
          // Filename doesn't match expected format, try simpler pattern
          const simpleMatch = filename.match(/^(\d+)(\s★)?\s-\s([^-]+)\s-\s(.+)\.(pk3|pk4|pk5|pk6|pk7)$/i);
          if (simpleMatch) {
            const [, oldSpeciesNum, shinyStar, oldSpeciesName, rest, ext] = simpleMatch;
            const newSpeciesNum = String(evolvedSpecies).padStart(3, '0');
            newFilename = `${newSpeciesNum}${shinyStar || ''} - ${newSpeciesName} - ${rest}.${ext}`;
            
            if (newFilename !== filename) {
              const newFilePath = path.join(folderPath, newFilename);
              if (fs.existsSync(newFilePath)) {
                let counter = 1;
                let uniqueFilename = newFilename;
                const nameWithoutExt = newFilename.replace(/\.(pk3|pk4|pk5|pk6|pk7)$/i, '');
                const fileExt = newFilename.match(/\.(pk3|pk4|pk5|pk6|pk7)$/i)?.[1] || 'pk3';
                while (fs.existsSync(path.join(folderPath, uniqueFilename))) {
                  uniqueFilename = `${nameWithoutExt}_${counter}.${fileExt}`;
                  counter++;
                }
                newFilename = uniqueFilename;
              }
              
              fs.renameSync(filePath, path.join(folderPath, newFilename));
              console.log(`[Evolve] Renamed file: ${filename} -> ${newFilename}`);
            }
          }
        }
      } catch (renameError) {
        console.warn(`[Evolve] Failed to rename file ${filename}:`, renameError.message);
        // Continue even if rename fails - the evolution still succeeded
      }
      
      res.json({ 
        success: true, 
        filename: newFilename, // Return new filename
        oldFilename: filename,  // Return old filename for reference
        oldSpecies: pokemon.species,
        newSpecies: evolvedSpecies
      });
  } catch (error) {
    console.error('Error evolving Pokemon:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to batch evolve Pokemon
app.post('/api/pokemon/batch-evolve', express.json(), (req, res) => {
  try {
    const { filenames, db } = req.body;
    
    if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid filenames array' });
    }
    
    const dbId = db || 'db1';
    const folderPath = getFolderPath(dbId);
    
    if (!folderPath) {
      return res.status(404).json({ error: 'Database not found' });
    }
    
    const results = [];
    const errors = [];
    
    for (const filename of filenames) {
      try {
        const filePath = path.join(folderPath, filename);
        
        if (!fs.existsSync(filePath)) {
          errors.push({ filename, error: 'File not found' });
          continue;
        }
        
        // Preserve file timestamps
        const stats = fs.statSync(filePath);
        const originalMtime = stats.mtime;
        const originalAtime = stats.atime;
        const originalBirthtime = stats.birthtime;
        
        // Read and parse the file
        let buffer = fs.readFileSync(filePath);
        const lowerFilename = filename.toLowerCase();
        
        let pokemon;
        if (lowerFilename.endsWith('.pk3')) {
          pokemon = PK3Parser.parse(buffer, filename);
        } else if (lowerFilename.endsWith('.pk4') || lowerFilename.endsWith('.pk5')) {
          pokemon = PK4Parser.parse(buffer, filename);
        } else if (lowerFilename.endsWith('.pk6')) {
          pokemon = PK6Parser.parse(buffer, filename);
        } else if (lowerFilename.endsWith('.pk7')) {
          pokemon = PK7Parser.parse(buffer, filename);
        } else {
          errors.push({ filename, error: 'Unsupported file format' });
          continue;
        }
        
        if (pokemon.error || !pokemon.species) {
          errors.push({ filename, error: `Invalid Pokemon: ${pokemon.error || 'missing species'}` });
          continue;
        }
        
        // Check if Pokemon can evolve
        const evolvedSpecies = getEvolution(pokemon.species);
        if (!evolvedSpecies) {
          errors.push({ filename, error: `Cannot evolve further` });
          continue;
        }
        
        // Update species in buffer (same logic as single evolve)
        const format = lowerFilename.endsWith('.pk3') ? 'pk3' : 
                       lowerFilename.endsWith('.pk4') || lowerFilename.endsWith('.pk5') ? 'pk4' :
                       lowerFilename.endsWith('.pk6') ? 'pk6' : 'pk7';
        
        let dataOffset = 0;
        let speciesOffset = 0;
        
        if (format === 'pk3') {
          const isPKHeXExport = buffer.length === 100;
          dataOffset = isPKHeXExport ? 0x20 : 0x00;
          speciesOffset = dataOffset + 0x20;
        } else if (format === 'pk4') {
          const size = buffer.length;
          const maxSpecies = lowerFilename.endsWith('.pk5') ? 649 : 493;
          if (size > 136 && size <= 220) {
            if (buffer.readUInt16LE(0x24) >= 1 && buffer.readUInt16LE(0x24) <= maxSpecies) {
              dataOffset = 0x1C;
            } else if (buffer.readUInt16LE(0x28) >= 1 && buffer.readUInt16LE(0x28) <= maxSpecies) {
              dataOffset = 0x20;
            } else {
              dataOffset = 0x00;
            }
          } else {
            dataOffset = 0x00;
          }
          speciesOffset = dataOffset + 0x08;
        } else if (format === 'pk6' || format === 'pk7') {
          const size = buffer.length;
          const maxSpecies = format === 'pk6' ? 721 : 807;
          if (size > 232) {
            if (buffer.readUInt16LE(0x24) >= 1 && buffer.readUInt16LE(0x24) <= maxSpecies) {
              dataOffset = 0x1C;
            } else if (buffer.readUInt16LE(0x28) >= 1 && buffer.readUInt16LE(0x28) <= maxSpecies) {
              dataOffset = 0x20;
            } else {
              dataOffset = 0x00;
            }
          } else {
            dataOffset = 0x00;
          }
          speciesOffset = dataOffset + 0x08;
        }
        
        if (speciesOffset + 2 > buffer.length) {
          errors.push({ filename, error: 'Invalid file structure' });
          continue;
        }
        
        buffer.writeUInt16LE(evolvedSpecies, speciesOffset);
        
        // Write back to file
        fs.writeFileSync(filePath, buffer);
        
        // Restore timestamps
        fs.utimesSync(filePath, originalAtime, originalMtime);
        if (originalBirthtime) {
          try {
            fs.utimesSync(filePath, originalAtime, originalBirthtime);
          } catch (e) {
            // Ignore
          }
        }
        
        results.push({
          filename,
          oldSpecies: pokemon.species,
          newSpecies: evolvedSpecies
        });
      } catch (error) {
        errors.push({ filename, error: error.message });
      }
    }
    
    res.json({
      success: true,
      evolved: results.length,
      failed: errors.length,
      results,
      errors
    });
  } catch (error) {
    console.error('Error batch evolving Pokemon:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get evolution suggestions (top 3 IV sum per species)
app.get('/api/pokemon/evolution-suggestions', (req, res) => {
  try {
    const dbId = req.query.db || req.query.folder || 'db1';
    console.log(`[Evolution Suggestions] Request for dbId: ${dbId}`);
    
    const folderPath = getFolderPath(dbId);
    console.log(`[Evolution Suggestions] Resolved folder path: ${folderPath}`);
    
    if (!folderPath) {
      console.error(`[Evolution Suggestions] Database "${dbId}" not found in PK3_DATABASES`);
      return res.status(404).json({ error: `Database "${dbId}" not found` });
    }
    
    if (!fs.existsSync(folderPath)) {
      console.error(`[Evolution Suggestions] Folder does not exist: ${folderPath}`);
      return res.status(404).json({ error: `Database folder does not exist: ${folderPath}` });
    }
    
    // Get all Pokemon files
    console.log(`[Evolution Suggestions] Searching for Pokemon files in: ${folderPath}`);
    const allFilePaths = findPokemonFilesRecursive(folderPath);
    console.log(`[Evolution Suggestions] Found ${allFilePaths.length} Pokemon files`);
    
    if (allFilePaths.length === 0) {
      console.log(`[Evolution Suggestions] No Pokemon files found, returning empty suggestions`);
      return res.json({ suggestions: {} });
    }
    
    const allPokemon = [];
    
    for (const filePath of allFilePaths) {
      try {
        // Check if file exists and is actually a file (not a directory)
        if (!fs.existsSync(filePath)) {
          console.warn(`[Evolution Suggestions] File not found: ${filePath}`);
          continue;
        }
        
        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
          console.warn(`[Evolution Suggestions] Path is not a file: ${filePath}`);
          continue;
        }
        
        let buffer;
        try {
          buffer = fs.readFileSync(filePath);
        } catch (readErr) {
          console.warn(`[Evolution Suggestions] Error reading file ${filePath}:`, readErr.message);
          continue;
        }
        
        if (!buffer || buffer.length === 0) {
          console.warn(`[Evolution Suggestions] Empty file: ${filePath}`);
          continue;
        }
        
        const filename = path.basename(filePath);
        const lower = filename.toLowerCase();
        let pokemon;
        
        try {
          if (lower.endsWith('.pk3')) {
            pokemon = PK3Parser.parse(buffer, filename);
          } else if (lower.endsWith('.pk4') || lower.endsWith('.pk5')) {
            pokemon = PK4Parser.parse(buffer, filename);
          } else if (lower.endsWith('.pk6')) {
            pokemon = PK6Parser.parse(buffer, filename);
          } else if (lower.endsWith('.pk7')) {
            pokemon = PK7Parser.parse(buffer, filename);
          } else {
            continue;
          }
        } catch (parseErr) {
          console.warn(`[Evolution Suggestions] Error parsing ${filename}:`, parseErr.message);
          continue;
        }
        
        if (pokemon.error || !pokemon.species || !getEvolution(pokemon.species)) {
          continue;
        }
        
        allPokemon.push({
          ...pokemon,
          filename,
          filepath: filePath
        });
      } catch (err) {
        // Skip invalid files
        console.warn(`[Evolution Suggestions] Unexpected error processing ${filePath}:`, err.message);
        continue;
      }
    }
    
    // Group by species and get top 3 by IV sum
    const speciesMap = new Map();
    
    for (const pokemon of allPokemon) {
      const speciesId = pokemon.species;
      if (!speciesMap.has(speciesId)) {
        speciesMap.set(speciesId, []);
      }
      speciesMap.get(speciesId).push(pokemon);
    }
    
    // Sort each species by IV sum (descending), then level (descending), then take top 3
    const suggestions = {};
    
    for (const [speciesId, pokemonList] of speciesMap.entries()) {
      pokemonList.sort((a, b) => {
        const ivSumA = a.ivSum || 0;
        const ivSumB = b.ivSum || 0;
        if (ivSumB !== ivSumA) {
          return ivSumB - ivSumA;
        }
        const levelA = a.level || 0;
        const levelB = b.level || 0;
        return levelB - levelA;
      });
      
      suggestions[speciesId] = pokemonList.slice(0, 3).map(p => ({
        filename: p.filename,
        species: p.species,
        speciesName: p.speciesName,
        level: p.level || 0,
        ivSum: p.ivSum || 0,
        isShiny: p.isShiny || false
      }));
    }
    
    console.log(`[Evolution Suggestions] Returning ${Object.keys(suggestions).length} species with suggestions`);
    res.json({ suggestions });
  } catch (error) {
    console.error('[Evolution Suggestions] Error getting evolution suggestions:', error);
    console.error('[Evolution Suggestions] Error type:', error.constructor.name);
    console.error('[Evolution Suggestions] Error code:', error.code);
    console.error('[Evolution Suggestions] Error path:', error.path);
    console.error('[Evolution Suggestions] Error syscall:', error.syscall);
    console.error('[Evolution Suggestions] Stack:', error.stack);
    
    // Provide more detailed error message
    let errorMessage = 'Unknown error occurred';
    if (error.code === 'ENOENT') {
      if (error.path) {
        errorMessage = `File or folder not found: ${error.path}`;
      } else {
        errorMessage = 'File or folder not found';
      }
    } else if (error.code === 'EACCES') {
      errorMessage = `Permission denied: ${error.path || 'unknown path'}`;
    } else if (error.code === 'ENOTDIR') {
      errorMessage = `Not a directory: ${error.path || 'unknown path'}`;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    console.error(`[Evolution Suggestions] Returning error to client: ${errorMessage}`);
    res.status(500).json({ error: errorMessage });
  }
});

// API endpoint to fix invalid moves in a Pokemon file
app.post('/api/pokemon/fix-moves', express.json(), (req, res) => {
  try {
    // Ensure we always return JSON, even on errors
    res.setHeader('Content-Type', 'application/json');
    
    const { filename, db } = req.body;
    
    if (!filename) {
      return res.status(400).json({ error: 'Missing filename' });
    }
    
    const dbId = db || 'db1';
    const folderPath = getFolderPath(dbId);
    
    if (!folderPath) {
      return res.status(404).json({ error: 'Database not found' });
    }
    
    const filePath = path.join(folderPath, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Preserve file timestamps
    const stats = fs.statSync(filePath);
    const originalMtime = stats.mtime;
    const originalAtime = stats.atime;
    const originalBirthtime = stats.birthtime;
    
    // Read the file
    let buffer = fs.readFileSync(filePath);
    
    // Determine format and fix moves
    const lowerFilename = filename.toLowerCase();
    let updated = false;
    
    if (lowerFilename.endsWith('.pk3')) {
      // PK3: Moves are at offsets 0x2C, 0x2E, 0x30, 0x32 (Block B)
      // Tackle is move ID 33, empty moves are 0
      const TACKLE_MOVE_ID = 33;
      const EMPTY_MOVE_ID = 0;
      
      // Determine format
      let isPKHeXExport = false;
      let dataOffset = 0;
      
      if (buffer.length === 100) {
        const speciesAt20 = buffer.readUInt16LE(0x20);
        isPKHeXExport = (speciesAt20 >= 1 && speciesAt20 <= 386);
        dataOffset = isPKHeXExport ? 0x20 : 0;
      } else if (buffer.length === 80) {
        isPKHeXExport = false;
        dataOffset = 0;
      } else {
        throw new Error(`Invalid PK3 file size: ${buffer.length} bytes (expected 80 or 100)`);
      }
      
      console.log(`[Fix Moves] File: ${filename}, Size: ${buffer.length}, PKHeX Export: ${isPKHeXExport}, Data Offset: ${dataOffset}`);
      
      // Check if encrypted
      // For corrupted files, the encryption check might fail, so we'll try to decrypt anyway if not PKHeX
      let needsDecryption = false;
      if (!isPKHeXExport) {
        try {
          needsDecryption = PK3Parser.checkIfEncrypted(buffer, dataOffset);
          console.log(`[Fix Moves] File: ${filename}, Encryption check: ${needsDecryption}`);
        } catch (checkError) {
          console.warn(`[Fix Moves] File: ${filename}, Encryption check failed, assuming encrypted:`, checkError.message);
          // For corrupted files, assume encrypted and try to decrypt
          needsDecryption = true;
        }
      }
      
      let workingBuffer = Buffer.from(buffer);
      
      if (needsDecryption) {
        try {
          console.log(`[Fix Moves] File: ${filename}, Attempting decryption...`);
          // For PKHeX exports (dataOffset = 0x20), we need to extract the 80-byte stored data first
          // For raw 80-byte files (dataOffset = 0), we can decrypt directly
          if (dataOffset > 0) {
            // Extract the 80-byte stored data from the PKHeX export format
            const storedData = buffer.slice(dataOffset, dataOffset + 80);
            const decrypted = PK3Parser.decryptPK3(storedData, 0);
            // Reconstruct the working buffer with decrypted data at the correct offset
            workingBuffer = Buffer.from(buffer);
            decrypted.copy(workingBuffer, dataOffset, 0, 80);
          } else {
            // Raw 80-byte or 100-byte file, decrypt in place
            workingBuffer = PK3Parser.decryptPK3(workingBuffer, 0);
          }
          console.log(`[Fix Moves] File: ${filename}, Decryption successful`);
          
          // Verify decryption worked by checking PID
          const pid = workingBuffer.readUInt32LE(dataOffset + 0x00);
          if (pid === 0) {
            throw new Error('Decryption failed: PID is zero after decryption');
          }
          console.log(`[Fix Moves] File: ${filename}, Decrypted PID: ${pid}`);
        } catch (decryptError) {
          console.error(`[Fix Moves] File: ${filename}, Decryption error:`, decryptError.message);
          throw new Error(`Failed to decrypt PK3 file: ${decryptError.message}`);
        }
      }
      
      // Read current moves before fixing (for logging)
      const move1Offset = dataOffset + 0x2C;
      const move2Offset = dataOffset + 0x2E;
      const move3Offset = dataOffset + 0x30;
      const move4Offset = dataOffset + 0x32;
      
      if (move1Offset + 2 <= workingBuffer.length) {
        const oldMove1 = workingBuffer.readUInt16LE(move1Offset);
        const oldMove2 = workingBuffer.readUInt16LE(move2Offset);
        const oldMove3 = workingBuffer.readUInt16LE(move3Offset);
        const oldMove4 = workingBuffer.readUInt16LE(move4Offset);
        console.log(`[Fix Moves] File: ${filename}, Current moves: ${oldMove1}, ${oldMove2}, ${oldMove3}, ${oldMove4}`);
      }
      
      // Update moves: Move1 = Tackle (33), Move2-4 = Empty (0)
      // Moves are at offsets 0x2C, 0x2E, 0x30, 0x32 in decrypted data
      // Also update PP values: Tackle has base PP, empty moves have 0 PP
      const pp1Offset = dataOffset + 0x34;
      const pp2Offset = dataOffset + 0x35;
      const pp3Offset = dataOffset + 0x36;
      const pp4Offset = dataOffset + 0x37;
      
      // Tackle base PP is 35
      const TACKLE_BASE_PP = 35;
      
      if (move1Offset + 2 <= workingBuffer.length) {
        workingBuffer.writeUInt16LE(TACKLE_MOVE_ID, move1Offset);
        if (pp1Offset < workingBuffer.length) {
          workingBuffer[pp1Offset] = TACKLE_BASE_PP;
        }
        updated = true;
        console.log(`[Fix Moves] File: ${filename}, Set Move1 to Tackle (${TACKLE_MOVE_ID}) at offset ${move1Offset}`);
      } else {
        console.error(`[Fix Moves] File: ${filename}, Move1 offset ${move1Offset} out of bounds (buffer length: ${workingBuffer.length})`);
      }
      
      if (move2Offset + 2 <= workingBuffer.length) {
        workingBuffer.writeUInt16LE(EMPTY_MOVE_ID, move2Offset);
        if (pp2Offset < workingBuffer.length) {
          workingBuffer[pp2Offset] = 0;
        }
        updated = true;
      }
      
      if (move3Offset + 2 <= workingBuffer.length) {
        workingBuffer.writeUInt16LE(EMPTY_MOVE_ID, move3Offset);
        if (pp3Offset < workingBuffer.length) {
          workingBuffer[pp3Offset] = 0;
        }
        updated = true;
      }
      
      if (move4Offset + 2 <= workingBuffer.length) {
        workingBuffer.writeUInt16LE(EMPTY_MOVE_ID, move4Offset);
        if (pp4Offset < workingBuffer.length) {
          workingBuffer[pp4Offset] = 0;
        }
        updated = true;
      }
      
      // Verify moves were set correctly
      if (updated && move1Offset + 2 <= workingBuffer.length) {
        const verifyMove1 = workingBuffer.readUInt16LE(move1Offset);
        const verifyMove2 = workingBuffer.readUInt16LE(move2Offset);
        const verifyMove3 = workingBuffer.readUInt16LE(move3Offset);
        const verifyMove4 = workingBuffer.readUInt16LE(move4Offset);
        console.log(`[Fix Moves] File: ${filename}, Verified moves after update: ${verifyMove1}, ${verifyMove2}, ${verifyMove3}, ${verifyMove4}`);
        
        if (verifyMove1 !== TACKLE_MOVE_ID || verifyMove2 !== EMPTY_MOVE_ID || verifyMove3 !== EMPTY_MOVE_ID || verifyMove4 !== EMPTY_MOVE_ID) {
          throw new Error(`Moves were not set correctly: expected [${TACKLE_MOVE_ID}, ${EMPTY_MOVE_ID}, ${EMPTY_MOVE_ID}, ${EMPTY_MOVE_ID}], got [${verifyMove1}, ${verifyMove2}, ${verifyMove3}, ${verifyMove4}]`);
        }
      }
      
      // Re-encrypt if needed
      if (needsDecryption && updated) {
        console.log(`[Fix Moves] File: ${filename}, Re-encrypting...`);
        const storedData = Buffer.alloc(80);
        if (workingBuffer.length < 80) {
          throw new Error(`Invalid PK3 data: workingBuffer too short (${workingBuffer.length} bytes, expected at least 80)`);
        }
        workingBuffer.copy(storedData, 0, dataOffset, dataOffset + 80);
        
        const pid = storedData.readUInt32LE(0x00);
        const oid = storedData.readUInt32LE(0x04);
        
        if (pid === 0 || oid === 0) {
          throw new Error('Invalid PK3 data: PID or OID is zero, cannot encrypt');
        }
        
        console.log(`[Fix Moves] File: ${filename}, Encrypting with PID: ${pid}, OID: ${oid}`);
        
        const SAV3Parser = require('./parsers/sav3-parser');
        const tempSave = new SAV3Parser(Buffer.alloc(128 * 1024));
        const encrypted = tempSave.encryptPKM(storedData);
        
        // Verify moves are still correct after encryption (by decrypting and checking)
        const decryptedCheck = tempSave.decryptPKM(encrypted);
        if (decryptedCheck) {
          const checkMove1 = decryptedCheck.readUInt16LE(0x2C);
          const checkMove2 = decryptedCheck.readUInt16LE(0x2E);
          const checkMove3 = decryptedCheck.readUInt16LE(0x30);
          const checkMove4 = decryptedCheck.readUInt16LE(0x32);
          console.log(`[Fix Moves] File: ${filename}, Moves after encryption/decryption check: ${checkMove1}, ${checkMove2}, ${checkMove3}, ${checkMove4}`);
          
          if (checkMove1 !== TACKLE_MOVE_ID || checkMove2 !== EMPTY_MOVE_ID || checkMove3 !== EMPTY_MOVE_ID || checkMove4 !== EMPTY_MOVE_ID) {
            throw new Error(`Moves corrupted during encryption: expected [${TACKLE_MOVE_ID}, ${EMPTY_MOVE_ID}, ${EMPTY_MOVE_ID}, ${EMPTY_MOVE_ID}], got [${checkMove1}, ${checkMove2}, ${checkMove3}, ${checkMove4}]`);
          }
        }
        
        if (buffer.length === 100) {
          const result = Buffer.alloc(100);
          encrypted.copy(result, 0, 0, 80);
          // Preserve party data from workingBuffer (which may have been modified during decryption)
          // For 100-byte files, party data is at bytes 80-99
          if (workingBuffer.length >= 100) {
            workingBuffer.copy(result, 80, 80, 100);
          } else {
            // Fallback: use original buffer's party data if workingBuffer is shorter
            buffer.copy(result, 80, 80, 100);
          }
          workingBuffer = result;
        } else {
          workingBuffer = encrypted;
        }
        console.log(`[Fix Moves] File: ${filename}, Re-encryption successful`);
      }
      
      buffer = workingBuffer;
    } else if (lowerFilename.endsWith('.pk4') || lowerFilename.endsWith('.pk5')) {
      // PK4/PK5: Moves are at different offsets depending on format
      // For now, skip PK4/PK5 as they have different structures
      return res.status(400).json({ error: 'PK4/PK5 move fixing not yet implemented' });
    } else if (lowerFilename.endsWith('.pk6') || lowerFilename.endsWith('.pk7')) {
      // PK6/PK7: Moves are at 0x5A, 0x5C, 0x5E, 0x60
      const isPKHeXExport = buffer.length === 260;
      const dataOffset = isPKHeXExport ? 0x20 : 0;
      const TACKLE_MOVE_ID = 33;
      const EMPTY_MOVE_ID = 0;
      
      const move1Offset = dataOffset + 0x5A;
      const move2Offset = dataOffset + 0x5C;
      const move3Offset = dataOffset + 0x5E;
      const move4Offset = dataOffset + 0x60;
      
      if (move1Offset + 2 <= buffer.length) {
        buffer.writeUInt16LE(TACKLE_MOVE_ID, move1Offset);
        updated = true;
      }
      if (move2Offset + 2 <= buffer.length) {
        buffer.writeUInt16LE(EMPTY_MOVE_ID, move2Offset);
        updated = true;
      }
      if (move3Offset + 2 <= buffer.length) {
        buffer.writeUInt16LE(EMPTY_MOVE_ID, move3Offset);
        updated = true;
      }
      if (move4Offset + 2 <= buffer.length) {
        buffer.writeUInt16LE(EMPTY_MOVE_ID, move4Offset);
        updated = true;
      }
    }
    
    if (!updated) {
      return res.status(400).json({ error: 'Could not fix moves for this file format' });
    }
    
    // Write the file back
    console.log(`[Fix Moves] File: ${filename}, Writing ${buffer.length} bytes to disk...`);
    fs.writeFileSync(filePath, buffer);
    // Force sync to ensure data is written to disk
    const fd = fs.openSync(filePath, 'r+');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    console.log(`[Fix Moves] File: ${filename}, File written and synced to disk`);
    
    // Final verification: read the file back and verify moves are correct
    // This ensures the file was written correctly
    if (updated && lowerFilename.endsWith('.pk3')) {
      console.log(`[Fix Moves] File: ${filename}, Performing final verification...`);
      const verifyBuffer = fs.readFileSync(filePath);
      const TACKLE_MOVE_ID = 33;
      const EMPTY_MOVE_ID = 0;
      
      const verifyIsPKHeXExport = (verifyBuffer.length === 100 && verifyBuffer.readUInt16LE(0x20) >= 1 && verifyBuffer.readUInt16LE(0x20) <= 386);
      const verifyDataOffset = verifyIsPKHeXExport ? 0x20 : 0;
      const verifyNeedsDecryption = !verifyIsPKHeXExport && PK3Parser.checkIfEncrypted(verifyBuffer, verifyDataOffset);
      let verifyWorking = Buffer.from(verifyBuffer);
      
      if (verifyNeedsDecryption) {
        try {
          if (verifyDataOffset > 0) {
            const verifyStoredData = verifyBuffer.slice(verifyDataOffset, verifyDataOffset + 80);
            const verifyDecrypted = PK3Parser.decryptPK3(verifyStoredData, 0);
            verifyWorking = Buffer.from(verifyBuffer);
            verifyDecrypted.copy(verifyWorking, verifyDataOffset, 0, 80);
          } else {
            verifyWorking = PK3Parser.decryptPK3(verifyWorking, 0);
          }
        } catch (verifyError) {
          console.error(`[Fix Moves] File: ${filename}, Verification decryption failed:`, verifyError.message);
        }
      }
      
      const verifyMove1 = verifyWorking.readUInt16LE(verifyDataOffset + 0x2C);
      const verifyMove2 = verifyWorking.readUInt16LE(verifyDataOffset + 0x2E);
      const verifyMove3 = verifyWorking.readUInt16LE(verifyDataOffset + 0x30);
      const verifyMove4 = verifyWorking.readUInt16LE(verifyDataOffset + 0x32);
      
      console.log(`[Fix Moves] File: ${filename}, Final verification moves: ${verifyMove1}, ${verifyMove2}, ${verifyMove3}, ${verifyMove4}`);
      
      if (verifyMove1 !== TACKLE_MOVE_ID || verifyMove2 !== EMPTY_MOVE_ID || verifyMove3 !== EMPTY_MOVE_ID || verifyMove4 !== EMPTY_MOVE_ID) {
        const errorMsg = `Moves verification failed after write! Expected [${TACKLE_MOVE_ID}, ${EMPTY_MOVE_ID}, ${EMPTY_MOVE_ID}, ${EMPTY_MOVE_ID}], got [${verifyMove1}, ${verifyMove2}, ${verifyMove3}, ${verifyMove4}]`;
        console.error(`[Fix Moves] File: ${filename}, ${errorMsg}`);
        // Throw error to prevent returning success when moves are incorrect
        throw new Error(errorMsg);
      } else {
        console.log(`[Fix Moves] File: ${filename}, Final verification passed!`);
      }
    }
    
    // Restore original file timestamps
    fs.utimesSync(filePath, originalAtime, originalMtime);
    
    res.json({ success: true, message: 'Moves fixed successfully' });
  } catch (error) {
    console.error(`Error fixing moves for ${req.body?.filename || 'unknown'}:`, error);
    console.error('Stack:', error.stack);
    // Ensure we return JSON even on errors
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Unknown error occurred' });
    }
  }
});

// API endpoint to delete a .pk3 file
app.delete('/api/pokemon/:filename', (req, res) => {
  const dbId = req.query.db || req.query.folder;
  const folderPath = dbId ? getFolderPath(dbId) : DEFAULT_PK3_FOLDER;
  const filename = req.params.filename;
  
  // Security: Only allow Pokemon files to be deleted
  const lower = filename.toLowerCase();
  if (!lower.endsWith('.pk3') && !lower.endsWith('.pk4') && !lower.endsWith('.pk5') && !lower.endsWith('.pk6') && !lower.endsWith('.pk7')) {
    return res.status(400).json({ error: 'Invalid file type' });
  }
  
  // Security: Prevent directory traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  const filePath = path.join(folderPath, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    fs.unlinkSync(filePath);
    res.json({ success: true, message: `File ${filename} deleted successfully` });
  } catch (error) {
    console.error(`Error deleting file ${filename}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to download selected Pokemon files as a zip
app.post('/api/pokemon/download', express.json({ limit: '10mb' }), (req, res) => {
  try {
    const { filenames, db } = req.body;
    
    if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
      return res.status(400).json({ error: 'No filenames provided' });
    }
    
    const dbId = db || 'db1';
    const folderPath = getFolderPath(dbId);
    
    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Security: Validate all filenames
    for (const filename of filenames) {
      const lower = filename.toLowerCase();
      if (!lower.endsWith('.pk3') && !lower.endsWith('.pk4') && !lower.endsWith('.pk5') && !lower.endsWith('.pk6') && !lower.endsWith('.pk7')) {
        return res.status(400).json({ error: `Invalid file type: ${filename}` });
      }
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: `Invalid filename: ${filename}` });
      }
    }
    
    // Create zip archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });
    
    // Set response headers
    res.attachment(`selected-pokemon-${Date.now()}.zip`);
    archive.pipe(res);
    
    // Add each file to the archive
    let filesAdded = 0;
    for (const filename of filenames) {
      const filePath = path.join(folderPath, filename);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: filename });
        filesAdded++;
      }
    }
    
    if (filesAdded === 0) {
      archive.abort();
      return res.status(404).json({ error: 'No files found' });
    }
    
    // Finalize the archive
    archive.finalize();
    
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create archive' });
      }
    });
    
  } catch (error) {
    console.error('Error creating download:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// In-memory save file storage (for current session)
let currentSaveFile = null;
let currentSaveFileName = null;

// Error handler for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `File too large: ${err.message}. Maximum size is 256KB.` });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  next(err);
};

// API endpoint to upload/load a save file
app.post('/api/save/load', upload.single('savefile'), handleMulterError, (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const buffer = req.file.buffer;
    const filename = req.file.originalname || 'save.sav';
    
    // Validate save file size (Gen 3 saves are typically 128KB = 0x20000 bytes)
    // Some saves might be slightly larger, so check for minimum size
    if (buffer.length < 0x10000) { // At least 64KB
      return res.status(400).json({ error: `Invalid save file: too small (got ${buffer.length} bytes, expected at least 64KB)` });
    }
    
    // Parse save file
    const save = new SAV3Parser(buffer);
    const info = save.getInfo();
    
    // Store in memory
    currentSaveFile = save;
    currentSaveFileName = filename;
    
    res.json({
      success: true,
      info,
      message: 'Save file loaded successfully'
    });
  } catch (error) {
    console.error('Error loading save file:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get current save file info
app.get('/api/save/info', (req, res) => {
  if (!currentSaveFile) {
    return res.status(404).json({ error: 'No save file loaded' });
  }
  
  try {
    const info = currentSaveFile.getInfo();
    res.json({
      loaded: true,
      filename: currentSaveFileName,
      ...info
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to import a Pokemon into the save file
app.post('/api/save/import', express.json({ limit: '1mb' }), (req, res) => {
  if (!currentSaveFile) {
    return res.status(404).json({ error: 'No save file loaded' });
  }
  
  try {
    const { pokemonData, box, slot, isParty, startFromLastBox, filename } = req.body;
    
    // Only allow .pk3 files to be imported to save files
    if (filename) {
      const lowerFilename = filename.toLowerCase();
      if (!lowerFilename.endsWith('.pk3')) {
        return res.status(400).json({ error: `Only .pk3 files can be imported to save files. File "${filename}" is not a .pk3 file.` });
      }
    }
    
    if (!pokemonData || !Array.isArray(pokemonData)) {
      return res.status(400).json({ error: 'Invalid Pokemon data' });
    }
    
    // Convert array to Buffer
    const pokemonBuffer = Buffer.from(pokemonData);
    
    // Parse the ORIGINAL buffer first to get correct species and decrypted data
    // This handles encrypted files correctly - parser will decrypt if needed
    let correctSpecies = null;
    let decryptedStoredData = null;
    
    try {
      const parsed = PK3Parser.parse(pokemonBuffer, req.body.filename || null);
      if (parsed && parsed.species && parsed.species >= 1 && parsed.species <= 386) {
        correctSpecies = parsed.species; // This is National Dex ID
      }
      
      // Get the decrypted 80-byte stored format from the parser
      // The parser internally decrypts if needed, so we need to reconstruct the decrypted stored format
      // For PKHeX exports: data starts at 0x20, first 80 bytes are decrypted
      // For encrypted files: parser decrypts internally, we need to extract the decrypted 80 bytes
      
      // Determine if it's PKHeX export or encrypted
      let isPKHeXExport = false;
      if (pokemonBuffer.length === 100) {
        const speciesAt20 = pokemonBuffer.readUInt16LE(0x20);
        isPKHeXExport = (speciesAt20 >= 1 && speciesAt20 <= 386);
      }
      
      if (isPKHeXExport) {
        // PKHeX export: The stored format is the first 80 bytes (0x00-0x4F)
        // The header (0x00-0x1F) contains PID, TID, SID, OT name, etc.
        // The Pokemon data blocks start at 0x20 within the stored format
        // So we need the full 80 bytes starting at 0x00
        decryptedStoredData = Buffer.from(pokemonBuffer.slice(0, 80));
      } else {
        // Encrypted file: need to decrypt using PK3Parser's logic
        const needsDecryption = PK3Parser.checkIfEncrypted(pokemonBuffer, 0);
        if (needsDecryption) {
          const decrypted = PK3Parser.decryptPK3(pokemonBuffer, 0);
          // decryptPK3 returns the decrypted buffer (80 bytes for stored, 100 bytes for party)
          // Ensure we get exactly 80 bytes
          if (decrypted.length >= 80) {
            decryptedStoredData = Buffer.from(decrypted.slice(0, 80));
          } else {
            // If decryption returned less than 80 bytes, something went wrong
            throw new Error(`Decryption returned invalid size: ${decrypted.length} bytes (expected at least 80)`);
          }
        } else {
          // Already decrypted - take first 80 bytes
          decryptedStoredData = Buffer.from(pokemonBuffer.length === 100 ? pokemonBuffer.slice(0, 80) : pokemonBuffer);
        }
      }
    } catch (e) {
      // If parsing fails, try to extract from filename and use raw data
      console.warn('Failed to parse Pokemon:', e.message);
      if (req.body.filename) {
        const match = req.body.filename.match(/^(\d+)\s/);
        if (match) {
          const fileSpecies = parseInt(match[1]);
          if (fileSpecies >= 1 && fileSpecies <= 386) {
            correctSpecies = fileSpecies;
          }
        }
      }
      // Fallback: use raw data (might be encrypted, but we'll try)
      decryptedStoredData = pokemonBuffer.length === 100 ? pokemonBuffer.slice(0, 80) : pokemonBuffer;
    }
    
    // Validate decrypted stored data
    if (!decryptedStoredData || decryptedStoredData.length !== 80) {
      return res.status(400).json({ error: `Failed to extract valid stored Pokemon data (got ${decryptedStoredData ? decryptedStoredData.length : 0} bytes)` });
    }
    
    // Validate that we have valid Pokemon data (non-zero PID)
    const pid = decryptedStoredData.readUInt32LE(0);
    if (pid === 0) {
      return res.status(400).json({ error: 'Invalid Pokemon data: PID is zero' });
    }
    
    // Convert National Dex species ID to internal species ID
    // Save files store internal species ID at 0x20
    if (correctSpecies !== null && correctSpecies >= 1 && correctSpecies <= 386) {
      // Use the parsed species (National Dex ID) and convert to internal
      let internalSpecies = correctSpecies;
      if (correctSpecies >= 252 && correctSpecies <= 386) {
        // Gen 3 Pokemon: convert National Dex to internal ID
        internalSpecies = convertNationalToInternal3(correctSpecies);
        // Validate: internal IDs for Gen 3 should be >= 277 and <= 386
        if (internalSpecies < 277 || internalSpecies > 386) {
          // Conversion might have failed - check if original at 0x20 is already internal
          const originalAt20 = decryptedStoredData.readUInt16LE(0x20);
          if (originalAt20 >= 277 && originalAt20 <= 386) {
            // Original might already be correct internal ID
            internalSpecies = originalAt20;
          } else if (originalAt20 >= 1 && originalAt20 <= 386) {
            // Original is valid (might be Gen 1-2), keep it
            internalSpecies = originalAt20;
          } else {
            // Both conversion and original are invalid - reject this Pokemon
            console.error(`Cannot determine valid internal species ID for National Dex ${correctSpecies} (converted: ${internalSpecies}, original: ${originalAt20})`);
            return res.status(400).json({ error: `Invalid species ID: ${correctSpecies} cannot be converted to valid Gen 3 internal ID` });
          }
        }
      }
      // Gen 1-2 Pokemon (1-251): internal ID = National Dex ID, no conversion needed
      
      // Always write a valid species (never write 0 or >386)
      // Final validation: internalSpecies must be 1-386
      if (internalSpecies >= 1 && internalSpecies <= 386) {
        decryptedStoredData.writeUInt16LE(internalSpecies, 0x20);
        // Note: We don't recalculate checksum here on decrypted data
        // The encryptPKM function will recalculate it correctly on the encrypted data
        // after shuffling and XORing, which is what the game expects
      } else {
        // Invalid species ID - reject this Pokemon
        console.error(`Invalid internal species ID ${internalSpecies} for National Dex ${correctSpecies}`);
        return res.status(400).json({ error: `Invalid species ID: ${internalSpecies} is out of valid range (1-386)` });
      }
    } else {
      // Fallback: try to convert the existing species at 0x20
      const speciesAt20 = decryptedStoredData.readUInt16LE(0x20);
      if (speciesAt20 >= 1 && speciesAt20 <= 386) {
        if (speciesAt20 >= 252 && speciesAt20 < 277) {
          // This is a National Dex ID for Gen 3 Pokemon, convert to internal
          const internalSpecies = convertNationalToInternal3(speciesAt20);
          // Validate: internal IDs must be 1-386 (Gen 3 internal IDs are 277-386, but we allow 1-386 for safety)
          if (internalSpecies >= 1 && internalSpecies <= 386) {
            decryptedStoredData.writeUInt16LE(internalSpecies, 0x20);
            // Note: We don't recalculate checksum here on decrypted data
            // The encryptPKM function will recalculate it correctly on the encrypted data
            // after shuffling and XORing, which is what the game expects
          } else {
            // Invalid conversion result - keep original (might be wrong but better than invalid)
            console.warn(`Conversion failed for species ${speciesAt20}: got ${internalSpecies}, keeping original`);
          }
        }
        // If speciesAt20 >= 277, assume it's already an internal ID (don't convert)
      }
    }
    
    // Use the decrypted stored data for import (write() will encrypt it)
    const storedData = decryptedStoredData;
    
    // Validate storedData before writing
    if (!storedData || storedData.length !== 80) {
      return res.status(400).json({ error: `Invalid stored data: expected 80 bytes, got ${storedData ? storedData.length : 0}` });
    }
    
    // Verify PID is still valid after all processing
    const finalPid = storedData.readUInt32LE(0);
    if (finalPid === 0) {
      return res.status(400).json({ error: 'Invalid Pokemon data: PID became zero after processing' });
    }
    
    if (isParty) {
      // Import to party
      const partySlot = slot !== undefined ? slot : currentSaveFile.findNextEmptyPartySlot();
      if (partySlot === null) {
        return res.status(400).json({ error: 'Party is full' });
      }
      // Use write method with 'party' target type
      try {
        currentSaveFile.write(storedData, 'party', partySlot);
        // Recalculate checksums after modifying save data
        currentSaveFile.writeSectors();
        res.json({ success: true, slot: partySlot, message: `Pokemon imported to party slot ${partySlot}` });
      } catch (writeError) {
        console.error('Error writing Pokemon to party:', writeError);
        return res.status(500).json({ error: `Failed to write Pokemon: ${writeError.message}` });
      }
    } else {
      // Import to box
      let targetBox = box;
      let targetSlot = slot;
      
      if (targetBox === undefined || targetSlot === undefined) {
        const empty = startFromLastBox 
          ? currentSaveFile.findNextEmptyBoxSlotFromEnd()
          : currentSaveFile.findNextEmptyBoxSlot();
        if (!empty) {
          return res.status(400).json({ error: 'All boxes are full' });
        }
        targetBox = empty.box;
        targetSlot = empty.slot;
      }
      
      // Use write method with 'box' target type
      try {
        currentSaveFile.write(storedData, 'box', { box: targetBox, slot: targetSlot });
        // Recalculate checksums after modifying save data
        currentSaveFile.writeSectors();
        res.json({ 
          success: true, 
          box: targetBox, 
          slot: targetSlot, 
          message: `Pokemon imported to box ${targetBox + 1}, slot ${targetSlot + 1}` 
        });
      } catch (writeError) {
        console.error(`Error writing Pokemon to box ${targetBox}, slot ${targetSlot}:`, writeError);
        return res.status(500).json({ error: `Failed to write Pokemon: ${writeError.message}` });
      }
    }
  } catch (error) {
    console.error('Error importing Pokemon:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to export the modified save file
app.get('/api/save/export', (req, res) => {
  if (!currentSaveFile) {
    return res.status(404).json({ error: 'No save file loaded' });
  }
  
  try {
    const exported = currentSaveFile.export();
    // Use the same filename as the loaded save file
    const filename = currentSaveFileName || 'save_modified.sav';
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exported);
  } catch (error) {
    console.error('Error exporting save file:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get Pokemon from a specific box slot
app.get('/api/save/box/:box/slot/:slot', (req, res) => {
  if (!currentSaveFile) {
    return res.status(404).json({ error: 'No save file loaded' });
  }
  
  try {
    const box = parseInt(req.params.box);
    const slot = parseInt(req.params.slot);
    
    const pokemonData = currentSaveFile.getBoxSlot(box, slot);
    if (!pokemonData) {
      return res.json({ empty: true });
    }
    
    // Parse the Pokemon data
    const pokemon = PK3Parser.parse(pokemonData);
    res.json({ ...pokemon, box, slot });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get Pokemon from party slot
app.get('/api/save/party/:slot', (req, res) => {
  if (!currentSaveFile) {
    return res.status(404).json({ error: 'No save file loaded' });
  }
  
  try {
    const slot = parseInt(req.params.slot);
    
    const pokemonData = currentSaveFile.getPartySlot(slot);
    if (!pokemonData) {
      return res.json({ empty: true });
    }
    
    // Parse the Pokemon data
    const pokemon = PK3Parser.parse(pokemonData);
    res.json({ ...pokemon, partySlot: slot });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get all box contents
app.get('/api/save/boxes', (req, res) => {
  if (!currentSaveFile) {
    return res.status(404).json({ error: 'No save file loaded' });
  }
  
  try {
    const contents = currentSaveFile.getAllBoxContents();
    const existingSpecies = currentSaveFile.getExistingSpecies();
    
    // Convert Map to object for JSON serialization
    const contentsObj = {};
    for (const [key, speciesId] of contents.entries()) {
      contentsObj[key] = speciesId;
    }
    
    res.json({
      contents: contentsObj,
      existingSpecies: Array.from(existingSpecies)
    });
  } catch (error) {
    console.error('Error getting box contents:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to sort boxes by National Dex
app.post('/api/save/sort-boxes', (req, res) => {
  if (!currentSaveFile) {
    return res.status(404).json({ error: 'No save file loaded' });
  }
  
  try {
    const count = currentSaveFile.sortBoxesByNationalDex();
    currentSaveFile.writeSectors();
    
    res.json({
      success: true,
      message: `Boxes sorted by National Dex number`,
      pokemonCount: count
    });
  } catch (error) {
    console.error('Error sorting boxes:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint for Living Dex mode injection
app.post('/api/save/living-dex', express.json(), async (req, res) => {
  if (!currentSaveFile) {
    return res.status(404).json({ error: 'No save file loaded' });
  }
  
  try {
    const { dbId } = req.body;
    const folderPath = dbId ? getFolderPath(dbId) : DEFAULT_PK3_FOLDER;
    
    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Get all Pokemon from database
    const files = findPK3Files(folderPath);
    const allPokemon = [];
    
    for (const file of files) {
      try {
        const buffer = fs.readFileSync(file);
        const pokemon = PK3Parser.parse(buffer, path.basename(file));
        if (!pokemon.error && pokemon.species && pokemon.species > 0 && pokemon.species <= 386) {
          allPokemon.push({
            ...pokemon,
            filepath: file,
            filename: path.basename(file)
          });
        }
      } catch (err) {
        console.error(`Error parsing ${file}:`, err);
      }
    }
    
    // Filter to one Pokemon per species (highest IV sum)
    const speciesMap = new Map();
    for (const pokemon of allPokemon) {
      const speciesId = pokemon.species;
      const ivSum = pokemon.ivSum || 0;
      
      if (!speciesMap.has(speciesId)) {
        speciesMap.set(speciesId, pokemon);
      } else {
        const existing = speciesMap.get(speciesId);
        const existingIvSum = existing.ivSum || 0;
        
        if (ivSum > existingIvSum) {
          speciesMap.set(speciesId, pokemon);
        } else if (ivSum === existingIvSum) {
          // Tiebreaker: prefer higher level
          const existingLevel = existing.level || 0;
          const currentLevel = pokemon.level || 0;
          if (currentLevel > existingLevel) {
            speciesMap.set(speciesId, pokemon);
          }
        }
      }
    }
    
    // Sort boxes by National Dex first
    console.log('[Living Dex] Sorting boxes by National Dex...');
    currentSaveFile.sortBoxesByNationalDex();
    currentSaveFile.writeSectors();
    
    // Get existing species in boxes (after sorting)
    const existingSpecies = currentSaveFile.getExistingSpecies();
    const boxContents = currentSaveFile.getAllBoxContents();
    
    // Create a map to track which slots are occupied
    const occupiedSlots = new Set();
    for (const key of boxContents.keys()) {
      occupiedSlots.add(key);
    }
    
    // Create a map of species to box/slot positions (sorted by National Dex)
    const speciesToSlot = new Map();
    
    // Sort species by National Dex ID (1-386)
    const sortedSpecies = Array.from(speciesMap.keys()).sort((a, b) => a - b);
    
    // Assign slots sequentially by National Dex order, leaving empty slots for missing species
    let currentBox = 0;
    let currentSlot = 0;
    
    for (let dexNumber = 1; dexNumber <= 386; dexNumber++) {
      // Check if we've run out of space
      if (currentBox >= COUNT_BOX) {
        break;
      }
      
      const key = `${currentBox},${currentSlot}`;
      const isOccupied = occupiedSlots.has(key);
      
      // If this species exists in our collection and isn't already in boxes
      if (sortedSpecies.includes(dexNumber) && !existingSpecies.has(dexNumber)) {
        // Only assign if slot is empty
        if (!isOccupied) {
          speciesToSlot.set(dexNumber, { box: currentBox, slot: currentSlot });
        }
      }
      
      // Move to next slot (always advance, even if we skipped this species or slot was occupied)
      currentSlot++;
      if (currentSlot >= COUNT_SLOTSPERBOX) {
        currentSlot = 0;
        currentBox++;
      }
    }
    
    // Import Pokemon to their assigned slots
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (const [speciesId, position] of speciesToSlot.entries()) {
      const pokemon = speciesMap.get(speciesId);
      if (!pokemon) continue;
      
      try {
        // Read the Pokemon file
        const buffer = fs.readFileSync(pokemon.filepath);
        
        // Parse to get the correct species and decrypted data
        let correctSpecies = null;
        let decryptedStoredData = null;
        
        try {
          const parsed = PK3Parser.parse(buffer, pokemon.filename);
          correctSpecies = parsed.species;
          if (!correctSpecies || correctSpecies === 0 || correctSpecies > 386) {
            throw new Error(`Invalid species ID: ${correctSpecies}`);
          }
        } catch (parseError) {
          throw new Error(`Failed to parse Pokemon file: ${parseError.message}`);
        }
        
        // Decrypt if needed
        const needsDecryption = PK3Parser.checkIfEncrypted(buffer);
        if (needsDecryption) {
          decryptedStoredData = PK3Parser.decryptPK3(buffer);
        } else {
          decryptedStoredData = Buffer.from(buffer);
        }
        
        if (!decryptedStoredData || decryptedStoredData.length < 80) {
          throw new Error('Invalid Pokemon data after decryption');
        }
        
        // Convert National Dex to internal species ID if needed
        let internalSpecies = correctSpecies;
        if (correctSpecies > 251) {
          // Gen 3 Pokemon (252-386): need to convert to internal ID
          // For Gen 3, internal ID = National Dex ID for 1-251, but 252+ need conversion
          // Actually, for Gen 3, species 252-386 map directly (no conversion needed in Gen 3)
          internalSpecies = correctSpecies;
        }
        
        // Ensure species is set correctly in decrypted data
        if (internalSpecies >= 1 && internalSpecies <= 386) {
          decryptedStoredData.writeUInt16LE(internalSpecies, 0x20);
        } else {
          throw new Error(`Invalid internal species ID ${internalSpecies} for National Dex ${correctSpecies}`);
        }
        
        // Encrypt if needed
        let storedData = decryptedStoredData;
        if (needsDecryption) {
          storedData = SAV3Parser.encryptPKM(decryptedStoredData, decryptedStoredData.readUInt32LE(0), decryptedStoredData.readUInt32LE(0x04));
        }
        
        // Write to box
        currentSaveFile.write(storedData, 'box', position);
        successCount++;
        results.push({
          species: correctSpecies,
          speciesName: pokemon.speciesName,
          box: position.box,
          slot: position.slot,
          success: true
        });
      } catch (error) {
        errorCount++;
        console.error(`Error importing ${pokemon.filename}:`, error);
        results.push({
          species: speciesId,
          speciesName: pokemon.speciesName,
          box: position.box,
          slot: position.slot,
          success: false,
          error: error.message
        });
      }
    }
    
    // Recalculate checksums after all modifications
    currentSaveFile.writeSectors();
    
    res.json({
      success: true,
      imported: successCount,
      errors: errorCount,
      results: results,
      message: `Living Dex injection complete: ${successCount} Pokemon imported, ${errorCount} errors`
    });
  } catch (error) {
    console.error('Error in Living Dex injection:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get Pokedex data
app.get('/api/pokedex', (req, res) => {
  const dbId = req.query.db || req.query.folder;
  const folderPath = dbId ? getFolderPath(dbId) : DEFAULT_PK3_FOLDER;
  
  console.log(`[API] /api/pokedex called with dbId: ${dbId}, folderPath: ${folderPath}`);
  
  if (!fs.existsSync(folderPath)) {
    console.error(`[API] Folder not found: ${folderPath}`);
    return res.status(404).json({ error: 'Folder not found' });
  }
  
  try {
    // Find all Pokemon files recursively (pk3, pk4, pk5, pk6, pk7)
    const files = findPokemonFilesRecursive(folderPath);
    console.log(`[API] Found ${files.length} Pokemon files in ${folderPath}`);
    
    // Count files by type for debugging
    const fileCounts = {
      pk3: files.filter(f => f.toLowerCase().endsWith('.pk3')).length,
      pk4: files.filter(f => f.toLowerCase().endsWith('.pk4')).length,
      pk5: files.filter(f => f.toLowerCase().endsWith('.pk5')).length,
      pk6: files.filter(f => f.toLowerCase().endsWith('.pk6')).length,
      pk7: files.filter(f => f.toLowerCase().endsWith('.pk7')).length
    };
    console.log(`[API] File type breakdown:`, fileCounts);
    
    const pokedexData = new Map(); // speciesId -> { owned: true, shiny: false }
    
    // All possible generation ranges (Gen 1-9)
    const allGenerations = {
      1: { start: 1, end: 151, name: 'Generation 1' },
      2: { start: 152, end: 251, name: 'Generation 2' },
      3: { start: 252, end: 386, name: 'Generation 3' },
      4: { start: 387, end: 493, name: 'Generation 4' },
      5: { start: 494, end: 649, name: 'Generation 5' },
      6: { start: 650, end: 721, name: 'Generation 6' },
      7: { start: 722, end: 809, name: 'Generation 7' },
      8: { start: 810, end: 905, name: 'Generation 8' },
      9: { start: 906, end: 1025, name: 'Generation 9' }
    };
    
    // Track which generations have Pokemon
    const availableGenerations = new Set();
    const maxSpeciesId = 1025; // Gen 9 max
    
    // Process all Pokemon files
    for (const file of files) {
      try {
        const buffer = fs.readFileSync(file);
        const filename = path.basename(file);
        const lower = filename.toLowerCase();
        
        // Use appropriate parser based on file extension
        let pokemon;
        try {
          if (lower.endsWith('.pk3')) {
            pokemon = PK3Parser.parse(buffer, filename);
          } else if (lower.endsWith('.pk4') || lower.endsWith('.pk5')) {
            pokemon = PK4Parser.parse(buffer, filename);
          } else if (lower.endsWith('.pk6')) {
            pokemon = PK6Parser.parse(buffer, filename);
          } else if (lower.endsWith('.pk7')) {
            pokemon = PK7Parser.parse(buffer, filename);
          } else {
            continue;
          }
        } catch (parseError) {
          console.error(`[API] Error parsing ${filename}:`, parseError.message);
          continue;
        }
        
        if (!pokemon || pokemon.error || !pokemon.species || pokemon.species === 0 || pokemon.species > maxSpeciesId) {
          continue;
        }
        
        const speciesId = pokemon.species;
        const isShiny = pokemon.isShiny === true;
        
        // Determine which generation this species belongs to
        for (const [genNum, genInfo] of Object.entries(allGenerations)) {
          if (speciesId >= genInfo.start && speciesId <= genInfo.end) {
            availableGenerations.add(parseInt(genNum));
            break;
          }
        }
        
        // Update Pokedex entry
        if (!pokedexData.has(speciesId)) {
          pokedexData.set(speciesId, {
            owned: true,
            shiny: isShiny
          });
        } else {
          const entry = pokedexData.get(speciesId);
          // If we already have a shiny, keep it; otherwise update if this one is shiny
          if (!entry.shiny && isShiny) {
            entry.shiny = isShiny;
          }
        }
      } catch (err) {
        console.error(`Error parsing ${file}:`, err);
      }
    }
    
    // Only include generations that have Pokemon in the database
    const generations = {};
    for (const genNum of availableGenerations) {
      generations[genNum] = allGenerations[genNum];
    }
    
    // Calculate completion stats per generation (only for available generations)
    const completionStats = {};
    
    for (const [genNum, genInfo] of Object.entries(generations)) {
      let owned = 0;
      let shiny = 0;
      
      for (let speciesId = genInfo.start; speciesId <= genInfo.end; speciesId++) {
        const entry = pokedexData.get(speciesId);
        if (entry && entry.owned) {
          owned++;
          if (entry.shiny) {
            shiny++;
          }
        }
      }
      
      const total = genInfo.end - genInfo.start + 1;
      const livingDex = owned === total;
      const shinyLivingDex = shiny === total && total > 0;
      
      completionStats[genNum] = {
        name: genInfo.name,
        owned,
        shiny,
        total,
        percentage: total > 0 ? Math.round((owned / total) * 100) : 0,
        shinyPercentage: total > 0 ? Math.round((shiny / total) * 100) : 0,
        livingDex,
        shinyLivingDex
      };
    }
    
    // Determine max species ID in database
    const speciesIdsInDb = Array.from(pokedexData.keys());
    const maxSpeciesInDb = speciesIdsInDb.length > 0 ? Math.max(...speciesIdsInDb) : 0;
    
    // Determine the max species ID to include based on available generations
    let maxSpeciesToInclude = maxSpeciesInDb;
    if (availableGenerations.size > 0) {
      const maxGen = Math.max(...Array.from(availableGenerations));
      const maxGenEnd = allGenerations[maxGen]?.end || maxSpeciesInDb;
      maxSpeciesToInclude = Math.max(maxSpeciesInDb, maxGenEnd);
    }
    
    // Convert Map to object for JSON (include all species up to max, including missing ones)
    const pokedexObj = {};
    for (let speciesId = 1; speciesId <= maxSpeciesToInclude; speciesId++) {
      const entry = pokedexData.get(speciesId);
      pokedexObj[speciesId] = entry || { owned: false, shiny: false };
    }
    
    res.json({
      pokedex: pokedexObj,
      completionStats: completionStats,
      availableGenerations: Array.from(availableGenerations).sort((a, b) => a - b)
    });
  } catch (error) {
    console.error('Error getting Pokedex data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to recursively find all .pk3 files in a directory
function findPK3Files(dir, fileList = []) {
  try {
    if (!fs.existsSync(dir)) {
      return fileList;
    }
    
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        // Recursively search subdirectories
        findPK3Files(filePath, fileList);
      } else if (file.toLowerCase().endsWith('.pk3')) {
        fileList.push(filePath);
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error);
  }
  
  return fileList;
}

// API endpoint to scan and move .pk3 files
app.post('/api/scan-move-files', express.json(), (req, res) => {
  try {
    const { sourceFolder, targetDbId, deleteSource } = req.body;
    
    if (!sourceFolder || !targetDbId) {
      return res.status(400).json({ error: 'Source folder and target database are required' });
    }
    
    // Validate source folder exists
    if (!fs.existsSync(sourceFolder)) {
      return res.status(400).json({ error: 'Source folder does not exist' });
    }
    
    // Get target folder path
    const targetFolder = getFolderPath(targetDbId);
    if (!targetFolder || !fs.existsSync(targetFolder)) {
      return res.status(400).json({ error: 'Target database folder does not exist' });
    }
    
    // Find all .pk3 files recursively
    const pk3Files = findPK3Files(sourceFolder);
    
    if (pk3Files.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No .pk3 files found',
        moved: 0,
        skipped: 0,
        errors: []
      });
    }
    
    // Move or copy files
    let moved = 0;
    let skipped = 0;
    const errors = [];
    
    for (const sourceFile of pk3Files) {
      try {
        const filename = path.basename(sourceFile);
        const targetFile = path.join(targetFolder, filename);
        
        // Check if file already exists in target
        if (fs.existsSync(targetFile)) {
          skipped++;
          continue;
        }
        
        if (deleteSource) {
          // Move file
          fs.renameSync(sourceFile, targetFile);
        } else {
          // Copy file
          fs.copyFileSync(sourceFile, targetFile);
        }
        
        moved++;
      } catch (error) {
        errors.push({ file: sourceFile, error: error.message });
        console.error(`Error processing ${sourceFile}:`, error);
      }
    }
    
    res.json({
      success: true,
      message: `Processed ${pk3Files.length} file(s): ${moved} moved/copied, ${skipped} skipped`,
      moved: moved,
      skipped: skipped,
      total: pk3Files.length,
      errors: errors
    });
  } catch (error) {
    console.error('Error scanning and moving files:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Looking for .pk3 files in: ${DEFAULT_PK3_FOLDER}`);
  console.log(`Place your .pk3 files in the 'pk3-files' folder`);
});

