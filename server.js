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
    console.log(`[API] Reading folder recursively: ${folderPath}`);
    // Use recursive search to find all Pokemon files in subdirectories too
    const allFilePaths = findPokemonFilesRecursive(folderPath);
    console.log(`[API] Found ${allFilePaths.length} Pokemon files (recursive search)`);
    
    // Count files by type for debugging
    const fileCounts = {
      pk3: allFilePaths.filter(f => f.toLowerCase().endsWith('.pk3')).length,
      pk4: allFilePaths.filter(f => f.toLowerCase().endsWith('.pk4')).length,
      pk5: allFilePaths.filter(f => f.toLowerCase().endsWith('.pk5')).length,
      pk6: allFilePaths.filter(f => f.toLowerCase().endsWith('.pk6')).length,
      pk7: allFilePaths.filter(f => f.toLowerCase().endsWith('.pk7')).length
    };
    console.log(`[API] File type breakdown:`, fileCounts);
    
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
            console.log(`[API] Skipping ${filename}: unknown file type`);
            continue;
          }
        } catch (parseError) {
          console.error(`[API] Error parsing ${filename}:`, parseError.message);
          console.error(`[API] Stack:`, parseError.stack);
          continue;
        }
        
        if (!pokemon) {
          console.log(`[API] Skipping ${filename}: parser returned null/undefined`);
          continue;
        }
        
        if (pokemon.error) {
          console.log(`[API] Skipping ${filename}: ${pokemon.error}`);
          continue;
        }
        
        if (!pokemon.species || pokemon.species === 0) {
          console.log(`[API] Skipping ${filename}: invalid species (${pokemon.species})`);
          continue;
        }
        
        if (pokemon.species > maxSpeciesId) {
          console.log(`[API] Skipping ${filename}: species ${pokemon.species} exceeds max ${maxSpeciesId}`);
          continue;
        }
        
        console.log(`[API] Parsed ${filename}: species=${pokemon.species}, shiny=${pokemon.isShiny}, format=${pokemon.format || 'unknown'}`);
        
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
    
    console.log(`[API] Pokedex summary: ${pokedexData.size} unique species, max species ID: ${maxSpeciesInDb}`);
    console.log(`[API] Available generations:`, Array.from(availableGenerations).sort((a, b) => a - b));
    console.log(`[API] Completion stats for ${Object.keys(completionStats).length} generations:`, 
      Object.keys(completionStats).map(gen => `${gen}: ${completionStats[gen].owned}/${completionStats[gen].total}`).join(', '));
    
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

