// Pokemon data storage
let pokemonData = [];
let filteredData = [];
let selectedPokemon = new Set(); // Track selected Pokemon by filename

// Index for fast sorting/grouping operations
let pokemonIndex = {
    // Pre-computed sort keys
    otName: new Map(),      // filename -> otName (lowercase for sorting)
    tidSid: new Map(),      // filename -> tidSidKey
    filename: new Map(),    // filename -> lowercase filename
    ivSum: new Map(),       // filename -> ivSum
    evSum: new Map(),       // filename -> evSum
    // Pre-computed grouping keys
    otGroupKey: new Map(),  // filename -> full OT group key
    tidSidGroupKey: new Map() // filename -> TID/SID group key
};

// Move name cache (moveId -> moveName)
const moveCache = new Map();

// Species name cache (speciesId -> speciesName)
const speciesCache = new Map();

// Base stats cache (speciesId -> baseStats)
const baseStatsCache = new Map();

// Ability cache (speciesId -> abilities array)
const abilityCache = new Map();

// Ball image cache (ballName -> imageUrl/dataUrl)
const ballImageCache = new Map();

// Move type cache (moveId -> typeName)
const moveTypeCache = new Map();

// Sprite cache (speciesId_shiny -> image data URL or URL)
const spriteCache = new Map();

// Current database selection
let currentDatabase = localStorage.getItem('selectedDatabase') || 'db1';

// DOM elements
const databaseSelect = document.getElementById('databaseSelect');
const loadBtn = document.getElementById('loadBtn');
const sortSelect = document.getElementById('sortSelect');
const searchInput = document.getElementById('searchInput');
const groupByOT = document.getElementById('groupByOT');
const groupByTIDSID = document.getElementById('groupByTIDSID');
const shinyFilter = document.getElementById('shinyFilter');
const compactView = document.getElementById('compactView');
const duplicateScannerBtn = document.getElementById('duplicateScannerBtn');
const advancedFilterBtn = document.getElementById('advancedFilterBtn');
const duplicateResults = document.getElementById('duplicateResults');
const closeDuplicateResults = document.getElementById('closeDuplicateResults');
const advancedFilterPanel = document.getElementById('advancedFilterPanel');
const closeAdvancedFilters = document.getElementById('closeAdvancedFilters');
const applyAdvancedFilters = document.getElementById('applyAdvancedFilters');
const clearAdvancedFilters = document.getElementById('clearAdvancedFilters');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const stats = document.getElementById('stats');
const pokemonCount = document.getElementById('pokemonCount');
const filteredCount = document.getElementById('filteredCount');
const pokemonGrid = document.getElementById('pokemonGrid');

// Advanced filter state
let advancedFilters = {};

// Event listeners
// Database selection change handler
if (databaseSelect) {
    databaseSelect.addEventListener('change', (e) => {
        currentDatabase = e.target.value;
        localStorage.setItem('selectedDatabase', currentDatabase);
        // Clear current data and reload
        pokemonData = [];
        filteredData = [];
        selectedPokemon.clear();
        loadPokemon();
    });
    
    // Set initial value
    databaseSelect.value = currentDatabase;
}

loadBtn.addEventListener('click', loadPokemon);
sortSelect.addEventListener('change', sortAndDisplay);
searchInput.addEventListener('input', filterAndDisplay);
groupByOT.addEventListener('change', sortAndDisplay);
groupByTIDSID.addEventListener('change', sortAndDisplay);
shinyFilter.addEventListener('change', filterAndDisplay);
compactView.addEventListener('change', sortAndDisplay);
duplicateScannerBtn.addEventListener('click', scanDuplicates);
closeDuplicateResults.addEventListener('click', () => duplicateResults.classList.add('hidden'));
advancedFilterBtn.addEventListener('click', () => advancedFilterPanel.classList.toggle('hidden'));
closeAdvancedFilters.addEventListener('click', () => advancedFilterPanel.classList.add('hidden'));
applyAdvancedFilters.addEventListener('click', applyFilters);
clearAdvancedFilters.addEventListener('click', clearFilters);

