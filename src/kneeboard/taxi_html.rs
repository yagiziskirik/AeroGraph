use super::models::{ActiveRunway, Airport};

pub fn generate_taxi_chart_html(
    airport: &Airport,
    airfield: &serde_json::Value,
    active_runways: &[ActiveRunway],
    wind_deg: i32,
    wind_kts: i32,
    is_departure: bool,
) -> String {
    let ap_name = airport.name.to_uppercase();
    let icao = airport.icao.as_deref().unwrap_or("");
    let elev = airport.elevation_ft.unwrap_or(0);

    let freqs = airport.freqs.as_ref();
    let tacan = airport.tacan.as_ref();

    let active_desigs: Vec<String> = active_runways.iter().map(|a| a.designator.clone()).collect();
    let active_str = if active_desigs.is_empty() {
        "CALM".to_string()
    } else {
        active_desigs.join(" & ")
    };

    let empty_arr = Vec::new();
    let paved_rings: Vec<Vec<f64>> = airfield.get("paved")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter().filter_map(|ring| {
                ring.as_array().map(|coords| {
                    coords.iter().filter_map(|c| c.as_f64()).collect::<Vec<f64>>()
                })
            }).collect()
        }).unwrap_or_else(|| Vec::new());

    let routes_list = airfield.get("routes").and_then(|v| v.as_array()).unwrap_or(&empty_arr);
    let features_list = airfield.get("features").and_then(|v| v.as_array()).unwrap_or(&empty_arr);
    let runways_list = airfield.get("runways").and_then(|v| v.as_array()).unwrap_or(&empty_arr);

    // Step 0: Check airport orientation.
    let mut raw_e0 = f64::INFINITY;
    let mut raw_e1 = f64::NEG_INFINITY;
    let mut raw_n0 = f64::INFINITY;
    let mut raw_n1 = f64::NEG_INFINITY;

    for r in runways_list {
        if let Some(corners) = r.get("corners").and_then(|v| v.as_array()) {
            for c in corners {
                let ce = c.get("e").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let cn = c.get("n").and_then(|v| v.as_f64()).unwrap_or(0.0);
                raw_e0 = raw_e0.min(ce); raw_e1 = raw_e1.max(ce);
                raw_n0 = raw_n0.min(cn); raw_n1 = raw_n1.max(cn);
            }
        }
    }
    for route in routes_list {
        if let Some(nodes) = route.get("nodes").and_then(|v| v.as_array()) {
            for nd in nodes {
                let ne = nd.get("e").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let nn = nd.get("n").and_then(|v| v.as_f64()).unwrap_or(0.0);
                raw_e0 = raw_e0.min(ne); raw_e1 = raw_e1.max(ne);
                raw_n0 = raw_n0.min(nn); raw_n1 = raw_n1.max(nn);
            }
        }
    }

    if raw_e0.is_infinite() {
        raw_e0 = -1000.0; raw_e1 = 1000.0;
        raw_n0 = -1000.0; raw_n1 = 1000.0;
    }

    let raw_ew_span = raw_e1 - raw_e0;
    let raw_ns_span = raw_n1 - raw_n0;

    let rotate_90 = raw_ew_span > (raw_ns_span * 1.05);
    let chart_rot_deg = if rotate_90 { 270 } else { 0 };

    let rot_coord = |e: f64, n: f64| -> (f64, f64) {
        if rotate_90 {
            (-n, e)
        } else {
            (e, n)
        }
    };

    // Parking spots info
    let route_0 = routes_list.first();
    let parking_spots = route_0.and_then(|r| r.get("parking")).and_then(|v| v.as_array()).unwrap_or(&empty_arr);
    let r0_nodes = route_0.and_then(|r| r.get("nodes")).and_then(|v| v.as_array()).unwrap_or(&empty_arr);

    struct SpotRot {
        n: i64,
        is_alert: bool,
        e: f64,
        n_coord: f64,
        te: f64,
        tn: f64,
    }

    let mut spots_rot = Vec::new();
    for sp in parking_spots {
        let k = sp.get("k").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
        if k < r0_nodes.len() {
            let pnode = &r0_nodes[k];
            let pe = pnode.get("e").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let pn = pnode.get("n").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let (te, tn) = rot_coord(pe, pn);
            spots_rot.push(SpotRot {
                n: sp.get("n").and_then(|v| v.as_i64()).unwrap_or(0),
                is_alert: sp.get("q").and_then(|v| v.as_i64()).unwrap_or(0) != 0,
                e: pe,
                n_coord: pn,
                te,
                tn,
            });
        }
    }

    let rwy_ends_count: usize = airport.runways.iter().map(|r| r.ends.len()).sum();
    let footer_table_h = 48 + (rwy_ends_count * 40);
    let map_h = 550.max(1532 - 302 - footer_table_h as i32);

    let svg_w = 992.0;
    let svg_h = map_h as f64;
    let pad = 250.0;

    let mut e0 = f64::INFINITY;
    let mut e1 = f64::NEG_INFINITY;
    let mut n0 = f64::INFINITY;
    let mut n1 = f64::NEG_INFINITY;
    let mut all_op_pts = Vec::new();

    let see = |e: f64, n: f64, e0: &mut f64, e1: &mut f64, n0: &mut f64, n1: &mut f64| {
        let (te, tn) = rot_coord(e, n);
        *e0 = (*e0).min(te); *e1 = (*e1).max(te);
        *n0 = (*n0).min(tn); *n1 = (*n1).max(tn);
    };

    for r in runways_list {
        if let Some(corners) = r.get("corners").and_then(|v| v.as_array()) {
            for c in corners {
                let ce = c.get("e").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let cn = c.get("n").and_then(|v| v.as_f64()).unwrap_or(0.0);
                see(ce, cn, &mut e0, &mut e1, &mut n0, &mut n1);
                all_op_pts.push(rot_coord(ce, cn));
            }
        }
    }

    for route in routes_list {
        if let Some(nodes) = route.get("nodes").and_then(|v| v.as_array()) {
            for nd in nodes {
                let ne = nd.get("e").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let nn = nd.get("n").and_then(|v| v.as_f64()).unwrap_or(0.0);
                see(ne, nn, &mut e0, &mut e1, &mut n0, &mut n1);
                all_op_pts.push(rot_coord(ne, nn));
            }
        }
    }

    if e0.is_finite() {
        let op_margin = 800.0;
        for ring in &paved_rings {
            for i in (0..ring.len()).step_by(2) {
                let pe = ring[i];
                let pn = ring[i + 1];
                let (te, tn) = rot_coord(pe, pn);
                if (e0 - op_margin) <= te && te <= (e1 + op_margin) && (n0 - op_margin) <= tn && tn <= (n1 + op_margin) {
                    see(pe, pn, &mut e0, &mut e1, &mut n0, &mut n1);
                }
            }
        }
    } else {
        for ring in &paved_rings {
            for i in (0..ring.len()).step_by(2) {
                see(ring[i], ring[i + 1], &mut e0, &mut e1, &mut n0, &mut n1);
            }
        }
    }

    if e0.is_infinite() {
        e0 = -1000.0; e1 = 1000.0;
        n0 = -1000.0; n1 = 1000.0;
    }

    e0 -= pad; e1 += pad;
    n0 -= pad; n1 += pad;

    let dx = e1 - e0;
    let dy = n1 - n0;

    let scale_full = ((svg_w - 70.0) / dx).min((svg_h - 60.0) / dy);
    let mut ol_count = 0;
    for i in 0..spots_rot.len() {
        let mut min_dist = f64::INFINITY;
        for j in 0..spots_rot.len() {
            if i != j {
                let d = ((spots_rot[i].te - spots_rot[j].te).hypot(spots_rot[i].tn - spots_rot[j].tn)) * scale_full;
                min_dist = min_dist.min(d);
            }
        }
        if min_dist < 15.0 {
            ol_count += 1;
        }
    }
    let ol_ratio = if !spots_rot.is_empty() { ol_count as f64 / spots_rot.len() as f64 } else { 0.0 };
    let has_inset = spots_rot.len() >= 12 && !(spots_rot.len() < 42 && ol_ratio < 0.35);

    let (scale, ox, oy) = if has_inset {
        let max_ap_w = 460.0;
        let scale = (max_ap_w / dx).min((svg_h - 60.0) / dy);
        let oy = 30.0 + (svg_h - 60.0 - dy * scale) / 2.0;

        let mut min_ox = 22.0f64;
        for (te, tn) in &all_op_pts {
            let y_val = oy + (n1 - tn) * scale;
            let req_x = if y_val < 235.0 { 122.0 } else { 22.0 };
            let cand_ox = req_x - (te - e0) * scale;
            if cand_ox > min_ox {
                min_ox = cand_ox;
            }
        }
        (scale, min_ox, oy)
    } else {
        let scale = ((svg_w - 70.0) / dx).min((svg_h - 60.0) / dy);
        let ox = 35.0 + (svg_w - 70.0 - dx * scale) / 2.0;
        let oy = 30.0 + (svg_h - 60.0 - dy * scale) / 2.0;
        (scale, ox, oy)
    };

    let coord_x = |e: f64, n: f64| -> f64 {
        let (te, _) = rot_coord(e, n);
        ox + (te - e0) * scale
    };

    let coord_y = |e: f64, n: f64| -> f64 {
        let (_, tn) = rot_coord(e, n);
        oy + (n1 - tn) * scale
    };

    let mut svg_parts = Vec::new();

    // 1. Paved areas
    for ring in &paved_rings {
        if ring.len() < 6 {
            continue;
        }
        let mut d = format!("M {:.1} {:.1}", coord_x(ring[0], ring[1]), coord_y(ring[0], ring[1]));
        for i in (2..ring.len()).step_by(2) {
            d.push_str(&format!(" L {:.1} {:.1}", coord_x(ring[i], ring[i + 1]), coord_y(ring[i], ring[i + 1])));
        }
        d.push_str(" Z");
        svg_parts.push(format!("<path d='{}' fill='#CBD3DA' fill-rule='evenodd' stroke='#8A96A0' stroke-width='1.2'/>", d));
    }

    // 2. Features / Buildings
    for f in features_list {
        let k = f.get("k").and_then(|v| v.as_str()).unwrap_or("");
        let e = f.get("e").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let n = f.get("n").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let w = f.get("w").and_then(|v| v.as_f64()).unwrap_or(60.0);
        let l = f.get("l").and_then(|v| v.as_f64()).unwrap_or(60.0);
        let h = f.get("h").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let cx = coord_x(e, n);
        let cy = coord_y(e, n);
        let fw = (w * scale).max(2.5);
        let fl = (l * scale).max(2.5);
        let rot_h = (h + chart_rot_deg as f64).rem_euclid(360.0);

        if k == "tower" {
        svg_parts.push(format!("<circle cx='{:.1}' cy='{:.1}' r='11' fill='#673AB7' stroke='#311B92' stroke-width='2'/>", cx, cy));
        svg_parts.push(format!("<rect x='{:.1}' y='{:.1}' width='32' height='15' rx='3' fill='#311B92'/>", cx - 16.0, cy - 22.0));
        svg_parts.push(format!("<text x='{:.1}' y='{:.1}' font-family='Arial, sans-serif' font-weight='900' font-size='11' fill='#FFFFFF' text-anchor='middle'>TWR</text>", cx, cy - 11.0));
        } else if k == "shelter" {
        svg_parts.push(format!("<rect x='{:.1}' y='{:.1}' width='{:.1}' height='{:.1}' fill='#78909C' stroke='#37474F' stroke-width='0.8' transform='rotate({:.1} {:.1} {:.1})'/>", cx - fw / 2.0, cy - fl / 2.0, fw, fl, rot_h, cx, cy));
        } else if k == "hangar" {
        svg_parts.push(format!("<rect x='{:.1}' y='{:.1}' width='{:.1}' height='{:.1}' fill='#8D6E63' stroke='#3E2723' stroke-width='0.8' transform='rotate({:.1} {:.1} {:.1})'/>", cx - fw / 2.0, cy - fl / 2.0, fw, fl, rot_h, cx, cy));
        } else if k != "pavement" {
        svg_parts.push(format!("<rect x='{:.1}' y='{:.1}' width='{:.1}' height='{:.1}' fill='#B0BEC5' stroke='#546E7A' stroke-width='0.6' transform='rotate({:.1} {:.1} {:.1})'/>", cx - fw / 2.0, cy - fl / 2.0, fw, fl, rot_h, cx, cy));
        }
    }

    // 3. Runways
    let mut runway_ends_to_draw = Vec::new();
    for r in runways_list {
        if let Some(corners) = r.get("corners").and_then(|v| v.as_array()) {
            if corners.len() >= 4 {
                let pts: Vec<String> = corners.iter().map(|c| {
                    let ce = c.get("e").and_then(|v| v.as_f64()).unwrap_or(0.0);
                    let cn = c.get("n").and_then(|v| v.as_f64()).unwrap_or(0.0);
                    format!("{:.1} {:.1}", coord_x(ce, cn), coord_y(ce, cn))
                }).collect();
                let d = format!("M {} Z", pts.join(" L "));
        svg_parts.push(format!("<path d='{}' fill='#1E2328' stroke='#FFFFFF' stroke-width='2'/>", d));
            }
        }

        if let Some(ends) = r.get("ends").and_then(|v| v.as_array()) {
            for end in ends {
                let desig = end.get("designator").and_then(|v| v.as_str()).unwrap_or("");
                if let Some(at) = end.get("at") {
                    if let (Some(ae), Some(an)) = (at.get("e").and_then(|v| v.as_f64()), at.get("n").and_then(|v| v.as_f64())) {
                        runway_ends_to_draw.push((ae, an, desig.to_string()));
                    }
                }
            }
        }

        if let Some(cables) = r.get("cables").and_then(|v| v.as_array()) {
            for cab in cables {
                let ce = cab.get("e").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let cn = cab.get("n").and_then(|v| v.as_f64()).unwrap_or(0.0);
        svg_parts.push(format!("<circle cx='{:.1}' cy='{:.1}' r='5' fill='#FFC107' stroke='#FF6F00' stroke-width='1.5'/>", coord_x(ce, cn), coord_y(ce, cn)));
            }
        }
    }

    // 4. Taxiways: yellow centerlines
    let mut drawn_segments = std::collections::HashSet::new();
    for route in routes_list {
        let r_nodes = route.get("nodes").and_then(|v| v.as_array()).unwrap_or(&empty_arr);
        let r_ed = route.get("ed").and_then(|v| v.as_array()).unwrap_or(&empty_arr);
        for i in (0..r_ed.len()).step_by(2) {
            let idx1 = r_ed[i].as_u64().unwrap_or(0) as usize;
            let idx2 = r_ed[i + 1].as_u64().unwrap_or(0) as usize;
            if idx1 < r_nodes.len() && idx2 < r_nodes.len() {
                let na = &r_nodes[idx1];
                let nb = &r_nodes[idx2];
                let na_e = na.get("e").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let na_n = na.get("n").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let nb_e = nb.get("e").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let nb_n = nb.get("n").and_then(|v| v.as_f64()).unwrap_or(0.0);

                let p1 = (((na_e / 8.0).round() * 8.0) as i64, ((na_n / 8.0).round() * 8.0) as i64);
                let p2 = (((nb_e / 8.0).round() * 8.0) as i64, ((nb_n / 8.0).round() * 8.0) as i64);
                if p1 != p2 {
                    let seg_key = (p1.min(p2), p1.max(p2));
                    if drawn_segments.insert(seg_key) {
                        svg_parts.push(format!("<line x1='{:.1}' y1='{:.1}' x2='{:.1}' y2='{:.1}' stroke='#FFC107' stroke-width='4.5' stroke-linecap='round'/>",
                            coord_x(na_e, na_n), coord_y(na_e, na_n),
                            coord_x(nb_e, nb_n), coord_y(nb_e, nb_n)
                        ));
                    }
                }
            }
        }
    }

    // 5. Taxiway Letters: Yellow badges
    let mut all_taxi_letters: std::collections::BTreeMap<String, Vec<(f64, f64)>> = std::collections::BTreeMap::new();
    for r in routes_list {
        if let Some(nodes) = r.get("nodes").and_then(|v| v.as_array()) {
            for nd in nodes {
                if let Some(l) = nd.get("l").and_then(|v| v.as_str()) {
                    let ne = nd.get("e").and_then(|v| v.as_f64()).unwrap_or(0.0);
                    let nn = nd.get("n").and_then(|v| v.as_f64()).unwrap_or(0.0);
                    all_taxi_letters.entry(l.to_string()).or_default().push((ne, nn));
                }
            }
        }
    }

    let screen_rwy_ends: Vec<(f64, f64)> = runway_ends_to_draw.iter().map(|(re_e, re_n, _)| (coord_x(*re_e, *re_n), coord_y(*re_e, *re_n))).collect();
    let mut placed_signs: Vec<(f64, f64)> = Vec::new();

    for (l, pts) in &all_taxi_letters {
        let mut letter_clusters: Vec<Vec<(f64, f64)>> = Vec::new();
        for (pe, pn) in pts {
            let mut placed = false;
            for c in &mut letter_clusters {
                let avg_e = c.iter().map(|p| p.0).sum::<f64>() / c.len() as f64;
                let avg_n = c.iter().map(|p| p.1).sum::<f64>() / c.len() as f64;
                if (pe - avg_e).hypot(pn - avg_n) < 1500.0 {
                    c.push((*pe, *pn));
                    placed = true;
                    break;
                }
            }
            if !placed {
                letter_clusters.push(vec![(*pe, *pn)]);
            }
        }

        for c in letter_clusters {
            let mid_e = c.iter().map(|p| p.0).sum::<f64>() / c.len() as f64;
            let mid_n = c.iter().map(|p| p.1).sum::<f64>() / c.len() as f64;
            let mut px = coord_x(mid_e, mid_n);
            let mut py = coord_y(mid_e, mid_n);

            if let Some(closest_end) = screen_rwy_ends.iter().min_by(|a, b| {
                let da = (px - a.0).hypot(py - a.1);
                let db = (px - b.0).hypot(py - b.1);
                da.partial_cmp(&db).unwrap()
            }) {
                let dist_to_end = (px - closest_end.0).hypot(py - closest_end.1);
                if dist_to_end < 50.0 {
                    let vx = px - closest_end.0;
                    let vy = py - closest_end.1;
                    let vlen = vx.hypot(vy).max(1.0);
                    px = closest_end.0 + (vx / vlen) * 55.0;
                    py = closest_end.1 + (vy / vlen) * 55.0;
                }
            }

            if placed_signs.iter().any(|(sx, sy)| (px - *sx).hypot(py - *sy) < 46.0) {
                continue;
            }
            placed_signs.push((px, py));
        svg_parts.push(format!("<rect x='{:.1}' y='{:.1}' width='46' height='42' rx='6' fill='#FFEB3B' stroke='#000000' stroke-width='3'/>", px - 23.0, py - 21.0));
        svg_parts.push(format!("<text x='{:.1}' y='{:.1}' font-family='Arial, sans-serif' font-weight='900' font-size='28' fill='#000000' text-anchor='middle'>{}</text>", px, py + 11.0, l));
        }
    }

    // 5.5 Runway End Badges (RENDERED ON TOP OF TAXIWAYS)
    for (re_e, re_n, desig) in &runway_ends_to_draw {
        let ex = coord_x(*re_e, *re_n);
        let ey = coord_y(*re_e, *re_n);
        let is_active = active_desigs.contains(desig);
        let badge_bg = if is_active { "1B5E20" } else { "263238" };
        let badge_border = if is_active { "66BB6A" } else { "B0BEC5" };
        let r_size = if is_active { 29.0 } else { 25.0 };
        let stroke_w = if is_active { 4.0 } else { 2.6 };
        let font_size = if is_active { 22 } else { 19 };

        svg_parts.push(format!("<circle cx='{:.1}' cy='{:.1}' r='{:.1}' fill='{}' stroke='{}' stroke-width='{:.1}'/>", ex, ey, r_size, badge_bg, badge_border, stroke_w));
        svg_parts.push(format!("<text x='{:.1}' y='{:.1}' font-family='Arial, sans-serif' font-weight='900' font-size='{}' fill='#FFFFFF' text-anchor='middle'>{}</text>", ex, ey + 8.5, font_size, desig));
    }

    // Hold short markers
    for route in routes_list {
        if let Some(nodes) = route.get("nodes").and_then(|v| v.as_array()) {
            for nd in nodes {
                if nd.get("t").and_then(|v| v.as_i64()) == Some(21) {
                    let ne = nd.get("e").and_then(|v| v.as_f64()).unwrap_or(0.0);
                    let nn = nd.get("n").and_then(|v| v.as_f64()).unwrap_or(0.0);
        svg_parts.push(format!("<circle cx='{:.1}' cy='{:.1}' r='6' fill='#D32F2F' stroke='#FFFFFF' stroke-width='2'/>", coord_x(ne, nn), coord_y(ne, nn)));
                }
            }
        }
    }

    // 6. Overview spots on main map
    for sp in &spots_rot {
        let px = coord_x(sp.e, sp.n_coord);
        let py = coord_y(sp.e, sp.n_coord);
        svg_parts.push(format!("<circle cx='{:.1}' cy='{:.1}' r='4' fill='#546E7A' stroke='#263238' stroke-width='1'/>", px, py));
    }

    let mut placed_spot_labels: Vec<(f64, f64)> = Vec::new();
    for sp in &spots_rot {
        let px = coord_x(sp.e, sp.n_coord);
        let py = coord_y(sp.e, sp.n_coord);

        if sp.is_alert {
            placed_spot_labels.push((px, py));
        svg_parts.push(format!("<circle cx='{:.1}' cy='{:.1}' r='12' fill='#D32F2F' stroke='#FFFFFF' stroke-width='2'/>", px, py));
        svg_parts.push(format!("<text x='{:.1}' y='{:.1}' font-family='Arial, sans-serif' font-weight='900' font-size='13' fill='#FFFFFF' text-anchor='middle'>Q</text>", px, py + 5.0));
            continue;
        }

        if placed_spot_labels.iter().any(|(sx, sy)| (px - *sx).hypot(py - *sy) < 32.0) {
            continue;
        }

        placed_spot_labels.push((px, py));
        svg_parts.push(format!("<circle cx='{:.1}' cy='{:.1}' r='10' fill='#FFFFFF' stroke='#263238' stroke-width='1.8'/>", px, py));
        svg_parts.push(format!("<text x='{:.1}' y='{:.1}' font-family='Arial, sans-serif' font-weight='900' font-size='11.5' fill='#000000' text-anchor='middle'>{:02}</text>", px, py + 4.5, sp.n));
    }

    // 7. Ramp Parking Detail Inset
    let airport_screen_right = ox + dx * scale;
    if has_inset && !spots_rot.is_empty() && (svg_w - airport_screen_right) > 260.0 {
        let mut apron_items = Vec::new();
        for s in &spots_rot {
            let mut dists: Vec<f64> = spots_rot.iter().filter(|o| o.n != s.n).map(|o| (s.te - o.te).hypot(s.tn - o.tn)).collect();
            dists.sort_by(|a, b| a.partial_cmp(b).unwrap());
            if dists.len() >= 2 && dists[1] > 2000.0 {
                // remote
            } else {
                apron_items.push(s);
            }
        }
        if apron_items.is_empty() {
            apron_items = spots_rot.iter().collect();
        }

        let apron_min_e = apron_items.iter().map(|s| s.te).fold(f64::INFINITY, f64::min);
        let apron_max_e = apron_items.iter().map(|s| s.te).fold(f64::NEG_INFINITY, f64::max);
        let apron_min_n = apron_items.iter().map(|s| s.tn).fold(f64::INFINITY, f64::min);
        let apron_max_n = apron_items.iter().map(|s| s.tn).fold(f64::NEG_INFINITY, f64::max);

        let apron_dx = apron_max_e - apron_min_e;
        let apron_dy = apron_max_n - apron_min_n;
        let apron_aspect = apron_dy / apron_dx.max(1.0);

        let inset_x = (airport_screen_right + 20.0).max(480.0);
        let inset_w = (svg_w - 15.0) - inset_x;
        let inset_y = 15.0;
        let inset_h = svg_h - 30.0;

        struct PanelConfig<'a> {
            p_id: &'static str,
            p_title: &'static str,
            p_spots: Vec<&'a SpotRot>,
            px: f64,
            py: f64,
            pw: f64,
            ph: f64,
        }

        let panels_config = if apron_aspect >= 1.6 {
            vec![
                PanelConfig {
                    p_id: "inset_single",
                    p_title: "APRON PARKING STANDS (MAGNIFIED)",
                    p_spots: apron_items,
                    px: inset_x, py: inset_y, pw: inset_w, ph: inset_h,
                }
            ]
        } else if apron_items.len() >= 60 {
            let gap = 10.0;
            let panel_h = (inset_h - 2.0 * gap) / 3.0;
            let mut sorted_spots = apron_items;
            sorted_spots.sort_by(|a, b| b.tn.partial_cmp(&a.tn).unwrap());
            let n_tot = sorted_spots.len();
            let s1 = n_tot / 3;
            let s2 = 2 * n_tot / 3;
            vec![
                PanelConfig { p_id: "inset_north", p_title: "APRON STANDS - NORTH", p_spots: sorted_spots[..s1].to_vec(), px: inset_x, py: inset_y, pw: inset_w, ph: panel_h },
                PanelConfig { p_id: "inset_central", p_title: "APRON STANDS - CENTRAL", p_spots: sorted_spots[s1..s2].to_vec(), px: inset_x, py: inset_y + panel_h + gap, pw: inset_w, ph: panel_h },
                PanelConfig { p_id: "inset_south", p_title: "APRON STANDS - SOUTH", p_spots: sorted_spots[s2..].to_vec(), px: inset_x, py: inset_y + 2.0 * (panel_h + gap), pw: inset_w, ph: panel_h },
            ]
        } else {
            let gap = 12.0;
            let panel_h = (inset_h - gap) / 2.0;
            let mut sorted_spots = apron_items;
            sorted_spots.sort_by(|a, b| b.tn.partial_cmp(&a.tn).unwrap());
            let mut best_split = sorted_spots.len() / 2;
            let mut max_gap = -1.0;
            let min_split = 1.max((sorted_spots.len() as f64 * 0.25) as usize);
            let max_split = (sorted_spots.len().saturating_sub(1)).min((sorted_spots.len() as f64 * 0.75) as usize);
            for i in min_split..max_split {
                let gap_val = sorted_spots[i - 1].tn - sorted_spots[i].tn;
                if gap_val > max_gap {
                    max_gap = gap_val;
                    best_split = i;
                }
            }
            vec![
                PanelConfig { p_id: "inset_north", p_title: "APRON STANDS - NORTH", p_spots: sorted_spots[..best_split].to_vec(), px: inset_x, py: inset_y, pw: inset_w, ph: panel_h },
                PanelConfig { p_id: "inset_south", p_title: "APRON STANDS - SOUTH", p_spots: sorted_spots[best_split..].to_vec(), px: inset_x, py: inset_y + panel_h + gap, pw: inset_w, ph: panel_h },
            ]
        };

        let num_panels = panels_config.len();
        for p in panels_config {
            if p.p_spots.is_empty() {
                continue;
            }
            let header_h = if num_panels >= 3 { 26.0 } else { 32.0 };
            let font_size = if num_panels >= 3 { 14 } else { 16 };
            let header_text_y = p.py + if num_panels >= 3 { 18.0 } else { 22.0 };

            let p_min_e = p.p_spots.iter().map(|s| s.te).fold(f64::INFINITY, f64::min) - 130.0;
            let p_max_e = p.p_spots.iter().map(|s| s.te).fold(f64::NEG_INFINITY, f64::max) + 130.0;
            let p_min_n = p.p_spots.iter().map(|s| s.tn).fold(f64::INFINITY, f64::min) - 130.0;
            let p_max_n = p.p_spots.iter().map(|s| s.tn).fold(f64::NEG_INFINITY, f64::max) + 130.0;
            let p_dx = (p_max_e - p_min_e).max(10.0);
            let p_dy = (p_max_n - p_min_n).max(10.0);

            let inner_pad = if num_panels >= 3 { 14.0 } else { 16.0 };
            let inner_w = p.pw - inner_pad * 2.0;
            let inner_h = p.ph - header_h - inner_pad * 2.0;
            let i_scale = (inner_w / p_dx).min(inner_h / p_dy);
            let i_ox = p.px + inner_pad + (inner_w - p_dx * i_scale) / 2.0;
            let i_oy = p.py + header_h + inner_pad + (inner_h - p_dy * i_scale) / 2.0;

            let ix_coord = |e: f64, n: f64| -> f64 {
                let (te, _) = rot_coord(e, n);
                i_ox + (te - p_min_e) * i_scale
            };
            let iy_coord = |e: f64, n: f64| -> f64 {
                let (_, tn) = rot_coord(e, n);
                i_oy + (p_max_n - tn) * i_scale
            };

            let clip_id = format!("clip_{}", p.p_id);
            svg_parts.push(format!("<defs><clipPath id='{}'><rect x='{:.1}' y='{:.1}' width='{:.1}' height='{:.1}' rx='4'/></clipPath></defs>", clip_id, p.px + 2.0, p.py + header_h, p.pw - 4.0, p.ph - header_h - 2.0));

        svg_parts.push(format!("<rect x='{:.1}' y='{:.1}' width='{:.1}' height='{:.1}' rx='6' fill='#F8FAFC' stroke='#1A237E' stroke-width='2.5' filter='drop-shadow(2px 2px 5px rgba(0,0,0,0.2))'/>", p.px, p.py, p.pw, p.ph));
        svg_parts.push(format!("<rect x='{:.1}' y='{:.1}' width='{:.1}' height='{:.1}' rx='4' fill='#1A237E'/>", p.px, p.py, p.pw, header_h));
        svg_parts.push(format!("<text x='{:.1}' y='{:.1}' font-family='Arial, sans-serif' font-weight='900' font-size='{}' fill='#FFFFFF' text-anchor='middle'>{}</text>", p.px + p.pw / 2.0, header_text_y, font_size, p.p_title));
        svg_parts.push(format!("<g clip-path='url(#{})'>", clip_id));

            // Paved inside panel
            for ring in &paved_rings {
                if ring.len() < 6 { continue; }
                let rot_pts: Vec<(f64, f64)> = (0..ring.len()).step_by(2).map(|i| rot_coord(ring[i], ring[i + 1])).collect();
                let ring_te_min = rot_pts.iter().map(|p| p.0).fold(f64::INFINITY, f64::min);
                let ring_te_max = rot_pts.iter().map(|p| p.0).fold(f64::NEG_INFINITY, f64::max);
                let ring_tn_min = rot_pts.iter().map(|p| p.1).fold(f64::INFINITY, f64::min);
                let ring_tn_max = rot_pts.iter().map(|p| p.1).fold(f64::NEG_INFINITY, f64::max);

                if ring_te_max < p_min_e || ring_te_min > p_max_e || ring_tn_max < p_min_n || ring_tn_min > p_max_n {
                    continue;
                }
                let mut d = format!("M {:.1} {:.1}", ix_coord(ring[0], ring[1]), iy_coord(ring[0], ring[1]));
                for i in (2..ring.len()).step_by(2) {
                    d.push_str(&format!(" L {:.1} {:.1}", ix_coord(ring[i], ring[i + 1]), iy_coord(ring[i], ring[i + 1])));
                }
                d.push_str(" Z");
        svg_parts.push(format!("<path d='{}' fill='#E2E8F0' stroke='#94A3B8' stroke-width='1.2'/>", d));
            }

            // Taxiways inside panel
            let mut inset_drawn_segs = std::collections::HashSet::new();
            for route in routes_list {
                let r_nodes = route.get("nodes").and_then(|v| v.as_array()).unwrap_or(&empty_arr);
                let r_ed = route.get("ed").and_then(|v| v.as_array()).unwrap_or(&empty_arr);
                for i in (0..r_ed.len()).step_by(2) {
                    let idx1 = r_ed[i].as_u64().unwrap_or(0) as usize;
                    let idx2 = r_ed[i + 1].as_u64().unwrap_or(0) as usize;
                    if idx1 < r_nodes.len() && idx2 < r_nodes.len() {
                        let na = &r_nodes[idx1];
                        let nb = &r_nodes[idx2];
                        let na_e = na.get("e").and_then(|v| v.as_f64()).unwrap_or(0.0);
                        let na_n = na.get("n").and_then(|v| v.as_f64()).unwrap_or(0.0);
                        let nb_e = nb.get("e").and_then(|v| v.as_f64()).unwrap_or(0.0);
                        let nb_n = nb.get("n").and_then(|v| v.as_f64()).unwrap_or(0.0);
                        let (nate, natn) = rot_coord(na_e, na_n);
                        let (nbte, nbtn) = rot_coord(nb_e, nb_n);

                        if (p_min_e <= nate && nate <= p_max_e && p_min_n <= natn && natn <= p_max_n) ||
                            (p_min_e <= nbte && nbte <= p_max_e && p_min_n <= nbtn && nbtn <= p_max_n) {
                            let p1 = (((nate / 10.0).round() * 10.0) as i64, ((natn / 10.0).round() * 10.0) as i64);
                            let p2 = (((nbte / 10.0).round() * 10.0) as i64, ((nbtn / 10.0).round() * 10.0) as i64);
                            if p1 != p2 {
                                let seg_key = (p1.min(p2), p1.max(p2));
                                if inset_drawn_segs.insert(seg_key) {
                                    svg_parts.push(format!("<line x1='{:.1}' y1='{:.1}' x2='{:.1}' y2='{:.1}' stroke='#F59E0B' stroke-width='3.5' stroke-linecap='round'/>",
                                        ix_coord(na_e, na_n), iy_coord(na_e, na_n),
                                        ix_coord(nb_e, nb_n), iy_coord(nb_e, nb_n)
                                    ));
                                }
                            }
                        }
                    }
                }
            }

            struct ValidItem<'a> {
                spot: &'a SpotRot,
                bx: f64,
                by: f64,
            }

            let panel_valid: Vec<ValidItem> = p.p_spots.iter().map(|s| ValidItem {
                spot: s,
                bx: ix_coord(s.e, s.n_coord),
                by: iy_coord(s.e, s.n_coord),
            }).collect();

            let mut adj: Vec<Vec<usize>> = vec![Vec::new(); panel_valid.len()];
            for i in 0..panel_valid.len() {
                for j in (i + 1)..panel_valid.len() {
                    let d = (panel_valid[i].bx - panel_valid[j].bx).hypot(panel_valid[i].by - panel_valid[j].by);
                    if d < 38.0 {
                        adj[i].push(j);
                        adj[j].push(i);
                    }
                }
            }

            let mut visited = std::collections::HashSet::new();
            let mut components = Vec::new();
            for i in 0..panel_valid.len() {
                if !visited.contains(&i) {
                    let mut comp = Vec::new();
                    let mut queue = vec![i];
                    visited.insert(i);
                    while !queue.is_empty() {
                        let curr = queue.remove(0);
                        comp.push(curr);
                        for &neighbor in &adj[curr] {
                            if visited.insert(neighbor) {
                                queue.push(neighbor);
                            }
                        }
                    }
                    components.push(comp);
                }
            }

            let mut stagger_offsets = std::collections::HashMap::new();
            for mut comp in components {
                if comp.len() == 1 {
                    stagger_offsets.insert(comp[0], (0.0, 0.0));
                    continue;
                }
                let xs: Vec<f64> = comp.iter().map(|&idx| panel_valid[idx].bx).collect();
                let ys: Vec<f64> = comp.iter().map(|&idx| panel_valid[idx].by).collect();
                let x_span = xs.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b)) - xs.iter().fold(f64::INFINITY, |a, &b| a.min(b));
                let y_span = ys.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b)) - ys.iter().fold(f64::INFINITY, |a, &b| a.min(b));

                if x_span >= y_span {
                    comp.sort_by(|&a, &b| panel_valid[a].bx.partial_cmp(&panel_valid[b].bx).unwrap());
                    for (order, &idx) in comp.iter().enumerate() {
                        let offset_y = if order % 2 == 0 { -16.0 } else { 16.0 };
                        stagger_offsets.insert(idx, (0.0, offset_y));
                    }
                } else {
                    comp.sort_by(|&a, &b| panel_valid[a].by.partial_cmp(&panel_valid[b].by).unwrap());
                    for (order, &idx) in comp.iter().enumerate() {
                        let offset_x = if order % 2 == 0 { -16.0 } else { 16.0 };
                        stagger_offsets.insert(idx, (offset_x, 0.0));
                    }
                }
            }

            for (idx, item) in panel_valid.iter().enumerate() {
                let n_val = item.spot.n;
                let is_alert = item.spot.is_alert;
                let base_x = item.bx;
                let base_y = item.by;
                let (off_x, off_y) = stagger_offsets.get(&idx).cloned().unwrap_or((0.0, 0.0));
                let sp_x = base_x + off_x;
                let sp_y = base_y + off_y;

                if off_x.abs() > 0.0 || off_y.abs() > 0.0 {
        svg_parts.push(format!("<line x1='{:.1}' y1='{:.1}' x2='{:.1}' y2='{:.1}' stroke='#94A3B8' stroke-width='1.8' stroke-dasharray='3,3'/>", base_x, base_y, sp_x, sp_y));
                }

        svg_parts.push(format!("<circle cx='{:.1}' cy='{:.1}' r='4' fill='#64748B'/>", base_x, base_y));
                if is_alert {
        svg_parts.push(format!("<circle cx='{:.1}' cy='{:.1}' r='16' fill='#D32F2F' stroke='#FFFFFF' stroke-width='2.5'/>", sp_x, sp_y));
        svg_parts.push(format!("<text x='{:.1}' y='{:.1}' font-family='Arial, sans-serif' font-weight='900' font-size='17' fill='#FFFFFF' text-anchor='middle'>Q</text>", sp_x, sp_y + 6.0));
                } else {
        svg_parts.push(format!("<circle cx='{:.1}' cy='{:.1}' r='15' fill='#FFFFFF' stroke='#1A237E' stroke-width='2.5'/>", sp_x, sp_y));
        svg_parts.push(format!("<text x='{:.1}' y='{:.1}' font-family='Arial, sans-serif' font-weight='900' font-size='17' fill='#1A237E' text-anchor='middle'>{:02}</text>", sp_x, sp_y + 6.0, n_val));
                }
            }

            svg_parts.push("</g>".to_string());
        }
    }

    // 8. North Arrow & Wind Indicator
    let arrow_x = 65;
    let arrow_y = 65;
    let needle_angle = chart_rot_deg;
    svg_parts.push(format!(r###"
    <g transform="translate({}, {})">
        <circle cx="0" cy="0" r="40" fill='#FFFFFF' stroke='#263238' stroke-width="3"/>
        <g transform="rotate({})">
            <line x1="0" y1="24" x2="0" y2="-6" stroke='#263238' stroke-width="3.5"/>
            <polygon points="0,-18 -8,-6 8,-6" fill='#D32F2F'/>
            <text transform="rotate({} 0 -26)" x="0" y="-23" font-family="Arial, sans-serif" font-weight="900" font-size="18" fill='#D32F2F' text-anchor="middle">N</text>
        </g>
    </g>
    "###, arrow_x, arrow_y, needle_angle, -needle_angle));

    if wind_kts > 0 {
        let wind_rot = (wind_deg + 180 + chart_rot_deg).rem_euclid(360);
        svg_parts.push(format!(r###"
        <g transform="translate({}, {})">
            <circle cx="0" cy="0" r="32" fill='#E8F5E9' stroke='#2E7D32' stroke-width="2.6"/>
            <g transform="rotate({})">
                <line x1="0" y1="-24" x2="0" y2="24" stroke='#1B5E20' stroke-width="3.5"/>
                <polygon points="0,26 -8,10 8,10" fill='#1B5E20'/>
            </g>
            <text x="0" y="50" font-family="Arial, sans-serif" font-weight="900" font-size="16" fill='#1B5E20' text-anchor="middle">{:03}° / {}KT</text>
        </g>
        "###, arrow_x, arrow_y + 105, wind_rot, wind_deg, wind_kts));
    }

    let svg_content = svg_parts.join("\n");

    // Runway Table Rows
    let mut rwy_rows = Vec::new();
    for r in &airport.runways {
        let length = r.length_ft as i64;
        let width = r.width_ft as i64;
        for end in &r.ends {
            let desig = &end.designator;
            let hdg = end.heading_true;
            let ils_str = end.ils.as_ref()
                .and_then(|v| {
                    if let Some(s) = v.as_str() {
                        Some(s.to_string())
                    } else if let Some(obj) = v.as_object() {
                        obj.get("freq").and_then(|f| f.as_str()).map(|s| s.to_string())
                    } else {
                        None
                    }
                })
                .unwrap_or_else(|| "---".to_string());

            let is_active = active_desigs.contains(desig);
            let badge = if is_active { r###"<span class="active-badge">ACTIVE</span>"### } else { "" };
            let (ptrn_dir, alt_str) = if let Some(pat) = end.pattern.as_ref() {
                let side = pat.get("overheadSide").and_then(|v| v.as_str()).unwrap_or("Left");
                let dir = if side.starts_with("Right") { "R" } else { "L" };
                let final_alt = pat.get("final").and_then(|f| f.get("altFt")).and_then(|v| v.as_i64());
                let alt = if let Some(fa) = final_alt { format!("{}'", fa) } else { "1,500'".to_string() };
                (dir, alt)
            } else {
                ("L", "1,500'".to_string())
            };
            let ptrn_str = format!("{} ({})", ptrn_dir, alt_str);

            rwy_rows.push(format!(r###"
            <tr class="{}">
                <td class="col-rwy"><b>{}</b> {}</td>
                <td><b>{} × {} ft</b></td>
                <td><b>{:.0}° M</b></td>
                <td class="col-ils"><b>{}</b></td>
                <td class="col-ptrn"><b>{}</b></td>
            </tr>
            "###, if is_active { "rwy-active" } else { "" }, desig, badge, length, width, hdg, ils_str, ptrn_str));
        }
    }

    let rwy_table_html = rwy_rows.join("\n");
    let chart_type_title = if is_departure { "DEPARTURE GROUND TAXI" } else { "RECOVERY GROUND TAXI & PARKING" };

    let tacan_str = if let Some(tc) = tacan {
        let chan = tc.get("channel").map(|v| {
            if let Some(s) = v.as_str() {
                s.to_string()
            } else if let Some(n) = v.as_i64() {
                n.to_string()
            } else {
                String::new()
            }
        }).unwrap_or_default();
        let band = tc.get("band").and_then(|v| v.as_str()).unwrap_or("X");
        let station = tc.get("station").and_then(|v| v.as_str()).unwrap_or("");
        if station.contains('(') && station.contains(')') {
            let code = station.split('(').nth(1).unwrap_or("").split(')').next().unwrap_or("");
            if !chan.is_empty() { format!("{}{}{} ({})", chan, band, if code.is_empty() { "" } else { " " }, code) } else { "---".to_string() }
        } else if !chan.is_empty() {
            format!("{}{}", chan, band)
        } else {
            "---".to_string()
        }
    } else {
        "---".to_string()
    };

    let icao_badge_html = if !icao.is_empty() {
        format!(r###"<span class="icao-badge">{}</span>"###, icao)
    } else {
        String::new()
    };

    let get_freq = |key: &str| -> String {
        freqs.and_then(|f| f.get(key)).and_then(|v| v.as_str()).unwrap_or("---").to_string()
    };

    format!(r###"<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
        background-color: #FAFAF8;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        color: #1A1A1A;
        width: 1024px;
        height: 1554px;
        padding: 82px 16px 14px 16px;
        overflow: hidden;
    }}
    .header {{
        margin-bottom: 6px;
    }}
    .header-table {{
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 6px;
    }}
    .header-table td {{
        vertical-align: top;
        padding: 0;
    }}
    .icao-badge {{
        display: inline-block;
        background: #0D47A1;
        color: #FFFFFF;
        padding: 5px 15px;
        border-radius: 6px;
        font-size: 28px;
        font-weight: 900;
        letter-spacing: 0.5px;
        margin-right: 14px;
        vertical-align: middle;
    }}
    .airport-title {{
        display: inline-block;
        font-size: 34px;
        font-weight: 900;
        color: #0D47A1;
        letter-spacing: 0.5px;
        vertical-align: middle;
    }}
    .proc-badge {{
        display: inline-block;
        background: #C62828;
        color: #FFFFFF;
        padding: 6px 16px;
        border-radius: 6px;
        font-size: 18px;
        font-weight: 900;
        letter-spacing: 0.5px;
        text-align: right;
        margin-bottom: 4px;
    }}
    .elev-text {{
        color: #0D47A1;
        font-size: 19px;
        font-weight: 900;
        letter-spacing: 0.5px;
        text-align: right;
    }}
    
    .pills-table {{
        width: 100%;
        border-collapse: collapse;
        border-spacing: 0;
        margin-bottom: 6px;
        table-layout: fixed;
    }}
    .pills-table td {{
        padding: 0;
        vertical-align: middle;
    }}
    .banner-pill {{
        background: #E8F5E9;
        border: 2.5px solid #2E7D32;
        border-radius: 6px;
        padding: 7px 4px;
        text-align: center;
        font-size: 20px;
        font-weight: 800;
        color: #1B5E20;
        white-space: nowrap;
        box-sizing: border-box;
        width: 100%;
    }}
    .banner-pill b {{
        color: #000000;
        font-weight: 900;
    }}
    
    .comms-table {{
        width: 100%;
        border: 2.5px solid #90A4AE;
        border-radius: 6px;
        border-collapse: separate;
        border-spacing: 0;
        overflow: hidden;
        background: #FFFFFF;
        margin-bottom: 6px;
    }}
    .comm-cell {{
        padding: 8px 4px;
        border-right: 2.5px solid #90A4AE;
        text-align: center;
        vertical-align: middle;
    }}
    .comm-cell:last-child {{
        border-right: none;
    }}
    .comm-lbl {{
        font-size: 16px;
        font-weight: 900;
        color: #546E7A;
        letter-spacing: 0.5px;
        margin-bottom: 3px;
    }}
    .comm-val {{
        font-size: 22px;
        font-weight: 900;
        color: #0D47A1;
    }}
    
    .map-container {{
        background: #FAFAF8;
        border: 2.5px solid #37474F;
        border-radius: 6px;
        width: 992px;
        height: {}px;
        position: relative;
        overflow: hidden;
    }}
    
    .footer-table {{
        margin-top: 6px;
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        background: #FFFFFF;
        border: 2.5px solid #263238;
        border-radius: 6px;
        overflow: hidden;
    }}
    .footer-table th {{
        background: #1A237E;
        color: #FFFFFF;
        font-weight: 900;
        font-size: 21px;
        padding: 7px 10px;
        text-align: left;
        letter-spacing: 0.5px;
        border-bottom: 2px solid #1A237E;
    }}
    .footer-table td {{
        padding: 7px 10px;
        border-top: 1.5px solid #CFD8DC;
        color: #263238;
        font-size: 22px;
    }}
    .col-rwy {{ font-size: 24px; font-weight: 900; }}
    .col-ils {{ font-size: 21px; color: #0D47A1; }}
    .col-ptrn {{ font-size: 21px; font-weight: 900; color: #1A237E; }}
    .rwy-active {{
        background: #E8F5E9;
    }}
    .rwy-active td {{ color: #1B5E20; }}
    .active-badge {{
        background: #2E7D32;
        color: #FFFFFF;
        font-size: 15px;
        font-weight: 900;
        padding: 3px 10px;
        border-radius: 4px;
        margin-left: 8px;
    }}
</style>
</head>
<body>

<div class="header">
    <table class="header-table">
        <tr>
            <td style="text-align: left; vertical-align: top; display: flex; align-items: center; gap: 2rem;">
                {}
                <span class="airport-title">{}</span>
            </td>
            <td style="text-align: right; vertical-align: middle;">
                <div class="proc-badge">{}</div>
                <div class="elev-text">ELEV {} FT MSL</div>
            </td>
        </tr>
    </table>
    <table class="pills-table">
        <tr>
            <td style="width: 33.333%; padding: 0 4px 0 0;">
                <div class="banner-pill">WIND: <b>{:03}° / {} KTS</b></div>
            </td>
            <td style="width: 33.333%; padding: 0 4px 0 4px;">
                <div class="banner-pill">ACT RWYS: <b>{}</b></div>
            </td>
            <td style="width: 33.333%; padding: 0 0 0 4px;">
                <div class="banner-pill">TAC: <b>{}</b></div>
            </td>
        </tr>
    </table>
    <table class="comms-table">
        <tr>
            <td class="comm-cell" style="width: 18%;"><div class="comm-lbl">ATIS</div><div class="comm-val">{}</div></td>
            <td class="comm-cell" style="width: 32%;"><div class="comm-lbl">TWR</div><div class="comm-val">{} / {}</div></td>
            <td class="comm-cell" style="width: 16%;"><div class="comm-lbl">GND</div><div class="comm-val">{}</div></td>
            <td class="comm-cell" style="width: 17%;"><div class="comm-lbl">APP</div><div class="comm-val">{}</div></td>
            <td class="comm-cell" style="width: 17%;"><div class="comm-lbl">OPS</div><div class="comm-val">{}</div></td>
        </tr>
    </table>
</div>

<div class="map-container">
    <svg width="{:.0}" height="{:.0}" xmlns="http://www.w3.org/2000/svg">
        {}
    </svg>
</div>

<table class="footer-table">
    <thead>
        <tr>
            <th>RWY</th>
            <th>DIM</th>
            <th>HDG</th>
            <th>ILS FREQ</th>
            <th>PTRN</th>
        </tr>
    </thead>
    <tbody>
        {}
    </tbody>
</table>

</body>
</html>
"###,
        map_h,
        icao_badge_html, ap_name,
        chart_type_title, elev,
        wind_deg, wind_kts,
        active_str, tacan_str,
        get_freq("atisVhf"), get_freq("towerUhf"), get_freq("towerVhf"),
        get_freq("groundUhf"), get_freq("approachUhf"), get_freq("opsUhf"),
        svg_w, svg_h,
        svg_content,
        rwy_table_html,
    )
}
