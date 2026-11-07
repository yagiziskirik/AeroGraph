#![windows_subsystem = "windows"]

pub mod bms;
pub mod config;
pub mod engine;
pub mod fvx;
pub mod gui;
pub mod input;
pub mod kneeboard;
pub mod speech;
pub mod tray;
pub mod updater;

#[derive(Debug, Clone)]
pub enum AppEvent {
    ListeningChanged(bool),
    IpcMessage(crate::gui::ipc::IpcRequest),
    ToggleConsole,
    CloseConsole,
    SpeechRecognized { text: String, confidence: f32 },
    KneeboardRegenFinished,
    ImportPresetFile(PathBuf),
}

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tao::event::Event;
use tao::event_loop::{ControlFlow, EventLoopBuilder};
use tray_icon::menu::MenuEvent;
use tray_icon::TrayIconEvent;

use crate::bms::config_parser::BmsConfig;
use crate::bms::shared_memory::BmsSharedMemoryClient;
use crate::config::AppConfig;
use crate::engine::state::StateEngine;
use crate::fvx::loader::LoadedProfile;
use crate::gui::TacticalConsoleManager;
use crate::input::axis_sampler::AxisSampler;
use crate::kneeboard::watcher::KneeboardWatcher;
use crate::speech::sapi::SapiEngine;
use crate::tray::app_tray::AppTray;

use windows::Win32::Foundation::BOOL;
use windows::Win32::System::Console::{
    AllocConsole, GetConsoleMode, GetConsoleWindow, GetStdHandle, SetConsoleCtrlHandler,
    SetConsoleMode, CONSOLE_MODE, CTRL_CLOSE_EVENT, ENABLE_EXTENDED_FLAGS, ENABLE_QUICK_EDIT_MODE,
    STD_INPUT_HANDLE,
};
use windows::Win32::UI::WindowsAndMessaging::{ShowWindow, SW_HIDE, SW_SHOW};

struct DualLogger {
    file: Mutex<Option<std::fs::File>>,
}

impl log::Log for DualLogger {
    fn enabled(&self, metadata: &log::Metadata) -> bool {
        if metadata.target().starts_with("tao::") {
            return metadata.level() <= log::Level::Error;
        }
        metadata.level() <= log::Level::Info
    }

    fn log(&self, record: &log::Record) {
        if self.enabled(record.metadata()) {
            let (h, m, s, ms) = unsafe {
                use windows::Win32::System::SystemInformation::GetLocalTime;
                let st = GetLocalTime();
                (st.wHour, st.wMinute, st.wSecond, st.wMilliseconds)
            };
            let msg = format!(
                "[{:02}:{:02}:{:02}.{:03}] [{}] {}: {}\n",
                h,
                m,
                s,
                ms,
                record.level(),
                record.target(),
                record.args()
            );
            print!("{}", msg);
            if let Ok(mut lock) = self.file.lock() {
                if let Some(ref mut f) = *lock {
                    use std::io::Write;
                    let _ = f.write_all(msg.as_bytes());
                    let _ = f.flush();
                }
            }
        }
    }

    fn flush(&self) {
        if let Ok(mut lock) = self.file.lock() {
            if let Some(ref mut f) = *lock {
                use std::io::Write;
                let _ = f.flush();
            }
        }
    }
}

static CONSOLE_IS_VISIBLE: AtomicBool = AtomicBool::new(false);

unsafe extern "system" fn console_ctrl_handler(ctrl_type: u32) -> BOOL {
    if ctrl_type == CTRL_CLOSE_EVENT {
        set_console_visible(false);
        return BOOL(1);
    }
    BOOL(0)
}

