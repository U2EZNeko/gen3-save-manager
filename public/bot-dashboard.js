// Bot Dashboard JavaScript
// Based on PokeDash: https://github.com/Dan-Mizu/PokeDash

// Bot instances storage (will be loaded from server)
let botInstances = [];

// Dashboard settings storage
let dashboardSettings = JSON.parse(localStorage.getItem('botDashboardSettings') || JSON.stringify({
    layout: 'grid',
    showParty: true,
    showEncounters: true,
    showStats: true,
    showMap: true,
    showEncounterRateGraph: false,
    updateInterval: 5, // seconds
    recentFindsCount: 5, // number of recent finds to display
    cardWidth: 240 // card width in pixels
}));

// Encounter rate history for graphing (per bot)
let encounterRateHistory = JSON.parse(localStorage.getItem('botEncounterRateHistory') || '{}');

// DOM elements
const addBotBtn = document.getElementById('addBotBtn');
const addBotModal = document.getElementById('addBotModal');
const closeAddBotModal = document.getElementById('closeAddBotModal');
const saveBotBtn = document.getElementById('saveBotBtn');
const cancelBotBtn = document.getElementById('cancelBotBtn');
const botInstancesContainer = document.getElementById('botInstances');
const botStatusContainer = document.getElementById('botStatusContainer');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const layoutSelect = document.getElementById('layoutSelect');
const showParty = document.getElementById('showParty');
const showEncounters = document.getElementById('showEncounters');
const showStats = document.getElementById('showStats');
const showMap = document.getElementById('showMap');
const showEncounterRateGraph = document.getElementById('showEncounterRateGraph');
const updateInterval = document.getElementById('updateInterval');
const recentFindsCount = document.getElementById('recentFindsCount');
const cardWidthSlider = document.getElementById('cardWidthSlider');
const cardWidthValue = document.getElementById('cardWidthValue');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    initializeTheme();
    loadDashboardSettings();
    await loadBotInstancesFromServer();
    setupEventListeners();
    setupPokemonInfoModal();
    startPolling();
});

// Theme management
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark-grey' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });
}

