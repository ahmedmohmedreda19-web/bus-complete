/* ===== نظام جزيئات خفيف (Canvas + rAF) — كونفيتي وانفجارات ===== */

interface Particle {
  x: number; y: number; vx: number; vy: number;
  g: number; life: number; max: number; size: number;
  color: string; rot: number; vr: number; shape: 0 | 1;
}

export const PALETTES = {
  exact: ["#6bc9a0", "#4fae87", "#a8ddc6", "#cdeade"],
  fixed: ["#7fb3d5", "#5d92b8", "#b3d3e8", "#d0e4f0"],
  ok: ["#e8b563", "#d99a45", "#f0d4a3", "#f5e3c4"],
  win: ["#e8b563", "#6bc9a0", "#7fb3d5", "#d998b8", "#a898d0", "#dda76b"],
  bad: ["#dd8f8f", "#e0899b", "#eec0c0"],
};

class Fx {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private parts: Particle[] = [];
  private raf = 0;
  private last = 0;

  init(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    window.addEventListener("resize", fit);
  }

  burst(x: number, y: number, palette: string[], count = 26, power = 7) {
    if (!this.ctx) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.35 + Math.random() * 0.65) * power;
      this.parts.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - power * 0.45,
        g: 0.22 + Math.random() * 0.12,
        life: 0, max: 42 + Math.random() * 34,
        size: 1.5 + Math.random() * 2.2,
        color: palette[(Math.random() * palette.length) | 0],
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
        shape: Math.random() > 0.5 ? 1 : 0,
      });
    }
    if (this.parts.length > 420) this.parts.splice(0, this.parts.length - 420);
    this.kick();
  }

  burstAtEl(el: Element | null, palette: string[], count = 26, power = 7) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    this.burst(r.left + r.width / 2, r.top + r.height / 2, palette, count, power);
  }

  rain(palette: string[], count = 130) {
    const w = window.innerWidth;
    for (let i = 0; i < count; i++) {
      this.parts.push({
        x: Math.random() * w, y: -20 - Math.random() * window.innerHeight * 0.5,
        vx: (Math.random() - 0.5) * 2.4, vy: 3.4 + Math.random() * 3.6,
        g: 0.05, life: 0, max: 130 + Math.random() * 60,
        size: 4 + Math.random() * 5,
        color: palette[(Math.random() * palette.length) | 0],
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.24,
        shape: 1,
      });
    }
    this.kick();
  }

  private kick() {
    if (this.raf) return;
    this.last = performance.now();
    const step = (t: number) => {
      const dt = Math.min(2.5, (t - this.last) / 16.7);
      this.last = t;
      this.update(dt);
      if (this.parts.length) this.raf = requestAnimationFrame(step);
      else { this.raf = 0; this.clear(); }
    };
    this.raf = requestAnimationFrame(step);
  }

  private clear() {
    if (this.canvas && this.ctx) this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  private update(dt: number) {
    if (!this.ctx) return;
    this.clear();
    const ctx = this.ctx;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life += dt;
      if (p.life >= p.max) { this.parts.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const fade = 1 - p.life / p.max;
      ctx.globalAlpha = Math.max(0, fade);
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.shape === 1) ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      else { ctx.beginPath(); ctx.arc(0, 0, p.size * 0.9, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

export const fx = new Fx();
