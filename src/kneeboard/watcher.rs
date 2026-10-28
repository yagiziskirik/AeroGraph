use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use image::RgbaImage;

use crate::config::AppConfig;
use crate::engine::audio::AudioPlayer;
use crate::kneeboard::blank_html::generate_blank_chart_html;
use crate::kneeboard::briefing_render::render_briefing_pages;
use crate::kneeboard::crop::{crop_theater_map_dual, find_theater_base_map};
use crate::kneeboard::custom::check_and_render_custom_pages;
use crate::kneeboard::dds::{find_theater_texture_dir, merge_texture_pair_to_dds, restore_original_texture};
use crate::kneeboard::ils::find_and_render_ils_chart;
use crate::kneeboard::layout::{KneeboardLayoutConfig, KneeboardPageType};
use crate::kneeboard::mission_html::{
    compute_mission_route_coords, compute_route_crop_box, compute_target_crop_box,
    generate_mission_overview_html, generate_tactical_target_html, resolve_threat_coords,
};
use crate::kneeboard::parser::{parse_briefing, parse_callsign_stpts};
use crate::kneeboard::renderer::{render_html_batch_parallel, render_html_to_png};
use crate::kneeboard::runways::{calculate_active_runways, find_airport, map_theater_id, TheaterDatabase};
use crate::kneeboard::taxi_html::generate_taxi_chart_html;

pub struct KneeboardWatcher;

impl KneeboardWatcher {
    /// Spawns the background KneeboardWatcher thread.
    pub fn spawn_loop(
        running: Arc<AtomicBool>,
        config: Arc<std::sync::Mutex<AppConfig>>,
        manual_rx: std::sync::mpsc::Receiver<()>,
    ) {
        thread::spawn(move || {
            Self::start_watcher(config, running, manual_rx, None);
        });
    }

    /// Background watcher thread that checks briefing.txt modification time.
    pub fn start_watcher(
        config: Arc<std::sync::Mutex<AppConfig>>,
        running: Arc<AtomicBool>,
        manual_rx: std::sync::mpsc::Receiver<()>,
        audio_player: Option<AudioPlayer>,
    ) {
        log::info!("KneeboardWatcher thread started (Pure Rust + WebKit Pipeline)");

        let mut last_briefing_mtime = None;
        let mut cached_bms_base_dir = {
            let cfg = config.lock().unwrap();
            cfg.get_bms_base_dir()
        };

        while running.load(Ordering::SeqCst) {
            let auto_kneeboards = {
                let cfg = config.lock().unwrap();
                if cached_bms_base_dir.is_none() {
                    cached_bms_base_dir = cfg.get_bms_base_dir();
                }
                cfg.auto_kneeboards
            };

            let manual_requested = manual_rx.try_recv().is_ok();

            if auto_kneeboards || manual_requested {
                if let Some(ref bms_dir) = cached_bms_base_dir {
                    let briefing_path = bms_dir.join("User").join("Briefings").join("briefing.txt");

                    let mut needs_regen = manual_requested;
                    if briefing_path.exists() {
                        if let Ok(metadata) = fs::metadata(&briefing_path) {
                            if let Ok(mtime) = metadata.modified() {
                                if let Some(last_mtime) = last_briefing_mtime {
                                    if mtime > last_mtime {
                                        needs_regen = true;
                                    }
                                }
                                last_briefing_mtime = Some(mtime);
                            }
                        }
                    }

                    if needs_regen {
                        let t0 = Instant::now();
                        log::info!("📋 [Kneeboards] Briefing change triggered! Regenerating kneeboards in pure Rust...");
                        let cfg = config.lock().unwrap().clone();
                        Self::execute_pipeline(&cfg, bms_dir, audio_player.as_ref());
                        let elapsed = t0.elapsed();
                        log::info!("✅ [Kneeboards] Kneeboards successfully updated in {:.2}s", elapsed.as_secs_f64());
                    }
                }
            }

            thread::sleep(Duration::from_millis(1500));
        }

        log::info!("KneeboardWatcher thread stopped");
    }

