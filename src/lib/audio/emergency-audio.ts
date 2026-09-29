/**
 * Emergency Audio Synthesizer & Looping Alarm Controller
 * 
 * Uses the Web Audio API to generate a distinct, clean clinical emergency alert tone.
 * Plays on a loop every 4 seconds until the admin checks, opens, or acknowledges the alert.
 */

class EmergencyAudioService {
  private audioCtx: AudioContext | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private isMuted: boolean = false;
  private activeAlertId: string | null = null;
  private isRunning: boolean = false;
  private listeners: Set<(state: { isRunning: boolean; isMuted: boolean; alertId: string | null; alertText: string | null }) => void> = new Set();
  private currentAlertText: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // Auto-unlock Web Audio context on first user interaction if blocked by autoplay policy
      const unlockAudio = () => {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
      };

      window.addEventListener('click', unlockAudio);
      window.addEventListener('keydown', unlockAudio);
      window.addEventListener('touchstart', unlockAudio);
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    return this.audioCtx;
  }

  /**
   * Plays a single two-tone medical emergency alert beep
   */
  public playAlertBeep(volume: number = 0.35): void {
    if (this.isMuted) return;

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Tone 1: High warning chime (880 Hz / A5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(volume, now + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.23);

      // Tone 2: Mid urgent chime (740 Hz / F#5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(740, now + 0.14);
      gain2.gain.setValueAtTime(0, now + 0.14);
      gain2.gain.linearRampToValueAtTime(volume * 1.1, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.14);
      osc2.stop(now + 0.40);

      // Tone 3: High confirmation pulse (987.77 Hz / B5)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(987.77, now + 0.30);
      gain3.gain.setValueAtTime(0, now + 0.30);
      gain3.gain.linearRampToValueAtTime(volume * 0.9, now + 0.34);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.30);
      osc3.stop(now + 0.60);
    } catch {
      // Gracefully handle browser audio restrictions
    }
  }

  /**
   * Starts a continuous alarm that beeps every 3.8 seconds until stopped or acknowledged
   */
  public startAlarm(alertId: string, alertText: string = 'Critical Emergency Alert'): void {
    this.activeAlertId = alertId;
    this.currentAlertText = alertText;
    this.isRunning = true;

    // Play initial beep immediately
    this.playAlertBeep();

    // Clear any existing timer
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Loop every 3.8 seconds
    this.intervalId = setInterval(() => {
      this.playAlertBeep();
    }, 3800);

    this.notify();
  }

  /**
   * Stops and silences the alarm (called when admin clicks, views, or acknowledges the alert)
   */
  public stopAlarm(alertId?: string): void {
    if (alertId && this.activeAlertId && this.activeAlertId !== alertId) {
      return; // Not the active alert
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    this.activeAlertId = null;
    this.currentAlertText = null;
    this.notify();
  }

  /**
   * Toggle mute for sound
   */
  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    this.notify();
    return this.isMuted;
  }

  public setMute(muted: boolean): void {
    this.isMuted = muted;
    this.notify();
  }

  public getState() {
    return {
      isRunning: this.isRunning,
      isMuted: this.isMuted,
      alertId: this.activeAlertId,
      alertText: this.currentAlertText,
    };
  }

  public subscribe(callback: (state: { isRunning: boolean; isMuted: boolean; alertId: string | null; alertText: string | null }) => void): () => void {
    this.listeners.add(callback);
    callback(this.getState());
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }
}

export const emergencyAudio = new EmergencyAudioService();
