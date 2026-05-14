// Lightweight Web Audio manager that synthesizes simple SFX procedurally.
// All sounds are generated — no external audio assets required.

type SfxName = 'click' | 'fire' | 'explosion' | 'hit' | 'victory' | 'defeat';

class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  /** Background music sub-graph. Kept separate so it can be muted/started
   *  independently from SFX. All sounds are synthesized — no copyrighted
   *  audio is shipped or loaded. */
  private musicGain: GainNode | null = null;
  private musicNodes: AudioNode[] = [];
  private musicTimer: number | null = null;
  private musicRunning = false;
  private musicMuted = false;

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

  setMusicMuted(m: boolean) {
    this.musicMuted = m;
    if (this.musicGain) this.musicGain.gain.value = m ? 0 : 0.18;
  }

  /**
   * Start a low-key procedural ambient bed evocative of WW2 war drums — a
   * slow timpani / snare march underneath a low brass-like drone. No
   * copyrighted material is loaded or referenced; everything is synthesized
   * by oscillators and noise buffers.
   */
  startMusic() {
    const ctx = this.ensure();
    if (!ctx || this.musicRunning) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    this.musicRunning = true;
    const out = ctx.destination;
    const musicGain = ctx.createGain();
    musicGain.gain.value = this.musicMuted ? 0 : 0.18;
    musicGain.connect(out);
    this.musicGain = musicGain;

    // Low brass-like drone: two slightly detuned sawtooths through a
    // gentle low-pass and slow tremolo for a "war film" pad.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    lp.Q.value = 0.6;
    lp.connect(musicGain);

    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.22;
    droneGain.connect(lp);

    const tremolo = ctx.createOscillator();
    tremolo.frequency.value = 0.18;
    const tremoloDepth = ctx.createGain();
    tremoloDepth.gain.value = 0.06;
    tremolo.connect(tremoloDepth);
    tremoloDepth.connect(droneGain.gain);
    tremolo.start();

    const droneA = ctx.createOscillator();
    droneA.type = 'sawtooth';
    droneA.frequency.value = 73.4; // ~D2
    const droneB = ctx.createOscillator();
    droneB.type = 'sawtooth';
    droneB.frequency.value = 87.3; // ~F2 minor third
    const droneC = ctx.createOscillator();
    droneC.type = 'triangle';
    droneC.frequency.value = 146.8; // D3 octave up, softer
    droneA.connect(droneGain);
    droneB.connect(droneGain);
    droneC.connect(droneGain);
    droneA.start();
    droneB.start();
    droneC.start();

    this.musicNodes.push(tremolo, tremoloDepth, droneA, droneB, droneC, droneGain, lp, musicGain);

    // Slow snare / kick march loop using shared noise + tone helpers.
    const beatMs = 720; // ~83 BPM — slow march feel
    let beat = 0;
    const tick = () => {
      if (!this.musicRunning || !this.musicGain) return;
      const t = ctx.currentTime;
      // Beat 0 + 2: kick. Beat 1 + 3: snare. Sprinkle distant tom.
      const phase = beat % 4;
      if (phase === 0 || phase === 2) this.kickThump(ctx, this.musicGain, t, 0.32);
      if (phase === 1 || phase === 3) this.snareHit(ctx, this.musicGain, t, 0.18);
      if (phase === 3 && beat % 16 === 15) this.tomRoll(ctx, this.musicGain, t);
      beat += 1;
    };
    tick();
    this.musicTimer = window.setInterval(tick, beatMs);
  }

  stopMusic() {
    if (!this.musicRunning) return;
    this.musicRunning = false;
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    for (const n of this.musicNodes) {
      try {
        (n as OscillatorNode).stop?.();
      } catch {
        /* not an oscillator */
      }
      try {
        n.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    this.musicNodes = [];
    this.musicGain = null;
  }

  private kickThump(ctx: AudioContext, out: AudioNode, t: number, gain: number) {
    const length = Math.floor(ctx.sampleRate * 0.32);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      const tt = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - tt, 3.5);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 95;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(lp);
    lp.connect(g);
    g.connect(out);
    src.start(t);
    src.stop(t + 0.4);
  }

  private snareHit(ctx: AudioContext, out: AudioNode, t: number, gain: number) {
    const length = Math.floor(ctx.sampleRate * 0.22);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      const tt = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - tt, 2.5);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    src.connect(hp);
    hp.connect(g);
    g.connect(out);
    src.start(t);
    src.stop(t + 0.26);
  }

  private tomRoll(ctx: AudioContext, out: AudioNode, t: number) {
    for (let i = 0; i < 4; i += 1) {
      const tt = t + i * 0.085;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140 + i * 6, tt);
      osc.frequency.exponentialRampToValueAtTime(70, tt + 0.18);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, tt);
      g.gain.linearRampToValueAtTime(0.16, tt + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.22);
      osc.connect(g);
      g.connect(out);
      osc.start(tt);
      osc.stop(tt + 0.25);
    }
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
