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
   */
  getActiveSlot() {
    // Check both slots and determine which is more recent/valid
    const slot0Valid = this.isSlotValid(0);
    const slot1Valid = this.isSlotValid(1);
    
    if (slot0Valid && !slot1Valid) return 0;
    if (slot1Valid && !slot0Valid) return 1;
    
    // If both are valid, check save counter
    if (slot0Valid && slot1Valid) {
      const counter0 = this.data.readUInt32LE(0xFFC);
      const counter1 = this.data.readUInt32LE(SIZE_MAIN + 0xFFC);
      return counter1 > counter0 ? 1 : 0;
    }
    
    // Default to slot 0
    return 0;
  }
  
  /**
   * Check if a save slot is valid
   */
  isSlotValid(slot) {
    const start = slot * SIZE_MAIN;
    if (start + SIZE_MAIN > this.data.length) return false;
    
    let validCount = 0;
    for (let i = 0; i < 14; i++) {
      const offset = start + (i * SIZE_SECTOR);
      if (offset + SIZE_SECTOR > this.data.length) break;
      
      const sector = this.data.slice(offset, offset + SIZE_SECTOR);
      const id = sector.readUInt16LE(0xFF4);
      const checksum = sector.readUInt16LE(0xFF6);
      const expected = this.calculateChecksum(sector.slice(0, SIZE_SECTOR_USED));
      const actual = checksum;
      
      if (expected === actual) {
        validCount++;
      }
    }
    
    // Consider valid if at least half the sectors are valid
    return validCount >= 7;
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
   */
  readSectors() {
    const start = this.activeSlot * SIZE_MAIN;
    
    // Check if we have enough data
    if (start + SIZE_MAIN > this.data.length) {
      throw new Error(`Save file too small: need ${start + SIZE_MAIN} bytes, got ${this.data.length}`);
    }
    
    for (let i = 0; i < 14; i++) {
      const offset = start + (i * SIZE_SECTOR);
      if (offset + SIZE_SECTOR > this.data.length) {
        console.warn(`Sector ${i} out of bounds, skipping`);
        break;
      }
      
      const sector = this.data.slice(offset, offset + SIZE_SECTOR);
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
   */
  writeSectors() {
    const start = this.activeSlot * SIZE_MAIN;
    
    // Write small buffer (sector 0)
    const sector0 = this.data.slice(start, start + SIZE_SECTOR);
    this.smallBuffer.copy(sector0, 0, 0, Math.min(SIZE_SECTOR_USED, this.smallBuffer.length));
    const checksum0 = this.calculateChecksum(this.smallBuffer);
    sector0.writeUInt16LE(0, 0xFF4); // Sector ID
    sector0.writeUInt16LE(checksum0, 0xFF6);
    sector0.copy(this.data, start, 0, SIZE_SECTOR);
    
    // Write large buffer (sectors 1-4)
    for (let id = 1; id <= 4; id++) {
      const sectorOffset = start + (id * SIZE_SECTOR);
      const bufferOffset = (id - 1) * SIZE_SECTOR_USED;
      const sector = this.data.slice(sectorOffset, sectorOffset + SIZE_SECTOR);
      this.largeBuffer.copy(sector, 0, bufferOffset, bufferOffset + SIZE_SECTOR_USED);
      const checksum = this.calculateChecksum(this.largeBuffer.slice(bufferOffset, bufferOffset + SIZE_SECTOR_USED));
      sector.writeUInt16LE(id, 0xFF4);
      sector.writeUInt16LE(checksum, 0xFF6);
      sector.copy(this.data, sectorOffset, 0, SIZE_SECTOR);
    }
    
    // Write storage buffer (sectors 5-13)
    for (let id = 5; id <= 13; id++) {
      const sectorOffset = start + (id * SIZE_SECTOR);
      const bufferOffset = (id - 5) * SIZE_SECTOR_USED;
      const sector = this.data.slice(sectorOffset, sectorOffset + SIZE_SECTOR);
      this.storageBuffer.copy(sector, 0, bufferOffset, bufferOffset + SIZE_SECTOR_USED);
      const checksum = this.calculateChecksum(this.storageBuffer.slice(bufferOffset, bufferOffset + SIZE_SECTOR_USED));
      sector.writeUInt16LE(id, 0xFF4);
      sector.writeUInt16LE(checksum, 0xFF6);
      sector.copy(this.data, sectorOffset, 0, SIZE_SECTOR);
    }
  }
  
  /**
   * Get box offset in storage buffer
   */
  getBoxOffset(box) {
    if (box < 0 || box >= COUNT_BOX) return -1;
    // Each box has COUNT_SLOTSPERBOX slots, each slot is SIZE_STORED bytes
    return box * COUNT_SLOTSPERBOX * SIZE_STORED;
  }
  
  /**
   * Get party offset in large buffer
   */
  getPartyOffset() {
    // Party starts after trainer data in large buffer
    // Approximate offset - may need adjustment based on game version
    return 0x98; // Common offset for party data
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
    return this.decryptPKM(pkmData);
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
   */
  decryptPKM(data) {
    if (!data || data.length < SIZE_STORED) return null;

    const PID = data.readUInt32LE(0);
    if (PID === 0) return null;
    
    const OID = data.readUInt32LE(4);
    const seed = (PID ^ OID) >>> 0;
    const sv = PID % 24;
    
    const decrypted = Buffer.from(data);
    
    // Step 1: XOR data blocks (0x20-0x50) with seed
    // Header (0x00-0x1F) is NOT encrypted
    for (let i = 0x20; i < SIZE_STORED; i += 4) {
      const value = decrypted.readUInt32LE(i);
      decrypted.writeUInt32LE((value ^ seed) >>> 0, i);
    }
    
    // Step 2: Unshuffle blocks using BlockPosition
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
      // Party Pokemon need 100 bytes, but we only have 80 bytes
      // Pad with zeros for the extra 20 bytes
      const encrypted = this.encryptPKM(pokemonData);
      const partyData = Buffer.alloc(SIZE_PARTY);
      encrypted.copy(partyData, 0, 0, SIZE_STORED);
      partyData.copy(this.largeBuffer, slotOffset, 0, SIZE_PARTY);
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
    
    // BlockPositionInvert maps PID % 24 to a shuffle value
    const BlockPositionInvert = [
      0, 1, 2, 4, 3, 5, 6, 7, 12, 18, 13, 19, 8, 10, 14, 20, 16, 22, 9, 11, 15, 21, 17, 23,
      0, 1, 2, 4, 3, 5, 6, 7, // duplicates
    ];
    const sv = BlockPositionInvert[PID % 24];
    
    // Step 1: Shuffle blocks using the inverted shuffle value
    const shuffled = this.shuffleArray3(data, sv, true);
    
    // Step 2: XOR data blocks (0x20-0x50) with seed
    // Header (0x00-0x1F) is NOT encrypted, only shuffled
    for (let i = 0x20; i < SIZE_STORED; i += 4) {
      const value = shuffled.readUInt32LE(i);
      const encryptedValue = (value ^ seed) >>> 0;
      shuffled.writeUInt32LE(encryptedValue, i);
    }
    
    // Step 3: Recalculate checksum (sum of blocks A, B, C, D at 0x20-0x4F)
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
    const BlockCount = 4;
    
    // BlockPositionInvert maps PID % 24 to a shuffle value for encryption
    const BlockPositionInvert = [
      0, 1, 2, 4, 3, 5, 6, 7, 12, 18, 13, 19, 8, 10, 14, 20, 16, 22, 9, 11, 15, 21, 17, 23,
      0, 1, 2, 4, 3, 5, 6, 7, // duplicates
    ];
    
    // BlockPosition contains block indices (0-3) for each shuffle pattern
    const BlockPosition = [
      0, 1, 2, 3, 0, 1, 3, 2, 0, 2, 1, 3, 0, 3, 1, 2, 0, 2, 3, 1, 0, 3, 2, 1,
      1, 0, 2, 3, 1, 0, 3, 2, 2, 0, 1, 3, 3, 0, 1, 2, 2, 0, 3, 1, 3, 0, 2, 1,
      1, 2, 0, 3, 1, 3, 0, 2, 2, 1, 0, 3, 3, 1, 0, 2, 2, 3, 0, 1, 3, 2, 0, 1,
      1, 2, 3, 0, 1, 3, 2, 0, 2, 1, 3, 0, 3, 1, 2, 0, 2, 3, 1, 0, 3, 2, 1, 0,
      0, 1, 2, 3, 0, 1, 3, 2, 0, 2, 1, 3, 0, 3, 1, 2, 0, 2, 3, 1, 0, 3, 2, 1,
      1, 0, 2, 3, 1, 0, 3, 2, // duplicates
    ];
    
    const result = Buffer.from(data);
    const index = sv * BlockCount;
    
    // Copy header (0x00-0x1F) as-is
    data.copy(result, 0, 0, SIZE_3HEADER);
    
    // Shuffle/unshuffle blocks
    // BlockPosition values are block indices (0-3), so srcBlockIndex is always 0-3
    // Validate data size first
    if (data.length < SIZE_3HEADER + (SIZE_3BLOCK * BlockCount)) {
      throw new Error(`Data too small for shuffling: ${data.length} bytes (need at least ${SIZE_3HEADER + (SIZE_3BLOCK * BlockCount)} bytes)`);
    }
    
    for (let block = 0; block < BlockCount; block++) {
      const arrayIndex = index + block;
      // Ensure we're within BlockPosition array bounds
      if (arrayIndex < 0 || arrayIndex >= BlockPosition.length) {
        throw new Error(`BlockPosition index out of range: ${arrayIndex} (array length: ${BlockPosition.length}, sv: ${sv}, index: ${index}, block: ${block})`);
      }
      const destOffset = SIZE_3HEADER + (SIZE_3BLOCK * block);
      const srcBlockIndex = BlockPosition[arrayIndex];
      // Ensure srcBlockIndex is valid (0-3)
      if (srcBlockIndex === undefined || srcBlockIndex < 0 || srcBlockIndex >= BlockCount) {
        throw new Error(`Invalid block index: ${srcBlockIndex} from BlockPosition[${arrayIndex}] (expected 0-${BlockCount - 1}, sv: ${sv}, index: ${index})`);
      }
      const srcOffset = SIZE_3HEADER + (SIZE_3BLOCK * srcBlockIndex);
      // Ensure srcOffset is within bounds
      if (srcOffset < 0 || srcOffset + SIZE_3BLOCK > data.length) {
        throw new Error(`Source offset out of range: ${srcOffset} (data length: ${data.length}, srcBlockIndex: ${srcBlockIndex}, arrayIndex: ${arrayIndex})`);
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
