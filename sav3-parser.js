/**
 * Gen 3 Save File Parser
 * Handles loading, modifying, and exporting Gen 3 .sav files
 * Based on PKHeX structure
 */

const SIZE_SECTOR = 0x1000;
const SIZE_SECTOR_USED = 0xF80;
const SIZE_MAIN = 14 * SIZE_SECTOR; // 14 sectors for main data
const COUNT_BOX = 14;
const COUNT_SLOTSPERBOX = 30;
const SIZE_STORED = 80; // Stored Pokemon size
const SIZE_PARTY = 100; // Party Pokemon size
const MAX_PARTY = 6;

class SAV3Parser {
  constructor(buffer) {
    // Gen 3 save files are typically 128KB (0x20000), but we need at least SIZE_MAIN (14 sectors = 0xE000)
    if (!buffer || buffer.length < SIZE_MAIN) {
      throw new Error(`Invalid save file: too small (got ${buffer.length} bytes, expected at least ${SIZE_MAIN} bytes)`);
    }
    
    this.data = Buffer.from(buffer);
    this.activeSlot = this.getActiveSlot();
    this.smallBuffer = Buffer.alloc(SIZE_SECTOR_USED);
    this.largeBuffer = Buffer.alloc(4 * SIZE_SECTOR_USED);
    this.storageBuffer = Buffer.alloc(9 * SIZE_SECTOR_USED);
    
    this.readSectors();
  }
  
  /**
   * Determine which save slot is active (slot 0 or slot 1)
   * Based on PKHeX's GetActiveSlot - uses IsAllMainSectorsPresent and CompareFooters
   */
  getActiveSlot() {
    // Check if both slots have all required sectors
    const slot0Valid = this.isAllMainSectorsPresent(0);
    const slot1Valid = this.isAllMainSectorsPresent(1);
    
    if (slot0Valid && !slot1Valid) return 0;
    if (slot1Valid && !slot0Valid) return 1;
    
    // If both are valid, compare footers (save counters) to find the most recent
    if (slot0Valid && slot1Valid) {
      // Find sector 0 in each slot to get footer offset
      const sector0_0 = this.findSector0(0);
      const sector0_1 = this.findSector0(1);
      
      if (sector0_0 >= 0 && sector0_1 >= 0) {
        // Compare save counters at offset 0xFFC in sector 0
        const counter0 = this.data.readUInt32LE(sector0_0 + 0xFFC);
        const counter1 = this.data.readUInt32LE(sector0_1 + 0xFFC);
        return counter1 > counter0 ? 1 : 0;
      }
    }
    
    // Default to slot 0
    return 0;
  }
  
  /**
   * Find sector 0 (small buffer sector) in a save slot
   */
  findSector0(slot) {
    const start = slot * SIZE_MAIN;
    const end = start + SIZE_MAIN;
    
    for (let ofs = start; ofs < end; ofs += SIZE_SECTOR) {
      if (ofs + SIZE_SECTOR > this.data.length) break;
      const sector = this.data.slice(ofs, ofs + SIZE_SECTOR);
      const id = sector.readUInt16LE(0xFF4);
      if (id === 0) {
        return ofs;
      }
    }
    return -1;
  }
  
  /**
   * Check if all main sectors (0-13) are present in a save slot
   * Based on PKHeX's IsAllMainSectorsPresent
   */
  isAllMainSectorsPresent(slot) {
    const start = slot * SIZE_MAIN;
    const end = start + SIZE_MAIN;
    let bitTrack = 0; // bit flags for each sector, 1 if present
    
    for (let ofs = start; ofs < end; ofs += SIZE_SECTOR) {
      if (ofs + SIZE_SECTOR > this.data.length) break;
      
      const sector = this.data.slice(ofs, ofs + SIZE_SECTOR);
      const id = sector.readUInt16LE(0xFF4);
      
      if (id < 0 || id >= 14) {
        return false; // Invalid sector ID
      }
      
      bitTrack |= (1 << id); // Set bit for this sector ID
    }
    
    // Check if all 14 sectors (0-13) are present
    // 0b_0011_1111_1111_1111 = all bits 0-13 set
    return bitTrack === 0b0011111111111111;
  }
  
  
  /**
   * Calculate sector checksum
   */
  calculateChecksum(data) {
    let sum = 0;
    for (let i = 0; i < data.length; i += 2) {
      if (i + 1 < data.length) {
        sum += data.readUInt16LE(i);
      } else {
        sum += data[i];
      }
    }
    return sum & 0xFFFF;
  }
  
