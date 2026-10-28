use crate::kneeboard::models::{BriefingData, Steerpoint};
use std::fs;
use std::path::Path;

/// Injects laser codes and TACAN channels from Comments.txt into package flights.
pub fn inject_comments_into_briefing(data: &mut BriefingData, comments_path: &Path) {
    if !comments_path.exists() {
        return;
    }

    if let Ok(content) = fs::read_to_string(comments_path) {
        let lines: Vec<&str> = content
            .lines()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();
        for (i, flt) in data.package_flights.iter_mut().enumerate() {
            if let Some(line) = lines.get(i) {
                let tokens: Vec<String> = line.split(',').map(|s| s.trim().to_string()).collect();
                flt.laser_tacan = tokens;
            }
        }
    }
}

/// Generates the standard Falcon BMS Laser Code and air-to-air TACAN channel for a given flight and aircraft.
fn default_laser_tacan(flight_idx: usize, ac_idx: usize) -> String {
    let f = flight_idx + 1;
    let a = ac_idx + 1;
    let laser = format!("{}{}", f, a);
    let tacan = match a {
        1 => format!("{}Y", 11 + f),
        2 => format!("{}Y", 21 + f),
        3 => format!("{}Y", 74 + f),
        _ => format!("{}Y", 84 + f),
    };
    format!("{} ({})", laser, tacan)
}

/// Generates Page 1 HTML (Flight Roster & Comm Ladder) matching briefing/style.css.
pub fn generate_briefing_page_1_html(data: &BriefingData) -> String {
    let mut flight_rows = Vec::new();
    let primary_callsign = &data.callsign;

    for (idx, flt) in data.package_flights.iter().enumerate() {
        let is_own = flt.is_primary || flt.callsign.eq_ignore_ascii_case(primary_callsign);
        let row_class = if is_own {
            "ownflight"
        } else if idx % 2 == 0 {
            "even"
        } else {
            "odd"
        };
        let roster_class = if is_own { "ownroster" } else { row_class };

        let flt_num_display =
            if is_own && !flt.flight_num.contains("(x") && !flt.flight_num.contains("(X") {
                format!("{} (x ) ", flt.flight_num)
            } else {
                flt.flight_num.clone()
            };

        // Line 1: Callsign, Flt #, Role, Aircraft, VHF
        flight_rows.push(format!(
            r#"<tr class="{row_class}"><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td></tr>"#,
            flt.callsign, flt_num_display, flt.role, flt.aircraft, flt.vhf
        ));

        // Line 2: Timings
        flight_rows.push(format!(
            r#"<tr class="{row_class}"><td></td><td>T/O: {}</td><td>Push: {}</td><td>Tgt: {}</td><td></td></tr>"#,
            flt.to_time, flt.push_time, flt.tgt_time
        ));

        // Line 3: Pilots (shows only pilots assigned to this flight)
        let mut pilot_cols = Vec::new();
        for (p_idx, pilot) in flt.pilots.iter().enumerate() {
            pilot_cols.push(format!("<td>#{} {}</td>", p_idx + 1, pilot));
        }
        while pilot_cols.len() < 4 {
            pilot_cols.push("<td></td>".to_string());
        }
        flight_rows.push(format!(
            r#"<tr class="{roster_class}"><td></td>{}</tr>"#,
            pilot_cols.join("")
        ));

        // Line 4: Laser / TACAN - matches the EXACT number of aircraft in the flight, with robust default fallback
        let num_ac = flt.pilots.len().max(1);
        let mut lt_cols = Vec::new();
        for ac_i in 0..num_ac {
            let lt = flt
                .laser_tacan
                .get(ac_i)
                .filter(|s| !s.is_empty())
                .cloned()
                .unwrap_or_else(|| default_laser_tacan(idx, ac_i));
            lt_cols.push(format!("<td>{}</td>", lt));
        }
        while lt_cols.len() < 4 {
            lt_cols.push("<td></td>".to_string());
        }
        flight_rows.push(format!(
            r#"<tr class="{roster_class}"><td></td>{}</tr>"#,
            lt_cols.join("")
        ));
    }

    // Fallback flight row if package_flights was empty
    if flight_rows.is_empty() {
        flight_rows.push(format!(
            r#"<tr class="ownflight"><td>{}</td><td>1001 (x )</td><td>{}</td><td>{}</td><td>VHF #15</td></tr>
<tr class="ownflight"><td></td><td>T/O: {}</td><td>Push: {}</td><td>Tgt: {}</td><td></td></tr>
<tr class="ownroster"><td></td><td>#1 {}</td><td></td><td></td><td></td></tr>
<tr class="ownroster"><td></td><td>11 (12Y)</td><td></td><td></td><td></td></tr>"#,
            data.callsign, data.role, data.aircraft, data.to_time, data.push_time, data.tgt_time, data.callsign
        ));
    }

    // Comm ladder rows
    let mut comm_rows = Vec::new();
    for (idx, comm) in data.comm_ladder.iter().enumerate() {
        let cls = if idx % 2 == 0 { "odd" } else { "even" };
        comm_rows.push(format!(
            r#"<tr class="{cls}"><td>{}:</td><td>{}</td><td>{}</td><td>{}</td></tr>"#,
            comm.agency, comm.callsign, comm.uhf, comm.vhf
        ));
    }

    format!(
        r#"<html><head><title>Falcon BMS Mission Briefing</title>
 <link rel="stylesheet" href="style.css" type="text/css" media="screen" />
 <link rel="icon" type="image/png" href="favicon.png" />
</head><body>
<div class="page">
<div class="section">
<table>
<tr><th class="title" colspan="5">Package #{} ({})</th></tr>
<tr class="header" ><th width="12%">Callsign:</th><th width="22%">Flt #:</th><th width="22%">Role:</th><th width="22%">Aircraft:</th><th width="22%">VHF:</th></tr>
{}
</table>
</div>
<div class="section">
<table>
<tr><th class="title" colspan="4">Comm Ladder</th></tr>
<tr class="header" ><th>Agency:</th><th>Callsign:</th><th>UHF [Ch]:</th><th>VHF [Ch]:</th></tr>
{}
</table>
</div>
</div>
</body></html>"#,
        data.pkg_num,
        data.task,
        flight_rows.join("\n"),
        comm_rows.join("\n")
    )
}

