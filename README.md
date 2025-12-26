# Gen3 Save Manager

A comprehensive web-based viewer and manager for Pokémon files across multiple generations (`.pk3`, `.pk4`, `.pk5`, `.pk6`, `.pk7`) and Generation 3 save files (`.sav`) from Pokémon Ruby, Sapphire, Emerald, FireRed, and LeafGreen.

## Features

### Core Functionality

- **Multi-Generation Pokémon File Viewer**: View and analyze Pokémon files from Generations 3-7
  - Generation 3: `.pk3` files (Ruby, Sapphire, Emerald, FireRed, LeafGreen)
  - Generation 4: `.pk4` files (Diamond, Pearl, Platinum, HeartGold, SoulSilver)
  - Generation 5: `.pk5` files (Black, White, Black 2, White 2)
  - Generation 6: `.pk6` files (X, Y, Omega Ruby, Alpha Sapphire)
  - Generation 7: `.pk7` files (Sun, Moon, Ultra Sun, Ultra Moon)
- **Save File Management**: Load, edit, and export Generation 3 `.sav` save files
- **Multiple Databases**: Switch between up to 4 different Pokémon databases/folders (expandable via folder management)
- **Auto-load**: Automatically loads Pokémon when the page opens
- **Folder Management**: Add, remove, and reorder custom database folders

### Viewing & Display

- **Pokémon Cards**: Card-based display showing:
  - Pokémon sprite (with shiny variants)
  - Species name and nickname
  - Level, HP, and calculated stats
  - IV Sum (sum of all 6 IVs)
  - Nature and Ability
  - Origin Game and Met Location (full location names)
  - Pokéball type (name and thumbnail)
  - OT Name, TID, and SID
  - Shiny indicator
- **Compact View**: Toggle to show only essential information (Name, Sprite, IV Sum)
- **Detailed Modal**: Click any Pokémon card to view:
  - Full Pokémon sprite (shiny if applicable)
  - Complete IV and EV breakdown
  - Interactive IV/EV charts (Bar and Radar charts)
  - All 4 moves with type icons
  - Complete metadata (Origin Game, Met Location, Ball, etc.)
  - Calculated stats based on base stats from PokeAPI
  - Delete button with confirmation
- **Customizable Display**:
  - Adjustable card width (220px - 700px)
  - Maximum display limit (0 = unlimited)
  - Responsive grid layout

### Sorting & Filtering

#### Sorting Options

- **IV Sum** (High to Low / Low to High)
- **EV Sum** (High to Low / Low to High)
- **Species** (Alphabetical)
- **Level** (High to Low / Low to High)
- **Individual Stats** (HP, Attack, Defense, Sp. Attack, Sp. Defense, Speed)
- **Individual IVs** (HP, Attack, Defense, Sp. Attack, Sp. Defense, Speed)
- **Experience** (High to Low)
- **OT Name / Origin Game** (Alphabetical)
- **Filename** (Alphabetical)
- **Date** (Newest First / Oldest First)

#### Filtering Options

- **Search Bar**: Filter by species name or nickname
- **Shiny Filter**: Show only shiny Pokémon
- **Advanced Filters Panel** with:
  - IV Sum range (0-186)
  - Individual IV ranges for all 6 stats (0-31 each)
  - EV Sum range (0-510)
  - Level range (1-100)
  - HP Stat range
  - Nature selection (all 25 natures)
  - Origin Game filter
  - Ball Type filter
  - Shiny toggle
  - Has Nickname filter
  - OT Name filter
  - TID range filter

### Grouping

- **Group by OT**: Organize Pokémon by Original Trainer (includes TID/SID and Game Version for uniqueness)
- **Group by TID/SID**: Group Pokémon by Trainer ID and Secret ID pairs
- Collapsible groups for easy navigation

### Statistics

Comprehensive database statistics including:

- **Overview**: Total Pokémon, Unique Species, Shiny Count, Shiny Rate
- **7-Day Trend Graph**: Visual representation of Pokémon count over the last 7 days
- **Most Common Pokémon**: Top 10 species with counts and percentages
- **Most Common Shiny Pokémon**: Top 10 shiny species
- **IV Statistics**: Average IV Sum and per-stat averages
- **EV Statistics**: Average EV Sum and per-stat averages
- **Level Statistics**: Average, Max, Min levels with distribution breakdown
- **Top OT Names**: Most common Original Trainer names
- **Origin Game Distribution**: Breakdown by game version
- **Top Natures**: Most common natures
- **Top Abilities**: Most common abilities
- **Top Pokeballs**: Most common ball types
- **Top Met Locations**: Most common catch locations
- **Top TID/SID Combinations**: Most common trainer ID pairs

