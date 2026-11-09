use std::borrow::Cow;
use std::path::PathBuf;
use std::sync::Arc;
use tao::dpi::{LogicalPosition, LogicalSize};
use tao::event_loop::EventLoopWindowTarget;
use tao::window::{Window, WindowBuilder};
use wry::{WebView, WebViewBuilder, WebViewBuilderExtWindows};

use super::assets::UiAssets;
use super::ipc::{IpcRequest, StateSnapshot, TelemetryData};
use crate::config::AppConfig;
use crate::kneeboard::dds::{
    get_or_extract_dds_page_png, resolve_passthrough_dds_path, resolve_restore_dds_path,
    KneeboardSlotMap,
};

pub struct TacticalConsoleWindow {
    window: Arc<Window>,
    webview: WebView,
    _context: wry::WebContext,
}

impl TacticalConsoleWindow {
    pub fn create<T>(
        target: &EventLoopWindowTarget<T>,
        config: &AppConfig,
        ipc_handler: impl Fn(IpcRequest, &Window) + Send + Sync + 'static,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let (mut width, mut height) = config.window_size;
        if let Some(monitor) = target.primary_monitor() {
            let screen_size = monitor.size().to_logical::<f64>(monitor.scale_factor());
            let max_w = (screen_size.width * 0.90).round() as u32;
            let max_h = (screen_size.height * 0.88).round() as u32;
            width = width.min(max_w).max(1024);
            height = height.min(max_h).max(680);
        }
        let mut builder = WindowBuilder::new()
            .with_title("AeroGraph Tactical Console")
            .with_inner_size(LogicalSize::new(width as f64, height as f64))
            .with_min_inner_size(LogicalSize::new(1024.0, 680.0))
            .with_decorations(false)
            .with_resizable(true)
            .with_visible(false)
            .with_maximized(config.window_maximized);

        if let Some((x, y)) = config.window_pos {
            builder = builder.with_position(LogicalPosition::new(x as f64, y as f64));
        }

        let window = Arc::new(builder.build(target)?);

        let win_drag = window.clone();
        let ipc_callback = move |request: wry::http::Request<String>| {
            let req_str = request.body();
            if let Ok(ipc_req) = IpcRequest::parse(req_str) {
                if matches!(ipc_req, IpcRequest::DragWindow) {
                    let _ = win_drag.drag_window();
                } else if let IpcRequest::ResizeWindow { ref direction } = ipc_req {
                    let dir = match direction.to_lowercase().as_str() {
                        "e" | "east" => tao::window::ResizeDirection::East,
                        "w" | "west" => tao::window::ResizeDirection::West,
                        "n" | "north" => tao::window::ResizeDirection::North,
                        "s" | "south" => tao::window::ResizeDirection::South,
                        "ne" | "northeast" => tao::window::ResizeDirection::NorthEast,
                        "nw" | "northwest" => tao::window::ResizeDirection::NorthWest,
                        "se" | "southeast" => tao::window::ResizeDirection::SouthEast,
                        "sw" | "southwest" => tao::window::ResizeDirection::SouthWest,
                        _ => return,
                    };
                    let _ = win_drag.drag_resize_window(dir);
                } else if matches!(ipc_req, IpcRequest::MinimizeWindow) {
                    win_drag.set_minimized(true);
                } else if matches!(ipc_req, IpcRequest::ToggleMaximize) {
                    win_drag.set_maximized(!win_drag.is_maximized());
                } else if matches!(ipc_req, IpcRequest::WindowReady) {
                    win_drag.set_visible(true);
                    win_drag.set_focus();
                    ipc_handler(ipc_req, &win_drag);
                } else {
                    ipc_handler(ipc_req, &win_drag);
                }
            } else {
                log::warn!("Invalid IPC message received: {}", req_str);
            }
        };

        let mut web_context = wry::WebContext::new(Some(AppConfig::webview_data_dir()));
        let mut webview_builder = WebViewBuilder::with_web_context(&mut web_context)
            .with_additional_browser_args(
                "--disable-web-security --allow-file-access-from-files --use-fake-ui-for-media-stream --enable-features=MediaStream --unsafely-treat-insecure-origin-as-secure=aerograph://app",
            )
            .with_background_color((10, 10, 12, 255))
            .with_autoplay(true)
            .with_initialization_script("window.addEventListener('contextmenu', function(e) { e.preventDefault(); });")
            .with_ipc_handler(ipc_callback);

        webview_builder =
            webview_builder.with_custom_protocol("aerograph".into(), move |_id, request| {
                let path = request.uri().path();
                let clean_path = if path.is_empty() || path == "/" {
                    "/index.html"
                } else {
                    path
                };

                // Check if requesting an extracted DDS kneeboard page (restore_original or pass_through)
                if clean_path.starts_with("/dds-page/") {
                    let sub = clean_path.trim_start_matches("/dds-page/");
                    let parts: Vec<&str> = sub.split('/').collect();
                    if parts.len() >= 2 {
                        let mode = parts[0].to_lowercase();
                        let slot_with_ext = parts[1];
                        let slot_key = slot_with_ext.trim_end_matches(".png");

                        if let Some((filename, offset_x)) =
                            KneeboardSlotMap::get_slot_info(slot_key)
                        {
                            let is_right = offset_x > 0;
                            let cfg = AppConfig::load();
                            let bms_dir = cfg.get_bms_base_dir();
                            let (theater, _) = AppConfig::get_bms_registry_info();
                            let assets_dir = AppConfig::find_assets_dir();

                            let dds_path = if mode == "restore" || mode == "restore_original" {
                                resolve_restore_dds_path(
                                    bms_dir.as_deref(),
                                    &assets_dir,
                                    &theater,
                                    filename,
                                )
                            } else {
                                resolve_passthrough_dds_path(bms_dir.as_deref(), &theater, filename)
                            };

                            if let Some(path) = dds_path {
                                if let Some(png_bytes) =
                                    get_or_extract_dds_page_png(&path, is_right)
                                {
                                    return wry::http::Response::builder()
                                        .header("Content-Type", "image/png")
                                        .header("Access-Control-Allow-Origin", "*")
                                        .header("Cache-Control", "no-cache")
                                        .body(Cow::Owned(png_bytes))
                                        .unwrap();
                                }
                            }
                        }
                    }
                }

                // Check if requesting an image from local-image, images, or custom
                let is_img_req = clean_path.starts_with("/local-image/")
                    || clean_path.starts_with("/images/")
                    || clean_path.starts_with("/custom/");

                if is_img_req {
                    let raw_sub = if clean_path.starts_with("/local-image/") {
                        clean_path.trim_start_matches("/local-image/")
                    } else {
                        clean_path.trim_start_matches('/')
                    };
                    let rel_sub = raw_sub.replace("%20", " ");
                    let filename = std::path::Path::new(&rel_sub)
                        .file_name()
                        .and_then(|f| f.to_str())
                        .unwrap_or(&rel_sub);

                    let assets_dir = AppConfig::find_assets_dir();
                    let user_templates = AppConfig::user_templates_dir();

                    let candidate_paths = vec![
                        PathBuf::from(&rel_sub),
                        assets_dir.join(&rel_sub),
                        user_templates.join(&rel_sub),
                        assets_dir.join("images").join(filename),
                        PathBuf::from("images").join(filename),
                        PathBuf::from("custom").join(filename),
                        user_templates.join(filename),
                    ];

                    for img_path in candidate_paths {
                        if img_path.exists() && img_path.is_file() {
                            if let Ok(bytes) = std::fs::read(&img_path) {
                                let ext = img_path
                                    .extension()
                                    .and_then(|s| s.to_str())
                                    .unwrap_or("")
                                    .to_lowercase();
                                let mime = match ext.as_str() {
                                    "png" => "image/png",
                                    "jpg" | "jpeg" => "image/jpeg",
                                    "bmp" => "image/bmp",
                                    "webp" => "image/webp",
                                    "svg" => "image/svg+xml",
                                    _ => "application/octet-stream",
                                };
                                return wry::http::Response::builder()
                                    .header("Content-Type", mime)
                                    .header("Access-Control-Allow-Origin", "*")
                                    .body(Cow::Owned(bytes))
                                    .unwrap();
                            }
                        }
                    }

                    // Dynamic / user images must not fall back to embedded UI assets
                    return wry::http::Response::builder()
                        .status(wry::http::StatusCode::NOT_FOUND)
                        .body(Cow::Borrowed(b"404 Not Found" as &[u8]))
                        .unwrap();
                }

                match UiAssets::get_file_content(clean_path) {
                    Some((bytes, mime)) => wry::http::Response::builder()
                        .header("Content-Type", mime)
                        .header("Access-Control-Allow-Origin", "*")
                        .body(bytes)
                        .unwrap(),
                    None => wry::http::Response::builder()
                        .status(wry::http::StatusCode::NOT_FOUND)
                        .body(Cow::Borrowed(b"404 Not Found" as &[u8]))
                        .unwrap(),
                }
            });

        // Check if dev GUI environment flag is enabled
        let dev_mode = std::env::var("AEROGRAPH_DEV_GUI").unwrap_or_default() == "1";
        if dev_mode {
            log::info!("GUI running in DEV mode: Loading http://localhost:3000");
            webview_builder = webview_builder.with_url("http://localhost:3000");
        } else {
            webview_builder = webview_builder.with_url("aerograph://app/index.html");
        }

        let webview = webview_builder.build(&*window)?;

        // Fallback watchdog: ensure window becomes visible even if IPC message is delayed
        let win_fallback = window.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(150));
            win_fallback.set_visible(true);
        });

        log::info!("Tactical Console window & WebView2 instantiated successfully");
        Ok(Self {
            window,
            webview,
            _context: web_context,
        })
    }

    pub fn window(&self) -> &Window {
        &self.window
    }

    pub fn send_event(&self, event_name: &str, data_json: &str) {
        let script = format!(
            "if (window.__AEROGRAPH_RECEIVE_EVENT__) {{ window.__AEROGRAPH_RECEIVE_EVENT__('{}', {}); }}",
            event_name, data_json
        );
        let _ = self.webview.evaluate_script(&script);
    }

    pub fn push_snapshot(&self, snapshot: &StateSnapshot) {
        if let Ok(json) = serde_json::to_string(snapshot) {
            self.send_event("StateSnapshot", &json);
        }
    }

    pub fn push_telemetry(&self, telemetry: &TelemetryData) {
        if let Ok(json) = serde_json::to_string(telemetry) {
            self.send_event("TelemetryUpdate", &json);
        }
    }

    pub fn push_audio_level(&self, level: f32) {
        self.send_event("AudioLevel", &format!("{:.3}", level));
    }
}
