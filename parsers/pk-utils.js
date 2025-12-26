/**
 * Shared utilities for PK4/PK5/PK6/PK7 parsers
 * Contains character conversion, location names, ball names, nature names, game names, and helper functions
 */

/**
 * Check if data at offset looks valid (for PKHeX export detection)
 */
function isValidSpeciesAtOffset(buffer, offset, maxSpecies) {
  if (offset + 2 > buffer.length) return false;
  try {
    const species = buffer.readUInt16LE(offset);
    // Check if species is in valid range (1 to maxSpecies)
    if (species >= 1 && species <= maxSpecies) {
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Extract IVs from Gen 4/5/6 format
 * IVs are packed in a 32-bit value (not individual bytes)
 * Each IV is 5 bits (0-31), packed as: HP (bits 0-4), ATK (5-9), DEF (10-14), SPE (15-19), SPA (20-24), SPD (25-29)
 */
function extractIVs(buffer, offset) {
  if (offset + 4 > buffer.length) {
    return { hp: 0, attack: 0, defense: 0, speed: 0, spAttack: 0, spDefense: 0 };
  }
  
  // Read 32-bit value containing all IVs
  const iv32 = buffer.readUInt32LE(offset);
  
  // Extract each IV using bit shifts (5 bits each)
  return {
    hp: (iv32 >> 0) & 0x1F,
    attack: (iv32 >> 5) & 0x1F,
    defense: (iv32 >> 10) & 0x1F,
    speed: (iv32 >> 15) & 0x1F,
    spAttack: (iv32 >> 20) & 0x1F,
    spDefense: (iv32 >> 25) & 0x1F,
  };
}

/**
 * Gen 4 character conversion table
 * Maps Gen 4 encoded values (0x0000-0x01EC) to Unicode characters
 */
const GEN4_CHAR_TABLE = [
  '\0', '　', 'ぁ', 'あ', 'ぃ', 'い', 'ぅ', 'う', 'ぇ', 'え', 'ぉ', 'お', 'か', 'が', 'き', 'ぎ', // 000-00F
  'く', 'ぐ', 'け', 'げ', 'こ', 'ご', 'さ', 'ざ', 'し', 'じ', 'す', 'ず', 'せ', 'ぜ', 'そ', 'ぞ', // 010-01F
  'た', 'だ', 'ち', 'ぢ', 'っ', 'つ', 'づ', 'て', 'で', 'と', 'ど', 'な', 'に', 'ぬ', 'ね', 'の', // 020-02F
  'は', 'ば', 'ぱ', 'ひ', 'び', 'ぴ', 'ふ', 'ぶ', 'ぷ', 'へ', 'べ', 'ぺ', 'ほ', 'ぼ', 'ぽ', 'ま', // 030-03F
  'み', 'む', 'め', 'も', 'ゃ', 'や', 'ゅ', 'ゆ', 'ょ', 'よ', 'ら', 'り', 'る', 'れ', 'ろ', 'わ', // 040-04F
  'を', 'ん', 'ァ', 'ア', 'ィ', 'イ', 'ゥ', 'ウ', 'ェ', 'エ', 'ォ', 'オ', 'カ', 'ガ', 'キ', 'ギ', // 050-05F
  'ク', 'グ', 'ケ', 'ゲ', 'コ', 'ゴ', 'サ', 'ザ', 'シ', 'ジ', 'ス', 'ズ', 'セ', 'ゼ', 'ソ', 'ゾ', // 060-06F
  'タ', 'ダ', 'チ', 'ヂ', 'ッ', 'ツ', 'ヅ', 'テ', 'デ', 'ト', 'ド', 'ナ', 'ニ', 'ヌ', 'ネ', 'ノ', // 070-07F
  'ハ', 'バ', 'パ', 'ヒ', 'ビ', 'ピ', 'フ', 'ブ', 'プ', 'ヘ', 'ベ', 'ペ', 'ホ', 'ボ', 'ポ', 'マ', // 080-08F
  'ミ', 'ム', 'メ', 'モ', 'ャ', 'ヤ', 'ュ', 'ユ', 'ョ', 'ヨ', 'ラ', 'リ', 'ル', 'レ', 'ロ', 'ワ', // 090-09F
  'ヲ', 'ン', '０', '１', '２', '３', '４', '５', '６', '７', '８', '９', 'Ａ', 'Ｂ', 'Ｃ', 'Ｄ', // 0A0-0AF
  'Ｅ', 'Ｆ', 'Ｇ', 'Ｈ', 'Ｉ', 'Ｊ', 'Ｋ', 'Ｌ', 'Ｍ', 'Ｎ', 'Ｏ', 'Ｐ', 'Ｑ', 'Ｒ', 'Ｓ', 'Ｔ', // 0B0-0BF
  'Ｕ', 'Ｖ', 'Ｗ', 'Ｘ', 'Ｙ', 'Ｚ', 'ａ', 'ｂ', 'ｃ', 'ｄ', 'ｅ', 'ｆ', 'ｇ', 'ｈ', 'ｉ', 'ｊ', // 0C0-0CF
  'ｋ', 'ｌ', 'ｍ', 'ｎ', 'ｏ', 'ｐ', 'ｑ', 'ｒ', 'ｓ', 'ｔ', 'ｕ', 'ｖ', 'ｗ', 'ｘ', 'ｙ', 'ｚ', // 0D0-0DF
  '\0', '！', '？', '、', '。', '…', '・', '／', '「', '」', '『', '』', '（', '）', '♂', '♀', // 0E0-0EF
  '＋', 'ー', '×', '÷', '＝', '～', '：', '；', '．', '，', '♠', '♣', '♥', '♦', '★', '◎', // 0F0-0FF
  '○', '□', '△', '◇', '＠', '♪', '％', '☀', '☁', '☂', '☃', '①', '②', '③', '④', '⑤', // 100-10F
  '⑥', '⑦', '円', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '←', '↑', '↓', '→', '►', // 110-11F
  '＆', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', // 120-12F
  'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', // 130-13F
  'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', // 140-14F
  'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'À', // 150-15F
  'Á', 'Â', 'Ã', 'Ä', 'Å', 'Æ', 'Ç', 'È', 'É', 'Ê', 'Ë', 'Ì', 'Í', 'Î', 'Ï', 'Ð', // 160-16F
  'Ñ', 'Ò', 'Ó', 'Ô', 'Õ', 'Ö', '⑧', 'Ø', 'Ù', 'Ú', 'Û', 'Ü', 'Ý', 'Þ', 'ß', 'à', // 170-17F
  'á', 'â', 'ã', 'ä', 'å', 'æ', 'ç', 'è', 'é', 'ê', 'ë', 'ì', 'í', 'î', 'ï', 'ð', // 180-18F
  'ñ', 'ò', 'ó', 'ô', 'õ', 'ö', '⑨', 'ø', 'ù', 'ú', 'û', 'ü', 'ý', 'þ', 'ÿ', 'Œ', // 190-19F
  'œ', 'Ş', 'ş', 'ª', 'º', '⑩', '⑪', '⑫', '$', '¡', '¿', '!', '?', ',', '.', '⑬', // 1A0-1AF
  '･', '/', '\'', "'", '"', '"', '„', '«', '»', '(', ')', '♂', '♀', '+', '-', '*', // 1B0-1BF
  '#', '=', '&', '~', ':', ';', '⑯', '⑰', '⑱', '⑲', '⑳', '⑴', '⑵', '⑶', '⑷', '⑸', // 1C0-1CF
  '@', '⑹', '%', '⑺', '⑻', '⑼', '⑽', '⑾', '⑿', '⒀', '⒁', '⒂', '⒃', '⒄', ' ', '⒅', // 1D0-1DF
  '⒆', '⒇', '⒈', '⒉', '⒊', '⒋', '⒌', '⒍', '°', '_', '＿', '⒎', '⒏', // 1E0-1EC
];

function convertGen4Char(val) {
  if (val === 0 || val === 0xFFFF) return null; // Terminator
  if (val <= 0x01EC) {
    const char = GEN4_CHAR_TABLE[val];
    if (char && char !== '\0') return char;
    return null;
  }
  // Korean range (0x0400-0x0D65) - use direct Unicode
  if (val >= 0x0400 && val <= 0x0D65) {
    return String.fromCharCode(val);
  }
  return null;
}

/**
 * Read string using 16-bit UTF-16LE encoding (Gen 4/5/6 format)
 */
function readString(buffer, offset, maxLength, format) {
  let str = '';
  const terminator = (format === 'pk6' || format === 'pk7') ? 0x0000 : 0xFFFF; // PK6/PK7 use 0x0000, PK4/PK5 use 0xFFFF
  
  const safeReadUInt16LE = (off) => {
    if (off + 2 > buffer.length) return 0;
    return buffer.readUInt16LE(off);
  };
  
  // Read 2 bytes at a time (UTF-16LE)
  for (let i = 0; i < maxLength * 2; i += 2) {
    if (offset + i + 2 > buffer.length) break;
    
    const charCode = safeReadUInt16LE(offset + i);
    
    // Check for terminator
    if (charCode === terminator || charCode === 0) break;
    
    let char = null;
    if (format === 'pk4') {
      // Gen 4: Use conversion table
      char = convertGen4Char(charCode);
      
      // If conversion table doesn't have it and it's in Latin Extended-A range, use direct Unicode
      if (!char && charCode >= 0x0100 && charCode <= 0x017F) {
        char = String.fromCharCode(charCode);
      }
    } else {
      // Gen 5/6/7: Direct Unicode, just normalize gender symbols
      if (charCode === 0x246E) char = '♂';
      else if (charCode === 0x246D) char = '♀';
      else if (charCode < 0x10000 && charCode !== 0) {
        char = String.fromCharCode(charCode);
      }
    }
    
    if (char) {
      str += char;
    }
  }
  
  return str.trim() || null;
}

/**
 * Get location name from location ID for Gen 4/5
 */
function getLocationNameGen4(locationID) {
  if (!locationID || locationID === 0) return 'None';
  
  // Gen 4/5 locations use banks: 0, 2000, 3000
  if (locationID >= 3000) {
    // Bank 3 (3000): Special locations
    const bank3Index = locationID - 3000;
    return `Special Location ${bank3Index}`;
  } else if (locationID >= 2000) {
    // Bank 2 (2000): Special locations
    const bank2Index = locationID - 2000;
    return `Event Location ${bank2Index}`;
  } else {
    // Bank 0 (0-234): Regular locations
    // Common Gen 4 locations
    const gen4Locations = {
      1: 'Twinleaf Town',
      2: 'Sandgem Town',
      3: 'Jubilife City',
      4: 'Oreburgh City',
      5: 'Floaroma Town',
      6: 'Eterna City',
      7: 'Hearthome City',
      8: 'Solaceon Town',
      9: 'Veilstone City',
      10: 'Pastoria City',
      11: 'Celestic Town',
      12: 'Canalave City',
      13: 'Snowpoint City',
      14: 'Sunyshore City',
      15: 'Pokémon League',
      16: 'Fight Area',
      17: 'Survival Area',
      18: 'Resort Area',
    };
    if (locationID >= 19 && locationID <= 48) {
      return `Route ${200 + (locationID - 19)}`;
    }
    // Additional Gen 4 locations
    if (locationID === 49) return 'Newmoon Island';
    if (locationID === 50) return 'Flower Paradise';
    if (locationID === 51) return 'Hall of Origin';
    if (locationID === 52) return 'Great Marsh'; // DPPt Great Marsh (Safari Zone equivalent)
    if (locationID === 53) return 'Pal Park';
    if (locationID === 63) return 'Trophy Garden';
    if (locationID === 64) return 'Iron Island';
    if (locationID === 65) return 'Fuego Ironworks';
    if (locationID === 66) return 'Valley Windworks';
    if (locationID === 67) return 'Eterna Forest';
    if (locationID === 68) return 'Old Chateau';
    if (locationID === 69) return 'Wayward Cave';
    if (locationID === 70) return 'Lost Tower';
    if (locationID === 71) return 'Ravaged Path';
    if (locationID === 72) return 'Oreburgh Gate';
    if (locationID === 73) return 'Oreburgh Mine';
    if (locationID === 74) return 'Floaroma Meadow';
    if (locationID === 75) return 'Floaroma Meadow (Flower Paradise)';
    if (locationID === 76) return 'Valor Lakefront';
    // HGSS locations (112-234)
    if (locationID === 202) return 'Safari Zone'; // HGSS Safari Zone
    if (locationID === 203) return 'Seafoam Islands'; // HGSS
    if (locationID === 228) return 'Safari Zone Gate'; // HGSS
    return gen4Locations[locationID] || `Location ${locationID}`;
  }
}

/**
 * Get location name from location ID for Gen 6
 */
function getLocationNameGen6(locationID) {
  if (!locationID || locationID === 0) return 'None';
  
  // Gen 6 locations use banks: 0, 30000, 40000, 60000
  if (locationID >= 60000) {
    // Bank 6 (60000): Special locations
    const bank6Locations = {
      60001: 'a lovely place',
      60003: 'faraway place',
      60004: 'Pokémon Movie 15',
    };
    return bank6Locations[locationID] || `Location ${locationID}`;
  } else if (locationID >= 40000) {
    // Bank 4 (40000): Event locations (Pokémon Movies, etc.)
    const bank4Index = locationID - 40000;
    // Common event locations
    if (bank4Index === 6) return 'Pokémon Movie 15';
    if (bank4Index >= 1 && bank4Index <= 79) {
      return `Pokémon Movie ${bank4Index + 9}`; // Movies 10-88
    }
    return `Event Location ${bank4Index}`;
  } else if (locationID >= 30000) {
    // Bank 3 (30000): Special locations
    const bank3Index = locationID - 30000;
    const bank3Locations = {
      1: 'Faraway place',
      3: 'a lovely place',
      4: 'Pokémon Movie 15',
      5: 'Pokémon Movie 16',
      6: 'Pokémon Movie 17',
      7: 'Pokémon Movie 18',
      8: 'Pokémon Movie 19',
      9: 'Pokémon Movie 20',
      10: 'Pokémon Movie 21',
      11: 'Pokémon Movie 22',
    };
    return bank3Locations[bank3Index] || `Special Location ${bank3Index}`;
  } else {
    // Bank 0 (0-354): Regular locations (X/Y/OR/AS)
    // Common Gen 6 locations - OR/AS routes
    if (locationID >= 300 && locationID <= 328) {
      // OR/AS routes 120-134 (mapped to 300-328)
      const routeNum = 120 + ((locationID - 300) / 2);
      return `Route ${routeNum}`;
    } else if (locationID >= 170 && locationID <= 192) {
      // OR/AS cities
      const orasCities = {
        170: 'Littleroot Town',
        172: 'Oldale Town',
        174: 'Petalburg City',
        176: 'Slateport City',
        178: 'Mauville City',
        180: 'Rustboro City',
        182: 'Fortree City',
        184: 'Lilycove City',
        186: 'Mossdeep City',
        188: 'Sootopolis City',
        190: 'Ever Grande City',
        192: 'Pokémon League',
      };
      return orasCities[locationID] || `Location ${locationID}`;
    } else if (locationID >= 194 && locationID <= 260) {
      // OR/AS routes 101-134 (even numbers)
      const routeNum = 101 + ((locationID - 194) / 2);
      return `Route ${routeNum}`;
    } else if (locationID >= 2 && locationID <= 32) {
      // X/Y cities
      const xyCities = {
        2: 'Vaniville Town',
        6: 'Santalune City',
        8: 'Lumiose City',
        10: 'Camphrier Town',
        12: 'Ambrette Town',
        14: 'Cyllage City',
        16: 'Geosenge Town',
        18: 'Shalour City',
        20: 'Coumarine City',
        22: 'Laverre City',
        24: 'Dendemille Town',
        26: 'Anistar City',
        28: 'Couriway Town',
        30: 'Snowbelle City',
        32: 'Pokémon League',
      };
      return xyCities[locationID] || `Location ${locationID}`;
    }
    return `Location ${locationID}`;
  }
}

/**
 * Get location name from location ID for Gen 7
 */
function getLocationNameGen7(locationID) {
  if (!locationID || locationID === 0) return 'None';
  
  // Gen 7 locations use banks: 0, 30000, 40000, 60000
  if (locationID >= 60000) {
    // Bank 6 (60000): Special locations
    const bank6Locations = {
      60001: 'a lovely place',
      60003: 'faraway place',
      60004: 'Pokémon Movie 15',
    };
    return bank6Locations[locationID] || `Location ${locationID}`;
  } else if (locationID >= 40000) {
    // Bank 4 (40000): Event locations (Pokémon Movies, etc.)
    const bank4Index = locationID - 40000;
    if (bank4Index >= 1 && bank4Index <= 88) {
      return `Pokémon Movie ${bank4Index + 9}`; // Movies 10-97
    }
    return `Event Location ${bank4Index}`;
  } else if (locationID >= 30000) {
    // Bank 3 (30000): Special locations
    const bank3Index = locationID - 30000;
    const bank3Locations = {
      1: 'Faraway place',
      3: 'a lovely place',
      4: 'Pokémon Movie 15',
      5: 'Pokémon Movie 16',
      6: 'Pokémon Movie 17',
      7: 'Pokémon Movie 18',
      8: 'Pokémon Movie 19',
      9: 'Pokémon Movie 20',
      10: 'Pokémon Movie 21',
      11: 'Pokémon Movie 22',
      12: 'Pokémon Movie 23',
      13: 'Pokémon Movie 24',
      14: 'Pokémon Movie 25',
      15: 'Pokémon Movie 26',
      16: 'Pokémon Movie 27',
      17: 'Pokémon Movie 28',
    };
    return bank3Locations[bank3Index] || `Special Location ${bank3Index}`;
  } else {
    // Bank 0 (0-232): Regular locations (Sun/Moon/Ultra Sun/Ultra Moon)
    // Based on PKHeX text_sm_00000_en.txt
    const gen7Locations = {
      0: 'None',
      2: 'Mystery Zone',
      4: 'Faraway Place',
      6: 'Route 1',
      7: 'Hau\'oli Outskirts',
      8: 'Route 1',
      11: 'Route 3',
      13: 'Route 2',
      15: 'Kala\'e Bay',
      17: 'Melemele Sea',
      19: 'Hau\'oli City',
      20: 'Beachfront',
      21: 'Hau\'oli City',
      22: 'Shopping District',
      23: 'Hau\'oli City',
      24: 'Marina',
      25: 'Iki Town',
      27: 'Mahalo Trail',
      29: 'Mahalo Trail',
      30: 'Plank Bridge',
      31: 'Ruins of Conflict',
      33: 'Ruins of Conflict',
      35: 'Ten Carat Hill',
      37: 'Ten Carat Hill',
      38: 'Farthest Hollow',
      39: 'Hau\'oli Cemetery',
      41: 'Melemele Meadow',
      43: 'Seaward Cave',
      45: 'Berry Fields',
      47: 'Verdant Cavern',
      48: 'Trial Site',
      49: 'Verdant Cavern',
      50: 'Totem\'s Den',
      51: 'Route 4',
      53: 'Route 5',
      55: 'Route 6',
      57: 'Route 7',
      59: 'Route 8',
      61: 'Route 9',
      63: 'Hano Grand Resort',
      65: 'Hano Beach',
      67: 'Akala Meadow',
      69: 'Paniola Town',
      71: 'Heahea City',
      73: 'Konikoni City',
      75: 'Royal Avenue',
      77: 'Memorial Hill',
      79: 'Paniola Ranch',
      83: 'Wela Volcano Park',
      85: 'Wela Volcano Park',
      86: 'Totem\'s Den',
      87: 'Brooklet Hill',
      89: 'Brooklet Hill',
      90: 'Totem\'s Den',
      91: 'Lush Jungle',
      93: 'Ruins of Life',
      95: 'Akala Outskirts',
      101: 'Diglett\'s Tunnel',
      103: 'Hano Grand Resort',
      105: 'Battle Royal Dome',
      107: 'Route 10',
      109: 'Route 11',
      111: 'Ula\'ula Beach',
      113: 'Route 13',
      115: 'Tapu Village',
      117: 'Route 15',
      119: 'Route 16',
      121: 'Route 17',
      123: 'Route 12',
      125: 'Haina Desert',
      127: 'Route 14',
      129: 'Ula\'ula Meadow',
      131: 'Po Town',
      133: 'Malie City',
      135: 'Malie Garden',
      137: 'Mount Hokulani',
      139: 'Blush Mountain',
      141: 'Ruins of Abundance',
      143: 'Lake of the Sunne',
      145: 'Lake of the Moone',
      147: 'Mount Lanakila',
      149: 'Shady House',
      151: 'Thrifty Megamart',
      152: 'Abandoned Site',
      153: 'Hokulani Observatory',
      155: 'Pokémon League',
      157: 'Poni Meadow',
      159: 'Poni Wilds',
      161: 'Ancient Poni Path',
      163: 'Poni Breaker Coast',
      165: 'Poni Grove',
      167: 'Poni Plains',
      169: 'Poni Coast',
      171: 'Poni Gauntlet',
      173: 'Seafolk Village',
      175: 'Vast Poni Canyon',
      177: 'Altar of the Sunne',
      179: 'Altar of the Moone',
      181: 'Ruins of Hope',
      183: 'Resolution Cave',
      185: 'Exeggutor Island',
      187: 'Battle Tree',
      189: 'Aether Paradise',
      191: 'Ultra Deep Sea',
      193: 'Malie City',
      194: 'Outer Cape',
      195: 'Melemele',
      196: 'Akala',
      197: 'Ula\'ula',
      198: 'Poni',
      199: 'Big Wave Beach',
      201: 'Sandy Cave',
      203: 'Heahea Beach',
      205: 'Poni Beach',
      207: 'Ultra Megalopolis',
      209: 'Megalo Tower',
      211: 'Ultra Plant',
      213: 'Ultra Crater',
      215: 'Ultra Desert',
      217: 'Ultra Forest',
      219: 'Ultra Jungle',
      221: 'Ultra Ruin',
      223: 'Ultra Space Wilds',
      225: 'Team Rocket\'s Castle',
      227: 'Plains Grotto',
      229: 'Pikachu Valley',
      230: 'Pikachu Valley', // Confirmed from text file
      231: 'Route 1',
      232: 'Trainers\' School',
    };
    
    if (gen7Locations[locationID]) {
      return gen7Locations[locationID];
    }
    
    // Fallback for unmapped locations
    return `Location ${locationID}`;
  }
}

/**
 * Map ball IDs to names
 */
function getBallName(ball) {
  const ballMap = {
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
    13: 'Dusk Ball',
    14: 'Heal Ball',
    15: 'Quick Ball',
    16: 'Cherish Ball',
    17: 'Fast Ball',
    18: 'Level Ball',
    19: 'Lure Ball',
    20: 'Heavy Ball',
    21: 'Love Ball',
    22: 'Friend Ball',
    23: 'Moon Ball',
    24: 'Sport Ball',
    25: 'Park Ball',
    26: 'Dream Ball',
    27: 'Beast Ball',
  };
  return ballMap[ball] || `Ball ${ball}`;
}

/**
 * Map nature IDs to names
 */
function getNatureName(nature) {
  const natureMap = {
    0: 'Hardy',
    1: 'Lonely',
    2: 'Brave',
    3: 'Adamant',
    4: 'Naughty',
    5: 'Bold',
    6: 'Docile',
    7: 'Relaxed',
    8: 'Impish',
    9: 'Lax',
    10: 'Timid',
    11: 'Hasty',
    12: 'Serious',
    13: 'Jolly',
    14: 'Naive',
    15: 'Modest',
    16: 'Mild',
    17: 'Quiet',
    18: 'Bashful',
    19: 'Rash',
    20: 'Calm',
    21: 'Gentle',
    22: 'Sassy',
    23: 'Careful',
    24: 'Quirky',
  };
  return natureMap[nature] || `Nature ${nature}`;
}

/**
 * Map origin game IDs to names
 */
function getGameName(originGame) {
  const gameMap = {
    0: 'None',
    1: 'Diamond',
    2: 'Pearl',
    3: 'Platinum',
    4: 'HeartGold',
    5: 'SoulSilver',
    7: 'Black',
    8: 'White',
    9: 'Black 2',
    10: 'White 2',
    11: 'X',
    12: 'Y',
    13: 'Alpha Sapphire',
    14: 'Omega Ruby',
    // Gen 6 extended versions (from PKHeX GameVersion enum)
    15: 'Channel',
    20: 'Omega Ruby', // OR (alternative code)
    21: 'Alpha Sapphire', // AS (alternative code)
    22: 'X',
    23: 'Y',
    24: 'Omega Ruby',
    25: 'Alpha Sapphire',
    26: 'X',
    27: 'Omega Ruby', // ORAS version code (27 = OR)
    30: 'GO',
    // Virtual Console (3DS) Gen 1
    35: 'Red', // Red (Virtual Console)
    36: 'Blue', // Blue (Virtual Console)
    37: 'Yellow', // Yellow (Virtual Console)
    // Virtual Console (3DS) Gen 2
    39: 'Gold', // Gold (Virtual Console)
    40: 'Silver', // Silver (Virtual Console)
    41: 'Crystal', // Crystal (Virtual Console)
    // Gen 7 games
    31: 'Sun',
    32: 'Moon',
    33: 'Ultra Sun',
    34: 'Ultra Moon',
    // Gen 7b games (Let's Go)
    42: 'Let\'s Go Pikachu',
    43: 'Let\'s Go Eevee',
  };
  return gameMap[originGame] || `Game ${originGame}`;
}

module.exports = {
  isValidSpeciesAtOffset,
  extractIVs,
  readString,
  getLocationNameGen4,
  getLocationNameGen6,
  getLocationNameGen7,
  getBallName,
  getNatureName,
  getGameName,
};

