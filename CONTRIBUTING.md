# Contributing to AeroGraph

Thank you for your interest in contributing to **AeroGraph**! Whether you are reporting a bug, proposing a new cockpit checklist template, or optimizing the rendering engine, we welcome your contributions.

Please review this guide before submitting issues or pull requests.

---

## 🧭 Branching & Pull Request Rules

> ⚠️ **Important: Never push commits directly to `main`!**  
> The `main` branch is protected and always reflects stable, tested releases. All work must follow a feature branch workflow and be submitted via Pull Requests. Every PR is personally tested on a live Falcon BMS setup before merging.

### Workflow:
1. **Fork or branch**:
   ```powershell
   git checkout main
   git pull origin main
   git checkout -b feature/your-feature-name
   # or fix/your-bugfix-name
   ```
2. **Make your changes** and test locally:
   ```powershell
   cargo test
   ```
3. **Commit with descriptive messages**:
   ```powershell
   git commit -am "feat: add support for new theater approach plates"
   ```
4. **Push your branch to GitHub**:
   ```powershell
   git push origin feature/your-feature-name
   ```
5. **Open a Pull Request** against the `main` branch using our PR template.

---

## 🤖 AI-Generated Content Policy

We embrace AI tools as powerful productivity enhancers for coding, drafting documentation, and generating test fixtures. However, maintaining simulator stability and code quality is paramount:

- **Human Review & Testing is Mandatory**: Any contribution created with the assistance of LLMs or AI coding agents **MUST be thoroughly reviewed, verified, and tested by a human contributor** before submission.
- **Pure Unverified AI Content Will Be Rejected**: Pull requests containing unverified AI-generated code, hallucinated APIs, untested mock routines, or generic filler documentation ("AI slop") will be closed immediately.
- **Maintainer Verification**: The maintainer (`yagiziskirik`) personally tests all contributions on a live Falcon BMS installation and hardware HOTAS setup before merging into `main`.

---

## 📦 Release Distribution & Update Delivery Architecture

### Where Are Release Files Stored?
Release setup executables are **NOT stored inside the Git repository tree or project source files**. Committing 130MB installer binaries into git history would quickly bloat the repository to gigabytes and make cloning painfully slow.

Instead, release binaries are stored in **GitHub Releases Assets**:
1. When a version tag (e.g. `v0.2.0`) is pushed to GitHub, the **GitHub Actions Release Workflow** (`.github/workflows/release.yml`) executes on a clean Microsoft Windows virtual machine runner.
2. The runner compiles the optimized release binary and builds `AeroGraph_Setup_v0.2.0.exe` using Inno Setup.
3. The workflow publishes a new **GitHub Release** and uploads the setup executable as an attached release asset:
   ```
   https://github.com/yagiziskirik/AeroGraph/releases/tag/v0.2.0
   ```

### How Do Users Receive Updates?
Users receive new updates through two simple channels:

1. **Automatic In-App Flight-Safe Updater (`src/updater.rs`)**:
   - On application startup (or when clicking *"🔄 Check for Updates..."* in the tray), AeroGraph queries the public GitHub Releases REST API:
     ```
     GET https://api.github.com/repos/yagiziskirik/AeroGraph/releases/latest
     ```
   - AeroGraph parses the latest release tag, compares it with its local version using semantic versioning (`v0.1.0` vs. `v0.2.0`), and resolves the HTTPS download URL for `AeroGraph_Setup_v*.exe` from GitHub's global Content Delivery Network (CDN).
   - If an active flight is in progress (`Falcon BMS.exe` is running), AeroGraph suppresses update prompts until the flight finishes.
   - When confirmed, AeroGraph downloads the setup executable to `%TEMP%`, shuts down cleanly, executes the installer silently (`/SILENT /FORCECLOSEAPPLICATIONS /RESTARTAPPLICATIONS`), updates files in `%LOCALAPPDATA%\Programs\AeroGraph`, and relaunches automatically.

2. **Manual Download**:
   - Users can download the standalone setup installer directly from the project's [GitHub Releases page](https://github.com/yagiziskirik/AeroGraph/releases) and run it manually at any time.

---

## 🔢 Version Control & Release Management

AeroGraph follows [Semantic Versioning (SemVer)](https://semver.org/):
- **MAJOR (`X.0.0`)**: Incompatible architectural changes or major sim engine rewrites.
- **MINOR (`0.X.0`)**: Backwards-compatible features (e.g. new page types, new audio engines, updater changes).
- **PATCH (`0.0.X`)**: Bug fixes, performance improvements, and documentation fixes.

### Synchronizing Versions Across Files
When bumping the version, you must update the version string in the following files:

1. **`Cargo.toml`**:
   ```toml
   [package]
   name = "aerograph"
   version = "0.2.0"
   ```
2. **`build.rs`** (Windows resource metadata):
   ```rust
   FILEVERSION 0,2,0,0
   PRODUCTVERSION 0,2,0,0
   VALUE "FileVersion", "0.2.0"
   VALUE "ProductVersion", "0.2.0"
   ```
3. **`installer/setup.iss`**:
   ```iss
   #define MyAppVersion "0.2.0"
   ```

### Tagging & Release Workflow
Once a release PR is merged into `main`:
1. Check out the latest `main`:
   ```powershell
   git checkout main
   git pull origin main
   ```
2. Tag the release:
   ```powershell
   git tag -a v0.2.0 -m "Release v0.2.0"
   git push origin v0.2.0
   ```
3. The GitHub Actions Release workflow will automatically compile the release executable, package the single `AeroGraph_Setup_v0.2.0.exe`, and publish the GitHub Release with attached assets.

---

## 🛠️ Local Development & Testing

### Prerequisites
- **Rust Toolchain**: 1.75+ (`rustup update stable`)
- **Windows SDK**: Required for `rc.exe` (resource compiler for icons and metadata)
- **Inno Setup 6**: Required to compile the standalone setup installer (`winget install JRSoftware.InnoSetup`)

### Running Automated Tests
```powershell
cargo test
```

### Building the Standalone Setup Installer Locally
To build and test the setup executable on your local machine:
```powershell
powershell -ExecutionPolicy Bypass -File .\installer\build_installer.ps1
```
The compiled installer will be output to:
```
installer\output\AeroGraph_Setup_v<version>.exe
```

---

## 🎨 Code Style & Quality Standards

AeroGraph enforces standard Rust code styling using `rustfmt.toml`. All contributions must pass formatting and lint checks before being merged:

### 1. Code Formatting (`cargo fmt`)
Format all source files automatically according to the repository's `rustfmt.toml`:
```powershell
cargo fmt
```

To verify whether your changes conform to formatting without modifying files (as checked by CI):
```powershell
cargo fmt --all --check
```

### 2. Linting (`cargo clippy`)
Run Clippy to catch common errors, unnecessary allocations, or anti-patterns:
```powershell
cargo clippy -- -D warnings
```

### 3. Unit Tests
Ensure all unit tests pass cleanly:
```powershell
cargo test
```

### 4. Dependency Guidelines
- Avoid introducing heavyweight dependencies (e.g. OpenSSL, heavy asynchronous runtimes, or external C dependencies) where lightweight, synchronous pure-Rust or native Win32 APIs can be used.
- All code changes should maintain low sim overhead and high performance.
