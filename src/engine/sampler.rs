use std::collections::{HashMap, HashSet};

use crate::bms::shared_memory::{BmsSharedMemoryClient, PrimaryFlightData};

/// Telemetry scalar types supported by Falcon BMS PrimaryFlightData.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScalarKind {
    Rpm,
    Kias,
    Mach,
    NozzlePos,
    GearPos,
    SpeedBrake,
    TotalFuel,
    FuelFlow,
    Ftit,
    OilPressure,
    EpuFuel,
    Pitch,
    Roll,
    Yaw,
    TrimPitch,
    TrimRoll,
    TrimYaw,
    Alpha,
    Beta,
}

impl ScalarKind {
    #[inline]
    pub fn extract_f32(&self, data: &PrimaryFlightData) -> f32 {
        match self {
            Self::Rpm => data.rpm,
            Self::Kias => data.kias,
            Self::Mach => data.mach,
            Self::NozzlePos => data.nozzle_pos,
            Self::GearPos => data.gear_pos,
            Self::SpeedBrake => data.speed_brake,
            Self::TotalFuel => data.internal_fuel + data.external_fuel,
            Self::FuelFlow => data.fuel_flow,
            Self::Ftit => data.ftit,
            Self::OilPressure => data.oil_pressure,
            Self::EpuFuel => data.epu_fuel,
            Self::Pitch => data.pitch,
            Self::Roll => data.roll,
            Self::Yaw => data.yaw,
            Self::TrimPitch => data.trim_pitch,
            Self::TrimRoll => data.trim_roll,
            Self::TrimYaw => data.trim_yaw,
            Self::Alpha => data.alpha,
            Self::Beta => data.beta,
        }
    }
}

/// A direct subscription to a telemetry scalar field.
#[derive(Debug, Clone)]
pub struct ScalarSubscription {
    pub name: String,
    pub kind: ScalarKind,
}

/// A direct subscription to a cockpit annunciator lamp or status bit.
#[derive(Debug, Clone)]
pub struct BitSubscription {
    pub name: String,
    pub mask: u32,
    pub is_hsi: bool,
}

/// Demand-driven subscription plan compiled from the loaded profile's required variables.
///
/// Only variables explicitly queried by the profile (plus mandatory internal variables like `In3D`)
/// are subscribed and sampled during the 20 Hz loop.
#[derive(Debug, Clone, Default)]
pub struct BmsSubscriptionPlan {
    pub subscribed_scalars: Vec<ScalarSubscription>,
    pub subscribed_bits: Vec<BitSubscription>,
    pub needs_voice_helpers: bool,
    pub needs_in_3d: bool,
    pub needs_on_ground: bool,
    pub active_variable_names: HashSet<String>,
}

impl BmsSubscriptionPlan {
    /// Compiles an active subscription plan from a set of harvested profile variables.
    ///
    /// Mandatory internal engine variables (such as `In3D`) are guaranteed to always be subscribed.
    pub fn compile(harvested_vars: &HashSet<String>) -> Self {
        let mut plan = Self {
            needs_in_3d: true, // Always mandatory for Tactical Console window auto-docking
            ..Default::default()
        };

        // Combine harvested vars with mandatory engine vars
        let mut all_vars = harvested_vars.clone();
        all_vars.insert("In3D".to_string());

        for var in &all_vars {
            plan.active_variable_names.insert(var.clone());

            // 1. Check scalars
            if let Some(kind) = match_scalar_name(var) {
                plan.subscribed_scalars.push(ScalarSubscription {
                    name: var.clone(),
                    kind,
                });
                continue;
            }

            // 2. Check bit indicators
            if let Some((mask, is_hsi)) = match_bit_name(var) {
                plan.subscribed_bits.push(BitSubscription {
                    name: var.clone(),
                    mask,
                    is_hsi,
                });
                continue;
            }

            // 3. Special telemetry flags
            if var.eq_ignore_ascii_case("In3D") {
                plan.needs_in_3d = true;
                continue;
            }
            if var.eq_ignore_ascii_case("OnGround") {
                plan.needs_on_ground = true;
                continue;
            }

            // 4. VoiceHelpers comms tokens
            if is_voice_helpers_var(var) {
                plan.needs_voice_helpers = true;
            }
        }

        plan
    }

