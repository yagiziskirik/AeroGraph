use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Steerpoint {
    pub num: u32,
    pub desc: String,
    pub time: String,
    pub dist: String,
    pub head: String,
    pub cas: String,
    pub alt: String,
    pub action: String,
    pub form: String,
    pub comm: String,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub action_code: i32,
}

impl Default for Steerpoint {
    fn default() -> Self {
        Self {
            num: 0,
            desc: String::new(),
            time: "--".to_string(),
            dist: "--".to_string(),
            head: "--".to_string(),
            cas: "--".to_string(),
            alt: "--".to_string(),
            action: "--".to_string(),
            form: "--".to_string(),
            comm: "--".to_string(),
            x: 0.0,
            y: 0.0,
            z: 0.0,
            action_code: 0,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum ThreatKind {
    #[default]
    Sam,
    Tanker,
    Awacs,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Threat {
    pub system: String,
    pub dist_nm: f64,
    pub dir: String,
    pub place: String,
    pub raw: String,
    pub x: f64,
    pub y: f64,
    pub range_nm: f64,
    #[serde(default)]
    pub kind: ThreatKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommAgency {
    pub agency: String,
    pub callsign: String,
    pub uhf: String,
    pub vhf: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PackageFlight {
    pub callsign: String,
    pub flight_num: String,
    pub is_primary: bool,
    pub role: String,
    pub aircraft: String,
    pub task: String,
    pub to_time: String,
    pub push_time: String,
    pub tgt_time: String,
    pub vhf: String,
    pub pilots: Vec<String>,
    pub laser_tacan: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WeatherReport {
    pub to_situation: String,
    pub to_wind: String,
    pub to_visibility: String,
    pub to_temp: String,
    pub to_cloud_base: String,
    pub to_con_layer: String,

    pub tgt_situation: String,
    pub tgt_wind: String,
    pub tgt_visibility: String,
    pub tgt_temp: String,
    pub tgt_cloud_base: String,
    pub tgt_con_layer: String,

    pub lnd_situation: String,
    pub lnd_wind: String,
    pub lnd_visibility: String,
    pub lnd_temp: String,
    pub lnd_cloud_base: String,
    pub lnd_con_layer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BriefingData {
    pub callsign: String,
    pub pkg_num: String,
    pub role: String,
    pub aircraft: String,
    pub task: String,
    pub to_time: String,
    pub push_time: String,
    pub tgt_time: String,
    pub dep_name: Option<String>,
    pub arr_name: Option<String>,
    pub alt_name: Option<String>,
    pub takeoff_wind_deg: i32,
    pub takeoff_wind_kts: i32,
    pub landing_wind_deg: i32,
    pub landing_wind_kts: i32,
    pub steerpoints: Vec<Steerpoint>,
    pub threats: Vec<Threat>,
    pub comm_ladder: Vec<CommAgency>,
    pub package_flights: Vec<PackageFlight>,
    pub weather: Option<WeatherReport>,
    pub timestamp_str: String,
    pub link16_mission_channel: Option<String>,
    pub link16_flight_stn: Option<String>,
}

impl Default for BriefingData {
    fn default() -> Self {
        Self {
            callsign: "VIPER 1".to_string(),
            pkg_num: "1001".to_string(),
            role: "SWEEP".to_string(),
            aircraft: "F-16CM".to_string(),
            task: "SWEEP".to_string(),
            to_time: "--".to_string(),
            push_time: "--".to_string(),
            tgt_time: "--".to_string(),
            dep_name: None,
            arr_name: None,
            alt_name: None,
            takeoff_wind_deg: 0,
            takeoff_wind_kts: 15,
            landing_wind_deg: 0,
            landing_wind_kts: 15,
            steerpoints: Vec::new(),
            threats: Vec::new(),
            comm_ladder: Vec::new(),
            package_flights: Vec::new(),
            weather: None,
            timestamp_str: String::new(),
            link16_mission_channel: None,
            link16_flight_stn: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetSteerpoint {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub action_code: i32,
    pub desc: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunwayEnd {
    pub designator: String,
    #[serde(rename = "headingTrue", default)]
    pub heading_true: f64,
    #[serde(default)]
    pub ils: Option<serde_json::Value>,
    #[serde(default)]
    pub pattern: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Runway {
    pub designator: Option<String>,
    #[serde(rename = "lengthFt", default)]
    pub length_ft: f64,
    #[serde(rename = "widthFt", default)]
    pub width_ft: f64,
    pub surface: Option<String>,
    #[serde(default)]
    pub ends: Vec<RunwayEnd>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Airport {
    pub id: serde_json::Value,
    pub name: String,
    #[serde(rename = "fullName", default)]
    pub full_name: Option<String>,
    pub icao: Option<String>,
    #[serde(rename = "elevationFt", default)]
    pub elevation_ft: Option<i32>,
    pub x: f64,
    pub y: f64,
    #[serde(default)]
    pub runways: Vec<Runway>,
    #[serde(default)]
    pub freqs: Option<serde_json::Value>,
    #[serde(default)]
    pub tacan: Option<serde_json::Value>,
}

#[derive(Debug, Clone)]
pub struct ActiveRunway {
    pub designator: String,
    pub course: f64,
    pub headwind: f64,
    pub crosswind: f64,
    pub diff: f64,
    pub has_ils: bool,
    pub end_obj: RunwayEnd,
    pub rwy_obj: Runway,
}
