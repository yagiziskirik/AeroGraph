use image::{imageops, RgbaImage};
use image_dds::{dds_from_image, ImageFormat, Mipmaps, Quality};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex};
use std::time::SystemTime;

type DdsPageCache = Mutex<HashMap<String, (SystemTime, Vec<u8>)>>;

static DDS_PAGE_CACHE: LazyLock<DdsPageCache> = LazyLock::new(|| Mutex::new(HashMap::new()));

pub struct KneeboardSlotMap;

impl KneeboardSlotMap {
    /// Returns the texture filename (e.g. "7982.dds") and X offset (0 or 1024) for a slot.
    pub fn get_slot_info(slot: &str) -> Option<(&'static str, u32)> {
        match slot.to_uppercase().as_str() {
            "F16_1L" => Some(("7982.dds", 0)),
            "F16_1R" => Some(("7982.dds", 1024)),
            "F16_2L" => Some(("7983.dds", 0)),
            "F16_2R" => Some(("7983.dds", 1024)),
            "F16_3L" => Some(("7984.dds", 0)),
            "F16_3R" => Some(("7984.dds", 1024)),
            "F16_4L" => Some(("7985.dds", 0)),
            "F16_4R" => Some(("7985.dds", 1024)),
            "F16_5L" => Some(("7986.dds", 0)),
            "F16_5R" => Some(("7986.dds", 1024)),
            "F16_6L" => Some(("7987.dds", 0)),
            "F16_6R" => Some(("7987.dds", 1024)),
            "F16_7L" => Some(("7988.dds", 0)),
            "F16_7R" => Some(("7988.dds", 1024)),
            "F16_8L" => Some(("7989.dds", 0)),
            "F16_8R" => Some(("7989.dds", 1024)),
            "F16_9L" => Some(("7990.dds", 0)),
            "F16_9R" => Some(("7990.dds", 1024)),
            "F16_10L" => Some(("7991.dds", 0)),
            "F16_10R" => Some(("7991.dds", 1024)),
            "F16_11L" => Some(("7992.dds", 0)),
            "F16_11R" => Some(("7992.dds", 1024)),
            "F16_12L" => Some(("7993.dds", 0)),
            "F16_12R" => Some(("7993.dds", 1024)),
            "F16_13L" => Some(("7994.dds", 0)),
            "F16_13R" => Some(("7994.dds", 1024)),
            "F16_14L" => Some(("7995.dds", 0)),
            "F16_14R" => Some(("7995.dds", 1024)),
            "F16_15L" => Some(("7996.dds", 0)),
            "F16_15R" => Some(("7996.dds", 1024)),
            "F16_16L" => Some(("7997.dds", 0)),
            "F16_16R" => Some(("7997.dds", 1024)),

            // F-15 Kneeboard slots
            "F15_1" => Some(("1403.dds", 1024)),
            "F15_2" => Some(("1404.dds", 1024)),
            "F15_3" => Some(("1405.dds", 1024)),
            "F15_4" => Some(("1406.dds", 1024)),
            "F15_5" => Some(("1407.dds", 1024)),
            "F15_6" => Some(("1408.dds", 1024)),
            "F15_7" => Some(("1409.dds", 1024)),
            "F15_8" => Some(("1410.dds", 1024)),
            _ => None,
        }
    }
}

/// Locates the active theater textures folder containing 7982.dds
pub fn find_theater_texture_dir(bms_base: &Path, theater_name: &str) -> Option<PathBuf> {
    let terr_data = bms_base.join("Data").join("TerrData").join("Objects");
    if !terr_data.exists() {
        return None;
    }

    let th_low = theater_name.to_lowercase();
    let subfolder = if th_low.contains("balkan") {
        "BalkansObj"
    } else if th_low.contains("israel") {
        "IsraelObj"
    } else if th_low.contains("hellas") {
        "HellasObj"
    } else if th_low.contains("falkland") {
        "FalklandsObj"
    } else if th_low.contains("ef2000") || th_low.contains("bto") {
        "EF2000Obj"
    } else {
        "KoreaObj"
    };

    let target = terr_data.join(subfolder);
    if target.exists() {
        return Some(target);
    }

    // Fallback: KoreaObj
    let korea = terr_data.join("KoreaObj");
    if korea.exists() {
        return Some(korea);
    }

    None
}

