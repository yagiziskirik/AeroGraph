## Description
Briefly explain the purpose of this Pull Request and the changes introduced.

Fixes #(issue number, if applicable)

## Type of Change
- [ ] `feat`: New feature (non-breaking change which adds user functionality)
- [ ] `fix`: Bug fix (non-breaking change which fixes an issue)
- [ ] `perf`: Performance optimization (improves generation time, memory, or caching)
- [ ] `docs`: Documentation update (README, CONTRIBUTING, notes)
- [ ] `refactor`: Code refactoring without changing functionality
- [ ] `chore` / `build`: Build system, CI, or dependency improvement

## Testing & Verification
Describe the tests you ran to verify your changes:
- [ ] Ran `cargo check-all` (auto-formatting, Clippy with 0 warnings, unit tests passed)
- [ ] Tested live with Falcon BMS 4.38
- [ ] Verified kneeboard rendering in 3D cockpit
- [ ] Verified voice engine / DirectInput sampling (if applicable)

## Checklist:
- [ ] My commit messages adhere to [Conventional Commits](https://www.conventionalcommits.org/) (e.g. `feat:`, `fix:`)
- [ ] I have **NOT modified version numbers** in `Cargo.toml` (releases are cut only on `main`)
- [ ] I have performed a self-review of my code
- [ ] I have commented my code where necessary
- [ ] I have updated documentation accordingly (if applicable)
- [ ] My changes pass with zero warnings or compiler errors
