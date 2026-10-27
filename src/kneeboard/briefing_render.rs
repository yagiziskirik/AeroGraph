use std::fs;
use std::path::{Path, PathBuf};
use super::briefing_html::{generate_briefing_page_1_html, generate_briefing_page_2_html, inject_comments_into_briefing};
use super::models::BriefingData;
use super::renderer::render_html_batch_parallel;

pub struct BriefingRenderResult {
    pub page_1_png: PathBuf,
    pub page_2_png: PathBuf,
}

pub fn render_briefing_pages(
    assets_dir: &Path,
    wkhtmltoimage_bin: &Path,
    briefing_data: &mut BriefingData,
) -> Result<BriefingRenderResult, String> {
    let briefing_dir = assets_dir.join("briefing");
    let images_dir = assets_dir.join("images");
    let _ = fs::create_dir_all(&briefing_dir);
    let _ = fs::create_dir_all(&images_dir);

    let comments_file = assets_dir.join("Comments.txt");
    inject_comments_into_briefing(briefing_data, &comments_file);

    let page_1_html = briefing_dir.join("page_1.html");
    let page_2_html = briefing_dir.join("page_2.html");

    let page_1_png = images_dir.join("page_1.png");
    let page_2_png = images_dir.join("page_2.png");

    let now_str = chrono_or_simple_time();

    // 1. Briefing Page 1 (Roster & Comm Ladder)
    log::info!("Synthesizing Briefing Page 1 HTML (Roster & Comms)...");
    let p1_content = generate_briefing_page_1_html(briefing_data);
    fs::write(&page_1_html, p1_content)
        .map_err(|e| format!("Failed to write {:?}: {}", page_1_html, e))?;

    // 2. Briefing Page 2 (Steerpoints & Weather)
    log::info!("Synthesizing Briefing Page 2 HTML (Steerpoints & Weather)...");
    let p2_content = generate_briefing_page_2_html(briefing_data, &now_str);
    fs::write(&page_2_html, p2_content)
        .map_err(|e| format!("Failed to write {:?}: {}", page_2_html, e))?;

    // 3. Render HTML to PNG in parallel via wkhtmltoimage.exe
    render_html_batch_parallel(
        wkhtmltoimage_bin,
        &[(&page_1_html, &page_1_png), (&page_2_html, &page_2_png)],
    );

    Ok(BriefingRenderResult {
        page_1_png,
        page_2_png,
    })
}

fn chrono_or_simple_time() -> String {
    use std::time::SystemTime;
    if let Ok(dur) = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH) {
        let secs = dur.as_secs();
        let days = secs / 86400;
        let rem_secs = secs % 86400;
        let hours = rem_secs / 3600;
        let mins = (rem_secs % 3600) / 60;
        let s = rem_secs % 60;
        // Approximate Y-M-D from epoch days
        let mut year = 1970;
        let mut d = days;
        loop {
            let leap = if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) { 1 } else { 0 };
            let days_in_year = 365 + leap;
            if d >= days_in_year {
                d -= days_in_year;
                year += 1;
            } else {
                break;
            }
        }
        let leap = if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) { 1 } else { 0 };
        let days_in_months = [31, 28 + leap, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        let mut month = 1;
        for &dim in &days_in_months {
            if d >= dim {
                d -= dim;
                month += 1;
            } else {
                break;
            }
        }
        let day = d + 1;
        format!("{:04}-{:02}-{:02} {:02}:{:02}:{:02}", year, month, day, hours, mins, s)
    } else {
        "now".to_string()
    }
}