// Load Pokemon from API
async function loadPokemon() {
    showLoading();
    hideError();
    
    try {
        const response = await fetch(`/api/pokemon?db=${currentDatabase}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        pokemonData = data;
        
        // Filter out Pokemon with errors or invalid species before preloading
        const validPokemon = pokemonData.filter(p => !p.error && p.species && p.species > 0 && p.species <= 386);
        console.log(`Loaded ${pokemonData.length} Pokemon, ${validPokemon.length} valid, ${pokemonData.length - validPokemon.length} invalid/errors`);
        
        // Pre-fetch all species names to ensure they're available (only for valid Pokemon)
        try {
            await preloadSpeciesNames(validPokemon);
        } catch (err) {
            console.error('Error preloading species names:', err);
        }
        
        // Update pokemon objects with fetched names
        try {
            pokemonData = await updatePokemonNames(pokemonData);
        } catch (err) {
            console.error('Error updating Pokemon names:', err);
            // Continue with original data if update fails
        }
        
        filteredData = [...pokemonData];
        
        // Build index for fast sorting/grouping
        buildIndex(pokemonData);
        
        if (pokemonData.length === 0) {
            showError('No .pk3 files found. Please place .pk3 files in the "pk3-files" folder.');
        } else {
            sortAndDisplay();
            showStats();
        }
    } catch (err) {
        showError(`Error loading Pokemon: ${err.message}`);
        console.error('Error:', err);
    } finally {
        hideLoading();
    }
}

// Build index for fast sorting/grouping
function buildIndex(data) {
    // Clear existing index
    pokemonIndex.otName.clear();
    pokemonIndex.tidSid.clear();
    pokemonIndex.filename.clear();
    pokemonIndex.ivSum.clear();
    pokemonIndex.evSum.clear();
    pokemonIndex.otGroupKey.clear();
    pokemonIndex.tidSidGroupKey.clear();
    
    data.forEach(p => {
        if (p.error || !p.filename) return;
        // Skip Pokemon with invalid species IDs (0 or > 386)
        if (!p.species || p.species === 0 || p.species > 386) return;
        
        // Pre-compute sort keys
        pokemonIndex.otName.set(p.filename, (p.otName || 'Unknown OT').toLowerCase());
        pokemonIndex.tidSid.set(p.filename, `${(p.otName || 'Unknown OT').toLowerCase()}_${p.tid || 0}_${p.sid || 0}`);
        pokemonIndex.filename.set(p.filename, (p.filename || '').toLowerCase());
        pokemonIndex.ivSum.set(p.filename, p.ivSum || 0);
        pokemonIndex.evSum.set(p.filename, p.evSum || 0);
        
        // Pre-compute grouping keys
        const otName = p.otName || 'Unknown OT';
        const gameName = p.originGameName || getOriginGameName(p.originGame) || 'Unknown';
        pokemonIndex.otGroupKey.set(p.filename, `${otName} (TID:${p.tid || 0} SID:${p.sid || 0}) - ${gameName}`);
        pokemonIndex.tidSidGroupKey.set(p.filename, `${otName} (TID:${p.tid || 0} SID:${p.sid || 0})`);
    });
}

// Sort Pokemon data (using index for faster sorting)
function sortPokemon(data, sortBy) {
    const sorted = [...data];
    
    switch(sortBy) {
        case 'ivSum':
            sorted.sort((a, b) => {
                if (a.error || b.error) return 0;
                const ivA = pokemonIndex.ivSum.get(a.filename) ?? (a.ivSum || 0);
                const ivB = pokemonIndex.ivSum.get(b.filename) ?? (b.ivSum || 0);
                return ivB - ivA;
            });
            break;
        case 'ivSumAsc':
            sorted.sort((a, b) => {
                if (a.error || b.error) return 0;
                const ivA = pokemonIndex.ivSum.get(a.filename) ?? (a.ivSum || 0);
                const ivB = pokemonIndex.ivSum.get(b.filename) ?? (b.ivSum || 0);
                return ivA - ivB;
            });
            break;
        case 'evSum':
            sorted.sort((a, b) => {
                if (a.error || b.error) return 0;
                const evA = pokemonIndex.evSum.get(a.filename) ?? (a.evSum || 0);
                const evB = pokemonIndex.evSum.get(b.filename) ?? (b.evSum || 0);
                return evB - evA;
            });
            break;
        case 'evSumAsc':
            sorted.sort((a, b) => {
                if (a.error || b.error) return 0;
                const evA = pokemonIndex.evSum.get(a.filename) ?? (a.evSum || 0);
                const evB = pokemonIndex.evSum.get(b.filename) ?? (b.evSum || 0);
                return evA - evB;
            });
            break;
        case 'species':
            sorted.sort((a, b) => {
                if (a.error || b.error) return 0;
                const nameA = (a.speciesName || '').toLowerCase();
                const nameB = (b.speciesName || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });
            break;
        case 'level':
            sorted.sort((a, b) => {
                if (a.error || b.error) return 0;
                return (b.level || 0) - (a.level || 0);
            });
            break;
        case 'levelAsc':
            sorted.sort((a, b) => {
                if (a.error || b.error) return 0;
                return (a.level || 0) - (b.level || 0);
            });
            break;
        case 'hp':
            sorted.sort((a, b) => {
                if (a.error || b.error) return 0;
                return (b.maxHP || 0) - (a.maxHP || 0);
            });
            break;
        case 'attack':
            sorted.sort((a, b) => {
                if (a.error || b.error) return 0;
                return (b.attack || 0) - (a.attack || 0);
            });
            break;
        case 'defense':
            sorted.sort((a, b) => {
                if (a.error || b.error) return 0;
                return (b.defense || 0) - (a.defense || 0);
            });
            break;
        case 'spAttack':
            sorted.sort((a, b) => {
                if (a.error || b.error) return 0;
                return (b.spAttack || 0) - (a.spAttack || 0);
            });
            break;
        case 'spDefense':
            sorted.sort((a, b) => {
                if (a.error || b.error) return 0;
                return (b.spDefense || 0) - (a.spDefense || 0);
            });
            break;
        case 'speed':
            sorted.sort((a, b) => {
                if (a.error || b.error) return 0;
                return (b.speed || 0) - (a.speed || 0);
            });
            break;
        case 'ivHp':
            sorted.sort((a, b) => {
                if (a.error || b.error) return 0;
                return (b.ivs?.hp || 0) - (a.ivs?.hp || 0);
            });
            break;
        case 'ivAttack':
            sorted.sort((a, b) => {
                if (a.error || b.error) return 0;
                return (b.ivs?.attack || 0) - (a.ivs?.attack || 0);
            });
            break;
        case 'ivDefense':
            sorted.sort((a, b) => {
                if (a.error || b.error) return 0;
                return (b.ivs?.defense || 0) - (a.ivs?.defense || 0);
            });
            break;
        case 'ivSpAttack':
            sorted.sort((a, b) => {
                if (a.error || b.error) return 0;
                return (b.ivs?.spAttack || 0) - (a.ivs?.spAttack || 0);
            });
            break;
        case 'ivSpDefense':
            sorted.sort((a, b) => {
                if (a.error || b.error) return 0;
                return (b.ivs?.spDefense || 0) - (a.ivs?.spDefense || 0);
            });
            break;
        case 'ivSpeed':
            sorted.sort((a, b) => {
                if (a.error || b.error) return 0;
                return (b.ivs?.speed || 0) - (a.ivs?.speed || 0);
            });
            break;
        case 'experience':
            sorted.sort((a, b) => {
                if (a.error || b.error) return 0;
                return (b.experience || 0) - (a.experience || 0);
            });
            break;
        case 'tidSid':
            // Sort by OT name (not TID) - using index
            sorted.sort((a, b) => {
                if (a.error || b.error) return 0;
                const otNameA = pokemonIndex.otName.get(a.filename) ?? (a.otName || 'Unknown OT').toLowerCase();
                const otNameB = pokemonIndex.otName.get(b.filename) ?? (b.otName || 'Unknown OT').toLowerCase();
                return otNameA.localeCompare(otNameB);
            });
            break;
        case 'filename':
            sorted.sort((a, b) => {
                if (a.error || b.error) return 0;
                const nameA = pokemonIndex.filename.get(a.filename) ?? (a.filename || '').toLowerCase();
                const nameB = pokemonIndex.filename.get(b.filename) ?? (b.filename || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });
            break;
    }
    
    return sorted;
}

// Filter Pokemon data with advanced filters
function filterPokemon(data, searchTerm, shinyOnly = false, advancedFilters = {}) {
    let filtered = data;
    
    // Filter out errors
    filtered = filtered.filter(p => !p.error);
    
    // Apply basic shiny filter (if not using advanced filters)
    if (!advancedFilters.shiny && shinyOnly) {
        filtered = filtered.filter(pokemon => pokemon.isShiny === true);
    }
    
    // Apply advanced filters
    if (Object.keys(advancedFilters).length > 0) {
        filtered = filtered.filter(pokemon => {
            // Shiny filter
            if (advancedFilters.shiny !== undefined && pokemon.isShiny !== advancedFilters.shiny) {
                return false;
            }
            
            // IV Sum
            if (advancedFilters.ivSumMin !== undefined && (pokemon.ivSum || 0) < advancedFilters.ivSumMin) return false;
            if (advancedFilters.ivSumMax !== undefined && (pokemon.ivSum || 0) > advancedFilters.ivSumMax) return false;
            
            // Individual IVs
            if (advancedFilters.ivHpMin !== undefined && (pokemon.ivs?.hp || 0) < advancedFilters.ivHpMin) return false;
            if (advancedFilters.ivHpMax !== undefined && (pokemon.ivs?.hp || 0) > advancedFilters.ivHpMax) return false;
            if (advancedFilters.ivAttackMin !== undefined && (pokemon.ivs?.attack || 0) < advancedFilters.ivAttackMin) return false;
            if (advancedFilters.ivAttackMax !== undefined && (pokemon.ivs?.attack || 0) > advancedFilters.ivAttackMax) return false;
            if (advancedFilters.ivDefenseMin !== undefined && (pokemon.ivs?.defense || 0) < advancedFilters.ivDefenseMin) return false;
            if (advancedFilters.ivDefenseMax !== undefined && (pokemon.ivs?.defense || 0) > advancedFilters.ivDefenseMax) return false;
            if (advancedFilters.ivSpAttackMin !== undefined && (pokemon.ivs?.spAttack || 0) < advancedFilters.ivSpAttackMin) return false;
            if (advancedFilters.ivSpAttackMax !== undefined && (pokemon.ivs?.spAttack || 0) > advancedFilters.ivSpAttackMax) return false;
            if (advancedFilters.ivSpDefenseMin !== undefined && (pokemon.ivs?.spDefense || 0) < advancedFilters.ivSpDefenseMin) return false;
            if (advancedFilters.ivSpDefenseMax !== undefined && (pokemon.ivs?.spDefense || 0) > advancedFilters.ivSpDefenseMax) return false;
            if (advancedFilters.ivSpeedMin !== undefined && (pokemon.ivs?.speed || 0) < advancedFilters.ivSpeedMin) return false;
            if (advancedFilters.ivSpeedMax !== undefined && (pokemon.ivs?.speed || 0) > advancedFilters.ivSpeedMax) return false;
            
            // EV Sum
            if (advancedFilters.evSumMin !== undefined && (pokemon.evSum || 0) < advancedFilters.evSumMin) return false;
            if (advancedFilters.evSumMax !== undefined && (pokemon.evSum || 0) > advancedFilters.evSumMax) return false;
            
            // Level
            if (advancedFilters.levelMin !== undefined && (pokemon.level || 0) < advancedFilters.levelMin) return false;
            if (advancedFilters.levelMax !== undefined && (pokemon.level || 0) > advancedFilters.levelMax) return false;
            
            // HP Stat
            if (advancedFilters.hpStatMin !== undefined && (pokemon.maxHP || 0) < advancedFilters.hpStatMin) return false;
            if (advancedFilters.hpStatMax !== undefined && (pokemon.maxHP || 0) > advancedFilters.hpStatMax) return false;
            
            // Nature
            if (advancedFilters.nature && advancedFilters.nature.length > 0) {
                if (!advancedFilters.nature.includes(pokemon.nature)) return false;
            }
            
            // Origin Game
            if (advancedFilters.originGame && advancedFilters.originGame.length > 0) {
                if (!advancedFilters.originGame.includes(pokemon.originGameName)) return false;
            }
            
            // Ball
            if (advancedFilters.ball && advancedFilters.ball.length > 0) {
                if (!advancedFilters.ball.includes(pokemon.ballName)) return false;
            }
            
            // Has Nickname
            if (advancedFilters.hasNickname !== undefined) {
                const hasNickname = pokemon.nickname && pokemon.nickname.trim() !== '' && 
                                   pokemon.nickname.toLowerCase() !== (pokemon.speciesName || '').toLowerCase();
                if (hasNickname !== advancedFilters.hasNickname) return false;
            }
            
            // OT Name
            if (advancedFilters.otName && advancedFilters.otName.trim() !== '') {
                const otName = (pokemon.otName || '').toLowerCase();
                if (!otName.includes(advancedFilters.otName.toLowerCase())) return false;
            }
            
            // TID
            if (advancedFilters.tidMin !== undefined && (pokemon.tid || 0) < advancedFilters.tidMin) return false;
            if (advancedFilters.tidMax !== undefined && (pokemon.tid || 0) > advancedFilters.tidMax) return false;
            
            return true;
        });
    }
    
    // Apply search filter
    if (searchTerm && searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(pokemon => {
            const species = (pokemon.speciesName || '').toLowerCase();
            const nickname = (pokemon.nickname || '').toLowerCase();
            const filename = (pokemon.filename || '').toLowerCase();
            return species.includes(term) || nickname.includes(term) || filename.includes(term);
        });
    }
    
    return filtered;
}

// Sort and display Pokemon
function sortAndDisplay() {
    const sortBy = sortSelect.value;
    const searchTerm = searchInput.value.trim();
    const shinyOnly = shinyFilter.checked;
    
    // Apply filter first (with advanced filters)
    let data = filterPokemon(pokemonData, searchTerm, shinyOnly, advancedFilters);
    
    // Then sort
    filteredData = sortPokemon(data, sortBy);
    
    // Display (with or without grouping)
    displayPokemon(filteredData);
    updateStats(filteredData.length, pokemonData.length);
}

// Filter and display Pokemon
function filterAndDisplay() {
    sortAndDisplay();
}

// Display Pokemon cards
async function displayPokemon(pokemon) {
    pokemonGrid.innerHTML = '';
    
    // Update grid class based on compact view
    if (compactView.checked) {
        pokemonGrid.classList.add('compact-grid');
    } else {
        pokemonGrid.classList.remove('compact-grid');
    }
    
    if (pokemon.length === 0) {
        pokemonGrid.innerHTML = '<div class="error-card">No Pokemon found matching your search.</div>';
        return;
    }
    
    // Check if grouping is enabled
    if (groupByOT.checked || groupByTIDSID.checked) {
        await displayGroupedPokemon(pokemon);
    } else {
        // Create all cards
        const cardPromises = pokemon.map(p => createPokemonCard(p));
        const cards = await Promise.all(cardPromises);
        cards.forEach(card => pokemonGrid.appendChild(card));
    }
    
    updateStats(pokemon.length);
}

// Display Pokemon grouped by OT Name and/or TID/SID
async function displayGroupedPokemon(pokemon) {
    // Determine grouping key based on checkboxes
    const useTIDSID = groupByTIDSID.checked;
    const useOT = groupByOT.checked;
    
    const grouped = {};
    pokemon.forEach(p => {
        if (p.error) {
            // Put errors in a special group
            if (!grouped['_errors']) {
                grouped['_errors'] = [];
            }
            grouped['_errors'].push(p);
        } else {
            // Determine grouping key (using index for faster lookup)
            let groupKey;
            if (useTIDSID && useOT) {
                // Group by both OT name, TID/SID, and Game Version
                groupKey = pokemonIndex.otGroupKey.get(p.filename) || 
                    `${p.otName || 'Unknown OT'} (TID:${p.tid || 0} SID:${p.sid || 0}) - ${p.originGameName || getOriginGameName(p.originGame) || 'Unknown'}`;
            } else if (useTIDSID) {
                // Group by TID/SID only
                groupKey = `TID:${p.tid || 0} SID:${p.sid || 0}`;
            } else if (useOT) {
                // Group by OT name, TID/SID, and Game Version (comprehensive OT grouping)
                groupKey = pokemonIndex.otGroupKey.get(p.filename) || 
                    `${p.otName || 'Unknown OT'} (TID:${p.tid || 0} SID:${p.sid || 0}) - ${p.originGameName || getOriginGameName(p.originGame) || 'Unknown'}`;
            } else {
                // No grouping
                groupKey = 'All Pokemon';
            }
            
            if (!grouped[groupKey]) {
                grouped[groupKey] = [];
            }
            grouped[groupKey].push(p);
        }
    });
    
    // Sort group names alphabetically (errors last)
    const groupNames = Object.keys(grouped).sort((a, b) => {
        if (a === '_errors') return 1;
        if (b === '_errors') return -1;
        return a.localeCompare(b);
    });
    
    // Display each group
    for (const groupKey of groupNames) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'ot-group';
        
        const header = document.createElement('div');
        header.className = 'ot-group-header';
        
        const displayName = groupKey === '_errors' ? 'Errors' : groupKey;
        
        header.innerHTML = `<h2>${displayName}</h2><span class="group-count">${grouped[groupKey].length} Pokemon</span>`;
        groupDiv.appendChild(header);
        
        const groupGrid = document.createElement('div');
        groupGrid.className = 'pokemon-grid';
        
        // Apply compact grid class if compact view is enabled
        if (compactView.checked) {
            groupGrid.classList.add('compact-grid');
        }
        
        // Create all cards for this group
        const cardPromises = grouped[groupKey].map(p => createPokemonCard(p));
        const cards = await Promise.all(cardPromises);
        cards.forEach(card => groupGrid.appendChild(card));
        
        groupDiv.appendChild(groupGrid);
        pokemonGrid.appendChild(groupDiv);
    }
}

// Get origin game name from game code
function getOriginGameName(gameCode) {
    const games = {
        0: 'None',
        1: 'Sapphire',
        2: 'Ruby',
        3: 'Emerald',
        4: 'FireRed',
        5: 'LeafGreen',
        7: 'Colosseum',
        8: 'XD',
        15: 'Channel',
    };
    return games[gameCode] || `Game ${gameCode}`;
}

// Create Pokemon card element
async function createPokemonCard(pokemon) {
    const card = document.createElement('div');
    card.className = 'pokemon-card';
    
    if (pokemon.error) {
        card.innerHTML = `
            <div class="error-card">
                <strong>${pokemon.filename}</strong><br>
                Error: ${pokemon.error}
            </div>
        `;
        return card;
    }
    
    // Get species name (should already be loaded, but fetch if missing or placeholder)
    let speciesName = pokemon.speciesName;
    if (!speciesName || speciesName === 'Loading...' || (typeof speciesName === 'string' && speciesName.includes('Unknown') && !speciesName.match(/^Unknown \(\d+\)$/))) {
        speciesName = await getSpeciesName(pokemon.species);
    }
    
    // Check if Pokemon is Gen 3 or below (use parsed flag if available, otherwise check species ID)
    // Ensure species is a number for the check
    const speciesId = parseInt(pokemon.species);
    const isGen3 = pokemon.isGen3 !== undefined ? pokemon.isGen3 : (speciesId >= 1 && speciesId <= 386);
    const spriteUrl = getSpriteUrl(speciesId, pokemon.isShiny);
    const nickname = pokemon.nickname && pokemon.nickname !== '???' && pokemon.nickname !== 'Loading...' ? pokemon.nickname : speciesName;
    
    // Only show sprite if it's Gen 3 or below (Generation 3: species IDs 1-386)
    const spriteHtml = (spriteUrl && isGen3) 
        ? `<img src="${spriteUrl}" alt="${speciesName}" 
                 onerror="this.parentElement.innerHTML='<div style=\'padding:20px;text-align:center;color:#999;\'>No Sprite<br>#${speciesId}</div>'">`
        : `<div style="padding:20px;text-align:center;color:#999;">Not Gen 3<br>#${speciesId}</div>`;
    
    // Check if compact view is enabled
    const isCompact = compactView.checked;
    
    if (isCompact) {
        // Compact view: Only name, sprite, and IV sum
        card.innerHTML = `
            <div class="pokemon-header compact-header">
                <div class="pokemon-sprite compact-sprite">
                    ${spriteHtml}
                </div>
                <div class="pokemon-info compact-info">
                    <div class="pokemon-name compact-name">${pokemon.isShiny ? '⭐ ' : ''}${nickname}</div>
                </div>
            </div>
            <div class="iv-sum compact-iv-sum">
                IV Sum: ${pokemon.ivSum || 0}
            </div>
        `;
        card.classList.add('compact');
    } else {
        // Full view: All data
        // Get moves HTML (will update asynchronously)
        const movesHtml = getMovesHTML(pokemon);
        
        card.innerHTML = `
            <div class="pokemon-header">
                <div class="pokemon-sprite">
                    ${spriteHtml}
                </div>
                <div class="pokemon-info">
                    <div class="pokemon-name">${pokemon.isShiny ? '⭐ ' : ''}${nickname}</div>
                    <div class="pokemon-species" data-species-id="${pokemon.species}">${speciesName}</div>
                </div>
            </div>
            
            <div class="iv-sum">
                IV Sum: ${pokemon.ivSum || 0}
            </div>
            
            <div class="iv-breakdown">
                <div class="iv-stat">
                    <div class="iv-stat-label">HP</div>
                    <div class="iv-stat-value">${pokemon.ivs?.hp || 0}</div>
                </div>
                <div class="iv-stat">
                    <div class="iv-stat-label">Atk</div>
                    <div class="iv-stat-value">${pokemon.ivs?.attack || 0}</div>
                </div>
                <div class="iv-stat">
                    <div class="iv-stat-label">Def</div>
                    <div class="iv-stat-value">${pokemon.ivs?.defense || 0}</div>
                </div>
                <div class="iv-stat">
                    <div class="iv-stat-label">SpA</div>
                    <div class="iv-stat-value">${pokemon.ivs?.spAttack || 0}</div>
                </div>
                <div class="iv-stat">
                    <div class="iv-stat-label">SpD</div>
                    <div class="iv-stat-value">${pokemon.ivs?.spDefense || 0}</div>
                </div>
                <div class="iv-stat">
                    <div class="iv-stat-label">Spe</div>
                    <div class="iv-stat-value">${pokemon.ivs?.speed || 0}</div>
                </div>
            </div>
            
            <div class="pokemon-details">
                <div class="detail-item">
                    <div class="detail-label">Level</div>
                    <div class="detail-value">${pokemon.level || '?'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">HP</div>
                    <div class="detail-value">${pokemon.hp || 0}/${pokemon.maxHP || 0}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Nature</div>
                    <div class="detail-value">${pokemon.natureName || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Ability</div>
                    <div class="detail-value" data-species-id="${pokemon.species}" data-ability-slot="${pokemon.ability || 0}">
                        <span class="ability-name">Loading...</span>
                        <span class="ability-type">(${pokemon.ability ? 'Hidden' : 'Normal'})</span>
                    </div>
                </div>
            </div>
            
            ${movesHtml}
            
            <div style="margin-top: 10px; font-size: 0.8em; color: #999;">
                ${pokemon.filename}
            </div>
        `;
        
        // Update move names asynchronously (only in full view)
        updateMoveNames(card, pokemon);
        
        // Calculate and update HP if needed (only in full view)
        if (pokemon.hpNeedsCalculation) {
            updateHP(card, pokemon);
        }
        
        // Update ability name asynchronously (only in full view)
        updateAbilityName(card, pokemon);
    }
    
    // Store filename in card data attribute for easy access
    card.dataset.filename = pokemon.filename;
    
    // Add selection checkbox (only show if save file is loaded)
    if (saveFileLoaded) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'pokemon-select-checkbox';
        checkbox.checked = selectedPokemon.has(pokemon.filename);
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click
            togglePokemonSelection(pokemon.filename, checkbox.checked);
        });
        
        // Insert checkbox at the top-right of the card
        const checkboxContainer = document.createElement('div');
        checkboxContainer.className = 'pokemon-checkbox-container';
        checkboxContainer.appendChild(checkbox);
        card.appendChild(checkboxContainer);
    }
    
    // Make card clickable to show expanded view (but not if clicking checkbox)
    card.style.cursor = 'pointer';
    card.addEventListener('click', (e) => {
        // Don't open modal if clicking checkbox
        if (!e.target.closest('.pokemon-select-checkbox')) {
            showPokemonModal(pokemon);
        }
    });
    
    return card;
}

