// Pokemon data storage
let pokemonData = [];
let filteredData = [];
let selectedPokemon = new Set(); // Track selected Pokemon by filename
let lastSelectedIndex = -1; // Track last selected card index for range selection
let statisticsPokemonData = []; // Store Pokemon data for statistics graph updates
let allPokemonCards = []; // Track all Pokemon cards in current display order

// Index for fast sorting/grouping operations
let pokemonIndex = {
    // Pre-computed sort keys
    otName: new Map(),      // filename -> otName (lowercase for sorting)
    tidSid: new Map(),      // filename -> tidSidKey
    filename: new Map(),    // filename -> lowercase filename
    ivSum: new Map(),       // filename -> ivSum
    evSum: new Map(),       // filename -> evSum
    fileDate: new Map(),    // filename -> file creation date timestamp
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

// Available generations in current database
let availableGenerations = [];

// Bot status polling interval
let botStatusInterval = null;

// DOM elements
const databaseSelect = document.getElementById('databaseSelect');
const loadBtn = document.getElementById('loadBtn');
const pokedexBtn = document.getElementById('pokedexBtn');
const mapBtn = document.getElementById('mapBtn');
const plannerBtn = document.getElementById('plannerBtn');
const plannerModal = document.getElementById('plannerModal');
const closePlannerModal = document.getElementById('closePlannerModal');
const plannerGameSelect = document.getElementById('plannerGameSelect');
const generatePlannerBtn = document.getElementById('generatePlannerBtn');
const plannerLoading = document.getElementById('plannerLoading');
const plannerResults = document.getElementById('plannerResults');
const plannerSummaryContent = document.getElementById('plannerSummaryContent');
const plannerEncountersContent = document.getElementById('plannerEncountersContent');
const batchEvolveBtn = document.getElementById('batchEvolveBtn');
const batchEvolveModal = document.getElementById('batchEvolveModal');
const closeBatchEvolveModal = document.getElementById('closeBatchEvolveModal');
const pokedexModal = document.getElementById('pokedexModal');
const closePokedexModal = document.getElementById('closePokedexModal');
const mapModal = document.getElementById('mapModal');
const closeMapModal = document.getElementById('closeMapModal');
const mapFRLGBtn = document.getElementById('mapFRLGBtn');
const mapEmeraldBtn = document.getElementById('mapEmeraldBtn');
const mapContainer = document.getElementById('mapContainer');
const mapRoot = document.getElementById('mapRoot');
const closePokemonInfoModal = document.getElementById('closePokemonInfoModal');
const pokemonInfoModal = document.getElementById('pokemonInfoModal');
const dbReloadNotification = document.getElementById('dbReloadNotification');
const reloadDbBtn = document.getElementById('reloadDbBtn');
const dismissNotificationBtn = document.getElementById('dismissNotificationBtn');
const notificationMessage = document.getElementById('notificationMessage');
const pendingFilesCounter = document.getElementById('pendingFilesCounter');
const pendingFilesCount = document.getElementById('pendingFilesCount');

// Track pending files count per database (stored in localStorage)
const PENDING_FILES_KEY = 'pendingFilesCount';
function getPendingFilesCount(dbId) {
    try {
        const counts = JSON.parse(localStorage.getItem(PENDING_FILES_KEY) || '{}');
        return counts[dbId] || 0;
    } catch (e) {
        return 0;
    }
}

function setPendingFilesCount(dbId, count) {
    try {
        const counts = JSON.parse(localStorage.getItem(PENDING_FILES_KEY) || '{}');
        counts[dbId] = count;
        localStorage.setItem(PENDING_FILES_KEY, JSON.stringify(counts));
    } catch (e) {
        console.error('Error saving pending files count:', e);
    }
}

function addPendingFilesCount(dbId, count) {
    const current = getPendingFilesCount(dbId);
    setPendingFilesCount(dbId, current + count);
    return current + count;
}

function clearPendingFilesCount(dbId) {
    try {
        const counts = JSON.parse(localStorage.getItem(PENDING_FILES_KEY) || '{}');
        delete counts[dbId];
        localStorage.setItem(PENDING_FILES_KEY, JSON.stringify(counts));
        updatePendingFilesCounter();
    } catch (e) {
        console.error('Error clearing pending files count:', e);
    }
}

// Update pending files counter display
function updatePendingFilesCounter() {
    if (!pendingFilesCount || !pendingFilesCounter) return;
    
    const pending = getPendingFilesCount(currentDatabase);
    if (pending > 0) {
        pendingFilesCount.textContent = pending;
        pendingFilesCounter.classList.remove('hidden');
    } else {
        pendingFilesCounter.classList.add('hidden');
    }
}
const sortSelect = document.getElementById('sortSelect');
const searchInput = document.getElementById('searchInput');
const groupByOT = document.getElementById('groupByOT');
const groupByTIDSID = document.getElementById('groupByTIDSID');
const shinyFilter = document.getElementById('shinyFilter');
const onePerSpeciesFilter = document.getElementById('onePerSpeciesFilter');
const onePerSpeciesLowestFilter = document.getElementById('onePerSpeciesLowestFilter');
const needsEvolutionFilter = document.getElementById('needsEvolutionFilter');
const compactView = document.getElementById('compactView');
const duplicateScannerBtn = document.getElementById('duplicateScannerBtn');
const advancedFilterBtn = document.getElementById('advancedFilterBtn');
const duplicateResults = document.getElementById('duplicateResults');
const closeDuplicateResults = document.getElementById('closeDuplicateResults');
const advancedFilterPanel = document.getElementById('advancedFilterPanel');
const closeAdvancedFilters = document.getElementById('closeAdvancedFilters');
const applyAdvancedFilters = document.getElementById('applyAdvancedFilters');
const clearAdvancedFilters = document.getElementById('clearAdvancedFilters');
const statisticsBtn = document.getElementById('statisticsBtn');
const statisticsModal = document.getElementById('statisticsModal');
const closeStatistics = document.getElementById('closeStatistics');
const statisticsBody = document.getElementById('statisticsBody');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const stats = document.getElementById('stats');
const pokemonCount = document.getElementById('pokemonCount');
const filteredCount = document.getElementById('filteredCount');
const pokemonGrid = document.getElementById('pokemonGrid');
const cardWidthSlider = document.getElementById('cardWidthSlider');
const cardWidthValue = document.getElementById('cardWidthValue');
const maxDisplayLimit = document.getElementById('maxDisplayLimit');
const startSelectingBtn = document.getElementById('startSelectingBtn');
const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');

// Advanced filter state
let advancedFilters = {};

// Theme toggle - cycles through light, grey dark, and full black dark
function getCurrentTheme() {
    const theme = document.documentElement.getAttribute('data-theme');
    if (!theme) return 'light';
    if (theme === 'dark-grey') return 'grey';
    if (theme === 'dark-black') return 'black';
    return 'light';
}

function setTheme(theme) {
    if (theme === 'light') {
        document.documentElement.removeAttribute('data-theme');
    } else if (theme === 'grey') {
        document.documentElement.setAttribute('data-theme', 'dark-grey');
    } else if (theme === 'black') {
        document.documentElement.setAttribute('data-theme', 'dark-black');
    }
    
    // Update theme config in localStorage
    const accentColorPicker = document.getElementById('accentColorPicker');
    const ivSumStyleRadios = document.querySelectorAll('input[name="ivSumStyle"]:checked');
    const currentConfig = {
        accentColor: accentColorPicker ? accentColorPicker.value : '#667eea',
        darkMode: theme,
        ivSumStyle: ivSumStyleRadios.length > 0 ? ivSumStyleRadios[0].value : 'gradient'
    };
    localStorage.setItem(THEME_CONFIG_KEY, JSON.stringify(currentConfig));
    
    // Update radio buttons in advanced options if they exist
    const darkModeRadios = document.querySelectorAll('input[name="darkMode"]');
    if (darkModeRadios.length > 0) {
        darkModeRadios.forEach(radio => {
            radio.checked = radio.value === theme;
        });
    }
}

function toggleTheme() {
    const currentTheme = getCurrentTheme();
    let nextTheme;
    
    // Cycle through: light -> grey -> black -> light
    if (currentTheme === 'light') {
        nextTheme = 'grey';
    } else if (currentTheme === 'grey') {
        nextTheme = 'black';
    } else {
        nextTheme = 'light';
    }
    
    setTheme(nextTheme);
    updateThemeIcon(nextTheme);
}

function updateThemeIcon(theme) {
    if (themeIcon) {
        if (theme === 'light') {
            themeIcon.textContent = '☀️';
        } else if (theme === 'grey') {
            themeIcon.textContent = '🌙';
        } else {
            themeIcon.textContent = '🌑';
        }
    }
}

// Initialize theme icon on page load
const currentTheme = getCurrentTheme();
updateThemeIcon(currentTheme);

// Theme toggle event listener
if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
}

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
        availableGenerations = []; // Clear available generations when database changes
        // Update pending files counter for new database
        updatePendingFilesCounter();
        loadPokemon();
    });
    
    // Set initial value
    databaseSelect.value = currentDatabase;
}

// Refresh button - only refreshes Pokemon from the current database, not the database list
loadBtn.addEventListener('click', loadPokemon);

// Pokedex button - set up event listener
if (pokedexBtn) {
    pokedexBtn.addEventListener('click', openPokedex);
    batchEvolveBtn.addEventListener('click', openBatchEvolve);
    closeBatchEvolveModal.addEventListener('click', () => {
        batchEvolveModal.classList.add('hidden');
    });
}
if (closePokedexModal && pokedexModal) {
    closePokedexModal.addEventListener('click', () => {
        pokedexModal.classList.add('hidden');
    });
}

// Map button - set up event listener
if (mapBtn && mapModal) {
    mapBtn.addEventListener('click', openMapModal);
}
if (plannerBtn && plannerModal) {
    plannerBtn.addEventListener('click', () => {
        plannerModal.classList.remove('hidden');
    });
}
if (closePlannerModal && plannerModal) {
    closePlannerModal.addEventListener('click', () => {
        plannerModal.classList.add('hidden');
    });
}
if (generatePlannerBtn) {
    generatePlannerBtn.addEventListener('click', generatePlanner);
}

if (closeMapModal && mapModal) {
    closeMapModal.addEventListener('click', () => {
        mapModal.classList.add('hidden');
    });
}

// Load map into container
async function loadMap(game) {
    if (!mapRoot) return;
    
    // Clear previous map
    mapRoot.innerHTML = '';
    
    // Create iframe for the map
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.src = game === 'frlg' ? '/FRLGIronmonMap/' : '/EmeraldIronmonMap/';
    mapRoot.appendChild(iframe);
    
    // Store reference for postMessage
    window.currentMapIframe = iframe;
}

if (mapFRLGBtn && mapEmeraldBtn) {
    mapFRLGBtn.addEventListener('click', () => {
        loadMap('frlg');
        mapFRLGBtn.classList.remove('btn-secondary');
        mapFRLGBtn.classList.add('btn-primary', 'active');
        mapEmeraldBtn.classList.remove('btn-primary', 'active');
        mapEmeraldBtn.classList.add('btn-secondary');
        // Refresh encounters if a location is selected
        const encountersDisplay = document.getElementById('encountersDisplay');
        if (encountersDisplay && !encountersDisplay.classList.contains('hidden')) {
            const selectedLocationName = document.getElementById('selectedLocationName');
            if (selectedLocationName) {
                selectLocation(selectedLocationName.textContent);
            }
        }
    });
    
    mapEmeraldBtn.addEventListener('click', () => {
        loadMap('emerald');
        mapEmeraldBtn.classList.remove('btn-secondary');
        mapEmeraldBtn.classList.add('btn-primary', 'active');
        mapFRLGBtn.classList.remove('btn-primary', 'active');
        mapFRLGBtn.classList.add('btn-secondary');
        // Refresh encounters if a location is selected
        const encountersDisplay = document.getElementById('encountersDisplay');
        if (encountersDisplay && !encountersDisplay.classList.contains('hidden')) {
            const selectedLocationName = document.getElementById('selectedLocationName');
            if (selectedLocationName) {
                selectLocation(selectedLocationName.textContent);
            }
        }
    });
}

// Close encounters button
const closeEncountersBtn = document.getElementById('closeEncountersBtn');
if (closeEncountersBtn) {
    closeEncountersBtn.addEventListener('click', closeEncountersDisplay);
}

if (closePokemonInfoModal && pokemonInfoModal) {
    closePokemonInfoModal.addEventListener('click', () => {
        pokemonInfoModal.classList.add('hidden');
    });
}

// Close modal when clicking outside
if (pokemonInfoModal) {
    pokemonInfoModal.addEventListener('click', (e) => {
        if (e.target === pokemonInfoModal) {
            pokemonInfoModal.classList.add('hidden');
        }
    });
}

// Show database reload notification
function showDbReloadNotification(filesMoved, targetDbId) {
    if (!dbReloadNotification || !notificationMessage) return;
    
    const targetDb = allDatabases.find(db => db.id === targetDbId);
    const dbName = targetDb ? targetDb.name : 'database';
    const fileText = filesMoved === 1 ? 'file' : 'files';
    
    // Add to cumulative pending count
    const totalPending = addPendingFilesCount(targetDbId, filesMoved);
    
    // Update notification message
    notificationMessage.textContent = `${filesMoved} ${fileText} ${filesMoved === 1 ? 'has' : 'have'} been moved to ${dbName} in this run. Reload to see them.`;
    
    // Update pending files counter
    if (pendingFilesCount) {
        pendingFilesCount.textContent = totalPending;
    }
    if (pendingFilesCounter) {
        pendingFilesCounter.classList.remove('hidden');
    }
    
    dbReloadNotification.classList.remove('hidden');
}

// Reload database button
if (reloadDbBtn) {
    reloadDbBtn.addEventListener('click', () => {
        // Check if we need to switch to the target database
        const savedConfig = localStorage.getItem(SCANNER_CONFIG_KEY);
        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                if (config.targetDbId && databaseSelect) {
                    databaseSelect.value = config.targetDbId;
                    currentDatabase = config.targetDbId;
                    localStorage.setItem('selectedDatabase', config.targetDbId);
                }
            } catch (e) {
                console.error('Error parsing scanner config:', e);
            }
        }
        
        // Clear pending files count for the current database
        clearPendingFilesCount(currentDatabase);
        
        // Reload Pokemon
        loadPokemon();
        
        // Hide notification
        if (dbReloadNotification) {
            dbReloadNotification.classList.add('hidden');
        }
        if (pendingFilesCounter) {
            pendingFilesCounter.classList.add('hidden');
        }
    });
}

// Dismiss notification button
if (dismissNotificationBtn) {
    dismissNotificationBtn.addEventListener('click', () => {
        if (dbReloadNotification) {
            dbReloadNotification.classList.add('hidden');
        }
    });
}
sortSelect.addEventListener('change', sortAndDisplay);
searchInput.addEventListener('input', filterAndDisplay);
groupByOT.addEventListener('change', sortAndDisplay);
groupByTIDSID.addEventListener('change', sortAndDisplay);
shinyFilter.addEventListener('change', filterAndDisplay);
onePerSpeciesFilter.addEventListener('change', (e) => {
    if (e.target.checked && onePerSpeciesLowestFilter) {
        onePerSpeciesLowestFilter.checked = false;
    }
    filterAndDisplay();
});
if (onePerSpeciesLowestFilter) {
    onePerSpeciesLowestFilter.addEventListener('change', (e) => {
        if (e.target.checked && onePerSpeciesFilter) {
            onePerSpeciesFilter.checked = false;
        }
        filterAndDisplay();
    });
}
if (needsEvolutionFilter) {
    needsEvolutionFilter.addEventListener('change', filterAndDisplay);
}
compactView.addEventListener('change', sortAndDisplay);
if (duplicateScannerBtn) {
    duplicateScannerBtn.addEventListener('click', () => {
        scanDuplicates();
        // Close advanced options modal if open
        if (advancedOptionsModal && !advancedOptionsModal.classList.contains('hidden')) {
            advancedOptionsModal.classList.add('hidden');
        }
    });
}
closeDuplicateResults.addEventListener('click', () => duplicateResults.classList.add('hidden'));
if (advancedFilterBtn) {
    advancedFilterBtn.addEventListener('click', () => {
        advancedFilterPanel.classList.toggle('hidden');
        // Close advanced options modal if open
        if (advancedOptionsModal && !advancedOptionsModal.classList.contains('hidden')) {
            advancedOptionsModal.classList.add('hidden');
        }
    });
}
closeAdvancedFilters.addEventListener('click', () => advancedFilterPanel.classList.add('hidden'));
if (statisticsBtn) {
    statisticsBtn.addEventListener('click', showStatistics);
}
if (closeStatistics) {
    closeStatistics.addEventListener('click', () => statisticsModal.classList.add('hidden'));
}
if (statisticsModal) {
    statisticsModal.addEventListener('click', (e) => {
        if (e.target === statisticsModal) {
            statisticsModal.classList.add('hidden');
        }
    });
}
applyAdvancedFilters.addEventListener('click', applyFilters);
clearAdvancedFilters.addEventListener('click', clearFilters);
cardWidthSlider.addEventListener('input', (e) => updateCardWidth(e.target.value));
if (maxDisplayLimit) {
    // Load saved max display limit from localStorage, default to 50
    const savedLimit = localStorage.getItem('maxDisplayLimit');
    if (savedLimit !== null) {
        maxDisplayLimit.value = savedLimit;
    } else {
        maxDisplayLimit.value = '50';
    }
    maxDisplayLimit.addEventListener('change', () => {
        localStorage.setItem('maxDisplayLimit', maxDisplayLimit.value);
        sortAndDisplay();
    });
}

// Selection mode toggle
if (startSelectingBtn) {
    startSelectingBtn.addEventListener('click', () => {
        selectionMode = !selectionMode;
        if (selectionMode) {
            startSelectingBtn.textContent = 'Stop Selecting';
            startSelectingBtn.classList.add('active');
            if (downloadSelectedBtn) {
                downloadSelectedBtn.classList.remove('hidden');
            }
        } else {
            startSelectingBtn.textContent = 'Start Selecting';
            startSelectingBtn.classList.remove('active');
            if (downloadSelectedBtn) {
                downloadSelectedBtn.classList.add('hidden');
            }
            // Clear selection when exiting selection mode
            selectedPokemon.clear();
            updateSelectionUI();
            // Re-render cards to remove checkboxes
            sortAndDisplay();
        }
        // Re-render cards to show/hide checkboxes
        sortAndDisplay();
    });
}

// Download selected Pokemon
if (downloadSelectedBtn) {
    downloadSelectedBtn.addEventListener('click', async () => {
        if (selectedPokemon.size === 0) {
            alert('No Pokemon selected');
            return;
        }
        
        try {
            const filenames = Array.from(selectedPokemon);
            const response = await fetch('/api/pokemon/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    filenames: filenames,
                    db: currentDatabase 
                }),
            });
            
            if (!response.ok) {
                throw new Error('Download failed');
            }
            
            // Get the blob and create download link
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `selected-pokemon-${Date.now()}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading Pokemon:', error);
            alert('Failed to download selected Pokemon: ' + error.message);
        }
    });
}

// Load Pokemon from the current database only (does not refresh the database list)
async function loadPokemon() {
    showLoading();
    hideError();
    
    try {
        console.log(`[Frontend] Loading Pokemon from database: ${currentDatabase}`);
        const response = await fetch(`/api/pokemon?db=${currentDatabase}`);
        console.log(`[Frontend] API response status: ${response.status}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Frontend] API error: ${response.status} - ${errorText}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`[Frontend] API returned ${data.length} Pokemon files`);
        console.log(`[Frontend] First 3 items:`, data.slice(0, 3).map(p => ({ filename: p.filename, species: p.species, error: p.error })));
        
        // Log any errors
        const errors = data.filter(p => p.error);
        if (errors.length > 0) {
            console.warn(`[Frontend] ${errors.length} files had errors:`, errors.slice(0, 5).map(p => `${p.filename}: ${p.error}`));
        }
        
        pokemonData = data;
        
        // Filter out Pokemon with errors or invalid species before preloading
        const validPokemon = pokemonData.filter(p => !p.error && p.species && p.species > 0 && p.species <= 807);
        console.log(`Loaded ${pokemonData.length} Pokemon, ${validPokemon.length} valid, ${pokemonData.length - validPokemon.length} invalid/errors`);
        
        if (validPokemon.length === 0 && pokemonData.length > 0) {
            console.error('All Pokemon were filtered out! Sample:', pokemonData.slice(0, 3));
        }
        
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
            showError('No Pokemon files found. Please check the selected database folder.');
            updateDbStatistics([]);
        } else {
            sortAndDisplay();
            showStats();
            updateDbStatistics(pokemonData);
        }
    } catch (err) {
        showError(`Error loading Pokemon: ${err.message}`);
        console.error('Error:', err);
        updateDbStatistics([]);
    } finally {
        hideLoading();
    }
}

// Update DB statistics display
function updateDbStatistics(data) {
    const statTotal = document.getElementById('statTotal');
    const statSpecies = document.getElementById('statSpecies');
    const statShiny = document.getElementById('statShiny');
    const statIVSum = document.getElementById('statIVSum');
    
    if (!statTotal || !statSpecies || !statShiny || !statIVSum) {
        return;
    }
    
    // Filter valid Pokemon (support all generations up to 1025)
    const validPokemon = data.filter(p => !p.error && p.species && p.species > 0 && p.species <= 1025);
    
    if (validPokemon.length === 0) {
        statTotal.textContent = '0';
        statSpecies.textContent = '0';
        statShiny.textContent = '0';
        statIVSum.textContent = '-';
        updateBotStatusDisplay();
        return;
    }
    
    // Calculate statistics
    const total = validPokemon.length;
    const uniqueSpecies = new Set(validPokemon.map(p => p.species)).size;
    const shinyCount = validPokemon.filter(p => p.isShiny).length;
    
    // Calculate average IV sum
    let ivSumTotal = 0;
    let ivSumCount = 0;
    validPokemon.forEach(p => {
        if (p.ivSum !== undefined && p.ivSum !== null) {
            ivSumTotal += p.ivSum;
            ivSumCount++;
        }
    });
    const avgIVSum = ivSumCount > 0 ? (ivSumTotal / ivSumCount).toFixed(1) : '-';
    
    // Update display
    statTotal.textContent = total;
    statSpecies.textContent = uniqueSpecies;
    statShiny.textContent = shinyCount;
    statIVSum.textContent = avgIVSum;
    
    // Update bot status
    updateBotStatusDisplay();
}

