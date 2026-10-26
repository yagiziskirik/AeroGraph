pub fn generate_blank_chart_html(airport_name: &str, reason: &str) -> String {
    format!(r#"<!DOCTYPE html>
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
        padding: 82px 42px 42px 42px;
        overflow: hidden;
    }}
    .outer-card {{
        width: 940px;
        height: 1430px;
        margin: 0 auto;
        border: 4px dashed #90A4AE;
        border-radius: 16px;
        background: #FFFFFF;
        text-align: center;
        padding-top: 500px;
    }}
    .badge {{
        background: #C62828;
        color: #FFFFFF;
        font-size: 26px;
        font-weight: 900;
        padding: 10px 24px;
        border-radius: 8px;
        margin: 0 auto 30px auto;
        display: inline-block;
        text-align: center;
    }}
    .main-title {{
        font-size: 50px;
        font-weight: 900;
        color: #263238;
        margin-bottom: 25px;
        text-align: center;
    }}
    .rule {{
        width: 320px;
        height: 4px;
        background: #B0BEC5;
        margin: 0 auto 30px auto;
        border-radius: 2px;
    }}
    .ap-title {{
        font-size: 38px;
        font-weight: 900;
        color: #0D47A1;
        margin-bottom: 16px;
        text-align: center;
    }}
    .reason-desc {{
        font-size: 24px;
        font-weight: 800;
        color: #C62828;
        text-transform: uppercase;
        text-align: center;
    }}
</style>
</head>
<body>
    <div class="outer-card">
        <div class="badge">AERONAUTICAL KNEEBOARD</div>
        <div class="main-title">[INTENTIONALLY LEFT BLANK]</div>
        <div class="rule"></div>
        <div class="ap-title">{}</div>
        <div class="reason-desc">{}</div>
    </div>
</body>
</html>
"#, airport_name.to_uppercase(), reason)
}