fn set_console_visible(visible: bool) {
    unsafe {
        let hwnd = GetConsoleWindow();
        if visible {
            if hwnd.0.is_null() {
                let _ = AllocConsole();
                let _ = SetConsoleCtrlHandler(Some(console_ctrl_handler), true);

                let h_in = GetStdHandle(STD_INPUT_HANDLE);
                if let Ok(handle) = h_in {
                    let mut mode = CONSOLE_MODE(0);
                    if GetConsoleMode(handle, &mut mode).is_ok() {
                        let _ = SetConsoleMode(
                            handle,
                            CONSOLE_MODE(
                                (mode.0 & !ENABLE_QUICK_EDIT_MODE.0) | ENABLE_EXTENDED_FLAGS.0,
                            ),
                        );
                    }
                }

                let cons_hwnd = GetConsoleWindow();
                if !cons_hwnd.0.is_null() {
                    let h_menu =
                        windows::Win32::UI::WindowsAndMessaging::GetSystemMenu(cons_hwnd, false);
                    if !h_menu.0.is_null() {
                        let _ = windows::Win32::UI::WindowsAndMessaging::DeleteMenu(
                            h_menu,
                            windows::Win32::UI::WindowsAndMessaging::SC_CLOSE,
                            windows::Win32::UI::WindowsAndMessaging::MF_BYCOMMAND,
                        );
                    }
                }
            } else {
                let _ = ShowWindow(hwnd, SW_SHOW);
            }
            CONSOLE_IS_VISIBLE.store(true, Ordering::SeqCst);
        } else {
            if !hwnd.0.is_null() {
                let _ = ShowWindow(hwnd, SW_HIDE);
            }
            CONSOLE_IS_VISIBLE.store(false, Ordering::SeqCst);
        }
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let log_path = AppConfig::log_file_path();
    let log_file = std::fs::File::create(&log_path).ok();
    let dual_logger = Box::leak(Box::new(DualLogger {
        file: Mutex::new(log_file),
    }));
    let _ = log::set_logger(dual_logger);
    log::set_max_level(log::LevelFilter::Info);

    std::panic::set_hook(Box::new(|info| {
        log::error!("CRITICAL PANIC: {:?}", info);
    }));
    log::info!("=== AeroGraph: Falcon BMS Voice & Kneeboards ===");
    log::info!("Session log started at: {:?}", log_path);

    // Canonicalize any CLI arguments (such as an .aeropreset file path) before changing CWD
    let args: Vec<String> = std::env::args()
        .map(|a| {
            let p = std::path::Path::new(&a);
            if p.exists() {
                std::fs::canonicalize(p)
                    .map(|c| {
                        let s = c.to_string_lossy().to_string();
                        s.strip_prefix(r"\\?\").unwrap_or(&s).to_string()
                    })
                    .unwrap_or(a)
            } else {
                a
            }
        })
        .collect();

    // Anchor working directory to application root directory
    let app_root = AppConfig::app_root_dir();
    let _ = std::env::set_current_dir(&app_root);

    // Check CLI flags for manual regeneration
    if args.iter().any(|a| a == "--regen" || a == "-r") {
        log::info!("Running manual kneeboard regeneration from CLI flag...");
        let cfg = AppConfig::load();
        if let Some(bms_dir) = cfg.get_bms_base_dir() {
            KneeboardWatcher::execute_pipeline(&cfg, &bms_dir, None);
            log::info!("Manual regeneration complete.");
        } else {
            log::error!("BMS base directory not found.");
        }
        return Ok(());
    }

    // Guard against multiple concurrent instances
    let _single_instance_mutex = unsafe {
        use windows::Win32::Foundation::{CloseHandle, GetLastError, ERROR_ALREADY_EXISTS};
        use windows::Win32::System::Threading::{
            CreateMutexW, OpenEventW, SetEvent, EVENT_MODIFY_STATE,
        };
        use windows::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONWARNING, MB_OK};

        let mutex_name = windows::core::w!("AeroGraph_Single_Instance_Mutex");
        let handle = CreateMutexW(None, true, mutex_name).ok();
        if GetLastError() == ERROR_ALREADY_EXISTS {
            log::warn!("Another instance of AeroGraph is already running.");

            // Check if an .aeropreset file was passed as argument to be imported
            if let Some(preset_arg) = args.iter().skip(1).find(|a| a.ends_with(".aeropreset")) {
                let p = std::path::Path::new(preset_arg);
                if p.exists() {
                    let pending_file = AppConfig::config_dir().join("pending_import.txt");
                    let _ = std::fs::write(&pending_file, p.to_string_lossy().as_bytes());
                    log::info!("Wrote pending import request for: {:?}", p);
                }
            }

            // Signal running instance via named event
            let event_name = windows::core::w!("AeroGraph_Single_Instance_Event");
            if let Ok(event) = OpenEventW(EVENT_MODIFY_STATE, false, event_name) {
                let _ = SetEvent(event);
                let _ = CloseHandle(event);
                log::info!("Signaled running AeroGraph instance. Exiting secondary process.");
                return Ok(());
            }

            MessageBoxW(
                None,
                windows::core::w!("Another instance of AeroGraph is already running.\nPlease close the existing instance before launching a new one."),
                windows::core::w!("AeroGraph - Already Running"),
                MB_OK | MB_ICONWARNING,
            );
            return Ok(());
        }
        handle
    };

    // Set process priority above normal to prevent Windows Efficiency Mode throttling
    unsafe {
        use windows::Win32::System::Threading::{
            GetCurrentProcess, SetPriorityClass, ABOVE_NORMAL_PRIORITY_CLASS,
        };
        let _ = SetPriorityClass(GetCurrentProcess(), ABOVE_NORMAL_PRIORITY_CLASS);
    }

    let mut config = AppConfig::load();
    log::info!(
        "Configuration loaded (Polling rate: {} Hz | Voice Recognition: {} | Auto-Kneeboards: {})",
        config.polling_rate_hz,
        config.voice_recognition,
        config.auto_kneeboards
    );

    // Register .aeropreset Windows file association and icon in HKCU
    if let Err(e) = AppConfig::register_aeropreset_association() {
        log::warn!("Failed to register .aeropreset file association: {:?}", e);
    }

    // Process CLI arguments for direct .aeropreset execution / double click
    for arg in args.iter().skip(1) {
        if arg.ends_with(".aeropreset") {
            let p = std::path::Path::new(arg);
            if p.exists() {
                match crate::gui::preset::AeroPresetPackage::import_from_file(p) {
                    Ok(pkg) => {
                        let _ = pkg.apply_to_workspace();
                        log::info!("Imported and applied .aeropreset from CLI: {:?}", p);
                        let now_ms = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis();
                        let custom = crate::gui::preset::CustomPreset {
                            id: format!("custom_{}", now_ms),
                            name: pkg.manifest.name,
                            description: pkg.manifest.description,
                            theater: pkg.manifest.theater,
                            color: pkg.manifest.color.clone(),
                            slots: pkg.layout.slots,
                            created_at: pkg.manifest.created_at,
                        };
                        let mut presets = AppConfig::load_custom_presets();
                        presets.retain(|x| x.id != custom.id && x.name != custom.name);
                        presets.push(custom);
                        let _ = AppConfig::save_custom_presets(&presets);

                        if !pkg.manifest.color.is_empty() {
                            config.gui_accent_color = pkg.manifest.color.clone();
                            let _ = config.save();
                        }
                        // Open console window automatically so user immediately sees their imported binder
                        config.gui_open_on_startup = true;
                    }
                    Err(e) => {
                        log::error!("Failed to parse .aeropreset file {:?}: {:?}", p, e);
                    }
                }
            }
        }
    }
    if config.get_bms_base_dir().is_none() {
        log::error!("Falcon BMS 4.38 installation could not be detected in the Windows Registry.");
        #[cfg(target_os = "windows")]
        unsafe {
            use windows::core::HSTRING;
            use windows::Win32::UI::WindowsAndMessaging::{
                MessageBoxW, MB_ICONERROR, MB_OK, MB_SYSTEMMODAL,
            };
            let text = HSTRING::from(
                "Falcon BMS 4.38 was not detected in your Windows Registry (HKLM\\SOFTWARE\\WOW6432Node\\Benchmark Sims\\Falcon BMS 4.38).\n\nPlease verify that Falcon BMS 4.38 is installed and has been launched at least once.",
            );
            let title = HSTRING::from("AeroGraph - Falcon BMS Detection Error");
            let _ = MessageBoxW(None, &text, &title, MB_ICONERROR | MB_OK | MB_SYSTEMMODAL);
        }
        std::process::exit(1);
    }

    if config.show_console {
        set_console_visible(true);
    }

    // 1. Locate or resolve FoxVox profile (.fvx)
    let mut profile_path = config.resolve_profile();
    if profile_path.is_none() && config.voice_recognition {
        log::info!("No profile configured. Prompting user to select a profile (.fvx)...");
        profile_path = AppTray::prompt_select_profile();
        if let Some(ref p) = profile_path {
            config.profile_path = Some(p.to_string_lossy().to_string());
            let _ = config.save();
        }
    }

    let loaded_profile = match profile_path {
        Some(ref p) => {
            log::info!("Loading profile: {:?}", p);
            match LoadedProfile::load_from_file(p) {
                Ok(lp) => {
                    config.profile_path = Some(p.to_string_lossy().to_string());
                    let _ = config.save();
                    Some(lp)
                }
                Err(e) => {
                    log::error!("Failed to load profile: {:?}", e);
                    None
                }
            }
        }
        None => None,
    };

    let profile_name = loaded_profile
        .as_ref()
        .map(|p| p.profile.Name.clone())
        .unwrap_or_else(|| "None".to_string());
    let autostart_enabled = AppConfig::is_auto_start_enabled();

    // 2. Initialize Tao event loop & System Tray
    let event_loop = EventLoopBuilder::<AppEvent>::with_user_event().build();
    let proxy = event_loop.create_proxy();
    let tray = AppTray::new(
        &profile_name,
        config.pilot_female,
        config.voice_recognition,
        config.listening_enabled,
        config.auto_kneeboards,
        autostart_enabled,
        config.show_console,
    )?;
    log::info!("AeroGraph system tray icon initialized");

    let running = Arc::new(AtomicBool::new(true));
    let r_single_instance = running.clone();
    let r_voice = running.clone();
    let r_watcher = running.clone();

    // Single-instance background event listener: receives CLI triggers from secondary instances
    let proxy_single_instance = proxy.clone();
    thread::spawn(move || {
        use windows::Win32::Foundation::{CloseHandle, WAIT_OBJECT_0};
        use windows::Win32::System::Threading::{CreateEventW, WaitForSingleObject};

        let event_name = windows::core::w!("AeroGraph_Single_Instance_Event");
        let event_handle = unsafe { CreateEventW(None, false, false, event_name) };
        if let Ok(handle) = event_handle {
            while r_single_instance.load(Ordering::Relaxed) {
                let res = unsafe { WaitForSingleObject(handle, 1000) };
                if res == WAIT_OBJECT_0 {
                    let pending_file = AppConfig::config_dir().join("pending_import.txt");
                    if pending_file.exists() {
                        if let Ok(path_str) = std::fs::read_to_string(&pending_file) {
                            let _ = std::fs::remove_file(&pending_file);
                            let path = PathBuf::from(path_str.trim());
                            if path.exists() {
                                let _ = proxy_single_instance
                                    .send_event(AppEvent::ImportPresetFile(path));
                                continue;
                            }
                        }
                    }
                    let _ = proxy_single_instance.send_event(AppEvent::ToggleConsole);
                }
            }
            unsafe {
                let _ = CloseHandle(handle);
            }
        }
    });

    // 3. Shared state
    let shared_profile = Arc::new(Mutex::new(loaded_profile));
    let shared_config = Arc::new(Mutex::new(config.clone()));
    let reload_trigger = Arc::new(AtomicBool::new(false));

    let (manual_trigger_tx, manual_trigger_rx) = mpsc::channel::<()>();
    let shared_input_snapshot = Arc::new(Mutex::new(
        crate::input::axis_sampler::InputSnapshot::default(),
    ));

    // 3b. Shared Audio Peak Meter for Real-Time VU Meter and Visualizer (Option A - CoreAudio)
    let ui_visible = Arc::new(AtomicBool::new(config.gui_open_on_startup));
    let ui_hardware_active = Arc::new(AtomicBool::new(false));
    let mpo_binding_active = Arc::new(AtomicBool::new(false));
    let voice_recognition_enabled = Arc::new(AtomicBool::new(config.voice_recognition));
    let mic_peak_level = Arc::new(AtomicU32::new(0));
    crate::engine::AudioPeakMeter::spawn_sampling_thread(
        running.clone(),
        ui_visible.clone(),
        voice_recognition_enabled.clone(),
        mic_peak_level.clone(),
    );

    // 4. Spawn background voice engine thread
    let v_profile = shared_profile.clone();
    let v_config = shared_config.clone();
    let v_reload = reload_trigger.clone();
    let v_proxy = proxy.clone();
    let v_input = shared_input_snapshot.clone();
    let v_hardware_active = ui_hardware_active.clone();
    let v_ui_visible = ui_visible.clone();
    let v_mpo_binding = mpo_binding_active.clone();

    let worker_ctx = VoiceWorkerContext {
        running: r_voice,
        profile_lock: v_profile,
        config_lock: v_config,
        reload_trigger: v_reload,
        proxy: v_proxy,
        input_lock: v_input,
        ui_hardware_active: v_hardware_active,
        ui_visible: v_ui_visible,
        mpo_binding_active: v_mpo_binding,
    };

    thread::spawn(move || {
        run_voice_worker_loop(worker_ctx);
    });

    // 5. Spawn background kneeboard watcher thread
    let w_config = shared_config.clone();
    let proxy_regen = proxy.clone();
    let on_regen_complete = Arc::new(move || {
        let _ = proxy_regen.send_event(AppEvent::KneeboardRegenFinished);
    });

    KneeboardWatcher::spawn_loop(
        r_watcher,
        w_config,
        manual_trigger_rx,
        Some(on_regen_complete),
    );

    // 6. Check for updates on startup if enabled (flight-safe, runs in background thread)
    if config.check_updates_on_startup {
        crate::updater::spawn_update_check(
            config.github_repo.clone(),
            env!("CARGO_PKG_VERSION").to_string(),
            false,
        );
    }

    // 7. Tactical Console & Audio State
    let mut tactical_console = TacticalConsoleManager::new();
    let mut main_bms_client = BmsSharedMemoryClient::new();
    let mut last_telemetry_tick = Instant::now();
    let mut last_in_3d = false;
    let audio_player = crate::engine::audio::AudioPlayer::new().ok();

    if config.gui_open_on_startup {
        let _ = proxy.send_event(AppEvent::ToggleConsole);
    }

    // 8. Run Tray & Console Event Loop on main thread
    let menu_channel = MenuEvent::receiver();
    let tray_channel = TrayIconEvent::receiver();
    let mut last_tray_listening = config.listening_enabled;
    let mut last_tray_click_instant = Instant::now() - Duration::from_secs(1);
    let mut mpo_baseline_snapshot: Option<std::collections::HashSet<(u32, String, String)>> = None;
    let mut mpo_prev_pressed: std::collections::HashSet<(u32, String, String)> =
        std::collections::HashSet::new();

    event_loop.run(move |event, event_loop_target, control_flow| {
        *control_flow =
            ControlFlow::WaitUntil(std::time::Instant::now() + Duration::from_millis(50));

        match event {
            // Window close requested by OS
            Event::WindowEvent {
                event: tao::event::WindowEvent::CloseRequested,
                ..
            } => {
                if let Some(win) = tactical_console.active_window() {
                    save_window_geometry(win, &shared_config);
                }
                tactical_console.teardown();
                ui_visible.store(false, Ordering::Relaxed);
            }

            // Custom User Events
            Event::UserEvent(AppEvent::ListeningChanged(active)) => {
                tray.set_listening_active(active);
                last_tray_listening = active;
                if let Some(win) = tactical_console.active_window() {
                    let json = serde_json::json!({
                        "listening_enabled": active
                    });
                    win.send_event("ListeningChanged", &json.to_string());
                }
            }
            Event::UserEvent(AppEvent::SpeechRecognized { text, confidence }) => {
                if let Some(win) = tactical_console.active_window() {
                    let json = serde_json::json!({
                        "phrase": text,
                        "confidence": (confidence * 100.0).round(),
                        "timestamp": "",
                        "status": "VERIFIED"
                    });
                    win.send_event("SpeechRecognized", &json.to_string());
                }
            }
            Event::UserEvent(AppEvent::ToggleConsole) => {
                if let Some(win) = tactical_console.active_window() {
                    save_window_geometry(win, &shared_config);
                }
                let cfg = shared_config.lock().unwrap().clone();
                let p = proxy.clone();
                let res = tactical_console.toggle(
                    event_loop_target,
                    &cfg,
                    move |req, _win| {
                        let _ = p.send_event(AppEvent::IpcMessage(req));
                    },
                );
                match res {
                    Ok(opened) => {
                        log::info!("Tactical Console toggled (open={})", opened);
                        ui_visible.store(opened, Ordering::Relaxed);
                        if opened {
                            if let Some(win) = tactical_console.active_window() {
                                push_snapshot_helper(
                                    win,
                                    &cfg,
                                    &shared_profile,
                                    &mut main_bms_client,
                                );
                            }
                        }
                    }
                    Err(e) => {
                        log::error!("Failed to toggle Tactical Console: {:?}", e);
                    }
                }
            }
            Event::UserEvent(AppEvent::CloseConsole) => {
                if let Some(win) = tactical_console.active_window() {
                    win.window().set_visible(false);
                    save_window_geometry(win, &shared_config);
                }
                tactical_console.teardown();
                ui_visible.store(false, Ordering::Relaxed);
            }
            Event::UserEvent(AppEvent::KneeboardRegenFinished) => {
                log::info!("Kneeboard regeneration finished, notifying Tactical Console");
                if let Some(win) = tactical_console.active_window() {
                    win.send_event("KneeboardRegenFinished", "{}");
                    let cfg = shared_config.lock().unwrap().clone();
                    push_snapshot_helper(win, &cfg, &shared_profile, &mut main_bms_client);
                }
            }
            Event::UserEvent(AppEvent::ImportPresetFile(path)) => {
                log::info!("Handling incoming preset import from external trigger: {:?}", path);
                match crate::gui::preset::AeroPresetPackage::import_from_file(&path) {
                    Ok(pkg) => {
                        let _ = pkg.apply_to_workspace();
                        let now_ms = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis();
                        let custom = crate::gui::preset::CustomPreset {
                            id: format!("custom_{}", now_ms),
                            name: pkg.manifest.name.clone(),
                            description: pkg.manifest.description.clone(),
                            theater: pkg.manifest.theater.clone(),
                            color: pkg.manifest.color.clone(),
                            slots: pkg.layout.slots.clone(),
                            created_at: pkg.manifest.created_at.clone(),
                        };
                        let mut presets = AppConfig::load_custom_presets();
                        presets.retain(|x| x.id != custom.id && x.name != custom.name);
                        presets.push(custom);
                        let _ = AppConfig::save_custom_presets(&presets);

                        if !pkg.manifest.color.is_empty() {
                            let mut cfg = shared_config.lock().unwrap();
                            cfg.gui_accent_color = pkg.manifest.color.clone();
                            let _ = cfg.save();
                        }

                        // Ensure tactical console window is open and brought to front
                        if tactical_console.active_window().is_none() {
                            let cfg = shared_config.lock().unwrap().clone();
                            let p = proxy.clone();
                            if let Ok(opened) = tactical_console.toggle(
                                event_loop_target,
                                &cfg,
                                move |req, _win| {
                                    let _ = p.send_event(AppEvent::IpcMessage(req));
                                },
                            ) {
                                ui_visible.store(opened, Ordering::Relaxed);
                                if let Some(win) = tactical_console.active_window() {
                                    win.window().set_focus();
                                    push_snapshot_helper(
                                        win,
                                        &cfg,
                                        &shared_profile,
                                        &mut main_bms_client,
                                    );
                                }
                            }
                        } else if let Some(win) = tactical_console.active_window() {
                            win.window().set_focus();
                            let cfg = shared_config.lock().unwrap().clone();
                            push_snapshot_helper(
                                win,
                                &cfg,
                                &shared_profile,
                                &mut main_bms_client,
                            );
                        }
                    }
                    Err(e) => {
                        log::error!("Failed to import AeroPreset from external trigger: {:?}", e);
                    }
                }
            }
            Event::UserEvent(AppEvent::IpcMessage(req)) => {
                let mut ctx = IpcContext {
                    tactical_console: &mut tactical_console,
                    shared_config: &shared_config,
                    shared_profile: &shared_profile,
                    reload_trigger: &reload_trigger,
                    manual_trigger_tx: &manual_trigger_tx,
                    tray: &tray,
                    last_tray_listening: &mut last_tray_listening,
                    main_bms_client: &mut main_bms_client,
                    audio_player: audio_player.as_ref(),
                    ui_visible: &ui_visible,
                    voice_recognition_enabled: &voice_recognition_enabled,
                    mpo_binding_active: &mpo_binding_active,
                    ui_hardware_active: &ui_hardware_active,
                };
                handle_ipc_message(req, &mut ctx);
            }

            // System Events & Periodic Telemetry
            Event::NewEvents(_) => {
                // Keep tray menu in sync if listening was toggled via voice ("stand by" / "radio check")
                let (current_listening, voice_enabled) = {
                    let cfg = shared_config.lock().unwrap();
                    (cfg.listening_enabled, cfg.voice_recognition)
                };
                if voice_enabled && current_listening != last_tray_listening {
                    tray.set_listening_active(current_listening);
                    last_tray_listening = current_listening;
                    if let Some(win) = tactical_console.active_window() {
                        let json = serde_json::json!({
                            "listening_enabled": current_listening
                        });
                        win.send_event("ListeningChanged", &json.to_string());
                    }
                }

                // System Tray Left-Click Toggle (Debounced single left-click opens/toggles the console)
                let mut tray_toggle_requested = false;
                while let Ok(tray_event) = tray_channel.try_recv() {
                    if let TrayIconEvent::Click {
                        button: tray_icon::MouseButton::Left,
                        button_state: tray_icon::MouseButtonState::Up,
                        ..
                    } = tray_event
                    {
                        tray_toggle_requested = true;
                    }
                }
                if tray_toggle_requested {
                    let now = Instant::now();
                    if now.duration_since(last_tray_click_instant) > Duration::from_millis(300) {
                        last_tray_click_instant = now;
                        if let Some(win) = tactical_console.active_window() {
                            save_window_geometry(win, &shared_config);
                        }
                        let cfg = shared_config.lock().unwrap().clone();
                        let p = proxy.clone();
                        let res = tactical_console.toggle(
                            event_loop_target,
                            &cfg,
                            move |req, _win| {
                                let _ = p.send_event(AppEvent::IpcMessage(req));
                            },
                        );
                        match res {
                            Ok(opened) => {
                                log::info!("Tactical Console toggled directly from tray (open={})", opened);
                                ui_visible.store(opened, Ordering::Relaxed);
                                if opened {
                                    if let Some(win) = tactical_console.active_window() {
                                        win.window().set_visible(true);
                                        win.window().set_focus();
                                        push_snapshot_helper(
                                            win,
                                            &cfg,
                                            &shared_profile,
                                            &mut main_bms_client,
                                        );
                                    }
                                }
                            }
                            Err(e) => {
                                log::error!("Failed to toggle Tactical Console: {:?}", e);
                            }
                        }
                    }
                }

                // System Tray Menu Click Dispatch
                while let Ok(menu_event) = menu_channel.try_recv() {
                    if menu_event.id == tray.item_exit.id() {
                        log::info!("Exit requested from tray menu");
                        while tray_channel.try_recv().is_ok() {}
                        if let Some(win) = tactical_console.active_window() {
                            save_window_geometry(win, &shared_config);
                        }
                        tactical_console.teardown();
                        running.store(false, Ordering::SeqCst);
                        *control_flow = ControlFlow::Exit;
                        return;
                    } else if menu_event.id == tray.item_voice_recognition.id() {
                        let mut cfg = shared_config.lock().unwrap();
                        cfg.voice_recognition = !cfg.voice_recognition;
                        tray.set_voice_recognition_enabled(cfg.voice_recognition);
                        let is_enabled = cfg.voice_recognition;
                        let _ = cfg.save();
                        voice_recognition_enabled.store(is_enabled, Ordering::Relaxed);
                        reload_trigger.store(true, Ordering::SeqCst);
                        log::info!(
                            "Voice recognition set to: {}",
                            if is_enabled { "Enabled" } else { "Disabled" }
                        );
                        if let Some(win) = tactical_console.active_window() {
                            push_snapshot_helper(win, &cfg, &shared_profile, &mut main_bms_client);
                        }
                    } else if menu_event.id == tray.item_listening.id() {
                        let mut cfg = shared_config.lock().unwrap();
                        if !cfg.voice_recognition {
                            continue;
                        }
                        cfg.listening_enabled = !cfg.listening_enabled;
                        tray.set_listening_active(cfg.listening_enabled);
                        last_tray_listening = cfg.listening_enabled;
                        let _ = cfg.save();
                        log::info!(
                            "Listening set to: {}",
                            if cfg.listening_enabled {
                                "Active"
                            } else {
                                "Muted"
                            }
                        );
                        if let Some(win) = tactical_console.active_window() {
                            push_snapshot_helper(win, &cfg, &shared_profile, &mut main_bms_client);
                        }
                    } else if menu_event.id == tray.item_auto_kneeboards.id() {
                        let mut cfg = shared_config.lock().unwrap();
                        cfg.auto_kneeboards = !cfg.auto_kneeboards;
                        tray.set_auto_kneeboards_enabled(cfg.auto_kneeboards);
                        let _ = cfg.save();
                        log::info!("Auto-kneeboard generation set to: {}", cfg.auto_kneeboards);
                        if let Some(win) = tactical_console.active_window() {
                            push_snapshot_helper(win, &cfg, &shared_profile, &mut main_bms_client);
                        }
                    } else if menu_event.id == tray.item_edit_kneeboards.id() {
                        let cfg_path = crate::kneeboard::layout::KneeboardLayoutConfig::config_path();
                        if !cfg_path.exists() {
                            let _ =
                                crate::kneeboard::layout::KneeboardLayoutConfig::load_or_create_default(
                                );
                        }
                        log::info!("Opening kneeboard configuration in editor: {:?}", cfg_path);
                        let _ = std::process::Command::new("notepad.exe")
                            .arg(&cfg_path)
                            .spawn();
                    } else if menu_event.id == tray.item_regen_now.id() {
                        log::info!("Manual kneeboard regeneration requested from tray menu");
                        let _ = manual_trigger_tx.send(());
                    } else if menu_event.id == tray.item_open_images.id() {
                        let images_path = PathBuf::from("images");
                        let _ = std::fs::create_dir_all(&images_path);
                        let _ = std::process::Command::new("explorer.exe")
                            .arg(&images_path)
                            .spawn();
                    } else if menu_event.id == tray.item_autostart.id() {
                        let cur_auto = AppConfig::is_auto_start_enabled();
                        let new_auto = !cur_auto;
                        let _ = AppConfig::set_auto_start_enabled(new_auto);
                        tray.set_autostart_enabled(new_auto);
                        {
                            let mut cfg = shared_config.lock().unwrap();
                            cfg.start_with_windows = new_auto;
                            let _ = cfg.save();
                        }
                        if let Some(win) = tactical_console.active_window() {
                            let cfg = shared_config.lock().unwrap().clone();
                            push_snapshot_helper(win, &cfg, &shared_profile, &mut main_bms_client);
                        }
                        log::info!("Start with Windows set to: {}", new_auto);
                    } else if menu_event.id == tray.item_console.id() {
                        let mut cfg = shared_config.lock().unwrap();
                        let current_vis = CONSOLE_IS_VISIBLE.load(Ordering::SeqCst);
                        let new_vis = !current_vis;
                        set_console_visible(new_vis);
                        tray.set_console_visible(new_vis);
                        cfg.show_console = new_vis;
                        let _ = cfg.save();
                        log::info!("Console visibility set to: {}", new_vis);
                    } else if menu_event.id == tray.item_check_updates.id() {
                        let repo = {
                            let cfg = shared_config.lock().unwrap();
                            cfg.github_repo.clone()
                        };
                        log::info!(
                            "Manual check for updates requested from tray menu (repo: {})",
                            repo
                        );
                        crate::updater::spawn_update_check(
                            repo,
                            env!("CARGO_PKG_VERSION").to_string(),
                            true,
                        );
                    } else if menu_event.id == tray.item_open_log.id() {
                        let log_p = AppConfig::log_file_path();
                        let _ = std::process::Command::new("notepad.exe")
                            .arg(&log_p)
                            .spawn();
                    } else if menu_event.id == tray.item_gender.id() {
                        let mut cfg = shared_config.lock().unwrap();
                        cfg.pilot_female = !cfg.pilot_female;
                        tray.set_gender(cfg.pilot_female);
                        let _ = cfg.save();
                        log::info!(
                            "Pilot gender set to: {}",
                            if cfg.pilot_female { "Female" } else { "Male" }
                        );
                        reload_trigger.store(true, Ordering::SeqCst);
                        if let Some(win) = tactical_console.active_window() {
                            let cfg_clone = cfg.clone();
                            push_snapshot_helper(win, &cfg_clone, &shared_profile, &mut main_bms_client);
                        }
                    } else if menu_event.id == tray.item_select.id() {
                        if let Some(path) = AppTray::prompt_select_profile() {
                            log::info!("Selected new profile: {:?}", path);
                            if let Ok(new_lp) = LoadedProfile::load_from_file(&path) {
                                tray.set_profile_name(&new_lp.profile.Name);
                                let mut cfg = shared_config.lock().unwrap();
                                cfg.profile_path = Some(path.to_string_lossy().to_string());
                                let _ = cfg.save();
                                let mut prof_guard = shared_profile.lock().unwrap();
                                *prof_guard = Some(new_lp);
                                reload_trigger.store(true, Ordering::SeqCst);
                            }
                        }
                    } else if menu_event.id == tray.item_reload.id() {
                        let cfg = shared_config.lock().unwrap();
                        let p_opt = cfg.resolve_profile();
                        if let Some(p) = p_opt {
                            if let Ok(reloaded) = LoadedProfile::load_from_file(&p) {
                                tray.set_profile_name(&reloaded.profile.Name);
                                let mut prof_guard = shared_profile.lock().unwrap();
                                *prof_guard = Some(reloaded);
                                log::info!("Profile reloaded successfully: {:?}", p);
                                reload_trigger.store(true, Ordering::SeqCst);
                            }
                        }
                    }
                }

                // High-Performance Telemetry Stream for Tactical Console (10Hz)
                if tactical_console.is_open() && last_telemetry_tick.elapsed() >= Duration::from_millis(100) {
                    last_telemetry_tick = Instant::now();
                    if !main_bms_client.is_connected() {
                        let _ = main_bms_client.connect();
                    }

                    let bms_running = main_bms_client.is_connected();
                    let is_3d = main_bms_client
                        .read_vibe_data()
                        .map(|v| v.in_3d != 0)
                        .unwrap_or(false);

                    // SmartAutoDock: Sim 3D Lockout & Teardown
                    if is_3d && !last_in_3d {
                        let cfg = shared_config.lock().unwrap();
                        if cfg.gui_auto_dock_on_3d && !cfg.secondary_monitor_pin {
                            log::info!("SmartAutoDock: Entered 3D simulation, tearing down Tactical Console to ensure 0% sim overhead.");
                            tactical_console.teardown();
                            last_in_3d = is_3d;
                            return;
                        }
                    }
                    last_in_3d = is_3d;

                    let is_vis = tactical_console
                        .active_window()
                        .map(|w| w.window().is_visible())
                        .unwrap_or(false);
                    ui_visible.store(is_vis, Ordering::Relaxed);

                    if let Some(win) = tactical_console.active_window() {
                        let strings = main_bms_client.read_string_info();
                        let callsign = if !strings.callsign.is_empty() {
                            strings.callsign
                        } else {
                            "VIPER 1-1".to_string()
                        };
                        let (bull_b, bull_d) = main_bms_client
                            .read_primary_data()
                            .map(|p| (p.bearing_to_beacon, p.distance_to_beacon))
                            .unwrap_or((0.0, 0.0));
                        let hw_snap = shared_input_snapshot.lock().unwrap().clone();
                        let is_voice_on = voice_recognition_enabled.load(Ordering::Relaxed);
                        let current_mic_peak = if is_voice_on {
                            f32::from_bits(mic_peak_level.load(Ordering::Relaxed))
                        } else {
                            0.0
                        };

                        win.push_telemetry(&crate::gui::ipc::TelemetryData {
                            bms_running,
                            is_3d,
                            theater: "KOREA".to_string(),
                            callsign,
                            uhf_freq: "251.000".to_string(),
                            vhf_freq: "121.500".to_string(),
                            steerpoint_num: 1,
                            bullseye_bearing: bull_b,
                            bullseye_distance: bull_d,
                            mic_vu_level: current_mic_peak,
                            pitch_axis: hw_snap.pitch,
                            roll_axis: hw_snap.roll,
                            yaw_axis: hw_snap.yaw,
                            left_brake: hw_snap.left_brake,
                            right_brake: hw_snap.right_brake,
                            ptt_com1: hw_snap.ptt_com1_pressed,
                            ptt_com2: hw_snap.ptt_com2_pressed,
                            active_buttons: hw_snap.pressed_buttons,
                            mpo_active: hw_snap.mpo_active,
                        });
                        win.push_audio_level(current_mic_peak);

                        let current_pressed_set: std::collections::HashSet<(u32, String, String)> =
                            hw_snap.pressed_device_buttons.iter().cloned().collect();

                        if mpo_binding_active.load(Ordering::Relaxed) {
                            if mpo_baseline_snapshot.is_none() {
                                // First tick after MPO binding was armed: record currently held switches/buttons as baseline
                                log::info!(
                                    "MPO binding mode armed: baseline held switches = {:?}",
                                    current_pressed_set
                                );
                                mpo_baseline_snapshot = Some(current_pressed_set.clone());
                            } else {
                                let baseline = mpo_baseline_snapshot.as_mut().unwrap();
                                // If a baseline switch is released (flipped to OFF), remove it from baseline
                                // so flipping it back to ON will register as a valid rising-edge activation.
                                baseline.retain(|k| current_pressed_set.contains(k));

                                // Find any button that transitioned to pressed (rising edge) and wasn't in baseline
                                let newly_activated =
                                    hw_snap.pressed_device_buttons.iter().find(|triple| {
                                        !baseline.contains(triple) && !mpo_prev_pressed.contains(triple)
                                    });

                                if let Some((btn, dev, guid)) = newly_activated.cloned() {
                                    mpo_binding_active.store(false, Ordering::Relaxed);
                                    mpo_baseline_snapshot = None;
                                    log::info!(
                                        "MPO button activation detected on hardware: btn={}, dev={}, guid={}",
                                        btn,
                                        dev,
                                        guid
                                    );
                                    {
                                        let mut prof_guard = shared_profile.lock().unwrap();
                                        if let Some(ref mut lp) = *prof_guard {
                                            lp.set_mpo_binding(btn, Some(&dev), Some(&guid));
                                            if let Err(e) = lp.save_to_file(&lp.profile_path) {
                                                log::error!(
                                                    "Failed to save profile with new MPO binding: {:?}",
                                                    e
                                                );
                                            } else {
                                                log::info!(
                                                    "Successfully updated .fvx profile with MPO JoyBtn {} on {} ({})",
                                                    btn,
                                                    dev,
                                                    guid
                                                );
                                            }
                                        }
                                    }
                                    reload_trigger.store(true, Ordering::SeqCst);
                                    let cfg = shared_config.lock().unwrap().clone();
                                    push_snapshot_helper(
                                        win,
                                        &cfg,
                                        &shared_profile,
                                        &mut main_bms_client,
                                    );
                                    win.send_event(
                                        "MpoBindingCaptured",
                                        &serde_json::json!({
                                            "button": btn,
                                            "device": dev,
                                            "guid": guid,
                                            "is_key": false,
                                        })
                                        .to_string(),
                                    );
                                }
                            }
                        } else {
                            mpo_baseline_snapshot = None;
                        }
                        mpo_prev_pressed = current_pressed_set;
                    }
                }
            }
            _ => {}
        }
    });
}

fn save_window_geometry(
    win: &crate::gui::window::TacticalConsoleWindow,
    shared_config: &Arc<Mutex<AppConfig>>,
) {
    let is_max = win.window().is_maximized();
    let mut cfg = shared_config.lock().unwrap();
    cfg.window_maximized = is_max;
    if !is_max {
        let scale = win.window().scale_factor();
        if let Ok(pos) = win.window().outer_position() {
            let logical_pos = pos.to_logical::<f64>(scale);
            cfg.window_pos = Some((logical_pos.x.round() as i32, logical_pos.y.round() as i32));
        }
        let logical_size = win.window().inner_size().to_logical::<f64>(scale);
        cfg.window_size = (
            logical_size.width.round().max(1024.0) as u32,
            logical_size.height.round().max(680.0) as u32,
        );
    }
    let _ = cfg.save();
}

struct IpcContext<'a> {
    tactical_console: &'a mut crate::gui::TacticalConsoleManager,
    shared_config: &'a Arc<Mutex<AppConfig>>,
    shared_profile: &'a Arc<Mutex<Option<LoadedProfile>>>,
    reload_trigger: &'a Arc<AtomicBool>,
    manual_trigger_tx: &'a mpsc::Sender<()>,
    tray: &'a AppTray,
    last_tray_listening: &'a mut bool,
    main_bms_client: &'a mut BmsSharedMemoryClient,
    audio_player: Option<&'a crate::engine::audio::AudioPlayer>,
    ui_visible: &'a Arc<AtomicBool>,
    voice_recognition_enabled: &'a Arc<AtomicBool>,
    mpo_binding_active: &'a Arc<AtomicBool>,
    ui_hardware_active: &'a Arc<AtomicBool>,
}

