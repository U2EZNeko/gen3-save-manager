/**
 * PK6 Parser for Generation 6 Pokemon files
 * Basic support for extracting common data from these formats
 */

const utils = require('./pk-utils');

class PK6Parser {
  /**
   * Detect file format based on size (pk6 only)
   * PKHeX export formats have headers, so sizes vary:
   * - pk6: 232 bytes (raw) or 260 bytes (PKHeX export with 28-byte header)
   */
  static detectFormat(buffer) {
    const size = buffer.length;
    
    // Safety check: must be at least 232 bytes (pk6 raw size)
    if (size < 232) {
      return null;
    }
    
    // Check for pk6 (Gen 6) - can be 232 (raw) or 260 (PKHeX export)
    if (size === 232 || size === 260) {
      return 'pk6';
    }
    
    // For sizes > 260, check species to determine if it's pk6
    if (size > 260) {
      if (utils.isValidSpeciesAtOffset(buffer, 0x08, 721)) return 'pk6';
    }
    
    return null;
  }
  
  /**
   * Determine if file is PKHeX export format and get data offset
   * PKHeX exports may have headers, but often the Pokemon data starts at offset 0x00
   */
  static getDataOffset(buffer, format) {
    const size = buffer.length;
    
    // For PK6 files that are exactly 260 bytes, check both possibilities:
    // 1. Data at start (0x00) - Pokemon data is 232 bytes, extra 28 bytes at end
    // 2. Data with header (0x1C) - 28-byte header, then 232 bytes of Pokemon data
    if (format === 'pk6' && size === 260) {
      // First check if species is valid at offset 0x08 (data at start)
      if (utils.isValidSpeciesAtOffset(buffer, 0x08, 721)) {
        return 0x00; // Data starts at beginning, extra bytes at end
      }
      // Then check if species is valid at offset 0x24 (0x1C header + 0x08 species offset)
      if (utils.isValidSpeciesAtOffset(buffer, 0x24, 721)) {
        return 0x1C; // 28-byte header
      }
      // Also check 0x20 header (32 bytes) as fallback: 0x20 + 0x08 = 0x28
      if (utils.isValidSpeciesAtOffset(buffer, 0x28, 721)) {
        return 0x20;
      }
      // Default: assume data at start (most common for PKHeX exports)
      return 0x00;
    }
    
    // For other sizes, check if valid Pokemon data exists at offset 0x00 first
    if (utils.isValidSpeciesAtOffset(buffer, 0x08, 721)) {
      return 0x00; // Pokemon data starts at beginning
    }
    
    // Default: assume data starts at 0x00
    return 0x00;
  }