/// Resolves the file path for stock BMS original textures (`restore_original`).
/// Search priority:
/// 1. <bms_dir>/Docs/07 Kneeboard Templates/F-16/DDS_Backup/<filename>
/// 2. <bms_dir>/Data/TerrData/Objects/<theater>Obj/backup/<filename>
/// 3. <bms_dir>/Data/TerrData/Objects/KoreaObj/backup/<filename>
/// 4. <assets_dir>/data/DDS_Backup/<filename>
pub fn resolve_restore_dds_path(
    bms_dir: Option<&Path>,
    assets_dir: &Path,
    theater_name: &str,
    filename: &str,
) -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(bms) = bms_dir {
        candidates.push(
            bms.join("Docs")
                .join("07 Kneeboard Templates")
                .join("F-16")
                .join("DDS_Backup")
                .join(filename),
        );
        if let Some(th_dir) = find_theater_texture_dir(bms, theater_name) {
            candidates.push(th_dir.join("backup").join(filename));
        }
        candidates.push(
            bms.join("Data")
                .join("TerrData")
                .join("Objects")
                .join("KoreaObj")
                .join("backup")
                .join(filename),
        );
    }
    candidates.push(assets_dir.join("data").join("DDS_Backup").join(filename));
    candidates.push(
        PathBuf::from("assets")
            .join("data")
            .join("DDS_Backup")
            .join(filename),
    );

    candidates
        .into_iter()
        .find(|candidate| candidate.exists() && candidate.is_file())
}

/// Resolves the file path for active game textures (`pass_through`).
/// Search priority:
/// 1. <bms_dir>/Data/TerrData/Objects/<theater>Obj/<filename>
/// 2. <bms_dir>/Data/TerrData/Objects/KoreaObj/<filename>
pub fn resolve_passthrough_dds_path(
    bms_dir: Option<&Path>,
    theater_name: &str,
    filename: &str,
) -> Option<PathBuf> {
    if let Some(bms) = bms_dir {
        if let Some(th_dir) = find_theater_texture_dir(bms, theater_name) {
            let p = th_dir.join(filename);
            if p.exists() && p.is_file() {
                return Some(p);
            }
        }
        let korea = bms
            .join("Data")
            .join("TerrData")
            .join("Objects")
            .join("KoreaObj")
            .join(filename);
        if korea.exists() && korea.is_file() {
            return Some(korea);
        }
    }
    None
}

/// Restores an original stock BMS texture from DDS_Backup (in assets/data/DDS_Backup or BMS Docs).
pub fn restore_original_texture(
    bms_dir: &Path,
    assets_dir: &Path,
    texture_dir: &Path,
    filename: &str,
) -> Result<bool, Box<dyn std::error::Error>> {
    let dest_path = texture_dir.join(filename);

    if let Some(candidate) = resolve_restore_dds_path(Some(bms_dir), assets_dir, "", filename) {
        fs::copy(&candidate, &dest_path)?;
        log::info!(
            "Restored stock BMS original texture for {}: from {:?}",
            filename,
            candidate
        );
        return Ok(true);
    }

    log::warn!(
        "Stock original texture for {} not found in DDS_Backup",
        filename
    );
    Ok(false)
}

/// Extracts a specific page (cropped to 1024x1554) from a 2048x2048 DDS texture file on disk.
/// `is_right` determines whether to extract the left half (X: 0..1024) or right half (X: 1024..2048).
pub fn extract_page_from_dds(dds_path: &Path, is_right: bool) -> Option<RgbaImage> {
    if !dds_path.exists() {
        return None;
    }
    let file = fs::File::open(dds_path).ok()?;
    let mut reader = std::io::BufReader::new(file);
    let dds_data = ddsfile::Dds::read(&mut reader).ok()?;
    let full_img = image_dds::image_from_dds(&dds_data, 0).ok()?;

    let w = full_img.width();
    let h = full_img.height();
    if w == 0 || h == 0 {
        return None;
    }

    let half_w = w / 2;
    let offset_x = if is_right { half_w } else { 0 };
    let cropped = imageops::crop_imm(&full_img, offset_x, 0, half_w, h).to_image();
    let resized = imageops::resize(&cropped, 1024, 1554, imageops::FilterType::Triangle);
    Some(resized)
}

/// Encodes an RgbaImage to PNG byte buffer.
pub fn encode_image_to_png(img: &RgbaImage) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    let mut bytes = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut bytes);
    img.write_to(&mut cursor, image::ImageFormat::Png)?;
    Ok(bytes)
}

