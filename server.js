const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const PK3Parser = require('./pk3-parser');
const PK4Parser = require('./pk4-parser');
const PK6Parser = require('./pk6-parser');
const PK7Parser = require('./pk7-parser');
const SAV3Parser = require('./sav3-parser');
const multer = require('multer');
const archiver = require('archiver');

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

// API endpoint to update a folder's name
app.put('/api/databases/:id', express.json(), (req, res) => {
  try {
    const folderId = req.params.id;
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const folder = PK3_DATABASES.find(db => db.id === folderId);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Update the name
    folder.name = name.trim();
    saveFolders(PK3_DATABASES);
    
    res.json({ success: true, folder: folder });
  } catch (error) {
    console.error('Error updating folder:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to recursively find all Pokemon files (.pk3, .pk4, .pk5, .pk6, .pk7) in a directory
function findPK3FilesRecursive(dirPath, fileList = []) {
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
          findPK3FilesRecursive(fullPath, fileList);
        } else if (stat.isFile()) {
          const lower = item.toLowerCase();
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
    const pk3Files = findPK3FilesRecursive(sourcePath);
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
    const allFiles = fs.readdirSync(folderPath);
    console.log(`[API] Found ${allFiles.length} total files in folder`);
    
    const files = allFiles
      .filter(file => {
        const lower = file.toLowerCase();
        const isPokemonFile = lower.endsWith('.pk3') || lower.endsWith('.pk4') || lower.endsWith('.pk5') || lower.endsWith('.pk6') || lower.endsWith('.pk7');
        return isPokemonFile;
      })
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