fn handle_ipc_message(req: crate::gui::ipc::IpcRequest, ctx: &mut IpcContext<'_>) {
    use crate::gui::ipc::IpcRequest;
    match req {
        IpcRequest::SetUiMode { mode } => {
            ctx.ui_hardware_active
                .store(mode == "hardware", Ordering::Relaxed);
        }
        IpcRequest::DragWindow | IpcRequest::ResizeWindow { .. } | IpcRequest::MinimizeWindow => {
            // Handled directly inside window event callback
        }
        IpcRequest::WindowReady => {
            ctx.tactical_console.close_splash();
            if let Some(win) = ctx.tactical_console.active_window() {
                win.window().set_visible(true);
                win.window().set_focus();
            }
        }
        IpcRequest::ToggleMaximize => {
            if let Some(win) = ctx.tactical_console.active_window() {
                win.window().set_maximized(!win.window().is_maximized());
            }
        }
        IpcRequest::CloseWindow => {
            if let Some(win) = ctx.tactical_console.active_window() {
                win.window().set_visible(false);
                save_window_geometry(win, ctx.shared_config);
            }
            ctx.tactical_console.teardown();
            ctx.ui_visible.store(false, Ordering::Relaxed);
            ctx.ui_hardware_active.store(false, Ordering::Relaxed);
        }
        IpcRequest::GetInitialState => {
            let cfg = ctx.shared_config.lock().unwrap().clone();
            if let Some(win) = ctx.tactical_console.active_window() {
                push_snapshot_helper(win, &cfg, ctx.shared_profile, ctx.main_bms_client);
            }
        }
        IpcRequest::UpdateConfig(new_cfg) => {
            let mut cfg = ctx.shared_config.lock().unwrap();
            let needs_reload = cfg.profile_path != new_cfg.profile_path
                || cfg.pilot_female != new_cfg.pilot_female
                || cfg.bms_key_file != new_cfg.bms_key_file;
            if cfg.start_with_windows != new_cfg.start_with_windows {
                let _ = AppConfig::set_auto_start_enabled(new_cfg.start_with_windows);
                ctx.tray.set_autostart_enabled(new_cfg.start_with_windows);
            }
            *cfg = *new_cfg;
            let _ = cfg.save();
            ctx.voice_recognition_enabled
                .store(cfg.voice_recognition, Ordering::Relaxed);
            ctx.tray
                .set_voice_recognition_enabled(cfg.voice_recognition);
            ctx.tray.set_listening_active(cfg.listening_enabled);
            ctx.tray.set_gender(cfg.pilot_female);
            ctx.tray.set_auto_kneeboards_enabled(cfg.auto_kneeboards);
            ctx.tray.set_autostart_enabled(cfg.start_with_windows);
            *ctx.last_tray_listening = cfg.listening_enabled;
            if needs_reload {
                ctx.reload_trigger.store(true, Ordering::SeqCst);
            }
            if let Some(win) = ctx.tactical_console.active_window() {
                push_snapshot_helper(win, &cfg, ctx.shared_profile, ctx.main_bms_client);
            }
        }
        IpcRequest::SetListening { active } => {
            let cfg_clone = {
                let mut cfg = ctx.shared_config.lock().unwrap();
                cfg.listening_enabled = active;
                let _ = cfg.save();
                cfg.clone()
            };
            ctx.tray.set_listening_active(active);
            *ctx.last_tray_listening = active;
            if let Some(win) = ctx.tactical_console.active_window() {
                push_snapshot_helper(win, &cfg_clone, ctx.shared_profile, ctx.main_bms_client);
            }
        }
        IpcRequest::SetVoiceRecognition { enabled } => {
            let cfg_clone = {
                let mut cfg = ctx.shared_config.lock().unwrap();
                cfg.voice_recognition = enabled;
                let _ = cfg.save();
                cfg.clone()
            };
            ctx.voice_recognition_enabled
                .store(enabled, Ordering::Relaxed);
            ctx.tray.set_voice_recognition_enabled(enabled);
            ctx.reload_trigger.store(true, Ordering::SeqCst);
            if let Some(win) = ctx.tactical_console.active_window() {
                push_snapshot_helper(win, &cfg_clone, ctx.shared_profile, ctx.main_bms_client);
            }
        }
        IpcRequest::SetAutoKneeboards { enabled } => {
            let cfg_clone = {
                let mut cfg = ctx.shared_config.lock().unwrap();
                cfg.auto_kneeboards = enabled;
                let _ = cfg.save();
                cfg.clone()
            };
            ctx.tray.set_auto_kneeboards_enabled(enabled);
            if let Some(win) = ctx.tactical_console.active_window() {
                push_snapshot_helper(win, &cfg_clone, ctx.shared_profile, ctx.main_bms_client);
            }
        }
        IpcRequest::SetSoundSettings { enabled, volume } => {
            let mut cfg = ctx.shared_config.lock().unwrap();
            cfg.gui_sound_effects = enabled;
            cfg.gui_sound_volume = volume;
            let _ = cfg.save();
        }
        IpcRequest::SetAccentColor { color } => {
            let cfg = {
                let mut cfg = ctx.shared_config.lock().unwrap();
                cfg.gui_accent_color = color;
                let _ = cfg.save();
                cfg.clone()
            };
            if let Some(win) = ctx.tactical_console.active_window() {
                push_snapshot_helper(win, &cfg, ctx.shared_profile, ctx.main_bms_client);
            }
        }
        IpcRequest::GetTemplateContent { path } => {
            let assets_dir = AppConfig::find_assets_dir();
            let user_templates_dir = AppConfig::user_templates_dir();
            let p = std::path::PathBuf::from(&path);
            let filename = p
                .file_name()
                .map(std::path::PathBuf::from)
                .unwrap_or_else(|| p.clone());
            let candidates = vec![
                p.clone(),
                user_templates_dir.join(&path),
                user_templates_dir.join(&filename),
                assets_dir.join(&p),
                assets_dir.join("notes").join(&p),
                std::path::PathBuf::from(".").join(&p),
                std::path::PathBuf::from(".").join("notes").join(&p),
            ];
            let mut found_content = None;
            for candidate in candidates {
                if candidate.exists() {
                    if let Ok(c) = std::fs::read_to_string(candidate) {
                        found_content = Some(c);
                        break;
                    }
                }
            }
            if let Some(win) = ctx.tactical_console.active_window() {
                let json = serde_json::json!({
                    "path": path,
                    "content": found_content.unwrap_or_default(),
                });
                win.send_event("TemplateContent", &json.to_string());
            }
        }
        IpcRequest::SaveCustomTemplate { template, content } => {
            let user_tmpl_dir = AppConfig::user_templates_dir();
            let file_name = format!("{}.md", template.id);
            let target_file = user_tmpl_dir.join(&file_name);
            if let Err(e) = std::fs::write(&target_file, &content) {
                log::error!(
                    "Failed to write custom template file {:?}: {:?}",
                    target_file,
                    e
                );
            }
            let mut templates = AppConfig::load_custom_templates();
            templates.retain(|t| t.id != template.id);
            let mut updated_template = template;
            updated_template.path = format!("custom/{}", file_name);
            templates.push(updated_template);
            if let Err(e) = AppConfig::save_custom_templates(&templates) {
                log::error!("Failed to save custom templates index: {:?}", e);
            }
            if let Some(win) = ctx.tactical_console.active_window() {
                let cfg = ctx.shared_config.lock().unwrap().clone();
                push_snapshot_helper(win, &cfg, ctx.shared_profile, ctx.main_bms_client);
            }
        }
        IpcRequest::DeleteCustomTemplate { id } => {
            let mut templates = AppConfig::load_custom_templates();
            templates.retain(|t| t.id != id);
            let _ = AppConfig::save_custom_templates(&templates);
            let target_file = AppConfig::user_templates_dir().join(format!("{}.md", id));
            if target_file.exists() {
                let _ = std::fs::remove_file(target_file);
            }
            if let Some(win) = ctx.tactical_console.active_window() {
                let cfg = ctx.shared_config.lock().unwrap().clone();
                push_snapshot_helper(win, &cfg, ctx.shared_profile, ctx.main_bms_client);
            }
        }
        IpcRequest::SaveCustomStamp { stamp } => {
            let mut stamps = AppConfig::load_custom_stamps();
            if let Some(existing) = stamps.iter_mut().find(|s| s.id == stamp.id) {
                *existing = stamp;
            } else {
                stamps.push(stamp);
            }
            if let Err(e) = AppConfig::save_custom_stamps(&stamps) {
                log::error!("Failed to save custom stamps: {:?}", e);
            }
            if let Some(win) = ctx.tactical_console.active_window() {
                let cfg = ctx.shared_config.lock().unwrap().clone();
                push_snapshot_helper(win, &cfg, ctx.shared_profile, ctx.main_bms_client);
            }
        }
        IpcRequest::DeleteCustomStamp { id } => {
            let mut stamps = AppConfig::load_custom_stamps();
            stamps.retain(|s| s.id != id);
            let _ = AppConfig::save_custom_stamps(&stamps);
            if let Some(win) = ctx.tactical_console.active_window() {
                let cfg = ctx.shared_config.lock().unwrap().clone();
                push_snapshot_helper(win, &cfg, ctx.shared_profile, ctx.main_bms_client);
            }
        }
        IpcRequest::ResetCustomStamps => {
            let default_stamps = AppConfig::default_stamps();
            let _ = AppConfig::save_custom_stamps(&default_stamps);
            if let Some(win) = ctx.tactical_console.active_window() {
                let cfg = ctx.shared_config.lock().unwrap().clone();
                push_snapshot_helper(win, &cfg, ctx.shared_profile, ctx.main_bms_client);
            }
        }
        IpcRequest::CommitKneeboardLayout { slots } => {
            let mut layout =
                crate::kneeboard::layout::KneeboardLayoutConfig::load_or_create_default();
            layout.slots = slots;
            if let Err(e) = layout.save() {
                log::error!("Failed to save kneeboard layout: {:?}", e);
            } else {
                log::info!("Kneeboard layout updated successfully via Tactical Console");
            }
        }
        IpcRequest::TriggerRegeneration => {
            log::info!("Manual kneeboard regeneration triggered via Tactical Console");
            let _ = ctx.manual_trigger_tx.send(());
        }
        IpcRequest::ExportPreset {
            file_path,
            name,
            description,
            theater,
            color,
        } => {
            let path = if file_path.trim().is_empty() {
                let default_fname = format!(
                    "{}.aeropreset",
                    name.trim().to_lowercase().replace(' ', "_")
                );
                rfd::FileDialog::new()
                    .add_filter("AeroPreset (*.aeropreset)", &["aeropreset"])
                    .set_file_name(&default_fname)
                    .set_title("Export AeroPreset (.aeropreset)")
                    .save_file()
            } else {
                Some(std::path::PathBuf::from(file_path))
            };
            if let Some(path) = path {
                let layout =
                    crate::kneeboard::layout::KneeboardLayoutConfig::load_or_create_default();
                let manifest = crate::gui::preset::AeroPresetManifest {
                    name,
                    author: "Pilot".to_string(),
                    theater,
                    description,
                    version: "1.0.0".to_string(),
                    created_at: "2026-11-06".to_string(),
                    color: color.unwrap_or_else(|| "#10B981".to_string()),
                };
                let mut custom_files = std::collections::HashMap::new();
                let assets_dir = AppConfig::find_assets_dir();
                let user_templates_dir = AppConfig::user_templates_dir();

                for slot_cfg in layout.slots.values() {
                    if let Some(ref p) = slot_cfg.path {
                        let pb = std::path::PathBuf::from(p);
                        let filename = pb
                            .file_name()
                            .map(std::path::PathBuf::from)
                            .unwrap_or_else(|| pb.clone());
                        let candidates = vec![
                            pb.clone(),
                            user_templates_dir.join(p),
                            user_templates_dir.join(&filename),
                            assets_dir.join(p),
                            assets_dir.join("notes").join(p),
                            std::path::PathBuf::from(".").join(p),
                            std::path::PathBuf::from(".").join("notes").join(p),
                        ];
                        for cand in candidates {
                            if cand.exists() {
                                if let Ok(bytes) = std::fs::read(&cand) {
                                    use base64::prelude::*;
                                    let b64 = BASE64_STANDARD.encode(&bytes);
                                    custom_files.insert(p.clone(), b64);
                                    break;
                                }
                            }
                        }
                    }
                }
                let package =
                    crate::gui::preset::AeroPresetPackage::new(manifest, layout, custom_files);
                if let Err(e) = package.export_to_file(&path) {
                    log::error!("Failed to export AeroPreset: {:?}", e);
                } else {
                    log::info!("Successfully exported AeroPreset to: {:?}", path);
                }
            }
        }
        IpcRequest::ImportPreset { file_path } => {
            let path = if file_path.trim().is_empty() {
                rfd::FileDialog::new()
                    .add_filter("AeroPreset (*.aeropreset)", &["aeropreset"])
                    .set_title("Import AeroPreset (.aeropreset)")
                    .pick_file()
            } else {
                Some(std::path::PathBuf::from(file_path))
            };
            if let Some(path) = path {
                match crate::gui::preset::AeroPresetPackage::import_from_file(&path) {
                    Ok(pkg) => {
                        let _ = pkg.apply_to_workspace();
                        let now_ms = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis();
                        let custom = crate::gui::preset::CustomPreset {
                            id: format!("custom_{}", now_ms),
                            name: pkg.manifest.name,
                            description: pkg.manifest.description,
                            theater: pkg.manifest.theater,
                            color: pkg.manifest.color,
                            slots: pkg.layout.slots,
                            created_at: pkg.manifest.created_at,
                        };
                        let mut presets = AppConfig::load_custom_presets();
                        presets.retain(|x| x.id != custom.id && x.name != custom.name);
                        presets.push(custom);
                        let _ = AppConfig::save_custom_presets(&presets);

                        if let Some(win) = ctx.tactical_console.active_window() {
                            let cfg = ctx.shared_config.lock().unwrap().clone();
                            push_snapshot_helper(
                                win,
                                &cfg,
                                ctx.shared_profile,
                                ctx.main_bms_client,
                            );
                        }
                    }
                    Err(e) => {
                        log::error!("Failed to import AeroPreset: {:?}", e);
                    }
                }
            }
        }
        IpcRequest::LoadBuiltinPreset { preset_id } => {
            let pkg = match preset_id.as_str() {
                "strike" | "sead" => crate::gui::preset::AeroPresetPackage::ag_strike_package(),
                "cap" | "bvr" => crate::gui::preset::AeroPresetPackage::aa_air_superiority(),
                "training" | "instrument" => {
                    crate::gui::preset::AeroPresetPackage::training_instrument()
                }
                _ => crate::gui::preset::AeroPresetPackage::default_korea(),
            };
            let color = pkg.manifest.color.clone();
            let _ = pkg.apply_to_workspace();
            {
                let mut cfg = ctx.shared_config.lock().unwrap();
                cfg.gui_accent_color = color;
                let _ = cfg.save();
            }
            if let Some(win) = ctx.tactical_console.active_window() {
                let cfg = ctx.shared_config.lock().unwrap().clone();
                push_snapshot_helper(win, &cfg, ctx.shared_profile, ctx.main_bms_client);
            }
        }
        IpcRequest::SaveCustomPreset { preset } => {
            let color = preset.color.clone();
            let mut presets = AppConfig::load_custom_presets();
            presets.retain(|p| p.id != preset.id);
            presets.push(preset.clone());
            let _ = AppConfig::save_custom_presets(&presets);

            // Also synchronize kneeboards.json with the saved preset slots
            let mut layout = crate::kneeboard::layout::KneeboardLayoutConfig::create_default();
            layout.slots = preset.slots;
            let _ = layout.save();

            {
                let mut cfg = ctx.shared_config.lock().unwrap();
                cfg.gui_accent_color = color;
                let _ = cfg.save();
            }

            if let Some(win) = ctx.tactical_console.active_window() {
                let cfg = ctx.shared_config.lock().unwrap().clone();
                push_snapshot_helper(win, &cfg, ctx.shared_profile, ctx.main_bms_client);
            }
        }
        IpcRequest::DeleteCustomPreset { id } => {
            let mut presets = AppConfig::load_custom_presets();
            presets.retain(|p| p.id != id);
            let _ = AppConfig::save_custom_presets(&presets);
            if let Some(win) = ctx.tactical_console.active_window() {
                let cfg = ctx.shared_config.lock().unwrap().clone();
                push_snapshot_helper(win, &cfg, ctx.shared_profile, ctx.main_bms_client);
            }
        }
        IpcRequest::ApplyCustomPreset { id } => {
            let presets = AppConfig::load_custom_presets();
            if let Some(preset) = presets.into_iter().find(|p| p.id == id) {
                let color = preset.color.clone();
                let mut layout = crate::kneeboard::layout::KneeboardLayoutConfig::create_default();
                layout.slots = preset.slots;
                let _ = layout.save();

                {
                    let mut cfg = ctx.shared_config.lock().unwrap();
                    cfg.gui_accent_color = color;
                    let _ = cfg.save();
                }

                if let Some(win) = ctx.tactical_console.active_window() {
                    let cfg = ctx.shared_config.lock().unwrap().clone();
                    push_snapshot_helper(win, &cfg, ctx.shared_profile, ctx.main_bms_client);
                }
            }
        }
        IpcRequest::SelectProfileFile => {
            if let Some(path) = AppTray::prompt_select_profile() {
                if let Ok(new_lp) = LoadedProfile::load_from_file(&path) {
                    ctx.tray.set_profile_name(&new_lp.profile.Name);
                    {
                        let mut cfg = ctx.shared_config.lock().unwrap();
                        cfg.profile_path = Some(path.to_string_lossy().to_string());
                        let _ = cfg.save();
                    }
                    {
                        let mut prof_guard = ctx.shared_profile.lock().unwrap();
                        *prof_guard = Some(new_lp);
                    }
                    ctx.reload_trigger.store(true, Ordering::SeqCst);

                    if let Some(win) = ctx.tactical_console.active_window() {
                        let cfg = ctx.shared_config.lock().unwrap().clone();
                        push_snapshot_helper(win, &cfg, ctx.shared_profile, ctx.main_bms_client);
                    }
                }
            }
        }
        IpcRequest::ReloadProfile => {
            let p_opt = {
                let cfg = ctx.shared_config.lock().unwrap();
                cfg.resolve_profile()
            };
            if let Some(p) = p_opt {
                if let Ok(reloaded) = LoadedProfile::load_from_file(&p) {
                    ctx.tray.set_profile_name(&reloaded.profile.Name);
                    {
                        let mut prof_guard = ctx.shared_profile.lock().unwrap();
                        *prof_guard = Some(reloaded);
                    }
                    ctx.reload_trigger.store(true, Ordering::SeqCst);
                    log::info!("Profile reloaded successfully: {:?}", p);
                }
            }
            if let Some(win) = ctx.tactical_console.active_window() {
                let cfg = ctx.shared_config.lock().unwrap().clone();
                push_snapshot_helper(win, &cfg, ctx.shared_profile, ctx.main_bms_client);
            }
        }
        IpcRequest::ResetDefaultProfile => {
            {
                let mut cfg = ctx.shared_config.lock().unwrap();
                cfg.profile_path = None;
                let _ = cfg.save();
            }
            let p_opt = {
                let cfg = ctx.shared_config.lock().unwrap();
                cfg.resolve_profile()
            };
            if let Some(p) = p_opt {
                if let Ok(reloaded) = LoadedProfile::load_from_file(&p) {
                    ctx.tray.set_profile_name(&reloaded.profile.Name);
                    {
                        let mut prof_guard = ctx.shared_profile.lock().unwrap();
                        *prof_guard = Some(reloaded);
                    }
                    ctx.reload_trigger.store(true, Ordering::SeqCst);
                    log::info!("Profile reset to default: {:?}", p);
                }
            }
            if let Some(win) = ctx.tactical_console.active_window() {
                let cfg = ctx.shared_config.lock().unwrap().clone();
                push_snapshot_helper(win, &cfg, ctx.shared_profile, ctx.main_bms_client);
            }
        }
        IpcRequest::TestVoiceAudio { phrase } => {
            let is_3d = ctx
                .main_bms_client
                .read_vibe_data()
                .map(|v| v.in_3d != 0)
                .unwrap_or(false);
            if is_3d {
                log::warn!(
                    "Audio test requested while in 3D flight: locked out to protect simulator comms."
                );
            } else if let Some(player) = ctx.audio_player {
                log::info!("Simulated voice audio test: \"{}\"", phrase);
                player.play_bytes(crate::engine::audio::LOUD_N_CLEAR_BYTES);
            }
        }
        IpcRequest::StartPttBinding => {
            log::info!("PTT binding mode requested from Tactical Console");
        }
        IpcRequest::StartMpoBinding => {
            log::info!("MPO binding mode started from Tactical Console");
            ctx.mpo_binding_active.store(true, Ordering::Relaxed);
        }
        IpcRequest::CancelMpoBinding => {
            log::info!("MPO binding mode cancelled");
            ctx.mpo_binding_active.store(false, Ordering::Relaxed);
        }
        IpcRequest::SetMpoButton { button, device } => {
            log::info!("Direct MPO button update: btn={}, dev={:?}", button, device);
            {
                let mut prof_guard = ctx.shared_profile.lock().unwrap();
                if let Some(ref mut lp) = *prof_guard {
                    lp.set_mpo_binding(button, device.as_deref(), None);
                    let _ = lp.save_to_file(&lp.profile_path);
                }
            }
            ctx.reload_trigger.store(true, Ordering::SeqCst);
            if let Some(win) = ctx.tactical_console.active_window() {
                let cfg = ctx.shared_config.lock().unwrap().clone();
                push_snapshot_helper(win, &cfg, ctx.shared_profile, ctx.main_bms_client);
            }
        }
        IpcRequest::ResetMpoBinding => {
            log::info!("Reset MPO button binding to profile default");
            {
                let mut prof_guard = ctx.shared_profile.lock().unwrap();
                if let Some(ref mut lp) = *prof_guard {
                    lp.set_mpo_binding(8, Some("F16 TQS by YGZ"), None);
                    let _ = lp.save_to_file(&lp.profile_path);
                }
            }
            ctx.reload_trigger.store(true, Ordering::SeqCst);
            if let Some(win) = ctx.tactical_console.active_window() {
                let cfg = ctx.shared_config.lock().unwrap().clone();
                push_snapshot_helper(win, &cfg, ctx.shared_profile, ctx.main_bms_client);
            }
        }
        IpcRequest::ImportMpoFromBms => {
            log::info!("Importing MPO binding from Falcon BMS configuration...");
            let bms_dir = {
                let cfg = ctx.shared_config.lock().unwrap();
                cfg.get_bms_base_dir()
            };
            if let Some(ref dir) = bms_dir {
                let bms_cfg = crate::bms::config_parser::BmsConfig::load_from_bms(dir, None)
                    .unwrap_or_default();
                let mut updated = false;
                if let Some(ref btn) = bms_cfg.mpo_button {
                    let dev_name = btn
                        .device_name
                        .as_ref()
                        .cloned()
                        .or_else(|| {
                            bms_cfg
                                .devices
                                .iter()
                                .find(|d| d.guid.eq_ignore_ascii_case(&btn.device_guid))
                                .map(|d| d.name.clone())
                        })
                        .unwrap_or_else(|| "Controller".to_string());
                    let dev_guid = if !btn.device_guid.is_empty() {
                        btn.device_guid.clone()
                    } else {
                        bms_cfg
                            .devices
                            .iter()
                            .find(|d| d.name.eq_ignore_ascii_case(&dev_name))
                            .map(|d| d.guid.clone())
                            .unwrap_or_default()
                    };
                    let mut prof_guard = ctx.shared_profile.lock().unwrap();
                    if let Some(ref mut lp) = *prof_guard {
                        lp.set_mpo_binding(btn.button_index, Some(&dev_name), Some(&dev_guid));
                        let _ = lp.save_to_file(&lp.profile_path);
                        updated = true;
                    }
                    if let Some(win) = ctx.tactical_console.active_window() {
                        win.send_event(
                            "MpoBindingCaptured",
                            &serde_json::json!({
                                "button": btn.button_index,
                                "device": dev_name,
                                "guid": dev_guid,
                                "is_key": false,
                            })
                            .to_string(),
                        );
                    }
                } else if let Some((kc, _mods)) = bms_cfg.mpo_key {
                    let key_name = format!("Key {}", kc);
                    let mut prof_guard = ctx.shared_profile.lock().unwrap();
                    if let Some(ref mut lp) = *prof_guard {
                        lp.set_mpo_key_binding(kc as u32, Some(&key_name));
                        let _ = lp.save_to_file(&lp.profile_path);
                        updated = true;
                    }
                    if let Some(win) = ctx.tactical_console.active_window() {
                        win.send_event(
                            "MpoBindingCaptured",
                            &serde_json::json!({
                                "button": kc,
                                "device": key_name,
                                "guid": "KEYBOARD",
                                "is_key": true,
                            })
                            .to_string(),
                        );
                    }
                }
                if updated {
                    ctx.reload_trigger.store(true, Ordering::SeqCst);
                    if let Some(win) = ctx.tactical_console.active_window() {
                        let cfg = ctx.shared_config.lock().unwrap().clone();
                        push_snapshot_helper(win, &cfg, ctx.shared_profile, ctx.main_bms_client);
                    }
                }
            }
        }
        IpcRequest::SetMpoKey {
            key_code,
            modifiers,
        } => {
            log::info!(
                "MPO switch hotkey updated: key={}, mods={}",
                key_code,
                modifiers
            );
            let key_name = format!("Key {}", key_code);
            {
                let mut prof_guard = ctx.shared_profile.lock().unwrap();
                if let Some(ref mut lp) = *prof_guard {
                    lp.set_mpo_key_binding(key_code, Some(&key_name));
                    let _ = lp.save_to_file(&lp.profile_path);
                }
            }
            ctx.reload_trigger.store(true, Ordering::SeqCst);
            if let Some(win) = ctx.tactical_console.active_window() {
                let cfg = ctx.shared_config.lock().unwrap().clone();
                push_snapshot_helper(win, &cfg, ctx.shared_profile, ctx.main_bms_client);
                win.send_event(
                    "MpoBindingCaptured",
                    &serde_json::json!({
                        "button": key_code,
                        "device": key_name,
                        "is_key": true,
                    })
                    .to_string(),
                );
            }
        }
        IpcRequest::OpenLogFile => {
            let log_p = AppConfig::log_file_path();
            let _ = std::process::Command::new("notepad.exe")
                .arg(&log_p)
                .spawn();
        }
        IpcRequest::OpenImagesFolder => {
            let images_path = std::path::PathBuf::from("images");
            let _ = std::fs::create_dir_all(&images_path);
            let _ = std::process::Command::new("explorer.exe")
                .arg(&images_path)
                .spawn();
        }
        IpcRequest::ToggleConsole => {
            let mut cfg = ctx.shared_config.lock().unwrap();
            let current_vis = CONSOLE_IS_VISIBLE.load(std::sync::atomic::Ordering::SeqCst);
            let new_vis = !current_vis;
            set_console_visible(new_vis);
            ctx.tray.set_console_visible(new_vis);
            cfg.show_console = new_vis;
            let _ = cfg.save();
            log::info!("Console visibility toggled via GUI to: {}", new_vis);
        }
        IpcRequest::CheckUpdates => {
            let repo = {
                let cfg = ctx.shared_config.lock().unwrap();
                cfg.github_repo.clone()
            };
            log::info!("Manual check for updates triggered via Tactical Console");
            crate::updater::spawn_update_check(repo, env!("CARGO_PKG_VERSION").to_string(), true);
        }
        IpcRequest::EditKneeboards => {
            let cfg_path = crate::kneeboard::layout::KneeboardLayoutConfig::config_path();
            if !cfg_path.exists() {
                let _ = crate::kneeboard::layout::KneeboardLayoutConfig::load_or_create_default();
            }
            log::info!("Opening kneeboards configuration from GUI: {:?}", cfg_path);
            let _ = std::process::Command::new("notepad.exe")
                .arg(&cfg_path)
                .spawn();
        }
        IpcRequest::GetConsoleLogs => {
            let log_path = AppConfig::log_file_path();
            let content = std::fs::read_to_string(&log_path)
                .unwrap_or_else(|_| "No log file found or unable to read log".to_string());
            let lines: Vec<&str> = content.lines().rev().take(60).collect();
            let mut ordered_lines: Vec<&str> = lines;
            ordered_lines.reverse();
            if let Some(win) = ctx.tactical_console.active_window() {
                let json = serde_json::json!({
                    "lines": ordered_lines,
                });
                win.send_event("ConsoleLogs", &json.to_string());
            }
        }
    }
}

