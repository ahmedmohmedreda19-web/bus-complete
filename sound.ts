/* ===== مولّد مؤثرات صوتية بسيط (WebAudio) ===== */

class Sfx {
  private ctx: AudioContext | null = null;
  enabled = true;

  ensure() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    } catch { this.ctx = null; }
  }

  private tone(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.12, delay = 0, slideTo?: number) {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  tick() { this.tone(880, 0.06, "square", 0.05); }
  flip() { this.tone(1200 + Math.random() * 600, 0.03, "square", 0.025); }
  correct() { this.tone(659, 0.1, "sine", 0.12); this.tone(987, 0.16, "sine", 0.12, 0.07); }
  fixed() { this.tone(523, 0.09, "triangle", 0.12); this.tone(784, 0.14, "triangle", 0.12, 0.06); }
  ok() { this.tone(440, 0.12, "triangle", 0.09); this.tone(587, 0.14, "triangle", 0.08, 0.08); }
  bad() { this.tone(150, 0.22, "sawtooth", 0.1, 0, 90); }
  warn() { this.tone(1046, 0.055, "square", 0.045); }
  horn() {
    // خفرات أتوبيس!
    this.tone(311, 0.42, "sawtooth", 0.08, 0, 415);
    this.tone(370, 0.42, "sawtooth", 0.08, 0, 466);
    this.tone(311, 0.36, "sawtooth", 0.07, 0.5, 415);
    this.tone(370, 0.36, "sawtooth", 0.07, 0.5, 466);
  }
  land() { this.tone(196, 0.18, "triangle", 0.14); this.tone(523, 0.3, "triangle", 0.14, 0.1); }
  fanfare() {
    const notes = [523, 659, 784, 1046, 784, 1046, 1318];
    notes.forEach((f, i) => this.tone(f, 0.16, i > 4 ? "triangle" : "sine", 0.1, i * 0.09));
    this.tone(1568, 0.5, "triangle", 0.08, 0.66);
  }
}

export const sfx = new Sfx();
