# AeroGraph Cockpit & Crew Chief Voice Command Reference

This document provides the authentic voice command guide for **AeroGraph**, mapped directly to the **FoxVox Falcon BMS 4.38 v1.3.1 profile**.

> ℹ️ **Credits & Attribution:**
> - FoxVox application and the Falcon BMS VCC voice library (`Falcon BMS 4.38 v1.3.1.fvx`) created by **[foxster](https://foxster.itch.io/foxvox)**. For in-depth video tutorials on setting up voice profiles and controller inputs, visit **[foxster's YouTube Channel](https://www.youtube.com/@foxster2)** and the **[FoxVox Tutorial Series](https://foxster.itch.io/foxvox/devlog/870907/foxvox-tutorial-videos)**.
> - Original voice response audio recordings and sound design performed by **[Bogey Dope](https://www.youtube.com/@BogeyDope)**.
> - Startup procedure contributions by **Tomcattwo**.
> - *AeroGraph natively executes `.fvx` profiles directly in Rust with zero-overhead SAPI grammar trees. Profile creation or custom key mappings should always be performed inside FoxVox.*

---

## 📖 Table of Contents

- [System Voice Controls](#-system-voice-controls)
- [Crew Chief Ramp Start Sequence](#-crew-chief-ramp-start-sequence)
  - [Engaging the Crew Chief](#engaging-the-crew-chief)
  - [Ramp Start Checklist & Dialogues](#ramp-start-checklist--dialogues)
  - [Special Crew Chief Voice Calls](#special-crew-chief-voice-calls)
- [Cockpit Voice Communications](#-cockpit-voice-communications)
  - [1. Air Traffic Control (ATC)](#1-air-traffic-control-atc)
  - [2. AWACS](#2-awacs)
  - [3. Tanker](#3-tanker)
  - [4. JTAC / Forward Air Control](#4-jtac--forward-air-control)
  - [5. Wingman, Element & Flight Commands](#5-wingman-element--flight-commands)
  - [6. Avionics, ICP & DED Controls ("Push" & "Change")](#6-avionics-icp--ded-controls-push--change)
  - [7. Jet Miscellaneous Switches](#7-jet-miscellaneous-switches)
  - [8. Views & Simulation Controls](#8-views--simulation-controls)

---

## 🎙️ System Voice Controls

AeroGraph continuously listens to these global commands to allow fast hands-free mute/unmute during multiplayer flights:

| Command Phrase | System Response | Visual & Audio Feedback |
| :--- | :--- | :--- |
| **`"Stand by"`** or **`"Standby"`** | Mutes speech recognition engine. | Plays `standing-by.mp3`; tray icon updates to *🎙️ Listening: Muted*. |
| **`"Radio check"`** or **`"Comms check"`** | Unmutes speech recognition engine. | Plays `loud-n-clear.mp3`; tray icon updates to *🎙️ Listening: Active*. |

> 💡 **Tip:**
> Use `"Stand by"` before talking on Teamspeak / Discord / IVC to prevent AeroGraph from parsing casual human voice chatter as cockpit commands.

---

## 🛠️ Crew Chief Ramp Start Sequence

### Engaging the Crew Chief

To initiate ground crew communications during ramp start:

- **Say**: `"Chief"`, `"Engage Chief"`, `"Engage Crew Chief"`, `"Start Chief"`, or `"Enable Chief"`.
- **Response**: Chief acknowledges with a confirmation beep (`start-beep.mp3`). The engine transitions into Ground Crew operational mode.

---

### Ramp Start Checklist & Dialogues

Follow this authentic checklist sequence during cold ramp start:

| Step | Action / Procedure | Spoken Pilot Phrase | Crew Chief Response | BMS / DirectInput Action |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Comms Check** | `"Comms Check"` | *"Loud & clear, sir!"* or *"Loud & clear, ma'am!"* | Audio verification |
| **2** | **Engine Start 2** | `"Start Two"` | *"Clear for start two."* | Waits for successful engine start |
| **3** | **EPU Safety Pin** | `"Pull EPU Pin"` / `"Remove EPU Safety Pin"` / `"EPU Safety Pin"` | *"Copy."* &rarr; *"EPU run up."* | EPU pin pulled |
| **4** | **Fuel / Hyd Flow** | `"Check Flow"` / `"Verify Flow"` | *"No flow."* | Confirms no hydraulic leaks |
| **5** | **SEC Check Prep** | `"Ready SEC"` / `"Clear SEC"` | *"Ready for SEC."* | Chief monitors engine nozzle |
| **6** | **SEC Check Confirmation** | `"SEC Good"` / `"SEC Pass"` / `"SEC OK"` | *"Copy."* | Secondary Engine Control confirmed |
| **7** | **Flight Controls Initial** | `"Flight Controls Clear"` / `"Controls Clear"` | *"Flight controls clear."* | Surfaces visually cleared |
| **8** | **FLCS BIT Clearance** | `"Cleared for BIT"` / `"Ready BIT"` | *"Cleared for BIT."* | Cleared for built-in test run |
| **9** | **Trim Check Prep** | `"Ready for Trim Check"` / `"Ready Trim"` | *"Ready for trim."* | Trim monitoring activated |
| **10** | **Trim Disconnect Test** | `"Trim Disconnected"` | *"Copy."* | Verifies autopilot trim disconnect and no movement on trim input from sidestick |
| **11** | **Trim Connected & MPO Kick** | `"Trim Connected"` | Chief checks controls (*"Nose Up"*, *"Nose Down"*, *"Roll Left"*, *"Roll Right"*, *"Yaw Left"*, *"Yaw Right"*) | **DirectInput / BMS MPO switch toggle & trim validation** |
| **12** | **Speedbrakes & Big Movements** | `"Clear for Big Movements"` / `"Ready Big Movements"` | *"Flight controls still clear."* &rarr; *"Speedbrakes open."* &rarr; *"Speedbrakes closed."* | Controls and speedbrake cycle test |
| **13** | **DBU Check** | `"DBU Still Clear"` / `"Digital Backup Clear"` | *"Flight controls still clear."* | Digital Backup Unit verify (same as last) |
| **14** | **Left Brake Check** | `"Ready Left Brake"` / `"Ready on the Left Brake"` | *"Copy."* &rarr; *"Ready left brake."* | Left main brake verification |
| **15** | **Right Brake Check** | `"Ready Right Brake"` / `"Ready on the Right Brake"` | *"Copy."* &rarr; *"Ready right brake."* | Right main brake verification |
| **16** | **Aerial Refueling Door** | `"Check AAR Door"` / `"Check Refuel Door"` | *"Copy, standby."* &rarr; *"Refuel door check ready."* &rarr; *"AAR door check open."* &rarr; *"AAR door check closed."* | Refuel slipway door check |
| **17** | **Wheel Chocks** | `"Remove Chocks"` / `"Pull Wheel Chocks"` / `"Pull Blocks"` | Chocks removed | **ATC ground menu chocks removal keystroke triggered** |
| **18** | **Clearance Off** | `"Cleared Off"` / `"All Clear Off"` / `"Everything Go"` | *"Bring her back Code 1, sir!"* / *"Bring her back Code 1, ma'am!"* | Chief disconnected, ready for taxi |

---

### Special Crew Chief Voice Calls

- **Casual Greeting**:
  - Say: `"How's Chief"`, `"How you doing today"`, `"What's happening this morning"`
  - Response: *"Alright, how are you?"* or *"Air Force day, ma'am!"*
- **Pause / Wait**:
  - Say: `"Hold on"`, `"Wait a minute"`, `"Stand by"`, `"Give me a moment"`
  - Response: *"Yes sir, standing by."* / *"Yes ma'am, standing by."*
- **Skip Procedure**:
  - Say: `"Skip Flight"`
  - Response: Instantly completes the ramp start sequence and clears the crew chief off.
- **Reset Ground Crew**:
  - Say: `"Reset Crew Chief"`
  - Response: Plays confirmation beep and resets crew chief state back to initial start.

---

## ✈️ Cockpit Voice Communications

These are configurable from FoxVox, and not all of the categories activated by default. If you want to learn more about it, you can checkout the **[FoxVox Tutorial Series](https://foxster.itch.io/foxvox/devlog/870907/foxvox-tutorial-videos)** for more in-depth tutorials.

### 1. Air Traffic Control (ATC)

ATC voice commands use standard Falcon BMS ATC calls. You can prefix calls with `"ATC"`, `"Tower"`, `"Ground"`, `"Approach"`, `"Departure"`, `"Carrier"`, or your flight callsign (e.g. `"#Callsign"`):

- **Menus**:
  - `"Open Ground Menu"` / `"Tower Menu"` / `"Approach Menu"` / `"Departure Menu"` / `"Carrier Menu"` / `"Close Menu"`
- **Ground Operations**:
  - `"Request Taxi"` / `"Taxi for Departure"` / `"Taxi Back to Ramp"`
  - `"Request Hotpit Refuel"` / `"Request JFS Recharge"`
  - `"Declare 1 (2 / 3 / 4) Ground Abort"`
  - `"Ready for Departure"`
- **Inbound & Approaches**:
  - `"Request Landing"` / `"Request Formation Landing"`
  - `"Report on Final"` / `"Report Overhead Break"`
  - `"Request Visual Approach"` / `"Request Instrument Approach"` / `"Request Overhead Approach"` / `"Request Unrestricted Approach"` (or add `"Heavy"`)
  - `"Approach Abort"` / `"Tower Abort"` / `"Carrier Abort"`
  - `"Report Airborne"` / `"Report Traffic in Sight"`
  - `"Declare Emergency"`
- **Altimeter & Environmental**:
  - `"Request QNH"` / `"Request QFE"`
  - `"Request Takeoff Runway"` / `"Request Landing Runway"`
  - `"Request Wind Check"`
- **Carrier / Naval Operations**:
  - `"Inbound Mother"` / `"Report See You"` / `"Report Platform"` / `"Call the Ball"` / `"Carrier Ready for Departure"`

---

### 2. AWACS

Prefix commands with `"AWACS"`, `"#Awacs"`, or your flight callsign:

- `"AWACS Request Picture"` / `"Situation"` / `"Status"`
- `"Declare"`
- `"Request Help"` / `"Assistance"` / `"Support"`
- `"Wilco"` / `"Judy"` / `"Unable"`
- `"Check In"` / `"Check Out"` / `"Request Relief"`
- `"Vector to Nearest Air Threat"` / `"Bogey Dope"`
- `"Vector to Target"` / `"Vector to Package"`
- `"Vector to Tanker"` / `"Vector to Nearest Tanker"`
- `"Vector to Home Plate"` / `"Vector to Divert Field"` / `"Vector to Carrier Group"`
- `"Request Rescue Chopper"`

---

### 3. Tanker

Prefix commands with `"Tanker"`, `"#Tanker"`, or your callsign:

- `"Tanker Menu"` / `"Close Menu"`
- `"Request Air Refueling"`
- `"Back in Pre-Contact Position"`
- `"Done Refueling"` / `"Refueling Complete"`
- `"Terminate Flight Refuel"`
- `"Request Individual Refueling"` / `"Request Element Refueling"`

---

### 4. JTAC / Forward Air Control

Prefix commands with `"JTAC"` or flight callsign:

- `"JTAC Menu"` / `"Close Menu"`
- `"Initial Contact"` / `"Check In"`
- `"Ready for 9 Liner"` / `"Ready for Echo Point"`
- `"IP Inbound"` / `"Re-attack"`
- `"Request Target Bullseye"`
- `"Request Laser Marking"` / `"Request Smoke Marking"`
- `"Check-Out"`

---

### 5. Wingman, Element & Flight Commands

Directed to **Wingman** (`"Wingman"`, `"Two"`, `"2"`), **Element** (`"Element"`, `"Three"`, `"3"`), or **Flight** (`"Flight"`, `"#Callsign"`):

#### Tactical Commands
- `"Attack My Target"` / `"Attack Targets"`
- `"Buddy Spike"` / `"Raygun"`
- `"Weapons Free Air"` / `"Weapons Free Ground"` / `"Weapons Hold"`
- `"Check Your Six"` / `"Clear My Six"`
- `"Rejoin Formation"`
- `"Drop Stores"` / `"Drop Fuel Tanks"`
- `"Datalink Ground Target"`
- `"Offensive Pursuit"` / `"Offensive Split"` / `"Beam Deploy"` / `"Grinder"` / `"Defensive"`
- `"Current Altitude Attack"` / `"High Attack"` / `"Low Attack"` / `"Dive Attack"` / `"Popup Attack"` / `"Free Attack"`
- `"Resume Mission"` / `"Return to Base"`

#### Sensor & Status Reports
- `"Activate Radar"` / `"Snooze Radar"`
- `"Say Position"` / `"Say Damage Report"` / `"Say Status"`
- `"Say Fuel State"` / `"Say Weapons State"`

#### Formations & Spacing
- `"Close Up"` / `"Switch Side"` / `"Break Right"` / `"Break Left"`
- `"Stack High"` / `"Stack Level"` / `"Stack Low"` / `"Go Deck"` / `"Flex"` / `"Kickout"`
- `"Go Wedge"` / `"Go Trail"` / `"Go Ladder"` / `"Go Stack"` / `"Go Fluid"` / `"Go Spread"` / `"Go Arrowhead"`
- *(Flight only)*: `"Go Box"` / `"Go Res Cell"` / `"Go Vic"` / `"Go Line Abreast"` / `"Go Finger Four"` / `"Go Echelon Left/Right"` / `"Go Diamond"`
- Runway Lineups: `"Lineup Single Ship"`, `"Lineup Element"`, `"Lineup 4 Ship Three in the Slot"`, `"Lineup 4 Ship Four in the Slot"`, `"Lineup Echelon"`

#### Avionics & Comm Changes
- `"Fence In"` / `"Fence Out"`
- `"Lights SOP"` / `"Music On"` / `"Music Off"` / `"Turn Smoke On"` / `"Turn Smoke Off"`
- `"Switch Flight Uniform"` / `"Switch Flight Victor"`
- `"Set Bingo"`

---

### 6. Avionics, ICP & DED Controls ("Push" & "Change")

#### "Push" Commands (ICP & UFC Data Entry)
- `"Push Uniform 1"` through `"Push Uniform 20"` (Sets UHF Comm 1 preset)
- `"Push Victor 1"` through `"Push Victor 20"` (Sets VHF Comm 2 preset)
- `"Push Steerpoint 1"` through `"Push Steerpoint 99"` (Direct steerpoint entry)
- `"Next Steerpoint"` / `"Previous Steerpoint"`
- `"Push Comm 1"` / `"Push Comm 2"` / `"Push List"`
- `"Push Air to Air"` / `"Push Air to Ground"` / `"Push Navigate"`
- `"Push Enter"` / `"Push Return"` / `"Push Sequence"` / `"Push Recall"` / `"Push Drift"` / `"Push Norm"`
- `"Warning Reset"`
- `"Push Bingo [1000 - 7000]"` (Sets Bingo fuel threshold)
- `"Push Left MFD [1-20]"` / `"Push Right MFD [1-20]"` (Presses OSB 1-20 on corresponding MFD)

#### "Change" Commands
- `"Change Heading [0 - 360]"` (Sets HSI heading bug)
- `"Change Course [0 - 360]"` (Sets HSI course pointer)
- `"Change QNH [2790 - 3120]"` (Sets altimeter pressure setting)
- `"Change HUD Scales Display"` / `"Change HUD Velocity Display"` / `"Change HUD Color Display"`
- `"Toggle Night Vision"` / `"Toggle Visor"` / `"Toggle Smoke"` / `"Toggle Lights"` / `"Toggle Spotlight"`
- `"Change Pilot Gender"` / `"Male Pilot"` / `"Female Pilot"`

---

### 7. Jet Miscellaneous Switches

Instant cockpit switch actuations without touching the mouse:

| Voice Command | Cockpit Actuation |
| :--- | :--- |
| **`"Gear up"`** / **`"Gear down"`** | Landing gear lever |
| **`"Master Arm"`** / **`"Master Simulate"`** / **`"Master Off"`** | Master Arm switch |
| **`"Laser Arm"`** / **`"Laser Off"`** | Laser Arm toggle switch |
| **`"Radar Altitude On"`** / **`"Radar Altitude Standby"`** | Radar Altimeter power |
| **`"Parking Break ON"`** / **`"Parking Break ANTI SKID"`** | Parking brake handle / Anti-skid mode |
| **`"Landing Lights"`** / **`"Taxi Lights"`** / **`"Gear Lights Off"`** | Landing / Taxi light switch |
| **`"CAT 1"`** / **`"CAT 3"`** | Stores Configuration CAT I / CAT III limiter |

---

### 8. Views & Simulation Controls

- **Views**:
  - `"View Front"` / `"View HUD Only"` / `"View Extended"`
  - `"Satellite Cam"` / `"Action Cam"` / `"Incoming Cam"` / `"Weapon Cam"` / `"Chase Cam"` / `"Orbit Cam"`
  - `"Zoom In"` / `"Zoom Out"`
  - `"Reset View"` / `"Reset Field of View"` / `"Reset Track IR"`
- **Simulation**:
  - `"Game Pause"` / `"Game Freeze"` / `"Game Unpause"`
