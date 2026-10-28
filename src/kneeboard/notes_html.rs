const AEROGRAPH_LOGO_B64: &str = include_str!("logo_b64.txt");

/// HTML-escapes raw string input to prevent malformed tags.
fn escape_html(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

/// Parses inline color formatting tags like `{red: text}`, `{blue: text}`, `{#HEX: text}`, and `{highlight: text}`.
pub fn parse_inline_formatting(input: &str) -> String {
    let mut out = String::new();
    let mut rest = input;

    while let Some(start_idx) = rest.find('{') {
        out.push_str(&escape_html(&rest[..start_idx]));
        let after_brace = &rest[start_idx + 1..];

        if let Some(end_idx) = after_brace.find('}') {
            let inside = &after_brace[..end_idx];
            if let Some(colon_idx) = inside.find(':') {
                let color_tag = inside[..colon_idx].trim().to_lowercase();
                let text = inside[colon_idx + 1..].trim();
                let escaped_text = escape_html(text);

                let styled = match color_tag.as_str() {
                    "red" => format!("<span style=\"color:#D32F2F;font-weight:bold;\">{}</span>", escaped_text),
                    "yellow" => format!("<span style=\"color:#F57F17;font-weight:bold;\">{}</span>", escaped_text),
                    "green" => format!("<span style=\"color:#2E7D32;font-weight:bold;\">{}</span>", escaped_text),
                    "blue" => format!("<span style=\"color:#1565C0;font-weight:bold;\">{}</span>", escaped_text),
                    "orange" => format!("<span style=\"color:#E65100;font-weight:bold;\">{}</span>", escaped_text),
                    "cyan" => format!("<span style=\"color:#00838F;font-weight:bold;\">{}</span>", escaped_text),
                    "gray" | "grey" => format!("<span style=\"color:#546E7A;\">{}</span>", escaped_text),
                    "white" => format!("<span style=\"color:#FFFFFF;background-color:#263238;padding:1px 6px;border-radius:3px;font-weight:bold;\">{}</span>", escaped_text),
                    "black" => format!("<span style=\"color:#111111;font-weight:bold;\">{}</span>", escaped_text),
                    "highlight" | "bg-yellow" => format!("<span style=\"background-color:#FFF59D;color:#111111;padding:1px 6px;border-radius:3px;font-weight:bold;\">{}</span>", escaped_text),
                    "bg-red" => format!("<span style=\"background-color:#FFCDD2;color:#B71C1C;padding:1px 6px;border-radius:3px;font-weight:bold;\">{}</span>", escaped_text),
                    "bg-green" => format!("<span style=\"background-color:#C8E6C9;color:#1B5E20;padding:1px 6px;border-radius:3px;font-weight:bold;\">{}</span>", escaped_text),
                    "bg-blue" => format!("<span style=\"background-color:#BBDEFB;color:#0D47A1;padding:1px 6px;border-radius:3px;font-weight:bold;\">{}</span>", escaped_text),
                    tag if tag.starts_with('#') => format!("<span style=\"color:{};font-weight:bold;\">{}</span>", escape_html(tag), escaped_text),
                    _ => format!("{{{}}}", escape_html(inside)),
                };
                out.push_str(&styled);
                rest = &after_brace[end_idx + 1..];
                continue;
            }
        }
        out.push('{');
        rest = after_brace;
    }
    out.push_str(&escape_html(rest));
    out
}

/// Parses raw markdown / text notes into styled HTML elements using WebKit-safe table and block layouts.
pub fn parse_notes_to_html(raw_text: &str) -> String {
    let mut html = String::new();
    let mut in_list = false;

    for line in raw_text.lines() {
        let trimmed = line.trim();

        if trimmed.is_empty() {
            if in_list {
                html.push_str("</ul>\n");
                in_list = false;
            }
            html.push_str("<div class=\"spacer\"></div>\n");
            continue;
        }

        // Section Headers
        if trimmed.starts_with("### ") {
            if in_list { html.push_str("</ul>\n"); in_list = false; }
            let title = parse_inline_formatting(&trimmed[4..]);
            html.push_str(&format!("<h3 class=\"section-h3\">{}</h3>\n", title));
        } else if trimmed.starts_with("## ") {
            if in_list { html.push_str("</ul>\n"); in_list = false; }
            let title = parse_inline_formatting(&trimmed[3..]);
            html.push_str(&format!("<h2 class=\"section-h2\">{}</h2>\n", title));
        } else if trimmed.starts_with("# ") {
            if in_list { html.push_str("</ul>\n"); in_list = false; }
            let title = parse_inline_formatting(&trimmed[2..]);
            html.push_str(&format!("<h1 class=\"section-h1\">{}</h1>\n", title));
        } else if trimmed.starts_with('[') && trimmed.ends_with(']') && !trimmed.starts_with("[ ]") && !trimmed.starts_with("[x]") && !trimmed.starts_with("[X]") {
            if in_list { html.push_str("</ul>\n"); in_list = false; }
            let title = parse_inline_formatting(&trimmed[1..trimmed.len()-1]);
            html.push_str(&format!("<div class=\"section-badge\">{}</div>\n", title));
        }
        // Warning alerts (WebKit safe table)
        else if trimmed.to_uppercase().starts_with("WARNING:") || trimmed.to_uppercase().starts_with("[WARNING]") {
            if in_list { html.push_str("</ul>\n"); in_list = false; }
            let content = if trimmed.to_uppercase().starts_with("WARNING:") {
                &trimmed[8..]
            } else {
                &trimmed[9..]
            };
            html.push_str(&format!(
                "<table class=\"alert-table warning\" cellpadding=\"0\" cellspacing=\"0\"><tr><td class=\"alert-badge-cell\"><span class=\"alert-badge\">WARNING</span></td><td class=\"alert-text-cell\">{}</td></tr></table>\n",
                parse_inline_formatting(content.trim())
            ));
        }
        // Caution alerts (WebKit safe table)
        else if trimmed.to_uppercase().starts_with("CAUTION:") || trimmed.to_uppercase().starts_with("[CAUTION]") {
            if in_list { html.push_str("</ul>\n"); in_list = false; }
            let content = if trimmed.to_uppercase().starts_with("CAUTION:") {
                &trimmed[8..]
            } else {
                &trimmed[9..]
            };
            html.push_str(&format!(
                "<table class=\"alert-table caution\" cellpadding=\"0\" cellspacing=\"0\"><tr><td class=\"alert-badge-cell\"><span class=\"alert-badge\">CAUTION</span></td><td class=\"alert-text-cell\">{}</td></tr></table>\n",
                parse_inline_formatting(content.trim())
            ));
        }
        // Checkboxes (WebKit safe table)
        else if trimmed.starts_with("[ ] ") || trimmed.starts_with("- [ ] ") {
            if in_list { html.push_str("</ul>\n"); in_list = false; }
            let text = if trimmed.starts_with("- ") { &trimmed[6..] } else { &trimmed[4..] };
            html.push_str(&format!(
                "<table class=\"check-table\" cellpadding=\"0\" cellspacing=\"0\"><tr><td class=\"check-box-cell\"><div class=\"check-box\"></div></td><td class=\"check-text-cell\">{}</td></tr></table>\n",
                parse_inline_formatting(text.trim())
            ));
        } else if trimmed.starts_with("[x] ") || trimmed.starts_with("[X] ") || trimmed.starts_with("- [x] ") || trimmed.starts_with("- [X] ") {
            if in_list { html.push_str("</ul>\n"); in_list = false; }
            let text = if trimmed.starts_with("- ") { &trimmed[6..] } else { &trimmed[4..] };
            html.push_str(&format!(
                "<table class=\"check-table checked\" cellpadding=\"0\" cellspacing=\"0\"><tr><td class=\"check-box-cell\"><div class=\"check-box checked\">&#x2714;</div></td><td class=\"check-text-cell\">{}</td></tr></table>\n",
                parse_inline_formatting(text.trim())
            ));
        }
        // Bullets
        else if trimmed.starts_with("- ") || trimmed.starts_with("* ") {
            if !in_list {
                html.push_str("<ul class=\"notes-list\">\n");
                in_list = true;
            }
            let item = parse_inline_formatting(&trimmed[2..]);
            html.push_str(&format!("  <li>{}</li>\n", item));
        }
        // Key-Value badge rows (WebKit safe full-width table)
        else if let Some(colon_idx) = trimmed.find(':') {
            let key = trimmed[..colon_idx].trim();
            let val = trimmed[colon_idx + 1..].trim();
            if !key.is_empty() && key.len() <= 28 && !val.is_empty() && key.chars().all(|c| c.is_ascii_alphanumeric() || c == ' ' || c == '/' || c == '-' || c == '_') {
                if in_list { html.push_str("</ul>\n"); in_list = false; }
                html.push_str(&format!(
                    "<table class=\"kv-table\" cellpadding=\"0\" cellspacing=\"0\"><tr><td class=\"kv-key\">{}</td><td class=\"kv-val\">{}</td></tr></table>\n",
                    parse_inline_formatting(key),
                    parse_inline_formatting(val)
                ));
            } else {
                if in_list { html.push_str("</ul>\n"); in_list = false; }
                html.push_str(&format!("<p class=\"note-line\">{}</p>\n", parse_inline_formatting(line)));
            }
        }
        // Plain text line
        else {
            if in_list { html.push_str("</ul>\n"); in_list = false; }
            html.push_str(&format!("<p class=\"note-line\">{}</p>\n", parse_inline_formatting(line)));
        }
    }

    if in_list {
        html.push_str("</ul>\n");
    }

    html
}

/// Resolves the stripe colors and header text color based on preset, custom list, or individual colors.
pub fn resolve_stripe_and_header_colors(
    preset: Option<&str>,
    stripe_color: Option<&str>,
    stripe_colors: Option<&[String]>,
    header_color: Option<&str>,
) -> (Vec<String>, String) {
    let (colors, default_hdr) = if let Some(list) = stripe_colors {
        if !list.is_empty() {
            let hdr = list[0].clone();
            (list.to_vec(), hdr)
        } else {
            (vec!["#111111".to_string()], "#111111".to_string())
        }
    } else if let Some(p) = preset {
        match p.to_lowercase().as_str() {
            "caution" => (vec!["#111111".to_string(), "#F5D742".to_string()], "#111111".to_string()),
            "warning" => (vec!["#111111".to_string(), "#D32F2F".to_string()], "#D32F2F".to_string()),
            "emergency" => (vec!["#D32F2F".to_string()], "#D32F2F".to_string()),
            "tactical" | "blue" => (vec!["#0D47A1".to_string(), "#0288D1".to_string()], "#0D47A1".to_string()),
            "green" => (vec!["#1B5E20".to_string(), "#388E3C".to_string()], "#1B5E20".to_string()),
            "standard" | "black" | _ => (vec!["#111111".to_string()], "#111111".to_string()),
        }
    } else if let Some(c) = stripe_color {
        (vec![c.to_string()], c.to_string())
    } else {
        (vec!["#111111".to_string()], "#111111".to_string())
    };

    let effective_header = header_color.map(|s| s.to_string()).unwrap_or(default_hdr);
    (colors, effective_header)
}

/// Generates a complete 1024x1554 HTML page formatted in the F-16 POH / Checklist aesthetic.
pub fn generate_notes_page_html(
    slot_name: &str,
    title: &str,
    subtitle: Option<&str>,
    header_code: Option<&str>,
    page_num: Option<&str>,
    preset: Option<&str>,
    stripe_color: Option<&str>,
    stripe_colors: Option<&[String]>,
    header_color: Option<&str>,
    spaced: bool,
    notes_raw: &str,
    callsign: &str,
) -> String {
    let is_left = slot_name.to_uppercase().ends_with('L');
    let effective_header_code = header_code.unwrap_or("AEROGRAPH // F-16 PILOT NOTES");
    let effective_page_num = page_num.unwrap_or(if is_left { "NOTES-L" } else { "NOTES-R" });

    let (colors, effective_header_color) = resolve_stripe_and_header_colors(preset, stripe_color, stripe_colors, header_color);

    // Build vector SVG stripe pattern
    let (pattern_width, rects_svg) = if spaced {
        // Authentic T.O. Checklist style: each color stripe is followed by a white background gap
        let stripe_w = 20;
        let pw = stripe_w * 2 * colors.len();
        let mut r = String::new();
        for (i, c) in colors.iter().enumerate() {
            let x_color = i * 2 * stripe_w;
            let x_gap = x_color + stripe_w;
            r.push_str(&format!(
                "<rect width=\"{}\" height=\"40\" x=\"{}\" fill=\"{}\"/>\n<rect width=\"{}\" height=\"40\" x=\"{}\" fill=\"#FAFAF8\"/>\n",
                stripe_w, x_color, c, stripe_w, x_gap
            ));
        }
        (pw, r)
    } else {
        // Dense style: colors alternate directly with no white gaps between them
        if colors.len() == 1 {
            let c = &colors[0];
            (
                40,
                format!(
                    "<rect width=\"20\" height=\"40\" x=\"0\" fill=\"{}\"/>\n<rect width=\"20\" height=\"40\" x=\"20\" fill=\"#FAFAF8\"/>\n",
                    c
                ),
            )
        } else {
            let pw = 20 * colors.len();
            let mut r = String::new();
            for (i, c) in colors.iter().enumerate() {
                r.push_str(&format!(
                    "<rect width=\"20\" height=\"40\" x=\"{}\" fill=\"{}\"/>\n",
                    i * 20,
                    c
                ));
            }
            (pw, r)
        }
    };

    let notch_class = if is_left { "notch-left" } else { "notch-right" };
    let subtitle_html = if let Some(sub) = subtitle {
        format!("<div class=\"subtitle\">{}</div>", parse_inline_formatting(sub))
    } else {
        format!("<div class=\"subtitle\">PILOT: {} &bull; MISSION DATA</div>", escape_html(callsign.to_uppercase().as_str()))
    };

    let parsed_content = parse_notes_to_html(notes_raw);

    format!(r##"<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
        background-color: #FAFAF8;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #1A1A1A;
        width: 1024px;
        height: 1554px;
        position: relative;
        overflow: hidden;
    }}

    /* Top 130px Diagonal Stripe Banner with Inline Vector SVG Pattern */
    .top-banner {{
        position: absolute;
        top: 0;
        left: 0;
        width: 1024px;
        height: 130px;
        overflow: hidden;
    }}

    /* Borderless Header Title Notch Anchored at Bottom Edge of Stripes (Table-based for guaranteed padding) */
    .header-notch {{
        position: absolute;
        bottom: 0px;
        background-color: #FAFAF8;
        border: none;
        border-collapse: collapse;
        z-index: 10;
    }}
    .header-notch-inner {{
        padding: 4px 26px;
        font-weight: 900;
        font-size: 22px;
        letter-spacing: 0.5px;
        color: {header_color};
        white-space: nowrap;
        vertical-align: middle;
    }}
    .notch-left {{
        left: 48px;
    }}
    .notch-right {{
        right: 48px;
    }}

    /* Main Content Container with Generous Side Inset */
    .content-container {{
        position: absolute;
        top: 130px;
        left: 0;
        width: 1024px;
        height: 1344px;
        padding: 28px 64px 20px 64px;
    }}

    .main-title {{
        font-size: 40px;
        font-weight: 900;
        font-style: italic;
        color: #111111;
        line-height: 1.15;
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }}

    .subtitle {{
        font-size: 20px;
        font-weight: 800;
        color: #546E7A;
        letter-spacing: 1.2px;
        margin-bottom: 22px;
        text-transform: uppercase;
        border-bottom: 2px solid #CFD8DC;
        padding-bottom: 8px;
    }}

    /* Formatted Elements */
    .spacer {{
        height: 14px;
    }}

    .section-h1 {{
        font-size: 28px;
        font-weight: 900;
        color: #0D47A1;
        background-color: #E3F2FD;
        border-left: 6px solid #1565C0;
        padding: 8px 14px;
        margin: 16px 0 10px 0;
        text-transform: uppercase;
        border-radius: 0 4px 4px 0;
    }}

    .section-h2 {{
        font-size: 24px;
        font-weight: 900;
        color: #263238;
        border-bottom: 2px solid #90A4AE;
        padding-bottom: 4px;
        margin: 16px 0 8px 0;
        text-transform: uppercase;
    }}

    .section-h3 {{
        font-size: 21px;
        font-weight: 800;
        color: #37474F;
        margin: 12px 0 6px 0;
    }}

    .section-badge {{
        display: inline-block;
        background-color: #263238;
        color: #FFFFFF;
        font-size: 19px;
        font-weight: 900;
        padding: 4px 16px;
        border-radius: 4px;
        margin: 14px 0 8px 0;
        text-transform: uppercase;
        letter-spacing: 1px;
    }}

    /* Alerts (WebKit Safe Table) */
    .alert-table {{
        width: 100%;
        margin: 10px 0;
        border-radius: 6px;
        border-collapse: separate;
        padding: 8px 14px;
    }}
    .alert-table.warning {{
        background-color: #FFEBEE;
        border: 2px solid #C62828;
    }}
    .alert-table.caution {{
        background-color: #FFF8E1;
        border: 2px solid #F57F17;
    }}
    .alert-badge-cell {{
        width: 130px;
        vertical-align: middle;
        padding-right: 14px;
    }}
    .alert-badge {{
        display: inline-block;
        color: #FFFFFF;
        padding: 3px 12px;
        border-radius: 4px;
        font-size: 16px;
        font-weight: 900;
        letter-spacing: 1px;
        text-align: center;
    }}
    .alert-table.warning .alert-badge {{ background-color: #C62828; }}
    .alert-table.caution .alert-badge {{ background-color: #F57F17; }}
    .alert-text-cell {{
        font-size: 22px;
        font-weight: 700;
        vertical-align: middle;
    }}
    .alert-table.warning .alert-text-cell {{ color: #B71C1C; }}
    .alert-table.caution .alert-text-cell {{ color: #E65100; }}

    /* Checkboxes (WebKit Safe Table) */
    .check-table {{
        width: 100%;
        margin: 6px 0;
        border-collapse: collapse;
    }}
    .check-box-cell {{
        width: 36px;
        vertical-align: middle;
        padding-right: 12px;
    }}
    .check-box {{
        width: 24px;
        height: 24px;
        border: 2px solid #455A64;
        border-radius: 4px;
        background-color: #FFFFFF;
        box-sizing: border-box;
    }}
    .check-box.checked {{
        background-color: #2E7D32;
        border-color: #2E7D32;
        color: #FFFFFF;
        font-size: 17px;
        line-height: 20px;
        text-align: center;
        font-weight: 900;
    }}
    .check-text-cell {{
        font-size: 22px;
        font-weight: 700;
        color: #263238;
        vertical-align: middle;
    }}

    .notes-list {{
        list-style-type: square;
        margin-left: 32px;
        margin-bottom: 8px;
    }}
    .notes-list li {{
        font-size: 22px;
        font-weight: 600;
        color: #212121;
        padding: 3px 0;
        line-height: 1.35;
    }}

    /* Key-Value Full-Width Card (WebKit Safe Table) */
    .kv-table {{
        width: 100%;
        background-color: #ECEFF1;
        border-radius: 6px;
        margin: 6px 0;
        border-collapse: separate;
    }}
    .kv-key {{
        padding: 8px 16px;
        font-weight: 900;
        font-size: 22px;
        color: #37474F;
        text-align: left;
        text-transform: uppercase;
        vertical-align: middle;
    }}
    .kv-val {{
        padding: 8px 16px;
        font-weight: 900;
        font-size: 22px;
        color: #0D47A1;
        text-align: right;
        font-family: "Lucida Console", "Consolas", monospace;
        letter-spacing: 1px;
        vertical-align: middle;
    }}

    .note-line {{
        font-size: 22px;
        line-height: 1.4;
        color: #263238;
        font-weight: 500;
        padding: 2px 0;
        white-space: pre-wrap;
    }}

    /* Fixed-Width Footer Table */
    .footer-table {{
        position: absolute;
        bottom: 24px;
        left: 64px;
        width: 896px;
        border-top: 2.5px solid #90A4AE;
        border-collapse: collapse;
    }}
    .footer-left {{
        text-align: left;
        vertical-align: middle;
        white-space: nowrap;
        width: 320px;
        padding-top: 14px;
        padding-bottom: 2px;
    }}
    .footer-logo {{
        width: 28px;
        height: 28px;
        vertical-align: middle;
        margin-right: 8px;
    }}
    .footer-title {{
        font-size: 18px;
        font-weight: 900;
        color: #263238;
        letter-spacing: 1px;
        vertical-align: middle;
    }}
    .footer-sub {{
        font-size: 14px;
        font-weight: 700;
        color: #78909C;
        vertical-align: middle;
    }}
    .footer-center {{
        text-align: center;
        vertical-align: middle;
        font-size: 15px;
        font-weight: 700;
        color: #546E7A;
        font-style: italic;
        padding-top: 14px;
        padding-bottom: 2px;
    }}
    .footer-right {{
        text-align: right;
        vertical-align: middle;
        white-space: nowrap;
        width: 160px;
        padding-top: 14px;
        padding-bottom: 2px;
    }}
    .footer-page-badge {{
        background-color: #263238;
        color: #FFFFFF;
        font-size: 18px;
        font-weight: 900;
        padding: 4px 18px;
        border-radius: 6px;
        letter-spacing: 1px;
        display: inline-block;
    }}
</style>
</head>
<body>
    <!-- Top 130px Stripe Banner with Vector SVG Pattern (QtWebKit Reliable) -->
    <div class="top-banner">
        <svg width="1024" height="130" style="position: absolute; top: 0; left: 0;" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id="diagonal-stripes" width="{pattern_width}" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    {rects_svg}
                </pattern>
            </defs>
            <rect width="1024" height="130" fill="url(#diagonal-stripes)"/>
        </svg>

        <!-- Borderless Header Notch Anchored at Bottom Edge (Table-based for guaranteed padding) -->
        <table class="header-notch {notch_class}" cellpadding="0" cellspacing="0">
            <tr>
                <td class="header-notch-inner">{effective_header_code}</td>
            </tr>
        </table>
    </div>

    <!-- Main Notes Content -->
    <div class="content-container">
        <div class="main-title">{title_escaped}</div>
        {subtitle_html}
        <div class="notes-body">
            {parsed_content}
        </div>
    </div>

    <!-- WebKit Safe Fixed-Width Footer with Real AeroGraph Logo -->
    <table class="footer-table" cellpadding="0" cellspacing="0">
        <tr>
            <td class="footer-left">
                <img src="data:image/png;base64,{logo_b64}" class="footer-logo" width="28" height="28" />
                <span class="footer-title">AEROGRAPH</span>
                <span class="footer-sub">// TACTICAL KNEEBOARDS</span>
            </td>
            <td class="footer-center">
                * PILOT MISSION NOTES / T.O. 1F-16CM-1
            </td>
            <td class="footer-right">
                <span class="footer-page-badge">{effective_page_num}</span>
            </td>
        </tr>
    </table>
</body>
</html>
"##,
        pattern_width = pattern_width,
        rects_svg = rects_svg,
        header_color = effective_header_color,
        notch_class = notch_class,
        effective_header_code = escape_html(effective_header_code),
        title_escaped = escape_html(title),
        subtitle_html = subtitle_html,
        parsed_content = parsed_content,
        logo_b64 = AEROGRAPH_LOGO_B64.trim(),
        effective_page_num = escape_html(effective_page_num),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_left_vs_right_notch_position() {
        let left_html = generate_notes_page_html(
            "F16_10L",
            "Pilot Notes",
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            true,
            "Sample note",
            "VIPER 1",
        );
        assert!(left_html.contains("header-notch notch-left"));
        assert!(!left_html.contains("header-notch notch-right"));

        let right_html = generate_notes_page_html(
            "F16_10R",
            "Pilot Notes",
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            true,
            "Sample note",
            "VIPER 1",
        );
        assert!(right_html.contains("header-notch notch-right"));
        assert!(!right_html.contains("header-notch notch-left"));
    }

    #[test]
    fn test_markdown_and_color_parsing() {
        let text = r#"
## MISSION OBJECTIVE
- Eliminate {red: SA-6 site} at STPT 4
[ ] Pre-flight alignment complete
[x] Laser code {green: 1688} verified
BULLSEYE: {blue: 045 / 60NM}
WARNING: {highlight: Active SAM radar} reported at IP
CAUTION: Low fuel state upon egress
"#;
        let html = parse_notes_to_html(text);
        assert!(html.contains("<h2 class=\"section-h2\">MISSION OBJECTIVE</h2>"));
        assert!(html.contains("color:#D32F2F"));
        assert!(html.contains("color:#2E7D32"));
        assert!(html.contains("color:#1565C0"));
        assert!(html.contains("background-color:#FFF59D"));
        assert!(html.contains("class=\"check-table\""));
        assert!(html.contains("class=\"check-table checked\""));
        assert!(html.contains("class=\"kv-table\""));
        assert!(html.contains("BULLSEYE"));
        assert!(html.contains("class=\"alert-table warning\""));
        assert!(html.contains("class=\"alert-table caution\""));
    }

    #[test]
    fn test_preset_resolution() {
        let (colors, hdr) = resolve_stripe_and_header_colors(Some("caution"), None, None, None);
        assert_eq!(colors, vec!["#111111", "#F5D742"]);
        assert_eq!(hdr, "#111111");

        let (colors, hdr) = resolve_stripe_and_header_colors(Some("warning"), None, None, None);
        assert_eq!(colors, vec!["#111111", "#D32F2F"]);
        assert_eq!(hdr, "#D32F2F");

        let (colors, hdr) = resolve_stripe_and_header_colors(Some("emergency"), None, None, None);
        assert_eq!(colors, vec!["#D32F2F"]);
        assert_eq!(hdr, "#D32F2F");

        let (colors, hdr) = resolve_stripe_and_header_colors(None, None, Some(&["#111111".into(), "#D32F2F".into(), "#F5D742".into()]), Some("#FFFFFF"));
        assert_eq!(colors.len(), 3);
        assert_eq!(hdr, "#FFFFFF");
    }

    #[test]
    fn test_render_sample_pages_to_disk() {
        let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let assets_dir = manifest_dir.join("assets");
        let work_dir = assets_dir.join("work");
        let images_dir = assets_dir.join("images");
        let _ = std::fs::create_dir_all(&work_dir);
        let _ = std::fs::create_dir_all(&images_dir);

        let sample_notes = r#"
## 1. MISSION RULES OF ENGAGEMENT (ROE)
- Weapons tight until authenticated past STPT 3
- Bogey Dope broadcast: UHF 254.000 / AWACS 'MAGIC'
- Primary Laser Code: {green: 1688} / Secondary: {yellow: 1111}

BULLSEYE: {blue: 045 / 60NM}
PACKAGE VHF: {blue: 138.250}
RAMROD: {blue: CHARLIE}

## 2. IN-FLIGHT ACTION CHECKLIST
[x] INS Alignment verified & UFC set
[ ] Master Arm {yellow: ARM} at STPT 4 (Fence In)
[ ] Laser Arm {green: ON} prior to 5nm to Target

WARNING: {highlight: Active SA-10 Grumble} radar tracking near STPT 6
CAUTION: Maintain minimum 18,000 FT MSL until IP ingress
"#;

        let left_html = generate_notes_page_html(
            "F16_10L",
            "Pilot Mission Notes — ROE",
            Some("FLIGHT: VIPER 1 &bull; THEATER: KOREA"),
            None,
            Some("NOTES-1"),
            Some("caution"),
            None,
            None,
            None,
            true,
            sample_notes,
            "VIPER 1",
        );

        let right_html = generate_notes_page_html(
            "F16_10R",
            "Pilot Fault List — Engine",
            Some("T.O. 1F-16CM-1 QUICK REFERENCE"),
            Some("T.O. BMS1F-16CJ-1CL-1"),
            Some("EP-7"),
            Some("warning"),
            None,
            None,
            None,
            true,
            sample_notes,
            "VIPER 1",
        );

        let left_html_path = work_dir.join("test_notes_L.html");
        let right_html_path = work_dir.join("test_notes_R.html");
        let _ = std::fs::write(&left_html_path, left_html);
        let _ = std::fs::write(&right_html_path, right_html);

        let bin_path = assets_dir.join("bin").join("wkhtmltoimage.exe");
        if bin_path.exists() {
            let left_png_path = images_dir.join("test_notes_L.png");
            let right_png_path = images_dir.join("test_notes_R.png");
            let _ = crate::kneeboard::renderer::render_html_to_png(&bin_path, &left_html_path, &left_png_path);
            let _ = crate::kneeboard::renderer::render_html_to_png(&bin_path, &right_html_path, &right_png_path);
            assert!(left_png_path.exists(), "Left PNG was not rendered");
            assert!(right_png_path.exists(), "Right PNG was not rendered");
        }
    }
}
