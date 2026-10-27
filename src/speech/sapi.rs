use std::collections::HashMap;
use std::ffi::c_void;
use std::mem;
use std::ptr;
use windows::core::{Result, PCWSTR, PWSTR};
use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED};
use windows::Win32::Media::Speech::{
    SpInprocRecognizer, SpObjectTokenCategory, SpObjectToken, ISpRecognizer, ISpRecoContext,
    ISpRecoGrammar, ISpRecoResult, ISpObjectTokenCategory, ISpObjectToken,
    SPEVENT, SPEI_RECOGNITION, SPEI_FALSE_RECOGNITION, SPRS_ACTIVE, SPRS_INACTIVE,
    SPRAF_TopLevel, SPRAF_Active, SPSTATEHANDLE, SPWT_LEXICAL, SPCAT_AUDIOIN,
    SPET_LPARAM_IS_OBJECT, SPET_LPARAM_IS_POINTER, SPET_LPARAM_IS_STRING,
};

use crate::bms::shared_memory::BmsStringInfo;
use crate::fvx::models::FvxProfile;

pub struct SapiEngine {
    _recognizer: ISpRecognizer,
    context: ISpRecoContext,
    grammar: Option<ISpRecoGrammar>,
    phrase_map: HashMap<String, (usize, usize)>,
}

unsafe impl Send for SapiEngine {}

