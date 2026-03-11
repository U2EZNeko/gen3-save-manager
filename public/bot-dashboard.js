// Bot Dashboard JavaScript
// Based on PokeDash: https://github.com/Dan-Mizu/PokeDash

// Bot instances storage (will be loaded from server)
let botInstances = [];

const DEFAULT_BOT_CARD_SECTION_ORDER = [
    'encounterRate',
    'targetPokemon',
    'currentLocation',
    'party',
    'recentFinds',
    'currentEncounter',
    'statistics',
    'currentPhase',
    'emulator',
    'game',
    'player',
    'totalStats'
];

const BOT_CARD_SECTION_LABELS = {
    encounterRate: 'Encounter Rate',
    targetPokemon: 'Target Pokemon',
    currentLocation: 'Current Location',
    party: 'Current Party',
    recentFinds: 'Recent Finds',
    currentEncounter: 'Current Encounter',
    statistics: 'Statistics',
    currentPhase: 'Current Phase',
    emulator: 'Emulator Info',
    game: 'Game',
    player: 'Player Info',
    totalStats: 'Total Stats'
};

function normalizeBotCardSectionOrder(order) {
    const valid = Array.isArray(order) ? order.filter(key => DEFAULT_BOT_CARD_SECTION_ORDER.includes(key)) : [];
    const unique = [...new Set(valid)];
    for (const key of DEFAULT_BOT_CARD_SECTION_ORDER) {
        if (!unique.includes(key)) unique.push(key);
    }
    return unique;
}

const DEFAULT_BOT_ACCENT_COLOR = '#667eea';

// Dashboard settings storage
let dashboardSettings = JSON.parse(localStorage.getItem('botDashboardSettings') || JSON.stringify({
    layout: 'grid',
    showParty: true,
    showEncounters: true,
    showStats: true,
    showMap: true,
    showCurrentEncounter: true,
    showEmulator: false,
    showGameState: false,
    showPlayerInfo: true,
    showTotalStats: true,
    showLogo: true,
    // Bot card section toggles
    showControls: true,
    showEncounterRateSection: true,
    showTargetPokemonSection: true,
    // Combined encounter rate summary toggle
    showCombinedEncounterRate: true,
    // Encounter rate graph display options
    showEncounterRateGraph: false, // Per-bot graph toggle
    showEncounterRateAsGraph: false, // Show graph instead of number in stats
    updateInterval: 5, // seconds
    recentFindsCount: 5, // number of recent finds to display
    cardWidth: 240, // card width in pixels
    // Statistics individual toggles (per-bot Statistics section)
    showStatsTotalEncounters: true,
    showStatsShinyEncounters: true,
    showStatsPlayTime: true,
    // Current Phase individual toggles
    showPhaseCurrentStreak: true,
    showPhaseEncounters: true,
    showPhaseDuration: true,
    showPhaseBestIV: true,
    showPhaseLongest: true,
    showPhasePokenav: true,
    // Current Encounter individual toggles
    showEncounterSprite: true,
    showEncounterName: true,
    showEncounterLevel: true,
    showEncounterShiny: true,
    showEncounterNature: true,
    showEncounterAbility: true,
    showEncounterIVSum: true,
    showEncounterIVs: true,
    // Emulator Info individual toggles
    showEmulatorFrameRate: true,
    showEmulatorFastForward: true,
    showEmulatorPaused: true,
    showEmulatorUptime: true,
    // Game individual toggles
    showGameBadges: true,
    showGameName: true,
    showGameLanguage: true,
    showGameRevision: true,
    showGameMapID: true,
    showGamePosition: true,
    showGameSteps: true,
    showGameTimePlayed: true,
    // Player Info individual toggles
    showPlayerName: true,
    showPlayerTID: true,
    showPlayerSID: true,
    showPlayerGender: true,
    showPlayerPlayTime: true,
    showPlayerID32: true,
    // Total Stats individual toggles
    showTotalStatsTotalEncounters: true,
    showTotalStatsShinyEncounters: true,
    showTotalStatsCatches: true,
    showTotalStatsHighestIV: true,
    showTotalStatsLowestIV: true,
    showTotalStatsHighestSV: true,
    showTotalStatsLowestSV: true,
    sectionOrder: DEFAULT_BOT_CARD_SECTION_ORDER,
    accentColor: DEFAULT_BOT_ACCENT_COLOR
}));

let encounterRateHistory = JSON.parse(localStorage.getItem('botEncounterRateHistory') || '{}');

// Graph update throttling
let lastGraphUpdate = 0;
const GRAPH_UPDATE_INTERVAL = 5000; // 5 seconds

// Tracked recent encounters (per bot) - tracks current encounter changes
let trackedEncounters = JSON.parse(localStorage.getItem('botTrackedEncounters') || '{}');

// Bot data cache - stores latest data for each bot (for summary calculations)
let botDataCache = new Map(); // botId -> { stats, success, etc. }

// Maximum total encounters cache - tracks the highest total encounters seen per bot
// This prevents the total from going down when a bot disconnects; persisted to localStorage
let maxTotalEncountersCache = new Map(); // botId -> maxEncounters (number)
let maxTotalShiniesCache = new Map();    // botId -> maxShinies (number)
let maxTotalCatchesCache = new Map();    // botId -> maxCatches (number)

const BOT_MAX_TOTALS_STORAGE_KEY = 'botDashboardMaxTotals';
const BOT_STATS_CACHE_STORAGE_KEY = 'botDashboardStatsCache';
const BOT_STATS_CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes – use cache when opening modal if within this age

async function loadBotStatsCache() {
    try {
        const res = await fetch('/api/bot-dashboard-cache');
        if (res && res.ok) {
            const data = await res.json();
            const stats = data && data.statsCache && typeof data.statsCache === 'object' ? data.statsCache : {};
            Object.entries(stats).forEach(([botId, entry]) => {
                if (entry && entry.stats != null) {
                    botStatsCache.set(botId, { stats: entry.stats, time: entry.time || 0 });
                }
            });
            return;
        }
    } catch (e) {
        console.warn('[loadBotStatsCache] Server load failed, trying localStorage:', e?.message || e);
    }
    try {
        const saved = localStorage.getItem(BOT_STATS_CACHE_STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            if (data && typeof data === 'object') {
                Object.entries(data).forEach(([botId, entry]) => {
                    if (entry && entry.stats != null) {
                        botStatsCache.set(botId, { stats: entry.stats, time: entry.time || 0 });
                    }
                });
            }
        }
    } catch (e) {
        console.warn('[loadBotStatsCache]', e);
    }
}

async function saveBotStatsCache() {
    const data = {};
    botStatsCache.forEach((entry, botId) => {
        if (entry && entry.stats != null) {
            data[botId] = { stats: entry.stats, time: entry.time || 0 };
        }
    });
    try {
        const res = await fetch('/api/bot-dashboard-cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ statsCache: data })
        });
        if (res && res.ok) return;
    } catch (e) {
        console.warn('[saveBotStatsCache] Server save failed, using localStorage:', e?.message || e);
    }
    try {
        localStorage.setItem(BOT_STATS_CACHE_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('[saveBotStatsCache]', e);
    }
}

function loadBotMaxTotalsCaches() {
    // Synchronous fallback from localStorage only; server load is done in loadBotDashboardCacheFromServer()
    try {
        const saved = localStorage.getItem(BOT_MAX_TOTALS_STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            if (data.encounters && typeof data.encounters === 'object') {
                Object.entries(data.encounters).forEach(([id, val]) => { maxTotalEncountersCache.set(id, Number(val)); });
            }
            if (data.shinies && typeof data.shinies === 'object') {
                Object.entries(data.shinies).forEach(([id, val]) => { maxTotalShiniesCache.set(id, Number(val)); });
            }
            if (data.catches && typeof data.catches === 'object') {
                Object.entries(data.catches).forEach(([id, val]) => { maxTotalCatchesCache.set(id, Number(val)); });
            }
        }
    } catch (e) {
        console.warn('[loadBotMaxTotalsCaches]', e);
    }
}

async function loadBotDashboardCacheFromServer() {
    try {
        const res = await fetch('/api/bot-dashboard-cache');
        if (res && res.ok) {
            const data = await res.json();
            if (data.statsCache && typeof data.statsCache === 'object') {
                Object.entries(data.statsCache).forEach(([botId, entry]) => {
                    if (entry && entry.stats != null) {
                        botStatsCache.set(botId, { stats: entry.stats, time: Number(entry.time) || 0 });
                    }
                });
            }
            if (data.maxTotals && typeof data.maxTotals === 'object') {
                const mt = data.maxTotals;
                if (mt.encounters && typeof mt.encounters === 'object') {
                    Object.entries(mt.encounters).forEach(([id, val]) => { maxTotalEncountersCache.set(id, Number(val) || 0); });
                }
                if (mt.shinies && typeof mt.shinies === 'object') {
                    Object.entries(mt.shinies).forEach(([id, val]) => { maxTotalShiniesCache.set(id, Number(val) ?? -1); });
                }
                if (mt.catches && typeof mt.catches === 'object') {
                    Object.entries(mt.catches).forEach(([id, val]) => { maxTotalCatchesCache.set(id, Number(val) ?? -1); });
                }
            }
            return;
        }
    } catch (e) {
        console.warn('[loadBotDashboardCacheFromServer] Server failed, using localStorage:', e?.message || e);
    }
    loadBotMaxTotalsCaches();
    try {
        const saved = localStorage.getItem(BOT_STATS_CACHE_STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            if (data && typeof data === 'object') {
                Object.entries(data).forEach(([botId, entry]) => {
                    if (entry && entry.stats != null) {
                        botStatsCache.set(botId, { stats: entry.stats, time: entry.time || 0 });
                    }
                });
            }
        }
    } catch (e2) {
        console.warn('[loadBotDashboardCacheFromServer] localStorage stats fallback:', e2);
    }
}

function saveBotMaxTotalsCaches() {
    const data = {
        encounters: Object.fromEntries(maxTotalEncountersCache),
        shinies: Object.fromEntries(maxTotalShiniesCache),
        catches: Object.fromEntries(maxTotalCatchesCache)
    };
    const hasAny = Object.keys(data.encounters).length > 0 || Object.keys(data.shinies).length > 0 || Object.keys(data.catches).length > 0;
    try {
        if (hasAny) {
            fetch('/api/bot-dashboard-cache', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ maxTotals: data })
            }).then(res => {
                if (res && res.ok) return;
                return Promise.reject(new Error('Save failed'));
            }).catch(() => {
                try {
                    localStorage.setItem(BOT_MAX_TOTALS_STORAGE_KEY, JSON.stringify(data));
                } catch (e) {
                    console.warn('[saveBotMaxTotalsCaches]', e);
                }
            });
        } else {
            try {
                localStorage.setItem(BOT_MAX_TOTALS_STORAGE_KEY, JSON.stringify(data));
            } catch (e) {
                console.warn('[saveBotMaxTotalsCaches]', e);
            }
        }
    } catch (e) {
        try {
            localStorage.setItem(BOT_MAX_TOTALS_STORAGE_KEY, JSON.stringify(data));
        } catch (e2) {
            console.warn('[saveBotMaxTotalsCaches]', e2);
        }
    }
}

function updateBotMaxTotals(botId, encounters, shinies, catches) {
    if (botId == null) return;
    let changed = false;
    if (typeof encounters === 'number' && encounters >= 0) {
        const cur = maxTotalEncountersCache.get(botId) ?? 0;
        if (encounters > cur) {
            maxTotalEncountersCache.set(botId, encounters);
            changed = true;
        }
    }
    if (typeof shinies === 'number' && shinies >= 0) {
        const cur = maxTotalShiniesCache.get(botId) ?? -1;
        if (shinies > cur) {
            maxTotalShiniesCache.set(botId, shinies);
            changed = true;
        }
    }
    if (typeof catches === 'number' && catches >= 0) {
        const cur = maxTotalCatchesCache.get(botId) ?? -1;
        if (catches > cur) {
            maxTotalCatchesCache.set(botId, catches);
            changed = true;
        }
    }
    if (changed) saveBotMaxTotalsCaches();
}

// Bot connection tracking - tracks last successful update and first failure time
let botConnectionTracking = new Map(); // botId -> { lastSuccess: timestamp, firstFailure: timestamp | null }
const BOT_OFFLINE_TIMEOUT = 10000; // 10 seconds before considering bot offline

// Last card section cache: keep showing previous Game/Player HTML for this long when current data is empty
const LAST_CARD_SECTION_TIMEOUT_MS = 60000; // 1 minute (game)
const LAST_PLAYER_SECTION_TIMEOUT_MS = 300000; // 5 minutes (player) - keep stable, avoid flash
const LAST_LOCATION_SECTION_TIMEOUT_MS = 60000; // 1 minute (current location)
const LAST_EMULATOR_SECTION_TIMEOUT_MS = 300000; // 5 minutes (emulator) - keep stable, avoid flash
const LAST_PHASE_SECTION_TIMEOUT_MS = 60000; // 1 minute (current phase)
const LAST_TOTAL_STATS_SECTION_TIMEOUT_MS = 60000; // 1 minute (total stats)
const lastGameSectionCache = new Map();   // botId -> { html, time }
const lastPlayerSectionCache = new Map(); // botId -> { html, time }
const lastLocationSectionCache = new Map(); // botId -> { html, time }
const lastEmulatorSectionCache = new Map(); // botId -> { html, time }
const lastPhaseSectionCache = new Map(); // botId -> { html, time }
const lastTotalStatsSectionCache = new Map(); // botId -> { html, time }

// Database Statistics modal: cache /stats per bot so offline bots still show last known data
const botStatsCache = new Map(); // botId -> { stats, time }

// Live encounter rate history - only in-memory, not persisted (for combined graph)
let liveEncounterRateHistory = new Map(); // botId -> [{ time, rate }, ...]
const MAX_LIVE_HISTORY_POINTS = 50; // Keep last 50 points per bot

// Bot order and visibility configuration
let botOrderConfig = {}; // botId -> { order: number, hidden: boolean }

// Bot target Pokemon configuration (server-side, cached locally)
let botTargetPokemon = {}; // botId -> { speciesId: number, speciesName: string }

// Load bot targets from server
async function loadBotTargets() {
    try {
        const response = await fetch('/api/bot-targets');
        if (response.ok) {
            const data = await response.json();
            botTargetPokemon = data || {};
        } else {
            console.warn('Failed to load bot targets from server, using empty object');
            botTargetPokemon = {};
        }
    } catch (error) {
        console.error('Error loading bot targets:', error);
        // Use empty object as fallback
        botTargetPokemon = {};
    }
}

// Get target Pokemon for a bot (synchronous, uses local cache)
function getBotTargetPokemon(botId) {
    return botTargetPokemon[botId] || null;
}

// Set target Pokemon for a bot (server-side)
async function setBotTargetPokemon(botId, speciesId, speciesName) {
    try {
        const response = await fetch(`/api/bot-targets/${botId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ speciesId, speciesName })
        });
        
        if (response.ok) {
            // Update local cache
            if (speciesId && speciesName) {
                botTargetPokemon[botId] = { speciesId, speciesName };
            } else {
                delete botTargetPokemon[botId];
            }
            return true;
        } else {
            console.error('Failed to save bot target');
            return false;
        }
    } catch (error) {
        console.error('Error setting bot target:', error);
        return false;
    }
}

// Clear target Pokemon for a bot (server-side)
async function clearBotTarget(botId) {
    try {
        const response = await fetch(`/api/bot-targets/${botId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            delete botTargetPokemon[botId];
            return true;
        } else {
            console.error('Failed to clear bot target');
            return false;
        }
    } catch (error) {
        console.error('Error clearing bot target:', error);
        return false;
    }
}

// DOM elements
const addBotBtn = document.getElementById('addBotBtn');
const addBotModal = document.getElementById('addBotModal');
const closeAddBotModal = document.getElementById('closeAddBotModal');
const saveBotBtn = document.getElementById('saveBotBtn');
const cancelBotBtn = document.getElementById('cancelBotBtn');
const botInstancesContainer = document.getElementById('botInstances');
const showHiddenBotsBtn = document.getElementById('showHiddenBotsBtn');
const hiddenBotsModal = document.getElementById('hiddenBotsModal');
const closeHiddenBotsModal = document.getElementById('closeHiddenBotsModal');
const closeHiddenBotsBtn = document.getElementById('closeHiddenBotsBtn');
const hiddenBotsList = document.getElementById('hiddenBotsList');
const botStatusContainer = document.getElementById('botStatusContainer');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const botHeaderLogo = document.querySelector('.header-logo');
const layoutSelect = document.getElementById('layoutSelect');
const optionsBtn = document.getElementById('optionsBtn');
const optionsModal = document.getElementById('optionsModal');
const closeOptionsModal = document.getElementById('closeOptionsModal');
const saveOptionsBtn = document.getElementById('saveOptionsBtn');
const cancelOptionsBtn = document.getElementById('cancelOptionsBtn');
const showParty = document.getElementById('showParty');
const showEncounters = document.getElementById('showEncounters');
const showStats = document.getElementById('showStats');
const showMap = document.getElementById('showMap');
const showControls = document.getElementById('showControls');
const showEncounterRateSectionEl = document.getElementById('showEncounterRateSection');
const showTargetPokemonSectionEl = document.getElementById('showTargetPokemonSection');
const showCurrentEncounter = document.getElementById('showCurrentEncounter');
const showEmulator = document.getElementById('showEmulator');
const showGameState = document.getElementById('showGameState');
const showPlayerInfo = document.getElementById('showPlayerInfo');
const showTotalStats = document.getElementById('showTotalStats');
const showEncounterRateAsGraph = document.getElementById('showEncounterRateAsGraph');
const updateInterval = document.getElementById('updateInterval');
const recentFindsCount = document.getElementById('recentFindsCount');
const cardWidthSlider = document.getElementById('cardWidthSlider');
const cardWidthValue = document.getElementById('cardWidthValue');

function normalizeHexColor(color) {
    return /^#[0-9A-Fa-f]{6}$/.test(color || '') ? color : DEFAULT_BOT_ACCENT_COLOR;
}

function adjustColorBrightness(hex, percent) {
    hex = normalizeHexColor(hex).replace('#', '');

    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    const newR = Math.min(255, Math.max(0, r + (r * percent / 100)));
    const newG = Math.min(255, Math.max(0, g + (g * percent / 100)));
    const newB = Math.min(255, Math.max(0, b + (b * percent / 100)));

    return '#' + [newR, newG, newB].map(x => {
        const hexValue = Math.round(x).toString(16);
        return hexValue.length === 1 ? '0' + hexValue : hexValue;
    }).join('');
}

function hexToRgbString(hex) {
    const normalized = normalizeHexColor(hex).replace('#', '');
    const r = parseInt(normalized.substr(0, 2), 16);
    const g = parseInt(normalized.substr(2, 2), 16);
    const b = parseInt(normalized.substr(4, 2), 16);
    return `${r}, ${g}, ${b}`;
}

function applyBotAccentColor(color) {
    if (!document.body) return;

    const normalized = normalizeHexColor(color);
    document.body.style.setProperty('--accent-color', normalized);
    document.body.style.setProperty('--accent-hover', adjustColorBrightness(normalized, 15));
    document.body.style.setProperty('--accent-color-hover', adjustColorBrightness(normalized, 15));
    document.body.style.setProperty('--accent-color-rgb', hexToRgbString(normalized));
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Dashboard] DOMContentLoaded - initializing...');
    await loadBotDashboardCacheFromServer();

    try {
        // Load bot targets from server (non-blocking - continue even if it fails)
        loadBotTargets().catch(error => {
            console.warn('Failed to load bot targets, continuing with empty targets:', error);
        });
        
        initializeTheme();
        applyBotAccentColor(dashboardSettings.accentColor || DEFAULT_BOT_ACCENT_COLOR);
        loadDashboardSettings();
        applyBotLogoVisibility(dashboardSettings.showLogo !== false);
        initFoldableCards();
        initBotSectionFolding();
        await loadBotInstancesFromServer();
        console.log('[Dashboard] Loaded', botInstances.length, 'bot instances');
        
        // Load bot order and visibility configuration
        loadBotOrderConfig();
        setupEventListeners();
        setupOptionsModal();
        setupPokemonInfoModal();
        console.log('[Dashboard] Starting polling...');
        startPolling();
        
        // Initial update of combined encounter rate after a short delay
        setTimeout(() => {
            updateCombinedEncounterRate();
        }, 2000);
        console.log('[Dashboard] Initialization complete');
    } catch (error) {
        console.error('[Dashboard] Error during initialization:', error);
        // Still try to show the page even if initialization fails
    }
});

// Initialize foldable top cards (Dashboard Settings, Bot Instances, Dashboard Summary)
function initFoldableCards() {
    document.querySelectorAll('.foldable-card').forEach(card => {
        const id = card.dataset.foldableId;
        if (id) {
            const saved = localStorage.getItem('foldable-' + id);
            if (saved === 'true') card.classList.add('collapsed');
        }
    });
    document.addEventListener('click', (e) => {
        const header = e.target.closest('.foldable-header');
        if (!header) return;
        if (e.target.closest('button')) return;
        const card = header.closest('.foldable-card');
        if (!card || !card.querySelector('.foldable-body')) return;
        e.preventDefault();
        e.stopPropagation();
        card.classList.toggle('collapsed');
        const id = card.dataset.foldableId;
        if (id) localStorage.setItem('foldable-' + id, card.classList.contains('collapsed'));
    }, true);
}

function getBotSectionFoldStateKey(botId, sectionKey) {
    return `foldable-bot-${botId}-${sectionKey}`;
}

function getBotFoldableSectionConfig(sectionEl) {
    if (!sectionEl) return null;

    if (sectionEl.classList.contains('bot-controls-section')) {
        return { key: 'controls', title: 'Controls' };
    }

    if (sectionEl.classList.contains('bot-video-section')) {
        return { key: 'video', title: 'Video Stream' };
    }

    if (sectionEl.classList.contains('status-section')) {
        const key = getBotCardSectionKey(sectionEl);
        const title = sectionEl.querySelector(':scope > h4')?.textContent?.trim() || 'Section';
        if (!key) return null;
        return { key, title };
    }

    return null;
}

function makeBotSectionFoldable(sectionEl, botId) {
    if (!sectionEl || sectionEl.classList.contains('bot-section-foldable')) return;

    const config = getBotFoldableSectionConfig(sectionEl);
    if (!config) return;

    const header = document.createElement('div');
    header.className = 'bot-section-header';
    header.setAttribute('role', 'button');
    header.setAttribute('tabindex', '0');
    header.setAttribute('aria-expanded', 'true');
    header.innerHTML = `
        <span class="bot-section-title">${config.title}</span>
        <span class="bot-section-chevron" aria-hidden="true">▼</span>
    `;

    const body = document.createElement('div');
    body.className = 'bot-section-body';

    const originalTitle = sectionEl.querySelector(':scope > h4');
    if (originalTitle) {
        originalTitle.remove();
    }

    while (sectionEl.firstChild) {
        body.appendChild(sectionEl.firstChild);
    }

    sectionEl.classList.add('bot-section-foldable');
    sectionEl.dataset.botId = String(botId);
    sectionEl.dataset.foldableSectionKey = config.key;
    sectionEl.appendChild(header);
    sectionEl.appendChild(body);

    const isCollapsed = localStorage.getItem(getBotSectionFoldStateKey(botId, config.key)) === 'true';
    if (isCollapsed) {
        sectionEl.classList.add('collapsed');
        header.setAttribute('aria-expanded', 'false');
    }
}

function initializeBotCardFoldableSections(card, botId) {
    if (!card) return;

    const foldableSections = card.querySelectorAll('.bot-controls-section, .bot-video-section, .status-section');
    foldableSections.forEach(sectionEl => makeBotSectionFoldable(sectionEl, botId));
}

function toggleBotSectionFold(sectionEl) {
    if (!sectionEl) return;

    sectionEl.classList.toggle('collapsed');
    const header = sectionEl.querySelector(':scope > .bot-section-header');
    if (header) {
        header.setAttribute('aria-expanded', sectionEl.classList.contains('collapsed') ? 'false' : 'true');
    }

    const botId = sectionEl.dataset.botId;
    const sectionKey = sectionEl.dataset.foldableSectionKey;
    if (botId && sectionKey) {
        localStorage.setItem(
            getBotSectionFoldStateKey(botId, sectionKey),
            sectionEl.classList.contains('collapsed')
        );
    }
}

function initBotSectionFolding() {
    document.addEventListener('click', (e) => {
        const header = e.target.closest('.bot-section-header');
        if (!header) return;

        const section = header.closest('.bot-section-foldable');
        if (!section) return;

        e.preventDefault();
        e.stopPropagation();
        toggleBotSectionFold(section);
    }, true);

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;

        const header = e.target.closest('.bot-section-header');
        if (!header) return;

        const section = header.closest('.bot-section-foldable');
        if (!section) return;

        e.preventDefault();
        toggleBotSectionFold(section);
    });
}

// Theme management
const THEME_CONFIG_KEY = 'themeConfig';

function getCurrentTheme() {
    const theme = document.documentElement.getAttribute('data-theme');
    if (!theme) return 'light';
    if (theme === 'dark-grey') return 'grey';
    if (theme === 'dark-black') return 'black';
    return 'light';
}

function applyTheme(theme) {
    if (theme === 'light') {
        document.documentElement.removeAttribute('data-theme');
    } else if (theme === 'grey') {
        document.documentElement.setAttribute('data-theme', 'dark-grey');
    } else if (theme === 'black') {
        document.documentElement.setAttribute('data-theme', 'dark-black');
    }
}

function loadStoredTheme() {
    try {
        const savedConfig = JSON.parse(localStorage.getItem(THEME_CONFIG_KEY) || '{}');
        if (savedConfig.darkMode === 'light' || savedConfig.darkMode === 'grey' || savedConfig.darkMode === 'black') {
            return savedConfig.darkMode;
        }
    } catch (error) {
        console.warn('Failed to parse theme config, falling back to legacy theme key:', error);
    }

    const legacyTheme = localStorage.getItem('theme');
    if (legacyTheme === 'dark-grey') return 'grey';
    if (legacyTheme === 'dark-black') return 'black';
    return 'light';
}

function persistTheme(theme) {
    let existingConfig = {};
    try {
        existingConfig = JSON.parse(localStorage.getItem(THEME_CONFIG_KEY) || '{}');
    } catch (error) {
        console.warn('Failed to parse existing theme config, resetting it:', error);
    }

    localStorage.setItem(THEME_CONFIG_KEY, JSON.stringify({
        ...existingConfig,
        darkMode: theme
    }));

    const legacyTheme = theme === 'grey' ? 'dark-grey' : theme === 'black' ? 'dark-black' : 'light';
    localStorage.setItem('theme', legacyTheme);
}

