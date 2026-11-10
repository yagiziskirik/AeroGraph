#![allow(non_snake_case, dead_code)]

use std::ffi::c_void;
use std::ptr;
use windows::core::PCWSTR;
use windows::Win32::Foundation::{CloseHandle, HANDLE};
use windows::Win32::System::Memory::{
    MapViewOfFile, OpenFileMappingW, UnmapViewOfFile, FILE_MAP_READ,
};

pub const BMS_MUTEX_NAME: &str = "FALCONBMS-9B416580-DE23-11B2-A386-000C6E135DDE\0";
pub const PRIMARY_SHARED_MEMORY_NAME: &str = "FalconSharedMemoryArea\0";
pub const SECONDARY_SHARED_MEMORY_NAME: &str = "FalconSharedMemoryArea2\0";
pub const STRING_SHARED_MEMORY_NAME: &str = "FalconSharedMemoryAreaString\0";
pub const INTELLIVIBE_SHARED_MEMORY_NAME: &str = "FalconIntellivibeSharedMemoryArea\0";

/// Minimal C-repr subset of BMS4FlightData (FalconSharedMemoryArea)
#[repr(C)]
#[derive(Debug, Clone, Copy, Default)]
pub struct PrimaryFlightData {
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub x_dot: f32,
    pub y_dot: f32,
    pub z_dot: f32,
    pub alpha: f32,
    pub beta: f32,
    pub gamma: f32,
    pub pitch: f32,
    pub roll: f32,
    pub yaw: f32,
    pub mach: f32,
    pub kias: f32,
    pub vt: f32,
    pub gs: f32,
    pub wind_offset: f32,
    pub nozzle_pos: f32,
    pub internal_fuel: f32,
    pub external_fuel: f32,
    pub fuel_flow: f32,
    pub rpm: f32,
    pub ftit: f32,
    pub gear_pos: f32,
    pub speed_brake: f32,
    pub epu_fuel: f32,
    pub oil_pressure: f32,
    pub light_bits: u32,
    pub head_pitch: f32,
    pub head_roll: f32,
    pub head_yaw: f32,
    pub light_bits2: u32,
    pub light_bits3: u32,
    pub chaff_count: f32,
    pub flare_count: f32,
    pub nose_gear_pos: f32,
    pub left_gear_pos: f32,
    pub right_gear_pos: f32,
    pub adi_ils_hor_pos: f32,
    pub adi_ils_ver_pos: f32,
    pub course_state: i32,
    pub heading_state: i32,
    pub total_states: i32,
    pub course_deviation: f32,
    pub desired_course: f32,
    pub distance_to_beacon: f32,
    pub bearing_to_beacon: f32,
    pub current_heading: f32,
    pub desired_heading: f32,
    pub deviation_limit: f32,
    pub half_deviation_limit: f32,
    pub localizer_course: f32,
    pub airbase_x: f32,
    pub airbase_y: f32,
    pub total_values: f32,
    pub trim_pitch: f32,
    pub trim_roll: f32,
    pub trim_yaw: f32,
    pub hsi_bits: u32,
}

/// Minimal C-repr subset of IntellivibeData from Falcon BMS IVibeData.h
#[repr(C)]
#[derive(Debug, Clone, Copy, Default)]
pub struct IntellivibeData {
    pub aa_missile_fired: u8,
    pub ag_missile_fired: u8,
    pub bomb_dropped: u8,
    pub flare_dropped: u8,
    pub chaff_dropped: u8,
    pub bullets_fired: u8,
    // 2 bytes compiler alignment padding before 4-byte int
    pub collision_counter: i32,
    pub is_firing_gun: u8,
    pub is_end_flight: u8,
    pub is_ejecting: u8,
    pub in_3d: u8,
    pub is_paused: u8,
    pub is_frozen: u8,
    pub is_over_g: u8,
    pub is_on_ground: u8,
    pub is_exit_game: u8,
}

/// Dynamic flight information parsed from String Shared Memory
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct BmsStringInfo {
    pub callsign: String,
    pub package_size: String,
    pub aircraft: String,
    pub seat: String,
    pub departure: String,
    pub arrival: String,
    pub alternate: String,
    pub tanker: String,
    pub awacs: String,
    pub ai_seat1: bool,
    pub ai_seat2: bool,
    pub ai_seat3: bool,
    pub ai_seat4: bool,
}

