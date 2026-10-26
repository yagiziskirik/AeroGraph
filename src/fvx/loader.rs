use std::collections::HashSet;
use std::fs::File;
use std::io::{Read, Cursor};
use std::path::{Path, PathBuf};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use flate2::read::GzDecoder;

use crate::fvx::models::FvxProfile;

pub struct LoadedProfile {
    pub profile: FvxProfile,
    pub profile_path: PathBuf,
    pub base_dir: PathBuf,
}

impl LoadedProfile {
    /// Loads a .fvx profile file from disk.
    pub fn load_from_file<P: AsRef<Path>>(path: P) -> Result<Self, Box<dyn std::error::Error>> {
        let path_ref = path.as_ref();
        let mut file = File::open(path_ref)?;
        let mut b64_content = String::new();
        file.read_to_string(&mut b64_content)?;

        let raw_bytes = BASE64.decode(b64_content.trim())?;
        if raw_bytes.len() < 4 {
            return Err("Invalid .fvx file: byte payload too short".into());
        }

        // The first 4 bytes are uncompressed length prefix (little-endian uint32)
        let gzip_data = &raw_bytes[4..];
        let mut decoder = GzDecoder::new(Cursor::new(gzip_data));
        let mut json_str = String::new();
        decoder.read_to_string(&mut json_str)?;

        let profile: FvxProfile = serde_json::from_str(&json_str)?;
        let profile_path = path_ref.to_path_buf();
        let base_dir = profile_path.parent().unwrap_or_else(|| Path::new(".")).to_path_buf();

        Ok(Self {
            profile,
            profile_path,
            base_dir,
        })
    }

    /// Resolves asset paths (e.g. .\VCC\Sounds\... or .\\\\VCC\\... or relative) against the profile base directory.
    pub fn resolve_asset_path(&self, relative_path: &str) -> PathBuf {
        let sanitized = relative_path.replace('\\', "/");
        let path = Path::new(&sanitized);
        if path.is_absolute() && path.exists() {
            return path.to_path_buf();
        }

        // Clean any leading dots, slashes, or backslashes
        let clean = sanitized.trim_start_matches(|c| c == '.' || c == '/');
        let joined = self.base_dir.join(clean);
        if joined.exists() {
            return joined;
        }

        // Search for VCC or Sounds subpaths relative to base_dir
        if let Some(idx) = clean.find("VCC/") {
            let sub = &clean[idx..];
            let cand = self.base_dir.join(sub);
            if cand.exists() {
                return cand;
            }
        }
        if let Some(idx) = clean.find("Sounds/") {
            let sub = &clean[idx..];
            let cand = self.base_dir.join(sub);
            if cand.exists() {
                return cand;
            }
        }

        // Fallback by filename alone in base_dir
        if let Some(fname) = Path::new(&sanitized).file_name() {
            let cand = self.base_dir.join(fname);
            if cand.exists() {
                return cand;
            }
        }

        joined
    }

    /// Dynamically extracts all unique axis variable names referenced in `VariableInputs` across all commands.
    pub fn extract_required_axes(&self) -> HashSet<String> {
        let mut axes = HashSet::new();
        
        // Scan standard command groups
        for cg in &self.profile.CommandGroups {
            for cmd in &cg.Commands {
                if let Some(inputs) = &cmd.VariableInputs {
                    for input in inputs {
                        axes.insert(input.Name.clone());
                    }
                }
            }
        }

        // Scan reactive key command groups
        if let Some(key_groups) = &self.profile.KeyCommandGroups {
            for kg in key_groups {
                for cmd in &kg.Commands {
                    if let Some(inputs) = &cmd.VariableInputs {
                        for input in inputs {
                            axes.insert(input.Name.clone());
                        }
                    }
                }
            }
        }

        axes
    }
}
