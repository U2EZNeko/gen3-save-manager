const fs = require('fs');
const path = require('path');

// Use global fetch if available (Node.js 18+), otherwise use node-fetch
let fetch;
if (typeof globalThis.fetch === 'function') {
  fetch = globalThis.fetch;
} else {
  try {
    fetch = require('node-fetch');
  } catch (e) {
    console.error('fetch not available. Please use Node.js 18+ or install node-fetch');
    process.exit(1);
  }
}

const DATA_DIR = path.join(__dirname, '..', 'data');
const POKEMON_DIR = path.join(DATA_DIR, 'pokemon');
const SPECIES_DIR = path.join(DATA_DIR, 'species');
const EVOLUTION_DIR = path.join(DATA_DIR, 'evolution');
const ENCOUNTERS_DIR = path.join(DATA_DIR, 'encounters');
const MOVES_DIR = path.join(DATA_DIR, 'moves');

// Create directories
[POKEMON_DIR, SPECIES_DIR, EVOLUTION_DIR, ENCOUNTERS_DIR, MOVES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Delay function to avoid rate limiting
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Download Pokemon data (1-1025 for all generations)
async function downloadPokemonData(speciesId) {
  try {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${speciesId}/`);
    if (!response.ok) {
      console.warn(`Failed to fetch Pokemon ${speciesId}: ${response.status}`);
      return null;
    }
    const data = await response.json();
    
    // Extract and format relevant data
    const pokemonData = {
      id: data.id,
      name: data.name,
      height: data.height,
      weight: data.weight,
      base_experience: data.base_experience,
      types: data.types.map(t => ({
        slot: t.slot,
        type: { name: t.type.name }
      })),
      abilities: data.abilities.map(a => ({
        ability: { name: a.ability.name },
        is_hidden: a.is_hidden,
        slot: a.slot
      })),
      stats: data.stats.map(s => ({
        base_stat: s.base_stat,
        stat: { name: s.stat.name }
      })),
      species: { url: data.species.url }
    };
    
    const filePath = path.join(POKEMON_DIR, `${speciesId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(pokemonData, null, 2));
    console.log(`Downloaded Pokemon ${speciesId}: ${data.name}`);
    return pokemonData;
  } catch (error) {
    console.error(`Error downloading Pokemon ${speciesId}:`, error.message);
    return null;
  }
}

// Download species data
async function downloadSpeciesData(speciesId) {
  try {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${speciesId}/`);
    if (!response.ok) {
      console.warn(`Failed to fetch species ${speciesId}: ${response.status}`);
      return null;
    }
    const data = await response.json();
    
    // Extract and format relevant data
    const speciesData = {
      id: data.id,
      name: data.name,
      evolution_chain: data.evolution_chain,
      flavor_text_entries: (data.flavor_text_entries || []).filter(e => 
        e.language && e.language.name === 'en'
      )
    };
    
    const filePath = path.join(SPECIES_DIR, `${speciesId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(speciesData, null, 2));
    console.log(`Downloaded species ${speciesId}: ${data.name}`);
    return speciesData;
  } catch (error) {
    console.error(`Error downloading species ${speciesId}:`, error.message);
    return null;
  }
}

// Download evolution chain data
async function downloadEvolutionChain(chainId) {
  try {
    const response = await fetch(`https://pokeapi.co/api/v2/evolution-chain/${chainId}/`);
    if (!response.ok) {
      console.warn(`Failed to fetch evolution chain ${chainId}: ${response.status}`);
      return null;
    }
    const data = await response.json();
    
    const filePath = path.join(EVOLUTION_DIR, `${chainId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Downloaded evolution chain ${chainId}`);
    return data;
  } catch (error) {
    console.error(`Error downloading evolution chain ${chainId}:`, error.message);
    return null;
  }
}

// Download encounters data
async function downloadEncounters(speciesId) {
  try {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${speciesId}/encounters`);
    if (!response.ok) {
      // Some Pokemon may not have encounters, that's okay
      return null;
    }
    const data = await response.json();
    
    const filePath = path.join(ENCOUNTERS_DIR, `${speciesId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Downloaded encounters for ${speciesId}`);
    return data;
  } catch (error) {
    // Encounters are optional, don't fail on error
    return null;
  }
}

// Download move data
async function downloadMove(moveId) {
  try {
    const response = await fetch(`https://pokeapi.co/api/v2/move/${moveId}/`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    
    const moveData = {
      id: data.id,
      name: data.name,
      type: data.type?.name || 'normal'
    };
    
    const filePath = path.join(MOVES_DIR, `${moveId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(moveData, null, 2));
    console.log(`Downloaded move ${moveId}: ${data.name}`);
    return moveData;
  } catch (error) {
    console.error(`Error downloading move ${moveId}:`, error.message);
    return null;
  }
}

// Main download function
async function downloadAllData() {
  console.log('Starting Pokemon data download...');
  console.log('This may take a while (downloading data for 1025 Pokemon)...\n');
  
  const maxPokemon = 1025; // Gen 1-9
  const maxMoves = 500; // Approximate max move ID
  
  // Track evolution chain IDs we've seen
  const evolutionChainIds = new Set();
  
  // Download Pokemon and species data
  for (let i = 1; i <= maxPokemon; i++) {
    // Download Pokemon data
    const pokemonData = await downloadPokemonData(i);
    await delay(100); // Rate limiting
    
    // Download species data
    const speciesData = await downloadSpeciesData(i);
    await delay(100);
    
    // Track evolution chain ID
    if (speciesData && speciesData.evolution_chain && speciesData.evolution_chain.url) {
      const chainId = parseInt(speciesData.evolution_chain.url.split('/').slice(-2, -1)[0]);
      if (chainId && !isNaN(chainId)) {
        evolutionChainIds.add(chainId);
      }
    }
    
    // Download encounters (optional, may fail for some Pokemon)
    await downloadEncounters(i);
    await delay(50);
    
    // Progress indicator
    if (i % 50 === 0) {
      console.log(`Progress: ${i}/${maxPokemon} Pokemon downloaded...\n`);
    }
  }
  
  // Download evolution chains
  console.log(`\nDownloading ${evolutionChainIds.size} evolution chains...`);
  for (const chainId of evolutionChainIds) {
    await downloadEvolutionChain(chainId);
    await delay(100);
  }
  
  // Download moves (1-500)
  console.log(`\nDownloading moves (1-${maxMoves})...`);
  for (let i = 1; i <= maxMoves; i++) {
    await downloadMove(i);
    await delay(50);
    
    if (i % 50 === 0) {
      console.log(`Progress: ${i}/${maxMoves} moves downloaded...`);
    }
  }
  
  console.log('\n✅ All data downloaded successfully!');
  console.log(`Data stored in: ${DATA_DIR}`);
}

// Run the download
downloadAllData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