  /**
   * Parse a .pk6 file buffer
   */
  static parse(buffer, filename = null) {
    const format = this.detectFormat(buffer);
    if (!format) {
      // Try to provide more helpful error message
      const size = buffer.length;
      throw new Error(`Invalid file size: ${size} bytes (expected 232 or 260 for pk6)`);
    }

    // Determine if PKHeX export format and get data offset
    const dataOffset = this.getDataOffset(buffer, format);
    
    // Debug: Log dataOffset for troubleshooting
    if (dataOffset !== 0) {
      console.log(`[PK6Parser] Using dataOffset: ${dataOffset} for ${format} file (size: ${buffer.length})`);
    }

    // Gen 6 offsets (from PKHeX.Core/PKM/PK6.cs)
    let speciesOffset = 0x08;
    let pidOffset = 0x18; // PID at 0x18 (EncryptionConstant at 0x00)
    let tidOffset = 0x0C;
    let sidOffset = 0x0E;
    let otNameOffset = 0xB0; // OriginalTrainerTrash: Data.Slice(0xB0, 26)
    let nicknameOffset = 0x40; // NicknameTrash: Data.Slice(0x40, 26)
    let ivOffset = 0x74; // IV32 at 0x74 (packed 32-bit value)
    let levelOffset = 0xEC; // Stat_Level at 0xEC (NOT 0x8E!)
    let hpCurrentOffset = 0xF0; // Stat_HPCurrent at 0xF0 (16-bit)
    let hpMaxOffset = 0xF2; // Stat_HPMax at 0xF2 (16-bit)
    let natureOffset = 0x1C; // Nature at 0x1C (NOT 0x1D!)
    let abilityOffset = 0x14;
    let isShinyOffset = 0x30; // Shiny flag location
    let move1Offset = 0x5A;
    let move2Offset = 0x5C;
    let move3Offset = 0x5E;
    let move4Offset = 0x60;
    let move1PPOffset = 0x62; // Move1_PP at 0x62
    let move2PPOffset = 0x63; // Move2_PP at 0x63
    let move3PPOffset = 0x64; // Move3_PP at 0x64
    let move4PPOffset = 0x65; // Move4_PP at 0x65
    let evHpOffset = 0x1E;
    let evAtkOffset = 0x1F;
    let evDefOffset = 0x20;
    let evSpAOffset = 0x22;
    let evSpDOffset = 0x23;
    let evSpeOffset = 0x21;
    let ballOffset = 0xDC; // Ball at 0xDC for PK6 (NOT 0x86!)
    let metLocationOffset = 0xDA; // MetLocation at 0xDA for PK6 (NOT 0x84!)
    let originGameOffset = 0xDF; // Version at 0xDF for PK6 (NOT 0x87!)
    let experienceOffset = 0x10; // EXP at 0x10 (32-bit)
    let heldItemOffset = 0x0A; // HeldItem at 0x0A (16-bit)
    let formOffset = 0x1D; // Form at 0x1D (bits 3-7)
    
    // Adjust all offsets by dataOffset (for PKHeX export format with header)
    speciesOffset += dataOffset;
    pidOffset += dataOffset;
    tidOffset += dataOffset;
    sidOffset += dataOffset;
    otNameOffset += dataOffset;
    nicknameOffset += dataOffset;
    ivOffset += dataOffset;
    levelOffset += dataOffset;
    hpCurrentOffset += dataOffset;
    hpMaxOffset += dataOffset;
    natureOffset += dataOffset;
    abilityOffset += dataOffset;
    isShinyOffset += dataOffset;
    move1Offset += dataOffset;
    move2Offset += dataOffset;
    move3Offset += dataOffset;
    move4Offset += dataOffset;
    move1PPOffset += dataOffset;
    move2PPOffset += dataOffset;
    move3PPOffset += dataOffset;
    move4PPOffset += dataOffset;
    evHpOffset += dataOffset;
    evAtkOffset += dataOffset;
    evDefOffset += dataOffset;
    evSpAOffset += dataOffset;
    evSpDOffset += dataOffset;
    evSpeOffset += dataOffset;
    ballOffset += dataOffset;
    metLocationOffset += dataOffset;
    originGameOffset += dataOffset;
    experienceOffset += dataOffset;
    heldItemOffset += dataOffset;
    formOffset += dataOffset;

    const safeReadUInt16LE = (offset) => {
      if (offset + 2 > buffer.length) return 0;
      return buffer.readUInt16LE(offset);
    };

    const safeReadUInt32LE = (offset) => {
      if (offset + 4 > buffer.length) return 0;
      return buffer.readUInt32LE(offset);
    };

    const safeReadByte = (offset) => {
      if (offset >= buffer.length) return 0;
      return buffer[offset];
    };

    // Extract basic data
    const personality = safeReadUInt32LE(pidOffset);
    let species = safeReadUInt16LE(speciesOffset);
    const tid = safeReadUInt16LE(tidOffset);
    const sid = safeReadUInt16LE(sidOffset);
    
    // Validate that we got valid data (species should be 1-721)
    if (species === 0 || species > 721) {
      throw new Error(`Invalid species ID: ${species} at offset ${speciesOffset} (dataOffset: ${dataOffset}). File might be encrypted or have wrong format.`);
    }
    
    // Nature: PK6 stores it directly
    let nature = safeReadByte(natureOffset);
    // Validate it - if invalid, use PID%25 as fallback
    if (nature > 24) {
      nature = personality % 25; // Fallback to PID-based nature
    }
    
    // Ensure nature is valid (0-24)
    if (nature < 0 || nature > 24) {
      nature = personality % 25; // Final fallback
    }
    
    // Read level
    let level = safeReadByte(levelOffset);
    
    // Read HP (16-bit values)
    let hpCurrent = safeReadUInt16LE(hpCurrentOffset);
    let hpMax = safeReadUInt16LE(hpMaxOffset);
    
    // For PK6 export files, stats might not be stored (all zeros)
    // Calculate level from EXP if level is 0
    if (level === 0 || level > 100) {
      const exp = safeReadUInt32LE(experienceOffset);
      if (exp > 0) {
        // Gen 6 EXP formula approximation
        // Level 100 Pokemon have EXP around 1,000,000-1,250,000 depending on growth rate
        if (exp >= 1000000 && exp <= 1640000) {
          // Level 100 range (most growth rates)
          level = 100;
        } else {
          // Rough approximation: EXP ≈ level^3 * growth_rate_factor
          // For most Pokemon, level ≈ cube root of (EXP / 100)
          level = Math.min(100, Math.max(1, Math.floor(Math.pow(exp / 100, 1/3))));
        }
      } else {
        level = 1; // Default if no EXP
      }
    }
    
    const ability = safeReadByte(abilityOffset);
    
    // Determine shiny status (PK6: Check IV32 bit 31 for shiny flag, or calculate from PID/TID/SID)
    let isShiny = false;
    const iv32 = safeReadUInt32LE(ivOffset);
    isShiny = ((iv32 >> 31) & 1) !== 0;
    // Also check PID/TID/SID calculation as fallback
    if (!isShiny) {
      const shinyValue = (tid ^ sid ^ (personality & 0xFFFF) ^ (personality >> 16));
      isShiny = shinyValue < 8;
    }
    
    // Validate species
    if (species === 0 || species > 721) {
      throw new Error(`Invalid species ID: ${species} (expected 1-721)`);
    }
    
    // Extract IVs (packed in 32-bit value)
    const ivs = utils.extractIVs(buffer, ivOffset);
    
    // Extract EVs (individual bytes)
    const evs = {
      hp: Math.min(safeReadByte(evHpOffset) || 0, 255),
      attack: Math.min(safeReadByte(evAtkOffset) || 0, 255),
      defense: Math.min(safeReadByte(evDefOffset) || 0, 255),
      spAttack: Math.min(safeReadByte(evSpAOffset) || 0, 255),
      spDefense: Math.min(safeReadByte(evSpDOffset) || 0, 255),
      speed: Math.min(safeReadByte(evSpeOffset) || 0, 255),
    };
    
    // Extract moves
    const move1 = safeReadUInt16LE(move1Offset);
    const move2 = safeReadUInt16LE(move2Offset);
    const move3 = safeReadUInt16LE(move3Offset);
    const move4 = safeReadUInt16LE(move4Offset);
    
    // Extract move PP
    const move1PP = move1 > 0 ? safeReadByte(move1PPOffset) : 0;
    const move2PP = move2 > 0 ? safeReadByte(move2PPOffset) : 0;
    const move3PP = move3 > 0 ? safeReadByte(move3PPOffset) : 0;
    const move4PP = move4 > 0 ? safeReadByte(move4PPOffset) : 0;
    
    // Debug: Log if moves exist but PP is 0 (might indicate wrong offset)
    if ((move1 > 0 && move1PP === 0) || (move2 > 0 && move2PP === 0) || (move3 > 0 && move3PP === 0) || (move4 > 0 && move4PP === 0)) {
      console.warn(`[PK6Parser] Warning: Move exists but PP is 0. Moves: [${move1}, ${move2}, ${move3}, ${move4}], PP: [${move1PP}, ${move2PP}, ${move3PP}, ${move4PP}]`);
      console.warn(`[PK6Parser] PP offsets: [${move1PPOffset}, ${move2PPOffset}, ${move3PPOffset}, ${move4PPOffset}], dataOffset: ${dataOffset}`);
    }
    
    // Extract strings (lengths for pk6)
    const nicknameLength = 26;
    const otNameLength = 26;
    const otName = utils.readString(buffer, otNameOffset, otNameLength, format) || 'Unknown OT';
    const nickname = utils.readString(buffer, nicknameOffset, nicknameLength, format);
    
    // Extract other data
    const ball = safeReadByte(ballOffset) || 4; // Default to Poke Ball
    const metLocation = safeReadUInt16LE(metLocationOffset);
    const originGame = safeReadByte(originGameOffset) || 0;
    
    // Read Experience (32-bit value at 0x10)
    const experience = safeReadUInt32LE(experienceOffset);
    
    // Read HeldItem and Form (PK6 only)
    let heldItem = 0;
    let form = 0;
    if (heldItemOffset !== undefined) {
      heldItem = safeReadUInt16LE(heldItemOffset);
    }
    if (formOffset !== undefined) {
      // Form is stored in bits 3-7 of byte at 0x1D
      form = (safeReadByte(formOffset) >> 3) & 0x1F;
    }
    
    // Calculate sums
    const ivSum = ivs.hp + ivs.attack + ivs.defense + ivs.speed + ivs.spAttack + ivs.spDefense;
    const evSum = evs.hp + evs.attack + evs.defense + evs.speed + evs.spAttack + evs.spDefense;
    
    // Get names from maps
    const ballName = utils.getBallName(ball);
    const natureName = utils.getNatureName(nature);
    const originGameName = utils.getGameName(originGame);
    
    // Met location name lookup
    const metLocationName = utils.getLocationNameGen6(metLocation);
    
    return {
      format,
      species,
      personality,
      tid,
      sid,
      tidSid: (tid | (sid << 16)),
      otName,
      nickname,
      nature,
      level,
      hp: hpMax || hpCurrent || 0, // Use max HP, fallback to current, then 0
      hpCurrent: hpCurrent || 0,
      hpMax: hpMax || 0,
      maxHP: hpMax || 0, // Also provide maxHP for frontend compatibility
      hpNeedsCalculation: (hpMax === 0 && hpCurrent === 0), // Flag for frontend to calculate HP
      evHP: evs.hp, // Also provide evHP for frontend compatibility
      ability,
      isShiny,
      experience: experience || 0,
      ivs,
      ivSum,
      evs,
      evSum,
      move1,
      move2,
      move3,
      move4,
      move1PP: move1PP || 0,
      move2PP: move2PP || 0,
      move3PP: move3PP || 0,
      move4PP: move4PP || 0,
      // Also provide pp1-pp4 for frontend compatibility
      pp1: move1PP || 0,
      pp2: move2PP || 0,
      pp3: move3PP || 0,
      pp4: move4PP || 0,
      ball,
      ballName, // Ball name for display
      metLocation,
      metLocationName, // Met location name for display
      originGame,
      originGameName, // Origin game name for display
      natureName, // Nature name for display
      heldItem: heldItem || 0,
      form: form || 0,
      isGen3: false,
      generation: 6,
    };
  }
}

module.exports = PK6Parser;