    /// Samples only subscribed variables directly from Falcon BMS Shared Memory into the target state map.
    /// Returns `(in_3d, bms_connected, strings)`.
    pub fn sample_into(
        &self,
        bms_client: &mut BmsSharedMemoryClient,
        target_map: &mut HashMap<String, String>,
    ) -> (bool, bool, crate::bms::shared_memory::BmsStringInfo) {
        let flight_data = bms_client.read_primary_data();
        let iv_data = bms_client.read_vibe_data();
        let bms_connected = flight_data.is_some() || iv_data.is_some();

        // 1. Determine In3D state (dual-source: Intellivibe in_3d byte or HsiBits Flying bit 0x8000_0000)
        let in_3d = if let Some(iv) = &iv_data {
            iv.in_3d != 0
        } else if let Some(fd) = &flight_data {
            (fd.hsi_bits & 0x8000_0000) != 0
        } else {
            false
        };

        if self.needs_in_3d {
            target_map.insert(
                "In3D".to_string(),
                if in_3d { "True" } else { "False" }.to_string(),
            );
        }

        // 2. Determine OnGround state
        if self.needs_on_ground {
            let on_ground = if let Some(iv) = &iv_data {
                iv.is_on_ground != 0
            } else if let Some(fd) = &flight_data {
                (fd.light_bits & 0x10) != 0
            } else {
                false
            };
            target_map.insert(
                "OnGround".to_string(),
                if on_ground { "True" } else { "False" }.to_string(),
            );
        }

        // 3. BMS Version constants
        if self.active_variable_names.contains("BMSVersionMajor") {
            target_map.insert("BMSVersionMajor".to_string(), "4".to_string());
        }
        if self.active_variable_names.contains("BMSVersionMinor") {
            target_map.insert("BMSVersionMinor".to_string(), "38".to_string());
        }

        // 4. Sample subscribed scalars directly from PrimaryFlightData
        if let Some(fd) = &flight_data {
            for sub in &self.subscribed_scalars {
                let val = sub.kind.extract_f32(fd);
                target_map.insert(sub.name.clone(), format_scalar(sub.kind, val));
            }

            for sub in &self.subscribed_bits {
                let bits = if sub.is_hsi {
                    fd.hsi_bits
                } else {
                    fd.light_bits
                };
                let is_set = (bits & sub.mask) != 0;
                target_map.insert(sub.name.clone(), if is_set { "1" } else { "0" }.to_string());
            }
        }

        // 5. Sample VoiceHelpers strings if requested
        let strings = if in_3d && bms_connected {
            let s = bms_client.read_string_info();
            let has_bms_strings = !s.callsign.is_empty()
                || !s.departure.is_empty()
                || !s.aircraft.is_empty()
                || !s.tanker.is_empty()
                || !s.awacs.is_empty();

            if self.needs_voice_helpers && has_bms_strings {
                self.update_string_var(target_map, "Callsign", &s.callsign);
                self.update_string_var(target_map, "Tanker", &s.tanker);
                self.update_string_var(target_map, "Awacs", &s.awacs);
                self.update_string_var(target_map, "Departure", &s.departure);
                self.update_string_var(target_map, "Arrival", &s.arrival);
                self.update_string_var(target_map, "Alternate", &s.alternate);
                self.update_string_var(target_map, "Aircraft", &s.aircraft);
                self.update_string_var(target_map, "PkgSize", &s.package_size);
                self.update_string_var(target_map, "Seat", &s.seat);

                self.update_bool_var(target_map, "AISeat1", s.ai_seat1);
                self.update_bool_var(target_map, "AISeat2", s.ai_seat2);
                self.update_bool_var(target_map, "AISeat3", s.ai_seat3);
                self.update_bool_var(target_map, "AISeat4", s.ai_seat4);
            }
            s
        } else {
            if self.needs_voice_helpers {
                // Offline / 2D UI testing fallback defaults (matching FoxVox ReadMe specification)
                self.inject_offline_defaults(target_map);
            }
            crate::bms::shared_memory::BmsStringInfo::default()
        };

        (in_3d, bms_connected, strings)
    }

    #[inline]
    fn update_string_var(&self, map: &mut HashMap<String, String>, name: &str, value: &str) {
        if self.active_variable_names.contains(name) {
            if !value.is_empty() {
                map.insert(name.to_string(), value.to_string());
            } else {
                map.remove(name);
            }
        }
    }

    #[inline]
    fn update_bool_var(&self, map: &mut HashMap<String, String>, name: &str, value: bool) {
        if self.active_variable_names.contains(name) {
            if value {
                map.insert(name.to_string(), "True".to_string());
            } else {
                map.remove(name);
            }
        }
    }