// Update bot status display
async function updateBotStatusDisplay() {
    const statBotsOnline = document.getElementById('statBotsOnline');
    if (!statBotsOnline) {
        return;
    }
    
    try {
        // Get bot instances from localStorage
        const botInstances = JSON.parse(localStorage.getItem('botInstances') || '[]');
        
        if (botInstances.length === 0) {
            statBotsOnline.textContent = '0/0';
            return;
        }
        
        // Check status of all bots in parallel
        const statusChecks = botInstances.map(async (bot) => {
            try {
                // Try to fetch bot status through proxy or direct
                const endpoints = ['/emulator', '/game_state', '/player'];
                for (const endpoint of endpoints) {
                    try {
                        // Try proxy first
                        const response = await fetch(`/api/bot-proxy?url=${encodeURIComponent(bot.url + endpoint)}`, {
                            method: 'GET',
                            headers: { 'Accept': 'application/json' },
                            signal: AbortSignal.timeout(5000) // 5 second timeout
                        });
                        if (response && response.ok) {
                            return true;
                        }
                    } catch (proxyErr) {
                        // Try direct connection
                        try {
                            const response = await fetch(`${bot.url}${endpoint}`, {
                                method: 'GET',
                                headers: { 'Accept': 'application/json' },
                                signal: AbortSignal.timeout(5000)
                            });
                            if (response && response.ok) {
                                return true;
                            }
                        } catch (directErr) {
                            continue;
                        }
                    }
                }
                return false;
            } catch (error) {
                return false;
            }
        });
        
        const results = await Promise.all(statusChecks);
        const onlineCount = results.filter(r => r === true).length;
        
        statBotsOnline.textContent = `${onlineCount}/${botInstances.length}`;
    } catch (error) {
        console.error('Error checking bot status:', error);
        statBotsOnline.textContent = '-';
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
    pokemonIndex.fileDate.clear();
    
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
        
        // Pre-compute file date for sorting (use creation date or modified date)
        const fileDate = p.fileCreated ? new Date(p.fileCreated).getTime() : (p.fileModified ? new Date(p.fileModified).getTime() : 0);
        pokemonIndex.fileDate.set(p.filename, fileDate);
        
        // Pre-compute grouping keys
        const otName = p.otName || 'Unknown OT';
        const gameName = p.originGameName || getOriginGameName(p.originGame) || 'Unknown';
        // OT group key: OT name + Game Version (for OT grouping)
        pokemonIndex.otGroupKey.set(p.filename, `${otName} - ${gameName}`);
        // TID/SID group key: OT name + TID/SID + Game (for comprehensive grouping)
        pokemonIndex.tidSidGroupKey.set(p.filename, `${otName} (TID:${p.tid || 0} SID:${p.sid || 0}) - ${gameName}`);
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
        case 'nationalDex':
            sorted.sort((a, b) => {
                if (a.error || b.error) return 0;
                const dexA = a.species || 0;
                const dexB = b.species || 0;
                return dexA - dexB;
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
            // Sort by OT name, then Origin Game - using index
            sorted.sort((a, b) => {
                if (a.error || b.error) return 0;
                const otNameA = pokemonIndex.otName.get(a.filename) ?? (a.otName || 'Unknown OT').toLowerCase();
                const otNameB = pokemonIndex.otName.get(b.filename) ?? (b.otName || 'Unknown OT').toLowerCase();
                const otCompare = otNameA.localeCompare(otNameB);
                if (otCompare !== 0) return otCompare;
                // If OT names are the same, sort by Origin Game
                const gameA = (a.originGameName || getOriginGameName(a.originGame) || 'Unknown').toLowerCase();
                const gameB = (b.originGameName || getOriginGameName(b.originGame) || 'Unknown').toLowerCase();
                return gameA.localeCompare(gameB);
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
        case 'dateNewest':
            sorted.sort((a, b) => {
                if (a.error || b.error) return 0;
                const dateA = pokemonIndex.fileDate.get(a.filename) ?? 0;
                const dateB = pokemonIndex.fileDate.get(b.filename) ?? 0;
                return dateB - dateA; // Newest first (higher timestamp first)
            });
            break;
        case 'dateOldest':
            sorted.sort((a, b) => {
                if (a.error || b.error) return 0;
                const dateA = pokemonIndex.fileDate.get(a.filename) ?? 0;
                const dateB = pokemonIndex.fileDate.get(b.filename) ?? 0;
                return dateA - dateB; // Oldest first (lower timestamp first)
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
            
            // Location
            if (advancedFilters.location && advancedFilters.location.trim() !== '') {
                const locationName = (pokemon.metLocationName || '').toLowerCase();
                const locationId = String(pokemon.metLocation || '');
                const filterLocation = advancedFilters.location.toLowerCase();
                if (!locationName.includes(filterLocation) && !locationId.includes(filterLocation)) return false;
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

// Filter to one Pokemon per species (highest IV sum)
function filterOnePerSpecies(data) {
    if (!onePerSpeciesFilter.checked) {
        return data;
    }
    
    // Group by species
    const speciesMap = new Map();
    
    data.forEach(pokemon => {
        if (pokemon.error || !pokemon.species) return;
        
        const speciesId = pokemon.species;
        const ivSum = pokemon.ivSum || 0;
        
        if (!speciesMap.has(speciesId)) {
            speciesMap.set(speciesId, pokemon);
        } else {
            const existing = speciesMap.get(speciesId);
            const existingIvSum = existing.ivSum || 0;
            
            // Keep the one with higher IV sum
            // If tied, prefer higher level, then keep existing
            if (ivSum > existingIvSum) {
                speciesMap.set(speciesId, pokemon);
            } else if (ivSum === existingIvSum) {
                // Tiebreaker: prefer higher level
                const existingLevel = existing.level || 0;
                const currentLevel = pokemon.level || 0;
                if (currentLevel > existingLevel) {
                    speciesMap.set(speciesId, pokemon);
                }
            }
        }
    });
    
    // Convert map back to array
    return Array.from(speciesMap.values());
}

// Filter to one Pokemon per species (lowest IV sum)
function filterOnePerSpeciesLowest(data) {
    if (!onePerSpeciesLowestFilter || !onePerSpeciesLowestFilter.checked) {
        return data;
    }
    
    // Group by species
    const speciesMap = new Map();
    
    data.forEach(pokemon => {
        if (pokemon.error || !pokemon.species) return;
        
        const speciesId = pokemon.species;
        const ivSum = pokemon.ivSum || 0;
        
        if (!speciesMap.has(speciesId)) {
            speciesMap.set(speciesId, pokemon);
        } else {
            const existing = speciesMap.get(speciesId);
            const existingIvSum = existing.ivSum || 0;
            
            // Keep the one with lower IV sum
            // If tied, prefer lower level, then keep existing
            if (ivSum < existingIvSum) {
                speciesMap.set(speciesId, pokemon);
            } else if (ivSum === existingIvSum) {
                // Tiebreaker: prefer lower level
                const existingLevel = existing.level || 0;
                const currentLevel = pokemon.level || 0;
                if (currentLevel < existingLevel) {
                    speciesMap.set(speciesId, pokemon);
                }
            }
        }
    });
    
    // Convert map back to array
    return Array.from(speciesMap.values());
}

// Filter to show only Pokemon that need to be evolved for Pokedex completion
function filterNeedsEvolution(data) {
    if (!needsEvolutionFilter || !needsEvolutionFilter.checked) {
        return data;
    }
    
    // Get all species IDs in the database
    const allSpecies = new Set();
    pokemonData.forEach(p => {
        if (!p.error && p.species) {
            allSpecies.add(Number(p.species));
        }
    });
    
    // Known non-evolving Pokemon - exclude them from this filter
    // This list includes final forms and Pokemon that don't evolve
    const nonEvolvingPokemon = new Set([
        // Final evolutions Gen 1
        3, 6, 9, 12, 15, 18, 20, 22, 24, 26, 28, 31, 34, 36, 38, 40, 42, 45, 47, 49, 51, 53, 55, 57, 59,
        62, 65, 68, 71, 73, 76, 78, 80, 82, 85, 87, 89, 91, 94, 97, 99, 101, 103, 105, 110, 112, 119, 121,
        125, 126, 130, 134, 135, 136, 139, 141, 149,
        // Final evolutions Gen 2
        154, 157, 160, 162, 164, 166, 168, 169, 171, 176, 178, 181, 184, 189, 192, 195, 199, 201, 205, 210, 212, 214, 217,
        219, 224, 226, 229, 232, 235, 237, 242, 248,
        // Final evolutions Gen 3
        254, 257, 260, 262, 264, 267, 269, 272, 275, 277, 279, 282, 284, 286, 289, 291, 295, 297, 301, 306,
        308, 310, 317, 318, 320, 322, 330, 332, 334, 340, 342, 344, 346, 348, 350, 354, 356, 362, 365, 367, 368, 373, 376,
        // Non-evolving Pokemon
        234, 323, 335, 336, 337, 338
    ]);
    
    // Filter to only Pokemon that:
    // 1. Can evolve (have at least one evolution)
    // 2. At least one evolved form is NOT in the database
    // 3. Don't show middle-stage evolutions if you already have a lower-stage form
    return data.filter(pokemon => {
        if (pokemon.error || !pokemon.species) return false;
        
        // Exclude non-evolving Pokemon (final forms)
        if (nonEvolvingPokemon.has(pokemon.species)) {
            return false;
        }
        
        // Get only Gen 3-available evolutions (species IDs 1-386)
        const evolvedSpeciesList = getAllEvolutionSpecies(pokemon.species, true);
        if (!evolvedSpeciesList || evolvedSpeciesList.length === 0) {
            return false; // Can't evolve (or no Gen 3 evolutions available)
        }
        
        // Check if ANY evolved form is missing from database
        // If all evolved forms exist, don't show this Pokemon
        const hasMissingEvolution = evolvedSpeciesList.some(evoSpecies => !allSpecies.has(Number(evoSpecies)));
        if (!hasMissingEvolution) {
            return false;
        }
        
        // Don't show middle-stage evolutions if you already have a lower-stage form
        // Example: If you have Lotad, don't show Lombre (you can evolve Lotad instead)
        const preEvolutions = getPreEvolution(pokemon.species);
        if (preEvolutions && preEvolutions.length > 0) {
            // Check if any pre-evolution is already in the database
            const hasPreEvolutionInDb = preEvolutions.some(preId => allSpecies.has(Number(preId)));
            if (hasPreEvolutionInDb) {
                return false; // Don't show this middle-stage Pokemon
            }
        }
        
        return true;
    });
}

// Sort and display Pokemon
function sortAndDisplay() {
    console.log(`[Frontend] sortAndDisplay() called, pokemonData.length = ${pokemonData ? pokemonData.length : 'null'}`);
    const sortBy = sortSelect.value;
    const searchTerm = searchInput.value.trim();
    const shinyOnly = shinyFilter.checked;
    
    // Apply filter first (with advanced filters)
    let data = filterPokemon(pokemonData, searchTerm, shinyOnly, advancedFilters);
    console.log(`[Frontend] After filtering: ${data.length} Pokemon`);
    
    // Apply one per species filter if enabled (highest or lowest IV)
    data = filterOnePerSpecies(data);
    data = filterOnePerSpeciesLowest(data);
    if (onePerSpeciesFilter.checked || (onePerSpeciesLowestFilter && onePerSpeciesLowestFilter.checked)) {
        console.log(`[Frontend] After one per species filter: ${data.length} Pokemon`);
    }
    
    // Apply needs evolution filter if enabled
    if (needsEvolutionFilter && needsEvolutionFilter.checked) {
        data = filterNeedsEvolution(data);
        console.log(`[Frontend] After needs evolution filter: ${data.length} Pokemon`);
    }
    
    // Then sort
    filteredData = sortPokemon(data, sortBy);
    console.log(`[Frontend] After sorting: ${filteredData.length} Pokemon`);
    
    // Display (with or without grouping)
    console.log(`[Frontend] Calling displayPokemon() with ${filteredData.length} Pokemon`);
    displayPokemon(filteredData);
}

// Filter and display Pokemon
function filterAndDisplay() {
    sortAndDisplay();
}

// Display Pokemon cards
async function displayPokemon(pokemon) {
    console.log(`[Frontend] displayPokemon() called with ${pokemon.length} Pokemon`);
    
    if (!pokemonGrid) {
        console.error('[Frontend] pokemonGrid element not found!');
        return;
    }
    
    pokemonGrid.innerHTML = '';
    
    // Update grid class based on compact view
    if (compactView && compactView.checked) {
        pokemonGrid.classList.add('compact-grid');
    } else {
        pokemonGrid.classList.remove('compact-grid');
    }
    
    if (pokemon.length === 0) {
        console.warn('[Frontend] displayPokemon called with 0 Pokemon');
        pokemonGrid.innerHTML = '<div class="error-card">No Pokemon found matching your search.</div>';
        return;
    }
    
    console.log(`[Frontend] Creating cards for ${pokemon.length} Pokemon...`);
    
    // Apply maximum display limit if set
    let displayPokemon = pokemon;
    const maxLimit = maxDisplayLimit ? parseInt(maxDisplayLimit.value) || 0 : 0;
    if (maxLimit > 0 && pokemon.length > maxLimit) {
        displayPokemon = pokemon.slice(0, maxLimit);
    }
    
    // Check if grouping is enabled
    try {
        if (groupByOT && groupByOT.checked || groupByTIDSID && groupByTIDSID.checked) {
            console.log('[Frontend] Displaying grouped Pokemon');
            await displayGroupedPokemon(displayPokemon, pokemon.length);
        } else {
            // Create all cards
            console.log(`[Frontend] Creating ${displayPokemon.length} cards...`);
            const cardPromises = displayPokemon.map((p, index) => {
                try {
                    return createPokemonCard(p);
                } catch (err) {
                    console.error(`[Frontend] Error creating card for ${p.filename} (index ${index}):`, err);
                    // Return error card instead
                    const errorCard = document.createElement('div');
                    errorCard.className = 'pokemon-card';
                    errorCard.innerHTML = `<div class="error-card"><strong>${p.filename}</strong><br>Error: ${err.message}</div>`;
                    return errorCard;
                }
            });
            const cards = await Promise.all(cardPromises);
            console.log(`[Frontend] Created ${cards.length} cards, appending to grid...`);
            allPokemonCards = cards; // Track all cards for multi-select
            cards.forEach(card => {
                if (card && pokemonGrid) {
                    pokemonGrid.appendChild(card);
                }
            });
            console.log(`[Frontend] Appended ${cards.length} cards to pokemonGrid`);
        }
        
        updateStats(displayPokemon.length, pokemon.length);
        // Update IV sum gradients if enabled
        updateIVSumGradients();
        console.log(`[Frontend] displayPokemon() completed successfully`);
    } catch (err) {
        console.error('[Frontend] Error in displayPokemon:', err);
        pokemonGrid.innerHTML = `<div class="error-card">Error displaying Pokemon: ${err.message}</div>`;
    }
}

// Display Pokemon grouped by OT Name and/or TID/SID
async function displayGroupedPokemon(pokemon, totalCount) {
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
                // Group by both OT name, TID/SID, and Game Version (comprehensive grouping)
                groupKey = pokemonIndex.tidSidGroupKey.get(p.filename) || 
                    `${p.otName || 'Unknown OT'} (TID:${p.tid || 0} SID:${p.sid || 0}) - ${p.originGameName || getOriginGameName(p.originGame) || 'Unknown'}`;
            } else if (useTIDSID) {
                // Group by TID/SID only
                groupKey = `TID:${p.tid || 0} SID:${p.sid || 0}`;
            } else if (useOT) {
                // Group by OT name + Game Version
                groupKey = pokemonIndex.otGroupKey.get(p.filename) || 
                    `${p.otName || 'Unknown OT'} - ${p.originGameName || getOriginGameName(p.originGame) || 'Unknown'}`;
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
        
        // Get the group's Pokemon list
        let groupPokemon = grouped[groupKey];
        const originalCount = groupPokemon.length;
        
        // When grouping by OT, limit each group to 10 Pokemon
        if (useOT && !useTIDSID && groupKey !== '_errors') {
            groupPokemon = groupPokemon.slice(0, 10);
        }
        
        const displayCount = groupPokemon.length;
        const countText = displayCount < originalCount 
            ? `${displayCount} of ${originalCount} Pokemon` 
            : `${displayCount} Pokemon`;
        
        header.innerHTML = `<h2>${displayName}</h2><span class="group-count">${countText}</span>`;
        groupDiv.appendChild(header);
        
        const groupGrid = document.createElement('div');
        groupGrid.className = 'pokemon-grid';
        
        // Apply compact grid class if compact view is enabled
        if (compactView.checked) {
            groupGrid.classList.add('compact-grid');
        }
        
        // Create all cards for this group (limited if needed)
        const cardPromises = groupPokemon.map(p => createPokemonCard(p));
        const cards = await Promise.all(cardPromises);
        allPokemonCards.push(...cards); // Track all cards for multi-select
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

// Format file date and time for display
function formatFileDateTime(pokemon) {
    if (!pokemon) return '';
    
    const fileDate = pokemon.fileCreated ? new Date(pokemon.fileCreated) : (pokemon.fileModified ? new Date(pokemon.fileModified) : null);
    if (!fileDate || isNaN(fileDate.getTime())) return '';
    
    // Format as: MM/DD/YYYY HH:MM:SS
    const month = String(fileDate.getMonth() + 1).padStart(2, '0');
    const day = String(fileDate.getDate()).padStart(2, '0');
    const year = fileDate.getFullYear();
    const hours = String(fileDate.getHours()).padStart(2, '0');
    const minutes = String(fileDate.getMinutes()).padStart(2, '0');
    const seconds = String(fileDate.getSeconds()).padStart(2, '0');
    
    return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
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
    
    // Show sprite for all valid Pokemon (Gen 1-6)
    const spriteHtml = spriteUrl 
        ? `<img src="${spriteUrl}" alt="${speciesName}" 
                 onerror="this.parentElement.innerHTML='<div style=\'padding:20px;text-align:center;color:#999;\'>No Sprite<br>#${speciesId}</div>'">`
        : `<div style="padding:20px;text-align:center;color:#999;">No Sprite<br>#${speciesId}</div>`;
    
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
            <div class="iv-sum compact-iv-sum" data-iv-sum="${pokemon.ivSum || 0}">
                IV Sum: ${pokemon.ivSum || 0}
            </div>
            <div style="margin-top: 8px; font-size: 0.75em; color: #999;">
                ${pokemon.filename}
                ${formatFileDateTime(pokemon) ? `<div style="margin-top: 2px; font-size: 0.85em; color: #888;">${formatFileDateTime(pokemon)}</div>` : ''}
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
            
            <div class="iv-sum" data-iv-sum="${pokemon.ivSum || 0}">
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
                ${formatFileDateTime(pokemon) ? `<div style="margin-top: 2px; font-size: 0.85em; color: #888;">${formatFileDateTime(pokemon)}</div>` : ''}
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
    
    // Add selection checkbox (show if save file is loaded OR if in selection mode)
    if (saveFileLoaded || selectionMode) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'pokemon-select-checkbox';
        checkbox.checked = selectedPokemon.has(pokemon.filename);
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click
            
            // Multi-select support: Shift for range, Ctrl/Cmd for toggle
            if (e.shiftKey && lastSelectedIndex >= 0) {
                // Range selection
                const currentIndex = allPokemonCards.findIndex(c => c.dataset.filename === pokemon.filename);
                if (currentIndex >= 0) {
                    const start = Math.min(lastSelectedIndex, currentIndex);
                    const end = Math.max(lastSelectedIndex, currentIndex);
                    const rangeSelected = checkbox.checked;
                    
                    for (let i = start; i <= end; i++) {
                        const c = allPokemonCards[i];
                        if (c) {
                            const cb = c.querySelector('.pokemon-select-checkbox');
                            if (cb) {
                                cb.checked = rangeSelected;
                                togglePokemonSelection(c.dataset.filename, rangeSelected);
                            }
                        }
                    }
                    lastSelectedIndex = currentIndex;
                    return;
                }
            }
            
            // Single selection or Ctrl/Cmd toggle
            togglePokemonSelection(pokemon.filename, checkbox.checked);
            const currentIndex = allPokemonCards.findIndex(c => c.dataset.filename === pokemon.filename);
            if (currentIndex >= 0) {
                lastSelectedIndex = currentIndex;
            }
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
        if (e.target.closest('.pokemon-select-checkbox')) {
            return;
        }
        
        // If save file is loaded or in selection mode, allow card click to toggle selection with Shift/Ctrl
        if (saveFileLoaded || selectionMode) {
            const checkbox = card.querySelector('.pokemon-select-checkbox');
            if (checkbox) {
                if (e.shiftKey && lastSelectedIndex >= 0) {
                    // Range selection
                    const currentIndex = allPokemonCards.findIndex(c => c === card);
                    if (currentIndex >= 0) {
                        const start = Math.min(lastSelectedIndex, currentIndex);
                        const end = Math.max(lastSelectedIndex, currentIndex);
                        const newState = !selectedPokemon.has(pokemon.filename);
                        
                        for (let i = start; i <= end; i++) {
                            const c = allPokemonCards[i];
                            if (c) {
                                const cb = c.querySelector('.pokemon-select-checkbox');
                                if (cb) {
                                    cb.checked = newState;
                                    togglePokemonSelection(c.dataset.filename, newState);
                                }
                            }
                        }
                        lastSelectedIndex = currentIndex;
                        return;
                    }
                }
                
                // Toggle selection (Ctrl/Cmd for multi-select, regular click toggles)
                const newState = !checkbox.checked;
                checkbox.checked = newState;
                togglePokemonSelection(pokemon.filename, newState);
                const currentIndex = allPokemonCards.findIndex(c => c === card);
                if (currentIndex >= 0) {
                    lastSelectedIndex = currentIndex;
                }
                return;
            }
        }
        
        // Otherwise show modal
        showPokemonModal(pokemon);
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
    if (selectedCount) {
        selectedCount.textContent = `${count} Pokemon selected`;
    }
    if (importSelectedBtn) {
        importSelectedBtn.disabled = count === 0 || !saveFileLoaded;
    }
    if (downloadSelectedBtn) {
        downloadSelectedBtn.disabled = count === 0;
    }
}

// Alias for backward compatibility
function updateSelectedCount() {
    updateSelectionUI();
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

// Fetch abilities from server (cached/proxied)
async function getAbilities(speciesId) {
    // Check cache first
    if (abilityCache.has(speciesId)) {
        return abilityCache.get(speciesId);
    }
    
    // Fetch for all valid Pokemon (species IDs 1-807 for Gen 1-7)
    if (!isValidSpeciesId(speciesId)) {
        return null;
    }
    
    try {
        const response = await fetch(`/api/pokemon/data/${speciesId}`);
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

// Check if species ID is valid for any generation (Gen 1-7: species IDs 1-807)
function isValidSpeciesId(speciesId) {
    const id = parseInt(speciesId);
    if (isNaN(id) || id <= 0) {
        return false;
    }
    // Support up to Gen 7 (species IDs 1-807)
    return id >= 1 && id <= 807;
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
    
    // Fetch for all valid Pokemon (species IDs 1-807 for Gen 1-7)
    if (!isValidSpeciesId(speciesId)) {
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

// Fetch base stats from server (cached/proxied)
async function getBaseStats(speciesId) {
    // Check cache first
    if (baseStatsCache.has(speciesId)) {
        return baseStatsCache.get(speciesId);
    }
    
    // Fetch for all valid Pokemon (species IDs 1-807 for Gen 1-7)
    if (!isValidSpeciesId(speciesId)) {
        return null;
    }
    
    try {
        const response = await fetch(`/api/pokemon/data/${speciesId}`);
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
        
        // Ensure species is a valid number (support Gen 1-7: species IDs 1-807)
        const speciesId = parseInt(p.species);
        if (isNaN(speciesId) || speciesId <= 0 || speciesId > 807) {
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

// Get sprite URL from PokeAPI for all generations
// Uses cached URLs to reduce API calls
function getSpriteUrl(speciesId, isShiny = false, form = null) {
    // Validate and convert to number
    const id = parseInt(speciesId);
    if (!isValidSpeciesId(id)) {
        // Silently return null for invalid species (filtered out elsewhere)
        return null;
    }
    
    // Build cache key including form for Unown
    const cacheKey = form && id === 201 
        ? `${id}_${form}_${isShiny ? 'shiny' : 'normal'}`
        : `${id}_${isShiny ? 'shiny' : 'normal'}`;
    
    if (spriteCache.has(cacheKey)) {
        return spriteCache.get(cacheKey);
    }
    
    // Use server-side sprite endpoint (proxies PokeAPI)
    let url = `/api/pokemon/sprite/${id}${isShiny ? '?shiny=true' : ''}`;
    if (form && id === 201) {
        url += (isShiny ? '&' : '?') + `form=${form}`;
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

// Fetch move data (name and type) from server (cached/proxied)
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
        const response = await fetch(`/api/pokemon/move/${moveId}`);
        if (!response.ok) {
            const fallback = `Move #${moveId}`;
            moveCache.set(moveId, fallback);
            moveTypeCache.set(moveId, 'normal');
            return { name: fallback, type: 'normal' };
        }
        
        const data = await response.json();
        const moveName = data.name.charAt(0).toUpperCase() + data.name.slice(1).replace(/-/g, ' ');
        const moveType = data.type || 'normal';
        
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
    // Use server-side type sprite endpoint (proxies PokeAPI)
    return `/api/pokemon/type-sprite/${type}`;
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
                                <img class="ball-thumbnail" src="" alt="${pokemon.ballName || pokemon.ball || '-'}" data-ball-name="${pokemon.ballName || pokemon.ball || ''}" style="width: 24px; height: 24px; vertical-align: middle; margin-right: 6px; display: none;">
                                ${pokemon.ballName || pokemon.ball || '-'}
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
                    ${getEvolutionSpecies(pokemon.species) ? `<button class="btn btn-primary" onclick="evolvePokemon('${pokemon.filename}', ${pokemon.species})" id="evolveBtn" style="display: none;">Evolve</button>` : ''}
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
    const ballName = pokemon.ballName || pokemon.ball;
    if (ballName && ballName !== 'None' && ballName !== '-' && ballName !== 'Ball 0') {
        loadBallThumbnail(ballName);
    }
    
    // Setup chart toggle buttons
    setupChartToggles();
}

// Evolve a single Pokemon
async function evolvePokemon(filename, currentSpecies) {
    try {
        const response = await fetch('/api/pokemon/evolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, db: currentDatabase })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to evolve Pokemon');
        }
        
        // Close modals
        pokemonModal.classList.add('hidden');
        
        // If batch evolve modal is open, refresh it
        if (batchEvolveModal && !batchEvolveModal.classList.contains('hidden')) {
            await openBatchEvolve();
        } else {
            // Otherwise reload Pokemon list
            await loadPokemon();
        }
        
        alert(`Successfully evolved Pokemon #${data.oldSpecies} to #${data.newSpecies}!`);
    } catch (error) {
        alert(`Error evolving Pokemon: ${error.message}`);
    }
}

// Open batch evolve modal
async function openBatchEvolve() {
    try {
        const response = await fetch(`/api/pokemon/evolution-suggestions?db=${currentDatabase}`);
        const data = await response.json();
        
        if (!response.ok) {
            const errorMsg = data.error || `HTTP ${response.status}: ${response.statusText}`;
            console.error('[Batch Evolve] Error response:', errorMsg);
            throw new Error(errorMsg);
        }
        
        if (!data || !data.suggestions) {
            console.warn('[Batch Evolve] No suggestions data received');
            data.suggestions = {};
        }
        
        displayBatchEvolveSuggestions(data.suggestions);
        batchEvolveModal.classList.remove('hidden');
    } catch (error) {
        console.error('[Batch Evolve] Error loading evolution suggestions:', error);
        alert(`Error loading evolution suggestions: ${error.message}`);
    }
}

// Display batch evolve suggestions
async function displayBatchEvolveSuggestions(suggestions) {
    const container = document.getElementById('batchEvolveSuggestions');
    
    container.innerHTML = '';
    
    // Sort species by ID
    const speciesIds = Object.keys(suggestions).map(Number).sort((a, b) => a - b);
    
    for (const speciesId of speciesIds) {
        const pokemonList = suggestions[speciesId];
        if (pokemonList.length === 0) continue;
        
        const speciesName = pokemonList[0].speciesName || `Species ${speciesId}`;
        const evolvedSpecies = getEvolutionSpecies(speciesId);
        const evolvedName = evolvedSpecies ? await getSpeciesName(evolvedSpecies) : 'Unknown';
        
        const speciesDiv = document.createElement('div');
        speciesDiv.style.marginBottom = '20px';
        speciesDiv.style.border = '1px solid #ddd';
        speciesDiv.style.padding = '10px';
        speciesDiv.style.borderRadius = '5px';
        
        speciesDiv.innerHTML = `
            <h4>#${speciesId} ${speciesName} → #${evolvedSpecies} ${evolvedName}</h4>
            <div class="batch-evolve-pokemon-list"></div>
        `;
        
        const pokemonListDiv = speciesDiv.querySelector('.batch-evolve-pokemon-list');
        
        for (const pokemon of pokemonList) {
            const pokemonDiv = document.createElement('div');
            pokemonDiv.style.display = 'flex';
            pokemonDiv.style.alignItems = 'center';
            pokemonDiv.style.padding = '5px';
            pokemonDiv.style.margin = '5px 0';
            pokemonDiv.style.border = '1px solid #eee';
            pokemonDiv.style.borderRadius = '3px';
            
            const spriteUrl = getSpriteUrl(pokemon.species, pokemon.isShiny);
            
            pokemonDiv.innerHTML = `
                <input type="checkbox" value="${pokemon.filename}" data-species="${speciesId}" style="margin-right: 10px;" onchange="updateBatchEvolveSelection()">
                ${spriteUrl ? `<img src="${spriteUrl}" alt="${pokemon.speciesName}" style="width: 40px; height: 40px; margin-right: 10px;">` : ''}
                <div style="flex: 1;">
                    <strong>${pokemon.speciesName || 'Unknown'}</strong>
                    ${pokemon.isShiny ? ' <span style="color: gold;">★</span>' : ''}
                    <div style="font-size: 0.9em; color: #666;">
                        Level: ${pokemon.level} | IV Sum: ${pokemon.ivSum} | ${pokemon.filename}
                    </div>
                </div>
                <button class="btn btn-small btn-primary" onclick="evolvePokemon('${pokemon.filename}', ${pokemon.species}); event.stopPropagation();" style="margin-left: 10px; display: none;">Evolve</button>
            `;
            
            pokemonListDiv.appendChild(pokemonDiv);
        }
        
        container.appendChild(speciesDiv);
    }
    
    // Set up select all/deselect all buttons
    document.getElementById('selectAllSuggestionsBtn').onclick = () => {
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = true;
        });
        updateBatchEvolveSelection();
    };
    
    document.getElementById('deselectAllSuggestionsBtn').onclick = () => {
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
        updateBatchEvolveSelection();
    };
    
    // Set up execute button
    document.getElementById('executeBatchEvolveBtn').onclick = executeBatchEvolve;
    
    updateBatchEvolveSelection();
}

// Update batch evolve selection count
function updateBatchEvolveSelection() {
    const container = document.getElementById('batchEvolveSuggestions');
    const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
    const selectedCount = checkboxes.length;
    
    document.getElementById('batchEvolveSelectedCount').textContent = `${selectedCount} selected`;
    document.getElementById('executeBatchEvolveBtn').disabled = selectedCount === 0;
}

// Execute batch evolution
async function executeBatchEvolve() {
    const container = document.getElementById('batchEvolveSuggestions');
    const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
    const filenames = Array.from(checkboxes).map(cb => cb.value);
    
    if (filenames.length === 0) {
        alert('Please select at least one Pokemon to evolve.');
        return;
    }
    
    const confirmed = confirm(`Evolve ${filenames.length} Pokemon?`);
    if (!confirmed) return;
    
    try {
        const response = await fetch('/api/pokemon/batch-evolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filenames, db: currentDatabase })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to evolve Pokemon');
        }
        
        // Close modal
        batchEvolveModal.classList.add('hidden');
        
        // Reload Pokemon list
        await loadPokemon();
        
        alert(`Successfully evolved ${data.evolved} Pokemon!${data.failed > 0 ? `\n${data.failed} failed.` : ''}`);
    } catch (error) {
        alert(`Error evolving Pokemon: ${error.message}`);
    }
}

// Helper to get all possible evolution species (client-side lookup)
// Returns an array of all species this Pokemon can evolve into (including full chain)
// Optionally filters to only include evolutions available in Gen 3 (species IDs 1-386)
function getAllEvolutionSpecies(speciesId, gen3Only = false) {
    // Map each species to ALL possible evolutions (including multi-stage and branching)
    const evolutionMap = {
        // Gen 1
        1: [2], 2: [3], 4: [5], 5: [6], 7: [8], 8: [9], 10: [11], 11: [12], 13: [14], 14: [15],
        16: [17], 17: [18], 19: [20], 21: [22], 23: [24], 25: [26], 27: [28], 29: [30], 30: [31],
        32: [33], 33: [34], 35: [36], 37: [38], 39: [40], 41: [42], 42: [169], 43: [44], 44: [45, 182], 46: [47],
        48: [49], 50: [51], 52: [53], 54: [55], 56: [57], 58: [59], 60: [61], 61: [62, 186], 63: [64],
        64: [65], 66: [67], 67: [68], 69: [70], 70: [71],         72: [73], 74: [75], 75: [76], 77: [78],
        79: [80, 199], 81: [82], 84: [85], 86: [87], 88: [89], 90: [91], 92: [93], 93: [94], 95: [208], 96: [97],
        98: [99], 100: [101], 102: [103], 104: [105], 109: [110], 111: [112], 113: [242], 116: [117], 117: [230], 118: [119],
        120: [121], 123: [212], 129: [130], 133: [134, 135, 136, 196, 197], 137: [233], 138: [139], 140: [141], 147: [148], 148: [149],
        // Gen 2
        152: [153], 153: [154], 155: [156], 156: [157], 158: [159], 159: [160], 161: [162], 163: [164],
        165: [166], 167: [168], 170: [171], 172: [25], 173: [35], 174: [39], 175: [176], 177: [178],
        179: [180], 180: [181], 183: [184], 187: [188], 188: [189], 191: [192], 194: [195], 198: [430], 200: [429],
        204: [205], 209: [210], 215: [461], 216: [217], 218: [219], 223: [224], 225: [226],
        228: [229], 231: [232], 233: [474], 236: [106, 107, 237], 238: [124], 239: [125], 240: [126], 246: [247], 247: [248],
        // Gen 3
        252: [253], 253: [254], 255: [256], 256: [257], 258: [259], 259: [260], 261: [262], 263: [264],
        265: [266, 268], 266: [267], 268: [269], 270: [271], 271: [272], 273: [274], 274: [275], 276: [277],
        278: [279], 280: [281], 281: [282], 283: [284], 285: [286], 287: [288], 288: [289], 290: [291, 292],
        293: [294], 294: [295], 296: [297], 298: [183], 300: [301], 304: [305], 305: [306], 307: [308],
        309: [310], 315: [316], 316: [317], 317: [318], 319: [320], 321: [322], 325: [326], 328: [329], 329: [330],
        331: [332], 333: [334], 339: [340], 341: [342], 343: [344], 345: [346], 347: [348], 349: [350], 353: [354],
        355: [356], 360: [202], 361: [362], 363: [364], 364: [365], 366: [367, 368], 371: [372], 372: [373], 374: [375], 375: [376]
    };
    
    const directEvolutions = evolutionMap[speciesId];
    if (!directEvolutions) return null;
    
    // Recursively get all evolutions in the chain
    const allEvolutions = new Set(directEvolutions);
    for (const evoId of directEvolutions) {
        const nextEvolutions = getAllEvolutionSpecies(evoId, gen3Only);
        if (nextEvolutions) {
            nextEvolutions.forEach(e => allEvolutions.add(e));
        }
    }
    
    let result = Array.from(allEvolutions);
    
    // Filter to only Gen 3-available evolutions if requested
    if (gen3Only) {
        result = result.filter(evoId => isGen3OrBelow(evoId));
    }
    
    return result.length > 0 ? result : null;
}

// Helper to get pre-evolution(s) - what evolves into this species
function getPreEvolution(speciesId) {
    const evolutionMap = {
        // Gen 1
        1: [2], 2: [3], 4: [5], 5: [6], 7: [8], 8: [9], 10: [11], 11: [12], 13: [14], 14: [15],
        16: [17], 17: [18], 19: [20], 21: [22], 23: [24], 25: [26], 27: [28], 29: [30], 30: [31],
        32: [33], 33: [34], 35: [36], 37: [38], 39: [40], 41: [42], 43: [44], 44: [45, 182], 46: [47],
        48: [49], 50: [51], 52: [53], 54: [55], 56: [57], 58: [59], 60: [61], 61: [62, 186], 63: [64],
        64: [65], 66: [67], 67: [68], 69: [70], 70: [71],         72: [73], 74: [75], 75: [76], 77: [78],
        79: [80, 199], 81: [82], 84: [85], 86: [87], 88: [89], 90: [91], 92: [93], 93: [94], 95: [208], 96: [97],
        98: [99], 100: [101], 102: [103], 104: [105], 109: [110], 111: [112], 116: [117], 117: [230], 118: [119],
        120: [121], 129: [130], 133: [134, 135, 136, 196, 197], 137: [233], 138: [139], 140: [141], 147: [148], 148: [149],
        // Gen 2
        152: [153], 153: [154], 155: [156], 156: [157], 158: [159], 159: [160], 161: [162], 163: [164],
        165: [166], 167: [168], 170: [171], 172: [25], 173: [35], 174: [39], 175: [176], 177: [178],
        179: [180], 180: [181], 183: [184], 187: [188], 188: [189], 191: [192], 194: [195], 198: [430], 200: [429],
        204: [205], 209: [210], 215: [461], 216: [217], 218: [219], 223: [224], 225: [226],
        228: [229], 231: [232], 233: [474], 236: [106, 107, 237], 238: [124], 239: [125], 240: [126], 246: [247], 247: [248],
        // Gen 3
        252: [253], 253: [254], 255: [256], 256: [257], 258: [259], 259: [260], 261: [262], 263: [264],
        265: [266, 268], 266: [267], 268: [269], 270: [271], 271: [272], 273: [274], 274: [275], 276: [277],
        278: [279], 280: [281], 281: [282], 283: [284], 285: [286], 287: [288], 288: [289], 290: [291, 292],
        293: [294], 294: [295], 296: [297], 298: [183], 300: [301], 304: [305], 305: [306], 307: [308],
        309: [310], 315: [316], 316: [317], 317: [318], 319: [320], 321: [322], 325: [326], 328: [329], 329: [330],
        331: [332], 333: [334], 339: [340], 341: [342], 343: [344], 345: [346], 347: [348], 349: [350], 353: [354],
        355: [356], 360: [202], 361: [362], 363: [364], 364: [365], 366: [367, 368], 371: [372], 372: [373], 374: [375], 375: [376]
    };
    
    // Build reverse map: find all species that evolve into this one
    const preEvolutions = [];
    for (const [preId, evolutions] of Object.entries(evolutionMap)) {
        if (evolutions.includes(speciesId)) {
            preEvolutions.push(parseInt(preId));
        }
    }
    
    // Also check recursively - if a pre-evolution has its own pre-evolution
    const allPreEvolutions = new Set(preEvolutions);
    for (const preId of preEvolutions) {
        const deeperPre = getPreEvolution(preId);
        if (deeperPre && deeperPre.length > 0) {
            deeperPre.forEach(p => allPreEvolutions.add(p));
        }
    }
    
    return Array.from(allPreEvolutions);
}

// Helper to get evolution species (backward compatibility - returns first evolution)
function getEvolutionSpecies(speciesId) {
    const evolutions = getAllEvolutionSpecies(speciesId);
    return evolutions && evolutions.length > 0 ? evolutions[0] : null;
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
    
    // Use server-side item sprite endpoint (proxies PokeAPI)
    return `/api/pokemon/item-sprite/${ballId}`;
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
            <svg viewBox="0 0 300 300" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: auto; max-width: 300px;">
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

// Statistics
// Store daily Pokemon count
function updateDailyPokemonCount(totalCount) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const storageKey = 'pokemonDailyCounts';
    
    try {
        let dailyCounts = JSON.parse(localStorage.getItem(storageKey) || '{}');
        dailyCounts[today] = totalCount;
        
        // Keep only last 7 days
        const dates = Object.keys(dailyCounts).sort();
        if (dates.length > 7) {
            const datesToRemove = dates.slice(0, dates.length - 7);
            datesToRemove.forEach(date => delete dailyCounts[date]);
        }
        
        localStorage.setItem(storageKey, JSON.stringify(dailyCounts));
    } catch (error) {
        console.error('Error updating daily Pokemon count:', error);
    }
}

// Get last 7 days of Pokemon counts from localStorage (old method)
function getLast7DaysCounts() {
    const storageKey = 'pokemonDailyCounts';
    try {
        const dailyCounts = JSON.parse(localStorage.getItem(storageKey) || '{}');
        const dates = Object.keys(dailyCounts).sort();
        
        // Get last 7 days
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            last7Days.push({
                date: dateStr,
                count: dailyCounts[dateStr] || null,
                label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            });
        }
        
        return last7Days;
    } catch (error) {
        console.error('Error getting daily Pokemon counts:', error);
        return [];
    }
}

// Get Pokemon counts grouped by file date
function getPokemonCountsByFileDate(pokemon, timeframe = '7d') {
    if (!pokemon || pokemon.length === 0) {
        return [];
    }
    
    // Calculate date range based on timeframe
    const now = new Date();
    let startDate = new Date();
    
    switch (timeframe) {
        case '7d':
            startDate.setDate(now.getDate() - 7);
            break;
        case '30d':
            startDate.setDate(now.getDate() - 30);
            break;
        case '90d':
            startDate.setDate(now.getDate() - 90);
            break;
        case '1y':
            startDate.setFullYear(now.getFullYear() - 1);
            break;
        case 'all':
            // Find earliest file date
            const dates = pokemon
                .map(p => {
                    const date = p.fileCreated ? new Date(p.fileCreated) : (p.fileModified ? new Date(p.fileModified) : null);
                    return date;
                })
                .filter(d => d !== null);
            if (dates.length > 0) {
                startDate = new Date(Math.min(...dates.map(d => d.getTime())));
            }
            break;
        default:
            startDate.setDate(now.getDate() - 7);
    }
    
    // Group Pokemon by file date (day)
    const dateCounts = new Map();
    
    pokemon.forEach(p => {
        const fileDate = p.fileCreated ? new Date(p.fileCreated) : (p.fileModified ? new Date(p.fileModified) : null);
        if (!fileDate || fileDate < startDate) {
            return; // Skip if no date or before start date
        }
        
        // Round to start of day
        const dateKey = new Date(fileDate.getFullYear(), fileDate.getMonth(), fileDate.getDate());
        const dateStr = dateKey.toISOString().split('T')[0];
        
        dateCounts.set(dateStr, (dateCounts.get(dateStr) || 0) + 1);
    });
    
    // Generate all dates in range
    const result = [];
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);
    const endDate = new Date(now);
    endDate.setHours(0, 0, 0, 0);
    
    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        result.push({
            date: dateStr,
            count: dateCounts.get(dateStr) || 0,
            label: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return result;
}

// Create line chart for 7-day Pokemon count (old format)
function create7DayLineChart(data) {
    if (!data || data.length === 0) {
        return '<p class="no-data">No historical data available yet. Data will appear after viewing statistics multiple times.</p>';
    }
    
    const hasData = data.some(d => d.count !== null);
    if (!hasData) {
        return '<p class="no-data">No historical data available yet. Data will appear after viewing statistics multiple times.</p>';
    }
    
    const maxCount = Math.max(...data.map(d => d.count || 0));
    const minCount = Math.min(...data.map(d => d.count || 0));
    const range = maxCount - minCount || 1; // Avoid division by zero
    
    const width = 600;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    let svg = `<div class="line-chart-container">
        <svg width="${width}" height="${height}" class="line-chart">
            <!-- Grid lines -->
            ${Array.from({ length: 5 }, (_, i) => {
                const y = padding.top + (chartHeight / 4) * i;
                const value = maxCount - (range / 4) * i;
                return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" 
                    stroke="var(--border-color)" stroke-width="1" opacity="0.3"/>
                    <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" 
                    fill="var(--text-secondary)" font-size="10">${Math.round(value)}</text>`;
            }).join('')}
            
            <!-- Data points and line -->
            <polyline points="${data.map((d, i) => {
                if (d.count === null) return null;
                const x = padding.left + (chartWidth / (data.length - 1)) * i;
                const y = padding.top + chartHeight - ((d.count - minCount) / range) * chartHeight;
                return `${x},${y}`;
            }).filter(p => p !== null).join(' ')}" 
                fill="none" stroke="var(--accent-color)" stroke-width="2"/>
            
            ${data.map((d, i) => {
                if (d.count === null) return '';
                const x = padding.left + (chartWidth / (data.length - 1)) * i;
                const y = padding.top + chartHeight - ((d.count - minCount) / range) * chartHeight;
                return `<circle cx="${x}" cy="${y}" r="4" fill="var(--accent-color)" stroke="var(--bg-secondary)" stroke-width="2">
                    <title>${d.label}: ${d.count} Pokemon</title>
                </circle>
                <text x="${x}" y="${height - padding.bottom + 15}" text-anchor="middle" 
                    fill="var(--text-secondary)" font-size="10" transform="rotate(-45 ${x} ${height - padding.bottom + 15})">${d.label}</text>`;
            }).join('')}
        </svg>
    </div>`;
    
    return svg;
}

// Create line chart for Pokemon count by file date
function createFileDateLineChart(data) {
    if (!data || data.length === 0) {
        return '<p class="no-data">No file date data available.</p>';
    }
    
    const maxCount = Math.max(...data.map(d => d.count || 0));
    const minCount = Math.min(...data.map(d => d.count || 0));
    const range = maxCount - minCount || 1; // Avoid division by zero
    
    const width = 600;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    // For longer timeframes, show fewer labels to avoid crowding
    const labelInterval = data.length > 30 ? Math.ceil(data.length / 15) : 1;
    
    let svg = `<div class="line-chart-container">
        <svg width="${width}" height="${height}" class="line-chart">
            <!-- Grid lines -->
            ${Array.from({ length: 5 }, (_, i) => {
                const y = padding.top + (chartHeight / 4) * i;
                const value = maxCount - (range / 4) * i;
                return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" 
                    stroke="var(--border-color)" stroke-width="1" opacity="0.3"/>
                    <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" 
                    fill="var(--text-secondary)" font-size="10">${Math.round(value)}</text>`;
            }).join('')}
            
            <!-- Data points and line -->
            <polyline points="${data.map((d, i) => {
                const x = padding.left + (chartWidth / (data.length - 1 || 1)) * i;
                const y = padding.top + chartHeight - ((d.count - minCount) / range) * chartHeight;
                return `${x},${y}`;
            }).join(' ')}" 
                fill="none" stroke="var(--accent-color)" stroke-width="2"/>
            
            ${data.map((d, i) => {
                const x = padding.left + (chartWidth / (data.length - 1 || 1)) * i;
                const y = padding.top + chartHeight - ((d.count - minCount) / range) * chartHeight;
                const showLabel = i % labelInterval === 0 || i === data.length - 1;
                return `<circle cx="${x}" cy="${y}" r="4" fill="var(--accent-color)" stroke="var(--bg-secondary)" stroke-width="2">
                    <title>${d.label}: ${d.count} Pokemon</title>
                </circle>
                ${showLabel ? `<text x="${x}" y="${height - padding.bottom + 15}" text-anchor="middle" 
                    fill="var(--text-secondary)" font-size="10" transform="rotate(-45 ${x} ${height - padding.bottom + 15})">${d.label}</text>` : ''}`;
            }).join('')}
        </svg>
    </div>`;
    
    return svg;
}

// Create bar chart for 7-day Pokemon count
function create7DayBarChart(data) {
    if (!data || data.length === 0) {
        return '<p class="no-data">No historical data available yet. Data will appear after viewing statistics multiple times.</p>';
    }
    
    const hasData = data.some(d => d.count !== null);
    if (!hasData) {
        return '<p class="no-data">No historical data available yet. Data will appear after viewing statistics multiple times.</p>';
    }
    
    const maxCount = Math.max(...data.map(d => d.count || 0));
    const width = 600;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const barWidth = chartWidth / data.length;
    
    let svg = `<div class="bar-chart-container">
        <svg width="${width}" height="${height}" class="bar-chart">
            <!-- Grid lines -->
            ${Array.from({ length: 5 }, (_, i) => {
                const y = padding.top + (chartHeight / 4) * i;
                const value = maxCount - (maxCount / 4) * i;
                return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" 
                    stroke="var(--border-color)" stroke-width="1" opacity="0.3"/>
                    <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" 
                    fill="var(--text-secondary)" font-size="10">${Math.round(value)}</text>`;
            }).join('')}
            
            <!-- Bars -->
            ${data.map((d, i) => {
                if (d.count === null) return '';
                const barHeight = (d.count / maxCount) * chartHeight;
                const x = padding.left + (barWidth * i);
                const y = padding.top + chartHeight - barHeight;
                return `<g class="bar-group" data-count="${d.count}" data-label="${d.label}">
                    <rect x="${x}" y="${y}" width="${barWidth * 0.8}" height="${barHeight}" 
                        fill="var(--accent-color)" stroke="var(--bg-secondary)" stroke-width="1"
                        class="bar-rect">
                        <title>${d.label}: ${d.count} Pokemon</title>
                    </rect>
                    <text x="${x + barWidth * 0.4}" y="${height - padding.bottom + 15}" text-anchor="middle" 
                        fill="var(--text-secondary)" font-size="10" transform="rotate(-45 ${x + barWidth * 0.4} ${height - padding.bottom + 15})">${d.label}</text>
                </g>`;
            }).join('')}
        </svg>
    </div>`;
    
    return svg;
}

// Create bar chart for Pokemon count by file date
function createFileDateBarChart(data) {
    if (!data || data.length === 0) {
        return '<p class="no-data">No file date data available.</p>';
    }
    
    const maxCount = Math.max(...data.map(d => d.count || 0));
    const width = 600;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const barWidth = chartWidth / data.length;
    
    // For longer timeframes, show fewer labels to avoid crowding
    const labelInterval = data.length > 30 ? Math.ceil(data.length / 15) : 1;
    
    let svg = `<div class="bar-chart-container">
        <svg width="${width}" height="${height}" class="bar-chart">
            <!-- Grid lines -->
            ${Array.from({ length: 5 }, (_, i) => {
                const y = padding.top + (chartHeight / 4) * i;
                const value = maxCount - (maxCount / 4) * i;
                return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" 
                    stroke="var(--border-color)" stroke-width="1" opacity="0.3"/>
                    <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" 
                    fill="var(--text-secondary)" font-size="10">${Math.round(value)}</text>`;
            }).join('')}
            
            <!-- Bars -->
            ${data.map((d, i) => {
                const barHeight = (d.count / maxCount) * chartHeight;
                const x = padding.left + (barWidth * i);
                const y = padding.top + chartHeight - barHeight;
                const showLabel = i % labelInterval === 0 || i === data.length - 1;
                return `<g class="bar-group" data-count="${d.count}" data-label="${d.label}">
                    <rect x="${x}" y="${y}" width="${barWidth * 0.8}" height="${barHeight}" 
                        fill="var(--accent-color)" stroke="var(--bg-secondary)" stroke-width="1"
                        class="bar-rect">
                        <title>${d.label}: ${d.count} Pokemon</title>
                    </rect>
                    ${showLabel ? `<text x="${x + barWidth * 0.4}" y="${height - padding.bottom + 15}" text-anchor="middle" 
                        fill="var(--text-secondary)" font-size="10" transform="rotate(-45 ${x + barWidth * 0.4} ${height - padding.bottom + 15})">${d.label}</text>` : ''}
                </g>`;
            }).join('')}
        </svg>
    </div>`;
    
    return svg;
}

async function showStatistics() {
    console.log('showStatistics called');
    console.log('statisticsBody:', statisticsBody);
    console.log('statisticsModal:', statisticsModal);
    
    if (!statisticsBody || !statisticsModal) {
        console.error('Statistics elements not found:', { statisticsBody, statisticsModal });
        alert('Statistics modal elements not found. Please refresh the page.');
        return;
    }
    
    statisticsBody.innerHTML = '<p>Calculating statistics...</p>';
    statisticsModal.classList.remove('hidden');
    console.log('Modal should be visible now');
    
    // Filter out invalid Pokemon (support Gen 1-7: species IDs 1-807)
    const validPokemon = pokemonData.filter(p => !p.error && p.species && p.species > 0 && p.species <= 807);
    
    if (validPokemon.length === 0) {
        statisticsBody.innerHTML = '<p class="no-statistics">No valid Pokemon found in database.</p>';
        return;
    }
    
    // Ensure species names are loaded before calculating statistics
    statisticsBody.innerHTML = '<p>Loading species names...</p>';
    await preloadSpeciesNames(validPokemon);
    
    // Update Pokemon data with species names from cache
    const pokemonWithNames = validPokemon.map(p => {
        const speciesId = parseInt(p.species);
        const speciesName = speciesCache.get(speciesId) || p.speciesName || `Unknown (${speciesId})`;
        return {
            ...p,
            speciesName: speciesName
        };
    });
    
    // Update daily count (for total Pokemon statistics)
    updateDailyPokemonCount(validPokemon.length);
    
    // Calculate statistics
    const stats = calculateStatistics(pokemonWithNames);
    
    // Display statistics (pass Pokemon data for file date graph)
    displayStatistics(stats, pokemonWithNames);
}

function calculateStatistics(pokemon) {
    const stats = {
        total: pokemon.length,
        uniqueSpecies: new Set(pokemon.map(p => p.species)).size,
        speciesCount: {},
        shinyCount: 0,
        shinySpecies: {},
        ivStats: {
            sum: { total: 0, count: 0, max: 0, min: 186, distribution: {} },
            hp: { total: 0, count: 0, max: 0, min: 31 },
            attack: { total: 0, count: 0, max: 0, min: 31 },
            defense: { total: 0, count: 0, max: 0, min: 31 },
            spAttack: { total: 0, count: 0, max: 0, min: 31 },
            spDefense: { total: 0, count: 0, max: 0, min: 31 },
            speed: { total: 0, count: 0, max: 0, min: 31 }
        },
        highestIVShiny: null,
        highestIVNonShiny: null,
        levelStats: { total: 0, count: 0, max: 0, min: 100, distribution: {} },
        evStats: {
            sum: { total: 0, count: 0, max: 0, min: 510 },
            hp: { total: 0, count: 0, max: 0, min: 255 },
            attack: { total: 0, count: 0, max: 0, min: 255 },
            defense: { total: 0, count: 0, max: 0, min: 255 },
            spAttack: { total: 0, count: 0, max: 0, min: 255 },
            spDefense: { total: 0, count: 0, max: 0, min: 255 },
            speed: { total: 0, count: 0, max: 0, min: 255 }
        },
        otDistribution: {},
        gameDistribution: {},
        natureDistribution: {},
        abilityDistribution: {},
        ballDistribution: {},
        metLocationDistribution: {},
        tidSidDistribution: {}
    };
    
    pokemon.forEach(p => {
        // Species count - try to get name from cache if not in object
        let speciesName = p.speciesName;
        if (!speciesName || speciesName.startsWith('#') || speciesName.startsWith('Unknown')) {
            const speciesId = parseInt(p.species);
            if (speciesId && speciesCache.has(speciesId)) {
                speciesName = speciesCache.get(speciesId);
            } else if (!speciesName) {
                speciesName = `#${p.species}`;
            }
        }
        stats.speciesCount[speciesName] = (stats.speciesCount[speciesName] || 0) + 1;
        
        // Shiny count
        if (p.isShiny) {
            stats.shinyCount++;
            stats.shinySpecies[speciesName] = (stats.shinySpecies[speciesName] || 0) + 1;
        }
        
        // IV statistics
        if (p.ivs) {
            const ivs = p.ivs;
            const ivSum = p.ivSum || 0;
            
            stats.ivStats.sum.total += ivSum;
            stats.ivStats.sum.count++;
            stats.ivStats.sum.max = Math.max(stats.ivStats.sum.max, ivSum);
            stats.ivStats.sum.min = Math.min(stats.ivStats.sum.min, ivSum);
            
            // IV Sum category distribution
            let category = '';
            if (ivSum >= 186) category = '186';
            else if (ivSum >= 180) category = '180-185';
            else if (ivSum >= 170) category = '170-179';
            else if (ivSum >= 150) category = '150-169';
            else if (ivSum >= 130) category = '130-149';
            else if (ivSum >= 100) category = '100-129';
            else if (ivSum >= 70) category = '70-99';
            else if (ivSum >= 50) category = '50-69';
            else if (ivSum >= 11) category = '11-49';
            else category = '10-0';
            
            if (!stats.ivStats.sum.distribution[category]) {
                stats.ivStats.sum.distribution[category] = 0;
            }
            stats.ivStats.sum.distribution[category]++;
            
            // Track highest IV shiny and non-shiny
            if (p.isShiny) {
                if (!stats.highestIVShiny || ivSum > (stats.highestIVShiny.ivSum || 0)) {
                    stats.highestIVShiny = {
                        species: speciesName,
                        speciesId: p.species,
                        ivSum: ivSum,
                        ivs: { ...ivs },
                        filename: p.filename || 'Unknown'
                    };
                }
            } else {
                if (!stats.highestIVNonShiny || ivSum > (stats.highestIVNonShiny.ivSum || 0)) {
                    stats.highestIVNonShiny = {
                        species: speciesName,
                        speciesId: p.species,
                        ivSum: ivSum,
                        ivs: { ...ivs },
                        filename: p.filename || 'Unknown'
                    };
                }
            }
            
            ['hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed'].forEach(stat => {
                const value = ivs[stat] || 0;
                stats.ivStats[stat].total += value;
                stats.ivStats[stat].count++;
                stats.ivStats[stat].max = Math.max(stats.ivStats[stat].max, value);
                stats.ivStats[stat].min = Math.min(stats.ivStats[stat].min, value);
            });
        }
        
        // Level statistics
        if (p.level) {
            stats.levelStats.total += p.level;
            stats.levelStats.count++;
            stats.levelStats.max = Math.max(stats.levelStats.max, p.level);
            stats.levelStats.min = Math.min(stats.levelStats.min, p.level);
            
            const levelRange = Math.floor(p.level / 10) * 10;
            const rangeKey = `${levelRange}-${levelRange + 9}`;
            stats.levelStats.distribution[rangeKey] = (stats.levelStats.distribution[rangeKey] || 0) + 1;
        }
        
        // OT distribution
        const otName = p.otName || 'Unknown OT';
        stats.otDistribution[otName] = (stats.otDistribution[otName] || 0) + 1;
        
        // Game distribution
        const gameName = p.originGameName || 'Unknown';
        stats.gameDistribution[gameName] = (stats.gameDistribution[gameName] || 0) + 1;
        
        // Nature distribution
        const natureName = p.natureName || (p.nature ? `Nature ${p.nature}` : null);
        if (natureName) {
            stats.natureDistribution[natureName] = (stats.natureDistribution[natureName] || 0) + 1;
        }
        
        // Ability distribution
        if (p.abilityName) {
            stats.abilityDistribution[p.abilityName] = (stats.abilityDistribution[p.abilityName] || 0) + 1;
        }
        
        // Ball distribution
        if (p.ballName) {
            stats.ballDistribution[p.ballName] = (stats.ballDistribution[p.ballName] || 0) + 1;
        }
        
        // Met location distribution
        if (p.metLocationName) {
            stats.metLocationDistribution[p.metLocationName] = (stats.metLocationDistribution[p.metLocationName] || 0) + 1;
        }
        
        // EV statistics
        if (p.evs) {
            const evs = p.evs;
            const evSum = p.evSum || 0;
            
            stats.evStats.sum.total += evSum;
            stats.evStats.sum.count++;
            stats.evStats.sum.max = Math.max(stats.evStats.sum.max, evSum);
            stats.evStats.sum.min = Math.min(stats.evStats.sum.min, evSum);
            
            ['hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed'].forEach(stat => {
                const value = evs[stat] || 0;
                stats.evStats[stat].total += value;
                stats.evStats[stat].count++;
                stats.evStats[stat].max = Math.max(stats.evStats[stat].max, value);
                stats.evStats[stat].min = Math.min(stats.evStats[stat].min, value);
            });
        }
        
        // TID/SID distribution
        if (p.tid !== undefined && p.sid !== undefined) {
            const tidSidKey = `TID:${p.tid || 0} / SID:${p.sid || 0}`;
            stats.tidSidDistribution[tidSidKey] = (stats.tidSidDistribution[tidSidKey] || 0) + 1;
        }
    });
    
    // Calculate averages
    if (stats.ivStats.sum.count > 0) {
        stats.ivStats.sum.avg = (stats.ivStats.sum.total / stats.ivStats.sum.count).toFixed(2);
        ['hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed'].forEach(stat => {
            if (stats.ivStats[stat].count > 0) {
                stats.ivStats[stat].avg = (stats.ivStats[stat].total / stats.ivStats[stat].count).toFixed(2);
            }
        });
    }
    
    if (stats.levelStats.count > 0) {
        stats.levelStats.avg = (stats.levelStats.total / stats.levelStats.count).toFixed(2);
    }
    
    // Calculate EV averages
    if (stats.evStats.sum.count > 0) {
        stats.evStats.sum.avg = (stats.evStats.sum.total / stats.evStats.sum.count).toFixed(2);
        ['hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed'].forEach(stat => {
            if (stats.evStats[stat].count > 0) {
                stats.evStats[stat].avg = (stats.evStats[stat].total / stats.evStats[stat].count).toFixed(2);
            }
        });
    }
    
    // Get top items
    stats.topSpecies = Object.entries(stats.speciesCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    stats.topShinySpecies = Object.entries(stats.shinySpecies)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    stats.topOTs = Object.entries(stats.otDistribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    stats.topNatures = Object.entries(stats.natureDistribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    stats.topAbilities = Object.entries(stats.abilityDistribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    stats.topBalls = Object.keys(stats.ballDistribution).length > 0
        ? Object.entries(stats.ballDistribution)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
        : [];
    
    stats.topMetLocations = Object.keys(stats.metLocationDistribution).length > 0
        ? Object.entries(stats.metLocationDistribution)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
        : [];
    
    stats.topTIDSIDs = Object.keys(stats.tidSidDistribution).length > 0
        ? Object.entries(stats.tidSidDistribution)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
        : [];
    
    return stats;
}

function displayStatistics(stats, pokemon = []) {
    // Default mode and timeframe
    let currentMode = 'fileDate'; // 'fileDate' or 'total'
    let currentTimeframe = '7d';
    
    let html = '<div class="statistics-container">';
    
    // Overview
    html += '<div class="statistics-section">';
    html += '<h3>Overview</h3>';
    html += '<div class="statistics-grid">';
    html += `<div class="statistic-card"><div class="statistic-value">${stats.total}</div><div class="statistic-label">Total Pokemon</div></div>`;
    html += `<div class="statistic-card"><div class="statistic-value">${stats.uniqueSpecies}</div><div class="statistic-label">Unique Species</div></div>`;
    html += `<div class="statistic-card"><div class="statistic-value">${stats.shinyCount}</div><div class="statistic-label">Shiny Pokemon</div></div>`;
    html += `<div class="statistic-card"><div class="statistic-value">${((stats.shinyCount / stats.total) * 100).toFixed(2)}%</div><div class="statistic-label">Shiny Rate</div></div>`;
    html += '</div>';
    
    // Pokemon Count Graph
    html += '<div class="statistics-graph-section">';
    html += '<div class="graph-header">';
    html += '<h4 id="graphTitle">Pokemon Count by File Date</h4>';
    html += '<div class="graph-controls">';
    html += '<div class="graph-mode-toggle">';
    html += '<label class="toggle-switch">';
    html += '<input type="checkbox" id="graphModeToggle" checked>';
    html += '<span class="toggle-slider"></span>';
    html += '<span class="toggle-label">File Date</span>';
    html += '</label>';
    html += '</div>';
    html += '<div class="chart-type-toggle">';
    html += '<button class="chart-type-btn active" data-chart-type="line" id="chartTypeLine">Line</button>';
    html += '<button class="chart-type-btn" data-chart-type="bar" id="chartTypeBar">Bar</button>';
    html += '</div>';
    html += '</div>';
    html += '<div class="timeframe-controls" id="timeframeControls">';
    html += '<button class="timeframe-btn active" data-timeframe="7d">7 Days</button>';
    html += '<button class="timeframe-btn" data-timeframe="30d">30 Days</button>';
    html += '<button class="timeframe-btn" data-timeframe="90d">90 Days</button>';
    html += '<button class="timeframe-btn" data-timeframe="1y">1 Year</button>';
    html += '<button class="timeframe-btn" data-timeframe="all">All Time</button>';
    html += '</div>';
    html += '</div>';
    const dailyData = getPokemonCountsByFileDate(pokemon, currentTimeframe);
    html += `<div class="graph-container" data-mode="${currentMode}" data-timeframe="${currentTimeframe}">${createFileDateLineChart(dailyData)}</div>`;
    html += '</div>';
    
    html += '</div>';
    
    // Most Common Pokemon
    html += '<div class="statistics-section">';
    html += '<h3>Most Common Pokemon</h3>';
    html += '<div class="statistics-list">';
    stats.topSpecies.forEach(([species, count], idx) => {
        const percentage = ((count / stats.total) * 100).toFixed(1);
        html += `<div class="statistics-item"><span class="statistics-rank">${idx + 1}.</span><span class="statistics-name">${species}</span><span class="statistics-count">${count} (${percentage}%)</span></div>`;
    });
    html += '</div></div>';
    
    // Most Common Shiny Pokemon
    if (stats.topShinySpecies.length > 0) {
        html += '<div class="statistics-section">';
        html += '<h3>Most Common Shiny Pokemon</h3>';
        html += '<div class="statistics-list">';
        stats.topShinySpecies.forEach(([species, count], idx) => {
            html += `<div class="statistics-item"><span class="statistics-rank">${idx + 1}.</span><span class="statistics-name">${species} ⭐</span><span class="statistics-count">${count}</span></div>`;
        });
        html += '</div></div>';
    }
    
    // IV Statistics
    if (stats.ivStats.sum.count > 0) {
        html += '<div class="statistics-section">';
        html += '<h3>IV Statistics</h3>';
        html += '<div class="statistics-grid">';
        html += `<div class="statistic-card"><div class="statistic-value">${stats.ivStats.sum.avg}</div><div class="statistic-label">Avg IV Sum</div></div>`;
        html += `<div class="statistic-card"><div class="statistic-value">${stats.ivStats.sum.max}</div><div class="statistic-label">Max IV Sum</div></div>`;
        html += `<div class="statistic-card"><div class="statistic-value">${stats.ivStats.sum.min}</div><div class="statistic-label">Min IV Sum</div></div>`;
        html += '</div>';
        
        // IV Sum Categories
        if (stats.ivStats.sum.distribution && Object.keys(stats.ivStats.sum.distribution).length > 0) {
            html += '<div class="statistics-subsection">';
            html += '<h4>IV Sum Categories</h4>';
            html += '<div class="statistics-list">';
            
            // Sort categories in descending order
            const categoryOrder = ['186', '180-185', '170-179', '150-169', '130-149', '100-129', '70-99', '50-69', '11-49', '10-0'];
            const sortedCategories = categoryOrder.filter(cat => stats.ivStats.sum.distribution[cat]);
            
            sortedCategories.forEach(category => {
                const count = stats.ivStats.sum.distribution[category];
                const percentage = ((count / stats.ivStats.sum.count) * 100).toFixed(1);
                html += `<div class="statistics-item"><span class="statistics-name">${category}</span><span class="statistics-count">${count} (${percentage}%)</span></div>`;
            });
            
            html += '</div></div>';
        }
        
        // Highest IV Pokemon
        html += '<div class="statistics-subsection">';
        html += '<h4>Highest IV Pokemon</h4>';
        html += '<div class="statistics-list">';
        
        if (stats.highestIVShiny) {
            const shiny = stats.highestIVShiny;
            const ivsStr = `HP:${shiny.ivs.hp || 0} Atk:${shiny.ivs.attack || 0} Def:${shiny.ivs.defense || 0} SpA:${shiny.ivs.spAttack || 0} SpD:${shiny.ivs.spDefense || 0} Spe:${shiny.ivs.speed || 0}`;
            html += `<div class="statistics-item"><span class="statistics-name">⭐ Highest Shiny: ${shiny.species}</span><span class="statistics-count">IV Sum: ${shiny.ivSum}</span></div>`;
            html += `<div class="statistics-item" style="padding-left: 20px; font-size: 0.9em; color: var(--text-secondary);"><span class="statistics-name">${ivsStr}</span></div>`;
        }
        
        if (stats.highestIVNonShiny) {
            const nonShiny = stats.highestIVNonShiny;
            const ivsStr = `HP:${nonShiny.ivs.hp || 0} Atk:${nonShiny.ivs.attack || 0} Def:${nonShiny.ivs.defense || 0} SpA:${nonShiny.ivs.spAttack || 0} SpD:${nonShiny.ivs.spDefense || 0} Spe:${nonShiny.ivs.speed || 0}`;
            html += `<div class="statistics-item"><span class="statistics-name">Highest Non-Shiny: ${nonShiny.species}</span><span class="statistics-count">IV Sum: ${nonShiny.ivSum}</span></div>`;
            html += `<div class="statistics-item" style="padding-left: 20px; font-size: 0.9em; color: var(--text-secondary);"><span class="statistics-name">${ivsStr}</span></div>`;
        }
        
        html += '</div></div>';
        
        html += '<div class="iv-breakdown">';
        ['hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed'].forEach(stat => {
            const statName = stat === 'spAttack' ? 'Sp. Atk' : stat === 'spDefense' ? 'Sp. Def' : stat.charAt(0).toUpperCase() + stat.slice(1);
            html += `<div class="iv-stat-item"><span class="iv-stat-name">${statName}:</span><span class="iv-stat-value">Avg: ${stats.ivStats[stat].avg || 0}</span></div>`;
        });
        html += '</div></div>';
    }
    
    // Level Statistics
    if (stats.levelStats.count > 0) {
        html += '<div class="statistics-section">';
        html += '<h3>Level Statistics</h3>';
        html += '<div class="statistics-grid">';
        html += `<div class="statistic-card"><div class="statistic-value">${stats.levelStats.avg}</div><div class="statistic-label">Average Level</div></div>`;
        html += `<div class="statistic-card"><div class="statistic-value">${stats.levelStats.max}</div><div class="statistic-label">Max Level</div></div>`;
        html += `<div class="statistic-card"><div class="statistic-value">${stats.levelStats.min}</div><div class="statistic-label">Min Level</div></div>`;
        html += '</div>';
        
        // Level distribution
        const levelDistEntries = Object.entries(stats.levelStats.distribution)
            .sort((a, b) => {
                const aStart = parseInt(a[0].split('-')[0]);
                const bStart = parseInt(b[0].split('-')[0]);
                return aStart - bStart;
            });
        if (levelDistEntries.length > 0) {
            html += '<div class="level-distribution">';
            html += '<h4>Level Distribution</h4>';
            html += '<div class="statistics-list">';
            levelDistEntries.forEach(([range, count]) => {
                const percentage = ((count / stats.total) * 100).toFixed(1);
                html += `<div class="statistics-item"><span class="statistics-name">Level ${range}</span><span class="statistics-count">${count} (${percentage}%)</span></div>`;
            });
            html += '</div></div>';
        }
        html += '</div>';
    }
    
    // OT Distribution
    html += '<div class="statistics-section">';
    html += '<h3>Top OT Names</h3>';
    html += '<div class="statistics-list">';
    stats.topOTs.forEach(([ot, count], idx) => {
        const percentage = ((count / stats.total) * 100).toFixed(1);
        html += `<div class="statistics-item"><span class="statistics-rank">${idx + 1}.</span><span class="statistics-name">${ot}</span><span class="statistics-count">${count} (${percentage}%)</span></div>`;
    });
    html += '</div></div>';
    
    // Game Distribution
    html += '<div class="statistics-section">';
    html += '<h3>Origin Game Distribution</h3>';
    html += '<div class="statistics-list">';
    Object.entries(stats.gameDistribution)
        .sort((a, b) => b[1] - a[1])
        .forEach(([game, count]) => {
            const percentage = ((count / stats.total) * 100).toFixed(1);
            html += `<div class="statistics-item"><span class="statistics-name">${game}</span><span class="statistics-count">${count} (${percentage}%)</span></div>`;
        });
    html += '</div></div>';
    
    // Nature Distribution
    if (stats.topNatures.length > 0) {
        html += '<div class="statistics-section">';
        html += '<h3>Top Natures</h3>';
        html += '<div class="statistics-list">';
        stats.topNatures.forEach(([nature, count], idx) => {
            const percentage = ((count / stats.total) * 100).toFixed(1);
            html += `<div class="statistics-item"><span class="statistics-rank">${idx + 1}.</span><span class="statistics-name">${nature}</span><span class="statistics-count">${count} (${percentage}%)</span></div>`;
        });
        html += '</div></div>';
    }
    
    // Ability Distribution
    if (stats.topAbilities.length > 0) {
        html += '<div class="statistics-section">';
        html += '<h3>Top Abilities</h3>';
        html += '<div class="statistics-list">';
        stats.topAbilities.forEach(([ability, count], idx) => {
            const percentage = ((count / stats.total) * 100).toFixed(1);
            html += `<div class="statistics-item"><span class="statistics-rank">${idx + 1}.</span><span class="statistics-name">${ability}</span><span class="statistics-count">${count} (${percentage}%)</span></div>`;
        });
        html += '</div></div>';
    }
    
    // EV Statistics
    if (stats.evStats.sum.count > 0) {
        html += '<div class="statistics-section">';
        html += '<h3>EV Statistics</h3>';
        html += '<div class="statistics-grid">';
        html += `<div class="statistic-card"><div class="statistic-value">${stats.evStats.sum.avg}</div><div class="statistic-label">Avg EV Sum</div></div>`;
        html += `<div class="statistic-card"><div class="statistic-value">${stats.evStats.sum.max}</div><div class="statistic-label">Max EV Sum</div></div>`;
        html += `<div class="statistic-card"><div class="statistic-value">${stats.evStats.sum.min}</div><div class="statistic-label">Min EV Sum</div></div>`;
        html += '</div>';
        html += '<div class="iv-breakdown">';
        ['hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed'].forEach(stat => {
            const statName = stat === 'spAttack' ? 'Sp. Atk' : stat === 'spDefense' ? 'Sp. Def' : stat.charAt(0).toUpperCase() + stat.slice(1);
            html += `<div class="iv-stat-item"><span class="iv-stat-name">${statName}:</span><span class="iv-stat-value">Avg: ${stats.evStats[stat].avg || 0} | Max: ${stats.evStats[stat].max} | Min: ${stats.evStats[stat].min}</span></div>`;
        });
        html += '</div></div>';
    }
    
    // Ball Distribution
    if (stats.topBalls && stats.topBalls.length > 0) {
        html += '<div class="statistics-section">';
        html += '<h3>Top Pokeballs</h3>';
        html += '<div class="statistics-list">';
        stats.topBalls.forEach(([ball, count], idx) => {
            const percentage = ((count / stats.total) * 100).toFixed(1);
            html += `<div class="statistics-item"><span class="statistics-rank">${idx + 1}.</span><span class="statistics-name">${ball}</span><span class="statistics-count">${count} (${percentage}%)</span></div>`;
        });
        html += '</div></div>';
    } else if (Object.keys(stats.ballDistribution).length > 0) {
        // Fallback: if topBalls wasn't calculated but ballDistribution has data
        html += '<div class="statistics-section">';
        html += '<h3>Top Pokeballs</h3>';
        html += '<div class="statistics-list">';
        Object.entries(stats.ballDistribution)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .forEach(([ball, count], idx) => {
                const percentage = ((count / stats.total) * 100).toFixed(1);
                html += `<div class="statistics-item"><span class="statistics-rank">${idx + 1}.</span><span class="statistics-name">${ball}</span><span class="statistics-count">${count} (${percentage}%)</span></div>`;
            });
        html += '</div></div>';
    }
    
    // Met Location Distribution
    if (stats.topMetLocations && stats.topMetLocations.length > 0) {
        html += '<div class="statistics-section">';
        html += '<h3>Top Met Locations</h3>';
        html += '<div class="statistics-list">';
        stats.topMetLocations.forEach(([location, count], idx) => {
            const percentage = ((count / stats.total) * 100).toFixed(1);
            html += `<div class="statistics-item"><span class="statistics-rank">${idx + 1}.</span><span class="statistics-name">${location}</span><span class="statistics-count">${count} (${percentage}%)</span></div>`;
        });
        html += '</div></div>';
    }
    
    // TID/SID Distribution
    if (stats.topTIDSIDs && stats.topTIDSIDs.length > 0) {
        html += '<div class="statistics-section">';
        html += '<h3>Top TID/SID Combinations</h3>';
        html += '<div class="statistics-list">';
        stats.topTIDSIDs.forEach(([tidSid, count], idx) => {
            const percentage = ((count / stats.total) * 100).toFixed(1);
            html += `<div class="statistics-item"><span class="statistics-rank">${idx + 1}.</span><span class="statistics-name">${tidSid}</span><span class="statistics-count">${count} (${percentage}%)</span></div>`;
        });
        html += '</div></div>';
    }
    
    // Pokedex Statistics
    html += '<div class="statistics-section">';
    html += '<h3>Living Dex Completion</h3>';
    html += '<div id="pokedexStatsContainer">Loading...</div>';
    html += '</div>';
    
    html += '</div>';
    
    statisticsBody.innerHTML = html;
    
    // Store Pokemon data globally for timeframe updates
    statisticsPokemonData = pokemon;
    
    // Set up timeframe button event listeners after a short delay to ensure DOM is ready
    setTimeout(setupTimeframeControls, 100);
    
    // Load Pokedex statistics
    loadPokedexStatistics();
}

// Load Pokedex statistics for the statistics modal
async function loadPokedexStatistics() {
    const container = document.getElementById('pokedexStatsContainer');
    if (!container) return;
    
    try {
        const dbId = currentDatabase || 'db1';
        const response = await fetch(`/api/pokedex?db=${dbId}`);
        if (!response.ok) {
            container.innerHTML = '<p>Failed to load Pokedex statistics</p>';
            return;
        }
        
        const data = await response.json();
        const { completionStats } = data;
        
        if (!completionStats || Object.keys(completionStats).length === 0) {
            container.innerHTML = '<p>No Pokedex data available</p>';
            return;
        }
        
        let html = '<div class="pokedex-stats-grid">';
        
        // Sort by generation number
        const sortedGens = Object.keys(completionStats).sort((a, b) => parseInt(a) - parseInt(b));
        
        for (const genNum of sortedGens) {
            const genStats = completionStats[genNum];
            const livingDexBadge = genStats.livingDex ? '<span class="badge living-dex">Living Dex</span>' : '';
            const shinyLivingDexBadge = genStats.shinyLivingDex ? '<span class="badge shiny-living-dex">Shiny Living Dex</span>' : '';
            
            html += `
                <div class="pokedex-stat-card">
                    <h4>${genStats.name}</h4>
                    <div class="stat-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${genStats.percentage}%"></div>
                        </div>
                        <span>${genStats.owned}/${genStats.total} (${genStats.percentage}%)</span>
                    </div>
                    <div class="shiny-progress">
                        <div class="progress-bar">
                            <div class="progress-fill shiny" style="width: ${genStats.shinyPercentage}%"></div>
                        </div>
                        <span>Shiny: ${genStats.shiny}/${genStats.total} (${genStats.shinyPercentage}%)</span>
                    </div>
                    <div class="badges">
                        ${livingDexBadge}
                        ${shinyLivingDexBadge}
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading Pokedex statistics:', error);
        container.innerHTML = '<p>Error loading Pokedex statistics</p>';
    }
}

// Setup chart tooltips to show exact numbers on hover
function setupChartTooltips() {
    // Remove existing tooltips
    const existingTooltips = document.querySelectorAll('.chart-tooltip');
    existingTooltips.forEach(t => t.remove());
    
    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);
    
    // Add hover events to chart elements
    const chartContainer = document.querySelector('.graph-container');
    if (!chartContainer) return;
    
    // For line charts - circles
    const circles = chartContainer.querySelectorAll('circle');
    circles.forEach(circle => {
        const title = circle.querySelector('title');
        if (title) {
            circle.addEventListener('mouseenter', (e) => {
                tooltip.textContent = title.textContent;
                tooltip.style.display = 'block';
                updateTooltipPosition(e, tooltip);
            });
            circle.addEventListener('mousemove', (e) => {
                updateTooltipPosition(e, tooltip);
            });
            circle.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });
        }
    });
    
    // For bar charts - rectangles
    const bars = chartContainer.querySelectorAll('.bar-rect, rect.bar-rect');
    bars.forEach(bar => {
        const title = bar.querySelector('title');
        const count = bar.closest('.bar-group')?.getAttribute('data-count');
        const label = bar.closest('.bar-group')?.getAttribute('data-label');
        if (title || (count && label)) {
            const text = title ? title.textContent : `${label}: ${count} Pokemon`;
            bar.addEventListener('mouseenter', (e) => {
                tooltip.textContent = text;
                tooltip.style.display = 'block';
                updateTooltipPosition(e, tooltip);
            });
            bar.addEventListener('mousemove', (e) => {
                updateTooltipPosition(e, tooltip);
            });
            bar.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });
        }
    });
}

function updateTooltipPosition(e, tooltip) {
    const x = e.clientX + 10;
    const y = e.clientY - 10;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
}

// Set up timeframe control buttons and mode toggle for statistics graph
function setupTimeframeControls() {
    const graphContainer = document.querySelector('.graph-container');
    const timeframeButtons = document.querySelectorAll('.timeframe-btn');
    const modeToggle = document.getElementById('graphModeToggle');
    const graphTitle = document.getElementById('graphTitle');
    const timeframeControls = document.getElementById('timeframeControls');
    
    if (!graphContainer) {
        return;
    }
    
    // Set up mode toggle
    if (modeToggle) {
        modeToggle.addEventListener('change', function() {
            const mode = this.checked ? 'fileDate' : 'total';
            updateStatisticsGraph(null, mode);
        });
    }
    
    // Set up timeframe buttons (only if in fileDate mode)
    if (timeframeButtons.length > 0) {
        timeframeButtons.forEach(btn => {
            // Remove existing listeners to avoid duplicates
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', function() {
                const timeframe = this.getAttribute('data-timeframe');
                updateStatisticsGraph(timeframe);
            });
        });
    }
    
    // Setup chart type toggle
    const chartTypeButtons = document.querySelectorAll('.chart-type-btn');
    if (chartTypeButtons.length > 0) {
        chartTypeButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const chartType = this.getAttribute('data-chart-type');
                updateStatisticsGraph(null, null, chartType);
            });
        });
    }
}

// Update statistics graph based on selected timeframe and mode
function updateStatisticsGraph(timeframe = null, mode = null, chartType = null) {
    const graphContainer = document.querySelector('.graph-container');
    const timeframeButtons = document.querySelectorAll('.timeframe-btn');
    const modeToggle = document.getElementById('graphModeToggle');
    const graphTitle = document.getElementById('graphTitle');
    const timeframeControls = document.getElementById('timeframeControls');
    const chartTypeButtons = document.querySelectorAll('.chart-type-btn');
    
    if (!graphContainer) {
        return;
    }
    
    // Get current mode
    if (mode === null) {
        mode = modeToggle && modeToggle.checked ? 'fileDate' : 'total';
    }
    
    // Get current chart type
    if (chartType === null) {
        const activeChartBtn = document.querySelector('.chart-type-btn.active');
        chartType = activeChartBtn ? activeChartBtn.getAttribute('data-chart-type') : 'line';
    }
    
    // Get current timeframe (only used in fileDate mode)
    if (timeframe === null) {
        timeframe = graphContainer.getAttribute('data-timeframe') || '7d';
    }
    
    let data, chart, title;
    
    if (mode === 'fileDate') {
        // File date mode - use Pokemon file dates
        if (statisticsPokemonData.length === 0) {
            chart = '<p class="no-data">No Pokemon data available.</p>';
        } else {
            data = getPokemonCountsByFileDate(statisticsPokemonData, timeframe);
            chart = chartType === 'bar' ? createFileDateBarChart(data) : createFileDateLineChart(data);
        }
        title = 'Pokemon Count by File Date';
        
        // Show timeframe controls
        if (timeframeControls) {
            timeframeControls.style.display = 'flex';
        }
        
        // Update button states
        if (timeframeButtons.length > 0) {
            timeframeButtons.forEach(btn => {
                if (btn.getAttribute('data-timeframe') === timeframe) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
    } else {
        // Total mode - use localStorage daily counts
        data = getLast7DaysCounts();
        chart = chartType === 'bar' ? create7DayBarChart(data) : create7DayLineChart(data);
        title = 'Total Pokemon Over 7 Days';
        
        // Hide timeframe controls
        if (timeframeControls) {
            timeframeControls.style.display = 'none';
        }
    }
    
    // Update graph
    graphContainer.innerHTML = chart;
    graphContainer.setAttribute('data-mode', mode);
    graphContainer.setAttribute('data-chart-type', chartType);
    if (mode === 'fileDate') {
        graphContainer.setAttribute('data-timeframe', timeframe);
    }
    
    // Update title
    if (graphTitle) {
        graphTitle.textContent = title;
    }
    
    // Update chart type button states
    if (chartTypeButtons.length > 0) {
        chartTypeButtons.forEach(btn => {
            if (btn.getAttribute('data-chart-type') === chartType) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    // Add hover tooltips for exact numbers
    setupChartTooltips();
}

// Duplicate Scanner
// Used by "Scan Duplicates" button in Advanced Options
// Only shows duplicates of the same species with the same IVs
async function scanDuplicates() {
    const duplicateResultsBody = document.getElementById('duplicateResultsBody');
    duplicateResultsBody.innerHTML = '<p>Scanning for duplicates...</p>';
    duplicateResults.classList.remove('hidden');
    
    // Group by PID (Personality Value) - most reliable duplicate detection
    const pidMap = new Map();
    const ivMap = new Map(); // Check by species + IVs (level removed since it can change)
    const duplicates = [];
    
    pokemonData.forEach(p => {
        if (p.error) return;
        
        // Check by PID
        const pidKey = `pid_${p.personality || 0}`;
        if (!pidMap.has(pidKey)) {
            pidMap.set(pidKey, []);
        }
        pidMap.get(pidKey).push(p);
        
        // Check by species + IVs only (level removed - if same species and same IVs, it's a duplicate)
        if (p.speciesId && p.ivs) {
            const ivKey = `${p.speciesId}_${p.ivs.hp || 0}_${p.ivs.attack || 0}_${p.ivs.defense || 0}_${p.ivs.spAttack || 0}_${p.ivs.spDefense || 0}_${p.ivs.speed || 0}`;
            if (!ivMap.has(ivKey)) {
                ivMap.set(ivKey, []);
            }
            ivMap.get(ivKey).push(p);
        }
    });
    
    // Find duplicates (groups with more than 1)
    // Filter PID duplicates to only show groups where all Pokemon have the same species
    const pidDuplicates = Array.from(pidMap.values())
        .filter(group => {
            if (group.length <= 1) return false;
            // Check if all Pokemon in the group have the same species
            const firstSpecies = group[0].speciesId;
            return group.every(p => p.speciesId === firstSpecies);
        });
    
    // IV duplicates already ensure same species (speciesId is in the key)
    const ivDuplicates = Array.from(ivMap.values()).filter(group => group.length > 1);
    
    let html = '<div class="duplicate-summary">';
    html += `<h3>Duplicate Detection Results</h3>`;
    html += `<p><strong>${pidDuplicates.length}</strong> duplicate groups found by PID (Personality Value, same species only)</p>`;
    html += `<p><strong>${ivDuplicates.length}</strong> potential duplicate groups found by Species + IVs (same species and same IVs)</p>`;
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
        html += '<div class="duplicate-section"><h4>Potential Duplicates (Same Species + Same IVs)</h4>';
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
    
    // Location
    const location = document.getElementById('locationFilter').value.trim();
    if (location) advancedFilters.location = location;
    
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

// Change size of cards
const updateCardWidth = (val) => {
    const px = `${val}px`;
    document.documentElement.style.setProperty('--pokemon-card-min-width', px);
    if (cardWidthValue) cardWidthValue.textContent = px;
};

// Save File Management
const loadSaveBtn = document.getElementById('loadSaveBtn');
const closeSaveFileSection = document.getElementById('closeSaveFileSection');
const saveFileSection = document.getElementById('saveFileSection');
const saveFileInput = document.getElementById('saveFileInput');
const loadSaveFileBtn = document.getElementById('loadSaveFileBtn');
const sortBoxesBtn = document.getElementById('sortBoxesBtn');
const exportSaveBtn = document.getElementById('exportSaveBtn');
const saveFileStatus = document.getElementById('saveFileStatus');
const saveFileLoading = document.getElementById('saveFileLoading');
// Drop zone removed - using card selection instead
const selectedCount = document.getElementById('selectedCount');
const importSelectedBtn = document.getElementById('importSelectedBtn');
let saveFileLoaded = false;
let selectionMode = false; // Track if we're in selection mode (independent of save file)

// Event listeners for save file management
if (loadSaveBtn) {
    loadSaveBtn.addEventListener('click', () => {
        saveFileSection.classList.toggle('hidden');
        // Close advanced options modal if open
        if (advancedOptionsModal && !advancedOptionsModal.classList.contains('hidden')) {
            advancedOptionsModal.classList.add('hidden');
        }
    });
}

// Close save file section
if (closeSaveFileSection) {
    closeSaveFileSection.addEventListener('click', () => {
        saveFileSection.classList.add('hidden');
    });
}

loadSaveFileBtn.addEventListener('click', () => {
    saveFileInput.click();
});

saveFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    await loadSaveFile(file);
});

// Drag and drop removed - using card selection instead

exportSaveBtn.addEventListener('click', exportSaveFile);
importSelectedBtn.addEventListener('click', importSelectedPokemon);

// Lottery select button
const lotterySelectBtn = document.getElementById('lotterySelectBtn');
if (lotterySelectBtn) {
    lotterySelectBtn.addEventListener('click', performLotterySelect);
}

const livingDexBtn = document.getElementById('livingDexBtn');
if (livingDexBtn) {
    livingDexBtn.addEventListener('click', performLivingDex);
}

// Perform lottery selection: select 1 random Pokemon per TID/SID combo from currently displayed Pokemon
function performLotterySelect() {
    if (!saveFileLoaded) {
        alert('Please load a save file first to enable selection');
        return;
    }
    
    // Use filteredData which contains the currently displayed Pokemon after all filters
    const dataToUse = filteredData && filteredData.length > 0 ? filteredData : pokemonData;
    
    if (!dataToUse || dataToUse.length === 0) {
        alert('No Pokemon to select from. Please load Pokemon first.');
        return;
    }
    
    const tidSidGroups = new Map();
    
    // Group currently displayed Pokemon by TID/SID
    for (const pokemon of dataToUse) {
        if (pokemon.error || !pokemon.filename) continue; // Skip error Pokemon and invalid entries
        
        // Ensure TID and SID are valid numbers
        const tid = pokemon.tid || 0;
        const sid = pokemon.sid || 0;
        const tidSidKey = `${tid}_${sid}`;
        
        if (!tidSidGroups.has(tidSidKey)) {
            tidSidGroups.set(tidSidKey, []);
        }
        tidSidGroups.get(tidSidKey).push(pokemon);
    }
    
    if (tidSidGroups.size === 0) {
        alert('No valid Pokemon found to select from');
        return;
    }
    
    // Select one random Pokemon from each TID/SID group
    selectedPokemon.clear();
    const selectedDetails = [];
    
    for (const [tidSidKey, pokemonList] of tidSidGroups) {
        if (pokemonList.length === 0) continue;
        
        const randomIndex = Math.floor(Math.random() * pokemonList.length);
        const selected = pokemonList[randomIndex];
        
        if (selected && selected.filename) {
            selectedPokemon.add(selected.filename);
            selectedDetails.push({
                filename: selected.filename,
                species: selected.speciesName || `Species ${selected.species}`,
                tid: selected.tid || 0,
                sid: selected.sid || 0
            });
        }
    }
    
    // Update selection UI
    updateSelectionUI();
    updateCardSelectionStates();
    
    const count = selectedPokemon.size;
    console.log('Lottery selection:', selectedDetails);
    alert(`Lottery selection complete: ${count} Pokemon selected (1 per TID/SID combo)`);
}

// Sort boxes by National Dex
async function sortBoxes() {
    if (!saveFileLoaded) {
        alert('Please load a save file first');
        return;
    }
    
    if (!confirm('This will sort all boxes by National Dex number.\n' +
                 'Pokemon will be rearranged in National Dex order (1-386),\n' +
                 'with empty slots left for missing species.\n\n' +
                 'Continue?')) {
        return;
    }
    
    try {
        const response = await fetch('/api/save/sort-boxes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to sort boxes');
        }
        
        const result = await response.json();
        alert(`Boxes sorted successfully!\n\n` +
              `${result.pokemonCount} Pokemon rearranged by National Dex number.`);
        
        console.log('Sort boxes result:', result);
    } catch (error) {
        console.error('Error sorting boxes:', error);
        alert(`Error: ${error.message}`);
    }
}

// Living Dex Mode - inject one Pokemon per species sorted by National Dex
async function performLivingDex() {
    if (!saveFileLoaded) {
        alert('Please load a save file first');
        return;
    }
    
    if (!confirm('Living Dex Mode will:\n' +
                 '• Sort boxes by National Dex number first\n' +
                 '• Add 1 Pokemon per species (highest IV sum)\n' +
                 '• Skip Pokemon already in boxes\n' +
                 '• Leave empty slots for missing species\n\n' +
                 'Continue?')) {
        return;
    }
    
    try {
        const response = await fetch('/api/save/living-dex', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                dbId: currentDatabase
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to perform Living Dex injection');
        }
        
        const result = await response.json();
        alert(`Living Dex injection complete!\n\n` +
              `Imported: ${result.imported} Pokemon\n` +
              `Errors: ${result.errors}\n\n` +
              `Boxes are now sorted by National Dex number.`);
        
        console.log('Living Dex results:', result);
    } catch (error) {
        console.error('Error in Living Dex mode:', error);
        alert(`Error: ${error.message}`);
    }
}

// Load save file
async function loadSaveFile(file) {
    if (!file.name.toLowerCase().endsWith('.sav')) {
        alert('Please select a .sav file');
        return;
    }
    
    // Show loading indicator
    if (saveFileLoading) {
        saveFileLoading.classList.remove('hidden');
    }
    loadSaveFileBtn.disabled = true;
    
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
        if (sortBoxesBtn) sortBoxesBtn.disabled = false;
        
        // Refresh display to show checkboxes
        sortAndDisplay();
        updateSelectionUI();
        
        console.log('Save file loaded:', data);
    } catch (error) {
        alert(`Error loading save file: ${error.message}`);
        console.error('Error:', error);
    } finally {
        // Hide loading indicator
        if (saveFileLoading) {
            saveFileLoading.classList.add('hidden');
        }
        loadSaveFileBtn.disabled = false;
    }
}

// Import Pokemon files into save file (auto-find empty slots)
async function importPokemonFiles(files) {
    if (!saveFileLoaded) {
        alert('Please load a save file first');
        return;
    }
    
    // Filter to only allow .pk3 files
    const pk3Files = Array.from(files).filter(file => {
        const lowerName = file.name.toLowerCase();
        return lowerName.endsWith('.pk3');
    });
    
    if (pk3Files.length === 0) {
        alert('No .pk3 files selected. Only .pk3 files can be imported to save files.');
        return;
    }
    
    if (pk3Files.length < files.length) {
        const skipped = files.length - pk3Files.length;
        alert(`Skipped ${skipped} non-.pk3 file(s). Only .pk3 files can be imported to save files.`);
    }
    
    const importTarget = document.querySelector('input[name="importTarget"]:checked').value;
    const startFromLastBox = document.getElementById('startFromLastBox')?.checked || false;
    let successCount = 0;
    let errorCount = 0;
    
    for (const file of pk3Files) {
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
                    isParty: importTarget === 'party',
                    startFromLastBox: startFromLastBox && importTarget === 'box', // Only applies to box imports
                    filename: file.name // Include filename for validation
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
    const startFromLastBox = document.getElementById('startFromLastBox')?.checked || false;
    
    const selectedFilenames = Array.from(selectedPokemon);
    let successCount = 0;
    let errorCount = 0;
    
    // Filter to only allow .pk3 files
    const pk3Filenames = selectedFilenames.filter(filename => {
        const lowerName = filename.toLowerCase();
        return lowerName.endsWith('.pk3');
    });
    
    if (pk3Filenames.length === 0) {
        alert('No .pk3 files selected. Only .pk3 files can be imported to save files.');
        return;
    }
    
    if (pk3Filenames.length < selectedFilenames.length) {
        const skipped = selectedFilenames.length - pk3Filenames.length;
        alert(`Skipped ${skipped} non-.pk3 file(s). Only .pk3 files can be imported to save files.`);
    }
    
    // Get Pokemon data for selected files
    for (const filename of pk3Filenames) {
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
            
            await importSinglePokemon(Array.from(buffer), importTarget, startFromLastBox, filename);
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
async function importSinglePokemon(pokemonData, importTarget, startFromLastBox = false, filename = null) {
    const response = await fetch('/api/save/import', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            pokemonData: pokemonData,
            box: undefined,
            slot: undefined,
            isParty: importTarget === 'party',
            startFromLastBox: startFromLastBox && importTarget === 'box', // Only applies to box imports
            filename: filename // Send filename for correct species parsing
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
        
        // Get filename from Content-Disposition header, or use default
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'save_modified.sav';
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (filenameMatch) {
                filename = filenameMatch[1];
            }
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        console.log('Save file exported as:', filename);
    } catch (error) {
        alert(`Error exporting save file: ${error.message}`);
        console.error('Error:', error);
    }
}

// Load database list from server
let allDatabases = []; // Store all databases for folder management

// Update scan target database dropdown (defined early so it can be called from loadDatabases)
function updateScanTargetDb() {
    const scanTargetDb = document.getElementById('scanTargetDb');
    if (!scanTargetDb) return;
    
    // Preserve the current selection before clearing
    const currentValue = scanTargetDb.value;
    
    scanTargetDb.innerHTML = '<option value="">Select a database...</option>';
    allDatabases.forEach(db => {
        const option = document.createElement('option');
        option.value = db.id;
        option.textContent = `${db.name} (${db.fileCount || 0} files)`;
        scanTargetDb.appendChild(option);
    });
    
    // Restore the previous selection if it still exists
    if (currentValue && allDatabases.some(db => db.id === currentValue)) {
        scanTargetDb.value = currentValue;
    }
}

async function loadDatabases() {
    try {
        const response = await fetch('/api/databases');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const databases = await response.json();
        allDatabases = databases; // Store for folder management
        
        // Update database select dropdown
        if (databaseSelect) {
            databaseSelect.innerHTML = '';
            databases.forEach(db => {
                const option = document.createElement('option');
                option.value = db.id;
                option.textContent = `${db.name} (${db.fileCount || db.count || 0} files)`;
                databaseSelect.appendChild(option);
            });
            
            // If currentDatabase is not in the list, set it to the first available database
            const currentDbExists = databases.some(db => db.id === currentDatabase);
            if (!currentDbExists && databases.length > 0) {
                console.log(`[Frontend] currentDatabase "${currentDatabase}" not found, setting to first database: ${databases[0].id}`);
                currentDatabase = databases[0].id;
                localStorage.setItem('selectedDatabase', currentDatabase);
                databaseSelect.value = currentDatabase;
            } else if (!currentDatabase && databases.length > 0) {
                console.log(`[Frontend] No currentDatabase set, setting to first database: ${databases[0].id}`);
                currentDatabase = databases[0].id;
                localStorage.setItem('selectedDatabase', currentDatabase);
                databaseSelect.value = currentDatabase;
            }
            
            console.log(`[Frontend] Database selection: ${currentDatabase}, available: ${databases.map(d => d.id).join(', ')}`);
        }
        
        // Update folder list in modal if it's open
        if (folderList) {
            displayFolderList();
        }
        
        // Update scan target DB dropdown if advanced options modal is open
        const advancedOptionsModal = document.getElementById('advancedOptionsModal');
        if (advancedOptionsModal && !advancedOptionsModal.classList.contains('hidden')) {
            updateScanTargetDb();
        }
    } catch (err) {
        console.error('Error loading databases:', err);
    }
}

// Folder Management
const manageFoldersBtn = document.getElementById('manageFoldersBtn');
const folderManagementModal = document.getElementById('folderManagementModal');
const closeFolderManagement = document.getElementById('closeFolderManagement');
const folderList = document.getElementById('folderList');
const newFolderName = document.getElementById('newFolderName');
const newFolderPath = document.getElementById('newFolderPath');
const addFolderBtn = document.getElementById('addFolderBtn');

// Open folder management modal
if (manageFoldersBtn) {
    manageFoldersBtn.addEventListener('click', () => {
        folderManagementModal.classList.remove('hidden');
        displayFolderList();
    });
}

// Close folder management modal
if (closeFolderManagement) {
    closeFolderManagement.addEventListener('click', () => {
        folderManagementModal.classList.add('hidden');
    });
}

// Close modal when clicking outside
if (folderManagementModal) {
    folderManagementModal.addEventListener('click', (e) => {
        if (e.target === folderManagementModal) {
            folderManagementModal.classList.add('hidden');
        }
    });
}

// Display folder list
function displayFolderList() {
    if (!folderList) return;
    
    folderList.innerHTML = '';
    
    if (allDatabases.length === 0) {
        folderList.innerHTML = '<p>No folders configured</p>';
        return;
    }
    
    allDatabases.forEach((db, index) => {
        const folderItem = document.createElement('div');
        folderItem.className = 'folder-item';
        folderItem.dataset.folderId = db.id;
        
        const folderInfo = document.createElement('div');
        folderInfo.className = 'folder-info';
        
        const folderNameContainer = document.createElement('div');
        folderNameContainer.className = 'folder-name-container';
        
        const folderName = document.createElement('div');
        folderName.className = 'folder-name';
        folderName.textContent = db.name;
        folderName.dataset.folderId = db.id;
        
        const folderNameInput = document.createElement('input');
        folderNameInput.type = 'text';
        folderNameInput.className = 'folder-name-input hidden';
        folderNameInput.value = db.name;
        folderNameInput.dataset.folderId = db.id;
        
        folderNameContainer.appendChild(folderName);
        folderNameContainer.appendChild(folderNameInput);
        
        const folderPathContainer = document.createElement('div');
        folderPathContainer.className = 'folder-path-container';
        
        const folderPath = document.createElement('div');
        folderPath.className = 'folder-path';
        folderPath.textContent = db.path;
        folderPath.dataset.folderId = db.id;
        
        const folderPathInput = document.createElement('input');
        folderPathInput.type = 'text';
        folderPathInput.className = 'folder-path-input hidden';
        folderPathInput.value = db.path;
        folderPathInput.dataset.folderId = db.id;
        folderPathInput.placeholder = 'Enter folder path';
        
        folderPathContainer.appendChild(folderPath);
        folderPathContainer.appendChild(folderPathInput);
        
        const folderStats = document.createElement('div');
        folderStats.className = 'folder-stats';
        folderStats.textContent = `${db.fileCount || 0} .pk3 files`;
        
        folderInfo.appendChild(folderNameContainer);
        folderInfo.appendChild(folderPathContainer);
        folderInfo.appendChild(folderStats);
        
        const folderActions = document.createElement('div');
        folderActions.className = 'folder-actions';
        
        // Reorder buttons
        const reorderContainer = document.createElement('div');
        reorderContainer.className = 'reorder-buttons';
        
        const moveUpBtn = document.createElement('button');
        moveUpBtn.className = 'btn btn-secondary btn-small btn-icon';
        moveUpBtn.innerHTML = '↑';
        moveUpBtn.title = 'Move up';
        moveUpBtn.disabled = index === 0;
        moveUpBtn.addEventListener('click', () => moveFolder(db.id, 'up'));
        reorderContainer.appendChild(moveUpBtn);
        
        const moveDownBtn = document.createElement('button');
        moveDownBtn.className = 'btn btn-secondary btn-small btn-icon';
        moveDownBtn.innerHTML = '↓';
        moveDownBtn.title = 'Move down';
        moveDownBtn.disabled = index === allDatabases.length - 1;
        moveDownBtn.addEventListener('click', () => moveFolder(db.id, 'down'));
        reorderContainer.appendChild(moveDownBtn);
        
        folderActions.appendChild(reorderContainer);
        
        // Edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-secondary btn-small';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => editFolder(db.id));
        folderActions.appendChild(editBtn);
        
        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-danger btn-small';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => removeFolder(db.id, db.name));
        folderActions.appendChild(removeBtn);
        
        folderItem.appendChild(folderInfo);
        folderItem.appendChild(folderActions);
        folderList.appendChild(folderItem);
    });
}

// Edit folder name and path
function editFolder(folderId) {
    const folderName = document.querySelector(`.folder-name[data-folder-id="${folderId}"]`);
    const folderNameInput = document.querySelector(`.folder-name-input[data-folder-id="${folderId}"]`);
    const folderPath = document.querySelector(`.folder-path[data-folder-id="${folderId}"]`);
    const folderPathInput = document.querySelector(`.folder-path-input[data-folder-id="${folderId}"]`);
    
    if (!folderName || !folderNameInput || !folderPath || !folderPathInput) return;
    
    // Show inputs, hide display elements
    folderName.classList.add('hidden');
    folderNameInput.classList.remove('hidden');
    folderPath.classList.add('hidden');
    folderPathInput.classList.remove('hidden');
    folderNameInput.focus();
    folderNameInput.select();
    
    // Save on Enter or blur (when both inputs lose focus)
    let saveTimeout;
    const saveEdit = async () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            const newName = folderNameInput.value.trim();
            const newPath = folderPathInput.value.trim();
            const originalName = folderName.textContent.trim();
            const originalPath = folderPath.textContent.trim();
            
            // Check if anything changed
            const nameChanged = newName !== originalName;
            const pathChanged = newPath !== originalPath;
            
            if (nameChanged || pathChanged) {
                try {
                    const updateData = {};
                    if (nameChanged) {
                        updateData.name = newName;
                    }
                    if (pathChanged) {
                        updateData.folderPath = newPath;
                    }
                    
                    console.log(`[Frontend] Updating folder ${folderId}:`, updateData);
                    
                    const response = await fetch(`/api/databases/${folderId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(updateData)
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    const result = await response.json();
                    console.log(`[Frontend] Update result:`, result);
                    
                    // Reload databases to update the list
                    await loadDatabases();
                } catch (error) {
                    console.error('Error updating folder:', error);
                    alert(`Failed to update folder: ${error.message}`);
                    // Reset input values to original
                    folderNameInput.value = originalName;
                    folderPathInput.value = originalPath;
                }
            } else {
                // No changes, just reset input values
                folderNameInput.value = originalName;
                folderPathInput.value = originalPath;
            }
            
            // Hide inputs, show display elements
            folderNameInput.classList.add('hidden');
            folderName.classList.remove('hidden');
            folderPathInput.classList.add('hidden');
            folderPath.classList.remove('hidden');
        }, 200); // Small delay to allow blur events to complete
    };
    
    // Cancel on Escape
    const cancelEdit = () => {
        clearTimeout(saveTimeout);
        folderNameInput.value = folderName.textContent;
        folderPathInput.value = folderPath.textContent;
        folderNameInput.classList.add('hidden');
        folderName.classList.remove('hidden');
        folderPathInput.classList.add('hidden');
        folderPath.classList.remove('hidden');
    };
    
    // Handle blur events - save when both inputs lose focus
    let blurTimeout;
    const handleBlur = () => {
        clearTimeout(blurTimeout);
        blurTimeout = setTimeout(() => {
            // Check if neither input is focused
            if (document.activeElement !== folderNameInput && document.activeElement !== folderPathInput) {
                saveEdit();
            }
        }, 100);
    };
    
    folderNameInput.addEventListener('blur', handleBlur, { once: true });
    folderPathInput.addEventListener('blur', handleBlur, { once: true });
    
    // Handle Enter key - save
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    };
    
    folderNameInput.addEventListener('keydown', handleKeyDown, { once: true });
    folderPathInput.addEventListener('keydown', handleKeyDown, { once: true });
}

// Move folder up or down
async function moveFolder(folderId, direction) {
    const currentIndex = allDatabases.findIndex(db => db.id === folderId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= allDatabases.length) return;
    
    // Swap in local array
    [allDatabases[currentIndex], allDatabases[newIndex]] = 
        [allDatabases[newIndex], allDatabases[currentIndex]];
    
    // Update server
    try {
        const folderIds = allDatabases.map(db => db.id);
        const response = await fetch('/api/databases/reorder', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ folderIds: folderIds })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to reorder folders');
        }
        
        // Reload databases to update the list
        await loadDatabases();
    } catch (error) {
        console.error('Error reordering folders:', error);
        alert(`Failed to reorder folders: ${error.message}`);
        // Reload to reset
        await loadDatabases();
    }
}

// Add new folder
if (addFolderBtn) {
    addFolderBtn.addEventListener('click', async () => {
        const name = newFolderName.value.trim();
        const folderPath = newFolderPath.value.trim();
        
        if (!name || !folderPath) {
            alert('Please enter both folder name and path');
            return;
        }
        
        try {
            const response = await fetch('/api/databases', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    folderPath: folderPath
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to add folder');
            }
            
            // Clear form
            newFolderName.value = '';
            newFolderPath.value = '';
            
            // Reload databases
            await loadDatabases();
            
            alert('Folder added successfully!');
        } catch (error) {
            console.error('Error adding folder:', error);
            alert(`Failed to add folder: ${error.message}`);
        }
    });
}

// Remove folder
async function removeFolder(folderId, folderName) {
    if (!confirm(`Are you sure you want to remove "${folderName}"?\n\nNote: The folder must be empty to be removed.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/databases/${folderId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to remove folder');
        }
        
        // Reload databases
        await loadDatabases();
        
        alert('Folder removed successfully!');
    } catch (error) {
        console.error('Error removing folder:', error);
        alert(`Failed to remove folder: ${error.message}`);
    }
}

// Advanced Options Modal
const advancedOptionsBtn = document.getElementById('advancedOptionsBtn');
const advancedOptionsModal = document.getElementById('advancedOptionsModal');
const closeAdvancedOptions = document.getElementById('closeAdvancedOptions');
const scanSourceFolder = document.getElementById('scanSourceFolder');
const scanTargetDb = document.getElementById('scanTargetDb');
const scanAndMoveBtn = document.getElementById('scanAndMoveBtn');
const scanResults = document.getElementById('scanResults');
const enableAutoScan = document.getElementById('enableAutoScan');
const scanIntervalGroup = document.getElementById('scanIntervalGroup');
const scanInterval = document.getElementById('scanInterval');
const stopAutoScanBtn = document.getElementById('stopAutoScanBtn');
const scanStatus = document.getElementById('scanStatus');
const saveScannerConfigBtn = document.getElementById('saveScannerConfigBtn');

// Auto-scan state
let autoScanInterval = null;
let isAutoScanning = false;

// Scanner configuration storage key
const SCANNER_CONFIG_KEY = 'folderScannerConfig';

// Save scanner configuration (server-side)
async function saveScannerConfig() {
    const sourceFolderEl = document.getElementById('scanSourceFolder');
    const targetDbEl = document.getElementById('scanTargetDb');
    const autoScanEl = document.getElementById('enableAutoScan');
    const intervalEl = document.getElementById('scanInterval');
    
    const config = {
        sourceFolder: sourceFolderEl ? sourceFolderEl.value.trim() : '',
        targetDbId: targetDbEl ? targetDbEl.value : '',
        enableAutoScan: autoScanEl ? autoScanEl.checked : false,
        scanInterval: intervalEl ? parseInt(intervalEl.value) || 5 : 5
    };
    
    // Only save if targetDbId is not empty
    if (!config.targetDbId) {
        alert('Please select a target database before saving');
        return;
    }
    
    try {
        const response = await fetch('/api/scanner/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        if (response.ok) {
            alert('Scanner configuration saved! Auto-scan will run on the server.');
        } else {
            const error = await response.json();
            alert(`Failed to save configuration: ${error.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error saving scanner config:', error);
        alert('Failed to save configuration. Please try again.');
    }
}

// Load scanner configuration (server-side)
async function loadScannerConfig() {
    try {
        const response = await fetch('/api/scanner/config');
        if (!response.ok) {
            console.error('Failed to load scanner config from server');
            return;
        }
        
        const config = await response.json();
        
        const sourceFolderEl = document.getElementById('scanSourceFolder');
        const targetDbEl = document.getElementById('scanTargetDb');
        const autoScanEl = document.getElementById('enableAutoScan');
        const intervalEl = document.getElementById('scanInterval');
        const scanIntervalGroup = document.getElementById('scanIntervalGroup');
        
        if (sourceFolderEl && config.sourceFolder) {
            sourceFolderEl.value = config.sourceFolder;
        }
        
        if (targetDbEl && config.targetDbId) {
            // Ensure the target database still exists before setting the value
            const targetDbExists = Array.from(targetDbEl.options).some(opt => opt.value === config.targetDbId);
            if (targetDbExists) {
                targetDbEl.value = config.targetDbId;
            }
        }
        
        if (autoScanEl) {
            autoScanEl.checked = config.enableAutoScan || false;
            if (autoScanEl.checked && scanIntervalGroup) {
                scanIntervalGroup.style.display = 'block';
            }
        }
        
        if (intervalEl && config.scanInterval) {
            intervalEl.value = config.scanInterval;
        }
    } catch (error) {
        console.error('Error loading scanner config:', error);
    }
}

// Start auto-scan if it was enabled in saved configuration
async function startAutoScanIfEnabled() {
    try {
        const saved = localStorage.getItem(SCANNER_CONFIG_KEY);
        if (!saved) return;
        
        const config = JSON.parse(saved);
        
        // Only start if auto-scan was enabled
        if (!config.enableAutoScan) return;
        
        // Check if source and target are configured
        if (!config.sourceFolder || !config.targetDbId) return;
        
        const sourceFolderEl = document.getElementById('scanSourceFolder');
        const targetDbEl = document.getElementById('scanTargetDb');
        const autoScanEl = document.getElementById('enableAutoScan');
        const intervalEl = document.getElementById('scanInterval');
        
        if (!sourceFolderEl || !targetDbEl || !autoScanEl || !intervalEl) {
            // Elements not ready yet, try again after a short delay
            setTimeout(startAutoScanIfEnabled, 500);
            return;
        }
        
        // Ensure values are set
        sourceFolderEl.value = config.sourceFolder;
        targetDbEl.value = config.targetDbId;
        autoScanEl.checked = true;
        intervalEl.value = config.scanInterval || 5;
        
        const intervalMinutes = parseInt(intervalEl.value) || 5;
        
        if (intervalMinutes < 1) {
            return;
        }
        
        // Stop any existing interval first
        if (autoScanInterval) {
            clearInterval(autoScanInterval);
            autoScanInterval = null;
        }
        
        // Start auto-scan
        isAutoScanning = true;
        const stopAutoScanBtn = document.getElementById('stopAutoScanBtn');
        const scanStatus = document.getElementById('scanStatus');
        const scanIntervalGroup = document.getElementById('scanIntervalGroup');
        
        if (stopAutoScanBtn) {
            stopAutoScanBtn.style.display = 'inline-block';
        }
        if (scanStatus) {
            scanStatus.innerHTML = `<div class="scan-result-success"><p>Auto-scanning every ${intervalMinutes} minute(s)...</p></div>`;
            scanStatus.classList.remove('hidden');
        }
        if (scanIntervalGroup) {
            scanIntervalGroup.style.display = 'block';
        }
        
        // Perform initial scan
        await performScanAndMove();
        
        // Set up interval
        const intervalMs = intervalMinutes * 60 * 1000;
        autoScanInterval = setInterval(async () => {
            await performScanAndMove();
        }, intervalMs);
    } catch (error) {
        console.error('Error starting auto-scan:', error);
    }
}

// Save scanner configuration button
if (saveScannerConfigBtn) {
    saveScannerConfigBtn.addEventListener('click', async () => {
        saveScannerConfig();
        
        // Check if auto-scan should be started
        const autoScanEl = document.getElementById('enableAutoScan');
        const intervalEl = document.getElementById('scanInterval');
        const sourceFolderEl = document.getElementById('scanSourceFolder');
        const targetDbEl = document.getElementById('scanTargetDb');
        
        if (autoScanEl && autoScanEl.checked && intervalEl) {
            const source = sourceFolderEl ? sourceFolderEl.value.trim() : '';
            const targetId = targetDbEl ? targetDbEl.value : '';
            
            // Only start auto-scan if source and target are configured
            if (source && targetId) {
                const intervalMinutes = intervalEl.value ? parseInt(intervalEl.value) : 5;
                
                if (intervalMinutes < 1) {
                    alert('Scan interval must be at least 1 minute');
                    return;
                }
                
                // Auto-scan now runs on the server, so just update UI
                isAutoScanning = true;
                const stopAutoScanBtn = document.getElementById('stopAutoScanBtn');
                const scanStatus = document.getElementById('scanStatus');
                
                if (stopAutoScanBtn) {
                    stopAutoScanBtn.style.display = 'inline-block';
                }
                if (scanStatus) {
                    scanStatus.innerHTML = `<div class="scan-result-success"><p>Auto-scanning on server every ${intervalMinutes} minute(s)...</p></div>`;
                    scanStatus.classList.remove('hidden');
                }
            }
        } else {
            // If auto-scan is disabled, stop any running scan
            if (autoScanInterval) {
                clearInterval(autoScanInterval);
                autoScanInterval = null;
                isAutoScanning = false;
                
                const stopAutoScanBtn = document.getElementById('stopAutoScanBtn');
                const scanStatus = document.getElementById('scanStatus');
                
                if (stopAutoScanBtn) {
                    stopAutoScanBtn.style.display = 'none';
                }
                if (scanStatus) {
                    scanStatus.classList.add('hidden');
                }
            }
        }
    });
}

// Theme management
const THEME_CONFIG_KEY = 'themeConfig';
let ivSumStyle = 'gradient'; // 'gradient' or 'accent'

function loadThemeConfig() {
    try {
        const saved = localStorage.getItem(THEME_CONFIG_KEY);
        let config;
        
        if (saved) {
            config = JSON.parse(saved);
        } else {
            // Default to dark grey if no config exists
            config = {
                accentColor: '#667eea',
                darkMode: 'grey',
                ivSumStyle: 'gradient'
            };
        }
        
        // Apply accent color
        if (config.accentColor) {
            document.documentElement.style.setProperty('--accent-color', config.accentColor);
            // Calculate hover color (lighter version)
            const hoverColor = adjustColorBrightness(config.accentColor, 15);
            document.documentElement.style.setProperty('--accent-hover', hoverColor);
        }
        
        // Apply dark mode (map values to CSS theme attributes)
        if (config.darkMode) {
            if (config.darkMode === 'light') {
                document.documentElement.removeAttribute('data-theme');
            } else if (config.darkMode === 'grey') {
                document.documentElement.setAttribute('data-theme', 'dark-grey');
            } else if (config.darkMode === 'black') {
                document.documentElement.setAttribute('data-theme', 'dark-black');
            }
        } else {
            // Default to dark grey
            document.documentElement.setAttribute('data-theme', 'dark-grey');
        }
        
        // Apply IV sum style
        if (config.ivSumStyle) {
            ivSumStyle = config.ivSumStyle;
        }
        updateIVSumGradients();
        
        // Update UI elements
        const accentColorPicker = document.getElementById('accentColorPicker');
        const accentColorText = document.getElementById('accentColorText');
        const darkModeRadios = document.querySelectorAll('input[name="darkMode"]');
        const ivSumStyleRadios = document.querySelectorAll('input[name="ivSumStyle"]');
        
        if (accentColorPicker && config.accentColor) {
            accentColorPicker.value = config.accentColor;
        }
        if (accentColorText && config.accentColor) {
            accentColorText.value = config.accentColor;
        }
        if (darkModeRadios && config.darkMode) {
            darkModeRadios.forEach(radio => {
                radio.checked = radio.value === config.darkMode;
            });
        }
        if (ivSumStyleRadios && config.ivSumStyle) {
            ivSumStyleRadios.forEach(radio => {
                radio.checked = radio.value === config.ivSumStyle;
            });
        }
        
        // Update theme icon after loading config
        const loadedTheme = config.darkMode || 'grey';
        updateThemeIcon(loadedTheme);
    } catch (error) {
        console.error('Error loading theme config:', error);
        // On error, default to dark grey
        document.documentElement.setAttribute('data-theme', 'dark-grey');
        updateThemeIcon('grey');
    }
}

function saveThemeConfig() {
    const accentColorPicker = document.getElementById('accentColorPicker');
    const darkModeRadios = document.querySelectorAll('input[name="darkMode"]:checked');
    const ivSumStyleRadios = document.querySelectorAll('input[name="ivSumStyle"]:checked');
    
    const config = {
        accentColor: accentColorPicker ? accentColorPicker.value : '#667eea',
        darkMode: darkModeRadios.length > 0 ? darkModeRadios[0].value : 'grey', // Default to grey
        ivSumStyle: ivSumStyleRadios.length > 0 ? ivSumStyleRadios[0].value : 'gradient'
    };
    
    localStorage.setItem(THEME_CONFIG_KEY, JSON.stringify(config));
}

function adjustColorBrightness(hex, percent) {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Adjust brightness
    const newR = Math.min(255, Math.max(0, r + (r * percent / 100)));
    const newG = Math.min(255, Math.max(0, g + (g * percent / 100)));
    const newB = Math.min(255, Math.max(0, b + (b * percent / 100)));
    
    // Convert back to hex
    return '#' + [newR, newG, newB].map(x => {
        const hex = Math.round(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

function getIVSumGradientColor(ivSum) {
    // Range: 0-186
    // 0 = red (#ff4444 = rgb(255, 68, 68)), 186 = green (#44ff44 = rgb(68, 255, 68))
    const normalized = Math.max(0, Math.min(186, ivSum)) / 186;
    
    // Interpolate between red and green
    const r = Math.round(255 - (255 - 68) * normalized); // Red: 255 -> 68
    const g = Math.round(68 + (255 - 68) * normalized); // Green: 68 -> 255
    const b = Math.round(68); // Blue stays at 68
    
    return `rgb(${r}, ${g}, ${b})`;
}

function updateIVSumGradients() {
    const ivSumElements = document.querySelectorAll('.iv-sum, .compact-iv-sum');
    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim();
    
    ivSumElements.forEach(el => {
        if (ivSumStyle === 'accent') {
            // Use accent color
            const hoverColor = adjustColorBrightness(accentColor, -10);
            el.style.background = `linear-gradient(135deg, ${accentColor} 0%, ${hoverColor} 100%)`;
            el.style.backgroundImage = 'none';
        } else {
            // Use dynamic gradient (red to green based on IV sum)
            let ivSum = parseInt(el.getAttribute('data-iv-sum'));
            
            if (isNaN(ivSum)) {
                const text = el.textContent || '';
                const match = text.match(/IV Sum:\s*(\d+)/);
                if (match) {
                    ivSum = parseInt(match[1]);
                }
            }
            
            if (!isNaN(ivSum)) {
                // Simple: red (0) to green (186)
                const normalized = Math.max(0, Math.min(186, ivSum)) / 186;
                const r = Math.round(255 - (255 - 68) * normalized); // 255 -> 68
                const g = Math.round(68 + (255 - 68) * normalized); // 68 -> 255
                const b = 68;
                const color = `rgb(${r}, ${g}, ${b})`;
                
                // Set background color directly
                el.style.background = color;
                el.style.backgroundImage = 'none';
            }
        }
    });
}

// Initialize theme on page load
loadThemeConfig();

// Update theme icon after theme loads
setTimeout(() => {
    const currentTheme = getCurrentTheme();
    updateThemeIcon(currentTheme);
}, 50);

// Apply IV sum gradients after theme loads
setTimeout(() => {
    updateIVSumGradients();
}, 100);

// Theme option event listeners
const accentColorPicker = document.getElementById('accentColorPicker');
const accentColorText = document.getElementById('accentColorText');
const darkModeRadios = document.querySelectorAll('input[name="darkMode"]');
const ivSumStyleRadios = document.querySelectorAll('input[name="ivSumStyle"]');

if (accentColorPicker) {
    accentColorPicker.addEventListener('input', (e) => {
        const color = e.target.value;
        if (accentColorText) {
            accentColorText.value = color;
        }
        document.documentElement.style.setProperty('--accent-color', color);
        const hoverColor = adjustColorBrightness(color, 15);
        document.documentElement.style.setProperty('--accent-hover', hoverColor);
        // Update IV sum bars if using accent color style
        if (ivSumStyle === 'accent') {
            updateIVSumGradients();
        }
        saveThemeConfig();
    });
}

if (accentColorText) {
    accentColorText.addEventListener('input', (e) => {
        const color = e.target.value;
        if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
            if (accentColorPicker) {
                accentColorPicker.value = color;
            }
            document.documentElement.style.setProperty('--accent-color', color);
            const hoverColor = adjustColorBrightness(color, 15);
            document.documentElement.style.setProperty('--accent-hover', hoverColor);
            // Update IV sum bars if using accent color style
            if (ivSumStyle === 'accent') {
                updateIVSumGradients();
            }
            saveThemeConfig();
        }
    });
}

if (darkModeRadios.length > 0) {
    darkModeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                const theme = e.target.value;
                if (theme === 'light') {
                    document.documentElement.removeAttribute('data-theme');
                } else if (theme === 'grey') {
                    document.documentElement.setAttribute('data-theme', 'dark-grey');
                } else if (theme === 'black') {
                    document.documentElement.setAttribute('data-theme', 'dark-black');
                }
                saveThemeConfig();
            }
        });
    });
}

// IV sum style radio buttons
if (ivSumStyleRadios.length > 0) {
    ivSumStyleRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                ivSumStyle = e.target.value;
                updateIVSumGradients();
                saveThemeConfig();
            }
        });
    });
}

// Open advanced options modal
if (advancedOptionsBtn) {
    advancedOptionsBtn.addEventListener('click', () => {
        advancedOptionsModal.classList.remove('hidden');
        // Populate target database dropdown first
        updateScanTargetDb();
        // Load saved configuration after dropdown is populated
        // Use setTimeout to ensure dropdown is fully updated
        setTimeout(() => {
            loadScannerConfig();
        }, 0);
        // Re-initialize scan button to ensure it's set up
        initializeScanButton();
    });
}

// Close advanced options modal
if (closeAdvancedOptions) {
    closeAdvancedOptions.addEventListener('click', () => {
        advancedOptionsModal.classList.add('hidden');
    });
}

// Safari Zone Ball Fixer
const findSafariPokemonBtn = document.getElementById('findSafariPokemonBtn');
const safariPokemonList = document.getElementById('safariPokemonList');
const safariFixerActions = document.getElementById('safariFixerActions');
const safariSelectedCount = document.getElementById('safariSelectedCount');
const replaceSafariBallBtn = document.getElementById('replaceSafariBallBtn');
const selectAllSafariBtn = document.getElementById('selectAllSafariBtn');
const deselectAllSafariBtn = document.getElementById('deselectAllSafariBtn');
const safariSelectedPokemon = new Set();

// Safari Zone location IDs and names
const safariZoneLocations = {
    // Gen 3
    57: true,   // RSE Safari Zone
    136: true,  // FRLG Safari Zone
    // Gen 4
    52: true,   // DPPt Great Marsh (MarshLocation_DPPt)
    202: true,  // HGSS Safari Zone (SafariLocation_HGSS)
    228: true,  // HGSS Safari Zone Gate (also Safari Zone)
    // Note: Location names may vary, so we also check by name
};

function isSafariZoneLocation(locationName, locationID) {
    // Check by location ID first (most reliable)
    if (locationID && safariZoneLocations[locationID]) {
        return true;
    }
    
    // Check by name (case insensitive, more flexible)
    if (locationName && locationName !== 'None') {
        const lowerName = locationName.toLowerCase();
        return lowerName.includes('safari') || 
               lowerName.includes('great marsh') ||
               lowerName.includes('marsh');
    }
    
    return false;
}

async function findSafariPokemon() {
    if (!pokemonData || pokemonData.length === 0) {
        alert('No Pokemon loaded. Please refresh your database first.');
        return;
    }
    
    safariSelectedPokemon.clear();
    safariPokemonList.innerHTML = '<p>Searching...</p>';
    safariPokemonList.classList.remove('hidden');
    safariFixerActions.classList.add('hidden');
    
    // Debug: Log all Pokemon with Safari-related locations
    console.log('Finding Safari Zone Pokemon...');
    const allSafariCandidates = pokemonData.filter(p => {
        if (p.error) return false;
        const isSafari = isSafariZoneLocation(p.metLocationName, p.metLocation);
        return isSafari;
    });
    console.log(`Found ${allSafariCandidates.length} Pokemon in Safari Zone locations`);
    if (allSafariCandidates.length > 0) {
        allSafariCandidates.slice(0, 10).forEach(p => {
            const ballDisplay = p.ballName || (typeof p.ball === 'string' ? p.ball : `Ball ${p.ball}`);
            const ballIdDisplay = typeof p.ball === 'number' ? p.ball : (p.ballId || 'N/A');
            console.log(`  - ${p.speciesName}: Location "${p.metLocationName}" (ID: ${p.metLocation}), Ball: "${ballDisplay}" (ID: ${ballIdDisplay})`);
        });
    }
    
    const safariPokemon = pokemonData.filter(p => {
        if (p.error) return false;
        
        // Check if caught in Safari Zone
        const isSafari = isSafariZoneLocation(p.metLocationName, p.metLocation);
        if (!isSafari) return false;
        
        // Check if ball is NOT Safari Ball (ID 5)
        // Get ball ID (preferred) or ball name
        const ballId = p.ballId || (typeof p.ball === 'number' ? p.ball : 0);
        const ballName = (p.ballName || (typeof p.ball === 'string' ? p.ball : '')).toLowerCase().trim();
        
        // Safari Ball is ID 5, or name variations of "Safari Ball"
        const isSafariBall = ballId === 5 || 
                            ballName === 'safari ball' || 
                            ballName === 'safariball' ||
                            (ballName.length > 0 && ballName.includes('safari'));
        
        // Return Pokemon that are NOT in Safari Ball
        return !isSafariBall;
    });
    
    console.log(`Found ${safariPokemon.length} Safari Zone Pokemon without Safari Ball`);
    
    if (safariPokemon.length === 0) {
        safariPokemonList.innerHTML = '<p class="no-data">No Pokemon found caught in Safari Zone without Safari Ball.</p>';
        return;
    }
    
    let html = `<h4>Found ${safariPokemon.length} Pokemon:</h4>`;
    html += '<div class="safari-pokemon-grid">';
    
    safariPokemon.forEach(p => {
        const speciesName = p.speciesName || `#${p.species}`;
        const locationName = p.metLocationName || `Location ${p.metLocation}`;
        html += `
            <div class="safari-pokemon-item">
                <label>
                    <input type="checkbox" class="safari-pokemon-checkbox" data-filename="${p.filename}">
                    <div class="safari-pokemon-info">
                        <strong>${speciesName}</strong>
                        <div class="safari-pokemon-details">
                            <span>Location: ${locationName}</span>
                            <span>Current Ball: ${p.ballName || 'Unknown'}</span>
                            <span>File: ${p.filename}</span>
                        </div>
                    </div>
                </label>
            </div>
        `;
    });
    
    html += '</div>';
    safariPokemonList.innerHTML = html;
    safariFixerActions.classList.remove('hidden');
    
    // Add checkbox listeners
    document.querySelectorAll('.safari-pokemon-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const filename = e.target.dataset.filename;
            if (e.target.checked) {
                safariSelectedPokemon.add(filename);
            } else {
                safariSelectedPokemon.delete(filename);
            }
            updateSafariSelectionUI();
        });
    });
    
    updateSafariSelectionUI();
}

function selectAllSafariPokemon() {
    document.querySelectorAll('.safari-pokemon-checkbox').forEach(checkbox => {
        checkbox.checked = true;
        const filename = checkbox.dataset.filename;
        safariSelectedPokemon.add(filename);
    });
    updateSafariSelectionUI();
}

function deselectAllSafariPokemon() {
    document.querySelectorAll('.safari-pokemon-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    safariSelectedPokemon.clear();
    updateSafariSelectionUI();
}

if (selectAllSafariBtn) {
    selectAllSafariBtn.addEventListener('click', selectAllSafariPokemon);
}

if (deselectAllSafariBtn) {
    deselectAllSafariBtn.addEventListener('click', deselectAllSafariPokemon);
}

function updateSafariSelectionUI() {
    const count = safariSelectedPokemon.size;
    safariSelectedCount.textContent = `${count} Pokemon selected`;
    replaceSafariBallBtn.disabled = count === 0;
}

async function replaceSafariBalls() {
    if (safariSelectedPokemon.size === 0) {
        alert('No Pokemon selected');
        return;
    }
    
    if (!confirm(`Replace Pokeball with Safari Ball for ${safariSelectedPokemon.size} Pokemon?`)) {
        return;
    }
    
    replaceSafariBallBtn.disabled = true;
    replaceSafariBallBtn.textContent = 'Replacing...';
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const filename of safariSelectedPokemon) {
        try {
            const response = await fetch(`/api/pokemon/update-ball`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filename: filename,
                    db: currentDatabase,
                    newBall: 5 // Safari Ball ID
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update ball');
            }
            
            successCount++;
        } catch (error) {
            errorCount++;
            console.error(`Error updating ${filename}:`, error);
        }
    }
    
    replaceSafariBallBtn.disabled = false;
    replaceSafariBallBtn.textContent = 'Replace with Safari Ball';
    
    alert(`Ball replacement complete: ${successCount} successful, ${errorCount} failed`);
    
    // Refresh Pokemon data
    if (successCount > 0) {
        await loadPokemon();
        safariSelectedPokemon.clear();
        safariPokemonList.classList.add('hidden');
        safariFixerActions.classList.add('hidden');
    }
}

if (findSafariPokemonBtn) {
    findSafariPokemonBtn.addEventListener('click', findSafariPokemon);
}

if (replaceSafariBallBtn) {
    replaceSafariBallBtn.addEventListener('click', replaceSafariBalls);
}

// Invalid Moves Fixer
const findInvalidMovesBtn = document.getElementById('findInvalidMovesBtn');
const invalidMovesList = document.getElementById('invalidMovesList');
const invalidMovesActions = document.getElementById('invalidMovesActions');
const invalidMovesSelectedCount = document.getElementById('invalidMovesSelectedCount');
const fixInvalidMovesBtn = document.getElementById('fixInvalidMovesBtn');
const selectAllInvalidMovesBtn = document.getElementById('selectAllInvalidMovesBtn');
const deselectAllInvalidMovesBtn = document.getElementById('deselectAllInvalidMovesBtn');
const invalidMovesSelectedPokemon = new Set();

// Check if a move is valid for Gen 3 (0 = empty, 1-354 = valid moves)
function isValidMove(move) {
    return move === 0 || (move >= 1 && move <= 354);
}

// Check if Pokemon has invalid moves
function hasInvalidMoves(pokemon) {
    // Moves are stored directly on the Pokemon object as move1, move2, move3, move4
    const move1 = pokemon.move1 || 0;
    const move2 = pokemon.move2 || 0;
    const move3 = pokemon.move3 || 0;
    const move4 = pokemon.move4 || 0;
    
    return !isValidMove(move1) || 
           !isValidMove(move2) || 
           !isValidMove(move3) || 
           !isValidMove(move4);
}

async function findInvalidMovesPokemon() {
    if (!pokemonData || pokemonData.length === 0) {
        alert('No Pokemon loaded. Please refresh your database first.');
        return;
    }
    
    invalidMovesSelectedPokemon.clear();
    invalidMovesList.innerHTML = '<p>Searching...</p>';
    invalidMovesList.classList.remove('hidden');
    invalidMovesActions.classList.add('hidden');
    
    // Find Pokemon with invalid moves
    const invalidMovesPokemon = pokemonData.filter(p => {
        if (p.error) return false;
        return hasInvalidMoves(p);
    });
    
    console.log(`Found ${invalidMovesPokemon.length} Pokemon with invalid moves`);
    
    if (invalidMovesPokemon.length === 0) {
        invalidMovesList.innerHTML = '<p class="no-data">No Pokemon found with invalid moves.</p>';
        return;
    }
    
    let html = '<div class="safari-pokemon-grid">';
    
    invalidMovesPokemon.forEach(p => {
        const speciesName = p.speciesName || `#${p.species}`;
        const move1 = p.move1 || 0;
        const move2 = p.move2 || 0;
        const move3 = p.move3 || 0;
        const move4 = p.move4 || 0;
        const moveStr = `Move1: ${move1}, Move2: ${move2}, Move3: ${move3}, Move4: ${move4}`;
        
        html += `
            <div class="safari-pokemon-item">
                <label>
                    <input type="checkbox" class="invalid-moves-checkbox" data-filename="${p.filename}">
                    <div class="safari-pokemon-info">
                        <strong>${speciesName}</strong>
                        <div class="safari-pokemon-details">
                            <span>${moveStr}</span>
                            <span>File: ${p.filename}</span>
                        </div>
                    </div>
                </label>
            </div>
        `;
    });
    
    html += '</div>';
    invalidMovesList.innerHTML = html;
    invalidMovesActions.classList.remove('hidden');
    
    // Add checkbox listeners
    document.querySelectorAll('.invalid-moves-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const filename = e.target.dataset.filename;
            if (e.target.checked) {
                invalidMovesSelectedPokemon.add(filename);
            } else {
                invalidMovesSelectedPokemon.delete(filename);
            }
            updateInvalidMovesSelectionUI();
        });
    });
    
    updateInvalidMovesSelectionUI();
}

