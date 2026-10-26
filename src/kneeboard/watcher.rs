use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant, SystemTime};

use crate::config::AppConfig;
use crate::engine::audio::{AudioPlayer, INIT_SOUND_BYTES};
use crate::kneeboard::blank_html::generate_blank_chart_html;
use crate::kneeboard::briefing_render::render_briefing_pages;
use crate::kneeboard::crop::find_theater_base_map;
use crate::kneeboard::custom::check_and_render_custom_pages;
use crate::kneeboard::dds::{find_theater_texture_dir, merge_page_to_dds};
use crate::kneeboard::ils::find_and_render_ils_chart;
use crate::kneeboard::mission_html::{compute_mission_route_coords, generate_mission_overview_page, generate_tactical_target_page, resolve_threat_coords};
use crate::kneeboard::parser::{parse_briefing, parse_callsign_stpts};
use crate::kneeboard::renderer::render_html_to_png;
use crate::kneeboard::runways::{calculate_active_runways, find_airport, map_theater_id, TheaterDatabase};
use crate::kneeboard::taxi_html::generate_taxi_chart_html;

pub struct KneeboardWatcher;

impl KneeboardWatcher {
    pub fn spawn_loop(
        running: Arc<AtomicBool>,
        config_lock: Arc<Mutex<AppConfig>>,
        manual_trigger_rx: mpsc::Receiver<()>,
    ) -> thread::JoinHandle<()> {
        thread::spawn(move || {
            log::info!("Kneeboard Watchdog (EZWatch) background thread started");
            let mut last_mod_time: Option<SystemTime> = None;
            let mut debounce_timer: Option<Instant> = None;
            let audio_player = AudioPlayer::new().ok();

            while running.load(Ordering::SeqCst) {
                let (ezwatch_enabled, bms_dir_opt) = {
                    let cfg = config_lock.lock().unwrap();
                    (cfg.ezwatch_enabled, cfg.get_bms_base_dir())
                };

                let manual_triggered = manual_trigger_rx.try_recv().is_ok();

                if let Some(ref bms_dir) = bms_dir_opt {
                    let briefing_path = bms_dir.join("User").join("Briefings").join("briefing.txt");

                    if briefing_path.exists() {
                        if let Ok(meta) = fs::metadata(&briefing_path) {
                            if let Ok(mtime) = meta.modified() {
                                if last_mod_time != Some(mtime) {
                                    if last_mod_time.is_some() {
                                        debounce_timer = Some(Instant::now());
                                    }
                                    last_mod_time = Some(mtime);
                                }
                            }
                        }
                    }

                    let should_auto_run = if let Some(timer) = debounce_timer {
                        if timer.elapsed() >= Duration::from_millis(750) {
                            debounce_timer = None;
                            ezwatch_enabled
                        } else {
                            false
                        }
                    } else {
                        false
                    };

                    if manual_triggered || should_auto_run {
                        log::info!("📋 [EZWatch] Briefing change triggered! Regenerating kneeboards in pure Rust...");
                        let start = Instant::now();
                        let cfg = config_lock.lock().unwrap().clone();
                        Self::execute_pipeline(&cfg, bms_dir, audio_player.as_ref());
                        log::info!("✅ [EZWatch] Kneeboards successfully updated in {:.2}s", start.elapsed().as_secs_f32());
                    }
                }

                thread::sleep(Duration::from_millis(250));
            }

            log::info!("Kneeboard Watchdog thread stopped");
        })
    }

