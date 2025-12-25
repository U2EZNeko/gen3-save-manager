const SAV3Parser = require('./sav3-parser.js');
const PK3Parser = require('./pk3-parser.js');
const fs = require('fs');

const saveFile = 'current_save_tested.sav';
if (fs.existsSync(saveFile)) {
  console.log('=== Debugging Save File ===\n');
  
  const buf = fs.readFileSync(saveFile);
  const parser = new SAV3Parser(buf);
  
  console.log(`Active slot: ${parser.activeSlot}`);
  console.log(`Storage buffer size: ${parser.storageBuffer.length} bytes`);
  console.log(`Expected: ${9 * 3968} = ${9 * 3968} bytes\n`);
  
  // Check if Pokemon are in storage buffer
  console.log('Checking storage buffer for Pokemon...');
  let foundInBuffer = 0;
  for (let box = 0; box < 14; box++) {
    for (let slot = 0; slot < 30; slot++) {
      const boxOffset = parser.getBoxOffset(box);
      if (boxOffset < 0) continue;
      
      const slotOffset = boxOffset + (slot * 80);
      if (slotOffset + 80 > parser.storageBuffer.length) continue;
      
      const pkmData = parser.storageBuffer.slice(slotOffset, slotOffset + 80);
      const pid = pkmData.readUInt32LE(0);
      if (pid !== 0) {
        foundInBuffer++;
        if (foundInBuffer <= 3) {
          const species = pkmData.readUInt16LE(0x20);
          console.log(`  Storage buffer - Box ${box+1}, Slot ${slot+1}: PID ${pid.toString(16)}, Species ${species}`);
        }
      }
    }
  }
  console.log(`Total Pokemon in storage buffer: ${foundInBuffer}\n`);
  
  // Check if Pokemon are in the actual save file data
  console.log('Checking save file data for Pokemon...');
  let foundInData = 0;
  
  // Find storage sectors (5-13)
  const storageSectors = [];
  for (let ofs = 0; ofs < buf.length; ofs += 4096) {
    if (ofs + 4096 > buf.length) break;
    const sector = buf.slice(ofs, ofs + 4096);
    const id = sector.readUInt16LE(0xFF4);
    if (id >= 5 && id <= 13) {
      storageSectors.push({ id, offset: ofs });
    }
  }
  
  console.log(`Found ${storageSectors.length} storage sectors in save file`);
  for (const sector of storageSectors) {
    console.log(`  Sector ${sector.id} at offset ${sector.offset.toString(16)}`);
    
    // Check first few slots in this sector
    for (let i = 0; i < 10 && i * 80 < 3968; i++) {
      const slotOffset = i * 80;
      if (slotOffset + 80 > 3968) break;
      
      const pkmData = sector.offset < buf.length ? buf.slice(sector.offset + slotOffset, sector.offset + slotOffset + 80) : null;
      if (pkmData && pkmData.length === 80) {
        const pid = pkmData.readUInt32LE(0);
        if (pid !== 0) {
          foundInData++;
          if (foundInData <= 3) {
            const species = pkmData.readUInt16LE(0x20);
            console.log(`    Sector ${sector.id}, Slot ${i}: PID ${pid.toString(16)}, Species ${species}`);
          }
        }
      }
    }
  }
  console.log(`Total Pokemon found in save file data: ${foundInData}\n`);
  
  // Check if we can read Pokemon through getBoxSlot
  console.log('Checking getBoxSlot()...');
  let foundViaGetBoxSlot = 0;
  for (let box = 0; box < 14; box++) {
    for (let slot = 0; slot < 30; slot++) {
      const pkm = parser.getBoxSlot(box, slot);
      if (pkm) {
        const pid = pkm.readUInt32LE(0);
        if (pid !== 0) {
          foundViaGetBoxSlot++;
          if (foundViaGetBoxSlot <= 3) {
            const species = pkm.readUInt16LE(0x20);
            console.log(`  Box ${box+1}, Slot ${slot+1}: PID ${pid.toString(16)}, Species ${species}`);
          }
        }
      }
    }
  }
  console.log(`Total Pokemon via getBoxSlot(): ${foundViaGetBoxSlot}\n`);
  
  // Check sector checksums
  console.log('Checking sector checksums...');
  for (const sector of storageSectors) {
    const sectorData = buf.slice(sector.offset, sector.offset + 3968);
    const storedChecksum = buf.readUInt16LE(sector.offset + 0xFF6);
    
    let calculatedChecksum = 0;
    for (let i = 0; i < 3968; i += 2) {
      calculatedChecksum += sectorData.readUInt16LE(i);
    }
    calculatedChecksum = calculatedChecksum & 0xFFFF;
    
    const isValid = calculatedChecksum === storedChecksum;
    console.log(`  Sector ${sector.id}: Stored=${storedChecksum.toString(16)}, Calculated=${calculatedChecksum.toString(16)}, Valid=${isValid}`);
  }
} else {
  console.log('Save file not found');
}

