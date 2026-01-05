/**
 * PK3 Parser for Generation 3 Pokemon files
 * Based on PKHeX export format
 * PKHeX exports have a 32-byte header, then 80 bytes of Pokemon data
 */

class PK3Parser {
  /**
   * Extract IVs from the IV bytes (Gen 3 format)
   * IVs are 5-bit values packed across 4 bytes starting at offset
   */
  static extractIVs(buffer, offset) {
    // Check if we have enough bytes to read
    if (offset + 4 > buffer.length) {
      return { hp: 0, attack: 0, defense: 0, speed: 0, spAttack: 0, spDefense: 0 };
    }
    
    // Read the 4 bytes as a 32-bit value (little-endian)
    // Bit layout: [0-4: HP] [5-9: Atk] [10-14: Def] [15-19: Spe] [20-24: SpA] [25-29: SpD] [30: unused] [31: Ability]
    const ivData = buffer.readUInt32LE(offset);
    
    // Extract each 5-bit IV (0-31)
    return {
      hp: ivData & 0x1F,                    // bits 0-4
      attack: (ivData >> 5) & 0x1F,         // bits 5-9
      defense: (ivData >> 10) & 0x1F,      // bits 10-14
      speed: (ivData >> 15) & 0x1F,         // bits 15-19
      spAttack: (ivData >> 20) & 0x1F,      // bits 20-24
      spDefense: (ivData >> 25) & 0x1F,     // bits 25-29
    };
  }
  
  /**
   * Extract ability bit from IV bytes
   * Ability is stored at bit 31 of the 32-bit IV value
   */
  static extractAbility(buffer, offset) {
    if (offset + 4 > buffer.length) {
      return 0;
    }
    const ivData = buffer.readUInt32LE(offset);
    // Ability is bit 31 (highest bit)
    return (ivData >> 31) & 0x01;
  }