/// Safe memory mapped area wrapper
pub struct MappedArea {
    handle: HANDLE,
    view: *mut c_void,
}

impl MappedArea {
    pub fn open(name: &str) -> Option<Self> {
        let wide: Vec<u16> = name.encode_utf16().collect();
        unsafe {
            let handle = OpenFileMappingW(FILE_MAP_READ.0, false, PCWSTR(wide.as_ptr())).ok()?;
            let view = MapViewOfFile(handle, FILE_MAP_READ, 0, 0, 0);
            if view.Value.is_null() {
                let _ = CloseHandle(handle);
                None
            } else {
                Some(Self {
                    handle,
                    view: view.Value,
                })
            }
        }
    }

    pub fn ptr<T>(&self) -> *const T {
        self.view as *const T
    }
}

impl Drop for MappedArea {
    fn drop(&mut self) {
        unsafe {
            if !self.view.is_null() {
                let _ =
                    UnmapViewOfFile(windows::Win32::System::Memory::MEMORY_MAPPED_VIEW_ADDRESS {
                        Value: self.view,
                    });
            }
            if !self.handle.is_invalid() {
                let _ = CloseHandle(self.handle);
            }
        }
    }
}

/// Client to read Falcon BMS shared memory
pub struct BmsSharedMemoryClient {
    primary: Option<MappedArea>,
    vibe: Option<MappedArea>,
    string_area: Option<MappedArea>,
    last_process_check: std::time::Instant,
}

impl Default for BmsSharedMemoryClient {
    fn default() -> Self {
        Self {
            primary: None,
            vibe: None,
            string_area: None,
            last_process_check: std::time::Instant::now(),
        }
    }
}

impl BmsSharedMemoryClient {
    pub fn new() -> Self {
        Self::default()
    }

    /// Fast, non-persistent check whether Falcon BMS process is currently active.
    pub fn is_bms_running() -> bool {
        crate::updater::is_bms_running()
    }

    /// Attempts to connect to Falcon BMS shared memory areas.
    pub fn connect(&mut self) -> bool {
        if !Self::is_bms_running() {
            return false;
        }
        if self.primary.is_none() {
            self.primary = MappedArea::open(PRIMARY_SHARED_MEMORY_NAME);
        }
        if self.vibe.is_none() {
            self.vibe = MappedArea::open(INTELLIVIBE_SHARED_MEMORY_NAME);
        }
        if self.string_area.is_none() {
            self.string_area = MappedArea::open(STRING_SHARED_MEMORY_NAME);
        }

        self.primary.is_some()
    }

    pub fn is_connected(&mut self) -> bool {
        if self.primary.is_none() {
            return false;
        }
        if self.last_process_check.elapsed() >= std::time::Duration::from_millis(800) {
            self.last_process_check = std::time::Instant::now();
            if !Self::is_bms_running() {
                self.disconnect();
                return false;
            }
        }
        true
    }

    pub fn disconnect(&mut self) {
        self.primary = None;
        self.vibe = None;
        self.string_area = None;
    }

    /// Reads primary flight data safely under mutex synchronization
    pub fn read_primary_data(&self) -> Option<PrimaryFlightData> {
        let area = self.primary.as_ref()?;
        Some(unsafe { ptr::read_unaligned(area.ptr::<PrimaryFlightData>()) })
    }

    /// Reads Intellivibe state (In3D, OnGround, etc.)
    pub fn read_vibe_data(&self) -> Option<IntellivibeData> {
        let area = self.vibe.as_ref()?;
        Some(unsafe { ptr::read_unaligned(area.ptr::<IntellivibeData>()) })
    }

    /// Reads callsigns and airport names from String Shared Memory Area
    pub fn read_string_info(&mut self) -> BmsStringInfo {
        if self.string_area.is_none() {
            self.string_area = MappedArea::open(STRING_SHARED_MEMORY_NAME);
        }
        let area = match self.string_area.as_ref() {
            Some(a) => a,
            None => return BmsStringInfo::default(),
        };

        unsafe {
            // Read header to determine dataSize
            let header_ptr = area.ptr::<u32>();
            let data_size = ptr::read_unaligned(header_ptr.add(2)) as usize;
            if data_size == 0 {
                return BmsStringInfo::default();
            }
            let total_size = 12 + data_size;
            let slice = std::slice::from_raw_parts(area.view as *const u8, total_size);
            Self::unpack_string_data_bytes(slice)
        }
    }

