use std::fs;
use std::path::Path;
use image::{GenericImageView, ImageBuffer, Rgba};
use super::models::{Airport, ActiveRunway};

pub fn format_image_to_kneeboard(src_image: &Path, output_png: &Path) -> Result<(), String> {
    let img = image::open(src_image)
        .map_err(|e| format!("Failed to open image {:?}: {}", src_image, e))?;

    let target_w = 1024u32;
    let target_h = 1554u32;

    // Background color: #FAFAF8
    let bg_color = Rgba([250u8, 250u8, 248u8, 255u8]);
    let mut canvas = ImageBuffer::from_pixel(target_w, target_h, bg_color);

    let (src_w, src_h) = img.dimensions();
    let scale_w = target_w as f64 / src_w as f64;
    let scale_h = target_h as f64 / src_h as f64;
    let scale = scale_w.min(scale_h);

    let new_w = ((src_w as f64 * scale).round() as u32).min(target_w);
    let new_h = ((src_h as f64 * scale).round() as u32).min(target_h);

    let resized = image::imageops::resize(&img, new_w, new_h, image::imageops::FilterType::Lanczos3);

    let offset_x = (target_w - new_w) / 2;
    let offset_y = (target_h - new_h) / 2;

    image::imageops::overlay(&mut canvas, &resized, offset_x as i64, offset_y as i64);

    if let Some(parent) = output_png.parent() {
        let _ = fs::create_dir_all(parent);
    }

    canvas.save(output_png)
        .map_err(|e| format!("Failed to save formatted kneeboard PNG {:?}: {}", output_png, e))?;

    Ok(())
}

pub fn find_and_render_ils_chart(
    airport: &Airport,
    active_end: &ActiveRunway,
    assets_dir: &Path,
    charts_index: &serde_json::Value,
    output_png: &Path,
) -> bool {
    let icao = airport.icao.as_deref().unwrap_or("");
    let desig = &active_end.designator;

    let rwy_num: String = desig.chars().filter(|c| c.is_ascii_digit()).collect();
    let rwy_num_trimmed = rwy_num.trim_start_matches('0');
    let rwy_side: String = desig.chars().filter(|c| c.is_alphabetic()).collect::<String>().to_uppercase();
    let desig_norm = if let Ok(num) = rwy_num_trimmed.parse::<u32>() {
        format!("{:02}{}", num, rwy_side)
    } else {
        desig.clone()
    };

    let charts_dir = assets_dir.join("charts");

    // 1. Check user override in charts/<ICAO>/
    if !icao.is_empty() {
        let user_candidates = [
            charts_dir.join(icao).join(format!("ILS_{}.png", desig)),
            charts_dir.join(icao).join(format!("ILS_{}.png", desig_norm)),
            charts_dir.join(format!("{}_ILS_{}.png", icao, desig)),
            charts_dir.join(format!("{}_ILS_{}.png", icao, desig_norm)),
        ];
        for uc in &user_candidates {
            if uc.exists() {
                if format_image_to_kneeboard(uc, output_png).is_ok() {
                    return true;
                }
            }
        }
    }

    // 2. Check bundled webp charts in charts/bundled/
    let id_str = match &airport.id {
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::String(s) => s.clone(),
        _ => String::new(),
    };

    if !id_str.is_empty() {
        // Helper to search a list of chart objects for this airport
        let try_find_in_list = |ap_charts: &Vec<serde_json::Value>| -> Option<String> {
            // First try matching ILS and runway designator
            for chart in ap_charts {
                let title = chart.get("title").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
                if title.contains("ils") && (title.contains(&desig.to_lowercase()) || title.contains(&desig_norm.to_lowercase())) {
                    if let Some(pages) = chart.get("pages").and_then(|v| v.as_array()) {
                        if let Some(first_page) = pages.first().and_then(|v| v.as_str()) {
                            return Some(first_page.replace("charts/", ""));
                        }
                    }
                }
            }
            // Fallback: any ILS approach for this airport
            for chart in ap_charts {
                let title = chart.get("title").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
                if title.contains("ils") {
                    if let Some(pages) = chart.get("pages").and_then(|v| v.as_array()) {
                        if let Some(first_page) = pages.first().and_then(|v| v.as_str()) {
                            return Some(first_page.replace("charts/", ""));
                        }
                    }
                }
            }
            None
        };

        // If charts_index is { "3033": [ ... ] }
        if let Some(ap_charts) = charts_index.get(&id_str).and_then(|v| v.as_array()) {
            if let Some(clean_rel) = try_find_in_list(ap_charts) {
                let bundled_file = charts_dir.join("bundled").join(&clean_rel);
                if bundled_file.exists() && format_image_to_kneeboard(&bundled_file, output_png).is_ok() {
                    return true;
                }
            }
        }

        // If charts_index is { "ap-f7eb0c31ef": { "3033": [ ... ] } }
        if let Some(obj) = charts_index.as_object() {
            for (_set_id, set_val) in obj {
                if let Some(ap_charts) = set_val.get(&id_str).and_then(|v| v.as_array()) {
                    if let Some(clean_rel) = try_find_in_list(ap_charts) {
                        let bundled_file = charts_dir.join("bundled").join(&clean_rel);
                        if bundled_file.exists() && format_image_to_kneeboard(&bundled_file, output_png).is_ok() {
                            return true;
                        }
                    }
                }
            }
        }
    }

    false
}
