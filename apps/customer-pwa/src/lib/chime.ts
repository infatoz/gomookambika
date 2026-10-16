/**
 * Go Mookambika Customer App - Pleasant Audio Chimes for Trip Updates
 * Synthesizes melodious notification sounds using Web Audio API.
 * 100% offline, zero network assets required, lightweight.
 */

class CustomerChimeManager {
  private audioCtx: AudioContext | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlockAudio = () => {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
      };
      window.addEventListener('click', unlockAudio, { once: true, passive: true });
      window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
    }
  }

  private initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return null;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  /**
   * Plays a pleasant 2-tone melodic chime for trip updates
   * (e.g. Captain assigned, Captain arrived, Trip started)
   */
  public playUpdateChime() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Tone 1: 587.33 Hz (D5)
      // Tone 2: 880.00 Hz (A5)
      const notes = [
        { freq: 587.33, start: now, end: now + 0.18 },
        { freq: 880.0, start: now + 0.15, end: now + 0.55 },
      ];

      notes.forEach(({ freq, start, end }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.3, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(end);
      });
    } catch (e) {
      console.warn('Trip update chime failed:', e);
    }
  }

  /**
   * Plays a celebratory 3-tone chime for trip completion / success
   */
  public playSuccessChime() {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz) -> C6 (1046Hz)
      const notes = [
        { freq: 523.25, start: now, end: now + 0.15 },
        { freq: 659.25, start: now + 0.12, end: now + 0.27 },
        { freq: 783.99, start: now + 0.24, end: now + 0.42 },
        { freq: 1046.5, start: now + 0.38, end: now + 0.85 },
      ];

      notes.forEach(({ freq, start, end }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.28, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(end);
      });
    } catch (e) {
      console.warn('Trip success chime failed:', e);
    }
  }
}

export const customerChime = new CustomerChimeManager();