### Duplicate Management

- **Duplicate Scanner**: Identifies:
  - **Exact Duplicates**: Same Personality Value (PID)
  - **Potential Duplicates**: Same Species, IVs, and Level
- **Side-by-side Comparison**: View duplicates together
- **Delete Functionality**: Remove duplicate files directly from the scanner

### Save File Management

- **Load Save Files**: Import Generation 3 `.sav` files (Ruby, Sapphire, Emerald, FireRed, LeafGreen)
- **Import Pokémon**:
  - **File Selection**: Select `.pk3` files from your computer (only `.pk3` files can be imported to save files)
  - **Select from Viewer**: Select Pokémon cards and import them
  - **Auto-slot Finding**: Automatically finds empty box or party slots
  - **Box Import**: Import to PC boxes (14 boxes × 30 slots = 420 total slots)
  - **Party Import**: Import to party (6 slots)
  - **Start from Last Box**: Option to fill boxes from the end
  - **Lottery Select**: Automatically select one Pokémon per TID/SID combination for lottery systems
- **Export Save Files**: Download modified save files with updated checksums

### Folder Scanner

- **Recursive Scanning**: Scan folders recursively for Pokémon files
- **Auto-Move**: Automatically move found files to selected database
- **Auto-Rename**: Automatically rename files with same name but different content
- **Auto-Scan**: Optional automatic scanning at configurable intervals (minimum 1 minute)
- **Status Display**: Real-time scanning progress and results

### User Interface

- **Light/Dark Mode**: Toggle between light (blue-tinted) and dark themes
- **Responsive Design**: Works on desktop, tablet, and mobile devices (desktop layout enforced on mobile)
- **Dynamic Layout**: Automatically adjusts to screen size
- **Performance Optimized**: 
  - Indexed sorting and grouping for fast operations
  - Cached sprites and API data
  - Batch API calls for species names

### Data Visualization

- **IV Charts**: Visual representation of Individual Values
  - Bar Chart
  - Radar Chart
- **EV Charts**: Visual representation of Effort Values
  - Bar Chart
  - Radar Chart
- **Type Icons**: Move type indicators from PokeAPI
- **Ball Thumbnails**: Visual ball type indicators

## Setup

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installation

1. **Clone or download the repository**

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create Pokémon database folders** (optional - they will be created automatically):
   ```
   gen3-save-manager/
   ├── pk3-files/        # Database 1 (default)
   ├── pk3-files-2/      # Database 2
   ├── pk3-files-3/      # Database 3
   ├── pk3-files-4/      # Database 4
   └── ...
   ```

4. **Place your Pokémon files** (`.pk3`, `.pk4`, `.pk5`, `.pk6`, `.pk7`) in one of the database folders

5. **Start the server:**
   ```bash
   npm start
   ```

6. **Open your browser** and navigate to `http://localhost:3000`

## Usage

### Viewing Pokémon

1. **Select a Database**: Use the dropdown to switch between your databases
2. **Pokémon Auto-load**: Pokémon are automatically loaded when the page opens
3. **Refresh**: Click "Refresh Pokemon" to reload from the selected database
4. **Adjust Display**: Use the card width slider and max display limit to customize the view

### Sorting Pokémon

1. Use the **"Sort by"** dropdown to select a sorting method
2. Pokémon are automatically sorted and displayed

### Grouping Pokémon

1. Check **"Group by OT"** to organize by Original Trainer (includes TID/SID/Game)
2. Check **"Group by TID/SID"** to group by Trainer ID pairs
3. Groups are collapsible for easy navigation

### Searching & Filtering

1. **Quick Search**: Type in the search box to filter by species name or nickname
2. **Shiny Filter**: Check "Show Only Shiny" to see only shiny Pokémon
3. **Advanced Filters**: Click "Advanced Filters" button to open the filter panel
   - Set ranges for IVs, EVs, Level, HP, etc.
   - Select specific Natures, Origin Games, or Ball Types
   - Apply multiple filters simultaneously

### Viewing Details

1. **Click any Pokémon card** to open the detailed modal view
2. **View IV/EV Charts**: Use the chart type toggles to switch between Bar and Radar charts
3. **Delete Pokémon**: Click the delete button in the modal (with confirmation)

### Statistics

1. Click **"Statistics"** button to view comprehensive database statistics
2. Review overview, trends, distributions, and top items
3. Statistics are calculated in real-time from your current database