    /// Complete pure Rust kneeboard generation pipeline.
    pub fn execute_pipeline(config: &AppConfig, bms_dir: &Path, _audio_opt: Option<&AudioPlayer>) {
        let assets_dir = AppConfig::find_assets_dir();

        // Load 32-slot layout configuration (generates kneeboards.json next to exe if missing)
        let layout_cfg = KneeboardLayoutConfig::load_or_create_default();

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

        let work_dir = assets_dir.join("work");
        let images_dir = assets_dir.join("images");
        let _ = fs::create_dir_all(&work_dir);
        let _ = fs::create_dir_all(&images_dir);

        // Store rendered images for each slot
        let mut slot_images: HashMap<String, RgbaImage> = HashMap::new();

        // =========================================================================
        // 1. Static Custom Checklists & Threats (CustomHtml slots) with MD5 Caching
        // =========================================================================
        let need_custom = layout_cfg.slots.values().any(|s| s.page_type == KneeboardPageType::CustomHtml);
        if need_custom {
            log::info!("Checking and updating custom checklist pages...");
            let _ = check_and_render_custom_pages(&assets_dir, &wkhtmltoimage_path, false);
            let custom_slots = [
                ("F16_2L", "checklist-1.png"),
                ("F16_2R", "threats-air.png"),
                ("F16_3L", "checklist-2.png"),
                ("F16_3R", "threats-gnd.png"),
                ("F16_4L", "checklist-3.png"),
                ("F16_5L", "checklist-4.png"),
                ("F16_6L", "checklist-5.png"),
            ];
            for (slot, png_file) in &custom_slots {
                let png_path = images_dir.join(png_file);
                if png_path.exists() {
                    if let Ok(img) = image::open(&png_path) {
                        slot_images.insert(slot.to_string(), img.to_rgba8());
                    }
                }
            }
        }

        // =========================================================================
        // 2. Parse Briefing Data & Steerpoints
        // =========================================================================
        let mut b_data = if briefing_txt.exists() {
            parse_briefing(&briefing_txt).unwrap_or_default()
        } else {
            crate::kneeboard::models::BriefingData::default()
        };

        // =========================================================================
        // 3. Dynamic Briefing Pages (Roster & Steerpoints) in Pure Rust
        // =========================================================================
        let need_p1 = layout_cfg.has_type(&KneeboardPageType::BriefingRoster);
        let need_p2 = layout_cfg.has_type(&KneeboardPageType::BriefingSteerpoints);
        if (need_p1 || need_p2) && briefing_txt.exists() {
            log::info!("Generating briefing pages (Roster & Steerpoints)...");
            match render_briefing_pages(&assets_dir, &wkhtmltoimage_path, &mut b_data) {
                Ok(res) => {
                    if need_p1 {
                        if let Ok(img1) = image::open(&res.page_1_png) {
                            slot_images.insert("F16_1L".to_string(), img1.to_rgba8());
                        }
                    }
                    if need_p2 {
                        if let Ok(img2) = image::open(&res.page_2_png) {
                            slot_images.insert("F16_1R".to_string(), img2.to_rgba8());
                        }
                    }
                }
                Err(e) => {
                    log::error!("Failed to generate briefing pages: {}", e);
                }
            }
        }

        // =========================================================================
        // 4. Theater Database & Coordinates
        // =========================================================================
        let need_maps = layout_cfg.has_type(&KneeboardPageType::MissionRoute)
            || layout_cfg.has_type(&KneeboardPageType::MissionTarget);
        let need_taxi = layout_cfg.has_type(&KneeboardPageType::DepTaxi)
            || layout_cfg.has_type(&KneeboardPageType::ArrTaxi);
        let need_ils = layout_cfg.has_type(&KneeboardPageType::ArrIlsPrimary)
            || layout_cfg.has_type(&KneeboardPageType::ArrIlsSecondary);

        let db = if need_maps || need_taxi || need_ils {
            TheaterDatabase::load(&assets_dir, &theater_name)
        } else {
            None
        };

        let callsign_stpts = parse_callsign_stpts(&callsign_ini);
        let dep_name = b_data.dep_name.clone().unwrap_or_else(|| "Gimhae".to_string());
        let arr_name = b_data.arr_name.clone().unwrap_or_else(|| "Gimhae".to_string());

        let dep_ap = db.as_ref().and_then(|d| find_airport(&d.airports, &dep_name));
        let arr_ap = db.as_ref().and_then(|d| find_airport(&d.airports, &arr_name));

        let dep_xy = dep_ap.map(|a| (a.x, a.y));
        let arr_xy = arr_ap.map(|a| (a.x, a.y));
        b_data.steerpoints = compute_mission_route_coords(&b_data.steerpoints, dep_xy, arr_xy, Some(&callsign_stpts));

        let data_dir = assets_dir.join("data");

        // =========================================================================
        // 5. Mission Route & Tactical Target Maps (Only if configured in slots)
        // =========================================================================
        let mut parallel_render_jobs: Vec<(PathBuf, PathBuf)> = Vec::new();
        let route_png = images_dir.join("mission_route.png");
        let target_png = images_dir.join("mission_target.png");
        let dep_png = images_dir.join("dep_gnd.png");
        let arr_png = images_dir.join("arr_gnd.png");

        if need_maps {
            let th_id = map_theater_id(&theater_name);
            let th_size = db.as_ref()
                .and_then(|d| d.theater_entry.get("sizeFt").and_then(|v| v.as_f64()))
                .unwrap_or(3358700.0);
            let map_id = db.as_ref()
                .and_then(|d| d.theater_entry.get("mapId").and_then(|v| v.as_str()))
                .unwrap_or("korea");

            let base_map = find_theater_base_map(th_id, bms_dir, &data_dir, map_id);
            log::info!("Base map resolved: {:?}", base_map);

            let geo_file = data_dir.join("geo").join(format!("{}.json", map_id));
            let resolved_threats = resolve_threat_coords(&b_data.threats, &geo_file);

            if let Some(ref map_path) = base_map {
                let need_route = layout_cfg.has_type(&KneeboardPageType::MissionRoute);
                let need_target = layout_cfg.has_type(&KneeboardPageType::MissionTarget);

                let route_crop_jpg = work_dir.join("crop_route_overview.jpg");
                let target_crop_jpg = work_dir.join("crop_target_zoom.jpg");

                let route_box = if need_route {
                    compute_route_crop_box(&b_data.steerpoints, &resolved_threats, th_size)
                        .map(|b| (b, route_crop_jpg.as_path()))
                } else {
                    None
                };

                let target_box = if need_target {
                    compute_target_crop_box(&b_data.steerpoints, th_size)
                        .map(|b| (b, target_crop_jpg.as_path()))
                } else {
                    None
                };

                // Fast dual map crop: loads from on-disk raw cache (or decodes once),
                // crops both regions, and frees map buffer from RAM immediately.
                if let Err(e) = crop_theater_map_dual(map_path, th_size, &work_dir, route_box, target_box) {
                    log::error!("Fast dual map crop failed: {}", e);
                }

                if need_route {
                    if let Ok(route_html) = generate_mission_overview_html(&b_data, &b_data.steerpoints, &resolved_threats, th_size, map_path, &work_dir) {
                        parallel_render_jobs.push((route_html, route_png.clone()));
                    }
                }

                if need_target {
                    if let Ok(target_html) = generate_tactical_target_html(&b_data, &b_data.steerpoints, &resolved_threats, th_size, map_path, &work_dir) {
                        parallel_render_jobs.push((target_html, target_png.clone()));
                    }
                }
            }
        }

        // =========================================================================
        // 6. Departure Ground Taxi Chart (DepTaxi)
        // =========================================================================
        if layout_cfg.has_type(&KneeboardPageType::DepTaxi) {
            let dep_active = if let Some(dep) = dep_ap {
                calculate_active_runways(dep, b_data.takeoff_wind_deg, b_data.takeoff_wind_kts)
            } else {
                Vec::new()
            };

            let dep_af = db.as_ref().and_then(|d| dep_ap.and_then(|ap| d.load_airfield_model(&assets_dir, &ap.id)));

            if let (Some(dep), Some(af)) = (dep_ap, dep_af.as_ref()) {
                let dep_html = work_dir.join("dep_gnd.html");
                let html = generate_taxi_chart_html(dep, af, &dep_active, b_data.takeoff_wind_deg, b_data.takeoff_wind_kts, true);
                if fs::write(&dep_html, html).is_ok() {
                    parallel_render_jobs.push((dep_html, dep_png.clone()));
                }
            } else {
                let blank_html = work_dir.join("dep_gnd_blank.html");
                let html = generate_blank_chart_html(&dep_name, "AIRFIELD MODEL NOT AVAILABLE");
                if fs::write(&blank_html, html).is_ok() {
                    parallel_render_jobs.push((blank_html, dep_png.clone()));
                }
            }
        }

        // =========================================================================
        // 7. Arrival ILS Approach Charts (ArrIlsPrimary & ArrIlsSecondary)
        // =========================================================================
        if need_ils {
            let arr_active = if let Some(arr) = arr_ap {
                calculate_active_runways(arr, b_data.landing_wind_deg, b_data.landing_wind_kts)
            } else {
                Vec::new()
            };

            let charts_json_raw: serde_json::Value = fs::read_to_string(data_dir.join("charts.json"))
                .ok()
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or(serde_json::Value::Null);

            // Primary ILS
            if layout_cfg.has_type(&KneeboardPageType::ArrIlsPrimary) {
                let arr_ils_png = images_dir.join("arr_ils.png");
                let mut rendered = false;
                if let Some(arr) = arr_ap {
                    if let Some(primary_end) = arr_active.first() {
                        if find_and_render_ils_chart(arr, primary_end, &assets_dir, &charts_json_raw, &arr_ils_png) {
                            if let Ok(img) = image::open(&arr_ils_png) {
                                slot_images.insert("F16_7R".to_string(), img.to_rgba8());
                                rendered = true;
                            }
                        }
                    }
                }
                if !rendered {
                    let blank_html = work_dir.join("arr_ils_blank.html");
                    let blank_png = images_dir.join("arr_ils_blank.png");
                    let html = generate_blank_chart_html(&arr_name, "ILS APPROACH CHARTS NOT AVAILABLE");
                    if fs::write(&blank_html, html).is_ok() {
                        if render_html_to_png(&wkhtmltoimage_path, &blank_html, &blank_png).is_ok() {
                            if let Ok(img) = image::open(&blank_png) {
                                slot_images.insert("F16_7R".to_string(), img.to_rgba8());
                            }
                        }
                    }
                }
            }

            // Secondary ILS
            if layout_cfg.has_type(&KneeboardPageType::ArrIlsSecondary) {
                let sec_ils_png = images_dir.join("arr_ils_sec.png");
                let mut rendered = false;
                if let Some(arr) = arr_ap {
                    if arr_active.len() > 1 {
                        let sec_end = &arr_active[1];
                        if sec_end.has_ils {
                            if find_and_render_ils_chart(arr, sec_end, &assets_dir, &charts_json_raw, &sec_ils_png) {
                                if let Ok(img) = image::open(&sec_ils_png) {
                                    slot_images.insert("F16_8R".to_string(), img.to_rgba8());
                                    rendered = true;
                                }
                            }
                        }
                    }
                }
                if !rendered {
                    let blank_html = work_dir.join("sec_ils_blank.html");
                    let blank_png = images_dir.join("sec_ils_blank.png");
                    let html = generate_blank_chart_html(&arr_name, "ILS APPROACH CHARTS NOT AVAILABLE");
                    if fs::write(&blank_html, html).is_ok() {
                        if render_html_to_png(&wkhtmltoimage_path, &blank_html, &blank_png).is_ok() {
                            if let Ok(img) = image::open(&blank_png) {
                                slot_images.insert("F16_8R".to_string(), img.to_rgba8());
                            }
                        }
                    }
                }
            }
        }

        // =========================================================================
        // 8. Recovery Ground Taxi Chart (ArrTaxi)
        // =========================================================================
        if layout_cfg.has_type(&KneeboardPageType::ArrTaxi) {
            let arr_active = if let Some(arr) = arr_ap {
                calculate_active_runways(arr, b_data.landing_wind_deg, b_data.landing_wind_kts)
            } else {
                Vec::new()
            };

            let arr_af = db.as_ref().and_then(|d| arr_ap.and_then(|ap| d.load_airfield_model(&assets_dir, &ap.id)));

            if let (Some(arr), Some(af)) = (arr_ap, arr_af.as_ref()) {
                let arr_html = work_dir.join("arr_gnd.html");
                let html = generate_taxi_chart_html(arr, af, &arr_active, b_data.landing_wind_deg, b_data.landing_wind_kts, false);
                if fs::write(&arr_html, html).is_ok() {
                    parallel_render_jobs.push((arr_html, arr_png.clone()));
                }
            } else {
                let blank_html = work_dir.join("arr_gnd_blank.html");
                let html = generate_blank_chart_html(&arr_name, "AIRFIELD MODEL NOT AVAILABLE");
                if fs::write(&blank_html, html).is_ok() {
                    parallel_render_jobs.push((blank_html, arr_png.clone()));
                }
            }
        }

        // =========================================================================
        // Execute Parallel HTML Rendering for Maps & Taxi Charts
        // =========================================================================
        if !parallel_render_jobs.is_empty() {
            let job_refs: Vec<(&Path, &Path)> = parallel_render_jobs.iter().map(|(h, p)| (h.as_path(), p.as_path())).collect();
            render_html_batch_parallel(&wkhtmltoimage_path, &job_refs);

            if layout_cfg.has_type(&KneeboardPageType::MissionRoute) {
                if let Ok(img) = image::open(&route_png) {
                    slot_images.insert("F16_4R".to_string(), img.to_rgba8());
                }
            }
            if layout_cfg.has_type(&KneeboardPageType::MissionTarget) {
                if let Ok(img) = image::open(&target_png) {
                    slot_images.insert("F16_5R".to_string(), img.to_rgba8());
                }
            }
            if layout_cfg.has_type(&KneeboardPageType::DepTaxi) {
                if let Ok(img) = image::open(&dep_png) {
                    slot_images.insert("F16_6R".to_string(), img.to_rgba8());
                }
            }
            if layout_cfg.has_type(&KneeboardPageType::ArrTaxi) {
                if let Ok(img) = image::open(&arr_png) {
                    slot_images.insert("F16_9R".to_string(), img.to_rgba8());
                }
            }
        }

        // =========================================================================
        // 9. Process Custom Notes, Image & Blank Card Slots
        // =========================================================================
        let mut notes_render_jobs: Vec<(String, PathBuf, PathBuf)> = Vec::new();

        for (slot, slot_cfg) in &layout_cfg.slots {
            match &slot_cfg.page_type {
                KneeboardPageType::Notes => {
                    let title = slot_cfg.title.as_deref().unwrap_or("PILOT MISSION NOTES");
                    let subtitle = slot_cfg.subtitle.as_deref();
                    let header_code = slot_cfg.header_code.as_deref();
                    let page_num = slot_cfg.page_num.as_deref();
                    let preset = slot_cfg.preset.as_deref();
                    let stripe_color = slot_cfg.stripe_color.as_deref();
                    let stripe_colors = slot_cfg.stripe_colors.as_deref();
                    let header_color = slot_cfg.header_color.as_deref();
                    let spaced = slot_cfg.spaced.unwrap_or(true);
                    let raw_text = slot_cfg.resolve_notes_text(&assets_dir).unwrap_or_default();

                    let notes_html_path = work_dir.join(format!("notes_{}.html", slot));
                    let notes_png_path = images_dir.join(format!("notes_{}.png", slot));

                    let html = crate::kneeboard::notes_html::generate_notes_page_html(
                        slot,
                        title,
                        subtitle,
                        header_code,
                        page_num,
                        preset,
                        stripe_color,
                        stripe_colors,
                        header_color,
                        spaced,
                        &raw_text,
                        &callsign,
                    );

                    if fs::write(&notes_html_path, html).is_ok() {
                        notes_render_jobs.push((slot.clone(), notes_html_path, notes_png_path));
                    }
                }
                KneeboardPageType::Image => {
                    if let Some(ref path_str) = slot_cfg.path {
                        let img_path = PathBuf::from(path_str);
                        let resolved = if img_path.is_absolute() {
                            img_path
                        } else {
                            assets_dir.join(&img_path)
                        };
                        if resolved.exists() {
                            if let Ok(img) = image::open(&resolved) {
                                slot_images.insert(slot.clone(), img.to_rgba8());
                            }
                        }
                    }
                }
                KneeboardPageType::Blank => {
                    let title = slot_cfg.title.as_deref().unwrap_or("AERONAUTICAL KNEEBOARD");
                    let reason = slot_cfg.reason.as_deref().unwrap_or("INTENTIONALLY LEFT BLANK");
                    let blank_html_path = work_dir.join(format!("blank_{}.html", slot));
                    let blank_png_path = images_dir.join(format!("blank_{}.png", slot));
                    let html = generate_blank_chart_html(title, reason);
                    if fs::write(&blank_html_path, html).is_ok() {
                        if render_html_to_png(&wkhtmltoimage_path, &blank_html_path, &blank_png_path).is_ok() {
                            if let Ok(img) = image::open(&blank_png_path) {
                                slot_images.insert(slot.clone(), img.to_rgba8());
                            }
                        }
                    }
                }
                KneeboardPageType::RestoreOriginal => {
                    // Handled during pair merging
                }
                _ => {}
            }
        }

        if !notes_render_jobs.is_empty() {
            log::info!("Parallel rendering {} custom notes kneeboard pages...", notes_render_jobs.len());
            let job_refs: Vec<(&Path, &Path)> = notes_render_jobs.iter().map(|(_, h, p)| (h.as_path(), p.as_path())).collect();
            render_html_batch_parallel(&wkhtmltoimage_path, &job_refs);
            for (slot, _, png_path) in notes_render_jobs {
                if let Ok(img) = image::open(&png_path) {
                    slot_images.insert(slot, img.to_rgba8());
                }
            }
        }

        // =========================================================================
        // 10. Direct Batched DDS Merging in Parallel across CPU threads
        // =========================================================================
        let mut dds_jobs = Vec::new();

        for (_pair_idx, filename, left_slot, right_slot) in KneeboardLayoutConfig::texture_pairs() {
            let left_cfg = layout_cfg.slots.get(*left_slot);
            let right_cfg = layout_cfg.slots.get(*right_slot);

            // Check if user requested to restore original for either slot
            let left_restore = left_cfg.map(|c| c.page_type == KneeboardPageType::RestoreOriginal).unwrap_or(false);
            let right_restore = right_cfg.map(|c| c.page_type == KneeboardPageType::RestoreOriginal).unwrap_or(false);
            if left_restore && right_restore {
                let _ = restore_original_texture(bms_dir, &assets_dir, &texture_dir, filename);
                continue;
            }

            let left_img = slot_images.get(*left_slot);
            let right_img = slot_images.get(*right_slot);

            if left_img.is_some() || right_img.is_some() {
                dds_jobs.push((*filename, left_img, right_img));
            }
        }

        if !dds_jobs.is_empty() {
            let t0 = std::time::Instant::now();
            log::info!("Starting parallel DDS merge of {} texture pairs...", dds_jobs.len());
            std::thread::scope(|s| {
                let handles: Vec<_> = dds_jobs
                    .into_iter()
                    .map(|(filename, left_img, right_img)| {
                        let tex_dir = &texture_dir;
                        s.spawn(move || {
                            let job_t0 = std::time::Instant::now();
                            if let Err(e) = merge_texture_pair_to_dds(tex_dir, filename, left_img, right_img) {
                                log::error!("Failed to merge texture pair {}: {}", filename, e);
                            } else {
                                log::info!("Merged DDS pair {} in {:?}", filename, job_t0.elapsed());
                            }
                        })
                    })
                    .collect();
                for h in handles {
                    let _ = h.join();
                }
            });
            log::info!("All DDS merges completed in parallel in {:?}", t0.elapsed());
        }

        // =========================================================================
        // 11. Play Completion Audio Cue
        // =========================================================================
        if config.play_sound_on_update {
            if let Ok(player) = AudioPlayer::new() {
                player.play_bytes_sync(crate::engine::audio::INIT_SOUND_BYTES);
            }
        }
    }
}
