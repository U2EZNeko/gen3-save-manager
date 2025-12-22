# Gen3 Save Manager

A comprehensive web-based viewer and manager for Generation 3 Pokémon files (`.pk3`) and save files (`.sav`) from Pokémon Ruby, Sapphire, Emerald, FireRed, and LeafGreen.

## Features

### 🎮 Core Functionality

- **Pokémon File Viewer**: View and analyze `.pk3` Pokémon files with detailed information
- **Save File Management**: Load, edit, and export Generation 3 `.sav` save files
- **Multiple Databases**: Switch between up to 4 different Pokémon databases/folders
- **Auto-load**: Automatically loads Pokémon when the page opens

### 📊 Viewing & Display

- **Pokémon Cards**: Beautiful card-based display showing:
  - Pokémon sprite (with shiny variants)
  - Species name and nickname
  - Level, HP, and calculated stats
  - IV Sum (sum of all 6 IVs)
  - Nature and Ability
  - Origin Game and Met Location
  - Pokéball type
  - OT Name, TID, and SID
  - Shiny indicator (⭐)
- **Compact View**: Toggle to show only essential information (Name, Sprite, IV Sum)
- **Detailed Modal**: Click any Pokémon card to view:
  - Full Pokémon sprite (shiny if applicable)
  - Complete IV and EV breakdown
  - Interactive IV/EV charts (Bar and Radar charts)
  - All 4 moves with type icons
  - Complete metadata (Origin Game, Met Location, Ball, etc.)
  - Calculated stats based on base stats from PokeAPI
  - Delete button with confirmation

### 🔍 Sorting & Filtering

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

### 👥 Grouping

- **Group by OT**: Organize Pokémon by Original Trainer (includes TID/SID and Game Version for uniqueness)
- **Group by TID/SID**: Group Pokémon by Trainer ID and Secret ID pairs

### 🔄 Duplicate Management

- **Duplicate Scanner**: Identifies:
  - **Exact Duplicates**: Same Personality Value (PID)
  - **Potential Duplicates**: Same Species, IVs, and Level
- **Side-by-side Comparison**: View duplicates together
- **Delete Functionality**: Remove duplicate files directly from the scanner

### 💾 Save File Management

- **Load Save Files**: Import Generation 3 `.sav` files (Ruby, Sapphire, Emerald, FireRed, LeafGreen)
- **Import Pokémon**:
  - **Drag & Drop**: Drag `.pk3` files directly onto the import zone
  - **Select from Viewer**: Select Pokémon cards and import them
  - **Auto-slot Finding**: Automatically finds empty box or party slots
  - **Box Import**: Import to PC boxes (14 boxes × 30 slots)
  - **Party Import**: Import to party (6 slots)
- **Export Save Files**: Download modified save files with updated checksums

### 🎨 User Interface

- **Dark Mode**: Modern dark theme throughout
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Dynamic Layout**: Automatically adjusts to screen size
- **Performance Optimized**: 
  - Indexed sorting and grouping for fast operations
  - Cached sprites and API data
  - Batch API calls for species names

### 📈 Data Visualization

- **IV Charts**: Visual representation of Individual Values
  - Bar Chart
  - Radar Chart
- **EV Charts**: Visual representation of Effort Values
  - Bar Chart
  - Radar Chart
- **Type Icons**: Move type indicators from PokeAPI

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

4. **Place your `.pk3` files** in one of the database folders

5. **Start the server:**
   ```bash
   npm start
   ```

6. **Open your browser** and navigate to `http://localhost:3000`

## Usage

### Viewing Pokémon

1. **Select a Database**: Use the dropdown to switch between your 4 databases
2. **Pokémon Auto-load**: Pokémon are automatically loaded when the page opens
3. **Refresh**: Click "Refresh Pokemon" to reload from the selected database

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

### Duplicate Scanning

1. Click **"Scan Duplicates"** button
2. Review exact and potential duplicates
3. Delete duplicate files directly from the results

### Save File Management

1. **Load a Save File**:
   - Click **"Load Save File"** button
   - Select a `.sav` file from your computer
   - The save file status will show "Loaded"

2. **Import Pokémon**:
   - **Method 1 - Drag & Drop**:
     - Drag `.pk3` files onto the drop zone
     - Select import target (Box or Party)
     - Files are automatically imported to empty slots
   - **Method 2 - Select from Viewer**:
     - Check the boxes on Pokémon cards you want to import
     - Click **"Import Selected Pokemon"**
     - Select import target (Box or Party)

3. **Export Save File**:
   - Click **"Export Save File"** button
   - The modified save file will download
   - Checksums are automatically recalculated

## File Formats

### .pk3 Files

- **Format**: Generation 3 Pokémon data format
- **Size**: 80 bytes (stored) or 100 bytes (PKHeX export/party format)
- **Supported Formats**:
  - Raw 80-byte stored format
  - PKHeX 100-byte export format (32-byte header + 80 bytes data)
  - Party format (80 bytes + 20 bytes party stats)

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

- **PK3 Parser**: Based on PKHeX's internal structure
  - Accurate species ID conversion (handles Gen 3 internal numbering)
  - Proper OT name decoding (Gen 3 character encoding)
  - Correct IV/EV extraction
  - Nature calculation from Personality Value
  - Shiny detection (Gen 3 formula)
  - Origin Game, Met Location, and Ball extraction

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

## API Endpoints

### Pokémon Files

- `GET /api/pokemon` - Get all Pokémon from selected database
- `GET /api/pokemon/file/:filename` - Get raw `.pk3` file data
- `DELETE /api/pokemon/:filename` - Delete a `.pk3` file
- `GET /api/databases` - Get list of available databases

### Save Files

- `POST /api/save/load` - Load a `.sav` file
- `GET /api/save/export` - Export the loaded save file
- `POST /api/save/import` - Import Pokémon into save file
- `GET /api/save/box/:box/slot/:slot` - Get Pokémon from box slot
- `GET /api/save/party/:slot` - Get Pokémon from party slot

## Browser Compatibility

- Modern browsers with ES6+ support
- Tested on:
  - Chrome/Edge (latest)
  - Firefox (latest)
  - Safari (latest)

## Notes

- Pokémon sprites are loaded from PokeAPI (requires internet connection)
- Only Generation 3 Pokémon (National Dex #1-386) are supported
- Save file modifications are done in-memory; original files are not modified until export
- All checksums are automatically recalculated when importing Pokémon

## License

MIT License

## Credits

- **PKHeX**: Save file format reference and parsing logic
- **PokeAPI**: Pokémon data, sprites, and information
- Built with Node.js, Express, and vanilla JavaScript

## Troubleshooting

### Pokémon not showing up
- Check that files are in the correct database folder
- Verify files are valid `.pk3` format (80 or 100 bytes)
- Check browser console for errors

### Save file import not working
- Ensure save file is from a Gen 3 game (Ruby, Sapphire, Emerald, FireRed, LeafGreen)
- Verify save file is not encrypted (use a save manager to extract)
- Check that save file is exactly 128 KB

### Sprites not loading
- Check internet connection (sprites load from PokeAPI)
- Verify Pokémon species ID is valid (1-386)
- Check browser console for API errors

### Import errors
- Ensure save file is loaded first
- Check that there are empty slots available
- Verify `.pk3` files are valid format