function initializeTheme() {
    const savedTheme = loadStoredTheme();
    applyTheme(savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = getCurrentTheme();
    let nextTheme;

    if (currentTheme === 'light') {
        nextTheme = 'grey';
    } else if (currentTheme === 'grey') {
        nextTheme = 'black';
    } else {
        nextTheme = 'light';
    }

    applyTheme(nextTheme);
    persistTheme(nextTheme);
    updateThemeIcon(nextTheme);
}

if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
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

// Load and apply dashboard settings
function loadDashboardSettings() {
    if (layoutSelect) {
        layoutSelect.value = dashboardSettings.layout || 'grid';
        layoutSelect.addEventListener('change', (e) => {
            dashboardSettings.layout = e.target.value;
            saveDashboardSettings();
            applyLayout();
        });
    }
    
    if (showParty) {
        showParty.checked = dashboardSettings.showParty !== false;
        showParty.addEventListener('change', (e) => {
            dashboardSettings.showParty = e.target.checked;
            saveDashboardSettings();
            refreshAllBotCards();
        });
    }
    
    if (showEncounters) {
        showEncounters.checked = dashboardSettings.showEncounters !== false;
        showEncounters.addEventListener('change', (e) => {
            dashboardSettings.showEncounters = e.target.checked;
            saveDashboardSettings();
            refreshAllBotCards();
        });
    }
    
    if (showStats) {
        showStats.checked = dashboardSettings.showStats !== false;
        showStats.addEventListener('change', (e) => {
            dashboardSettings.showStats = e.target.checked;
            saveDashboardSettings();
            refreshAllBotCards();
        });
    }
    
    if (showMap) {
        showMap.checked = dashboardSettings.showMap !== false;
        showMap.addEventListener('change', (e) => {
            dashboardSettings.showMap = e.target.checked;
            saveDashboardSettings();
            refreshAllBotCards();
        });
    }
    
    if (showControls) {
        showControls.checked = dashboardSettings.showControls !== false;
        showControls.addEventListener('change', (e) => {
            dashboardSettings.showControls = e.target.checked;
            saveDashboardSettings();
            applyDashboardSectionVisibility();
        });
    }
    
    if (showEncounterRateSectionEl) {
        showEncounterRateSectionEl.checked = dashboardSettings.showEncounterRateSection !== false;
        showEncounterRateSectionEl.addEventListener('change', (e) => {
            dashboardSettings.showEncounterRateSection = e.target.checked;
            saveDashboardSettings();
            refreshAllBotCards();
        });
    }
    
    if (showTargetPokemonSectionEl) {
        showTargetPokemonSectionEl.checked = dashboardSettings.showTargetPokemonSection !== false;
        showTargetPokemonSectionEl.addEventListener('change', (e) => {
            dashboardSettings.showTargetPokemonSection = e.target.checked;
            saveDashboardSettings();
            refreshAllBotCards();
        });
    }
    
    if (showCurrentEncounter) {
        showCurrentEncounter.checked = dashboardSettings.showCurrentEncounter !== false;
        showCurrentEncounter.addEventListener('change', (e) => {
            dashboardSettings.showCurrentEncounter = e.target.checked;
            saveDashboardSettings();
            refreshAllBotCards();
        });
    }
    
    if (showEmulator) {
        showEmulator.checked = dashboardSettings.showEmulator || false;
        showEmulator.addEventListener('change', (e) => {
            dashboardSettings.showEmulator = e.target.checked;
            saveDashboardSettings();
            refreshAllBotCards();
        });
    }
    
    if (showGameState) {
        showGameState.checked = dashboardSettings.showGameState || false;
        showGameState.addEventListener('change', (e) => {
            dashboardSettings.showGameState = e.target.checked;
            saveDashboardSettings();
            refreshAllBotCards();
        });
    }
    
    if (showPlayerInfo) {
        showPlayerInfo.checked = dashboardSettings.showPlayerInfo || false;
        showPlayerInfo.addEventListener('change', (e) => {
            dashboardSettings.showPlayerInfo = e.target.checked;
            saveDashboardSettings();
            refreshAllBotCards();
        });
    }
    
    if (showTotalStats) {
        showTotalStats.checked = dashboardSettings.showTotalStats || false;
        showTotalStats.addEventListener('change', (e) => {
            dashboardSettings.showTotalStats = e.target.checked;
            saveDashboardSettings();
            refreshAllBotCards();
        });
    }
    
    if (showEncounterRateAsGraph) {
        showEncounterRateAsGraph.checked = dashboardSettings.showEncounterRateAsGraph || false;
        showEncounterRateAsGraph.addEventListener('change', (e) => {
            dashboardSettings.showEncounterRateAsGraph = e.target.checked;
            saveDashboardSettings();
            refreshAllBotCards();
        });
    }
    
    if (updateInterval) {
        updateInterval.value = dashboardSettings.updateInterval || 5;
        updateInterval.addEventListener('change', (e) => {
            const value = parseInt(e.target.value) || 5;
            if (value < 1) {
                e.target.value = 1;
                dashboardSettings.updateInterval = 1;
            } else if (value > 300) {
                e.target.value = 300;
                dashboardSettings.updateInterval = 300;
            } else {
                dashboardSettings.updateInterval = value;
            }
            saveDashboardSettings();
            // Note: Update interval is now for fallback polling only
            // SSE updates are server-controlled (every 2 seconds)
        });
    }
    
    // Recent Finds Count
    if (recentFindsCount) {
        recentFindsCount.value = dashboardSettings.recentFindsCount || 5;
        recentFindsCount.addEventListener('change', (e) => {
            const value = parseInt(e.target.value) || 5;
            if (value < 1) {
                e.target.value = 1;
                dashboardSettings.recentFindsCount = 1;
            } else if (value > 50) {
                e.target.value = 50;
                dashboardSettings.recentFindsCount = 50;
            } else {
                dashboardSettings.recentFindsCount = value;
            }
            saveDashboardSettings();
            // Refresh bot cards to update recent finds count
            refreshAllBotCards();
        });
    }
    
    // Card width slider
    if (cardWidthSlider && cardWidthValue) {
        const initialWidth = dashboardSettings.cardWidth || 240;
        // Ensure minimum is 220px
        const clampedWidth = Math.max(220, initialWidth);
        cardWidthSlider.value = clampedWidth;
        cardWidthValue.textContent = clampedWidth;
        updateCardWidth(clampedWidth);
        
        cardWidthSlider.addEventListener('input', (e) => {
            const width = Math.max(220, parseInt(e.target.value) || 240);
            cardWidthSlider.value = width; // Ensure slider reflects clamped value
            cardWidthValue.textContent = width;
            dashboardSettings.cardWidth = width;
            updateCardWidth(width);
            saveDashboardSettings();
        });
    }
    
    applyLayout();
}

function updateCardWidth(width) {
    const widthValue = `${width}px`;
    document.documentElement.style.setProperty('--bot-card-width', widthValue);
    console.log(`Card width updated to: ${widthValue}`);
}

function saveDashboardSettings() {
    dashboardSettings.sectionOrder = normalizeBotCardSectionOrder(dashboardSettings.sectionOrder);
    localStorage.setItem('botDashboardSettings', JSON.stringify(dashboardSettings));
}

function applyBotLogoVisibility(showLogo) {
    if (botHeaderLogo) {
        botHeaderLogo.style.display = showLogo === false ? 'none' : '';
    }
}

function getBotCardSectionKey(sectionEl) {
    if (!sectionEl) return null;
    if (sectionEl.classList.contains('encounter-rate-card')) return 'encounterRate';
    if (sectionEl.classList.contains('target-pokemon-section')) return 'targetPokemon';
    const title = sectionEl.querySelector('h4')?.textContent?.trim() || '';
    if (title === 'Current Location') return 'currentLocation';
    if (title.startsWith('Current Party')) return 'party';
    if (title === 'Recent Finds') return 'recentFinds';
    if (title === 'Current Encounter') return 'currentEncounter';
    if (title === 'Statistics') return 'statistics';
    if (title === 'Current Phase') return 'currentPhase';
    if (title === 'Emulator Info') return 'emulator';
    if (title === 'Game') return 'game';
    if (title === 'Player Info') return 'player';
    if (title === 'Total Stats') return 'totalStats';
    return null;
}

function applyBotCardSectionOrder(container) {
    if (!container) return;
    const order = normalizeBotCardSectionOrder(dashboardSettings.sectionOrder);
    const orderMap = new Map(order.map((key, index) => [key, index]));
    const sections = Array.from(container.children).filter(
        el => el.classList && el.classList.contains('status-section')
    );
    sections
        .sort((a, b) => {
            const aIdx = orderMap.get(getBotCardSectionKey(a)) ?? Number.MAX_SAFE_INTEGER;
            const bIdx = orderMap.get(getBotCardSectionKey(b)) ?? Number.MAX_SAFE_INTEGER;
            return aIdx - bIdx;
        })
        .forEach(section => container.appendChild(section));
}

function renderSectionOrderControls() {
    const list = document.getElementById('botSectionOrderList');
    if (!list) return;
    const order = normalizeBotCardSectionOrder(dashboardSettings.sectionOrder);
    list.innerHTML = order.map((key) => `
        <div class="section-order-item" data-section-key="${key}" draggable="true">
            <span class="section-order-handle" title="Drag to reorder" aria-hidden="true">⋮⋮</span>
            <span class="section-order-label">${BOT_CARD_SECTION_LABELS[key] || key}</span>
        </div>
    `).join('');
}

function applyLayout() {
    if (botStatusContainer) {
        botStatusContainer.className = `bot-status-container layout-${dashboardSettings.layout || 'grid'}`;
    }
}

function applyDashboardSectionVisibility() {
    if (!botStatusContainer) return;
    botStatusContainer.querySelectorAll('.bot-status-card').forEach(card => {
        const controlsSection = card.querySelector('.bot-controls-section');
        if (controlsSection) {
            controlsSection.style.display = dashboardSettings.showControls !== false ? '' : 'none';
        }
    });
}

async function refreshAllBotCards() {
    for (const bot of botInstances) {
        const card = document.getElementById(`bot-status-${bot.id}`);
        if (card) {
            const result = await fetchBotData(bot);
            updateStatusCard(card, bot, result);
        }
    }
    updateDashboardSummary();
}

// Event listeners
function setupEventListeners() {
    // Hidden bots modal
    if (showHiddenBotsBtn) {
        showHiddenBotsBtn.addEventListener('click', () => {
            showHiddenBotsModal();
        });
    }
    
    if (closeHiddenBotsModal) {
        closeHiddenBotsModal.addEventListener('click', () => {
            hiddenBotsModal.classList.add('hidden');
        });
    }
    
    if (closeHiddenBotsBtn) {
        closeHiddenBotsBtn.addEventListener('click', () => {
            hiddenBotsModal.classList.add('hidden');
        });
    }
    
    // Close modal when clicking outside
    if (hiddenBotsModal) {
        hiddenBotsModal.addEventListener('click', (e) => {
            if (e.target === hiddenBotsModal) {
                hiddenBotsModal.classList.add('hidden');
            }
        });
    }
    
    if (addBotBtn) {
        addBotBtn.addEventListener('click', () => {
            addBotModal.classList.remove('hidden');
        });
    }

    if (closeAddBotModal) {
        closeAddBotModal.addEventListener('click', () => {
            addBotModal.classList.add('hidden');
            clearAddBotForm();
        });
    }

    if (cancelBotBtn) {
        cancelBotBtn.addEventListener('click', () => {
            addBotModal.classList.add('hidden');
            clearAddBotForm();
        });
    }

    if (saveBotBtn) {
        saveBotBtn.addEventListener('click', saveBotInstance);
    }

    // Close modal on outside click
    if (addBotModal) {
        addBotModal.addEventListener('click', (e) => {
            if (e.target === addBotModal) {
                addBotModal.classList.add('hidden');
                clearAddBotForm();
            }
        });
    }

    // Bot Dashboard Statistics button and modal
    const botDashboardStatisticsBtn = document.getElementById('botDashboardStatisticsBtn');
    const botDashboardStatisticsModal = document.getElementById('botDashboardStatisticsModal');
    const closeBotDashboardStatistics = document.getElementById('closeBotDashboardStatistics');
    if (botDashboardStatisticsBtn) {
        botDashboardStatisticsBtn.addEventListener('click', () => showBotDashboardStatistics());
    }
    const botStatsRefreshBtn = document.getElementById('botStatsRefreshBtn');
    const botStatsWipeBtn = document.getElementById('botStatsWipeBtn');
    if (botStatsRefreshBtn) {
        botStatsRefreshBtn.addEventListener('click', () => showBotDashboardStatistics(true)); // refresh fetches new data but never clears cache
    }
    if (botStatsWipeBtn) {
        botStatsWipeBtn.addEventListener('click', () => {
            botStatsCache.clear();
            saveBotStatsCache();
            showBotDashboardStatistics();
        });
    }
    if (closeBotDashboardStatistics) {
        closeBotDashboardStatistics.addEventListener('click', () => botDashboardStatisticsModal && botDashboardStatisticsModal.classList.add('hidden'));
    }
    if (botDashboardStatisticsModal) {
        botDashboardStatisticsModal.addEventListener('click', (e) => {
            if (e.target === botDashboardStatisticsModal) botDashboardStatisticsModal.classList.add('hidden');
        });
    }
}

// Show Database Statistics modal with /stats content and combined per-species data
// forceRefresh: if true, always fetch /stats for all bots (regardless of online status) with a longer timeout to force an update; otherwise use cache when < 5 min old
// Refresh only updates the cache with new data; it never clears or removes existing cache entries.
// Loads cached values immediately, then updates in the background if needed.
async function showBotDashboardStatistics(forceRefresh = false) {
    const modal = document.getElementById('botDashboardStatisticsModal');
    const body = document.getElementById('botDashboardStatisticsBody');
    const loadingOverlay = document.getElementById('botDashboardStatisticsLoading');
    if (!modal || !body) return;

    if (loadingOverlay) {
        loadingOverlay.classList.remove('hidden');
        loadingOverlay.setAttribute('aria-hidden', 'false');
    }
    modal.classList.remove('hidden');

    function hideLoading() {
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
            loadingOverlay.setAttribute('aria-hidden', 'true');
        }
    }

    function escapeHtml(s) {
        if (s == null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    const botsToShow = botInstances.length ? botInstances : [];
    if (botsToShow.length === 0) {
        body.innerHTML = '<p class="no-data">No bot instances configured. Add bots first.</p>';
        hideLoading();
        return;
    }

    // Build results from cache only (sync) so we can show immediately
    function buildResultsFromCache() {
        const out = [];
        const now = Date.now();
        for (const bot of botsToShow) {
            const cached = botStatsCache.get(bot.id);
            if (cached && cached.stats != null) {
                out.push({ bot, stats: cached.stats, error: null, fromCache: true });
                continue;
            }
            if (botDataCache.has(bot.id)) {
                const botData = botDataCache.get(bot.id);
                const raw = botData?.data?.stats;
                const statsFromCard = raw && typeof raw === 'object' && raw.data !== undefined ? raw.data : raw;
                if (statsFromCard != null) {
                    out.push({ bot, stats: statsFromCard, error: null, fromCache: true });
                    continue;
                }
            }
            out.push({ bot, stats: null, error: null, fromCache: false });
        }
        return out;
    }

    // Build full HTML from results (shared by initial render and background update)
    function buildStatisticsHtml(results) {
        function getPokemonFromStats(stats) {
            if (!stats) return {};
            const p = stats.pokemon ?? stats.data?.pokemon ?? stats.species ?? stats.by_species;
            if (p && typeof p === 'object' && !Array.isArray(p)) return p;
            return {};
        }
        function getSpeciesCount(value) {
            if (value == null) return 0;
            if (typeof value === 'number') return value;
            return Number(value.encounters ?? value.total_encounters ?? value.count ?? value.total ?? 0) || 0;
        }
        function getBySpeciesFromStats(stats) {
            if (!stats) return {};
            const out = {};
            const pokemonMap = getPokemonFromStats(stats);
            if (Object.keys(pokemonMap).length > 0) {
                for (const [key, value] of Object.entries(pokemonMap)) {
                    const c = getSpeciesCount(value);
                    if (c > 0) out[key] = c;
                }
                return out;
            }
            const sources = [stats.species, stats.by_species, stats.totals?.by_species, stats.totals?.species];
            const src = sources.find(s => s && typeof s === 'object' && Object.keys(s).length > 0);
            if (!src) return {};
            for (const [k, v] of Object.entries(src)) {
                const c = getSpeciesCount(v);
                if (c > 0) out[k] = c;
            }
            return out;
        }

        const totals = { total_encounters: 0, shiny_encounters: 0, catches: 0, by_species: {} };
        const byBot = [];
        const combinedPokemon = {};
        for (const { bot, stats } of results) {
            const pokemonMap = getPokemonFromStats(stats);
            for (const [nameKey, entry] of Object.entries(pokemonMap)) {
                if (!entry || typeof entry !== 'object') continue;
                const id = entry.species_id != null ? entry.species_id : nameKey;
                const key = String(id);
                const speciesName = entry.species_name ?? entry.speciesName ?? nameKey;
                if (!combinedPokemon[key]) {
                    combinedPokemon[key] = {
                        species_id: entry.species_id, species_name: speciesName,
                        total_encounters: 0, shiny_encounters: 0, catches: 0,
                        total_highest_iv_sum: null, total_lowest_iv_sum: null, total_highest_sv: null, total_lowest_sv: null, last_encounter_time: null
                    };
                }
                const c = combinedPokemon[key];
                c.total_encounters += Number(entry.total_encounters ?? entry.totalEncounters ?? 0) || 0;
                c.shiny_encounters += Number(entry.shiny_encounters ?? entry.shinyEncounters ?? 0) || 0;
                c.catches += Number(entry.catches ?? 0) || 0;
                const hiIv = entry.total_highest_iv_sum != null ? (typeof entry.total_highest_iv_sum === 'object' ? entry.total_highest_iv_sum.value : Number(entry.total_highest_iv_sum)) : null;
                if (hiIv != null && (c.total_highest_iv_sum == null || hiIv > c.total_highest_iv_sum)) c.total_highest_iv_sum = hiIv;
                const loIv = entry.total_lowest_iv_sum != null ? (typeof entry.total_lowest_iv_sum === 'object' ? entry.total_lowest_iv_sum.value : Number(entry.total_lowest_iv_sum)) : null;
                if (loIv != null && (c.total_lowest_iv_sum == null || loIv < c.total_lowest_iv_sum)) c.total_lowest_iv_sum = loIv;
                const hiSv = entry.total_highest_sv != null ? (typeof entry.total_highest_sv === 'object' ? entry.total_highest_sv.value : Number(entry.total_highest_sv)) : null;
                if (hiSv != null && (c.total_highest_sv == null || hiSv > c.total_highest_sv)) c.total_highest_sv = hiSv;
                const loSv = entry.total_lowest_sv != null ? (typeof entry.total_lowest_sv === 'object' ? entry.total_lowest_sv.value : Number(entry.total_lowest_sv)) : null;
                if (loSv != null && (c.total_lowest_sv == null || loSv < c.total_lowest_sv)) c.total_lowest_sv = loSv;
                const lastTime = entry.last_encounter_time ?? entry.lastEncounterTime;
                if (lastTime && (c.last_encounter_time == null || String(lastTime) > String(c.last_encounter_time))) c.last_encounter_time = lastTime;
            }
        }
        for (const { bot, stats, error, fromCache } of results) {
            const totalsObj = (stats && stats.totals) ? stats.totals : {};
            const encounters = totalsObj.total_encounters ?? totalsObj.totalEncounters ?? 0;
            const shinies = totalsObj.shiny_encounters ?? totalsObj.shinyEncounters ?? 0;
            const catches = totalsObj.catches ?? 0;
            totals.total_encounters += Number(encounters) || 0;
            totals.shiny_encounters += Number(shinies) || 0;
            totals.catches += Number(catches) || 0;
            const bySpecies = getBySpeciesFromStats(stats);
            for (const [speciesKey, count] of Object.entries(bySpecies)) {
                if (count > 0) totals.by_species[speciesKey] = (totals.by_species[speciesKey] || 0) + count;
            }
            byBot.push({
                name: bot.name || bot.url || bot.id,
                error,
                fromCache: fromCache || false,
                totals: totalsObj,
                by_species: bySpecies,
                total_highest_iv_sum: stats?.totals?.total_highest_iv_sum,
                total_lowest_iv_sum: stats?.totals?.total_lowest_iv_sum,
                total_highest_sv: stats?.totals?.total_highest_sv,
                total_lowest_sv: stats?.totals?.total_lowest_sv
            });
        }
        const combinedEntries = Object.values(combinedPokemon);
        if (combinedEntries.length > 0) {
            totals.total_encounters = combinedEntries.reduce((s, r) => s + (r.total_encounters || 0), 0);
            totals.shiny_encounters = combinedEntries.reduce((s, r) => s + (r.shiny_encounters || 0), 0);
            totals.catches = combinedEntries.reduce((s, r) => s + (r.catches || 0), 0);
            totals.by_species = {};
            combinedEntries.forEach(r => {
                const name = r.species_name || '';
                if (name) totals.by_species[name] = r.total_encounters || 0;
            });
        }

        let html = '<div class="statistics-container">';
        html += '<div class="statistics-section"><h3>Combined totals</h3><div class="statistics-grid statistics-totals-grid">';
        const oneInX = totals.shiny_encounters > 0 && totals.total_encounters > 0 ? Math.round(totals.total_encounters / totals.shiny_encounters) : null;
        const shinyRateDisplay = oneInX != null ? `1 in ${oneInX.toLocaleString()}` : '—';
        html += `<div class="statistic-card"><div class="statistic-value">${totals.total_encounters.toLocaleString()}</div><div class="statistic-label">Total Encounters</div></div>`;
        html += `<div class="statistic-card"><div class="statistic-value">${totals.shiny_encounters.toLocaleString()}</div><div class="statistic-label">Shiny Encounters</div></div>`;
        html += `<div class="statistic-card"><div class="statistic-value">${totals.catches.toLocaleString()}</div><div class="statistic-label">Catches</div></div>`;
        html += `<div class="statistic-card"><div class="statistic-value">${shinyRateDisplay}</div><div class="statistic-label">Shiny Rate</div></div>`;
        const bestIVEntry = combinedEntries.filter(r => r.total_highest_iv_sum != null).sort((a, b) => (b.total_highest_iv_sum || 0) - (a.total_highest_iv_sum || 0))[0];
        const bestSVEntry = combinedEntries.filter(r => r.total_highest_sv != null).sort((a, b) => (b.total_highest_sv || 0) - (a.total_highest_sv || 0))[0];
        const lowestIVEntry = combinedEntries.filter(r => r.total_lowest_iv_sum != null).sort((a, b) => (a.total_lowest_iv_sum || 999) - (b.total_lowest_iv_sum || 999))[0];
        const lowestSVEntry = combinedEntries.filter(r => r.total_lowest_sv != null).sort((a, b) => (a.total_lowest_sv || 999999) - (b.total_lowest_sv || 999999))[0];
        const highestShinyPctEntry = combinedEntries.filter(r => (r.total_encounters || 0) >= 1).map(r => ({ ...r, shinyPct: ((r.shiny_encounters || 0) / (r.total_encounters || 1)) * 100 })).sort((a, b) => (b.shinyPct || 0) - (a.shinyPct || 0))[0];
        if (bestIVEntry) html += `<div class="statistic-card"><div class="statistic-value">${Number(bestIVEntry.total_highest_iv_sum).toLocaleString()}</div><div class="statistic-label">Highest IV <span class="statistic-sublabel">(${escapeHtml(bestIVEntry.species_name || '—')})</span></div></div>`;
        if (bestSVEntry) html += `<div class="statistic-card"><div class="statistic-value">${Number(bestSVEntry.total_highest_sv).toLocaleString()}</div><div class="statistic-label">Highest SV <span class="statistic-sublabel">(${escapeHtml(bestSVEntry.species_name || '—')})</span></div></div>`;
        if (lowestIVEntry) html += `<div class="statistic-card"><div class="statistic-value">${Number(lowestIVEntry.total_lowest_iv_sum).toLocaleString()}</div><div class="statistic-label">Lowest IV <span class="statistic-sublabel">(${escapeHtml(lowestIVEntry.species_name || '—')})</span></div></div>`;
        if (lowestSVEntry) html += `<div class="statistic-card"><div class="statistic-value">${Number(lowestSVEntry.total_lowest_sv).toLocaleString()}</div><div class="statistic-label">Lowest SV <span class="statistic-sublabel">(${escapeHtml(lowestSVEntry.species_name || '—')})</span></div></div>`;
        if (highestShinyPctEntry && highestShinyPctEntry.shinyPct != null) html += `<div class="statistic-card"><div class="statistic-value">${(highestShinyPctEntry.shinyPct).toFixed(1)}%</div><div class="statistic-label">Highest shiny % <span class="statistic-sublabel">(${escapeHtml(highestShinyPctEntry.species_name || '—')})</span></div></div>`;
        html += '</div>';
        html += '<div class="statistics-totals-by-instance"><h4 class="statistics-totals-table-title">By instance</h4><div class="statistics-table-wrapper"><table class="statistics-table statistics-totals-table">';
        html += '<thead><tr>';
        html += '<th class="statistics-th-sortable" data-sort-col="instance" data-sort-type="text">Instance</th>';
        html += '<th class="statistics-th-sortable" data-sort-col="encounters" data-sort-type="number">Encounters</th>';
        html += '<th class="statistics-th-sortable" data-sort-col="shinies" data-sort-type="number">Shinies</th>';
        html += '<th class="statistics-th-sortable" data-sort-col="catches" data-sort-type="number">Catches</th>';
        html += '<th class="statistics-th-sortable" data-sort-col="shiny-rate" data-sort-type="number">Shiny Rate</th>';
        html += '</tr></thead><tbody>';
        for (const row of byBot) {
            const enc = Number(row.totals?.total_encounters ?? row.totals?.totalEncounters ?? 0) || 0;
            const sh = Number(row.totals?.shiny_encounters ?? row.totals?.shinyEncounters ?? 0) || 0;
            const cat = Number(row.totals?.catches ?? 0) || 0;
            const botOneInX = sh > 0 && enc > 0 ? Math.round(enc / sh) : null;
            const rateDisplay = botOneInX != null ? `1 in ${botOneInX.toLocaleString()}` : '—';
            const rateSort = botOneInX != null ? botOneInX : 0;
            const instanceName = (row.name || '').trim();
            html += `<tr class="statistics-instance-row" data-instance="${escapeHtml(instanceName)}" data-encounters="${enc}" data-shinies="${sh}" data-catches="${cat}" data-shiny-rate="${rateSort}"><td class="statistics-instance-name">${escapeHtml(row.name)}${row.fromCache ? ' <span class="statistics-cached-badge">(cached)</span>' : ''}</td><td>${enc.toLocaleString()}</td><td>${sh.toLocaleString()}</td><td>${cat.toLocaleString()}</td><td>${rateDisplay}</td></tr>`;
        }
        html += `<tr class="statistics-totals-table-footer"><td><strong>Total</strong></td><td><strong>${totals.total_encounters.toLocaleString()}</strong></td><td><strong>${totals.shiny_encounters.toLocaleString()}</strong></td><td><strong>${totals.catches.toLocaleString()}</strong></td><td><strong>${shinyRateDisplay}</strong></td></tr>`;
        html += '</tbody></table></div></div></div>';
        const speciesEntries = Object.entries(totals.by_species).sort((a, b) => b[1] - a[1]).slice(0, 30);
        if (speciesEntries.length > 0) {
            html += '<div class="statistics-section"><h3>Most common species (combined)</h3><div class="statistics-list">';
            speciesEntries.forEach(([species, count], idx) => {
                const pct = totals.total_encounters > 0 ? ((count / totals.total_encounters) * 100).toFixed(1) : '0';
                html += `<div class="statistics-item"><span class="statistics-rank">${idx + 1}.</span><span class="statistics-name">${escapeHtml(species)}</span><span class="statistics-count">${Number(count).toLocaleString()} (${pct}%)</span></div>`;
            });
            html += '</div></div>';
        }
        const sortedPokemon = Object.values(combinedPokemon).sort((a, b) => (b.total_encounters || 0) - (a.total_encounters || 0));
        if (sortedPokemon.length > 0) {
            html += '<div class="statistics-section"><h3>Per-species statistics (combined)</h3><p class="statistics-subtitle">From /stats pokemon data across all instances. Search by name or number. Click column headers to sort.</p>';
            html += '<input type="text" id="botStatsSpeciesFilter" class="input statistics-species-filter" placeholder="Search Pokémon (name or #)..." autocomplete="off">';
            html += '<div class="statistics-table-wrapper"><table class="statistics-table statistics-per-species-table"><thead><tr>';
            html += '<th class="statistics-th-sortable" data-sort-col="species" data-sort-type="text">Species</th>';
            html += '<th class="statistics-th-sortable" data-sort-col="encounters" data-sort-type="number">Encounters</th>';
            html += '<th class="statistics-th-sortable" data-sort-col="shinies" data-sort-type="number">Shinies</th>';
            html += '<th class="statistics-th-sortable" data-sort-col="catches" data-sort-type="number">Catches</th>';
            html += '<th class="statistics-th-sortable" data-sort-col="shiny-rate" data-sort-type="number">1 in X (shiny)</th>';
            html += '<th class="statistics-th-sortable" data-sort-col="best-iv" data-sort-type="number">Best IV</th>';
            html += '<th class="statistics-th-sortable" data-sort-col="lowest-iv" data-sort-type="number">Lowest IV</th>';
            html += '<th class="statistics-th-sortable" data-sort-col="last-encounter" data-sort-type="number">Last encounter</th>';
            html += '</tr></thead><tbody id="botStatsPerMonList">';
            sortedPokemon.forEach((r) => {
                const name = r.species_name || '—';
                const id = r.species_id != null ? r.species_id : '';
                const lastTime = r.last_encounter_time ? (() => { try { const d = new Date(r.last_encounter_time); return isNaN(d.getTime()) ? r.last_encounter_time : d.toLocaleString(); } catch (_) { return r.last_encounter_time; } })() : '—';
                const lastTimeTs = r.last_encounter_time ? (() => { try { return new Date(r.last_encounter_time).getTime(); } catch (_) { return 0; } })() : 0;
                const enc = Number(r.total_encounters || 0);
                const sh = Number(r.shiny_encounters || 0);
                const cat = Number(r.catches || 0);
                const oneInX = sh > 0 && enc > 0 ? Math.round(enc / sh) : null;
                const shinyRateDisplay = oneInX != null ? `1 in ${oneInX.toLocaleString()}` : '—';
                const shinyRateSort = oneInX != null ? oneInX : 0;
                const bestIv = r.total_highest_iv_sum != null ? Number(r.total_highest_iv_sum) : '';
                const lowIv = r.total_lowest_iv_sum != null ? Number(r.total_lowest_iv_sum) : '';
                html += `<tr class="statistics-per-mon-item" data-species-key="${escapeHtml(String(name))}" data-species-id="${escapeHtml(String(id))}" data-encounters="${enc}" data-shinies="${sh}" data-catches="${cat}" data-shiny-rate="${shinyRateSort}" data-best-iv="${bestIv}" data-lowest-iv="${lowIv}" data-last-encounter="${lastTimeTs}" data-species="${escapeHtml(String(name))}"><td class="statistics-name">${escapeHtml(name)}</td><td>${enc.toLocaleString()}</td><td>${sh.toLocaleString()}</td><td>${cat.toLocaleString()}</td><td>${shinyRateDisplay}</td><td>${bestIv !== '' ? bestIv : '—'}</td><td>${lowIv !== '' ? lowIv : '—'}</td><td class="statistics-last-time">${escapeHtml(lastTime)}</td></tr>`;
            });
            html += '</tbody></table></div></div>';
        }
        if (sortedPokemon.length === 0) {
            const allSpeciesEntries = Object.entries(totals.by_species).sort((a, b) => b[1] - a[1]);
            if (allSpeciesEntries.length > 0) {
                html += '<div class="statistics-section"><h3>Total statistics per Pokémon</h3><p class="statistics-subtitle">Combined encounter count across all instances. Search by name or number.</p>';
                html += '<input type="text" id="botStatsSpeciesFilter" class="input statistics-species-filter" placeholder="Search Pokémon (name or #)..." autocomplete="off">';
                html += '<div class="statistics-per-mon-list" id="botStatsPerMonList">';
                allSpeciesEntries.forEach(([species, count], idx) => {
                    const pct = totals.total_encounters > 0 ? ((count / totals.total_encounters) * 100).toFixed(1) : '0';
                    const displayName = /^\d+$/.test(String(species)) ? `#${species}` : species;
                    html += `<div class="statistics-item statistics-per-mon-item" data-species-key="${escapeHtml(species)}" data-species-display="${escapeHtml(displayName)}" data-species-count="${Number(count).toLocaleString()}" data-species-pct="${pct}" title="Total encounters for this species. Click to show details." role="button" tabindex="0"><span class="statistics-rank">${idx + 1}.</span><span class="statistics-name">${escapeHtml(displayName)}</span><span class="statistics-count">${Number(count).toLocaleString()} (${pct}%)</span><div class="statistics-per-mon-detail hidden" aria-live="polite">Encounters: <strong>${Number(count).toLocaleString()}</strong> (${pct}% of total)</div></div>`;
                });
                html += '</div></div>';
            }
        }
        html += '<div class="statistics-section"><h3>By instance</h3>';
        for (const row of byBot) {
            html += '<div class="statistics-subsection">';
            html += `<h4>${escapeHtml(row.name)}${row.fromCache ? ' <span class="statistics-cached-badge">(cached)</span>' : ''}</h4>`;
            if (row.error && !row.fromCache) {
                html += `<p class="no-data">Failed to load: ${escapeHtml(row.error)}</p>`;
            } else {
                const t = row.totals || {};
                const enc = t.total_encounters ?? t.totalEncounters ?? 0;
                const sh = t.shiny_encounters ?? t.shinyEncounters ?? 0;
                const cat = t.catches ?? 0;
                html += '<div class="statistics-grid">';
                html += `<div class="statistic-card"><div class="statistic-value">${Number(enc).toLocaleString()}</div><div class="statistic-label">Encounters</div></div>`;
                html += `<div class="statistic-card"><div class="statistic-value">${Number(sh).toLocaleString()}</div><div class="statistic-label">Shinies</div></div>`;
                html += `<div class="statistic-card"><div class="statistic-value">${Number(cat).toLocaleString()}</div><div class="statistic-label">Catches</div></div>`;
                if (t.total_highest_iv_sum && typeof t.total_highest_iv_sum === 'object') html += `<div class="statistic-card"><div class="statistic-value">${t.total_highest_iv_sum.value}</div><div class="statistic-label">Highest IV <span class="statistic-sublabel">(${escapeHtml(t.total_highest_iv_sum.species_name || '—')})</span></div></div>`;
                if (t.total_highest_sv && typeof t.total_highest_sv === 'object') html += `<div class="statistic-card"><div class="statistic-value">${t.total_highest_sv.value.toLocaleString()}</div><div class="statistic-label">Highest SV <span class="statistic-sublabel">(${escapeHtml(t.total_highest_sv.species_name || '—')})</span></div></div>`;
                html += '</div>';
                const botSpeciesEntries = Object.entries(row.by_species || {}).map(([s, d]) => [s, typeof d === 'number' ? d : (d?.count ?? d?.encounters ?? 0)]).sort((a, b) => b[1] - a[1]).slice(0, 10);
                if (botSpeciesEntries.length > 0) {
                    html += '<div class="statistics-list">';
                    botSpeciesEntries.forEach(([species, c]) => { html += `<div class="statistics-item"><span class="statistics-name">${escapeHtml(species)}</span><span class="statistics-count">${Number(c).toLocaleString()}</span></div>`; });
                    html += '</div>';
                }
            }
            html += '</div>';
        }
        html += '</div></div>';
        return html;
    }

    function wireStatisticsFilter() {
        const filterInput = document.getElementById('botStatsSpeciesFilter');
        const perMonList = document.getElementById('botStatsPerMonList');
        if (filterInput && perMonList) {
            filterInput.addEventListener('input', () => {
                const q = (filterInput.value || '').trim().toLowerCase();
                perMonList.querySelectorAll('.statistics-per-mon-item').forEach(el => {
                    const key = (el.dataset.speciesKey || '').toLowerCase();
                    const display = (el.dataset.speciesDisplay || '').toLowerCase();
                    const id = (el.dataset.speciesId || '').toLowerCase();
                    const nameCell = el.querySelector('.statistics-name');
                    const cellText = nameCell ? (nameCell.textContent || '').toLowerCase() : '';
                    el.style.display = !q || key.includes(q) || display.includes(q) || id.includes(q) || cellText.includes(q) ? '' : 'none';
                });
            });
            perMonList.addEventListener('click', (e) => {
                const row = e.target.closest('.statistics-per-mon-item');
                if (row && row.querySelector('.statistics-per-mon-detail')) row.querySelector('.statistics-per-mon-detail').classList.toggle('hidden');
            });
            perMonList.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                const row = e.target.closest('.statistics-per-mon-item');
                if (row && row.querySelector('.statistics-per-mon-detail')) { e.preventDefault(); row.querySelector('.statistics-per-mon-detail').classList.toggle('hidden'); }
            });
        }
        const perSpeciesTable = document.querySelector('.statistics-per-species-table');
        if (perSpeciesTable) {
            const thead = perSpeciesTable.querySelector('thead');
            const tbody = perSpeciesTable.querySelector('#botStatsPerMonList');
            if (thead && tbody) {
                thead.addEventListener('click', (e) => {
                    const th = e.target.closest('.statistics-th-sortable');
                    if (!th) return;
                    const col = th.getAttribute('data-sort-col');
                    const type = th.getAttribute('data-sort-type') || 'number';
                    const dir = th.getAttribute('data-sort-dir') === 'asc' ? 'desc' : 'asc';
                    thead.querySelectorAll('.statistics-th-sortable').forEach(h => h.removeAttribute('data-sort-dir'));
                    th.setAttribute('data-sort-dir', dir);
                    const attr = 'data-' + col;
                    const rows = Array.from(tbody.querySelectorAll('.statistics-per-mon-item'));
                    rows.sort((a, b) => {
                        let va = a.getAttribute(attr);
                        let vb = b.getAttribute(attr);
                        if (type === 'number') {
                            va = va === '' || va == null ? (dir === 'asc' ? Infinity : -Infinity) : Number(va);
                            vb = vb === '' || vb == null ? (dir === 'asc' ? Infinity : -Infinity) : Number(vb);
                            return dir === 'asc' ? va - vb : vb - va;
                        }
                        va = (va || '').toLowerCase();
                        vb = (vb || '').toLowerCase();
                        const cmp = va.localeCompare(vb);
                        return dir === 'asc' ? cmp : -cmp;
                    });
                    rows.forEach(r => tbody.appendChild(r));
                });
            }
        }
        const instanceTable = document.querySelector('.statistics-totals-table');
        if (instanceTable) {
            const thead = instanceTable.querySelector('thead');
            const tbody = instanceTable.querySelector('tbody');
            if (thead && tbody) {
                thead.addEventListener('click', (e) => {
                    const th = e.target.closest('.statistics-th-sortable');
                    if (!th) return;
                    const col = th.getAttribute('data-sort-col');
                    const type = th.getAttribute('data-sort-type') || 'number';
                    const dir = th.getAttribute('data-sort-dir') === 'asc' ? 'desc' : 'asc';
                    thead.querySelectorAll('.statistics-th-sortable').forEach(h => h.removeAttribute('data-sort-dir'));
                    th.setAttribute('data-sort-dir', dir);
                    const footer = tbody.querySelector('.statistics-totals-table-footer');
                    const attr = 'data-' + col;
                    const rows = Array.from(tbody.querySelectorAll('.statistics-instance-row'));
                    rows.sort((a, b) => {
                        let va = a.getAttribute(attr);
                        let vb = b.getAttribute(attr);
                        if (type === 'number') {
                            va = va === '' || va == null ? (dir === 'asc' ? Infinity : -Infinity) : Number(va);
                            vb = vb === '' || vb == null ? (dir === 'asc' ? Infinity : -Infinity) : Number(vb);
                            return dir === 'asc' ? va - vb : vb - va;
                        }
                        va = (va || '').toLowerCase();
                        vb = (vb || '').toLowerCase();
                        const cmp = va.localeCompare(vb);
                        return dir === 'asc' ? cmp : -cmp;
                    });
                    if (footer) footer.remove();
                    rows.forEach(r => tbody.appendChild(r));
                    if (footer) tbody.appendChild(footer);
                });
            }
        }
    }

    // Phase 1: show cached data immediately
    const results = buildResultsFromCache();
    body.innerHTML = buildStatisticsHtml(results);
    hideLoading();
    wireStatisticsFilter();

    // Phase 2: fetch in background if any bot needs an update
    const now = Date.now();
    const needsFetch = botsToShow.filter(bot => {
        const cached = botStatsCache.get(bot.id);
        return forceRefresh || !cached || !cached.stats || (now - (cached.time || 0)) >= BOT_STATS_CACHE_MAX_AGE_MS;
    });
    if (needsFetch.length === 0) return;

    (async () => {
        for (const bot of needsFetch) {
            try {
                const statsData = await (forceRefresh
                    ? fetchBotEndpoint(bot, (bot.url || '').replace(/\/$/, ''), '/stats', { timeout: 20000 })
                    : fetchBotEndpoint(bot, (bot.url || '').replace(/\/$/, ''), '/stats'));
                if (statsData != null) botStatsCache.set(bot.id, { stats: statsData, time: Date.now() });
            } catch (e) {
                let fallback = botStatsCache.get(bot.id);
                if (!fallback && botDataCache.has(bot.id)) {
                    const botData = botDataCache.get(bot.id);
                    const raw = botData?.data?.stats;
                    const statsFromCard = raw && typeof raw === 'object' && raw.data !== undefined ? raw.data : raw;
                    if (statsFromCard != null) { fallback = { stats: statsFromCard, time: Date.now() }; botStatsCache.set(bot.id, fallback); }
                }
            }
            await new Promise(r => setTimeout(r, 0));
        }
        saveBotStatsCache();
        const results2 = buildResultsFromCache();
        body.innerHTML = buildStatisticsHtml(results2);
        wireStatisticsFilter();
    })();
}

// Load and display bot instances
// Load bot instances from server
async function loadBotInstancesFromServer() {
    try {
        const response = await fetch('/api/bots');
        if (response.ok) {
            const serverBots = await response.json();
            botInstances = Array.isArray(serverBots) ? serverBots : [];
            
            // If server has no bots but localStorage does, migrate them
            if (botInstances.length === 0) {
                const localBots = JSON.parse(localStorage.getItem('botInstances') || '[]');
                if (localBots.length > 0) {
                    console.log(`Migrating ${localBots.length} bot instances from localStorage to server`);
                    botInstances = localBots;
                    await saveBotInstances(); // Save to server
                }
            }
            
            // Also save to localStorage as backup
            localStorage.setItem('botInstances', JSON.stringify(botInstances));
            console.log(`Loaded ${botInstances.length} bot instances from server`);
        } else {
            console.warn('Failed to load bots from server, using localStorage fallback');
            // Fallback to localStorage
            botInstances = JSON.parse(localStorage.getItem('botInstances') || '[]');
        }
    } catch (error) {
        console.error('Error loading bots from server:', error);
        // Fallback to localStorage
        botInstances = JSON.parse(localStorage.getItem('botInstances') || '[]');
    }
    
    loadBotInstances();
}

function loadBotInstances() {
    botInstancesContainer.innerHTML = '';
    
    if (botInstances.length === 0) {
        botInstancesContainer.innerHTML = '<p class="no-bots">No bot instances configured. Click "Add Bot Instance" to get started.</p>';
        return;
    }

    botInstances.forEach((bot, index) => {
        const botCard = createBotInstanceCard(bot, index);
        botInstancesContainer.appendChild(botCard);
    });
}

function createBotInstanceCard(bot, index) {
    const card = document.createElement('div');
    card.className = 'bot-instance-card';
    card.innerHTML = `
        <div class="bot-instance-info">
            <h3>${bot.name || `Bot ${index + 1}`}</h3>
            <p class="bot-url">${bot.url}</p>
        </div>
        <div class="bot-instance-actions">
            <button class="btn btn-secondary btn-small edit-bot-btn" data-index="${index}">Edit</button>
            <button class="btn btn-secondary btn-small test-bot-btn" data-index="${index}">Test</button>
            <button class="btn btn-danger btn-small remove-bot-btn" data-index="${index}">Remove</button>
        </div>
    `;

    // Add event listeners
    const editBtn = card.querySelector('.edit-bot-btn');
    const testBtn = card.querySelector('.test-bot-btn');
    const removeBtn = card.querySelector('.remove-bot-btn');

    if (editBtn) {
        editBtn.addEventListener('click', () => editBotInstance(index));
    }

    if (testBtn) {
        testBtn.addEventListener('click', () => testBotConnection(index));
    }

    if (removeBtn) {
        removeBtn.addEventListener('click', () => removeBotInstance(index));
    }

    return card;
}

// Edit bot instance
function editBotInstance(index) {
    const bot = botInstances[index];
    if (!bot) return;

    // Parse URL to extract components
    let host = '';
    let port = '';
    
    try {
        const urlObj = new URL(bot.url);
        host = urlObj.hostname;
        port = urlObj.port || '';
    } catch (err) {
        // If URL parsing fails, try to extract manually
        const match = bot.url.match(/(?:https?:\/\/)?([^:\/]+)(?::(\d+))?/);
        if (match) {
            host = match[1] || '';
            port = match[2] || '';
        } else {
            host = bot.url;
        }
    }

    // Populate form with existing data
    document.getElementById('botName').value = bot.name || '';
    document.getElementById('botUrl').value = host;
    document.getElementById('botPort').value = port;

    // Set modal to edit mode
    const modalTitle = addBotModal.querySelector('.modal-header h2');
    if (modalTitle) {
        modalTitle.textContent = 'Edit Bot Instance';
    }
    
    // Store the index being edited
    addBotModal.dataset.editIndex = index;
    
    // Show modal
    addBotModal.classList.remove('hidden');
}

// Save bot instance (handles both add and edit)
function saveBotInstance() {
    const name = document.getElementById('botName').value.trim();
    const url = document.getElementById('botUrl').value.trim();
    const port = document.getElementById('botPort').value.trim();
    const editIndex = addBotModal.dataset.editIndex;

    if (!url) {
        alert('Please enter a bot hostname or IP address');
        return;
    }

    // Construct full URL - ensure it has protocol and port
    let fullUrl = url.trim();
    
    // Add protocol if missing
    if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
        fullUrl = `http://${fullUrl}`;
    }
    
    // Parse URL to ensure proper format and preserve port
    try {
        const urlObj = new URL(fullUrl);
        
        // If port field is provided, use it
        if (port) {
            urlObj.port = port;
        }
        
        fullUrl = urlObj.href;
    } catch (err) {
        alert('Invalid URL format. Please enter a valid hostname or IP address (e.g., localhost or 127.0.0.1)');
        return;
    }

    // Remove trailing slash
    fullUrl = fullUrl.replace(/\/$/, '');

    if (editIndex !== undefined) {
        // Edit existing bot
        const index = parseInt(editIndex);
        if (botInstances[index]) {
            botInstances[index].name = name || `Bot ${index + 1}`;
            botInstances[index].url = fullUrl;
            saveBotInstances();
            loadBotInstances();
            updateBotStatus(); // Refresh status cards
        }
    } else {
        // Add new bot
        const botInstance = {
            id: Date.now().toString(),
            name: name || `Bot ${botInstances.length + 1}`,
            url: fullUrl
        };

        botInstances.push(botInstance);
        saveBotInstances();
        loadBotInstances();
        updateBotStatus(); // Refresh status cards
    }

    addBotModal.classList.add('hidden');
    clearAddBotForm();
}