// Toggle Pokemon selection
function togglePokemonSelection(filename, isSelected) {
    if (isSelected) {
        selectedPokemon.add(filename);
    } else {
        selectedPokemon.delete(filename);
    }
    updateSelectionUI();
}

// Update selection UI
function updateSelectionUI() {
    const count = selectedPokemon.size;
    selectedCount.textContent = `${count} Pokemon selected`;
    importSelectedBtn.disabled = count === 0 || !saveFileLoaded;
}

// Update all card checkbox states
function updateCardSelectionStates() {
    document.querySelectorAll('.pokemon-select-checkbox').forEach(checkbox => {
        const card = checkbox.closest('.pokemon-card');
        if (card && card.dataset.filename) {
            checkbox.checked = selectedPokemon.has(card.dataset.filename);
        }
    });
}

// Update HP in a card asynchronously
async function updateHP(card, pokemon) {
    const baseStats = await getBaseStats(pokemon.species);
    if (baseStats && baseStats.hp > 0) {
        const maxHP = calculateHP(baseStats.hp, pokemon.ivs?.hp || 0, pokemon.evHP || 0, pokemon.level || 1);
        const currentHP = pokemon.hp || maxHP; // Use stored HP if available, otherwise use max
        
        // Update the HP display - find the HP detail item
        const detailItems = card.querySelectorAll('.detail-item');
        detailItems.forEach(item => {
            const label = item.querySelector('.detail-label');
            if (label && label.textContent === 'HP') {
                const value = item.querySelector('.detail-value');
                if (value) {
                    value.textContent = `${currentHP}/${maxHP}`;
                }
            }
        });
    }
}

// Fetch abilities from PokeAPI
async function getAbilities(speciesId) {
    // Check cache first
    if (abilityCache.has(speciesId)) {
        return abilityCache.get(speciesId);
    }
    
    // Only fetch for Gen 3 Pokemon (species IDs 1-386)
    if (!isGen3OrBelow(speciesId)) {
        return null;
    }
    
    try {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${speciesId}/`);
        if (!response.ok) {
            return null;
        }
        
        const data = await response.json();
        // Get abilities - Gen 3 Pokemon have 1-2 abilities
        const abilities = data.abilities
            .filter(a => !a.is_hidden)
            .map(a => ({
                name: a.ability.name.charAt(0).toUpperCase() + a.ability.name.slice(1).replace(/-/g, ' '),
                slot: a.slot - 1 // Convert to 0-based index
            }))
            .sort((a, b) => a.slot - b.slot);
        
        // Get hidden ability if it exists
        const hiddenAbility = data.abilities.find(a => a.is_hidden);
        if (hiddenAbility) {
            abilities.push({
                name: hiddenAbility.ability.name.charAt(0).toUpperCase() + hiddenAbility.ability.name.slice(1).replace(/-/g, ' '),
                slot: 2, // Hidden ability slot
                isHidden: true
            });
        }
        
        abilityCache.set(speciesId, abilities);
        return abilities;
    } catch (error) {
        console.warn(`Failed to fetch abilities for ${speciesId}:`, error);
        return null;
    }
}

// Update ability name in a card asynchronously
async function updateAbilityName(card, pokemon) {
    const abilities = await getAbilities(pokemon.species);
    if (abilities && abilities.length > 0) {
        // Determine which ability to show based on ability slot (0 = first, 1 = hidden)
        const abilitySlot = pokemon.ability || 0;
        let ability;
        
        if (abilitySlot === 1 || abilitySlot === 2) {
            // Hidden ability
            ability = abilities.find(a => a.isHidden) || abilities[0];
        } else {
            // Normal ability (slot 0)
            ability = abilities.find(a => !a.isHidden && a.slot === 0) || abilities[0];
        }
        
        if (ability) {
            const abilityElement = card.querySelector('[data-ability-slot]');
            if (abilityElement) {
                const nameSpan = abilityElement.querySelector('.ability-name');
                const typeSpan = abilityElement.querySelector('.ability-type');
                if (nameSpan) {
                    nameSpan.textContent = ability.name;
                }
                if (typeSpan) {
                    typeSpan.textContent = ability.isHidden ? '(Hidden)' : '(Normal)';
                }
            }
        }
    } else {
        // Fallback if abilities can't be fetched
        const abilityElement = card.querySelector('[data-ability-slot]');
        if (abilityElement) {
            const nameSpan = abilityElement.querySelector('.ability-name');
            const typeSpan = abilityElement.querySelector('.ability-type');
            if (nameSpan) {
                nameSpan.textContent = 'Unknown';
            }
            if (typeSpan) {
                typeSpan.textContent = pokemon.ability ? '(Hidden)' : '(Normal)';
            }
        }
    }
}

// Update move names and types in a card asynchronously
async function updateMoveNames(card, pokemon) {
    // Fetch move data (name and type) for all moves
    const moveData = await Promise.all([
        getMoveData(pokemon.move1 || 0),
        getMoveData(pokemon.move2 || 0),
        getMoveData(pokemon.move3 || 0),
        getMoveData(pokemon.move4 || 0)
    ]);
    
    // Update each move card in the grid
    const moveCards = card.querySelectorAll('.move-card');
    moveData.forEach((data, index) => {
        if (moveCards[index] && data) {
            const moveId = [pokemon.move1, pokemon.move2, pokemon.move3, pokemon.move4][index];
            const pp = [pokemon.pp1, pokemon.pp2, pokemon.pp3, pokemon.pp4][index];
            
            // Update the move card with new data
            const newCardHtml = createMoveCard(index + 1, data.name, data.type, moveId, pp);
            moveCards[index].outerHTML = newCardHtml;
        }
    });
}

// Generation 3 Pokemon range: 1-386 (Bulbasaur to Deoxys)
const GEN3_MAX_SPECIES_ID = 386;

// Check if Pokemon is Gen 3 or below based on species ID
function isGen3OrBelow(speciesId) {
    // Generation 3 includes Pokemon with species IDs 1-386
    // Ensure speciesId is a number
    const id = parseInt(speciesId);
    if (isNaN(id) || id <= 0) {
        return false;
    }
    return id >= 1 && id <= GEN3_MAX_SPECIES_ID;
}

// Fetch species name from PokeAPI
async function getSpeciesName(speciesId) {
    // Validate speciesId
    if (!speciesId || speciesId === 0 || isNaN(speciesId)) {
        const unknownName = `Unknown (${speciesId || '?'})`;
        speciesCache.set(speciesId, unknownName);
        return unknownName;
    }
    
    // Check cache first
    if (speciesCache.has(speciesId)) {
        return speciesCache.get(speciesId);
    }
    
    // Only fetch for Gen 3 Pokemon (species IDs 1-386)
    if (!isGen3OrBelow(speciesId)) {
        const unknownName = `Unknown (${speciesId})`;
        speciesCache.set(speciesId, unknownName);
        return unknownName;
    }
    
    try {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${speciesId}/`);
        if (!response.ok) {
            // Try alternative endpoint if species endpoint fails
            try {
                const altResponse = await fetch(`https://pokeapi.co/api/v2/pokemon/${speciesId}/`);
                if (altResponse.ok) {
                    const altData = await altResponse.json();
                    const formattedName = altData.name.charAt(0).toUpperCase() + altData.name.slice(1);
                    speciesCache.set(speciesId, formattedName);
                    return formattedName;
                }
            } catch (altError) {
                console.warn(`Alternative fetch failed for species ${speciesId}:`, altError);
            }
            console.warn(`PokeAPI returned ${response.status} for species ${speciesId}`);
            const unknownName = `Unknown (${speciesId})`;
            speciesCache.set(speciesId, unknownName);
            return unknownName;
        }
        
        const data = await response.json();
        // Get the English name
        const nameEntry = data.names.find(n => n.language.name === 'en');
        const speciesName = nameEntry ? nameEntry.name : (data.name || `Unknown (${speciesId})`);
        const formattedName = speciesName.charAt(0).toUpperCase() + speciesName.slice(1);
        speciesCache.set(speciesId, formattedName);
        return formattedName;
    } catch (error) {
        console.warn(`Failed to fetch species ${speciesId}:`, error);
        const unknownName = `Unknown (${speciesId})`;
        speciesCache.set(speciesId, unknownName);
        return unknownName;
    }
}