impl SapiEngine {
    pub fn new() -> Result<Self> {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            // In-process recognizer: 100% headless, zero Windows UI / floating bar popup!
            let recognizer: ISpRecognizer = CoCreateInstance(&SpInprocRecognizer, None, CLSCTX_ALL)?;

            // Bind default system audio input token (microphone)
            let cat: ISpObjectTokenCategory = CoCreateInstance(&SpObjectTokenCategory, None, CLSCTX_ALL)?;
            cat.SetId(SPCAT_AUDIOIN, false)?;
            let token_id = cat.GetDefaultTokenId()?;

            let token: ISpObjectToken = CoCreateInstance(&SpObjectToken, None, CLSCTX_ALL)?;
            token.SetId(None, token_id, false)?;

            recognizer.SetInput(&token, true)?;

            // Adjust silence timeouts to allow natural pauses without cutting off mid-sentence
            let prop_end: Vec<u16> = "EndSilenceTimeout\0".encode_utf16().collect();
            let prop_amb: Vec<u16> = "EndSilenceTimeoutAmbiguous\0".encode_utf16().collect();
            let _ = recognizer.SetPropertyNum(PCWSTR(prop_end.as_ptr()), 1000);
            let _ = recognizer.SetPropertyNum(PCWSTR(prop_amb.as_ptr()), 1500);

            let context = recognizer.CreateRecoContext()?;
            let _ = context.SetNotifyWin32Event();

            // Filter event interest to recognition events to prevent queue congestion
            let interest = (1u64 << SPEI_RECOGNITION.0) | (1u64 << SPEI_FALSE_RECOGNITION.0);
            let _ = context.SetInterest(interest, interest);

            Ok(Self {
                _recognizer: recognizer,
                context,
                grammar: None,
                phrase_map: HashMap::new(),
            })
        }
    }

    /// Checks if a phrase is registered in the active grammar.
    pub fn has_phrase(&self, phrase: &str) -> bool {
        self.phrase_map.contains_key(&phrase.trim().to_lowercase())
    }

    /// Compiles the active .fvx profile voice phrases directly into in-memory SAPI grammar rules.
    /// If an identical grammar is already cached in local storage, it is loaded instantly.
    pub fn compile_and_load_grammar(
        &mut self,
        profile: &FvxProfile,
        strings: &BmsStringInfo,
        active_config: Option<&str>,
    ) -> Result<()> {
        // Drop previous grammar and clear phrase map before building new grammar
        if let Some(old_grammar) = self.grammar.take() {
            unsafe {
                let _ = old_grammar.SetGrammarState(windows::Win32::Media::Speech::SPGS_DISABLED);
            }
        }
        self.phrase_map.clear();

        let is_chief_mode = active_config.is_some();

        // Generic local storage caching:
        // Hash all parameters that define this specific grammar build
        let cache_dir = crate::config::AppConfig::config_path()
            .parent()
            .map(|p| p.join("cache"))
            .unwrap_or_else(|| std::path::PathBuf::from("cache"));
        let _ = std::fs::create_dir_all(&cache_dir);

        let hash_input = format!(
            "{}_{:?}_{}_{}_{}_{}_{}_{}_{}_{}",
            profile.Name, active_config,
            strings.callsign, strings.departure, strings.arrival,
            strings.tanker, strings.awacs, strings.seat,
            strings.package_size, strings.aircraft
        );
        use std::hash::{Hash, Hasher};
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        hash_input.hash(&mut hasher);
        let hash = format!("{:016x}", hasher.finish());
        let bin_path = cache_dir.join(format!("grammar_{}.bin", hash));
        let map_path = cache_dir.join(format!("grammar_{}.json", hash));

        // 1. Check local storage cache: if unchanged, load binary grammar in milliseconds
        if bin_path.exists() && map_path.exists() {
            let t_load = std::time::Instant::now();
            if let (Ok(bin_data), Ok(map_str)) = (std::fs::read(&bin_path), std::fs::read_to_string(&map_path)) {
                if let Ok(phrase_map) = serde_json::from_str::<HashMap<String, (usize, usize)>>(&map_str) {
                    unsafe {
                        if let Ok(grammar) = self.context.CreateGrammar(0) {
                            let root_rule: Vec<u16> = "RootRule\0".encode_utf16().collect();
                            let load_res = grammar.LoadCmdFromMemory(
                                bin_data.as_ptr() as *const windows::Win32::Media::Speech::SPBINARYGRAMMAR,
                                windows::Win32::Media::Speech::SPLOADOPTIONS(0),
                            );
                            if load_res.is_ok() {
                                let _ = grammar.SetRuleState(PCWSTR(root_rule.as_ptr()), ptr::null_mut(), SPRS_ACTIVE);
                                log::info!(
                                    "⚡ [Cache Hit] Loaded SAPI grammar from local storage in {:.2}ms ({} phrases | Mode: {})",
                                    t_load.elapsed().as_secs_f64() * 1000.0,
                                    phrase_map.len(),
                                    if is_chief_mode { "Chief" } else { "Cockpit Comms" }
                                );
                                self.grammar = Some(grammar);
                                self.phrase_map = phrase_map;
                                return Ok(());
                            }
                        }
                    }
                }
            }
        }

        // 2. Cache miss or first compile: build grammar, commit, and cache to local storage
        log::info!(
            "Building SAPI grammar for mode: {} (saving to local storage cache)...",
            if is_chief_mode { "Chief" } else { "Cockpit Comms" }
        );

        let mut phrase_map = HashMap::new();

        unsafe {
            let grammar = self.context.CreateGrammar(0)?;
            let root_rule: Vec<u16> = "RootRule\0".encode_utf16().collect();
            let mut h_rule = SPSTATEHANDLE::default();

            grammar.GetRule(
                PCWSTR(root_rule.as_ptr()),
                1,
                (SPRAF_TopLevel.0 | SPRAF_Active.0) as u32,
                true,
                &mut h_rule,
            )?;

            let mut count = 0;

            // System commands: always active in all modes directly from root
            let sys_commands = ["stand by", "standby", "comms check", "radio check"];
            for sys_phrase in sys_commands {
                let wide: Vec<u16> = format!("{}\0", sys_phrase).encode_utf16().collect();
                let hr = grammar.AddWordTransition(
                    h_rule,
                    SPSTATEHANDLE::default(),
                    PCWSTR(wide.as_ptr()),
                    PCWSTR(ptr::null()),
                    SPWT_LEXICAL,
                    1.0,
                    ptr::null(),
                );
                if hr.is_ok() {
                    phrase_map.insert(sys_phrase.to_string(), (usize::MAX, usize::MAX));
                    count += 1;
                }
            }

            for (g_idx, group) in profile.CommandGroups.iter().enumerate() {
                let grp_name = group.Name.as_deref().unwrap_or("");
                let is_chief_group = group.Name.is_none();

                // Never load Chief Unrecognized (Group 1) into active speech grammar
                if grp_name == "Chief Unrecognized" {
                    continue;
                }

                if is_chief_mode {
                    // Chief mode active: only Group 0 commands are loaded
                    if !is_chief_group {
                        continue;
                    }
                } else {
                    // Cockpit mode: exclude Group 0 and disabled groups
                    if is_chief_group || group.Disabled.unwrap_or(false) {
                        continue;
                    }
                }

                let grp_segments = if is_chief_group {
                    &[][..]
                } else {
                    group.GroupCommand.as_ref()
                        .map(|gc| &gc.VoiceCommandKeys[..])
                        .unwrap_or(&[])
                };

                if !grp_segments.is_empty() {
                    // Optimized state-based transitions: h_rule --[prefix]--> h_grp --[cmd]--> terminal
                    // This reduces SAPI transitions from 37,000+ to ~1,000, slashing load time from 68s to 3ms!
                    let mut h_grp = SPSTATEHANDLE::default();
                    if grammar.CreateNewState(h_rule, &mut h_grp).is_ok() {
                        let prefix_variants = Self::expand_segments(grp_segments, strings, false, grp_name);
                        for p in &prefix_variants {
                            let clean_p = p.trim().to_lowercase();
                            if clean_p.len() < 2 { continue; }
                            let wide: Vec<u16> = format!("{}\0", clean_p).encode_utf16().collect();
                            let _ = grammar.AddWordTransition(
                                h_rule,
                                h_grp,
                                PCWSTR(wide.as_ptr()),
                                PCWSTR(ptr::null()),
                                SPWT_LEXICAL,
                                1.0,
                                ptr::null(),
                            );
                            count += 1;
                        }

                        for (c_idx, cmd) in group.Commands.iter().enumerate() {
                            let cmd_name = cmd.Name.as_deref().unwrap_or("");
                            if let Some(cmd_segments) = &cmd.VoiceCommandKeys {
                                let cmd_variants = Self::expand_segments(cmd_segments, strings, false, cmd_name);
                                for c in &cmd_variants {
                                    let clean_c = c.trim().to_lowercase();
                                    if clean_c.len() < 2 { continue; }
                                    let wide: Vec<u16> = format!("{}\0", clean_c).encode_utf16().collect();
                                    let _ = grammar.AddWordTransition(
                                        h_grp,
                                        SPSTATEHANDLE::default(),
                                        PCWSTR(wide.as_ptr()),
                                        PCWSTR(ptr::null()),
                                        SPWT_LEXICAL,
                                        1.0,
                                        ptr::null(),
                                    );
                                    count += 1;

                                    // Map all valid combined phrases
                                    for p in &prefix_variants {
                                        let full = format!("{} {}", p.trim().to_lowercase(), clean_c);
                                        phrase_map.insert(full, (g_idx, c_idx));
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // Direct commands from root (Chief commands & Engage Crew Chief)
                    for (c_idx, cmd) in group.Commands.iter().enumerate() {
                        let cmd_name = cmd.Name.as_deref().unwrap_or("");
                        let mut phrases = Vec::new();

                        if is_chief_group {
                            if let Some(cmd_segments) = &cmd.VoiceCommandKeys {
                                let base_phrases = Self::expand_segments(cmd_segments, strings, true, cmd_name);
                                for bp in &base_phrases {
                                    phrases.push(bp.clone());
                                    phrases.push(format!("chief {}", bp));
                                    phrases.push(format!("crew chief {}", bp));
                                    phrases.push(format!("hey chief {}", bp));
                                }
                            }

                            if cmd_name.contains("Ready Start") || cmd_name.contains("Start Two") {
                                phrases.push("ready start two".to_string());
                                phrases.push("ready start".to_string());
                                phrases.push("ready two".to_string());
                                phrases.push("start two".to_string());
                                phrases.push("clear start two".to_string());
                                phrases.push("chief ready start two".to_string());
                            } else if cmd_name.contains("Comms Check") {
                                phrases.push("comms check".to_string());
                                phrases.push("radio check".to_string());
                                phrases.push("chief comms check".to_string());
                                phrases.push("crew chief comms check".to_string());
                            } else if cmd_name.contains("Cleared Off") {
                                phrases.push("cleared off".to_string());
                                phrases.push("clear off".to_string());
                                phrases.push("chief cleared off".to_string());
                            } else if cmd_name.contains("How's Chief") {
                                phrases.push("how's chief".to_string());
                                phrases.push("hows chief".to_string());
                                phrases.push("how are you chief".to_string());
                                phrases.push("how's it going chief".to_string());
                                phrases.push("how are you doing chief".to_string());
                            }
                        } else {
                            if let Some(cmd_segments) = &cmd.VoiceCommandKeys {
                                phrases.extend(Self::expand_segments(cmd_segments, strings, false, cmd_name));
                            }
                            if grp_name == "Engage Crew Chief" {
                                phrases.push("engage chief".to_string());
                                phrases.push("engage crew chief".to_string());
                                phrases.push("activate chief".to_string());
                                phrases.push("connect intercom".to_string());
                            }
                        }

                        for phrase in phrases {
                            let clean = phrase.trim().to_lowercase();
                            if clean.is_empty() || clean.len() < 2 {
                                continue;
                            }
                            if clean == "doing" || clean == "going" || clean == "how" || clean == "tonight"
                                || clean == "morning" || clean == "today" || clean == "how going"
                                || clean == "how doing" || clean == "whats doing"
                            {
                                continue;
                            }
                            let wide: Vec<u16> = format!("{}\0", clean).encode_utf16().collect();
                            let hr = grammar.AddWordTransition(
                                h_rule,
                                SPSTATEHANDLE::default(),
                                PCWSTR(wide.as_ptr()),
                                PCWSTR(ptr::null()),
                                SPWT_LEXICAL,
                                1.0,
                                ptr::null(),
                            );
                            if hr.is_ok() {
                                phrase_map.insert(clean, (g_idx, c_idx));
                                count += 1;
                            }
                        }
                    }
                }
            }

            grammar.Commit(0)?;
            let stream = windows::Win32::System::Com::StructuredStorage::CreateStreamOnHGlobal(None, true)?;
            grammar.SaveCmd(&stream, None)?;
            let hglobal = windows::Win32::System::Com::StructuredStorage::GetHGlobalFromStream(&stream)?;
            let ptr = windows::Win32::System::Memory::GlobalLock(hglobal);
            let size = windows::Win32::System::Memory::GlobalSize(hglobal);
            if !ptr.is_null() && size > 0 {
                let slice = std::slice::from_raw_parts(ptr as *const u8, size);
                let _ = std::fs::write(&bin_path, slice);
                let _ = windows::Win32::System::Memory::GlobalUnlock(hglobal);
                if let Ok(json) = serde_json::to_string(&phrase_map) {
                    let _ = std::fs::write(&map_path, json);
                }
                log::info!("💾 Cached compiled SAPI grammar to local storage ({} bytes)", size);
            }
            grammar.SetRuleState(PCWSTR(root_rule.as_ptr()), ptr::null_mut(), SPRS_ACTIVE)?;

            log::info!(
                "Windows SAPI Grammar active: compiled {} phrases (Mode: {})",
                count,
                if is_chief_mode { "Chief" } else { "Cockpit Comms" }
            );
            self.grammar = Some(grammar);
            self.phrase_map = phrase_map;
        }

        Ok(())
    }

    /// Converts trailing numeric digit to spoken English word (e.g. "Goblin2" -> ["Goblin Two", "Goblin 2"]).
    fn expand_callsign_variants(raw: &str) -> Vec<String> {
        let clean = raw.trim();
        if clean.is_empty() {
            return vec!["Goblin Two".to_string(), "Goblin 2".to_string()];
        }
        let mut variants = vec![clean.to_string()];
        let digits = [
            ('1', "One"), ('2', "Two"), ('3', "Three"), ('4', "Four"),
            ('5', "Five"), ('6', "Six"), ('7', "Seven"), ('8', "Eight"), ('9', "Nine"),
        ];
        for (d, word) in digits {
            if clean.ends_with(d) {
                let base = &clean[..clean.len() - 1].trim();
                variants.push(format!("{} {}", base, word));
                variants.push(format!("{} {}", base, d));
            }
        }
        variants
    }

    /// Expands command voice key segments into full candidate phrases.
    fn expand_segments(
        segments: &[crate::fvx::models::VoiceCommandKeySegment],
        strings: &BmsStringInfo,
        is_chief: bool,
        cmd_name: &str,
    ) -> Vec<String> {
        let mut results = vec![String::new()];

        let callsign = if strings.callsign.is_empty() { "Goblin2" } else { &strings.callsign };
        let departure = if strings.departure.is_empty() { "Gunsan" } else { &strings.departure };
        let arrival = if strings.arrival.is_empty() { "Gunsan" } else { &strings.arrival };
        let alternate = if strings.alternate.is_empty() { "Osan" } else { &strings.alternate };
        let tanker = if strings.tanker.is_empty() { "Texaco1" } else { &strings.tanker };
        let awacs = if strings.awacs.is_empty() { "Sentry7" } else { &strings.awacs };
        let seat = if strings.seat.is_empty() { "1" } else { &strings.seat };
        let pkg_size = if strings.package_size.is_empty() { "Singleton" } else { &strings.package_size };
        let aircraft = if strings.aircraft.is_empty() { "F16" } else { &strings.aircraft };

        for (idx, seg) in segments.iter().enumerate() {
            // For How's Chief, Seg 0 ("How", "Whats", "How are") must NOT be optional,
            // otherwise single words like "doing" or "tonight" would match as How's Chief!
            let is_opt = if is_chief && cmd_name.contains("How's Chief") && idx == 0 {
                false
            } else {
                seg.Optional.unwrap_or(false)
            };

            let mut next_results = Vec::new();

            if is_opt {
                next_results.extend(results.clone());
            }

            for key_item in &seg.Keys {
                if key_item.Exclusion.unwrap_or(false) {
                    continue;
                }
                let raw_key = key_item.Key.trim_end_matches('*').trim();
                let expanded_words = if raw_key == "#Callsign" {
                    Self::expand_callsign_variants(callsign)
                } else if raw_key == "#Departure" {
                    vec![
                        departure.to_string(),
                        format!("{} Approach", departure),
                        format!("{} Tower", departure),
                        format!("{} Ground", departure),
                    ]
                } else if raw_key == "#Arrival" {
                    vec![
                        arrival.to_string(),
                        format!("{} Approach", arrival),
                        format!("{} Tower", arrival),
                    ]
                } else if raw_key == "#Alternate" {
                    vec![
                        alternate.to_string(),
                        format!("{} Tower", alternate),
                        format!("{} Approach", alternate),
                    ]
                } else if raw_key == "#Tanker" {
                    Self::expand_callsign_variants(tanker)
                } else if raw_key == "#Awacs" {
                    Self::expand_callsign_variants(awacs)
                } else if raw_key == "#Callsign #Seat" {
                    let mut combo = Vec::new();
                    for cs in Self::expand_callsign_variants(callsign) {
                        combo.push(format!("{} {}", cs, seat));
                    }
                    combo
                } else if raw_key == "#Callsign #PkgSize #Aircraft" {
                    let mut combo = Vec::new();
                    for cs in Self::expand_callsign_variants(callsign) {
                        combo.push(format!("{} {} {}", cs, pkg_size, aircraft));
                    }
                    combo
                } else if raw_key == "#Tanker #Callsign" {
                    let mut combo = Vec::new();
                    for t in Self::expand_callsign_variants(tanker) {
                        for cs in Self::expand_callsign_variants(callsign) {
                            combo.push(format!("{} {}", t, cs));
                        }
                    }
                    combo
                } else if raw_key == "#Awacs #Callsign" {
                    let mut combo = Vec::new();
                    for a in Self::expand_callsign_variants(awacs) {
                        for cs in Self::expand_callsign_variants(callsign) {
                            combo.push(format!("{} {}", a, cs));
                        }
                    }
                    combo
                } else if raw_key.eq_ignore_ascii_case("chief") {
                    vec![
                        "chief".to_string(),
                        "crew chief".to_string(),
                        "engage chief".to_string(),
                        "engage crew chief".to_string(),
                    ]
                } else {
                    vec![raw_key.to_string()]
                };

                for w in expanded_words {
                    for prefix in &results {
                        let phrase = if prefix.is_empty() {
                            w.clone()
                        } else {
                            format!("{} {}", prefix, w)
                        };
                        next_results.push(phrase);
                    }
                }
            }

            if !next_results.is_empty() {
                results = next_results;
            }
        }

        results
    }

    /// Sets recognition listening active or paused (e.g. for PTT gating).
    pub fn set_active(&self, active: bool) {
        if let Some(grammar) = &self.grammar {
            unsafe {
                let root_rule: Vec<u16> = "RootRule\0".encode_utf16().collect();
                let state = if active { SPRS_ACTIVE } else { SPRS_INACTIVE };
                let _ = grammar.SetRuleState(PCWSTR(root_rule.as_ptr()), ptr::null_mut(), state);
            }
        }
    }

    /// Polls for recognition events. Returns (group_idx, cmd_idx, recognized_text, confidence) if a phrase was recognized.
    pub fn poll_recognition(&self) -> Option<(usize, usize, String, f32)> {
        unsafe {
            let mut result = None;
            loop {
                let mut event: SPEVENT = mem::zeroed();
                let mut fetched: u32 = 0;
                let hr = self.context.GetEvents(1, &mut event, &mut fetched as *mut u32);

                if hr.is_err() || fetched == 0 {
                    break;
                }

                let event_id = (event._bitfield & 0xFFFF) as i32;
                if event_id == SPEI_RECOGNITION.0 {
                    let p_result = event.lParam.0 as *mut c_void;
                    if !p_result.is_null() {
                        let reco_result: ISpRecoResult = mem::transmute(p_result);
                        
                        // Extract confidence from SPPHRASE
                        let mut confidence: f32 = 1.0;
                        let mut phrase_ptr: *mut windows::Win32::Media::Speech::SPPHRASE = ptr::null_mut();
                        if let Ok(p) = reco_result.GetPhrase() {
                            phrase_ptr = p;
                            if !phrase_ptr.is_null() {
                                let phrase_ref = &*phrase_ptr;
                                confidence = phrase_ref.Base.Rule.SREngineConfidence;
                            }
                        }

                        let mut text_ptr: PWSTR = PWSTR(ptr::null_mut());
                        let _ = reco_result.GetText(0xFFFFFFFF, 0xFFFFFFFF, true, &mut text_ptr, None);

                        if !text_ptr.0.is_null() {
                            let text = text_ptr.to_string().unwrap_or_default().trim().to_lowercase();
                            if let Some(&(g_idx, c_idx)) = self.phrase_map.get(&text) {
                                result = Some((g_idx, c_idx, text, confidence));
                            }
                            windows::Win32::System::Com::CoTaskMemFree(Some(text_ptr.0 as *const c_void));
                        }

                        if !phrase_ptr.is_null() {
                            windows::Win32::System::Com::CoTaskMemFree(Some(phrase_ptr as *const c_void));
                        }
                    }
                    if result.is_some() {
                        return result;
                    }
                } else {
                    // For other events with COM object or pointer in lParam, release or free them
                    let param_type = ((event._bitfield >> 16) & 0xFFFF) as i32;
                    if param_type == SPET_LPARAM_IS_OBJECT.0 as i32 {
                        let obj_ptr = event.lParam.0 as *mut windows::core::IUnknown;
                        if !obj_ptr.is_null() {
                            let _: windows::core::IUnknown = mem::transmute(obj_ptr);
                        }
                    } else if param_type == SPET_LPARAM_IS_POINTER.0 as i32 || param_type == SPET_LPARAM_IS_STRING.0 as i32 {
                        if event.lParam.0 != 0 {
                            windows::Win32::System::Com::CoTaskMemFree(Some(event.lParam.0 as *const c_void));
                        }
                    }
                }
            }
            result
        }
    }

    /// Generates W3C SRGS XML grammar string from .fvx profile and current BMS strings.
    pub fn generate_srgs_xml(profile: &FvxProfile, strings: &BmsStringInfo) -> (String, HashMap<String, (usize, usize)>) {
        let mut rule_map = HashMap::new();
        let mut xml = String::from(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
            <grammar version=\"1.0\" xml:lang=\"en-GB\" root=\"RootRule\" xmlns=\"http://www.w3.org/2001/06/grammar\">\n\
            <rule id=\"RootRule\" scope=\"public\">\n<one-of>\n"
        );

        // Dynamic token rules
        let mut sub_rules = String::new();
        let callsign = if strings.callsign.is_empty() { "Goblin Two" } else { &strings.callsign };
        sub_rules.push_str(&format!(
            "<rule id=\"DynamicCallsign\"><one-of><item>{}</item></one-of></rule>\n",
            Self::xml_escape(callsign)
        ));

        let departure = if strings.departure.is_empty() { "Gunsan" } else { &strings.departure };
        sub_rules.push_str(&format!(
            "<rule id=\"DynamicDeparture\"><one-of><item>{}</item><item>{} Approach</item><item>{} Tower</item></one-of></rule>\n",
            Self::xml_escape(departure), Self::xml_escape(departure), Self::xml_escape(departure)
        ));

        // Iterate command groups
        for (g_idx, group) in profile.CommandGroups.iter().enumerate() {
            for (c_idx, cmd) in group.Commands.iter().enumerate() {
                if let Some(segments) = &cmd.VoiceCommandKeys {
                    if segments.is_empty() {
                        continue;
                    }
                    let rule_name = format!("Cmd_{}_{}", g_idx, c_idx);
                    rule_map.insert(rule_name.clone(), (g_idx, c_idx));

                    xml.push_str(&format!("<item><ruleref uri=\"#{}\"/></item>\n", rule_name));

                    sub_rules.push_str(&format!("<rule id=\"{}\">\n", rule_name));
                    for seg in segments {
                        let is_opt = seg.Optional.unwrap_or(false);
                        if is_opt {
                            sub_rules.push_str("<item repeat=\"0-1\"><one-of>\n");
                        } else {
                            sub_rules.push_str("<one-of>\n");
                        }

                        for key_item in &seg.Keys {
                            if key_item.Exclusion.unwrap_or(false) {
                                continue;
                            }
                            let text = &key_item.Key;
                            if text.starts_with("#Callsign") {
                                sub_rules.push_str("<item><ruleref uri=\"#DynamicCallsign\"/></item>\n");
                            } else if text.starts_with("#Departure") {
                                sub_rules.push_str("<item><ruleref uri=\"#DynamicDeparture\"/></item>\n");
                            } else {
                                let clean = text.trim_end_matches('*');
                                sub_rules.push_str(&format!("<item>{}</item>\n", Self::xml_escape(clean)));
                            }
                        }

                        if is_opt {
                            sub_rules.push_str("</one-of></item>\n");
                        } else {
                            sub_rules.push_str("</one-of>\n");
                        }
                    }
                    sub_rules.push_str("</rule>\n");
                }
            }
        }

        xml.push_str("</one-of>\n</rule>\n");
        xml.push_str(&sub_rules);
        xml.push_str("</grammar>\n");

        (xml, rule_map)
    }

    fn xml_escape(s: &str) -> String {
        s.replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
            .replace('\'', "&apos;")
    }
}
