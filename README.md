# .pk* Save Manager - Alpha version

<div align="center">

**A comprehensive web-based viewer and manager for Pokémon files across multiple generations**

[![Version](https://img.shields.io/badge/version-0.1.0--alpha-blue.svg)](package.json)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)](https://nodejs.org/)

</div>

---

## 📋 Overview

Gen3 Save Manager is a powerful, web-based application for viewing, managing, and analyzing Pokémon files from Generations 3-7 (`.pk3`, `.pk4`, `.pk5`, `.pk6`, `.pk7`) and Generation 3 save files (`.sav`) from Pokémon Ruby, Sapphire, Emerald, FireRed, and LeafGreen.

Perfect for Pokémon collectors, breeders, and bot operators who need to organize, analyze, and manage large collections of Pokémon files.

<img width="2214" height="1275" alt="image" src="https://github.com/user-attachments/assets/4c1641ab-33c9-4fd5-ab1c-7c11ffb0786c" />

<img width="2022" height="1266" alt="image" src="https://github.com/user-attachments/assets/ab6f2eb7-63d9-49d8-bb69-f3ac63210ee8" />




---

## ✨ Key Features

### 🎮 Multi-Generation Support
- **Generation 3**: `.pk3` files (Ruby, Sapphire, Emerald, FireRed, LeafGreen)
- **Generation 4**: `.pk4` files (Diamond, Pearl, Platinum, HeartGold, SoulSilver)
- **Generation 5**: `.pk5` files (Black, White, Black 2, White 2)
- **Generation 6**: `.pk6` files (X, Y, Omega Ruby, Alpha Sapphire)
- **Generation 7**: `.pk7` files (Sun, Moon, Ultra Sun, Ultra Moon)

### 📊 Advanced Viewing & Analysis
- **Card-based Display**: Beautiful Pokémon cards with sprites, stats, and metadata

- **Detailed Modal Views**: Complete IV/EV breakdowns with interactive charts
  <img width="943" height="1184" alt="image" src="https://github.com/user-attachments/assets/236416af-56f0-4d8e-8a9c-4285aeca2b78" />
- **Pokédex Viewer**: Browse all Pokémon with detailed information
  <img width="1242" height="1194" alt="image" src="https://github.com/user-attachments/assets/d68cce24-8bd6-4a56-a8f3-f0fe67f9942d" />

- **Map Viewer**: Visual location data for Pokémon encounters WIP
- **Completion Planner**: Plan your Pokédex completion with encounter requirements

<img width="1271" height="842" alt="image" src="https://github.com/user-attachments/assets/479048f8-0e6a-428b-a1ce-f7a0bf85d665" />

### 🔍 Powerful Filtering & Sorting
- **Advanced Filters**: IV ranges, EV ranges, nature, ability, ball type, and more
  <img width="636" height="257" alt="image" src="https://github.com/user-attachments/assets/091d6f21-631c-4bf9-a070-36ba911a1389" />
  <img width="447" height="1277" alt="image" src="https://github.com/user-attachments/assets/39e4422a-cbc8-465e-9dce-d11e21a47ba2" />

- **Multiple Sort Options**: Sort by IV sum, species, level, stats, and more
- **Grouping**: Organize by OT name or TID/SID combinations
- **Search**: Quick search by species name or nickname
  <img width="662" height="312" alt="image" src="https://github.com/user-attachments/assets/20877cae-66e9-49ce-9e86-9a381f2fae3c" />
### 📈 Comprehensive Statistics
- **Database Statistics**: Total Pokémon, unique species, shiny counts
- **IV Statistics**: 
  - Average, max, and min IV sums
  - IV sum category distribution (186, 180-185, 170-179, etc.)
  - Highest IV shiny and non-shiny Pokémon
  - Per-stat averages
- **Trend Analysis**: 7-day growth graphs
- **Distribution Charts**: Species, natures, abilities, balls, locations, and more

<img width="1416" height="1164" alt="image" src="https://github.com/user-attachments/assets/d6cbbe8b-3ba2-4c0d-a9ca-96b8c7d9e630" />

### 🤖 Bot Dashboard
- **Multi-Bot Monitoring**: Monitor multiple PokeBotGen-3 instances simultaneously
- **Real-time Updates**: Live status updates via Server-Sent Events or polling
- **Bot Status Cards**: View party, encounters, stats, map location, and more
- **Target Pokémon Tracking**: Set and track target Pokémon for each bot
- **Encounter Rate Graphs**: Visualize encounter rates over time
- **Combined Statistics**: Aggregate data across all bots
  
<img width="2063" height="1180" alt="image" src="https://github.com/user-attachments/assets/3bedfd20-2aec-4fa3-a5d5-1b04a94266d9" />

### 📁 File Management
- **Multiple Databases**: Manage up to 4+ custom database folders
- **Folder Scanner**: Auto-scan and organize Pokémon files from any folder
- **Auto-Move**: Automatically move files to selected databases
- **Duplicate Detection**: Find exact and potential duplicates
- **Save File Support**: Import/export Generation 3 save files (WIP)

### 🎨 User Interface
- **Light/Dark Themes**: Toggle between light and dark modes
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Dynamic Layout**: Automatically adapts to screen size
- **Customizable Display**: Adjustable card width and display limits

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v14.0.0 or higher
- **npm** (comes with Node.js)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/gen3-save-manager.git
   cd gen3-save-manager
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000`

### First Time Setup

1. **Create database folders** (optional - created automatically):
   - Run the server from the desired directory; `pk3-files/` (Database 1) is created there
   - Or add custom folders via "Manage Folders" (paths can be relative to current directory or absolute)

2. **Add your Pokémon files:**
   - Copy `.pk3`, `.pk4`, `.pk5`, `.pk6`, or `.pk7` files to your database folders
   - Files are automatically detected and loaded

---

## 📖 Usage Guide

### Viewing Pokémon

- **Auto-load**: Pokémon are automatically loaded when the page opens
- **Refresh**: Click "Refresh Pokemon" to reload from the selected database
- **Card View**: Browse Pokémon in a responsive grid layout
- **Detailed View**: Click any card to see full details with IV/EV charts

### Filtering & Sorting


- **Quick Search**: Type in the search box to filter by species or nickname
- **Shiny Filter**: Toggle "Show Only Shiny" to see only shiny Pokémon
- **Advanced Filters**: Click "Advanced Filters" for detailed filtering options
- **Sort Options**: Use the dropdown to sort by various criteria
- **Grouping**: Enable "Group by OT" or "Group by TID/SID" for organization

### Statistics

- Click **"Statistics"** to view comprehensive database analytics
- Review IV distributions, species counts, trends, and more
- Statistics update in real-time based on your current database

### Bot Dashboard

1. Click **"Bot Dashboard"** from the main page
2. Click **"Add Bot"** to add a PokeBotGen-3 instance
3. Enter bot name, hostname/IP, and port
4. Monitor bot status, encounters, and statistics in real-time
5. Set target Pokémon for each bot instance

### Folder Scanner

1. Open **"Advanced Options"** → **"Folder Scanner"**
2. Enter source folder path (relative or absolute)
3. Select target database
4. Enable auto-scan for continuous monitoring (optional)
5. Click **"Scan and Move Files"** to start

### Duplicate Management

1. Open **"Advanced Options"** → **"Scan Duplicates"**
2. Review exact duplicates (same PID) and potential duplicates (same species + IVs)
3. Delete duplicate files directly from the results

---

## 📁 File Formats

### Pokémon Files

| Format | Generation | Size | Supported Games | Save Import |
|--------|-----------|------|----------------|-------------|
| `.pk3` | Gen 3 | 80/100 bytes | Ruby, Sapphire, Emerald, FireRed, LeafGreen | ✅ WIP |
| `.pk4` | Gen 4 | 136/236 bytes | Diamond, Pearl, Platinum, HeartGold, SoulSilver | ❌ View only |
| `.pk5` | Gen 5 | 136/236 bytes | Black, White, Black 2, White 2 | ❌ View only |
| `.pk6` | Gen 6 | 232/260 bytes | X, Y, Omega Ruby, Alpha Sapphire | ❌ View only |
| `.pk7` | Gen 7 | 232/260 bytes | Sun, Moon, Ultra Sun, Ultra Moon | ❌ View only |

### Save Files

- **Format**: Generation 3 save file (`.sav`)
- **Size**: 128 KB
- **Supported Games**: Ruby, Sapphire, Emerald, FireRed, LeafGreen
- **Features**:
  - 14 PC boxes (30 slots each = 420 total slots)
  - 6 party slots
  - Automatic checksum recalculation
  - Proper encryption/decryption

> **Note**: Save file import/export features are currently work-in-progress (WIP)

---

## 🏗️ Architecture

### Technology Stack
- **Backend**: Node.js with Express
- **Frontend**: Vanilla JavaScript (no frameworks)
- **Data Source**: PokeAPI for sprites, names, and metadata
- **Charts**: Chart.js for data visualization

### Project Structure
```
gen3-save-manager/
├── parsers/           # Pokémon file parsers
│   ├── pk3-parser.js
│   ├── pk4-parser.js
│   ├── pk6-parser.js
│   ├── pk7-parser.js
│   └── sav3-parser.js
├── public/            # Frontend files
│   ├── app.js         # Main application logic
│   ├── bot-dashboard.js
│   ├── index.html
│   └── style.css
├── data/              # Cached API data
├── scripts/           # Utility scripts
├── server.js          # Express server
└── package.json
```

### API Endpoints

#### Pokémon Files
- `GET /api/pokemon` - Get all Pokémon from selected database
- `GET /api/pokemon/:filename` - Get parsed Pokémon data
- `GET /api/pokemon/file/:filename` - Get raw file data
- `DELETE /api/pokemon/:filename` - Delete a Pokémon file

#### Databases
- `GET /api/databases` - Get list of databases
- `POST /api/databases` - Add a new database folder
- `PUT /api/databases/:id` - Update folder name
- `DELETE /api/databases/:id` - Remove a folder
- `POST /api/databases/reorder` - Reorder folders
- `POST /api/databases/scan-and-move` - Scan and move files

#### Bot Management
- `GET /api/bots` - Get all bot instances
- `POST /api/bots` - Add a bot instance
- `PUT /api/bots/:id` - Update a bot instance
- `DELETE /api/bots/:id` - Remove a bot instance
- `GET /api/bot-targets` - Get bot target Pokémon
- `POST /api/bot-targets/:botId` - Set bot target Pokémon

#### Scanner
- `GET /api/scanner/config` - Get scanner configuration
- `POST /api/scanner/config` - Update scanner configuration

---

## 🎯 Statistics Features



### IV Statistics
- **Summary**: Average, max, and min IV sums
- **Categories**: Distribution across IV sum ranges:
  - 186 (perfect)
  - 180-185
  - 170-179
  - 150-169
  - 130-149
  - 100-129
  - 70-99
  - 50-69
  - 11-49
  - 10-0
- **Best Pokémon**: Highest IV shiny and non-shiny Pokémon with full IV breakdown
- **Per-Stat Averages**: Average IVs for HP, Attack, Defense, Sp. Atk, Sp. Def, Speed

### Other Statistics
- **Overview**: Total Pokémon, unique species, shiny count, shiny rate
- **Trends**: 7-day growth graph
- **Top Lists**: Most common species, shiny species, OTs, natures, abilities, balls, locations
- **Distributions**: Level, EV, origin game, TID/SID combinations

---

## 🔧 Configuration

### Server (host & port)
- Copy `server-config.example.json` to `server-config.json` (in the directory you run the server from) to set the IP and port.
- **`host`**: Bind address. Use `0.0.0.0` to listen on all interfaces (other devices can connect; Windows may show a firewall prompt). Use `127.0.0.1` for localhost only.
- **`port`**: Port number (default `3000`).
- You can also override with environment variables: `HOST=127.0.0.1 PORT=3001 node server.js`.

### Database Folders
- **Default**: One database at `pk3-files/` (created in the directory where you run the server)
- Custom folders can be added via "Manage Folders"
- Folders are stored in `folders-config.json` in the **current working directory** (not committed to git)
- Copy `folders-config.example.json` to `folders-config.json` to use a portable relative path

### Bot Configuration
- Bot instances stored in `bots-config.json` (in current working directory, not committed to git)
- Bot targets stored in `bot-targets.json` (in current working directory, not committed to git)

### Scanner Configuration
- Scanner settings stored in `scanner-config.json` (in current working directory, not committed to git)
- Auto-scan runs server-side and persists across restarts


---

## 📝 Notes

- **Internet Connection**: Required for initial load (PokeAPI for sprites and data)
- **Supported Species**: Generations 1-7 (National Dex #1-807)
- **Save File Import**: Currently WIP - only `.pk3` files supported
- **Performance**: Optimized with indexing and caching for large collections
- **Data Privacy**: All data stays local - no external data transmission

---

## 🐛 Troubleshooting

### Pokémon Not Showing
- ✅ Check files are in the correct database folder
- ✅ Verify files are valid Pokémon formats (`.pk3`, `.pk4`, `.pk5`, `.pk6`, `.pk7`)
- ✅ Check browser console for errors
- ✅ Ensure species IDs are valid (1-807)

### Sprites Not Loading
- ✅ Check internet connection (sprites load from PokeAPI)
- ✅ Verify Pokémon species ID is valid
- ✅ Check browser console for API errors

### Bot Dashboard Not Loading
- ✅ Ensure PokeBotGen-3 instances are running
- ✅ Verify bot URLs and ports are correct
- ✅ Check browser console for connection errors

### Statistics Not Showing
- ✅ Ensure you have valid Pokémon in your database
- ✅ Check that species names are loading (requires internet)
- ✅ Verify browser console for any errors

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 🙏 Credits

- **PKHeX**: Save file format reference and parsing logic
- **PokeAPI**: Pokémon data, sprites, and information
- **Chart.js**: Data visualization library
- Built with Node.js, Express, and vanilla JavaScript

---

## ⚠️ Alpha Release Notice

This is an **alpha release** (v0.1.0-alpha). Some features are still work-in-progress:

- ⚠️ Save file import/export (WIP)
- ⚠️ Evolution features (hidden, WIP)
- ⚠️ Some advanced features may have bugs

Please report any issues you encounter!

---

<div align="center">

**Made with ❤️ for the Pokémon community**

</div>