fn push_snapshot_helper(
    win: &crate::gui::window::TacticalConsoleWindow,
    cfg: &AppConfig,
    shared_profile: &Arc<Mutex<Option<LoadedProfile>>>,
    bms_client: &mut BmsSharedMemoryClient,
) {
    let (prof_name, prof_path) = {
        let guard = shared_profile.lock().unwrap();
        if let Some(ref p) = *guard {
            (
                p.profile.Name.clone(),
                p.profile_path.to_string_lossy().to_string(),
            )
        } else {
            (
                "Falcon BMS 4.38 Default".to_string(),
                "Default Bundled Profile".to_string(),
            )
        }
    };
    let (mpo_button, mpo_device, _mpo_guid, mpo_is_key) = {
        let guard = shared_profile.lock().unwrap();
        if let Some(ref lp) = *guard {
            lp.get_mpo_binding()
        } else {
            (8, "F16 TQS by YGZ".to_string(), "".to_string(), false)
        }
    };
    let bms_mpo_binding = cfg.get_bms_base_dir().and_then(|dir| {
        let bms_cfg = crate::bms::config_parser::BmsConfig::load_from_bms(&dir, None).ok()?;
        bms_cfg.get_mpo_display()
    });
    let layout = crate::kneeboard::layout::KneeboardLayoutConfig::load_or_create_default();
    let assets_dir = AppConfig::find_assets_dir();
    let images_dir = assets_dir.join("images");
    let mut generated_images = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&images_dir) {
        for entry in entries.flatten() {
            if let Ok(ft) = entry.file_type() {
                if ft.is_file() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.ends_with(".png") {
                        generated_images.push(name);
                    }
                }
            }
        }
    }
    win.push_snapshot(&crate::gui::ipc::StateSnapshot {
        config: cfg.clone(),
        profile_name: prof_name,
        profile_path: prof_path,
        bms_connected: bms_client.is_connected(),
        is_3d: bms_client
            .read_vibe_data()
            .map(|v| v.in_3d != 0)
            .unwrap_or(false),
        kneeboard_slots: layout.slots,
        available_templates: get_available_templates(),
        custom_templates: AppConfig::load_custom_templates(),
        custom_stamps: AppConfig::load_custom_stamps(),
        mpo_button,
        mpo_device,
        mpo_is_key,
        bms_mpo_binding,
        custom_presets: AppConfig::load_custom_presets(),
        generated_images,
    });
}