    /// Unpacks raw string shared memory bytes according to Falcon BMS FlightData.h StringData layout.
    pub fn unpack_string_data_bytes(bytes: &[u8]) -> BmsStringInfo {
        let mut info = BmsStringInfo::default();
        if bytes.len() < 12 {
            return info;
        }

        let num_strings = u32::from_le_bytes(bytes[4..8].try_into().unwrap_or([0; 4])) as usize;
        let data_size = u32::from_le_bytes(bytes[8..12].try_into().unwrap_or([0; 4])) as usize;

        if num_strings == 0 || data_size == 0 {
            return info;
        }

        let total_size = (12 + data_size).min(bytes.len());
        let mut offset = 12usize;

        for _ in 0..num_strings {
            if offset + 8 > total_size {
                break;
            }
            let str_id = u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap_or([0; 4]));
            let str_len =
                u32::from_le_bytes(bytes[offset + 4..offset + 8].try_into().unwrap_or([0; 4]))
                    as usize;
            offset += 8;

            if offset + str_len > total_size {
                break;
            }

            let slice = &bytes[offset..offset + str_len];
            let text = String::from_utf8_lossy(slice)
                .trim_matches('\0')
                .trim()
                .to_string();

            // Advance past string payload AND its null-terminator byte (char[strLength + 1])
            offset += str_len + 1;

            // Match known string IDs from Falcon BMS FlightData.h (StringIdentifier enum):
            // 29: AcName
            // 35: VoiceHelpers (<player>|<seats>,<tanker>,<awacs>,<departure>,<arrival>,<alternate>)
            match str_id {
                29 => {
                    if !text.is_empty() {
                        info.aircraft = text;
                    }
                }
                35 => {
                    Self::parse_voice_helpers_into(&text, &mut info);
                }
                _ => {}
            }
        }

