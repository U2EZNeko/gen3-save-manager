/**
 * PK4/PK5 Parser for Generation 4 and 5 Pokemon files
 * Basic support for extracting common data from these formats
 */

const utils = require('./pk-utils');

class PK4Parser {
  /**
   * Detect file format based on size (pk4 or pk5)
   * PKHeX export formats have headers, so sizes vary:
   * - pk4: 136 bytes (raw) or 136+ bytes (PKHeX export, e.g., 236 bytes)
   * - pk5: 220 bytes (raw) or 220+ bytes (PKHeX export)
   */
  static detectFormat(buffer) {
    const size = buffer.length;
    
    // Safety check: must be at least 136 bytes (smallest pk4 size)
    if (size < 136) {
      return null;
    }
    
    // IMPORTANT: Check 236 bytes FIRST - it's a PK4 export, NOT pk6!
    // 236-byte files are PK4 exports and must be detected before checking for pk6
    if (size === 236) {
      return 'pk4'; // 236 bytes is ALWAYS pk4 export format
    }
    
    // Check for pk4 (Gen 4) - can be 136 (raw) or larger (PKHeX export, e.g., 236 bytes)
    if (size < 220) {
      return 'pk4'; // Definitely pk4 if less than pk5 raw size
    }
    
    // For sizes >= 220, need to distinguish pk4 export from pk5
    // Common sizes: pk4 export = 236 bytes, pk5 raw = 220 bytes, pk5 export = 220+ bytes
    if (size === 220) {
      // Exactly 220 bytes is pk5 raw format
      return 'pk5';
    }
    
    // For sizes > 220 but < 232 (236 is already handled above), check species to distinguish
    if (size > 220 && size < 232) {
      // Check species to distinguish pk4 from pk5
      if (utils.isValidSpeciesAtOffset(buffer, 0x08, 493)) {
        return 'pk4';
      }
      if (utils.isValidSpeciesAtOffset(buffer, 0x08, 649)) {
        return 'pk5';
      }
    }
    
    // For sizes >= 232, it's not pk4/pk5 (would be pk6)
    // But check species ranges just in case
    if (size >= 232) {
      if (utils.isValidSpeciesAtOffset(buffer, 0x08, 649)) return 'pk5';
      if (utils.isValidSpeciesAtOffset(buffer, 0x08, 493)) return 'pk4';
    }
    
    return null;
  }
  
  /**
   * Determine if file is PKHeX export format and get data offset
   * PKHeX exports may have headers, but often the Pokemon data starts at offset 0x00
   */
  static getDataOffset(buffer, format) {
    const size = buffer.length;
    
    // For pk4/pk5, check if valid Pokemon data exists at offset 0x00 first
    // Species is always at offset 0x08 relative to data start
    const maxSpecies = format === 'pk4' ? 493 : 649;
    if (utils.isValidSpeciesAtOffset(buffer, 0x08, maxSpecies)) {
      return 0x00; // Pokemon data starts at beginning
    }
    
    // If not at 0x00, check for PKHeX export headers
    // For headers, species would be at: header_offset + 0x08
    if (format === 'pk5' && size > 220) {
      // PK5 exports can be larger than 220 bytes
      if (utils.isValidSpeciesAtOffset(buffer, 0x24, 649)) { // 0x1C + 0x08
        return 0x1C;
      }
      if (utils.isValidSpeciesAtOffset(buffer, 0x28, 649)) { // 0x20 + 0x08
        return 0x20;
      }
    } else if (format === 'pk4' && size > 136) {
      // PK4 exports can be larger than 136 bytes (e.g., 236 bytes)
      if (utils.isValidSpeciesAtOffset(buffer, 0x24, 493)) { // 0x1C + 0x08
        return 0x1C;
      }
      if (utils.isValidSpeciesAtOffset(buffer, 0x28, 493)) { // 0x20 + 0x08
        return 0x20;
      }
    }
    
    // Default: assume data starts at 0x00
    return 0x00;
  }

