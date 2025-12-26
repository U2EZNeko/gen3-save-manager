const SAV3Parser = require('./parsers/sav3-parser.js');
const fs = require('fs');

const saveFile = 'current_save_tested.sav';
if (fs.existsSync(saveFile)) {
  const buf = fs.readFileSync(saveFile);
  const parser = new SAV3Parser(buf);
  console.log('Checking for invalid species IDs...\n');
  let invalid = 0;
  let zeroSpecies = 0;
  let valid = 0;
  
  for (let box = 0; box < 14; box++) {
    for (let slot = 0; slot < 30; slot++) {
      const pkm = parser.getBoxSlot(box, slot);
      if (pkm) {
        const pid = pkm.readUInt32LE(0);
        if (pid !== 0) {
          const species = pkm.readUInt16LE(0x20);
          if (species === 0) {
            zeroSpecies++;
            if (zeroSpecies <= 5) console.log(`Box ${box+1}, Slot ${slot+1}: Species 0 (PID: ${pid.toString(16)})`);
          } else if (species > 386) {
            invalid++;
            if (invalid <= 5) console.log(`Box ${box+1}, Slot ${slot+1}: Invalid species ${species} (PID: ${pid.toString(16)})`);
          } else {
            valid++;
          }
        }
      }
    }
  }
  console.log(`\nValid species (1-386): ${valid}`);
  console.log(`Species 0: ${zeroSpecies}`);
  console.log(`Invalid species (>386): ${invalid}`);
} else {
  console.log('Save file not found');
}

