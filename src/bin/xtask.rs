use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitStatus};

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    let command = args.first().map(|s| s.as_str()).unwrap_or("help");

    match command {
        "check" | "check-all" => run_check_all(),
        "build-all" => {
            let debug_mode = args.contains(&"--debug".to_string());
            run_build_all(debug_mode);
        }
        "ui-dev" => run_ui_dev(),
        "ui-build" => run_ui_build(),
        "local" => run_local(args.contains(&"--debug".to_string())),
        "release" => {
            let execute =
                args.contains(&"--execute".to_string()) || args.contains(&"-x".to_string());
            run_release(execute);
        }
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
                "  cargo check-all                 Run auto-fmt, Clippy lints, unit tests & UI typecheck"
            );
            println!(
                "  cargo build-all                 All-in-one check-all + ui-build + local binary deploy"
            );
            println!(
                "  cargo xtask ui-dev              Start Next.js GUI development server (pnpm dev)"
            );
            println!("  cargo xtask ui-build            Export Next.js static assets to ui/out (pnpm export)");
            println!("  cargo local                     Build release binary & deploy to ./AeroGraph.exe");
            println!("  cargo installer                 Compile release binary & build Inno Setup installer");
            println!(
                "  cargo installer --version <ver> Build installer with custom version string"
            );
            println!("  cargo release                   Dry-run release check (shows previous & target version)");
            println!("  cargo release --execute         Tag and push the release to origin (git tag & git push)");
        }
    }
}

fn run_build_all(debug_mode: bool) {
    println!("=== 1/3: Running check-all (formatting, lints, tests, UI check) ===");
    run_check_all();
    println!("\n=== 2/3: Building and exporting Next.js static UI assets ===");
    run_ui_build();
    println!("\n=== 3/3: Building and deploying local binary ===");
    run_local(debug_mode);
    println!("\n✔ build-all completed successfully!");
}

fn run_local(debug_mode: bool) {
    sync_ui_package_version();
    let profile = if debug_mode { "debug" } else { "release" };
    println!("Building AeroGraph ({} profile)...", profile);
    let mut build_args = vec!["build"];
    if !debug_mode {
        build_args.push("--release");
    }
    let status = Command::new("cargo")
        .args(&build_args)
        .status()
        .expect("Failed to execute cargo build");
    check_status(status, "cargo build");

    let src_exe = PathBuf::from("target").join(profile).join("aerograph.exe");
    let dst_exe = PathBuf::from("AeroGraph.exe");

    if dst_exe.exists() {
        if let Err(e) = fs::OpenOptions::new().write(true).open(&dst_exe) {
            eprintln!("\n⚠️ WARNING: Cannot overwrite AeroGraph.exe in project root ({e}).");
            eprintln!("AeroGraph.exe appears to be running! Please close AeroGraph and run this command again.");
            std::process::exit(1);
        }
    }

    match fs::copy(&src_exe, &dst_exe) {
        Ok(bytes) => {
            println!(
                "\n✔ Successfully deployed {:?} -> {:?} ({} bytes).",
                src_exe, dst_exe, bytes
            );
            println!("Ready for local testing in root with assets/ and kneeboards.json!");
        }
        Err(e) => {
            eprintln!("⚠️ Failed to copy executable to project root: {e}");
            std::process::exit(1);
        }
    }
}

fn run_ui_dev() {
    sync_ui_package_version();
    println!("Starting Next.js development server (pnpm dev)...");
    let status = Command::new("cmd")
        .args(["/C", "pnpm", "dev"])
        .current_dir("ui")
        .status()
        .expect("Failed to execute pnpm dev in ui/");
    check_status(status, "pnpm dev");
}

fn run_ui_build() {
    sync_ui_package_version();
    println!("Exporting Next.js static assets (pnpm export)...");
    let status = Command::new("cmd")
        .args(["/C", "pnpm", "export"])
        .current_dir("ui")
        .status()
        .expect("Failed to execute pnpm export in ui/");
    check_status(status, "pnpm export");
}