  /**
   * Read sectors from save file into buffers
   * Based on PKHeX's ReadSectors - scans for sectors by ID within the active slot
   */
  readSectors() {
    const start = this.activeSlot * SIZE_MAIN;
    const end = start + SIZE_MAIN;
    
    // Check if we have enough data
    if (start + SIZE_MAIN > this.data.length) {
      throw new Error(`Save file too small: need ${start + SIZE_MAIN} bytes, got ${this.data.length}`);
    }
    
    // Scan through all sectors in the active slot and route to buffers by ID
    // Sectors may not be in sequential order, so we scan for them
    for (let ofs = start; ofs < end; ofs += SIZE_SECTOR) {
      if (ofs + SIZE_SECTOR > this.data.length) break;
      
      const sector = this.data.slice(ofs, ofs + SIZE_SECTOR);
      const id = sector.readUInt16LE(0xFF4);
      const sectorData = sector.slice(0, SIZE_SECTOR_USED);
      
      // Route to appropriate buffer based on sector ID
      if (id === 0) {
        sectorData.copy(this.smallBuffer, 0, 0, Math.min(SIZE_SECTOR_USED, this.smallBuffer.length));
      } else if (id >= 1 && id <= 4) {
        const largeOffset = (id - 1) * SIZE_SECTOR_USED;
        if (largeOffset + SIZE_SECTOR_USED <= this.largeBuffer.length) {
          sectorData.copy(this.largeBuffer, largeOffset, 0, SIZE_SECTOR_USED);
        }
      } else if (id >= 5 && id <= 13) {
        const storageOffset = (id - 5) * SIZE_SECTOR_USED;
        if (storageOffset + SIZE_SECTOR_USED <= this.storageBuffer.length) {
          sectorData.copy(this.storageBuffer, storageOffset, 0, SIZE_SECTOR_USED);
        }
      }
    }
  }
  
