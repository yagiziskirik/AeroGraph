use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use windows::core::{w, PCWSTR};
use windows::Win32::Foundation::{BOOL, COLORREF, HWND, LPARAM, LRESULT, RECT, WPARAM};
use windows::Win32::Graphics::Gdi::{
    BeginPaint, BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, CreateFontW, CreateSolidBrush,
    DeleteDC, DeleteObject, DrawTextW, EndPaint, FillRect, FrameRect, InvalidateRect, SelectObject,
    SetBkMode, SetTextColor, DT_CENTER, DT_NOPREFIX, DT_SINGLELINE, FW_BOLD, FW_NORMAL,
    PAINTSTRUCT, SRCCOPY, TRANSPARENT,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, DrawIconEx, GetMessageW,
    GetSystemMetrics, KillTimer, LoadIconW, PostMessageW, PostQuitMessage, RegisterClassExW,
    SetTimer, ShowWindow, TranslateMessage, CS_DROPSHADOW, CS_HREDRAW, CS_VREDRAW, DI_NORMAL,
    IDI_APPLICATION, MSG, SM_CXSCREEN, SM_CYSCREEN, SW_HIDE, SW_SHOW, WM_CLOSE, WM_DESTROY,
    WM_ERASEBKGND, WM_PAINT, WM_TIMER, WNDCLASSEXW, WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_POPUP,
};

static CLASS_REGISTERED: AtomicBool = AtomicBool::new(false);
const CLASS_NAME: PCWSTR = w!("AeroGraphSplashWindow");

const SPLASH_WIDTH: i32 = 540;
const SPLASH_HEIGHT: i32 = 320;

pub struct SplashWindow {
    hwnd_raw: isize,
    closed: Arc<AtomicBool>,
    thread: Option<std::thread::JoinHandle<()>>,
}

static ANIM_FRAME: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);