### Duplicate Scanning

1. Click **"Scan Duplicates"** button (in Advanced Options)
2. Review exact and potential duplicates
3. Delete duplicate files directly from the results

### Folder Management

1. Click **"Manage Folders"** button
2. View current folders and their paths
3. Add new folders with custom names and paths
4. Remove or reorder folders as needed

### Folder Scanner

1. Open **"Advanced Options"** modal
2. Navigate to **"Folder Scanner"** section
3. Enter source folder path (relative or absolute)
4. Select target database
5. Optionally enable auto-scan with interval
6. Click **"Scan and Move Files"** to start

### Save File Management

1. **Load a Save File**:
   - Click **"Load Save File"** button (in Advanced Options or Save File section)
   - Select a `.sav` file from your computer
   - The save file status will show "Loaded"

2. **Import Pokémon**:
   - **Method 1 - File Selection**:
     - Select `.pk3` files from your computer (only `.pk3` files supported for save file import)
     - Select import target (Box or Party)
     - Files are automatically imported to empty slots
   - **Method 2 - Select from Viewer**:
     - Check the boxes on Pokémon cards you want to import (only `.pk3` files)
     - Click **"Import Selected Pokemon"**
     - Select import target (Box or Party)
   - **Lottery Select**: Click "Lottery Select" to automatically select one Pokémon per TID/SID combination
   - **Start from Last Box**: Check this option to fill boxes from the end instead of the beginning

3. **Export Save File**:
   - Click **"Export Save File"** button
   - The modified save file will download
   - Checksums are automatically recalculated

## File Formats

### Pokémon Files

#### .pk3 Files (Generation 3)
- **Format**: Generation 3 Pokémon data format
- **Size**: 80 bytes (stored) or 100 bytes (PKHeX export/party format)
- **Supported Formats**:
  - Raw 80-byte stored format
  - PKHeX 100-byte export format (32-byte header + 80 bytes data)
  - Party format (80 bytes + 20 bytes party stats)
- **Supported Games**: Ruby, Sapphire, Emerald, FireRed, LeafGreen
- **Import to Save Files**: Yes (only format supported for save file import)

#### .pk4 Files (Generation 4)
- **Format**: Generation 4 Pokémon data format
- **Size**: 136 bytes (stored) or 236 bytes (PKHeX export format)
- **Supported Games**: Diamond, Pearl, Platinum, HeartGold, SoulSilver
- **Import to Save Files**: No (viewing only)

#### .pk5 Files (Generation 5)
- **Format**: Generation 5 Pokémon data format
- **Size**: 136 bytes (stored) or 236 bytes (PKHeX export format)
- **Supported Games**: Black, White, Black 2, White 2
- **Import to Save Files**: No (viewing only)

#### .pk6 Files (Generation 6)
- **Format**: Generation 6 Pokémon data format
- **Size**: 232 bytes (stored) or 260 bytes (PKHeX export format)
- **Supported Games**: X, Y, Omega Ruby, Alpha Sapphire
- **Import to Save Files**: No (viewing only)

#### .pk7 Files (Generation 7)
- **Format**: Generation 7 Pokémon data format
- **Size**: 232 bytes (stored) or 260 bytes (PKHeX export format)
- **Supported Games**: Sun, Moon, Ultra Sun, Ultra Moon
- **Import to Save Files**: No (viewing only)

### .sav Files

- **Format**: Generation 3 save file format
- **Size**: 128 KB
- **Supported Games**:
  - Pokémon Ruby
  - Pokémon Sapphire
  - Pokémon Emerald
  - Pokémon FireRed
  - Pokémon LeafGreen
- **Features**:
  - 14 PC boxes (30 slots each = 420 total slots)
  - 6 party slots
  - Automatic checksum recalculation
  - Proper encryption/decryption using Gen 3 algorithms

## Technical Details

### Data Sources

- **PokeAPI**: Used for:
  - Pokémon sprites (regular and shiny)
  - Species names
  - Move names
  - Base stats
  - Ability names
  - Type icons
  - Ball images

### Parsing

The application includes parsers for multiple Pokémon file formats:

- **PK3 Parser**: Based on PKHeX's internal structure
  - Accurate species ID conversion (handles Gen 3 internal numbering)
  - Proper OT name decoding (Gen 3 character encoding)
  - Correct IV/EV extraction
  - Nature calculation from Personality Value
  - Shiny detection (Gen 3 formula)
  - Origin Game, Met Location, and Ball extraction