  /**
   * Write buffers back to save file sectors
   * Based on PKHeX's WriteSectors - finds sectors by ID and writes buffer data to them
   * IMPORTANT: We must find the actual sector positions by scanning for sector IDs,
   * as sectors may not be in sequential order within the save slot
   */
  writeSectors() {
    const start = this.activeSlot * SIZE_MAIN;
    const end = start + SIZE_MAIN;
    
    // First, find all sector positions by scanning for sector IDs
    // This matches PKHeX's approach - sectors can be in any order
    const sectorPositions = new Map(); // id -> offset
    
    for (let ofs = start; ofs < end; ofs += SIZE_SECTOR) {
      if (ofs + SIZE_SECTOR > this.data.length) break;
      
      const sector = this.data.slice(ofs, ofs + SIZE_SECTOR);
      const id = sector.readUInt16LE(0xFF4);
      
      // Only track valid sector IDs (0-13)
      if (id >= 0 && id <= 13) {
        sectorPositions.set(id, ofs);
      }
    }
    
    // Now write each sector by ID
    // Based on PKHeX's WriteSectors - copy buffer data to sectors
    // PKHeX copies FROM buffer chunks TO data sectors
    for (const [id, ofs] of sectorPositions.entries()) {
      if (ofs + SIZE_SECTOR > this.data.length) continue;
      
      if (id === 0) {
        // Small buffer (sector 0)
        // Save the original counter and footer bytes before we overwrite anything
        const footerStart = ofs + SIZE_SECTOR_USED;
        const originalCounter = this.data.readUInt32LE(ofs + 0xFFC);
        const originalFooterBytes = this.data.slice(footerStart + 0x08, ofs + 0xFFC); // Bytes 0xFF8-0xFFB (8 bytes before counter)
        
        this.smallBuffer.copy(this.data, ofs, 0, Math.min(SIZE_SECTOR_USED, this.smallBuffer.length));
        const checksum = this.calculateChecksum(this.smallBuffer.slice(0, SIZE_SECTOR_USED));
        // Write sector ID and checksum in footer
        this.data.writeUInt16LE(0, ofs + 0xFF4); // Sector ID
        this.data.writeUInt16LE(checksum, ofs + 0xFF6);
        
        // Restore footer bytes 0xFF8-0xFFB (but NOT 0xFFC-0xFFF which contains the counter)
        originalFooterBytes.copy(this.data, footerStart + 0x08);
        
        // Increment save counter at 0xFFC to make this slot the active one
        // This ensures the slot we wrote to remains active after export
        const otherSlot = this.activeSlot === 0 ? 1 : 0;
        const otherSector0 = this.findSector0(otherSlot);
        let otherCounter = 0;
        if (otherSector0 >= 0) {
          otherCounter = this.data.readUInt32LE(otherSector0 + 0xFFC);
        }
        // Make sure our counter is higher than the other slot's counter
        const newCounter = Math.max(originalCounter, otherCounter) + 1;
        // Handle overflow - wrap around if needed
        const finalCounter = (newCounter > 0xFFFFFFFF) ? 0 : (newCounter >>> 0);
        this.data.writeUInt32LE(finalCounter, ofs + 0xFFC);
      } else if (id >= 1 && id <= 4) {
        // Large buffer (sectors 1-4)
        const bufferOffset = (id - 1) * SIZE_SECTOR_USED;
        if (bufferOffset + SIZE_SECTOR_USED <= this.largeBuffer.length) {
          const footerStart = ofs + SIZE_SECTOR_USED;
          const originalFooterBytes = this.data.slice(footerStart + 0x08, ofs + SIZE_SECTOR);
          
          this.largeBuffer.copy(this.data, ofs, bufferOffset, bufferOffset + SIZE_SECTOR_USED);
          const checksum = this.calculateChecksum(this.largeBuffer.slice(bufferOffset, bufferOffset + SIZE_SECTOR_USED));
          this.data.writeUInt16LE(id, ofs + 0xFF4);
          this.data.writeUInt16LE(checksum, ofs + 0xFF6);
          // Restore rest of footer (0xFF8-0xFFF)
          originalFooterBytes.copy(this.data, footerStart + 0x08);
        }
      } else if (id >= 5 && id <= 13) {
        // Storage buffer (sectors 5-13)
        const bufferOffset = (id - 5) * SIZE_SECTOR_USED;
        if (bufferOffset + SIZE_SECTOR_USED <= this.storageBuffer.length) {
          const footerStart = ofs + SIZE_SECTOR_USED;
          const originalFooterBytes = this.data.slice(footerStart + 0x08, ofs + SIZE_SECTOR);
          
          this.storageBuffer.copy(this.data, ofs, bufferOffset, bufferOffset + SIZE_SECTOR_USED);
          const checksum = this.calculateChecksum(this.storageBuffer.slice(bufferOffset, bufferOffset + SIZE_SECTOR_USED));
          this.data.writeUInt16LE(id, ofs + 0xFF4);
          this.data.writeUInt16LE(checksum, ofs + 0xFF6);
          // Restore rest of footer (0xFF8-0xFFF)
          originalFooterBytes.copy(this.data, footerStart + 0x08);
        }
      }
    }
    
    // After writing sectors, reload buffers from the updated save file data
    // This ensures that subsequent operations (like findNextEmptyBoxSlot) see the updated data
    this.readSectors();
  }
  
  /**
   * Get box offset in storage buffer
   * Based on PKHeX: Box + 4 + (SIZE_STORED * box * COUNT_SLOTSPERBOX)
   * Box starts at 0, with a 4-byte header, then boxes follow
   */
  getBoxOffset(box) {
    if (box < 0 || box >= COUNT_BOX) return -1;
    // Storage buffer starts with 4-byte header (current box index at offset 0)
    // Then boxes follow: each box has COUNT_SLOTSPERBOX slots, each slot is SIZE_STORED bytes
    return 4 + (box * COUNT_SLOTSPERBOX * SIZE_STORED);
  }
  
