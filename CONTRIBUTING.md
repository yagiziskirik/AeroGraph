# Contributing to AeroGraph

Thank you for your interest in contributing to **AeroGraph**! Whether you are reporting a bug, proposing a new cockpit checklist template, or optimizing the rendering engine, we welcome your contributions.

Please review this guide before submitting issues or pull requests. For a technical overview of how AeroGraph integrates with Falcon BMS and Windows flight hardware, consult the [System Architecture Guide](docs/ARCHITECTURE.md).

---

## 🛠️ 1. Prerequisites & Local Environment Setup

Before building AeroGraph locally, ensure you have the following installed:

1. **Rust Toolchain (Stable 1.75+)**:
   ```powershell
   rustup update stable
   rustup component add rustfmt clippy
   ```
2. **Node.js (v18+) & pnpm (v9+)**:
   Required to develop, compile, and package the Next.js Tactical Avionics Console GUI:
   ```powershell
   winget install OpenJS.NodeJS.LTS
   corepack enable
   corepack prepare pnpm@latest --activate
   ```
3. **Windows SDK**:
   Required for `rc.exe` (resource compiler used to embed icon and application metadata into Windows PE binaries). Usually installed automatically with Visual Studio Build Tools / C++ desktop workload.
4. **Inno Setup 6**:
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
2. **Understand the architecture and make your changes**:
   Consult [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for subsystem boundaries, the kneeboard `.dds` rendering pipeline, and threading model. Keep the scope of changes focused.
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

## 🖥️ 3. Tactical Avionics Console (UI) Development Workflow

AeroGraph's Tactical Avionics Console GUI is built as a high-performance Next.js application located in the [`ui/`](ui/) directory:
- **Stack**: Next.js 14, React 18, Tailwind CSS, Framer Motion, and Lucide Icons.
- **Packaging Model**: Statically exported into HTML/CSS/JS (`ui/out/`) and embedded directly into the final standalone Windows binary (`rust-embed`), requiring zero Node.js runtime on end-user machines.

### 1. Install Frontend Dependencies
```powershell
pnpm --dir ui install
```

### 2. Interactive Frontend Dev Server
```powershell
pnpm --dir ui dev
```
Starts the Next.js development server at `http://localhost:3000`. The frontend includes mock IPC telemetry and state simulation, allowing full UI design, responsive layout verification, and animation tuning directly in any modern browser without needing to launch Falcon BMS.

### 3. Frontend Linting & Typechecking
Before building the backend, verify TypeScript types and ESLint conformance:
```powershell
pnpm --dir ui tsc --noEmit
pnpm --dir ui lint
```

### 4. Build & Export Static Assets (`cargo ui-build`)
To compile and package the Next.js static assets for embedding into the Rust binary:
```powershell
cargo ui-build
```
> [!TIP]
> `cargo ui-build` is a native Cargo alias configured in `.cargo/config.toml` that invokes `src/bin/xtask.rs ui-build`. It exports the optimized web application to `ui/out/`. Subsequent Rust builds (`cargo build` or `cargo build --release`) automatically link these compiled static assets directly into `aerograph.exe`.

### 5. Local Binary Build & Testing Workflow

After generating the static UI assets with `cargo ui-build`, compile the backend Rust binary using standard Cargo commands:

- **Debug Build** (fast compilation with debug symbols):
  ```powershell
  cargo build
  ```
  Generates `target\debug\aerograph.exe`.

- **Release Build** (optimized for live flight sim usage):
  ```powershell
  cargo build --release
  ```
  Generates `target\release\aerograph.exe`.

#### Rapid Local Testing (Moving Executable to Root):
The recommended workflow for testing AeroGraph locally is to run the compiled `.exe` directly from the main project root folder (`.\AeroGraph.exe`). This ensures it operates against live local resources (`assets\`, `images\`, `notes\`, and local `kneeboards.json`):

```powershell
# Automated: compiles release binary and deploys to .\AeroGraph.exe
cargo local

# Or for debug profile:
cargo local -- --debug

# Manual alternative via PowerShell:
cargo build --release
Copy-Item target\release\aerograph.exe .\AeroGraph.exe
```

> [!IMPORTANT]
> **Ensure AeroGraph is Closed Before Deploying**:  
> If `AeroGraph.exe` is currently running, Windows will lock the executable file and prevent overwriting with a `SharingViolation` error. `cargo local` automatically verifies the target file is writable before copying. Always close any running instance from the system tray or Task Manager before copying.

---

## 🧪 4. Pre-Flight Quality Checks & Cargo Aliases

AeroGraph enforces strict code quality and formatting. CI will automatically check formatting, linting with Clippy, and run unit tests on every pull request.

AeroGraph provides native Cargo aliases configured in `.cargo/config.toml` for seamless local development:

| Command | Purpose |
| :--- | :--- |
| `cargo check-all` | Runs `fmt`, `clippy -D warnings`, and the complete unit test suite. |
| `cargo ui-build` | Compiles and exports the Next.js Tactical Console into `ui/out/`. |
| `cargo local` | Compiles `--release` binary and deploys directly to `./AeroGraph.exe`. |
| `cargo installer` | Compiles the release binary and packages the Inno Setup installer. |
| `cargo lint` | Runs `cargo clippy -- -D warnings`. |
| `cargo fmt-check` | Verifies code formatting without altering files. |
| `cargo test` | Executes backend Rust unit tests. |

### Fast All-in-One Pre-Flight Check:
```powershell
cargo check-all
```

### Dependency & Performance Guidelines:
- Avoid introducing heavyweight dependencies (e.g. OpenSSL, heavy asynchronous runtimes, or external C dependencies) where lightweight, synchronous pure-Rust or native Win32 APIs can be used.
- All code changes must maintain low sim overhead and sub-millisecond responsiveness.

---

## 🤖 5. AI-Generated Content Policy

We embrace AI tools as powerful productivity enhancers for coding, drafting documentation, and generating test fixtures. However, maintaining simulator stability and code quality is paramount:

- **Human Review & Testing is Mandatory**: Any contribution created with the assistance of LLMs or AI coding agents **MUST be thoroughly reviewed, verified, and tested by a human contributor** before submission.
- **Pure Unverified AI Content Will Be Rejected**: Pull requests containing unverified AI-generated code, hallucinated APIs, untested mock routines, or generic filler documentation ("AI slop") will be closed immediately.
- **Maintainer Verification**: The maintainer (`yagiziskirik`) personally tests all contributions on a live Falcon BMS installation and hardware HOTAS setup before merging into `main`.

---

## 🚀 6. Maintainer Release & Delivery Architecture

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