function selectAllInvalidMovesPokemon() {
    document.querySelectorAll('.invalid-moves-checkbox').forEach(checkbox => {
        checkbox.checked = true;
        const filename = checkbox.dataset.filename;
        invalidMovesSelectedPokemon.add(filename);
    });
    updateInvalidMovesSelectionUI();
}

function deselectAllInvalidMovesPokemon() {
    document.querySelectorAll('.invalid-moves-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    invalidMovesSelectedPokemon.clear();
    updateInvalidMovesSelectionUI();
}

function updateInvalidMovesSelectionUI() {
    const count = invalidMovesSelectedPokemon.size;
    invalidMovesSelectedCount.textContent = `${count} selected`;
    fixInvalidMovesBtn.disabled = count === 0;
}

async function fixInvalidMoves() {
    if (invalidMovesSelectedPokemon.size === 0) {
        alert('No Pokemon selected');
        return;
    }
    
    if (!confirm(`Fix invalid moves for ${invalidMovesSelectedPokemon.size} Pokemon? This will set Move1 to Tackle and Move2-4 to empty.`)) {
        return;
    }
    
    fixInvalidMovesBtn.disabled = true;
    fixInvalidMovesBtn.textContent = 'Fixing...';
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const filename of invalidMovesSelectedPokemon) {
        try {
            const response = await fetch(`/api/pokemon/fix-moves`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filename: filename,
                    db: currentDatabase
                })
            });
            
            if (!response.ok) {
                let errorMessage = 'Failed to fix moves';
                try {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const error = await response.json();
                        errorMessage = error.error || errorMessage;
                    } else {
                        const text = await response.text();
                        errorMessage = text || errorMessage;
                    }
                } catch (parseError) {
                    errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }
            
            // Try to parse response as JSON, but don't fail if it's not
            try {
                await response.json();
            } catch (e) {
                // Response might not be JSON, that's okay if status was OK
            }
            
            successCount++;
        } catch (error) {
            errorCount++;
            console.error(`Error fixing moves for ${filename}:`, error);
        }
    }
    
    fixInvalidMovesBtn.disabled = false;
    fixInvalidMovesBtn.textContent = 'Fix Moves (Tackle + Empty)';
    
    alert(`Move fix complete: ${successCount} successful, ${errorCount} failed`);
    
    // Refresh Pokemon data
    if (successCount > 0) {
        await loadPokemon();
        invalidMovesSelectedPokemon.clear();
        invalidMovesList.classList.add('hidden');
        invalidMovesActions.classList.add('hidden');
    }
}

