use std::path::PathBuf;
use tray_icon::menu::{Menu, MenuItem, PredefinedMenuItem};
use tray_icon::{TrayIcon, TrayIconBuilder};

pub struct AppTray {
    pub tray: TrayIcon,
    pub item_profile: MenuItem,
    pub item_select: MenuItem,
    pub item_reload: MenuItem,
    pub item_listening: MenuItem,
    pub item_gender: MenuItem,
    pub item_auto_kneeboards: MenuItem,
    pub item_regen_now: MenuItem,
    pub item_open_images: MenuItem,
    pub item_autostart: MenuItem,
    pub item_console: MenuItem,
    pub item_open_log: MenuItem,
    pub item_exit: MenuItem,
}

impl AppTray {
    pub fn new(
        current_profile_name: &str,
        pilot_female: bool,
        listening_enabled: bool,
        auto_kneeboards_enabled: bool,
        autostart_enabled: bool,
        console_visible: bool,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let menu = Menu::new();

        // 1. Profile Section
        let item_profile = MenuItem::new(format!("Profile: {}", current_profile_name), false, None);
        let item_select = MenuItem::new("Select .fvx Profile...", true, None);
        let item_reload = MenuItem::new("Reload Profile", true, None);

        // 2. Voice Section
        let listening_text = if listening_enabled {
            "🎙️ Listening: Active"
        } else {
            "🎙️ Listening: Muted"
        };
        let item_listening = MenuItem::new(listening_text, true, None);

        let gender_text = if pilot_female {
            "Pilot: Female"
        } else {
            "Pilot: Male"
        };
        let item_gender = MenuItem::new(gender_text, true, None);

        // 3. Kneeboards Section
        let kneeboards_text = if auto_kneeboards_enabled {
            "📋 Auto-Kneeboards: Enabled"
        } else {
            "📋 Auto-Kneeboards: Disabled"
        };

        let item_auto_kneeboards = MenuItem::new(kneeboards_text, true, None);

        let item_regen_now = MenuItem::new("⚡ Regenerate Kneeboards Now", true, None);
        let item_open_images = MenuItem::new("📁 Open Kneeboard Images", true, None);

        // 4. System / App Section
        let autostart_text = if autostart_enabled {
            "🚀 Start with Windows: Enabled"
        } else {
            "🚀 Start with Windows: Disabled"
        };
        let item_autostart = MenuItem::new(autostart_text, true, None);

        let console_text = if console_visible {
            "Hide Console Window"
        } else {
            "Show Console Window"
        };
        let item_console = MenuItem::new(console_text, true, None);

        let item_open_log = MenuItem::new("Open Log File", true, None);
        let item_exit = MenuItem::new("Exit AeroGraph", true, None);

        let _ = menu.append(&item_profile);
        let _ = menu.append(&PredefinedMenuItem::separator());
        let _ = menu.append(&item_listening);
        let _ = menu.append(&item_gender);
        let _ = menu.append(&item_select);
        let _ = menu.append(&item_reload);
        let _ = menu.append(&PredefinedMenuItem::separator());
        let _ = menu.append(&item_auto_kneeboards);
        let _ = menu.append(&item_regen_now);
        let _ = menu.append(&item_open_images);
        let _ = menu.append(&PredefinedMenuItem::separator());
        let _ = menu.append(&item_autostart);
        let _ = menu.append(&item_console);
        let _ = menu.append(&item_open_log);
        let _ = menu.append(&PredefinedMenuItem::separator());
        let _ = menu.append(&item_exit);

        let icon = load_app_icon().unwrap_or_else(|_| {
            let icon_rgba = create_default_icon_rgba();
            tray_icon::Icon::from_rgba(icon_rgba, 16, 16).unwrap()
        });

        let tray = TrayIconBuilder::new()
            .with_menu(Box::new(menu))
            .with_tooltip("AeroGraph - Falcon BMS Voice & Kneeboards")
            .with_icon(icon)
            .build()?;

        Ok(Self {
            tray,
            item_profile,
            item_select,
            item_reload,
            item_listening,
            item_gender,
            item_auto_kneeboards,
            item_regen_now,
            item_open_images,
            item_autostart,
            item_console,
            item_open_log,
            item_exit,
        })
    }

    pub fn set_profile_name(&self, name: &str) {
        self.item_profile.set_text(format!("Profile: {}", name));
    }

    pub fn set_listening_active(&self, active: bool) {
        self.item_listening.set_text(if active {
            "🎙️ Listening: Active"
        } else {
            "🎙️ Listening: Muted"
        });
    }

    pub fn set_gender(&self, female: bool) {
        self.item_gender.set_text(if female {
            "Pilot: Female"
        } else {
            "Pilot: Male"
        });
    }

    pub fn set_auto_kneeboards_enabled(&self, enabled: bool) {
        self.item_auto_kneeboards.set_text(if enabled {
            "📋 Auto-Kneeboards: Enabled"
        } else {
            "📋 Auto-Kneeboards: Disabled"
        });
    }

    pub fn set_autostart_enabled(&self, enabled: bool) {
        self.item_autostart.set_text(if enabled {
            "🚀 Start with Windows: Enabled"
        } else {
            "🚀 Start with Windows: Disabled"
        });
    }

    pub fn set_console_visible(&self, visible: bool) {
        self.item_console.set_text(if visible {
            "Hide Console Window"
        } else {
            "Show Console Window"
        });
    }

    pub fn prompt_select_profile() -> Option<PathBuf> {
        rfd::FileDialog::new()
            .add_filter("FoxVox Profile (*.fvx)", &["fvx"])
            .set_title("Select FoxVox Profile (.fvx)")
            .pick_file()
    }
}

fn load_app_icon() -> Result<tray_icon::Icon, Box<dyn std::error::Error>> {
    const ICON_BYTES: &[u8] = include_bytes!("../../icon.ico");
    let img = image::load_from_memory(ICON_BYTES)?;
    let resized = img.resize_exact(32, 32, image::imageops::FilterType::Lanczos3);
    let rgba = resized.into_rgba8();
    let (w, h) = rgba.dimensions();
    Ok(tray_icon::Icon::from_rgba(rgba.into_raw(), w, h)?)
}

fn create_default_icon_rgba() -> Vec<u8> {
    let mut rgba = Vec::with_capacity(16 * 16 * 4);
    for y in 0..16 {
        for x in 0..16 {
            let is_border = x == 0 || x == 15 || y == 0 || y == 15;
            if is_border {
                rgba.extend_from_slice(&[0, 150, 255, 255]);
            } else if (x > 3 && x < 12) && (y > 3 && y < 12) {
                rgba.extend_from_slice(&[0, 200, 255, 255]);
            } else {
                rgba.extend_from_slice(&[15, 23, 42, 220]);
            }
        }
    }
    rgba
}