fn run_check_all() {
    sync_ui_package_version();
    println!("==========================================================");
    println!("         AeroGraph Pre-Flight Quality Check               ");
    println!("==========================================================");

    // 1. Auto-format
    println!("\n[1/4] Formatting Rust source code (cargo fmt)...");
    let status = Command::new("cargo")
        .arg("fmt")
        .status()
        .expect("Failed to run cargo fmt");
    check_status(status, "cargo fmt");
    println!("✔ Code formatting completed.");

    // 2. Clippy
    println!("\n[2/4] Running Clippy lints (cargo clippy -- -D warnings)...");
    let status = Command::new("cargo")
        .args(["clippy", "--", "-D", "warnings"])
        .status()
        .expect("Failed to run cargo clippy");
    check_status(status, "cargo clippy");
    println!("✔ Clippy checks passed with 0 warnings.");

    // 3. Tests
    println!("\n[3/4] Running unit tests (cargo test)...");
    let status = Command::new("cargo")
        .arg("test")
        .status()
        .expect("Failed to run cargo test");
    check_status(status, "cargo test");
    println!("✔ All unit tests passed cleanly.");

    // 4. UI Validation
    println!("\n[4/4] Validating Next.js GUI TypeScript & Linting...");
    let status = Command::new("cmd")
        .args(["/C", "pnpm", "typecheck"])
        .current_dir("ui")
        .status()
        .expect("Failed to run pnpm typecheck in ui/");
    check_status(status, "pnpm typecheck");

    let status = Command::new("cmd")
        .args(["/C", "pnpm", "lint"])
        .current_dir("ui")
        .status()
        .expect("Failed to run pnpm lint in ui/");
    check_status(status, "pnpm lint");
    println!("✔ UI checks passed cleanly with 0 warnings.");

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

fn sync_ui_package_version() {
    let cargo_toml = fs::read_to_string("Cargo.toml").unwrap_or_default();
    let version = cargo_toml
        .lines()
        .find(|l| l.trim().starts_with("version"))
        .and_then(|l| l.split('=').nth(1))
        .map(|s| s.trim().trim_matches('"'))
        .unwrap_or("1.0.0-alpha");

    let pkg_path = Path::new("ui/package.json");
    if pkg_path.exists() {
        if let Ok(content) = fs::read_to_string(pkg_path) {
            if let Ok(mut json) = serde_json::from_str::<serde_json::Value>(&content) {
                if json.get("version").and_then(|v| v.as_str()) != Some(version) {
                    json["version"] = serde_json::Value::String(version.to_string());
                    if let Ok(formatted) = serde_json::to_string_pretty(&json) {
                        let _ = fs::write(pkg_path, formatted + "\n");
                        println!("✔ Synced ui/package.json version to v{}", version);
                    }
                }
            }
        }
    }
}

fn run_release(execute: bool) {
    sync_ui_package_version();

    let cargo_toml = fs::read_to_string("Cargo.toml").expect("Failed to read Cargo.toml");
    let version = cargo_toml
        .lines()
        .find(|l| l.trim().starts_with("version"))
        .and_then(|l| l.split('=').nth(1))
        .map(|s| s.trim().trim_matches('"'))
        .unwrap_or("0.1.0");

    let previous_tag = get_previous_tag();
    let target_tag = format!("v{}", version);
    let tag_exists = check_tag_exists(&target_tag);
    let is_dirty = check_git_dirty();

    println!("==========================================================");
    println!("         AeroGraph Release Workflow                       ");
    println!("==========================================================");
    println!(
        "Previous Version / Tag : {}",
        previous_tag.as_deref().unwrap_or("None")
    );
    println!("Target Release Version : v{} (from Cargo.toml)", version);
    println!("Target Release Tag     : {}", target_tag);
    println!(
        "Working Tree Status    : {}",
        if is_dirty {
            "DIRTY (uncommitted changes detected)"
        } else {
            "CLEAN"
        }
    );
    println!("\nGit Commands to be executed:");
    println!("  git tag -a {} -m \"Release {}\"", target_tag, target_tag);
    println!("  git push origin {}", target_tag);

    if !execute {
        println!("\n----------------------------------------------------------");
        if tag_exists {
            println!(
                "⚠️  WARNING: Git tag '{}' already exists in repository!",
                target_tag
            );
        }
        if is_dirty {
            println!("⚠️  WARNING: Working tree has uncommitted changes. Commit all changes before releasing.");
        }
        println!("[DRY-RUN] No changes were made to the Git repository.");
        println!("To create the tag and push to GitHub origin, execute:");
        println!("  cargo release --execute");
        println!("----------------------------------------------------------\n");
    } else {
        if tag_exists {
            eprintln!(
                "\n❌ Release aborted: Git tag '{}' already exists in repository.",
                target_tag
            );
            eprintln!("Did you forget to update the version in Cargo.toml?");
            std::process::exit(1);
        }
        if is_dirty {
            eprintln!("\n❌ Release aborted: Working tree has uncommitted changes.");
            eprintln!("Please commit all changes cleanly before executing release tagging.");
            std::process::exit(1);
        }

        println!("\n[1/2] Creating annotated Git tag: {}...", target_tag);
        let tag_status = Command::new("git")
            .args([
                "tag",
                "-a",
                &target_tag,
                "-m",
                &format!("Release {}", target_tag),
            ])
            .status()
            .expect("Failed to execute git tag");
        check_status(tag_status, "git tag");
        println!("✔ Tag '{}' created successfully.", target_tag);

        println!(
            "\n[2/2] Pushing tag to origin (git push origin {})...",
            target_tag
        );
        let push_status = Command::new("git")
            .args(["push", "origin", &target_tag])
            .status()
            .expect("Failed to execute git push");
        check_status(push_status, "git push");
        println!("✔ Successfully pushed tag '{}' to origin!", target_tag);

        println!("\n==========================================================");
        println!(
            "  SUCCESS: AeroGraph {} has been tagged and pushed!     ",
            target_tag
        );
        println!("  GitHub Actions will now package the release installer.  ");
        println!("==========================================================\n");
    }
}

fn get_previous_tag() -> Option<String> {
    if let Ok(output) = Command::new("git")
        .args(["describe", "--tags", "--abbrev=0"])
        .output()
    {
        if output.status.success() {
            let tag = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !tag.is_empty() {
                return Some(tag);
            }
        }
    }
    if let Ok(output) = Command::new("git")
        .args(["tag", "--sort=-v:refname"])
        .output()
    {
        if output.status.success() {
            let tags = String::from_utf8_lossy(&output.stdout);
            if let Some(first) = tags.lines().next() {
                let trimmed = first.trim().to_string();
                if !trimmed.is_empty() {
                    return Some(trimmed);
                }
            }
        }
    }
    None
}

fn check_tag_exists(tag: &str) -> bool {
    if let Ok(output) = Command::new("git").args(["tag", "-l", tag]).output() {
        if output.status.success() {
            let res = String::from_utf8_lossy(&output.stdout).trim().to_string();
            return !res.is_empty();
        }
    }
    false
}

fn check_git_dirty() -> bool {
    if let Ok(output) = Command::new("git").args(["status", "--porcelain"]).output() {
        if output.status.success() {
            return !output.stdout.is_empty();
        }
    }
    false
}

fn check_status(status: ExitStatus, step: &str) {
    if !status.success() {
        eprintln!("❌ Step '{}' failed with status: {:?}", step, status);
        std::process::exit(status.code().unwrap_or(1));
    }
}
