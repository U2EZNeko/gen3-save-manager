const SAV3Parser = require('./sav3-parser.js');
const fs = require('fs');
const PK3Parser = require('./pk3-parser.js');

const saveFile = 'current_save_tested.sav';
if (fs.existsSync(saveFile)) {
  const buf = fs.readFileSync(saveFile);
  const parser = new SAV3Parser(buf);
  console.log('Checking boxes for Pokemon...\n');
  let found = 0;
  let glitched = 0;
  
  for (let box = 0; box < 14; box++) {
    for (let slot = 0; slot < 30; slot++) {
      const pkm = parser.getBoxSlot(box, slot);
      if (pkm) {
        found++;
        const parsed = PK3Parser.parse(pkm);
        if (parsed.error || parsed.species === 0 || parsed.species > 386) {
          glitched++;
          console.log(`Box ${box+1}, Slot ${slot+1}: GLITCHED - ${parsed.error || 'Invalid species ' + parsed.species}`);
        } else {
          console.log(`Box ${box+1}, Slot ${slot+1}: ${parsed.speciesName || 'Unknown'} (${parsed.species})`);
        }
        if (found >= 10) break;
      }
    }
    if (found >= 10) break;
  }
  console.log(`\nTotal found: ${found}, Glitched: ${glitched}`);
} else {
  console.log('Save file not found');
}

