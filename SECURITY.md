# Security Policy

## Supported Versions

AeroGraph follows a rolling update model. Security patches, vulnerability mitigations, and compatibility fixes are provided for the active minor series and latest release.

| Version | Supported | Notes |
| :--- | :---: | :--- |
| **Latest Release (`>= 0.2.x`)** | :white_check_mark: | Actively supported with automatic update notifications. |
| **`< 0.2.0`** | :x: | End of life. Please update to the latest release. |

AeroGraph includes a built-in update check on launch that prompts users when a newer secure version is published. Pilots are encouraged to update promptly when notified.

---

## Reporting a Vulnerability

The AeroGraph maintainers take the security of simulated flight software and Windows desktop integration seriously.

If you believe you have found a security vulnerability in AeroGraph (such as unsafe native Windows memory access, updater MITM exposure, or arbitrary code execution):

1. **Do NOT open a public GitHub Issue.**
2. Report the vulnerability privately via contacting the maintainer directly via [this email](mailto:yagiz@iskirik.com).

### What to Include in Your Report:
- A description of the vulnerability and its potential impact.
- Clear steps to reproduce the issue (proof of concept script, malformed briefing file, or specific sim environment state).
- The version of AeroGraph and Windows OS on which the issue was observed.

### Response Timeline:
- **Initial Acknowledgment**: Within 48 hours.
- **Assessment & Fix**: We will work to verify the vulnerability and produce a patch in a timely manner.
- **Coordinated Disclosure**: Once a patch is built, tested, and released as an updated installer, a public advisory will be published with credit to the reporter.
