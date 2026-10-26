#![allow(non_snake_case, dead_code)]

use std::collections::HashMap;
use std::ffi::c_void;
use std::mem;
use std::ptr;
use windows::core::{GUID, HRESULT};
use windows::Win32::Foundation::{BOOL, HINSTANCE, HWND, MAX_PATH};
use windows::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryW};

pub const DIRECTINPUT_VERSION: u32 = 0x0800;
pub const DIEDFL_ALLDEVICES: u32 = 0x00000000;
pub const DI8DEVCLASS_GAMECTRL: u32 = 4;
pub const DISCL_BACKGROUND: u32 = 0x00000008;
pub const DISCL_NONEXCLUSIVE: u32 = 0x00000002;
pub const DI_OK: HRESULT = HRESULT(0);

#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct DIDEVICEINSTANCEW {
    pub dwSize: u32,
    pub guidInstance: GUID,
    pub guidProduct: GUID,
    pub dwDevType: u32,
    pub tszInstanceName: [u16; MAX_PATH as usize],
    pub tszProductName: [u16; MAX_PATH as usize],
    pub guidFFDriver: GUID,
    pub wUsagePage: u16,
    pub wUsage: u16,
}

#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct DIJOYSTATE2 {
    pub lX: i32,
    pub lY: i32,
    pub lZ: i32,
    pub lRx: i32,
    pub lRy: i32,
    pub lRz: i32,
    pub rglSlider: [i32; 2],
    pub rgdwPOV: [u32; 4],
    pub rgbButtons: [u8; 128],
    pub lVX: i32,
    pub lVY: i32,
    pub lVZ: i32,
    pub lVRx: i32,
    pub lVRy: i32,
    pub lVRz: i32,
    pub rglVSlider: [i32; 2],
    pub lAX: i32,
    pub lAY: i32,
    pub lAZ: i32,
    pub lARx: i32,
    pub lARy: i32,
    pub lARz: i32,
    pub rglASlider: [i32; 2],
    pub lFX: i32,
    pub lFY: i32,
    pub lFZ: i32,
    pub lFRx: i32,
    pub lFRy: i32,
    pub lFRz: i32,
    pub rglFSlider: [i32; 2],
}

impl Default for DIJOYSTATE2 {
    fn default() -> Self {
        unsafe { mem::zeroed() }
    }
}

#[repr(C)]
pub struct DIOBJECTDATAFORMAT {
    pub pguid: *const GUID,
    pub dwOfs: u32,
    pub dwType: u32,
    pub dwFlags: u32,
}

#[repr(C)]
pub struct DIDATAFORMAT {
    pub dwSize: u32,
    pub dwObjSize: u32,
    pub dwFlags: u32,
    pub dwDataSize: u32,
    pub dwNumObjs: u32,
    pub rgodf: *mut DIOBJECTDATAFORMAT,
}

// DirectInput COM Interfaces vtables
#[repr(C)]
pub struct IDirectInput8WVtbl {
    pub QueryInterface: unsafe extern "system" fn(*mut c_void, *const GUID, *mut *mut c_void) -> HRESULT,
    pub AddRef: unsafe extern "system" fn(*mut c_void) -> u32,
    pub Release: unsafe extern "system" fn(*mut c_void) -> u32,
    pub CreateDevice: unsafe extern "system" fn(*mut c_void, *const GUID, *mut *mut c_void, *mut c_void) -> HRESULT,
    pub EnumDevices: unsafe extern "system" fn(*mut c_void, u32, LPDIENUMDEVICESCALLBACKW, *mut c_void, u32) -> HRESULT,
}

#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct DIDEVICEOBJECTINSTANCEW {
    pub dwSize: u32,
    pub guidType: GUID,
    pub dwOfs: u32,
    pub dwType: u32,
    pub dwFlags: u32,
    pub tszName: [u16; 260],
    pub dwFFMaxForce: u32,
    pub dwFFForceResolution: u32,
    pub wCollectionNumber: u16,
    pub wDesignatorIndex: u16,
    pub wUsagePage: u16,
    pub wUsage: u16,
    pub dwDimension: u32,
    pub wExponent: u16,
    pub wReportId: u16,
}

pub type LPDIENUMDEVICEOBJECTSCALLBACKW = unsafe extern "system" fn(*const DIDEVICEOBJECTINSTANCEW, *mut c_void) -> BOOL;