#[allow(clippy::manual_dangling_ptr)]
unsafe extern "system" fn splash_wnd_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    match msg {
        WM_ERASEBKGND => LRESULT(1), // Suppress background erase to eliminate flicker
        WM_TIMER => {
            let frame = ANIM_FRAME.fetch_add(1, Ordering::Relaxed);
            // Safety watchdog: auto-terminate splash screen if left orphaned for > 5 seconds (160 frames)
            if frame >= 160 {
                let _ = PostMessageW(hwnd, WM_CLOSE, WPARAM(0), LPARAM(0));
            } else {
                let _ = InvalidateRect(hwnd, None, BOOL(0));
            }
            LRESULT(0)
        }
        WM_PAINT => {
            let mut ps = PAINTSTRUCT::default();
            let hdc = BeginPaint(hwnd, &mut ps);

            // Double buffering setup
            let mem_dc = CreateCompatibleDC(hdc);
            let mem_bm = CreateCompatibleBitmap(hdc, SPLASH_WIDTH, SPLASH_HEIGHT);
            let old_bm = SelectObject(mem_dc, mem_bm);

            let rect = RECT {
                left: 0,
                top: 0,
                right: SPLASH_WIDTH,
                bottom: SPLASH_HEIGHT,
            };

            // 1. Cockpit Deep Carbon Background (#0A0A0C -> 0x000C0A0A)
            let bg_brush = CreateSolidBrush(COLORREF(0x000C0A0A));
            FillRect(mem_dc, &rect, bg_brush);
            let _ = DeleteObject(bg_brush);

            // 2. Outer Chassis Border (#27272A -> 0x002A2727)
            let border_brush = CreateSolidBrush(COLORREF(0x002A2727));
            let _ = FrameRect(mem_dc, &rect, border_brush);
            let _ = DeleteObject(border_brush);

            // 3. Inner Cockpit Hairline Frame (#18181B -> 0x001B1818)
            let inner_rect = RECT {
                left: 6,
                top: 6,
                right: SPLASH_WIDTH - 6,
                bottom: SPLASH_HEIGHT - 6,
            };
            let inner_brush = CreateSolidBrush(COLORREF(0x001B1818));
            let _ = FrameRect(mem_dc, &inner_rect, inner_brush);
            let _ = DeleteObject(inner_brush);

            // 4. Tactical Amber Corner HUD Brackets (#F59E0B -> 0x000B9EF5)
            let amber_brush = CreateSolidBrush(COLORREF(0x000B9EF5));
            let bracket_len = 14;
            let bracket_thick = 2;

            // Top-Left Corner
            FillRect(
                mem_dc,
                &RECT {
                    left: 12,
                    top: 12,
                    right: 12 + bracket_len,
                    bottom: 12 + bracket_thick,
                },
                amber_brush,
            );
            FillRect(
                mem_dc,
                &RECT {
                    left: 12,
                    top: 12,
                    right: 12 + bracket_thick,
                    bottom: 12 + bracket_len,
                },
                amber_brush,
            );

            // Top-Right Corner
            FillRect(
                mem_dc,
                &RECT {
                    left: SPLASH_WIDTH - 12 - bracket_len,
                    top: 12,
                    right: SPLASH_WIDTH - 12,
                    bottom: 12 + bracket_thick,
                },
                amber_brush,
            );
            FillRect(
                mem_dc,
                &RECT {
                    left: SPLASH_WIDTH - 12 - bracket_thick,
                    top: 12,
                    right: SPLASH_WIDTH - 12,
                    bottom: 12 + bracket_len,
                },
                amber_brush,
            );

            // Bottom-Left Corner
            FillRect(
                mem_dc,
                &RECT {
                    left: 12,
                    top: SPLASH_HEIGHT - 12 - bracket_thick,
                    right: 12 + bracket_len,
                    bottom: SPLASH_HEIGHT - 12,
                },
                amber_brush,
            );
            FillRect(
                mem_dc,
                &RECT {
                    left: 12,
                    top: SPLASH_HEIGHT - 12 - bracket_len,
                    right: 12 + bracket_thick,
                    bottom: SPLASH_HEIGHT - 12,
                },
                amber_brush,
            );

            // Bottom-Right Corner
            FillRect(
                mem_dc,
                &RECT {
                    left: SPLASH_WIDTH - 12 - bracket_len,
                    top: SPLASH_HEIGHT - 12 - bracket_thick,
                    right: SPLASH_WIDTH - 12,
                    bottom: SPLASH_HEIGHT - 12,
                },
                amber_brush,
            );
            FillRect(
                mem_dc,
                &RECT {
                    left: SPLASH_WIDTH - 12 - bracket_thick,
                    top: SPLASH_HEIGHT - 12 - bracket_len,
                    right: SPLASH_WIDTH - 12,
                    bottom: SPLASH_HEIGHT - 12,
                },
                amber_brush,
            );

            let _ = DeleteObject(amber_brush);

            // 5. Authentic AeroGraph Application Logo Icon
            let hinstance =
                windows::Win32::System::LibraryLoader::GetModuleHandleW(None).unwrap_or_default();
            let hicon = LoadIconW(hinstance, PCWSTR(1 as *const u16))
                .unwrap_or_else(|_| LoadIconW(None, IDI_APPLICATION).unwrap_or_default());

            if !hicon.is_invalid() {
                let icon_size = 56;
                let icon_x = (SPLASH_WIDTH - icon_size) / 2;
                let icon_y = 28;
                let _ = DrawIconEx(
                    mem_dc, icon_x, icon_y, hicon, icon_size, icon_size, 0, None, DI_NORMAL,
                );
            }

            SetBkMode(mem_dc, TRANSPARENT);

            // 6. Application Branding Title "A E R O G R A P H"
            let hfont_title = CreateFontW(
                24,
                0,
                0,
                0,
                FW_BOLD.0 as i32,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                w!("Chakra Petch"),
            );
            let old_font = SelectObject(mem_dc, hfont_title);
            SetTextColor(mem_dc, COLORREF(0x00F4F4F5)); // Bright White (#F4F4F5)

            let mut r_title = RECT {
                left: 0,
                top: 96,
                right: SPLASH_WIDTH,
                bottom: 126,
            };
            let mut title_text: Vec<u16> = "A E R O G R A P H\0".encode_utf16().collect();
            DrawTextW(
                mem_dc,
                &mut title_text,
                &mut r_title,
                DT_CENTER | DT_SINGLELINE | DT_NOPREFIX,
            );

            // 7. Tactical Subheader Markings
            let hfont_sub = CreateFontW(
                11,
                0,
                0,
                0,
                FW_BOLD.0 as i32,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                w!("Consolas"),
            );
            SelectObject(mem_dc, hfont_sub);
            SetTextColor(mem_dc, COLORREF(0x000B9EF5)); // Amber (#F59E0B)

            let mut r_sub = RECT {
                left: 0,
                top: 132,
                right: SPLASH_WIDTH,
                bottom: 152,
            };
            let mut sub_text: Vec<u16> = "TACTICAL AVIONICS SUITE  //  FALCON BMS 4.38\0"
                .encode_utf16()
                .collect();
            DrawTextW(
                mem_dc,
                &mut sub_text,
                &mut r_sub,
                DT_CENTER | DT_SINGLELINE | DT_NOPREFIX,
            );

            // 8. Active Indeterminate Progress Bar
            let track_x = 70;
            let track_y = 176;
            let track_w = SPLASH_WIDTH - 140; // 400px
            let track_h = 5;

            // Track Background (#18181B)
            let track_rect = RECT {
                left: track_x,
                top: track_y,
                right: track_x + track_w,
                bottom: track_y + track_h,
            };
            let track_bg = CreateSolidBrush(COLORREF(0x001B1818));
            FillRect(mem_dc, &track_rect, track_bg);
            let _ = DeleteObject(track_bg);

            // Track Border (#27272A)
            let track_border = CreateSolidBrush(COLORREF(0x002A2727));
            let _ = FrameRect(mem_dc, &track_rect, track_border);
            let _ = DeleteObject(track_border);

            // Smooth Animated Scanning Pip
            let frame = ANIM_FRAME.load(Ordering::Relaxed);
            let cycle = frame % 60;
            let ratio = cycle as f32 / 60.0;
            let sweep = if ratio < 0.5 {
                ratio * 2.0
            } else {
                (1.0 - ratio) * 2.0
            };
            let pip_w = 80;
            let pip_x = track_x + (((track_w - pip_w) as f32) * sweep) as i32;

            let pip_rect = RECT {
                left: pip_x,
                top: track_y,
                right: pip_x + pip_w,
                bottom: track_y + track_h,
            };
            let emerald_brush = CreateSolidBrush(COLORREF(0x0081B910)); // Emerald (#10B981)
            FillRect(mem_dc, &pip_rect, emerald_brush);
            let _ = DeleteObject(emerald_brush);

            // 9. Cycling Dynamic Loading Status Text
            let hfont_status = CreateFontW(
                11,
                0,
                0,
                0,
                FW_BOLD.0 as i32,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                w!("Consolas"),
            );
            SelectObject(mem_dc, hfont_status);
            SetTextColor(mem_dc, COLORREF(0x0081B910)); // Emerald (#10B981)

            let status_messages = [
                "[●] INITIALIZING AVIONICS BUS...\0",
                "[●] BINDING DIRECTINPUT HARDWARE...\0",
                "[●] MOUNTING KNEEBOARD ENGINE...\0",
                "[●] SYNCHRONIZING WITH FALCON BMS...\0",
            ];
            let msg_idx = ((frame / 20) % 4) as usize;
            let mut status_text: Vec<u16> = status_messages[msg_idx].encode_utf16().collect();

            let mut r_status = RECT {
                left: 0,
                top: 196,
                right: SPLASH_WIDTH,
                bottom: 220,
            };
            DrawTextW(
                mem_dc,
                &mut status_text,
                &mut r_status,
                DT_CENTER | DT_SINGLELINE | DT_NOPREFIX,
            );

            // 10. Footer Cockpit Metadata
            let hfont_footer = CreateFontW(
                9,
                0,
                0,
                0,
                FW_NORMAL.0 as i32,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                w!("Consolas"),
            );
            SelectObject(mem_dc, hfont_footer);
            SetTextColor(mem_dc, COLORREF(0x0071717A)); // Zinc-500 (#71717A)

            let mut r_footer = RECT {
                left: 0,
                top: 280,
                right: SPLASH_WIDTH,
                bottom: 302,
            };
            let mut footer_text: Vec<u16> =
                "SYSTEM INTEGRITY: NOMINAL  •  INITIALIZING UI SUBSYSTEM\0"
                    .encode_utf16()
                    .collect();
            DrawTextW(
                mem_dc,
                &mut footer_text,
                &mut r_footer,
                DT_CENTER | DT_SINGLELINE | DT_NOPREFIX,
            );

            // Blit memory DC to the screen atomically
            let _ = BitBlt(
                hdc,
                0,
                0,
                SPLASH_WIDTH,
                SPLASH_HEIGHT,
                mem_dc,
                0,
                0,
                SRCCOPY,
            );

            // Cleanup
            SelectObject(mem_dc, old_font);
            let _ = DeleteObject(hfont_title);
            let _ = DeleteObject(hfont_sub);
            let _ = DeleteObject(hfont_status);
            let _ = DeleteObject(hfont_footer);

            SelectObject(mem_dc, old_bm);
            let _ = DeleteObject(mem_bm);
            let _ = DeleteDC(mem_dc);

            let _ = EndPaint(hwnd, &ps);
            LRESULT(0)
        }
        WM_CLOSE => {
            let _ = KillTimer(hwnd, 1);
            let _ = ShowWindow(hwnd, SW_HIDE);
            let _ = DestroyWindow(hwnd);
            LRESULT(0)
        }
        WM_DESTROY => {
            PostQuitMessage(0);
            LRESULT(0)
        }
        _ => DefWindowProcW(hwnd, msg, wparam, lparam),
    }
}

