use std::thread;
use std::time::Duration;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, KEYEVENTF_SCANCODE,
};
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowTextW};

pub struct KeyboardDispatcher;

impl KeyboardDispatcher {
    /// Checks whether the currently focused window belongs to Falcon BMS.
    pub fn is_falcon_bms_focused() -> bool {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.0.is_null() {
                return false;
            }
            let mut title_buf = [0u16; 512];
            let len = GetWindowTextW(hwnd, &mut title_buf);
            if len > 0 {
                let title = String::from_utf16_lossy(&title_buf[..len as usize]);
                let lower = title.to_lowercase();

                // Never inject into developer tools, editors, or shells
                if lower.contains("powershell")
                    || lower.contains("cmd.exe")
                    || lower.contains("terminal")
                    || lower.contains("code")
                    || lower.contains("visual studio")
                {
                    return false;
                }

                return lower.starts_with("falcon bms")
                    || lower.contains("falcon bms")
                    || lower.starts_with("bms");
            }
            false
        }
    }

    /// Dispatches a key down or key up event by WPF Key code.
    /// Kind 0 = KeyDown, Kind 1 = KeyUp, Kind 2 = Sleep/Delay.
    pub fn dispatch_key_action(kind: i32, wpf_key: i32, is_extended: bool) {
        if kind == 2 {
            // Sleep duration in milliseconds
            if wpf_key > 0 {
                thread::sleep(Duration::from_millis(wpf_key as u64));
            }
            return;
        }

        // Only inject if Falcon BMS is the active foreground window
        if !Self::is_falcon_bms_focused() {
            log::warn!("Keystroke injection skipped: Falcon BMS window is not focused");
            return;
        }

        if let Some(scan_code) = Self::wpf_key_to_scan_code(wpf_key) {
            unsafe {
                let mut flags = KEYEVENTF_SCANCODE;
                if is_extended {
                    flags.0 |= 0x0001; // KEYEVENTF_EXTENDEDKEY
                }
                if kind == 1 {
                    flags |= KEYEVENTF_KEYUP;
                }

                let input = INPUT {
                    r#type: INPUT_KEYBOARD,
                    Anonymous: INPUT_0 {
                        ki: KEYBDINPUT {
                            wVk: Default::default(),
                            wScan: scan_code,
                            dwFlags: flags,
                            time: 0,
                            dwExtraInfo: 0,
                        },
                    },
                };

                SendInput(&[input], std::mem::size_of::<INPUT>() as i32);

                // Simulation keyboard pacing:
                // DirectInput in Falcon BMS polls the keyboard asynchronously at the simulation frame rate (~60-90 FPS in VR).
                // A crisp hold time of 16ms on KeyDown and a 20ms gap after KeyUp guarantees BMS DirectX catches every scan code
                // without lagging or lingering visibly on the VR HUD.
                if kind == 0 {
                    thread::sleep(Duration::from_millis(16));
                } else if kind == 1 {
                    thread::sleep(Duration::from_millis(20));
                }
            }
        }
    }

    /// Maps WPF System.Windows.Input.Key integer codes directly to Hardware Scan Codes for Falcon BMS.
    pub fn wpf_key_to_scan_code(wpf_key: i32) -> Option<u16> {
        match wpf_key {
            // Numbers 0..9 (WPF Key 34..43)
            34 => Some(0x0B), // '0'
            35 => Some(0x02), // '1'
            36 => Some(0x03), // '2'
            37 => Some(0x04), // '3'
            38 => Some(0x05), // '4'
            39 => Some(0x06), // '5'
            40 => Some(0x07), // '6'
            41 => Some(0x08), // '7'
            42 => Some(0x09), // '8'
            43 => Some(0x0A), // '9'

            // Letters A..Z (WPF Key 44..69)
            44 => Some(0x1E), // A
            45 => Some(0x30), // B
            46 => Some(0x2E), // C
            47 => Some(0x20), // D
            48 => Some(0x12), // E
            49 => Some(0x21), // F
            50 => Some(0x22), // G
            51 => Some(0x23), // H
            52 => Some(0x17), // I
            53 => Some(0x24), // J
            54 => Some(0x25), // K
            55 => Some(0x26), // L
            56 => Some(0x32), // M
            57 => Some(0x31), // N
            58 => Some(0x18), // O
            59 => Some(0x19), // P
            60 => Some(0x10), // Q
            61 => Some(0x13), // R
            62 => Some(0x1F), // S
            63 => Some(0x14), // T (Falcon BMS Tower / ATC Menu!)
            64 => Some(0x16), // U
            65 => Some(0x2F), // V
            66 => Some(0x11), // W
            67 => Some(0x2D), // X
            68 => Some(0x15), // Y
            69 => Some(0x2C), // Z

            // Modifiers
            116 => Some(0x2A), // LeftShift
            117 => Some(0x36), // RightShift
            118 => Some(0x1D), // LeftCtrl
            119 => Some(0x1D), // RightCtrl
            120 => Some(0x38), // LeftAlt
            121 => Some(0x38), // RightAlt

            // Control keys
            6 => Some(0x1C),  // Return / Enter
            13 => Some(0x01), // Escape
            18 => Some(0x39), // Space
            2 => Some(0x0E),  // Backspace
            3 => Some(0x0F),  // Tab

            // Function keys F1..F12 (WPF Key 90..101)
            90 => Some(0x3B),  // F1
            91 => Some(0x3C),  // F2
            92 => Some(0x3D),  // F3
            93 => Some(0x3E),  // F4
            94 => Some(0x3F),  // F5
            95 => Some(0x40),  // F6
            96 => Some(0x41),  // F7
            97 => Some(0x42),  // F8
            98 => Some(0x43),  // F9
            99 => Some(0x44),  // F10
            100 => Some(0x57), // F11
            101 => Some(0x58), // F12

            _ => None,
        }
    }
}