#[repr(C)]
pub struct IDirectInputDevice8WVtbl {
    pub QueryInterface: unsafe extern "system" fn(*mut c_void, *const GUID, *mut *mut c_void) -> HRESULT,
    pub AddRef: unsafe extern "system" fn(*mut c_void) -> u32,
    pub Release: unsafe extern "system" fn(*mut c_void) -> u32,
    pub GetCapabilities: *const c_void,
    pub EnumObjects: unsafe extern "system" fn(*mut c_void, LPDIENUMDEVICEOBJECTSCALLBACKW, *mut c_void, u32) -> HRESULT,
    pub GetProperty: *const c_void,
    pub SetProperty: *const c_void,
    pub Acquire: unsafe extern "system" fn(*mut c_void) -> HRESULT,
    pub Unacquire: unsafe extern "system" fn(*mut c_void) -> HRESULT,
    pub GetDeviceState: unsafe extern "system" fn(*mut c_void, u32, *mut c_void) -> HRESULT,
    pub GetDeviceData: *const c_void,
    pub SetDataFormat: unsafe extern "system" fn(*mut c_void, *const DIDATAFORMAT) -> HRESULT,
    pub SetEventNotification: *const c_void,
    pub SetCooperativeLevel: unsafe extern "system" fn(*mut c_void, HWND, u32) -> HRESULT,
    pub GetObjectInfo: *const c_void,
    pub GetDeviceInfo: *const c_void,
    pub RunControlPanel: *const c_void,
    pub Initialize: *const c_void,
    pub CreateEffect: *const c_void,
    pub EnumEffects: *const c_void,
    pub GetEffectInfo: *const c_void,
    pub GetForceFeedbackState: *const c_void,
    pub SendForceFeedbackCommand: *const c_void,
    pub EnumCreatedEffectObjects: *const c_void,
    pub Escape: *const c_void,
    pub Poll: unsafe extern "system" fn(*mut c_void) -> HRESULT,
    pub SendDeviceData: *const c_void,
    pub EnumEffectsInFile: *const c_void,
    pub WriteEffectToFile: *const c_void,
    pub BuildActionMap: *const c_void,
    pub SetActionMap: *const c_void,
    pub GetImageInfo: *const c_void,
}

pub type LPDIENUMDEVICESCALLBACKW = unsafe extern "system" fn(*const DIDEVICEINSTANCEW, *mut c_void) -> BOOL;
type DirectInput8CreateFn = unsafe extern "system" fn(HINSTANCE, u32, *const GUID, *mut *mut c_void, *mut c_void) -> HRESULT;

// DIDATAFORMAT definition for standard joystick (c_dfDIJoystick)
// DIDFT_AXIS = 0x00000003, DIDFT_BUTTON = 0x0000000C, DIDFT_POV = 0x00000010, DIDFT_ANYINSTANCE = 0x00FFFF00
const DIDFT_AXIS: u32 = 0x00000003 | 0x00FFFF00;
const DIDFT_BUTTON: u32 = 0x0000000C | 0x00FFFF00;
const DIDFT_POV: u32 = 0x00000010 | 0x00FFFF00;


// Standard GUIDs for axis data
// GUID_XAxis: A36D02E0-C9F3-11CF-BFC7-444553540000
const GUID_XAXIS: GUID = GUID::from_u128(0xA36D02E0_C9F3_11CF_BFC7_444553540000);
const GUID_YAXIS: GUID = GUID::from_u128(0xA36D02E1_C9F3_11CF_BFC7_444553540000);
const GUID_ZAXIS: GUID = GUID::from_u128(0xA36D02E2_C9F3_11CF_BFC7_444553540000);
const GUID_RXAXIS: GUID = GUID::from_u128(0xA36D02F4_C9F3_11CF_BFC7_444553540000);
const GUID_RYAXIS: GUID = GUID::from_u128(0xA36D02F5_C9F3_11CF_BFC7_444553540000);
const GUID_RZAXIS: GUID = GUID::from_u128(0xA36D02E3_C9F3_11CF_BFC7_444553540000);
const GUID_SLIDER: GUID = GUID::from_u128(0xA36D02E4_C9F3_11CF_BFC7_444553540000);
const GUID_POV: GUID = GUID::from_u128(0xA36D02E5_C9F3_11CF_BFC7_444553540000);

const DIDFT_OPTIONAL: u32 = 0x80000000;
const DIDOI_ASPECTPOSITION: u32 = 0x00000100;

pub struct DirectInputManager {
    dinput: *mut c_void,
    devices: HashMap<String, *mut c_void>, // GUID string -> IDirectInputDevice8W
    device_suspended_until: std::sync::Mutex<HashMap<String, std::time::Instant>>,
    device_disconnected_logged: std::sync::Mutex<std::collections::HashSet<String>>,
    _df_objects: Box<[DIOBJECTDATAFORMAT]>,
    data_format: Box<DIDATAFORMAT>,
}