  /**
   * Get party offset in large buffer
   * Based on PKHeX: Party starts at 0x238 in Large buffer (RS/E)
   * Party count is at 0x234
   */
  getPartyOffset() {
    // Party starts at 0x238 in large buffer (RS/E/FRLG)
    // This is after trainer data and other game-specific data
    return 0x238;
  }
  
  /**
   * Get Pokemon from a specific box slot
   */
  getBoxSlot(box, slot) {
    if (box < 0 || box >= COUNT_BOX || slot < 0 || slot >= COUNT_SLOTSPERBOX) {
      return null;
    }
    
    const boxOffset = this.getBoxOffset(box);
    if (boxOffset < 0) return null;
    
    const slotOffset = boxOffset + (slot * SIZE_STORED);
    if (slotOffset + SIZE_STORED > this.storageBuffer.length) return null;
    
    const pkmData = this.storageBuffer.slice(slotOffset, slotOffset + SIZE_STORED);
    
    // Check if slot is empty (all zeros or invalid PID)
    const personality = pkmData.readUInt32LE(0);
    if (personality === 0) {
      return null; // Empty slot
    }
    
    const decrypted = this.decryptPKM(pkmData);
    if (!decrypted) {
      return null; // Decryption failed or invalid data
    }
    
    // Recalculate checksum for decrypted data and update it in the header
    // This ensures PK3Parser.checkIfEncrypted returns false for already-decrypted data
    let checksum = 0;
    const blockStart = 0x20;
    const blockEnd = 0x50;
    for (let i = blockStart; i < blockEnd && i + 2 <= decrypted.length; i += 2) {
      checksum += decrypted.readUInt16LE(i);
    }
    checksum = checksum & 0xFFFF;
    decrypted.writeUInt16LE(checksum, 0x1C);
    
    return decrypted;
  }
  
  /**
   * Get Pokemon from party slot
   */
  getPartySlot(slot) {
    if (slot < 0 || slot >= MAX_PARTY) return null;
    
    const partyOffset = this.getPartyOffset();
    const slotOffset = partyOffset + (slot * SIZE_PARTY);
    if (slotOffset + SIZE_PARTY > this.largeBuffer.length) return null;
    
    const pkmData = this.largeBuffer.slice(slotOffset, slotOffset + SIZE_PARTY);
    // Party Pokemon have extra data, but the first 80 bytes are the stored format
    return this.decryptPKM(pkmData.slice(0, SIZE_STORED));
  }
  
  /**
   * Decrypt Pokemon data (Gen 3 encryption)
   * Based on PKHeX's DecryptArray3:
   * 1. XOR data blocks (0x20-0x50) with seed = PID ^ OID
   * 2. Unshuffle blocks using BlockPosition[PID % 24]
   */
  decryptPKM(data) {
    if (!data || data.length < SIZE_STORED) return null;

    const PID = data.readUInt32LE(0);
    if (PID === 0) return null;
    
    const OID = data.readUInt32LE(4);
    const seed = (PID ^ OID) >>> 0;
    const sv = PID % 24;
    
    // Step 1: XOR data blocks (0x20-0x50) with seed
    // Header (0x00-0x1F) is NOT encrypted
    // CryptArray3 XORs the data blocks (0x20-0x50) with seed
    const decrypted = Buffer.from(data);
    const SIZE_3HEADER = 32; // 0x20
    const SIZE_3STORED_BLOCKS = 48; // 0x50 - 0x20 = 48 bytes
    for (let i = SIZE_3HEADER; i < SIZE_3HEADER + SIZE_3STORED_BLOCKS; i += 4) {
      const value = decrypted.readUInt32LE(i);
      decrypted.writeUInt32LE((value ^ seed) >>> 0, i);
    }
    
    // Step 2: Unshuffle blocks using BlockPosition[PID % 24]
    // For decryption, we use PID % 24 directly (not BlockPositionInvert)
    return this.shuffleArray3(decrypted, sv, false);
  }
  
  /**
   * Check if a Pokemon slot is empty
   */
  isPKMPresent(data) {
    if (!data) return false;
    const personality = data.readUInt32LE(0);
    return personality !== 0;
  }
  
