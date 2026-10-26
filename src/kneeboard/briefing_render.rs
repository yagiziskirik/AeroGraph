use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use super::renderer::render_html_to_png;

pub struct BriefingRenderResult {
    pub page_1_png: PathBuf,
    pub page_2_png: PathBuf,
}

pub fn render_briefing_pages(
    assets_dir: &Path,
    xbrief_bin: &Path,
    wkhtmltoimage_bin: &Path,
    briefing_file: &Path,
    callsign_ini: Option<&Path>,
) -> Result<BriefingRenderResult, String> {
    if !xbrief_bin.exists() {
        return Err(format!("xbrief.exe not found at {:?}", xbrief_bin));
    }
    if !briefing_file.exists() {
        return Err(format!("briefing.txt not found at {:?}", briefing_file));
    }

    let briefing_dir = assets_dir.join("briefing");
    let images_dir = assets_dir.join("images");
    let _ = fs::create_dir_all(&briefing_dir);
    let _ = fs::create_dir_all(&images_dir);

    let comments_file = assets_dir.join("Comments.txt");
    let comments_arg = if comments_file.exists() {
        comments_file.to_string_lossy().to_string()
    } else {
        "Comments.txt".to_string()
    };

    let page_1_html = briefing_dir.join("page_1.html");
    let page_2_html = briefing_dir.join("page_2.html");

    let page_1_png = images_dir.join("page_1.png");
    let page_2_png = images_dir.join("page_2.png");

    // =========================================================================
    // 1. Briefing Page 1 (Roster & Comm Ladder): format pc
    // =========================================================================
    log::info!("Generating briefing page 1 HTML via xbrief.exe (--format pc)...");
    let mut cmd1 = Command::new(xbrief_bin);
    cmd1.args(&[
        "--format", "pc",
        "--comments", &comments_arg,
        briefing_file.to_str().unwrap_or(""),
    ]);
    if let Some(ini) = callsign_ini {
        if ini.exists() {
            cmd1.arg(ini.to_str().unwrap_or(""));
        }
    }
    cmd1.current_dir(assets_dir);

    let out1 = cmd1.output().map_err(|e| format!("Failed to launch xbrief.exe for page 1: {}", e))?;
    if !out1.status.success() {
        let err = String::from_utf8_lossy(&out1.stderr);
        return Err(format!("xbrief.exe error on page 1: {}", err));
    }
    fs::write(&page_1_html, &out1.stdout)
        .map_err(|e| format!("Failed to write {:?}: {}", page_1_html, e))?;

    // =========================================================================
    // 2. Briefing Page 2 (Steerpoints & Weather): format stwz
    // =========================================================================
    log::info!("Generating briefing page 2 HTML via xbrief.exe (--format stwz)...");
    let mut cmd2 = Command::new(xbrief_bin);
    cmd2.args(&[
        "--format", "stwz",
        "--comments", &comments_arg,
        briefing_file.to_str().unwrap_or(""),
    ]);
    if let Some(ini) = callsign_ini {
        if ini.exists() {
            cmd2.arg(ini.to_str().unwrap_or(""));
        }
    }
    cmd2.current_dir(assets_dir);

    let out2 = cmd2.output().map_err(|e| format!("Failed to launch xbrief.exe for page 2: {}", e))?;
    if !out2.status.success() {
        let err = String::from_utf8_lossy(&out2.stderr);
        return Err(format!("xbrief.exe error on page 2: {}", err));
    }
    fs::write(&page_2_html, &out2.stdout)
        .map_err(|e| format!("Failed to write {:?}: {}", page_2_html, e))?;

    // =========================================================================
    // 3. Render HTML to PNG via wkhtmltoimage.exe
    // =========================================================================
    log::info!("Rendering briefing page 1 -> {:?}", page_1_png);
    render_html_to_png(wkhtmltoimage_bin, &page_1_html, &page_1_png)
        .map_err(|e| format!("Failed to render briefing page 1: {}", e))?;

    log::info!("Rendering briefing page 2 -> {:?}", page_2_png);
    render_html_to_png(wkhtmltoimage_bin, &page_2_html, &page_2_png)
        .map_err(|e| format!("Failed to render briefing page 2: {}", e))?;

    Ok(BriefingRenderResult {
        page_1_png,
        page_2_png,
    })
}
