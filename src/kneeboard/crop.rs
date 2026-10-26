use std::path::{Path, PathBuf};
use image::GenericImageView;

pub fn find_theater_base_map(theater_id: &str, base_dir: &Path, data_dir: &Path, map_id: &str) -> Option<PathBuf> {
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
                    let dir_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_lowercase();
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
                                            let fname = p.file_name().and_then(|n| n.to_str()).unwrap_or("").to_lowercase();
                                            if fname.ends_with(".png") && (fname.contains("16k") || fname.contains("8k") || fname.contains("4k") || fname.contains("map")) {
                                                if let Ok(meta) = mf.metadata() {
                                                    matches.push((p, meta.len()));
                                                }
                                            }
                                        }
                                        matches.sort_by(|a, b| b.1.cmp(&a.1));
                                        if let Some((best, _)) = matches.first() {
                                            return Some(best.clone());
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

    // 3. Fallback to bundled data/maps/<map_id>/
    let maps_th_dir = data_dir.join("maps").join(map_id);
    if maps_th_dir.exists() {
        let fallbacks = [
            maps_th_dir.join("chart_z3.jpg"),
            maps_th_dir.join("chart.jpg"),
            maps_th_dir.join("topo_z3.jpg"),
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

/// Crop theater map with exact bounding box calculation as in ez_charts.py
pub fn crop_theater_map(
    base_map_path: &Path,
    size_ft: f64,
    crop_box: (f64, f64, f64, f64), // (min_x, max_x, min_y, max_y)
    out_path: &Path,
) -> Result<(), String> {
    let mut reader = image::ImageReader::open(base_map_path)
        .map_err(|e| format!("Failed to open base map {:?}: {}", base_map_path, e))?;
    let mut limits = image::Limits::default();
    limits.max_alloc = None;
    limits.max_image_width = None;
    limits.max_image_height = None;
    reader.limits(limits);
    let img = reader.decode()
        .map_err(|e| format!("Failed to decode base map {:?}: {}", base_map_path, e))?;
    let (map_w, map_h) = img.dimensions();

    let (min_x, max_x, min_y, max_y) = crop_box;
    let px_left = ((min_y / size_ft) * (map_w as f64)).max(0.0) as u32;
    let px_top = ((1.0 - (max_x / size_ft)) * (map_h as f64)).max(0.0) as u32;

    let px_w = (((max_y - min_y) / size_ft) * (map_w as f64)) as u32;
    let px_h = (((max_x - min_x) / size_ft) * (map_h as f64)) as u32;

    let px_w = px_w.min(map_w.saturating_sub(px_left)).max(100);
    let px_h = px_h.min(map_h.saturating_sub(px_top)).max(100);

    let cropped = img.crop_imm(px_left, px_top, px_w, px_h);

    if let Some(parent) = out_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    cropped.save(out_path).map_err(|e| format!("Failed to save cropped map to {:?}: {}", out_path, e))?;
    Ok(())
}