  /**
   * Write Pokemon to a box slot
   */
  write(pokemonData, targetType, targetIndex) {
    if (!pokemonData || pokemonData.length < SIZE_STORED) {
      throw new Error('Invalid Pokemon data');
    }
    
    let slotOffset = -1;
    
    if (targetType === 'box') {
      if (targetIndex === undefined || targetIndex === null) {
        // Find next empty slot
        for (let box = 0; box < COUNT_BOX; box++) {
          for (let slot = 0; slot < COUNT_SLOTSPERBOX; slot++) {
            const existing = this.getBoxSlot(box, slot);
            if (!this.isPKMPresent(existing)) {
              const boxOffset = this.getBoxOffset(box);
              slotOffset = boxOffset + (slot * SIZE_STORED);
              targetIndex = { box, slot };
              break;
            }
          }
          if (slotOffset >= 0) break;
        }
        if (slotOffset < 0) {
          throw new Error('No empty box slots available');
        }
      } else {
        // Use specified slot
        const boxOffset = this.getBoxOffset(targetIndex.box);
        if (boxOffset < 0) throw new Error('Invalid box index');
        slotOffset = boxOffset + (targetIndex.slot * SIZE_STORED);
      }
      
      // Encrypt and write to storage buffer
      const encrypted = this.encryptPKM(pokemonData);
      if (slotOffset + SIZE_STORED > this.storageBuffer.length) {
        throw new Error(`Box slot offset out of bounds: ${slotOffset} (buffer size: ${this.storageBuffer.length})`);
      }
      encrypted.copy(this.storageBuffer, slotOffset, 0, SIZE_STORED);
      
    } else if (targetType === 'party') {
      if (targetIndex === undefined || targetIndex === null) {
        // Find next empty party slot
        for (let slot = 0; slot < MAX_PARTY; slot++) {
          const existing = this.getPartySlot(slot);
          if (!this.isPKMPresent(existing)) {
            const partyOffset = this.getPartyOffset();
            slotOffset = partyOffset + (slot * SIZE_PARTY);
            targetIndex = slot;
            break;
          }
        }
        if (slotOffset < 0) {
          throw new Error('Party is full');
        }
      } else {
        // Use specified slot
        const partyOffset = this.getPartyOffset();
        slotOffset = partyOffset + (targetIndex * SIZE_PARTY);
      }
      
      // Encrypt and write to large buffer
      // Party Pokemon need 100 bytes: 80 bytes stored format + 20 bytes party data
      const encrypted = this.encryptPKM(pokemonData);
      if (slotOffset + SIZE_PARTY > this.largeBuffer.length) {
        throw new Error(`Party slot offset out of bounds: ${slotOffset} (buffer size: ${this.largeBuffer.length})`);
      }
      // Copy encrypted stored format (80 bytes) to party slot
      encrypted.copy(this.largeBuffer, slotOffset, 0, SIZE_STORED);
      // Initialize party data (last 20 bytes) to zero
      this.largeBuffer.fill(0, slotOffset + SIZE_STORED, slotOffset + SIZE_PARTY);
      
      // Update party count if needed
      const currentCount = this.largeBuffer.readUInt8(0x234);
      if (targetIndex >= currentCount) {
        this.largeBuffer.writeUInt8(targetIndex + 1, 0x234);
      }
    } else {
      throw new Error('Invalid target type');
    }
    
    return targetIndex;
  }
  
