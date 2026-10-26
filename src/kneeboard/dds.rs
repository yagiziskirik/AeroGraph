use std::fs;
use std::path::{Path, PathBuf};
use image::{imageops, RgbaImage};
use image_dds::{dds_from_image, ImageFormat, Mipmaps, Quality};

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

/// Merges a 1024x1554 or custom page image into the target DDS texture file.
pub fn merge_page_to_dds(
    texture_dir: &Path,
    slot: &str,
    page_img: &RgbaImage,
) -> Result<(), Box<dyn std::error::Error>> {
    let (filename, offset_x) = KneeboardSlotMap::get_slot_info(slot)
        .ok_or_else(|| format!("Unknown kneeboard slot: {}", slot))?;

    let dest_path = texture_dir.join(filename);
    log::info!("Merging slot {} into texture: {}", slot, dest_path.display());

    // Prepare 2048x2048 RGBA canvas
    let mut canvas = if dest_path.exists() {
        // Try to load and decode existing DDS texture so we don't overwrite the other half
        let mut loaded = None;
        if let Ok(file) = fs::File::open(&dest_path) {
            let mut reader = std::io::BufReader::new(file);
            if let Ok(dds_data) = ddsfile::Dds::read(&mut reader) {
                match image_dds::image_from_dds(&dds_data, 0) {
                    Ok(img) => {
                        log::info!("Successfully decoded existing DDS: {}", filename);
                        loaded = Some(img);
                    }
                    Err(e) => {
                        log::warn!("Could not decode existing DDS {} ({:?}), creating clean canvas", filename, e);
                    }
                }
            } else {
                log::warn!("ddsfile could not parse {}, creating clean canvas", filename);
            }
        }
        loaded.unwrap_or_else(|| RgbaImage::from_pixel(2048, 2048, image::Rgba([250, 250, 248, 255])))
    } else {
        RgbaImage::from_pixel(2048, 2048, image::Rgba([250, 250, 248, 255]))
    };

    // Resize page image to 1024x2048 exact stretch (matching BMS kneeboard aspect ratio)
    let resized = imageops::resize(page_img, 1024, 2048, imageops::FilterType::Triangle);

    // Composite at offset (0, 0) or (1024, 0)
    imageops::overlay(&mut canvas, &resized, offset_x as i64, 0);

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
    log::info!("Merged page {} into {}", slot, dest_path.display());

    Ok(())
}