// Fetch base stats from PokeAPI
async function getBaseStats(speciesId) {
    // Check cache first
    if (baseStatsCache.has(speciesId)) {
        return baseStatsCache.get(speciesId);
    }
    
    // Only fetch for Gen 3 Pokemon (species IDs 1-386)
    if (!isGen3OrBelow(speciesId)) {
        return null;
    }
    
    try {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${speciesId}/`);
        if (!response.ok) {
            return null;
        }
        
        const data = await response.json();
        const baseStats = {
            hp: data.stats.find(s => s.stat.name === 'hp')?.base_stat || 0,
            attack: data.stats.find(s => s.stat.name === 'attack')?.base_stat || 0,
            defense: data.stats.find(s => s.stat.name === 'defense')?.base_stat || 0,
            spAttack: data.stats.find(s => s.stat.name === 'special-attack')?.base_stat || 0,
            spDefense: data.stats.find(s => s.stat.name === 'special-defense')?.base_stat || 0,
            speed: data.stats.find(s => s.stat.name === 'speed')?.base_stat || 0
        };
        baseStatsCache.set(speciesId, baseStats);
        return baseStats;
    } catch (error) {
        console.warn(`Failed to fetch base stats for ${speciesId}:`, error);
        return null;
    }
}

// Calculate HP from base stats, IVs, EVs, and level
function calculateHP(baseHP, ivHP, evHP, level) {
    // Gen 3 HP formula: floor(((2 * BaseHP + IV + floor(EV/4)) * Level) / 100) + Level + 10
    return Math.floor(((2 * baseHP + ivHP + Math.floor(evHP / 4)) * level) / 100) + level + 10;
}

// Calculate stat from base stats, IVs, EVs, level, and nature modifier
function calculateStat(baseStat, iv, ev, level, natureModifier = 1) {
    // Gen 3 stat formula: floor((floor(((2 * Base + IV + floor(EV/4)) * Level) / 100) + 5) * Nature)
    return Math.floor((Math.floor(((2 * baseStat + iv + Math.floor(ev / 4)) * level) / 100) + 5) * natureModifier);
}

// Pre-load species names for all Pokemon
async function preloadSpeciesNames(pokemonData) {
    // Get unique species IDs
    const uniqueSpecies = new Set();
    pokemonData.forEach(p => {
        if (!p.error && p.species !== undefined && p.species !== null) {
            // Ensure species is a valid number
            const speciesId = parseInt(p.species);
            if (!isNaN(speciesId) && speciesId > 0) {
                uniqueSpecies.add(speciesId);
            } else {
                console.warn(`Invalid species ID for ${p.filename}: ${p.species} (parsed as ${speciesId})`);
            }
        } else if (!p.error) {
            console.warn(`Missing species ID for ${p.filename}`);
        }
    });
    
    // Fetch all species names in parallel (with rate limiting)
    const speciesArray = Array.from(uniqueSpecies).sort((a, b) => a - b);
    console.log(`Preloading ${speciesArray.length} unique species names from ${pokemonData.length} Pokemon...`);
    if (speciesArray.length === 0) {
        console.warn('No valid species IDs found!');
        return;
    }
    const batchSize = 10; // Process 10 at a time to avoid overwhelming the API
    
    for (let i = 0; i < speciesArray.length; i += batchSize) {
        const batch = speciesArray.slice(i, i + batchSize);
        const results = await Promise.allSettled(batch.map(speciesId => {
            return getSpeciesName(speciesId);
        }));
        
        // Log any failures
        results.forEach((result, idx) => {
            if (result.status === 'rejected') {
                console.error(`Error fetching species ${batch[idx]}:`, result.reason);
            } else if (result.value && result.value.includes('Unknown') && !result.value.match(/Unknown \(\d+\)/)) {
                console.warn(`Species ${batch[idx]} returned unexpected Unknown: ${result.value}`);
            }
        });
        
        // Small delay between batches to be respectful to the API
        if (i + batchSize < speciesArray.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    console.log(`Preloaded ${speciesCache.size} species names from ${speciesArray.length} unique species`);
}

// Update Pokemon objects with fetched species names
async function updatePokemonNames(pokemonData) {
    const updated = [];
    let missingCount = 0;
    for (const p of pokemonData) {
        if (p.error) {
            updated.push(p);
            continue;
        }
        
        // Ensure species is a valid number
        const speciesId = parseInt(p.species);
        if (isNaN(speciesId) || speciesId <= 0 || speciesId > 386) {
            // Invalid species ID - file might be corrupted or wrong format
            updated.push({
                ...p,
                species: 0, // Mark as invalid
                speciesName: `Invalid (${p.species || '?'})`
            });
            continue;
        }
        
        // Get species name from cache (should be pre-loaded)
        let speciesName = speciesCache.get(speciesId);
        if (!speciesName || speciesName === 'Loading...') {
            // If not in cache or is placeholder, fetch it (shouldn't happen after preload, but just in case)
            missingCount++;
            console.warn(`Species ${speciesId} not in cache for ${p.filename}, fetching now...`);
            speciesName = await getSpeciesName(speciesId);
        }
        
        // Ensure we have a valid string and not a placeholder
        if (typeof speciesName !== 'string' || speciesName === 'Loading...') {
            speciesName = `Unknown (${speciesId})`;
        }
        
        // Update the pokemon object
        updated.push({
            ...p,
            species: speciesId, // Ensure species is a number
            speciesName: speciesName
        });
    }
    if (missingCount > 0) {
        console.warn(`Warning: ${missingCount} Pokemon had missing species names after preload`);
    }
    return updated;
}

// Get sprite URL from PokeAPI, ensuring it's Gen 3 or below
// Uses cached URLs to reduce API calls
function getSpriteUrl(speciesId, isShiny = false) {
    // Validate and convert to number
    const id = parseInt(speciesId);
    if (isNaN(id) || id <= 0 || id > 386) {
        // Silently return null for invalid species (filtered out elsewhere)
        return null;
    }
    
    // Only allow Gen 3 Pokemon (species IDs 1-386)
    // Generation 3 includes: Bulbasaur (1) to Deoxys (386)
    if (!isGen3OrBelow(id)) {
        // Silently return null for invalid species (file might be corrupted or wrong format)
        return null;
    }
    
    // Check cache first
    const cacheKey = `${id}_${isShiny ? 'shiny' : 'normal'}`;
    if (spriteCache.has(cacheKey)) {
        return spriteCache.get(cacheKey);
    }
    
    // Use PokeAPI sprite URL
    // For Generation 3, Pokemon species ID matches PokeAPI Pokemon ID (1-386)
    // PokeAPI sprites: https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{id}.png
    // Shiny sprites: https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/{id}.png
    let url;
    if (isShiny) {
        url = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${id}.png`;
    } else {
        url = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
    }
    
    // Cache the URL
    spriteCache.set(cacheKey, url);
    return url;
}

// Fetch move name from PokeAPI
async function getMoveName(moveId) {
    const moveData = await getMoveData(moveId);
    return moveData.name;
}

// Fetch move data (name and type) from PokeAPI
async function getMoveData(moveId) {
    // Check cache first
    if (moveCache.has(moveId) && moveTypeCache.has(moveId)) {
        return {
            name: moveCache.get(moveId),
            type: moveTypeCache.get(moveId)
        };
    }
    
    // Validate move ID (Gen 3 moves are roughly 1-354)
    if (!moveId || moveId < 1 || moveId > 500) {
        const fallback = `Move #${moveId}`;
        moveCache.set(moveId, fallback);
        moveTypeCache.set(moveId, 'normal');
        return { name: fallback, type: 'normal' };
    }
    
    try {
        const response = await fetch(`https://pokeapi.co/api/v2/move/${moveId}/`);
        if (!response.ok) {
            const fallback = `Move #${moveId}`;
            moveCache.set(moveId, fallback);
            moveTypeCache.set(moveId, 'normal');
            return { name: fallback, type: 'normal' };
        }
        
        const data = await response.json();
        const moveName = data.name.charAt(0).toUpperCase() + data.name.slice(1).replace(/-/g, ' ');
        const moveType = data.type?.name || 'normal';
        
        moveCache.set(moveId, moveName);
        moveTypeCache.set(moveId, moveType);
        return { name: moveName, type: moveType };
    } catch (error) {
        console.warn(`Failed to fetch move ${moveId}:`, error);
        const fallback = `Move #${moveId}`;
        moveCache.set(moveId, fallback);
        moveTypeCache.set(moveId, 'normal');
        return { name: fallback, type: 'normal' };
    }
}