  /**
   * Encrypt Pokemon data (Gen 3 encryption)
   * Based on PKHeX's EncryptArray3:
   * 1. Shuffle blocks based on BlockPositionInvert[PID % 24]
   * 2. XOR data blocks (0x20-0x50) with seed = PID ^ OID
   */
  encryptPKM(data) {
    if (data.length !== SIZE_STORED) {
      throw new Error(`Invalid data size: expected ${SIZE_STORED}, got ${data.length}`);
    }
    
    const PID = data.readUInt32LE(0);
    const OID = data.readUInt32LE(4);
    const seed = (PID ^ OID) >>> 0;
    
    // BlockPositionInvert maps PID % 24 to a shuffle value for encryption
    const BlockPositionInvert = [
      0, 1, 2, 4, 3, 5, 6, 7, 12, 18, 13, 19, 8, 10, 14, 20, 16, 22, 9, 11, 15, 21, 17, 23,
      0, 1, 2, 4, 3, 5, 6, 7, // duplicates
    ];
    const sv = BlockPositionInvert[PID % 24];
    
    // Step 1: Shuffle blocks using the inverted shuffle value
    // For encryption, we use BlockPositionInvert[PID % 24]
    const shuffled = this.shuffleArray3(data, sv, true);
    
    // Step 2: XOR data blocks (0x20-0x50) with seed
    // Header (0x00-0x1F) is NOT encrypted, only shuffled
    // CryptArray3 XORs the data blocks (0x20-0x50) with seed
    // Note: We XOR 32-bit values, not individual bytes
    // SIZE_3STORED = 80 (0x50), SIZE_3HEADER = 32 (0x20)
    // So we XOR from 0x20 to 0x50 (48 bytes = 12 uint32 values)
    const SIZE_3HEADER = 32; // 0x20
    const SIZE_3STORED_BLOCKS = 48; // 0x50 - 0x20 = 48 bytes
    for (let i = SIZE_3HEADER; i < SIZE_3HEADER + SIZE_3STORED_BLOCKS; i += 4) {
      const value = shuffled.readUInt32LE(i);
      const encryptedValue = (value ^ seed) >>> 0;
      shuffled.writeUInt32LE(encryptedValue, i);
    }
    
    // Step 3: Recalculate checksum (sum of blocks A, B, C, D at 0x20-0x4F)
    // Checksum is calculated on the ENCRYPTED data blocks (after shuffle and XOR)
    // This matches how the game validates Pokemon data
    let checksum = 0;
    for (let i = 0x20; i < 0x50; i += 2) {
      checksum += shuffled.readUInt16LE(i);
    }
    checksum = checksum & 0xFFFF; // Keep only 16 bits
    shuffled.writeUInt16LE(checksum, 0x1C);
    
    return shuffled;
  }
  
  /**
   * Shuffle/unshuffle Gen 3 Pokemon blocks
   * @param {Buffer} data - Input data
   * @param {number} sv - Shuffle value (for encrypt: BlockPositionInvert[PID % 24], for decrypt: PID % 24)
   * @param {boolean} encrypt - true for encrypt, false for decrypt
   */
  shuffleArray3(data, sv, encrypt) {
    const SIZE_3HEADER = 32;
    const SIZE_3BLOCK = 12;
    const SIZE_3STORED = 80;
    const BlockCount = 4;
    
    // BlockPosition contains block indices (0-3) for each shuffle pattern
    // This is the same array used by PKHeX
    const BlockPosition = [
      0, 1, 2, 3, 0, 1, 3, 2, 0, 2, 1, 3, 0, 3, 1, 2, 0, 2, 3, 1, 0, 3, 2, 1,
      1, 0, 2, 3, 1, 0, 3, 2, 2, 0, 1, 3, 3, 0, 1, 2, 2, 0, 3, 1, 3, 0, 2, 1,
      1, 2, 0, 3, 1, 3, 0, 2, 2, 1, 0, 3, 3, 1, 0, 2, 2, 3, 0, 1, 3, 2, 0, 1,
      1, 2, 3, 0, 1, 3, 2, 0, 2, 1, 3, 0, 3, 1, 2, 0, 2, 3, 1, 0, 3, 2, 1, 0,
      0, 1, 2, 3, 0, 1, 3, 2, 0, 2, 1, 3, 0, 3, 1, 2, 0, 2, 3, 1, 0, 3, 2, 1,
      1, 0, 2, 3, 1, 0, 3, 2, // duplicates
    ];
    
    const result = Buffer.alloc(data.length);
    const index = sv * BlockCount;
    
    // Copy header (0x00-0x1F) as-is
    data.copy(result, 0, 0, SIZE_3HEADER);
    
    // Copy data after SIZE_3STORED (if any - for party Pokemon)
    if (data.length > SIZE_3STORED) {
      data.copy(result, SIZE_3STORED, SIZE_3STORED, data.length);
    }
    
    // Shuffle/unshuffle blocks using BlockPosition array
    // BlockPosition[index + block] tells us which source block to use for each destination block
    for (let block = 0; block < BlockCount; block++) {
      const arrayIndex = index + block;
      if (arrayIndex < 0 || arrayIndex >= BlockPosition.length) {
        throw new Error(`BlockPosition index out of range: ${arrayIndex} (array length: ${BlockPosition.length}, sv: ${sv}, index: ${index}, block: ${block})`);
      }
      
      const destOffset = SIZE_3HEADER + (SIZE_3BLOCK * block);
      const srcBlockIndex = BlockPosition[arrayIndex];
      
      if (srcBlockIndex < 0 || srcBlockIndex >= BlockCount) {
        throw new Error(`Invalid block index: ${srcBlockIndex} from BlockPosition[${arrayIndex}] (expected 0-${BlockCount - 1})`);
      }
      
      const srcOffset = SIZE_3HEADER + (SIZE_3BLOCK * srcBlockIndex);
      
      if (srcOffset + SIZE_3BLOCK > data.length || destOffset + SIZE_3BLOCK > result.length) {
        throw new Error(`Block copy out of bounds: src=${srcOffset}, dest=${destOffset}, dataLen=${data.length}, resultLen=${result.length}`);
      }
      
      data.copy(result, destOffset, srcOffset, srcOffset + SIZE_3BLOCK);
    }
    
    return result;
  }
  
