import { SlotConfig, TemplateMetadata } from '../types/ipc';

// Embedded authentic contents for all 14 flight notes
export const EMBEDDED_NOTES: Record<string, string> = {
  'notes/fuel_planning.md': `## FUEL FLOW REGIMES & CRUISE PLANNING
- Optimum Cruise: FL280-FL330 at Mach 0.78-0.82 (~2,400 lbs/hr)
- Low-Level Ingress: 480-500 kts at 500 FT AGL (~6,000 lbs/hr)
- Sustained Mil Power: 400-450 kts BFM turn (~9,000 lbs/hr)
- Full Afterburner: 65,000-80,000 lbs/hr (internal fuel depleted in 8-10 min)

CRUISE CONSUMPTION: ~2,400 LBS/HR (15-18 NM / 100 LBS)
MIL POWER CONSUMPTION: ~9,000 LBS/HR
MAX AB CONSUMPTION: ~72,000 LBS/HR
MAX ENDURANCE (HOLDING): 210-230 KIAS / ~1,900 LBS/HR (6°-7° AOA)

## BINGO & JOKER COMPUTATION
BINGO FORMULA: (DIVERT DIST NM * 10) + 1,200 LBS RESERVE
JOKER FORMULA: BINGO + 1,000 LBS (FENCE-OUT TRIGGER)

WARNING: {highlight: Egress target area immediately} upon reaching JOKER state
CAUTION: Trapped external fuel indicated if WING tanks show full while FEED tanks drop

## ABNORMAL & TRAPPED FUEL CHECKLIST
[ ] AIR SOURCE switch - CHECK NORM or DUMP (verify ECS pressure)
[ ] FUEL TRANSFER switch - VERIFY NORM
[ ] WINGS FIRST FEED - Check wing tanks drop before centerline
[ ] GRAVITY FEED - If pump fail, descend below FL200 for gravity feed`,

  'notes/aa_missiles.md': `## AIM-120 AMRAAM EMPLOYMENT ENVELOPES
- High Altitude (FL350 / M 1.2): Rmax ~30-34 NM | Rtr ~16-18 NM | Pitbull ~9-11 NM
- Medium Altitude (FL200 / M 0.9): Rmax ~20-24 NM | Rtr ~12-14 NM | Pitbull ~7-8 NM
- Low Altitude (FL050 / M 0.8): Rmax ~12-14 NM | Rtr ~7-8 NM | Pitbull ~5-6 NM

AMRAAM HIGH-ALT RMAX: 32 NM (M 1.2 / FL350)
AMRAAM MED-ALT RMAX: 22 NM (M 0.9 / FL200)
ACTIVE PITBULL GATE: 8-10 NM TO TARGET
MIN ABORT RANGE (MAR): 12 NM (VS SU-27/MIG-29)

## BVR TIMELINE & ABORT GATES
- DOR (Desired Out Range): {blue: 22-25 NM} — Turn out if uncommitted
- MTR (Minimum Target Range): {yellow: 14-16 NM} — Last shot commitment gate
- MAR (Minimum Abort Range): {red: 10-12 NM} — Mandatory crank/skate or defensive dive

WARNING: {highlight: Su-27 / R-27ER Alamo} has comparable kinetic range to AIM-120B at co-altitude
CAUTION: Maintain FCR elevation volume: 4-Bar scan time is 3.8s, 2-Bar scan time is 1.0s

## AIM-9 SIDEWINDER (AIM-9M & AIM-9X)
- AIM-9M: Slaved/Bore, 3-4 NM head-on, 4-5 NM tail-chase
- AIM-9X: High off-boresight capable with JHMCS helmet cueing (up to 80° off-boresight)
- Tone Verification: Verify high-pitched growl before uncaging (TMS Up)

[ ] Master Arm - ARM
[ ] Dogfight Switch - DGFT (auto selects AIM-9, ACM 20x30 HUD scan)
[ ] Uncage Seeker - TMS UP / Boresight verify`,

  'notes/ag_precision.md': `## LASER GUIDED BOMBS (GBU-10 / 12 / 24)
- Release Gate: 450-500 KTAS level CCRP or 10°-20° dive toss
- Release Altitude: Minimum 12,000 FT AGL (optimum 16,000-22,000 FT MSL)
- PRF Laser Codes: Flight lead {green: 1688}, Wingman {yellow: 1685}, TGP match verified

GBU-12 TTI LEAD TIME: LASER ON AT TTI - 12 SEC
GBU-24 TTI LEAD TIME: LASER ON AT TTI - 18 SEC
STANDARD RELEASE SPEED: 480 KTAS LEVEL
STANDARD PRF CODE: 1688

## GPS / INS STANDOFF WEAPONS (JDAM & JSOW)
- GBU-31/38 JDAM: In-Range cue on HUD, optimal release FL220-FL300
- AGM-154 JSOW: Standoff glide weapon (range ~35-45 NM from FL300)
- LAR (Launch Acceptability Region): Verify 'IN RNG' or 'IN ZONE' prompt

WARNING: {highlight: GBU-24 Paveway III} requires loft or level release; steep dive blind-zones seeker
CAUTION: TGP Auto-Lasing requires TGP switch in LASER ARM and UFC DED Laser code match

## AGM-65 MAVERICK (D / G MODELS)
- AGM-65D (WPN / IR): Small warhead, armor tracking, lock-on gate ~5-7 NM
- AGM-65G (WPN / IIR): Large blast-frag warhead, bridge/bunker, lock-on gate ~7-9 NM
- Bore / Slave: TGP to Target -> TMS Up to Slave WPN -> FOV EXP -> TMS Up to Track

[ ] Laser Arm Switch - ON prior to 5nm to IP
[ ] Master Arm - ARM at STPT Fence-In
[ ] TGP - A-G Track verified (AREA or POINT)`,

  'notes/rwr_countermeasures.md': `## ALR-56M RWR THREAT SYMBOLS & DEFENSIVE BANDS
- '2', '3', '5': Strategic Heavy SAMs (SA-2, SA-3, SA-5) — Standoff / high altitude threats
- '6', '8', '11', '17': Tactical Mobile SAMs (SA-6, SA-8, SA-11/17) — Lethal zone 12-18 NM
- '10', '20', 'BB': High-End IADS (SA-10 Grumble, SA-20, Big Bird) — Lethal zone 45-65 NM
- '15', '22', 'S6': Short Range Air Defense (Tor SA-15, Pantsir SA-22, Tunguska) — Lethal under 7 NM
- '29', '31', '35': Interceptors (MiG-29, MiG-31 Foxhound, Su-35) — Look-down pulse Doppler

RWR SEARCH SYMBOL: STEADY ICON OUTSIDE DIAMOND
RWR TRACK SYMBOL: FLASHING ICON WITH AUDIBLE TONE
RWR LAUNCH SYMBOL: FLASHING ICON INSIDE DIAMOND (HIGH PITCH WARBLE)
DEFENSIVE NOTCH: BEAM THREAT AT 90° / 3-9 LINE

## COUNTERMEASURES DISPENSER (CMS) PROGRAMS
PROGRAM 1 (RADAR SAM BREAK): 2 CHAFF / 1 FLARE x 4 CYCLES (INTERVAL 0.5S)
PROGRAM 2 (IR MISSILE BREAK): 1 CHAFF / 2 FLARES x 6 CYCLES (INTERVAL 0.25S)
PROGRAM 3 (CHAFF ONLY CORRIDOR): 2 CHAFF x 10 CYCLES (INTERVAL 1.0S)
PROGRAM 4 (PRE-EMPTIVE POP): 1 FLARE EVERY 3.0S FOR BOMB RUN

WARNING: {highlight: Missile Launch Audio} requires immediate maximum break toward beam + Chaff/Flare
CAUTION: Doppler Notch is effective only against radar guided missiles; descend below threat radar horizon

[ ] CMS MODE Switch - SEMI or AUTO
[ ] RWR Power - ON / HANDOFF NORMAL
[ ] Jammer Switch (ALQ-131 / 184) - OPERATE / XMIT`,

  'notes/ag_ballistic.md': `## UNGUIDED GENERAL PURPOSE BOMBS (MK-82 / MK-84)
- Low-Drag (LDGP): Level CCRP at 15k-20k FT or 30° dive CCIP (pull out > 4,000 FT AGL)
- High-Drag (Snakeye / AIR): Low-level 450-500 kts at 300-500 FT AGL
- Frag Avoidance: Minimum pull-out altitude 1,500 FT AGL (Mk-82 AIR) / 3,000 FT (Mk-84)

MK-82 LDGP RELEASE GATE: 450-500 KTS / 15,000 FT MSL
MK-82 AIR LOW-LEVEL GATE: 480 KTS / 300-500 FT AGL
GUN CEASE-FIRE ALTITUDE: 1,000 FT AGL (MANDATORY PULL-OUT)

## CLUSTER BOMB UNITS (CBU-87 / 97 / 103 / 105)
- CBU-87 / 103 (CEM): Anti-personnel / soft vehicle spread (HOB 1,200-1,500 FT)
- CBU-97 / 105 (SFW): Sensor-Fuzed anti-armor pucks (HOB 1,500 FT AGL mandatory)
- Release Gate: Optimum 450 kts, 20° dive or level CCRP from 12,000-18,000 FT

WARNING: {highlight: CBU-97/105 SFW} fuzing fails if released below 8,000 FT MSL or wrong HOB
CAUTION: Frag envelope for Mk-84 low-altitude drops requires immediate 5G break away

## M61A1 20MM VULCAN CANNON STRAFE
- Gun Modes: EEGS Level V for A-A, STRAFE for A-G
- Roll-in / Cease-fire: Roll-in 3,000-4,000 FT AGL at 350-400 kts; pull out by 1,000 FT AGL
- SMS Setup: Verify CCIP / CCRP mode, interval & quantity on SMS page`,

  'notes/pfl_fault_actions.md': `## CRITICAL PILOT FAULT LIST (PFL) CODES & ACTIONS
- MAIN GEN: Main generator trip. EPU will start if both Main and Stby Gen drop. Shed electrical load.
- STBY GEN: Standby generator inoperative. Avoid heavy electrical bus cycling; monitor voltmeter.
- CADC / F-ACK: Central Air Data Computer failure. Airspeed on HUD unreliable; fly standby pitot gauge.
- FLCS FAULT: Flight Control System channel mismatch. Verify wings level; cycle FLCS RESET switch.
- SEC: Main Engine Control transfer to secondary mode. Afterburner unavailable; high idle thrust.
- ENG CONT DEGR: Digital engine control degraded. Maintain smooth throttle; avoid abrupt snaps.
- HYD OIL LO: Hydraulic fluid quantity low. Cross-check Sys A and Sys B gauges (>2,800 PSI normal).
- RADAR / RWR DEGR: Sensor cooling airflow reduced. Check ECS airflow and bleed air switches.

BATTERY RUNTIME (EPU OFF): ~10-12 MINUTES ONLY
EPU OPERATING RUNTIME: ~10 MINUTES (HYDRAZINE POWER)
CADC AIRSPEED BACKUP: CROSS-CHECK STANDBY ALTIMETER / ASI
SEC IDLE THRUST WARNING: 75-80% RPM (LONGER LANDING ROLLOUT)

WARNING: {highlight: If MAIN GEN drops in flight}, verify EPU RUN light illuminates within 3 seconds
CAUTION: SEC mode increases engine idle thrust significantly; plan long rollout or hook engagement

## PFL FAULT RESPONSE CHECKLIST
[ ] MASTER CAUTION Light - PUSH TO RESET
[ ] F-ACK Page on DED - REVIEW 3-LETTER FAULT CODE
[ ] FLCS RESET Switch - MOMENTARY TOGGLE TO RESET (ONE ATTEMPT ONLY)
[ ] Standby Instruments - VERIFY ATTITUDE, AIRSPEED & HEADING`,

  'notes/sead_harm.md': `## AGM-88 HARM EMPLOYMENT PROFILES
- POS (Position Known): Pre-Briefed (PB), Equations of Motion (EOM), Range Unknown (RUK)
- HAS (HARM as Sensor): Direct seeker search | HAD: HTS pod display with threat ranges

HARM MAX RANGE (FL300): 40-55 NM (EOM / HIGH ALT)
HARM LOW-ALT RANGE: 15-22 NM (POP-UP PROFILE)
POP-UP PROFILE: 350 KTS 500 FT -> 4G PULL TO 35° -> PICKLE 12,000 FT

## COMMON THEATER SAM ALIC TABLE CODES
SA-2 / SA-3 / SA-5 (STRATEGIC): ALIC 102 / 103 / 105
SA-6 / SA-8 / SA-11 (MOBILE): ALIC 106 / 108 / 111
SA-10 / SA-15 / HQ-9 (ADVANCED): ALIC 110 / 115 / 119

WARNING: {highlight: Active SA-10 / SA-20} has lethal track to 65 NM; respect 25 NM standoff
CAUTION: If target radar drops offline during flyout, HARM defaults to dead reckoning

## SEAD TACTICAL CHECKLIST
[ ] Master Arm - ARM | WPN Mode - HARM (POS or HAS)
[ ] Threat Table - ALIC code loaded and verified
[ ] Magnum Call - Broadcast callsign, weapon, and target radar code`,

  'notes/ep_hydraulics.md': `## HYDRAULIC SYSTEM A & B FAILURE ANALYSIS
- SYSTEM A: Flight controls (FLCS primary actuators), Speedbrakes, Trailing Edge Flaps.
- SYSTEM B: Flight controls (FLCS secondary actuators), Landing Gear, Brakes, Nosewheel Steering, Gun.
- Cross-Over: Flight control surfaces remain operable on either single system; landing gear requires Sys B.

NORMAL HYDRAULIC PRESSURE: 2,850-3,200 PSI
LOW PRESSURE CAUTION: BELOW 1,000 PSI
BRAKE ACCUMULATOR MIN: 750 PSI (EMERGENCY BRAKE ONLY)
HOOK EXTENSION LIMIT: 175 KTS MAXIMUM ENGAGEMENT

## SYSTEM B LOSS & ALTERNATE GEAR EXTENSION
1. AIRSPEED - REDUCE BELOW 300 KIAS
2. LANDING GEAR HANDLE - DOWN
3. ALT GEAR EXTENSION HANDLE - PULL OUT FULLY
4. VERIFY - 3 GREEN GEAR DOWN LIGHTS ILLUMINATED
5. NOSEWHEEL STEERING - INOPERATIVE (USE DIFFERENTIAL BRAKING)
6. ARRESTOR HOOK - EXTEND IF BRAKE ACCUMULATOR EXHAUSTED

WARNING: {highlight: With System B failure, normal wheel braking is lost}; accumulator gives ~75 pushes
CAUTION: Nosewheel steering is completely disabled on System B failure; maintain rudder steering

## EMERGENCY ARRESTOR HOOK LANDING
- Airspeed at cable: Maximum 175 kts groundspeed
- Alignment: Touchdown on runway centerline ±25 FT
- Pattern: Fly straight-in approach; do not flare excessively`,

  'notes/airframe_limits.md': `## AIRFRAME G-LOAD & CONFIGURATION LIMITS
- Category I (Clean / A-A Stores): -3.0G to +9.0G
- Category III (Heavy A-G Stores / External Tanks): -1.0G to +5.5G
- Speedbrakes / Flaps: No speed limit on speedbrakes; flaps max 300 KIAS

MAX GEAR EXTENSION SPEED: 300 KIAS / 0.65 MACH
MAX TIRE GROUNDSPEED: 215 KTS GROUNDSPEED
MAX TAKEOFF / LANDING WT: 42,300 LBS RAMP / 32,000 LBS FIELD
HOOK ENGAGEMENT MAX: 175 KTS GROUNDSPEED (+-25 FT CENTERLINE)

## CROSSWIND LANDING LIMITS
DRY RUNWAY MAX XWIND: 25 KTS DIRECT COMPONENT
WET RUNWAY MAX XWIND: 15 KTS DIRECT COMPONENT
ICY / CONTAMINATED MAX: 10 KTS DIRECT COMPONENT

WARNING: {highlight: Exceeding 215 kts tire speed} on heavy-weight landing will cause tire blowout
CAUTION: Category III stores require STORES switch in CAT III to prevent FLCS departure

## PRE-LANDING CONFIGURATION CHECKLIST
[ ] STORES CONFIG Switch - VERIFY CAT I or CAT III
[ ] Landing Gear Handle - DOWN below 300 KIAS (3 Green verified)
[ ] Brake Pressure - Verify > 2,800 PSI on hydraulic gauge`,

  'notes/divert_airfields.md': `## THEATER PRIMARY DIVERT AIRFIELDS
GIMHAE (RKPK): RWY 18L/36R (9,000 FT) | TCN: 045X | TWR: 236.600 | ILS: 110.50 (36R)
OSAN (RKSO): RWY 09/27 (9,000 FT) | TCN: 034X | TWR: 308.800 | ILS: 109.90 (27)
KUNSAN (RKJK): RWY 18/36 (9,000 FT) | TCN: 075X | TWR: 292.300 | ILS: 110.30 (36)
CHONGJU (RKTU): RWY 06R/24L (9,000 FT) | TCN: 087X | TWR: 235.300 | ILS: 110.10 (24L)
SEOSAN (RKTP): RWY 02R/20L (9,000 FT) | TCN: 102X | TWR: 233.300 | ILS: 108.70 (20L)
TAEGU (RKTN): RWY 13R/31L (9,000 FT) | TCN: 029X | TWR: 317.500 | ILS: 108.30 (31L)
POHANG (RKTH): RWY 10/28 (7,000 FT) | TCN: 072X | TWR: 234.200 | ILS: 109.50 (28)
SACHEON (RKPS): RWY 06L/24R (9,000 FT) | TCN: 031X | TWR: 236.200 | ILS: 109.10 (24R)

EMERGENCY GUARD FREQ: UHF 243.000 / VHF 121.500
EMERGENCY SQUAWK: 7700
LOST COMMS SQUAWK: 7600
RADIO CHECK FREQ: 254.000 (PACKAGE UNIFIED)

WARNING: {highlight: Verify runway length and arresting gear cable availability} before diverting heavy
CAUTION: Airfield elevation differences affect altimeter subscale; reset QNH upon initial contact

## DIVERT FLOW PROCEDURE
[ ] Fuel State - Check BINGO vs distance to alternate base
[ ] TACAN - Dial alternate channel and verify bearing/DME
[ ] Tower Frequency - Dial tower frequency on Comm 1
[ ] Divert Squawk - Set 7700 if declared fuel emergency`,

  'notes/approach_speeds.md': `## OVERHEAD TACTICAL BREAK & RECOVERY
- Entry & Initial: 1,500 FT AGL at 300 KIAS aligned with runway centerline
- Break Turn: 2.5G-3.5G level turn to downwind; throttle IDLE; speedbrakes as required
- Gear & Flaps: Below 300 kts drop gear handle; below 240 kts flaps full; 1.0-1.2 NM spacing

BREAK ALTITUDE / AIRSPEED: 1,500 FT AGL / 300 KIAS
FINAL APPROACH AOA: 11°-13° AOA (ON-SPEED GREEN DONUT)

## ON-SPEED FINAL APPROACH SPEEDS (13° AOA)
20,000 LBS / 22,000 LBS: 125 KIAS / 131 KIAS
25,000 LBS / 28,000 LBS: 140 KIAS / 148 KIAS
31,000 LBS (HEAVY): 156 KIAS

WARNING: {highlight: Avoid pulling more than 15° AOA} on short final to prevent drag-rise sink rate
CAUTION: Crosswind landings require crab technique until touchdown; do not wing-low into ground

## FINAL RECOVERY CHECKLIST
[ ] Landing Gear - 3 GREEN VERIFIED
[ ] AOA Indexer - GREEN DONUT (11°-13° AOA)
[ ] Speedbrakes - EXTENDED 60° (FLIGHT IDLE TOUCHDOWN)`,

  'notes/ifr_holding.md': `## INSTRUMENT HOLDING PROCEDURES & ENTRIES
- Standard Holding: Right-hand turns, 1-min inbound leg (< FL140) / 1.5-min (> FL140)
- Direct Entry: Inbound track within 70° sector of holding fix
- Teardrop Entry: Outbound 30° toward holding side for 1 min, then right to intercept
- Parallel Entry: Outbound on non-holding side for 1 min, then left turn to inbound

HOLDING AIRSPEED & AOA: 210-230 KIAS / 6°-7° AOA (MAX ENDURANCE)
MISSED APPROACH CLIMB: MIL POWER 300 KIAS TO 4,000 FT MSL
ILS GLIDE PATH GATE: 2.5°-3.0° DESCENT (~750 FT/MIN AT 140 KTS)
DECISION ALTITUDE (DA): MINIMUM 200 FT AGL (MISSED APP IF NO VISUAL)

WARNING: {highlight: Execute immediate Missed Approach} if raw glide slope deviates > 1 dot low
CAUTION: Maintain positive rate of climb before retracting landing gear on missed approach

## MISSED APPROACH & GO-AROUND FLOW
[ ] Throttle - MILITARY POWER (AB IF HEAVY)
[ ] Pitch - ROTATE TO 10° NOSE UP ON FPM
[ ] Altimeter & VVI - VERIFY POSITIVE RATE OF CLIMB
[ ] Landing Gear - UP (VERIFY AIRSPEED BELOW 300 KIAS)
[ ] Navigation - FOLLOW PUBLISHED MISSED APPROACH TRACK`,

  'notes/comms_laser_matrix.md': `## STANDARD PRF LASER CODE ASSIGNMENTS
FLIGHT LEAD PRF CODE: 1688
WINGMAN #2 PRF CODE: 1685
ELEMENT LEAD #3 PRF CODE: 1681
WINGMAN #4 PRF CODE: 1684
JTAC / FORWARD AIR CONTROLLER: 1111 / 1511
BUDDY LASE STANDARD: 1655

## RADIO BAND & CHANNEL PRESET LADDER
CHANNEL 1 (UNIFIED): TACTICAL AIRFIELD GROUND / RAMP
CHANNEL 2 (UNIFIED): TACTICAL AIRFIELD TOWER
CHANNEL 3 (UNIFIED): DEPARTURE / RADAR CONTROL
CHANNEL 4 (UNIFIED): ENROUTE / COMMON TACTICAL
CHANNEL 5 (UNIFIED): AIR COMBAT MANEUVERING / INTERCEPT
CHANNEL 6 (UNIFIED): AWACS 'MAGIC' / PICTURE BROADCAST
CHANNEL 7 (UNIFIED): OVERHEAD TANKER TRACK / BOOM
CHANNEL 15 (UNIFIED): PACKAGE TACTICAL INTRA-FLIGHT
CHANNEL 20 (UNIFIED): EMERGENCY GUARD (243.0 UHF / 121.5 VHF)

WARNING: {highlight: Confirm Laser PRF Code matches} both weapon seeker and TGP page before pickle
CAUTION: Guard 243.000 is always monitored on UHF backup receiver; verify guard switch enabled

## TACAN FREQUENCY PAIRINGS & BANDS
- Ground Airfield Navigation: Channels 01X to 126X (Receive / Transmit T/R)
- Air-to-Air Tanker / Flight Lead Yardstick: 63-channel separation (e.g. Lead 29Y -> Wing 92Y)

[ ] DED UFC Laser Code - VERIFY 1688 ON BOTH TGP & WPN
[ ] UHF Radio - PRESET CH LOADED (VERIFY BOTH COMM 1 & 2)
[ ] IFF Transponder - MODE 4 ENABLED / CODE SET`,

  'notes/ep_flameout.md': `## ENGINE FLAMEOUT / LOSS OF THRUST (MEMORY ITEMS)
1. AIRSPEED - MAINTAIN 200-220 KIAS (BEST GLIDE)
2. JFS SWITCH - START 2
3. THROTTLE - OFF, THEN ADVANCE TO IDLE AT 12% RPM
4. EPU RUN LIGHT - VERIFY ILLUMINATED (GREEN)
5. ENG CONT SWITCH - SEC (IF MAIN CONTROL FAILS TO RELIGHT)

OPTIMUM GLIDE SPEED: 200-220 KIAS (CLEAN CONFIG)
GLIDE RATIO: ~1.7 NM PER 1,000 FT ALTITUDE LOSS
JFS RESTART ENVELOPE: BELOW 20,000 FT MSL / UNDER 400 KTS
SPOOLDOWN RESTART: ABOVE 250 KTS / RPM ABOVE 50%

## SFO (SIMULATED FLAMEOUT) EMERGENCY PROFILE
- High Key: 7,000-10,000 FT AGL directly over threshold (gear UP, 200 kts)
- Low Key: 3,000-4,000 FT AGL abeam rollout point (gear DOWN, 190-200 kts)
- Base Turn: 1,500-2,000 FT AGL maintaining 180-190 kts
- Final Rollout: Minimum 800 FT AGL aligned with runway centerline

WARNING: {highlight: EPU hydrazine provides only ~10 minutes} of emergency electrical and hydraulic power
CAUTION: SEC mode relight produces no afterburner and higher idle thrust; prepare for long landing rollout

## EJECT CRITERIA (IF NO AIRSTART)
- Controlled Flight Ejection Altitude: 2,000 FT AGL minimum
- Uncontrolled Flight Ejection Altitude: 4,000 FT AGL minimum
- Pull Ejection Handle firmly between legs with back flat against seat`,
};