// Create move card HTML for grid display
function createMoveCard(slot, moveName, moveType, moveId, pp) {
    if (!moveId || moveId === 0) {
        return `
            <div class="move-card empty">
                <div class="move-card-content">
                    <div class="move-type-icon" style="background: #3d3d54;">---</div>
                    <div class="move-card-name">---</div>
                    <div class="move-card-pp">---</div>
                </div>
            </div>
        `;
    }
    
    const typeColor = getTypeColor(moveType);
    const typeIconUrl = getTypeIconUrl(moveType);
    
    return `
        <div class="move-card">
            <div class="move-card-content">
                <div class="move-type-icon" style="background: ${typeColor};">
                    <img src="${typeIconUrl}" alt="${moveType}" class="type-icon-img" onerror="this.style.display='none'; this.parentElement.innerHTML='${moveType.charAt(0).toUpperCase()}'">
                </div>
                <div class="move-card-name" title="${moveName}">${moveName}</div>
                <div class="move-card-pp">PP: ${pp || '?'}</div>
            </div>
        </div>
    `;
}

// Get type color for move type
function getTypeColor(type) {
    const typeColors = {
        normal: '#A8A878',
        fire: '#F08030',
        water: '#6890F0',
        electric: '#F8D030',
        grass: '#78C850',
        ice: '#98D8D8',
        fighting: '#C03028',
        poison: '#A040A0',
        ground: '#E0C068',
        flying: '#A890F0',
        psychic: '#F85888',
        bug: '#A8B820',
        rock: '#B8A038',
        ghost: '#705898',
        dragon: '#7038F8',
        dark: '#705848',
        steel: '#B8B8D0'
    };
    return typeColors[type.toLowerCase()] || '#A8A878';
}

// Get type icon URL
function getTypeIconUrl(type) {
    // Using PokeAPI type sprites - correct path doesn't include generation-iii
    // Try the standard path first, fallback to alternative if needed
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/types/${type}.png`;
}

// Get moves HTML (async version)
async function getMovesHTMLAsync(pokemon) {
    const moves = [];
    if (pokemon.move1 && pokemon.move1 > 0) moves.push({ id: pokemon.move1, pp: pokemon.pp1 });
    if (pokemon.move2 && pokemon.move2 > 0) moves.push({ id: pokemon.move2, pp: pokemon.pp2 });
    if (pokemon.move3 && pokemon.move3 > 0) moves.push({ id: pokemon.move3, pp: pokemon.pp3 });
    if (pokemon.move4 && pokemon.move4 > 0) moves.push({ id: pokemon.move4, pp: pokemon.pp4 });
    
    if (moves.length === 0) return '';
    
    // Fetch all move names in parallel
    const moveNames = await Promise.all(moves.map(m => getMoveName(m.id)));
    
    return `
        <div class="moves">
            <div class="moves-title">Moves</div>
            ${moves.map((m, i) => `<div class="move-item">${moveNames[i]} (PP: ${m.pp})</div>`).join('')}
        </div>
    `;
}

// Get moves HTML (synchronous version with placeholders that update)
function getMovesHTML(pokemon) {
    // Create 2x2 grid of move cards with placeholders
    const move1 = pokemon.move1 || 0;
    const move2 = pokemon.move2 || 0;
    const move3 = pokemon.move3 || 0;
    const move4 = pokemon.move4 || 0;
    
    // Get cached names and types if available
    const move1Name = moveCache.get(move1) || (move1 ? `Move #${move1}` : '---');
    const move2Name = moveCache.get(move2) || (move2 ? `Move #${move2}` : '---');
    const move3Name = moveCache.get(move3) || (move3 ? `Move #${move3}` : '---');
    const move4Name = moveCache.get(move4) || (move4 ? `Move #${move4}` : '---');
    
    const move1Type = moveTypeCache.get(move1) || 'normal';
    const move2Type = moveTypeCache.get(move2) || 'normal';
    const move3Type = moveTypeCache.get(move3) || 'normal';
    const move4Type = moveTypeCache.get(move4) || 'normal';
    
    return `
        <div class="moves-section">
            <div class="moves-title">Moves</div>
            <div class="moves-grid">
                ${createMoveCard(1, move1Name, move1Type, move1, pokemon.pp1)}
                ${createMoveCard(2, move2Name, move2Type, move2, pokemon.pp2)}
                ${createMoveCard(3, move3Name, move3Type, move3, pokemon.pp3)}
                ${createMoveCard(4, move4Name, move4Type, move4, pokemon.pp4)}
            </div>
        </div>
    `;
}

// UI helper functions
function showLoading() {
    loading.classList.remove('hidden');
    pokemonGrid.innerHTML = '';
}

function hideLoading() {
    loading.classList.add('hidden');
}

function showError(message) {
    error.textContent = message;
    error.classList.remove('hidden');
}

function hideError() {
    error.classList.add('hidden');
}

function showStats() {
    stats.classList.remove('hidden');
}

function updateStats(count, total = null) {
    pokemonCount.textContent = count;
    if (total !== null && count !== total) {
        filteredCount.textContent = ` (${count} of ${total} shown)`;
    } else {
        filteredCount.textContent = '';
    }
}

// Modal elements
const pokemonModal = document.getElementById('pokemonModal');
const modalBody = document.getElementById('modalBody');
const modalClose = document.querySelector('.modal-close');

// Close modal handlers
modalClose.addEventListener('click', () => {
    pokemonModal.classList.add('hidden');
});

pokemonModal.addEventListener('click', (e) => {
    if (e.target === pokemonModal) {
        pokemonModal.classList.add('hidden');
    }
});

// Close on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !pokemonModal.classList.contains('hidden')) {
        pokemonModal.classList.add('hidden');
    }
});