if (findInvalidMovesBtn) {
    findInvalidMovesBtn.addEventListener('click', findInvalidMovesPokemon);
}
if (selectAllInvalidMovesBtn) {
    selectAllInvalidMovesBtn.addEventListener('click', selectAllInvalidMovesPokemon);
}
if (deselectAllInvalidMovesBtn) {
    deselectAllInvalidMovesBtn.addEventListener('click', deselectAllInvalidMovesPokemon);
}
if (fixInvalidMovesBtn) {
    fixInvalidMovesBtn.addEventListener('click', fixInvalidMoves);
}

// Close modal when clicking outside
if (advancedOptionsModal) {
    advancedOptionsModal.addEventListener('click', (e) => {
        if (e.target === advancedOptionsModal) {
            advancedOptionsModal.classList.add('hidden');
        }
    });
}


// Toggle auto-scan checkbox
if (enableAutoScan) {
    enableAutoScan.addEventListener('change', (e) => {
        if (e.target.checked) {
            if (scanIntervalGroup) {
                scanIntervalGroup.style.display = 'block';
            }
        } else {
            if (scanIntervalGroup) {
                scanIntervalGroup.style.display = 'none';
            }
            stopAutoScan();
        }
    });
}

// Stop auto-scan (server-side)
async function stopAutoScan() {
    // Update server config to disable auto-scan
    try {
        const response = await fetch('/api/scanner/config');
        if (response.ok) {
            const config = await response.json();
            config.enableAutoScan = false;
            
            await fetch('/api/scanner/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });
        }
    } catch (error) {
        console.error('Error stopping auto-scan on server:', error);
    }
    
    // Update UI
    if (autoScanInterval) {
        clearInterval(autoScanInterval);
        autoScanInterval = null;
    }
    isAutoScanning = false;
    if (stopAutoScanBtn) {
        stopAutoScanBtn.style.display = 'none';
    }
    if (scanStatus) {
        scanStatus.classList.add('hidden');
    }
    if (enableAutoScan) {
        enableAutoScan.checked = false;
    }
    if (scanIntervalGroup) {
        scanIntervalGroup.style.display = 'none';
    }
}

// Stop auto-scan button
if (stopAutoScanBtn) {
    stopAutoScanBtn.addEventListener('click', () => {
        stopAutoScan();
    });
}

// Perform scan and move operation
async function performScanAndMove() {
    if (!scanSourceFolder || !scanTargetDb) {
        return;
    }
    
    const source = scanSourceFolder.value.trim();
    const targetId = scanTargetDb.value;
    
    if (!source || !targetId) {
        if (scanStatus) {
            scanStatus.innerHTML = '<div class="scan-result-error"><p>Please enter a source folder and select a target database</p></div>';
            scanStatus.classList.remove('hidden');
        }
        return;
    }
    
    try {
        const response = await fetch('/api/databases/scan-and-move', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sourceFolder: source,
                targetDbId: targetId
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to scan and move files');
        }
        
        const result = await response.json();
        
        // Display results
        let resultHtml = `<div class="scan-result-success">
            <h4>Scan Complete</h4>
            <p><strong>Total files found:</strong> ${result.totalFound}</p>
            <p><strong>Files moved:</strong> ${result.filesMoved}</p>
            <p><strong>Files skipped:</strong> ${result.filesSkipped}</p>
        </div>`;
        
        if (result.errors && result.errors.length > 0) {
            resultHtml += `<div class="scan-result-errors">
                <h4>Errors (${result.errors.length}):</h4>
                <ul>`;
            result.errors.forEach(err => {
                resultHtml += `<li>${err.file}: ${err.error}</li>`;
            });
            resultHtml += `</ul></div>`;
        }
        
        if (isAutoScanning) {
            // Update status for auto-scan
            if (scanStatus) {
                const now = new Date().toLocaleTimeString();
                scanStatus.innerHTML = `<div class="scan-result-success">
                    <p><strong>Last scan:</strong> ${now} - Moved ${result.filesMoved} file(s), skipped ${result.filesSkipped}</p>
                </div>`;
                scanStatus.classList.remove('hidden');
            }
        } else {
            // Show full results for manual scan
            if (scanResults) {
                scanResults.innerHTML = resultHtml;
                scanResults.classList.remove('hidden');
            }
        }
        
        // Show notification if files were moved
        if (result.filesMoved > 0) {
            showDbReloadNotification(result.filesMoved, targetId);
        }
        
        // Reload databases to update file counts
        await loadDatabases();
        updateScanTargetDb();
        
    } catch (error) {
        console.error('Error scanning and moving files:', error);
        if (isAutoScanning) {
            if (scanStatus) {
                const now = new Date().toLocaleTimeString();
                scanStatus.innerHTML = `<div class="scan-result-error">
                    <p><strong>Last scan (${now}):</strong> ${error.message}</p>
                </div>`;
                scanStatus.classList.remove('hidden');
            }
        } else {
            if (scanResults) {
                scanResults.innerHTML = `<div class="scan-result-error">
                    <h4>Error</h4>
                    <p>${error.message}</p>
                </div>`;
                scanResults.classList.remove('hidden');
            }
        }
    }
}

// Initialize scan button listener
function initializeScanButton() {
    const btn = document.getElementById('scanAndMoveBtn');
    if (!btn) {
        return;
    }
    
    // Remove existing listener if any (by cloning and replacing)
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', async () => {
        // Get elements dynamically to ensure they exist
        const sourceFolderEl = document.getElementById('scanSourceFolder');
        const targetDbEl = document.getElementById('scanTargetDb');
        const autoScanEl = document.getElementById('enableAutoScan');
        const intervalEl = document.getElementById('scanInterval');
        
        if (!sourceFolderEl || !targetDbEl) {
            alert('Scanner elements not found');
            return;
        }
        
        const source = sourceFolderEl.value ? sourceFolderEl.value.trim() : '';
        const targetId = targetDbEl.value ? targetDbEl.value : '';
        
        if (!source || !targetId) {
            alert('Please enter a source folder and select a target database');
            return;
        }
        
        // Check if auto-scan is enabled
        if (autoScanEl && autoScanEl.checked && intervalEl) {
            const intervalMinutes = intervalEl.value ? parseInt(intervalEl.value) : 5;
            
            if (intervalMinutes < 1) {
                alert('Scan interval must be at least 1 minute');
                return;
            }
            
            // Stop any existing interval first
            if (autoScanInterval) {
                clearInterval(autoScanInterval);
                autoScanInterval = null;
            }
            
            // Start auto-scan
            isAutoScanning = true;
            if (stopAutoScanBtn) {
                stopAutoScanBtn.style.display = 'inline-block';
            }
            if (scanStatus) {
                scanStatus.innerHTML = `<div class="scan-result-success"><p>Auto-scanning every ${intervalMinutes} minute(s)...</p></div>`;
                scanStatus.classList.remove('hidden');
            }
            
            // Perform initial scan
            await performScanAndMove();
            
            // Set up interval
            const intervalMs = intervalMinutes * 60 * 1000;
            autoScanInterval = setInterval(async () => {
                await performScanAndMove();
            }, intervalMs);
            
            return;
        }
        
        // Manual scan
        if (!confirm(`This will recursively scan "${source}" for .pk3 files and move them to the selected database. Continue?`)) {
            return;
        }
        
        // Disable button and show loading
        newBtn.disabled = true;
        newBtn.textContent = 'Scanning...';
        if (scanResults) {
            scanResults.classList.add('hidden');
        }
        
        await performScanAndMove();
        
        // Re-enable button
        newBtn.disabled = false;
        newBtn.textContent = 'Scan and Move Files';
        
        // Clear source folder input only for manual scans
        if (!isAutoScanning && sourceFolderEl) {
            sourceFolderEl.value = '';
        }
    });
}