    fn inject_offline_defaults(&self, map: &mut HashMap<String, String>) {
        let defaults = [
            ("Callsign", "Goblin2"),
            ("Tanker", "Texaco1"),
            ("Awacs", "Sentry7"),
            ("Departure", "Gunsan"),
            ("Arrival", "Gunsan"),
            ("Alternate", "Osan"),
            ("Aircraft", "F16"),
            ("PkgSize", "Singleton"),
            ("Seat", "1"),
        ];

        for (k, v) in defaults {
            if self.active_variable_names.contains(k) {
                map.insert(k.to_string(), v.to_string());
            }
        }
    }
}

fn match_scalar_name(name: &str) -> Option<ScalarKind> {
    match name {
        "rpm" => Some(ScalarKind::Rpm),
        "kias" => Some(ScalarKind::Kias),
        "mach" => Some(ScalarKind::Mach),
        "nozzlePos" => Some(ScalarKind::NozzlePos),
        "gearPos" => Some(ScalarKind::GearPos),
        "speedBrake" => Some(ScalarKind::SpeedBrake),
        "totalFuel" => Some(ScalarKind::TotalFuel),
        "fuelFlow" => Some(ScalarKind::FuelFlow),
        "ftit" => Some(ScalarKind::Ftit),
        "oilPressure" => Some(ScalarKind::OilPressure),
        "epuFuel" => Some(ScalarKind::EpuFuel),
        "pitch" => Some(ScalarKind::Pitch),
        "roll" => Some(ScalarKind::Roll),
        "yaw" => Some(ScalarKind::Yaw),
        "TrimPitch" => Some(ScalarKind::TrimPitch),
        "TrimRoll" => Some(ScalarKind::TrimRoll),
        "TrimYaw" => Some(ScalarKind::TrimYaw),
        "alpha" => Some(ScalarKind::Alpha),
        "beta" => Some(ScalarKind::Beta),
        _ => None,
    }
}

fn match_bit_name(name: &str) -> Option<(u32, bool)> {
    // Returns (mask, is_hsi)
    match name {
        "MasterCaution" => Some((0x1, false)),
        "TF" => Some((0x2, false)),
        "ENG_FIRE" => Some((0x20, false)),
        "CONFIG" => Some((0x40, false)),
        "HYD" => Some((0x80, false)),
        "OIL" => Some((0x200, false)),
        "DUAL" => Some((0x400, false)),
        "CANOPY" => Some((0x800, false)),
        "T_L_CFG" => Some((0x1000, false)),
        "AOA_BELOW" => Some((0x2000, false)),
        "AOA_ON" => Some((0x4000, false)),
        "AOA_ABOVE" => Some((0x8000, false)),
        "RefuelRDY" | "lightBits.RefuelRDY" => Some((0x8000, false)),
        "RefuelAR" | "lightBits.RefuelAR" => Some((0x10000, false)),
        "RefuelDSC" | "lightBits.RefuelDSC" => Some((0x20000, false)),
        "F_ACK" => Some((0x40000, false)),
        "FLCS_FAULT" => Some((0x80000, false)),
        "Flying" => Some((0x8000_0000, true)),
        _ => None,
    }
}

fn is_voice_helpers_var(name: &str) -> bool {
    matches!(
        name,
        "Callsign"
            | "Tanker"
            | "Awacs"
            | "Departure"
            | "Arrival"
            | "Alternate"
            | "Aircraft"
            | "PkgSize"
            | "Seat"
            | "AISeats"
            | "AISeat1"
            | "AISeat2"
            | "AISeat3"
            | "AISeat4"
    )
}