fn get_available_templates() -> Vec<crate::gui::ipc::TemplateMetadata> {
    vec![
        crate::gui::ipc::TemplateMetadata {
            id: "fuel_planning".into(),
            name: "Fuel Flow Regimes & Cruise Planning".into(),
            category: "notes".into(),
            path: "notes/fuel_planning.md".into(),
            description: "Optimum cruise, bingo & joker computations, trapped fuel checklist"
                .into(),
            default_title: "FUEL PLANNING & CRUISE".into(),
            default_code: "T.O. 1F-16CM-1 // FUEL-OPS".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "pfl_fault_actions".into(),
            name: "Pilot Fault List (PFL) Quick Actions".into(),
            category: "notes".into(),
            path: "notes/pfl_fault_actions.md".into(),
            description: "FLCS, Engine, Hydraulic, and Avionics fault responses".into(),
            default_title: "PILOT FAULT LIST (PFL)".into(),
            default_code: "T.O. 1F-16CM-1CL-1 // PFL-OPS".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "airframe_limits".into(),
            name: "Airframe Operating Limits & G-Envelope".into(),
            category: "notes".into(),
            path: "notes/airframe_limits.md".into(),
            description: "CAT I vs CAT III G-limits, airspeed limits, stores limitations".into(),
            default_title: "AIRFRAME & G-LIMITS".into(),
            default_code: "T.O. 1F-16CM-1 // LIMITS".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "approach_speeds".into(),
            name: "Approach Speeds & Overhead Break".into(),
            category: "notes".into(),
            path: "notes/approach_speeds.md".into(),
            description: "Gross weight landing speeds, 11-13 deg AOA bracket, pattern altitudes"
                .into(),
            default_title: "APPROACH & OVERHEAD BREAK".into(),
            default_code: "T.O. 1F-16CM-1 // APPROACH".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "ep_flameout".into(),
            name: "Engine Flameout & SFO Profiles".into(),
            category: "notes".into(),
            path: "notes/ep_flameout.md".into(),
            description: "High key, low key, airstart envelope, glide performance".into(),
            default_title: "ENGINE FLAMEOUT & SFO".into(),
            default_code: "T.O. 1F-16CM-1CL-1 // EP-FLAMEOUT".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "ep_hydraulics".into(),
            name: "Hydraulic System Failures (Sys A/B)".into(),
            category: "notes".into(),
            path: "notes/ep_hydraulics.md".into(),
            description: "Loss of System A or B, EPU operation, alternate gear extension".into(),
            default_title: "HYDRAULIC SYS A/B FAILURE".into(),
            default_code: "T.O. 1F-16CM-1CL-1 // EP-HYD".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "sead_harm".into(),
            name: "SEAD / HARM ALIC Codes & Threat Matrix".into(),
            category: "notes".into(),
            path: "notes/sead_harm.md".into(),
            description: "Target table, table-of-harm, PB / HAS / POS modes, threat codes".into(),
            default_title: "SEAD / HARM PROFILES & ALIC".into(),
            default_code: "T.O. 1F-16CM-34-1-4 // SEAD".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "aa_missiles".into(),
            name: "Air-to-Air Missile Launch Envelopes".into(),
            category: "notes".into(),
            path: "notes/aa_missiles.md".into(),
            description: "AIM-120C AMRAAM and AIM-9X Sidewinder employment tactics".into(),
            default_title: "A/A WEAPONS ENVELOPE".into(),
            default_code: "T.O. 1F-16CM-34-1 // AA-WEAPONS".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "ag_precision".into(),
            name: "Air-to-Ground Precision Delivery (GBU/JDAM)".into(),
            category: "notes".into(),
            path: "notes/ag_precision.md".into(),
            description: "Laser guided bombs, JDAM LAR envelopes, laser codes, weapon release"
                .into(),
            default_title: "A/G PRECISION DELIVERY".into(),
            default_code: "T.O. 1F-16CM-34-1 // AG-PRECISION".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "ag_ballistic".into(),
            name: "Air-to-Ground Ballistic Delivery (CCIP/DTOS)".into(),
            category: "notes".into(),
            path: "notes/ag_ballistic.md".into(),
            description: "Uncontrolled ordnance release profiles, safe escape maneuvers".into(),
            default_title: "A/G BALLISTIC DELIVERY".into(),
            default_code: "T.O. 1F-16CM-34-1 // AG-BALLISTIC".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "rwr_countermeasures".into(),
            name: "RWR Symbology & Countermeasures Programs".into(),
            category: "notes".into(),
            path: "notes/rwr_countermeasures.md".into(),
            description: "Threat bands, CMDS manual / semi-auto programs 1-6".into(),
            default_title: "RWR & CMDS PROGRAMS".into(),
            default_code: "T.O. 1F-16CM-34-1 // RWR-CMDS".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "divert_airfields".into(),
            name: "Divert Airfields & Recovery Data".into(),
            category: "notes".into(),
            path: "notes/divert_airfields.md".into(),
            description: "Runway headings, length, TACAN channels, ILS localizer frequencies"
                .into(),
            default_title: "DIVERT AIRFIELDS & RECOVERY".into(),
            default_code: "FLIGHT INFO PUB // DIVERT".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "ifr_holding".into(),
            name: "IFR Holding & Penetration Turn".into(),
            category: "notes".into(),
            path: "notes/ifr_holding.md".into(),
            description: "Standard holding entry, teardrop timing, missed approach procedure"
                .into(),
            default_title: "IFR HOLDING & MISSED APP".into(),
            default_code: "FLIGHT INFO PUB // IFR-RECOVERY".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "comms_laser_matrix".into(),
            name: "Comms Ladder & Laser Codes Matrix".into(),
            category: "notes".into(),
            path: "notes/comms_laser_matrix.md".into(),
            description: "Package frequency assignments, PRF codes, flight comms ladder".into(),
            default_title: "COMMS & LASER MATRIX".into(),
            default_code: "SPINS // COMMS-MATRIX".into(),
        },
        // HTML checklists
        crate::gui::ipc::TemplateMetadata {
            id: "chk_start".into(),
            name: "Checklist 1: Engine Start & Systems Check".into(),
            category: "checklist".into(),
            path: "custom/kneeboard-checklist-1-start.html".into(),
            description: "Before start, after start, SEC/EPU test, FLCS BIT".into(),
            default_title: "CL-1: START & SYSTEMS".into(),
            default_code: "CHECKLIST // START".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "chk_taxi".into(),
            name: "Checklist 2: Taxi, Takeoff & Landing".into(),
            category: "checklist".into(),
            path: "custom/kneeboard-checklist-2-taxi-takeoff-land.html".into(),
            description: "Taxi checks, before takeoff, after takeoff, descent, landing".into(),
            default_title: "CL-2: TAXI, TAKEOFF, LAND".into(),
            default_code: "CHECKLIST // TAXI-LAND".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "chk_tacan_aar".into(),
            name: "Checklist 3: TACAN & Air-to-Air Refueling".into(),
            category: "checklist".into(),
            path: "custom/kneeboard-checklist-3-tacan-aar.html".into(),
            description: "TACAN rendezvous, pre-contact checks, disconnect, post-AAR".into(),
            default_title: "CL-3: TACAN & AAR".into(),
            default_code: "CHECKLIST // AAR".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "chk_fence".into(),
            name: "Checklist 4: Fence-In / Fence-Out".into(),
            category: "checklist".into(),
            path: "custom/kneeboard-checklist-4-fence.html".into(),
            description: "Combat area ingress checks, master arm, ECM, egress checks".into(),
            default_title: "CL-4: FENCE IN / OUT".into(),
            default_code: "CHECKLIST // FENCE".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "chk_lgb_mav".into(),
            name: "Checklist 5: LGB, Maverick & Mark Point".into(),
            category: "checklist".into(),
            path: "custom/kneeboard-checklist-5-lgb-mav-mark.html".into(),
            description: "TGP boresight, laser codes, Maverick handoff, mark point save".into(),
            default_title: "CL-5: LGB & MAVERICK".into(),
            default_code: "CHECKLIST // WEAPONS".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "threat_air".into(),
            name: "Threat Guide: Airborne Interceptors & Radars".into(),
            category: "checklist".into(),
            path: "custom/kneeboard-threats-air.html".into(),
            description: "BVR threat radars, search/track frequencies, missile ranges".into(),
            default_title: "THREATS: AIR INTERCEPTORS".into(),
            default_code: "TACTICAL // AIR-THREATS".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "threat_gnd".into(),
            name: "Threat Guide: Ground SAMs & AAA".into(),
            category: "checklist".into(),
            path: "custom/kneeboard-threats-gnd.html".into(),
            description: "SA-2 through SA-15 envelopes, radar bands, guidance types".into(),
            default_title: "THREATS: GROUND SAMS & AAA".into(),
            default_code: "TACTICAL // SAM-THREATS".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "briefing_roster".into(),
            name: "Mission Briefing: Package Roster".into(),
            category: "chart".into(),
            path: "".into(),
            description: "Dynamic mission callsigns, flight elements, IFF, laser and comms".into(),
            default_title: "PACKAGE ROSTER & COMMS".into(),
            default_code: "SPINS // ROSTER-COMMS".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "briefing_steerpoints".into(),
            name: "Mission Briefing: Steerpoints Table".into(),
            category: "chart".into(),
            path: "".into(),
            description: "Dynamic steerpoint table with TOT, speed, altitudes and coordinates"
                .into(),
            default_title: "STEERPOINTS & NAVIGATION".into(),
            default_code: "FLIGHT PLAN // NAV".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "mission_route".into(),
            name: "Mission Route Overview Map".into(),
            category: "chart".into(),
            path: "".into(),
            description: "Dynamic Mission Route 16k SkyVector Crop & Flight Polyline".into(),
            default_title: "MISSION ROUTE OVERVIEW".into(),
            default_code: "MAP // ROUTE".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "mission_target".into(),
            name: "Target & Combat Area Map".into(),
            category: "chart".into(),
            path: "".into(),
            description: "Dynamic Tactical Target / Combat Area Zoom & IP Profile".into(),
            default_title: "TARGET & COMBAT AREA MAP".into(),
            default_code: "MAP // TARGET".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "dep_taxi".into(),
            name: "Departure Airfield Ground Chart".into(),
            category: "chart".into(),
            path: "".into(),
            description: "Dynamic departure airfield taxiways, runways and parking spots".into(),
            default_title: "DEPARTURE AIRFIELD TAXI".into(),
            default_code: "AIRFIELD // TAXI".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "arr_taxi".into(),
            name: "Recovery Airfield Ground Chart".into(),
            category: "chart".into(),
            path: "".into(),
            description: "Dynamic recovery airfield taxiways, runways and parking spots".into(),
            default_title: "RECOVERY AIRFIELD TAXI".into(),
            default_code: "AIRFIELD // RECOVERY".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "arr_ils_primary".into(),
            name: "Arrival Primary ILS Approach Chart".into(),
            category: "chart".into(),
            path: "".into(),
            description: "Dynamic primary runway ILS approach plate with frequencies".into(),
            default_title: "ARRIVAL ILS APPROACH".into(),
            default_code: "APPROACH // ILS-1".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "arr_ils_secondary".into(),
            name: "Arrival Secondary ILS Approach Chart".into(),
            category: "chart".into(),
            path: "".into(),
            description: "Dynamic secondary runway ILS approach plate".into(),
            default_title: "ARRIVAL SECONDARY ILS".into(),
            default_code: "APPROACH // ILS-2".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "blank".into(),
            name: "Intentionally Left Blank Card".into(),
            category: "chart".into(),
            path: "".into(),
            description: "Intentionally Left Blank Aeronautical Card".into(),
            default_title: "INTENTIONALLY LEFT BLANK".into(),
            default_code: "BLANK".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "restore_original".into(),
            name: "Restore Original DDS Texture".into(),
            category: "chart".into(),
            path: "".into(),
            description: "Restores original Falcon BMS theater texture from backup".into(),
            default_title: "RESTORE ORIGINAL DDS".into(),
            default_code: "RESTORE // THEATER".into(),
        },
        crate::gui::ipc::TemplateMetadata {
            id: "pass_through".into(),
            name: "Pass-Through (Untouched Texture)".into(),
            category: "chart".into(),
            path: "".into(),
            description: "Leaves existing Falcon BMS theater texture completely untouched".into(),
            default_title: "PASS-THROUGH TEXTURE".into(),
            default_code: "PASS-THROUGH".into(),
        },
    ]
}