// Initialize scan button on page load
// Initialize pending files counter on page load
updatePendingFilesCounter();
initializeScanButton();

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

        // init card width slider
        updateCardWidth(cardWidthSlider.value);
        
        // Load scanner configuration after databases are loaded
        updateScanTargetDb();
        loadScannerConfig();
        // Start auto-scan if it was enabled
        setTimeout(() => {
            startAutoScanIfEnabled();
        }, 1000);
        
        // Initialize bot status display and start polling
        updateBotStatusDisplay();
        // Update bot status every 30 seconds
        if (botStatusInterval) {
            clearInterval(botStatusInterval);
        }
        botStatusInterval = setInterval(() => {
            updateBotStatusDisplay();
        }, 30000); // 30 seconds
    });
} else {
    // DOM is already ready, load immediately
    (async () => {
        await loadDatabases();
        if (databaseSelect) {
            databaseSelect.value = currentDatabase;
        }
        loadPokemon();
        
        // Load scanner configuration after databases are loaded
        updateScanTargetDb();
        loadScannerConfig();
        // Start auto-scan if it was enabled
        setTimeout(() => {
            startAutoScanIfEnabled();
        }, 1000);
    })();
}

// Location index cache
let locationIndex = null;
let allEncounterData = null;

// Load encounter data and build location index
async function loadLocationIndex() {
    if (locationIndex) return locationIndex;
    
    try {
        const response = await fetch('/api/pokemon/encounter-rates');
        if (!response.ok) {
            console.error('Failed to load encounter data');
            return null;
        }
        
        allEncounterData = await response.json();
        locationIndex = {};
        
        // Build location index: location -> { game -> [pokemon encounters] }
        for (const [speciesId, pokemonData] of Object.entries(allEncounterData.pokemon)) {
            if (!pokemonData.encounters) continue;
            
            for (const [game, encounters] of Object.entries(pokemonData.encounters)) {
                for (const encounter of encounters) {
                    if (encounter.method === 'Wild' && encounter.location) {
                        const locationKey = encounter.location.toLowerCase().trim();
                        if (!locationIndex[locationKey]) {
                            locationIndex[locationKey] = {};
                        }
                        if (!locationIndex[locationKey][game]) {
                            locationIndex[locationKey][game] = [];
                        }
                        locationIndex[locationKey][game].push({
                            speciesId: parseInt(speciesId),
                            name: pokemonData.name,
                            encounter: encounter
                        });
                    }
                }
            }
        }
        
        return locationIndex;
    } catch (error) {
        console.error('Error loading location index:', error);
        return null;
    }
}