/// Calculates the backward minimum fuel ladder from landing (1500 lbs reserve).
pub fn compute_min_fuel_ladder(steerpoints: &[Steerpoint]) -> Vec<String> {
    let n = steerpoints.len();
    if n == 0 {
        return Vec::new();
    }

    let mut fuels: Vec<Option<u32>> = vec![None; n];
    let mut current_fuel = 1500u32;
    fuels[n - 1] = Some(current_fuel);

    for i in (0..n - 1).rev() {
        let next_sp = &steerpoints[i + 1];
        let curr_sp = &steerpoints[i];

        if curr_sp.desc.eq_ignore_ascii_case("refuel")
            || curr_sp.action.to_lowercase().contains("refuel")
        {
            fuels[i] = None;
            continue;
        }

        let dist: f64 = next_sp.dist.parse().unwrap_or(0.0);
        let is_combat_leg = next_sp.desc.to_lowercase().contains("attack")
            || curr_sp.desc.to_lowercase().contains("ip")
            || curr_sp.desc.to_lowercase().contains("attack");

        let leg_burn = if is_combat_leg {
            500 + (dist * 12.0) as u32
        } else {
            (dist * 13.0).max(100.0) as u32
        };

        let burn_rounded = ((leg_burn + 50) / 100) * 100;
        current_fuel += burn_rounded.max(100);
        fuels[i] = Some(current_fuel);
    }

    fuels
        .into_iter()
        .map(|f| match f {
            Some(lbs) => lbs.to_string(),
            None => "--".to_string(),
        })
        .collect()
}