function clearAddBotForm() {
    document.getElementById('botName').value = '';
    document.getElementById('botUrl').value = '';
    document.getElementById('botPort').value = '';
    
    // Reset modal to add mode
    const modalTitle = addBotModal.querySelector('.modal-header h2');
    if (modalTitle) {
        modalTitle.textContent = 'Add Bot Instance';
    }
    
    // Clear edit index
    if (addBotModal.dataset.editIndex) {
        delete addBotModal.dataset.editIndex;
    }
}

// Show hidden bots modal
function showHiddenBotsModal() {
    if (!hiddenBotsList) return;
    
    // Get all hidden bots
    const hiddenBots = botInstances.filter(bot => {
        const config = botOrderConfig[bot.id];
        return config && config.hidden;
    });
    
    if (hiddenBots.length === 0) {
        hiddenBotsList.innerHTML = '<p class="no-hidden-bots">No hidden bots.</p>';
    } else {
        hiddenBotsList.innerHTML = '';
        hiddenBots.forEach(bot => {
            const botItem = document.createElement('div');
            botItem.className = 'hidden-bot-item';
            botItem.innerHTML = `
                <div class="hidden-bot-info">
                    <h4>${bot.name || 'Unnamed Bot'}</h4>
                    <p class="bot-url">${bot.url}</p>
                </div>
                <button class="btn btn-primary btn-small unhide-bot-btn" data-bot-id="${bot.id}">Unhide</button>
            `;
            
            const unhideBtn = botItem.querySelector('.unhide-bot-btn');
            if (unhideBtn) {
                unhideBtn.addEventListener('click', () => {
                    unhideBot(bot.id);
                });
            }
            
            hiddenBotsList.appendChild(botItem);
        });
    }
    
    hiddenBotsModal.classList.remove('hidden');
}

// Unhide a bot
function unhideBot(botId) {
    if (!botOrderConfig[botId]) {
        botOrderConfig[botId] = { order: 0, hidden: false };
    } else {
        botOrderConfig[botId].hidden = false;
    }
    
    saveBotOrderConfig();
    
    // Update the card if it exists
    const card = document.getElementById(`bot-status-${botId}`);
    if (card) {
        card.style.display = '';
        const toggleBtn = card.querySelector('.bot-toggle-visibility');
        if (toggleBtn) {
            toggleBtn.textContent = '👁️';
            toggleBtn.title = 'Hide Bot';
        }
    } else {
        // Card doesn't exist yet, trigger update
        updateBotStatus();
    }
    
    // Reorder cards
    reorderBotCards();
    
    // Update summary
    updateDashboardSummary();
    
    // Refresh the hidden bots list
    showHiddenBotsModal();
}

function removeBotInstance(index) {
    if (confirm('Are you sure you want to remove this bot instance?')) {
        botInstances.splice(index, 1);
        saveBotInstances();
        loadBotInstances();
        updateBotStatus();
    }
}

function testBotConnection(index) {
    const bot = botInstances[index];
    if (!bot) return;

    fetchBotData(bot, true).then(result => {
        if (result.success) {
            alert(`Connection successful! Bot is responding.`);
        } else {
            alert(`Connection failed: ${result.error}`);
        }
    });
}

// Save bot instances to server
async function saveBotInstances() {
    // Save to localStorage as backup
    localStorage.setItem('botInstances', JSON.stringify(botInstances));
    
    // Save to server
    try {
        const response = await fetch('/api/bots', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ bots: botInstances })
        });
        
        if (response.ok) {
            console.log('Bot instances saved to server successfully');
        } else {
            const error = await response.json().catch(() => ({ error: response.statusText }));
            console.error('Failed to save bots to server:', error);
        }
    } catch (error) {
        console.error('Error saving bots to server:', error);
        // Continue anyway - at least localStorage is saved
    }
}

// Fetch bot data from API
async function fetchBotData(bot, testOnly = false) {
    try {
        // Skip API documentation fetch - not needed and causes errors
        // The bot API endpoints are well-known and don't need to be discovered

        // Try to fetch through server proxy first (handles CORS), then direct
        // PokeBotGen-3 API endpoints (from api.json documentation)
        // Use /emulator as the status endpoint since it provides emulator info
        const endpoints = [
            '/emulator',
            '/game_state',
            '/player'
        ];

        let statusData = null;
        let workingEndpoint = null;
        
        for (const endpoint of endpoints) {
            try {
                // First try through server proxy
                let response = null;
                try {
                    response = await fetch(`/api/bot-proxy?url=${encodeURIComponent(bot.url + endpoint)}`, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json'
                        },
                        signal: AbortSignal.timeout(5000) // 5s per endpoint so we don't block other bots
                    });
                } catch (proxyErr) {
                    // If proxy fails, try direct connection
                    try {
                        response = await fetch(`${bot.url}${endpoint}`, {
                            method: 'GET',
                            headers: {
                                'Accept': 'application/json'
                            },
                            signal: AbortSignal.timeout(5000)
                        });
                    } catch (directErr) {
                        continue;
                    }
                }

                if (response && response.ok) {
                    statusData = await response.json();
                    workingEndpoint = endpoint;
                    break;
                }
            } catch (err) {
                console.warn(`Failed to fetch ${endpoint}:`, err);
                continue;
            }
        }

        if (testOnly) {
            return { 
                success: statusData !== null, 
                error: statusData ? null : 'No response from bot API. Check the URL and ensure the bot is running.' 
            };
        }

        if (!statusData) {
            return { 
                success: false, 
                error: 'Could not connect to bot API. Make sure the bot is running and the URL is correct.' 
            };
        }

        // Fetch additional data using the working endpoint base
        // Based on PokeBotGen-3 API documentation
        // Note: encounter_log is fetched separately with retry logic to avoid SQLite cursor conflicts
        const baseUrl = bot.url;
        
        // Fetch player data separately if we didn't get it from the status endpoint
        const needsPlayerData = workingEndpoint !== '/player';
        const needsEmulatorData = workingEndpoint !== '/emulator';
        const needsGameStateData = workingEndpoint !== '/game_state';
        
        // Stats are fetched on a slower interval (updateBotStatsOnly); use cache here so UI poll stays light
        const cachedStats = botDataCache.get(bot.id)?.data?.stats;
        
        const fetchPromises = [
            fetchBotEndpoint(bot, baseUrl, '/party'),
            fetchBotEndpoint(bot, baseUrl, '/encounter_rate'),
            fetchBotEndpoint(bot, baseUrl, '/map')
        ];
        
        if (needsEmulatorData) {
            fetchPromises.push(fetchBotEndpoint(bot, baseUrl, '/emulator'));
        } else {
            fetchPromises.push(Promise.resolve(null)); // Placeholder
        }
        
        if (needsPlayerData) {
            fetchPromises.push(fetchBotEndpoint(bot, baseUrl, '/player'));
        } else {
            fetchPromises.push(Promise.resolve(null)); // Placeholder
        }
        
        if (needsGameStateData) {
            fetchPromises.push(fetchBotEndpoint(bot, baseUrl, '/game_state'));
        } else {
            fetchPromises.push(Promise.resolve(null)); // Placeholder
        }
        
        const [partyData, encounterRateData, mapData, emulatorData, playerData, gameStateData] = await Promise.all(fetchPromises);
        
        // Use cached or empty stats (stats are updated by the slower stats-only poll)
        const statsData = cachedStats && typeof cachedStats === 'object' ? cachedStats : {};
        
        // Ensure partyData is always an array (handle null/undefined/errors)
        const finalPartyData = Array.isArray(partyData) ? partyData : [];
        
        // Use statusData as emulatorData if we got it from /emulator endpoint
        const finalEmulatorData = needsEmulatorData ? (emulatorData || null) : (workingEndpoint === '/emulator' ? statusData : null);
        // Use statusData as playerData if we got it from /player endpoint
        const finalPlayerData = needsPlayerData ? (playerData || null) : (workingEndpoint === '/player' ? statusData : null);
        // Use statusData as gameStateData if we got it from /game_state endpoint
        const finalGameStateData = needsGameStateData ? (gameStateData || null) : (workingEndpoint === '/game_state' ? statusData : null);
        
        // Debug: log encounter rate data
        if (encounterRateData) {
            console.log(`[${bot.name}] Raw encounter_rate endpoint response:`, encounterRateData);
            console.log(`[${bot.name}] Extracted encounter_rate:`, encounterRateData?.encounter_rate);
            console.log(`[${bot.name}] Type of encounterRateData:`, typeof encounterRateData, 'Is object:', typeof encounterRateData === 'object');
        }
        
        // Calculate final encounter_rate value
        // encounterRateData should be { encounter_rate: number }
        let finalEncounterRate = undefined;
        if (encounterRateData) {
            if (typeof encounterRateData === 'object' && encounterRateData.encounter_rate !== undefined) {
                finalEncounterRate = encounterRateData.encounter_rate;
            } else if (typeof encounterRateData === 'number') {
                finalEncounterRate = encounterRateData;
            }
        }
        if (!finalEncounterRate && statsData && statsData.encounter_rate !== undefined) {
            finalEncounterRate = statsData.encounter_rate;
        }
        console.log(`[${bot.name}] Final encounter_rate value:`, finalEncounterRate, 'from encounterRateData:', encounterRateData);
        
        // Fetch current opponent/encounter to track encounters
        // Add a small delay to avoid conflicts with other concurrent requests
        await new Promise(resolve => setTimeout(resolve, 100));
        const currentEncounter = await fetchBotEndpoint(
            bot, 
            baseUrl, 
            '/opponent', '/current_encounter', '/encounter'
        );

        // Merge all data into status
        const mergedStatus = {
            ...statusData,
            ...(finalEmulatorData || {}),
            ...(finalPlayerData || {}),
            ...(finalGameStateData || {}),
            // Also include as nested objects for easier access
            emulator: finalEmulatorData,
            player: finalPlayerData,
            gameState: finalGameStateData
        };

        // Track the current encounter BEFORE getting tracked list (so new encounters are included)
        if (currentEncounter) {
            console.log(`[${bot.name}] Tracking current encounter from fetchBotData:`, currentEncounter);
            trackCurrentEncounter(bot.id, currentEncounter);
        } else {
            console.log(`[${bot.name}] No current encounter data from /opponent endpoint`);
        }

        // Fetch WildEncounter events from API (preferred over tracked encounters)
        const recentFindsCount = dashboardSettings.recentFindsCount || 5;
        const wildEncounterEvents = await fetchWildEncounterEvents(bot, recentFindsCount);
        
        // Use WildEncounter events if available, otherwise fall back to tracked encounters
        let encounterList = [];
        if (wildEncounterEvents && wildEncounterEvents.length > 0) {
            encounterList = wildEncounterEvents;
            console.log(`[${bot.name}] Using ${wildEncounterEvents.length} WildEncounter events for Recent Finds`);
        } else {
            // Fallback to tracked encounters (most recent first)
            encounterList = (trackedEncounters[bot.id] || []).slice().reverse();
            console.log(`[${bot.name}] Using ${encounterList.length} tracked encounters for Recent Finds (WildEncounter events not available)`);
        }
        
        return {
            success: true,
            data: {
                status: mergedStatus,
                party: finalPartyData,
                encounters: encounterList,
                currentEncounter: currentEncounter,
                stats: statsData,
                encounter_rate: finalEncounterRate,
                map: mapData,
                emulator: finalEmulatorData,
                player: finalPlayerData,
                gameState: finalGameStateData
            }
        };
    } catch (error) {
        console.error(`Error fetching data from ${bot.name}:`, error);
        return {
            success: false,
            error: error.message || 'Unknown error'
        };
    }
}

