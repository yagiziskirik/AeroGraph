pub mod assets;
pub mod ipc;
pub mod preset;
pub mod window;

use tao::event_loop::EventLoopWindowTarget;
use tao::window::Window;

use crate::config::AppConfig;
use ipc::IpcRequest;
use window::TacticalConsoleWindow;

pub struct TacticalConsoleManager {
    active_window: Option<TacticalConsoleWindow>,
}

impl TacticalConsoleManager {
    pub fn new() -> Self {
        Self {
            active_window: None,
        }
    }

    pub fn is_open(&self) -> bool {
        self.active_window.is_some()
    }

    pub fn toggle<T>(
        &mut self,
        target: &EventLoopWindowTarget<T>,
        config: &AppConfig,
        ipc_handler: impl Fn(IpcRequest, &Window) + Send + Sync + 'static,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        if self.active_window.is_some() {
            self.teardown();
            Ok(false)
        } else {
            self.open(target, config, ipc_handler)?;
            Ok(true)
        }
    }

    pub fn open<T>(
        &mut self,
        target: &EventLoopWindowTarget<T>,
        config: &AppConfig,
        ipc_handler: impl Fn(IpcRequest, &Window) + Send + Sync + 'static,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if self.active_window.is_none() {
            let win = TacticalConsoleWindow::create(target, config, ipc_handler)?;
            self.active_window = Some(win);
        }
        Ok(())
    }

    pub fn teardown(&mut self) {
        if self.active_window.is_some() {
            log::info!("Complete teardown of Tactical Console: dropping WebView2 & Window to release resources.");
            self.active_window = None;
        }
    }

    pub fn active_window(&self) -> Option<&TacticalConsoleWindow> {
        self.active_window.as_ref()
    }
}

impl Default for TacticalConsoleManager {
    fn default() -> Self {
        Self::new()
    }
}