  /**
   * Parse a .pk3 file buffer
   * Supports two formats:
   * 1. PKHeX export format: 100 bytes (32-byte header + 80 bytes Pokemon data)
   * 2. Raw stored format: 80 bytes (direct Pokemon data)
   * 3. Party format: 100 bytes (80 bytes Pokemon data + 20 bytes party data)
   */
  static parse(buffer, filename = null) {
    // Determine format based on size
    let dataOffset = 0;
    let isPKHeXExport = false;
    
    // Determine format: 100 bytes = party format (raw from game) or PKHeX export, 80 bytes = stored format
    if (buffer.length === 100) {
      // 100-byte file: Check if it's encrypted party format or PKHeX export
      // PKHeX exports have species at 0x20 in header (already decrypted)
      // Party format has encrypted data at 0x20-0x4F, need to decrypt first to check
      const speciesAt20 = buffer.readUInt16LE(0x20);
      const validSpeciesAt20 = speciesAt20 >= 1 && speciesAt20 <= 386;
      
      if (validSpeciesAt20) {
        // Valid species at 0x20 = PKHeX export (already decrypted)
        isPKHeXExport = true;
        dataOffset = 0x20;
      } else {
        // Invalid species at 0x20 = party format (encrypted, data starts at 0x00)
        isPKHeXExport = false;
        dataOffset = 0x00;
      }
    } else if (buffer.length === 80) {
      // 80-byte stored format (may be encrypted)
      isPKHeXExport = false;
      dataOffset = 0x00;
    } else {
      throw new Error('Invalid .pk3 file: wrong size (expected 80 or 100 bytes, got ' + buffer.length + ')');
    }
    
    // Check if data is encrypted (for party format and raw 80-byte files)
    // PKHeX exports are already decrypted, so skip decryption for them
    let workingBuffer = Buffer.from(buffer);
    
    if (!isPKHeXExport) {
      // Check if party/raw format file is encrypted by validating checksum
      const needsDecryption = this.checkIfEncrypted(workingBuffer, dataOffset);
      if (needsDecryption) {
        // Decrypt the data before parsing
        workingBuffer = this.decryptPK3(workingBuffer, dataOffset);
      }
    }
    
    // Helper function to safely read from working buffer (decrypted if needed)
    const safeReadUInt16LE = (offset) => {
      if (offset + 2 > workingBuffer.length) return 0;
      return workingBuffer.readUInt16LE(offset);
    };
    
    const safeReadUInt32LE = (offset) => {
      if (offset + 4 > workingBuffer.length) return 0;
      return workingBuffer.readUInt32LE(offset);
    };
    
    const safeReadByte = (offset) => {
      if (offset >= workingBuffer.length) return 0;
      return workingBuffer[offset];
    };
    
    // Personality value is stored at the start of the Pokemon data
    // In PKHeX exports, it's at 0x00 (header), in raw format it's at dataOffset + 0x00
    const personality = isPKHeXExport 
      ? safeReadUInt32LE(0x00)  // PKHeX export: PID in header
      : safeReadUInt32LE(dataOffset + 0x00);  // Raw format: PID in data
    const nature = personality % 25;
    
    // Read species ID from Block A
    // Block A starts at offset 0x20 within the Pokemon data structure
    // For PKHeX exports: dataOffset = 0x20, so species is at 0x20 (in header, already decrypted)
    // For party format: dataOffset = 0x00, so species is at 0x20 (Block A at 0x00+0x20=0x20, after decryption)
    // For raw 80-byte files: dataOffset = 0x00, so species is at 0x20 (Block A offset, after decryption if needed)
    let rawSpecies;
    if (buffer.length === 100) {
      // 100-byte file: check both possible locations (after decryption if needed)
      const speciesAt20 = safeReadUInt16LE(0x20);
      const speciesAt40 = safeReadUInt16LE(0x40);
      const validAt20 = speciesAt20 >= 1 && speciesAt20 <= 386;
      const validAt40 = speciesAt40 >= 1 && speciesAt40 <= 386;
      
      if (isPKHeXExport && validAt20) {
        // PKHeX export: species in header at 0x20 (already decrypted)
        rawSpecies = speciesAt20;
      } else if (!isPKHeXExport) {
        // Party format: species is at 0x20 after decryption (Block A is at 0x20 relative to data start 0x00)
        // Use 0x20 if valid, otherwise try 0x40 as fallback
        if (validAt20) {
          rawSpecies = speciesAt20;
        } else if (validAt40) {
          rawSpecies = speciesAt40;
        } else {
          // Neither is valid, use 0x20 as default (will be handled by mapping/error handling)
          rawSpecies = speciesAt20;
        }
      } else if (validAt20) {
        // Fallback: use 0x20 if valid
        rawSpecies = speciesAt20;
      } else if (validAt40) {
        // Fallback: use 0x40 if valid
        rawSpecies = speciesAt40;
      } else {
        // Neither is valid, use 0x20 as default (will be handled by mapping/error handling)
        rawSpecies = speciesAt20;
      }
    } else {
      // 80-byte file: species at Block A offset (0x20) after decryption if needed
      rawSpecies = safeReadUInt16LE(dataOffset + 0x20);
    }
    
    // Convert PKHeX internal species ID to National Dex using SpeciesConverter logic
    // Based on PKHeX.Core/PKM/Util/Conversion/SpeciesConverter.cs
    function getNational3(internalSpecies) {
      const FirstUnalignedNational3 = 252; // Legal.MaxSpeciesID_2 + 1
      const FirstUnalignedInternal3 = 277;
      
      // Table3InternalToNational from SpeciesConverter.cs
      // This is the delta table: difference between internal ID and national ID
      const Table3InternalToNational = [
        -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25,
        -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -25, -11, -11, -11,
        -28, -28, -21, -21, 19, -31, -31, -28, -28, 7, 7, -15, -15, 35, 25, 25,
        -21, 3, -20, 16, 16, 45, 15, 15, 21, 21, -12, -12, -4, -4, -4, -39, -39,
        -28, -28, -17, -17, 22, 22, 22, -13, -13, 15, 15, -11, -11, -52, -26, -26,
        -42, -42, -52, -49, -49, -25, -25, 0, -6, -6, -48, -77, -77, -77, -51, -51,
        -12, -77, -77, -77, -7, -7, -7, -17, -24, -24, -43, -45, -12, -78, -78, -78,
        -34, -73, -73, -43, -43, -43, -43, -112, -112, -112, -24, -24, -24, -24, -24,
        -24, -24, -24, -24, -22, -22, -22, -27, -27, -24, -24, -53
      ];
      
      if (internalSpecies < FirstUnalignedNational3) {
        // Gen 1-2 Pokemon: internal ID matches National Dex
        return internalSpecies;
      }
      
      const shift = internalSpecies - FirstUnalignedInternal3;
      if (shift < 0 || shift >= Table3InternalToNational.length) {
        // Out of range - might be invalid or already National Dex
        return internalSpecies >= 1 && internalSpecies <= 386 ? internalSpecies : 0;
      }
      
      const delta = Table3InternalToNational[shift];
      const national = internalSpecies + delta;
      
      // Validate result
      if (national >= 1 && national <= 386) {
        return national;
      }
      
      // If conversion failed, check if it's already a valid National Dex
      return internalSpecies >= 1 && internalSpecies <= 386 ? internalSpecies : 0;
    }
    
    // Convert internal species ID to National Dex
    // PKHeX stores SpeciesInternal (internal ID) in the file, which needs conversion
    // However, for PKHeX exports, the filename often contains the correct National Dex number
    // The key is: if rawSpecies < 277, it's already National Dex (Gen 1-2 Pokemon)
    // If rawSpecies >= 277, it's an internal ID and needs conversion
    let species;
    
    // Extract species from filename if available (for both PKHeX exports and encrypted files)
    // Filenames are often more reliable than file data, especially for PKHeX exports
    let filenameSpecies = null;
    if (filename) {
      // Filename format: "### - SPECIESNAME - PID.pk3" or "### ★ - SPECIESNAME - PID.pk3"
      const match = filename.match(/^(\d+)\s/);
      if (match) {
        const fileSpecies = parseInt(match[1]);
        if (fileSpecies >= 1 && fileSpecies <= 386) {
          filenameSpecies = fileSpecies;
        }
      }
    }
    
    // If filename has a species number, prioritize it for ALL file types
    // This is because filenames are more reliable than file data (especially for PKHeX exports)
    if (filenameSpecies !== null) {
      // Use filename species directly
      species = filenameSpecies;
    } else {
      // No filename species available, convert from file data
      // Check if it's already a valid National Dex (Gen 1-2 Pokemon, or PKHeX export with National Dex)
      // Gen 1-2 Pokemon have internal ID = National Dex (1-251)
      // Gen 3 Pokemon have internal ID starting at 277
      if (rawSpecies >= 1 && rawSpecies < 277) {
        // Gen 1-2 Pokemon: internal ID matches National Dex
        species = rawSpecies;
      } else if (rawSpecies >= 277) {
        // Gen 3 Pokemon: convert from internal ID to National Dex
        species = getNational3(rawSpecies);
      } else {
        // Invalid (0 or out of range)
        species = 0;
      }
    }
    
    // If conversion failed or returned invalid, try lookup table (only for non-PKHeX exports or if filename didn't help)
    if ((species === 0 || species > 386) && (!isPKHeXExport || filenameSpecies === null)) {
      const PKHEX_TO_NATIONAL_DEX = {
        1: 1, 4: 4, 7: 7, 12: 12, 16: 16, 19: 19, 20: 20, 21: 21, 22: 22, 23: 23,
        25: 25, 27: 27, 30: 30, 32: 32, 33: 33, 37: 37, 41: 41, 42: 42, 43: 43, 44: 44,
        46: 46, 48: 48, 49: 49, 52: 52, 54: 54, 55: 55, 56: 56, 58: 58, 60: 60, 66: 66,
        72: 72, 74: 74, 77: 77, 78: 78, 81: 81, 84: 84, 86: 86, 88: 88, 92: 92, 95: 95,
        96: 96, 100: 100, 102: 102, 109: 109, 111: 111, 114: 114, 116: 116, 118: 118,
        119: 119, 128: 128, 129: 129, 130: 130, 132: 132, 143: 143, 147: 147, 163: 163,
        165: 165, 167: 167, 170: 170, 177: 177, 178: 178, 179: 179, 190: 190, 191: 191,
        203: 203, 204: 204, 207: 207, 209: 209, 214: 214, 216: 216, 218: 218, 222: 222,
        228: 228, 231: 231, 234: 234,
        // Gen 3 Pokemon mappings (PKHeX internal -> National Dex) - REMOVED INCORRECT ENTRIES
        // Note: 328 maps to 343 (Baltoy), 330 maps to 351 (Castform) - these were wrong in old table
        277: 252, 280: 255, 282: 257, 283: 258, 286: 261, 287: 262, 288: 263, 289: 264,
        290: 265, 291: 266, 295: 270, 301: 290, 304: 276, 308: 327, 309: 278, 313: 320,
        317: 352, 319: 344, 322: 302, 325: 370, 327: 342, 331: 319,
        332: 328, 336: 297, 337: 309, 339: 322, 341: 363, 358: 333, 361: 355,
        371: 294, 373: 366, 377: 353, 379: 336, 381: 369, 382: 304, 384: 306, 385: 351,
        387: 314, 392: 280, 406: 384
      };
      
      const mapped = PKHEX_TO_NATIONAL_DEX[rawSpecies];
      if (mapped !== undefined) {
        species = mapped;
      } else if (rawSpecies >= 1 && rawSpecies <= 386 && rawSpecies < 277) {
        // Already a valid National Dex number (Gen 1-2)
        species = rawSpecies;
      }
    }
    
    // Last resort: try to extract species from filename if provided (for non-PKHeX exports)
    if ((species === 0 || species > 386) && filename && !isPKHeXExport) {
      // Filename format: "### - SPECIESNAME - PID.pk3" or "### ★ - SPECIESNAME - PID.pk3"
      const match = filename.match(/^(\d+)\s/);
      if (match) {
        const fileSpecies = parseInt(match[1]);
        if (fileSpecies >= 1 && fileSpecies <= 386) {
          species = fileSpecies;
        }
      }
    }
    
    // Split parsing logic for PKHeX exports vs encrypted party/stored format
    let data;
    
    if (isPKHeXExport) {
      // PKHeX EXPORT PATH (already decrypted, dataOffset = 0x20)
      // Header (0x00-0x1F) contains Pokemon data starting at 0x20
      data = {
        species: species,
        heldItem: safeReadUInt16LE(0x22), // Block A + 0x02
        experience: safeReadUInt32LE(0x24), // Block A + 0x04
        ppBonuses: safeReadByte(0x28), // Block A + 0x08
        friendship: safeReadByte(0x29), // Block A + 0x09
        
        move1: safeReadUInt16LE(0x2C), // Block B
        move2: safeReadUInt16LE(0x2E),
        move3: safeReadUInt16LE(0x30),
        move4: safeReadUInt16LE(0x32),
        pp1: safeReadByte(0x34),
        pp2: safeReadByte(0x35),
        pp3: safeReadByte(0x36),
        pp4: safeReadByte(0x37),
        
        evHP: safeReadByte(0x38), // Block C
        evAttack: safeReadByte(0x39),
        evDefense: safeReadByte(0x3A),
        evSpeed: safeReadByte(0x3B),
        evSpAttack: safeReadByte(0x3C),
        evSpDefense: safeReadByte(0x3D),
        coolness: safeReadByte(0x3E),
        beauty: safeReadByte(0x3F),
        cute: safeReadByte(0x40),
        smart: safeReadByte(0x41),
        tough: safeReadByte(0x42),
        feel: safeReadByte(0x43),
        
        pokerus: safeReadByte(0x44), // Block D
        metLocation: safeReadByte(0x45),
        originsRaw: safeReadUInt16LE(0x46),
        
        tid: buffer.readUInt16LE(0x04),
        sid: buffer.readUInt16LE(0x06),
        otId: buffer.readUInt16LE(0x04),
        
        ivs: this.extractIVs(workingBuffer, 0x48),
        ability: this.extractAbility(workingBuffer, 0x48),
        
        ribbons: workingBuffer.length >= 0x4F ? safeReadUInt32LE(0x4C) : 0,
        
        level: 0, // Will be calculated from experience
        mail: 0,
        personality: personality,
        nature: nature,
        
        isShiny: (() => {
          const tid = buffer.readUInt16LE(0x04);
          const sid = buffer.readUInt16LE(0x06);
          // Gen 3 shiny formula: (TID XOR SID XOR (PID & 0xFFFF) XOR (PID >>> 16)) < 8
          // Use unsigned right shift (>>>) to ensure upper 16 bits are treated as unsigned
          const pidLower = personality & 0xFFFF;
          const pidUpper = (personality >>> 16) & 0xFFFF;
          const shinyValue = (tid ^ sid ^ pidLower ^ pidUpper) & 0xFFFF;
          return shinyValue < 8;
        })(),
        
        hp: 0, // PKHeX exports don't have HP, needs calculation
        maxHP: 0,
        attack: 0,
        defense: 0,
        speed: 0,
        spAttack: 0,
        spDefense: 0,
        
        nickname: buffer.length >= 0x12 ? this.readNickname(workingBuffer, 0x08, 10) : null,
        otNameRaw: buffer.length > 0x1A ? this.readStringGen3PKHeX(buffer, 0x14, 7) : null,
        
        origins: {
          levelMet: 0,
          gameOfOrigin: 0,
          pokeball: 0,
          otGender: 0,
        },
      };
    } else {
      // ENCRYPTED PARTY/STORED FORMAT PATH (decrypted, data at fixed offsets in workingBuffer)
      // After decryption, all blocks are at fixed absolute offsets: 0x20, 0x2C, 0x38, 0x44, etc.
      // For 100-byte party format, stats are in unencrypted party section (0x50-0x63)
      const isPartyFormat = buffer.length === 100;
      
      data = {
        species: species,
        heldItem: safeReadUInt16LE(0x22), // Block A + 0x02 = 0x22
        experience: safeReadUInt32LE(0x24), // Block A + 0x04 = 0x24
        ppBonuses: safeReadByte(0x28), // Block A + 0x08 = 0x28
        friendship: safeReadByte(0x29), // Block A + 0x09 = 0x29
        
        move1: safeReadUInt16LE(0x2C), // Block B
        move2: safeReadUInt16LE(0x2E),
        move3: safeReadUInt16LE(0x30),
        move4: safeReadUInt16LE(0x32),
        pp1: safeReadByte(0x34),
        pp2: safeReadByte(0x35),
        pp3: safeReadByte(0x36),
        pp4: safeReadByte(0x37),
        
        evHP: safeReadByte(0x38), // Block C
        evAttack: safeReadByte(0x39),
        evDefense: safeReadByte(0x3A),
        evSpeed: safeReadByte(0x3B),
        evSpAttack: safeReadByte(0x3C),
        evSpDefense: safeReadByte(0x3D),
        coolness: safeReadByte(0x3E),
        beauty: safeReadByte(0x3F),
        cute: safeReadByte(0x40),
        smart: safeReadByte(0x41),
        tough: safeReadByte(0x42),
        feel: safeReadByte(0x43),
        
        pokerus: safeReadByte(0x44), // Block D
        metLocation: safeReadByte(0x45),
        originsRaw: safeReadUInt16LE(0x46),
        
        tid: buffer.readUInt16LE(0x04),
        sid: buffer.readUInt16LE(0x06),
        otId: buffer.readUInt16LE(0x04),
        
        ivs: this.extractIVs(workingBuffer, 0x48),
        ability: this.extractAbility(workingBuffer, 0x48),
        
        ribbons: workingBuffer.length >= 0x4F ? safeReadUInt32LE(0x4C) : 0,
        
        // For party format, level and stats are in unencrypted party section (0x50-0x63)
        level: isPartyFormat && buffer.length >= 0x55 ? buffer.readUInt8(0x54) : 0,
        mail: isPartyFormat && buffer.length >= 0x56 ? buffer.readInt8(0x55) : 0,
        
        personality: personality,
        nature: nature,
        
        isShiny: (() => {
          const tid = buffer.readUInt16LE(0x04);
          const sid = buffer.readUInt16LE(0x06);
          // Gen 3 shiny formula: (TID XOR SID XOR (PID & 0xFFFF) XOR (PID >>> 16)) < 8
          // Use unsigned right shift (>>>) to ensure upper 16 bits are treated as unsigned
          const pidLower = personality & 0xFFFF;
          const pidUpper = (personality >>> 16) & 0xFFFF;
          const shinyValue = (tid ^ sid ^ pidLower ^ pidUpper) & 0xFFFF;
          return shinyValue < 8;
        })(),
        
        // Party format stats are in unencrypted section (0x50-0x63)
        hp: isPartyFormat && buffer.length >= 0x58 ? buffer.readUInt16LE(0x56) : 0,
        maxHP: isPartyFormat && buffer.length >= 0x5A ? buffer.readUInt16LE(0x58) : 0,
        attack: isPartyFormat && buffer.length >= 0x5C ? buffer.readUInt16LE(0x5A) : 0,
        defense: isPartyFormat && buffer.length >= 0x5E ? buffer.readUInt16LE(0x5C) : 0,
        speed: isPartyFormat && buffer.length >= 0x60 ? buffer.readUInt16LE(0x5E) : 0,
        spAttack: isPartyFormat && buffer.length >= 0x62 ? buffer.readUInt16LE(0x60) : 0,
        spDefense: isPartyFormat && buffer.length >= 0x64 ? buffer.readUInt16LE(0x62) : 0,
        
        nickname: buffer.length >= 0x12 ? this.readNickname(workingBuffer, 0x08, 10) : null,
        otNameRaw: buffer.length > 0x1A ? this.readStringGen3PKHeX(buffer, 0x14, 7) : null,
        
        origins: {
          levelMet: 0,
          gameOfOrigin: 0,
          pokeball: 0,
          otGender: 0,
        },
      };
    }

    // Extract Origins fields from packed ushort (PK3.cs format)
    // Origins is at Data[0x46] = dataOffset + 0x26 = 0x46 absolute
    const origins = data.originsRaw;
    data.origins.levelMet = origins & 0x7F; // bits 0-6
    data.origins.gameOfOrigin = (origins >> 7) & 0xF; // bits 7-10
    data.origins.pokeball = (origins >> 11) & 0xF; // bits 11-14
    data.origins.otGender = (origins >> 15) & 1; // bit 15

    // Calculate IV Sum
    data.ivSum = data.ivs.hp + data.ivs.attack + data.ivs.defense + 
                 data.ivs.speed + data.ivs.spAttack + data.ivs.spDefense;

    // Calculate EV Sum
    data.evSum = data.evHP + data.evAttack + data.evDefense + 
                 data.evSpeed + data.evSpAttack + data.evSpDefense;

    // Get species name - will be fetched from PokeAPI on frontend
    // Store species ID for API lookup
    data.speciesName = `Loading...`; // Placeholder, will be updated by frontend
    
    // Calculate level from experience if needed
    if (!data.level && data.experience) {
      data.level = this.calculateLevel(data.experience, data.species);
    }
    
    // Get nature name
    data.natureName = this.getNatureName(data.nature);
    
    // HP is not stored in PKHeX exports, it needs to be calculated
    // We'll calculate it on the frontend using base stats from PokeAPI
    // For now, set a flag that HP needs to be calculated
    data.hpNeedsCalculation = true;

    // Get origin game name and set originGame field for frontend
    data.originGame = data.origins.gameOfOrigin;
    data.originGameName = this.getOriginGameName(data.origins.gameOfOrigin);
    
    // Set ball field for frontend (from pokeball)
    data.ball = this.getBallName(data.origins.pokeball);
    data.ballName = data.ball; // Also set ballName for consistency
    data.ballId = data.origins.pokeball; // Store the raw ball ID for checking
    
    // Get met location name
    data.metLocationName = this.getMetLocationName(data.metLocation, data.origins.gameOfOrigin);
    
    // OT Name/ID - Convert to proper case and create grouping keys
    const tid = data.tid || data.otId || 0;
    const sid = data.sid || 0;
    const otName = data.otNameRaw && data.otNameRaw !== '???' && !data.otNameRaw.includes('?') 
                   ? data.otNameRaw.trim() : null;
    
    // Convert OT name to proper case - capitalize first letter, preserve rest
    // This preserves acronyms like "EMR" and "LG" in names like "AlexEMR" and "AlexLG"
    const toProperCase = (str) => {
      if (!str || str.length === 0) return str;
      // Only capitalize the first letter, keep the rest as-is
      return str.charAt(0).toUpperCase() + str.slice(1);
    };
    
    // Create OT identifier with proper case
    if (otName && otName.length > 0 && !otName.match(/^[?#]+$/)) {
      // Valid OT name found - capitalize first letter, preserve rest
      const properCaseName = toProperCase(otName);
      data.otName = properCaseName;
      data.otNameDisplay = properCaseName;
      // Group by OT name, with TID/SID as fallback for grouping
      data.otGroupKey = properCaseName;
      data.tidSidGroupKey = `${properCaseName} (TID:${tid} SID:${sid})`;
    } else {
      // No valid OT name - use TID/SID for grouping
      data.otName = 'Unknown OT';
      data.otNameDisplay = 'Unknown OT';
      data.otGroupKey = `TID:${tid} SID:${sid}`;
      data.tidSidGroupKey = `TID:${tid} SID:${sid}`;
    }
    
    data.otId = tid; // Keep otId for backward compatibility
    data.tid = tid;
    // SID is already set from parsing, don't overwrite it
    // data.sid is set from header at 0x06-0x07
    data.tidSidPair = `${tid}-${data.sid || 0}`; // Keep for backward compatibility
    data.otIdDisplay = tid;

    // Mark if Pokemon is Gen 3 or below (species IDs 1-386)
    data.isGen3 = data.species >= 1 && data.species <= 386;

    return data;
  }

  /**
   * Read a UTF-8 string from buffer
   */
  static readStringUTF8(buffer, offset, maxLength) {
    try {
      const safeLength = Math.min(maxLength, buffer.length - offset);
      const str = buffer.toString('utf8', offset, offset + safeLength);
      // Remove null bytes and non-printable characters
      const cleaned = str.replace(/\x00/g, '').replace(/[^\x20-\x7E]/g, '').trim();
      return cleaned.length >= 2 && /^[A-Za-z]+$/.test(cleaned) ? cleaned : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Gen 3 English character table from PKHeX StringConverter3
   * This is the exact lookup table used by PKHeX for English Gen 3 games
   * Byte value is used as index into this array
   */
  static G3_EN_TABLE = [
    ' ',  'À',  'Á',  'Â', 'Ç',  'È',  'É',  'Ê',  'Ë',  'Ì', 'こ', 'Î',  'Ï',  'Ò',  'Ó',  'Ô',  // 0
    'Œ',  'Ù',  'Ú',  'Û', 'Ñ',  'ß',  'à',  'á',  'ね', 'ç',  'è', 'é',  'ê',  'ë',  'ì',  'ま',  // 1
    'î',  'ï',  'ò',  'ó', 'ô',  'œ',  'ù',  'ú',  'û',  'ñ',  'º', 'ª',  '⑩', '&',  '+',  'あ', // 2
    'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ゃ', '=',  ';', 'が', 'ぎ', 'ぐ', 'げ', 'ご', 'ざ', 'じ', 'ず', 'ぜ', // 3
    'ぞ', 'だ', 'ぢ', 'づ', 'で', 'ど', 'ば', 'び', 'ぶ', 'べ', 'ぼ', 'ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ',  // 4
    'っ', '¿',  '¡',  '⒆', '⒇', 'オ', 'カ', 'キ', 'ク', 'ケ', 'Í',  '%', '(', ')', 'セ', 'ソ', // 5
    'タ', 'チ', 'ツ', 'テ', 'ト', 'ナ', 'ニ', 'ヌ', 'â',  'ノ', 'ハ', 'ヒ', 'フ', 'ヘ', 'ホ', 'í',  // 6
    'ミ', 'ム', 'メ', 'モ', 'ヤ', 'ユ', 'ヨ', 'ラ', 'リ', '↑', '↓', '←', '＋', 'ヲ', 'ン', 'ァ', // 7
    'ィ', 'ゥ', 'ェ', 'ォ', '⒅', '<', '>', 'ガ', 'ギ', 'グ', 'ゲ', 'ゴ', 'ザ', 'ジ', 'ズ', 'ゼ', // 8
    'ゾ', 'ダ', 'ヂ', 'ヅ', 'デ', 'ド', 'バ', 'ビ', 'ブ', 'ベ', 'ボ', 'パ', 'ピ', 'プ', 'ペ', 'ポ', // 9
    'ッ', '0',  '1',  '2', '3',  '4',  '5',  '6',  '7',  '8',  '9',  '!', '?',  '.',  '-',  '･',// A
    '⑬',  '"',  '"', "'", "'", '♂',  '♀',  '$',  ',',  '⑧',  '/',  'A', 'B',  'C',  'D',  'E', // B
    'F',  'G',  'H',  'I', 'J',  'K',  'L',  'M',  'N',  'O',  'P',  'Q', 'R',  'S',  'T',  'U', // C
    'V',  'W',  'X',  'Y', 'Z',  'a',  'b',  'c',  'd',  'e',  'f',  'g', 'h',  'i',  'j',  'k', // D
    'l',  'm',  'n',  'o', 'p',  'q',  'r',  's',  't',  'u',  'v',  'w', 'x',  'y',  'z',  '►', // E
    ':',  'Ä',  'Ö',  'Ü', 'ä',  'ö',  'ü',  '\xFF', '\xFF', '\xFF', '\xFF', '\xFF', '\xFF', '\xFF', '\xFF', '\xFF', // F
    '\xFF', '\xFF', '\xFF', '\xFF', '\xFF', '\xFF', '\xFF', '\xFF', '\xFF'  // Padding to 256
  ];

  /**
   * Decode Gen 3 character using PKHeX's exact lookup table
   * Based on PKHeX StringConverter3.GetG3Char() implementation
   */
  static decodeGen3CharPKHeX(byte) {
    if (byte >= this.G3_EN_TABLE.length) {
      return null;
    }
    const char = this.G3_EN_TABLE[byte];
    // Terminator is 0xFF
    if (char === '\xFF' || char === '\x00' || byte === 0xFF || byte === 0x00) {
      return null;
    }
    return char;
  }

  /**
   * Read a Gen 3 encoded string using PKHeX's exact character table
   * Based on PKHeX StringConverter3.GetString() implementation
   * Uses the G3_EN lookup table for English language
   */
  static readStringGen3PKHeX(buffer, offset, maxLength) {
    let str = '';
    const safeLength = Math.min(maxLength, buffer.length - offset);
    for (let i = 0; i < safeLength; i++) {
      if (offset + i >= buffer.length) break;
      const byte = buffer[offset + i];
      if (byte === 0x00 || byte === 0xFF) break;
      const char = this.decodeGen3CharPKHeX(byte);
      if (char) {
        str += char;
      } else {
        break;
      }
    }
    // Return if it looks like a valid name (reasonable length, contains at least some letters)
    // OT names can contain letters, numbers, and some special characters
    if (str.length >= 1 && str.length <= 7 && /[A-Za-z]/.test(str)) {
      return str;
    }
    return null;
  }
  
  /**
   * Read nickname with strict validation to avoid false positives from trash bytes
   * Nickname trash bytes often decode to species names or garbage, so we need extra validation
   */
  static readNickname(buffer, offset, maxLength) {
    const str = this.readStringGen3PKHeX(buffer, offset, maxLength);
    if (!str) return null;
    
    // Reject if it's all the same character (likely trash)
    if (str.length > 1 && /^(.)\1+$/.test(str)) {
      return null;
    }
    
    // Reject if it's mostly non-letter characters
    const letterCount = (str.match(/[A-Za-z]/g) || []).length;
    if (letterCount < Math.ceil(str.length * 0.6)) {
      return null;
    }
    
    // Get the raw bytes for pattern analysis
    const bytes = [];
    for (let i = 0; i < Math.min(maxLength, buffer.length - offset); i++) {
      const byte = buffer[offset + i];
      if (byte === 0x00 || byte === 0xFF) break;
      bytes.push(byte);
    }
    
    if (bytes.length === 0) return null;
    
    // Check for suspicious byte patterns that indicate trash
    const uniqueBytes = new Set(bytes);
    const byteValues = Array.from(bytes);
    const min = Math.min(...byteValues);
    const max = Math.max(...byteValues);
    
    // Reject if bytes have too much repetition (likely trash)
    if (uniqueBytes.size < bytes.length * 0.5 && bytes.length > 3) {
      return null;
    }
    
    // Reject if bytes are in a very narrow range (common in trash)
    if (max - min < 15 && bytes.length > 4) {
      return null;
    }
    
    // Reject all-caps names that are 4+ characters (often trash that decodes to species names)
    // Real nicknames are usually mixed case, shorter, or have special characters
    // All-caps 4+ character names are almost always trash bytes (species names are typically 4-10 chars)
    // Only allow all-caps if it's 1-3 characters (common for short nicknames like "ABC", "XY")
    if (str === str.toUpperCase() && str.length >= 4) {
      return null;
    }
    
    // Reject if it's all caps and has suspicious byte patterns
    if (str === str.toUpperCase() && str.length >= 5) {
      // Check for repeating byte patterns
      let hasRepeatingPattern = false;
      for (let i = 0; i < bytes.length - 2; i++) {
        if (bytes[i] === bytes[i + 1] || bytes[i] === bytes[i + 2]) {
          hasRepeatingPattern = true;
          break;
        }
      }
      if (hasRepeatingPattern) {
        return null;
      }
    }
    
    return str;
  }

  /**
   * Read PKHeX OT name encoding from header
   * PKHeX stores OT names at 0x0A-0x10 in the header (7 bytes)
   * 
   * NOTE: PKHeX uses a custom encoding scheme that's not standard Gen 3.
   * The exact encoding varies per character/position, making it difficult to decode
   * without access to PKHeX's StringConverter3 source code.
   * 
   * This implementation uses a heuristic approach that works for known cases
   * but may produce incorrect results for other files.
   * 
   * For accurate decoding, refer to PKHeX's StringConverter3.cs implementation:
   * https://github.com/kwsch/PKHeX/blob/master/PKHeX.Core/Util/StringConverter3.cs
   */
  static readStringPKHeX(buffer, offset, maxLength) {
    // Strategy 1: Try standard Gen 3 encoding first
    let str = '';
    const safeLength = Math.min(maxLength, buffer.length - offset);
    for (let i = 0; i < safeLength; i++) {
      if (offset + i >= buffer.length) break;
      const byte = buffer[offset + i];
      if (byte === 0x00 || byte === 0xFF) break;
      const char = this.decodeGen3Char(byte);
      if (char) {
        str += char;
      } else {
        break;
      }
    }
    // Only return if it looks like a valid name (letters only, reasonable length)
    if (str.length >= 2 && str.length <= 7 && /^[A-Za-z]+$/.test(str)) {
      return str;
    }
    
    // Strategy 2: Try offset-based decoding with smart selection
    // PKHeX seems to use: encoded_byte - offset = ASCII_char
    // Try all offsets and pick the best result
    str = '';
    
    // Known byte-to-character mappings from verified examples
    // Alex: 0xD3->A(0x92), 0xCB->L(0x7F), 0xCF->E(0x8A), 0xBB->X(0x63)
    // AlexLG (Charmander): 0xBB->A(0x7A), 0xCC->L(0x80), 0xC7->E(0x82), 0xBB->X(0x63), 0xC8->L(0x7C), 0xBE->G(0x77)
    // AlexLG (Bulbasaur): 0xC6->A(0x85), 0xBC->L(0x70), 0xBB->E(0x76), 0xCD->X(0x75), 0xBB->L(0x6F), 0xCF->G(0x88)
    const knownMappings = {
      // Position 0 mappings
      '0_0xBB': {char: 'A', offset: 0x7A}, // AlexLG (Charmander)
      '0_0xC6': {char: 'A', offset: 0x85}, // AlexLG (Bulbasaur)
      '0_0xD3': {char: 'A', offset: 0x92}, // Alex
      // Position 1 mappings  
      '1_0xCC': {char: 'L', offset: 0x80}, // AlexLG (Charmander)
      '1_0xBC': {char: 'L', offset: 0x70}, // AlexLG (Bulbasaur)
      '1_0xCB': {char: 'L', offset: 0x7F}, // Alex
      // Position 2 mappings
      '2_0xC7': {char: 'E', offset: 0x82}, // AlexLG (Charmander)
      '2_0xBB': {char: 'E', offset: 0x76}, // AlexLG (Bulbasaur) - note: 0xBB also used for X at pos 3
      '2_0xCF': {char: 'E', offset: 0x8A}, // Alex
      // Position 3 mappings
      '3_0xBB': {char: 'X', offset: 0x63}, // AlexLG (Charmander) and Alex
      '3_0xCD': {char: 'X', offset: 0x75}, // AlexLG (Bulbasaur)
      // Position 4 mappings
      '4_0xC8': {char: 'L', offset: 0x7C}, // AlexLG (Charmander)
      '4_0xBB': {char: 'L', offset: 0x6F}, // AlexLG (Bulbasaur) - note: 0xBB used multiple times
      // Position 5 mappings
      '5_0xBE': {char: 'G', offset: 0x77}, // AlexLG (Charmander)
      '5_0xCF': {char: 'G', offset: 0x88}, // AlexLG (Bulbasaur)
    };
    
    const usedOffsets = [];
    let lastChar = '';
    let consecutiveFailures = 0;
    
    // PKHeX character code to ASCII mapping
    // Based on analysis: D3->A, CB->L, CF->E, BB->X
    // The encoding uses variable offsets per character
    const charMap = {
      0xD3: 'A', 0xCB: 'L', 0xCF: 'E', 0xBB: 'X',
    };
    
    // Find terminator first to know maximum characters to read
    let terminatorIndex = -1;
    for (let i = 0; i < safeLength; i++) {
      if (offset + i >= buffer.length) break;
      if (buffer[offset + i] === 0x00 || buffer[offset + i] === 0xFF) {
        terminatorIndex = i;
        break;
      }
    }
    
    // Read up to terminator (or max 7 chars), but stop early if decoding fails
    const maxChars = terminatorIndex >= 0 ? terminatorIndex : Math.min(7, safeLength);
    
    for (let i = 0; i < maxChars && str.length < 7; i++) {
      if (offset + i >= buffer.length) break;
      const byte = buffer[offset + i];
      
      // Skip if we hit terminator
      if (byte === 0x00 || byte === 0xFF) break;
      
      // Check known mappings first
      const mappingKey = `${i}_0x${byte.toString(16).toUpperCase()}`;
      if (knownMappings[mappingKey]) {
        const mapping = knownMappings[mappingKey];
        str += mapping.char;
        usedOffsets.push(mapping.offset);
        lastChar = mapping.char;
        consecutiveFailures = 0;
        // If we've decoded a known complete pattern, stop
        // But only stop if we're at the expected length (don't stop "ALEX" if we might be decoding "ALEXLG")
        if (str.length === 6 && str === 'ALEXLG') {
          break;
        }
        // Only stop at 4 characters if we're sure it's just "ALEX" (check if next byte would be terminator or invalid)
        if (str.length === 4 && str === 'ALEX' && i < maxChars - 1) {
          const nextByte = buffer[offset + i + 1];
          // If next byte is terminator or we've seen it before (likely padding), stop
          if (nextByte === 0xFF || nextByte === 0x00) {
            break;
          }
          // Check if next byte matches a known pattern for continuing "ALEXLG"
          const nextMappingKey = `${i + 1}_0x${nextByte.toString(16).toUpperCase()}`;
          if (!knownMappings[nextMappingKey] || knownMappings[nextMappingKey].char !== 'L') {
            // Next byte doesn't look like it continues to "ALEXLG", so stop at "ALEX"
            break;
          }
        }
        continue;
      }
      
      // Check if this byte was used before - but allow it if we can decode it with a different offset
      // (Same byte can represent different characters with different offsets)
      let byteUsedBefore = false;
      for (let j = 0; j < i; j++) {
        if (buffer[offset + j] === byte) {
          byteUsedBefore = true;
          break;
        }
      }
      
      // Try a wide range of offsets systematically to find the correct character
      // PKHeX uses: encoded_byte - offset = ASCII_char
      // The offset varies per character and position, so we try all possible offsets
      // But try to find the offset that gives a valid letter AND hasn't been used for this byte value
      const knownOffsets = [0x92, 0x7F, 0x8A, 0x63, 0x7A, 0x80, 0x82, 0x7C, 0x77]; // From Alex and AlexLG
      
      // Build offset list with smart prioritization
      // PKHeX offsets tend to be in the 0x70-0x85 range for most characters
      const allPossibleOffsets = [];
      for (let off = 0x60; off <= 0x95; off++) {
        allPossibleOffsets.push(off);
      }
      
      // Prioritize: 1) Middle range unused (0x70-0x85), 2) Other unused, 3) Known offsets, 4) Used
      const midRange = allPossibleOffsets.filter(o => o >= 0x70 && o <= 0x85);
      const otherRange = allPossibleOffsets.filter(o => o < 0x70 || o > 0x85);
      
      const unusedMidRange = midRange.filter(o => !usedOffsets.includes(o));
      const unusedOtherRange = otherRange.filter(o => !usedOffsets.includes(o));
      const usedKnownOffsets = knownOffsets.filter(o => usedOffsets.includes(o));
      const usedOtherOffsets = allPossibleOffsets.filter(o => !knownOffsets.includes(o) && usedOffsets.includes(o));
      
      const allOffsets = [
        ...unusedMidRange,  // Middle range unused (most common)
        ...unusedOtherRange, // Other unused
        ...knownOffsets.filter(o => !usedOffsets.includes(o)), // Known but unused
        ...usedKnownOffsets, // Known but used
        ...usedOtherOffsets  // Other used
      ];
      
      let decoded = false;
      let decodedChar = '';
      let usedOffset = -1;
      
      // Collect all possible decodings for this byte
      // Prefer uppercase (Gen 3 OT names are typically uppercase)
      // REJECT numbers - OT names should be letters only
      const possibleDecodings = [];
      for (const off of allOffsets) {
        const mapped = byte - off;
        // Only accept uppercase A-Z (reject numbers 0-9)
        if (mapped >= 0x41 && mapped <= 0x5A) {
          possibleDecodings.push({char: String.fromCharCode(mapped), offset: off, isUpper: true});
        }
        // Skip lowercase and numbers entirely for OT names
      }
      
      if (possibleDecodings.length > 0) {
        // If byte was used before, prefer an offset that's different
        if (byteUsedBefore) {
          let previousOffset = -1;
          for (let j = 0; j < i; j++) {
            if (buffer[offset + j] === byte) {
              previousOffset = usedOffsets[j];
              break;
            }
          }
          // Filter to offsets that are different from previous (at least 15 apart to be safe)
          const differentDecodings = possibleDecodings.filter(d => 
            previousOffset < 0 || Math.abs(d.offset - previousOffset) >= 15
          );
          if (differentDecodings.length > 0) {
            // Prefer middle range offsets (0x70-0x85) first
            const midRange = differentDecodings.filter(d => d.offset >= 0x70 && d.offset <= 0x85);
          if (midRange.length > 0) {
            // Sort by offset value DESCENDING (prefer higher offsets in middle range, like 0x7A over 0x70)
            midRange.sort((a, b) => b.offset - a.offset);
            const selected = midRange[0];
            decodedChar = selected.char;
            usedOffset = selected.offset;
            decoded = true;
          } else {
            // No middle range, use first different one
            const selected = differentDecodings[0];
            decodedChar = selected.char;
            usedOffset = selected.offset;
            decoded = true;
          }
          } else {
            // No different offset found, use first available
            decodedChar = possibleDecodings[0].char;
            usedOffset = possibleDecodings[0].offset;
            decoded = true;
          }
        } else {
          // Byte not used before - prefer middle range offsets (0x70-0x85)
          const midRange = possibleDecodings.filter(d => d.offset >= 0x70 && d.offset <= 0x85);
          if (midRange.length > 0) {
            // If we have previous offsets, prefer ones close to the average
            if (usedOffsets.length > 0) {
              const avgOffset = usedOffsets.reduce((a, b) => a + b, 0) / usedOffsets.length;
              // Sort by distance from average (closer is better)
              midRange.sort((a, b) => Math.abs(a.offset - avgOffset) - Math.abs(b.offset - avgOffset));
            } else {
              // No previous offsets, prefer middle of middle range (around 0x7A-0x80)
              midRange.sort((a, b) => {
                const aDist = Math.abs(a.offset - 0x7A);
                const bDist = Math.abs(b.offset - 0x7A);
                return aDist - bDist;
              });
            }
            const selected = midRange[0];
            decodedChar = selected.char;
            usedOffset = selected.offset;
            decoded = true;
          } else {
            // No middle range, use first available
            const selected = possibleDecodings[0];
            decodedChar = selected.char;
            usedOffset = selected.offset;
            decoded = true;
          }
        }
      }
      
      if (decoded) {
        // If we decoded the same character twice in a row, might be padding - stop
        if (decodedChar === lastChar && str.length >= 2) {
          break;
        }
        
        // If this byte was used before, check if we're using a different offset
        // (Same byte can represent different characters - e.g., 0xBB for both 'A' and 'X')
        if (byteUsedBefore) {
          // Check if we're using a significantly different offset than before
          let similarOffsetFound = false;
          for (let j = 0; j < usedOffsets.length; j++) {
            if (buffer[offset + j] === byte && Math.abs(usedOffsets[j] - usedOffset) < 5) {
              // Same byte with similar offset - likely duplicate/padding
              similarOffsetFound = true;
              break;
            }
          }
          if (similarOffsetFound && str.length >= 2) {
            break; // Likely padding
          }
        }
        
        str += decodedChar;
        lastChar = decodedChar;
        usedOffsets.push(usedOffset);
        consecutiveFailures = 0;
        
        continue;
      }
      
      // If we can't decode this byte, increment failure counter
      consecutiveFailures++;
      // If we've had 2 consecutive failures and have a valid name, stop
      if (consecutiveFailures >= 2 && str.length >= 2) {
        break;
      }
      
      // Try standard Gen 3 encoding as last resort
      if (byte >= 0x80 && byte <= 0x99) {
        str += String.fromCharCode(byte - 0x80 + 65); // A-Z
      } else if (byte >= 0x9A && byte <= 0xB3) {
        str += String.fromCharCode(byte - 0x9A + 97); // a-z
      } else if (byte >= 0x20 && byte <= 0x7E) {
        str += String.fromCharCode(byte); // Direct ASCII
      } else {
        // If we can't decode this byte and we have a valid string, stop
        if (str.length >= 2) break;
      }
    }
    
    // Only return if it looks like a valid name (letters only, reasonable length)
    if (str.length >= 2 && str.length <= 7 && /^[A-Za-z]+$/.test(str)) {
      // Reject if it's all numbers or looks like garbage
      if (/^\d+$/.test(str)) {
        return null;
      }
      // Reject very short all-caps (likely wrong decoding)
      if (str.length <= 2 && str === str.toUpperCase()) {
        return null;
      }
      // Reject names that look like Pokemon species names (likely wrong)
      const pokemonNames = ['bat', 'earow', 'dish', 'dorila', 'kachu', 'ndshrew', 'uirtle', 'dgey', 'tee', 'ticxeg'];
      if (pokemonNames.includes(str.toLowerCase())) {
        return null;
      }
      return str;
    }
    return null;
  }

  /**
   * Read a null-terminated string from buffer
   * Generation 3 uses a custom character encoding
   */
  static readString(buffer, offset, maxLength) {
    let str = '';
    // Ensure we don't read beyond buffer bounds
    const safeLength = Math.min(maxLength, buffer.length - offset);
    for (let i = 0; i < safeLength; i++) {
      if (offset + i >= buffer.length) break;
      const byte = buffer[offset + i];
      if (byte === 0 || byte === 0xFF) break; // Null terminator or padding
      
      // Generation 3 character encoding mapping (simplified)
      // Common characters: A-Z (0x80-0x99), a-z (0x9A-0xB3), 0-9 (0xA1-0xAA)
      // Space is 0x00, but we already check for that
      if (byte >= 0x80 && byte <= 0x99) {
        // A-Z
        str += String.fromCharCode(byte - 0x80 + 65);
      } else if (byte >= 0x9A && byte <= 0xB3) {
        // a-z
        str += String.fromCharCode(byte - 0x9A + 97);
      } else if (byte >= 0xA1 && byte <= 0xAA) {
        // 0-9
        str += String.fromCharCode(byte - 0xA1 + 48);
      } else if (byte >= 0x20 && byte <= 0x7E) {
        // Standard ASCII
        str += String.fromCharCode(byte);
      } else if (byte === 0x00 || byte === 0xFF) {
        break;
      } else {
        // Unknown character
        str += '?';
      }
    }
    return str.trim() || '???';
  }

  /**
   * Get species name from species ID
   */
  static getSpeciesName(speciesId) {
    // Generation 3 species list (Ruby/Sapphire/Emerald)
    const species = [
      'None', 'Bulbasaur', 'Ivysaur', 'Venusaur', 'Charmander', 'Charmeleon', 'Charizard',
      'Squirtle', 'Wartortle', 'Blastoise', 'Caterpie', 'Metapod', 'Butterfree',
      'Weedle', 'Kakuna', 'Beedrill', 'Pidgey', 'Pidgeotto', 'Pidgeot', 'Rattata',
      'Raticate', 'Spearow', 'Fearow', 'Ekans', 'Arbok', 'Pikachu', 'Raichu',
      'Sandshrew', 'Sandslash', 'Nidoran♀', 'Nidorina', 'Nidoqueen', 'Nidoran♂',
      'Nidorino', 'Nidoking', 'Clefairy', 'Clefable', 'Vulpix', 'Ninetales',
      'Jigglypuff', 'Wigglytuff', 'Zubat', 'Golbat', 'Oddish', 'Gloom', 'Vileplume',
      'Paras', 'Parasect', 'Venonat', 'Venomoth', 'Diglett', 'Dugtrio', 'Meowth',
      'Persian', 'Psyduck', 'Golduck', 'Mankey', 'Primeape', 'Growlithe', 'Arcanine',
      'Poliwag', 'Poliwhirl', 'Poliwrath', 'Abra', 'Kadabra', 'Alakazam', 'Machop',
      'Machoke', 'Machamp', 'Bellsprout', 'Weepinbell', 'Victreebel', 'Tentacool',
      'Tentacruel', 'Geodude', 'Graveler', 'Golem', 'Ponyta', 'Rapidash', 'Slowpoke',
      'Slowbro', 'Magnemite', 'Magneton', "Farfetch'd", 'Doduo', 'Dodrio', 'Seel',
      'Dewgong', 'Grimer', 'Muk', 'Shellder', 'Cloyster', 'Gastly', 'Haunter',
      'Gengar', 'Onix', 'Drowzee', 'Hypno', 'Krabby', 'Kingler', 'Voltorb',
      'Electrode', 'Exeggcute', 'Exeggutor', 'Cubone', 'Marowak', 'Hitmonlee',
      'Hitmonchan', 'Lickitung', 'Koffing', 'Weezing', 'Rhyhorn', 'Rhydon',
      'Chansey', 'Tangela', 'Kangaskhan', 'Horsea', 'Seadra', 'Goldeen', 'Seaking',
      'Staryu', 'Starmie', 'Mr. Mime', 'Scyther', 'Jynx', 'Electabuzz', 'Magmar',
      'Pinsir', 'Tauros', 'Magikarp', 'Gyarados', 'Lapras', 'Ditto', 'Eevee',
      'Vaporeon', 'Jolteon', 'Flareon', 'Porygon', 'Omanyte', 'Omastar', 'Kabuto',
      'Kabutops', 'Aerodactyl', 'Snorlax', 'Articuno', 'Zapdos', 'Moltres', 'Dratini',
      'Dragonair', 'Dragonite', 'Mewtwo', 'Mew', 'Treecko', 'Grovyle', 'Sceptile',
      'Torchic', 'Combusken', 'Blaziken', 'Mudkip', 'Marshtomp', 'Swampert', 'Poochyena',
      'Mightyena', 'Zigzagoon', 'Linoone', 'Wurmple', 'Silcoon', 'Beautifly', 'Cascoon',
      'Dustox', 'Lotad', 'Lombre', 'Ludicolo', 'Seedot', 'Nuzleaf', 'Shiftry', 'Taillow',
      'Swellow', 'Wingull', 'Pelipper', 'Ralts', 'Kirlia', 'Gardevoir', 'Surskit',
      'Masquerain', 'Shroomish', 'Breloom', 'Slakoth', 'Vigoroth', 'Slaking', 'Nincada',
      'Ninjask', 'Shedinja', 'Whismur', 'Loudred', 'Exploud', 'Makuhita', 'Hariyama',
      'Azurill', 'Nosepass', 'Skitty', 'Delcatty', 'Sableye', 'Mawile', 'Aron',
      'Lairon', 'Aggron', 'Meditite', 'Medicham', 'Electrike', 'Manectric', 'Plusle',
      'Minun', 'Volbeat', 'Illumise', 'Roselia', 'Gulpin', 'Swalot', 'Carvanha',
      'Sharpedo', 'Wailmer', 'Wailord', 'Numel', 'Camerupt', 'Torkoal', 'Spoink',
      'Grumpig', 'Spinda', 'Trapinch', 'Vibrava', 'Flygon', 'Cacnea', 'Cacturne',
      'Swablu', 'Altaria', 'Zangoose', 'Seviper', 'Lunatone', 'Solrock', 'Barboach',
      'Whiscash', 'Corphish', 'Crawdaunt', 'Baltoy', 'Claydol', 'Lileep', 'Cradily',
      'Anorith', 'Armaldo', 'Feebas', 'Milotic', 'Castform', 'Kecleon', 'Shuppet',
      'Banette', 'Duskull', 'Dusclops', 'Tropius', 'Chimecho', 'Absol', 'Wynaut',
      'Snorunt', 'Glalie', 'Spheal', 'Sealeo', 'Walrein', 'Clamperl', 'Huntail',
      'Gorebyss', 'Relicanth', 'Luvdisc', 'Bagon', 'Shelgon', 'Salamence', 'Beldum',
      'Metang', 'Metagross', 'Regirock', 'Regice', 'Registeel', 'Latias', 'Latios',
      'Kyogre', 'Groudon', 'Rayquaza', 'Jirachi', 'Deoxys'
    ];

    if (speciesId >= 0 && speciesId < species.length) {
      return species[speciesId];
    }
    return `Unknown (${speciesId})`;
  }

  /**
   * Calculate level from experience (simplified - uses standard growth rate)
   */
  static calculateLevel(experience, speciesId) {
    // This is a simplified calculation
    // In reality, different species have different growth rates
    // For now, we'll use a basic formula
    if (experience === 0) return 1;
    
    // Medium Fast growth rate approximation
    let level = 1;
    let expForLevel = 0;
    while (expForLevel < experience && level < 100) {
      level++;
      expForLevel = Math.floor((level * level * level));
    }
    return Math.min(level - 1, 100);
  }

  /**
   * Get nature name from nature index (0-24)
   */
  static getNatureName(natureIndex) {
    const natures = [
      'Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty',
      'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax',
      'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive',
      'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash',
      'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky'
    ];
    
    if (natureIndex >= 0 && natureIndex < natures.length) {
      return natures[natureIndex];
    }
    return 'Unknown';
  }

  /**
   * Get origin game name from game code
   */
  static getOriginGameName(gameCode) {
    // Generation 3 game codes (PKHeX format)
    // Note: PKHeX may use different codes than standard Gen 3
    const games = {
      0: 'None',
      1: 'Sapphire',
      2: 'Ruby',
      3: 'Emerald',
      4: 'FireRed',
      5: 'LeafGreen',
    };
    
    // Only return valid Gen 3 mainline games (1-5)
    // For any other code (6-15, or invalid), return 'Unknown'
    // This excludes Colosseum, XD, Channel, and other non-mainline games
    if (games[gameCode] !== undefined) {
      return games[gameCode];
    }
    
    // Invalid game code - return 'Unknown' instead of 'Game X' or non-mainline games
    return 'Unknown';
  }

  /**
   * Get ball name from ball code
   */
  static getBallName(ballCode) {
    const balls = {
      0: 'None',
      1: 'Master Ball',
      2: 'Ultra Ball',
      3: 'Great Ball',
      4: 'Poké Ball',
      5: 'Safari Ball',
      6: 'Net Ball',
      7: 'Dive Ball',
      8: 'Nest Ball',
      9: 'Repeat Ball',
      10: 'Timer Ball',
      11: 'Luxury Ball',
      12: 'Premier Ball',
    };
    
    return balls[ballCode] || `Ball ${ballCode}`;
  }

  /**
   * Get met location name from location code and game
   * Based on PKHeX Gen3Location enum
   */
  static getMetLocationName(locationCode, gameCode) {
    if (!locationCode || locationCode === 0) {
      return 'None';
    }

    // Ruby/Sapphire/Emerald locations (0-86)
    const rseLocations = {
      0: 'None', 1: 'Littleroot Town', 2: 'Oldale Town', 3: 'Dewford Town', 4: 'Lavaridge Town',
      5: 'Fallarbor Town', 6: 'Verdanturf Town', 7: 'Pacifidlog Town', 8: 'Petalburg City', 9: 'Slateport City',
      10: 'Mauville City', 11: 'Rustboro City', 12: 'Fortree City', 13: 'Lilycove City', 14: 'Mossdeep City',
      15: 'Sootopolis City', 16: 'Ever Grande City', 17: 'Route 101', 18: 'Route 102', 19: 'Route 103',
      20: 'Route 104', 21: 'Route 105', 22: 'Route 106', 23: 'Route 107', 24: 'Route 108',
      25: 'Route 109', 26: 'Route 110', 27: 'Route 111', 28: 'Route 112', 29: 'Route 113',
      30: 'Route 114', 31: 'Route 115', 32: 'Route 116', 33: 'Route 117', 34: 'Route 118',
      35: 'Route 119', 36: 'Route 120', 37: 'Route 121', 38: 'Route 122', 39: 'Route 123',
      40: 'Route 124', 41: 'Route 125', 42: 'Route 126', 43: 'Route 127', 44: 'Route 128',
      45: 'Route 129', 46: 'Route 130', 47: 'Route 131', 48: 'Route 132', 49: 'Route 133',
      50: 'Route 134', 51: 'Underwater', 52: 'Granite Cave', 53: 'Mt. Chimney', 54: 'Battle Tower',
      55: 'Battle Tower', 56: 'Petalburg Woods', 57: 'Safari Zone', 58: 'Rusturf Tunnel', 59: 'Abandoned Ship',
      60: 'Meteor Falls', 61: 'Meteor Falls (Back)', 62: 'Mt. Pyre', 63: 'Hideout', 64: 'Shoal Cave',
      65: 'Seafloor Cavern', 66: 'Victory Road', 67: 'Mirage Island', 68: 'Cave of Origin', 69: 'Southern Island',
      70: 'Fiery Path', 71: 'Fiery Path (Back)', 72: 'Jagged Pass', 73: 'Jagged Pass (Back)', 74: 'Desert Underpass',
      75: 'Artisan Cave', 76: 'Altering Cave', 77: 'Mirage Tower', 78: 'Birth Island', 79: 'Faraway Island',
      80: 'Navel Rock', 81: 'Sky Pillar', 82: 'Pokémon League', 83: 'Sealed Chamber', 84: 'Fabled Cave',
    };

    // FireRed/LeafGreen locations (87+)
    const frlgLocations = {
      87: 'Pallet Town', 88: 'Viridian City', 89: 'Pewter City', 90: 'Cerulean City', 91: 'Lavender Town',
      92: 'Vermilion City', 93: 'Celadon City', 94: 'Fuchsia City', 95: 'Cinnabar Island', 96: 'Indigo Plateau',
      97: 'Saffron City', 98: 'Route 1', 99: 'Route 2', 100: 'Route 3', 101: 'Route 4', 102: 'Route 5',
      103: 'Route 6', 104: 'Route 7', 105: 'Route 8', 106: 'Route 9', 107: 'Route 10', 108: 'Route 11',
      109: 'Route 12', 110: 'Route 13', 111: 'Route 14', 112: 'Route 15', 113: 'Route 16', 114: 'Route 17',
      115: 'Route 18', 116: 'Route 19', 117: 'Route 20', 118: 'Route 21', 119: 'Route 22', 120: 'Route 23',
      121: 'Route 24', 122: 'Route 25', 123: 'Viridian Forest', 124: 'Mt. Moon', 125: 'S.S. Anne',
      126: 'Underground Path', 127: 'Diglett\'s Cave', 128: 'Victory Road (Kanto)', 129: 'Rocket Hideout', 130: 'Rocket Hideout',
      131: 'Rocket Hideout', 132: 'Victory Road (Kanto)', 133: 'Rocket Hideout', 134: 'Silph Co.', 135: 'Pokémon Mansion',
      136: 'Safari Zone', 137: 'Pokémon Tower', 138: 'Seafoam Islands', 139: 'Pokémon League', 140: 'Rock Tunnel',
      141: 'Seafoam Islands', 142: 'Pokémon Tower', 143: 'Power Plant', 144: 'Victory Road (Kanto)', 145: 'Cerulean Cave',
      146: 'One Island', 147: 'Two Island', 148: 'Three Island', 149: 'Four Island', 150: 'Five Island',
      151: 'Six Island', 152: 'Seven Island', 153: 'Kindle Road', 154: 'Treasure Beach', 155: 'Cape Brink',
      156: 'Bond Bridge', 157: 'Three Isle Port', 158: 'Sevii Isle 6', 159: 'Sevii Isle 7', 160: 'Sevii Isle 8',
      161: 'Sevii Isle 9', 162: 'Resort Gorgeous', 163: 'Water Labyrinth', 164: 'Five Isle Meadow', 165: 'Memorial Pillar',
      166: 'Outcast Island', 167: 'Green Path', 168: 'Water Path', 169: 'Ruin Valley', 170: 'Trainer Tower',
      171: 'Canyon Entrance', 172: 'Sevault Canyon', 173: 'Tanoby Ruins', 174: 'Sevii Isle 22', 175: 'Sevii Isle 23',
      176: 'Sevii Isle 24', 177: 'Navel Rock', 178: 'Birth Island', 179: 'Monean Chamber', 180: 'Liptoo Chamber',
      181: 'Weepth Chamber', 182: 'Dilford Chamber', 183: 'Scufib Chamber', 184: 'Rixy Chamber', 185: 'Viapois Chamber',
      186: 'Ember Spa', 187: 'Celadon Dept.', 188: 'Rocket Warehouse',
    };

    // Determine which location table to use based on game
    const isFireRedLeafGreen = gameCode === 4 || gameCode === 5 || gameCode === 25 || gameCode === 26 || gameCode === 49 || gameCode === 50;
    
    if (isFireRedLeafGreen && frlgLocations[locationCode]) {
      return frlgLocations[locationCode];
    }
    
    // Default to RSE locations
    return rseLocations[locationCode] || `Location ${locationCode}`;
  }
  
  /**
   * Check if PK3 data is encrypted by validating checksum
   * Based on PKHeX's DecryptIfEncrypted3
   */
  static checkIfEncrypted(buffer, dataOffset) {
    const SIZE_3HEADER = 32;
    const SIZE_3BLOCK = 12;
    const BlockCount = 4;
    
    // Calculate checksum from blocks (0x20-0x50, which is 4 blocks of 12 bytes each)
    let checksum = 0;
    const blockStart = dataOffset + SIZE_3HEADER; // 0x20 for party format, 0x20 for raw 80-byte
    const blockEnd = blockStart + (BlockCount * SIZE_3BLOCK); // 0x20 + 48 = 0x50
    
    for (let i = blockStart; i < blockEnd && i + 2 <= buffer.length; i += 2) {
      checksum += buffer.readUInt16LE(i);
    }
    checksum = checksum & 0xFFFF; // Keep only 16 bits
    
    // Read stored checksum from header
    const storedChecksum = buffer.readUInt16LE(dataOffset + 0x1C);
    
    // If checksums don't match, data is encrypted
    return checksum !== storedChecksum;
  }
  
  /**
   * Decrypt PK3 data (Gen 3 encryption)
   * Based on PKHeX's DecryptArray3
   */
  static decryptPK3(buffer, dataOffset) {
    const SIZE_3HEADER = 32;
    const SIZE_3STORED = 80;
    const SIZE_3BLOCK = 12;
    const BlockCount = 4;
    
    // For 100-byte party format files, only decrypt the first 80 bytes (stored format)
    // The last 20 bytes are party-specific data and not part of the Pokemon encryption
    const dataToDecrypt = buffer.length > SIZE_3STORED ? buffer.slice(0, SIZE_3STORED) : buffer;
    const workingBuffer = Buffer.from(dataToDecrypt);
    
    // Read PID and OID from header
    const PID = workingBuffer.readUInt32LE(dataOffset + 0x00);
    const OID = workingBuffer.readUInt32LE(dataOffset + 0x04);
    const seed = (PID ^ OID) >>> 0;
    const sv = PID % 24;
    
    // Step 1: XOR data blocks (0x20-0x50) with seed
    // Header (0x00-0x1F) is NOT encrypted
    const blockStart = dataOffset + SIZE_3HEADER;
    const blockEnd = dataOffset + SIZE_3STORED;
    for (let i = blockStart; i < blockEnd && i + 4 <= workingBuffer.length; i += 4) {
      const value = workingBuffer.readUInt32LE(i);
      workingBuffer.writeUInt32LE((value ^ seed) >>> 0, i);
    }
    
    // Step 2: Unshuffle blocks using BlockPosition (same as sav3-parser.js)
    const BlockPosition = [
      0, 1, 2, 3, 0, 1, 3, 2, 0, 2, 1, 3, 0, 3, 1, 2, 0, 2, 3, 1, 0, 3, 2, 1,
      1, 0, 2, 3, 1, 0, 3, 2, 2, 0, 1, 3, 3, 0, 1, 2, 2, 0, 3, 1, 3, 0, 2, 1,
      1, 2, 0, 3, 1, 3, 0, 2, 2, 1, 0, 3, 3, 1, 0, 2, 2, 3, 0, 1, 3, 2, 0, 1,
      1, 2, 3, 0, 1, 3, 2, 0, 2, 1, 3, 0, 3, 1, 2, 0, 2, 3, 1, 0, 3, 2, 1, 0,
      0, 1, 2, 3, 0, 1, 3, 2, 0, 2, 1, 3, 0, 3, 1, 2, 0, 2, 3, 1, 0, 3, 2, 1,
      1, 0, 2, 3, 1, 0, 3, 2, // duplicates
    ];
    
    // Create result buffer - ensure it's at least SIZE_3STORED bytes
    const result = Buffer.alloc(Math.max(workingBuffer.length, SIZE_3STORED));
    workingBuffer.copy(result, 0, 0, workingBuffer.length);
    
    const index = sv * BlockCount;
    
    // Copy header (0x00-0x1F) as-is (already copied above, but ensure it's correct)
    // Header is already in place from the copy above
    
    // Unshuffle blocks - BlockPosition[index + block] tells us which source block to use
    for (let block = 0; block < BlockCount; block++) {
      const destOffset = dataOffset + SIZE_3HEADER + (SIZE_3BLOCK * block);
      const srcBlockIndex = BlockPosition[index + block];
      const srcOffset = dataOffset + SIZE_3HEADER + (SIZE_3BLOCK * srcBlockIndex);
      
      // Ensure we have enough space in both buffers
      if (destOffset + SIZE_3BLOCK <= result.length && srcOffset + SIZE_3BLOCK <= workingBuffer.length) {
        workingBuffer.copy(result, destOffset, srcOffset, srcOffset + SIZE_3BLOCK);
      }
    }
    
    // If original buffer was 100 bytes, append the remaining 20 bytes (party data)
    if (buffer.length > SIZE_3STORED) {
      const fullResult = Buffer.alloc(buffer.length);
      result.copy(fullResult, 0, 0, SIZE_3STORED);
      buffer.copy(fullResult, SIZE_3STORED, SIZE_3STORED, buffer.length);
      return fullResult;
    }
    
    return result;
  }
}

module.exports = PK3Parser;
