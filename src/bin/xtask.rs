use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitStatus};

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    let command = args.first().map(|s| s.as_str()).unwrap_or("help");

    match command {
        "check" | "check-all" => run_check_all(),
        "installer" => {
            let mut custom_version = None;
            let mut iter = args.iter().skip(1);
            while let Some(arg) = iter.next() {
                if arg == "--version" || arg == "-Version" || arg == "-v" {
                    if let Some(val) = iter.next() {
                        custom_version = Some(val.clone());
                    }
                } else if arg.starts_with("--version=") {
                    custom_version = Some(arg.trim_start_matches("--version=").to_string());
                }
            }
            run_installer(custom_version.as_deref());
        }
        _ => {
            println!("AeroGraph Workspace Tasks");
            println!("Usage:");
            println!(
                "  cargo check-all                 Run auto-fmt, Clippy lints, and unit tests"
            );
            println!("  cargo installer                 Compile release binary & build Inno Setup installer");
            println!(
                "  cargo installer --version <ver> Build installer with custom version string"
            );
        }
    }
}

fn run_check_all() {
    println!("==========================================================");
    println!("         AeroGraph Pre-Flight Quality Check               ");
    println!("==========================================================");

    // 1. Auto-format
    println!("\n[1/3] Formatting Rust source code (cargo fmt)...");
    let status = Command::new("cargo")
        .arg("fmt")
        .status()
        .expect("Failed to run cargo fmt");
    check_status(status, "cargo fmt");
    println!("✔ Code formatting completed.");

    // 2. Clippy
    println!("\n[2/3] Running Clippy lints (cargo clippy -- -D warnings)...");
    let status = Command::new("cargo")
        .args(["clippy", "--", "-D", "warnings"])
        .status()
        .expect("Failed to run cargo clippy");
    check_status(status, "cargo clippy");
    println!("✔ Clippy checks passed with 0 warnings.");

    // 3. Tests
    println!("\n[3/3] Running unit tests (cargo test)...");
    let status = Command::new("cargo")
        .arg("test")
        .status()
        .expect("Failed to run cargo test");
    check_status(status, "cargo test");
    println!("✔ All unit tests passed cleanly.");

    println!("\n==========================================================");
    println!("  ALL PRE-FLIGHT CHECKS PASSED! Ready for PR submission.  ");
    println!("==========================================================\n");
}

fn run_installer(custom_version: Option<&str>) {
    println!("==========================================================");
    println!("         AeroGraph Automated Installer Builder            ");
    println!("==========================================================");

    // 1. Resolve version
    let version = match custom_version {
        Some(v) => {
            println!("Using Custom AeroGraph Version: v{}", v);
            v.to_string()
        }
        None => {
            let cargo_toml = fs::read_to_string("Cargo.toml").expect("Failed to read Cargo.toml");
            let v = cargo_toml
                .lines()
                .find(|l| l.trim().starts_with("version"))
                .and_then(|l| l.split('=').nth(1))
                .map(|s| s.trim().trim_matches('"'))
                .unwrap_or("0.1.0");
            println!("Detected AeroGraph Version from Cargo.toml: v{}", v);
            v.to_string()
        }
    };

    // 2. Build release binary
    println!("\n[1/2] Building AeroGraph release binary (cargo build --release)...");
    let status = Command::new("cargo")
        .args(["build", "--release"])
        .status()
        .expect("Failed to run cargo build --release");
    check_status(status, "cargo build --release");

    let release_exe = Path::new("target/release/AeroGraph.exe");
    if !release_exe.exists() {
        eprintln!("❌ Release executable not found at {:?}", release_exe);
        std::process::exit(1);
    }
    println!("✔ Executable built successfully: {:?}", release_exe);

    // 3. Locate ISCC.exe
    println!("\n[2/2] Locating Inno Setup Compiler (ISCC.exe)...");
    let iscc_path = find_iscc().unwrap_or_else(|| {
        eprintln!("❌ Inno Setup Compiler (ISCC.exe) could not be located.");
        eprintln!("Please install Inno Setup 6 to compile the graphical setup installer:");
        eprintln!("  winget install JRSoftware.InnoSetup");
        std::process::exit(1);
    });
    println!("✔ Found Inno Setup Compiler at: {:?}", iscc_path);

    let output_dir = Path::new("installer/output");
    if !output_dir.exists() {
        let _ = fs::create_dir_all(output_dir);
    }

    let status = Command::new(&iscc_path)
        .arg(format!("/DMyAppVersion={}", version))
        .arg("installer/setup.iss")
        .status()
        .expect("Failed to run ISCC.exe");
    check_status(status, "Inno Setup compilation");

    let setup_exe = output_dir.join(format!("AeroGraph_Setup_v{}.exe", version));
    if setup_exe.exists() {
        let metadata = fs::metadata(&setup_exe).ok();
        let size_mb = metadata
            .map(|m| m.len() as f64 / 1_048_576.0)
            .unwrap_or(0.0);
        println!("\n==========================================================");
        println!("  SUCCESS: Standalone graphical installer created!         ");
        println!("==========================================================");
        println!("Installer: {:?}", setup_exe);
        println!("Size:      {:.2} MB\n", size_mb);
    } else {
        eprintln!("❌ Installer output file not found at {:?}", setup_exe);
        std::process::exit(1);
    }
}

fn find_iscc() -> Option<PathBuf> {
    if let Ok(path_var) = env::var("PATH") {
        for dir in env::split_paths(&path_var) {
            let cand = dir.join("iscc.exe");
            if cand.exists() {
                return Some(cand);
            }
        }
    }
    let candidates = [
        r"C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
        r"C:\Program Files\Inno Setup 6\ISCC.exe",
        r"C:\Program Files (x86)\Inno Setup 7\ISCC.exe",
        r"C:\Program Files\Inno Setup 7\ISCC.exe",
    ];
    for cand in &candidates {
        let p = PathBuf::from(cand);
        if p.exists() {
            return Some(p);
        }
    }
    if let Ok(local_app_data) = env::var("LOCALAPPDATA") {
        let p = PathBuf::from(local_app_data).join(r"Programs\Inno Setup 6\ISCC.exe");
        if p.exists() {
            return Some(p);
        }
    }
    None
}

fn check_status(status: ExitStatus, step: &str) {
    if !status.success() {
        eprintln!("❌ Step '{}' failed with status: {:?}", step, status);
        std::process::exit(status.code().unwrap_or(1));
    }
}