/// Generates Page 2 HTML (Steerpoints & Weather Report) matching briefing/style.css.
pub fn generate_briefing_page_2_html(data: &BriefingData, processed_time: &str) -> String {
    let fuel_ladder = compute_min_fuel_ladder(&data.steerpoints);

    let mut stpt_rows = Vec::new();
    for (idx, sp) in data.steerpoints.iter().enumerate() {
        let cls = if idx % 2 == 0 { "odd" } else { "even" };
        let min_fuel = fuel_ladder.get(idx).map(|s| s.as_str()).unwrap_or("--");

        // Shorten action names matching xbrief conventions
        let act_lower = sp.action.to_lowercase();
        let action_display = if act_lower.contains("climb im") {
            "Climb imdt."
        } else if act_lower.contains("descend im") {
            "Descend imdt."
        } else if act_lower.contains("climb del") {
            "Climb del."
        } else if act_lower.contains("descend del") {
            "Descend del."
        } else {
            &sp.action
        };

        stpt_rows.push(format!(
            r#"<tr class="{cls}"><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td style="text-align:center">{}</td></tr>"#,
            sp.num, sp.desc, sp.time, sp.dist, sp.head, sp.cas, sp.alt, action_display, sp.form, min_fuel
        ));
    }

    let w = data.weather.clone().unwrap_or_default();
    let weather_rows = format!(
        r#"<tr class="even"><td>Situation:</td><td>{}</td><td>{}</td><td>{}</td></tr>
<tr class="odd"><td>Wind:</td><td>{}</td><td>{}</td><td>{}</td></tr>
<tr class="even"><td>Visibility:</td><td>{}</td><td>{}</td><td>{}</td></tr>
<tr class="odd"><td>Temp:</td><td>{}</td><td>{}</td><td>{}</td></tr>
<tr class="even"><td>Cloud Base:</td><td>{}</td><td>{}</td><td>{}</td></tr>
<tr class="odd"><td>Con Layer:</td><td>{}</td><td>{}</td><td>{}</td></tr>"#,
        if !w.to_situation.is_empty() {
            &w.to_situation
        } else {
            "Fair"
        },
        if !w.tgt_situation.is_empty() {
            &w.tgt_situation
        } else {
            "Fair"
        },
        if !w.lnd_situation.is_empty() {
            &w.lnd_situation
        } else {
            "Fair"
        },
        if !w.to_wind.is_empty() {
            &w.to_wind
        } else {
            "265deg@ 15kts."
        },
        if !w.tgt_wind.is_empty() {
            &w.tgt_wind
        } else {
            "265deg@ 15kts."
        },
        if !w.lnd_wind.is_empty() {
            &w.lnd_wind
        } else {
            "265deg@ 15kts."
        },
        if !w.to_visibility.is_empty() {
            &w.to_visibility
        } else {
            "115km"
        },
        if !w.tgt_visibility.is_empty() {
            &w.tgt_visibility
        } else {
            "115km"
        },
        if !w.lnd_visibility.is_empty() {
            &w.lnd_visibility
        } else {
            "115km"
        },
        if !w.to_temp.is_empty() {
            &w.to_temp
        } else {
            "15deg C."
        },
        if !w.tgt_temp.is_empty() {
            &w.tgt_temp
        } else {
            "15deg C."
        },
        if !w.lnd_temp.is_empty() {
            &w.lnd_temp
        } else {
            "15deg C."
        },
        if !w.to_cloud_base.is_empty() {
            &w.to_cloud_base
        } else {
            "5,000 ft MSL base"
        },
        if !w.tgt_cloud_base.is_empty() {
            &w.tgt_cloud_base
        } else {
            "5,000 ft MSL base"
        },
        if !w.lnd_cloud_base.is_empty() {
            &w.lnd_cloud_base
        } else {
            "5,000 ft MSL base"
        },
        if !w.to_con_layer.is_empty() {
            &w.to_con_layer
        } else {
            "28,000 ft MSL base"
        },
        if !w.tgt_con_layer.is_empty() {
            &w.tgt_con_layer
        } else {
            "28,000 ft MSL base"
        },
        if !w.lnd_con_layer.is_empty() {
            &w.lnd_con_layer
        } else {
            "28,000 ft MSL base"
        }
    );

    let gen_time = if !data.timestamp_str.is_empty() {
        &data.timestamp_str
    } else {
        "recent"
    };

    format!(
        r#"<html><head><title>Falcon BMS Mission Briefing</title>
 <link rel="stylesheet" href="style.css" type="text/css" media="screen" />
 <link rel="icon" type="image/png" href="favicon.png" />
</head><body>
<div class="page">
<div class="section">
<table>
<tr><th class="title" colspan="10">Steerpoints</th></tr>
<tr class="header" ><th>#:</th><th>Desc:</th><th>Time:</th><th>Dist:</th><th>Head:</th><th>Cas:</th><th>Alt:</th><th>Action:</th><th>Form:</th><th>Min Fuel:</th></tr>
{}
</table>
</div>
<div class="section">
<table>
<tr><th class="title" colspan="4">Weather</th></tr>
<tr class="header" ><th>Conditions @</th><th>Take Off:</th><th>Target Area:</th><th>Landing:</th></tr>
{}
</table>
</div>
<div class="section"><table><tr><th class="stamp">Briefing generated at {}, processed at {}</th></tr></table></div>
</div>
</body></html>"#,
        stpt_rows.join("\n"),
        weather_rows,
        gen_time,
        processed_time
    )
}