// Get all unique locations
function getAllLocations() {
    if (!locationIndex) return [];
    return Object.keys(locationIndex).sort();
}

// Get encounters for a location and game
function getLocationEncounters(locationName, game) {
    if (!locationIndex) return [];
    const locationKey = locationName.toLowerCase().trim();
    // Try exact match first
    if (locationIndex[locationKey]?.[game]) {
        return locationIndex[locationKey][game];
    }
    // Try fuzzy match
    const matchedLocation = findLocationByName(locationName);
    if (matchedLocation) {
        const matchedKey = matchedLocation.toLowerCase().trim();
        return locationIndex[matchedKey]?.[game] || [];
    }
    return [];
}

// Location name normalization and matching
function normalizeLocationName(name) {
    if (!name) return '';
    return name.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Find location by fuzzy matching
function findLocationByName(searchName) {
    if (!locationIndex) return null;
    
    const normalizedSearch = normalizeLocationName(searchName);
    const locations = getAllLocations();
    
    // Exact match
    for (const loc of locations) {
        if (normalizeLocationName(loc) === normalizedSearch) {
            return loc;
        }
    }
    
    // Contains match
    for (const loc of locations) {
        const normalizedLoc = normalizeLocationName(loc);
        if (normalizedLoc.includes(normalizedSearch) || normalizedSearch.includes(normalizedLoc)) {
            return loc;
        }
    }
    
    // Partial word match
    const searchWords = normalizedSearch.split(' ');
    for (const loc of locations) {
        const normalizedLoc = normalizeLocationName(loc);
        const locWords = normalizedLoc.split(' ');
        if (searchWords.some(word => locWords.some(lw => lw.includes(word) || word.includes(lw)))) {
            return loc;
        }
    }
    
    return null;
}

// Open Map Modal
async function openMapModal() {
    const modal = document.getElementById('mapModal');
    if (!modal) {
        alert('Map modal not found. Please refresh the page.');
        return;
    }
    modal.classList.remove('hidden');
    
    // Load location index if not already loaded
    await loadLocationIndex();
    
    // Populate location list
    populateLocationList();
    
    // Set up postMessage listener for iframe communication
    setupMapMessageListener();
    
    // Load default map (FRLG)
    if (mapFRLGBtn && mapFRLGBtn.classList.contains('active')) {
        loadMap('frlg');
    }
}


// Select a location and show encounters
function selectLocation(locationName) {
    const encountersDisplay = document.getElementById('encountersDisplay');
    const encountersContent = document.getElementById('encountersContent');
    const selectedLocationName = document.getElementById('selectedLocationName');
    const locationList = document.getElementById('locationList');
    
    if (!encountersDisplay || !encountersContent || !selectedLocationName) return;
    
    // Determine current game
    const mapFRLGBtn = document.getElementById('mapFRLGBtn');
    const isFRLG = mapFRLGBtn && mapFRLGBtn.classList.contains('active');
    
    // Get encounters for this location
    // For FRLG, combine FireRed and LeafGreen encounters (they're usually the same)
    let encounters = [];
    if (isFRLG) {
        const frEncounters = getLocationEncounters(locationName, 'firered');
        const lgEncounters = getLocationEncounters(locationName, 'leafgreen');
        // Combine and deduplicate by species ID
        const encounterMap = new Map();
        [...frEncounters, ...lgEncounters].forEach(enc => {
            const key = enc.speciesId;
            if (!encounterMap.has(key) || (enc.encounter.rate || 0) > (encounterMap.get(key).encounter.rate || 0)) {
                encounterMap.set(key, enc);
            }
        });
        encounters = Array.from(encounterMap.values());
    } else {
        encounters = getLocationEncounters(locationName, 'emerald');
    }
    
    const gameName = isFRLG ? 'FireRed/LeafGreen' : 'Emerald';
    
    selectedLocationName.textContent = locationName;
    encountersContent.innerHTML = '';
    
    if (encounters.length === 0) {
        encountersContent.innerHTML = `<p>No wild encounters found for ${locationName} in ${gameName}.</p>`;
    } else {
        // Group by method and sort by rate
        const grouped = {};
        encounters.forEach(({ speciesId, name, encounter }) => {
            const key = encounter.method || 'Wild';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push({ speciesId, name, encounter });
        });
        
        // Sort encounters by rate (highest first)
        Object.keys(grouped).forEach(method => {
            grouped[method].sort((a, b) => {
                const rateA = a.encounter.rate || 0;
                const rateB = b.encounter.rate || 0;
                return rateB - rateA;
            });
        });
        
        // Display encounters
        Object.entries(grouped).forEach(([method, pokemonList]) => {
            const methodSection = document.createElement('div');
            methodSection.className = 'encounter-method-section';
            methodSection.innerHTML = `<h5>${method}</h5>`;
            
            const pokemonListEl = document.createElement('ul');
            pokemonListEl.className = 'encounter-pokemon-list';
            
            pokemonList.forEach(({ speciesId, name, encounter }) => {
                const li = document.createElement('li');
                li.className = 'encounter-pokemon-item';
                
                let text = `<span class="pokemon-link" data-species="${speciesId}">#${speciesId} ${name}</span>`;
                if (encounter.level) {
                    if (encounter.level.min === encounter.level.max) {
                        text += ` (Level ${encounter.level.min})`;
                    } else {
                        text += ` (Level ${encounter.level.min}-${encounter.level.max})`;
                    }
                }
                if (encounter.rate) {
                    text += ` - <span class="encounter-rate">${encounter.rate}%</span>`;
                }
                
                li.innerHTML = text;
                pokemonListEl.appendChild(li);
            });
            
            methodSection.appendChild(pokemonListEl);
            encountersContent.appendChild(methodSection);
        });
        
        // Add click handlers for Pokemon links
        encountersContent.querySelectorAll('.pokemon-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const speciesId = parseInt(link.dataset.species);
                const pokemonInfoModal = document.getElementById('pokemonInfoModal');
                if (pokemonInfoModal) {
                    pokemonInfoModal.classList.add('hidden');
                }
                showPokemonInfo(speciesId);
            });
        });
    }
    
    // Show encounters panel, hide location list
    encountersDisplay.classList.remove('hidden');
    if (locationList) {
        locationList.style.display = 'none';
    }
}

// Close encounters display
function closeEncountersDisplay() {
    const encountersDisplay = document.getElementById('encountersDisplay');
    const locationList = document.getElementById('locationList');
    
    if (encountersDisplay) {
        encountersDisplay.classList.add('hidden');
    }
    if (locationList) {
        locationList.style.display = 'block';
    }
}

// Set up postMessage listener for iframe communication
function setupMapMessageListener() {
    // Remove any existing listener to avoid duplicates
    if (window.mapMessageHandler) {
        window.removeEventListener('message', window.mapMessageHandler);
    }
    
    // Listen for messages from the iframe (the integrated maps)
    window.mapMessageHandler = (event) => {
        console.log('Message received:', event.origin, event.data);
        
        // Accept messages from same origin (local maps) or any origin for debugging
        const isLocalOrigin = event.origin === window.location.origin || 
                              event.origin.startsWith('http://localhost') ||
                              event.origin.startsWith('http://127.0.0.1') ||
                              event.origin === 'null' || // file:// protocol
                              true; // Accept all for debugging
        
        if (!isLocalOrigin) {
            console.log('Rejected message from origin:', event.origin);
            return;
        }
        
        // Handle location data from the map
        if (event.data && event.data.type === 'location' && event.data.location) {
            console.log('Received location from map:', event.data.location);
            const locationName = event.data.location;
            const matchedLocation = findLocationByName(locationName);
            if (matchedLocation) {
                console.log('Matched location:', matchedLocation);
                selectLocation(matchedLocation);
            } else {
                // Try direct match
                const mapFRLGBtn = document.getElementById('mapFRLGBtn');
                const isFRLG = mapFRLGBtn && mapFRLGBtn.classList.contains('active');
                const game = isFRLG ? 'firered' : 'emerald';
                
                const encounters = getLocationEncounters(locationName, game);
                console.log('Direct match encounters:', encounters.length);
                if (encounters.length > 0) {
                    selectLocation(locationName);
                } else {
                    console.log('Location not found:', locationName, 'tried game:', game);
                }
            }
        }
    };
    
    window.addEventListener('message', window.mapMessageHandler);
    console.log('Map message listener set up');
}

// Open Pokedex
async function openPokedex() {
    const modal = document.getElementById('pokedexModal');
    if (!modal) {
        alert('Pokedex modal not found. Please refresh the page.');
        return;
    }
    modal.classList.remove('hidden');
    try {
        await loadPokedexData();
    } catch (error) {
        alert(`Error loading Pokedex: ${error.message}`);
    }
}

