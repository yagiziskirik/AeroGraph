use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use md5::{Md5, Digest};
use super::renderer::render_html_to_png;

pub struct CustomPageTask {
    pub slot: &'static str,
    pub png_path: PathBuf,
    pub description: &'static str,
}

fn file_md5(path: &Path) -> String {
    if let Ok(bytes) = fs::read(path) {
        let mut hasher = Md5::new();
        hasher.input(&bytes);
        let result = hasher.result();
        return format!("{:x}", result);
    }
    String::new()
}

pub fn check_and_render_custom_pages(
    assets_dir: &Path,
    wkhtmltoimage_bin: &Path,
    force_all: bool,
) -> Vec<CustomPageTask> {
    let custom_dir = assets_dir.join("custom");
    let images_dir = assets_dir.join("images");
    let work_dir = assets_dir.join("work");
    let cache_file = work_dir.join("custom_pages_cache.json");

    let _ = fs::create_dir_all(&images_dir);
    let _ = fs::create_dir_all(&work_dir);

    let mut cache: HashMap<String, String> = HashMap::new();
    if !force_all && cache_file.exists() {
        if let Ok(content) = fs::read_to_string(&cache_file) {
            if let Ok(loaded) = serde_json::from_str(&content) {
                cache = loaded;
            }
        }
    }

    let custom_defs: &[(&str, &str, &str, &str)] = &[
        ("kneeboard-checklist-1-start.html", "F16_2L", "checklist-1.png", "Checklist 1 Start"),
        ("kneeboard-threats-air.html", "F16_2R", "threats-air.png", "Threats Air Reference"),
        ("kneeboard-checklist-2-taxi-takeoff-land.html", "F16_3L", "checklist-2.png", "Checklist 2 Taxi/TO/Land"),
        ("kneeboard-threats-gnd.html", "F16_3R", "threats-gnd.png", "Threats Ground SAM Reference"),
        ("kneeboard-checklist-3-tacan-aar.html", "F16_4L", "checklist-3.png", "Checklist 3 TACAN/AAR"),
        ("kneeboard-checklist-4-fence.html", "F16_5L", "checklist-4.png", "Checklist 4 Fence In/Out"),
        ("kneeboard-checklist-5-lgb-mav-mark.html", "F16_6L", "checklist-5.png", "Checklist 5 LGB/Mav/Mark"),
    ];

    let mut tasks = Vec::new();
    let mut cache_modified = false;

    for (html_filename, slot, png_filename, desc) in custom_defs {
        let html_path = custom_dir.join(html_filename);
        let png_path = images_dir.join(png_filename);

        if !html_path.exists() {
            continue;
        }

        let cur_hash = file_md5(&html_path);
        let cached_hash = cache.get(*html_filename).cloned().unwrap_or_default();

        if force_all || cur_hash != cached_hash || !png_path.exists() {
            log::info!("Rendering custom page {} -> {:?}...", html_filename, png_path);
            if let Err(e) = render_html_to_png(wkhtmltoimage_bin, &html_path, &png_path) {
                log::error!("Failed to render custom page {}: {}", html_filename, e);
            } else {
                cache.insert(html_filename.to_string(), cur_hash);
                cache_modified = true;
                tasks.push(CustomPageTask {
                    slot,
                    png_path,
                    description: desc,
                });
            }
        }
    }

    if cache_modified {
        if let Ok(json_str) = serde_json::to_string_pretty(&cache) {
            let _ = fs::write(&cache_file, json_str);
        }
    }

    tasks
}
