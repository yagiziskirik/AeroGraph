#![windows_subsystem = "windows"]

pub mod config;
pub mod fvx;
pub mod bms;
pub mod input;
pub mod speech;
pub mod engine;
pub mod kneeboard;
pub mod tray;

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tao::event::Event;
use tao::event_loop::{ControlFlow, EventLoopBuilder};
use tray_icon::menu::MenuEvent;

use crate::config::AppConfig;
use crate::fvx::loader::LoadedProfile;
use crate::bms::config_parser::BmsConfig;
use crate::bms::shared_memory::BmsSharedMemoryClient;
use crate::input::axis_sampler::AxisSampler;
use crate::speech::sapi::SapiEngine;
use crate::engine::state::StateEngine;
use crate::kneeboard::watcher::KneeboardWatcher;
use crate::tray::app_tray::AppTray;

use windows::Win32::Foundation::BOOL;
use windows::Win32::System::Console::{
    AllocConsole, GetConsoleMode, GetConsoleWindow, GetStdHandle, SetConsoleCtrlHandler,
    SetConsoleMode, CONSOLE_MODE, CTRL_CLOSE_EVENT, ENABLE_EXTENDED_FLAGS,
    ENABLE_QUICK_EDIT_MODE, STD_INPUT_HANDLE,
};
use windows::Win32::UI::WindowsAndMessaging::{ShowWindow, SW_HIDE, SW_SHOW};

struct DualLogger {
    file: Mutex<Option<std::fs::File>>,
}

impl log::Log for DualLogger {
    fn enabled(&self, metadata: &log::Metadata) -> bool {
        metadata.level() <= log::Level::Info
    }