- **PK4/PK5 Parser**: Generation 4 and 5 support
  - UTF-16LE string decoding
  - Location name mapping for Gen 4/5
  - Ball and nature name conversion
  - Game version mapping

- **PK6 Parser**: Generation 6 support
  - Location name mapping for Gen 6
  - Full metadata extraction

- **PK7 Parser**: Generation 7 support
  - Location name mapping for Gen 7
  - Virtual Console game support
  - Full metadata extraction

- **SAV3 Parser**: Based on PKHeX's save file structure
  - Sector-based save file organization
  - Proper encryption/decryption (block shuffling + XOR)
  - Checksum calculation and validation
  - Box and party slot management

### Performance

- **Indexing**: Pre-computed sort and group keys for fast operations
- **Caching**: Client-side caching of:
  - Sprite URLs
  - Species names
  - Move names
  - Base stats
  - Ability data
  - Ball images
  - Type icons

### Architecture

- **Backend**: Node.js with Express
- **Frontend**: Vanilla JavaScript (no frameworks)
- **Parsers**: Modular parser system in `parsers/` directory
  - `pk3-parser.js`: Generation 3 Pokémon files
  - `pk4-parser.js`: Generation 4 and 5 Pokémon files
  - `pk6-parser.js`: Generation 6 Pokémon files
  - `pk7-parser.js`: Generation 7 Pokémon files
  - `sav3-parser.js`: Generation 3 save files
  - `pk-utils.js`: Shared utilities for all parsers

## API Endpoints

### Pokémon Files

- `GET /api/pokemon` - Get all Pokémon from selected database
- `GET /api/pokemon/:filename` - Get parsed Pokémon data for a specific file
- `GET /api/pokemon/file/:filename` - Get raw Pokémon file data
- `DELETE /api/pokemon/:filename` - Delete a Pokémon file

### Databases

- `GET /api/databases` - Get list of available databases
- `POST /api/databases` - Add a new folder/database
- `PUT /api/databases/:id` - Update a folder's name
- `DELETE /api/databases/:id` - Remove a folder
- `POST /api/databases/reorder` - Reorder folders
- `POST /api/databases/scan-and-move` - Scan folder and move files to database

### Save Files

- `POST /api/save/load` - Load a `.sav` file
- `GET /api/save/export` - Export the loaded save file
- `POST /api/save/import` - Import Pokémon into save file (only `.pk3` files)
- `GET /api/save/box/:box/slot/:slot` - Get Pokémon from box slot
- `GET /api/save/party/:slot` - Get Pokémon from party slot

## Browser Compatibility

- Modern browsers with ES6+ support
- Tested on:
  - Chrome/Edge (latest)
  - Firefox (latest)
  - Safari (latest)
- Desktop layout enforced on mobile devices

## Notes

- Pokémon sprites are loaded from PokeAPI (requires internet connection)
- Supported Pokémon species: Generations 1-7 (National Dex #1-807)
- Save file modifications are done in-memory; original files are not modified until export
- All checksums are automatically recalculated when importing Pokémon
- Only `.pk3` files can be imported to Generation 3 save files
- Other generation files (`.pk4`, `.pk5`, `.pk6`, `.pk7`) are view-only

## License

MIT License

## Credits

- **PKHeX**: Save file format reference and parsing logic
- **PokeAPI**: Pokémon data, sprites, and information
- Built with Node.js, Express, and vanilla JavaScript

## Troubleshooting

### Pokémon not showing up

- Check that files are in the correct database folder
- Verify files are valid Pokémon format (`.pk3`, `.pk4`, `.pk5`, `.pk6`, or `.pk7`)
- Check browser console for errors
- Ensure species IDs are within valid range (1-807)

### Save file import not working

- Ensure save file is from a Gen 3 game (Ruby, Sapphire, Emerald, FireRed, LeafGreen)
- Verify save file is not encrypted (use a save manager to extract)
- Check that save file is exactly 128 KB
- Only `.pk3` files can be imported to save files

### Sprites not loading

- Check internet connection (sprites load from PokeAPI)
- Verify Pokémon species ID is valid (1-807)
- Check browser console for API errors

### Import errors

- Ensure save file is loaded first
- Check that there are empty slots available
- Verify `.pk3` files are valid format (only `.pk3` files can be imported)
- Check that files are not corrupted

### Statistics not showing

- Ensure you have valid Pokémon in your database
- Check that species names are loading (requires internet connection for first load)
- Verify browser console for any errors