fn run_splash_thread(tx: std::sync::mpsc::Sender<isize>, closed: Arc<AtomicBool>) {
    #[cfg(target_os = "windows")]
    unsafe {
        ANIM_FRAME.store(0, Ordering::Relaxed);

        if !CLASS_REGISTERED.swap(true, Ordering::SeqCst) {
            let wc = WNDCLASSEXW {
                cbSize: std::mem::size_of::<WNDCLASSEXW>() as u32,
                style: CS_HREDRAW | CS_VREDRAW | CS_DROPSHADOW,
                lpfnWndProc: Some(splash_wnd_proc),
                cbClsExtra: 0,
                cbWndExtra: 0,
                hInstance: windows::Win32::System::LibraryLoader::GetModuleHandleW(None)
                    .unwrap_or_default()
                    .into(),
                hIcon: windows::Win32::UI::WindowsAndMessaging::HICON::default(),
                hCursor: windows::Win32::UI::WindowsAndMessaging::LoadCursorW(
                    None,
                    windows::Win32::UI::WindowsAndMessaging::IDC_ARROW,
                )
                .unwrap_or_default(),
                hbrBackground: windows::Win32::Graphics::Gdi::HBRUSH::default(),
                lpszMenuName: PCWSTR::null(),
                lpszClassName: CLASS_NAME,
                hIconSm: windows::Win32::UI::WindowsAndMessaging::HICON::default(),
            };
            let _ = RegisterClassExW(&wc);
        }

        let screen_w = GetSystemMetrics(SM_CXSCREEN);
        let screen_h = GetSystemMetrics(SM_CYSCREEN);
        let x = ((screen_w - SPLASH_WIDTH) / 2).max(0);
        let y = ((screen_h - SPLASH_HEIGHT) / 2).max(0);

        let hwnd_res = CreateWindowExW(
            WS_EX_TOPMOST | WS_EX_TOOLWINDOW,
            CLASS_NAME,
            w!("AeroGraph Loading"),
            WS_POPUP,
            x,
            y,
            SPLASH_WIDTH,
            SPLASH_HEIGHT,
            None,
            None,
            None,
            None,
        );

        let hwnd = match hwnd_res {
            Ok(h) if !h.0.is_null() => h,
            _ => return,
        };

        // Notify caller that window has been successfully created
        let _ = tx.send(hwnd.0 as isize);

        // If caller already cancelled before window finished creating, exit immediately
        if closed.load(Ordering::SeqCst) {
            let _ = DestroyWindow(hwnd);
            return;
        }

        // Start 30ms animation timer (~33 FPS)
        SetTimer(hwnd, 1, 30, None);
        let _ = ShowWindow(hwnd, SW_SHOW);

        // Standard Win32 message loop dedicated to this thread
        let mut msg = MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).as_bool() {
            let _ = TranslateMessage(&msg);
            let _ = DispatchMessageW(&msg);
        }
    }
}

