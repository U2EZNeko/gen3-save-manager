const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const PK3Parser = require('./pk3-parser');
const SAV3Parser = require('./sav3-parser');
const multer = require('multer');

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

// Available Pokemon database folders
const PK3_DATABASES = [
  { id: 'db1', name: 'Database 1', path: path.join(__dirname, 'pk3-files') },
  { id: 'db2', name: 'Database 2', path: path.join(__dirname, 'pk3-files-2') },
  { id: 'db3', name: 'Database 3', path: path.join(__dirname, 'pk3-files-3') },
  { id: 'db4', name: 'Database 4', path: path.join(__dirname, 'pk3-files-4') }
];

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
  res.json(PK3_DATABASES.map(db => ({
    id: db.id,
    name: db.name,
    exists: fs.existsSync(db.path),
    fileCount: fs.existsSync(db.path) 
      ? fs.readdirSync(db.path).filter(f => f.toLowerCase().endsWith('.pk3')).length 
      : 0
  })));
});

// API endpoint to get all .pk3 files from the folder
app.get('/api/pokemon', (req, res) => {
  const dbId = req.query.db || req.query.folder; // Support both 'db' and 'folder' for backward compatibility
  const folderPath = dbId ? getFolderPath(dbId) : DEFAULT_PK3_FOLDER;
  
  if (!fs.existsSync(folderPath)) {
    return res.status(404).json({ error: 'Folder not found' });
  }

  try {
    const files = fs.readdirSync(folderPath)
      .filter(file => file.toLowerCase().endsWith('.pk3'))
      .map(file => {
        const filePath = path.join(folderPath, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          path: filePath,
          size: stats.size,
          modified: stats.mtime
        };
      });

    // Parse each .pk3 file
    const pokemon = files.map(file => {
      try {
        const buffer = fs.readFileSync(file.path);
        const pokemonData = PK3Parser.parse(buffer, file.filename);
        // Get file stats again to include creation date
        const fileStats = fs.statSync(file.path);
        return {
          ...pokemonData,
          filename: file.filename,
          fileCreated: fileStats.birthtime || fileStats.mtime, // Use birthtime (creation) or mtime (modified) as fallback
          fileModified: fileStats.mtime
        };
      } catch (error) {
        console.error(`Error parsing ${file.filename}:`, error);
        return {
          filename: file.filename,
          error: error.message
        };
      }
    });

    res.json(pokemon);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get a specific .pk3 file
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
    
    const pokemonData = PK3Parser.parse(buffer);
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

// API endpoint to delete a .pk3 file
app.delete('/api/pokemon/:filename', (req, res) => {
  const dbId = req.query.db || req.query.folder;
  const folderPath = dbId ? getFolderPath(dbId) : DEFAULT_PK3_FOLDER;
  const filename = req.params.filename;
  
  // Security: Only allow .pk3 files to be deleted
  if (!filename.toLowerCase().endsWith('.pk3')) {
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
    const { pokemonData, box, slot, isParty, startFromLastBox } = req.body;
    
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Looking for .pk3 files in: ${DEFAULT_PK3_FOLDER}`);
  console.log(`Place your .pk3 files in the 'pk3-files' folder`);
});

