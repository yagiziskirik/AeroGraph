# Contributing to AeroGraph

Thank you for your interest in contributing to **AeroGraph**! Whether you are reporting a bug, proposing a new cockpit checklist template, or optimizing the rendering engine, we welcome your contributions.

Please review this guide before submitting issues or pull requests.

---

## 🛠️ 1. Prerequisites & Local Environment Setup

Before building AeroGraph locally, ensure you have the following installed:

1. **Rust Toolchain (Stable 1.75+)**:
   ```powershell
   rustup update stable
   rustup component add rustfmt clippy
   ```
2. **Windows SDK**:
   Required for `rc.exe` (resource compiler used to embed icon and application metadata into Windows PE binaries). Usually installed automatically with Visual Studio Build Tools / C++ desktop workload.
3. **Inno Setup 6**:
   Required to compile the standalone setup installer. Install via winget or official installer:
   ```powershell
   winget install JRSoftware.InnoSetup
   ```

---

## 🌿 2. Branching & Pull Request Workflow

> ⚠️ **Important: Never push commits directly to `main`!**  
> The `main` branch is protected and always reflects stable, tested releases. All work must follow a feature branch workflow and be submitted via Pull Requests. Every PR is personally tested on a live Falcon BMS setup before merging.

### Branch Naming Conventions:
Name feature branches descriptively using standard prefixes:
- `feature/<name>` or `feat/<name>`: New capabilities or enhancements (e.g., `feature/mfd-threat-rings`)
- `fix/<name>` or `bugfix/<name>`: Bug fixes (e.g., `fix/briefing-parser-date`)
- `docs/<name>`: Documentation improvements (e.g., `docs/install-guide`)
- `refactor/<name>`: Code refactoring without changing functionality (e.g., `refactor/kneeboard-renderer`)