// Show Pokemon modal with expanded view
async function showPokemonModal(pokemon) {
    if (pokemon.error) {
        return;
    }
    
    // Ensure modal elements exist
    if (!pokemonModal || !modalBody) {
        console.error('Modal elements not found');
        return;
    }
    
    // Fetch additional data if needed
    const speciesId = parseInt(pokemon.species);
    const speciesName = await getSpeciesName(speciesId);
    const baseStats = await getBaseStats(speciesId);
    const abilities = await getAbilities(speciesId);
    
    const nickname = pokemon.nickname && pokemon.nickname !== '???' && pokemon.nickname !== 'Loading...' ? pokemon.nickname : speciesName;
    const isGen3 = pokemon.isGen3 !== undefined ? pokemon.isGen3 : (speciesId >= 1 && speciesId <= 386);
    const spriteUrl = getSpriteUrl(speciesId, pokemon.isShiny);
    
    // Determine ability name
    let abilityName = 'Unknown';
    let abilityType = 'Normal';
    if (abilities && abilities.length > 0) {
        const abilitySlot = pokemon.ability || 0;
        let ability;
        if (abilitySlot === 1 || abilitySlot === 2) {
            ability = abilities.find(a => a.isHidden) || abilities[0];
            abilityType = 'Hidden';
        } else {
            ability = abilities.find(a => !a.isHidden && a.slot === 0) || abilities[0];
            abilityType = 'Normal';
        }
        if (ability) {
            abilityName = ability.name;
        }
    }
    
    // Get move names and types
    const moveData = await Promise.all([
        getMoveData(pokemon.move1 || 0),
        getMoveData(pokemon.move2 || 0),
        getMoveData(pokemon.move3 || 0),
        getMoveData(pokemon.move4 || 0)
    ]);
    
    const moveNames = moveData.map(m => (m && m.name) ? m.name : '---');
    const moveTypes = moveData.map(m => (m && m.type) ? m.type : 'normal');
    
    // Calculate stats
    const ivs = pokemon.ivs || {};
    const evs = {
        hp: pokemon.evHP || 0,
        attack: pokemon.evAttack || 0,
        defense: pokemon.evDefense || 0,
        spAttack: pokemon.evSpAttack || 0,
        spDefense: pokemon.evSpDefense || 0,
        speed: pokemon.evSpeed || 0
    };
    
    // Calculate actual stats if we have base stats
    let calculatedStats = null;
    if (baseStats && pokemon.level) {
        const level = pokemon.level;
        calculatedStats = {
            hp: calculateHP(baseStats.hp, ivs.hp || 0, evs.hp, level),
            attack: calculateStat(baseStats.attack, ivs.attack || 0, evs.attack, level, pokemon.nature === 'adamant' || pokemon.nature === 'brave' || pokemon.nature === 'naughty' || pokemon.nature === 'lonely' ? 1.1 : (pokemon.nature === 'modest' || pokemon.nature === 'quiet' || pokemon.nature === 'mild' || pokemon.nature === 'rash' ? 0.9 : 1)),
            defense: calculateStat(baseStats.defense, ivs.defense || 0, evs.defense, level, pokemon.nature === 'bold' || pokemon.nature === 'relaxed' || pokemon.nature === 'impish' || pokemon.nature === 'lax' ? 1.1 : (pokemon.nature === 'lonely' || pokemon.nature === 'hasty' || pokemon.nature === 'mild' || pokemon.nature === 'gentle' ? 0.9 : 1)),
            spAttack: calculateStat(baseStats.spAttack, ivs.spAttack || 0, evs.spAttack, level, pokemon.nature === 'modest' || pokemon.nature === 'quiet' || pokemon.nature === 'mild' || pokemon.nature === 'rash' ? 1.1 : (pokemon.nature === 'adamant' || pokemon.nature === 'impish' || pokemon.nature === 'jolly' || pokemon.nature === 'careful' ? 0.9 : 1)),
            spDefense: calculateStat(baseStats.spDefense, ivs.spDefense || 0, evs.spDefense, level, pokemon.nature === 'calm' || pokemon.nature === 'gentle' || pokemon.nature === 'sassy' || pokemon.nature === 'careful' ? 1.1 : (pokemon.nature === 'naughty' || pokemon.nature === 'lax' || pokemon.nature === 'rash' || pokemon.nature === 'naive' ? 0.9 : 1)),
            speed: calculateStat(baseStats.speed, ivs.speed || 0, evs.speed, level, pokemon.nature === 'timid' || pokemon.nature === 'hasty' || pokemon.nature === 'jolly' || pokemon.nature === 'naive' ? 1.1 : (pokemon.nature === 'brave' || pokemon.nature === 'relaxed' || pokemon.nature === 'quiet' || pokemon.nature === 'sassy' ? 0.9 : 1))
        };
    }
    
    // Create IV chart HTML (default to radar chart)
    const ivChartHtml = createIVChart(ivs, 'radar');
    
    // Create EV chart HTML (default to radar chart)
    const evChartHtml = createEVChart(evs, 'radar');
    
    // Build modal content
    modalBody.innerHTML = `
        <div class="modal-header">
            <div class="modal-sprite">
                ${isGen3 && spriteUrl ? `<img src="${spriteUrl}" alt="${speciesName}" style="max-width: 200px; max-height: 200px;">` : `<div style="padding: 40px; text-align: center; color: #999;">No Sprite<br>#${pokemon.species}</div>`}
            </div>
            <div class="modal-title">
                <h2>${nickname}</h2>
                <h3>#${String(pokemon.species).padStart(3, '0')} - ${speciesName}</h3>
            </div>
        </div>
        
        <div class="modal-sections">
            <div class="modal-section">
                <h4>Basic Information</h4>
                <div class="modal-grid">
                    <div class="modal-item">
                        <span class="modal-label">Level:</span>
                        <span class="modal-value">${pokemon.level || '?'}</span>
                    </div>
                    <div class="modal-item">
                        <span class="modal-label">HP:</span>
                        <span class="modal-value">${pokemon.hp || 0}/${calculatedStats ? calculatedStats.hp : pokemon.maxHP || 0}</span>
                    </div>
                    <div class="modal-item">
                        <span class="modal-label">Nature:</span>
                        <span class="modal-value">${pokemon.natureName || '-'}</span>
                    </div>
                    <div class="modal-item">
                        <span class="modal-label">Ability:</span>
                        <span class="modal-value">${abilityName} <small>(${abilityType})</small></span>
                    </div>
                    <div class="modal-item">
                        <span class="modal-label">Origin Game:</span>
                        <span class="modal-value">${pokemon.originGameName || getOriginGameName(pokemon.originGame) || 'Unknown'}</span>
                    </div>
                    <div class="modal-item">
                        <span class="modal-label">Met Location:</span>
                        <span class="modal-value">${pokemon.metLocationName || pokemon.metLocation || '-'}</span>
                    </div>
                    <div class="modal-item">
                        <span class="modal-label">Ball:</span>
                        <span class="modal-value">
                            <span class="ball-display">
                                <img class="ball-thumbnail" src="" alt="${pokemon.ball || '-'}" data-ball-name="${pokemon.ball || ''}" style="width: 24px; height: 24px; vertical-align: middle; margin-right: 6px; display: none;">
                                ${pokemon.ball || '-'}
                            </span>
                        </span>
                    </div>
                    <div class="modal-item">
                        <span class="modal-label">Shiny:</span>
                        <span class="modal-value">${pokemon.isShiny ? '⭐ Yes' : 'No'}</span>
                    </div>
                    <div class="modal-item">
                        <span class="modal-label">OT Name:</span>
                        <span class="modal-value">${pokemon.otName || 'Unknown'}</span>
                    </div>
                    <div class="modal-item">
                        <span class="modal-label">TID:</span>
                        <span class="modal-value">${pokemon.tid || 0}</span>
                    </div>
                    <div class="modal-item">
                        <span class="modal-label">SID:</span>
                        <span class="modal-value">${pokemon.sid || 0}</span>
                    </div>
                    <div class="modal-item">
                        <span class="modal-label">PID:</span>
                        <span class="modal-value">${pokemon.personalityValue ? '0x' + pokemon.personalityValue.toString(16).toUpperCase().padStart(8, '0') : '-'}</span>
                    </div>
                    <div class="modal-item">
                        <span class="modal-label">Experience:</span>
                        <span class="modal-value">${pokemon.experience || 0}</span>
                    </div>
                </div>
            </div>
            
            <div class="modal-section">
                <h4>IVs (Individual Values)</h4>
                <div class="iv-summary">IV Sum: ${pokemon.ivSum || 0} / 186</div>
                <div class="chart-type-toggle">
                    <button class="chart-toggle-btn" data-chart-type="bar" data-chart-target="iv">Bar</button>
                    <button class="chart-toggle-btn active" data-chart-type="radar" data-chart-target="iv">Radar</button>
                </div>
                <div id="iv-chart-container" class="iv-chart-container">
                    ${ivChartHtml}
                </div>
            </div>
            
            <div class="modal-section">
                <h4>EVs (Effort Values)</h4>
                <div class="ev-summary">EV Sum: ${pokemon.evSum || 0} / 510</div>
                <div class="chart-type-toggle">
                    <button class="chart-toggle-btn" data-chart-type="bar" data-chart-target="ev">Bar</button>
                    <button class="chart-toggle-btn active" data-chart-type="radar" data-chart-target="ev">Radar</button>
                </div>
                <div id="ev-chart-container" class="iv-chart-container">
                    ${evChartHtml}
                </div>
            </div>
            
            ${calculatedStats ? `
            <div class="modal-section">
                <h4>Calculated Stats</h4>
                <div class="modal-grid">
                    <div class="modal-item">
                        <span class="modal-label">HP:</span>
                        <span class="modal-value">${calculatedStats.hp}</span>
                    </div>
                    <div class="modal-item">
                        <span class="modal-label">Attack:</span>
                        <span class="modal-value">${calculatedStats.attack}</span>
                    </div>
                    <div class="modal-item">
                        <span class="modal-label">Defense:</span>
                        <span class="modal-value">${calculatedStats.defense}</span>
                    </div>
                    <div class="modal-item">
                        <span class="modal-label">Sp. Attack:</span>
                        <span class="modal-value">${calculatedStats.spAttack}</span>
                    </div>
                    <div class="modal-item">
                        <span class="modal-label">Sp. Defense:</span>
                        <span class="modal-value">${calculatedStats.spDefense}</span>
                    </div>
                    <div class="modal-item">
                        <span class="modal-label">Speed:</span>
                        <span class="modal-value">${calculatedStats.speed}</span>
                    </div>
                </div>
            </div>
            ` : ''}
            
            <div class="modal-section">
                <h4>Moves</h4>
                <div class="moves-grid">
                    ${createMoveCard(1, moveNames[0] || '---', moveTypes[0] || 'normal', pokemon.move1, pokemon.pp1)}
                    ${createMoveCard(2, moveNames[1] || '---', moveTypes[1] || 'normal', pokemon.move2, pokemon.pp2)}
                    ${createMoveCard(3, moveNames[2] || '---', moveTypes[2] || 'normal', pokemon.move3, pokemon.pp3)}
                    ${createMoveCard(4, moveNames[3] || '---', moveTypes[3] || 'normal', pokemon.move4, pokemon.pp4)}
                </div>
            </div>
            
            <div class="modal-section">
                <h4>File Information</h4>
                <div class="modal-item">
                    <span class="modal-label">Filename:</span>
                    <span class="modal-value" style="font-family: monospace; font-size: 0.9em;">${pokemon.filename}</span>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-danger" onclick="deletePokemonFile('${pokemon.filename}')">Delete File</button>
                </div>
            </div>
        </div>
    `;
    
    // Store IVs and EVs in modal for chart switching (after modal body is populated)
    if (modalBody) {
        modalBody.dataset.ivs = JSON.stringify(ivs);
        modalBody.dataset.evs = JSON.stringify(evs);
    }
    
    // Show modal
    if (pokemonModal) {
        pokemonModal.classList.remove('hidden');
    }
    
    // Load ball thumbnail asynchronously
    if (pokemon.ball && pokemon.ball !== 'None' && pokemon.ball !== '-') {
        loadBallThumbnail(pokemon.ball);
    }
    
    // Setup chart toggle buttons
    setupChartToggles();
}

// Delete Pokemon file with confirmation
async function deletePokemonFile(filename) {
    // Show confirmation dialog
    const confirmed = confirm(`Are you sure you want to delete "${filename}"?\n\nThis action cannot be undone.`);
    
    if (!confirmed) {
        return;
    }
    
    try {
        const response = await fetch(`/api/pokemon/${encodeURIComponent(filename)}?db=${currentDatabase}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete file');
        }
        
        // Close modal
        pokemonModal.classList.add('hidden');
        
        // Reload Pokemon list
        await loadPokemon();
        
        // Show success message (optional)
        console.log(`File ${filename} deleted successfully`);
    } catch (error) {
        alert(`Error deleting file: ${error.message}`);
        console.error('Error deleting file:', error);
    }
}