// Fetch bot endpoint with retry logic for handling SQLite cursor errors
async function fetchBotEndpointWithRetry(bot, baseUrl, endpoints, maxRetries = 3, initialDelay = 500) {
    let lastError = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const result = await fetchBotEndpoint(bot, baseUrl, ...endpoints);
            if (result !== null) {
                return result; // Success
            }
        } catch (error) {
            lastError = error;
            const errorMessage = error.message || String(error) || '';
            const errorText = error.toString() || '';
            
            // Check if it's a SQLite cursor error or similar database error
            if (errorMessage.includes('Recursive use of cursors') || 
                errorMessage.includes('ProgrammingError') ||
                errorMessage.includes('database is locked') ||
                errorMessage.includes('SQLite') ||
                errorText.includes('Recursive use of cursors') ||
                errorText.includes('ProgrammingError')) {
                
                if (attempt < maxRetries - 1) {
                    // Exponential backoff: wait longer between retries
                    const delay = initialDelay * Math.pow(2, attempt);
                    console.warn(`[${bot.name}] SQLite cursor error on attempt ${attempt + 1}/${maxRetries}, retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
            } else {
                // Non-SQLite error, don't retry
                console.error(`[${bot.name}] Non-SQLite error, not retrying:`, error);
                throw error;
            }
        }
    }
    
    // All retries failed
    console.error(`[${bot.name}] Failed to fetch encounter_log after ${maxRetries} attempts:`, lastError);
    return null;
}

// Fetch species-specific encounter count from bot API
async function fetchSpeciesEncounterCount(bot, speciesId) {
    try {
        const baseUrl = bot.url;
        const endpoints = [
            `/stats/species/${speciesId}`,
            `/stats/by_species/${speciesId}`,
            `/species/${speciesId}/stats`,
            `/encounters/${speciesId}`
        ];
        
        for (const endpoint of endpoints) {
            try {
                const fullUrl = baseUrl.endsWith('/') 
                    ? baseUrl.slice(0, -1) + endpoint 
                    : baseUrl + endpoint;
                
                // Try proxy first
                let response = null;
                try {
                    response = await fetch(`/api/bot-proxy?url=${encodeURIComponent(fullUrl)}`, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json'
                        },
                        signal: AbortSignal.timeout(3000)
                    });
                } catch (proxyErr) {
                    // Try direct
                    try {
                        response = await fetch(fullUrl, {
                            method: 'GET',
                            headers: {
                                'Accept': 'application/json'
                            },
                            signal: AbortSignal.timeout(3000)
                        });
                    } catch (directErr) {
                        continue;
                    }
                }
                
                if (response && response.ok) {
                    const data = await response.json();
                    // Try to extract encounter count from various formats
                    const count = data.encounters || 
                                data.total_encounters || 
                                data.count ||
                                data.total ||
                                data.encounter_count;
                    if (count !== undefined && count !== null) {
                        return count;
                    }
                }
            } catch (err) {
                console.warn(`[${bot.name}] Failed to fetch from ${endpoint}:`, err);
                continue;
            }
        }
        
        return null;
    } catch (error) {
        console.error(`[${bot.name}] Error fetching species encounter count:`, error);
        return null;
    }
}

// Fetch WildEncounter events from bot API
async function fetchWildEncounterEvents(bot, limit = 10) {
    try {
        const baseUrl = bot.url;
        const endpoints = [
            '/events?type=WildEncounter&limit=' + limit,
            '/events/wild_encounter?limit=' + limit,
            '/wild_encounters?limit=' + limit
        ];
        
        for (const endpoint of endpoints) {
            try {
                const fullUrl = baseUrl.endsWith('/') 
                    ? baseUrl.slice(0, -1) + endpoint 
                    : baseUrl + endpoint;
                
                // Try proxy first
                let response = null;
                try {
                    response = await fetch(`/api/bot-proxy?url=${encodeURIComponent(fullUrl)}`, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json'
                        },
                        signal: AbortSignal.timeout(5000)
                    });
                } catch (proxyErr) {
                    // Try direct
                    try {
                        response = await fetch(fullUrl, {
                            method: 'GET',
                            headers: {
                                'Accept': 'application/json'
                            },
                            signal: AbortSignal.timeout(5000)
                        });
                    } catch (directErr) {
                        continue;
                    }
                }
                
                if (response && response.ok) {
                    const data = await response.json();
                    
                    // Handle different response formats
                    let events = [];
                    if (Array.isArray(data)) {
                        events = data;
                    } else if (data.events && Array.isArray(data.events)) {
                        events = data.events;
                    } else if (data.data && Array.isArray(data.data)) {
                        events = data.data;
                    } else if (data.results && Array.isArray(data.results)) {
                        events = data.results;
                    } else if (data.wild_encounters && Array.isArray(data.wild_encounters)) {
                        events = data.wild_encounters;
                    }
                    
                    // Filter for WildEncounter events if not already filtered
                    const wildEncounters = events.filter(event => {
                        if (typeof event === 'object' && event !== null) {
                            return event.type === 'WildEncounter' || 
                                   event.event_type === 'WildEncounter' ||
                                   event.name === 'WildEncounter' ||
                                   // If no type field, assume it's a wild encounter if it has pokemon/species data
                                   (!event.type && !event.event_type && (event.pokemon || event.species));
                        }
                        return false;
                    });
                    
                    if (wildEncounters.length > 0) {
                        console.log(`[${bot.name}] Fetched ${wildEncounters.length} WildEncounter events from ${endpoint}`);
                        return wildEncounters;
                    }
                }
            } catch (err) {
                console.warn(`[${bot.name}] Failed to fetch from ${endpoint}:`, err);
                continue;
            }
        }
        
        console.warn(`[${bot.name}] No WildEncounter events found from any endpoint`);
        return [];
    } catch (error) {
        console.error(`[${bot.name}] Error fetching WildEncounter events:`, error);
        return [];
    }
}

// Track current encounter - add to tracked list when it changes
function trackCurrentEncounter(botId, currentEncounter) {
    if (!currentEncounter || !botId) {
        console.log(`[trackCurrentEncounter] Skipping - botId: ${botId}, currentEncounter:`, currentEncounter ? 'exists' : 'null');
        return;
    }
    
    console.log(`[trackCurrentEncounter] Processing encounter for bot ${botId}:`, currentEncounter);
    
    // Initialize tracked encounters for this bot if needed
    if (!trackedEncounters[botId]) {
        trackedEncounters[botId] = [];
    }
    
    // Extract encounter identifier to detect changes
    let encounterId = null;
    let encounterData = null;
    
    // Try to extract species ID and other identifying info
    if (currentEncounter.species) {
        const species = currentEncounter.species;
        encounterId = species.id || species.national_dex_number || species.nationalDexNumber;
        encounterData = {
            ...currentEncounter,
            timestamp: Date.now()
        };
    } else if (currentEncounter.pokemon) {
        const pokemon = currentEncounter.pokemon;
        const species = pokemon.species || {};
        encounterId = species.id || species.national_dex_number || species.nationalDexNumber;
        encounterData = {
            ...currentEncounter,
            timestamp: Date.now()
        };
    } else if (currentEncounter.id || currentEncounter.national_dex_number) {
        encounterId = currentEncounter.id || currentEncounter.national_dex_number || currentEncounter.nationalDexNumber;
        encounterData = {
            ...currentEncounter,
            timestamp: Date.now()
        };
    }
    
    // If we can't identify the encounter, skip tracking
    if (!encounterId && !encounterData) return;
    
    // Check if this is a new encounter
    // Track every encounter change, not just species changes
    // Compare the full encounter data to detect any changes (level, stats, etc.)
    const lastEncounter = trackedEncounters[botId][trackedEncounters[botId].length - 1];
    let isNewEncounter = true;
    
    if (lastEncounter) {
        // Get last encounter ID and timestamp
        let lastId = null;
        let lastTimestamp = lastEncounter.timestamp || 0;
        
        if (lastEncounter.species) {
            lastId = lastEncounter.species.id || lastEncounter.species.national_dex_number || lastEncounter.species.nationalDexNumber;
        } else if (lastEncounter.pokemon) {
            lastId = lastEncounter.pokemon.species?.id || lastEncounter.pokemon.species?.national_dex_number || lastEncounter.pokemon.species?.nationalDexNumber;
        } else if (lastEncounter.id || lastEncounter.national_dex_number) {
            lastId = lastEncounter.id || lastEncounter.national_dex_number || lastEncounter.nationalDexNumber;
        }
        
        // Get current encounter level and other distinguishing features
        const currentLevel = currentEncounter.level || currentEncounter.pokemon?.level || 0;
        const lastLevel = lastEncounter.level || lastEncounter.pokemon?.level || 0;
        const currentHP = currentEncounter.hp || currentEncounter.current_hp || currentEncounter.pokemon?.hp || currentEncounter.pokemon?.current_hp || 0;
        const lastHP = lastEncounter.hp || lastEncounter.current_hp || lastEncounter.pokemon?.hp || lastEncounter.pokemon?.current_hp || 0;
        
        // Consider it a new encounter if:
        // 1. Different species ID, OR
        // 2. Same species but different level (different Pokemon), OR
        // 3. Same species and level but HP changed significantly (new encounter), OR
        // 4. More than 1 second has passed since last encounter (new encounter - track all changes)
        const timeSinceLastEncounter = Date.now() - lastTimestamp;
        const isDifferentSpecies = lastId && encounterId && lastId !== encounterId;
        const isDifferentLevel = currentLevel > 0 && lastLevel > 0 && currentLevel !== lastLevel;
        const hpChanged = lastHP > 0 && currentHP > 0 && Math.abs(currentHP - lastHP) > 5; // HP changed by more than 5
        const isTimeBasedNew = timeSinceLastEncounter > 1000; // 1 second - track every encounter change
        
        // Only skip if it's the exact same encounter (same species, level, HP, and very recent)
        if (!isDifferentSpecies && !isDifferentLevel && !hpChanged && !isTimeBasedNew) {
            // Same encounter, don't track again
            isNewEncounter = false;
        }
    }
    
    // Only add if it's a new encounter
    if (isNewEncounter && encounterData) {
        trackedEncounters[botId].push(encounterData);
        
        // Hard limit to 50 encounters max to prevent memory leaks
        // Delete oldest encounters when limit is exceeded
        const MAX_ENCOUNTERS = 50;
        if (trackedEncounters[botId].length > MAX_ENCOUNTERS) {
            // Remove oldest encounters (from the beginning of the array)
            trackedEncounters[botId] = trackedEncounters[botId].slice(-MAX_ENCOUNTERS);
        }
        
        // Save to localStorage
        try {
            localStorage.setItem('botTrackedEncounters', JSON.stringify(trackedEncounters));
        } catch (e) {
            console.warn('Failed to save tracked encounters to localStorage:', e);
        }
        
        console.log(`[Bot ${botId}] New encounter tracked:`, encounterId, 'Level:', encounterData.level || encounterData.pokemon?.level, `(${trackedEncounters[botId].length}/${MAX_ENCOUNTERS})`);
    }
}

async function fetchBotEndpoint(bot, baseUrl, ...args) {
    let endpoints = args;
    let options = {};
    if (args.length > 0 && typeof args[args.length - 1] === 'object' && args[args.length - 1] !== null && !Array.isArray(args[args.length - 1]) && 'timeout' in args[args.length - 1]) {
        options = args[args.length - 1];
        endpoints = args.slice(0, -1);
    }
    const timeoutMs = options.timeout != null ? Number(options.timeout) : 5000;

    for (const endpoint of endpoints) {
        try {
            // Try proxy first
            let response = null;
            try {
                // Ensure URL is properly formatted
                let fullUrl = baseUrl.endsWith('/') 
                    ? baseUrl.slice(0, -1) + endpoint 
                    : baseUrl + endpoint;
                
                // For encounter_log, try to get all encounters (no filters)
                // Try different query parameters to get all encounters
                if (endpoint.includes('encounter') && !endpoint.includes('?')) {
                    // Try multiple variations to get all encounters (not just shinies/filtered)
                    const variations = [
                        fullUrl + '?limit=10&filter=none',  // Explicitly request no filter
                        fullUrl + '?limit=10',              // Just limit, no filter
                        fullUrl + '?limit=100&filter=all',  // All encounters
                        fullUrl + '?all=true',              // All flag
                        fullUrl + '?include_all=true',      // Include all flag
                        fullUrl + '?filter=none',           // No filter
                        fullUrl                             // Try without params as fallback
                    ];
                    
                    for (const urlToTry of variations) {
                        try {
                            response = await fetch(`/api/bot-proxy?url=${encodeURIComponent(urlToTry)}`, {
                                method: 'GET',
                                headers: {
                                    'Accept': 'application/json'
                                },
                                signal: AbortSignal.timeout(timeoutMs)
                            });
                            
                            if (response && response.ok) {
                                try {
                                    const data = await response.json();
                                    console.log(`[${bot.name}] Encounter endpoint '${endpoint}' (${urlToTry}) response:`, data);
                                    console.log(`[${bot.name}] Response keys:`, Object.keys(data || {}));
                                    // Check if we got a good response - for /encounter_rate, accept encounter_rate property
                                    if (data && (Array.isArray(data) || data.encounter_log || data.encounters || data.data || data.encounter_rate !== undefined)) {
                                        return data;
                                    }
                                } catch (jsonErr) {
                                    // Check if the error is a SQLite cursor error
                                    const errorText = await response.text().catch(() => '');
                                    if (errorText.includes('Recursive use of cursors') || 
                                        errorText.includes('ProgrammingError') ||
                                        errorText.includes('SQLite')) {
                                        // Re-throw as a specific error that can be caught by retry logic
                                        throw new Error('SQLite cursor error: ' + errorText.substring(0, 200));
                                    }
                                    // Other JSON parse errors, continue to next variation
                                    console.warn(`[${bot.name}] JSON parse error for ${urlToTry}:`, jsonErr);
                                    continue;
                                }
                            } else if (response && !response.ok) {
                                // Check response text for SQLite errors
                                const errorText = await response.text().catch(() => '');
                                if (errorText.includes('Recursive use of cursors') || 
                                    errorText.includes('ProgrammingError') ||
                                    errorText.includes('SQLite')) {
                                    throw new Error('SQLite cursor error: ' + errorText.substring(0, 200));
                                }
                            }
                        } catch (err) {
                            // Check if it's a SQLite error that should be retried
                            const errorMessage = err.message || String(err) || '';
                            if (errorMessage.includes('Recursive use of cursors') || 
                                errorMessage.includes('ProgrammingError') ||
                                errorMessage.includes('SQLite')) {
                                // Re-throw to be caught by retry logic
                                throw err;
                            }
                            // Other errors, continue to next variation
                            continue;
                        }
                    }
                    // If all variations failed, continue to next endpoint
                    continue;
                } else {
                    response = await fetch(`/api/bot-proxy?url=${encodeURIComponent(fullUrl)}`, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json'
                        },
                        signal: AbortSignal.timeout(timeoutMs)
                    });
                }
            } catch (proxyErr) {
                // Try direct
                try {
                    let urlToFetch = `${baseUrl}${endpoint}`;
                    
                    if (endpoint.includes('encounter') && !endpoint.includes('?')) {
                        urlToFetch = `${baseUrl}${endpoint}?limit=100`;
                    }
                    
                    response = await fetch(urlToFetch, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json'
                        },
                        signal: AbortSignal.timeout(timeoutMs)
                    });
                } catch (directErr) {
                    continue;
                }
            }

            if (response && response.ok) {
                try {
                    const data = await response.json();
                    // Log encounter_log responses for debugging
                    if (endpoints.some(e => e.includes('encounter'))) {
                        console.log(`[${bot.name}] Encounter endpoint '${endpoint}' response:`, data);
                        console.log(`[${bot.name}] Response keys:`, Object.keys(data || {}));
                    }
                    // For /encounter_rate endpoint, make sure we return the data
                    if (endpoint.includes('encounter_rate') && data) {
                        console.log(`[${bot.name}] Returning encounter_rate data:`, data);
                    }
                    // For /party endpoint, ensure we return an array or null
                    if (endpoint.includes('/party')) {
                        if (data === null || data === undefined) {
                            console.warn(`[${bot.name}] Party endpoint returned null/undefined, returning empty array`);
                            return [];
                        }
                        if (!Array.isArray(data)) {
                            console.warn(`[${bot.name}] Party endpoint returned non-array data:`, typeof data, data);
                            return [];
                        }
                    }
                    return data;
                } catch (jsonErr) {
                    // Check if response contains SQLite error
                    const errorText = await response.text().catch(() => '');
                    if (errorText.includes('Recursive use of cursors') || 
                        errorText.includes('ProgrammingError') ||
                        errorText.includes('SQLite')) {
                        // Re-throw as a specific error that can be caught by retry logic
                        throw new Error('SQLite cursor error: ' + errorText.substring(0, 200));
                    }
                    // Other JSON parse errors - for party endpoint, return empty array
                    if (endpoint.includes('/party')) {
                        console.warn(`[${bot.name}] JSON parse error for party endpoint, returning empty array:`, jsonErr);
                        return [];
                    }
                    console.warn(`[${bot.name}] JSON parse error for ${endpoint}:`, jsonErr);
                    continue;
                }
            } else if (response && !response.ok) {
                // For party endpoint, return empty array on error instead of continuing
                if (endpoint.includes('/party')) {
                    const statusText = response.statusText || 'Unknown error';
                    console.warn(`[${bot.name}] Party endpoint returned error ${response.status}: ${statusText}, returning empty array`);
                    return [];
                }
                // Check response text for SQLite errors
                try {
                    const errorText = await response.text().catch(() => '');
                    if (errorText.includes('Recursive use of cursors') || 
                        errorText.includes('ProgrammingError') ||
                        errorText.includes('SQLite')) {
                        throw new Error('SQLite cursor error: ' + errorText.substring(0, 200));
                    }
                } catch (textErr) {
                    // If we can't read the text, continue to next endpoint
                    continue;
                }
            }
        } catch (err) {
            // Check if it's a SQLite error that should be retried
            const errorMessage = err.message || String(err) || '';
            if (errorMessage.includes('Recursive use of cursors') || 
                errorMessage.includes('ProgrammingError') ||
                errorMessage.includes('SQLite')) {
                // Re-throw to be caught by retry logic
                throw err;
            }
            // Other errors, continue to next endpoint
            console.warn(`[${bot.name}] Failed to fetch ${endpoint}:`, err);
            continue;
        }
    }
    return null;
}

// Update dashboard summary
function updateDashboardSummary() {
    const visibleBots = getVisibleBots();
    const totalBots = visibleBots.length;
    let onlineCount = 0;
    let offlineCount = 0;
    let totalEncounters = 0;
    
    // Count online/offline bots (only visible ones)
    visibleBots.forEach(bot => {
        const card = document.getElementById(`bot-status-${bot.id}`);
        if (card) {
            const indicator = card.querySelector('.status-indicator');
            if (indicator) {
                if (indicator.classList.contains('online')) {
                    onlineCount++;
                } else if (indicator.classList.contains('offline')) {
                    offlineCount++;
                }
            }
        }
    });
    
    // Calculate totals from cached bot data and update per-bot max caches (only visible bots)
    const visibleBotIds = new Set(visibleBots.map(b => b.id));
    let totalShinies = 0;
    let totalCatches = 0;
    botDataCache.forEach((botData, botId) => {
        if (!visibleBotIds.has(botId)) return;
        if (!botData || !botData.success || !botData.data) return;
        const stats = botData.data.stats || {};
        const totals = (stats.totals && typeof stats.totals === 'object') ? stats.totals : stats;
            // Encounters
            let encounters = totals.total_encounters ?? totals.totalEncounters ?? stats.total_encounters ?? stats.totalEncounters;
            if (typeof encounters === 'number' && encounters > 0) {
                const currentMax = maxTotalEncountersCache.get(botId) || 0;
                if (encounters > currentMax) maxTotalEncountersCache.set(botId, encounters);
            }
            // Shinies
            let shinies = totals.shiny_encounters ?? totals.shinyEncounters ?? stats.shiny_encounters ?? stats.shinyEncounters;
            if (typeof shinies === 'number' && shinies >= 0) {
                const currentMax = maxTotalShiniesCache.get(botId) ?? -1;
                if (shinies > currentMax) maxTotalShiniesCache.set(botId, shinies);
            }
            // Catches
            let catches = totals.catches ?? totals.total_caught ?? stats.catches ?? stats.total_caught;
            if (typeof catches === 'number' && catches >= 0) {
                const currentMax = maxTotalCatchesCache.get(botId) ?? -1;
                if (catches > currentMax) maxTotalCatchesCache.set(botId, catches);
            }
    });
    saveBotMaxTotalsCaches();
    
    // Total statistics include all bots (visible + hidden) using last known max totals so hiding doesn't drop numbers
    totalEncounters = 0;
    totalShinies = 0;
    totalCatches = 0;
    maxTotalEncountersCache.forEach((maxEncounters, botId) => {
        totalEncounters += maxEncounters;
    });
    maxTotalShiniesCache.forEach((maxVal, botId) => {
        totalShinies += Math.max(0, maxVal);
    });
    maxTotalCatchesCache.forEach((maxVal, botId) => {
        totalCatches += Math.max(0, maxVal);
    });
    
    const summaryTotalBots = document.getElementById('summaryTotalBots');
    const summaryOnline = document.getElementById('summaryOnline');
    const summaryOffline = document.getElementById('summaryOffline');
    const summaryTotalEncounters = document.getElementById('summaryTotalEncounters');
    const summaryTotalShinies = document.getElementById('summaryTotalShinies');
    const summaryTotalCatches = document.getElementById('summaryTotalCatches');
    
    if (summaryTotalBots) summaryTotalBots.textContent = totalBots;
    if (summaryOnline) summaryOnline.textContent = onlineCount;
    if (summaryOffline) summaryOffline.textContent = offlineCount;
    if (summaryTotalEncounters) summaryTotalEncounters.textContent = totalEncounters.toLocaleString();
    if (summaryTotalShinies) summaryTotalShinies.textContent = totalShinies.toLocaleString();
    if (summaryTotalCatches) summaryTotalCatches.textContent = totalCatches.toLocaleString();
    
    // Update graphs only every 5 seconds
    const now = Date.now();
    if (now - lastGraphUpdate >= GRAPH_UPDATE_INTERVAL) {
        lastGraphUpdate = now;
        
        // Update combined encounter rate
        updateCombinedEncounterRate();
        
        // Render mini graphs for bots if enabled
        if (dashboardSettings.showEncounterRateAsGraph) {
            botInstances.forEach(bot => {
                renderBotEncounterRateGraph(bot.id);
            });
        }
    }
}

// Load bot order and visibility configuration
function loadBotOrderConfig() {
    const saved = localStorage.getItem('botOrderConfig');
    if (saved) {
        try {
            botOrderConfig = JSON.parse(saved);
        } catch (e) {
            console.error('[loadBotOrderConfig] Failed to parse config:', e);
            botOrderConfig = {};
        }
    } else {
        botOrderConfig = {};
    }
}

// Save bot order and visibility configuration
function saveBotOrderConfig() {
    localStorage.setItem('botOrderConfig', JSON.stringify(botOrderConfig));
}

// Get sorted and filtered bot instances (respecting order and visibility)
function getVisibleBots() {
    // Initialize order for bots that don't have one
    botInstances.forEach((bot, index) => {
        if (!botOrderConfig[bot.id]) {
            botOrderConfig[bot.id] = { order: index, hidden: false };
        }
    });
    
    // Filter out hidden bots and sort by order
    return botInstances
        .filter(bot => {
            const config = botOrderConfig[bot.id];
            return !config || !config.hidden;
        })
        .sort((a, b) => {
            const orderA = botOrderConfig[a.id]?.order ?? 0;
            const orderB = botOrderConfig[b.id]?.order ?? 0;
            return orderA - orderB;
        });
}

// Update max-totals caches from a stats object (used by main poll and by stats-only poll)
function updateMaxTotalsFromStats(botId, stats) {
    if (!stats || typeof stats !== 'object') return;
    const totals = stats.totals || {};
    let encounters = 0;
    if (totals.total_encounters !== undefined && totals.total_encounters !== null) {
        encounters = totals.total_encounters;
    } else if (stats.total_encounters !== undefined && stats.total_encounters !== null) {
        encounters = stats.total_encounters;
    } else if (stats.totalEncounters !== undefined && stats.totalEncounters !== null) {
        encounters = stats.totalEncounters;
    }
    if (typeof encounters === 'number' && encounters > 0) {
        const currentMax = maxTotalEncountersCache.get(botId) || 0;
        if (encounters > currentMax) maxTotalEncountersCache.set(botId, encounters);
    }
    const shinies = totals.shiny_encounters ?? totals.shinyEncounters;
    if (typeof shinies === 'number' && shinies >= 0) {
        const currentMax = maxTotalShiniesCache.get(botId) ?? -1;
        if (shinies > currentMax) maxTotalShiniesCache.set(botId, shinies);
    }
    const catches = totals.catches ?? totals.total_caught;
    if (typeof catches === 'number' && catches >= 0) {
        const currentMax = maxTotalCatchesCache.get(botId) ?? -1;
        if (catches > currentMax) maxTotalCatchesCache.set(botId, catches);
    }
}

// Update bot status display
// showLoading: only show loading state on initial load, not on SSE updates
function updateBotStatus(showLoading = false) {
    console.log('[updateBotStatus] Called with', botInstances.length, 'bots, showLoading:', showLoading);
    
    if (botInstances.length === 0) {
        if (botStatusContainer) {
            botStatusContainer.innerHTML = '';
        }
        updateDashboardSummary();
        return;
    }

    // Prevent overlapping runs: if a previous update is still in progress, skip this cycle
    if (updateBotStatusInProgress && !showLoading) {
        console.log('[updateBotStatus] Skipping - previous update still in progress');
        return;
    }

    // Get visible bots in correct order
    const visibleBots = getVisibleBots();
    console.log('[updateBotStatus] Processing', visibleBots.length, 'visible bots out of', botInstances.length, 'total');

    // Remove status cards for bots that are no longer in the visible list (hidden bots).
    // Only remove the DOM node; never clear botDataCache, botStatsCache, or max total caches for that bot.
    const visibleIds = new Set(visibleBots.map(b => b.id));
    if (botStatusContainer) {
        botStatusContainer.querySelectorAll('[id^="bot-status-"]').forEach(el => {
            const id = el.id.replace('bot-status-', '');
            if (!visibleIds.has(id)) el.remove();
        });
    }

    // Process bots sequentially to avoid overwhelming the API
    (async () => {
        updateBotStatusInProgress = true;
        const cycleStartTime = Date.now();
        try {
        for (const bot of visibleBots) {
            // Don't start another bot if we've already used too much time this cycle
            if (Date.now() - cycleStartTime > UPDATE_BOT_STATUS_CYCLE_TIMEOUT_MS) {
                console.warn('[updateBotStatus] Cycle timeout - stopping to allow next poll');
                break;
            }
            try {
                // Check if card already exists
                let statusCard = document.getElementById(`bot-status-${bot.id}`);
                
                if (!statusCard) {
                    // Create new card if it doesn't exist
                    statusCard = createStatusCard(bot);
                    if (botStatusContainer) {
                        botStatusContainer.appendChild(statusCard);
                    }
                } else if (showLoading) {
                    // Only show loading state if explicitly requested (initial load)
                    const indicator = statusCard.querySelector('.status-indicator');
                    if (indicator) {
                        indicator.textContent = 'Updating...';
                        indicator.className = 'status-indicator loading';
                    }
                }

                // Fetch and update data (with per-bot timeout so one slow bot doesn't block the rest)
                if (visibleBots.length <= 6) console.log(`[updateBotStatus] Fetching data for ${bot.name}...`);
                let result;
                try {
                    result = await Promise.race([
                        fetchBotData(bot),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), UPDATE_BOT_STATUS_PER_BOT_TIMEOUT_MS))
                    ]);
                } catch (timeoutOrErr) {
                    const msg = timeoutOrErr && timeoutOrErr.message === 'Timeout' ? 'Request timed out' : (timeoutOrErr?.message || String(timeoutOrErr));
                    console.warn(`[updateBotStatus] ${bot.name} failed or timed out:`, msg);
                    result = { success: false, error: msg };
                }
                if (visibleBots.length <= 6) {
                    console.log(`[updateBotStatus] Got result for ${bot.name}:`, result.success ? 'success' : 'failed', result.error || '');
                }
                if (result.success && result.data) {
                    if (visibleBots.length <= 6) {
                        console.log(`[updateBotStatus] Result data for ${bot.name} - encounter_rate:`, result.data.encounter_rate, 'data keys:', Object.keys(result.data));
                    }
                    // Cache bot data for summary calculations
                    botDataCache.set(bot.id, result);
                    
                    // Update connection tracking - mark as successful
                    botConnectionTracking.set(bot.id, {
                        lastSuccess: Date.now(),
                        firstFailure: null
                    });
                    
                    // Update maximum encounters cache
                    if (result && result.success && result.data) {
                        updateMaxTotalsFromStats(bot.id, result.data.stats || {});
                    }
                    
                    // Update live encounter rate history (in-memory only)
                    const encounterRate = result.data.encounter_rate;
                    if (encounterRate !== undefined && encounterRate !== null && typeof encounterRate === 'number' && encounterRate >= 0) {
                        if (!liveEncounterRateHistory.has(bot.id)) {
                            liveEncounterRateHistory.set(bot.id, []);
                        }
                        const history = liveEncounterRateHistory.get(bot.id);
                        const now = Date.now();
                        // Only add if rate changed or enough time has passed (1 second)
                        const lastEntry = history.length > 0 ? history[history.length - 1] : null;
                        if (!lastEntry || lastEntry.rate !== encounterRate || (now - lastEntry.time) >= 1000) {
                            history.push({ time: now, rate: encounterRate });
                            // Keep only last N points
                            if (history.length > MAX_LIVE_HISTORY_POINTS) {
                                history.shift();
                            }
                        }
                    }
                } else {
                    // Track failure but don't immediately remove data
                    const now = Date.now();
                    const tracking = botConnectionTracking.get(bot.id);
                    
                    if (!tracking || tracking.firstFailure === null) {
                        // First failure - record the time
                        botConnectionTracking.set(bot.id, {
                            lastSuccess: tracking?.lastSuccess || now,
                            firstFailure: now
                        });
                    }
                    
                    // Check if bot has been offline for 10+ seconds – keep last known data, only stop treating as temporarily offline
                    const failureTime = botConnectionTracking.get(bot.id)?.firstFailure;
                    if (failureTime && (now - failureTime) >= BOT_OFFLINE_TIMEOUT) {
                        // Keep botDataCache and liveEncounterRateHistory so we always remember last values for totals and Bot Statistics
                        // Only use cached data for this card update
                    }
                    // Use the last successful data from cache if available (whether temporarily or long-term offline)
                    const cachedData = botDataCache.get(bot.id);
                    if (cachedData) {
                        result = cachedData; // Use cached data instead of failed result
                    }
                }
                if (statusCard) {
                    updateStatusCard(statusCard, bot, result);
                }
                // Yield to main thread so UI stays responsive with many bots
                await new Promise(r => setTimeout(r, 0));
            } catch (err) {
                console.error(`[updateBotStatus] Error updating bot ${bot.name}:`, err);
            }
        }
        } finally {
            updateBotStatusInProgress = false;
        }
        
        // Update summary after all bots are processed
        setTimeout(() => {
            updateDashboardSummary();
        }, 1000);
    })();
}

function createStatusCard(bot) {
    const card = document.createElement('div');
    card.className = 'bot-status-card';
    card.id = `bot-status-${bot.id}`;
    const config = botOrderConfig[bot.id] || { order: 0, hidden: false };
    card.innerHTML = `
        <div class="status-card-header">
            <div class="status-card-header-left">
                <h3>${bot.name}</h3>
                <span class="status-indicator loading">Loading...</span>
            </div>
            <div class="status-card-header-controls">
                <button class="btn-icon bot-move-up" data-bot-id="${bot.id}" title="Move Up">↑</button>
                <button class="btn-icon bot-move-down" data-bot-id="${bot.id}" title="Move Down">↓</button>
                <button class="btn-icon bot-toggle-visibility" data-bot-id="${bot.id}" title="${config.hidden ? 'Show Bot' : 'Hide Bot'}">
                    ${config.hidden ? '👁️‍🗨️' : '👁️'}
                </button>
            </div>
        </div>
        <div class="bot-controls-section">
            <div class="bot-control-item">
                <label>Bot Mode:</label>
                <span class="bot-mode-display" id="bot-mode-${bot.id}">-</span>
            </div>
            <div class="bot-control-item">
                <label for="emulation-speed-${bot.id}">Emulation Speed:</label>
                <select id="emulation-speed-${bot.id}" class="emulation-speed-select">
                    <option value="0.25">0.25x</option>
                    <option value="0.5">0.5x</option>
                    <option value="1" selected>1x</option>
                    <option value="2">2x</option>
                    <option value="4">4x</option>
                    <option value="8">8x</option>
                    <option value="16">16x</option>
                    <option value="32">32x</option>
                    <option value="unlimited">Unlimited</option>
                </select>
            </div>
            <div class="bot-control-item">
                <label>
                    <input type="checkbox" id="video-enabled-${bot.id}" class="video-checkbox">
                    Video Enabled
                </label>
            </div>
            <div class="bot-control-item">
                <label>
                    <input type="checkbox" id="audio-enabled-${bot.id}" class="audio-checkbox">
                    Audio Enabled
                </label>
            </div>
            <div class="bot-control-item">
                <label>
                    <input type="checkbox" id="video-stream-enabled-${bot.id}" class="video-stream-checkbox">
                    Stream Video
                </label>
            </div>
        </div>
        <div class="bot-video-section" id="bot-video-${bot.id}" style="display: none;">
            <img id="bot-video-player-${bot.id}" class="bot-video-player" alt="Bot video stream" />
        </div>
        <div class="status-card-content">
            <div class="loading-spinner"></div>
        </div>
    `;
    
    // Setup event listeners for controls
    setupBotControls(card, bot);
    
    // Setup reorder and visibility controls
    setupBotCardControls(card, bot);
    initializeBotCardFoldableSections(card, bot.id);
    
    // Hide card if bot is hidden
    if (config.hidden) {
        card.style.display = 'none';
    }
    
    applyDashboardSectionVisibility();
    return card;
}

// Setup reorder and visibility controls for bot card
function setupBotCardControls(card, bot) {
    const moveUpBtn = card.querySelector('.bot-move-up');
    const moveDownBtn = card.querySelector('.bot-move-down');
    const toggleVisibilityBtn = card.querySelector('.bot-toggle-visibility');
    
    if (moveUpBtn) {
        moveUpBtn.addEventListener('click', () => moveBotUp(bot.id));
    }
    
    if (moveDownBtn) {
        moveDownBtn.addEventListener('click', () => moveBotDown(bot.id));
    }
    
    if (toggleVisibilityBtn) {
        toggleVisibilityBtn.addEventListener('click', () => toggleBotVisibility(bot.id));
    }
}

// Move bot up in order
function moveBotUp(botId) {
    const config = botOrderConfig[botId];
    if (!config) return;
    
    const currentOrder = config.order;
    if (currentOrder <= 0) return; // Already at top
    
    // Find bot with order one less
    const otherBotId = Object.keys(botOrderConfig).find(id => 
        botOrderConfig[id].order === currentOrder - 1
    );
    
    if (otherBotId) {
        // Swap orders
        botOrderConfig[otherBotId].order = currentOrder;
        config.order = currentOrder - 1;
    } else {
        config.order = currentOrder - 1;
    }
    
    saveBotOrderConfig();
    reorderBotCards();
}

// Move bot down in order
function moveBotDown(botId) {
    const config = botOrderConfig[botId];
    if (!config) return;
    
    const currentOrder = config.order;
    const maxOrder = Math.max(...Object.values(botOrderConfig).map(c => c.order), 0);
    if (currentOrder >= maxOrder) return; // Already at bottom
    
    // Find bot with order one more
    const otherBotId = Object.keys(botOrderConfig).find(id => 
        botOrderConfig[id].order === currentOrder + 1
    );
    
    if (otherBotId) {
        // Swap orders
        botOrderConfig[otherBotId].order = currentOrder;
        config.order = currentOrder + 1;
    } else {
        config.order = currentOrder + 1;
    }
    
    saveBotOrderConfig();
    reorderBotCards();
}

// Toggle bot visibility
function toggleBotVisibility(botId) {
    if (!botOrderConfig[botId]) {
        botOrderConfig[botId] = { order: 0, hidden: false };
    }
    
    botOrderConfig[botId].hidden = !botOrderConfig[botId].hidden;
    saveBotOrderConfig();
    
    // Update button icon
    const card = document.getElementById(`bot-status-${botId}`);
    if (card) {
        const toggleBtn = card.querySelector('.bot-toggle-visibility');
        if (toggleBtn) {
            const isHidden = botOrderConfig[botId].hidden;
            toggleBtn.textContent = isHidden ? '👁️‍🗨️' : '👁️';
            toggleBtn.title = isHidden ? 'Show Bot' : 'Hide Bot';
        }
        
        // Hide or show the card
        if (isHidden) {
            card.style.display = 'none';
        } else {
            card.style.display = '';
        }
    }
    
    // Hiding must never clear cached values: botDataCache, botStatsCache, and max total caches
    // are left unchanged so totals and Bot Statistics still show last known data for hidden bots.
    // When hiding: keep last data in cache so total statistics still include it; we just stop polling (visible bots only)
    // Do not delete botDataCache or liveEncounterRateHistory for hidden bots.
    
    // Reorder to update display
    reorderBotCards();
    
    // Update summary
    updateDashboardSummary();
}

// Reorder bot cards in DOM based on configuration
function reorderBotCards() {
    if (!botStatusContainer) return;
    
    const visibleBots = getVisibleBots();
    const cards = Array.from(botStatusContainer.children).filter(card => 
        card.classList.contains('bot-status-card')
    );
    
    // Sort cards by bot order
    cards.sort((a, b) => {
        const botIdA = a.id.replace('bot-status-', '');
        const botIdB = b.id.replace('bot-status-', '');
        const orderA = botOrderConfig[botIdA]?.order ?? 999;
        const orderB = botOrderConfig[botIdB]?.order ?? 999;
        return orderA - orderB;
    });
    
    // Re-append in correct order
    cards.forEach(card => {
        botStatusContainer.appendChild(card);
    });
    
    // Hide cards for hidden bots
    botInstances.forEach(bot => {
        const config = botOrderConfig[bot.id];
        if (config && config.hidden) {
            const card = document.getElementById(`bot-status-${bot.id}`);
            if (card) {
                card.style.display = 'none';
            }
        }
    });
}

// Setup event listeners for bot controls
function setupBotControls(card, bot) {
    const speedSelect = card.querySelector(`#emulation-speed-${bot.id}`);
    const videoCheckbox = card.querySelector(`#video-enabled-${bot.id}`);
    const audioCheckbox = card.querySelector(`#audio-enabled-${bot.id}`);
    const videoStreamCheckbox = card.querySelector(`#video-stream-enabled-${bot.id}`);
    const videoSection = card.querySelector(`#bot-video-${bot.id}`);
    const videoPlayer = card.querySelector(`#bot-video-player-${bot.id}`);
    
    // Emulation speed change
    if (speedSelect) {
        speedSelect.addEventListener('change', async (e) => {
            const speed = e.target.value;
            await setEmulationSpeed(bot, speed);
        });
    }
    
    // Video toggle
    if (videoCheckbox) {
        videoCheckbox.addEventListener('change', async (e) => {
            const enabled = e.target.checked;
            await setVideoEnabled(bot, enabled);
        });
    }
    
    // Audio toggle
    if (audioCheckbox) {
        audioCheckbox.addEventListener('change', async (e) => {
            const enabled = e.target.checked;
            await setAudioEnabled(bot, enabled);
        });
    }
    
    // Video stream toggle
    if (videoStreamCheckbox) {
        videoStreamCheckbox.addEventListener('change', async (e) => {
            const enabled = e.target.checked;
            
            // Show/hide video section
            if (videoSection) {
                videoSection.style.display = enabled ? 'block' : 'none';
            }
            
            // Start/stop video stream
            if (enabled && videoPlayer) {
                startVideoStream(bot, videoPlayer);
            } else if (videoPlayer) {
                stopVideoStream(videoPlayer);
            }
        });
    }
}

// Set emulation speed
async function setEmulationSpeed(bot, speed) {
    try {
        const speedValue = speed === 'unlimited' ? 0 : parseInt(speed);
        const requestBody = { emulation_speed: speedValue };
        
        console.log(`[${bot.name}] Setting emulation speed to ${speedValue === 0 ? 'unlimited' : speedValue + 'x'}`);
        console.log(`[${bot.name}] Request body:`, JSON.stringify(requestBody));
        
        // Ensure bot.url doesn't have trailing slash
        const baseUrl = bot.url.replace(/\/$/, '');
        const targetUrl = `${baseUrl}/emulator`;
        const proxyUrl = `/api/bot-proxy?url=${encodeURIComponent(targetUrl)}`;
        
        console.log(`[${bot.name}] Target URL: ${targetUrl}`);
        
        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log(`[${bot.name}] Response status:`, response.status, response.statusText);
        
        // Always try to read response first to avoid "body already read" errors
        const responseText = await response.text().catch(() => '');
        
        // Check if response is successful (200-299) or 204 (No Content)
        const isSuccess = (response.status >= 200 && response.status < 300) || response.status === 204;
        
        if (isSuccess) {
            // Try to parse JSON, but don't fail if response is empty or non-JSON
            let responseData = { success: true };
            if (responseText) {
                try {
                    responseData = JSON.parse(responseText);
                } catch (e) {
                    // Non-JSON response is OK for POST requests - command was accepted
                    console.log(`[${bot.name}] Response is not JSON (this is OK):`, responseText.substring(0, 100));
                }
            }
            console.log(`[${bot.name}] Emulation speed set successfully (status ${response.status})`);
            // Refresh bot status to update UI
            setTimeout(() => {
                const card = document.getElementById(`bot-status-${bot.id}`);
                if (card) {
                    fetchBotData(bot).then(result => {
                        updateStatusCard(card, bot, result);
                    });
                }
            }, 500);
        } else {
            // Only show error for actual failures
            let errorData;
            try {
                errorData = JSON.parse(responseText);
            } catch {
                errorData = { error: responseText || response.statusText };
            }
            console.error(`[${bot.name}] Failed to set emulation speed:`, errorData);
            alert(`Failed to set emulation speed: ${errorData.error || response.statusText}\n\nCheck console for details.`);
        }
    } catch (error) {
        console.error(`[${bot.name}] Error setting emulation speed:`, error);
        alert(`Error setting emulation speed: ${error.message}`);
    }
}

// Set video enabled
async function setVideoEnabled(bot, enabled) {
    try {
        const requestBody = { video_enabled: enabled };
        
        // Ensure bot.url doesn't have trailing slash
        const baseUrl = bot.url.replace(/\/$/, '');
        const targetUrl = `${baseUrl}/emulator`;
        const proxyUrl = `/api/bot-proxy?url=${encodeURIComponent(targetUrl)}`;
        
        console.log(`[${bot.name}] Setting video ${enabled ? 'enabled' : 'disabled'}`);
        console.log(`[${bot.name}] Bot URL: ${bot.url}`);
        console.log(`[${bot.name}] Target URL: ${targetUrl}`);
        console.log(`[${bot.name}] Proxy URL: ${proxyUrl}`);
        console.log(`[${bot.name}] Request body:`, JSON.stringify(requestBody));
        
        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log(`[${bot.name}] Response status:`, response.status, response.statusText);
        console.log(`[${bot.name}] Response headers:`, Object.fromEntries(response.headers.entries()));
        
        // Always try to read response first to avoid "body already read" errors
        const responseText = await response.text().catch(() => '');
        
        // Check if response is successful (200-299) or 204 (No Content)
        const isSuccess = (response.status >= 200 && response.status < 300) || response.status === 204;
        
        if (isSuccess) {
            // Try to parse JSON, but don't fail if response is empty or non-JSON
            let responseData = { success: true };
            if (responseText) {
                try {
                    responseData = JSON.parse(responseText);
                } catch (e) {
                    // Non-JSON response is OK for POST requests - command was accepted
                    console.log(`[${bot.name}] Response is not JSON (this is OK):`, responseText.substring(0, 100));
                }
            }
            console.log(`[${bot.name}] Video ${enabled ? 'enabled' : 'disabled'} successfully (status ${response.status})`);
            // Refresh bot status to update UI
            setTimeout(() => {
                const card = document.getElementById(`bot-status-${bot.id}`);
                if (card) {
                    fetchBotData(bot).then(result => {
                        updateStatusCard(card, bot, result);
                    });
                }
            }, 500);
        } else {
            // Some bot builds apply the command but still return 500.
            // Verify the actual state before showing an error.
            let errorData;
            try {
                errorData = JSON.parse(responseText);
            } catch {
                errorData = { error: responseText || response.statusText };
            }
            
            try {
                await new Promise(resolve => setTimeout(resolve, 500));
                const verifiedResult = await fetchBotData(bot);
                const verifiedData = verifiedResult?.data || {};
                const verifiedStatus = verifiedData.status || {};
                const verifiedEmulator = verifiedData.emulator || verifiedStatus.emulator || {};
                const actualEnabled =
                    verifiedStatus.video_enabled ??
                    verifiedStatus.videoEnabled ??
                    verifiedEmulator.video_enabled ??
                    verifiedEmulator.videoEnabled;
                
                if (actualEnabled === enabled) {
                    console.warn(
                        `[${bot.name}] Video toggle returned ${response.status}, but the bot state updated successfully.`
                    );
                    const card = document.getElementById(`bot-status-${bot.id}`);
                    if (card) {
                        updateStatusCard(card, bot, verifiedResult);
                    }
                    return;
                }
            } catch (verifyError) {
                console.warn(`[${bot.name}] Failed to verify video state after error response:`, verifyError);
            }
            
            console.error(`[${bot.name}] Failed to set video:`, errorData);
            alert(`Failed to set video: ${errorData.error || response.statusText}\n\nCheck console for details.`);
        }
    } catch (error) {
        console.error(`[${bot.name}] Error setting video:`, error);
        alert(`Error setting video: ${error.message}`);
    }
}

// Set audio enabled
async function setAudioEnabled(bot, enabled) {
    try {
        const requestBody = { audio_enabled: enabled };
        
        // Ensure bot.url doesn't have trailing slash
        const baseUrl = bot.url.replace(/\/$/, '');
        const targetUrl = `${baseUrl}/emulator`;
        const proxyUrl = `/api/bot-proxy?url=${encodeURIComponent(targetUrl)}`;
        
        console.log(`[${bot.name}] Setting audio ${enabled ? 'enabled' : 'disabled'}`);
        console.log(`[${bot.name}] Target URL: ${targetUrl}`);
        console.log(`[${bot.name}] Request body:`, JSON.stringify(requestBody));
        
        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log(`[${bot.name}] Response status:`, response.status, response.statusText);
        
        // Always try to read response first to avoid "body already read" errors
        const responseText = await response.text().catch(() => '');
        
        // Check if response is successful (200-299) or 204 (No Content)
        const isSuccess = (response.status >= 200 && response.status < 300) || response.status === 204;
        
        if (isSuccess) {
            // Try to parse JSON, but don't fail if response is empty or non-JSON
            let responseData = { success: true };
            if (responseText) {
                try {
                    responseData = JSON.parse(responseText);
                } catch (e) {
                    // Non-JSON response is OK for POST requests - command was accepted
                    console.log(`[${bot.name}] Response is not JSON (this is OK):`, responseText.substring(0, 100));
                }
            }
            console.log(`[${bot.name}] Audio ${enabled ? 'enabled' : 'disabled'} successfully (status ${response.status})`);
            // Refresh bot status to update UI
            setTimeout(() => {
                const card = document.getElementById(`bot-status-${bot.id}`);
                if (card) {
                    fetchBotData(bot).then(result => {
                        updateStatusCard(card, bot, result);
                    });
                }
            }, 500);
        } else {
            // Only show error for actual failures
            let errorData;
            try {
                errorData = JSON.parse(responseText);
            } catch {
                errorData = { error: responseText || response.statusText };
            }
            console.error(`[${bot.name}] Failed to set audio:`, errorData);
            alert(`Failed to set audio: ${errorData.error || response.statusText}\n\nCheck console for details.`);
        }
    } catch (error) {
        console.error(`[${bot.name}] Error setting audio:`, error);
        alert(`Error setting audio: ${error.message}`);
    }
}

// Start video stream
function startVideoStream(bot, imgElement) {
    // MJPEG streams work with <img> tags, not <video> tags
    // The browser automatically updates the image as new frames arrive in the multipart stream
    
    // Clear previous stream
    stopVideoStream(imgElement);
    
    // Set up the video stream URL (same as bot's built-in interface)
    const fps = 30;
    const cacheBuster = new Date().toString();
    const videoUrl = `${bot.url}/stream_video?fps=${fps}&cache_buster=${encodeURIComponent(cacheBuster)}`;
    const proxyUrl = `/api/bot-video-proxy?url=${encodeURIComponent(videoUrl)}`;
    
    console.log(`[${bot.name}] Starting video stream (MJPEG via img element)`);
    console.log(`[${bot.name}] Stream URL: ${proxyUrl}`);
    
    // Clear any previous error handlers
    imgElement.onerror = null;
    imgElement.onload = null;
    
    // Set up error handler
    imgElement.onerror = (e) => {
        console.error(`[${bot.name}] Video stream error:`, e);
        // Try direct connection as fallback
        console.warn(`[${bot.name}] Trying direct connection...`);
        imgElement.src = videoUrl;
    };
    
    // Set up success handler
    imgElement.onload = () => {
        console.log(`[${bot.name}] Video stream frame loaded`);
    };
    
    // Set the image source - browser will handle the MJPEG stream automatically
    // The multipart/x-mixed-replace content type tells the browser to continuously update the image
    imgElement.src = proxyUrl;
    
    // Store cleanup function on element
    imgElement._stopStream = () => {
        // Cleanup is handled by stopVideoStream
    };
}

// Stop video stream
function stopVideoStream(imgElement) {
    if (imgElement) {
        // Call cleanup function if it exists
        if (imgElement._stopStream) {
            imgElement._stopStream();
        }
        // Clear the image source to stop the stream
        imgElement.src = '';
        // Clear error handlers
        imgElement.onerror = null;
        imgElement.onload = null;
        imgElement._stopStream = null;
    }
}

function updateStatusCard(card, bot, result) {
    const content = card.querySelector('.status-card-content');
    const indicator = card.querySelector('.status-indicator');

    let usingCachedData = false;
    if (!result.success) {
        // Check if we should use cached data (bot hasn't been offline for 10+ seconds)
        const tracking = botConnectionTracking.get(bot.id);
        const now = Date.now();
        const failureTime = tracking?.firstFailure;
        
        if (failureTime && (now - failureTime) < BOT_OFFLINE_TIMEOUT) {
            // Bot is temporarily offline but within timeout - use cached data
            const cachedData = botDataCache.get(bot.id);
            if (cachedData && cachedData.success) {
                // Use cached data instead of failed result
                result = cachedData;
                usingCachedData = true;
            } else {
                // No cached data available - show offline
                if (indicator) {
                    indicator.textContent = 'Offline';
                    indicator.className = 'status-indicator offline';
                }
                content.innerHTML = `
                    <div class="error-message">
                        <p><strong>Error:</strong> ${result.error || 'Could not connect to bot'}</p>
                        <p class="bot-url-display">${bot.url}</p>
                    </div>
                `;
                return;
            }
        } else {
            // Bot has been offline for 10+ seconds – still show last known data if we have it
            const cachedData = botDataCache.get(bot.id);
            if (cachedData && cachedData.success && cachedData.data) {
                result = cachedData;
                usingCachedData = true;
                // Fall through to render full card with cached data and "Offline" indicator
            } else {
                // No cached data – show offline error only
                if (indicator) {
                    indicator.textContent = 'Offline';
                    indicator.className = 'status-indicator offline';
                }
                content.innerHTML = `
                    <div class="error-message">
                        <p><strong>Error:</strong> ${result.error || 'Could not connect to bot'}</p>
                        <p class="bot-url-display">${bot.url}</p>
                    </div>
                `;
                return;
            }
        }
    }

    // When we're showing cached data for an offline bot, show "Offline" in the indicator
    if (usingCachedData && result && !result.success) {
        if (indicator) {
            indicator.textContent = 'Offline';
            indicator.className = 'status-indicator offline';
        }
    } else if (!usingCachedData) {
        if (indicator) {
            indicator.textContent = 'Online';
            indicator.className = 'status-indicator online';
        }
    } else {
        // usingCachedData && result.success (temporarily offline)
        if (indicator) {
            indicator.textContent = 'Updating...';
            indicator.className = 'status-indicator loading';
        }
    }

    const data = result.data || {};
    const status = data.status || {};
    const emulator = data.emulator || status.emulator || {};
    let player = data.player || status.player || {};
    const gameState = data.gameState || status.gameState || {};
    const party = data.party || [];
    const encounters = data.encounters || [];
    let stats = data.stats || {};

    // Unwrap common API response shapes: { data: { totals: {} } } or { data: { name, trainer_id } }
    if (stats && typeof stats === 'object' && stats.data !== undefined) {
        stats = stats.data;
    }
    if (player && typeof player === 'object' && player.data !== undefined) {
        player = player.data;
    }

    // When data comes from stream or has empty stats/player, merge in cached data so we don't lose stats/trainer info
    const cached = botDataCache.get(bot.id);
    if (cached && cached.success && cached.data) {
        const cachedStats = cached.data.stats;
        if (cachedStats && typeof cachedStats === 'object' && Object.keys(cachedStats).length > 0) {
            const unwrapped = (cachedStats.data !== undefined) ? cachedStats.data : cachedStats;
            if (!stats || typeof stats !== 'object' || Object.keys(stats).length === 0) {
                stats = unwrapped;
            }
        }
        const cachedPlayer = cached.data.player;
        if (cachedPlayer && typeof cachedPlayer === 'object' && Object.keys(cachedPlayer).length > 0) {
            const unwrapped = (cachedPlayer.data !== undefined) ? cachedPlayer.data : cachedPlayer;
            if (!player || typeof player !== 'object' || Object.keys(player).length === 0) {
                player = unwrapped;
            }
        }
    }
    // Build a single player source from status spread (trainer fields may be at top level of status)
    const playerFromStatus = (status && (status.name !== undefined || status.trainer_id !== undefined || status.trainer_name !== undefined)) ? status : {};
    if (Object.keys(playerFromStatus).length > 0) {
        player = Object.assign({}, player, playerFromStatus);
    }

    const map = data.map || {};
    const currentEncounter = data.currentEncounter || {};
    
    // Use cached encounter_rate when current is missing/0 so we don't show "0/hr"
    let encounterRateForDisplay = data.encounter_rate;
    if ((encounterRateForDisplay == null || encounterRateForDisplay === 0) && cached && cached.success && cached.data && (cached.data.encounter_rate != null && cached.data.encounter_rate !== 0)) {
        encounterRateForDisplay = cached.data.encounter_rate;
    }
    if ((encounterRateForDisplay == null || encounterRateForDisplay === 0) && liveEncounterRateHistory.has(bot.id)) {
        const hist = liveEncounterRateHistory.get(bot.id);
        if (hist && hist.length > 0) encounterRateForDisplay = hist[hist.length - 1].rate;
    }
    
    // Debug: log data structures
    if (emulator && Object.keys(emulator).length > 0) {
        console.log(`[${bot.name}] Emulator data:`, JSON.stringify(emulator, null, 2));
    }
    if (player && Object.keys(player).length > 0) {
        console.log(`[${bot.name}] Player data:`, JSON.stringify(player, null, 2));
    }
    if (status && Object.keys(status).length > 0) {
        console.log(`[${bot.name}] Status data:`, JSON.stringify(status, null, 2));
    }

    // Merge emulator data into status for controls
    const statusWithEmulator = {
        ...status,
        ...emulator,
        // Also include emulator as nested object for easier access
        emulator: emulator
    };

    // Update bot controls with current values
    updateBotControls(card, bot, statusWithEmulator);

    // Build status card content
    let html = '';

    // Use cached stats when current response has none so Total Stats etc. don't go empty
    let statsForCard = stats;
    if ((!statsForCard || Object.keys(statsForCard).length === 0) && cached && cached.success && cached.data && cached.data.stats) {
        const s = cached.data.stats;
        statsForCard = (s && s.data !== undefined) ? s.data : s;
    }
    if (!statsForCard) statsForCard = {};

    // Encounter Rate - display at the top
    // Normalize stats: support stats.totals.X, stats.data.totals.X, or flat stats.X
    const rawStats = statsForCard;
    const statsTotalsObj = rawStats.totals && typeof rawStats.totals === 'object' ? rawStats.totals : rawStats;
    const statsData = {
        totals: statsTotalsObj,
        total_encounters: rawStats.total_encounters ?? statsTotalsObj.total_encounters ?? statsTotalsObj.totalEncounters,
        totalEncounters: rawStats.totalEncounters ?? statsTotalsObj.totalEncounters ?? statsTotalsObj.total_encounters,
        shiny_encounters: rawStats.shiny_encounters ?? statsTotalsObj.shiny_encounters ?? statsTotalsObj.shinyEncounters,
        shinyEncounters: rawStats.shinyEncounters ?? statsTotalsObj.shinyEncounters ?? statsTotalsObj.shiny_encounters,
        catches: rawStats.catches ?? statsTotalsObj.catches ?? statsTotalsObj.total_caught,
        play_time: rawStats.play_time ?? statsTotalsObj.play_time ?? statsTotalsObj.playTime,
        playTime: rawStats.playTime ?? statsTotalsObj.playTime ?? statsTotalsObj.play_time,
        current_phase: rawStats.current_phase ?? rawStats.currentPhase,
        currentPhase: rawStats.currentPhase ?? rawStats.current_phase
    };
    const encounterRate = data.encounter_rate;
    
    // Save to history for graph (only when we have a real current rate)
    if (dashboardSettings.showEncounterRateSection !== false && encounterRate !== undefined && encounterRate !== null) {
        encounterRateHistory = JSON.parse(localStorage.getItem('botEncounterRateHistory') || '{}');
        if (!encounterRateHistory[bot.id]) {
            encounterRateHistory[bot.id] = [];
        }
        const history = encounterRateHistory[bot.id];
        const now = Date.now();
        const lastEntry = history.length > 0 ? history[history.length - 1] : null;
        if (!lastEntry || lastEntry.rate !== encounterRate || (now - lastEntry.time) >= 1000) {
            history.push({ time: now, rate: encounterRate, botName: bot.name });
            if (history.length > 100) history.shift();
            localStorage.setItem('botEncounterRateHistory', JSON.stringify(encounterRateHistory));
        }
    }
    
    if (dashboardSettings.showEncounterRateSection !== false) {
        const rateToShow = encounterRateForDisplay != null ? encounterRateForDisplay : (encounterRate != null ? encounterRate : null);
        if (rateToShow !== undefined && rateToShow !== null) {
            if (dashboardSettings.showEncounterRateAsGraph) {
                html += `<div class="status-section encounter-rate-card">
                    <h4>Encounter Rate</h4>
                    <canvas id="encounter-rate-chart-${bot.id}" class="encounter-rate-mini-chart"></canvas>
                </div>`;
            } else {
                html += `<div class="status-section encounter-rate-card">
                    <h4>Encounter Rate</h4>
                    <p>${rateToShow}/hr</p>
                </div>`;
            }
        } else {
            html += `<div class="status-section encounter-rate-card">
                <h4>Encounter Rate</h4>
                <p>—/hr</p>
            </div>`;
        }
    }

    // Target Pokemon
    if (dashboardSettings.showTargetPokemonSection !== false) {
        const targetPokemon = getBotTargetPokemon(bot.id);
        html += `<div class="status-section target-pokemon-section">
        <h4>Target Pokemon</h4>`;
        if (targetPokemon) {
        const unownForm = (targetPokemon.speciesId === 201) ? getUnownFormFromSpeciesName(targetPokemon.speciesName) : null;
        const spriteUrl = getSpriteUrl(targetPokemon.speciesId, true, unownForm || undefined);
        const spriteIdForFallback = (targetPokemon.speciesId === 201 && unownForm)
            ? (unownForm === 'a' || unownForm === 'A' ? '201' : '201-' + (unownForm.length === 1 ? unownForm.toLowerCase() : unownForm === '!' ? 'exclamation' : 'question'))
            : targetPokemon.speciesId;
        const fallbackShinyUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${spriteIdForFallback}.png`;
        
        // Get species-specific encounter count from stats
        let speciesEncounters = null;
        if (rawStats && rawStats.species) {
            // Check if stats has per-species data
            const speciesData = rawStats.species[targetPokemon.speciesId] || 
                              rawStats.species[targetPokemon.speciesId.toString()] ||
                              rawStats.by_species?.[targetPokemon.speciesId] ||
                              rawStats.by_species?.[targetPokemon.speciesId.toString()];
            if (speciesData) {
                speciesEncounters = speciesData.encounters || 
                                  speciesData.total_encounters || 
                                  speciesData.count ||
                                  speciesData.total;
            }
        }
        // Also check if stats has a nested structure like stats.totals.by_species
        if (speciesEncounters === null && rawStats && rawStats.totals) {
            const totalsBySpecies = rawStats.totals.by_species || rawStats.totals.species;
            if (totalsBySpecies) {
                const speciesData = totalsBySpecies[targetPokemon.speciesId] || 
                                  totalsBySpecies[targetPokemon.speciesId.toString()];
                if (speciesData) {
                    speciesEncounters = speciesData.encounters || 
                                      speciesData.total_encounters || 
                                      speciesData.count ||
                                      speciesData.total;
                }
            }
        }
        
            html += `
            <div class="target-pokemon-display">
                <div class="target-pokemon-sprite-container">
                    <img src="${spriteUrl}" alt="${targetPokemon.speciesName}" class="target-pokemon-sprite" 
                         onerror="this.src='${fallbackShinyUrl}'">
                    <p class="target-pokemon-encounters" id="target-encounters-${bot.id}" style="display: ${speciesEncounters !== null ? 'block' : 'none'};">${speciesEncounters !== null ? `${speciesEncounters.toLocaleString()}` : ''}</p>
                </div>
                <div class="target-pokemon-info">
                    <p class="target-pokemon-name">#${targetPokemon.speciesId} ${targetPokemon.speciesName}</p>
                    <button class="btn btn-small btn-secondary change-target-btn" data-bot-id="${bot.id}">Change</button>
                </div>
            </div>
            `;
            
        } else {
            html += `
            <div class="target-pokemon-display">
                <p class="no-target">No target set</p>
                <button class="btn btn-small btn-primary set-target-btn" data-bot-id="${bot.id}">Set Target</button>
            </div>
            `;
        }
        html += `</div>`;
    }

    // Current Location/Map - always show section when enabled to avoid pop in/out; use cache when no current data
    if (dashboardSettings.showMap) {
        let mapName = null;
        let mapType = null;
        
        if (map && map.map && map.map.name) {
            mapName = map.map.name;
            mapType = map.map.type;
        } else if (map && map.name) {
            mapName = map.name;
            mapType = map.type;
        } else if (status.location) {
            mapName = status.location;
        } else if (status.currentLocation) {
            mapName = status.currentLocation;
        } else if (map && typeof map === 'object' && Object.keys(map).length > 0) {
            mapName = map.name || map.map_name || map.location || map.current_map;
            mapType = map.type || map.map_type;
        }
        
        let locationSectionHtml = mapName
            ? `<div class="status-section">
                <h4>Current Location</h4>
                <p>${mapName}${mapType ? ` (${mapType})` : ''}</p>
            </div>`
            : '';
        if (locationSectionHtml) {
            lastLocationSectionCache.set(bot.id, { html: locationSectionHtml, time: Date.now() });
            html += locationSectionHtml;
        } else {
            const cached = lastLocationSectionCache.get(bot.id);
            if (cached) html += cached.html;
        }
    }

    // Party
    if (dashboardSettings.showParty && party && party.length > 0) {
        html += `<div class="status-section">
            <h4>Current Party (${party.length}/6)</h4>
            <div class="party-display">`;
        
        party.forEach((pokemon, index) => {
            // PokeBotGen-3 API format: pokemon.species.name or pokemon.species.id
            const species = pokemon.species || {};
            const speciesId = species.id || species.national_dex_number || 0;
            const speciesName = species.name || `#${speciesId}`;
            const level = pokemon.level || 0;
            const nickname = pokemon.nickname || '';
            const isShiny = pokemon.is_shiny || pokemon.isShiny || false;
            const unownFormIndex = getUnownFormIndexFromEncounterOrName(pokemon, speciesId, speciesName);
            const unownForm = (speciesId === 201 && unownFormIndex !== null && unownFormIndex !== undefined)
                ? getUnownFormForSprite(unownFormIndex)
                : undefined;
            const spriteUrl = getSpriteUrl(speciesId, isShiny, unownForm);
            const displayName = nickname && nickname.toLowerCase() !== speciesName.toLowerCase() 
                ? nickname 
                : speciesName;
            
            html += `<div class="party-member">
                <img src="${spriteUrl}" alt="Pokemon" onerror="this.style.display='none'">
                <div class="party-member-info">
                    <strong>${displayName}</strong>
                    <span>Lv. ${level}</span>
                    ${isShiny ? '<span class="shiny-badge">⭐</span>' : ''}
                </div>
            </div>`;
        });
        
        html += `</div></div>`;
    }

    // Recent Finds – only show when enabled; hide the whole card when off
    if (dashboardSettings.showEncounters) {
    // Handle various API response formats
    let encounterList = [];
    
    // Debug: log the encounters data structure
    if (encounters) {
        console.log(`[${bot.name}] Raw encounters data:`, encounters);
        console.log(`[${bot.name}] Encounters type:`, typeof encounters, Array.isArray(encounters));
    }
    
    if (Array.isArray(encounters)) {
        encounterList = encounters;
        console.log(`[${bot.name}] Using direct array, length: ${encounterList.length}`);
    } else if (encounters && typeof encounters === 'object') {
        // Check for nested array (e.g., { encounter_log: [...] })
        if (encounters.encounter_log && Array.isArray(encounters.encounter_log)) {
            encounterList = encounters.encounter_log;
            console.log(`[${bot.name}] Using encounter_log array, length: ${encounterList.length}`);
        } else if (encounters.encounters && Array.isArray(encounters.encounters)) {
            encounterList = encounters.encounters;
            console.log(`[${bot.name}] Using encounters array, length: ${encounterList.length}`);
        } else if (encounters.data && Array.isArray(encounters.data)) {
            encounterList = encounters.data;
            console.log(`[${bot.name}] Using data array, length: ${encounterList.length}`);
        } else if (encounters.results && Array.isArray(encounters.results)) {
            encounterList = encounters.results;
            console.log(`[${bot.name}] Using results array, length: ${encounterList.length}`);
        } else if (encounters.species) {
            // Single opponent object
            encounterList = [encounters];
            console.log(`[${bot.name}] Using single opponent object`);
        } else if (Object.keys(encounters).length > 0) {
            // Try to find array values
            for (const key in encounters) {
                if (Array.isArray(encounters[key])) {
                    encounterList = encounters[key];
                    console.log(`[${bot.name}] Found array in key '${key}', length: ${encounterList.length}`);
                    break;
                }
            }
        }
    }
    
    console.log(`[${bot.name}] Final encounterList length: ${encounterList.length}`);
    
    if (encounterList.length > 0) {
        html += `<div class="status-section">
            <h4>Recent Finds</h4>
            <div class="encounters-list">`;
        
        // Get the count from settings
        const recentFindsCount = dashboardSettings.recentFindsCount || 5;
        
        // Show most recent encounters first (already in reverse order from tracking)
        const recentEncounters = encounterList.slice(0, recentFindsCount);
        recentEncounters.forEach(encounter => {
            // Handle different encounter data structures, including WildEncounter events
            let speciesId = 0;
            let speciesName = '#0';
            let level = 0;
            let isShiny = false;
            
            // WildEncounter event format: { type: 'WildEncounter', data: { pokemon: {...} } } or { pokemon: {...} }
            // Check if this is a WildEncounter event
            if (encounter.type === 'WildEncounter' || encounter.event_type === 'WildEncounter' || encounter.name === 'WildEncounter') {
                // WildEncounter event format
                const eventData = encounter.data || encounter;
                const pokemon = eventData.pokemon || eventData;
                
                if (pokemon.species) {
                    const species = pokemon.species;
                    speciesId = species.id || species.national_dex_number || species.nationalDexNumber || 0;
                    speciesName = species.name || `#${speciesId}`;
                    level = pokemon.level || eventData.level || 0;
                    isShiny = pokemon.is_shiny || pokemon.isShiny || eventData.is_shiny || eventData.isShiny || false;
                } else if (pokemon.id || pokemon.national_dex_number) {
                    speciesId = pokemon.id || pokemon.national_dex_number || pokemon.nationalDexNumber || 0;
                    speciesName = pokemon.name || pokemon.species_name || `#${speciesId}`;
                    level = pokemon.level || 0;
                    isShiny = pokemon.is_shiny || pokemon.isShiny || false;
                }
            } else if (encounter.species) {
                // Format: { species: { id, name, national_dex_number }, level, is_shiny }
                const species = encounter.species;
                speciesId = species.id || species.national_dex_number || species.nationalDexNumber || 0;
                speciesName = species.name || `#${speciesId}`;
                level = encounter.level || 0;
                isShiny = encounter.is_shiny || encounter.isShiny || false;
            } else if (encounter.pokemon) {
                // Alternative format: { pokemon: { ... } }
                const pokemon = encounter.pokemon;
                const species = pokemon.species || {};
                speciesId = species.id || species.national_dex_number || 0;
                speciesName = species.name || `#${speciesId}`;
                level = pokemon.level || encounter.level || 0;
                isShiny = pokemon.is_shiny || pokemon.isShiny || encounter.is_shiny || false;
            } else if (encounter.id || encounter.national_dex_number) {
                // Direct format: { id, name, level, is_shiny }
                speciesId = encounter.id || encounter.national_dex_number || encounter.nationalDexNumber || 0;
                speciesName = encounter.name || encounter.species_name || `#${speciesId}`;
                level = encounter.level || 0;
                isShiny = encounter.is_shiny || encounter.isShiny || false;
            } else {
                // Log for debugging
                console.warn(`[${bot.name}] Unknown encounter format:`, encounter);
            }
            
            // Only display if we have valid data
            if (speciesId > 0 || speciesName !== '#0') {
                const unownFormIndex = getUnownFormIndexFromEncounterOrName(encounter, speciesId, speciesName);
                const unownForm = (speciesId === 201 && unownFormIndex !== null && unownFormIndex !== undefined)
                    ? getUnownFormForSprite(unownFormIndex)
                    : undefined;
                speciesName = formatEncounterSpeciesName(speciesId, speciesName, encounter);
                const spriteUrl = getSpriteUrl(speciesId, isShiny, unownForm);
                
                // Store the full encounter data as JSON in data attribute (HTML-encoded)
                const encounterData = JSON.stringify(encounter).replace(/"/g, '&quot;');
                
                html += `<div class="encounter-item clickable-encounter" data-species-id="${speciesId}" data-encounter="${encounterData}" style="cursor: pointer;" title="Click to view details">
                    <img src="${spriteUrl}" alt="Pokemon" onerror="this.style.display='none'">
                    <div class="encounter-info">
                        <strong>${speciesName}</strong>
                        ${level > 0 ? `<span>Lv. ${level}</span>` : ''}
                        ${isShiny ? '<span class="shiny-badge">⭐</span>' : ''}
                    </div>
                </div>`;
            }
        });
        
        html += `</div></div>`;
    }
    }

    // Current Encounter/Opponent
    if (dashboardSettings.showCurrentEncounter) {
        html += `<div class="status-section">
            <h4>Current Encounter</h4>`;

        const hasEncounter = currentEncounter && Object.keys(currentEncounter).length > 0;

        if (hasEncounter) {
            // Extract encounter data
            let speciesId = 0;
            let speciesName = 'Unknown';
            let level = 0;
            let isShiny = false;
            let ivs = null;
            let nature = null;
            let ability = null;
            
            if (currentEncounter.species) {
                const species = currentEncounter.species;
                speciesId = species.id || species.national_dex_number || 0;
                speciesName = species.name || `#${speciesId}`;
            } else if (currentEncounter.id || currentEncounter.national_dex_number) {
                speciesId = currentEncounter.id || currentEncounter.national_dex_number || 0;
                speciesName = currentEncounter.name || currentEncounter.species_name || `#${speciesId}`;
            }
            
            level = currentEncounter.level || 0;
            isShiny = currentEncounter.is_shiny || currentEncounter.isShiny || false;
            ivs = currentEncounter.ivs || currentEncounter.IVs;
            nature = formatNatureValue(
                currentEncounter.nature ||
                currentEncounter.nature_name ||
                currentEncounter.pokemon?.nature ||
                currentEncounter.pokemon?.nature_name
            );
            ability = formatAbilityValue(
                currentEncounter.ability || currentEncounter.pokemon?.ability,
                currentEncounter.ability_name || currentEncounter.pokemon?.ability_name,
                currentEncounter.ability_slot || currentEncounter.pokemon?.ability_slot
            );
            
            if (speciesId > 0 || speciesName !== 'Unknown') {
                const unownFormIndex = getUnownFormIndexFromEncounterOrName(currentEncounter, speciesId, speciesName);
                const unownForm = (speciesId === 201 && unownFormIndex !== null && unownFormIndex !== undefined)
                    ? getUnownFormForSprite(unownFormIndex)
                    : undefined;
                speciesName = formatEncounterSpeciesName(speciesId, speciesName, currentEncounter);
                const spriteUrl = getSpriteUrl(speciesId, isShiny, unownForm);
                html += `<div class="current-encounter-display">`;
                html += `<div class="encounter-sprite-slot">`;
                if (dashboardSettings.showEncounterSprite !== false) {
                    html += `<img src="${spriteUrl}" alt="Pokemon" onerror="this.style.display='none'" class="encounter-sprite">`;
                }
                html += `</div>`;
                
                html += `<div class="encounter-details">`;
                
                if (dashboardSettings.showEncounterName !== false) {
                    html += `<div class="encounter-name">
                        <strong>${speciesName}</strong>
                        ${(dashboardSettings.showEncounterShiny !== false && isShiny) ? '<span class="shiny-badge">⭐</span>' : ''}
                    </div>`;
                } else if (dashboardSettings.showEncounterShiny !== false && isShiny) {
                    html += `<div class="encounter-name"><span class="shiny-badge">⭐</span></div>`;
                }
                
                if (dashboardSettings.showEncounterLevel !== false && level > 0) {
                    html += `<div class="encounter-detail">Level: ${level}</div>`;
                }
                if (dashboardSettings.showEncounterNature !== false && nature) {
                    html += `<div class="encounter-detail">Nature: ${nature}</div>`;
                }
                if (dashboardSettings.showEncounterAbility !== false && ability) {
                    html += `<div class="encounter-detail">Ability: ${ability}</div>`;
                }
                
                if (ivs && typeof ivs === 'object') {
                    const ivSum = Object.values(ivs).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
                    if (dashboardSettings.showEncounterIVSum !== false) {
                        html += `<div class="encounter-detail">IV Sum: ${ivSum}</div>`;
                    }
                }
                
                html += `</div></div>`;
            }
        } else {
            const mode =
                statusWithEmulator.mode ||
                statusWithEmulator.bot_mode ||
                statusWithEmulator.game_mode ||
                statusWithEmulator.gameMode ||
                (typeof statusWithEmulator.game_state === 'string' ? statusWithEmulator.game_state : null) ||
                'Unknown';

            html += `<div class="current-encounter-display current-encounter-empty">
                <div class="encounter-sprite-slot" aria-hidden="true"></div>
                <div class="encounter-details">
                    <div class="encounter-name">
                        <strong>No current encounter</strong>
                    </div>
                    <div class="encounter-detail">Mode: ${mode}</div>
                </div>
            </div>`;
        }
        
        html += `</div>`;
    }

    // Stats - only run max-totals update and Current Phase; Statistics cards (Total Encounters, Total Shinies, Total Catches) removed from bot card
    if (dashboardSettings.showStats) {
        const statsTotals = statsData.totals || {};
        const totalEncounters =
            statsData.total_encounters ??
            statsData.totalEncounters ??
            statsTotals.total_encounters ??
            statsTotals.totalEncounters;
        const shinyEncounters =
            statsData.shiny_encounters ??
            statsData.shinyEncounters ??
            statsTotals.shiny_encounters ??
            statsTotals.shinyEncounters;
        const playTimeValue =
            statsData.play_time ??
            statsData.playTime ??
            statsTotals.play_time ??
            statsTotals.playTime;
        const catchesValue =
            statsData.catches ??
            statsTotals.catches ??
            statsTotals.total_caught ??
            statsData.total_caught;
        const numEncountersRaw = totalEncounters != null ? Number(totalEncounters) : undefined;
        const numShiniesRaw = shinyEncounters != null ? Number(shinyEncounters) : undefined;
        const numCatchesRaw = catchesValue != null ? Number(catchesValue) : undefined;
        updateBotMaxTotals(bot.id, numEncountersRaw, numShiniesRaw, numCatchesRaw);

        // Phase - Display detailed phase information (no Statistics cards on card)
        const phaseData = statsData.current_phase || statsData.currentPhase;
        if (phaseData !== undefined) {
            if (typeof phaseData === 'object' && phaseData !== null) {
                // Format phase object with key information
                const phaseInfo = [];
                
                // Current streak (most important)
                if (dashboardSettings.showPhaseCurrentStreak !== false && phaseData.current_streak) {
                    const streak = phaseData.current_streak;
                    const species = streak.species_name || 'Unknown';
                    const value = streak.value || 0;
                    phaseInfo.push(`Current Streak: ${value} (${species})`);
                }
                
                // Total encounters in phase
                if (dashboardSettings.showPhaseEncounters !== false && phaseData.encounters !== undefined) {
                    phaseInfo.push(`Encounters: ${phaseData.encounters.toLocaleString()}`);
                }
                
                // Start time
                if (dashboardSettings.showPhaseDuration !== false && phaseData.start_time) {
                    try {
                        const startDate = new Date(phaseData.start_time);
                        const duration = Date.now() - startDate.getTime();
                        const hours = Math.floor(duration / (1000 * 60 * 60));
                        const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
                        phaseInfo.push(`Duration: ${hours}h ${minutes}m`);
                    } catch (e) {
                        // Ignore date parsing errors
                    }
                }
                
                // Highest IV sum
                if (dashboardSettings.showPhaseBestIV !== false && phaseData.highest_iv_sum) {
                    const iv = phaseData.highest_iv_sum;
                    phaseInfo.push(`Best IV: ${iv.value} (${iv.species_name || 'Unknown'})`);
                }
                
                // Longest streak
                if (dashboardSettings.showPhaseLongest !== false && phaseData.longest_streak) {
                    const streak = phaseData.longest_streak;
                    phaseInfo.push(`Longest: ${streak.value} (${streak.species_name || 'Unknown'})`);
                }
                
                // Pokenav calls
                if (dashboardSettings.showPhasePokenav !== false && phaseData.pokenav_calls !== undefined) {
                    phaseInfo.push(`Pokenav: ${phaseData.pokenav_calls}`);
                }
                
                // Display as a formatted list
                if (phaseInfo.length > 0) {
                    const phaseSectionHtml = `<div class="status-section">
                        <h4>Current Phase</h4>
                        <div class="phase-info">${
                            phaseInfo.map(info => `<div class="phase-info-item">${info}</div>`).join('')
                        }</div></div>`;
                    lastPhaseSectionCache.set(bot.id, { html: phaseSectionHtml, time: Date.now() });
                    html += phaseSectionHtml;
                } else {
                    // Fallback to JSON if no recognized structure
                    html += `<div class="stat-item">
                        <span class="stat-label">Current Phase:</span>
                        <span class="stat-value">${JSON.stringify(phaseData)}</span>
                    </div>`;
                }
                
                // Log for debugging
                console.log(`[${bot.name}] Phase object:`, phaseData);
            } else {
                // Simple string/number phase
                html += `<div class="stat-item">
                    <span class="stat-label">Current Phase:</span>
                    <span class="stat-value">${String(phaseData)}</span>
                </div>`;
            }
        } else {
            // No phase data: show last cached Current Phase section if we have real data (ignore empty messages)
            const phaseCached = lastPhaseSectionCache.get(bot.id);
            if (phaseCached) html += phaseCached.html;
        }
    }

    // Emulator Info - always show section when enabled to avoid pop in/out; use cached content when no current data
    const emulatorData = emulator && Object.keys(emulator).length > 0 ? emulator : 
                        (status.emulator && Object.keys(status.emulator).length > 0 ? status.emulator : 
                        (status.frame_rate !== undefined || status.frameRate !== undefined ? status : null));
    
    if (dashboardSettings.showEmulator) {
        html += `<div class="status-section">
            <h4>Emulator Info</h4>
            <div class="phase-info">`;
        let emulatorInnerHtml = '';
        if (emulatorData) {
            const emulatorInfo = [];
            const getEmulatorValue = (...keys) => {
                for (const key of keys) {
                    if (emulatorData[key] !== undefined && emulatorData[key] !== null) return emulatorData[key];
                }
                return undefined;
            };
            if (dashboardSettings.showEmulatorFrameRate !== false && getEmulatorValue('frame_rate', 'frameRate', 'fps', 'FPS', 'current_fps') !== undefined) {
                emulatorInfo.push(`FPS: ${getEmulatorValue('frame_rate', 'frameRate', 'fps', 'FPS', 'current_fps')}`);
            }
            if (dashboardSettings.showEmulatorFastForward !== false && getEmulatorValue('fast_forward', 'fastForward', 'fast_forward_enabled', 'fastForwardEnabled') !== undefined) {
                emulatorInfo.push(`Fast Forward: ${getEmulatorValue('fast_forward', 'fastForward', 'fast_forward_enabled', 'fastForwardEnabled') ? 'On' : 'Off'}`);
            }
            if (dashboardSettings.showEmulatorPaused !== false && getEmulatorValue('paused', 'is_paused', 'isPaused') !== undefined) {
                emulatorInfo.push(`Paused: ${getEmulatorValue('paused', 'is_paused', 'isPaused') ? 'Yes' : 'No'}`);
            }
            if (dashboardSettings.showEmulatorUptime !== false) {
                const uptime = getEmulatorValue('uptime', 'up_time', 'upTime', 'runtime', 'run_time', 'runTime');
                if (uptime !== undefined) {
                    emulatorInfo.push(`Uptime: ${typeof uptime === 'number' ? formatPlayTime(uptime) : uptime}`);
                }
            }
            const excludedKeys = ['frame_rate', 'frameRate', 'fps', 'FPS', 'current_fps', 'current_time_spent_in_bot_fraction', 'currentTimeSpentInBotFraction',
                                  'speed', 'speed_multiplier', 'speedMultiplier', 
                                  'emulation_speed', 'emulationSpeed', 'fast_forward', 'fastForward', 'paused', 
                                  'is_paused', 'isPaused', 'uptime', 'up_time', 'upTime', 'runtime', 'run_time', 
                                  'runTime', 'video_enabled', 'videoEnabled', 'video', 'audio_enabled', 'audioEnabled', 
                                  'audio', 'bot_mode', 'botMode', 'mode'];
            for (const [key, value] of Object.entries(emulatorData)) {
                if (excludedKeys.includes(key)) continue;
                if (value !== null && value !== undefined && typeof value !== 'object') {
                    const label = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1')
                        .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                    emulatorInfo.push(`${label}: ${value}`);
                }
            }
            if (emulatorInfo.length > 0) {
                emulatorInnerHtml = emulatorInfo.map(info => `<div class="phase-info-item">${info}</div>`).join('');
                lastEmulatorSectionCache.set(bot.id, { html: emulatorInnerHtml, time: Date.now() });
            }
        }
        if (emulatorInnerHtml) {
            html += emulatorInnerHtml;
        } else {
            const cached = lastEmulatorSectionCache.get(bot.id);
            if (cached) html += cached.html;
            else html += `<div class="phase-info-item">No emulator data available</div>`;
        }
        html += `</div></div>`;
    }

    // Game
    if (dashboardSettings.showGameState && status && Object.keys(status).length > 0) {
        // Debug: log status structure
        console.log(`[${bot.name}] Game data:`, JSON.stringify(status, null, 2));
        
        html += `<div class="status-section">
            <h4>Game</h4>
            <div class="phase-info">`;
        
        // Build list of game info items (like Current Phase format)
        const gameInfo = [];
        
        // Helper function to safely extract nested values
        const getValue = (obj, ...paths) => {
            for (const path of paths) {
                const keys = path.split('.');
                let value = obj;
                for (const key of keys) {
                    if (value && typeof value === 'object' && key in value) {
                        value = value[key];
                    } else {
                        value = undefined;
                        break;
                    }
                }
                if (value !== undefined && value !== null) {
                    return value;
                }
            }
            return undefined;
        };
        
        // Mode - always add when we have status so we never show "No game data available"
        const gameMode = status.mode || status.bot_mode || status.game_mode || status.gameMode || (typeof status.game_state === 'string' ? status.game_state : null) || 'Unknown';
        gameInfo.push(`Mode: ${gameMode}`);
        
        // Badges
        const badges = getValue(status, 'badges', 'badge_count', 'badges.count');
        if (dashboardSettings.showGameBadges !== false && badges !== undefined) {
            const badgeCount = Array.isArray(badges) ? badges.length : (typeof badges === 'number' ? badges : (badges.count || badges));
            gameInfo.push(`Badges: ${badgeCount}`);
        }
        
        // Game name - handle object case
        const game = status.game || getValue(status, 'game', 'game_name', 'game.name', 'version', 'version.name');
        if (dashboardSettings.showGameName !== false && game !== undefined) {
            let gameName = 'Unknown';
            let gameLanguage = null;
            let gameRevision = null;
            
            if (typeof game === 'string') {
                gameName = game;
            } else if (typeof game === 'object' && game !== null) {
                // Extract name/title (prefer name over title for display)
                gameName = game.name || game.title || game.version || game.game || 'Unknown';
                // Extract language and revision
                gameLanguage = game.language;
                gameRevision = game.revision;
            } else if (typeof game === 'number') {
                gameName = String(game);
            }
            
            gameInfo.push(`Game: ${gameName}`);
            
            // Add language if available
            if (dashboardSettings.showGameLanguage !== false && gameLanguage !== undefined && gameLanguage !== null) {
                gameInfo.push(`Language: ${gameLanguage}`);
            }
            
            // Add revision if available
            if (dashboardSettings.showGameRevision !== false && gameRevision !== undefined && gameRevision !== null) {
                gameInfo.push(`Revision: ${gameRevision}`);
            }
        } else {
            // Still show language and revision if game name is hidden
            const game = status.game || getValue(status, 'game', 'game_name', 'game.name', 'version', 'version.name');
            if (game && typeof game === 'object' && game !== null) {
                const gameLanguage = game.language;
                const gameRevision = game.revision;
                if (dashboardSettings.showGameLanguage !== false && gameLanguage !== undefined && gameLanguage !== null) {
                    gameInfo.push(`Language: ${gameLanguage}`);
                }
                if (dashboardSettings.showGameRevision !== false && gameRevision !== undefined && gameRevision !== null) {
                    gameInfo.push(`Revision: ${gameRevision}`);
                }
            }
        }
        
        // Map ID
        const mapId = getValue(status, 'map_id', 'map.id', 'mapId', 'current_map_id');
        if (dashboardSettings.showGameMapID !== false && mapId !== undefined) {
            gameInfo.push(`Map ID: ${mapId}`);
        }
        
        // Position
        const x = getValue(status, 'x', 'position.x', 'player.x', 'coords.x');
        const y = getValue(status, 'y', 'position.y', 'player.y', 'coords.y');
        if (dashboardSettings.showGamePosition !== false && x !== undefined && y !== undefined) {
            gameInfo.push(`Position: (${x}, ${y})`);
        }
        
        // Additional common fields
        const steps = getValue(status, 'steps', 'player.steps');
        if (dashboardSettings.showGameSteps !== false && steps !== undefined && typeof steps === 'number') {
            gameInfo.push(`Steps: ${steps.toLocaleString()}`);
        }
        
        const timePlayed = getValue(status, 'time_played', 'timePlayed', 'play_time', 'playTime');
        if (dashboardSettings.showGameTimePlayed !== false && timePlayed !== undefined && typeof timePlayed === 'number') {
            gameInfo.push(`Time Played: ${formatPlayTime(timePlayed)}`);
        }
        
        // Display all game info items in phase-info format
        if (gameInfo.length > 0) {
            let gameSectionHtml = '';
            gameInfo.forEach(info => {
                gameSectionHtml += `<div class="phase-info-item">${info}</div>`;
            });
            lastGameSectionCache.set(bot.id, { html: gameSectionHtml, time: Date.now() });
            html += gameSectionHtml;
        } else {
            const cached = lastGameSectionCache.get(bot.id);
            if (cached) {
                html += cached.html;
            } else {
                html += `<div class="phase-info-item">No game data available</div>`;
            }
        }
        
        html += `</div></div>`;
    }

    // Player Info - always show section when enabled so it doesn't flash in/out; use cache when current data is empty
    const PLAYER_LIKE_KEYS = ['name', 'player_name', 'trainer_name', 'trainerName', 'ot', 'OT', 'original_trainer', 'originalTrainer',
        'trainer_id', 'trainerId', 'tid', 'TID', 'secret_id', 'secretId', 'sid', 'SID', 'gender', 'play_time', 'playTime', 'time_played', 'timePlayed',
        'money', 'coins', 'id32', 'ID32', 'trainerID32', 'trainerId32'];
    const statusHasPlayerLike = status && typeof status === 'object' && PLAYER_LIKE_KEYS.some(k => status[k] !== undefined && status[k] !== null);
    const mergedPlayer = Object.assign({}, player || {}, (statusHasPlayerLike ? status : {}));
    const playerData = (mergedPlayer && Object.keys(mergedPlayer).length > 0) ? mergedPlayer :
                      (player && Object.keys(player).length > 0 ? player :
                      (status.player && Object.keys(status.player).length > 0 ? status.player :
                      (status.name !== undefined || status.trainer_id !== undefined || status.trainer_name !== undefined || statusHasPlayerLike ? status : null)));
    
    if (dashboardSettings.showPlayerInfo) {
        html += `<div class="status-section">
            <h4>Player Info</h4>
            <div class="phase-info">`;
        
        let playerSectionContent = '';
        if (playerData) {
            const playerInfo = [];
            const getPlayerValue = (...keys) => {
                for (const key of keys) {
                    if (playerData[key] !== undefined && playerData[key] !== null) return playerData[key];
                    const pathParts = key.split('.');
                    let value = playerData;
                    for (const part of pathParts) {
                        if (value && typeof value === 'object' && part in value) value = value[part];
                        else { value = undefined; break; }
                    }
                    if (value !== undefined && value !== null) return value;
                }
                for (const key of keys) {
                    if (status[key] !== undefined && status[key] !== null) return status[key];
                }
                return undefined;
            };
            if (dashboardSettings.showPlayerName !== false) {
                const playerName = getPlayerValue('name', 'player_name', 'trainer_name', 'player.name', 'trainer.name', 'ot', 'OT', 'original_trainer', 'originalTrainer');
                if (playerName !== undefined && String(playerName).trim() !== '') playerInfo.push(`Name: ${String(playerName).trim()}`);
            }
            if (dashboardSettings.showPlayerTID !== false) {
                const tid = getPlayerValue('trainer_id', 'tid', 'TID', 'player.trainer_id', 'trainer.id', 'trainer.tid', 'trainerID', 'trainerId');
                if (tid !== undefined && (typeof tid === 'number' || typeof tid === 'string')) playerInfo.push(`Trainer ID: ${tid}`);
            }
            if (dashboardSettings.showPlayerSID !== false) {
                const sid = getPlayerValue('secret_id', 'sid', 'SID', 'player.secret_id', 'trainer.secret_id', 'trainer.sid', 'secretID', 'secretId');
                if (sid !== undefined && (typeof sid === 'number' || typeof sid === 'string')) playerInfo.push(`Secret ID: ${sid}`);
            }
            if (dashboardSettings.showPlayerGender !== false) {
                const gender = getPlayerValue('gender', 'player.gender', 'trainer.gender', 'is_male', 'isMale');
                if (gender !== undefined) {
                    let genderText = 'Unknown';
                    if (typeof gender === 'string') genderText = gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase();
                    else if (typeof gender === 'number') genderText = gender === 0 ? 'Male' : gender === 1 ? 'Female' : String(gender);
                    else if (typeof gender === 'boolean') genderText = gender ? 'Female' : 'Male';
                    playerInfo.push(`Gender: ${genderText}`);
                }
            }
            if (dashboardSettings.showPlayerPlayTime !== false) {
                const playTime = getPlayerValue('play_time', 'playTime', 'player.play_time', 'time_played', 'timePlayed');
                if (playTime !== undefined && typeof playTime === 'number') playerInfo.push(`Play Time: ${formatPlayTime(playTime)}`);
            }
            const money = getPlayerValue('money', 'player.money', 'trainer.money');
            if (money !== undefined && (typeof money === 'number' || typeof money === 'string')) playerInfo.push(`Money: $${Number(money).toLocaleString()}`);
            const coins = getPlayerValue('coins', 'player.coins', 'trainer.coins');
            if (coins !== undefined && (typeof coins === 'number' || typeof coins === 'string')) playerInfo.push(`Coins: ${Number(coins).toLocaleString()}`);
            if (dashboardSettings.showPlayerID32 !== false) {
                const id32 = getPlayerValue('id32', 'ID32', 'player.id32', 'trainer.id32', 'trainerID32', 'trainerId32');
                if (id32 !== undefined && typeof id32 === 'number') playerInfo.push(`ID32: ${id32}`);
            }
            const knownKeys = ['name', 'player_name', 'trainer_name', 'ot', 'OT', 'trainer_id', 'tid', 'TID', 'secret_id', 'sid', 'SID', 'gender', 'play_time', 'playTime', 'id32', 'ID32', 'money', 'coins', 'registered_item', 'emulation_speed', 'emulationSpeed'];
            for (const [key, value] of Object.entries(playerData)) {
                if (knownKeys.includes(key)) continue;
                if (/^\d+$/.test(String(key))) continue; // skip numeric keys (e.g. 0,1,2 from string/array-like)
                if (value !== null && value !== undefined && typeof value !== 'object') {
                    const label = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                    playerInfo.push(`${label}: ${value}`);
                }
            }
            if (playerInfo.length > 0) {
                playerInfo.forEach(info => { playerSectionContent += `<div class="phase-info-item">${info}</div>`; });
                lastPlayerSectionCache.set(bot.id, { html: playerSectionContent, time: Date.now() });
            }
        }
        // Prefer cached content when current build is empty to avoid flashing
        if (playerSectionContent) {
            html += playerSectionContent;
        } else {
            const cached = lastPlayerSectionCache.get(bot.id);
            if (cached) html += cached.html;
            else html += `<div class="phase-info-item">No player data available</div>`;
        }
        html += `</div></div>`;
    }

    // Total Stats - remember last values; show section when enabled, use cache when no current data
    const hasTotals = statsData && statsData.totals && Object.keys(statsData.totals).length > 0;
    const hasAnyStats = statsData && Object.keys(statsData).length > 0;
    if (dashboardSettings.showTotalStats) {
        let totalStatsSectionHtml = '';
        if (hasAnyStats || hasTotals) {
            const formatStatValue = (value) => {
                if (value === null || value === undefined) return null;
                if (typeof value === 'number') return value.toLocaleString();
                if (typeof value === 'object') return JSON.stringify(value);
                return String(value);
            };
            const statInfo = [];
            const totals = statsData.totals || {};
            if (totals && Object.keys(totals).length > 0) {
                if (totals.total_encounters !== undefined && dashboardSettings.showTotalStatsTotalEncounters !== false) {
                    statInfo.push(`Total Encounters: ${Number(totals.total_encounters).toLocaleString()}`);
                }
                if (totals.shiny_encounters !== undefined && dashboardSettings.showTotalStatsShinyEncounters !== false) {
                    statInfo.push(`Shiny Encounters: ${Number(totals.shiny_encounters).toLocaleString()}`);
                }
                if (totals.catches !== undefined && dashboardSettings.showTotalStatsCatches !== false) {
                    statInfo.push(`Catches: ${Number(totals.catches).toLocaleString()}`);
                }
                if (totals.total_highest_iv_sum && typeof totals.total_highest_iv_sum === 'object' && dashboardSettings.showTotalStatsHighestIV !== false) {
                    const iv = totals.total_highest_iv_sum;
                    statInfo.push(`Total Highest IV: ${iv.value} (${iv.species_name || 'Unknown'})`);
                }
                if (totals.total_lowest_iv_sum && typeof totals.total_lowest_iv_sum === 'object' && dashboardSettings.showTotalStatsLowestIV !== false) {
                    const iv = totals.total_lowest_iv_sum;
                    statInfo.push(`Total Lowest IV: ${iv.value} (${iv.species_name || 'Unknown'})`);
                }
                if (totals.total_highest_sv && typeof totals.total_highest_sv === 'object' && dashboardSettings.showTotalStatsHighestSV !== false) {
                    const sv = totals.total_highest_sv;
                    statInfo.push(`Total Highest SV: ${sv.value} (${sv.species_name || 'Unknown'})`);
                }
                if (totals.total_lowest_sv && typeof totals.total_lowest_sv === 'object' && dashboardSettings.showTotalStatsLowestSV !== false) {
                    const sv = totals.total_lowest_sv;
                    statInfo.push(`Total Lowest SV: ${sv.value} (${sv.species_name || 'Unknown'})`);
                }
            }
            const statFields = [
                { key: 'total_encounters', label: 'Total Encounters', aliases: ['totalEncounters', 'encounters'] },
                { key: 'shiny_encounters', label: 'Shiny Encounters', aliases: ['shinyEncounters', 'shinies'] },
                { key: 'play_time', label: 'Play Time', aliases: ['playTime', 'time_played', 'timePlayed'], formatter: (v) => typeof v === 'number' ? formatPlayTime(v) : v },
                { key: 'total_runtime', label: 'Total Runtime', aliases: ['totalRuntime', 'runtime'], formatter: (v) => typeof v === 'number' ? formatPlayTime(v) : v },
                { key: 'total_shinies', label: 'Total Shinies', aliases: ['totalShinies'] },
                { key: 'total_caught', label: 'Total Caught', aliases: ['totalCaught', 'caught'] },
                { key: 'total_fainted', label: 'Total Fainted', aliases: ['totalFainted', 'fainted'] },
                { key: 'total_resets', label: 'Total Resets', aliases: ['totalResets', 'resets'] },
                { key: 'encounters_per_hour', label: 'Encounters/Hour', aliases: ['encountersPerHour', 'encounter_rate'] },
                { key: 'shiny_rate', label: 'Shiny Rate', aliases: ['shinyRate'], formatter: (v) => typeof v === 'number' ? `${(v * 100).toFixed(4)}%` : v },
                { key: 'average_iv_sum', label: 'Average IV Sum', aliases: ['averageIvSum', 'avg_iv_sum', 'avgIvSum'], formatter: (v) => typeof v === 'number' ? v.toFixed(2) : v },
                { key: 'best_iv_sum', label: 'Best IV Sum', aliases: ['bestIvSum', 'highest_iv_sum', 'highestIvSum'] },
                { key: 'total_pokemon_caught', label: 'Pokemon Caught', aliases: ['totalPokemonCaught', 'pokemon_caught'] },
                { key: 'total_pokemon_seen', label: 'Pokemon Seen', aliases: ['totalPokemonSeen', 'pokemon_seen'] },
                { key: 'total_battles', label: 'Total Battles', aliases: ['totalBattles', 'battles'] },
                { key: 'total_wins', label: 'Total Wins', aliases: ['totalWins', 'wins'] },
                { key: 'total_losses', label: 'Total Losses', aliases: ['totalLosses', 'losses'] },
                { key: 'win_rate', label: 'Win Rate', aliases: ['winRate'], formatter: (v) => typeof v === 'number' ? `${(v * 100).toFixed(2)}%` : v },
                { key: 'money_earned', label: 'Money Earned', aliases: ['moneyEarned'], formatter: (v) => typeof v === 'number' ? `₽${v.toLocaleString()}` : v },
                { key: 'money_spent', label: 'Money Spent', aliases: ['moneySpent'], formatter: (v) => typeof v === 'number' ? `₽${v.toLocaleString()}` : v },
                { key: 'items_found', label: 'Items Found', aliases: ['itemsFound'] },
                { key: 'pokeballs_used', label: 'Pokeballs Used', aliases: ['pokeballsUsed'] },
                { key: 'pokeballs_caught', label: 'Pokeballs Caught', aliases: ['pokeballsCaught'] },
                { key: 'catch_rate', label: 'Catch Rate', aliases: ['catchRate'], formatter: (v) => typeof v === 'number' ? `${(v * 100).toFixed(2)}%` : v }
            ];
            const displayedKeys = new Set();
            if (totals && Object.keys(totals).length > 0) {
                Object.keys(totals).forEach(key => displayedKeys.add(key));
            }
            displayedKeys.add('totals');
            statFields.forEach(field => {
                let value = statsData[field.key];
                if (value === undefined || value === null) {
                    for (const alias of field.aliases) {
                        if (statsData[alias] !== undefined && statsData[alias] !== null) {
                            value = statsData[alias];
                            break;
                        }
                    }
                }
                if (value !== undefined && value !== null) {
                    displayedKeys.add(field.key);
                    field.aliases.forEach(alias => displayedKeys.add(alias));
                    const formattedValue = field.formatter ? field.formatter(value) : formatStatValue(value);
                    if (formattedValue != null) statInfo.push(`${field.label}: ${formattedValue}`);
                }
            });
            for (const [key, value] of Object.entries(statsData)) {
                if (displayedKeys.has(key) || key === 'current_phase' || key === 'currentPhase' ||
                    (typeof value === 'object' && value !== null)) continue;
                if (key.toLowerCase().includes('phase') || key.toLowerCase().includes('fraction') ||
                    key.toLowerCase().includes('time_spent') || key.toLowerCase().includes('timespent')) continue;
                const label = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
                if (label.toLowerCase().includes('time spent') || label.toLowerCase().includes('fraction')) continue;
                const fv = formatStatValue(value);
                if (fv != null) statInfo.push(`${label}: ${fv}`);
            }
            // If no items from API, use remembered max totals so we don't show "No stats available"
            if (statInfo.length === 0) {
                const maxEnc = maxTotalEncountersCache.get(bot.id);
                const maxShinies = maxTotalShiniesCache.get(bot.id);
                const maxCatches = maxTotalCatchesCache.get(bot.id);
                if (maxEnc != null && dashboardSettings.showTotalStatsTotalEncounters !== false) {
                    statInfo.push(`Total Encounters: ${Number(maxEnc).toLocaleString()}`);
                }
                if (maxShinies != null && dashboardSettings.showTotalStatsShinyEncounters !== false) {
                    statInfo.push(`Shiny Encounters: ${Number(maxShinies).toLocaleString()}`);
                }
                if (maxCatches != null && dashboardSettings.showTotalStatsCatches !== false) {
                    statInfo.push(`Catches: ${Number(maxCatches).toLocaleString()}`);
                }
                // If still empty, show zeros so we never show "No stats available"
                if (statInfo.length === 0) {
                    if (dashboardSettings.showTotalStatsTotalEncounters !== false) statInfo.push('Total Encounters: 0');
                    if (dashboardSettings.showTotalStatsShinyEncounters !== false) statInfo.push('Shiny Encounters: 0');
                    if (dashboardSettings.showTotalStatsCatches !== false) statInfo.push('Catches: 0');
                }
            }
            const innerItems = statInfo.length > 0
                ? statInfo.map(info => `<div class="phase-info-item">${info}</div>`).join('')
                : '<div class="phase-info-item">No stats available</div>';
            const botNameEsc = String(bot.name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            totalStatsSectionHtml = `<div class="status-section">
                <h4>Total Stats — ${botNameEsc}</h4>
                <div class="phase-info">${innerItems}</div></div>`;
            if (statInfo.length > 0) {
                lastTotalStatsSectionCache.set(bot.id, { html: totalStatsSectionHtml, time: Date.now() });
            }
        } else {
            const totalStatsCached = lastTotalStatsSectionCache.get(bot.id);
            if (totalStatsCached) {
                totalStatsSectionHtml = totalStatsCached.html;
            } else {
                // No API stats and no cache: show at least remembered max totals or zeros
                const maxEnc = maxTotalEncountersCache.get(bot.id);
                const maxShinies = maxTotalShiniesCache.get(bot.id);
                const maxCatches = maxTotalCatchesCache.get(bot.id);
                const fallbackItems = [];
                if (maxEnc != null && dashboardSettings.showTotalStatsTotalEncounters !== false) {
                    fallbackItems.push(`<div class="phase-info-item">Total Encounters: ${Number(maxEnc).toLocaleString()}</div>`);
                } else if (dashboardSettings.showTotalStatsTotalEncounters !== false) {
                    fallbackItems.push(`<div class="phase-info-item">Total Encounters: 0</div>`);
                }
                if (maxShinies != null && dashboardSettings.showTotalStatsShinyEncounters !== false) {
                    fallbackItems.push(`<div class="phase-info-item">Shiny Encounters: ${Number(maxShinies).toLocaleString()}</div>`);
                } else if (dashboardSettings.showTotalStatsShinyEncounters !== false) {
                    fallbackItems.push(`<div class="phase-info-item">Shiny Encounters: 0</div>`);
                }
                if (maxCatches != null && dashboardSettings.showTotalStatsCatches !== false) {
                    fallbackItems.push(`<div class="phase-info-item">Catches: ${Number(maxCatches).toLocaleString()}</div>`);
                } else if (dashboardSettings.showTotalStatsCatches !== false) {
                    fallbackItems.push(`<div class="phase-info-item">Catches: 0</div>`);
                }
                if (fallbackItems.length > 0) {
                    const botNameEsc = String(bot.name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                    totalStatsSectionHtml = `<div class="status-section">
                        <h4>Total Stats — ${botNameEsc}</h4>
                        <div class="phase-info">${fallbackItems.join('')}</div></div>`;
                }
            }
        }
        if (totalStatsSectionHtml) html += totalStatsSectionHtml;
    }

    if (!html) {
        html = '<p>No data available</p>';
    }

    // Preserve chart data before updating HTML (to prevent flashing)
    let preservedChartData = null;
    if (dashboardSettings.showEncounterRateAsGraph) {
        const existingCanvas = document.getElementById(`encounter-rate-chart-${bot.id}`);
        if (existingCanvas && existingCanvas.chart) {
            // Save chart data before destroying
            preservedChartData = {
                labels: [...existingCanvas.chart.data.labels],
                data: [...existingCanvas.chart.data.datasets[0].data]
            };
            existingCanvas.chart.destroy();
            existingCanvas.chart = null;
        }
    }

    // Only update the content, not the entire card
    const existingContent = card.querySelector('.status-card-content');
    if (existingContent) {
        existingContent.innerHTML = html;
        applyBotCardSectionOrder(existingContent);
    } else {
        content.innerHTML = html;
        applyBotCardSectionOrder(content);
    }
    initializeBotCardFoldableSections(card, bot.id);
    
    // If target Pokemon encounter count needs to be fetched, do it now (after DOM is updated)
    const targetPokemonForFetch = getBotTargetPokemon(bot.id);
    if (targetPokemonForFetch) {
        const statsForFetch = data.stats || {};
        let speciesEncountersFromStats = null;
        if (statsForFetch && statsForFetch.species) {
            const speciesData = statsForFetch.species[targetPokemonForFetch.speciesId] || 
                              statsForFetch.species[targetPokemonForFetch.speciesId.toString()] ||
                              statsForFetch.by_species?.[targetPokemonForFetch.speciesId] ||
                              statsForFetch.by_species?.[targetPokemonForFetch.speciesId.toString()];
            if (speciesData) {
                speciesEncountersFromStats = speciesData.encounters || 
                                  speciesData.total_encounters || 
                                  speciesData.count ||
                                  speciesData.total;
            }
        }
        if (speciesEncountersFromStats === null && statsForFetch && statsForFetch.totals) {
            const totalsBySpecies = statsForFetch.totals.by_species || statsForFetch.totals.species;
            if (totalsBySpecies) {
                const speciesData = totalsBySpecies[targetPokemonForFetch.speciesId] || 
                                  totalsBySpecies[targetPokemonForFetch.speciesId.toString()];
                if (speciesData) {
                    speciesEncountersFromStats = speciesData.encounters || 
                                      speciesData.total_encounters || 
                                      speciesData.count ||
                                      speciesData.total;
                }
            }
        }
        
        // If not found in stats, fetch from API asynchronously (non-blocking)
        if (speciesEncountersFromStats === null) {
            fetchSpeciesEncounterCount(bot, targetPokemonForFetch.speciesId).then(count => {
                if (count !== null && count !== undefined) {
                    const encountersEl = document.getElementById(`target-encounters-${bot.id}`);
                    if (encountersEl) {
                        encountersEl.textContent = count.toLocaleString();
                        encountersEl.style.display = 'block';
                    }
                }
            }).catch(err => {
                console.warn(`[${bot.name}] Failed to fetch species encounter count:`, err);
            });
        }
    }
    
    // Add event listeners for target Pokemon buttons
    const setTargetBtn = card.querySelector(`.set-target-btn[data-bot-id="${bot.id}"]`);
    const changeTargetBtn = card.querySelector(`.change-target-btn[data-bot-id="${bot.id}"]`);
    
    if (setTargetBtn) {
        setTargetBtn.addEventListener('click', () => showTargetPokemonSelector(bot.id));
    }
    if (changeTargetBtn) {
        changeTargetBtn.addEventListener('click', () => showTargetPokemonSelector(bot.id));
    }
    
    // Restore or create mini graph for this bot if enabled
    if (dashboardSettings.showEncounterRateAsGraph) {
        setTimeout(() => {
            const canvas = document.getElementById(`encounter-rate-chart-${bot.id}`);
            if (canvas) {
                const now = Date.now();
                const shouldUpdateData = now - lastGraphUpdate >= GRAPH_UPDATE_INTERVAL;
                
                if (shouldUpdateData) {
                    lastGraphUpdate = now;
                    // Create/update chart with fresh data
                    renderBotEncounterRateGraph(bot.id);
                } else if (preservedChartData) {
                    // Recreate chart with preserved data (no data refresh, prevents flashing)
                    recreateChartWithData(canvas, preservedChartData);
                } else {
                    // Create new chart
                    renderBotEncounterRateGraph(bot.id);
                }
            }
        }, 50);
    }
}

// Color palette for different bots
const botColors = [
    { border: 'rgb(75, 192, 192)', background: 'rgba(75, 192, 192, 0.2)' },
    { border: 'rgb(255, 99, 132)', background: 'rgba(255, 99, 132, 0.2)' },
    { border: 'rgb(54, 162, 235)', background: 'rgba(54, 162, 235, 0.2)' },
    { border: 'rgb(255, 206, 86)', background: 'rgba(255, 206, 86, 0.2)' },
    { border: 'rgb(153, 102, 255)', background: 'rgba(153, 102, 255, 0.2)' },
    { border: 'rgb(255, 159, 64)', background: 'rgba(255, 159, 64, 0.2)' },
    { border: 'rgb(199, 199, 199)', background: 'rgba(199, 199, 199, 0.2)' },
    { border: 'rgb(83, 102, 255)', background: 'rgba(83, 102, 255, 0.2)' },
    { border: 'rgb(255, 99, 255)', background: 'rgba(255, 99, 255, 0.2)' },
    { border: 'rgb(99, 255, 132)', background: 'rgba(99, 255, 132, 0.2)' }
];

// Update combined encounter rate display and graph
// Use live data only from in-memory liveEncounterRateHistory
function updateCombinedEncounterRate() {
    const combinedContainer = document.querySelector('.combined-encounter-rate');
    if (!combinedContainer) return;

    if (dashboardSettings.showCombinedEncounterRate === false) {
        combinedContainer.style.display = 'none';
        const canvas = document.getElementById('combinedEncounterRateChart');
        if (canvas && canvas.chart) {
            canvas.chart.destroy();
            canvas.chart = null;
        }
        const valueElement = document.getElementById('combinedEncounterRateValue');
        if (valueElement) {
            valueElement.textContent = '';
        }
        return;
    } else {
        combinedContainer.style.display = '';
    }

    // Calculate current combined rate from live bot data
    let combinedRate = 0;
    
    // Collect current encounter rates from all bots
    botInstances.forEach(bot => {
        const botData = botDataCache.get(bot.id);
        if (botData && botData.success && botData.data) {
            const encounterRate = botData.data.encounter_rate;
            if (encounterRate !== undefined && encounterRate !== null && typeof encounterRate === 'number' && encounterRate >= 0) {
                combinedRate += encounterRate;
            }
        }
    });
    
    console.log('[Combined Rate] Calculated from live data:', combinedRate, 'from', botInstances.length, 'bots');
    
    // Update the display value
    const valueElement = document.getElementById('combinedEncounterRateValue');
    if (valueElement) {
        valueElement.textContent = `${combinedRate}/hr`;
        console.log('[Combined Rate] Updated display to:', combinedRate);
    } else {
        console.warn('[Combined Rate] Value element not found!');
    }
    
    // Build combined history from live data only (in-memory)
    const allTimestamps = new Set();
    botInstances.forEach(bot => {
        const history = liveEncounterRateHistory.get(bot.id);
        if (history) {
            history.forEach(point => allTimestamps.add(point.time));
        }
    });
    
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
    
    // If no live data, show empty graph
    if (sortedTimestamps.length === 0) {
        const canvas = document.getElementById('combinedEncounterRateChart');
        if (canvas && canvas.chart) {
            canvas.chart.destroy();
            canvas.chart = null;
        }
        return;
    }
    
    // Build combined data by summing rates at each timestamp
    const combinedData = sortedTimestamps.map(timestamp => {
        let sum = 0;
        botInstances.forEach(bot => {
            const history = liveEncounterRateHistory.get(bot.id);
            if (history) {
                // Find closest point to this timestamp (within 2 seconds)
                let closestPoint = null;
                let minDiff = Infinity;
                history.forEach(point => {
                    const diff = Math.abs(point.time - timestamp);
                    if (diff < minDiff && diff < 2000) { // Within 2 seconds
                        minDiff = diff;
                        closestPoint = point;
                    }
                });
                if (closestPoint) {
                    sum += closestPoint.rate;
                }
            }
        });
        return sum;
    });
    
    const labels = sortedTimestamps.map(ts => {
        const date = new Date(ts);
        return date.toLocaleTimeString();
    });
    
    // Render the combined graph
    const canvas = document.getElementById('combinedEncounterRateChart');
    if (!canvas) {
        console.warn('[Combined Rate] Canvas element not found!');
        return;
    }
    if (typeof Chart === 'undefined') {
        console.warn('[Combined Rate] Chart.js not loaded!');
        return;
    }
    
    console.log('[Combined Rate] Rendering graph with', sortedTimestamps.length, 'live data points');
    
    // Destroy existing chart if it exists
    if (canvas.chart) {
        canvas.chart.destroy();
    }
    
    // Create combined chart with live data only
    canvas.chart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Combined Encounter Rate (Live)',
                data: combinedData,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.1,
                fill: true,
                pointRadius: 3,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y}/hr`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: false,
                        text: 'Encounters per Hour'
                    }
                },
                x: {
                    display: false,
                    title: {
                        display: false,
                        text: 'Time'
                    },
                    ticks: {
                        display: false
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Recreate chart with preserved data (for smooth updates without flashing)
function recreateChartWithData(canvas, chartData) {
    if (!canvas || typeof Chart === 'undefined') return;
    
    if (canvas.chart) {
        canvas.chart.destroy();
    }
    
    canvas.chart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Encounter Rate',
                data: chartData.data,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.1,
                fill: true,
                pointRadius: 2,
                pointHoverRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // No animation for smooth updates
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y}/hr`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        maxTicksLimit: 5
                    }
                },
                x: {
                    ticks: {
                        maxTicksLimit: 5
                    }
                }
            }
        }
    });
}

