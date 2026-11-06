use std::borrow::Cow;
use std::sync::Arc;
use tao::dpi::{LogicalPosition, LogicalSize};
use tao::event_loop::EventLoopWindowTarget;
use tao::window::{Window, WindowBuilder};
use wry::{WebView, WebViewBuilder, WebViewBuilderExtWindows};

use super::assets::UiAssets;
use super::ipc::{IpcRequest, StateSnapshot, TelemetryData};
use crate::config::AppConfig;

pub struct TacticalConsoleWindow {
    window: Arc<Window>,
    webview: WebView,
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

        let mut webview_builder = WebViewBuilder::new()
            .with_additional_browser_args(
                "--disable-web-security --allow-file-access-from-files --use-fake-ui-for-media-stream --enable-features=MediaStream --unsafely-treat-insecure-origin-as-secure=aerograph://app",
            )
            .with_background_color((10, 10, 12, 255))
            .with_autoplay(true)
            .with_ipc_handler(ipc_callback);

        // Check if dev GUI environment flag is enabled
        let dev_mode = std::env::var("AEROGRAPH_DEV_GUI").unwrap_or_default() == "1";
        if dev_mode {
            log::info!("GUI running in DEV mode: Loading http://localhost:3000");
            webview_builder = webview_builder.with_url("http://localhost:3000");
        } else {
            webview_builder = webview_builder
                .with_custom_protocol("aerograph".into(), move |_id, request| {
                    let path = request.uri().path();
                    let clean_path = if path.is_empty() || path == "/" {
                        "/index.html"
                    } else {
                        path
                    };

                    // Check if requesting an image from assets/images
                    if clean_path.starts_with("/images/") {
                        let filename = clean_path.trim_start_matches("/images/");
                        let assets_dir = AppConfig::find_assets_dir();
                        let img_path = assets_dir.join("images").join(filename);
                        if img_path.exists() {
                            if let Ok(bytes) = std::fs::read(&img_path) {
                                let mime = if filename.ends_with(".png") {
                                    "image/png"
                                } else if filename.ends_with(".jpg") || filename.ends_with(".jpeg")
                                {
                                    "image/jpeg"
                                } else {
                                    "application/octet-stream"
                                };
                                return wry::http::Response::builder()
                                    .header("Content-Type", mime)
                                    .header("Access-Control-Allow-Origin", "*")
                                    .body(Cow::Owned(bytes))
                                    .unwrap();
                            }
                        }
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
                })
                .with_url("aerograph://app/index.html");
        }

        let webview = webview_builder.build(&*window)?;

        // Fallback watchdog: ensure window becomes visible even if IPC message is delayed
        let win_fallback = window.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(150));
            win_fallback.set_visible(true);
        });

        log::info!("Tactical Console window & WebView2 instantiated successfully");
        Ok(Self { window, webview })
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