// Get ball image URL - using PokeAPI or CDN
function getBallImageUrl(ballName) {
    // Map ball names to PokeAPI item IDs or use a CDN
    const ballMap = {
        'Master Ball': 'master-ball',
        'Ultra Ball': 'ultra-ball',
        'Great Ball': 'great-ball',
        'Poké Ball': 'poke-ball',
        'Safari Ball': 'safari-ball',
        'Net Ball': 'net-ball',
        'Dive Ball': 'dive-ball',
        'Nest Ball': 'nest-ball',
        'Repeat Ball': 'repeat-ball',
        'Timer Ball': 'timer-ball',
        'Luxury Ball': 'luxury-ball',
        'Premier Ball': 'premier-ball'
    };
    
    const ballId = ballMap[ballName];
    if (!ballId) {
        return null;
    }
    
    // Use PokeAPI for ball sprites
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${ballId}.png`;
}

// Load ball thumbnail with caching
async function loadBallThumbnail(ballName) {
    if (!ballName || ballName === 'None' || ballName === '-') {
        return;
    }
    
    // Check cache first
    if (ballImageCache.has(ballName)) {
        const imageUrl = ballImageCache.get(ballName);
        if (imageUrl) {
            updateBallThumbnails(ballName, imageUrl);
        }
        return;
    }
    
    // Get image URL
    const imageUrl = getBallImageUrl(ballName);
    if (!imageUrl) {
        return;
    }
    
    // Try to load image and cache it
    try {
        const img = new Image();
        img.onload = () => {
            // Cache the URL
            ballImageCache.set(ballName, imageUrl);
            updateBallThumbnails(ballName, imageUrl);
        };
        img.onerror = () => {
            // If image fails to load, cache null to avoid retrying
            ballImageCache.set(ballName, null);
        };
        img.src = imageUrl;
    } catch (err) {
        console.error(`Error loading ball image for ${ballName}:`, err);
        ballImageCache.set(ballName, null);
    }
}

// Update all ball thumbnails with the given ball name
function updateBallThumbnails(ballName, imageUrl) {
    if (!imageUrl) return;
    
    const thumbnails = document.querySelectorAll(`img.ball-thumbnail[data-ball-name="${ballName}"]`);
    thumbnails.forEach(img => {
        img.src = imageUrl;
        img.style.display = 'inline-block';
    });
}

// Create IV chart HTML
function createIVChart(ivs, chartType = 'radar') {
    const stats = [
        { name: 'HP', value: ivs.hp || 0 },
        { name: 'Attack', value: ivs.attack || 0 },
        { name: 'Defense', value: ivs.defense || 0 },
        { name: 'Sp. Attack', value: ivs.spAttack || 0 },
        { name: 'Sp. Defense', value: ivs.spDefense || 0 },
        { name: 'Speed', value: ivs.speed || 0 }
    ];
    
    switch(chartType) {
        case 'bar':
            return createBarChart(stats, 31, getIVColor);
        case 'radar':
        default:
            return createRadarChart(stats, 31);
    }
}

// Create bar chart (supports both IV and EV)
function createBarChart(stats, maxValue = 31, colorFn = getIVColor) {
    return `
        <div class="chart-container">
            ${stats.map(stat => `
                <div class="chart-item">
                    <div class="chart-label">
                        <span>${stat.name}</span>
                        <span class="chart-value">${stat.value}/${maxValue}</span>
                    </div>
                    <div class="chart-bar-container">
                        <div class="chart-bar" style="width: ${(stat.value / maxValue) * 100}%; background: ${colorFn(stat.value)};"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Create radar chart (supports both IV and EV)
function createRadarChart(stats, maxValue = 31) {
    const centerX = 150;
    const centerY = 150;
    const radius = 120;
    const angleStep = (2 * Math.PI) / stats.length;
    
    // Create polygon points
    const points = stats.map((stat, index) => {
        const angle = (index * angleStep) - (Math.PI / 2);
        const value = stat.value / maxValue;
        const x = centerX + (radius * value * Math.cos(angle));
        const y = centerY + (radius * value * Math.sin(angle));
        return `${x},${y}`;
    }).join(' ');
    
    // Create grid lines
    const gridLines = [0.25, 0.5, 0.75, 1.0].map(scale => {
        const gridPoints = stats.map((stat, index) => {
            const angle = (index * angleStep) - (Math.PI / 2);
            const x = centerX + (radius * scale * Math.cos(angle));
            const y = centerY + (radius * scale * Math.sin(angle));
            return `${x},${y}`;
        }).join(' ');
        return `<polygon points="${gridPoints}" fill="none" stroke="#3d3d54" stroke-width="1" opacity="0.5"/>`;
    }).join('');
    
    // Create axis lines
    const axisLines = stats.map((stat, index) => {
        const angle = (index * angleStep) - (Math.PI / 2);
        const x = centerX + (radius * Math.cos(angle));
        const y = centerY + (radius * Math.sin(angle));
        return `<line x1="${centerX}" y1="${centerY}" x2="${x}" y2="${y}" stroke="#3d3d54" stroke-width="1" opacity="0.3"/>`;
    }).join('');
    
    // Create labels
    const labels = stats.map((stat, index) => {
        const angle = (index * angleStep) - (Math.PI / 2);
        const labelRadius = radius + 25;
        const x = centerX + (labelRadius * Math.cos(angle));
        const y = centerY + (labelRadius * Math.sin(angle));
        return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="#e0e0e0" font-size="12" font-weight="bold">${stat.name}</text>`;
    }).join('');
    
    // Create value labels
    const valueLabels = stats.map((stat, index) => {
        const angle = (index * angleStep) - (Math.PI / 2);
        const value = stat.value / maxValue;
        const labelRadius = radius * value * 0.7;
        const x = centerX + (labelRadius * Math.cos(angle));
        const y = centerY + (labelRadius * Math.sin(angle));
        const color = maxValue === 255 ? '#03A9F4' : '#667eea'; // Different color for EV charts
        return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="${color}" font-size="11" font-weight="bold">${stat.value}</text>`;
    }).join('');
    
    return `
        <div class="radar-chart-container">
            <svg width="300" height="300" viewBox="0 0 300 300">
                ${gridLines}
                ${axisLines}
                <polygon points="${points}" fill="${maxValue === 255 ? '#03A9F4' : '#667eea'}" fill-opacity="0.3" stroke="${maxValue === 255 ? '#03A9F4' : '#667eea'}" stroke-width="2"/>
                ${labels}
                ${valueLabels}
            </svg>
        </div>
    `;
}

// Create grid chart
function createGridChart(stats) {
    return `
        <div class="grid-chart-container">
            ${stats.map(stat => `
                <div class="grid-chart-item">
                    <div class="grid-chart-label">${stat.name}</div>
                    <div class="grid-chart-value" style="color: ${getIVColor(stat.value)}">${stat.value}</div>
                    <div class="grid-chart-max">/31</div>
                    <div class="grid-chart-bar-container">
                        <div class="grid-chart-bar" style="width: ${(stat.value / 31) * 100}%; background: ${getIVColor(stat.value)};"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Create circular chart
function createCircularChart(stats) {
    return `
        <div class="circular-chart-container">
            ${stats.map(stat => {
                const percentage = (stat.value / 31) * 100;
                const circumference = 2 * Math.PI * 45;
                const offset = circumference - (percentage / 100) * circumference;
                return `
                    <div class="circular-chart-item">
                        <svg class="circular-chart-svg" width="120" height="120">
                            <circle class="circular-chart-bg" cx="60" cy="60" r="45" fill="none" stroke="#1e1e2e" stroke-width="8"/>
                            <circle class="circular-chart-progress" cx="60" cy="60" r="45" fill="none" 
                                    stroke="${getIVColor(stat.value)}" stroke-width="8" 
                                    stroke-dasharray="${circumference}" 
                                    stroke-dashoffset="${offset}"
                                    stroke-linecap="round"
                                    transform="rotate(-90 60 60)"/>
                            <text x="60" y="60" text-anchor="middle" dominant-baseline="middle" 
                                  fill="#e0e0e0" font-size="18" font-weight="bold">${stat.value}</text>
                        </svg>
                        <div class="circular-chart-label">${stat.name}</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// Switch chart type (for both IV and EV)
function switchChart(chartType, data, chartTarget) {
    // Update button states for the specific chart target
    document.querySelectorAll(`.chart-toggle-btn[data-chart-target="${chartTarget}"]`).forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.chartType === chartType) {
            btn.classList.add('active');
        }
    });
    
    // Update chart
    const container = document.getElementById(`${chartTarget}-chart-container`);
    if (container) {
        if (chartTarget === 'iv') {
            container.innerHTML = createIVChart(data, chartType);
        } else if (chartTarget === 'ev') {
            container.innerHTML = createEVChart(data, chartType);
        }
    }
}

// Setup chart toggle button event listeners
function setupChartToggles() {
    const toggleButtons = document.querySelectorAll('.chart-toggle-btn');
    toggleButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const chartType = this.dataset.chartType;
            const chartTarget = this.dataset.chartTarget;
            const modalBody = document.getElementById('modalBody');
            
            if (modalBody) {
                try {
                    if (chartTarget === 'iv' && modalBody.dataset.ivs) {
                        const ivs = JSON.parse(modalBody.dataset.ivs);
                        switchChart(chartType, ivs, 'iv');
                    } else if (chartTarget === 'ev' && modalBody.dataset.evs) {
                        const evs = JSON.parse(modalBody.dataset.evs);
                        switchChart(chartType, evs, 'ev');
                    }
                } catch (e) {
                    console.error('Error parsing chart data:', e);
                }
            }
        });
    });
}

// Create EV chart HTML
function createEVChart(evs, chartType = 'radar') {
    const stats = [
        { name: 'HP', value: evs.hp },
        { name: 'Attack', value: evs.attack },
        { name: 'Defense', value: evs.defense },
        { name: 'Sp. Attack', value: evs.spAttack },
        { name: 'Sp. Defense', value: evs.spDefense },
        { name: 'Speed', value: evs.speed }
    ];
    
    switch(chartType) {
        case 'bar':
            return createBarChart(stats, 255, getEVColor);
        case 'radar':
        default:
            return createRadarChart(stats, 255);
    }
}

// Get color for IV value
function getIVColor(value) {
    if (value >= 30) return '#4CAF50'; // Green for perfect/near-perfect
    if (value >= 20) return '#8BC34A'; // Light green for good
    if (value >= 10) return '#FFC107'; // Yellow for average
    return '#FF9800'; // Orange for low
}

// Get color for EV value
function getEVColor(value) {
    if (value >= 200) return '#2196F3'; // Blue for high
    if (value >= 100) return '#03A9F4'; // Light blue for medium
    if (value >= 50) return '#00BCD4'; // Cyan for low-medium
    return '#009688'; // Teal for low
}

// Duplicate Scanner
async function scanDuplicates() {
    const duplicateResultsBody = document.getElementById('duplicateResultsBody');
    duplicateResultsBody.innerHTML = '<p>Scanning for duplicates...</p>';
    duplicateResults.classList.remove('hidden');
    
    // Group by PID (Personality Value) - most reliable duplicate detection
    const pidMap = new Map();
    const ivMap = new Map(); // Also check by species + IVs + level
    const duplicates = [];
    
    pokemonData.forEach(p => {
        if (p.error) return;
        
        // Check by PID
        const pidKey = `pid_${p.personality || 0}`;
        if (!pidMap.has(pidKey)) {
            pidMap.set(pidKey, []);
        }
        pidMap.get(pidKey).push(p);
        
        // Check by species + IVs + level (alternative duplicate detection)
        if (p.speciesId && p.ivs) {
            const ivKey = `${p.speciesId}_${p.ivs.hp || 0}_${p.ivs.attack || 0}_${p.ivs.defense || 0}_${p.ivs.spAttack || 0}_${p.ivs.spDefense || 0}_${p.ivs.speed || 0}_${p.level || 0}`;
            if (!ivMap.has(ivKey)) {
                ivMap.set(ivKey, []);
            }
            ivMap.get(ivKey).push(p);
        }
    });
    
    // Find duplicates (groups with more than 1)
    const pidDuplicates = Array.from(pidMap.values()).filter(group => group.length > 1);
    const ivDuplicates = Array.from(ivMap.values()).filter(group => group.length > 1);
    
    let html = '<div class="duplicate-summary">';
    html += `<h3>Duplicate Detection Results</h3>`;
    html += `<p><strong>${pidDuplicates.length}</strong> duplicate groups found by PID (Personality Value)</p>`;
    html += `<p><strong>${ivDuplicates.length}</strong> potential duplicate groups found by Species + IVs + Level</p>`;
    html += '</div>';
    
    // Display PID duplicates
    if (pidDuplicates.length > 0) {
        html += '<div class="duplicate-section"><h4>Exact Duplicates (Same PID)</h4>';
        pidDuplicates.forEach((group, idx) => {
            html += `<div class="duplicate-group"><h5>Group ${idx + 1} (${group.length} duplicates)</h5>`;
            html += '<div class="duplicate-grid">';
            group.forEach(p => {
                const spriteUrl = getSpriteUrl(p.species, p.isShiny);
                html += `
                    <div class="duplicate-card" data-filename="${p.filename}">
                        <div class="duplicate-card-content">
                            ${spriteUrl ? `<img src="${spriteUrl}" alt="${p.speciesName || 'Unknown'}" class="duplicate-sprite" onerror="this.style.display='none'">` : '<div class="duplicate-sprite" style="display: flex; align-items: center; justify-content: center; color: #666; font-size: 0.8em;">?</div>'}
                            <div class="duplicate-card-info">
                                <strong>${p.speciesName || 'Unknown'}</strong>
                                ${p.isShiny ? ' <span class="shiny-star">⭐</span>' : ''}
                                <div class="duplicate-filename">${p.filename}</div>
                                <div class="duplicate-details">
                                    <small>Level: ${p.level || 0}</small>
                                    <small>IV Sum: ${p.ivSum || 0}</small>
                                    <small>PID: ${(p.personality || 0).toString(16).toUpperCase()}</small>
                                </div>
                            </div>
                        </div>
                        <div class="duplicate-card-actions">
                            <button class="btn btn-small btn-primary" onclick="event.stopPropagation(); showPokemonModalByFilename('${p.filename}')">View</button>
                            <button class="btn btn-small btn-danger" onclick="event.stopPropagation(); deleteDuplicateFile('${p.filename}', ${idx})">Delete</button>
                        </div>
                    </div>
                `;
            });
            html += '</div></div>';
        });
        html += '</div>';
    }
    
    // Display IV duplicates (if different from PID duplicates)
    if (ivDuplicates.length > 0) {
        html += '<div class="duplicate-section"><h4>Potential Duplicates (Same Species + IVs + Level)</h4>';
        let ivGroupIdx = 0;
        ivDuplicates.forEach(group => {
            // Skip if already shown as PID duplicate
            const isPidDuplicate = group.some(p => 
                pidDuplicates.some(pidGroup => pidGroup.includes(p))
            );
            if (isPidDuplicate) return;
            
            ivGroupIdx++;
            html += `<div class="duplicate-group"><h5>Group ${ivGroupIdx} (${group.length} potential duplicates)</h5>`;
            html += '<div class="duplicate-grid">';
            group.forEach(p => {
                const spriteUrl = getSpriteUrl(p.species, p.isShiny);
                html += `
                    <div class="duplicate-card" data-filename="${p.filename}">
                        <div class="duplicate-card-content">
                            ${spriteUrl ? `<img src="${spriteUrl}" alt="${p.speciesName || 'Unknown'}" class="duplicate-sprite" onerror="this.style.display='none'">` : '<div class="duplicate-sprite" style="display: flex; align-items: center; justify-content: center; color: #666; font-size: 0.8em;">?</div>'}
                            <div class="duplicate-card-info">
                                <strong>${p.speciesName || 'Unknown'}</strong>
                                ${p.isShiny ? ' <span class="shiny-star">⭐</span>' : ''}
                                <div class="duplicate-filename">${p.filename}</div>
                                <div class="duplicate-details">
                                    <small>Level: ${p.level || 0}</small>
                                    <small>IV Sum: ${p.ivSum || 0}</small>
                                    <small>PID: ${(p.personality || 0).toString(16).toUpperCase()}</small>
                                </div>
                            </div>
                        </div>
                        <div class="duplicate-card-actions">
                            <button class="btn btn-small btn-primary" onclick="event.stopPropagation(); showPokemonModalByFilename('${p.filename}')">View</button>
                            <button class="btn btn-small btn-danger" onclick="event.stopPropagation(); deleteDuplicateFile('${p.filename}', ${ivGroupIdx})">Delete</button>
                        </div>
                    </div>
                `;
            });
            html += '</div></div>';
        });
        html += '</div>';
    }
    
    if (pidDuplicates.length === 0 && ivDuplicates.length === 0) {
        html += '<p class="no-duplicates">No duplicates found!</p>';
    }
    
    duplicateResultsBody.innerHTML = html;
}

// Delete duplicate file and refresh duplicate scanner
async function deleteDuplicateFile(filename, groupIndex) {
    if (!confirm(`Are you sure you want to delete ${filename}? This action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/pokemon/${encodeURIComponent(filename)}?db=${currentDatabase}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        // Remove from pokemonData
        pokemonData = pokemonData.filter(p => p.filename !== filename);
        
        // Rebuild index
        buildIndex(pokemonData);
        
        // Refresh duplicate scanner
        scanDuplicates();
        
        // Refresh main display
        sortAndDisplay();
        
        console.log(`${filename} deleted successfully`);
    } catch (error) {
        console.error('Error deleting file:', error);
        alert(`Failed to delete file: ${error.message}`);
    }
}

// Apply advanced filters
function applyFilters() {
    advancedFilters = {};
    
    // IV Sum
    const ivSumMin = document.getElementById('ivSumMin').value;
    const ivSumMax = document.getElementById('ivSumMax').value;
    if (ivSumMin) advancedFilters.ivSumMin = parseInt(ivSumMin);
    if (ivSumMax) advancedFilters.ivSumMax = parseInt(ivSumMax);
    
    // Individual IVs
    const ivFields = ['Hp', 'Attack', 'Defense', 'SpAttack', 'SpDefense', 'Speed'];
    ivFields.forEach(field => {
        const min = document.getElementById(`iv${field}Min`).value;
        const max = document.getElementById(`iv${field}Max`).value;
        if (min) advancedFilters[`iv${field}Min`] = parseInt(min);
        if (max) advancedFilters[`iv${field}Max`] = parseInt(max);
    });
    
    // EV Sum
    const evSumMin = document.getElementById('evSumMin').value;
    const evSumMax = document.getElementById('evSumMax').value;
    if (evSumMin) advancedFilters.evSumMin = parseInt(evSumMin);
    if (evSumMax) advancedFilters.evSumMax = parseInt(evSumMax);
    
    // Level
    const levelMin = document.getElementById('levelMin').value;
    const levelMax = document.getElementById('levelMax').value;
    if (levelMin) advancedFilters.levelMin = parseInt(levelMin);
    if (levelMax) advancedFilters.levelMax = parseInt(levelMax);
    
    // HP Stat
    const hpStatMin = document.getElementById('hpStatMin').value;
    const hpStatMax = document.getElementById('hpStatMax').value;
    if (hpStatMin) advancedFilters.hpStatMin = parseInt(hpStatMin);
    if (hpStatMax) advancedFilters.hpStatMax = parseInt(hpStatMax);
    
    // Nature
    const natureSelect = document.getElementById('natureFilter');
    const selectedNatures = Array.from(natureSelect.selectedOptions).map(opt => opt.value);
    if (selectedNatures.length > 0) advancedFilters.nature = selectedNatures;
    
    // Origin Game
    const originGameSelect = document.getElementById('originGameFilter');
    const selectedGames = Array.from(originGameSelect.selectedOptions).map(opt => opt.value);
    if (selectedGames.length > 0) advancedFilters.originGame = selectedGames;
    
    // Ball
    const ballSelect = document.getElementById('ballFilter');
    const selectedBalls = Array.from(ballSelect.selectedOptions).map(opt => opt.value);
    if (selectedBalls.length > 0) advancedFilters.ball = selectedBalls;
    
    // Other filters
    if (document.getElementById('filterShiny').checked) {
        advancedFilters.shiny = true;
    }
    
    if (document.getElementById('filterHasNickname').checked) {
        advancedFilters.hasNickname = true;
    }
    
    const otName = document.getElementById('otNameFilter').value.trim();
    if (otName) advancedFilters.otName = otName;
    
    const tidMin = document.getElementById('tidMin').value;
    const tidMax = document.getElementById('tidMax').value;
    if (tidMin) advancedFilters.tidMin = parseInt(tidMin);
    if (tidMax) advancedFilters.tidMax = parseInt(tidMax);
    
    // Apply filters and refresh display
    sortAndDisplay();
    advancedFilterPanel.classList.add('hidden');
}

// Clear advanced filters
function clearFilters() {
    // Clear all input fields
    document.querySelectorAll('#advancedFilterPanel input[type="number"], #advancedFilterPanel input[type="text"]').forEach(input => {
        input.value = '';
    });
    document.querySelectorAll('#advancedFilterPanel input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });
    document.querySelectorAll('#advancedFilterPanel select').forEach(select => {
        select.selectedIndex = -1;
    });
    
    // Clear filter state
    advancedFilters = {};
    
    // Refresh display
    sortAndDisplay();
}

// Save File Management
const loadSaveBtn = document.getElementById('loadSaveBtn');
const saveFileSection = document.getElementById('saveFileSection');
const saveFileInput = document.getElementById('saveFileInput');
const loadSaveFileBtn = document.getElementById('loadSaveFileBtn');
const exportSaveBtn = document.getElementById('exportSaveBtn');
const saveFileStatus = document.getElementById('saveFileStatus');
const dropZone = document.getElementById('dropZone');
const selectedCount = document.getElementById('selectedCount');
const importSelectedBtn = document.getElementById('importSelectedBtn');
let saveFileLoaded = false;

// Event listeners for save file management
loadSaveBtn.addEventListener('click', () => {
    saveFileSection.classList.toggle('hidden');
});

loadSaveFileBtn.addEventListener('click', () => {
    saveFileInput.click();
});

saveFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    await loadSaveFile(file);
});

// Drag and drop for save file
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    
    const files = Array.from(e.dataTransfer.files);
    const pk3Files = files.filter(f => f.name.toLowerCase().endsWith('.pk3'));
    
    if (pk3Files.length > 0) {
        await importPokemonFiles(pk3Files);
    }
});

dropZone.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pk3';
    input.multiple = true;
    input.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        await importPokemonFiles(files);
    });
    input.click();
});