impl SplashWindow {
    /// Instantly displays an animated, lightweight cockpit splash screen on a dedicated thread.
    pub fn show() -> Option<Self> {
        #[cfg(target_os = "windows")]
        {
            let (tx, rx) = std::sync::mpsc::channel::<isize>();
            let closed = Arc::new(AtomicBool::new(false));
            let c_thread = closed.clone();

            let handle = std::thread::Builder::new()
                .name("AeroGraphSplash".to_string())
                .spawn(move || {
                    run_splash_thread(tx, c_thread);
                })
                .ok()?;

            let hwnd_raw = rx
                .recv_timeout(std::time::Duration::from_millis(1000))
                .ok()?;
            Some(Self {
                hwnd_raw,
                closed,
                thread: Some(handle),
            })
        }

        #[cfg(not(target_os = "windows"))]
        {
            None
        }
    }

    /// Closes and destroys the native splash window immediately.
    pub fn close(&mut self) {
        #[cfg(target_os = "windows")]
        if !self.closed.swap(true, Ordering::SeqCst) {
            unsafe {
                let hwnd = HWND(self.hwnd_raw as *mut _);
                let _ = PostMessageW(hwnd, WM_CLOSE, WPARAM(0), LPARAM(0));
            }
            if let Some(handle) = self.thread.take() {
                let _ = handle.join();
            }
        }
    }
}

impl Drop for SplashWindow {
    fn drop(&mut self) {
        self.close();
    }
}
