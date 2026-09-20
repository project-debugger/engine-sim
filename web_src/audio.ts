import { EnginePreset } from './types';

export class EngineAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;

  // Sound nodes
  private oscBase: OscillatorNode | null = null;
  private oscSub: OscillatorNode | null = null;
  private oscHarmonic: OscillatorNode | null = null;
  private waveShaper: WaveShaperNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private starterOsc: OscillatorNode | null = null;
  private starterGain: GainNode | null = null;

  private isStarted: boolean = false;

  public init(): void {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtx();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Distortion curve for throat exhaust crackle
    this.waveShaper = this.ctx.createWaveShaper();
    this.waveShaper.curve = this.makeDistortionCurve(16) as any;
    this.waveShaper.oversample = '2x';

    // Resonant lowpass exhaust filter
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.setValueAtTime(400, this.ctx.currentTime);
    this.filter.Q.setValueAtTime(3.5, this.ctx.currentTime);

    // Main cylinder firing pulse oscillator
    this.oscBase = this.ctx.createOscillator();
    this.oscBase.type = 'sawtooth';

    // Sub-harmonic oscillator for crank rumble
    this.oscSub = this.ctx.createOscillator();
    this.oscSub.type = 'triangle';

    // Higher order valve & exhaust harmonic
    this.oscHarmonic = this.ctx.createOscillator();
    this.oscHarmonic.type = 'sawtooth';

    // Starter motor whirr
    this.starterOsc = this.ctx.createOscillator();
    this.starterOsc.type = 'sine';
    this.starterOsc.frequency.setValueAtTime(70, this.ctx.currentTime);

    this.starterGain = this.ctx.createGain();
    this.starterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.starterOsc.connect(this.starterGain);
    this.starterGain.connect(this.masterGain);

    // Connect engine oscs -> waveShaper -> filter -> masterGain
    const engineGain = this.ctx.createGain();
    engineGain.gain.setValueAtTime(0.7, this.ctx.currentTime);

    this.oscBase.connect(engineGain);
    this.oscSub.connect(engineGain);
    this.oscHarmonic.connect(engineGain);

    engineGain.connect(this.waveShaper);
    this.waveShaper.connect(this.filter);
    this.filter.connect(this.masterGain);

    this.oscBase.start();
    this.oscSub.start();
    this.oscHarmonic.start();
    this.starterOsc.start();
    this.isStarted = true;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.28, this.ctx.currentTime, 0.05);
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public update(
    rpm: number,
    throttle: number,
    ignition: boolean,
    starter: boolean,
    preset: EnginePreset
  ): void {
    if (!this.ctx || !this.isStarted) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const t = this.ctx.currentTime;

    // Starter motor sound
    if (this.starterGain && this.starterOsc) {
      const starterVol = starter ? 0.35 : 0.0;
      this.starterGain.gain.setTargetAtTime(starterVol, t, 0.04);
      if (starter) {
        this.starterOsc.frequency.setTargetAtTime(65 + Math.random() * 8, t, 0.05);
      }
    }

    // Engine firing frequency: fundamental = (RPM / 60) * (cylinders / 2)
    const isRunning = ignition && rpm > 80;
    const fundamental = Math.max(12, (rpm / 60) * (preset.cylinders / 2));

    if (this.oscBase && this.oscSub && this.oscHarmonic) {
      if (isRunning) {
        this.oscBase.frequency.setTargetAtTime(fundamental, t, 0.02);
        this.oscSub.frequency.setTargetAtTime(fundamental * 0.5, t, 0.02);
        this.oscHarmonic.frequency.setTargetAtTime(fundamental * 2.0, t, 0.02);
      } else {
        // Slow coast down hum
        this.oscBase.frequency.setTargetAtTime(20, t, 0.1);
        this.oscSub.frequency.setTargetAtTime(10, t, 0.1);
      }
    }

    if (this.filter && this.masterGain && !this.isMuted) {
      if (isRunning) {
        // Filter opens with RPM and throttle
        const cutoff = Math.min(
          9000,
          250 + (rpm * 0.9) + (throttle * 2400 * preset.soundTimbre.highPitchGain)
        );
        this.filter.frequency.setTargetAtTime(cutoff, t, 0.03);

        const targetVolume = Math.min(
          0.45,
          0.12 + (throttle * 0.22) + (rpm / preset.maxRpm) * 0.15
        );
        this.masterGain.gain.setTargetAtTime(targetVolume, t, 0.03);
      } else if (!starter) {
        this.masterGain.gain.setTargetAtTime(0, t, 0.08);
      }
    }
  }

  // Trigger backfire pop
  public triggerBackfire(): void {
    if (!this.ctx || this.isMuted || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const popOsc = this.ctx.createOscillator();
    const popGain = this.ctx.createGain();

    popOsc.type = 'square';
    popOsc.frequency.setValueAtTime(140, now);
    popOsc.frequency.exponentialRampToValueAtTime(30, now + 0.08);

    popGain.gain.setValueAtTime(0.5, now);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    popOsc.connect(popGain);
    popGain.connect(this.masterGain);

    popOsc.start(now);
    popOsc.stop(now + 0.1);
  }

  private makeDistortionCurve(amount: number): Float32Array {
    const k = typeof amount === 'number' ? amount : 50;
    const nSamples = 44100;
    const curve = new Float32Array(nSamples);
    const deg = Math.PI / 180;
    for (let i = 0; i < nSamples; ++i) {
      const x = (i * 2) / nSamples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }
}
