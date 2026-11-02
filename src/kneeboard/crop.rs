use image::GenericImageView;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::Instant;

#[derive(Serialize, Deserialize)]
struct MapCacheMeta {
    source_path: String,
    source_modified_secs: u64,
    source_size: u64,
    width: u32,
    height: u32,
}

pub fn find_theater_base_map(
    theater_id: &str,
    base_dir: &Path,
    data_dir: &Path,
    map_id: &str,
) -> Option<PathBuf> {
    let th_lower = theater_id.to_lowercase();

    // 1. KTO / Korea Maps in base_dir / "Docs" / "05 Maps"
    if th_lower.contains("korea") || th_lower.contains("kto") {
        let kto_maps_dir = base_dir.join("Docs").join("05 Maps");
        if kto_maps_dir.exists() {
            let candidates = [
                kto_maps_dir.join("8_KTO_16k_Skyvector.png"),
                kto_maps_dir.join("7_KTO_16k_Blank.png"),
                kto_maps_dir.join("6_KTO_8k_Blank.png"),
                kto_maps_dir.join("0_KTO_4k_Blank.png"),
            ];
            for c in &candidates {
                if c.exists() {
                    return Some(c.clone());
                }
            }
        }
    }

    // 2. Add-On Theaters
    let data_sub = base_dir.join("Data");
    if data_sub.exists() {
        if let Ok(entries) = std::fs::read_dir(&data_sub) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let dir_name = path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_lowercase();
                    if dir_name.starts_with("add-on") {
                        let is_match = (th_lower.contains("balkan") && dir_name.contains("balkan"))
                            || (th_lower.contains("hellas") && dir_name.contains("hellas"))
                            || dir_name.contains(&th_lower)
                            || (!map_id.is_empty() && dir_name.contains(&map_id.to_lowercase()));

                        if is_match {
                            let subdirs = [
                                path.join("Docs").join("02 Maps"),
                                path.join("Docs").join("Maps"),
                                path.join("Docs").join("05 Maps"),
                                path.join("Docs"),
                            ];
                            for mdir in &subdirs {
                                if mdir.exists() {
                                    if let Ok(mfiles) = std::fs::read_dir(mdir) {
                                        let mut matches = Vec::new();
                                        for mf in mfiles.flatten() {
                                            let p = mf.path();
                                            let ext = p
                                                .extension()
                                                .and_then(|e| e.to_str())
                                                .unwrap_or("")
                                                .to_lowercase();
                                            if ext == "png" || ext == "jpg" || ext == "jpeg" {
                                                matches.push(p);
                                            }
                                        }
                                        matches.sort_by_key(|p| {
                                            std::cmp::Reverse(
                                                p.metadata().map(|m| m.len()).unwrap_or(0),
                                            )
                                        });
                                        if let Some(best) = matches.into_iter().next() {
                                            return Some(best);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 3. Fallback maps in assets/data/maps/
    let maps_th_dir = data_dir.join("maps").join(map_id);
    if maps_th_dir.exists() {
        let fallbacks = [
            maps_th_dir.join("8_KTO_16k_Skyvector.png"),
            maps_th_dir.join("topo.png"),
            maps_th_dir.join("topo.jpg"),
        ];
        for f in &fallbacks {
            if f.exists() {
                return Some(f.clone());
            }
        }
    }

    None
}

/// Loads the base map into an RGB buffer, using a fast raw uncompressed cache on disk if available.
fn load_or_cache_theater_map(
    base_map_path: &Path,
    work_dir: &Path,
) -> Result<image::RgbImage, String> {
    let stem = base_map_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("map");
    let cache_raw_path = work_dir.join(format!("cache_{}.raw", stem));
    let cache_meta_path = work_dir.join(format!("cache_{}.meta.json", stem));

    let src_meta = fs::metadata(base_map_path).map_err(|e| {
        format!(
            "Failed to read source map metadata {:?}: {}",
            base_map_path, e
        )
    })?;
    let src_size = src_meta.len();
    let src_modified_secs = src_meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    // Check if on-disk raw cache is valid
    if cache_raw_path.exists() && cache_meta_path.exists() {
        if let Ok(meta_str) = fs::read_to_string(&cache_meta_path) {
            if let Ok(meta) = serde_json::from_str::<MapCacheMeta>(&meta_str) {
                if meta.source_size == src_size && meta.source_modified_secs == src_modified_secs {
                    let expected_bytes = (meta.width as usize) * (meta.height as usize) * 3;
                    if let Ok(mut f) = fs::File::open(&cache_raw_path) {
                        let t0 = Instant::now();
                        let mut buf = Vec::with_capacity(expected_bytes);
                        if f.read_to_end(&mut buf).is_ok() && buf.len() == expected_bytes {
                            log::info!(
                                "Loaded theater map from fast disk cache in {:?}",
                                t0.elapsed()
                            );
                            if let Some(img) =
                                image::RgbImage::from_raw(meta.width, meta.height, buf)
                            {
                                return Ok(img);
                            }
                        }
                    }
                }
            }
        }
    }

    // Otherwise, decode source image (once) and write the fast raw cache
    log::info!(
        "Decoding source theater map {:?} (one-time initialization)...",
        base_map_path
    );
    let t0 = Instant::now();

    let mut reader = image::ImageReader::open(base_map_path)
        .map_err(|e| format!("Failed to open base map {:?}: {}", base_map_path, e))?;
    let mut limits = image::Limits::default();
    limits.max_alloc = None;
    limits.max_image_width = None;
    limits.max_image_height = None;
    reader.limits(limits);

    let dyn_img = reader
        .decode()
        .map_err(|e| format!("Failed to decode base map {:?}: {}", base_map_path, e))?;
    let (w, h) = dyn_img.dimensions();
    let rgb_img = dyn_img.to_rgb8();
    log::info!("Decoded source map in {:?}", t0.elapsed());

    // Write fast raw cache to disk for subsequent instantaneous loads
    let _ = fs::create_dir_all(work_dir);
    if let Ok(mut f) = fs::File::create(&cache_raw_path) {
        if f.write_all(rgb_img.as_raw()).is_ok() {
            let meta = MapCacheMeta {
                source_path: base_map_path.to_string_lossy().to_string(),
                source_modified_secs: src_modified_secs,
                source_size: src_size,
                width: w,
                height: h,
            };
            if let Ok(json) = serde_json::to_string(&meta) {
                let _ = fs::write(&cache_meta_path, json);
            }
            log::info!("Saved fast raw map cache to {:?}", cache_raw_path);
        }
    }

    Ok(rgb_img)
}

/// Crops a bounding box from an RGB map image and saves as JPEG.
fn crop_box_to_file(
    img: &image::RgbImage,
    theater_size_ft: f64,
    crop_box: (f64, f64, f64, f64),
    out_path: &Path,
) -> Result<(), String> {
    let (map_w, map_h) = img.dimensions();
    let (min_x, max_x, min_y, max_y) = crop_box;

    let px_left = ((min_y / theater_size_ft) * (map_w as f64)).max(0.0) as u32;
    let px_top = ((1.0 - (max_x / theater_size_ft)) * (map_h as f64)).max(0.0) as u32;

    let px_w = (((max_y - min_y) / theater_size_ft) * (map_w as f64)) as u32;
    let px_h = (((max_x - min_x) / theater_size_ft) * (map_h as f64)) as u32;

    let px_w = px_w.min(map_w.saturating_sub(px_left)).max(100);
    let px_h = px_h.min(map_h.saturating_sub(px_top)).max(100);

    let cropped = image::imageops::crop_imm(img, px_left, px_top, px_w, px_h).to_image();

    if let Some(parent) = out_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    cropped
        .save(out_path)
        .map_err(|e| format!("Failed to save cropped map to {:?}: {}", out_path, e))?;

    Ok(())
}

/// Decodes the base map once (using fast on-disk raw cache if present),
/// crops both the route overview and target zoom, and immediately drops the map from RAM.
#[allow(clippy::type_complexity)]
pub fn crop_theater_map_dual(
    base_map_path: &Path,
    theater_size_ft: f64,
    work_dir: &Path,
    route_job: Option<((f64, f64, f64, f64), &Path)>,
    target_job: Option<((f64, f64, f64, f64), &Path)>,
) -> Result<(), String> {
    if route_job.is_none() && target_job.is_none() {
        return Ok(());
    }

    let t0 = Instant::now();
    let map_img = load_or_cache_theater_map(base_map_path, work_dir)?;

    if let Some((crop_box, out_path)) = route_job {
        crop_box_to_file(&map_img, theater_size_ft, crop_box, out_path)?;
    }

    if let Some((crop_box, out_path)) = target_job {
        crop_box_to_file(&map_img, theater_size_ft, crop_box, out_path)?;
    }

    // Immediately drop map buffer to keep RAM usage minimal
    drop(map_img);
    log::info!(
        "Dual map cropping complete and map unloaded from RAM in {:?}",
        t0.elapsed()
    );

    Ok(())
}

/// Legacy single crop helper that delegates to dual cropper
pub fn crop_theater_map(
    base_map_path: &Path,
    theater_size_ft: f64,
    crop_box: (f64, f64, f64, f64),
    out_path: &Path,
) -> Result<(), String> {
    let parent = out_path.parent().unwrap_or(Path::new("."));
    crop_theater_map_dual(
        base_map_path,
        theater_size_ft,
        parent,
        Some((crop_box, out_path)),
        None,
    )
}