    pub fn execute_pipeline(config: &AppConfig, bms_dir: &Path, audio_opt: Option<&AudioPlayer>) {
        let assets_dir = AppConfig::find_assets_dir();
        let (theater_name, callsign) = AppConfig::get_bms_registry_info();
        log::info!("Active Theater: {} | Pilot Callsign: {}", theater_name, callsign);

        let texture_dir = match find_theater_texture_dir(bms_dir, &theater_name) {
            Some(td) => td,
            None => {
                log::error!("Could not locate theater texture directory in BMS installation");
                return;
            }
        };

        let briefing_txt = bms_dir.join("User").join("Briefings").join("briefing.txt");
        let callsign_ini = bms_dir.join("User").join("Config").join(format!("{}.ini", callsign));

        let bin_dir = assets_dir.join("bin");
        let wkhtmltoimage_path = bin_dir.join("wkhtmltoimage.exe");
        let xbrief_path = bin_dir.join("xbrief.exe");

        let work_dir = assets_dir.join("work");
        let images_dir = assets_dir.join("images");
        let _ = fs::create_dir_all(&work_dir);
        let _ = fs::create_dir_all(&images_dir);

        // =========================================================================
        // 1. Static Custom Checklists & Threats (7 HTML Pages) with MD5 Caching
        // =========================================================================
        log::info!("Checking and updating custom checklist pages...");
        let _custom_tasks = check_and_render_custom_pages(&assets_dir, &wkhtmltoimage_path, false);
        let custom_slots = [
            ("F16_2L", "checklist-1.png", "Checklist 1 Start"),
            ("F16_2R", "threats-air.png", "Threats Air Reference"),
            ("F16_3L", "checklist-2.png", "Checklist 2 Taxi/TO/Land"),
            ("F16_3R", "threats-gnd.png", "Threats Ground SAM Reference"),
            ("F16_4L", "checklist-3.png", "Checklist 3 TACAN/AAR"),
            ("F16_5L", "checklist-4.png", "Checklist 4 Fence In/Out"),
            ("F16_6L", "checklist-5.png", "Checklist 5 LGB/Mav/Mark"),
        ];
        for (slot, png_file, desc) in &custom_slots {
            let png_path = images_dir.join(png_file);
            if png_path.exists() {
                if let Ok(img) = image::open(&png_path) {
                    let _ = merge_page_to_dds(&texture_dir, slot, &img.to_rgba8());
                    log::info!("Merged {}: {}", slot, desc);
                }
            }
        }

        // =========================================================================
        // 2. Briefing Pages (Roster & Steerpoints) via xbrief.exe -> wkhtmltoimage
        // =========================================================================
        if briefing_txt.exists() {
            log::info!("Generating briefing pages via xbrief.exe & wkhtmltoimage...");
            match render_briefing_pages(&assets_dir, &xbrief_path, &wkhtmltoimage_path, &briefing_txt, Some(&callsign_ini)) {
                Ok(res) => {
                    if let Ok(img1) = image::open(&res.page_1_png) {
                        let _ = merge_page_to_dds(&texture_dir, "F16_1L", &img1.to_rgba8());
                        log::info!("Merged F16_1L: Briefing Page 1 (Roster & Comms)");
                    }
                    if let Ok(img2) = image::open(&res.page_2_png) {
                        let _ = merge_page_to_dds(&texture_dir, "F16_1R", &img2.to_rgba8());
                        log::info!("Merged F16_1R: Briefing Page 2 (Steerpoints & Weather)");
                    }
                }
                Err(e) => {
                    log::error!("Failed to generate briefing pages: {}", e);
                }
            }
        }

        // =========================================================================
        // 3. Theater Database & Briefing Data Loading
        // =========================================================================
        let db = TheaterDatabase::load(&assets_dir, &theater_name);
        let mut b_data = parse_briefing(&briefing_txt).unwrap_or_default();
        let callsign_stpts = parse_callsign_stpts(&callsign_ini);

        let dep_name = b_data.dep_name.clone().unwrap_or_else(|| "Gimhae".to_string());
        let arr_name = b_data.arr_name.clone().unwrap_or_else(|| "Gimhae".to_string());

        let dep_ap = db.as_ref().and_then(|d| find_airport(&d.airports, &dep_name));
        let arr_ap = db.as_ref().and_then(|d| find_airport(&d.airports, &arr_name));

        let dep_xy = dep_ap.map(|a| (a.x, a.y));
        let arr_xy = arr_ap.map(|a| (a.x, a.y));
        b_data.steerpoints = compute_mission_route_coords(&b_data.steerpoints, dep_xy, arr_xy, Some(&callsign_stpts));

        let th_id = map_theater_id(&theater_name);
        let th_size = db.as_ref()
            .and_then(|d| d.theater_entry.get("sizeFt").and_then(|v| v.as_f64()))
            .unwrap_or(3358700.0);
        let map_id = db.as_ref()
            .and_then(|d| d.theater_entry.get("mapId").and_then(|v| v.as_str()))
            .unwrap_or("korea");

        let data_dir = assets_dir.join("data");
        let base_map = find_theater_base_map(th_id, bms_dir, &data_dir, map_id);
        log::info!("Base map resolved: {:?}", base_map);

        let geo_file = data_dir.join("geo").join(format!("{}.json", map_id));
        let resolved_threats = resolve_threat_coords(&b_data.threats, &geo_file);

        // =========================================================================
        // 4. Mission Route Overview Map (F16_4R -> 7985.dds)
        // =========================================================================
        if let Some(ref map_path) = base_map {
            let route_png = images_dir.join("mission_route.png");
            match generate_mission_overview_page(&b_data, &b_data.steerpoints, &resolved_threats, th_size, map_path, &work_dir, &route_png, &wkhtmltoimage_path) {
                Ok(_) => {
                    if let Ok(img) = image::open(&route_png) {
                        let _ = merge_page_to_dds(&texture_dir, "F16_4R", &img.to_rgba8());
                        log::info!("Rendered and merged F16_4R: Mission Route Overview");
                    }
                }
                Err(e) => {
                    log::error!("Failed to generate mission overview map: {}", e);
                }
            }
        }

        // =========================================================================
        // 5. Tactical Target Area Map (F16_5R -> 7986.dds)
        // =========================================================================
        if let Some(ref map_path) = base_map {
            let target_png = images_dir.join("mission_target.png");
            match generate_tactical_target_page(&b_data, &b_data.steerpoints, &resolved_threats, th_size, map_path, &work_dir, &target_png, &wkhtmltoimage_path) {
                Ok(_) => {
                    if let Ok(img) = image::open(&target_png) {
                        let _ = merge_page_to_dds(&texture_dir, "F16_5R", &img.to_rgba8());
                        log::info!("Rendered and merged F16_5R: Tactical Target / Combat Area");
                    }
                }
                Err(e) => {
                    log::error!("Failed to generate tactical target map: {}", e);
                }
            }
        }

        // =========================================================================
        // 6. Departure Ground Taxi Chart (F16_6R -> 7987.dds)
        // =========================================================================
        let dep_active = if let Some(dep) = dep_ap {
            calculate_active_runways(dep, b_data.takeoff_wind_deg, b_data.takeoff_wind_kts)
        } else {
            Vec::new()
        };

        let dep_af = db.as_ref().and_then(|d| dep_ap.and_then(|ap| d.load_airfield_model(&assets_dir, &ap.id)));
        let dep_png = images_dir.join("dep_gnd.png");

        if let (Some(dep), Some(af)) = (dep_ap, dep_af.as_ref()) {
            let dep_html = work_dir.join("dep_gnd.html");
            let html = generate_taxi_chart_html(dep, af, &dep_active, b_data.takeoff_wind_deg, b_data.takeoff_wind_kts, true);
            if fs::write(&dep_html, html).is_ok() {
                if render_html_to_png(&wkhtmltoimage_path, &dep_html, &dep_png).is_ok() {
                    if let Ok(img) = image::open(&dep_png) {
                        let _ = merge_page_to_dds(&texture_dir, "F16_6R", &img.to_rgba8());
                        log::info!("Rendered and merged F16_6R: Departure Ground Taxi Chart ({})", dep.name);
                    }
                }
            }
        } else {
            let blank_html = work_dir.join("dep_gnd_blank.html");
            let html = generate_blank_chart_html(&dep_name, "AIRFIELD MODEL NOT AVAILABLE");
            if fs::write(&blank_html, html).is_ok() {
                if render_html_to_png(&wkhtmltoimage_path, &blank_html, &dep_png).is_ok() {
                    if let Ok(img) = image::open(&dep_png) {
                        let _ = merge_page_to_dds(&texture_dir, "F16_6R", &img.to_rgba8());
                        log::info!("Rendered blank F16_6R: Departure Airfield Model Not Available ({})", dep_name);
                    }
                }
            }
        }

        // =========================================================================
        // 7. Arrival Primary ILS Approach Plate (F16_7R -> 7988.dds)
        // =========================================================================
        let arr_active = if let Some(arr) = arr_ap {
            calculate_active_runways(arr, b_data.landing_wind_deg, b_data.landing_wind_kts)
        } else {
            Vec::new()
        };

        let mut ils_rendered = false;
        let arr_ils_png = images_dir.join("arr_ils.png");

        // Load raw charts.json for fallback lookups
        let charts_json_raw: serde_json::Value = fs::read_to_string(data_dir.join("charts.json"))
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or(serde_json::Value::Null);

        if let Some(arr) = arr_ap {
            if let Some(primary_end) = arr_active.first() {
                if find_and_render_ils_chart(arr, primary_end, &assets_dir, &charts_json_raw, &arr_ils_png) {
                    if let Ok(img) = image::open(&arr_ils_png) {
                        let _ = merge_page_to_dds(&texture_dir, "F16_7R", &img.to_rgba8());
                        ils_rendered = true;
                        log::info!("Rendered and merged F16_7R: ARR ILS RWY {} ({})", primary_end.designator, arr.name);
                    }
                }
            }
        }

        if !ils_rendered {
            let blank_html = work_dir.join("arr_ils_blank.html");
            let blank_png = images_dir.join("arr_ils_blank.png");
            let html = generate_blank_chart_html(&arr_name, "ILS APPROACH CHARTS NOT AVAILABLE");
            if fs::write(&blank_html, html).is_ok() {
                if render_html_to_png(&wkhtmltoimage_path, &blank_html, &blank_png).is_ok() {
                    if let Ok(img) = image::open(&blank_png) {
                        let _ = merge_page_to_dds(&texture_dir, "F16_7R", &img.to_rgba8());
                        log::info!("Rendered blank F16_7R: ARR ILS Not Available ({})", arr_name);
                    }
                }
            }
        }

        // =========================================================================
        // 8. Arrival Secondary ILS or Blank (F16_8R -> 7989.dds)
        // =========================================================================
        let mut sec_ils_rendered = false;
        let sec_ils_png = images_dir.join("arr_ils_sec.png");

        if let Some(arr) = arr_ap {
            if arr_active.len() > 1 {
                let sec_end = &arr_active[1];
                if sec_end.has_ils {
                    if find_and_render_ils_chart(arr, sec_end, &assets_dir, &charts_json_raw, &sec_ils_png) {
                        if let Ok(img) = image::open(&sec_ils_png) {
                            let _ = merge_page_to_dds(&texture_dir, "F16_8R", &img.to_rgba8());
                            sec_ils_rendered = true;
                            log::info!("Rendered and merged F16_8R: ARR Secondary ILS RWY {} ({})", sec_end.designator, arr.name);
                        }
                    }
                }
            }
        }

        if !sec_ils_rendered {
            let blank_html = work_dir.join("sec_ils_blank.html");
            let blank_png = images_dir.join("sec_ils_blank.png");
            let html = generate_blank_chart_html(&arr_name, "ILS APPROACH CHARTS NOT AVAILABLE");
            if fs::write(&blank_html, html).is_ok() {
                if render_html_to_png(&wkhtmltoimage_path, &blank_html, &blank_png).is_ok() {
                    if let Ok(img) = image::open(&blank_png) {
                        let _ = merge_page_to_dds(&texture_dir, "F16_8R", &img.to_rgba8());
                        log::info!("Rendered blank F16_8R: Secondary ILS Not Available ({})", arr_name);
                    }
                }
            }
        }

        // =========================================================================
        // 9. Recovery Ground Taxi Chart (F16_9R -> 7990.dds)
        // =========================================================================
        let arr_af = db.as_ref().and_then(|d| arr_ap.and_then(|ap| d.load_airfield_model(&assets_dir, &ap.id)));
        let arr_png = images_dir.join("arr_gnd.png");

        if let (Some(arr), Some(af)) = (arr_ap, arr_af.as_ref()) {
            let arr_html = work_dir.join("arr_gnd.html");
            let html = generate_taxi_chart_html(arr, af, &arr_active, b_data.landing_wind_deg, b_data.landing_wind_kts, false);
            if fs::write(&arr_html, html).is_ok() {
                if render_html_to_png(&wkhtmltoimage_path, &arr_html, &arr_png).is_ok() {
                    if let Ok(img) = image::open(&arr_png) {
                        let _ = merge_page_to_dds(&texture_dir, "F16_9R", &img.to_rgba8());
                        log::info!("Rendered and merged F16_9R: Recovery Ground Taxi Chart ({})", arr.name);
                    }
                }
            }
        } else {
            let blank_html = work_dir.join("arr_gnd_blank.html");
            let html = generate_blank_chart_html(&arr_name, "AIRFIELD MODEL NOT AVAILABLE");
            if fs::write(&blank_html, html).is_ok() {
                if render_html_to_png(&wkhtmltoimage_path, &blank_html, &arr_png).is_ok() {
                    if let Ok(img) = image::open(&arr_png) {
                        let _ = merge_page_to_dds(&texture_dir, "F16_9R", &img.to_rgba8());
                        log::info!("Rendered blank F16_9R: Recovery Airfield Model Not Available ({})", arr_name);
                    }
                }
            }
        }

        // =========================================================================
        // 10. Apply Any User Custom Slot Overrides from Config
        // =========================================================================
        for (custom_slot, path_str) in &config.custom_slots {
            let p = PathBuf::from(path_str);
            if p.exists() {
                if let Ok(reader) = image::ImageReader::open(&p) {
                    if let Ok(c_img) = reader.decode() {
                        let _ = merge_page_to_dds(&texture_dir, custom_slot, &c_img.to_rgba8());
                    }
                }
            }
        }

        // =========================================================================
        // 11. Play Completion Audio Cue
        // =========================================================================
        if config.play_sound_on_update {
            if let Some(audio) = audio_opt {
                audio.play_system_sound("init.mp3", INIT_SOUND_BYTES);
            }
        }
    }
}
