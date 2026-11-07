// Web Audio Synthesizer for Authentic Cockpit & Avionics Acoustic Feedback

class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private volume: number = 0.5;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.initContext();
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });
    }
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setSettings(enabled: boolean, volume: number) {
    this.enabled = enabled;
    this.volume = Math.max(0, Math.min(1, volume));
  }

  // 1. Mechanical Relay Click (Light tactical button / OSB press)
  public playClick() {
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.012);

    gain.gain.setValueAtTime(0.25 * this.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.012);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.015);
  }

  // 2. Heavy Toggle Switch Flip (e.g. Master Mode, Guard, PTT)
  public playSwitch() {
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.025);

    gain.gain.setValueAtTime(0.4 * this.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.03);
  }

  // 3. Kneeboard Binder Page Turn (Subtle matte laminate rustle)
  public playPageTurn() {
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // Filtered noise transient simulating paper flip
    const bufferSize = this.ctx.sampleRate * 0.04;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, t);
    filter.Q.setValueAtTime(3, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2 * this.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);
  }

  // 4. DDS Commit Acknowledgment (Chime transient)
  public playCommit() {
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, t);
    osc1.frequency.setValueAtTime(1320, t + 0.05);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(440, t);
    osc2.frequency.setValueAtTime(660, t + 0.05);

    gain.gain.setValueAtTime(0.2 * this.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.12);
    osc2.stop(t + 0.12);
  }
}

export const Sound = new SoundEngine();