### Commit Message Standards (Conventional Commits):
AeroGraph adheres to [Conventional Commits](https://www.conventionalcommits.org/):
```text
<type>(<optional scope>): <description>
```
Common types:
- `feat`: A new feature for the end-user (e.g., `feat(kneeboard): add night mode palette`)
- `fix`: A bug fix (e.g., `fix(parser): handle missing bullseye in flight plan`)
- `docs`: Documentation changes only
- `refactor`: Code changes that neither fix a bug nor add a feature
- `test`: Adding missing tests or correcting existing tests
- `chore`: Maintenance tasks, dependency updates, or internal build configs

### Workflow:
1. **Fork or branch from latest `main`**:
   ```powershell
   git checkout main
   git pull origin main
   git checkout -b feature/your-feature-name
   ```
2. **Make your changes** and keep the scope focused.
3. **Run Pre-Flight Quality Checks** (see Section 3 below):
   ```powershell
   cargo check-all
   ```
4. **Commit with descriptive messages** following Conventional Commits:
   ```powershell
   git commit -am "feat(kneeboard): add support for new theater approach plates"
   ```
5. **Push your branch to GitHub**:
   ```powershell
   git push origin feature/your-feature-name
   ```
6. **Open a Pull Request** against `main` using our PR template.

> [!NOTE]
> **Do NOT bump version numbers in feature branches!**  
> `Cargo.toml` version bumping and release tagging are managed exclusively on `main` by the maintainer when preparing an official release.

---

## 🧪 3. Pre-Flight Quality Checks

AeroGraph enforces strict code quality and formatting. CI will automatically check formatting, linting with Clippy, and run unit tests on every pull request.

To verify your code before pushing, use our native Cargo command:

### Fast All-in-One Pre-Flight Check:
```powershell
cargo check-all
```
This runs:
1. `cargo fmt` (automatically formats all Rust source files according to `rustfmt.toml`)
2. `cargo clippy -- -D warnings` (ensures zero lint warnings or compiler warnings)
3. `cargo test` (executes the automated unit test suite)

### Individual Commands:
- **Format Code**: `cargo fmt`
- **Verify Format Without Changes**: `cargo fmt-check` (or `cargo fmt --all --check`)
- **Lint**: `cargo lint` (or `cargo clippy -- -D warnings`)
- **Tests**: `cargo test`

### Dependency & Performance Guidelines:
- Avoid introducing heavyweight dependencies (e.g. OpenSSL, heavy asynchronous runtimes, or external C dependencies) where lightweight, synchronous pure-Rust or native Win32 APIs can be used.
- All code changes must maintain low sim overhead and sub-millisecond responsiveness.

---

## 🤖 4. AI-Generated Content Policy

We embrace AI tools as powerful productivity enhancers for coding, drafting documentation, and generating test fixtures. However, maintaining simulator stability and code quality is paramount:

- **Human Review & Testing is Mandatory**: Any contribution created with the assistance of LLMs or AI coding agents **MUST be thoroughly reviewed, verified, and tested by a human contributor** before submission.
- **Pure Unverified AI Content Will Be Rejected**: Pull requests containing unverified AI-generated code, hallucinated APIs, untested mock routines, or generic filler documentation ("AI slop") will be closed immediately.
- **Maintainer Verification**: The maintainer (`yagiziskirik`) personally tests all contributions on a live Falcon BMS installation and hardware HOTAS setup before merging into `main`.

---

## 🚀 5. Maintainer Release & Delivery Architecture

*(This section is for maintainers cutting releases and curious contributors who want to understand AeroGraph's distribution architecture).*

### Single Source of Truth
AeroGraph's version number is declared in **one place only**:
- **`Cargo.toml`** (`[package] version = "X.Y.Z"`)

All other consumers read this version dynamically at build or compile time:
- **`build.rs`**: Reads `CARGO_PKG_VERSION` environment variables to populate Windows PE resource metadata (`FILEVERSION`, `PRODUCTVERSION`, `FileVersion`). Never edit `build.rs` for version bumps.
- **`installer/setup.iss`**: Receives `/DMyAppVersion` dynamically from the build script and GitHub Actions.
- **`README.md`**: Fetches the latest release dynamically via GitHub Shields badge.

### Building the Standalone Setup Installer Locally
To build and test the setup executable on your local machine:
```powershell
cargo installer
```
This automatically compiles the optimized release executable (`cargo build --release`) first, and then compiles `installer/setup.iss` with Inno Setup. The installer is output to:
```
installer\output\AeroGraph_Setup_v*.exe
```

#### Testing Custom Version Installers:
If you need to test generating an installer for a custom version string without editing `Cargo.toml`:
```powershell
cargo installer --version 0.9.9-test
```
This outputs `installer\output\AeroGraph_Setup_v0.9.9-test.exe`.

### Fleet Auto-Update & GitHub Tag Protection
When an official version tag (`v*.*.*`) is pushed to GitHub, GitHub Actions (`.github/workflows/release.yml`) builds the installer and attaches it to a new GitHub Release.

AeroGraph's in-app updater (`src/updater.rs`) queries `GET /repos/yagiziskirik/AeroGraph/releases/latest` on startup. If a newer release exists, it prompts active pilots to update. To protect live pilot installations from accidental or unauthorized releases:
- Tag creation on `refs/tags/v*` is strictly restricted to the repository maintainer via **GitHub Tag Protection Rules**.
- Contributors cannot push release tags.

### Maintainer Release Workflow (`cargo-release`)
Once all feature PRs for a release are merged into `main`:
1. Check out latest `main`:
   ```powershell
   git checkout main
   git pull origin main
   ```
2. Run a dry run to inspect changes:
   ```powershell
   cargo release patch
   # Or: cargo release minor / cargo release 0.3.0
   ```
3. Execute the release:
   ```powershell
   cargo release patch --execute
   ```
   `cargo-release` will:
   - Run pre-release checks (`cargo check`)
   - Bump `version` in `Cargo.toml` and update `Cargo.lock`
   - Commit `chore(release): vX.Y.Z`
   - Create annotated tag `vX.Y.Z`
   - Push commit and tag to GitHub
4. The GitHub Actions Release workflow will automatically compile the release executable, package `AeroGraph_Setup_vX.Y.Z.exe`, and publish the GitHub Release with attached assets.