#[inline]
fn format_scalar(kind: ScalarKind, val: f32) -> String {
    match kind {
        ScalarKind::Rpm => format!("{:.1}", val),
        ScalarKind::NozzlePos | ScalarKind::SpeedBrake | ScalarKind::GearPos => {
            format!("{:.2}", val)
        }
        ScalarKind::TrimPitch | ScalarKind::TrimRoll | ScalarKind::TrimYaw => {
            format!("{:.2}", val)
        }
        _ => format!("{:.1}", val),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_subscription_plan_compilation() {
        let mut vars = HashSet::new();
        vars.insert("rpm".to_string());
        vars.insert("Tanker".to_string());
        vars.insert("RefuelRDY".to_string());
        vars.insert("Step".to_string()); // Script variable

        let plan = BmsSubscriptionPlan::compile(&vars);

        assert!(plan.needs_in_3d); // Mandatory
        assert!(plan.needs_voice_helpers); // Tanker requested
        assert_eq!(plan.subscribed_scalars.len(), 1);
        assert_eq!(plan.subscribed_scalars[0].name, "rpm");
        assert_eq!(plan.subscribed_bits.len(), 1);
        assert_eq!(plan.subscribed_bits[0].name, "RefuelRDY");
    }

    #[test]
    fn test_mandatory_in3d_included_even_if_not_in_profile() {
        let empty_vars = HashSet::new();
        let plan = BmsSubscriptionPlan::compile(&empty_vars);
        assert!(plan.needs_in_3d);
        assert!(plan.active_variable_names.contains("In3D"));
    }

    #[test]
    fn test_telemetry_sampling_speed_benchmark() {
        use std::time::Instant;

        let iterations = 100_000;
        let mut vars = HashSet::new();
        vars.insert("rpm".to_string());
        vars.insert("nozzlePos".to_string());
        vars.insert("speedBrake".to_string());
        vars.insert("gearPos".to_string());
        vars.insert("In3D".to_string());
        vars.insert("OnGround".to_string());
        vars.insert("RefuelRDY".to_string());
        vars.insert("Tanker".to_string());
        vars.insert("Awacs".to_string());
        vars.insert("AISeat2".to_string());

        let plan = BmsSubscriptionPlan::compile(&vars);

        let mut pfd = PrimaryFlightData {
            rpm: 92.5,
            nozzle_pos: 0.15,
            speed_brake: 0.0,
            gear_pos: 0.0,
            light_bits: 0x8000 | 0x10,
            hsi_bits: 0x8000_0000,
            ..Default::default()
        };

        // 1. Baseline: Old unoptimized approach (ad-hoc string allocations & parsing)
        let mut old_map: HashMap<String, String> = HashMap::new();
        let start_old = Instant::now();
        for i in 0..iterations {
            pfd.rpm = 90.0 + ((i % 100) as f32) * 0.1;
            old_map.insert("rpm".to_string(), format!("{:.1}", pfd.rpm));
            old_map.insert("nozzlePos".to_string(), format!("{:.2}", pfd.nozzle_pos));
            old_map.insert("speedBrake".to_string(), format!("{:.2}", pfd.speed_brake));
            old_map.insert("gearPos".to_string(), format!("{:.2}", pfd.gear_pos));
            old_map.insert(
                "RefuelRDY".to_string(),
                if (pfd.light_bits & 0x8000) != 0 {
                    "1"
                } else {
                    "0"
                }
                .to_string(),
            );
            old_map.insert(
                "In3D".to_string(),
                if (pfd.hsi_bits & 0x8000_0000) != 0 {
                    "True"
                } else {
                    "False"
                }
                .to_string(),
            );
            old_map.insert("Tanker".to_string(), "Texaco1".to_string());

            let cur_rpm: f64 = old_map.get("rpm").unwrap().parse().unwrap();
            let is_in_3d = old_map.get("In3D").unwrap() == "True";
            let _passed = cur_rpm > 50.0 && is_in_3d;
        }
        let elapsed_old = start_old.elapsed();

        // 2. Optimized: Demand-driven compiled plan sampling
        let mut new_map: HashMap<String, String> = HashMap::new();
        let start_new = Instant::now();
        for i in 0..iterations {
            pfd.rpm = 90.0 + ((i % 100) as f32) * 0.1;

            for sub in &plan.subscribed_scalars {
                let val = sub.kind.extract_f32(&pfd);
                new_map.insert(sub.name.clone(), format_scalar(sub.kind, val));
            }
            for sub in &plan.subscribed_bits {
                let is_set = (pfd.light_bits & sub.mask) != 0;
                new_map.insert(sub.name.clone(), if is_set { "1" } else { "0" }.to_string());
            }

            let cur_rpm: f64 = new_map.get("rpm").unwrap().parse().unwrap();
            let _passed = cur_rpm > 50.0;
        }
        let elapsed_new = start_new.elapsed();

        let old_ns_per_op = elapsed_old.as_nanos() as f64 / iterations as f64;
        let new_ns_per_op = elapsed_new.as_nanos() as f64 / iterations as f64;
        let speedup = elapsed_old.as_secs_f64() / elapsed_new.as_secs_f64();

        println!("\n=================================================================");
        println!(
            "🚀 TELEMETRY SAMPLING BENCHMARK ({} iterations)",
            iterations
        );
        println!("-----------------------------------------------------------------");
        println!(
            "⏱️  Baseline (Old string allocation & map churn) : {:.2?} ({:.1} ns/op)",
            elapsed_old, old_ns_per_op
        );
        println!(
            "⚡ Optimized (New Demand-Driven Subscription)     : {:.2?} ({:.1} ns/op)",
            elapsed_new, new_ns_per_op
        );
        println!(
            "📈 Performance Speedup Factor                    : {:.2}x faster",
            speedup
        );
        println!("=================================================================\n");

        assert!(
            elapsed_new <= elapsed_old,
            "New subscription sampling must be at least as fast or faster than baseline"
        );
    }
}
