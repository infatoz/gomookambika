/**
 * Go Mookambika Captain - Phone Ringing & Alert Audio Manager
 * Synthesizes a loud, urgent phone ringing alert pattern (Uber/Ola dispatch style)
 * using Web Audio API + rhythmic haptic vibration.
 * Completely self-contained, offline-ready, zero network dependencies.
 */

class PhoneRingtoneManager {
  private audioCtx: AudioContext | null = null;
  private isPlaying = false;
  private isMuted = false;
  private isVibrating = false;
  private timer: any = null;
  private vibrationTimer: any = null;

  constructor() {
    // Attempt to resume audio context on first user interaction if locked by browser autoplay policy
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
    } catch (e) {
      console.warn('AudioContext init error:', e);
      return null;
    }
  }

  /**
   * Starts the continuous phone ringing pattern and rhythmic vibration
   */
  public start() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.isMuted = false;

    // 1. Play sound pattern
    this.playRingCycle();

    // 2. Start repeating haptic vibration: [ring 400ms, pause 150ms, ring 400ms, pause 1200ms]
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      const doVibrate = () => {
        if (!this.isPlaying) return;
        try {
          this.isVibrating = true;
          navigator.vibrate([450, 150, 450, 150, 600]);
        } catch {
          this.isVibrating = false;
        }
      };
      doVibrate();
      this.vibrationTimer = setInterval(doVibrate, 2200);
    }
  }

  /**
   * Generates a single phone ring cycle:
   * Two urgent dual-frequency bursts (853Hz + 960Hz) followed by a short silence.
   */
  private playRingCycle = () => {
    if (!this.isPlaying) return;

    if (!this.isMuted) {
      const ctx = this.initContext();
      if (ctx) {
        try {
          const now = ctx.currentTime;
          // Dual bursts mimicking an urgent dispatch phone ring
          // Burst 1: 0.0s to 0.4s
          // Pause:   0.4s to 0.55s
          // Burst 2: 0.55s to 1.05s
          // Pause until next cycle at 2.2s
          const bursts = [
            { start: now + 0.05, end: now + 0.45 },
            { start: now + 0.6, end: now + 1.1 },
          ];

          bursts.forEach(({ start, end }) => {
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            // Dual tone frequencies (standard phone/emergency alert standard)
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(853, start);

            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(960, start);

            // Envelope to avoid audio clicks/pops
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(0.4, start + 0.04);
            gain.gain.setValueAtTime(0.4, end - 0.04);
            gain.gain.exponentialRampToValueAtTime(0.0001, end);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            osc1.start(start);
            osc2.start(start);
            osc1.stop(end);
            osc2.stop(end);
          });
        } catch (e) {
          console.warn('Audio ring cycle failed:', e);
        }
      }
    }

    // Schedule next cycle
    this.timer = setTimeout(this.playRingCycle, 2200);
  };

  /**
   * Mute or un-mute sound while keeping notification modal visible
   */
  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Stops the ringing and vibration completely
   */
  public stop() {
    this.isPlaying = false;
    this.isMuted = false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.vibrationTimer) {
      clearInterval(this.vibrationTimer);
      this.vibrationTimer = null;
    }

    if (this.isVibrating && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      this.isVibrating = false;
      try {
        navigator.vibrate(0);
      } catch {}
    } else {
      this.isVibrating = false;
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close().catch(() => {});
      } catch {}
      this.audioCtx = null;
    }
  }
}

export const ringtone = new PhoneRingtoneManager();