// Default 32 slots matching Falcon BMS standard layout
export const DEFAULT_DEV_SLOTS: Record<string, SlotConfig> = {
  F16_1L: { type: 'briefing_roster', description: 'Package Roster & Comms Ladder', title: 'PACKAGE ROSTER & COMMS', header_code: 'SPINS // ROSTER-COMMS' },
  F16_1R: { type: 'briefing_steerpoints', description: 'Steerpoints & Weather', title: 'STEERPOINTS & NAVIGATION', header_code: 'FLIGHT PLAN // NAV' },
  F16_2L: { type: 'custom_html', path: 'custom/kneeboard-checklist-1-start.html', description: 'Checklist 1: Engine Start', title: 'ENGINE START & SYSTEMS CHECK', header_code: 'CHECKLIST // START' },
  F16_2R: { type: 'custom_html', path: 'custom/kneeboard-threats-air.html', description: 'Air-to-Air Threat Guide', title: 'AIR-TO-AIR THREAT GUIDE', header_code: 'THREATS // A-A' },
  F16_3L: { type: 'custom_html', path: 'custom/kneeboard-checklist-2-taxi-takeoff-land.html', description: 'Checklist 2: Taxi & Takeoff', title: 'TAXI, TAKEOFF & LANDING', header_code: 'CHECKLIST // TAXI-TO' },
  F16_3R: { type: 'custom_html', path: 'custom/kneeboard-threats-gnd.html', description: 'SAM Threat Guide', title: 'SURFACE-TO-AIR MISSILE GUIDE', header_code: 'THREATS // SAM' },
  F16_4L: { type: 'custom_html', path: 'custom/kneeboard-checklist-3-tacan-aar.html', description: 'Checklist 3: TACAN & AAR', title: 'TACAN NAV & AIR REFUELING', header_code: 'CHECKLIST // TACAN-AAR' },
  F16_4R: { type: 'mission_route', description: 'Mission Route Overview Map', title: 'MISSION ROUTE OVERVIEW', header_code: 'MAP // ROUTE' },
  F16_5L: { type: 'custom_html', path: 'custom/kneeboard-checklist-4-fence.html', description: 'Checklist 4: Fence-In / Fence-Out', title: 'FENCE-IN / FENCE-OUT COMBAT', header_code: 'CHECKLIST // FENCE' },
  F16_5R: { type: 'mission_target', description: 'Tactical Target Combat Area Map', title: 'TARGET & COMBAT AREA MAP', header_code: 'MAP // TARGET' },
  F16_6L: { type: 'custom_html', path: 'custom/kneeboard-checklist-5-lgb-mav-mark.html', description: 'Checklist 5: LGB, Maverick & Mark Point', title: 'LGB & MAVERICK EMPLOYMENT', header_code: 'CHECKLIST // PGM' },
  F16_6R: { type: 'dep_taxi', description: 'Departure Airfield Taxi & Parking Chart', title: 'DEPARTURE AIRFIELD TAXI', header_code: 'AIRFIELD // TAXI' },
  F16_7L: {
    type: 'notes',
    title: 'PILOT MISSION SCRATCHPAD',
    header_code: 'MISSION 15 // SCRATCHPAD',
    notes: [
      '## 1. LOCATIONS',
      'Sinan-ni Bridge: N38°33.184" E127°37.770" - 1127\'',
      'Hyesan Bridge: N38°22.395" E127°45.658" - 620\'',
      '',
      '## 2. PROFILES',
      '- Profile 1: {orange: PRE}, AD {blue: 9.00SEC}, IMP AZ {green: 350}',
      '- Profile 2: {orange: PRE}, AD {blue: 7.00SEC}, IMP AZ {green: 340}',
      '',
      'WARNING: {highlight: Active SA-3 Grumble} tracking near STPT 5 and STPT 6',
      'CAUTION: Maintain minimum 25,000 FT MSL until IP ingress',
    ],
  },
  F16_7R: { type: 'arr_ils_primary', description: 'Arrival Primary ILS Approach Chart', title: 'ARRIVAL ILS APPROACH', header_code: 'APPROACH // ILS-1' },
  F16_8L: { type: 'notes', path: 'notes/fuel_planning.md', title: 'FUEL REGIMES, BINGO & HOLDING', header_code: 'T.O. 1F-16CM-1 // FUEL-OPS', page_num: 'FUEL-1', preset: 'standard' },
  F16_8R: { type: 'arr_ils_secondary', description: 'Arrival Secondary ILS Approach Chart', title: 'ARRIVAL SECONDARY ILS', header_code: 'APPROACH // ILS-2' },
  F16_9L: { type: 'notes', path: 'notes/aa_missiles.md', title: 'A/A MISSILES & BVR TIMELINES', header_code: 'T.O. 1F-16CM-34-1-1 // A-A BVR', page_num: 'A/A-1', preset: 'tactical' },
  F16_9R: { type: 'arr_taxi', description: 'Recovery Airfield Ground Taxi Chart', title: 'RECOVERY AIRFIELD TAXI', header_code: 'AIRFIELD // RECOVERY' },
  F16_10L: { type: 'notes', path: 'notes/ag_precision.md', title: 'A/G PRECISION GUIDED MUNITIONS', header_code: 'T.O. 1F-16CM-34-1-2 // PGM STRIKE', page_num: 'PGM-1', preset: 'caution' },
  F16_10R: { type: 'notes', path: 'notes/rwr_countermeasures.md', title: 'RWR THREAT MATRIX & CMS PROGRAMS', header_code: 'T.O. 1F-16CM-34-1-3 // RWR THREATS', page_num: 'RWR-1', preset: 'caution' },
  F16_11L: { type: 'notes', path: 'notes/ag_ballistic.md', title: 'A/G BALLISTIC ORDNANCE & STRAFE', header_code: 'T.O. 1F-16CM-34-1-1 // BALLISTICS', page_num: 'BALL-1', preset: 'caution' },
  F16_11R: { type: 'notes', path: 'notes/pfl_fault_actions.md', title: 'CRITICAL PILOT FAULT LIST (PFL)', header_code: 'T.O. 1F-16CM-1CL-1 // PFL FAULTS', page_num: 'PFL-1', preset: 'caution' },
  F16_12L: { type: 'notes', path: 'notes/sead_harm.md', title: 'SEAD / HARM PROFILES & ALIC CODES', header_code: 'T.O. 1F-16CM-34-1-4 // SEAD HARM', page_num: 'SEAD-1', preset: 'caution' },
  F16_12R: { type: 'notes', path: 'notes/ep_hydraulics.md', title: 'HYDRAULIC FAILURE & ALT GEAR', header_code: 'T.O. 1F-16CM-1CL-2 // HYD-GEAR', page_num: 'HYD-1', preset: 'caution' },
  F16_13L: { type: 'notes', path: 'notes/airframe_limits.md', title: 'AIRFRAME & CROSSWIND LIMITATIONS', header_code: 'T.O. 1F-16CM-1 // AIRFRAME LIMITS', page_num: 'LIMITS-1', preset: 'caution' },
  F16_13R: { type: 'notes', path: 'notes/divert_airfields.md', title: 'THEATER DIVERT AIRFIELDS DIRECTORY', header_code: 'FLIGHT INFO PUB // THEATER DIVERT', page_num: 'DIVERT-1', preset: 'standard' },
  F16_14L: { type: 'notes', path: 'notes/approach_speeds.md', title: 'APPROACH SPEEDS & OVERHEAD BREAK', header_code: 'T.O. 1F-16CM-1 // APPROACH & BREAK', page_num: 'APP-1', preset: 'standard' },
  F16_14R: { type: 'notes', path: 'notes/ifr_holding.md', title: 'INSTRUMENT HOLDING & MISSED APP', header_code: 'FLIGHT INFO PUB // IFR RECOVERY', page_num: 'IFR-1', preset: 'standard' },
  F16_15L: { type: 'notes', path: 'notes/comms_laser_matrix.md', title: 'LASER CODES & COMMS LADDER', header_code: 'T.O. 1F-16CM-1 // COMMS & LASER', page_num: 'COMMS-1', preset: 'standard' },
  F16_15R: { type: 'notes', path: 'notes/ep_flameout.md', title: 'ENGINE FLAMEOUT & SFO PROFILE', header_code: 'T.O. 1F-16CM-1CL-1 // EP FLAMEOUT', page_num: 'EP-1', preset: 'emergency' },
  F16_16L: { type: 'blank', description: 'Intentionally left blank', title: 'INTENTIONALLY LEFT BLANK', header_code: 'BLANK' },
  F16_16R: { type: 'blank', description: 'Intentionally left blank', title: 'INTENTIONALLY LEFT BLANK', header_code: 'BLANK' },
};

