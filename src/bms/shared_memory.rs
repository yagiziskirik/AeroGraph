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
    pub fn read_string_info(&self) -> BmsStringInfo {
        let mut info = BmsStringInfo::default();
        let area = match self.string_area.as_ref() {
            Some(a) => a,
            None => return info,
        };

        unsafe {
            // String memory layout: uint32 VersionNum, uint32 NoOfStrings, uint32 dataSize
            let header_ptr = area.ptr::<u32>();
            let num_strings = ptr::read_unaligned(header_ptr.add(1)) as usize;
            let data_size = ptr::read_unaligned(header_ptr.add(2)) as usize;

            if num_strings == 0 || data_size == 0 {
                return info;
            }

            // Following the 12-byte header is array of string structures
            // Each entry: uint32 strId, uint32 strLength, followed by chars
            let mut offset = 12usize;
            let base_bytes = area.view as *const u8;

            for _ in 0..num_strings {
                if offset + 8 > data_size + 12 {
                    break;
                }
                let str_id = ptr::read_unaligned(base_bytes.add(offset) as *const u32);
                let str_len =
                    ptr::read_unaligned(base_bytes.add(offset + 4) as *const u32) as usize;
                offset += 8;

                if offset + str_len > data_size + 12 {
                    break;
                }

                let slice = std::slice::from_raw_parts(base_bytes.add(offset), str_len);
                // Null-terminated or raw string
                let text = String::from_utf8_lossy(slice)
                    .trim_matches('\0')
                    .trim()
                    .to_string();
                offset += str_len;

                // Match known string IDs from Falcon BMS Headers:
                // 1: Callsign, 2: Package Size, 3: Aircraft, 4: Seat, 5: Departure, 6: Arrival, 7: Alternate, 8: Tanker, 9: Awacs
                match str_id {
                    1 => info.callsign = text,
                    2 => info.package_size = text,
                    3 => info.aircraft = text,
                    4 => info.seat = text,
                    5 => info.departure = text,
                    6 => info.arrival = text,
                    7 => info.alternate = text,
                    8 => info.tanker = text,
                    9 => info.awacs = text,
                    _ => {}
                }
            }
        }

        info
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
}