// Render mini encounter rate graph for a single bot
function renderBotEncounterRateGraph(botId) {
    const canvas = document.getElementById(`encounter-rate-chart-${botId}`);
    if (!canvas || typeof Chart === 'undefined') return;
    
    // Reload history
    encounterRateHistory = JSON.parse(localStorage.getItem('botEncounterRateHistory') || '{}');
    const history = encounterRateHistory[botId] || [];
    
    if (history.length === 0) {
        // No data yet, destroy chart if exists
        if (canvas.chart) {
            canvas.chart.destroy();
            canvas.chart = null;
        }
        return;
    }
    
    // Use all historical data points
    const labels = history.map(point => {
        const date = new Date(point.time);
        return date.toLocaleTimeString();
    });
    const data = history.map(point => point.rate);
    
    // Destroy existing chart if it exists
    if (canvas.chart) {
        canvas.chart.destroy();
    }
    
    // Create mini chart
    canvas.chart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Encounter Rate',
                data: data,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.1,
                fill: true,
                pointRadius: 2,
                pointHoverRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y}/hr`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        maxTicksLimit: 5
                    }
                },
                x: {
                    ticks: {
                        maxTicksLimit: 5
                    }
                }
            }
        }
    });
}

// Setup Options Modal
function setupOptionsModal() {
    if (!optionsBtn || !optionsModal) return;
    let draggedSectionItem = null;
    const botAccentColorPicker = document.getElementById('botAccentColorPicker');
    const botAccentColorText = document.getElementById('botAccentColorText');
    
    // Open options modal
    optionsBtn.addEventListener('click', () => {
        // Sync checkboxes with current settings
        updateOptionsModalCheckboxes();
        renderSectionOrderControls();
        optionsModal.classList.remove('hidden');
    });
    
    // Close options modal
    if (closeOptionsModal) {
        closeOptionsModal.addEventListener('click', () => {
            optionsModal.classList.add('hidden');
        });
    }
    
    if (cancelOptionsBtn) {
        cancelOptionsBtn.addEventListener('click', () => {
            optionsModal.classList.add('hidden');
        });
    }
    
    // Save options
    if (saveOptionsBtn) {
        saveOptionsBtn.addEventListener('click', () => {
            saveOptionsFromModal();
            optionsModal.classList.add('hidden');
        });
    }
    
    // Close on outside click
    optionsModal.addEventListener('click', (e) => {
        if (e.target === optionsModal) {
            optionsModal.classList.add('hidden');
        }
    });

    if (botAccentColorPicker && botAccentColorText) {
        botAccentColorPicker.addEventListener('input', (e) => {
            botAccentColorText.value = e.target.value;
        });

        botAccentColorText.addEventListener('input', (e) => {
            const color = normalizeHexColor(e.target.value);
            if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value || '')) {
                botAccentColorPicker.value = color;
            }
        });
    }

    const botSectionOrderList = document.getElementById('botSectionOrderList');
    if (botSectionOrderList) {
        botSectionOrderList.addEventListener('dragstart', (e) => {
            const item = e.target.closest('.section-order-item');
            if (!item) return;
            draggedSectionItem = item;
            item.classList.add('dragging');
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', item.dataset.sectionKey || '');
            }
        });

        botSectionOrderList.addEventListener('dragend', () => {
            if (draggedSectionItem) {
                draggedSectionItem.classList.remove('dragging');
                draggedSectionItem = null;
            }
            dashboardSettings.sectionOrder = normalizeBotCardSectionOrder(
                Array.from(botSectionOrderList.querySelectorAll('.section-order-item')).map(el => el.dataset.sectionKey)
            );
        });

        botSectionOrderList.addEventListener('dragover', (e) => {
            if (!draggedSectionItem) return;
            e.preventDefault();
            const items = Array.from(botSectionOrderList.querySelectorAll('.section-order-item:not(.dragging)'));
            const target = items.find(item => {
                const rect = item.getBoundingClientRect();
                return e.clientY < rect.top + rect.height / 2;
            });
            if (target) {
                botSectionOrderList.insertBefore(draggedSectionItem, target);
            } else {
                botSectionOrderList.appendChild(draggedSectionItem);
            }
        });

        botSectionOrderList.addEventListener('drop', (e) => {
            if (!draggedSectionItem) return;
            e.preventDefault();
            dashboardSettings.sectionOrder = normalizeBotCardSectionOrder(
                Array.from(botSectionOrderList.querySelectorAll('.section-order-item')).map(el => el.dataset.sectionKey)
            );
        });
    }
}

// Update options modal checkboxes to match current settings
function updateOptionsModalCheckboxes() {
    const optShowEncounterRateSection = document.getElementById('optShowEncounterRateSection');
    const optShowTargetPokemonSection = document.getElementById('optShowTargetPokemonSection');
    const optShowMap = document.getElementById('optShowMap');
    const optShowParty = document.getElementById('optShowParty');
    const optShowCurrentEncounter = document.getElementById('optShowCurrentEncounter');
    const optShowEncounters = document.getElementById('optShowEncounters');
    const optShowStats = document.getElementById('optShowStats');
    const optShowEmulator = document.getElementById('optShowEmulator');
    const optShowGameState = document.getElementById('optShowGameState');
    const optShowPlayerInfo = document.getElementById('optShowPlayerInfo');
    const optShowTotalStats = document.getElementById('optShowTotalStats');
    const optShowLogo = document.getElementById('optShowLogo');
    const optShowEncounterRateAsGraph = document.getElementById('optShowEncounterRateAsGraph');
    const optShowCombinedEncounterRate = document.getElementById('optShowCombinedEncounterRate');
    const botAccentColorPicker = document.getElementById('botAccentColorPicker');
    const botAccentColorText = document.getElementById('botAccentColorText');
    
    // Statistics toggles
    const optShowStatsTotalEncounters = document.getElementById('optShowStatsTotalEncounters');
    const optShowStatsShinyEncounters = document.getElementById('optShowStatsShinyEncounters');
    const optShowStatsPlayTime = document.getElementById('optShowStatsPlayTime');
    // Current Phase toggles
    const optShowPhaseCurrentStreak = document.getElementById('optShowPhaseCurrentStreak');
    const optShowPhaseEncounters = document.getElementById('optShowPhaseEncounters');
    const optShowPhaseDuration = document.getElementById('optShowPhaseDuration');
    const optShowPhaseBestIV = document.getElementById('optShowPhaseBestIV');
    const optShowPhaseLongest = document.getElementById('optShowPhaseLongest');
    const optShowPhasePokenav = document.getElementById('optShowPhasePokenav');
    // Current Encounter toggles
    const optShowEncounterSprite = document.getElementById('optShowEncounterSprite');
    const optShowEncounterName = document.getElementById('optShowEncounterName');
    const optShowEncounterLevel = document.getElementById('optShowEncounterLevel');
    const optShowEncounterShiny = document.getElementById('optShowEncounterShiny');
    const optShowEncounterNature = document.getElementById('optShowEncounterNature');
    const optShowEncounterAbility = document.getElementById('optShowEncounterAbility');
    const optShowEncounterIVSum = document.getElementById('optShowEncounterIVSum');
    const optShowEncounterIVs = document.getElementById('optShowEncounterIVs');
    // Emulator Info toggles
    const optShowEmulatorFrameRate = document.getElementById('optShowEmulatorFrameRate');
    const optShowEmulatorFastForward = document.getElementById('optShowEmulatorFastForward');
    const optShowEmulatorPaused = document.getElementById('optShowEmulatorPaused');
    const optShowEmulatorUptime = document.getElementById('optShowEmulatorUptime');
    // Game toggles
    const optShowGameBadges = document.getElementById('optShowGameBadges');
    const optShowGameName = document.getElementById('optShowGameName');
    const optShowGameLanguage = document.getElementById('optShowGameLanguage');
    const optShowGameRevision = document.getElementById('optShowGameRevision');
    const optShowGameMapID = document.getElementById('optShowGameMapID');
    const optShowGamePosition = document.getElementById('optShowGamePosition');
    const optShowGameSteps = document.getElementById('optShowGameSteps');
    const optShowGameTimePlayed = document.getElementById('optShowGameTimePlayed');
    // Player Info toggles
    const optShowPlayerName = document.getElementById('optShowPlayerName');
    const optShowPlayerTID = document.getElementById('optShowPlayerTID');
    const optShowPlayerSID = document.getElementById('optShowPlayerSID');
    const optShowPlayerGender = document.getElementById('optShowPlayerGender');
    const optShowPlayerPlayTime = document.getElementById('optShowPlayerPlayTime');
    const optShowPlayerID32 = document.getElementById('optShowPlayerID32');
    // Total Stats toggles
    const optShowTotalStatsTotalEncounters = document.getElementById('optShowTotalStatsTotalEncounters');
    const optShowTotalStatsShinyEncounters = document.getElementById('optShowTotalStatsShinyEncounters');
    const optShowTotalStatsCatches = document.getElementById('optShowTotalStatsCatches');
    const optShowTotalStatsHighestIV = document.getElementById('optShowTotalStatsHighestIV');
    const optShowTotalStatsLowestIV = document.getElementById('optShowTotalStatsLowestIV');
    const optShowTotalStatsHighestSV = document.getElementById('optShowTotalStatsHighestSV');
    const optShowTotalStatsLowestSV = document.getElementById('optShowTotalStatsLowestSV');
    
    if (optShowEncounterRateSection) optShowEncounterRateSection.checked = dashboardSettings.showEncounterRateSection !== false;
    if (optShowTargetPokemonSection) optShowTargetPokemonSection.checked = dashboardSettings.showTargetPokemonSection !== false;
    if (optShowControls) optShowControls.checked = dashboardSettings.showControls !== false;
    if (optShowMap) optShowMap.checked = dashboardSettings.showMap !== false;
    if (optShowParty) optShowParty.checked = dashboardSettings.showParty !== false;
    if (optShowCurrentEncounter) optShowCurrentEncounter.checked = dashboardSettings.showCurrentEncounter !== false;
    if (optShowEncounters) optShowEncounters.checked = dashboardSettings.showEncounters !== false;
    if (optShowStats) optShowStats.checked = dashboardSettings.showStats !== false;
    if (optShowEmulator) optShowEmulator.checked = dashboardSettings.showEmulator || false;
    if (optShowGameState) optShowGameState.checked = dashboardSettings.showGameState || false;
    if (optShowPlayerInfo) optShowPlayerInfo.checked = dashboardSettings.showPlayerInfo || false;
    if (optShowTotalStats) optShowTotalStats.checked = dashboardSettings.showTotalStats || false;
    if (optShowLogo) optShowLogo.checked = dashboardSettings.showLogo !== false;
    if (optShowEncounterRateAsGraph) optShowEncounterRateAsGraph.checked = dashboardSettings.showEncounterRateAsGraph || false;
    if (optShowCombinedEncounterRate) optShowCombinedEncounterRate.checked = dashboardSettings.showCombinedEncounterRate !== false;
    if (botAccentColorPicker) botAccentColorPicker.value = normalizeHexColor(dashboardSettings.accentColor);
    if (botAccentColorText) botAccentColorText.value = normalizeHexColor(dashboardSettings.accentColor);
    
    // Statistics toggles
    if (optShowStatsTotalEncounters) optShowStatsTotalEncounters.checked = dashboardSettings.showStatsTotalEncounters !== false;
    if (optShowStatsShinyEncounters) optShowStatsShinyEncounters.checked = dashboardSettings.showStatsShinyEncounters !== false;
    if (optShowStatsPlayTime) optShowStatsPlayTime.checked = dashboardSettings.showStatsPlayTime !== false;
    // Current Phase toggles
    if (optShowPhaseCurrentStreak) optShowPhaseCurrentStreak.checked = dashboardSettings.showPhaseCurrentStreak !== false;
    if (optShowPhaseEncounters) optShowPhaseEncounters.checked = dashboardSettings.showPhaseEncounters !== false;
    if (optShowPhaseDuration) optShowPhaseDuration.checked = dashboardSettings.showPhaseDuration !== false;
    if (optShowPhaseBestIV) optShowPhaseBestIV.checked = dashboardSettings.showPhaseBestIV !== false;
    if (optShowPhaseLongest) optShowPhaseLongest.checked = dashboardSettings.showPhaseLongest !== false;
    if (optShowPhasePokenav) optShowPhasePokenav.checked = dashboardSettings.showPhasePokenav !== false;
    // Current Encounter toggles
    if (optShowEncounterSprite) optShowEncounterSprite.checked = dashboardSettings.showEncounterSprite !== false;
    if (optShowEncounterName) optShowEncounterName.checked = dashboardSettings.showEncounterName !== false;
    if (optShowEncounterLevel) optShowEncounterLevel.checked = dashboardSettings.showEncounterLevel !== false;
    if (optShowEncounterShiny) optShowEncounterShiny.checked = dashboardSettings.showEncounterShiny !== false;
    if (optShowEncounterNature) optShowEncounterNature.checked = dashboardSettings.showEncounterNature !== false;
    if (optShowEncounterAbility) optShowEncounterAbility.checked = dashboardSettings.showEncounterAbility !== false;
    if (optShowEncounterIVSum) optShowEncounterIVSum.checked = dashboardSettings.showEncounterIVSum !== false;
    if (optShowEncounterIVs) optShowEncounterIVs.checked = dashboardSettings.showEncounterIVs !== false;
    // Emulator Info toggles
    if (optShowEmulatorFrameRate) optShowEmulatorFrameRate.checked = dashboardSettings.showEmulatorFrameRate !== false;
    if (optShowEmulatorFastForward) optShowEmulatorFastForward.checked = dashboardSettings.showEmulatorFastForward !== false;
    if (optShowEmulatorPaused) optShowEmulatorPaused.checked = dashboardSettings.showEmulatorPaused !== false;
    if (optShowEmulatorUptime) optShowEmulatorUptime.checked = dashboardSettings.showEmulatorUptime !== false;
    // Game toggles
    if (optShowGameBadges) optShowGameBadges.checked = dashboardSettings.showGameBadges !== false;
    if (optShowGameName) optShowGameName.checked = dashboardSettings.showGameName !== false;
    if (optShowGameLanguage) optShowGameLanguage.checked = dashboardSettings.showGameLanguage !== false;
    if (optShowGameRevision) optShowGameRevision.checked = dashboardSettings.showGameRevision !== false;
    if (optShowGameMapID) optShowGameMapID.checked = dashboardSettings.showGameMapID !== false;
    if (optShowGamePosition) optShowGamePosition.checked = dashboardSettings.showGamePosition !== false;
    if (optShowGameSteps) optShowGameSteps.checked = dashboardSettings.showGameSteps !== false;
    if (optShowGameTimePlayed) optShowGameTimePlayed.checked = dashboardSettings.showGameTimePlayed !== false;
    // Player Info toggles
    if (optShowPlayerName) optShowPlayerName.checked = dashboardSettings.showPlayerName !== false;
    if (optShowPlayerTID) optShowPlayerTID.checked = dashboardSettings.showPlayerTID !== false;
    if (optShowPlayerSID) optShowPlayerSID.checked = dashboardSettings.showPlayerSID !== false;
    if (optShowPlayerGender) optShowPlayerGender.checked = dashboardSettings.showPlayerGender !== false;
    if (optShowPlayerPlayTime) optShowPlayerPlayTime.checked = dashboardSettings.showPlayerPlayTime !== false;
    if (optShowPlayerID32) optShowPlayerID32.checked = dashboardSettings.showPlayerID32 !== false;
    // Total Stats toggles
    if (optShowTotalStatsTotalEncounters) optShowTotalStatsTotalEncounters.checked = dashboardSettings.showTotalStatsTotalEncounters !== false;
    if (optShowTotalStatsShinyEncounters) optShowTotalStatsShinyEncounters.checked = dashboardSettings.showTotalStatsShinyEncounters !== false;
    if (optShowTotalStatsCatches) optShowTotalStatsCatches.checked = dashboardSettings.showTotalStatsCatches !== false;
    if (optShowTotalStatsHighestIV) optShowTotalStatsHighestIV.checked = dashboardSettings.showTotalStatsHighestIV !== false;
    if (optShowTotalStatsLowestIV) optShowTotalStatsLowestIV.checked = dashboardSettings.showTotalStatsLowestIV !== false;
    if (optShowTotalStatsHighestSV) optShowTotalStatsHighestSV.checked = dashboardSettings.showTotalStatsHighestSV !== false;
    if (optShowTotalStatsLowestSV) optShowTotalStatsLowestSV.checked = dashboardSettings.showTotalStatsLowestSV !== false;
    renderSectionOrderControls();
}

// Save options from modal to dashboard settings
function saveOptionsFromModal() {
    const optShowControls = document.getElementById('optShowControls');
    const optShowEncounterRateSection = document.getElementById('optShowEncounterRateSection');
    const optShowTargetPokemonSection = document.getElementById('optShowTargetPokemonSection');
    const optShowMap = document.getElementById('optShowMap');
    const optShowParty = document.getElementById('optShowParty');
    const optShowCurrentEncounter = document.getElementById('optShowCurrentEncounter');
    const optShowEncounters = document.getElementById('optShowEncounters');
    const optShowStats = document.getElementById('optShowStats');
    const optShowEmulator = document.getElementById('optShowEmulator');
    const optShowGameState = document.getElementById('optShowGameState');
    const optShowPlayerInfo = document.getElementById('optShowPlayerInfo');
    const optShowTotalStats = document.getElementById('optShowTotalStats');
    const optShowLogo = document.getElementById('optShowLogo');
    const optShowEncounterRateAsGraph = document.getElementById('optShowEncounterRateAsGraph');
    const optShowCombinedEncounterRate = document.getElementById('optShowCombinedEncounterRate');
    const botAccentColorPicker = document.getElementById('botAccentColorPicker');
    const botAccentColorText = document.getElementById('botAccentColorText');
    
    // Statistics toggles
    const optShowStatsTotalEncounters = document.getElementById('optShowStatsTotalEncounters');
    const optShowStatsShinyEncounters = document.getElementById('optShowStatsShinyEncounters');
    const optShowStatsPlayTime = document.getElementById('optShowStatsPlayTime');
    // Current Phase toggles
    const optShowPhaseCurrentStreak = document.getElementById('optShowPhaseCurrentStreak');
    const optShowPhaseEncounters = document.getElementById('optShowPhaseEncounters');
    const optShowPhaseDuration = document.getElementById('optShowPhaseDuration');
    const optShowPhaseBestIV = document.getElementById('optShowPhaseBestIV');
    const optShowPhaseLongest = document.getElementById('optShowPhaseLongest');
    const optShowPhasePokenav = document.getElementById('optShowPhasePokenav');
    // Current Encounter toggles
    const optShowEncounterSprite = document.getElementById('optShowEncounterSprite');
    const optShowEncounterName = document.getElementById('optShowEncounterName');
    const optShowEncounterLevel = document.getElementById('optShowEncounterLevel');
    const optShowEncounterShiny = document.getElementById('optShowEncounterShiny');
    const optShowEncounterNature = document.getElementById('optShowEncounterNature');
    const optShowEncounterAbility = document.getElementById('optShowEncounterAbility');
    const optShowEncounterIVSum = document.getElementById('optShowEncounterIVSum');
    const optShowEncounterIVs = document.getElementById('optShowEncounterIVs');
    // Emulator Info toggles
    const optShowEmulatorFrameRate = document.getElementById('optShowEmulatorFrameRate');
    const optShowEmulatorFastForward = document.getElementById('optShowEmulatorFastForward');
    const optShowEmulatorPaused = document.getElementById('optShowEmulatorPaused');
    const optShowEmulatorUptime = document.getElementById('optShowEmulatorUptime');
    // Game toggles
    const optShowGameBadges = document.getElementById('optShowGameBadges');
    const optShowGameName = document.getElementById('optShowGameName');
    const optShowGameLanguage = document.getElementById('optShowGameLanguage');
    const optShowGameRevision = document.getElementById('optShowGameRevision');
    const optShowGameMapID = document.getElementById('optShowGameMapID');
    const optShowGamePosition = document.getElementById('optShowGamePosition');
    const optShowGameSteps = document.getElementById('optShowGameSteps');
    const optShowGameTimePlayed = document.getElementById('optShowGameTimePlayed');
    // Player Info toggles
    const optShowPlayerName = document.getElementById('optShowPlayerName');
    const optShowPlayerTID = document.getElementById('optShowPlayerTID');
    const optShowPlayerSID = document.getElementById('optShowPlayerSID');
    const optShowPlayerGender = document.getElementById('optShowPlayerGender');
    const optShowPlayerPlayTime = document.getElementById('optShowPlayerPlayTime');
    const optShowPlayerID32 = document.getElementById('optShowPlayerID32');
    // Total Stats toggles
    const optShowTotalStatsTotalEncounters = document.getElementById('optShowTotalStatsTotalEncounters');
    const optShowTotalStatsShinyEncounters = document.getElementById('optShowTotalStatsShinyEncounters');
    const optShowTotalStatsCatches = document.getElementById('optShowTotalStatsCatches');
    const optShowTotalStatsHighestIV = document.getElementById('optShowTotalStatsHighestIV');
    const optShowTotalStatsLowestIV = document.getElementById('optShowTotalStatsLowestIV');
    const optShowTotalStatsHighestSV = document.getElementById('optShowTotalStatsHighestSV');
    const optShowTotalStatsLowestSV = document.getElementById('optShowTotalStatsLowestSV');
    const botSectionOrderList = document.getElementById('botSectionOrderList');
    
    // Update dashboard settings
    if (optShowControls) dashboardSettings.showControls = optShowControls.checked;
    if (optShowEncounterRateSection) dashboardSettings.showEncounterRateSection = optShowEncounterRateSection.checked;
    if (optShowTargetPokemonSection) dashboardSettings.showTargetPokemonSection = optShowTargetPokemonSection.checked;
    if (optShowMap) dashboardSettings.showMap = optShowMap.checked;
    if (optShowParty) dashboardSettings.showParty = optShowParty.checked;
    if (optShowCurrentEncounter) dashboardSettings.showCurrentEncounter = optShowCurrentEncounter.checked;
    if (optShowEncounters) dashboardSettings.showEncounters = optShowEncounters.checked;
    if (optShowStats) dashboardSettings.showStats = optShowStats.checked;
    if (optShowEmulator) dashboardSettings.showEmulator = optShowEmulator.checked;
    if (optShowGameState) dashboardSettings.showGameState = optShowGameState.checked;
    if (optShowPlayerInfo) dashboardSettings.showPlayerInfo = optShowPlayerInfo.checked;
    if (optShowTotalStats) dashboardSettings.showTotalStats = optShowTotalStats.checked;
    if (optShowLogo) dashboardSettings.showLogo = optShowLogo.checked;
    if (optShowEncounterRateAsGraph) dashboardSettings.showEncounterRateAsGraph = optShowEncounterRateAsGraph.checked;
    if (optShowCombinedEncounterRate) dashboardSettings.showCombinedEncounterRate = optShowCombinedEncounterRate.checked;
    dashboardSettings.accentColor = normalizeHexColor(
        botAccentColorText ? botAccentColorText.value : botAccentColorPicker ? botAccentColorPicker.value : dashboardSettings.accentColor
    );
    
    // Statistics toggles
    if (optShowStatsTotalEncounters) dashboardSettings.showStatsTotalEncounters = optShowStatsTotalEncounters.checked;
    if (optShowStatsShinyEncounters) dashboardSettings.showStatsShinyEncounters = optShowStatsShinyEncounters.checked;
    if (optShowStatsPlayTime) dashboardSettings.showStatsPlayTime = optShowStatsPlayTime.checked;
    // Current Phase toggles
    if (optShowPhaseCurrentStreak) dashboardSettings.showPhaseCurrentStreak = optShowPhaseCurrentStreak.checked;
    if (optShowPhaseEncounters) dashboardSettings.showPhaseEncounters = optShowPhaseEncounters.checked;
    if (optShowPhaseDuration) dashboardSettings.showPhaseDuration = optShowPhaseDuration.checked;
    if (optShowPhaseBestIV) dashboardSettings.showPhaseBestIV = optShowPhaseBestIV.checked;
    if (optShowPhaseLongest) dashboardSettings.showPhaseLongest = optShowPhaseLongest.checked;
    if (optShowPhasePokenav) dashboardSettings.showPhasePokenav = optShowPhasePokenav.checked;
    // Current Encounter toggles
    if (optShowEncounterSprite) dashboardSettings.showEncounterSprite = optShowEncounterSprite.checked;
    if (optShowEncounterName) dashboardSettings.showEncounterName = optShowEncounterName.checked;
    if (optShowEncounterLevel) dashboardSettings.showEncounterLevel = optShowEncounterLevel.checked;
    if (optShowEncounterShiny) dashboardSettings.showEncounterShiny = optShowEncounterShiny.checked;
    if (optShowEncounterNature) dashboardSettings.showEncounterNature = optShowEncounterNature.checked;
    if (optShowEncounterAbility) dashboardSettings.showEncounterAbility = optShowEncounterAbility.checked;
    if (optShowEncounterIVSum) dashboardSettings.showEncounterIVSum = optShowEncounterIVSum.checked;
    if (optShowEncounterIVs) dashboardSettings.showEncounterIVs = optShowEncounterIVs.checked;
    // Emulator Info toggles
    if (optShowEmulatorFrameRate) dashboardSettings.showEmulatorFrameRate = optShowEmulatorFrameRate.checked;
    if (optShowEmulatorFastForward) dashboardSettings.showEmulatorFastForward = optShowEmulatorFastForward.checked;
    if (optShowEmulatorPaused) dashboardSettings.showEmulatorPaused = optShowEmulatorPaused.checked;
    if (optShowEmulatorUptime) dashboardSettings.showEmulatorUptime = optShowEmulatorUptime.checked;
    // Game toggles
    if (optShowGameBadges) dashboardSettings.showGameBadges = optShowGameBadges.checked;
    if (optShowGameName) dashboardSettings.showGameName = optShowGameName.checked;
    if (optShowGameLanguage) dashboardSettings.showGameLanguage = optShowGameLanguage.checked;
    if (optShowGameRevision) dashboardSettings.showGameRevision = optShowGameRevision.checked;
    if (optShowGameMapID) dashboardSettings.showGameMapID = optShowGameMapID.checked;
    if (optShowGamePosition) dashboardSettings.showGamePosition = optShowGamePosition.checked;
    if (optShowGameSteps) dashboardSettings.showGameSteps = optShowGameSteps.checked;
    if (optShowGameTimePlayed) dashboardSettings.showGameTimePlayed = optShowGameTimePlayed.checked;
    // Player Info toggles
    if (optShowPlayerName) dashboardSettings.showPlayerName = optShowPlayerName.checked;
    if (optShowPlayerTID) dashboardSettings.showPlayerTID = optShowPlayerTID.checked;
    if (optShowPlayerSID) dashboardSettings.showPlayerSID = optShowPlayerSID.checked;
    if (optShowPlayerGender) dashboardSettings.showPlayerGender = optShowPlayerGender.checked;
    if (optShowPlayerPlayTime) dashboardSettings.showPlayerPlayTime = optShowPlayerPlayTime.checked;
    if (optShowPlayerID32) dashboardSettings.showPlayerID32 = optShowPlayerID32.checked;
    // Total Stats toggles
    if (optShowTotalStatsTotalEncounters) dashboardSettings.showTotalStatsTotalEncounters = optShowTotalStatsTotalEncounters.checked;
    if (optShowTotalStatsShinyEncounters) dashboardSettings.showTotalStatsShinyEncounters = optShowTotalStatsShinyEncounters.checked;
    if (optShowTotalStatsCatches) dashboardSettings.showTotalStatsCatches = optShowTotalStatsCatches.checked;
    if (optShowTotalStatsHighestIV) dashboardSettings.showTotalStatsHighestIV = optShowTotalStatsHighestIV.checked;
    if (optShowTotalStatsLowestIV) dashboardSettings.showTotalStatsLowestIV = optShowTotalStatsLowestIV.checked;
    if (optShowTotalStatsHighestSV) dashboardSettings.showTotalStatsHighestSV = optShowTotalStatsHighestSV.checked;
    if (optShowTotalStatsLowestSV) dashboardSettings.showTotalStatsLowestSV = optShowTotalStatsLowestSV.checked;
    if (botSectionOrderList) {
        dashboardSettings.sectionOrder = normalizeBotCardSectionOrder(
            Array.from(botSectionOrderList.querySelectorAll('.section-order-item')).map(el => el.dataset.sectionKey)
        );
    }
    
    // Save to localStorage
    saveDashboardSettings();
    applyBotAccentColor(dashboardSettings.accentColor);
    applyBotLogoVisibility(dashboardSettings.showLogo !== false);
    
    // Update main dashboard checkboxes to match
    if (showControls) showControls.checked = dashboardSettings.showControls;
    if (showEncounterRateSectionEl) showEncounterRateSectionEl.checked = dashboardSettings.showEncounterRateSection;
    if (showTargetPokemonSectionEl) showTargetPokemonSectionEl.checked = dashboardSettings.showTargetPokemonSection;
    if (showMap) showMap.checked = dashboardSettings.showMap;
    if (showParty) showParty.checked = dashboardSettings.showParty;
    if (showCurrentEncounter) showCurrentEncounter.checked = dashboardSettings.showCurrentEncounter;
    if (showEncounters) showEncounters.checked = dashboardSettings.showEncounters;
    if (showStats) showStats.checked = dashboardSettings.showStats;
    if (showEmulator) showEmulator.checked = dashboardSettings.showEmulator;
    if (showGameState) showGameState.checked = dashboardSettings.showGameState;
    if (showPlayerInfo) showPlayerInfo.checked = dashboardSettings.showPlayerInfo;
    if (showTotalStats) showTotalStats.checked = dashboardSettings.showTotalStats;
    if (showEncounterRateAsGraph) showEncounterRateAsGraph.checked = dashboardSettings.showEncounterRateAsGraph;
    
    applyDashboardSectionVisibility();
    // Refresh all bot cards
    refreshAllBotCards();
}

// Setup Pokemon info modal
function setupPokemonInfoModal() {
    const pokemonInfoModal = document.getElementById('pokemonInfoModal');
    const closePokemonInfoModal = document.getElementById('closePokemonInfoModal');
    
    if (closePokemonInfoModal && pokemonInfoModal) {
        closePokemonInfoModal.addEventListener('click', () => {
            pokemonInfoModal.classList.add('hidden');
        });
    }
    
    if (pokemonInfoModal) {
        pokemonInfoModal.addEventListener('click', (e) => {
            if (e.target === pokemonInfoModal) {
                pokemonInfoModal.classList.add('hidden');
            }
        });
    }
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && pokemonInfoModal && !pokemonInfoModal.classList.contains('hidden')) {
            pokemonInfoModal.classList.add('hidden');
        }
    });
    
    // Delegate click events for encounter items (since they're dynamically created)
    document.addEventListener('click', (e) => {
        const encounterItem = e.target.closest('.clickable-encounter');
        if (encounterItem) {
            const speciesId = parseInt(encounterItem.dataset.speciesId);
            const encounterData = encounterItem.dataset.encounter;
            
            if (encounterData) {
                // Parse encounter data and show actual stats
                try {
                    const encounter = JSON.parse(encounterData);
                    showEncounterStats(speciesId, encounter).catch(error => console.error('Error showing encounter stats:', error));
                } catch (err) {
                    console.error('Error parsing encounter data:', err);
                    // Fallback to Pokedex info
                    if (speciesId > 0) {
                        showPokemonInfo(speciesId).catch(error => console.error('Error showing Pokemon info:', error));
                    }
                }
            } else if (speciesId > 0) {
                // Fallback to Pokedex info if no encounter data
                showPokemonInfo(speciesId).catch(err => console.error('Error showing Pokemon info:', err));
            }
        }
    });
}

// Show encounter stats (actual Pokemon data from encounter)
async function showEncounterStats(speciesId, encounter) {
    const modal = document.getElementById('pokemonInfoModal');
    const content = document.getElementById('pokemonInfoContent');
    const title = document.getElementById('pokemonInfoTitle');
    
    if (!modal || !content) return;
    
    // Show modal with loading state
    modal.classList.remove('hidden');
    content.innerHTML = '<div class="loading">Loading encounter details...</div>';
    
    try {
        // Extract Pokemon data from encounter
        let pokemonData = null;
        
        // Handle different encounter formats
        if (encounter.pokemon) {
            pokemonData = encounter.pokemon;
        } else if (encounter.species) {
            // Build pokemon data from encounter
            pokemonData = {
                species: encounter.species.id || encounter.species.national_dex_number || speciesId,
                level: encounter.level || encounter.pokemon?.level || 0,
                isShiny: encounter.is_shiny || encounter.isShiny || encounter.pokemon?.is_shiny || encounter.pokemon?.isShiny || false,
                ivs: encounter.ivs || encounter.iv || encounter.pokemon?.ivs || encounter.pokemon?.iv || {},
                nature: encounter.nature || encounter.nature_name || encounter.pokemon?.nature || encounter.pokemon?.nature_name || null,
                ability: encounter.ability || encounter.ability_name || encounter.ability_slot || encounter.pokemon?.ability || encounter.pokemon?.ability_name || null,
                moves: encounter.moves || encounter.pokemon?.moves || [],
                gender: encounter.gender || encounter.pokemon?.gender || '',
                hp: encounter.hp || encounter.current_hp || encounter.pokemon?.hp || encounter.pokemon?.current_hp || 0,
                maxHP: encounter.max_hp || encounter.maxHP || encounter.pokemon?.max_hp || encounter.pokemon?.maxHP || 0
            };
        } else {
            // Direct format - merge all available data
            pokemonData = {
                ...encounter,
                species: encounter.species || encounter.id || encounter.national_dex_number || speciesId,
                level: encounter.level || 0,
                isShiny: encounter.is_shiny || encounter.isShiny || false,
                ivs: encounter.ivs || encounter.iv || {},
                nature: encounter.nature || encounter.nature_name || null,
                ability: encounter.ability || encounter.ability_name || encounter.ability_slot || null,
                moves: encounter.moves || [],
                gender: encounter.gender || '',
                hp: encounter.hp || encounter.current_hp || 0,
                maxHP: encounter.max_hp || encounter.maxHP || 0
            };
        }
        
        // Get species name
        const speciesName = await getSpeciesName(speciesId);
        title.textContent = `${speciesName} - Encounter Details`;
        
        // Display the encounter stats
        content.innerHTML = formatEncounterStats(pokemonData, speciesId, speciesName);
        
        // Setup shiny toggle
        setTimeout(() => {
            const shinyToggle = document.getElementById('pokemonInfoShinyToggle');
            const spriteImg = document.getElementById('pokemonInfoSprite');
            if (shinyToggle && spriteImg) {
                let isShiny = pokemonData.isShiny || pokemonData.is_shiny || false;
                shinyToggle.addEventListener('click', () => {
                    isShiny = !isShiny;
                    const imgSpeciesId = parseInt(spriteImg.dataset.speciesId);
                    if (imgSpeciesId) {
                        spriteImg.src = getSpriteUrl(imgSpeciesId, isShiny);
                    }
                });
            }
        }, 100);
    } catch (error) {
        console.error('Error loading encounter stats:', error);
        content.innerHTML = `<div class="error">Error loading encounter details: ${error.message}</div>`;
    }
}

// Format encounter stats for display
function formatEncounterStats(pokemonData, speciesId, speciesName) {
    const level = pokemonData.level || 0;
    const isShiny = pokemonData.isShiny || pokemonData.is_shiny || false;
    
    // Extract IVs - handle different formats
    let ivs = {};
    if (pokemonData.ivs) {
        ivs = pokemonData.ivs;
    } else if (pokemonData.iv) {
        ivs = pokemonData.iv;
    } else {
        // Try to extract individual IV fields
        ivs = {
            hp: pokemonData.iv_hp || pokemonData.ivHP || pokemonData.hp_iv || 0,
            attack: pokemonData.iv_attack || pokemonData.ivAttack || pokemonData.attack_iv || 0,
            defense: pokemonData.iv_defense || pokemonData.ivDefense || pokemonData.defense_iv || 0,
            spAttack: pokemonData.iv_sp_attack || pokemonData.ivSpAttack || pokemonData.sp_attack_iv || pokemonData.spAttack_iv || 0,
            spDefense: pokemonData.iv_sp_defense || pokemonData.ivSpDefense || pokemonData.sp_defense_iv || pokemonData.spDefense_iv || 0,
            speed: pokemonData.iv_speed || pokemonData.ivSpeed || pokemonData.speed_iv || 0
        };
    }
    
    // Extract nature - handle both string and object formats
    let nature = formatNatureValue(pokemonData.nature || pokemonData.nature_name) || 'Unknown';
    
    // Extract ability - handle both string and object formats
    let ability = formatAbilityValue(
        pokemonData.ability,
        pokemonData.ability_name,
        pokemonData.ability_slot
    ) || 'Unknown';
    
    // Extract moves - handle different formats
    let moves = [];
    if (pokemonData.moves && Array.isArray(pokemonData.moves)) {
        moves = pokemonData.moves.map(move => {
            if (typeof move === 'string') {
                return move;
            } else if (typeof move === 'object' && move !== null) {
                return move.name || move.move || move.move_name || move.moveName || 
                       (move.id ? `Move #${move.id}` : 'Unknown Move');
            } else if (typeof move === 'number') {
                return `Move #${move}`;
            }
            return 'Unknown Move';
        });
    } else if (pokemonData.move1 || pokemonData.move2 || pokemonData.move3 || pokemonData.move4) {
        // Handle individual move fields
        if (pokemonData.move1) moves.push(extractMoveName(pokemonData.move1));
        if (pokemonData.move2) moves.push(extractMoveName(pokemonData.move2));
        if (pokemonData.move3) moves.push(extractMoveName(pokemonData.move3));
        if (pokemonData.move4) moves.push(extractMoveName(pokemonData.move4));
    }
    const gender = pokemonData.gender || '';
    const hp = pokemonData.hp || pokemonData.current_hp || 0;
    const maxHP = pokemonData.max_hp || pokemonData.maxHP || 0;
    
    const spriteUrl = getSpriteUrl(speciesId, isShiny);
    
    let html = '<div class="pokemon-info-container">';
    
    // Basic info section
    html += '<div class="pokemon-info-section">';
    html += '<h3>Encounter Details</h3>';
    
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
    if (level > 0) {
        html += `<p><strong>Level:</strong> ${level}</p>`;
    }
    if (hp > 0 && maxHP > 0) {
        html += `<p><strong>HP:</strong> ${hp}/${maxHP}</p>`;
    }
    if (gender) {
        html += `<p><strong>Gender:</strong> ${gender === 'M' ? 'Male' : gender === 'F' ? 'Female' : gender === 'N' ? 'Genderless' : gender}</p>`;
    }
    html += `<p><strong>Shiny:</strong> ${isShiny ? 'Yes ⭐' : 'No'}</p>`;
    html += `<p><strong>Nature:</strong> ${nature}</p>`;
    html += `<p><strong>Ability:</strong> ${ability}</p>`;
    
    html += '</div>';
    
    // IVs section
    if (ivs && Object.keys(ivs).length > 0) {
        // Calculate IV sum
        let ivSum = 0;
        const ivValues = {
            hp: parseInt(ivs.hp) || 0,
            attack: parseInt(ivs.attack) || 0,
            defense: parseInt(ivs.defense) || 0,
            spAttack: parseInt(ivs.spAttack || ivs.sp_attack) || 0,
            spDefense: parseInt(ivs.spDefense || ivs.sp_defense) || 0,
            speed: parseInt(ivs.speed) || 0
        };
        ivSum = Object.values(ivValues).reduce((sum, val) => sum + val, 0);
        
        html += '<div class="pokemon-info-section">';
        html += '<h3>Individual Values (IVs)</h3>';
        html += `<div class="iv-summary">IV Sum: ${ivSum} / 186</div>`;
        html += '<div class="chart-type-toggle">';
        html += '<button class="chart-toggle-btn" data-chart-type="bar" data-chart-target="iv">Bar</button>';
        html += '<button class="chart-toggle-btn active" data-chart-type="radar" data-chart-target="iv">Radar</button>';
        html += '</div>';
        html += `<div id="encounter-iv-chart-container" class="iv-chart-container">`;
        html += createIVChart(ivValues, 'radar');
        html += '</div>';
        html += '</div>';
        
        // Setup chart toggle after rendering
        setTimeout(() => {
            setupEncounterChartToggles(ivValues);
        }, 100);
    }
    
    // Moves section
    if (moves && moves.length > 0) {
        html += '<div class="pokemon-info-section">';
        html += '<h3>Moves</h3>';
        html += '<ul>';
        moves.forEach(move => {
            // Moves should already be extracted as strings, but handle edge cases
            const moveName = typeof move === 'string' ? move : 
                           (move && typeof move === 'object' ? 
                            (move.name || move.move || move.move_name || move.moveName || 
                             (move.id ? `Move #${move.id}` : 'Unknown')) : 
                            String(move));
            html += `<li>${moveName}</li>`;
        });
        html += '</ul></div>';
    }
    
    html += '</div>';
    return html;
}

