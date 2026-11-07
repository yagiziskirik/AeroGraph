use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use windows::Win32::Media::Audio::Endpoints::IAudioMeterInformation;
use windows::Win32::Media::Audio::{
    eCapture, eCommunications, eConsole, eMultimedia, IAudioClient, IMMDeviceEnumerator,
    MMDeviceEnumerator, AUDCLNT_SHAREMODE_SHARED,
};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
};

pub struct AudioPeakMeter {
    meter: Option<IAudioMeterInformation>,
    _client: Option<IAudioClient>,
}

unsafe impl Send for AudioPeakMeter {}

impl Default for AudioPeakMeter {
    fn default() -> Self {
        Self::new()
    }
}

impl AudioPeakMeter {
    pub fn new() -> Self {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        }
        let (meter, client) = Self::init_meter();
        Self {
            meter,
            _client: client,
        }
    }

    fn init_meter() -> (Option<IAudioMeterInformation>, Option<IAudioClient>) {
        unsafe {
            let enumerator: IMMDeviceEnumerator =
                match CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) {
                    Ok(e) => e,
                    Err(err) => {
                        log::warn!(
                            "AudioPeakMeter: Failed to create MMDeviceEnumerator: {:?}",
                            err
                        );
                        return (None, None);
                    }
                };

            let device = enumerator
                .GetDefaultAudioEndpoint(eCapture, eConsole)
                .or_else(|_| enumerator.GetDefaultAudioEndpoint(eCapture, eCommunications))
                .or_else(|_| enumerator.GetDefaultAudioEndpoint(eCapture, eMultimedia))
                .ok();

            let device = match device {
                Some(d) => d,
                None => {
                    log::warn!("AudioPeakMeter: No default audio capture endpoint found.");
                    return (None, None);
                }
            };

            // Start a lightweight shared capture stream so Windows keeps the capture pin actively running
            let client: Option<IAudioClient> = device.Activate(CLSCTX_ALL, None).ok();
            if let Some(ref client) = client {
                if let Ok(pwfx) = client.GetMixFormat() {
                    let _ =
                        client.Initialize(AUDCLNT_SHAREMODE_SHARED, 0, 10_000_000, 0, pwfx, None);
                    let _ = client.Start();
                    log::info!("AudioPeakMeter: Active capture stream initialized via CoreAudio");
                }
            }

            let meter: Option<IAudioMeterInformation> = device.Activate(CLSCTX_ALL, None).ok();
            (meter, client)
        }
    }

    pub fn get_peak(&mut self) -> f32 {
        if self.meter.is_none() {
            let (m, c) = Self::init_meter();
            self.meter = m;
            self._client = c;
        }
        if let Some(ref meter) = self.meter {
            unsafe {
                if let Ok(peak) = meter.GetPeakValue() {
                    return peak.clamp(0.0, 1.0);
                }
            }
            self.meter = None;
            self._client = None;
        }
        0.0
    }

    /// Spawns a background thread that samples the default capture endpoint at ~50 Hz
    /// only when `ui_visible` is true AND `voice_recognition_enabled` is true.
    /// When either is false, it drops audio clients, releases mic hardware, and sleeps consuming zero CPU.
    pub fn spawn_sampling_thread(
        running: Arc<AtomicBool>,
        ui_visible: Arc<AtomicBool>,
        voice_recognition_enabled: Arc<AtomicBool>,
        mic_level: Arc<AtomicU32>,
    ) -> thread::JoinHandle<()> {
        thread::Builder::new()
            .name("aerograph-audio-meter".to_string())
            .spawn(move || {
                unsafe {
                    let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
                }
                let mut peak_meter = AudioPeakMeter::new();

                while running.load(Ordering::Relaxed) {
                    let is_active = ui_visible.load(Ordering::Relaxed)
                        && voice_recognition_enabled.load(Ordering::Relaxed);

                    if !is_active {
                        // Drop client and meter when tactical console is closed / hidden OR voice recognition is disabled
                        if peak_meter.meter.is_some() || peak_meter._client.is_some() {
                            if let Some(ref client) = peak_meter._client {
                                unsafe {
                                    let _ = client.Stop();
                                }
                            }
                            peak_meter.meter = None;
                            peak_meter._client = None;
                            mic_level.store(0, Ordering::Relaxed);
                        }
                        thread::sleep(Duration::from_millis(100));
                        continue;
                    }

                    let val = peak_meter.get_peak();
                    mic_level.store(val.to_bits(), Ordering::Relaxed);
                    thread::sleep(Duration::from_millis(20)); // ~50 Hz sampling rate
                }
            })
            .expect("Failed to spawn audio meter thread")
    }
}
