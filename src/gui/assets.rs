use rust_embed::RustEmbed;
use std::borrow::Cow;

#[derive(RustEmbed)]
#[folder = "ui/out/"]
pub struct UiAssets;

impl UiAssets {
    pub fn get_file_content(path: &str) -> Option<(Cow<'static, [u8]>, String)> {
        let clean_path = path.trim_start_matches('/');
        let lookup_path = if clean_path.is_empty() || clean_path == "index.html" {
            "index.html"
        } else {
            clean_path
        };

        if let Some(file) = Self::get(lookup_path) {
            let mime = mime_guess::from_path(lookup_path)
                .first_or_octet_stream()
                .to_string();
            Some((file.data, mime))
        } else {
            // Check trailing slash directory fallback for Next.js routing
            let html_candidate = format!("{}.html", clean_path.trim_end_matches('/'));
            if let Some(file) = Self::get(&html_candidate) {
                Some((file.data, "text/html".to_string()))
            } else {
                None
            }
        }
    }
}
