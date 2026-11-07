use std::env;
use std::path::{Path, PathBuf};
use std::process::Command;

fn main() {
    println!("cargo:rerun-if-changed=icon.ico");
    println!("cargo:rerun-if-changed=build.rs");

    // Ensure ui/out directory exists with at least a placeholder file so
    // #[derive(RustEmbed)] on UiAssets in src/gui/assets.rs does not fail
    // during fresh checkouts, cargo check, or cargo clippy before `cargo ui-build` is run.
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap_or_else(|_| ".".into()));
    let ui_out = manifest_dir.join("ui").join("out");
    if !ui_out.exists() {
        let _ = std::fs::create_dir_all(&ui_out);
    }
    let placeholder = ui_out.join("index.html");
    if !placeholder.exists() {
        let _ = std::fs::write(
            &placeholder,
            b"<!DOCTYPE html><html><body>AeroGraph Tactical Console Placeholder</body></html>",
        );
    }

    if env::var("CARGO_CFG_TARGET_OS").unwrap_or_default() == "windows" {
        let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
        let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
        let icon_path = manifest_dir.join("icon.ico");
        let rc_file = out_dir.join("app.rc");
        let res_file = out_dir.join("app.res");

        // Extract version metadata dynamically from Cargo
        let major = env::var("CARGO_PKG_VERSION_MAJOR").unwrap_or_else(|_| "0".into());
        let minor = env::var("CARGO_PKG_VERSION_MINOR").unwrap_or_else(|_| "0".into());
        let patch = env::var("CARGO_PKG_VERSION_PATCH").unwrap_or_else(|_| "0".into());
        let version = env::var("CARGO_PKG_VERSION").unwrap_or_else(|_| "0.0.0".into());

        // Generate .rc script with embedded icon and application metadata
        let rc_content = format!(
            "1 ICON \"{}\"\n\
            1 VERSIONINFO\n\
            FILEVERSION {major},{minor},{patch},0\n\
            PRODUCTVERSION {major},{minor},{patch},0\n\
            BEGIN\n\
                BLOCK \"StringFileInfo\"\n\
                BEGIN\n\
                    BLOCK \"040904b0\"\n\
                    BEGIN\n\
                        VALUE \"FileDescription\", \"AeroGraph - Falcon BMS Voice & Kneeboards\"\n\
                        VALUE \"FileVersion\", \"{version}\"\n\
                        VALUE \"ProductName\", \"AeroGraph\"\n\
                        VALUE \"ProductVersion\", \"{version}\"\n\
                    END\n\
                END\n\
                BLOCK \"VarFileInfo\"\n\
                BEGIN\n\
                    VALUE \"Translation\", 0x0409, 1200\n\
                END\n\
            END\n",
            icon_path.display().to_string().replace('\\', "\\\\")
        );
        std::fs::write(&rc_file, rc_content).expect("Failed to write app.rc");

        if let Some(rc_exe) = find_rc_exe() {
            let status = Command::new(&rc_exe)
                .arg("/fo")
                .arg(&res_file)
                .arg(&rc_file)
                .status();

            match status {
                Ok(s) if s.success() => {
                    println!("cargo:rustc-link-arg={}", res_file.display());
                    println!(
                        "cargo:warning=Successfully compiled and linked app.res into executable!"
                    );
                }
                other => {
                    println!("cargo:warning=rc.exe execution failed: {:?}", other);
                }
            }
        } else {
            println!("cargo:warning=rc.exe could not be found");
        }
    }
}

fn find_rc_exe() -> Option<PathBuf> {
    // 1. Check if already in PATH
    if let Ok(path_var) = env::var("PATH") {
        for dir in env::split_paths(&path_var) {
            let candidate = dir.join("rc.exe");
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }
    // 2. Search Windows Kits standard installation path
    let base = Path::new(r"C:\Program Files (x86)\Windows Kits\10\bin");
    if base.exists() {
        if let Ok(entries) = std::fs::read_dir(base) {
            let mut subdirs: Vec<_> = entries.flatten().map(|e| e.path()).collect();
            subdirs.sort();
            subdirs.reverse(); // prefer latest SDK version
            for ver_dir in subdirs {
                let candidate = ver_dir.join("x64").join("rc.exe");
                if candidate.exists() {
                    return Some(candidate);
                }
            }
        }
    }
    None
}