    fn log(&self, record: &log::Record) {
        if self.enabled(record.metadata()) {
            let msg = format!(
                "[{}] {}: {}\n",
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
        // Intercept clicking 'X' on console: do NOT terminate AeroGraph, only hide console!
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
                        let _ = SetConsoleMode(handle, CONSOLE_MODE((mode.0 & !ENABLE_QUICK_EDIT_MODE.0) | ENABLE_EXTENDED_FLAGS.0));
                    }
                }

                let cons_hwnd = GetConsoleWindow();
                if !cons_hwnd.0.is_null() {
                    let h_menu = windows::Win32::UI::WindowsAndMessaging::GetSystemMenu(cons_hwnd, false);
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

    // Check CLI flags for manual regeneration
    let args: Vec<String> = std::env::args().collect();
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
        use windows::Win32::System::Threading::CreateMutexW;
        use windows::Win32::Foundation::{GetLastError, ERROR_ALREADY_EXISTS};
        use windows::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONWARNING, MB_OK};

        let mutex_name = windows::core::w!("AeroGraph_Single_Instance_Mutex");
        let handle = CreateMutexW(None, true, mutex_name).ok();
        if GetLastError() == ERROR_ALREADY_EXISTS {
            log::warn!("Another instance of AeroGraph is already running. Exiting.");
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
        use windows::Win32::System::Threading::{GetCurrentProcess, SetPriorityClass, ABOVE_NORMAL_PRIORITY_CLASS};
        let _ = SetPriorityClass(GetCurrentProcess(), ABOVE_NORMAL_PRIORITY_CLASS);
    }

    let mut config = AppConfig::load();
    log::info!("Configuration loaded (Polling rate: {} Hz | EZWatch: {})", config.polling_rate_hz, config.ezwatch_enabled);

    if config.show_console {
        set_console_visible(true);
    }

    // 1. Locate or resolve FoxVox profile (.fvx)
    let mut profile_path = config.resolve_profile();
    if profile_path.is_none() {
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

    let profile_name = loaded_profile.as_ref().map(|p| p.profile.Name.clone()).unwrap_or_else(|| "None".to_string());
    let autostart_enabled = AppConfig::is_auto_start_enabled();

    // 2. Initialize Tao event loop & System Tray
    let event_loop = EventLoopBuilder::new().build();
    let tray = AppTray::new(
        &profile_name,
        config.pilot_female,
        config.listening_enabled,
        config.ezwatch_enabled,
        autostart_enabled,
        config.show_console,
    )?;
    log::info!("AeroGraph system tray icon initialized");

    let running = Arc::new(AtomicBool::new(true));
    let r_voice = running.clone();
    let r_watcher = running.clone();

    // 3. Shared state
    let shared_profile = Arc::new(Mutex::new(loaded_profile));
    let shared_config = Arc::new(Mutex::new(config.clone()));
    let reload_trigger = Arc::new(AtomicBool::new(false));

    let (manual_trigger_tx, manual_trigger_rx) = mpsc::channel::<()>();

    // 4. Spawn background voice engine thread
    let v_profile = shared_profile.clone();
    let v_config = shared_config.clone();
    let v_reload = reload_trigger.clone();

    thread::spawn(move || {
        run_voice_worker_loop(r_voice, v_profile, v_config, v_reload);
    });

    // 5. Spawn background EZWatch kneeboard thread
    let w_config = shared_config.clone();

    KneeboardWatcher::spawn_loop(r_watcher, w_config, manual_trigger_rx);

    // 6. Run Tray Event Loop on main thread
    let menu_channel = MenuEvent::receiver();
    let mut last_tray_listening = config.listening_enabled;

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::WaitUntil(std::time::Instant::now() + Duration::from_millis(50));

        if let Event::NewEvents(_) = event {
            // Keep tray menu in sync if listening was toggled via voice ("stand by" / "radio check")
            let current_listening = {
                let cfg = shared_config.lock().unwrap();
                cfg.listening_enabled
            };
            if current_listening != last_tray_listening {
                tray.set_listening_active(current_listening);
                last_tray_listening = current_listening;
            }

            while let Ok(menu_event) = menu_channel.try_recv() {
                if menu_event.id == tray.item_exit.id() {
                    log::info!("Exit requested from tray menu");
                    running.store(false, Ordering::SeqCst);
                    *control_flow = ControlFlow::Exit;
                    return;
                } else if menu_event.id == tray.item_listening.id() {
                    let mut cfg = shared_config.lock().unwrap();
                    cfg.listening_enabled = !cfg.listening_enabled;
                    tray.set_listening_active(cfg.listening_enabled);
                    last_tray_listening = cfg.listening_enabled;
                    let _ = cfg.save();
                    log::info!("Listening set to: {}", if cfg.listening_enabled { "Active" } else { "Muted" });
                } else if menu_event.id == tray.item_ezwatch.id() {
                    let mut cfg = shared_config.lock().unwrap();
                    cfg.ezwatch_enabled = !cfg.ezwatch_enabled;
                    tray.set_ezwatch_enabled(cfg.ezwatch_enabled);
                    let _ = cfg.save();
                    log::info!("EZWatch auto-generation set to: {}", cfg.ezwatch_enabled);
                } else if menu_event.id == tray.item_regen_now.id() {
                    log::info!("Manual kneeboard regeneration requested from tray menu");
                    let _ = manual_trigger_tx.send(());
                } else if menu_event.id == tray.item_open_images.id() {
                    let images_path = PathBuf::from("images");
                    let _ = std::fs::create_dir_all(&images_path);
                    let _ = std::process::Command::new("explorer.exe").arg(&images_path).spawn();
                } else if menu_event.id == tray.item_autostart.id() {
                    let cur_auto = AppConfig::is_auto_start_enabled();
                    let new_auto = !cur_auto;
                    let _ = AppConfig::set_auto_start_enabled(new_auto);
                    tray.set_autostart_enabled(new_auto);
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
                } else if menu_event.id == tray.item_open_log.id() {
                    let log_p = AppConfig::log_file_path();
                    let _ = std::process::Command::new("notepad.exe").arg(&log_p).spawn();
                } else if menu_event.id == tray.item_gender.id() {
                    let mut cfg = shared_config.lock().unwrap();
                    cfg.pilot_female = !cfg.pilot_female;
                    tray.set_gender(cfg.pilot_female);
                    let _ = cfg.save();
                    log::info!("Pilot gender set to: {}", if cfg.pilot_female { "Female" } else { "Male" });
                    reload_trigger.store(true, Ordering::SeqCst);
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
        }
    });
}

fn run_voice_worker_loop(
    running: Arc<AtomicBool>,
    profile_lock: Arc<Mutex<Option<LoadedProfile>>>,
    config_lock: Arc<Mutex<AppConfig>>,
    reload_trigger: Arc<AtomicBool>,
) {
    let mut bms_client = BmsSharedMemoryClient::new();
    let mut sapi = match SapiEngine::new() {
        Ok(s) => {
            log::info!("SAPI Speech Recognizer initialized successfully");
            Some(s)
        }
        Err(e) => {
            log::error!("Failed to initialize Windows SAPI Recognizer: {:?}", e);
            None
        }
    };
    let initial_gender = {
        let cfg = config_lock.lock().unwrap();
        cfg.pilot_female
    };
    let mut state_engine = StateEngine::new(initial_gender);
    let mut axis_sampler: Option<AxisSampler> = None;
    let bms_dir = BmsConfig::find_bms_directory();
    log::info!("Falcon BMS directory: {:?}", bms_dir);
    let mut active_profile_name: Option<String> = None;
    let mut last_compiled_config: Option<Option<String>> = None;
    let mut last_ptt_com1 = false;
    let mut last_ptt_com2 = false;
    let mut last_ptt_com1_time: Option<Instant> = None;
    let mut last_ptt_com2_time: Option<Instant> = None;
    let mut last_chief_engaged = false;
    let mut last_bms_connect_attempt = std::time::Instant::now();
    let mut last_sampler_attempt = std::time::Instant::now();
    let mut initial_chirp_played = false;

    while running.load(Ordering::SeqCst) {
        let polling_rate = {
            let cfg = config_lock.lock().unwrap();
            cfg.polling_rate_hz.clamp(10, 100)
        };
        let poll_interval = Duration::from_millis((1000 / polling_rate) as u64);

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

        // Check BMS shared memory connection (throttled to 1s when disconnected)
        if !bms_client.is_connected() {
            if last_bms_connect_attempt.elapsed() >= Duration::from_secs(1) {
                last_bms_connect_attempt = Instant::now();
                if bms_client.connect() {
                    log::info!("Connected to Falcon BMS Shared Memory!");
                }
            }
        }

        let bms_conn = bms_client.is_connected();
        state_engine.set_bms_connected(bms_conn);

        if let Some(flight_data) = bms_client.read_primary_data() {
            state_engine.update_from_flight_data(&flight_data);
        }

        if let Some(vibe) = bms_client.read_vibe_data() {
            if vibe.in_3d != 0 {
                state_engine.variables.insert("In3D".to_string(), "True".to_string());
            }
        }

        let strings = bms_client.read_string_info();

        // Process profile
        let profile_opt = profile_lock.lock().unwrap();
        if let Some(loaded) = profile_opt.as_ref() {
            let profile_name = &loaded.profile.Name;
            let profile_changed = active_profile_name.as_ref() != Some(profile_name) || reload;

            if profile_changed {
                active_profile_name = Some(profile_name.clone());
                log::info!("Loaded profile: {}", profile_name);

                if let Some(ref dir) = bms_dir {
                    let bms_cfg = BmsConfig::load_from_bms(dir, None).unwrap_or_default();
                    let req_axes = loaded.extract_required_axes();
                    log::info!("Required axes for this profile: {:?}", req_axes);
                    match AxisSampler::new(bms_cfg, &req_axes) {
                        Ok(sampler) => {
                            log::info!("DirectInput axis sampler initialized successfully");
                            axis_sampler = Some(sampler);
                        }
                        Err(e) => {
                            log::error!("Failed to initialize DirectInput axis sampler: {:?}", e);
                            axis_sampler = None;
                        }
                    }
                }
            }

            // Retry initializing DirectInput sampler if disconnected
            if axis_sampler.is_none() && last_sampler_attempt.elapsed() >= Duration::from_secs(3) {
                last_sampler_attempt = Instant::now();
                if let Some(ref dir) = bms_dir {
                    let bms_cfg = BmsConfig::load_from_bms(dir, None).unwrap_or_default();
                    let req_axes = loaded.extract_required_axes();
                    if let Ok(sampler) = AxisSampler::new(bms_cfg, &req_axes) {
                        log::info!("DirectInput axis sampler re-connected successfully");
                        axis_sampler = Some(sampler);
                    }
                }
            }

            let chief_engaged = state_engine.is_chief_engaged();
            let state_changed = last_compiled_config != Some(state_engine.active_configuration.clone())
                || last_chief_engaged != chief_engaged;

            if profile_changed || state_changed {
                if let Some(ref mut engine) = sapi {
                    let cfg_id = state_engine.active_configuration.as_deref();
                    match engine.compile_and_load_grammar(&loaded.profile, &strings, cfg_id) {
                        Ok(_) => {
                            log::info!("Windows SAPI Grammar active (Chief: {}, Config: {:?})", chief_engaged, cfg_id);
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
            }

            let mut ptt_com1 = false;
            let mut ptt_com2 = false;
            let mut input_vars = std::collections::HashMap::new();

            if let Some(ref mut sampler) = axis_sampler {
                let snapshot = sampler.sample();
                ptt_com1 = snapshot.ptt_com1_pressed;
                ptt_com2 = snapshot.ptt_com2_pressed;
                input_vars = snapshot.active_variables;
            }

            if ptt_com1 != last_ptt_com1 {
                log::info!("📻 [PTT COM1 (UHF)] {}", if ptt_com1 { "PRESSED" } else { "RELEASED" });
                last_ptt_com1 = ptt_com1;
            }
            if ptt_com2 != last_ptt_com2 {
                log::info!("📻 [PTT COM2 (VHF)] {}", if ptt_com2 { "PRESSED" } else { "RELEASED" });
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
                engine.set_active(true);

                if let Some((g_idx, c_idx, text, confidence)) = engine.poll_recognition() {
                    let clean_text = text.trim().to_lowercase();

                    if clean_text == "stand by" {
                        log::info!("🛑 [Voice Command] \"Stand by\" -> Pausing voice recognition");
                        {
                            let mut cfg = config_lock.lock().unwrap();
                            cfg.listening_enabled = false;
                            let _ = cfg.save();
                        }
                        if let Some(ref player) = state_engine.audio_player {
                            player.play_system_sound("standing-by.mp3", crate::engine::audio::STANDING_BY_BYTES);
                        }
                        continue;
                    } else if clean_text == "radio check" {
                        log::info!("🎙️ [Voice Command] \"Radio check\" -> Resuming voice recognition");
                        {
                            let mut cfg = config_lock.lock().unwrap();
                            cfg.listening_enabled = true;
                            let _ = cfg.save();
                        }
                        if let Some(ref player) = state_engine.audio_player {
                            player.play_system_sound("loud-n-clear.mp3", crate::engine::audio::LOUD_N_CLEAR_BYTES);
                        }
                        continue;
                    }

                    if !listening_enabled {
                        log::debug!("Speech \"{}\" ignored while on Standby", clean_text);
                        continue;
                    }

                    if confidence < 0.50 && confidence > 0.0 {
                        log::warn!("🎤 [Low Confidence {:.2}] Discarding ambiguous speech: \"{}\"", confidence, text);
                        continue;
                    }

                    if let Some(group) = loaded.profile.CommandGroups.get(g_idx) {
                        if !state_engine.is_group_active(group) {
                            log::debug!("Ignoring command from inactive group: {:?}", group.Name);
                        } else {
                            let requires_ptt1 = group.PushToTalk.as_ref().map_or(false, |ptt| {
                                ptt.VariableInputs.iter().any(|v| v.Name == "SimTransmitCom1")
                            });
                            let requires_ptt2 = group.PushToTalk.as_ref().map_or(false, |ptt| {
                                ptt.VariableInputs.iter().any(|v| v.Name == "SimTransmitCom2")
                            });

                            let ptt_grace = Duration::from_millis(1500);
                            let ptt1_held = ptt_com1 || last_ptt_com1_time.map_or(false, |t| t.elapsed() <= ptt_grace);
                            let ptt2_held = ptt_com2 || last_ptt_com2_time.map_or(false, |t| t.elapsed() <= ptt_grace);

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
                                    log::info!("🎤 Recognized speech (conf: {:.2}): \"{}\" -> [{} > {}]", confidence, text, grp_name, cmd_name);
                                    state_engine.execute_command(cmd, loaded);
                                }
                            } else {
                                let ptt_btn = if requires_ptt1 { "COM1 (UHF)" } else { "COM2 (VHF)" };
                                log::info!("📻 [PTT Gated] Speech \"{}\" recognized for [{}], but {} was not held", text, grp_name, ptt_btn);
                            }
                        }
                    }
                }
            }

            if listening_enabled {
                state_engine.evaluate_reactive_groups(loaded, &input_vars);
            }
        }

        drop(profile_opt);
        thread::sleep(poll_interval);
    }

    log::info!("Voice worker loop stopped");
}