  /**
   * Find next empty box slot
   */
  findNextEmptyBoxSlot() {
    for (let box = 0; box < COUNT_BOX; box++) {
      for (let slot = 0; slot < COUNT_SLOTSPERBOX; slot++) {
        const pokemon = this.getBoxSlot(box, slot);
        if (!pokemon) {
          return { box, slot };
        }
      }
    }
    return null; // No empty slots
  }
  
  /**
   * Find next empty party slot
   */
  findNextEmptyPartySlot() {
    for (let slot = 0; slot < MAX_PARTY; slot++) {
      const pokemon = this.getPartySlot(slot);
      if (!pokemon) {
        return slot;
      }
    }
    return null; // Party full
  }
  
  /**
   * Export save file
   */
  export() {
    this.writeSectors();
    return Buffer.from(this.data);
  }
  
  /**
   * Gen 3 English character table from PKHeX StringConverter3
   * This is the exact lookup table used by PKHeX for English Gen 3 games
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
   * Decode a single Gen 3 character using PKHeX's G3_EN table
   */
  decodeGen3CharPKHeX(byte) {
    if (byte >= SAV3Parser.G3_EN_TABLE.length) {
      return null;
    }
    const char = SAV3Parser.G3_EN_TABLE[byte];
    // Terminator is 0xFF
    if (char === '\xFF' || char === '\x00' || byte === 0xFF || byte === 0x00) {
      return null;
    }
    return char;
  }
  
  /**
   * Read a Gen 3 encoded string using PKHeX's exact character table
   */
  readStringGen3PKHeX(buffer, offset, maxLength) {
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
    return str || null;
  }
  
  /**
   * Get save file info
   */
  getInfo() {
    // Read OT name from small buffer (first 8 bytes, but only 7 used for non-Japanese)
    // Based on PKHeX: OriginalTrainerTrash => Small[..8], but MaxStringLengthTrainer = 7
    // Check if Japanese (offset 0x6 in small buffer should be 0 for Japanese)
    const isJapanese = this.smallBuffer.readUInt16LE(0x6) === 0;
    const otLength = isJapanese ? 5 : 7;
    const otName = this.readStringGen3PKHeX(this.smallBuffer, 0, otLength);
    
    // Read play time (offset 0xE for hours, 0x10 for minutes, 0x11 for seconds)
    const hours = this.smallBuffer.readUInt16LE(0xE);
    const minutes = this.smallBuffer[0x10];
    const seconds = this.smallBuffer[0x11];
    
    return {
      otName: otName || 'Unknown',
      playTime: hours,
      playTimeMinutes: minutes,
      playTimeSeconds: seconds,
      activeSlot: this.activeSlot,
      isJapanese
    };
  }
}

module.exports = SAV3Parser;