unsafe impl Send for DirectInputManager {}

impl DirectInputManager {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let dll_name: Vec<u16> = "dinput8.dll\0".encode_utf16().collect();
        let hmodule = unsafe { LoadLibraryW(windows::core::PCWSTR(dll_name.as_ptr())) }?;
        let proc = unsafe { GetProcAddress(hmodule, windows::core::PCSTR(b"DirectInput8Create\0".as_ptr())) }
            .ok_or("Failed to find DirectInput8Create in dinput8.dll")?;

        // Build standard joystick format (DIJOYSTATE2: 164 objects)
        let mut df_objects = Vec::with_capacity(164);

        // Axes (8): X, Y, Z, Rx, Ry, Rz, Slider0, Slider1
        let axis_guids = [
            &GUID_XAXIS, &GUID_YAXIS, &GUID_ZAXIS,
            &GUID_RXAXIS, &GUID_RYAXIS, &GUID_RZAXIS,
            &GUID_SLIDER, &GUID_SLIDER,
        ];
        for (i, guid) in axis_guids.iter().enumerate() {
            df_objects.push(DIOBJECTDATAFORMAT {
                pguid: *guid as *const GUID,
                dwOfs: (i * 4) as u32,
                dwType: DIDFT_OPTIONAL | DIDFT_AXIS,
                dwFlags: DIDOI_ASPECTPOSITION,
            });
        }

        // POVs (4)
        for i in 0..4 {
            df_objects.push(DIOBJECTDATAFORMAT {
                pguid: &GUID_POV as *const GUID,
                dwOfs: 32 + (i * 4) as u32,
                dwType: DIDFT_OPTIONAL | DIDFT_POV,
                dwFlags: 0,
            });
        }

        // Buttons (128)
        for i in 0..128 {
            df_objects.push(DIOBJECTDATAFORMAT {
                pguid: ptr::null(),
                dwOfs: 48 + i as u32,
                dwType: DIDFT_OPTIONAL | DIDFT_BUTTON,
                dwFlags: 0,
            });
        }

        let mut boxed_objects = df_objects.into_boxed_slice();
        let data_format = Box::new(DIDATAFORMAT {
            dwSize: mem::size_of::<DIDATAFORMAT>() as u32,
            dwObjSize: mem::size_of::<DIOBJECTDATAFORMAT>() as u32,
            dwFlags: 0x00000001, // DIDFT_ABSAXIS
            dwDataSize: mem::size_of::<DIJOYSTATE2>() as u32,
            dwNumObjs: boxed_objects.len() as u32,
            rgodf: boxed_objects.as_mut_ptr(),
        });

        let mut mgr = Self {
            dinput: ptr::null_mut(),
            devices: HashMap::new(),
            device_suspended_until: std::sync::Mutex::new(HashMap::new()),
            device_disconnected_logged: std::sync::Mutex::new(std::collections::HashSet::new()),
            _df_objects: boxed_objects,
            data_format,
        };

        let create_fn: DirectInput8CreateFn = unsafe { mem::transmute(proc) };
        let mut dinput_ptr: *mut c_void = ptr::null_mut();

        let hinstance = unsafe { windows::Win32::System::LibraryLoader::GetModuleHandleW(None) }
            .map(|h| HINSTANCE(h.0))
            .unwrap_or(HINSTANCE(ptr::null_mut()));

        // IID_IDirectInput8W: {BF798031-483A-4DA2-AA99-5D64ED369700}
        let iid_idirectinput8w = GUID::from_u128(0xBF798031_483A_4DA2_AA99_5D64ED369700);
        let hr = unsafe {
            create_fn(
                hinstance,
                DIRECTINPUT_VERSION,
                &iid_idirectinput8w,
                &mut dinput_ptr,
                ptr::null_mut(),
            )
        };

        if hr != DI_OK || dinput_ptr.is_null() {
            return Err(format!("DirectInput8Create failed: {:?}", hr).into());
        }

