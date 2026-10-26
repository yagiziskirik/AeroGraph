use std::path::Path;
use std::process::Command;

/// Invokes the bundled wkhtmltoimage.exe to render an HTML file to a 1024x1554 PNG.
pub fn render_html_to_png(wkhtmltoimage_bin: &Path, html_path: &Path, output_png: &Path) -> Result<(), String> {
    if !wkhtmltoimage_bin.exists() {
        return Err(format!("wkhtmltoimage.exe not found at {:?}", wkhtmltoimage_bin));
    }
    if !html_path.exists() {
        return Err(format!("HTML file not found at {:?}", html_path));
    }

    if let Some(parent) = output_png.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let mut cmd = Command::new(wkhtmltoimage_bin);
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

    Ok(())
}
