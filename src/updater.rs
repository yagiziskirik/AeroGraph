use std::fs::File;
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;
use windows::core::PCWSTR;
use windows::Win32::Foundation::{CloseHandle, HANDLE, HWND};
use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};
use windows::Win32::UI::WindowsAndMessaging::{MessageBoxW, IDYES, MB_ICONINFORMATION, MB_YESNO};

#[derive(Debug, Clone)]
pub struct ReleaseInfo {
    pub tag_name: String,
    pub version: String,
    pub body: String,
    pub html_url: String,
    pub download_url: Option<String>,
    pub asset_name: Option<String>,
}

/// Checks if Falcon BMS process (Falcon BMS.exe or variant) is currently running.
pub fn is_bms_running() -> bool {
    unsafe {
        let snapshot: HANDLE = match CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) {
            Ok(h) => h,
            Err(_) => return false,
        };

        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };

        if Process32FirstW(snapshot, &mut entry).is_ok() {
            loop {
                let null_pos = entry
                    .szExeFile
                    .iter()
                    .position(|&c| c == 0)
                    .unwrap_or(entry.szExeFile.len());
                let exe_name =
                    String::from_utf16_lossy(&entry.szExeFile[..null_pos]).to_lowercase();

                let clean = exe_name.replace([' ', '_'], "");
                if clean.starts_with("falconbms") && clean.ends_with(".exe") {
                    let _ = CloseHandle(snapshot);
                    return true;
                }

                if Process32NextW(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = CloseHandle(snapshot);
    }
    false
}

/// Compares two version strings according to SemVer 2.0.0 precedence rules.
/// Returns true if `remote` is strictly greater than `current`.
pub fn is_newer_version(remote: &str, current: &str) -> bool {
    fn parse_version(s: &str) -> (Vec<u64>, Option<String>) {
        let clean = s.trim().trim_start_matches(['v', 'V']);
        let (core_str, pre_str) = match clean.split_once('-') {
            Some((c, p)) => (c, Some(p.to_string())),
            None => (clean, None),
        };
        let nums: Vec<u64> = core_str
            .split('.')
            .filter_map(|p| p.parse::<u64>().ok())
            .collect();
        (nums, pre_str)
    }

    let (r_nums, r_pre) = parse_version(remote);
    let (c_nums, c_pre) = parse_version(current);

    // 1. Compare major, minor, patch numbers
    let max_len = r_nums.len().max(c_nums.len());
    for i in 0..max_len {
        let r = r_nums.get(i).copied().unwrap_or(0);
        let c = c_nums.get(i).copied().unwrap_or(0);
        if r > c {
            return true;
        }
        if r < c {
            return false;
        }
    }

    // 2. If core numeric versions are equal, compare prerelease status:
    // SemVer rule: A normal release with no prerelease has higher precedence than a prerelease version.
    // e.g. 1.0.0 > 1.0.0-beta > 1.0.0-alpha
    match (r_pre, c_pre) {
        (None, Some(_)) => true, // Remote is stable release, current is prerelease -> newer
        (Some(_), None) => false, // Remote is prerelease, current is stable -> not newer
        (None, None) => false,   // Both are identical stable releases
        (Some(r), Some(c)) => compare_prerelease(&r, &c),
    }
}

fn compare_prerelease(remote: &str, current: &str) -> bool {
    let r_parts: Vec<&str> = remote.split('.').collect();
    let c_parts: Vec<&str> = current.split('.').collect();

    let max_len = r_parts.len().max(c_parts.len());
    for i in 0..max_len {
        let r = r_parts.get(i);
        let c = c_parts.get(i);

        match (r, c) {
            (Some(r_val), Some(c_val)) => {
                if r_val == c_val {
                    continue;
                }
                if let (Ok(r_num), Ok(c_num)) = (r_val.parse::<u64>(), c_val.parse::<u64>()) {
                    return r_num > c_num;
                }
                let rank = |val: &str| -> u32 {
                    let v = val.to_lowercase();
                    if v.contains("alpha") {
                        1
                    } else if v.contains("beta") {
                        2
                    } else if v.contains("rc") {
                        3
                    } else {
                        4
                    }
                };
                let r_rank = rank(r_val);
                let c_rank = rank(c_val);
                if r_rank != c_rank {
                    return r_rank > c_rank;
                }
                return r_val > c_val;
            }
            (Some(_), None) => return true,
            (None, Some(_)) => return false,
            (None, None) => break,
        }
    }
    false
}

/// Queries GitHub Releases API for the latest release on `yagiziskirik/AeroGraph`.
pub fn check_for_updates(
    repo: &str,
    current_version: &str,
) -> Result<Option<ReleaseInfo>, Box<dyn std::error::Error + Send + Sync>> {
    let url = format!("https://api.github.com/repos/{}/releases/latest", repo);
    log::info!("Checking for updates at: {}", url);

    let user_agent = format!("AeroGraph-Updater/{}", current_version);
    let response: serde_json::Value = ureq::get(&url)
        .set("User-Agent", &user_agent)
        .set("Accept", "application/vnd.github.v3+json")
        .timeout(Duration::from_secs(10))
        .call()?
        .into_json()?;

    let tag_name = response["tag_name"]
        .as_str()
        .unwrap_or_default()
        .to_string();
    let clean_version = tag_name.trim_start_matches(['v', 'V']).to_string();

    if !is_newer_version(&clean_version, current_version) {
        log::info!(
            "AeroGraph is up to date (current: v{}, latest: v{})",
            current_version,
            clean_version
        );
        return Ok(None);
    }

    log::info!("New AeroGraph version found: v{}", clean_version);
    let body = response["body"].as_str().unwrap_or("").to_string();
    let html_url = response["html_url"].as_str().unwrap_or("").to_string();

    // Look for installer asset (*.exe or AeroGraph_Setup*.exe)
    let mut download_url = None;
    let mut asset_name = None;

    if let Some(assets) = response["assets"].as_array() {
        for asset in assets {
            if let Some(name) = asset["name"].as_str() {
                if name.ends_with(".exe") && name.to_lowercase().contains("setup") {
                    download_url = asset["browser_download_url"]
                        .as_str()
                        .map(|s| s.to_string());
                    asset_name = Some(name.to_string());
                    break;
                }
            }
        }
        // Fallback: any .exe asset
        if download_url.is_none() {
            for asset in assets {
                if let Some(name) = asset["name"].as_str() {
                    if name.ends_with(".exe") {
                        download_url = asset["browser_download_url"]
                            .as_str()
                            .map(|s| s.to_string());
                        asset_name = Some(name.to_string());
                        break;
                    }
                }
            }
        }
    }

    Ok(Some(ReleaseInfo {
        tag_name,
        version: clean_version,
        body,
        html_url,
        download_url,
        asset_name,
    }))
}

/// Displays a native Windows dialog prompting the user to update.
pub fn prompt_update_available(info: &ReleaseInfo, current_version: &str) -> bool {
    let summary = if info.body.len() > 300 {
        format!("{}...", &info.body[..300])
    } else if !info.body.is_empty() {
        info.body.clone()
    } else {
        "Bug fixes, performance improvements, and kneeboard updates.".to_string()
    };

    let message = format!(
        "A new version of AeroGraph is available!\n\n\
        Current Version: v{}\n\
        Latest Version:  v{}\n\n\
        Release Notes:\n\
        {}\n\n\
        Would you like to download and install this update now?\n\
        (AeroGraph will close, perform a silent update, and restart)",
        current_version, info.version, summary
    );

    let wide_msg: Vec<u16> = format!("{}\0", message).encode_utf16().collect();
    let wide_title: Vec<u16> = "AeroGraph Update Available\0".encode_utf16().collect();

    unsafe {
        let result = MessageBoxW(
            HWND::default(),
            PCWSTR(wide_msg.as_ptr()),
            PCWSTR(wide_title.as_ptr()),
            MB_YESNO | MB_ICONINFORMATION,
        );
        result == IDYES
    }
}

/// Downloads the setup installer into %TEMP% and executes it silently with auto-restart.
pub fn perform_silent_update(
    download_url: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let temp_dir = std::env::temp_dir();
    let temp_setup_path: PathBuf = temp_dir.join("AeroGraph_Setup_Update.exe");

    log::info!(
        "Downloading update installer from: {} to: {:?}",
        download_url,
        temp_setup_path
    );

    let response = ureq::get(download_url)
        .set("User-Agent", "AeroGraph-Updater")
        .timeout(Duration::from_secs(60))
        .call()?;

    let mut reader = response.into_reader();
    let mut file = File::create(&temp_setup_path)?;
    let bytes_copied = std::io::copy(&mut reader, &mut file)?;
    let _ = file.flush();
    let _ = file.sync_all();
    drop(file);

    log::info!(
        "Successfully downloaded installer ({} bytes). Launching silent update...",
        bytes_copied
    );

    // Launch setup in silent mode, force-closing running instance and restarting after update.
    // Retry briefly if Windows Defender / AV temporarily holds an exclusive lock (os error 32).
    let mut attempts = 0;
    let spawn_result = loop {
        match Command::new(&temp_setup_path)
            .args(["/SILENT", "/FORCECLOSEAPPLICATIONS", "/RESTARTAPPLICATIONS"])
            .spawn()
        {
            Ok(child) => break Ok(child),
            Err(e) if e.raw_os_error() == Some(32) && attempts < 10 => {
                attempts += 1;
                log::warn!(
                    "Installer file busy (os error 32, possibly AV scan), retrying in 300ms (attempt {}/10)...",
                    attempts
                );
                std::thread::sleep(Duration::from_millis(300));
            }
            Err(e) => break Err(e),
        }
    };

    match spawn_result {
        Ok(_) => {
            log::info!("Silent installer launched. Exiting current AeroGraph instance.");
            std::process::exit(0);
        }
        Err(e) => {
            log::error!("Failed to launch downloaded installer: {}", e);
            Err(Box::new(e))
        }
    }
}

/// Spawns a background thread to check for updates.
/// If `manual` is true, informs the user when already up-to-date.
pub fn spawn_update_check(repo: String, current_version: String, manual: bool) {
    std::thread::spawn(move || {
        // If automatic startup check, check if Falcon BMS is running first
        if !manual && is_bms_running() {
            log::info!("Falcon BMS is currently running - suppressing startup auto-update check until sim exits.");
            return;
        }

        // Small delay on startup so tray icon and audio engine initialize first
        if !manual {
            std::thread::sleep(Duration::from_secs(3));
        }

        match check_for_updates(&repo, &current_version) {
            Ok(Some(info)) => {
                // If auto check, double-check BMS hasn't been launched in the meantime
                if !manual && is_bms_running() {
                    log::info!("Falcon BMS was launched - suppressing update dialog.");
                    return;
                }

                if prompt_update_available(&info, &current_version) {
                    if let Some(ref dl_url) = info.download_url {
                        if let Err(e) = perform_silent_update(dl_url) {
                            log::error!("Failed to complete update: {}", e);
                            show_info_dialog(
                                "Update Failed",
                                &format!("Failed to download and run the update installer:\n{}", e),
                            );
                        }
                    } else {
                        // Open release page if no direct executable asset found
                        let _ = Command::new("cmd")
                            .args(["/C", "start", "", &info.html_url])
                            .spawn();
                    }
                }
            }
            Ok(None) => {
                if manual {
                    show_info_dialog(
                        "AeroGraph Update",
                        &format!(
                            "AeroGraph is up to date!\n\nCurrent Version: v{}\nNo newer releases found.",
                            current_version
                        ),
                    );
                }
            }
            Err(e) => {
                log::warn!("Update check failed: {}", e);
                if manual {
                    show_info_dialog(
                        "Update Check Failed",
                        &format!(
                            "Unable to check for updates on GitHub:\n{}\n\nPlease check your internet connection.",
                            e
                        ),
                    );
                }
            }
        }
    });
}

fn show_info_dialog(title: &str, message: &str) {
    let wide_msg: Vec<u16> = format!("{}\0", message).encode_utf16().collect();
    let wide_title: Vec<u16> = format!("{}\0", title).encode_utf16().collect();
    unsafe {
        MessageBoxW(
            HWND::default(),
            PCWSTR(wide_msg.as_ptr()),
            PCWSTR(wide_title.as_ptr()),
            windows::Win32::UI::WindowsAndMessaging::MB_OK | MB_ICONINFORMATION,
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_comparison() {
        assert!(is_newer_version("0.2.0", "0.1.0"));
        assert!(is_newer_version("v0.2.0", "0.1.0"));
        assert!(is_newer_version("0.1.1", "0.1.0"));
        assert!(is_newer_version("1.0.0", "0.9.9"));
        assert!(!is_newer_version("0.1.0", "0.1.0"));
        assert!(!is_newer_version("v0.1.0", "0.1.0"));
        assert!(!is_newer_version("0.0.9", "0.1.0"));
        assert!(!is_newer_version("0.1.0", "0.2.0"));

        // Prerelease and SemVer 2.0.0 ordering
        assert!(is_newer_version("1.0.0-beta", "1.0.0-alpha"));
        assert!(is_newer_version("1.0.0-beta.2", "1.0.0-beta.1"));
        assert!(is_newer_version("1.0.0-rc.1", "1.0.0-beta"));
        assert!(is_newer_version("1.0.0", "1.0.0-beta"));
        assert!(is_newer_version("1.0.0", "1.0.0-alpha"));
        assert!(is_newer_version("v1.0.0", "1.0.0-beta"));
        assert!(!is_newer_version("1.0.0-beta", "1.0.0"));
        assert!(!is_newer_version("1.0.0-alpha", "1.0.0-beta"));
        assert!(!is_newer_version("1.0.0-beta", "1.0.0-beta"));
    }
}