// Helper function to extract move name from various formats
function extractMoveName(move) {
    if (typeof move === 'string') {
        return move;
    } else if (typeof move === 'number') {
        return `Move #${move}`;
    } else if (move && typeof move === 'object') {
        return move.name || move.move || move.move_name || move.moveName || 
               (move.id ? `Move #${move.id}` : 'Unknown Move');
    }
    return 'Unknown Move';
}

// Create IV chart HTML (from main page)
function createIVChart(ivs, chartType = 'radar') {
    const stats = [
        { name: 'HP', value: ivs.hp || 0 },
        { name: 'Attack', value: ivs.attack || 0 },
        { name: 'Defense', value: ivs.defense || 0 },
        { name: 'Sp. Attack', value: ivs.spAttack || ivs.sp_attack || 0 },
        { name: 'Sp. Defense', value: ivs.spDefense || ivs.sp_defense || 0 },
        { name: 'Speed', value: ivs.speed || 0 }
    ];
    
    switch(chartType) {
        case 'bar':
            return createBarChart(stats, 31);
        case 'radar':
        default:
            return createRadarChart(stats, 31);
    }
}

// Create bar chart (using same style as main page)
function createBarChart(stats, maxValue = 31) {
    return `
        <div class="chart-container">
            ${stats.map(stat => `
                <div class="chart-item">
                    <div class="chart-label">
                        <span>${stat.name}</span>
                        <span class="chart-value">${stat.value}/${maxValue}</span>
                    </div>
                    <div class="chart-bar-container">
                        <div class="chart-bar" style="width: ${(stat.value / maxValue) * 100}%; background: ${getIVColor(stat.value)};"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Create radar chart (using same style as main page)
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
        return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="#667eea" font-size="11" font-weight="bold">${stat.value}</text>`;
    }).join('');
    
    return `
        <div class="radar-chart-container">
            <svg viewBox="0 0 300 300" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: auto; max-width: 300px;">
                ${gridLines}
                ${axisLines}
                <polygon points="${points}" fill="#667eea" fill-opacity="0.3" stroke="#667eea" stroke-width="2"/>
                ${labels}
                ${valueLabels}
            </svg>
        </div>
    `;
}

// Get IV color based on value
function getIVColor(value) {
    if (value >= 30) return '#4CAF50'; // Green
    if (value >= 20) return '#8BC34A'; // Light green
    if (value >= 15) return '#FFC107'; // Yellow
    if (value >= 10) return '#FF9800'; // Orange
    return '#F44336'; // Red
}

// Setup chart toggle buttons for encounter stats
function setupEncounterChartToggles(ivs) {
    const toggleButtons = document.querySelectorAll('#encounter-iv-chart-container').length > 0 
        ? document.querySelector('#encounter-iv-chart-container').parentElement.querySelectorAll('.chart-toggle-btn')
        : [];
    
    toggleButtons.forEach(btn => {
        // Remove existing listeners
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', function() {
            const chartType = this.dataset.chartType;
            const chartTarget = this.dataset.chartTarget;
            const container = document.getElementById('encounter-iv-chart-container');
            
            if (container && chartTarget === 'iv') {
                container.innerHTML = createIVChart(ivs, chartType);
                
                // Update active button
                toggleButtons.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            }
        });
    });
}

// Show Pokemon information (similar to main page)
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
        
        // Setup shiny toggle
        setTimeout(() => {
            const shinyToggle = document.getElementById('pokemonInfoShinyToggle');
            const spriteImg = document.getElementById('pokemonInfoSprite');
            if (shinyToggle && spriteImg) {
                let isShiny = false;
                shinyToggle.addEventListener('click', () => {
                    isShiny = !isShiny;
                    const imgSpeciesId = parseInt(spriteImg.dataset.speciesId);
                    if (imgSpeciesId) {
                        spriteImg.src = getSpriteUrl(imgSpeciesId, isShiny);
                    }
                });
            }
        }, 100);
    } catch (error) {
        console.error('Error loading Pokemon info:', error);
        content.innerHTML = `<div class="error">Error loading Pokemon information: ${error.message}</div>`;
    }
}

// Get species name
async function getSpeciesName(speciesId) {
    try {
        const response = await fetch(`/api/pokemon/species/${speciesId}`);
        if (response.ok) {
            const data = await response.json();
            return data.name || `#${speciesId}`;
        }
    } catch (error) {
        console.error('Error fetching species name:', error);
    }
    return `#${speciesId}`;
}

