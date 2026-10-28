# AeroGraph

**AeroGraph** is a high-performance, standalone Windows application for **Falcon BMS 4.38** that combines:
1. **Automated Kneeboard Generator & Watcher**: Pure Rust pipeline that monitors your mission briefings and generates pixel-calibrated, high-contrast, VR-readable kneeboards (Roster, Comms Ladder, Steerpoints, Weather, 16k SkyVector Route & Combat Area Maps, Airfield Ground Taxi Diagrams, ILS Approach Charts, and POH-Style Custom Notes) stitched directly into Falcon BMS 3D cockpit DDS textures using native Windows Chromium / Edge headless rendering.
2. **Crew Chief & Voice Engine**: Speech-recognition-powered virtual copilot and ground crew engine (FoxVox profile engine, DirectInput HOTAS axis sampling, Windows SAPI speech recognition, and low-latency audio cue feedback).

---

## 🚀 Quick Start

1. **Launch**:
   Run `AeroGraph.exe`. The application docks into your Windows System Tray (notification area).
2. **Automated Kneeboard Monitoring**:
   Whenever you commit or change a flight in Falcon BMS, AeroGraph automatically detects the updated `User/Briefings/briefing.txt` and regenerates your kneeboards in the background in seconds.
3. **One-Click Kneeboard Editing**:
   Right-click the system tray icon and select **📝 Edit Kneeboards**. AeroGraph immediately opens your `kneeboards.json` layout configuration in Notepad. Save your edits and click **⚡ Regenerate Kneeboards Now** to see your changes in the cockpit.
4. **Command Line Manual Trigger**:
   ```powershell
   .\AeroGraph.exe --regen
   ```

---

## 📋 Kneeboard Configuration (`kneeboards.json`)

When AeroGraph runs, if `kneeboards.json` does not exist in the application folder, it **automatically generates** a comprehensive configuration file detailing all **32 kneeboard slots** (16 Left and 16 Right pages, mapped to Falcon BMS textures `7982.dds` through `7997.dds`).

You can edit `kneeboards.json` with any text editor to rearrange pages, insert custom notes, load external charts, or disable pages you don't need.

### Available Page Types

| Type | Description | Key Parameters |
| :--- | :--- | :--- |
| `notes` | **POH-Style Custom Mission Notes & Scratchpad** with clip-clearing diagonal stripes, asymmetric L/R title notches, and rich Markdown formatting. | `"notes": [...]` or `"path": "notes.txt"`, `"title": "..."` |
| `briefing_roster` | Flight member callsigns, aircraft, laser codes, TACAN channels, and Comm Ladder. | None |
| `briefing_steerpoints` | Steerpoint table (altitude, CAS, heading, distance, action, fuel) and Weather report. | None |
| `mission_route` | High-resolution 16k SkyVector theater map crop with full flight path and SAM threat rings. | None |
| `mission_target` | Tactical combat area zoom around Target STPT, IP, and Egress vectors. | None |
| `dep_taxi` | Departure airfield ground taxi diagram, active runway badges, wind indicator, and runway table. | None |
| `arr_taxi` | Recovery airfield ground taxi and parking chart. | None |
| `arr_ils_primary` | Primary arrival runway ILS approach chart from theater database. | None |
| `arr_ils_secondary` | Secondary arrival runway ILS approach chart (or fallback blank card). | None |
| `custom_html` | Renders a custom HTML page or legacy checklist. | `"path": "custom/checklist.html"` |
| `blank` | Calibrated daylight Intentionally Left Blank card (`#FAFAF8`, high-contrast VR text). | `"title": "...", "reason": "..."` |
| `image` | Directly displays any custom PNG or JPG image file. | `"path": "path/to/image.png"` |
| `restore_original` | Restores the stock Falcon BMS texture from the `.orig` backup. | None |
| `pass_through` | **Untouched**: Preserves the existing texture on that half in Falcon BMS. | None |

---

## 📝 POH-Style Custom Notes Feature

The `notes` page type gives pilots a rapid way to add custom mission directives, SPINS, ROE, pilot scratchpads, or emergency checklists directly to their kneeboards without needing graphic editors or HTML knowledge.

### Aviation Technical Order (POH) Aesthetic

- **Top Diagonal Stripe Banner**: A full-width, 150px tall diagonal black stripe banner across the top (roughly 2x the standard margin height), ensuring the stripes extend past and remain prominently visible below the 3D cockpit physical kneeboard clip.
- **Asymmetric Clip-Aware Title Notch**:
  - **Left Pages (`*L`)**: Embedded title box positioned on the **Top-Left**.
  - **Right Pages (`*R`)**: Embedded title box positioned on the **Top-Right**.
  - This guarantees the central physical clip never obscures your reference code or title.
- **Comfortable Side Inset**: Generous horizontal padding (64px) keeps your text and data comfortably inset from the texture edges.
- **Clean Footer**: AeroGraph tactical wings emblem badge and metadata are placed in the bottom footer, keeping the header focused and uncluttered.

### Input Methods: Inline JSON vs. External Files

You can provide notes either directly in `kneeboards.json` or by pointing to an external `.txt` or `.md` file:

#### 1. Inline Array of Strings (Recommended for direct JSON editing):
```json
"F16_7L": {
  "type": "notes",
  "title": "MISSION SPINS & RULES OF ENGAGEMENT",
  "subtitle": "FLIGHT: VIPER 1 • THEATER: KOREA",
  "header_code": "T.O. BMS1F-16CM-1",
  "page_num": "SPINS-1",
  "preset": "caution",
  "spaced": false,
  "notes": [
    "## 1. BVR COMBAT RULES OF ENGAGEMENT",
    "- Hostile criteria: 2x sensor confirmation or AWACS Bogey Dope {yellow: 'HOT/HOSTILE'}",
    "- Weapons Free beyond {green: 25nm} Bullseye 045/60",
    "- Primary Laser Code: {green: 1688} / Secondary: {yellow: 1111}",
    "",
    "BULLSEYE: {blue: 045 / 60NM}",
    "PACKAGE VHF: {blue: 138.250}",
    "RAMROD: {blue: CHARLIE}",
    "",
    "## 2. IN-FLIGHT CHECKLIST",
    "[x] INS Alignment verified & UFC set",
    "[ ] Master Arm {yellow: ARM} at STPT 4 (Fence In)",
    "[ ] Laser Arm {green: ON} prior to 5nm to Target",
    "",
    "WARNING: {highlight: Active SA-10 Grumble} radar tracking near STPT 6",
    "CAUTION: Maintain minimum 18,000 FT MSL until IP ingress"
  ]
}
```

#### 2. External `.txt` or `.md` File:
```json
"F16_7R": {
  "type": "notes",
  "title": "ENGINE EMERGENCY & FAULT ISOLATION",
  "header_code": "T.O. 1F-16CM-1",
  "page_num": "EP-3",
  "preset": "emergency",
  "path": "notes/engine_emergencies.txt"
}
```
You can simply open `notes/engine_emergencies.txt` in Windows Notepad, paste or type your notes using the aviation formatting tags, save, and AeroGraph will render it into your kneeboards.

---

### 🎨 Notes Color Customization & Presets

You can customize the top hazard stripe pattern and header bar colors using built-in presets or custom HEX color lists:

#### 1. Using a Preset with Spaced Stripes (USAF Checklist Style):
```json
"F16_7L": {
  "type": "notes",
  "title": "MISSION SPINS & RULES OF ENGAGEMENT",
  "preset": "caution",
  "spaced": true,
  "notes": [...]
}
```

#### 2. Using Custom Multi-Color Stripes & Dense Mode:
```json
"F16_8L": {
  "type": "notes",
  "title": "TACTICAL AIR CONTROL PARTY (TACP)",
  "header_code": "CAS 9-LINE",
  "page_num": "CAS-1",
  "stripe_colors": ["#111111", "#0D47A1", "#0288D1"],
  "header_color": "#0D47A1",
  "spaced": false,
  "notes": [...]
}
```

#### Available Presets:
- `"caution"`: Alternating Black & Safety Yellow diagonal stripes (`["#111111", "#F5D742"]`).
- `"warning"`: Alternating Black & Hazard Red diagonal stripes (`["#111111", "#D32F2F"]`).
- `"emergency"`: Pure Hazard Red diagonal stripes (`["#D32F2F"]`).
- `"tactical"` or `"blue"`: Navy & Tactical Blue diagonal stripes (`["#0D47A1", "#0288D1"]`).
- `"green"`: Deep Forest & Tactical Green diagonal stripes (`["#1B5E20", "#388E3C"]`).
- `"standard"` or `"black"`: Solid classic Black & White stripes (default).

#### Stripe Spacing (`spaced`):
- **`spaced`** (boolean, default: `true`): Keeps clean white background spacing between each colored stripe line (e.g. `Black, White, Yellow, White` or `Red, White, Red, White`), matching authentic USAF T.O. 1F-16 checklist cards.
- Set `"spaced": false` for dense stripes that alternate every single line with no white gap (e.g. `Black, Yellow, Black, Yellow`).

#### Custom Colors:
- **`stripe_colors`**: Provide any array of 2 or more HEX colors to alternate across the hazard pattern:
  ```json
  "stripe_colors": ["#111111", "#F5D742", "#D32F2F"]
  ```
- **`stripe_color`**: Provide a single HEX color for a 2-tone pattern with the page background:
  ```json
  "stripe_color": "#D32F2F"
  ```
- **`header_color`**: Override the notch header text color independently (defaults to the primary stripe color):
  ```json
  "header_color": "#0D47A1"
  ```

---

### 🎨 Notes Formatting Syntax Reference

AeroGraph includes a lightweight aviation Markdown parser that automatically transforms your plain text into structured flight cards:

| Syntax | What it produces | Visual Appearance |
| :--- | :--- | :--- |
| `# Title` | **Primary Section Banner** | Blue highlight bar with dark blue accent left border |
| `## Section` | **Secondary Section Header** | Bold dark header with horizontal underline |
| `### Subheader` | **Minor Subhead** | Compact slate-gray subhead |
| `[SECTION]` | **Category Pill Badge** | Dark rectangular badge with bold white text |
| `WARNING: text` | **Safety Alert Box** | Red-bordered callout box with a bold `WARNING` badge |
| `CAUTION: text` | **Advisory Caution Box** | Amber-bordered callout box with a bold `CAUTION` badge |
| `[ ] Item` or `- [ ] Item` | **Empty Checkbox** | Square checkbox for pending cockpit checklist items |
| `[x] Item` or `- [x] Item` | **Checked Box** | Green square with checkmark for completed items |
| `- Item` or `* Item` | **Bullet Point** | Clean list item with square bullet dot |
| `KEY: VALUE` | **Two-Column Data Card** | Slate-gray key-value badge with monospace highlight (e.g. `BULLSEYE: 045 / 60NM`) |
| Regular lines | **Plain Text** | Clean typography with preserved indentation and linebreaks |

#### Inline Text Coloring:
You can colorize words or phrases anywhere in your titles, keys, values, warnings, cautions, and checklist items using `{color: text}` tags:
- `{red: text}`, `{yellow: text}`, `{green: text}`, `{blue: text}`, `{orange: text}`, `{cyan: text}`, `{gray: text}`, `{black: text}`
- `{#E91E63: custom hex color}`
- `{highlight: yellow marker highlight}` or `{bg-yellow: text}`
- `{bg-red: text}`, `{bg-green: text}`, `{bg-blue: text}`, `{white: white text on dark badge}`

Example:
```json
"notes": [
  "Primary Laser Code: {green: 1688} / Secondary: {yellow: 1111}",
  "BULLSEYE: {blue: 045 / 60NM}",
  "WARNING: {highlight: Active SA-10 Grumble} radar tracking near STPT 6",
  "[ ] Master Arm {yellow: ARM} at STPT 4 (Fence In)"
]
```

---

## 🖥️ System Tray Controls

Right-click the AeroGraph icon in the Windows notification area to access:

- **📝 Edit Kneeboards**: Opens `kneeboards.json` directly in your default text editor (Notepad).
- **⚡ Regenerate Kneeboards Now**: Manually triggers the complete generation pipeline.
- **📁 Open Kneeboard Images**: Opens the `assets/images` directory containing all rendered PNG page previews.
- **📋 Auto-Kneeboards**: Toggles automatic file-watching on `User/Briefings/briefing.txt`.
- **🎙️ Listening Mode**: Toggle voice recognition on/off (also controllable hands-free via *"Stand by"* / *"Radio check"*).
- **Pilot Voice**: Toggle between Male and Female pilot response voices.
- **Select .fvx Profile...**: Load different aircraft voice profiles.
- **🚀 Start with Windows**: Enable or disable automatic launch on Windows startup.
- **Show/Hide Console Window**: Toggle diagnostic console output.
- **Open Log File**: View application logs.

---

## ⚡ Performance Optimization (Automatic Skipping & Batching)

AeroGraph is built in pure Rust for high speed and sim responsiveness:
- **Fast Bundled Rendering Engine**: HTML pages are rendered via the optimized bundled `wkhtmltoimage` pipeline in parallel threads with sub-second execution.
- **Parallel Multi-Core Rendering**: Notes, taxi diagrams, and map pages render concurrently across CPU threads.
- **Parallel Multi-Threaded DDS Merging**: All texture pairs (`7982.dds` through `7997.dds`) are processed, resized, and compressed (SIMD BC1/DXT1) concurrently across all CPU threads via `std::thread::scope`, reducing total DDS generation time from ~16 seconds to ~1–2 seconds.
- **Automatic Skipping**:
  - If no slots use `mission_route` or `mission_target`, base map decoding and 16k cropping are **completely skipped**.
  - If no slots use taxi or ILS charts, airfield geometry parsing is **completely skipped**.
- **Texture Pair Batching**: Left (`X=0`) and Right (`X=1024`) pages are batched into a single DDS operation per texture pair (`7982.dds` through `7997.dds`), cutting disk I/O and BC1 compression overhead in half.

---

## 🥽 VR Readability & Display Calibration

- **Daylight `#FAFAF8` Background**: Minimizes eye strain and god-rays inside VR headsets compared to harsh pure white backgrounds.
- **Calibrated Contrast**: Dark charcoal (`#111111` / `#1A1A1A`) and deep blues (`#0D47A1`) ensure sharp readability across all headset resolutions (Pimax, Quest 3, Reverb G2).
- **Native 1024x1554 Resolution**: Matches Falcon BMS 3D cockpit DDS texture mapping exactly, avoiding downsampling blur.

---

## 📁 Directory Structure

```
AeroGraph/
├── AeroGraph.exe             # Standalone Windows application
├── kneeboards.json           # 32-slot layout configuration
├── README.md                 # User guide and manual
└── assets/
    ├── custom/               # Custom HTML checklist templates
    ├── briefing/             # Briefing styles and CSS
    ├── data/                 # Theater databases, airfield models & charts.json
    ├── images/               # Rendered intermediate page PNGs
    ├── profiles/             # FoxVox aircraft speech profiles (.fvx)
    └── sounds/               # Audio cues and sound effects (.wav)
```