// All available templates cataloged for the library drawer with authentic slot types
export const AVAILABLE_TEMPLATES_CATALOG: TemplateMetadata[] = [
  // Flight Notes (.md)
  { id: 'fuel_planning', type: 'notes', name: 'Fuel Regimes, Bingo & Holding', category: 'notes', default_title: 'FUEL REGIMES, BINGO & HOLDING', default_code: 'T.O. 1F-16CM-1 // FUEL-OPS', path: 'notes/fuel_planning.md', preset: 'standard', description: 'Cruise consumption, Bingo/Joker formulas and abnormal gravity feed' },
  { id: 'aa_missiles', type: 'notes', name: 'A/A Missiles & BVR Timelines', category: 'notes', default_title: 'A/A MISSILES & BVR TIMELINES', default_code: 'T.O. 1F-16CM-34-1-1 // A-A BVR', path: 'notes/aa_missiles.md', preset: 'tactical', description: 'AIM-120 AMRAAM pitbull gates, MAR envelopes and AIM-9X cueing' },
  { id: 'ag_precision', type: 'notes', name: 'A/G Precision Guided Munitions', category: 'notes', default_title: 'A/G PRECISION GUIDED MUNITIONS', default_code: 'T.O. 1F-16CM-34-1-2 // PGM STRIKE', path: 'notes/ag_precision.md', preset: 'caution', description: 'GBU-10/12/24 release parameters, JDAM LAR and AGM-65 Maverick' },
  { id: 'rwr_countermeasures', type: 'notes', name: 'RWR Threat Matrix & CMS Programs', category: 'notes', default_title: 'RWR THREAT MATRIX & CMS PROGRAMS', default_code: 'T.O. 1F-16CM-34-1-3 // RWR THREATS', path: 'notes/rwr_countermeasures.md', preset: 'caution', description: 'ALR-56M threat symbology, lethal zones, and CMS 1-4 programs' },
  { id: 'ag_ballistic', type: 'notes', name: 'A/G Ballistic Ordnance & Strafe', category: 'notes', default_title: 'A/G BALLISTIC ORDNANCE & STRAFE', default_code: 'T.O. 1F-16CM-34-1-1 // BALLISTICS', path: 'notes/ag_ballistic.md', preset: 'caution', description: 'Mk-82/84 CCIP/CCRP gates, CBU-87/97/105 and 20mm strafe' },
  { id: 'pfl_fault_actions', type: 'notes', name: 'Critical Pilot Fault List (PFL)', category: 'notes', default_title: 'CRITICAL PILOT FAULT LIST (PFL)', default_code: 'T.O. 1F-16CM-1CL-1 // PFL FAULTS', path: 'notes/pfl_fault_actions.md', preset: 'caution', description: 'Main Gen, CADC, FLCS fault actions and battery limits' },
  { id: 'sead_harm', type: 'notes', name: 'SEAD / HARM Profiles & ALIC Codes', category: 'notes', default_title: 'SEAD / HARM PROFILES & ALIC CODES', default_code: 'T.O. 1F-16CM-34-1-4 // SEAD HARM', path: 'notes/sead_harm.md', preset: 'caution', description: 'AGM-88 HARM POS/HAS modes, pop-up profiles and SAM ALIC table' },
  { id: 'ep_hydraulics', type: 'notes', name: 'Hydraulic Failure & Alt Gear', category: 'notes', default_title: 'HYDRAULIC FAILURE & ALT GEAR', default_code: 'T.O. 1F-16CM-1CL-2 // HYD-GEAR', path: 'notes/ep_hydraulics.md', preset: 'caution', description: 'System A/B split, alternate gear extension and hook landing' },
  { id: 'airframe_limits', type: 'notes', name: 'Airframe & Crosswind Limitations', category: 'notes', default_title: 'AIRFRAME & CROSSWIND LIMITATIONS', default_code: 'T.O. 1F-16CM-1 // AIRFRAME LIMITS', path: 'notes/airframe_limits.md', preset: 'caution', description: 'CAT I / CAT III G-limits, max gear/tire speeds and crosswinds' },
  { id: 'divert_airfields', type: 'notes', name: 'Theater Divert Airfields Directory', category: 'notes', default_title: 'THEATER DIVERT AIRFIELDS DIRECTORY', default_code: 'FLIGHT INFO PUB // THEATER DIVERT', path: 'notes/divert_airfields.md', preset: 'standard', description: 'RKPK, RKSO, RKJK, RKTU runways, TACAN, Tower and ILS freqs' },
  { id: 'approach_speeds', type: 'notes', name: 'Approach Speeds & Overhead Break', category: 'notes', default_title: 'APPROACH SPEEDS & OVERHEAD BREAK', default_code: 'T.O. 1F-16CM-1 // APPROACH & BREAK', path: 'notes/approach_speeds.md', preset: 'standard', description: 'Tactical break initial, downwind spacing, and weight-based speeds' },
  { id: 'ifr_holding', type: 'notes', name: 'Instrument Holding & Missed App', category: 'notes', default_title: 'INSTRUMENT HOLDING & MISSED APP', default_code: 'FLIGHT INFO PUB // IFR RECOVERY', path: 'notes/ifr_holding.md', preset: 'standard', description: 'Holding patterns, maximum endurance AOA and go-around procedure' },
  { id: 'comms_laser_matrix', type: 'notes', name: 'Laser Codes & Comms Ladder', category: 'notes', default_title: 'LASER CODES & COMMS LADDER', default_code: 'T.O. 1F-16CM-1 // COMMS & LASER', path: 'notes/comms_laser_matrix.md', preset: 'standard', description: 'Lead, wingman, JTAC PRF codes, radio channels and TACAN pairing' },
  { id: 'ep_flameout', type: 'notes', name: 'Engine Flameout & SFO Profile', category: 'notes', default_title: 'ENGINE FLAMEOUT & SFO PROFILE', default_code: 'T.O. 1F-16CM-1CL-1 // EP FLAMEOUT', path: 'notes/ep_flameout.md', preset: 'emergency', description: 'Memory items, best glide airspeed, SFO high/low key and ejection' },

  // Tactical Checklists (HTML)
  { id: 'chk_start', type: 'custom_html', name: 'Checklist 1: Engine Start', category: 'checklist', default_title: 'ENGINE START & SYSTEMS CHECK', default_code: 'CHECKLIST // START', path: 'custom/kneeboard-checklist-1-start.html', description: 'Before start and after start switch flows and BIT checks' },
  { id: 'chk_taxi_to_land', type: 'custom_html', name: 'Checklist 2: Taxi, Takeoff & Landing', category: 'checklist', default_title: 'TAXI, TAKEOFF & LANDING', default_code: 'CHECKLIST // TAXI-TO', path: 'custom/kneeboard-checklist-2-taxi-takeoff-land.html', description: 'Departure checks, line-up, takeoff flow and landing final' },
  { id: 'chk_tacan_aar', type: 'custom_html', name: 'Checklist 3: TACAN Nav & Refueling', category: 'checklist', default_title: 'TACAN NAV & AIR REFUELING', default_code: 'CHECKLIST // TACAN-AAR', path: 'custom/kneeboard-checklist-3-tacan-aar.html', description: 'Air-to-air refueling boom contact, disconnect and TACAN' },
  { id: 'chk_fence', type: 'custom_html', name: 'Checklist 4: Fence-In / Fence-Out', category: 'checklist', default_title: 'FENCE-IN / FENCE-OUT COMBAT', default_code: 'CHECKLIST // FENCE', path: 'custom/kneeboard-checklist-4-fence.html', description: 'Master arm, jammer, RWR, radar mode and egress safety' },
  { id: 'chk_pgm', type: 'custom_html', name: 'Checklist 5: LGB, Maverick & Mark Point', category: 'checklist', default_title: 'LGB & MAVERICK EMPLOYMENT', default_code: 'CHECKLIST // PGM', path: 'custom/kneeboard-checklist-5-lgb-mav-mark.html', description: 'TGP handoff, bore/slave and mark point coordinates' },
  { id: 'threat_air', type: 'custom_html', name: 'Threat Guide: Air-to-Air Threats', category: 'checklist', default_title: 'AIR-TO-AIR THREAT GUIDE', default_code: 'THREATS // A-A', path: 'custom/kneeboard-threats-air.html', description: 'MiG-29, Su-27 radar and IR missile engagement profiles' },
  { id: 'threat_gnd', type: 'custom_html', name: 'Threat Guide: Surface-to-Air (SAM)', category: 'checklist', default_title: 'SURFACE-TO-AIR MISSILE GUIDE', default_code: 'THREATS // SAM', path: 'custom/kneeboard-threats-gnd.html', description: 'SA-2 through SA-15 threat envelopes, guidance and RWR tags' },

  // Briefing Dynamic Cards & Aeronautical Charts
  { id: 'briefing_roster', type: 'briefing_roster', name: 'Mission Briefing: Package Roster', category: 'chart', default_title: 'PACKAGE ROSTER & COMMS', default_code: 'SPINS // ROSTER-COMMS', path: '', description: 'Dynamic mission callsigns, flight elements, IFF, laser and comms' },
  { id: 'briefing_steerpoints', type: 'briefing_steerpoints', name: 'Mission Briefing: Steerpoints Table', category: 'chart', default_title: 'STEERPOINTS & NAVIGATION', default_code: 'FLIGHT PLAN // NAV', path: '', description: 'Dynamic steerpoint table with TOT, speed, altitudes and coordinates' },
  { id: 'mission_route', type: 'mission_route', name: 'Mission Route Overview Map', category: 'chart', default_title: 'MISSION ROUTE OVERVIEW', default_code: 'MAP // ROUTE', path: '', description: 'Dynamic Mission Route 16k SkyVector Crop & Flight Polyline' },
  { id: 'mission_target', type: 'mission_target', name: 'Target & Combat Area Map', category: 'chart', default_title: 'TARGET & COMBAT AREA MAP', default_code: 'MAP // TARGET', path: '', description: 'Dynamic Tactical Target / Combat Area Zoom & IP Profile' },
  { id: 'dep_taxi', type: 'dep_taxi', name: 'Departure Airfield Ground Chart', category: 'chart', default_title: 'DEPARTURE AIRFIELD TAXI', default_code: 'AIRFIELD // TAXI', path: '', description: 'Dynamic departure airfield taxiways, runways and parking spots' },
  { id: 'arr_taxi', type: 'arr_taxi', name: 'Recovery Airfield Ground Chart', category: 'chart', default_title: 'RECOVERY AIRFIELD TAXI', default_code: 'AIRFIELD // RECOVERY', path: '', description: 'Dynamic recovery airfield taxiways, runways and parking spots' },
  { id: 'arr_ils_primary', type: 'arr_ils_primary', name: 'Arrival Primary ILS Approach Chart', category: 'chart', default_title: 'ARRIVAL ILS APPROACH', default_code: 'APPROACH // ILS-1', path: '', description: 'Dynamic primary runway ILS approach plate with frequencies' },
  { id: 'arr_ils_secondary', type: 'arr_ils_secondary', name: 'Arrival Secondary ILS Approach Chart', category: 'chart', default_title: 'ARRIVAL SECONDARY ILS', default_code: 'APPROACH // ILS-2', path: '', description: 'Dynamic secondary runway ILS approach plate' },
  { id: 'blank', type: 'blank', name: 'Intentionally Left Blank Card', category: 'chart', default_title: 'INTENTIONALLY LEFT BLANK', default_code: 'BLANK', path: '', description: 'Intentionally Left Blank Aeronautical Card' },
];
