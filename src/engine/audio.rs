use rand::seq::SliceRandom;
use rodio::{Decoder, OutputStream, Sink};
use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};

use std::sync::Mutex;

pub struct AudioPlayer {
    // Keep stream handle alive so audio plays
    _stream: OutputStream,
    stream_handle: rodio::OutputStreamHandle,
    shared_sink: Mutex<Option<Sink>>,
}

impl AudioPlayer {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let (stream, stream_handle) = OutputStream::try_default()?;
        let initial_sink = Sink::try_new(&stream_handle).ok();
        Ok(Self {
            _stream: stream,
            stream_handle,
            shared_sink: Mutex::new(initial_sink),
        })
    }

    /// Stops any currently playing audio immediately.
    pub fn stop(&self) {
        let mut guard = self.shared_sink.lock().unwrap();
        if let Some(s) = guard.take() {
            s.stop();
        }
        *guard = Sink::try_new(&self.stream_handle).ok();
    }

    /// Plays an audio file sequentially on the shared channel.
    /// If await_audio is true, blocks until the audio finishes playing.
    pub fn play_sound(&self, primary_path: &Path, alt_paths: &[PathBuf], await_audio: bool) {
        let mut candidates = vec![primary_path.to_path_buf()];
        candidates.extend_from_slice(alt_paths);

        // Filter for existing files
        let existing: Vec<&PathBuf> = candidates.iter().filter(|p| p.exists()).collect();
        if existing.is_empty() {
            log::warn!("Audio file not found: {:?}", primary_path);
            return;
        }

        // Pick one at random if there are alternatives
        let mut rng = rand::thread_rng();
        let chosen = existing.choose(&mut rng).unwrap();

        if let Ok(file) = File::open(chosen) {
            let reader = BufReader::new(file);
            if let Ok(source) = Decoder::new(reader) {
                let mut guard = self.shared_sink.lock().unwrap();
                if guard.is_none() {
                    *guard = Sink::try_new(&self.stream_handle).ok();
                }

                if let Some(ref sink) = *guard {
                    sink.append(source);
                    log::info!(
                        "Playing audio: {:?}",
                        chosen.file_name().unwrap_or_default()
                    );
                    if await_audio {
                        sink.sleep_until_end();
                    }
                }
            }
        }
    }

    /// Plays raw audio bytes (e.g. embedded startup/ready chirp).
    pub fn play_bytes(&self, bytes: &'static [u8]) {
        let cursor = std::io::Cursor::new(bytes);
        if let Ok(source) = Decoder::new(cursor) {
            let mut guard = self.shared_sink.lock().unwrap();
            if guard.is_none() {
                *guard = Sink::try_new(&self.stream_handle).ok();
            }

            if let Some(ref sink) = *guard {
                sink.append(source);
                log::info!("Playing audio cue");
            }
        }
    }

    /// Plays raw audio bytes and waits until playback finishes (sync).
    pub fn play_bytes_sync(&self, bytes: &'static [u8]) {
        let cursor = std::io::Cursor::new(bytes);
        if let Ok(source) = Decoder::new(cursor) {
            if let Ok(sink) = Sink::try_new(&self.stream_handle) {
                log::info!("Playing completion audio cue");
                sink.append(source);
                sink.sleep_until_end();
            }
        }
    }

    /// Plays a system sound from disk if present, falling back to embedded bytes.
    pub fn play_system_sound(&self, filename: &str, fallback_bytes: &'static [u8]) {
        let local_path = Path::new(filename);
        if local_path.exists() {
            self.play_sound(local_path, &[], false);
        } else {
            self.play_bytes(fallback_bytes);
        }
    }

    /// Plays a system sound synchronously, waiting until playback finishes so short cues aren't cut off when a temporary player drops.
    pub fn play_system_sound_sync(&self, filename: &str, fallback_bytes: &'static [u8]) {
        let local_path = Path::new(filename);
        if local_path.exists() {
            self.play_sound(local_path, &[], true);
        } else {
            self.play_bytes_sync(fallback_bytes);
        }
    }
}

pub const CHIRP_BYTES: &[u8] = include_bytes!("../../assets/sounds/chirp.mp3");
pub const LOUD_N_CLEAR_BYTES: &[u8] = include_bytes!("../../assets/sounds/loud-n-clear.mp3");
pub const STANDING_BY_BYTES: &[u8] = include_bytes!("../../assets/sounds/standing-by.mp3");
pub const INIT_SOUND_BYTES: &[u8] = include_bytes!("../../assets/sounds/init.mp3");
pub const COMMIT_SOUND_BYTES: &[u8] = include_bytes!("../../assets/sounds/commit.mp3");