// Load Pokedex data
async function loadPokedexData() {
    try {
        const dbId = currentDatabase || 'db1';
        const response = await fetch(`/api/pokedex?db=${dbId}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error || 'Failed to load Pokedex data');
        }
        
        const data = await response.json();
        displayPokedex(data);
    } catch (error) {
        alert(`Error loading Pokedex: ${error.message}`);
    }
}

// Calculate statistics for a specific species
function calculateSpeciesStatistics(speciesId) {
    if (!pokemonData || pokemonData.length === 0) {
        return null;
    }
    
    // Filter Pokemon by species
    const speciesPokemon = pokemonData.filter(p => 
        !p.error && 
        p.species && 
        Number(p.species) === Number(speciesId)
    );
    
    if (speciesPokemon.length === 0) {
        return null;
    }
    
    // Calculate statistics
    const stats = {
        count: speciesPokemon.length,
        shinyCount: speciesPokemon.filter(p => p.isShiny).length,
        ivSums: [],
        avgIVSum: 0,
        maxIVSum: 0,
        minIVSum: 186,
        avgLevel: 0,
        maxLevel: 0,
        minLevel: 100
    };
    
    let ivSumTotal = 0;
    let ivSumCount = 0;
    let levelTotal = 0;
    let levelCount = 0;
    
    speciesPokemon.forEach(p => {
        // IV Sum statistics
        if (p.ivSum !== undefined && p.ivSum !== null) {
            const ivSum = Number(p.ivSum);
            stats.ivSums.push(ivSum);
            ivSumTotal += ivSum;
            ivSumCount++;
            stats.maxIVSum = Math.max(stats.maxIVSum, ivSum);
            stats.minIVSum = Math.min(stats.minIVSum, ivSum);
        }
        
        // Level statistics
        if (p.level !== undefined && p.level !== null) {
            const level = Number(p.level);
            levelTotal += level;
            levelCount++;
            stats.maxLevel = Math.max(stats.maxLevel, level);
            stats.minLevel = Math.min(stats.minLevel, level);
        }
    });
    
    stats.avgIVSum = ivSumCount > 0 ? (ivSumTotal / ivSumCount) : 0;
    stats.avgLevel = levelCount > 0 ? (levelTotal / levelCount) : 0;
    
    // If no IV data, set min to 0
    if (stats.minIVSum === 186) {
        stats.minIVSum = 0;
    }
    
    return stats;
}

// Display Pokedex
async function displayPokedex(data) {
    const { pokedex, completionStats, availableGenerations: gens } = data;
    
    // Store available generations globally
    availableGenerations = gens || [];
    
    console.log('[Pokedex] Data received:', {
        pokedexSize: Object.keys(pokedex).length,
        completionStats: completionStats,
        availableGenerations: availableGenerations,
        sampleKeys: Object.keys(pokedex).slice(0, 10),
        sampleEntries: Object.entries(pokedex).slice(0, 5)
    });
    
    // Update generation filter dropdown to show only generations in the database
    let genFilterSelect = document.getElementById('pokedexGenFilter');
    if (genFilterSelect) {
        // Preserve the currently selected value before rebuilding
        const currentSelection = genFilterSelect.value;
        
        genFilterSelect.innerHTML = '<option value="all">All Generations</option>';
        // Only show generations that are present in the database
        if (availableGenerations && availableGenerations.length > 0) {
            // Sort generations numerically
            const sortedGens = [...availableGenerations].sort((a, b) => a - b);
            for (const genNum of sortedGens) {
                const genName = completionStats[genNum]?.name || `Generation ${genNum}`;
                genFilterSelect.innerHTML += `<option value="${genNum}">${genName}</option>`;
            }
        }
        
        // Restore the selected value if it's still valid (either "all" or a generation in availableGenerations)
        if (currentSelection === 'all' || (availableGenerations && availableGenerations.includes(parseInt(currentSelection)))) {
            genFilterSelect.value = currentSelection;
        } else {
            // If the previously selected generation is no longer available, default to "all"
            genFilterSelect.value = 'all';
        }
    }
    
    // Display completion stats
    const statsContainer = document.getElementById('pokedexCompletionStats');
    if (statsContainer) {
        let statsHTML = '';
        // Sort by generation number
        const sortedGens = Object.keys(completionStats).sort((a, b) => parseInt(a) - parseInt(b));
        for (const genNum of sortedGens) {
            const stats = completionStats[genNum];
            const livingDexBadge = stats.livingDex ? '<span class="badge living-dex">Living Dex</span>' : '';
            const shinyLivingDexBadge = stats.shinyLivingDex ? '<span class="badge shiny-living-dex">Shiny Living Dex</span>' : '';
            
            statsHTML += `
                <div class="completion-stat">
                    <h4>${stats.name}</h4>
                    <div class="stat-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${stats.percentage}%"></div>
                        </div>
                        <span>${stats.owned}/${stats.total} (${stats.percentage}%)</span>
                    </div>
                    <div class="shiny-progress">
                        <div class="progress-bar">
                            <div class="progress-fill shiny" style="width: ${stats.shinyPercentage}%"></div>
                        </div>
                        <span>Shiny: ${stats.shiny}/${stats.total} (${stats.shinyPercentage}%)</span>
                    </div>
                    <div class="badges">
                        ${livingDexBadge}
                        ${shinyLivingDexBadge}
                    </div>
                </div>
            `;
        }
        statsContainer.innerHTML = statsHTML;
    }
    
    // Display Pokemon grid
    const grid = document.getElementById('pokedexGrid');
    if (!grid) return;
    
    const showOwned = document.getElementById('pokedexShowOwned')?.checked ?? true;
    const showMissing = document.getElementById('pokedexShowMissing')?.checked ?? true;
    const genFilter = genFilterSelect?.value ?? 'all';
    
    // Generation ranges (all possible)
    const genRanges = {
        1: { start: 1, end: 151 },
        2: { start: 152, end: 251 },
        3: { start: 252, end: 386 },
        4: { start: 387, end: 493 },
        5: { start: 494, end: 649 },
        6: { start: 650, end: 721 },
        7: { start: 722, end: 809 },
        8: { start: 810, end: 905 },
        9: { start: 906, end: 1025 }
    };
    
    // Determine max species ID to display
    const pokedexKeys = Object.keys(pokedex).map(Number).filter(k => k > 0);
    const maxSpeciesId = pokedexKeys.length > 0 ? Math.max(...pokedexKeys) : 0;
    
    // If no Pokemon found, show message
    if (maxSpeciesId === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 20px;">No Pokemon found in database</div>';
        return;
    }
    
    // Show all species up to Gen 9 (1025) - filters will handle what to display
    const maxToShow = 1025;
    
    // Collect all species IDs that need names fetched
    const speciesToFetch = [];
    for (let speciesId = 1; speciesId <= maxToShow; speciesId++) {
        // Determine generation
        let gen = 1;
        if (speciesId >= 152 && speciesId <= 251) gen = 2;
        else if (speciesId >= 252 && speciesId <= 386) gen = 3;
        else if (speciesId >= 387 && speciesId <= 493) gen = 4;
        else if (speciesId >= 494 && speciesId <= 649) gen = 5;
        else if (speciesId >= 650 && speciesId <= 721) gen = 6;
        else if (speciesId >= 722 && speciesId <= 809) gen = 7;
        else if (speciesId >= 810 && speciesId <= 905) gen = 8;
        else if (speciesId >= 906 && speciesId <= 1025) gen = 9;
        
        // Apply generation filter
        if (genFilter !== 'all' && parseInt(genFilter) !== gen) {
            continue;
        }
        
        // Only show Pokemon from generations present in the database
        if (availableGenerations && availableGenerations.length > 0 && !availableGenerations.includes(gen)) {
            continue;
        }
        
        // Convert speciesId to string for lookup (JSON keys are strings)
        const entry = pokedex[String(speciesId)] || pokedex[speciesId] || { owned: false, shiny: false };
        
        // Apply owned/missing filter
        if (!showOwned && entry.owned) continue;
        if (!showMissing && !entry.owned) continue;
        
        // Check if we need to fetch the name
        if (!speciesCache.has(speciesId)) {
            speciesToFetch.push(speciesId);
        }
    }
    
    // Fetch all missing species names in parallel (with rate limiting)
    if (speciesToFetch.length > 0) {
        // Show loading message
        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 20px;">Loading Pokemon names...</div>';
        
        // Fetch in batches to avoid overwhelming the API
        const batchSize = 10;
        for (let i = 0; i < speciesToFetch.length; i += batchSize) {
            const batch = speciesToFetch.slice(i, i + batchSize);
            await Promise.all(batch.map(speciesId => getSpeciesName(speciesId)));
        }
    }
    
    // Now build the grid with all names available
    let gridHTML = '';
    
    for (let speciesId = 1; speciesId <= maxToShow; speciesId++) {
        // Determine generation
        let gen = 1;
        if (speciesId >= 152 && speciesId <= 251) gen = 2;
        else if (speciesId >= 252 && speciesId <= 386) gen = 3;
        else if (speciesId >= 387 && speciesId <= 493) gen = 4;
        else if (speciesId >= 494 && speciesId <= 649) gen = 5;
        else if (speciesId >= 650 && speciesId <= 721) gen = 6;
        else if (speciesId >= 722 && speciesId <= 809) gen = 7;
        else if (speciesId >= 810 && speciesId <= 905) gen = 8;
        else if (speciesId >= 906 && speciesId <= 1025) gen = 9;
        
        // Apply generation filter
        if (genFilter !== 'all' && parseInt(genFilter) !== gen) {
            continue;
        }
        
        // Only show Pokemon from generations present in the database
        if (availableGenerations && availableGenerations.length > 0 && !availableGenerations.includes(gen)) {
            continue;
        }
        
        // Convert speciesId to string for lookup (JSON keys are strings)
        const entry = pokedex[String(speciesId)] || pokedex[speciesId] || { owned: false, shiny: false };
        
        // Apply owned/missing filter
        if (!showOwned && entry.owned) continue;
        if (!showMissing && !entry.owned) continue;
        
        // Get species name (should be in cache now)
        const speciesName = speciesCache.get(speciesId) || `#${speciesId}`;
        const spriteUrl = getSpriteUrl(speciesId, entry.shiny);
        
        let statusClass = 'missing';
        if (entry.owned && entry.shiny) {
            statusClass = 'shiny';
        } else if (entry.owned) {
            statusClass = 'owned';
        }
        
        // Calculate statistics for this species (only if checkbox is checked)
        const showStatsOnCard = document.getElementById('pokedexShowStats')?.checked ?? true;
        const speciesStats = showStatsOnCard ? calculateSpeciesStatistics(speciesId) : null;
        let statsHTML = '';
        if (showStatsOnCard && speciesStats && speciesStats.count > 0) {
            const hasIVData = speciesStats.avgIVSum > 0 || speciesStats.maxIVSum > 0;
            statsHTML = `
                <div class="pokedex-stats">
                    <div class="pokedex-stat-item">
                        <span class="stat-label">Count:</span>
                        <span class="stat-value">${speciesStats.count}</span>
                    </div>
                    ${speciesStats.shinyCount > 0 ? `
                    <div class="pokedex-stat-item">
                        <span class="stat-label">Shiny:</span>
                        <span class="stat-value">${speciesStats.shinyCount}</span>
                    </div>
                    ` : ''}
                    ${hasIVData ? `
                    <div class="pokedex-stat-item">
                        <span class="stat-label">Avg IV:</span>
                        <span class="stat-value">${speciesStats.avgIVSum > 0 ? speciesStats.avgIVSum.toFixed(1) : '0.0'}</span>
                    </div>
                    <div class="pokedex-stat-item">
                        <span class="stat-label">Max IV:</span>
                        <span class="stat-value">${speciesStats.maxIVSum}</span>
                    </div>
                    ${speciesStats.count > 1 && speciesStats.minIVSum < speciesStats.maxIVSum ? `
                    <div class="pokedex-stat-item">
                        <span class="stat-label">Min IV:</span>
                        <span class="stat-value">${speciesStats.minIVSum}</span>
                    </div>
                    ` : ''}
                    ` : ''}
                </div>
            `;
        }
        
        gridHTML += `
            <div class="pokedex-entry ${statusClass}" data-species="${speciesId}">
                <div class="pokedex-number">#${speciesId}</div>
                <img src="${spriteUrl}" alt="${speciesName}" class="pokedex-sprite" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${speciesId}.png'">
                <div class="pokedex-name">${speciesName}</div>
                ${entry.shiny ? '<span class="shiny-indicator">★</span>' : ''}
                ${statsHTML}
            </div>
        `;
    }
    
    grid.innerHTML = gridHTML;
    
    // Add click handlers to pokedex entries
    const entries = grid.querySelectorAll('.pokedex-entry');
    entries.forEach(entry => {
        entry.addEventListener('click', () => {
            const speciesId = parseInt(entry.dataset.species);
            if (speciesId) {
                showPokemonInfo(speciesId);
            }
        });
    });
    
    // Add filter event listeners (only once)
    const showOwnedCheckbox = document.getElementById('pokedexShowOwned');
    const showMissingCheckbox = document.getElementById('pokedexShowMissing');
    // genFilterSelect already declared above
    
    if (showOwnedCheckbox && !showOwnedCheckbox.dataset.listenerAdded) {
        showOwnedCheckbox.addEventListener('change', () => loadPokedexData());
        showOwnedCheckbox.dataset.listenerAdded = 'true';
    }
    if (showMissingCheckbox && !showMissingCheckbox.dataset.listenerAdded) {
        showMissingCheckbox.addEventListener('change', () => loadPokedexData());
        showMissingCheckbox.dataset.listenerAdded = 'true';
    }
    if (genFilterSelect && !genFilterSelect.dataset.listenerAdded) {
        genFilterSelect.addEventListener('change', () => loadPokedexData());
        genFilterSelect.dataset.listenerAdded = 'true';
    }
    
    // Add stats toggle event listener
    const showStatsCheckbox = document.getElementById('pokedexShowStats');
    if (showStatsCheckbox && !showStatsCheckbox.dataset.listenerAdded) {
        showStatsCheckbox.addEventListener('change', () => loadPokedexData());
        showStatsCheckbox.dataset.listenerAdded = 'true';
    }
}

// Calculate Unown form from IVs (Gen 3 formula)
// Form is determined by: ((ATK & 0x6) << 5) | ((DEF & 0x6) << 3) | ((SPE & 0x6) << 1) | ((SPC & 0x6) >> 1)) / 10
function calculateUnownForm(attackIV, defenseIV, speedIV, spAttackIV) {
    const atkBits = (attackIV & 0x6) << 5;
    const defBits = (defenseIV & 0x6) << 3;
    const speBits = (speedIV & 0x6) << 1;
    const spcBits = (spAttackIV & 0x6) >> 1;
    const formValue = (atkBits | defBits | speBits | spcBits) / 10;
    return Math.min(27, Math.max(0, Math.floor(formValue))); // Forms 0-27 (A-Z, !, ?)
}

// Get Unown form letter/character
function getUnownFormName(form) {
    if (form >= 0 && form <= 25) {
        return String.fromCharCode(65 + form); // A-Z
    } else if (form === 26) {
        return '!';
    } else if (form === 27) {
        return '?';
    }
    return '?';
}

// Show Unown Dex modal
async function showUnownDex() {
    const modal = document.getElementById('unownDexModal');
    const content = document.getElementById('unownDexContent');
    
    if (!modal || !content) {
        console.error('Unown Dex modal elements not found');
        return;
    }
    
    modal.classList.remove('hidden');
    content.innerHTML = '<div class="loading">Loading Unown forms...</div>';
    
    try {
        // Fetch all Pokemon files to find Unown
        const dbId = currentDatabase || 'db1';
        const response = await fetch(`/api/pokemon?db=${dbId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch Pokemon data');
        }
        
        const pokemonData = await response.json();
        
        // Track which forms are owned (shiny and non-shiny) and store Pokemon data
        const unownForms = {};
        const unownPokemonByForm = {}; // Store actual Pokemon data for each form
        for (let i = 0; i <= 27; i++) {
            unownForms[i] = { owned: false, shiny: false, pokemon: [] };
            unownPokemonByForm[i] = [];
        }
        
        // Process all Pokemon to find Unown
        for (const pokemon of pokemonData) {
            if (pokemon.species === 201 && !pokemon.error) {
                // Calculate form from IVs
                const form = calculateUnownForm(
                    pokemon.ivs?.attack || 0,
                    pokemon.ivs?.defense || 0,
                    pokemon.ivs?.speed || 0,
                    pokemon.ivs?.spAttack || 0
                );
                
                if (form >= 0 && form <= 27) {
                    unownForms[form].owned = true;
                    unownPokemonByForm[form].push(pokemon);
                    if (pokemon.isShiny) {
                        unownForms[form].shiny = true;
                    }
                }
            }
        }
        
        // Fetch Unown Pokemon data from PokeAPI
        let unownPokemonData = null;
        try {
            const pokemonResponse = await fetch('https://pokeapi.co/api/v2/pokemon/201');
            if (pokemonResponse.ok) {
                unownPokemonData = await pokemonResponse.json();
            }
        } catch (e) {
            console.warn('Failed to fetch Unown data from PokeAPI:', e);
        }
        
        // Display Unown Dex
        let html = '';
        
        // Add basic Unown information section
        if (unownPokemonData) {
            html += '<div class="unown-dex-info-section">';
            html += '<h3>Unown Information</h3>';
            html += `<p><strong>Name:</strong> Unown</p>`;
            html += `<p><strong>ID:</strong> #201</p>`;
            if (unownPokemonData.height) {
                html += `<p><strong>Height:</strong> ${(unownPokemonData.height / 10).toFixed(1)} m</p>`;
            }
            if (unownPokemonData.weight) {
                html += `<p><strong>Weight:</strong> ${(unownPokemonData.weight / 10).toFixed(1)} kg</p>`;
            }
            if (unownPokemonData.types && unownPokemonData.types.length > 0) {
                html += '<p><strong>Types:</strong> ';
                html += unownPokemonData.types.map(t => t.type.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ');
                html += '</p>';
            }
            if (unownPokemonData.abilities && unownPokemonData.abilities.length > 0) {
                html += '<p><strong>Abilities:</strong> ';
                html += unownPokemonData.abilities.map(a => a.ability.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ');
                html += '</p>';
            }
            html += '</div>';
        }
        
        // Add summary
        const ownedCount = Object.values(unownForms).filter(f => f.owned).length;
        const shinyCount = Object.values(unownForms).filter(f => f.shiny).length;
        html += `
            <div class="unown-dex-summary">
                <div class="summary-stat">
                    <strong>Owned:</strong> ${ownedCount}/28
                </div>
                <div class="summary-stat">
                    <strong>Shiny:</strong> ${shinyCount}/28
                </div>
            </div>
        `;
        
        // Display Unown forms grid
        html += '<div class="unown-dex-grid">';
        for (let form = 0; form <= 27; form++) {
            const formData = unownForms[form];
            const formName = getUnownFormName(form);
            const ownedClass = formData.owned ? 'owned' : 'missing';
            const shinyClass = formData.shiny ? 'shiny' : '';
            
            // Get sprite URL for this form
            const formLower = formName.toLowerCase();
            const spriteUrl = getSpriteUrl(201, false, formLower);
            const shinySpriteUrl = getSpriteUrl(201, true, formLower);
            
            // Get Pokemon count for this form
            const pokemonCount = unownPokemonByForm[form].length;
            const shinyCount = unownPokemonByForm[form].filter(p => p.isShiny).length;
            
            html += `
                <div class="unown-form-card ${ownedClass} ${shinyClass}" data-form="${form}">
                    <div class="unown-form-sprite">
                        <img src="${spriteUrl}" alt="Unown ${formName}" 
                             onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/201-${formLower}.png'">
                        ${formData.shiny ? `<img src="${shinySpriteUrl}" alt="Unown ${formName} Shiny" class="shiny-sprite"
                             onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/201-${formLower}.png'">` : ''}
                    </div>
                    <div class="unown-form-letter">${formName}</div>
                    <div class="unown-form-status">
                        ${formData.shiny ? '<span class="shiny-indicator">★</span>' : ''}
                        ${formData.owned ? '<span class="owned-indicator">✓</span>' : '<span class="missing-indicator">✗</span>'}
                    </div>
                    ${pokemonCount > 0 ? `<div class="unown-form-count">${pokemonCount} ${pokemonCount === 1 ? 'Pokemon' : 'Pokemon'}${shinyCount > 0 ? ` (${shinyCount} shiny)` : ''}</div>` : ''}
                </div>
            `;
        }
        html += '</div>';
        
        content.innerHTML = html;
    } catch (error) {
        console.error('Error loading Unown Dex:', error);
        content.innerHTML = `<div class="error">Error loading Unown forms: ${error.message}</div>`;
    }
}

// Close Unown Dex modal
function closeUnownDexModal() {
    const modal = document.getElementById('unownDexModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Setup Unown Dex modal close handler
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('closeUnownDexModal');
    const modal = document.getElementById('unownDexModal');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeUnownDexModal);
    }
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeUnownDexModal();
            }
        });
    }
});

// Show Pokemon information modal
async function showPokemonInfo(speciesId) {
    const modal = document.getElementById('pokemonInfoModal');
    const content = document.getElementById('pokemonInfoContent');
    const title = document.getElementById('pokemonInfoTitle');
    
    if (!modal || !content) return;
    
    // Show modal with loading state
    modal.classList.remove('hidden');
    content.innerHTML = '<div class="loading">Loading Pokemon information...</div>';
    
    try {
        // Get Pokemon name
        const speciesName = await getSpeciesName(speciesId);
        title.textContent = `#${speciesId} - ${speciesName}`;
        
        // Fetch Pokemon data
        const pokemonData = await fetchPokemonData(speciesId);
        
        // Display the information
        content.innerHTML = formatPokemonInfo(pokemonData, speciesId, speciesName);
        
        // If this is Unown, load and display all forms
        if (speciesId === 201) {
            loadUnownForms();
        }
    } catch (error) {
        console.error('Error loading Pokemon info:', error);
        content.innerHTML = `<div class="error">Error loading Pokemon information: ${error.message}</div>`;
    }
}

// Load and display Unown forms in the Pokemon info modal
async function loadUnownForms() {
    const formsGrid = document.getElementById('unownFormsGrid');
    if (!formsGrid) return;
    
    try {
        // Fetch all Pokemon files to find Unown
        const dbId = currentDatabase || 'db1';
        const response = await fetch(`/api/pokemon?db=${dbId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch Pokemon data');
        }
        
        const pokemonData = await response.json();
        
        // Track which forms are owned (shiny and non-shiny)
        const unownForms = {};
        const unownPokemonByForm = {};
        for (let i = 0; i <= 27; i++) {
            unownForms[i] = { owned: false, shiny: false };
            unownPokemonByForm[i] = [];
        }
        
        // Process all Pokemon to find Unown
        for (const pokemon of pokemonData) {
            if (pokemon.species === 201 && !pokemon.error) {
                // Calculate form from IVs
                const form = calculateUnownForm(
                    pokemon.ivs?.attack || 0,
                    pokemon.ivs?.defense || 0,
                    pokemon.ivs?.speed || 0,
                    pokemon.ivs?.spAttack || 0
                );
                
                if (form >= 0 && form <= 27) {
                    unownForms[form].owned = true;
                    unownPokemonByForm[form].push(pokemon);
                    if (pokemon.isShiny) {
                        unownForms[form].shiny = true;
                    }
                }
            }
        }
        
        // Display Unown forms grid
        let html = '';
        for (let form = 0; form <= 27; form++) {
            const formData = unownForms[form];
            const formName = getUnownFormName(form);
            const ownedClass = formData.owned ? 'owned' : 'missing';
            const shinyClass = formData.shiny ? 'shiny' : '';
            
            // Get sprite URL for this form
            // PokeAPI uses lowercase letters for A-Z, and special characters need URL encoding
            let formLower = formName.toLowerCase();
            if (formName === '!') formLower = 'exclamation';
            if (formName === '?') formLower = 'question';
            
            // Use direct PokeAPI sprite URL for Unown forms
            const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/201-${formLower}.png`;
            const shinySpriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/201-${formLower}.png`;
            
            // Get Pokemon count for this form
            const pokemonCount = unownPokemonByForm[form].length;
            const shinyCount = unownPokemonByForm[form].filter(p => p.isShiny).length;
            
            html += `
                <div class="unown-form-card ${ownedClass} ${shinyClass}" data-form="${form}">
                    <div class="unown-form-sprite">
                        <img src="${spriteUrl}" alt="Unown ${formName}" 
                             onerror="this.onerror=null; this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/201.png'">
                        ${formData.shiny ? `<img src="${shinySpriteUrl}" alt="Unown ${formName} Shiny" class="shiny-sprite"
                             onerror="this.onerror=null; this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/201.png'">` : ''}
                    </div>
                    <div class="unown-form-letter">${formName}</div>
                    <div class="unown-form-status">
                        ${formData.shiny ? '<span class="shiny-indicator">★</span>' : ''}
                        ${formData.owned ? '<span class="owned-indicator">✓</span>' : '<span class="missing-indicator">✗</span>'}
                    </div>
                    ${pokemonCount > 0 ? `<div class="unown-form-count">${pokemonCount}${shinyCount > 0 ? ` (${shinyCount}★)` : ''}</div>` : ''}
                </div>
            `;
        }
        
        // Add summary
        const ownedCount = Object.values(unownForms).filter(f => f.owned).length;
        const shinyCount = Object.values(unownForms).filter(f => f.shiny).length;
        html += `
            <div class="unown-forms-summary">
                <div class="summary-stat">
                    <strong>Owned:</strong> ${ownedCount}/28
                </div>
                <div class="summary-stat">
                    <strong>Shiny:</strong> ${shinyCount}/28
                </div>
            </div>
        `;
        
        formsGrid.innerHTML = html;
    } catch (error) {
        console.error('Error loading Unown forms:', error);
        formsGrid.innerHTML = `<div class="error">Error loading Unown forms: ${error.message}</div>`;
    }
}

// Fetch Pokemon data from API (using server-side endpoints)
async function fetchPokemonData(speciesId) {
    try {
        
        // Fetch Pokemon data from server (cached/proxied)
        const pokemonResponse = await fetch(`/api/pokemon/data/${speciesId}`);
        if (!pokemonResponse.ok) {
            throw new Error('Failed to fetch Pokemon data');
        }
        const pokemon = await pokemonResponse.json();
        
        // Fetch species data from server (cached/proxied)
        const speciesResponse = await fetch(`/api/pokemon/species/${speciesId}`);
        let species = null;
        if (speciesResponse.ok) {
            species = await speciesResponse.json();
        }
        
        // Get location areas (where to find) from server
        const locationAreas = await fetchLocationAreas(speciesId);
        
        // Get evolution info with conditions
        let evolutionInfo = null;
        let evolutionDetails = null;
        try {
            // Get from server
            const evoResponse = await fetch(`/api/pokemon/evolution-info/${speciesId}`);
            if (evoResponse.ok) {
                evolutionInfo = await evoResponse.json();
            }
            
            // Get evolution chain from server if species data available
            if (species && species.evolution_chain && species.evolution_chain.url) {
                const chainId = parseInt(species.evolution_chain.url.split('/').slice(-2, -1)[0]);
                if (chainId) {
                    const evolutionResponse = await fetch(`/api/pokemon/evolution-chain/${chainId}`);
                    if (evolutionResponse.ok) {
                        const evolutionChain = await evolutionResponse.json();
                        evolutionDetails = getEvolutionDetails(evolutionChain.chain, speciesId);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching evolution info:', error);
        }
        
        // Get Pokedex entries (already filtered to English by server)
        const pokedexEntries = species ? (species.flavor_text_entries || []) : [];
        
        return {
            pokemon,
            species,
            locationAreas,
            evolutionInfo,
            evolutionDetails,
            pokedexEntries
        };
    } catch (error) {
        console.error('Error fetching Pokemon data:', error);
        // Fallback to basic info
        let evolutionInfo = null;
        try {
            const evoResponse = await fetch(`/api/pokemon/evolution-info/${speciesId}`);
            if (evoResponse.ok) {
                evolutionInfo = await evoResponse.json();
            }
        } catch (error) {
            console.error('Error fetching evolution info:', error);
        }
        
        return {
            error: error.message,
            locationAreas: [],
            evolutionInfo,
            evolutionDetails: null,
            pokedexEntries: []
        };
    }
}

// Map game versions to generations
function getGenerationFromVersion(versionName) {
    const version = versionName.toLowerCase();
    
    // Generation 3 (check before Gen 1 to catch firered/leafgreen before they match 'red'/'green')
    if (version.includes('ruby') || version.includes('sapphire') || version.includes('emerald') ||
        version.includes('firered') || version.includes('leafgreen') || version.includes('fire-red') || version.includes('leaf-green')) {
        return 3;
    }
    // Generation 1
    if (version.includes('red') || version.includes('blue') || version.includes('yellow')) {
        return 1;
    }
    // Generation 2
    if (version.includes('gold') || version.includes('silver') || version.includes('crystal')) {
        return 2;
    }
    // Generation 4
    if (version.includes('diamond') || version.includes('pearl') || version.includes('platinum') ||
        version.includes('heartgold') || version.includes('soulsilver') || version.includes('heart-gold') || version.includes('soul-silver')) {
        return 4;
    }
    // Generation 5
    if (version.includes('black') || version.includes('white')) {
        return 5;
    }
    // Generation 6
    if (version.includes('x') || version.includes('y') || 
        version.includes('omega-ruby') || version.includes('alpha-sapphire') ||
        version.includes('omegaruby') || version.includes('alphasapphire')) {
        return 6;
    }
    // Generation 7
    if (version.includes('sun') || version.includes('moon') || version.includes('ultra')) {
        return 7;
    }
    // Generation 8
    if (version.includes('sword') || version.includes('shield') ||
        version.includes('brilliant-diamond') || version.includes('shining-pearl') ||
        version.includes('brilliantdiamond') || version.includes('shiningpearl') ||
        version.includes('legends-arceus') || version.includes('legendsarceus')) {
        return 8;
    }
    // Generation 9
    if (version.includes('scarlet') || version.includes('violet')) {
        return 9;
    }
    
    return null;
}

// Fetch location areas where Pokemon can be found (using server-side endpoint)
async function fetchLocationAreas(speciesId) {
    try {
        const response = await fetch(`/api/pokemon/encounters/${speciesId}`);
        if (!response.ok) {
            return {};
        }
        const encounters = await response.json();
        
        // Group by location - store ALL data, don't filter here
        const locations = {};
        encounters.forEach(encounter => {
            const locationName = encounter.location_area.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            if (!locations[locationName]) {
                locations[locationName] = [];
            }
            encounter.version_details.forEach(versionDetail => {
                const versionName = versionDetail.version.name;
                const gen = getGenerationFromVersion(versionName);
                
                versionDetail.encounter_details.forEach(detail => {
                    locations[locationName].push({
                        method: detail.method.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                        chance: detail.chance,
                        minLevel: detail.min_level,
                        maxLevel: detail.max_level,
                        version: versionName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                        generation: gen
                    });
                });
            });
        });
        
        return locations;
    } catch (error) {
        console.error('Error fetching location areas:', error);
        return {};
    }
}

// Get generation for a species ID
function getGenerationForSpecies(speciesId) {
    if (speciesId >= 1 && speciesId <= 151) return 1;
    if (speciesId >= 152 && speciesId <= 251) return 2;
    if (speciesId >= 252 && speciesId <= 386) return 3;
    if (speciesId >= 387 && speciesId <= 493) return 4;
    if (speciesId >= 494 && speciesId <= 649) return 5;
    if (speciesId >= 650 && speciesId <= 721) return 6;
    if (speciesId >= 722 && speciesId <= 809) return 7;
    if (speciesId >= 810 && speciesId <= 905) return 8;
    if (speciesId >= 906 && speciesId <= 1025) return 9;
    return null;
}

// Check if a species ID is in available generations
function isSpeciesInAvailableGenerations(speciesId) {
    if (!availableGenerations || availableGenerations.length === 0) {
        return true; // If no filter, show all
    }
    const gen = getGenerationForSpecies(speciesId);
    return gen && availableGenerations.includes(gen);
}


// Get evolution details from PokeAPI evolution chain
function getEvolutionDetails(chain, targetSpeciesId) {
    const details = { evolvesFrom: null, evolvesInto: [] };
    
    // Helper to extract species ID from URL
    function getSpeciesIdFromUrl(url) {
        const parts = url.split('/').filter(p => p);
        return parseInt(parts[parts.length - 1]);
    }
    
    // Find the target Pokemon in the chain and its direct relationships
    function findTarget(node, parentSpeciesId = null) {
        const currentSpeciesId = getSpeciesIdFromUrl(node.species.url);
        
        // Check if this is the target Pokemon
        if (currentSpeciesId === targetSpeciesId) {
            // This is the target - find what it evolves into (direct children only)
            // Only add if evolution_details exists and has valid data (not empty)
            if (node.evolves_to && node.evolves_to.length > 0) {
                node.evolves_to.forEach(evolution => {
                    // Only process if evolution_details exists and is not empty
                    // A valid evolution MUST have evolution_details
                    if (!evolution.evolution_details || evolution.evolution_details.length === 0) {
                        return; // Skip - not a valid evolution
                    }
                    
                    const evoId = getSpeciesIdFromUrl(evolution.species.url);
                    const evoName = evolution.species.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    
                    const evoDetails = evolution.evolution_details.map(detail => ({
                        trigger: detail.trigger && detail.trigger.name ? detail.trigger.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null,
                        minLevel: detail.min_level,
                        item: detail.item ? detail.item.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null,
                        timeOfDay: detail.time_of_day || null,
                        location: detail.location ? detail.location.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null,
                        heldItem: detail.held_item ? detail.held_item.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null,
                        knownMove: detail.known_move ? detail.known_move.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null,
                        minHappiness: detail.min_happiness,
                        minBeauty: detail.min_beauty,
                        minAffection: detail.min_affection,
                        needsOverworldRain: detail.needs_overworld_rain,
                        partySpecies: detail.party_species ? detail.party_species.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null,
                        partyType: detail.party_type ? detail.party_type.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null,
                        relativePhysicalStats: detail.relative_physical_stats,
                        turnUpsideDown: detail.turn_upside_down
                    }));
                    
                    details.evolvesInto.push({ id: evoId, name: evoName, details: evoDetails });
                });
            }
            
            // If we have a parent, that's what it evolves from
            if (parentSpeciesId !== null) {
                const parentName = node.species.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                // Find the evolution details from parent to this Pokemon
                // We need to look back at the parent node, but we'll handle this differently
                return { found: true, isTarget: true };
            }
            
            return { found: true, isTarget: true };
        }
        
        // Check if any direct child is the target (meaning this is the parent)
        // Only process if evolution_details exists and is valid
        if (node.evolves_to && node.evolves_to.length > 0) {
            for (const evolution of node.evolves_to) {
                // Only process if evolution_details exists and is not empty
                // A valid evolution MUST have evolution_details
                if (!evolution.evolution_details || evolution.evolution_details.length === 0) {
                    continue; // Skip - not a valid evolution
                }
                
                const evoId = getSpeciesIdFromUrl(evolution.species.url);
                if (evoId === targetSpeciesId) {
                    // This node is the parent of the target
                    const preEvoId = currentSpeciesId;
                    const preEvoName = node.species.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    
                    const preEvoDetails = evolution.evolution_details.map(detail => ({
                        trigger: detail.trigger && detail.trigger.name ? detail.trigger.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null,
                        minLevel: detail.min_level,
                        item: detail.item ? detail.item.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null,
                        timeOfDay: detail.time_of_day || null,
                        location: detail.location ? detail.location.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null,
                        heldItem: detail.held_item ? detail.held_item.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null,
                        knownMove: detail.known_move ? detail.known_move.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null,
                        minHappiness: detail.min_happiness,
                        minBeauty: detail.min_beauty,
                        minAffection: detail.min_affection,
                        needsOverworldRain: detail.needs_overworld_rain,
                        partySpecies: detail.party_species ? detail.party_species.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null,
                        partyType: detail.party_type ? detail.party_type.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null,
                        relativePhysicalStats: detail.relative_physical_stats,
                        turnUpsideDown: detail.turn_upside_down
                    }));
                    
                    details.evolvesFrom = { id: preEvoId, name: preEvoName, details: preEvoDetails };
                    return { found: true, isTarget: false };
                }
            }
        }
        
        // Continue searching in children
        if (node.evolves_to && node.evolves_to.length > 0) {
            for (const child of node.evolves_to) {
                const result = findTarget(child, currentSpeciesId);
                if (result && result.found) {
                    return result;
                }
            }
        }
        
        return { found: false };
    }
    
    findTarget(chain);
    return details;
}

// Format Pokemon information for display
function formatPokemonInfo(data, speciesId, speciesName) {
    const { pokemon, locationAreas, evolutionInfo, evolutionDetails, pokedexEntries, error } = data;
    
    let html = '<div class="pokemon-info-container">';
    
    // Basic info section
    html += '<div class="pokemon-info-section">';
    html += '<h3>Basic Information</h3>';
    
    if (pokemon) {
        const spriteUrl = getSpriteUrl(speciesId, false);
        html += `<div class="pokemon-info-sprite-container">`;
        html += `<div class="pokemon-info-sprite"><img id="pokemonInfoSprite" src="${spriteUrl}" alt="${speciesName}" data-species-id="${speciesId}"></div>`;
        html += `<div class="sprite-toggle-container">`;
        html += `<button type="button" id="pokemonInfoShinyToggle" class="sprite-toggle-button shiny-toggle-btn">`;
        html += `<span class="shiny-icon">✨</span>`;
        html += `<span class="shiny-text">Shiny</span>`;
        html += `</button>`;
        html += `</div>`;
        html += `</div>`;
        html += `<p><strong>Name:</strong> ${speciesName}</p>`;
        html += `<p><strong>ID:</strong> #${speciesId}</p>`;
        html += `<p><strong>Height:</strong> ${(pokemon.height / 10).toFixed(1)} m</p>`;
        html += `<p><strong>Weight:</strong> ${(pokemon.weight / 10).toFixed(1)} kg</p>`;
        html += `<p><strong>Base Experience:</strong> ${pokemon.base_experience || 'N/A'}</p>`;
        
        // Types
        if (pokemon.types && pokemon.types.length > 0) {
            html += '<p><strong>Types:</strong> ';
            html += pokemon.types.map(t => t.type.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ');
            html += '</p>';
        }
        
        // Abilities
        if (pokemon.abilities && pokemon.abilities.length > 0) {
            html += '<p><strong>Abilities:</strong> ';
            html += pokemon.abilities.map(a => {
                const name = a.ability.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                return a.is_hidden ? `${name} (Hidden)` : name;
            }).join(', ');
            html += '</p>';
        }
    } else {
        html += `<p><strong>Name:</strong> ${speciesName}</p>`;
        html += `<p><strong>ID:</strong> #${speciesId}</p>`;
    }
    
    html += '</div>';
    
    // Unown Forms section (only for Unown - species 201)
    if (speciesId === 201) {
        html += '<div class="pokemon-info-section unown-forms-section">';
        html += '<h3>Unown Forms</h3>';
        html += '<div class="unown-forms-grid" id="unownFormsGrid">';
        html += '<div class="loading">Loading Unown forms...</div>';
        html += '</div>';
        html += '</div>';
    }
    
    // Statistics section - show collection stats for this species
    const speciesStats = calculateSpeciesStatistics(speciesId);
    if (speciesStats && speciesStats.count > 0) {
        html += '<div class="pokemon-info-section statistics-section">';
        html += '<h3>Collection Statistics</h3>';
        html += `<p><strong>Total in Database:</strong> ${speciesStats.count}</p>`;
        if (speciesStats.shinyCount > 0) {
            html += `<p><strong>Shiny Count:</strong> ${speciesStats.shinyCount}</p>`;
        }
        if (speciesStats.avgIVSum > 0 || speciesStats.maxIVSum > 0) {
            html += `<p><strong>Average IV Sum:</strong> ${speciesStats.avgIVSum > 0 ? speciesStats.avgIVSum.toFixed(1) : '0.0'}</p>`;
            html += `<p><strong>Maximum IV Sum:</strong> ${speciesStats.maxIVSum}</p>`;
            if (speciesStats.count > 1 && speciesStats.minIVSum < speciesStats.maxIVSum) {
                html += `<p><strong>Minimum IV Sum:</strong> ${speciesStats.minIVSum}</p>`;
            }
        }
        if (speciesStats.avgLevel > 0) {
            html += `<p><strong>Average Level:</strong> ${speciesStats.avgLevel.toFixed(1)}</p>`;
            if (speciesStats.count > 1) {
                html += `<p><strong>Level Range:</strong> ${speciesStats.minLevel} - ${speciesStats.maxLevel}</p>`;
            }
        }
        html += '</div>';
    }
    
    // Evolution section
    html += '<div class="pokemon-info-section evolution-section">';
    html += '<h3>Evolution</h3>';
    
    // Validate evolution data - reject obviously incorrect relationships
    // Known non-evolving Pokemon in Gen 3: Seviper (336), Zangoose (335), Lunatone (337), Solrock (338),
    // Altaria (334), Whiscash (340), Camerupt (323), Beautifly (267), Stantler (234), Unown (201)
    const nonEvolvingPokemon = [201, 234, 267, 323, 334, 335, 336, 337, 338, 340];
    const hasInvalidEvolutionData = nonEvolvingPokemon.includes(speciesId);
    
    // Check if there's actual evolution data (not just empty objects)
    // Skip if this Pokemon is known to not evolve
    let hasEvolutionData = !hasInvalidEvolutionData && ((evolutionDetails && (
        evolutionDetails.evolvesFrom || 
        (evolutionDetails.evolvesInto && evolutionDetails.evolvesInto.length > 0)
    )) || (evolutionInfo && (
        evolutionInfo.evolvesFrom || 
        evolutionInfo.evolvesInto
    )));
    
    if (hasEvolutionData) {
        // Use evolutionDetails from PokeAPI if available, otherwise fall back to evolutionInfo
        if (evolutionDetails && evolutionDetails.evolvesFrom) {
            let preEvoName = speciesCache.get(evolutionDetails.evolvesFrom.id) || evolutionDetails.evolvesFrom.name;
            html += `<p><strong>Evolves from:</strong> <span class="pokemon-link" data-species="${evolutionDetails.evolvesFrom.id}">#${evolutionDetails.evolvesFrom.id} ${preEvoName}</span></p>`;
            if (evolutionDetails.evolvesFrom.details && evolutionDetails.evolvesFrom.details.length > 0) {
                html += '<ul class="evolution-conditions">';
                evolutionDetails.evolvesFrom.details.forEach(detail => {
                    html += formatEvolutionCondition(detail);
                });
                html += '</ul>';
            }
        } else if (evolutionInfo && evolutionInfo.evolvesFrom) {
            let preEvoName = speciesCache.get(evolutionInfo.evolvesFrom);
            if (!preEvoName) {
                preEvoName = `#${evolutionInfo.evolvesFrom}`;
                getSpeciesName(evolutionInfo.evolvesFrom).then(name => {
                    const content = document.getElementById('pokemonInfoContent');
                    if (content) {
                        const link = content.querySelector(`.pokemon-link[data-species="${evolutionInfo.evolvesFrom}"]`);
                        if (link) {
                            link.textContent = `#${evolutionInfo.evolvesFrom} ${name}`;
                        }
                    }
                }).catch(() => {});
            }
            html += `<p><strong>Evolves from:</strong> <span class="pokemon-link" data-species="${evolutionInfo.evolvesFrom}">#${evolutionInfo.evolvesFrom} ${preEvoName}</span></p>`;
        }
        
        if (evolutionDetails && evolutionDetails.evolvesInto && evolutionDetails.evolvesInto.length > 0) {
            evolutionDetails.evolvesInto.forEach(evo => {
                let evoName = speciesCache.get(evo.id) || evo.name;
                html += `<p><strong>Evolves into:</strong> <span class="pokemon-link" data-species="${evo.id}">#${evo.id} ${evoName}</span></p>`;
                if (evo.details && evo.details.length > 0) {
                    html += '<ul class="evolution-conditions">';
                    evo.details.forEach(detail => {
                        html += formatEvolutionCondition(detail);
                    });
                    html += '</ul>';
                }
            });
        } else if (evolutionInfo && evolutionInfo.evolvesInto) {
            let evoName = speciesCache.get(evolutionInfo.evolvesInto);
            if (!evoName) {
                evoName = `#${evolutionInfo.evolvesInto}`;
                getSpeciesName(evolutionInfo.evolvesInto).then(name => {
                    const content = document.getElementById('pokemonInfoContent');
                    if (content) {
                        const link = content.querySelector(`.pokemon-link[data-species="${evolutionInfo.evolvesInto}"]`);
                        if (link) {
                            link.textContent = `#${evolutionInfo.evolvesInto} ${name}`;
                        }
                    }
                }).catch(() => {});
            }
            html += `<p><strong>Evolves into:</strong> <span class="pokemon-link" data-species="${evolutionInfo.evolvesInto}">#${evolutionInfo.evolvesInto} ${evoName}</span></p>`;
        }
    } else {
        // No evolution data - Pokemon does not evolve
        html += '<p>This Pokemon does not evolve.</p>';
    }
    
    html += '</div>';
    
    // Pokedex text section
    if (pokedexEntries && pokedexEntries.length > 0) {
        html += '<div class="pokemon-info-section pokedex-text-section">';
        html += '<h3>Pokedex Entry</h3>';
        
        // Filter to English entries only
        const englishEntries = pokedexEntries.filter(entry => 
            entry.language && entry.language.name === 'en'
        );
        
        // Get unique games from English entries
        const games = new Set();
        englishEntries.forEach(entry => {
            if (entry.version && entry.version.name) {
                games.add(entry.version.name);
            }
        });
        const sortedGames = Array.from(games).sort();
        
        if (sortedGames.length > 0) {
            html += '<div class="pokedex-game-filter">';
            html += '<label for="pokedexGameSelect"><strong>Game:</strong></label>';
            html += '<select id="pokedexGameSelect" class="pokedex-game-selector">';
            sortedGames.forEach((game, index) => {
                const gameName = game.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                html += `<option value="${game}" ${index === 0 ? 'selected' : ''}>${gameName}</option>`;
            });
            html += '</select>';
            html += '</div>';
            
            html += '<div class="pokedex-text-container" data-entries="' + encodeURIComponent(JSON.stringify(englishEntries)) + '">';
            // Show first game's entry by default
            const firstGame = sortedGames[0];
            const firstEntry = englishEntries.find(e => e.version && e.version.name === firstGame);
            if (firstEntry) {
                html += `<p class="pokedex-text">${firstEntry.flavor_text.replace(/\f/g, ' ').replace(/\n/g, ' ')}</p>`;
            }
            html += '</div>';
        } else {
            html += '<p>No Pokedex entries available.</p>';
        }
        
        html += '</div>';
    }
    
    
    // Location section
    html += '<div class="pokemon-info-section location-section">';
    html += '<h3>Where to Find</h3>';
    
    if (locationAreas && Object.keys(locationAreas).length > 0) {
        // Get unique generations from location data
        const allGens = new Set();
        Object.values(locationAreas).forEach(encounters => {
            encounters.forEach(encounter => {
                if (encounter.generation) {
                    allGens.add(encounter.generation);
                }
            });
        });
        const sortedGens = Array.from(allGens).sort((a, b) => a - b);
        
        // Add generation selector
        // Determine initial selection: if availableGenerations has exactly one gen, select it; otherwise "all"
        const initialGenSelection = (availableGenerations && availableGenerations.length === 1) 
            ? availableGenerations[0].toString() 
            : 'all';
        
        html += '<div class="location-filter">';
        html += '<label for="locationGenFilter"><strong>Filter by Generation:</strong></label>';
        html += '<select id="locationGenFilter" class="location-gen-selector">';
        html += `<option value="all" ${initialGenSelection === 'all' ? 'selected' : ''}>All Generations</option>`;
        sortedGens.forEach(gen => {
            html += `<option value="${gen}" ${initialGenSelection === gen.toString() ? 'selected' : ''}>Generation ${gen}</option>`;
        });
        html += '</select>';
        html += '</div>';
        
        // Store all location data in data attribute for filtering
        html += '<div class="location-list" data-all-locations="' + encodeURIComponent(JSON.stringify(locationAreas)) + '">';
        // Initial display - show all or filtered by availableGenerations (if single gen)
        const initialFilter = (availableGenerations && availableGenerations.length === 1) 
            ? availableGenerations 
            : null;
        const filteredLocations = filterLocationsByGeneration(locationAreas, initialFilter);
        
        if (Object.keys(filteredLocations).length > 0) {
            Object.entries(filteredLocations).forEach(([location, encounters]) => {
                html += `<div class="location-item" data-location="${encodeURIComponent(location)}">`;
                html += `<strong>${location}</strong>`;
                html += '<ul>';
                encounters.forEach(encounter => {
                    html += `<li>${encounter.method} (${encounter.version})`;
                    if (encounter.minLevel && encounter.maxLevel) {
                        html += ` - Level ${encounter.minLevel}-${encounter.maxLevel}`;
                    }
                    if (encounter.chance) {
                        html += ` - ${encounter.chance}% chance`;
                    }
                    html += '</li>';
                });
                html += '</ul>';
                html += '</div>';
            });
        } else {
            html += '<p>No location data available for the selected generation.</p>';
        }
        html += '</div>';
    } else {
        html += '<p>Location data not available for this Pokemon.</p>';
    }
    
    html += '</div>';
    html += '</div>';
    
    // Add event delegation for pokemon links and generation filter after content is set
    setTimeout(() => {
        const content = document.getElementById('pokemonInfoContent');
        if (content) {
            // Pokemon link clicks
            content.addEventListener('click', (e) => {
                const link = e.target.closest('.pokemon-link');
                if (link) {
                    const speciesId = parseInt(link.dataset.species);
                    if (speciesId) {
                        showPokemonInfo(speciesId);
                    }
                }
            });
            
            // Generation filter for locations
            const genFilter = content.querySelector('#locationGenFilter');
            if (genFilter) {
                genFilter.addEventListener('change', (e) => {
                    const selectedGen = e.target.value === 'all' ? null : parseInt(e.target.value);
                    const locationList = content.querySelector('.location-list');
                    if (locationList && locationList.dataset.allLocations) {
                        const allLocations = JSON.parse(decodeURIComponent(locationList.dataset.allLocations));
                        const filtered = filterLocationsByGeneration(allLocations, selectedGen ? [selectedGen] : null);
                        updateLocationDisplay(locationList, filtered);
                    }
                });
            }
            
            // Shiny sprite toggle (button)
            const shinyToggle = content.querySelector('#pokemonInfoShinyToggle');
            const spriteImg = content.querySelector('#pokemonInfoSprite');
            let isShiny = false;
            if (shinyToggle && spriteImg) {
                shinyToggle.addEventListener('click', () => {
                    isShiny = !isShiny;
                    const speciesId = parseInt(spriteImg.dataset.speciesId);
                    if (speciesId) {
                        const newSpriteUrl = getSpriteUrl(speciesId, isShiny);
                        if (newSpriteUrl) {
                            spriteImg.src = newSpriteUrl;
                        }
                        // Update button appearance
                        const icon = shinyToggle.querySelector('.shiny-icon');
                        const text = shinyToggle.querySelector('.shiny-text');
                        if (isShiny) {
                            shinyToggle.classList.add('active');
                            if (icon) icon.textContent = '⭐';
                            if (text) text.textContent = 'Normal';
                        } else {
                            shinyToggle.classList.remove('active');
                            if (icon) icon.textContent = '✨';
                            if (text) text.textContent = 'Shiny';
                        }
                    }
                });
            }
            
            // Pokedex game selector
            const pokedexGameSelect = content.querySelector('#pokedexGameSelect');
            const pokedexTextContainer = content.querySelector('.pokedex-text-container');
            if (pokedexGameSelect && pokedexTextContainer) {
                pokedexGameSelect.addEventListener('change', (e) => {
                    const selectedGame = e.target.value;
                    const entries = JSON.parse(decodeURIComponent(pokedexTextContainer.dataset.entries));
                    // Ensure we only get English entries
                    const entry = entries.find(e => 
                        e.version && e.version.name === selectedGame && 
                        e.language && e.language.name === 'en'
                    );
                    if (entry) {
                        const textElement = pokedexTextContainer.querySelector('.pokedex-text');
                        if (textElement) {
                            textElement.textContent = entry.flavor_text.replace(/\f/g, ' ').replace(/\n/g, ' ');
                        } else {
                            pokedexTextContainer.innerHTML = `<p class="pokedex-text">${entry.flavor_text.replace(/\f/g, ' ').replace(/\n/g, ' ')}</p>`;
                        }
                    }
                });
            }
        }
    }, 0);
    
    return html;
}

// Format evolution condition details
function formatEvolutionCondition(detail) {
    let html = '<li>';
    const conditions = [];
    
    if (detail.trigger) {
        if (detail.trigger.toLowerCase() === 'level-up') {
            if (detail.minLevel) {
                conditions.push(`Level ${detail.minLevel}`);
            } else {
                conditions.push('Level up');
            }
        } else {
            conditions.push(detail.trigger);
            if (detail.minLevel) {
                conditions.push(`at Level ${detail.minLevel}`);
            }
        }
    }
    
    if (detail.item) {
        conditions.push(`using ${detail.item}`);
    }
    
    if (detail.heldItem) {
        conditions.push(`holding ${detail.heldItem}`);
    }
    
    if (detail.location) {
        conditions.push(`at ${detail.location}`);
    }
    
    if (detail.timeOfDay) {
        conditions.push(`during ${detail.timeOfDay}`);
    }
    
    if (detail.knownMove) {
        conditions.push(`knowing ${detail.knownMove}`);
    }
    
    if (detail.minHappiness) {
        conditions.push(`with ${detail.minHappiness} happiness`);
    }
    
    if (detail.minBeauty) {
        conditions.push(`with ${detail.minBeauty} beauty`);
    }
    
    if (detail.minAffection) {
        conditions.push(`with ${detail.minAffection} affection`);
    }
    
    if (detail.needsOverworldRain) {
        conditions.push('in rain');
    }
    
    if (detail.partySpecies) {
        conditions.push(`with ${detail.partySpecies} in party`);
    }
    
    if (detail.partyType) {
        conditions.push(`with ${detail.partyType} type in party`);
    }
    
    if (detail.turnUpsideDown) {
        conditions.push('(turn upside down)');
    }
    
    html += conditions.length > 0 ? conditions.join(' ') : 'Unknown condition';
    html += '</li>';
    return html;
}

// Filter locations by generation
function filterLocationsByGeneration(locationAreas, generations) {
    if (!locationAreas || Object.keys(locationAreas).length === 0) {
        return {};
    }
    
    // If no filter specified, return all
    if (!generations || generations.length === 0) {
        return locationAreas;
    }
    
    const filtered = {};
    Object.entries(locationAreas).forEach(([location, encounters]) => {
        const filteredEncounters = encounters.filter(encounter => {
            return encounter.generation && generations.includes(encounter.generation);
        });
        if (filteredEncounters.length > 0) {
            filtered[location] = filteredEncounters;
        }
    });
    
    return filtered;
}

// Update location display based on filtered data
function updateLocationDisplay(container, filteredLocations) {
    if (!container) return;
    
    // Clear existing location items
    const existingItems = container.querySelectorAll('.location-item');
    existingItems.forEach(item => item.remove());
    
    // Add filtered locations
    if (Object.keys(filteredLocations).length > 0) {
        Object.entries(filteredLocations).forEach(([location, encounters]) => {
            const locationItem = document.createElement('div');
            locationItem.className = 'location-item';
            locationItem.setAttribute('data-location', encodeURIComponent(location));
            
            let html = `<strong>${location}</strong>`;
            html += '<ul>';
            encounters.forEach(encounter => {
                html += `<li>${encounter.method} (${encounter.version})`;
                if (encounter.minLevel && encounter.maxLevel) {
                    html += ` - Level ${encounter.minLevel}-${encounter.maxLevel}`;
                }
                if (encounter.chance) {
                    html += ` - ${encounter.chance}% chance`;
                }
                html += '</li>';
            });
            html += '</ul>';
            
            locationItem.innerHTML = html;
            container.appendChild(locationItem);
        });
    } else {
        const noData = document.createElement('p');
        noData.textContent = 'No location data available for the selected generation.';
        container.appendChild(noData);
    }
}

// Map game names to PokeAPI version names
function getPokeAPIVersionName(game) {
    const versionMap = {
        'firered': 'fire-red',
        'leafgreen': 'leaf-green',
        'ruby': 'ruby',
        'sapphire': 'sapphire',
        'emerald': 'emerald'
    };
    return versionMap[game] || game;
}

// Format encounter method names for display
function formatEncounterMethod(method) {
    if (!method) return 'Unknown';
    
    const methodLower = method.toLowerCase();
    const methodMap = {
        'walk': 'Grass',
        'old-rod': 'Old Rod',
        'good-rod': 'Good Rod',
        'super-rod': 'Super Rod',
        'surf': 'Water',
        'rock-smash': 'Rock Smash',
        'headbutt': 'Headbutt',
        'cave': 'Cave',
        'land': 'Land',
        'water-edge': 'Water Edge',
        'water': 'Water',
        'fishing': 'Fishing',
        'special': 'Special',
        'gift': 'Gift',
        'trade': 'Trade',
        'event': 'Event'
    };
    
    // Check for exact matches first
    if (methodMap[methodLower]) {
        return methodMap[methodLower];
    }
    
    // Check for partial matches
    for (const [key, value] of Object.entries(methodMap)) {
        if (methodLower.includes(key)) {
            return value;
        }
    }
    
    // Default: capitalize first letter of each word
    return method.split(/[- ]/).map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
}

// Helper function to check if a Pokemon is legendary or mythical (Gen 3: 1-386)
function isLegendaryOrMythical(speciesId) {
    // Gen 1 legendaries
    if (speciesId === 144 || speciesId === 145 || speciesId === 146 || // Articuno, Zapdos, Moltres
        speciesId === 150 || // Mewtwo
        speciesId === 151) { // Mew
        return true;
    }
    // Gen 2 legendaries
    if (speciesId === 243 || speciesId === 244 || speciesId === 245 || // Raikou, Entei, Suicune
        speciesId === 249 || speciesId === 250) { // Lugia, Ho-Oh
        return true;
    }
    // Gen 3 legendaries
    if (speciesId === 377 || speciesId === 378 || speciesId === 379 || // Regirock, Regice, Registeel
        speciesId === 380 || speciesId === 381 || // Latias, Latios
        speciesId === 382 || speciesId === 383 || speciesId === 384 || // Kyogre, Groudon, Rayquaza
        speciesId === 385 || speciesId === 386) { // Jirachi, Deoxys
        return true;
    }
    return false;
}

// Pokedex Completion Planner
async function generatePlanner() {
    const game = plannerGameSelect.value;
    if (!game) {
        alert('Please select a game');
        return;
    }

    plannerLoading.classList.remove('hidden');
    plannerResults.classList.add('hidden');
    plannerSummaryContent.innerHTML = '';
    plannerEncountersContent.innerHTML = '';

    try {
        // Fetch owned Pokemon from pokedex
        const pokedexResponse = await fetch(`/api/pokedex?db=${currentDatabase}`);
        if (!pokedexResponse.ok) {
            throw new Error('Failed to fetch pokedex data');
        }
        const pokedexData = await pokedexResponse.json();
        const shinyOnly = document.getElementById('plannerShinyOnly')?.checked || false;
        
        // Get all Gen 3 Pokemon (1-386)
        const allGen3Species = new Set();
        for (let i = 1; i <= 386; i++) {
            allGen3Species.add(i);
        }

        // Find missing Pokemon (or missing shinies if checkbox is checked)
        const missingSpecies = [];
        for (const speciesId of allGen3Species) {
            const entry = pokedexData.pokedex?.[speciesId] || pokedexData.pokedex?.[String(speciesId)] || { owned: false, shiny: false };
            
            if (shinyOnly) {
                // Only show Pokemon that don't have a shiny (missing shiny)
                if (!entry.shiny) {
                    missingSpecies.push(speciesId);
                }
            } else {
                // Original logic: show Pokemon that aren't owned at all
                if (!entry.owned) {
                    missingSpecies.push(speciesId);
                }
            }
        }

        // Calculate how many of each Pokemon are needed (accounting for evolutions)
        // Map: speciesId -> count needed
        const pokemonNeededCounts = new Map();
        
        // Helper to find the base form (lowest in evolution chain) for a given species
        function findBaseForm(speciesId) {
            const preEvolutions = getPreEvolution(speciesId);
            if (!preEvolutions || preEvolutions.length === 0) {
                return speciesId; // This is already the base form
            }
            // Recursively find the base form - get the minimum species ID in the chain
            let baseForm = speciesId;
            for (const preId of preEvolutions) {
                const deeperBase = findBaseForm(preId);
                // Base form is the one with the lowest species ID (earliest in the chain)
                if (deeperBase < baseForm) {
                    baseForm = deeperBase;
                }
            }
            return baseForm;
        }
        
        // Helper to check if we have any evolution in the chain (including the species itself)
        function hasAnyInChain(speciesId) {
            const entry = pokedexData.pokedex?.[speciesId] || pokedexData.pokedex?.[String(speciesId)] || { owned: false, shiny: false };
            if (shinyOnly ? entry.shiny : entry.owned) {
                return true;
            }
            // Check all evolutions
            const evolutions = getAllEvolutionSpecies(speciesId, true);
            if (evolutions) {
                for (const evoId of evolutions) {
                    const evoEntry = pokedexData.pokedex?.[evoId] || pokedexData.pokedex?.[String(evoId)] || { owned: false, shiny: false };
                    if (shinyOnly ? evoEntry.shiny : evoEntry.owned) {
                        return true;
                    }
                }
            }
            return false;
        }
        
        // Group missing species by their base form (evolution chain)
        // Each evolution chain only needs 1 base form Pokemon, regardless of how many evolutions are missing
        const processedBaseForms = new Set();
        
        for (const speciesId of missingSpecies) {
            // Find the base form we need to catch
            const baseForm = findBaseForm(speciesId);
            
            // Only count each base form once, even if multiple evolutions in that chain are missing
            if (!processedBaseForms.has(baseForm)) {
                processedBaseForms.add(baseForm);
                
                // Check if we have any Pokemon in this evolution chain
                const hasInChain = hasAnyInChain(baseForm);
                
                // We only need 1 base form per evolution chain
                // If we already have something in the chain, we might still need 1 more to evolve
                // But typically, if we have something, we can evolve it, so we might not need another
                // For simplicity, if we don't have anything in the chain, we need 1 base form
                if (!hasInChain) {
                    pokemonNeededCounts.set(baseForm, 1);
                } else {
                    // We have something in the chain, but we're still missing evolutions
                    // This means we need 1 more base form to evolve (since we can't evolve the one we have)
                    pokemonNeededCounts.set(baseForm, 1);
                }
            }
        }

        // Map game to PokeAPI version name
        const pokeAPIVersion = getPokeAPIVersionName(game);

        // Build encounter map for missing Pokemon using PokeAPI location data
        // Only include Pokemon that we actually need to catch (from pokemonNeededCounts)
        const locationEncounters = new Map(); // location -> [{ speciesId, name, encounter, priority, count }]
        const pokemonEncounters = new Map(); // speciesId -> [encounters]

        // Fetch location data for each Pokemon we need to catch
        for (const [speciesId, count] of pokemonNeededCounts.entries()) {
            try {
                // Get Pokemon name
                const pokemonName = await getSpeciesName(speciesId);
                
                // Fetch location areas from PokeAPI
                const locationAreas = await fetchLocationAreas(speciesId);
                
                if (!locationAreas || Object.keys(locationAreas).length === 0) {
                    continue;
                }

                pokemonEncounters.set(speciesId, []);

                // Process each location
                for (const [locationName, encounters] of Object.entries(locationAreas)) {
                    // Filter encounters for the selected game version
                    const gameEncounters = encounters.filter(enc => {
                        const versionName = enc.version.toLowerCase().replace(/\s+/g, '-');
                        return versionName === pokeAPIVersion || 
                               versionName.includes(game.toLowerCase());
                    });

                    if (gameEncounters.length === 0) {
                        continue;
                    }

                    // Process each encounter
                    for (const enc of gameEncounters) {
                        // Skip non-wild encounters (trades, gifts, etc.)
                        const method = enc.method.toLowerCase();
                        if (method.includes('trade') || method.includes('gift') || 
                            method.includes('event') || method.includes('special')) {
                            continue;
                        }

                        const rate = enc.chance || 0;
                        const formattedMethod = formatEncounterMethod(enc.method);
                        
                        // Determine priority
                        let priority = 4; // Default: 1-time/special encounters
                        if (rate > 0) {
                            if (rate >= 10) {
                                priority = 2; // High probability
                            } else if (rate === 1) {
                                priority = 3; // 1% encounters
                            } else {
                                priority = 2; // Other wild encounters
                            }
                        } else {
                            priority = 4; // 1-time encounters
                        }

                        const encounterInfo = {
                            speciesId,
                            name: pokemonName,
                            count: count, // How many of this Pokemon are needed
                            encounter: {
                                method: enc.method,
                                formattedMethod: formattedMethod,
                                level: {
                                    min: enc.minLevel,
                                    max: enc.maxLevel
                                },
                                rate: rate
                            },
                            priority,
                            rate,
                            method: enc.method,
                            formattedMethod: formattedMethod,
                            location: locationName
                        };

                        pokemonEncounters.get(speciesId).push(encounterInfo);

                        // Group by location
                        if (!locationEncounters.has(locationName)) {
                            locationEncounters.set(locationName, []);
                        }
                        locationEncounters.get(locationName).push(encounterInfo);
                    }
                }
            } catch (error) {
                console.warn(`Failed to fetch location data for species ${speciesId}:`, error);
                continue;
            }
        }

        // Deduplicate Pokemon across locations - keep only on route with most other mons
        // First, build a map of species -> locations where it appears
        const speciesToLocations = new Map(); // speciesId -> [location names]
        for (const [location, encounters] of locationEncounters.entries()) {
            const uniqueSpecies = new Set(encounters.map(e => e.speciesId));
            for (const speciesId of uniqueSpecies) {
                if (!speciesToLocations.has(speciesId)) {
                    speciesToLocations.set(speciesId, []);
                }
                speciesToLocations.get(speciesId).push(location);
            }
        }

        // For each species that appears on multiple locations, keep only on the best one
        for (const [speciesId, locations] of speciesToLocations.entries()) {
            if (locations.length > 1) {
                // Find the location with the most other Pokemon
                let bestLocation = locations[0];
                let maxOtherMons = 0;

                for (const location of locations) {
                    const encounters = locationEncounters.get(location);
                    const uniqueSpecies = new Set(encounters.map(e => e.speciesId));
                    // Count other Pokemon (excluding current species)
                    const otherMonsCount = uniqueSpecies.size - 1;
                    if (otherMonsCount > maxOtherMons) {
                        maxOtherMons = otherMonsCount;
                        bestLocation = location;
                    }
                }

                // Remove this species from all other locations
                for (const location of locations) {
                    if (location !== bestLocation) {
                        const encounters = locationEncounters.get(location);
                        locationEncounters.set(
                            location,
                            encounters.filter(e => e.speciesId !== speciesId)
                        );
                    }
                }
            }
        }

        // Deduplicate encounters within each location - keep only highest probability encounter per Pokemon
        for (const [location, encounters] of locationEncounters.entries()) {
            // Group encounters by speciesId
            const encountersBySpecies = new Map(); // speciesId -> [encounters]
            for (const enc of encounters) {
                if (!encountersBySpecies.has(enc.speciesId)) {
                    encountersBySpecies.set(enc.speciesId, []);
                }
                encountersBySpecies.get(enc.speciesId).push(enc);
            }
            
            // For each species, keep only the encounter with highest rate
            const deduplicatedEncounters = [];
            for (const [speciesId, speciesEncounters] of encountersBySpecies.entries()) {
                if (speciesEncounters.length === 1) {
                    // Only one encounter, keep it
                    deduplicatedEncounters.push(speciesEncounters[0]);
                } else {
                    // Multiple encounters for same species, keep the one with highest rate
                    // If rates are equal, prefer higher priority, then better method
                    const bestEncounter = speciesEncounters.reduce((best, current) => {
                        const currentRate = current.rate || 0;
                        const bestRate = best.rate || 0;
                        
                        // First compare by rate
                        if (currentRate > bestRate) return current;
                        if (currentRate < bestRate) return best;
                        
                        // Rates are equal, compare by priority (lower number = higher priority)
                        if (current.priority < best.priority) return current;
                        if (current.priority > best.priority) return best;
                        
                        // Same priority, keep the first one (or could compare by method)
                        return best;
                    });
                    deduplicatedEncounters.push(bestEncounter);
                }
            }
            
            // Update the location with deduplicated encounters
            locationEncounters.set(location, deduplicatedEncounters);
        }

        // Count Pokemon per location for prioritization
        const locationCounts = new Map();
        for (const [location, encounters] of locationEncounters.entries()) {
            const uniqueSpecies = new Set(encounters.map(e => e.speciesId));
            locationCounts.set(location, uniqueSpecies.size);
        }

        // Sort locations by priority:
        // 1. Total Pokemon needed (highest first - most efficient locations)
        // 2. Routes with multiple encounters (highest count first)
        // 3. High probability encounters (rate >= 10%)
        // 4. Other encounters sorted by rate (descending)
        // 5. 1-time encounters (alphabetical)
        // 6. Legendary encounters (near bottom, but above empty locations)
        // 7. Empty locations (very bottom)
        const sortedLocations = Array.from(locationEncounters.entries()).sort((a, b) => {
            const [locationA, encountersA] = a;
            const [locationB, encountersB] = b;
            const countA = locationCounts.get(locationA);
            const countB = locationCounts.get(locationB);

            // Check if locations are empty (no encounters)
            const isEmptyA = countA === 0 || encountersA.length === 0;
            const isEmptyB = countB === 0 || encountersB.length === 0;

            // Highest priority: push empty locations to the very bottom
            if (isEmptyA && !isEmptyB) return 1;
            if (!isEmptyA && isEmptyB) return -1;

            // Check if locations contain legendaries (only if not empty)
            const hasLegendaryA = !isEmptyA && encountersA.some(e => isLegendaryOrMythical(e.speciesId));
            const hasLegendaryB = !isEmptyB && encountersB.some(e => isLegendaryOrMythical(e.speciesId));

            // Second priority: push legendary locations near the bottom (but above empty)
            if (hasLegendaryA && !hasLegendaryB) return 1;
            if (!hasLegendaryA && hasLegendaryB) return -1;

            // Calculate total Pokemon needed for each location
            const totalNeededA = encountersA.reduce((sum, enc) => sum + (enc.count || 1), 0);
            const totalNeededB = encountersB.reduce((sum, enc) => sum + (enc.count || 1), 0);

            // First priority: sort by total needed (descending - most needed first)
            if (totalNeededA !== totalNeededB) {
                return totalNeededB - totalNeededA;
            }

            // If totals are equal, prioritize locations with multiple Pokemon (count > 1)
            if (countA > 1 && countB <= 1) return -1;
            if (countA <= 1 && countB > 1) return 1;
            if (countA > 1 && countB > 1) {
                // Both have multiple, sort by count descending
                return countB - countA;
            }

            // Second priority: highest encounter rate
            const maxRateA = Math.max(...encountersA.map(e => e.rate || 0));
            const maxRateB = Math.max(...encountersB.map(e => e.rate || 0));
            
            // Prioritize high rate encounters (>= 10%)
            if (maxRateA >= 10 && maxRateB < 10) return -1;
            if (maxRateA < 10 && maxRateB >= 10) return 1;
            
            // If both are high rate, sort by rate descending
            if (maxRateA >= 10 && maxRateB >= 10) {
                return maxRateB - maxRateA;
            }
            
            // If both are low rate, sort by rate descending (higher rates first)
            if (maxRateA !== maxRateB) {
                return maxRateB - maxRateA;
            }

            // Same rate or both have no rate, sort alphabetically
            return locationA.localeCompare(locationB);
        });

        // Display summary
        const totalMissing = missingSpecies.length;
        const withEncounters = Array.from(pokemonEncounters.values()).filter(e => e.length > 0).length;
        const withoutEncounters = totalMissing - withEncounters;
        const multiEncounterLocations = Array.from(locationCounts.values()).filter(c => c > 1).length;
        const missingLabel = shinyOnly ? 'Missing Shinies' : 'Total Missing';

        plannerSummaryContent.innerHTML = `
            <div class="planner-stat">
                <strong>${missingLabel}:</strong> ${totalMissing} Pokemon
            </div>
            <div class="planner-stat">
                <strong>With Encounters:</strong> ${withEncounters} Pokemon
            </div>
            <div class="planner-stat">
                <strong>Without Encounters:</strong> ${withoutEncounters} Pokemon (evolutions, trades, etc.)
            </div>
            <div class="planner-stat">
                <strong>Multi-Encounter Locations:</strong> ${multiEncounterLocations} locations
            </div>
        `;

        // Display encounters
        let html = '';
        for (const [location, encounters] of sortedLocations) {
            const count = locationCounts.get(location);
            const isMultiEncounter = count > 1;
            
            // Calculate total count needed for this location
            const totalNeeded = encounters.reduce((sum, enc) => sum + (enc.count || 1), 0);
            const hasMultipleNeeded = encounters.some(enc => (enc.count || 1) > 1);
            
            html += `<div class="planner-location ${isMultiEncounter ? 'multi-encounter' : ''}">`;
            html += `<h4>${location} ${isMultiEncounter ? `<span class="badge">${count} Pokemon</span>` : ''}`;
            if (totalNeeded > count || hasMultipleNeeded) {
                html += ` <span class="badge total-needed-badge">${totalNeeded} needed</span>`;
            }
            html += `</h4>`;
            html += '<ul class="planner-encounter-list">';
            
            // Sort encounters within location by priority and rate
            // Legendaries go to the bottom
            const sortedEncounters = encounters.sort((a, b) => {
                // First, check if either is legendary - push legendaries to bottom
                const isLegendaryA = isLegendaryOrMythical(a.speciesId);
                const isLegendaryB = isLegendaryOrMythical(b.speciesId);
                if (isLegendaryA && !isLegendaryB) return 1;
                if (!isLegendaryA && isLegendaryB) return -1;
                
                // Then sort by priority and rate
                if (a.priority !== b.priority) return a.priority - b.priority;
                return (b.rate || 0) - (a.rate || 0);
            });

            for (const enc of sortedEncounters) {
                html += '<li class="planner-encounter-item">';
                html += `<strong>#${enc.speciesId} ${enc.name}</strong>`;
                
                // Show count for how many are needed (always show, including 1)
                if (enc.count && enc.count > 0) {
                    html += ` <span class="pokemon-count-badge">${enc.count > 1 ? '+' : ''}${enc.count}</span>`;
                }
                
                // Show encounter method (Grass, Water, Fishing, etc.)
                const methodDisplay = enc.formattedMethod || formatEncounterMethod(enc.method || 'Unknown');
                html += ` <span class="encounter-method">[${methodDisplay}]</span>`;
                
                if (enc.rate !== null && enc.rate > 0) {
                    html += ` - ${enc.rate}%`;
                } else if (enc.method && (enc.method.includes('Special') || enc.method.includes('Legendary'))) {
                    html += ` - ${enc.method}`;
                }
                if (enc.encounter && enc.encounter.level) {
                    const level = enc.encounter.level;
                    if (level.min && level.max) {
                        html += ` (Level ${level.min}-${level.max})`;
                    } else if (level.min) {
                        html += ` (Level ${level.min})`;
                    }
                }
                html += '</li>';
            }
            html += '</ul>';
            html += '</div>';
        }

        if (html === '') {
            html = '<p>No encounter data available for missing Pokemon.</p>';
        }

        plannerEncountersContent.innerHTML = html;
        plannerLoading.classList.add('hidden');
        plannerResults.classList.remove('hidden');
    } catch (error) {
        console.error('Error generating planner:', error);
        plannerLoading.classList.add('hidden');
        plannerSummaryContent.innerHTML = `<p class="error">Error: ${error.message}</p>`;
        plannerResults.classList.remove('hidden');
    }
}