exportSaveBtn.addEventListener('click', exportSaveFile);
importSelectedBtn.addEventListener('click', importSelectedPokemon);

// Load save file
async function loadSaveFile(file) {
    if (!file.name.toLowerCase().endsWith('.sav')) {
        alert('Please select a .sav file');
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('savefile', file);
        
        const response = await fetch('/api/save/load', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            let errorMessage = 'Failed to load save file';
            try {
                const error = await response.json();
                errorMessage = error.error || errorMessage;
            } catch (e) {
                // If response is not JSON, try to get text
                const text = await response.text();
                errorMessage = text || errorMessage;
            }
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        saveFileLoaded = true;
        saveFileStatus.textContent = `Loaded: ${file.name} - OT: ${data.info.otName}`;
        saveFileStatus.style.color = '#4CAF50';
        exportSaveBtn.disabled = false;
        
        // Refresh display to show checkboxes
        sortAndDisplay();
        updateSelectionUI();
        
        console.log('Save file loaded:', data);
    } catch (error) {
        alert(`Error loading save file: ${error.message}`);
        console.error('Error:', error);
    }
}

// Import Pokemon files into save file (auto-find empty slots)
async function importPokemonFiles(files) {
    if (!saveFileLoaded) {
        alert('Please load a save file first');
        return;
    }
    
    const importTarget = document.querySelector('input[name="importTarget"]:checked').value;
    let successCount = 0;
    let errorCount = 0;
    
    for (const file of files) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = new Uint8Array(arrayBuffer);
            
            const response = await fetch('/api/save/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    pokemonData: Array.from(buffer),
                    box: undefined, // Auto-find empty slot
                    slot: undefined, // Auto-find empty slot
                    isParty: importTarget === 'party'
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to import Pokemon');
            }
            
            const result = await response.json();
            successCount++;
            console.log(`Imported ${file.name}:`, result);
        } catch (error) {
            errorCount++;
            console.error(`Error importing ${file.name}:`, error);
        }
    }
    
    alert(`Import complete: ${successCount} successful, ${errorCount} failed`);
}

// Import selected Pokemon from the website
async function importSelectedPokemon() {
    if (!saveFileLoaded) {
        alert('Please load a save file first');
        return;
    }
    
    if (selectedPokemon.size === 0) {
        alert('No Pokemon selected');
        return;
    }
    
    const importTarget = document.querySelector('input[name="importTarget"]:checked').value;
    const selectedFilenames = Array.from(selectedPokemon);
    let successCount = 0;
    let errorCount = 0;
    
    // Get Pokemon data for selected files
    for (const filename of selectedFilenames) {
        try {
            const response = await fetch(`/api/pokemon/${encodeURIComponent(filename)}`);
            if (!response.ok) {
                throw new Error('Failed to fetch Pokemon data');
            }
            
            // Fetch the raw file data
            const fileResponse = await fetch(`/api/pokemon/file/${encodeURIComponent(filename)}?db=${currentDatabase}`);
            if (!fileResponse.ok) {
                throw new Error('Could not access Pokemon file');
            }
            
            const blob = await fileResponse.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const buffer = new Uint8Array(arrayBuffer);
            
            await importSinglePokemon(Array.from(buffer), importTarget);
            successCount++;
        } catch (error) {
            errorCount++;
            console.error(`Error importing ${filename}:`, error);
        }
    }
    
    alert(`Import complete: ${successCount} successful, ${errorCount} failed`);
    
    // Clear selection
    selectedPokemon.clear();
    updateSelectionUI();
    updateCardSelectionStates();
}

// Import a single Pokemon
async function importSinglePokemon(pokemonData, importTarget) {
    const response = await fetch('/api/save/import', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            pokemonData: pokemonData,
            box: undefined,
            slot: undefined,
            isParty: importTarget === 'party'
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to import Pokemon');
    }
    
    return await response.json();
}

// Export save file
async function exportSaveFile() {
    if (!saveFileLoaded) {
        alert('No save file loaded');
        return;
    }
    
    try {
        const response = await fetch('/api/save/export');
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to export save file');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'save_modified.sav';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        console.log('Save file exported');
    } catch (error) {
        alert(`Error exporting save file: ${error.message}`);
        console.error('Error:', error);
    }
}

// Load database list from server
async function loadDatabases() {
    try {
        const response = await fetch('/api/databases');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const databases = await response.json();
        
        // Update database select dropdown
        if (databaseSelect) {
            databaseSelect.innerHTML = '';
            databases.forEach(db => {
                const option = document.createElement('option');
                option.value = db.id;
                option.textContent = `${db.name} (${db.fileCount || db.count || 0} files)`;
                databaseSelect.appendChild(option);
            });
        }
    } catch (err) {
        console.error('Error loading databases:', err);
    }
}

// Auto-load Pokemon when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        // Load database list and update select
        await loadDatabases();
        // Set the saved database selection
        if (databaseSelect) {
            databaseSelect.value = currentDatabase;
        }
        // Load Pokemon from selected database
        loadPokemon();
    });
} else {
    // DOM is already ready, load immediately
    (async () => {
        await loadDatabases();
        if (databaseSelect) {
            databaseSelect.value = currentDatabase;
        }
        loadPokemon();
    })();
}

