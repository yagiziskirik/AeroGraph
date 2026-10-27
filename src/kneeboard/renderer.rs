use std::path::{Path, PathBuf};
use std::process::Command;

pub enum HtmlRenderer {
    Chromium(PathBuf),
    WkHtmlToImage(PathBuf),
}

/// Discovers an available HTML rendering engine (Edge / Chrome / wkhtmltoimage).
pub fn find_html_renderer(fallback_bin: Option<&Path>) -> Result<HtmlRenderer, String> {
    // 1. Check Microsoft Edge (built-in on Windows 10/11)
    let edge_paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ];
    for p in &edge_paths {
        let pb = PathBuf::from(p);
        if pb.exists() {
            return Ok(HtmlRenderer::Chromium(pb));
        }
    }

    // 2. Check Google Chrome
    let chrome_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ];
    for p in &chrome_paths {
        let pb = PathBuf::from(p);
        if pb.exists() {
            return Ok(HtmlRenderer::Chromium(pb));
        }
    }

    // 3. Fallback to bundled wkhtmltoimage
    if let Some(bin) = fallback_bin {
        if bin.exists() {
            return Ok(HtmlRenderer::WkHtmlToImage(bin.to_path_buf()));
        }
    }

    Err("No compatible HTML renderer found (msedge, chrome, or wkhtmltoimage)".to_string())
}

/// Renders an HTML document to a 1024x1554 PNG using the specified engine without modifying document layout.
pub fn render_html_to_png(renderer_bin: &Path, html_path: &Path, output_png: &Path) -> Result<(), String> {
    if !html_path.exists() {
        return Err(format!("HTML file not found at {:?}", html_path));
    }

    if let Some(parent) = output_png.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let bin_name = renderer_bin.file_name().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
    let is_chromium = bin_name.contains("edge") || bin_name.contains("chrome");

    if is_chromium {
        let canon = html_path.canonicalize().unwrap_or_else(|_| html_path.to_path_buf());
        let norm = canon.to_string_lossy().replace('\\', "/");
        let path_clean = norm.trim_start_matches("//?/");
        let file_url = format!("file:///{}", path_clean);

        let abs_output = if output_png.is_absolute() {
            output_png.to_path_buf()
        } else {
            std::env::current_dir().unwrap_or_default().join(output_png)
        };
        let screenshot_arg = format!("--screenshot={}", abs_output.to_string_lossy());

        let mut cmd = Command::new(renderer_bin);
        cmd.args(&[
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--window-size=1024,1554",
            &screenshot_arg,
            &file_url,
        ]);

        let output = cmd.output().map_err(|e| format!("Failed to execute Chromium renderer: {}", e))?;
        if !output_png.exists() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Chromium exited without producing image at {:?}: {}", output_png, stderr));
        }
    } else {
        let mut cmd = Command::new(renderer_bin);
        cmd.args(&[
            "--width", "1024",
            "--height", "1554",
            "--disable-smart-width",
            "--enable-local-file-access",
        ]);
        cmd.arg(html_path);
        cmd.arg(output_png);

        let output = cmd.output().map_err(|e| format!("Failed to execute wkhtmltoimage: {}", e))?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("wkhtmltoimage error: {}", stderr));
        }

        if !output_png.exists() {
            return Err(format!("wkhtmltoimage exited cleanly but output PNG was not created at {:?}", output_png));
        }
    }

    Ok(())
}

/// Renders multiple HTML files to PNG in parallel across CPU threads.
pub fn render_html_batch_parallel(
    renderer_bin: &Path,
    jobs: &[(&Path, &Path)],
) -> Vec<Result<(), String>> {
    if jobs.is_empty() {
        return Vec::new();
    }

    let t0 = std::time::Instant::now();
    log::info!("Starting parallel render of {} HTML pages...", jobs.len());

    let results = std::thread::scope(|s| {
        let handles: Vec<_> = jobs
            .iter()
            .map(|&(html, png)| {
                s.spawn(move || {
                    let page_t0 = std::time::Instant::now();
                    let res = render_html_to_png(renderer_bin, html, png);
                    log::info!("Rendered {:?} in {:?}", png.file_name().unwrap_or_default(), page_t0.elapsed());
                    res
                })
            })
            .collect();

        handles
            .into_iter()
            .map(|h| h.join().unwrap_or_else(|_| Err("Thread panicked".to_string())))
            .collect()
    });

    log::info!("All {} HTML pages rendered in parallel in {:?}", jobs.len(), t0.elapsed());
    results
}
