# AeroGraph

**AeroGraph** is a high-performance, standalone Windows application for **Falcon BMS 4.38** that combines:
1. **Automated Kneeboard Generator & Watcher**: Pure Rust pipeline that monitors your mission briefings and generates pixel-calibrated, high-contrast, VR-readable kneeboards (Roster, Comms Ladder, Steerpoints, Weather, 16k SkyVector Route & Combat Area Maps, Airfield Ground Taxi Diagrams, and ILS Approach Charts) stitched directly into Falcon BMS 3D cockpit DDS textures.
2. **Crew Chief & Voice Engine**: Speech-recognition-powered virtual copilot and ground crew engine (FoxVox profile engine, DirectInput HOTAS axis sampling, SAPI speech recognition, and low-latency audio cue feedback).

---

## 🚀 Quick Start

1. **Launch**:
   Run `AeroGraph.exe`. The application docks into your Windows System Tray (notification area).
2. **Automated Kneeboard Monitoring**:
   Whenever you commit or change a flight in Falcon BMS, AeroGraph automatically detects the updated `User/Briefings/briefing.txt` and regenerates your kneeboards in the background.
3. **Manual Regeneration**:
   Right-click the tray icon and select **Regenerate Kneeboards**, or run from command line:
   ```powershell
   .\AeroGraph.exe --regen
   ```

---

## 📋 Kneeboard Configuration (`kneeboards.json`)

When AeroGraph runs, if `kneeboards.json` does not exist in the application folder, it **automatically generates** a comprehensive configuration file detailing all **32 kneeboard slots** (16 Left and 16 Right pages, mapped to Falcon BMS textures `7982.dds` through `7997.dds`).

You can edit `kneeboards.json` with any text editor to rearrange pages, insert custom charts, add notes scratchpads, or disable pages you don't need.

### Available Page Types

| Type | Description | Required Parameters |
| :--- | :--- | :--- |
| `briefing_roster` | Flight member callsigns, aircraft, laser codes, TACAN channels, and Comm Ladder. | None |
| `briefing_steerpoints` | Steerpoint table (altitude, CAS, heading, distance, action, fuel) and Weather report. | None |
| `custom_html` | Renders a custom or checklist HTML page via WebKit (calibrated fonts and tables). | `"path": "custom/checklist.html"` |
| `mission_route` | High-resolution 16k SkyVector theater map crop with full flight path and SAM threat circles. | None |
| `mission_target` | Tactical combat area zoom around Target STPT, IP, and Egress vectors. | None |
| `dep_taxi` | Departure airfield ground taxi diagram, runway badges, wind indicator, and runway table. | None |
| `arr_taxi` | Recovery airfield ground taxi and parking chart. | None |
| `arr_ils_primary` | Primary arrival runway ILS approach chart from theater database. | None |
| `arr_ils_secondary` | Secondary arrival runway ILS approach chart (or fallback blank). | None |
| `blank` | Calibrated daylight Intentionally Left Blank card (`#FAFAF8`, high-contrast VR text). | `"title": "...", "reason": "..."` (optional) |
| `image` | Directly displays any custom PNG or JPG image file. | `"path": "path/to/image.png"` |
| `restore_original` | Restores the stock Falcon BMS texture from the `.orig` backup. | None |
| `pass_through` | **Untouched**: Preserves the existing texture on that half in Falcon BMS. | None |

### Performance Optimization (Automatic Skipping)
AeroGraph only calculates and renders what is actively configured in your `kneeboards.json`:
- If no slots use `mission_route` or `mission_target`, base map decoding and 16k cropping are **completely skipped**.
- If no slots use taxi or ILS charts, airfield geometry parsing is **completely skipped**.

### Example `kneeboards.json` Customization

```json
{
  "slots": {
    "F16_1L": { "type": "briefing_roster", "description": "Package Roster & Comms" },
    "F16_1R": { "type": "briefing_steerpoints", "description": "Navigation & Weather" },
    "F16_2L": { "type": "custom_html", "path": "custom/kneeboard-checklist-1-start.html" },
    "F16_2R": { "type": "custom_html", "path": "custom/kneeboard-threats-air.html" },
    "F16_4R": { "type": "mission_route" },
    "F16_5R": { "type": "mission_target" },
    "F16_6R": { "type": "dep_taxi" },
    "F16_7R": { "type": "arr_ils_primary" },
    "F16_9R": { "type": "arr_taxi" },
    "F16_10L": {
      "type": "blank",
      "title": "PILOT SCRATCHPAD",
      "reason": "CAS 9-LINE / MISSION NOTES"
    },
    "F16_10R": {
      "type": "image",
      "path": "custom_charts/special_departure.png"
    }
  }
}
```

---

## 🛡️ Stock Texture Restoration

Falcon BMS stock kneeboard textures (`7982.dds` through `7997.dds`) are stored in `assets/data/DDS_Backup/` (sourced directly from `Docs/07 Kneeboard Templates/F-16/DDS_Backup`).
- If you ever want to revert a slot to the stock game texture, simply set `"type": "restore_original"` in `kneeboards.json`. AeroGraph will restore the untouched original texture into the theater texture folder.

---

## ⚡ Texture Pair Batching

AeroGraph batches Left (X=0) and Right (X=1024) kneeboard pages into a single DDS operation per texture pair. This cuts texture decoding, BC1/DXT1 encoding, and disk I/O in half, providing fast updates during sim flight planning.

---

## 🎙️ Crew Chief & Voice Controls

Right-click the system tray icon to configure:
- **Listening Mode**: Toggle voice recognition on/off (also controllable via hands-free voice commands: *"Stand by"* / *"Radio check"*).
- **Crew Chief Voice**: Switch between male and female responses.
- **Profile Selector**: Load different aircraft `.fvx` profiles.
- **Auto-Start**: Toggle automatic launch on Windows login.

---

## 📁 Directory Structure

```
AeroGraph/
├── AeroGraph.exe             # Standalone executable
├── kneeboards.json           # Auto-generated 32-slot layout configuration
├── README.md                 # User guide and manual
└── assets/
    ├── bin/
    │   └── wkhtmltoimage.exe # Bundled WebKit rendering engine (1024x1554)
    ├── custom/               # Calibrated custom HTML checklist templates
    ├── briefing/             # Briefing styles and templates (style.css)
    ├── data/                 # Theater databases, airfield models & charts.json
    ├── images/               # Rendered intermediate page images
    ├── profiles/             # FoxVox aircraft speech profiles
    └── sounds/               # Audio cues and sound effects
```
