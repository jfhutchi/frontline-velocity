// Lightweight Web Audio manager that synthesizes simple SFX procedurally.
// All sounds are generated — no external audio assets required.

type SfxName = 'click' | 'fire' | 'explosion' | 'hit' | 'victory' | 'defeat';

class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;

  ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
    } catch (err) {
      console.warn('[Audio] failed to create AudioContext', err);
      this.ctx = null;
    }
    return this.ctx;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  }

  play(name: SfxName) {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const t = ctx.currentTime;
    switch (name) {
      case 'click':
        this.tone(ctx, this.master, 660, t, 0.06, 0.18, 'square');
        break;
      case 'fire':
        this.boom(ctx, this.master, t, 0.25, 0.6);
        this.tone(ctx, this.master, 180, t, 0.18, 0.4, 'sawtooth', 90);
        break;
      case 'explosion':
        this.boom(ctx, this.master, t, 0.55, 0.9);
        this.tone(ctx, this.master, 120, t, 0.4, 0.45, 'square', 60);
        break;
      case 'hit':
        this.tone(ctx, this.master, 320, t, 0.06, 0.22, 'triangle', 220);
        break;
      case 'victory':
        this.tone(ctx, this.master, 523, t, 0.18, 0.4, 'triangle');
        this.tone(ctx, this.master, 659, t + 0.2, 0.18, 0.4, 'triangle');
        this.tone(ctx, this.master, 784, t + 0.4, 0.32, 0.5, 'triangle');
        break;
      case 'defeat':
        this.tone(ctx, this.master, 220, t, 0.4, 0.4, 'sawtooth', 120);
        this.tone(ctx, this.master, 165, t + 0.4, 0.6, 0.45, 'sawtooth', 90);
        break;
    }
  }

  private tone(
    ctx: AudioContext,
    out: AudioNode,
    freq: number,
    startTime: number,
    duration: number,
    gain: number,
    type: OscillatorType = 'sine',
    endFreq?: number,
  ) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + duration);
    }
    g.gain.setValueAtTime(0, startTime);
    g.gain.linearRampToValueAtTime(gain, startTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(g);
    g.connect(out);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  private boom(ctx: AudioContext, out: AudioNode, startTime: number, duration: number, gain: number) {
    // Generate a short noise burst with a low-pass for "thump".
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const tt = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - tt, 1.6);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 280;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(out);
    src.start(startTime);
    src.stop(startTime + duration + 0.05);
  }
}

export const AudioManager = new AudioManagerImpl();
