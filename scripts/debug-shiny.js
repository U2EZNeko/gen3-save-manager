const fs = require('fs');
const path = require('path');
const PK3Parser = require('../parsers/pk3-parser');

// Test files
const testFiles = [
  '214 - Heracross - Relaxed [176] - C2019BA2.pk3',
  '33 - Nidorino - Quiet [172] - 629B3ADD.pk3'
];

testFiles.forEach(filename => {
  // Try root first, then pk3-db-bots directory
  let filePath = path.join(__dirname, '..', filename);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, '..', 'pk3-db-bots', filename);
  }
  
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filename}`);
    return;
  }
  
  const buffer = fs.readFileSync(filePath);
  console.log(`\n=== ${filename} ===`);
  console.log(`File size: ${buffer.length} bytes`);
  
  // Read raw values
  const personality = buffer.readUInt32LE(0x00);
  const tid = buffer.readUInt16LE(0x04);
  const sid = buffer.readUInt16LE(0x06);
  
  console.log(`Personality (PID): 0x${personality.toString(16).toUpperCase().padStart(8, '0')} (${personality})`);
  console.log(`TID: ${tid}`);
  console.log(`SID: ${sid}`);
  
  // Calculate shiny using correct formula (unsigned right shift)
  const pidLower = personality & 0xFFFF;
  const pidUpper = (personality >>> 16) & 0xFFFF;
  const shinyValue = (tid ^ sid ^ pidLower ^ pidUpper) & 0xFFFF;
  const isShiny = shinyValue < 8;
  
  console.log(`Shiny calculation:`);
  console.log(`  TID: 0x${tid.toString(16).toUpperCase().padStart(4, '0')} (${tid})`);
  console.log(`  SID: 0x${sid.toString(16).toUpperCase().padStart(4, '0')} (${sid})`);
  console.log(`  TID XOR SID: 0x${(tid ^ sid).toString(16).toUpperCase().padStart(4, '0')} (${tid ^ sid})`);
  console.log(`  PID lower 16 bits: 0x${pidLower.toString(16).toUpperCase().padStart(4, '0')} (${pidLower})`);
  console.log(`  PID upper 16 bits: 0x${pidUpper.toString(16).toUpperCase().padStart(4, '0')} (${pidUpper})`);
  console.log(`  Shiny value: 0x${shinyValue.toString(16).toUpperCase().padStart(4, '0')} (${shinyValue})`);
  console.log(`  Is shiny: ${isShiny}`);
  
  // Parse the file
  try {
    const data = PK3Parser.parse(buffer, filename);
    console.log(`\nParsed data:`);
    console.log(`  Species: ${data.species} (${data.speciesName})`);
    console.log(`  Parsed TID: ${data.tid}`);
    console.log(`  Parsed SID: ${data.sid}`);
    console.log(`  Parsed Personality: 0x${data.personality.toString(16).toUpperCase().padStart(8, '0')}`);
    console.log(`  Parsed isShiny: ${data.isShiny}`);
    
    // Recalculate with parsed values using correct formula
    const recalcPidLower = data.personality & 0xFFFF;
    const recalcPidUpper = (data.personality >>> 16) & 0xFFFF;
    const recalcShinyValue = (data.tid ^ data.sid ^ recalcPidLower ^ recalcPidUpper) & 0xFFFF;
    console.log(`  Recalculated shiny value: 0x${recalcShinyValue.toString(16).toUpperCase().padStart(4, '0')} (${recalcShinyValue})`);
    console.log(`  Should be shiny: ${recalcShinyValue < 8}`);
  } catch (error) {
    console.error(`Error parsing: ${error.message}`);
  }
  
  // Check if it's PKHeX export format
  if (buffer.length === 100) {
    const speciesAt20 = buffer.readUInt16LE(0x20);
    const validSpeciesAt20 = speciesAt20 >= 1 && speciesAt20 <= 386;
    console.log(`\nFormat check:`);
    console.log(`  Species at 0x20: ${speciesAt20} (valid: ${validSpeciesAt20})`);
    console.log(`  Likely format: ${validSpeciesAt20 ? 'PKHeX Export' : 'Party Format'}`);
  }
});