  /**
   * Parse a .pk4/.pk5 file buffer
   */
  static parse(buffer, filename = null) {
    const format = this.detectFormat(buffer);
    if (!format) {
      // Try to provide more helpful error message
      const size = buffer.length;
      let suggestion = '';
      if (size >= 136 && size < 220) suggestion = ' (likely pk4)';
      else if (size >= 220 && size < 232) suggestion = ' (likely pk5)';
      throw new Error(`Invalid file size: ${size} bytes (expected 136+ for pk4, 220+ for pk5)${suggestion}`);
    }

    // Determine if PKHeX export format and get data offset
    const dataOffset = this.getDataOffset(buffer, format);
    
    // Debug: Log dataOffset for troubleshooting
    if (dataOffset !== 0) {
      console.log(`[PK4Parser] Using dataOffset: ${dataOffset} for ${format} file (size: ${buffer.length})`);
    }

    // Common offsets for Gen 4/5 (relative to data start)
    let speciesOffset, pidOffset, tidOffset, sidOffset, otNameOffset, nicknameOffset;
    let ivOffset, levelOffset, hpCurrentOffset, hpMaxOffset, natureOffset, abilityOffset, isShinyOffset;
    let move1Offset, move2Offset, move3Offset, move4Offset;
    let move1PPOffset, move2PPOffset, move3PPOffset, move4PPOffset;
    let evHpOffset, evAtkOffset, evDefOffset, evSpAOffset, evSpDOffset, evSpeOffset;
    let ballOffset, metLocationOffset, originGameOffset, experienceOffset;

    if (format === 'pk4') {
      // Gen 4 offsets (from PKHeX.Core/PKM/PK4.cs)
      speciesOffset = 0x08;
      pidOffset = 0x00;
      tidOffset = 0x0C;
      sidOffset = 0x0E;
      otNameOffset = 0x68; // OriginalTrainerTrash: Data.Slice(0x68, 16)
      nicknameOffset = 0x48; // NicknameTrash: Data.Slice(0x48, 22)
      ivOffset = 0x38; // IV32 at 0x38 (packed 32-bit value)
      levelOffset = 0x8C; // Stat_Level at 0x8C
      hpCurrentOffset = 0x8E; // Stat_HPCurrent at 0x8E (16-bit)
      hpMaxOffset = 0x90; // Stat_HPMax at 0x90 (16-bit)
      natureOffset = 0x1D; // PK4 doesn't store nature - always use PID%25
      abilityOffset = 0x15;
      isShinyOffset = 0x40; // Gender/Form/Shiny flags at 0x40
      move1Offset = 0x28;
      move2Offset = 0x2A;
      move3Offset = 0x2C;
      move4Offset = 0x2E;
      move1PPOffset = 0x30; // Move1_PP at 0x30
      move2PPOffset = 0x31; // Move2_PP at 0x31
      move3PPOffset = 0x32; // Move3_PP at 0x32
      move4PPOffset = 0x33; // Move4_PP at 0x33
      evHpOffset = 0x18;
      evAtkOffset = 0x19;
      evDefOffset = 0x1A;
      evSpAOffset = 0x1C;
      evSpDOffset = 0x1D; // Note: conflicts with natureOffset, but PK4 doesn't use natureOffset
      evSpeOffset = 0x1B;
      ballOffset = 0x83; // BallDPPt at 0x83 (from PK4.cs line 269)
      metLocationOffset = 0x80; // MetLocationDP at 0x80 (16-bit, from PK4.cs line 260-263)
      originGameOffset = 0x5F; // Version at 0x5F (from PK4.cs line 201)
      experienceOffset = 0x10; // EXP at 0x10 (32-bit)
    } else if (format === 'pk5') {
      // Gen 5 offsets (similar to pk4)
      speciesOffset = 0x08;
      pidOffset = 0x00;
      tidOffset = 0x0C;
      sidOffset = 0x0E;
      otNameOffset = 0x68; // Same as pk4
      nicknameOffset = 0x48; // Same as pk4
      ivOffset = 0x38; // Same as pk4
      levelOffset = 0x8C; // Same as pk4
      hpCurrentOffset = 0x8E; // Same as pk4
      hpMaxOffset = 0x90; // Same as pk4
      natureOffset = 0x1D;
      abilityOffset = 0x15;
      isShinyOffset = 0x40;
      move1Offset = 0x28; // PK5 moves same as PK4
      move2Offset = 0x2A;
      move3Offset = 0x2C;
      move4Offset = 0x2E;
      move1PPOffset = 0x30; // PK5 Move PP offsets (same as PK4)
      move2PPOffset = 0x31;
      move3PPOffset = 0x32;
      move4PPOffset = 0x33;
      evHpOffset = 0x1A;
      evAtkOffset = 0x1B;
      evDefOffset = 0x1C;
      evSpAOffset = 0x1D;
      evSpDOffset = 0x1E;
      evSpeOffset = 0x1F;
      ballOffset = 0x86;
      metLocationOffset = 0x80; // Same as pk4
      originGameOffset = 0x87;
      experienceOffset = 0x10; // Same as pk4
    }
    
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
    
    // Validate that we got valid data (species should be 1-649)
    if (species === 0 || species > 649) {
      throw new Error(`Invalid species ID: ${species} at offset ${speciesOffset} (dataOffset: ${dataOffset}). File might be encrypted or have wrong format.`);
    }
    
    // Nature: PK4 always uses PID%25, PK5 stores it directly
    let nature;
    if (format === 'pk4') {
      // PK4: Nature is ALWAYS derived from PID%25 (not stored)
      nature = personality % 25;
    } else {
      // PK5: Nature is stored directly at natureOffset
      nature = safeReadByte(natureOffset);
      // Validate it - if invalid, use PID%25 as fallback
      if (nature > 24) {
        nature = personality % 25; // Fallback to PID-based nature
      }
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
    
    if (level === 0 || level > 100) {
      level = 1; // Default to level 1 if invalid
    }
    
    const ability = safeReadByte(abilityOffset);
    
    // Determine shiny status (PK4/PK5: calculate from PID/TID/SID)
    const shinyValue = (tid ^ sid ^ (personality & 0xFFFF) ^ (personality >> 16));
    const isShiny = shinyValue < 8;
    
    // Validate species
    const maxSpecies = format === 'pk4' ? 493 : 649;
    if (species === 0 || species > maxSpecies) {
      throw new Error(`Invalid species ID: ${species} (expected 1-${maxSpecies})`);
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
      console.warn(`[PK4Parser] Warning: Move exists but PP is 0. Moves: [${move1}, ${move2}, ${move3}, ${move4}], PP: [${move1PP}, ${move2PP}, ${move3PP}, ${move4PP}]`);
      console.warn(`[PK4Parser] PP offsets: [${move1PPOffset}, ${move2PPOffset}, ${move3PPOffset}, ${move4PPOffset}], dataOffset: ${dataOffset}`);
    }
    
    // Extract strings (lengths vary by format)
    const nicknameLength = 22;
    const otNameLength = 16;
    const otName = utils.readString(buffer, otNameOffset, otNameLength, format) || 'Unknown OT';
    const nickname = utils.readString(buffer, nicknameOffset, nicknameLength, format);
    
    // Extract other data
    const ball = safeReadByte(ballOffset) || 4; // Default to Poke Ball
    const metLocation = safeReadUInt16LE(metLocationOffset);
    const originGame = safeReadByte(originGameOffset) || 0;
    
    // Read Experience (32-bit value at 0x10)
    const experience = safeReadUInt32LE(experienceOffset);
    
    // Calculate sums
    const ivSum = ivs.hp + ivs.attack + ivs.defense + ivs.speed + ivs.spAttack + ivs.spDefense;
    const evSum = evs.hp + evs.attack + evs.defense + evs.speed + evs.spAttack + evs.spDefense;
    
    // Get names from maps
    const ballName = utils.getBallName(ball);
    const natureName = utils.getNatureName(nature);
    const originGameName = utils.getGameName(originGame);
    
    // Met location name lookup
    const metLocationName = utils.getLocationNameGen4(metLocation);
    
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
      heldItem: 0,
      form: 0,
      isGen3: false,
      generation: format === 'pk4' ? 4 : 5,
    };
  }
}

module.exports = PK4Parser;

