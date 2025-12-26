const fs = require('fs');
const path = require('path');
const SAV3Parser = require('./parsers/sav3-parser');
const PK3Parser = require('./parsers/pk3-parser');

// Convert National Dex ID to Gen 3 internal species ID
// Based on PKHeX.Core/PKM/Util/Conversion/SpeciesConverter.cs GetInternal3
function convertNationalToInternal3(nationalSpecies) {
  const FirstUnalignedNational3 = 252; // Legal.MaxSpeciesID_2 + 1
  const FirstUnalignedInternal3 = 277;
  
  // Table3NationalToInternal from SpeciesConverter.cs
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
    return nationalSpecies;
  }
  
  const shift = nationalSpecies - FirstUnalignedNational3;
  if (shift < 0 || shift >= Table3NationalToInternal.length) {
    return nationalSpecies;
  }
  
  const delta = Table3NationalToInternal[shift];
  const internal = nationalSpecies + delta;
  
  if (internal >= FirstUnalignedInternal3 && internal <= 386) {
    return internal;
  }
  
  return nationalSpecies;
}

// Test script to import random Pokemon and verify they imported correctly
async function testImport() {
    console.log('=== Pokemon Import Test Script ===\n');
    
    // Configuration
    const SAVE_FILE = process.argv[2] || 'test_save.sav';
    const PK3_FOLDER = process.argv[3] || 'pk3-files';
    const NUM_TO_IMPORT = parseInt(process.argv[4]) || 5;
    
    if (!fs.existsSync(SAVE_FILE)) {
        console.error(`Error: Save file not found: ${SAVE_FILE}`);
        console.log('Usage: node test-import.js [save_file.sav] [pk3_folder] [num_to_import]');
        process.exit(1);
    }
    
    if (!fs.existsSync(PK3_FOLDER)) {
        console.error(`Error: PK3 folder not found: ${PK3_FOLDER}`);
        process.exit(1);
    }
    
    // Load save file
    console.log(`1. Loading save file: ${SAVE_FILE}`);
    const saveBuffer = fs.readFileSync(SAVE_FILE);
    const saveFile = new SAV3Parser(saveBuffer);
    const saveInfo = saveFile.getInfo();
    console.log(`   ✓ Save file loaded: OT: ${saveInfo.otName}, Game: ${saveInfo.gameVersion}\n`);
    
    // Get all PK3 files
    console.log(`2. Scanning PK3 files in: ${PK3_FOLDER}`);
    const pk3Files = fs.readdirSync(PK3_FOLDER)
        .filter(f => f.toLowerCase().endsWith('.pk3'))
        .map(f => path.join(PK3_FOLDER, f));
    
    if (pk3Files.length === 0) {
        console.error(`Error: No .pk3 files found in ${PK3_FOLDER}`);
        process.exit(1);
    }
    
    console.log(`   ✓ Found ${pk3Files.length} PK3 files\n`);
    
    // Select random Pokemon files
    console.log(`3. Selecting ${NUM_TO_IMPORT} random Pokemon files...`);
    const selectedFiles = [];
    const shuffled = [...pk3Files].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < Math.min(NUM_TO_IMPORT, shuffled.length); i++) {
        const file = shuffled[i];
        const buffer = fs.readFileSync(file);
        const parsed = PK3Parser.parse(buffer, path.basename(file));
        
        if (parsed.error) {
            console.log(`   ⚠ Skipping ${path.basename(file)}: ${parsed.error}`);
            continue;
        }
        
        selectedFiles.push({
            filename: path.basename(file),
            path: file,
            buffer: buffer,
            parsed: parsed
        });
        
        console.log(`   ✓ Selected: ${parsed.speciesName || 'Unknown'} (${parsed.species}) - ${path.basename(file)}`);
    }
    
    console.log(`\n   Total selected: ${selectedFiles.length} Pokemon\n`);
    
    if (selectedFiles.length === 0) {
        console.error('Error: No valid Pokemon files to import');
        process.exit(1);
    }
    
    // Find initial empty slots
    console.log('4. Finding empty box slots...');
    const emptySlotsBefore = [];
    for (let box = 0; box < 14; box++) {
        for (let slot = 0; slot < 30; slot++) {
            const pkm = saveFile.getBoxSlot(box, slot);
            if (!pkm) {
                emptySlotsBefore.push({ box, slot });
            }
        }
    }
    console.log(`   ✓ Found ${emptySlotsBefore.length} empty slots\n`);
    
    // Import Pokemon
    console.log('5. Importing Pokemon...');
    const importResults = [];
    const importedLocations = [];
    
    for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        try {
            // Parse to get correct species and decrypted data (same logic as server)
            const originalBuffer = file.buffer;
            let correctSpecies = file.parsed.species;
            let decryptedStoredData = null;
            
            // Determine if it's PKHeX export or encrypted
            let isPKHeXExport = false;
            if (originalBuffer.length === 100) {
                const speciesAt20 = originalBuffer.readUInt16LE(0x20);
                isPKHeXExport = (speciesAt20 >= 1 && speciesAt20 <= 386);
            }
            
            if (isPKHeXExport) {
                // PKHeX export: The stored format is the first 80 bytes (0x00-0x4F)
                // The header (0x00-0x1F) contains PID, TID, SID, OT name, etc.
                // The Pokemon data blocks start at 0x20 within the stored format
                // So we need the full 80 bytes starting at 0x00
                decryptedStoredData = Buffer.from(originalBuffer.slice(0, 80));
            } else {
                // Encrypted file: need to decrypt using PK3Parser's logic
                const needsDecryption = PK3Parser.checkIfEncrypted(originalBuffer, 0);
                if (needsDecryption) {
                    const decrypted = PK3Parser.decryptPK3(originalBuffer, 0);
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
                    decryptedStoredData = Buffer.from(originalBuffer.length === 100 ? originalBuffer.slice(0, 80) : originalBuffer);
                }
            }
            
            // Validate decrypted stored data
            if (!decryptedStoredData || decryptedStoredData.length !== 80) {
                throw new Error(`Failed to extract valid stored Pokemon data (got ${decryptedStoredData ? decryptedStoredData.length : 0} bytes)`);
            }
            
            // Validate PID
            const pid = decryptedStoredData.readUInt32LE(0);
            if (pid === 0) {
                throw new Error('Invalid Pokemon data: PID is zero');
            }
            
            // Convert National Dex species ID to internal species ID
            if (correctSpecies !== null && correctSpecies >= 1 && correctSpecies <= 386) {
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
                            // Both conversion and original are invalid - skip this Pokemon
                            throw new Error(`Cannot determine valid internal species ID for National Dex ${correctSpecies} (converted: ${internalSpecies}, original: ${originalAt20})`);
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
                    // Invalid species ID - skip this Pokemon
                    throw new Error(`Invalid internal species ID ${internalSpecies} for National Dex ${correctSpecies} (out of valid range 1-386)`);
                }
            }
            
            // Find next empty slot
            const empty = saveFile.findNextEmptyBoxSlot();
            if (!empty) {
                throw new Error('All boxes are full');
            }
            
            // Import using decrypted data (write() will encrypt it)
            // Note: Don't recalculate checksum here - encryptPKM does that on encrypted data
            // We already calculated it on decrypted data, but encryptPKM will recalculate on encrypted data
            saveFile.write(decryptedStoredData, 'box', { box: empty.box, slot: empty.slot });
            
            importedLocations.push({ box: empty.box, slot: empty.slot });
            importResults.push({
                filename: file.filename,
                species: file.parsed.species,
                speciesName: file.parsed.speciesName,
                box: empty.box,
                slot: empty.slot,
                success: true
            });
            
            console.log(`   ✓ Imported ${file.parsed.speciesName || 'Unknown'} to Box ${empty.box + 1}, Slot ${empty.slot + 1}`);
        } catch (error) {
            importResults.push({
                filename: file.filename,
                success: false,
                error: error.message
            });
            console.log(`   ✗ Failed to import ${file.filename}: ${error.message}`);
        }
    }
    
    console.log(`\n   Imported: ${importResults.filter(r => r.success).length}/${selectedFiles.length}\n`);
    
    // Write all sectors back to save file after all imports are complete
    console.log('Writing sectors back to save file...');
    saveFile.writeSectors();
    console.log('   ✓ Sectors written\n');
    
    // Verify imports
    console.log('6. Verifying imported Pokemon...');
    let verifiedCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < importResults.length; i++) {
        const result = importResults[i];
        if (!result.success) {
            failedCount++;
            continue;
        }
        
        try {
            // Read back from save file
            const importedPkm = saveFile.getBoxSlot(result.box, result.slot);
            if (!importedPkm) {
                throw new Error('Pokemon not found at expected location');
            }
            
            // Parse the imported Pokemon
            const importedParsed = PK3Parser.parse(importedPkm);
            
            // Compare key properties
            const original = selectedFiles[i].parsed;
            const matches = {
                species: importedParsed.species === original.species,
                pid: importedParsed.personality === original.personality,
                tid: importedParsed.tid === original.tid,
                sid: importedParsed.sid === original.sid,
                otName: importedParsed.otName === original.otName
            };
            
            const allMatch = Object.values(matches).every(v => v === true);
            
            if (allMatch) {
                verifiedCount++;
                console.log(`   ✓ Verified: ${result.speciesName} (Box ${result.box + 1}, Slot ${result.slot + 1})`);
                console.log(`     Species: ${importedParsed.species}, PID: ${importedParsed.personality.toString(16).toUpperCase()}, OT: ${importedParsed.otName}`);
            } else {
                failedCount++;
                console.log(`   ✗ Verification failed: ${result.speciesName} (Box ${result.box + 1}, Slot ${result.slot + 1})`);
                console.log(`     Species match: ${matches.species}, PID match: ${matches.pid}, TID match: ${matches.tid}, SID match: ${matches.sid}, OT match: ${matches.otName}`);
                console.log(`     Original: Species ${original.species}, PID ${original.personality.toString(16).toUpperCase()}, TID ${original.tid}, SID ${original.sid}, OT ${original.otName}`);
                console.log(`     Imported: Species ${importedParsed.species}, PID ${importedParsed.personality.toString(16).toUpperCase()}, TID ${importedParsed.tid}, SID ${importedParsed.sid}, OT ${importedParsed.otName}`);
            }
        } catch (error) {
            failedCount++;
            console.log(`   ✗ Verification error for ${result.filename}: ${error.message}`);
        }
    }
    
    console.log(`\n   Verified: ${verifiedCount}/${importResults.filter(r => r.success).length}`);
    console.log(`   Failed: ${failedCount}\n`);
    
    // Export modified save file
    const outputFile = SAVE_FILE.replace('.sav', '_tested.sav');
    console.log(`7. Exporting modified save file: ${outputFile}`);
    const exported = saveFile.export();
    fs.writeFileSync(outputFile, exported);
    console.log(`   ✓ Save file exported\n`);
    
    // Summary
    console.log('=== Test Summary ===');
    console.log(`Total Pokemon selected: ${selectedFiles.length}`);
    console.log(`Successfully imported: ${importResults.filter(r => r.success).length}`);
    console.log(`Successfully verified: ${verifiedCount}`);
    console.log(`Failed: ${failedCount}`);
    console.log(`Output save file: ${outputFile}`);
    
    if (failedCount === 0 && verifiedCount === importResults.filter(r => r.success).length) {
        console.log('\n✓ All tests passed!');
        process.exit(0);
    } else {
        console.log('\n✗ Some tests failed');
        process.exit(1);
    }
}

// Run the test
testImport().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