        info
    }

    /// Parses the VoiceHelpers payload (str_id 35) into BmsStringInfo
    pub fn parse_voice_helpers_into(raw: &str, info: &mut BmsStringInfo) {
        // Format: <player>|<seats>,<tanker>,<awacs>,<departure>,<arrival>,<alternate>
        // Example: "Cowboy1|PAAX,Texaco7,Chalice9,Osan,Osan,Pyeongtaek"
        if let Some((player_callsign, rest)) = raw.split_once('|') {
            let cs = player_callsign.trim();
            if !cs.is_empty() {
                info.callsign = cs.to_string();
            }

            let tokens: Vec<&str> = rest.split(',').map(|s| s.trim()).collect();
            if let Some(&seats) = tokens.first() {
                let chars: Vec<char> = seats.chars().collect();
                info.ai_seat1 = chars.first().is_some_and(|&c| c == 'A' || c == 'H');
                info.ai_seat2 = chars.get(1).is_some_and(|&c| c == 'A' || c == 'H');
                info.ai_seat3 = chars.get(2).is_some_and(|&c| c == 'A' || c == 'H');
                info.ai_seat4 = chars.get(3).is_some_and(|&c| c == 'A' || c == 'H');

                let total_active = chars.iter().filter(|&&c| c != 'X').count();
                info.package_size = match total_active {
                    1 => "Singleton".to_string(),
                    2 => "2 Ship".to_string(),
                    3 => "3 Ship".to_string(),
                    4 => "4 Ship".to_string(),
                    _ => total_active.to_string(),
                };

                if let Some(player_seat) = chars.iter().position(|&c| c == 'P') {
                    info.seat = (player_seat + 1).to_string();
                }
            }

            if let Some(&tanker) = tokens.get(1) {
                if !tanker.is_empty() && !tanker.eq_ignore_ascii_case("none") {
                    info.tanker = tanker.to_string();
                }
            }

            if let Some(&awacs) = tokens.get(2) {
                if !awacs.is_empty() && !awacs.eq_ignore_ascii_case("none") {
                    info.awacs = awacs.to_string();
                }
            }

            if let Some(&dep) = tokens.get(3) {
                if !dep.is_empty() && !dep.eq_ignore_ascii_case("none") {
                    info.departure = dep.to_string();
                }
            }

            if let Some(&arr) = tokens.get(4) {
                if !arr.is_empty() && !arr.eq_ignore_ascii_case("none") {
                    info.arrival = arr.to_string();
                }
            }

            if let Some(&alt) = tokens.get(5) {
                if !alt.is_empty() && !alt.eq_ignore_ascii_case("none") {
                    info.alternate = alt.to_string();
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_intellivibe_layout() {
        assert_eq!(std::mem::offset_of!(IntellivibeData, collision_counter), 8);
        assert_eq!(std::mem::offset_of!(IntellivibeData, is_firing_gun), 12);
        assert_eq!(std::mem::offset_of!(IntellivibeData, is_end_flight), 13);
        assert_eq!(std::mem::offset_of!(IntellivibeData, is_ejecting), 14);
        assert_eq!(std::mem::offset_of!(IntellivibeData, in_3d), 15);
        assert_eq!(std::mem::offset_of!(IntellivibeData, is_on_ground), 19);
    }

    #[test]
    fn test_voice_helpers_parsing() {
        let payload = "Cowboy1|PAAX,Texaco7,Chalice9,Osan,Osan,Pyeongtaek";
        let mut info = BmsStringInfo::default();
        BmsSharedMemoryClient::parse_voice_helpers_into(payload, &mut info);

        assert_eq!(info.callsign, "Cowboy1");
        assert_eq!(info.package_size, "3 Ship");
        assert_eq!(info.seat, "1");
        assert!(!info.ai_seat1); // Player in seat 1
        assert!(info.ai_seat2); // AI in seat 2
        assert!(info.ai_seat3); // AI in seat 3
        assert!(!info.ai_seat4); // 'X'
        assert_eq!(info.tanker, "Texaco7");
        assert_eq!(info.awacs, "Chalice9");
        assert_eq!(info.departure, "Osan");
        assert_eq!(info.arrival, "Osan");
        assert_eq!(info.alternate, "Pyeongtaek");
    }

    #[test]
    fn test_voice_helpers_none_tanker_awacs() {
        let payload = "Goblin2|PXXX,None,None,Gunsan,Gunsan,Osan";
        let mut info = BmsStringInfo::default();
        BmsSharedMemoryClient::parse_voice_helpers_into(payload, &mut info);

        assert_eq!(info.callsign, "Goblin2");
        assert_eq!(info.package_size, "Singleton");
        assert_eq!(info.seat, "1");
        assert!(!info.ai_seat1);
        assert!(!info.ai_seat2);
        assert_eq!(info.tanker, "");
        assert_eq!(info.awacs, "");
    }

    #[test]
    fn test_unpack_multi_string_stream() {
        // Construct a realistic FalconSharedMemoryAreaString payload with multiple entries
        // Header: VersionNum=5, NoOfStrings=4, dataSize
        let string_entries: Vec<(u32, &str)> = vec![
            (0, "C:\\Games\\Falcon BMS 4.38\\Bin\\x64\\Falcon BMS.exe"), // BmsExe
            (1, "BMS - Full.key"),                                       // KeyFile
            (29, "F-16C-52"),                                            // AcName
            (35, "Cowboy1|PAAX,Texaco7,Chalice9,Osan,Osan,Pyeongtaek"),  // VoiceHelpers
        ];

        let mut data_blob = Vec::new();
        for (str_id, s) in &string_entries {
            data_blob.extend_from_slice(&str_id.to_le_bytes());
            let str_len = s.len() as u32;
            data_blob.extend_from_slice(&str_len.to_le_bytes());
            data_blob.extend_from_slice(s.as_bytes());
            data_blob.push(0); // Null terminator byte
        }

        let mut stream = Vec::new();
        let version_num = 5u32;
        let num_strings = string_entries.len() as u32;
        let data_size = data_blob.len() as u32;
        stream.extend_from_slice(&version_num.to_le_bytes());
        stream.extend_from_slice(&num_strings.to_le_bytes());
        stream.extend_from_slice(&data_size.to_le_bytes());
        stream.extend_from_slice(&data_blob);

        let info = BmsSharedMemoryClient::unpack_string_data_bytes(&stream);
        assert_eq!(info.aircraft, "F-16C-52");
        assert_eq!(info.callsign, "Cowboy1");
        assert_eq!(info.tanker, "Texaco7");
        assert_eq!(info.awacs, "Chalice9");
        assert_eq!(info.departure, "Osan");
        assert_eq!(info.arrival, "Osan");
        assert_eq!(info.alternate, "Pyeongtaek");
        assert_eq!(info.package_size, "3 Ship");
        assert_eq!(info.seat, "1");
        assert!(!info.ai_seat1);
        assert!(info.ai_seat2);
        assert!(info.ai_seat3);
        assert!(!info.ai_seat4);
    }
}