        mgr.dinput = dinput_ptr;
        Ok(mgr)
    }

    /// Connects and initializes a joystick/TQS/pedals device by GUID string.
    pub fn open_device(&mut self, guid_str: &str) -> Result<(), Box<dyn std::error::Error>> {
        let clean_guid = guid_str.trim_matches('{').trim_matches('}');
        let parsed_guid = GUID::try_from(clean_guid)
            .map_err(|e| format!("Invalid device GUID {}: {:?}", guid_str, e))?;

        if self.devices.contains_key(clean_guid) {
            return Ok(());
        }

        let vtbl = unsafe { *(self.dinput as *mut *mut IDirectInput8WVtbl) };
        let mut dev_ptr: *mut c_void = ptr::null_mut();

        let hr = unsafe { ((*vtbl).CreateDevice)(self.dinput, &parsed_guid, &mut dev_ptr, ptr::null_mut()) };
        if hr != DI_OK || dev_ptr.is_null() {
            return Err(format!("CreateDevice failed for {}: {:?}", guid_str, hr).into());
        }

        // Set data format & cooperative level to background non-exclusive so we don't interfere with BMS
        let dev_vtbl = unsafe { *(dev_ptr as *mut *mut IDirectInputDevice8WVtbl) };
        unsafe {
            let hr_df = ((*dev_vtbl).SetDataFormat)(dev_ptr, &*self.data_format);
            let hwnd = windows::Win32::UI::WindowsAndMessaging::GetDesktopWindow();
            let hr_cl = ((*dev_vtbl).SetCooperativeLevel)(dev_ptr, hwnd, DISCL_BACKGROUND | DISCL_NONEXCLUSIVE);
            let hr_acq = ((*dev_vtbl).Acquire)(dev_ptr);
            println!("open_device {}: hr_df={:#x}, hr_cl={:#x}, hr_acq={:#x}", clean_guid, hr_df.0, hr_cl.0, hr_acq.0);
        }

        self.devices.insert(clean_guid.to_uppercase(), dev_ptr);
        Ok(())
    }

    /// Aliases an alternative GUID (e.g. Product GUID <-> Instance GUID) to an existing device pointer.
    pub fn alias_device(&mut self, from_guid: &str, to_guid: &str) {
        let clean_from = from_guid.trim_matches('{').trim_matches('}').to_uppercase();
        let clean_to = to_guid.trim_matches('{').trim_matches('}').to_uppercase();
        if let Some(&ptr) = self.devices.get(&clean_from) {
            self.devices.entry(clean_to).or_insert(ptr);
        }
    }

    /// Checks if a device has already been opened by either its instance or product GUID.
    pub fn is_device_open(&self, guid_str: &str) -> bool {
        let clean = guid_str.trim_matches('{').trim_matches('}').to_uppercase();
        self.devices.contains_key(&clean)
    }

    /// Dynamically enumerates all attached physical and virtual game controllers.
    /// Returns a list of (instance_guid, product_guid, product_name).
    /// Called once at startup, with minimal memory and no runtime polling impact.
    pub fn enumerate_game_controllers(&self) -> Vec<(String, String, String)> {
        let mut list: Vec<(String, String, String)> = Vec::new();
        if self.dinput.is_null() {
            return list;
        }

        unsafe extern "system" fn enum_cb(instance: *const DIDEVICEINSTANCEW, context: *mut c_void) -> BOOL {
            if instance.is_null() || context.is_null() {
                return BOOL(1);
            }
            let inst = &*instance;
            let list = &mut *(context as *mut Vec<(String, String, String)>);

            let fmt_guid = |g: &GUID| {
                format!(
                    "{:08X}-{:04X}-{:04X}-{:02X}{:02X}-{:02X}{:02X}{:02X}{:02X}{:02X}{:02X}",
                    g.data1, g.data2, g.data3,
                    g.data4[0], g.data4[1],
                    g.data4[2], g.data4[3], g.data4[4], g.data4[5], g.data4[6], g.data4[7]
                )
            };

            let inst_guid = fmt_guid(&inst.guidInstance);
            let prod_guid = fmt_guid(&inst.guidProduct);
            let name = String::from_utf16_lossy(&inst.tszProductName)
                .trim_matches('\0')
                .trim()
                .to_string();

            list.push((inst_guid, prod_guid, name));
            BOOL(1)
        }

        const DIEDFL_ATTACHEDONLY: u32 = 0x00000001;
        let vtbl = unsafe { *(self.dinput as *mut *mut IDirectInput8WVtbl) };
        unsafe {
            let _ = ((*vtbl).EnumDevices)(
                self.dinput,
                DI8DEVCLASS_GAMECTRL,
                enum_cb,
                &mut list as *mut _ as *mut c_void,
                DIEDFL_ATTACHEDONLY,
            );
        }

        list
    }

    /// Samples a device and returns its current state. Throttled by the caller to protect AS5600 encoders.
    /// Automatically detects disconnections and suspends polling with a 3-second backoff to avoid CPU waste and console spam.
    pub fn poll_device(&self, guid_str: &str) -> Option<DIJOYSTATE2> {
        let clean = guid_str.trim_matches('{').trim_matches('}').to_uppercase();
        let dev_ptr = *self.devices.get(&clean)?;

        // If polling for this device was suspended due to disconnect, skip until backoff window expires
        let now = std::time::Instant::now();
        if let Ok(suspended) = self.device_suspended_until.lock() {
            if let Some(&until) = suspended.get(&clean) {
                if now < until {
                    return None;
                }
            }
        }

        let dev_vtbl = unsafe { *(dev_ptr as *mut *mut IDirectInputDevice8WVtbl) };

        unsafe {
            let _ = ((*dev_vtbl).Poll)(dev_ptr);
            let mut state: DIJOYSTATE2 = mem::zeroed();
            let hr = ((*dev_vtbl).GetDeviceState)(
                dev_ptr,
                mem::size_of::<DIJOYSTATE2>() as u32,
                &mut state as *mut _ as *mut c_void,
            );

            if hr == DI_OK {
                // Device is active & healthy: clear any suspension or disconnect warning flags
                if let Ok(mut suspended) = self.device_suspended_until.lock() {
                    suspended.remove(&clean);
                }
                if let Ok(mut logged) = self.device_disconnected_logged.lock() {
                    if logged.remove(&clean) {
                        log::info!("🎮 Controller [{}] reconnected and operational", clean);
                    }
                }
                Some(state)
            } else {
                // Try to re-acquire once
                let hr_acq = ((*dev_vtbl).Acquire)(dev_ptr);
                if hr_acq == DI_OK {
                    let hr_retry = ((*dev_vtbl).GetDeviceState)(
                        dev_ptr,
                        mem::size_of::<DIJOYSTATE2>() as u32,
                        &mut state as *mut _ as *mut c_void,
                    );
                    if hr_retry == DI_OK {
                        return Some(state);
                    }
                }

                // Controller is disconnected or unplugged: suspend polling for 3s to eliminate CPU waste and log spam
                if let Ok(mut suspended) = self.device_suspended_until.lock() {
                    suspended.insert(clean.clone(), now + std::time::Duration::from_secs(3));
                }

                if let Ok(mut logged) = self.device_disconnected_logged.lock() {
                    if logged.insert(clean.clone()) {
                        log::warn!("🎮 Controller [{}] disconnected / unplugged (polling suspended, retrying every 3s)", clean);
                    }
                }

                None
            }
        }
    }

    pub fn enum_device_objects(&self, guid_str: &str) {
        let clean = guid_str.trim_matches('{').trim_matches('}').to_uppercase();
        if let Some(&dev_ptr) = self.devices.get(&clean) {
            unsafe {
                let dev_vtbl = *(dev_ptr as *mut *mut IDirectInputDevice8WVtbl);
                unsafe extern "system" fn cb(obj: *const DIDEVICEOBJECTINSTANCEW, _: *mut c_void) -> BOOL {
                    let o = &*obj;
                    let name = String::from_utf16_lossy(&o.tszName).trim_matches('\0').to_string();
                    let is_axis = (o.dwType & 0x03) != 0;
                    if is_axis {
                        println!("    Axis Object: name='{}', type={:#x}, ofs={}, usagePage={:#x}, usage={:#x}, guid={:?}",
                            name, o.dwType, o.dwOfs, o.wUsagePage, o.wUsage, o.guidType);
                    }
                    BOOL(1)
                }
                let _ = ((*dev_vtbl).EnumObjects)(dev_ptr, cb, ptr::null_mut(), 0);
            }
        }
    }
}


impl Drop for DirectInputManager {
    fn drop(&mut self) {
        let mut unique_ptrs: Vec<*mut c_void> = self.devices.values().copied().collect();
        unique_ptrs.sort();
        unique_ptrs.dedup();

        for dev_ptr in unique_ptrs {
            if !dev_ptr.is_null() {
                unsafe {
                    let dev_vtbl = *(dev_ptr as *mut *mut IDirectInputDevice8WVtbl);
                    let _ = ((*dev_vtbl).Unacquire)(dev_ptr);
                    let _ = ((*dev_vtbl).Release)(dev_ptr);
                }
            }
        }
        self.devices.clear();

        if !self.dinput.is_null() {
            unsafe {
                let vtbl = *(self.dinput as *mut *mut IDirectInput8WVtbl);
                let _ = ((*vtbl).Release)(self.dinput);
            }
            self.dinput = ptr::null_mut();
        }
    }
}