struct VoiceWorkerContext {
    running: Arc<AtomicBool>,
    profile_lock: Arc<Mutex<Option<LoadedProfile>>>,
    config_lock: Arc<Mutex<AppConfig>>,
    reload_trigger: Arc<AtomicBool>,
    proxy: tao::event_loop::EventLoopProxy<AppEvent>,
    input_lock: Arc<Mutex<crate::input::axis_sampler::InputSnapshot>>,
    ui_hardware_active: Arc<AtomicBool>,
    ui_visible: Arc<AtomicBool>,
    mpo_binding_active: Arc<AtomicBool>,
}

fn run_voice_worker_loop(ctx: VoiceWorkerContext) {
    let VoiceWorkerContext {
        running,
        profile_lock,
        config_lock,
        reload_trigger,
        proxy,
        input_lock,
        ui_hardware_active,
        ui_visible,
        mpo_binding_active,
    } = ctx;
    let mut bms_client = BmsSharedMemoryClient::new();
    let initial_voice_enabled = {
        let cfg = config_lock.lock().unwrap();
        cfg.voice_recognition
    };
    let mut sapi = if initial_voice_enabled {
        match SapiEngine::new() {
            Ok(s) => {
                log::info!("SAPI Speech Recognizer initialized successfully");
                Some(s)
            }
            Err(e) => {
                log::error!("Failed to initialize Windows SAPI Recognizer: {:?}", e);
                None
            }
        }
    } else {
        log::info!("Voice recognition disabled in configuration; skipping SAPI initialization.");
        None
    };

    let initial_gender = {
        let cfg = config_lock.lock().unwrap();
        cfg.pilot_female
    };
    let mut state_engine = StateEngine::new(initial_gender);
    let mut axis_sampler: Option<AxisSampler> = None;
    let bms_dir = BmsConfig::find_bms_directory();
    log::info!("Falcon BMS directory: {:?}", bms_dir);
    let cached_bms_cfg = bms_dir
        .as_ref()
        .and_then(|d| BmsConfig::load_from_bms(d, None).ok())
        .unwrap_or_default();
    let mut active_profile_name: Option<String> = None;
    let mut last_compiled_config: Option<Option<String>> = None;
    let mut last_compiled_strings: Option<crate::bms::shared_memory::BmsStringInfo> = None;
    let mut last_ptt_com1 = false;
    let mut last_ptt_com2 = false;
    let mut last_ptt_com1_time: Option<Instant> = None;
    let mut last_ptt_com2_time: Option<Instant> = None;
    let mut last_chief_engaged = false;
    let mut last_bms_connect_attempt = std::time::Instant::now();
    let mut last_sampler_attempt = std::time::Instant::now();
    let mut initial_chirp_played = false;
    let mut last_bms_connected = false;

    while running.load(Ordering::SeqCst) {
        let (polling_rate, voice_enabled, auto_engage) = {
            let cfg = config_lock.lock().unwrap();
            (
                cfg.polling_rate_hz.clamp(10, 100),
                cfg.voice_recognition,
                cfg.auto_engage_voice,
            )
        };
        let poll_interval = Duration::from_millis((1000 / polling_rate) as u64);

        // Check BMS shared memory connection (throttled to 1s when disconnected)
        if !bms_client.is_connected()
            && last_bms_connect_attempt.elapsed() >= Duration::from_secs(1)
        {
            last_bms_connect_attempt = Instant::now();
            if bms_client.connect() {
                log::info!("Connected to Falcon BMS Shared Memory!");
            }
        }

        let bms_conn = bms_client.is_connected();

        // Edge detection for Auto-Engage Voice Automation
        if auto_engage {
            if bms_conn && !last_bms_connected && !voice_enabled {
                log::info!(
                    "Auto-Engage: Falcon BMS detected! Automatically engaging voice recognition."
                );
                let _ = proxy.send_event(AppEvent::IpcMessage(
                    crate::gui::ipc::IpcRequest::SetVoiceRecognition { enabled: true },
                ));
            } else if !bms_conn && last_bms_connected && voice_enabled {
                log::info!(
                    "Auto-Engage: Falcon BMS closed. Automatically disengaging voice recognition."
                );
                let _ = proxy.send_event(AppEvent::IpcMessage(
                    crate::gui::ipc::IpcRequest::SetVoiceRecognition { enabled: false },
                ));
            }
        }
        last_bms_connected = bms_conn;

        let controllers_needed = voice_enabled
            || (ui_visible.load(Ordering::Relaxed) && ui_hardware_active.load(Ordering::Relaxed))
            || mpo_binding_active.load(Ordering::Relaxed);

        if !voice_enabled && sapi.is_some() {
            log::info!("Voice recognition disabled: releasing SAPI and microphone");
            sapi = None;
        }

        if !controllers_needed {
            if axis_sampler.is_some() {
                log::info!("Controllers not required: releasing DirectInput axis sampler");
                axis_sampler = None;
            }
            active_profile_name = None;
            last_compiled_config = None;
            thread::sleep(Duration::from_millis(100));
            continue;
        }

        if voice_enabled && sapi.is_none() {
            log::info!("Voice recognition enabled: initializing SAPI Recognizer...");
            sapi = match SapiEngine::new() {
                Ok(s) => {
                    log::info!("SAPI Speech Recognizer initialized successfully");
                    Some(s)
                }
                Err(e) => {
                    log::error!("Failed to initialize Windows SAPI Recognizer: {:?}", e);
                    None
                }
            };
            last_compiled_config = None;
        }

        let reload = reload_trigger.swap(false, Ordering::SeqCst);
        if reload {
            log::info!("🔄 Reload requested: resetting internal state logic");
            let pilot_female = {
                let cfg = config_lock.lock().unwrap();
                cfg.pilot_female
            };
            state_engine.reset(pilot_female);
            last_compiled_config = None;
            last_chief_engaged = false;
        }

        state_engine.set_bms_connected(bms_conn);

        if let Some(flight_data) = bms_client.read_primary_data() {
            state_engine.update_from_flight_data(&flight_data);
        }

        if let Some(vibe) = bms_client.read_vibe_data() {
            let in_3d = if vibe.in_3d != 0 { "True" } else { "False" };
            state_engine
                .variables
                .insert("In3D".to_string(), in_3d.to_string());
            let on_ground = if vibe.is_on_ground != 0 {
                "True"
            } else {
                "False"
            };
            state_engine
                .variables
                .insert("OnGround".to_string(), on_ground.to_string());
        }

        let strings = bms_client.read_string_info();
        if !strings.awacs.is_empty() {
            state_engine
                .variables
                .insert("Awacs".to_string(), strings.awacs.clone());
        } else {
            state_engine.variables.remove("Awacs");
        }
        if !strings.tanker.is_empty() {
            state_engine
                .variables
                .insert("Tanker".to_string(), strings.tanker.clone());
        } else {
            state_engine.variables.remove("Tanker");
        }
        let pkg_size: usize = strings.package_size.trim().parse().unwrap_or(0);
        if pkg_size >= 2 {
            state_engine
                .variables
                .insert("AISeat2".to_string(), "True".to_string());
        } else {
            state_engine.variables.remove("AISeat2");
        }
        if pkg_size >= 3 {
            state_engine
                .variables
                .insert("AISeat3".to_string(), "True".to_string());
        } else {
            state_engine.variables.remove("AISeat3");
        }
        if pkg_size >= 4 {
            state_engine
                .variables
                .insert("AISeat4".to_string(), "True".to_string());
        } else {
            state_engine.variables.remove("AISeat4");
        }

        // Process profile
        let profile_opt = profile_lock.lock().unwrap();
        if let Some(loaded) = profile_opt.as_ref() {
            let profile_name = &loaded.profile.Name;
            let profile_changed = active_profile_name.as_ref() != Some(profile_name) || reload;

            if profile_changed {
                active_profile_name = Some(profile_name.clone());
                log::info!("Loaded profile: {}", profile_name);

                let bms_cfg = if let Some(ref _dir) = bms_dir {
                    cached_bms_cfg.clone()
                } else {
                    BmsConfig::default()
                };
                let req_axes = loaded.extract_required_axes();
                log::info!("Required axes for this profile: {:?}", req_axes);
                match AxisSampler::new(bms_cfg, &req_axes) {
                    Ok(mut sampler) => {
                        sampler.set_mpo_binding(loaded.get_mpo_binding());
                        log::info!("DirectInput axis sampler initialized successfully");
                        axis_sampler = Some(sampler);
                    }
                    Err(e) => {
                        log::error!("Failed to initialize DirectInput axis sampler: {:?}", e);
                        axis_sampler = None;
                    }
                }
            }

            // Retry initializing DirectInput sampler if disconnected
            if axis_sampler.is_none() && last_sampler_attempt.elapsed() >= Duration::from_secs(3) {
                last_sampler_attempt = Instant::now();
                let bms_cfg = if let Some(ref dir) = bms_dir {
                    BmsConfig::load_from_bms(dir, None).unwrap_or_default()
                } else {
                    BmsConfig::default()
                };
                let req_axes = loaded.extract_required_axes();
                if let Ok(mut sampler) = AxisSampler::new(bms_cfg, &req_axes) {
                    sampler.set_mpo_binding(loaded.get_mpo_binding());
                    log::info!("DirectInput axis sampler re-connected successfully");
                    axis_sampler = Some(sampler);
                }
            }

            if profile_changed {
                if let Some(ref mut sampler) = axis_sampler {
                    sampler.set_mpo_binding(loaded.get_mpo_binding());
                }
            }

            let chief_engaged = state_engine.is_chief_engaged();
            let strings_changed = last_compiled_strings.as_ref() != Some(&strings);
            let state_changed = last_compiled_config
                != Some(state_engine.active_configuration.clone())
                || last_chief_engaged != chief_engaged
                || strings_changed;

            if profile_changed || state_changed {
                if strings_changed && last_compiled_strings.is_some() {
                    log::info!("🔄 [BMS Flight Data] Callsign or airbase updated from Falcon BMS (Callsign: \"{}\", Base: \"{}\")", strings.callsign, strings.departure);
                }
                if let Some(ref mut engine) = sapi {
                    let cfg_id = state_engine.active_configuration.as_deref();
                    match engine.compile_and_load_grammar(&loaded.profile, &strings, cfg_id) {
                        Ok(_) => {
                            log::info!(
                                "Windows SAPI Grammar active (Chief: {}, Config: {:?})",
                                chief_engaged,
                                cfg_id
                            );
                            if !initial_chirp_played || reload {
                                initial_chirp_played = true;
                                if let Some(ref player) = state_engine.audio_player {
                                    player.play_bytes(crate::engine::audio::CHIRP_BYTES);
                                }
                            }
                        }
                        Err(e) => {
                            log::error!("Failed to compile SAPI grammar: {:?}", e);
                        }
                    }
                }
                last_compiled_config = Some(state_engine.active_configuration.clone());
                last_chief_engaged = chief_engaged;
                last_compiled_strings = Some(strings.clone());
            }

            let mut ptt_com1 = false;
            let mut ptt_com2 = false;
            let mut input_vars = std::collections::HashMap::new();

            if let Some(ref mut sampler) = axis_sampler {
                let snapshot = sampler.sample();
                *input_lock.lock().unwrap() = snapshot.clone();
                ptt_com1 = snapshot.ptt_com1_pressed;
                ptt_com2 = snapshot.ptt_com2_pressed;
                input_vars = snapshot.active_variables;
            }

            if ptt_com1 != last_ptt_com1 {
                log::info!(
                    "📻 [PTT COM1 (UHF)] {}",
                    if ptt_com1 { "PRESSED" } else { "RELEASED" }
                );
                last_ptt_com1 = ptt_com1;
            }
            if ptt_com2 != last_ptt_com2 {
                log::info!(
                    "📻 [PTT COM2 (VHF)] {}",
                    if ptt_com2 { "PRESSED" } else { "RELEASED" }
                );
                last_ptt_com2 = ptt_com2;
            }

            if ptt_com1 {
                last_ptt_com1_time = Some(Instant::now());
            }
            if ptt_com2 {
                last_ptt_com2_time = Some(Instant::now());
            }

            let listening_enabled = {
                let cfg = config_lock.lock().unwrap();
                cfg.listening_enabled
            };

            if let Some(ref engine) = sapi {
                if let Some((g_idx, c_idx, text, confidence)) = engine.poll_recognition() {
                    let _ = proxy.send_event(AppEvent::SpeechRecognized {
                        text: text.clone(),
                        confidence,
                    });
                    let clean_text = text.trim().to_lowercase();

                    // System-wide Standby and Comms Check override EVERYTHING else
                    if clean_text == "stand by" || clean_text == "standby" {
                        log::info!("🛑 [Voice Command] \"{}\" -> Pausing voice recognition (System-wide Mute)", text);
                        {
                            let mut cfg = config_lock.lock().unwrap();
                            cfg.listening_enabled = false;
                            let _ = cfg.save();
                        }
                        let _ = proxy.send_event(AppEvent::ListeningChanged(false));
                        if let Some(ref player) = state_engine.audio_player {
                            player.play_system_sound(
                                "standing-by.mp3",
                                crate::engine::audio::STANDING_BY_BYTES,
                            );
                        }
                        continue;
                    } else if clean_text == "comms check" || clean_text == "radio check" {
                        let was_muted = {
                            let cfg = config_lock.lock().unwrap();
                            !cfg.listening_enabled
                        };
                        if was_muted {
                            log::info!("🎙️ [Voice Command] \"{}\" -> Resuming voice recognition (System-wide Unmute)", text);
                            {
                                let mut cfg = config_lock.lock().unwrap();
                                cfg.listening_enabled = true;
                                let _ = cfg.save();
                            }
                            let _ = proxy.send_event(AppEvent::ListeningChanged(true));
                            if let Some(ref player) = state_engine.audio_player {
                                player.play_system_sound(
                                    "loud-n-clear.mp3",
                                    crate::engine::audio::LOUD_N_CLEAR_BYTES,
                                );
                            }
                            continue;
                        } else {
                            if !state_engine.is_chief_engaged() {
                                log::info!(
                                    "🎙️ [Voice Command] \"{}\" -> Cockpit comms check acknowledged",
                                    text
                                );
                                if let Some(ref player) = state_engine.audio_player {
                                    player.play_system_sound(
                                        "loud-n-clear.mp3",
                                        crate::engine::audio::LOUD_N_CLEAR_BYTES,
                                    );
                                }
                                continue;
                            }
                            // In Chief mode, let it pass through to Group 0 command execution!
                        }
                    }

                    if !listening_enabled {
                        log::debug!("Speech \"{}\" ignored while on Standby", clean_text);
                        continue;
                    }

                    if confidence < 0.50 && confidence > 0.0 {
                        log::warn!(
                            "🎤 [Low Confidence {:.2}] Discarding ambiguous speech: \"{}\"",
                            confidence,
                            text
                        );
                        continue;
                    }

                    if let Some(group) = loaded.profile.CommandGroups.get(g_idx) {
                        let grp_name = group.Name.as_deref().unwrap_or("Command");
                        if !state_engine.is_group_active(group) {
                            log::info!("🚫 [Condition Gated] Command group [{}] is inactive under current conditions. Ignoring \"{}\"", grp_name, text);
                        } else {
                            let requires_ptt1 = group.PushToTalk.as_ref().is_some_and(|ptt| {
                                ptt.VariableInputs
                                    .iter()
                                    .any(|v| v.Name == "SimTransmitCom1")
                            });
                            let requires_ptt2 = group.PushToTalk.as_ref().is_some_and(|ptt| {
                                ptt.VariableInputs
                                    .iter()
                                    .any(|v| v.Name == "SimTransmitCom2")
                            });

                            let ptt_grace = Duration::from_millis(1500);
                            let ptt1_held = ptt_com1
                                || last_ptt_com1_time.is_some_and(|t| t.elapsed() <= ptt_grace);
                            let ptt2_held = ptt_com2
                                || last_ptt_com2_time.is_some_and(|t| t.elapsed() <= ptt_grace);

                            let ptt_allowed = if requires_ptt1 {
                                ptt1_held
                            } else if requires_ptt2 {
                                ptt2_held
                            } else {
                                true
                            };

                            let grp_name = group.Name.as_deref().unwrap_or("Command");

                            if ptt_allowed {
                                if let Some(cmd) = group.Commands.get(c_idx) {
                                    let cmd_name = cmd.Name.as_deref().unwrap_or("Unnamed");
                                    if let Some(conds) = &cmd.Conditions {
                                        if !state_engine.evaluate_condition_groups(conds) {
                                            log::info!("🚫 [Condition Gated] Command [{}] condition not met under current state. Ignoring \"{}\"", cmd_name, text);
                                            continue;
                                        }
                                    }
                                    log::info!(
                                        "🎤 Recognized speech (conf: {:.2}): \"{}\" -> [{} > {}]",
                                        confidence,
                                        text,
                                        grp_name,
                                        cmd_name
                                    );
                                    state_engine.execute_command(cmd, loaded);
                                }
                            } else {
                                let ptt_btn = if requires_ptt1 {
                                    "COM1 (UHF)"
                                } else {
                                    "COM2 (VHF)"
                                };
                                log::info!("📻 [PTT Gated] Speech \"{}\" recognized for [{}], but {} was not held", text, grp_name, ptt_btn);
                            }
                        }
                    }
                }
            }

            if voice_enabled && listening_enabled {
                state_engine.evaluate_reactive_groups(loaded, &input_vars);
            }
        }

        drop(profile_opt);
        thread::sleep(poll_interval);
    }

    log::info!("Voice worker loop stopped");
}