function updateThemeIcon(theme) {
    if (themeIcon) {
        themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
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
    
    if (showEncounterRateGraph) {
        showEncounterRateGraph.checked = dashboardSettings.showEncounterRateGraph || false;
        showEncounterRateGraph.addEventListener('change', (e) => {
            dashboardSettings.showEncounterRateGraph = e.target.checked;
            saveDashboardSettings();
            // Show/hide graph container and render/clear chart
            const container = document.getElementById('encounterRateGraphContainer');
            if (container) {
                if (e.target.checked) {
                    renderDashboardEncounterRateChart();
                } else {
                    container.style.display = 'none';
                    const canvas = document.getElementById('dashboardEncounterRateChart');
                    if (canvas && canvas.chart) {
                        canvas.chart.destroy();
                        canvas.chart = null;
                    }
                }
            }
        });
        
        // Initial render if enabled
        if (dashboardSettings.showEncounterRateGraph) {
            setTimeout(() => {
                renderDashboardEncounterRateChart();
            }, 500);
        }
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
            // Restart polling with new interval
            startPolling();
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
    localStorage.setItem('botDashboardSettings', JSON.stringify(dashboardSettings));
}

function applyLayout() {
    if (botStatusContainer) {
        botStatusContainer.className = `bot-status-container layout-${dashboardSettings.layout || 'grid'}`;
    }
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
        // First, try to get API documentation to understand available endpoints
        let apiDoc = null;
        try {
            const docResponse = await fetch(`/api/bot-proxy?url=${encodeURIComponent(bot.url + '/static/api-doc.html')}`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });
            if (docResponse.ok) {
                const docText = await docResponse.text();
                // Try to extract endpoints from the documentation
                apiDoc = docText;
            }
        } catch (err) {
            // API doc not available, continue with default endpoints
            console.log('Could not fetch API documentation, using default endpoints');
        }

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
                        signal: AbortSignal.timeout(10000) // 10 second timeout
                    });
                } catch (proxyErr) {
                    // If proxy fails, try direct connection
                    try {
                        response = await fetch(`${bot.url}${endpoint}`, {
                            method: 'GET',
                            headers: {
                                'Accept': 'application/json'
                            },
                            signal: AbortSignal.timeout(10000)
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
        const [partyData, statsData, encounterRateData, mapData, emulatorData] = await Promise.all([
            fetchBotEndpoint(bot, baseUrl, '/party'),
            fetchBotEndpoint(bot, baseUrl, '/stats'),
            fetchBotEndpoint(bot, baseUrl, '/encounter_rate'),
            fetchBotEndpoint(bot, baseUrl, '/map'),
            fetchBotEndpoint(bot, baseUrl, '/emulator')
        ]);
        
        // Fetch encounter_log separately with retry logic to handle SQLite cursor errors
        // Add a small delay to avoid conflicts with other concurrent requests
        await new Promise(resolve => setTimeout(resolve, 100));
        const encountersData = await fetchBotEndpointWithRetry(
            bot, 
            baseUrl, 
            ['/encounter_log?limit=10&filter=none', '/encounter_log?limit=10', '/encounter_log?limit=100&filter=all', '/encounter_log', '/opponent', '/encounters'],
            3, // max retries
            500 // initial delay in ms
        );

        // Merge emulator data into status if available
        const mergedStatus = {
            ...statusData,
            ...(emulatorData || {})
        };

        return {
            success: true,
            data: {
                status: mergedStatus,
                party: partyData,
                encounters: encountersData,
                stats: statsData,
                encounter_rate: encounterRateData?.encounter_rate,
                map: mapData,
                emulator: emulatorData
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

async function fetchBotEndpoint(bot, baseUrl, ...endpoints) {
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
                                signal: AbortSignal.timeout(8000)
                            });
                            
                            if (response && response.ok) {
                                try {
                                    const data = await response.json();
                                    console.log(`[${bot.name}] Encounter endpoint '${endpoint}' (${urlToTry}) response:`, data);
                                    console.log(`[${bot.name}] Response keys:`, Object.keys(data || {}));
                                    // Check if we got a good response with encounters
                                    if (data && (Array.isArray(data) || data.encounter_log || data.encounters || data.data)) {
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
                        signal: AbortSignal.timeout(8000)
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
                        signal: AbortSignal.timeout(8000)
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
                    // Other JSON parse errors
                    console.warn(`[${bot.name}] JSON parse error for ${endpoint}:`, jsonErr);
                    continue;
                }
            } else if (response && !response.ok) {
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
    const totalBots = botInstances.length;
    let onlineCount = 0;
    let offlineCount = 0;
    let totalEncounters = 0;
    
    // Count online/offline bots
    document.querySelectorAll('.status-indicator').forEach(indicator => {
        if (indicator.classList.contains('online')) {
            onlineCount++;
        } else if (indicator.classList.contains('offline')) {
            offlineCount++;
        }
    });
    
    // Count total encounters from stats
    document.querySelectorAll('.stat-item').forEach(statItem => {
        const label = statItem.querySelector('.stat-label');
        const value = statItem.querySelector('.stat-value');
        if (label && value && label.textContent.includes('Total Encounters')) {
            const count = parseInt(value.textContent) || 0;
            totalEncounters += count;
        }
    });
    
    const summaryTotalBots = document.getElementById('summaryTotalBots');
    const summaryOnline = document.getElementById('summaryOnline');
    const summaryOffline = document.getElementById('summaryOffline');
    const summaryTotalEncounters = document.getElementById('summaryTotalEncounters');
    
    if (summaryTotalBots) summaryTotalBots.textContent = totalBots;
    if (summaryOnline) summaryOnline.textContent = onlineCount;
    if (summaryOffline) summaryOffline.textContent = offlineCount;
    if (summaryTotalEncounters) summaryTotalEncounters.textContent = totalEncounters;
    
    // Update encounter rate graph if enabled
    if (dashboardSettings.showEncounterRateGraph) {
        renderDashboardEncounterRateChart();
    }
}

// Update bot status display
function updateBotStatus() {
    if (botInstances.length === 0) {
        botStatusContainer.innerHTML = '';
        updateDashboardSummary();
        return;
    }

    botInstances.forEach(async (bot) => {
        // Check if card already exists
        let statusCard = document.getElementById(`bot-status-${bot.id}`);
        
        if (!statusCard) {
            // Create new card if it doesn't exist
            statusCard = createStatusCard(bot);
            botStatusContainer.appendChild(statusCard);
        } else {
            // Update existing card - show loading state
            const indicator = statusCard.querySelector('.status-indicator');
            if (indicator) {
                indicator.textContent = 'Updating...';
                indicator.className = 'status-indicator loading';
            }
        }

        // Fetch and update data
        const result = await fetchBotData(bot);
        updateStatusCard(statusCard, bot, result);
    });
    
    // Update summary after all bots are processed
    setTimeout(() => {
        updateDashboardSummary();
    }, 1000);
}

function createStatusCard(bot) {
    const card = document.createElement('div');
    card.className = 'bot-status-card';
    card.id = `bot-status-${bot.id}`;
    card.innerHTML = `
        <div class="status-card-header">
            <h3>${bot.name}</h3>
            <span class="status-indicator loading">Loading...</span>
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
            <video id="bot-video-player-${bot.id}" class="bot-video-player" autoplay muted playsinline></video>
        </div>
        <div class="status-card-content">
            <div class="loading-spinner"></div>
        </div>
    `;
    
    // Setup event listeners for controls
    setupBotControls(card, bot);
    
    return card;
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
        
        if (response.ok) {
            const responseData = await response.json().catch(() => ({}));
            console.log(`[${bot.name}] Emulation speed set successfully:`, responseData);
        } else {
            const errorText = await response.text().catch(() => '');
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { error: errorText || response.statusText };
            }
            console.error(`[${bot.name}] Failed to set emulation speed:`, errorData);
            console.error(`[${bot.name}] Full error response:`, errorText);
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
        
        if (response.ok) {
            const responseData = await response.json().catch(() => ({}));
            console.log(`[${bot.name}] Video ${enabled ? 'enabled' : 'disabled'} successfully:`, responseData);
        } else {
            const errorText = await response.text().catch(() => '');
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { error: errorText || response.statusText };
            }
            console.error(`[${bot.name}] Failed to set video:`, errorData);
            console.error(`[${bot.name}] Full error response:`, errorText);
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
        
        if (response.ok) {
            const responseData = await response.json().catch(() => ({}));
            console.log(`[${bot.name}] Audio ${enabled ? 'enabled' : 'disabled'} successfully:`, responseData);
        } else {
            const errorText = await response.text().catch(() => '');
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { error: errorText || response.statusText };
            }
            console.error(`[${bot.name}] Failed to set audio:`, errorData);
            console.error(`[${bot.name}] Full error response:`, errorText);
            alert(`Failed to set audio: ${errorData.error || response.statusText}\n\nCheck console for details.`);
        }
    } catch (error) {
        console.error(`[${bot.name}] Error setting audio:`, error);
        alert(`Error setting audio: ${error.message}`);
    }
}

// Start video stream
function startVideoStream(bot, videoElement) {
    // Based on the bot's integrated page, it uses /stream_video with fps and cache_buster
    const fps = 30;
    const cacheBuster = new Date().toString();
    const videoUrl = `${bot.url}/stream_video?fps=${fps}&cache_buster=${encodeURIComponent(cacheBuster)}`;
    const proxyUrl = `/api/bot-video-proxy?url=${encodeURIComponent(videoUrl)}`;
    
    console.log(`[${bot.name}] Starting video stream`);
    console.log(`[${bot.name}] Video URL: ${videoUrl}`);
    console.log(`[${bot.name}] Proxy URL: ${proxyUrl}`);
    
    // Clear previous error handlers and stop any existing stream
    videoElement.onerror = null;
    videoElement.onloadedmetadata = null;
    videoElement.onloadstart = null;
    stopVideoStream(videoElement);
    
    // Set up success handler
    const successHandler = () => {
        console.log(`[${bot.name}] Video stream started successfully`);
    };
    
    // Set up load start handler (fires when video starts loading)
    videoElement.onloadstart = () => {
        console.log(`[${bot.name}] Video stream loading started`);
    };
    
    // Set up error handler
    const errorHandler = (e) => {
        console.error(`[${bot.name}] Video stream error:`, e);
        console.warn(`[${bot.name}] Video stream failed via proxy, trying direct connection...`);
        // Try direct connection as fallback
        videoElement.src = videoUrl;
        videoElement.onerror = (e2) => {
            console.error(`[${bot.name}] Video stream failed on both proxy and direct connection:`, e2);
            alert(`Video stream failed. Check console for details.`);
        };
    };
    
    // Try proxy first (handles CORS)
    videoElement.src = proxyUrl;
    videoElement.onloadedmetadata = successHandler;
    videoElement.onerror = errorHandler;
    
    // Also set a timeout to detect if stream never starts
    setTimeout(() => {
        if (!videoElement.readyState || videoElement.readyState === 0) {
            console.warn(`[${bot.name}] Video stream timeout - no data received after 5 seconds`);
        }
    }, 5000);
}

// Stop video stream
function stopVideoStream(videoElement) {
    if (videoElement) {
        videoElement.pause();
        videoElement.src = '';
        videoElement.load();
    }
}

function updateStatusCard(card, bot, result) {
    const content = card.querySelector('.status-card-content');
    const indicator = card.querySelector('.status-indicator');

    if (!result.success) {
        indicator.textContent = 'Offline';
        indicator.className = 'status-indicator offline';
        content.innerHTML = `
            <div class="error-message">
                <p><strong>Error:</strong> ${result.error || 'Could not connect to bot'}</p>
                <p class="bot-url-display">${bot.url}</p>
            </div>
        `;
        return;
    }

    indicator.textContent = 'Online';
    indicator.className = 'status-indicator online';

    const data = result.data || {};
    const status = data.status || {};
    const emulator = data.emulator || {};
    const party = data.party || [];
    const encounters = data.encounters || [];
    const stats = data.stats || {};
    const map = data.map || {};

    // Debug: log map data structure
    if (map && Object.keys(map).length > 0) {
        console.log(`[${bot.name}] Map data:`, JSON.stringify(map, null, 2));
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

    // Current Location/Map
    if (dashboardSettings.showMap) {
        let mapName = null;
        let mapType = null;
        
        // Try different map data structures
        if (map && map.map && map.map.name) {
            // Structure: { map: { name: "...", type: "..." } }
            mapName = map.map.name;
            mapType = map.map.type;
        } else if (map && map.name) {
            // Structure: { name: "...", type: "..." }
            mapName = map.name;
            mapType = map.type;
        } else if (status.location) {
            // Fallback to status.location
            mapName = status.location;
        } else if (status.currentLocation) {
            // Fallback to status.currentLocation
            mapName = status.currentLocation;
        } else if (map && typeof map === 'object' && Object.keys(map).length > 0) {
            // Try to find name in any property
            mapName = map.name || map.map_name || map.location || map.current_map;
            mapType = map.type || map.map_type;
        }
        
        if (mapName) {
            html += `<div class="status-section">
                <h4>Current Location</h4>
                <p>${mapName}${mapType ? ` (${mapType})` : ''}</p>
            </div>`;
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
            const spriteUrl = getSpriteUrl(speciesId, isShiny);
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

    // Recent Finds
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
        
        // Show most recent encounters first (reverse the list, then take first N)
        const recentEncounters = encounterList.slice().reverse().slice(0, recentFindsCount);
        recentEncounters.forEach(encounter => {
            // Handle different encounter data structures
            let speciesId = 0;
            let speciesName = '#0';
            let level = 0;
            let isShiny = false;
            
            // Try multiple data structure formats
            if (encounter.species) {
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
                const spriteUrl = getSpriteUrl(speciesId, isShiny);
                
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

    // Stats
    // Handle both /stats and /encounter_rate responses
    const encounterRate = data.encounter_rate || (stats && stats.encounter_rate);
    const statsData = stats || {};
    
    // Track encounter rate for graphing (always track, not just when graph is enabled)
    if (encounterRate !== undefined) {
        if (!encounterRateHistory[bot.id]) {
            encounterRateHistory[bot.id] = [];
        }
        const history = encounterRateHistory[bot.id];
        const now = Date.now();
        history.push({ time: now, rate: encounterRate, botName: bot.name });
        // Keep only last 100 data points
        if (history.length > 100) {
            history.shift();
        }
        localStorage.setItem('botEncounterRateHistory', JSON.stringify(encounterRateHistory));
    }
    
    if (dashboardSettings.showStats && statsData && (Object.keys(statsData).length > 0 || encounterRate !== undefined)) {
        html += `<div class="status-section">
            <h4>Statistics</h4>
            <div class="stats-grid">`;
        
        // Encounter rate
        if (encounterRate !== undefined) {
            html += `<div class="stat-item">
                <span class="stat-label">Encounter Rate:</span>
                <span class="stat-value">${encounterRate}/hr</span>
            </div>`;
        }
        
        // Total encounters (from stats)
        if (statsData.total_encounters !== undefined || statsData.totalEncounters !== undefined) {
            html += `<div class="stat-item">
                <span class="stat-label">Total Encounters:</span>
                <span class="stat-value">${statsData.total_encounters || statsData.totalEncounters}</span>
            </div>`;
        }
        
        // Shiny encounters
        if (statsData.shiny_encounters !== undefined || statsData.shinyEncounters !== undefined) {
            html += `<div class="stat-item">
                <span class="stat-label">Shiny Encounters:</span>
                <span class="stat-value">${statsData.shiny_encounters || statsData.shinyEncounters}</span>
            </div>`;
        }
        
        // Play time
        if (statsData.play_time !== undefined || statsData.playTime !== undefined) {
            const playTime = statsData.play_time || statsData.playTime;
            html += `<div class="stat-item">
                <span class="stat-label">Play Time:</span>
                <span class="stat-value">${formatPlayTime(playTime)}</span>
            </div>`;
        }
        
        // Phase - Display detailed phase information
        const phaseData = statsData.current_phase || statsData.currentPhase;
        if (phaseData !== undefined) {
            if (typeof phaseData === 'object' && phaseData !== null) {
                // Format phase object with key information
                const phaseInfo = [];
                
                // Current streak (most important)
                if (phaseData.current_streak) {
                    const streak = phaseData.current_streak;
                    const species = streak.species_name || 'Unknown';
                    const value = streak.value || 0;
                    phaseInfo.push(`Current Streak: ${value} (${species})`);
                }
                
                // Total encounters in phase
                if (phaseData.encounters !== undefined) {
                    phaseInfo.push(`Encounters: ${phaseData.encounters.toLocaleString()}`);
                }
                
                // Start time
                if (phaseData.start_time) {
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
                if (phaseData.highest_iv_sum) {
                    const iv = phaseData.highest_iv_sum;
                    phaseInfo.push(`Best IV: ${iv.value} (${iv.species_name || 'Unknown'})`);
                }
                
                // Longest streak
                if (phaseData.longest_streak) {
                    const streak = phaseData.longest_streak;
                    phaseInfo.push(`Longest: ${streak.value} (${streak.species_name || 'Unknown'})`);
                }
                
                // Pokenav calls
                if (phaseData.pokenav_calls !== undefined) {
                    phaseInfo.push(`Pokenav: ${phaseData.pokenav_calls}`);
                }
                
                // Display as a formatted list
                if (phaseInfo.length > 0) {
                    html += `<div class="status-section">
                        <h4>Current Phase</h4>
                        <div class="phase-info">`;
                    
                    phaseInfo.forEach(info => {
                        html += `<div class="phase-info-item">${info}</div>`;
                    });
                    
                    html += `</div></div>`;
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
        }
        
        html += `</div></div>`;
    }

    if (!html) {
        html = '<p>No data available</p>';
    }

    // Only update the content, not the entire card
    const existingContent = card.querySelector('.status-card-content');
    if (existingContent) {
        existingContent.innerHTML = html;
    } else {
        content.innerHTML = html;
    }
    
    // Update the dashboard summary chart after updating this bot
    if (dashboardSettings.showEncounterRateGraph) {
        setTimeout(() => {
            renderDashboardEncounterRateChart();
        }, 100);
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

function renderDashboardEncounterRateChart() {
    const canvas = document.getElementById('dashboardEncounterRateChart');
    const container = document.getElementById('encounterRateGraphContainer');
    if (!canvas || !container || typeof Chart === 'undefined') return;
    
    // Collect all bot histories
    const datasets = [];
    let allTimestamps = new Set();
    let hasData = false;
    
    // First pass: collect all timestamps from all bots
    botInstances.forEach((bot) => {
        const history = encounterRateHistory[bot.id];
        if (history && history.length > 0) {
            hasData = true;
            history.forEach(point => {
                allTimestamps.add(point.time);
            });
        }
    });
    
    if (!hasData) {
        container.style.display = 'none';
        if (canvas.chart) {
            canvas.chart.destroy();
            canvas.chart = null;
        }
        return;
    }
    
    container.style.display = 'block';
    
    // Sort timestamps
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
    const labels = sortedTimestamps.map(ts => {
        const date = new Date(ts);
        return date.toLocaleTimeString();
    });
    
    // Create datasets for ALL bots (even if they don't have data yet)
    botInstances.forEach((bot, index) => {
        const history = encounterRateHistory[bot.id];
        const color = botColors[index % botColors.length];
        
        if (history && history.length > 0) {
            // Map data points to sorted timestamps
            const data = sortedTimestamps.map(timestamp => {
                // Find the closest data point to this timestamp
                let closestPoint = null;
                let minDiff = Infinity;
                
                history.forEach(point => {
                    const diff = Math.abs(point.time - timestamp);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestPoint = point;
                    }
                });
                
                // Only use if within 5 seconds (5000ms)
                return (minDiff < 5000 && closestPoint) ? closestPoint.rate : null;
            });
            
            datasets.push({
                label: bot.name || `Bot ${index + 1}`,
                data: data,
                borderColor: color.border,
                backgroundColor: color.background,
                tension: 0.1,
                fill: false,
                pointRadius: 2,
                pointHoverRadius: 4
            });
        } else {
            // Include bot even if no data yet (with empty dataset, visible by default)
            // Use a very small value instead of null so the line can be shown when enabled
            datasets.push({
                label: bot.name || `Bot ${index + 1}`,
                data: sortedTimestamps.map(() => 0), // Use 0 instead of null so Chart.js doesn't auto-hide
                borderColor: color.border,
                backgroundColor: color.background,
                tension: 0.1,
                fill: false,
                pointRadius: 0, // No points for empty data
                pointHoverRadius: 0,
                borderWidth: 1,
                spanGaps: true, // Allow gaps in the line
                showLine: true // Show the line even with 0 data
            });
        }
    });
    
    console.log(`[Chart] Rendering ${datasets.length} bot datasets (${botInstances.length} total bots)`);
    
    // Destroy existing chart if it exists
    if (canvas.chart) {
        canvas.chart.destroy();
    }
    
    // Create chart with all bots
    canvas.chart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    onClick: function(e, legendItem, legend) {
                        // Prevent default behavior
                        e.stopPropagation();
                        
                        // Get the chart instance
                        const chart = legend.chart;
                        const index = legendItem.datasetIndex;
                        const meta = chart.getDatasetMeta(index);
                        
                        // Toggle visibility - Chart.js uses null for visible, true for hidden
                        if (meta.hidden === null || meta.hidden === false) {
                            meta.hidden = true;
                        } else {
                            meta.hidden = null; // null means visible in Chart.js
                        }
                        
                        // Update the chart without animation to prevent flickering
                        chart.update('none');
                        
                        // Return false to prevent default Chart.js behavior
                        return false;
                    }
                },
                tooltip: {
                    filter: function(tooltipItem) {
                        // Only show tooltips for data points that have actual data (not 0 from empty datasets)
                        // Check if this is a real data point by looking at the dataset
                        const dataset = tooltipItem.dataset;
                        // If all values are 0, it's likely an empty dataset - don't show tooltip
                        const hasRealData = dataset.data.some(val => val !== null && val !== 0 && val !== undefined);
                        if (!hasRealData) return false;
                        // For datasets with real data, only show if value is not 0
                        return tooltipItem.parsed.y !== null && tooltipItem.parsed.y !== 0;
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Encounters per Hour'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Time'
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
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
                    showEncounterStats(speciesId, encounter);
                } catch (err) {
                    console.error('Error parsing encounter data:', err);
                    // Fallback to Pokedex info
                    if (speciesId > 0) {
                        showPokemonInfo(speciesId);
                    }
                }
            } else if (speciesId > 0) {
                // Fallback to Pokedex info if no encounter data
                showPokemonInfo(speciesId);
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
    let nature = 'Unknown';
    if (pokemonData.nature) {
        if (typeof pokemonData.nature === 'string') {
            nature = pokemonData.nature;
        } else if (typeof pokemonData.nature === 'object' && pokemonData.nature.name) {
            nature = pokemonData.nature.name;
        }
    } else if (pokemonData.nature_name) {
        nature = pokemonData.nature_name;
    }
    
    // Extract ability - handle both string and object formats
    let ability = 'Unknown';
    if (pokemonData.ability) {
        if (typeof pokemonData.ability === 'string') {
            ability = pokemonData.ability;
        } else if (typeof pokemonData.ability === 'object' && pokemonData.ability.name) {
            ability = pokemonData.ability.name;
        } else if (typeof pokemonData.ability === 'number') {
            ability = `Ability ${pokemonData.ability}`;
        }
    } else if (pokemonData.ability_name) {
        ability = pokemonData.ability_name;
    } else if (pokemonData.ability_slot) {
        ability = `Ability Slot ${pokemonData.ability_slot}`;
    }
    
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

function getSpriteUrl(speciesId, isShiny) {
    // Use PokeAPI sprites
    if (speciesId > 0 && speciesId <= 1025) {
        const paddedId = String(speciesId).padStart(3, '0');
        return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${isShiny ? 'shiny/' : ''}${speciesId}.png`;
    }
    return '';
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
        const mode = status.mode || status.bot_mode || status.game_mode || status.gameMode || 'Unknown';
        modeDisplay.textContent = mode;
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

// Polling
let pollingInterval = null;

function startPolling() {
    // Stop existing polling if any
    stopPolling();
    
    // Update immediately
    updateBotStatus();
    
    // Get update interval from settings
    const intervalSeconds = dashboardSettings.updateInterval || 5;
    const intervalMs = intervalSeconds * 1000;
    
    // Then update at the specified interval
    pollingInterval = setInterval(() => {
        updateBotStatus();
    }, intervalMs);
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopPolling();
});