// Fetch Pokemon data from API
async function fetchPokemonData(speciesId) {
    try {
        // Fetch Pokemon data from server
        const pokemonResponse = await fetch(`/api/pokemon/data/${speciesId}`);
        if (!pokemonResponse.ok) {
            throw new Error('Failed to fetch Pokemon data');
        }
        const pokemon = await pokemonResponse.json();
        
        // Fetch species data
        const speciesResponse = await fetch(`/api/pokemon/species/${speciesId}`);
        let species = null;
        if (speciesResponse.ok) {
            species = await speciesResponse.json();
        }
        
        // Get location areas
        const locationAreas = await fetchLocationAreas(speciesId);
        
        // Get evolution info
        let evolutionInfo = null;
        let evolutionDetails = null;
        try {
            const evoResponse = await fetch(`/api/pokemon/evolution-info/${speciesId}`);
            if (evoResponse.ok) {
                evolutionInfo = await evoResponse.json();
            }
            
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
        
        // Get Pokedex entries
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
        throw error;
    }
}

// Fetch location areas
async function fetchLocationAreas(speciesId) {
    try {
        const response = await fetch(`/api/pokemon/encounters/${speciesId}`);
        if (!response.ok) {
            return {};
        }
        const encounters = await response.json();
        
        const locations = {};
        encounters.forEach(encounter => {
            const locationName = encounter.location_area.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            if (!locations[locationName]) {
                locations[locationName] = [];
            }
            encounter.version_details.forEach(versionDetail => {
                const versionName = versionDetail.version.name;
                versionDetail.encounter_details.forEach(detail => {
                    locations[locationName].push({
                        method: detail.method.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                        chance: detail.chance,
                        minLevel: detail.min_level,
                        maxLevel: detail.max_level,
                        version: versionName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
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

// Get evolution details from chain
function getEvolutionDetails(chain, targetSpeciesId) {
    function findInChain(node, targetId) {
        const speciesId = parseInt(node.species.url.split('/').slice(-2, -1)[0]);
        if (speciesId === targetId) {
            return node;
        }
        for (const evolution of node.evolves_to || []) {
            const found = findInChain(evolution, targetId);
            if (found) return found;
        }
        return null;
    }
    
    const targetNode = findInChain(chain, targetSpeciesId);
    if (!targetNode) return null;
    
    const details = {
        evolvesFrom: null,
        evolvesInto: []
    };
    
    // Find parent
    function findParent(node, targetId) {
        for (const evolution of node.evolves_to || []) {
            const speciesId = parseInt(evolution.species.url.split('/').slice(-2, -1)[0]);
            if (speciesId === targetId) {
                return node;
            }
            const found = findParent(evolution, targetId);
            if (found) return found;
        }
        return null;
    }
    
    const parent = findParent(chain, targetSpeciesId);
    if (parent) {
        const parentId = parseInt(parent.species.url.split('/').slice(-2, -1)[0]);
        details.evolvesFrom = parentId;
    }
    
    // Find children
    if (targetNode.evolves_to && targetNode.evolves_to.length > 0) {
        targetNode.evolves_to.forEach(evolution => {
            const childId = parseInt(evolution.species.url.split('/').slice(-2, -1)[0]);
            details.evolvesInto.push(childId);
        });
    }
    
    return details;
}

// Format Pokemon information for display
function formatPokemonInfo(data, speciesId, speciesName) {
    const { pokemon, locationAreas, evolutionInfo, evolutionDetails, pokedexEntries } = data;
    
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
    
    // Evolution section
    html += '<div class="pokemon-info-section evolution-section">';
    html += '<h3>Evolution</h3>';
    
    const nonEvolvingPokemon = [234, 267, 323, 334, 335, 336, 337, 338, 340];
    const hasInvalidEvolutionData = nonEvolvingPokemon.includes(speciesId);
    
    let hasEvolutionData = !hasInvalidEvolutionData && ((evolutionDetails && (
        evolutionDetails.evolvesFrom || 
        (evolutionDetails.evolvesInto && evolutionDetails.evolvesInto.length > 0)
    )) || (evolutionInfo && (
        evolutionInfo.evolvesFrom || 
        evolutionInfo.evolvesInto
    )));
    
    if (hasEvolutionData) {
        if (evolutionDetails) {
            if (evolutionDetails.evolvesFrom) {
                html += `<p><strong>Evolves from:</strong> #${evolutionDetails.evolvesFrom}</p>`;
            }
            if (evolutionDetails.evolvesInto && evolutionDetails.evolvesInto.length > 0) {
                html += `<p><strong>Evolves into:</strong> ${evolutionDetails.evolvesInto.map(id => `#${id}`).join(', ')}</p>`;
            }
        } else if (evolutionInfo) {
            if (evolutionInfo.evolvesFrom) {
                html += `<p><strong>Evolves from:</strong> #${evolutionInfo.evolvesFrom}</p>`;
            }
            if (evolutionInfo.evolvesInto) {
                html += `<p><strong>Evolves into:</strong> #${evolutionInfo.evolvesInto}</p>`;
            }
        }
    } else {
        html += '<p>This Pokemon does not evolve.</p>';
    }
    
    html += '</div>';
    
    // Pokedex entries
    if (pokedexEntries && pokedexEntries.length > 0) {
        html += '<div class="pokemon-info-section">';
        html += '<h3>Pokedex Entries</h3>';
        pokedexEntries.slice(0, 5).forEach(entry => {
            html += `<p><strong>${entry.version.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</strong> ${entry.flavor_text}</p>`;
        });
        html += '</div>';
    }
    
    // Location areas
    if (locationAreas && Object.keys(locationAreas).length > 0) {
        html += '<div class="pokemon-info-section">';
        html += '<h3>Where to Find</h3>';
        for (const [locationName, encounters] of Object.entries(locationAreas)) {
            html += `<p><strong>${locationName}:</strong></p>`;
            html += '<ul>';
            encounters.slice(0, 10).forEach(enc => {
                html += `<li>${enc.method} (Level ${enc.minLevel}-${enc.maxLevel}, ${enc.chance}% chance) - ${enc.version}</li>`;
            });
            html += '</ul>';
        }
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}

function formatNatureValue(nature) {
    if (!nature) return null;
    if (typeof nature === 'string') return nature;
    if (typeof nature === 'object') {
        return nature.name || nature.nature_name || null;
    }
    return null;
}

function formatAbilityValue(ability, fallbackAbilityName, fallbackAbilitySlot) {
    if (ability) {
        if (typeof ability === 'string') return ability;
        if (typeof ability === 'object') {
            return ability.name || ability.ability_name || null;
        }
        if (typeof ability === 'number') {
            return `Ability ${ability}`;
        }
    }
    if (fallbackAbilityName) return fallbackAbilityName;
    if (fallbackAbilitySlot) return `Ability Slot ${fallbackAbilitySlot}`;
    return null;
}

function parseUnownFormFromString(str) {
    if (typeof str !== 'string' || !str.trim()) return null;
    const s = str.trim();
    // "Unown (Z)", "Unown (!)", "Unown (?)"
    let m = s.match(/Unown\s*\(\s*([A-Za-z!?])\s*\)/i);
    if (m) {
        const ch = m[1];
        if (ch === '!') return 26;
        if (ch === '?') return 27;
        const upper = ch.toUpperCase();
        if (upper >= 'A' && upper <= 'Z') return upper.charCodeAt(0) - 65;
        return null;
    }
    // "Unown Z", "Unown-Z", "Unown  !", "unown ?" (space or hyphen before letter/!/?)
    m = s.match(/Unown\s*[- ]\s*([A-Za-z!?])\s*$/i);
    if (m) {
        const ch = m[1];
        if (ch === '!') return 26;
        if (ch === '?') return 27;
        const upper = ch.toUpperCase();
        if (upper >= 'A' && upper <= 'Z') return upper.charCodeAt(0) - 65;
        return null;
    }
    // Single letter/!/? at end after "unown" (e.g. "unown z")
    m = s.match(/unown\s+([a-z!?])\s*$/i);
    if (m) {
        const ch = m[1];
        if (ch === '!') return 26;
        if (ch === '?') return 27;
        if (ch >= 'A' && ch <= 'Z') return ch.charCodeAt(0) - 65;
        if (ch >= 'a' && ch <= 'z') return ch.charCodeAt(0) - 97;
        return null;
    }
    return null;
}

function getUnownFormIndexFromEncounterOrName(encounter, speciesId, speciesName) {
    const id = parseInt(speciesId);
    if (id !== 201) return null;

    // 1) Explicit form in speciesName (API may send "Unown (Z)", "Unown Z", "Unown-Z", etc.)
    const fromName = parseUnownFormFromString(speciesName);
    if (fromName !== null) return fromName;

    // 2) Fall back to encounter object: explicit form fields, then species.*, then PID/IVs
    return calculateUnownFormFromEncounter(encounter);
}

function formatEncounterSpeciesName(speciesId, speciesName, encounter) {
    const id = parseInt(speciesId);
    if (id !== 201) return speciesName;

    const formIndex = getUnownFormIndexFromEncounterOrName(encounter, id, speciesName);
    if (formIndex === null || formIndex === undefined) {
        return speciesName;
    }
    const formName = getUnownFormName(formIndex);
    return `Unown (${formName})`;
}

function getSpriteUrl(speciesId, isShiny, form) {
    // Use app sprite API (supports Unown form)
    const id = parseInt(speciesId);
    if (!id || id < 1 || id > 1025) return '';
    let url = `/api/pokemon/sprite/${id}${isShiny ? '?shiny=true' : ''}`;
    if (id === 201 && form) {
        const formParam = (form.length === 1) ? form.toLowerCase() : (form === '!' ? 'exclamation' : form === '?' ? 'question' : form.toLowerCase());
        url += (isShiny ? '&' : '?') + `form=${encodeURIComponent(formParam)}`;
    }
    return url;
}

// Unown form index 0-25 = A-Z, 26 = !, 27 = ?
function getUnownFormName(formIndex) {
    if (formIndex >= 0 && formIndex <= 25) return String.fromCharCode(65 + formIndex);
    if (formIndex === 26) return '!';
    if (formIndex === 27) return '?';
    return '?';
}

function getUnownFormForSprite(formIndex) {
    if (formIndex >= 0 && formIndex <= 25) return String.fromCharCode(97 + formIndex);
    if (formIndex === 26) return '!';
    if (formIndex === 27) return '?';
    return '?';
}

// Extract Unown form using the same mechanic as the Pokedex (app.js calculateUnownForm).
// Prefer explicit form from API (species.form, form, unownForm, etc.), then PID/IVs.
function calculateUnownFormFromEncounter(encounter) {
    if (!encounter) return null;

    // 1) Prefer explicit form from API: top-level, pokemon, data.pokemon, and species (common in bot APIs)
    const directFormSources = [
        encounter,
        encounter.pokemon,
        encounter.data && encounter.data.pokemon,
        encounter.species,
        encounter.data && encounter.data.species
    ].filter(Boolean);

    for (const src of directFormSources) {
        // Numeric form index 0-27
        let numericForm = null;
        if (typeof src.unownForm === 'number' && Number.isInteger(src.unownForm)) numericForm = src.unownForm;
        else if (typeof src.unown_form === 'number' && Number.isInteger(src.unown_form)) numericForm = src.unown_form;
        else if (typeof src.formIndex === 'number' && Number.isInteger(src.formIndex)) numericForm = src.formIndex;
        else if (typeof src.form_index === 'number' && Number.isInteger(src.form_index)) numericForm = src.form_index;
        else if (typeof src.form_id === 'number' && Number.isInteger(src.form_id)) numericForm = src.form_id;
        if (numericForm !== null) return Math.min(27, Math.max(0, numericForm));

        // String form: "Z", "z", "!", "?", "Unown (Z)", "exclamation", "question"
        const stringForm =
            src.unownForm ??
            src.unown_form ??
            src.form ??
            src.form_name ??
            src.formName ??
            src.species_form;
        if (typeof stringForm === 'string' && stringForm.trim().length > 0) {
            const trimmed = stringForm.trim();
            // PokeAPI-style form names
            if (/^exclamation$/i.test(trimmed)) return 26;
            if (/^question$/i.test(trimmed)) return 27;
            // Parse "Unown (Z)" / "Unown Z" from species.name if this is the species object
            if (src === encounter.species || src === (encounter.data && encounter.data.species)) {
                const fromName = parseUnownFormFromString(src.name || trimmed);
                if (fromName !== null) return fromName;
            }
            const single = trimmed.match(/^([A-Za-z!?])/);
            if (single) {
                const ch = single[1];
                if (ch === '!') return 26;
                if (ch === '?') return 27;
                const upper = ch.toUpperCase();
                if (upper >= 'A' && upper <= 'Z') return upper.charCodeAt(0) - 65;
            }
        }
    }

    // 2) Same as Pokedex: build pokemon-like object and use identical calculateUnownForm logic
    const ivsRaw = encounter?.ivs ?? encounter?.IVs ?? encounter?.pokemon?.ivs ?? encounter?.data?.pokemon?.ivs;
    const pokemon = {
        // Bot API often sends personality_value (e.g. pokebot-gen3); also pid, personality
        personality: encounter?.personality ?? encounter?.pid ?? encounter?.personality_value ??
            encounter?.pokemon?.personality ?? encounter?.pokemon?.pid ?? encounter?.pokemon?.personality_value ??
            encounter?.data?.pokemon?.personality ?? encounter?.data?.pokemon?.pid ?? encounter?.data?.pokemon?.personality_value,
        ivs: ivsRaw ? {
            attack:   ivsRaw.attack ?? ivsRaw.atk ?? 0,
            defense:  ivsRaw.defense ?? ivsRaw.def ?? 0,
            speed:    ivsRaw.speed ?? ivsRaw.spd ?? 0,
            spAttack: ivsRaw.spAttack ?? ivsRaw.spa ?? 0
        } : undefined
    };

    // Exact copy of app.js calculateUnownForm(pokemon) — PID then IV
    const pid = pokemon?.personality;

    if (typeof pid === 'number' && pid > 0) {
        const value =
            ((pid & 0x03000000) >> 18) |
            ((pid & 0x00030000) >> 12) |
            ((pid & 0x00000300) >> 6)  |
            (pid & 0x00000003);
        return Math.min(27, Math.max(0, value % 28));
    }

    if (!pokemon.ivs) return null;

    const attackIV   = pokemon.ivs.attack   ?? 0;
    const defenseIV  = pokemon.ivs.defense  ?? 0;
    const speedIV    = pokemon.ivs.speed    ?? 0;
    const spAttackIV = pokemon.ivs.spAttack ?? 0;

    const atkBits = (attackIV & 0x6) << 5;
    const defBits = (defenseIV & 0x6) << 3;
    const speBits = (speedIV & 0x6) << 1;
    const spcBits = (spAttackIV & 0x6) >> 1;
    const formValue = (atkBits | defBits | speBits | spcBits) / 10;
    return Math.min(27, Math.max(0, Math.floor(formValue)));
}

// Parse Unown form from target speciesName e.g. "Unown (A)" -> "a"
function getUnownFormFromSpeciesName(speciesName) {
    if (!speciesName) return null;
    const m = speciesName.match(/Unown\s*\(([A-Za-z!?])\)/i);
    if (!m) return null;
    const ch = m[1];
    if (ch >= 'A' && ch <= 'Z') return ch.toLowerCase();
    if (ch >= 'a' && ch <= 'z') return ch;
    if (ch === '!') return '!';
    if (ch === '?') return '?';
    return null;
}

function formatPlayTime(seconds) {
    if (!seconds) return '0h 0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

// Update bot controls with current values
function updateBotControls(card, bot, status) {
    // Update bot mode display
    const modeDisplay = card.querySelector(`#bot-mode-${bot.id}`);
    if (modeDisplay) {
        const mode = status.mode || status.bot_mode || status.game_mode || status.gameMode || (typeof status.game_state === 'string' ? status.game_state : null) || 'Unknown';
        modeDisplay.textContent = mode;
        
        // Add/remove red background tint for Manual mode
        if (mode && mode.toLowerCase() === 'manual') {
            card.classList.add('bot-manual-mode');
        } else {
            card.classList.remove('bot-manual-mode');
        }
    }
    
    // Update emulation speed
    const speedSelect = card.querySelector(`#emulation-speed-${bot.id}`);
    if (speedSelect) {
        // Get speed from emulation_speed field (as per bot API)
        const speed = status.emulation_speed !== undefined ? status.emulation_speed :
                     status.emulator?.emulation_speed !== undefined ? status.emulator.emulation_speed :
                     null;
        
        // Handle different speed formats
        let speedValue = '1'; // default
        if (speed === null || speed === undefined) {
            // Keep current value if speed is not available
            return;
        } else if (speed === 0) {
            speedValue = 'unlimited';
        } else if (typeof speed === 'number') {
            speedValue = String(speed);
        } else if (typeof speed === 'string') {
            if (speed === 'unlimited' || speed === '0') {
                speedValue = 'unlimited';
            } else {
                speedValue = speed;
            }
        }
        
        // Only update if different to avoid triggering change events
        if (speedSelect.value !== speedValue) {
            speedSelect.value = speedValue;
        }
    }
    
    // Update video enabled
    const videoCheckbox = card.querySelector(`#video-enabled-${bot.id}`);
    if (videoCheckbox) {
        const enabled = status.video_enabled !== undefined ? status.video_enabled : 
                       (status.video !== undefined ? status.video : 
                       (status.videoEnabled !== undefined ? status.videoEnabled : false));
        if (videoCheckbox.checked !== enabled) {
            videoCheckbox.checked = enabled;
        }
    }
    
    // Update audio enabled
    const audioCheckbox = card.querySelector(`#audio-enabled-${bot.id}`);
    if (audioCheckbox) {
        const enabled = status.audio_enabled !== undefined ? status.audio_enabled : 
                       (status.audio !== undefined ? status.audio : 
                       (status.audioEnabled !== undefined ? status.audioEnabled : false));
        if (audioCheckbox.checked !== enabled) {
            audioCheckbox.checked = enabled;
        }
    }
    
    // Update video stream toggle (this controls whether we display the stream, not the bot setting)
    const videoStreamCheckbox = card.querySelector(`#video-stream-enabled-${bot.id}`);
    const videoSection = card.querySelector(`#bot-video-${bot.id}`);
    const videoPlayer = card.querySelector(`#bot-video-player-${bot.id}`);
    
    if (videoStreamCheckbox) {
        // Check if video stream should be shown (based on current checkbox state or video enabled)
        const shouldShow = videoStreamCheckbox.checked;
        
        if (videoSection) {
            videoSection.style.display = shouldShow ? 'block' : 'none';
        }
        
        // Start/stop video stream based on checkbox
        if (shouldShow && videoPlayer) {
            startVideoStream(bot, videoPlayer);
        } else if (videoPlayer) {
            stopVideoStream(videoPlayer);
        }
    }
}

// SSE (Server-Sent Events) for real-time updates - connect to bot's /stream_events
// Topics must be subscribed per pokebot-gen3 API: https://github.com/40Cakes/pokebot-gen3/blob/main/modules/web/static/index.html#L257-L303
const STREAM_TOPICS = [
    'Opponent', 'Party', 'PerformanceData', 'GameState', 'Map', 'MapTile',
    'Message', 'BotMode', 'EmulatorSettings', 'Player', 'PokenavCall', 'Inputs', 'FishingAttempt'
];
const botEventSources = new Map(); // botId -> EventSource
// Per-bot merged state from stream events (Opponent, Party, etc.)
const botStreamState = new Map(); // botId -> { party, opponent, encounter_rate, game_state, map, ... }

let updateBotStatusInProgress = false;
let statsPollInProgress = false;

// Limit time per bot and per cycle so many bots don't block updates forever
const UPDATE_BOT_STATUS_PER_BOT_TIMEOUT_MS = 10000; // 10s max per bot
const UPDATE_BOT_STATUS_CYCLE_TIMEOUT_MS = 100000; // 100s max per full cycle (~10 bots at 10s each)
// Stats (totals, per-species) are fetched less often than UI data
const STATS_POLL_INTERVAL_MS = 30000; // 30s - stats-only poll interval
const STATS_POLL_INITIAL_DELAY_MS = 2000; // Run first stats poll 2s after load
// Avoid opening too many SSE connections (browser limit ~6 per origin); use polling only for the rest
const MAX_STREAM_BOTS = 3;

// Fetch /stats for visible bots only (runs on a slower interval than main UI poll)
async function updateBotStatsOnly() {
    if (statsPollInProgress) return;
    const visibleBots = getVisibleBots();
    if (visibleBots.length === 0) return;
    statsPollInProgress = true;
    try {
    for (const bot of visibleBots) {
        try {
            const statsData = await Promise.race([
                fetchBotEndpoint(bot, bot.url || '', '/stats'),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
            ]);
            if (!statsData || typeof statsData !== 'object') continue;
            const existing = botDataCache.get(bot.id);
            if (existing && existing.data) {
                const updated = {
                    ...existing,
                    data: { ...existing.data, stats: statsData }
                };
                botDataCache.set(bot.id, updated);
                updateMaxTotalsFromStats(bot.id, statsData);
                const card = document.getElementById(`bot-status-${bot.id}`);
                if (card) updateStatusCard(card, bot, updated);
            } else {
                updateMaxTotalsFromStats(bot.id, statsData);
            }
            // Keep Bot Statistics modal cache in sync when background poll gets new data
            botStatsCache.set(bot.id, { stats: statsData, time: Date.now() });
        } catch (e) {
            console.warn(`[${bot.name}] Stats poll failed:`, e?.message || e);
        }
        await new Promise(r => setTimeout(r, 0)); // yield between bots
    }
    saveBotStatsCache();
    } finally {
        statsPollInProgress = false;
    }
}

function startPolling() {
    // Stop existing connections
    stopPolling();
    
    const visibleBots = getVisibleBots();
    console.log('Starting polling for', visibleBots.length, 'visible bots out of', botInstances.length, 'total');
    
    // Update immediately with current data (only on initial load)
    updateBotStatus(true);
    
    // Use faster polling for real-time updates; scale interval with bot count so one cycle can finish before the next
    const intervalSeconds = Math.min(dashboardSettings.updateInterval || 2, 2); // Max 2 seconds base
    let intervalMs = intervalSeconds * 1000;
    if (visibleBots.length > 1) {
        // Allow enough time for one full cycle (per-bot timeout 10s) so we don't stack and kill the tab
        const minIntervalForBots = 5000 + visibleBots.length * 10000; // 5s + 10s per bot
        intervalMs = Math.max(intervalMs, Math.min(90000, minIntervalForBots));
    }
    
    console.log('Setting up polling interval:', intervalMs, 'ms (', visibleBots.length, 'bots)');
    
    // Use server-side polling (most reliable)
    const pollingInterval = setInterval(() => {
        if (visibleBots.length <= 6) console.log('Polling update triggered');
        updateBotStatus(false);
    }, intervalMs);
    
    // Store the main polling interval
    botPollingIntervals.set('main', pollingInterval);
    
    // Stats-only poll: fetch /stats less frequently than UI (Total Stats, Bot Statistics modal, max totals)
    const runStatsPoll = () => {
        updateBotStatsOnly().catch(err => console.warn('[Stats poll]', err));
    };
    setTimeout(runStatsPoll, STATS_POLL_INITIAL_DELAY_MS);
    const statsPollingInterval = setInterval(runStatsPoll, STATS_POLL_INTERVAL_MS);
    botPollingIntervals.set('stats', statsPollingInterval);
    
    // Connect to bot streams only for first N bots to avoid exhausting browser connections (site dies with 5+)
    const botsToStream = visibleBots.length <= MAX_STREAM_BOTS ? visibleBots : visibleBots.slice(0, MAX_STREAM_BOTS);
    if (visibleBots.length > MAX_STREAM_BOTS) {
        console.log('Streams limited to', MAX_STREAM_BOTS, 'bots;', visibleBots.length - MAX_STREAM_BOTS, 'bots use polling only');
    }
    botsToStream.forEach(bot => {
        connectToBotStream(bot);
    });
}

function connectToBotStream(bot) {
    // Don't connect to hidden bots
    const config = botOrderConfig[bot.id];
    if (config && config.hidden) {
        console.log(`[${bot.name}] Skipping stream connection - bot is hidden`);
        return;
    }
    
    // Try stream first, but fallback quickly if it doesn't work
    let streamTimeout = null;
    let hasReceivedData = false;
    
    try {
        // Build stream URL with topic params (required by pokebot-gen3 /stream_events API)
        const baseUrl = (bot.url || '').replace(/\/$/, '');
        const topicParams = STREAM_TOPICS.map(t => 'topic=' + encodeURIComponent(t)).join('&');
        const streamPath = baseUrl + '/stream_events?' + topicParams;
        const streamUrl = `/api/bot-stream-proxy?url=${encodeURIComponent(streamPath)}`;
        const eventSource = new EventSource(streamUrl);
        
        botEventSources.set(bot.id, eventSource);
        botStreamState.set(bot.id, {});
        
        // Set a timeout - if no data received in 10 seconds, fallback to polling
        streamTimeout = setTimeout(() => {
            if (!hasReceivedData) {
                console.warn(`[${bot.name}] Stream timeout - no data received, falling back to polling`);
                eventSource.close();
                botEventSources.delete(bot.id);
                botStreamState.delete(bot.id);
                fallbackToPollingForBot(bot);
            }
        }, 10000);
        
        function markReceivedData() {
            hasReceivedData = true;
            if (streamTimeout) {
                clearTimeout(streamTimeout);
                streamTimeout = null;
            }
        }
        
        function buildResultFromStreamState() {
            const state = botStreamState.get(bot.id) || {};
            const trackedEncountersForBot = (trackedEncounters[bot.id] || []).slice().reverse();
            return {
                success: true,
                data: {
                    status: { game_state: state.game_state },
                    party: state.party || [],
                    encounters: trackedEncountersForBot,
                    currentEncounter: state.opponent || null,
                    stats: state.stats || {},
                    encounter_rate: state.encounter_rate,
                    map: state.map || {},
                    emulator: state.emulator || {}
                }
            };
        }
        
        function applyStreamUpdate() {
            const result = buildResultFromStreamState();
            botDataCache.set(bot.id, result);
            const encounterRate = result.data.encounter_rate;
            if (encounterRate !== undefined && encounterRate !== null && typeof encounterRate === 'number' && encounterRate >= 0) {
                if (!liveEncounterRateHistory.has(bot.id)) {
                    liveEncounterRateHistory.set(bot.id, []);
                }
                const history = liveEncounterRateHistory.get(bot.id);
                const now = Date.now();
                const lastEntry = history.length > 0 ? history[history.length - 1] : null;
                if (!lastEntry || lastEntry.rate !== encounterRate || (now - lastEntry.time) >= 1000) {
                    history.push({ time: now, rate: encounterRate });
                    if (history.length > MAX_LIVE_HISTORY_POINTS) history.shift();
                }
            }
            const card = document.getElementById(`bot-status-${bot.id}`);
            if (card) {
                const indicator = card.querySelector('.status-indicator');
                const wasOnline = indicator && indicator.textContent === 'Online';
                updateStatusCard(card, bot, result);
                if (indicator && wasOnline) {
                    indicator.textContent = 'Online';
                    indicator.className = 'status-indicator online';
                }
            } else {
                updateBotStatus(true);
            }
            updateDashboardSummary();
        }
        
        // Handle typed SSE events (pokebot-gen3 sends event type per topic)
        eventSource.addEventListener('Opponent', (event) => {
            markReceivedData();
            try {
                const data = event.data ? JSON.parse(event.data) : null;
                trackCurrentEncounter(bot.id, data);
                const state = botStreamState.get(bot.id) || {};
                state.opponent = data;
                botStreamState.set(bot.id, state);
                applyStreamUpdate();
            } catch (e) { console.warn(`[${bot.name}] Opponent parse:`, e); }
        });
        eventSource.addEventListener('Party', (event) => {
            markReceivedData();
            try {
                const data = event.data ? JSON.parse(event.data) : null;
                const state = botStreamState.get(bot.id) || {};
                state.party = Array.isArray(data) ? data : (state.party || []);
                botStreamState.set(bot.id, state);
                applyStreamUpdate();
            } catch (e) { console.warn(`[${bot.name}] Party parse:`, e); }
        });
        eventSource.addEventListener('PerformanceData', (event) => {
            markReceivedData();
            try {
                const data = event.data ? JSON.parse(event.data) : null;
                if (data && typeof data.encounter_rate === 'number') {
                    const state = botStreamState.get(bot.id) || {};
                    state.encounter_rate = data.encounter_rate;
                    state.emulator = state.emulator || {};
                    state.emulator.current_fps = data.fps;
                    state.emulator.current_time_spent_in_bot_fraction = data.current_time_spent_in_bot_fraction;
                    botStreamState.set(bot.id, state);
                    applyStreamUpdate();
                }
            } catch (e) { console.warn(`[${bot.name}] PerformanceData parse:`, e); }
        });
        eventSource.addEventListener('GameState', (event) => {
            markReceivedData();
            try {
                const data = event.data !== undefined ? (typeof event.data === 'string' ? event.data : JSON.parse(event.data)) : '';
                const state = botStreamState.get(bot.id) || {};
                state.game_state = typeof data === 'string' ? data : (data && data.game_state) || '';
                botStreamState.set(bot.id, state);
                applyStreamUpdate();
            } catch (e) { console.warn(`[${bot.name}] GameState parse:`, e); }
        });
        eventSource.addEventListener('Map', (event) => {
            markReceivedData();
            try {
                const data = event.data ? JSON.parse(event.data) : null;
                const state = botStreamState.get(bot.id) || {};
                state.map = data || state.map || {};
                botStreamState.set(bot.id, state);
                applyStreamUpdate();
            } catch (e) { console.warn(`[${bot.name}] Map parse:`, e); }
        });
        eventSource.addEventListener('Player', (event) => {
            markReceivedData();
            try {
                const data = event.data ? JSON.parse(event.data) : null;
                const state = botStreamState.get(bot.id) || {};
                state.player = data;
                botStreamState.set(bot.id, state);
                applyStreamUpdate();
            } catch (e) { console.warn(`[${bot.name}] Player parse:`, e); }
        });
        eventSource.addEventListener('Message', (event) => {
            markReceivedData();
            try {
                const data = event.data;
                const state = botStreamState.get(bot.id) || {};
                state.message = data != null ? String(data) : '';
                botStreamState.set(bot.id, state);
                applyStreamUpdate();
            } catch (e) { console.warn(`[${bot.name}] Message parse:`, e); }
        });
        eventSource.addEventListener('BotMode', (event) => {
            markReceivedData();
            try {
                const data = event.data !== undefined ? (typeof event.data === 'string' ? event.data : JSON.parse(event.data)) : '';
                const state = botStreamState.get(bot.id) || {};
                state.bot_mode = typeof data === 'string' ? data : (data && data.bot_mode) || '';
                botStreamState.set(bot.id, state);
                applyStreamUpdate();
            } catch (e) { console.warn(`[${bot.name}] BotMode parse:`, e); }
        });
        eventSource.addEventListener('EmulatorSettings', (event) => {
            markReceivedData();
            try {
                const data = event.data ? JSON.parse(event.data) : null;
                const state = botStreamState.get(bot.id) || {};
                state.emulator = Object.assign(state.emulator || {}, data || {});
                botStreamState.set(bot.id, state);
                applyStreamUpdate();
            } catch (e) { console.warn(`[${bot.name}] EmulatorSettings parse:`, e); }
        });
        eventSource.addEventListener('MapTile', (event) => {
            markReceivedData();
            try {
                const data = event.data ? JSON.parse(event.data) : null;
                const state = botStreamState.get(bot.id) || {};
                if (!state.map) state.map = {};
                state.map.player_position = data;
                botStreamState.set(bot.id, state);
                applyStreamUpdate();
            } catch (e) { console.warn(`[${bot.name}] MapTile parse:`, e); }
        });
        // Generic message fallback (some servers may send untyped events)
        eventSource.onmessage = (event) => {
            if (event.data.startsWith(':')) return;
            markReceivedData();
            try {
                const botData = JSON.parse(event.data);
                const state = botStreamState.get(bot.id) || {};
                if (botData.opponent != null) state.opponent = botData.opponent;
                if (botData.party != null) state.party = botData.party;
                if (botData.encounter_rate != null) state.encounter_rate = botData.encounter_rate;
                if (botData.game_state != null) state.game_state = botData.game_state;
                if (botData.map != null) state.map = botData.map;
                if (botData.emulator != null) state.emulator = botData.emulator;
                botStreamState.set(bot.id, state);
                applyStreamUpdate();
            } catch (e) { /* ignore */ }
        };
        
        eventSource.onerror = (error) => {
            console.error(`[${bot.name}] SSE stream error:`, error, 'ReadyState:', eventSource.readyState);
            
            if (streamTimeout) {
                clearTimeout(streamTimeout);
                streamTimeout = null;
            }
            
            // If connection failed immediately, fallback to polling
            if (eventSource.readyState === EventSource.CLOSED && !hasReceivedData) {
                console.warn(`[${bot.name}] Stream connection failed, falling back to polling`);
                botEventSources.delete(bot.id);
                botStreamState.delete(bot.id);
                fallbackToPollingForBot(bot);
                return;
            }
            
            // Try to reconnect after a delay (only if we had a working connection)
            if (hasReceivedData) {
                setTimeout(() => {
                    const currentSource = botEventSources.get(bot.id);
                    if (currentSource && currentSource.readyState === EventSource.CLOSED) {
                        console.log(`[${bot.name}] Reconnecting to stream...`);
                        connectToBotStream(bot);
                    }
                }, 5000);
            } else {
                // Never got data, fallback immediately
                botEventSources.delete(bot.id);
                botStreamState.delete(bot.id);
                fallbackToPollingForBot(bot);
            }
        };
        
        eventSource.onopen = () => {
            console.log(`[${bot.name}] Connected to bot stream_events`);
        };
    } catch (err) {
        console.error(`[${bot.name}] Failed to establish stream connection:`, err);
        if (streamTimeout) {
            clearTimeout(streamTimeout);
        }
        // Fallback to polling for this bot
        fallbackToPollingForBot(bot);
    }
}

// Show target Pokemon selector modal
async function showTargetPokemonSelector(botId) {
    // Create or get modal
    let modal = document.getElementById('targetPokemonModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'targetPokemonModal';
        modal.className = 'modal hidden';
        modal.innerHTML = `
            <div class="modal-content target-pokemon-modal-content">
                <div class="modal-header">
                    <h2>Set Target Pokemon</h2>
                    <span class="modal-close" id="closeTargetPokemonModal">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="targetPokemonSelect">Select Pokemon:</label>
                        <div class="pokemon-select-wrapper">
                            <input type="text" id="targetPokemonSelect" class="target-pokemon-select" placeholder="Type to search Pokemon..." autocomplete="off">
                            <div id="targetPokemonDropdown" class="pokemon-dropdown hidden"></div>
                        </div>
                    </div>
                    <div class="form-group">
                        <button class="btn btn-primary" id="saveTargetPokemonBtn">Set Target</button>
                        <button class="btn btn-secondary" id="clearTargetPokemonBtn">Clear Target</button>
                        <button class="btn btn-secondary" id="cancelTargetPokemonBtn">Cancel</button>
                    </div>
                    <div id="targetPokemonPreview" class="target-pokemon-preview"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Populate Pokemon dropdown (Gen 3: 1-386)
        const pokemonSelect = document.getElementById('targetPokemonSelect');
        const pokemonDropdown = document.getElementById('targetPokemonDropdown');
        if (pokemonSelect && pokemonDropdown) {
            // Load Pokemon names asynchronously
            loadPokemonList(pokemonSelect, pokemonDropdown);
        }
        
        // Add event listeners
        const closeBtn = document.getElementById('closeTargetPokemonModal');
        const cancelBtn = document.getElementById('cancelTargetPokemonBtn');
        const saveBtn = document.getElementById('saveTargetPokemonBtn');
        const clearBtn = document.getElementById('clearTargetPokemonBtn');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                const currentBotId = modal.dataset.botId;
                if (currentBotId) {
                    await clearBotTarget(currentBotId);
                    modal.classList.add('hidden');
                    // Refresh the bot status card
                    const card = document.getElementById(`bot-status-${currentBotId}`);
                    if (card) {
                        const bot = botInstances.find(b => b.id === currentBotId);
                        if (bot) {
                            const cachedData = botDataCache.get(currentBotId);
                            if (cachedData) {
                                updateStatusCard(card, bot, cachedData);
                            }
                        }
                    }
                }
            });
        }
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const currentBotId = modal.dataset.botId;
                if (!currentBotId) {
                    alert('Error: Bot ID not found.');
                    return;
                }
                const inputValue = pokemonSelect.value.trim();
                if (!inputValue) {
                    alert('Please select a Pokemon.');
                    return;
                }
                
                // Parse the input value - could be "#123 - Name", "Name", "#123", or "123"
                let speciesId = null;
                let speciesName = null;
                
                const match = inputValue.match(/^#?(\d+)\s*-\s*(.+)$/);
                if (match) {
                    speciesId = parseInt(match[1]);
                    speciesName = match[2].trim();
                } else {
                    const displayMapData = pokemonSelect.dataset.pokemonDisplayMap;
                    if (displayMapData) {
                        const displayMap = new Map(JSON.parse(displayMapData));
                        const entry = displayMap.get(inputValue) || displayMap.get(inputValue.trim());
                        if (entry) {
                            speciesId = entry.id;
                            speciesName = entry.name;
                        }
                    }
                    if (!speciesId && /^#?\d+$/.test(inputValue)) {
                        const numMatch = inputValue.match(/^#?(\d+)$/);
                        if (numMatch) {
                            speciesId = parseInt(numMatch[1]);
                            const displayMapData = pokemonSelect.dataset.pokemonDisplayMap;
                            if (displayMapData) {
                                const displayMap = new Map(JSON.parse(displayMapData));
                                const entry = displayMap.get(`#${speciesId}`);
                                if (entry) speciesName = entry.name;
                            }
                        }
                    }
                }
                
                if (speciesId && speciesId >= 1 && speciesId <= 386 && speciesName) {
                    await setBotTargetPokemon(currentBotId, speciesId, speciesName);
                    modal.classList.add('hidden');
                    // Refresh the bot status card
                    const card = document.getElementById(`bot-status-${currentBotId}`);
                    if (card) {
                        const bot = botInstances.find(b => b.id === currentBotId);
                        if (bot) {
                            const cachedData = botDataCache.get(currentBotId);
                            if (cachedData) {
                                updateStatusCard(card, bot, cachedData);
                            }
                        }
                    }
                } else {
                    alert('Please select a valid Pokemon.');
                }
            });
        }
        if (pokemonSelect) {
            const pokemonDropdown = document.getElementById('targetPokemonDropdown');
            
            // Filter and show dropdown when input changes
            const filterAndShowDropdown = () => {
                const inputValue = pokemonSelect.value.trim().toLowerCase();
                const listData = pokemonSelect.dataset.pokemonList;
                if (!listData || !pokemonDropdown) return;
                
                const pokemonList = JSON.parse(listData);
                const listWithDisplay = pokemonList.map(p => ({
                    ...p,
                    displayText: `#${p.id} - ${p.name}`
                }));
                
                let filtered = [];
                if (inputValue) {
                    filtered = listWithDisplay.filter(p =>
                        p.name.toLowerCase().includes(inputValue) ||
                        p.id.toString().includes(inputValue) ||
                        p.displayText.toLowerCase().includes(inputValue)
                    );
                } else {
                    filtered = listWithDisplay.slice(0, 20);
                }
                filtered = filtered.slice(0, 50);
                
                if (filtered.length > 0 && inputValue) {
                    pokemonDropdown.innerHTML = '';
                    filtered.forEach(pokemon => {
                        const item = document.createElement('div');
                        item.className = 'pokemon-dropdown-item';
                        item.textContent = pokemon.displayText;
                        item.dataset.pokemonId = pokemon.id;
                        item.dataset.pokemonName = pokemon.name;
                        if (pokemon.form) item.dataset.pokemonForm = pokemon.form;
                        item.addEventListener('click', () => {
                            pokemonSelect.value = pokemon.displayText;
                            pokemonDropdown.classList.add('hidden');
                            updatePreview();
                        });
                        pokemonDropdown.appendChild(item);
                    });
                    pokemonDropdown.classList.remove('hidden');
                } else {
                    pokemonDropdown.classList.add('hidden');
                }
            };
            
            // Update preview when input changes
            const updatePreview = async () => {
                const inputValue = pokemonSelect.value.trim();
                if (!inputValue) {
                    const preview = document.getElementById('targetPokemonPreview');
                    if (preview) preview.innerHTML = '';
                    return;
                }
                const displayMapData = pokemonSelect.dataset.pokemonDisplayMap;
                if (!displayMapData) return;
                const displayMap = new Map(JSON.parse(displayMapData));
                let matchedPokemon = displayMap.get(inputValue) || displayMap.get(inputValue.replace(/^#(\d+)\s*-\s*(.+)$/, (_, id, name) => `#${id} - ${name.trim()}`));
                if (!matchedPokemon) {
                    const match = inputValue.match(/^#?(\d+)\s*-\s*(.+)$/);
                    if (match) matchedPokemon = displayMap.get(`#${match[1]} - ${match[2].trim()}`);
                }
                if (matchedPokemon && matchedPokemon.id >= 1 && matchedPokemon.id <= 386) {
                    const preview = document.getElementById('targetPokemonPreview');
                    const formParam = (matchedPokemon.id === 201 && matchedPokemon.form) ? `?form=${encodeURIComponent(matchedPokemon.form)}` : '';
                    const spriteUrl = `/api/pokemon/sprite/${matchedPokemon.id}${formParam}`;
                    const fallbackForm = (matchedPokemon.id === 201 && matchedPokemon.form) ? (matchedPokemon.form.length === 1 ? matchedPokemon.form : matchedPokemon.form === '!' ? 'exclamation' : 'question') : '';
                    const fallbackSuffix = fallbackForm ? '-' + fallbackForm : '';
                    if (preview) {
                        preview.innerHTML = `
                            <div class="target-pokemon-preview-content">
                                <img src="${spriteUrl}" alt="${matchedPokemon.name}" 
                                     onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${matchedPokemon.id}${fallbackSuffix}.png'">
                                <p><strong>#${matchedPokemon.id} ${matchedPokemon.name}</strong></p>
                            </div>
                        `;
                    }
                } else {
                    const preview = document.getElementById('targetPokemonPreview');
                    if (preview) preview.innerHTML = '';
                }
            };
            
            pokemonSelect.addEventListener('input', () => {
                filterAndShowDropdown();
                updatePreview();
            });
            pokemonSelect.addEventListener('focus', filterAndShowDropdown);
            
            // Hide dropdown when clicking outside
            const wrapper = pokemonSelect.closest('.pokemon-select-wrapper');
            document.addEventListener('click', (e) => {
                if (wrapper && !wrapper.contains(e.target)) {
                    pokemonDropdown.classList.add('hidden');
                }
            });
        }
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    }
    
    // Set current bot ID
    modal.dataset.botId = botId;
    
    // Load current target if set
    const currentTarget = getBotTargetPokemon(botId);
    const pokemonSelect = document.getElementById('targetPokemonSelect');
    if (pokemonSelect) {
        if (currentTarget) {
            // Set value in format "#123 - Name" for the input
            pokemonSelect.value = `#${currentTarget.speciesId} - ${currentTarget.speciesName}`;
            // Trigger preview update
            pokemonSelect.dispatchEvent(new Event('input'));
        } else {
            pokemonSelect.value = '';
        }
    }
    
    // Show modal
    modal.classList.remove('hidden');
}

// Load Pokemon list (sorted alphabetically); includes all 28 Unown forms for targets
async function loadPokemonList(inputElement, dropdownElement) {
    try {
        // Fetch all Pokemon names for Gen 3 (1-386)
        const pokemonList = [];
        const batchSize = 50;
        
        for (let i = 1; i <= 386; i += batchSize) {
            const batch = [];
            for (let j = i; j < Math.min(i + batchSize, 387); j++) {
                batch.push(fetchPokemonNameForList(j));
            }
            const results = await Promise.all(batch);
            results.forEach((name, index) => {
                if (name) {
                    const id = i + index;
                    if (id === 201) {
                        // Add all 28 Unown forms as separate entries
                        for (let f = 0; f <= 25; f++) {
                            pokemonList.push({ id: 201, name: `Unown (${String.fromCharCode(65 + f)})`, form: String.fromCharCode(97 + f) });
                        }
                        pokemonList.push({ id: 201, name: 'Unown (!)', form: '!' });
                        pokemonList.push({ id: 201, name: 'Unown (?)', form: '?' });
                    } else {
                        pokemonList.push({ id, name });
                    }
                }
            });
        }
        
        // Sort by name alphabetically
        pokemonList.sort((a, b) => a.name.localeCompare(b.name));
        
        // Build display map for lookup by displayText, name, #id, or id
        const displayMap = new Map();
        pokemonList.forEach(p => {
            const displayText = `#${p.id} - ${p.name}`;
            const entry = { id: p.id, name: p.name, form: p.form || null };
            displayMap.set(displayText, entry);
            displayMap.set(p.name, entry);
            displayMap.set(`#${p.id}`, entry);
            displayMap.set(p.id.toString(), entry);
        });
        
        if (inputElement) {
            inputElement.dataset.pokemonList = JSON.stringify(pokemonList);
            inputElement.dataset.pokemonDisplayMap = JSON.stringify(Array.from(displayMap.entries()));
        }
    } catch (error) {
        console.error('Error loading Pokemon list:', error);
    }
}

// Fetch Pokemon name for list (with caching)
const pokemonNameCache = new Map();
async function fetchPokemonNameForList(speciesId) {
    if (pokemonNameCache.has(speciesId)) {
        return pokemonNameCache.get(speciesId);
    }
    
    try {
        const response = await fetch(`/api/pokemon/species/${speciesId}`);
        if (response.ok) {
            const speciesData = await response.json();
            const speciesName = speciesData.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            pokemonNameCache.set(speciesId, speciesName);
            return speciesName;
        }
    } catch (error) {
        console.error(`Error fetching Pokemon name for ${speciesId}:`, error);
    }
    
    return `Unknown (${speciesId})`;
}

// Store polling intervals per bot
const botPollingIntervals = new Map(); // botId -> intervalId

function fallbackToPollingForBot(bot) {
    // Don't create multiple polling intervals for the same bot
    if (botPollingIntervals.has(bot.id)) {
        return;
    }
    
    console.warn(`[${bot.name}] Falling back to polling mode`);
    // Get update interval from settings
    const intervalSeconds = dashboardSettings.updateInterval || 5;
    const intervalMs = intervalSeconds * 1000;
    
    // Poll this specific bot
    const intervalId = setInterval(async () => {
        const card = document.getElementById(`bot-status-${bot.id}`);
        if (card) {
            const result = await fetchBotData(bot);
            updateStatusCard(card, bot, result);
        }
    }, intervalMs);
    
    botPollingIntervals.set(bot.id, intervalId);
}

function fallbackToPolling() {
    console.warn('Falling back to polling mode');
    // Get update interval from settings
    const intervalSeconds = dashboardSettings.updateInterval || 5;
    const intervalMs = intervalSeconds * 1000;
    
    // Update at the specified interval (don't show loading on each update)
    setInterval(() => {
        updateBotStatus(false);
    }, intervalMs);
}

function stopPolling() {
    // Close all bot event sources
    botEventSources.forEach((eventSource, botId) => {
        eventSource.close();
    });
    botEventSources.clear();
    botStreamState.clear();
    
    // Clear all polling intervals
    botPollingIntervals.forEach((intervalId, botId) => {
        clearInterval(intervalId);
    });
    botPollingIntervals.clear();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopPolling();
});

