const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const PK3Parser = require('./pk3-parser');
const SAV3Parser = require('./sav3-parser');
const multer = require('multer');

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
        return {
          ...pokemonData,
          filename: file.filename
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
    const { pokemonData, box, slot, isParty } = req.body;
    
    if (!pokemonData || !Array.isArray(pokemonData)) {
      return res.status(400).json({ error: 'Invalid Pokemon data' });
    }
    
    // Convert array to Buffer
    const pokemonBuffer = Buffer.from(pokemonData);
    
    // Convert PKHeX export/party format to stored format (80 bytes)
    let storedData = pokemonBuffer;
    if (pokemonBuffer.length === 100) {
      // 100-byte file: Could be PKHeX export (32-byte header + 80 bytes) or party format (80 bytes + 20 bytes party)
      const pid = pokemonBuffer.readUInt32LE(0);
      const speciesAt20 = pokemonBuffer.readUInt16LE(0x20);
      const speciesAt40 = pokemonBuffer.readUInt16LE(0x40);
      const validSpeciesAt20 = speciesAt20 >= 1 && speciesAt20 <= 386;
      const validSpeciesAt40 = speciesAt40 >= 1 && speciesAt40 <= 386;
      
      if (validSpeciesAt20 && !validSpeciesAt40) {
        // PKHeX export format: Header at 0x00-0x1F, Pokemon data blocks at 0x20-0x6F
        // Need to reconstruct 80-byte stored format:
        // Stored format: 0x00-0x1F (header) + 0x20-0x4F (Pokemon blocks) = 80 bytes
        // PKHeX export: 0x00-0x1F (header) + 0x20-0x6F (Pokemon blocks) = 112 bytes total
        // But file might be truncated to 100 bytes, so we have 68 bytes of Pokemon data
        storedData = Buffer.alloc(80, 0);
        // Copy header (first 32 bytes) - this includes PID, TID, SID, OT name, etc.
        pokemonBuffer.copy(storedData, 0, 0, 32);
        // Copy Pokemon data blocks: stored format needs 48 bytes (0x20-0x4F)
        // PKHeX export has up to 80 bytes (0x20-0x6F), but file might be truncated
        const dataStart = 0x20;
        const dataNeeded = 48; // Stored format needs 48 bytes of Pokemon blocks
        const dataAvailable = Math.min(dataNeeded, pokemonBuffer.length - dataStart);
        pokemonBuffer.copy(storedData, 0x20, dataStart, dataStart + dataAvailable);
        // If we got less than 48 bytes, the rest is already zero-padded
      } else if (validSpeciesAt40 && !validSpeciesAt20) {
        // Party format: Pokemon data is first 80 bytes (stored format)
        storedData = pokemonBuffer.slice(0, 80);
      } else if (pid > 0 && pid < 0xFFFFFFFF) {
        // Has valid PID, likely PKHeX export - reconstruct stored format
        storedData = Buffer.alloc(80, 0);
        // Copy header (32 bytes)
        pokemonBuffer.copy(storedData, 0, 0, 32);
        // Copy Pokemon data blocks (48 bytes needed, but file might be truncated)
        const dataStart = 0x20;
        const dataNeeded = 48;
        const dataAvailable = Math.min(dataNeeded, pokemonBuffer.length - dataStart);
        pokemonBuffer.copy(storedData, 0x20, dataStart, dataStart + dataAvailable);
      } else {
        // Default to party format (first 80 bytes)
        storedData = pokemonBuffer.slice(0, 80);
      }
    } else if (pokemonBuffer.length !== 80) {
      return res.status(400).json({ error: `Invalid Pokemon data size: expected 80 or 100 bytes, got ${pokemonBuffer.length}` });
    }
    
    // Validate stored data size
    if (storedData.length !== 80) {
      return res.status(400).json({ error: `Invalid stored Pokemon data size: expected 80 bytes, got ${storedData.length}` });
    }
    
    if (isParty) {
      // Import to party
      const partySlot = slot !== undefined ? slot : currentSaveFile.findNextEmptyPartySlot();
      if (partySlot === null) {
        return res.status(400).json({ error: 'Party is full' });
      }
      // Use write method with 'party' target type
      currentSaveFile.write(storedData, 'party', partySlot);
      // Recalculate checksums after modifying save data
      currentSaveFile.writeSectors();
      res.json({ success: true, slot: partySlot, message: `Pokemon imported to party slot ${partySlot}` });
    } else {
      // Import to box
      let targetBox = box;
      let targetSlot = slot;
      
      if (targetBox === undefined || targetSlot === undefined) {
        const empty = currentSaveFile.findNextEmptyBoxSlot();
        if (!empty) {
          return res.status(400).json({ error: 'All boxes are full' });
        }
        targetBox = empty.box;
        targetSlot = empty.slot;
      }
      
      // Use write method with 'box' target type
      currentSaveFile.write(storedData, 'box', { box: targetBox, slot: targetSlot });
      // Recalculate checksums after modifying save data
      currentSaveFile.writeSectors();
      res.json({ 
        success: true, 
        box: targetBox, 
        slot: targetSlot, 
        message: `Pokemon imported to box ${targetBox + 1}, slot ${targetSlot + 1}` 
      });
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