/// Retrieves the extracted PNG bytes for a DDS page, using an in-memory mtime-based cache.
pub fn get_or_extract_dds_page_png(dds_path: &Path, is_right: bool) -> Option<Vec<u8>> {
    if !dds_path.exists() {
        return None;
    }

    let metadata = fs::metadata(dds_path).ok()?;
    let modified = metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH);
    let cache_key = format!("{}:{}:{:?}", dds_path.display(), is_right, modified);

    if let Ok(cache) = DDS_PAGE_CACHE.lock() {
        if let Some((cached_time, bytes)) = cache.get(&cache_key) {
            if *cached_time == modified {
                return Some(bytes.clone());
            }
        }
    }

    let img = extract_page_from_dds(dds_path, is_right)?;
    let png_bytes = encode_image_to_png(&img).ok()?;

    if let Ok(mut cache) = DDS_PAGE_CACHE.lock() {
        cache.insert(cache_key, (modified, png_bytes.clone()));
    }

    Some(png_bytes)
}

/// Merges both left (offset 0) and right (offset 1024) pages into a single 2048x2048 DDS texture in ONE pass.
/// If either left or right is None, the existing texture data on that side is preserved.
pub fn merge_texture_pair_to_dds(
    texture_dir: &Path,
    filename: &str,
    left_img: Option<&RgbaImage>,
    right_img: Option<&RgbaImage>,
) -> Result<(), Box<dyn std::error::Error>> {
    if left_img.is_none() && right_img.is_none() {
        return Ok(()); // Nothing to update
    }

    let dest_path = texture_dir.join(filename);
    log::info!(
        "Merging texture pair into {}: Left={} | Right={}",
        filename,
        left_img.is_some(),
        right_img.is_some()
    );

    // Prepare 2048x2048 RGBA canvas
    let mut canvas = if dest_path.exists() {
        let mut loaded = None;
        if let Ok(file) = fs::File::open(&dest_path) {
            let mut reader = std::io::BufReader::new(file);
            if let Ok(dds_data) = ddsfile::Dds::read(&mut reader) {
                match image_dds::image_from_dds(&dds_data, 0) {
                    Ok(img) => {
                        loaded = Some(img);
                    }
                    Err(e) => {
                        log::warn!(
                            "Could not decode existing DDS {} ({:?}), creating clean canvas",
                            filename,
                            e
                        );
                    }
                }
            } else {
                log::warn!(
                    "ddsfile could not parse {}, creating clean canvas",
                    filename
                );
            }
        }
        loaded
            .unwrap_or_else(|| RgbaImage::from_pixel(2048, 2048, image::Rgba([250, 250, 248, 255])))
    } else {
        RgbaImage::from_pixel(2048, 2048, image::Rgba([250, 250, 248, 255]))
    };

    // Overlay Left Page at X=0
    if let Some(left) = left_img {
        let resized = imageops::resize(left, 1024, 2048, imageops::FilterType::Triangle);
        imageops::overlay(&mut canvas, &resized, 0, 0);
    }

    // Overlay Right Page at X=1024
    if let Some(right) = right_img {
        let resized = imageops::resize(right, 1024, 2048, imageops::FilterType::Triangle);
        imageops::overlay(&mut canvas, &resized, 1024, 0);
    }

    // Fast SIMD BC1 (DXT1) compression with no mipmaps
    let dds = dds_from_image(
        &canvas,
        ImageFormat::BC1RgbaUnorm,
        Quality::Fast,
        Mipmaps::Disabled,
    )?;

    // Atomic write
    let temp_path = texture_dir.join(format!("{}.tmp", filename));
    let mut writer = fs::File::create(&temp_path)?;
    dds.write(&mut writer)?;
    drop(writer);

    fs::rename(&temp_path, &dest_path)?;
    log::info!(
        "Successfully written batched texture: {}",
        dest_path.display()
    );

    Ok(())
}

/// Merges a 1024x1554 or custom page image into the target DDS texture file.
pub fn merge_page_to_dds(
    texture_dir: &Path,
    slot: &str,
    page_img: &RgbaImage,
) -> Result<(), Box<dyn std::error::Error>> {
    let (filename, offset_x) = KneeboardSlotMap::get_slot_info(slot)
        .ok_or_else(|| format!("Unknown kneeboard slot: {}", slot))?;

    if offset_x == 0 {
        merge_texture_pair_to_dds(texture_dir, filename, Some(page_img), None)
    } else {
        merge_texture_pair_to_dds(texture_dir, filename, None, Some(page_img))
    }
}
