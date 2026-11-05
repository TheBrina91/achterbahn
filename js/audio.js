/* CoasterCraft 2D - Procedural Web Audio Sound Engine */

class CoasterAudio {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.isInitialized = false;

    // Continuous sound nodes
    this.rumbleGain = null;
    this.rumbleFilter = null;
    this.windGain = null;
    this.windFilter = null;

    // Chain lift state
    this.lastChainClickTime = 0;
    this.lastScreamTime = 0;
  }

  init() {
    if (this.isInitialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();

      // Continuous rail rumble (filtered pink noise)
      const rumbleNoise = this.createNoiseBuffer();
      const rumbleSource = this.ctx.createBufferSource();
      rumbleSource.buffer = rumbleNoise;
      rumbleSource.loop = true;

      this.rumbleFilter = this.ctx.createBiquadFilter();
      this.rumbleFilter.type = 'lowpass';
      this.rumbleFilter.frequency.value = 120;

      this.rumbleGain = this.ctx.createGain();
      this.rumbleGain.gain.value = 0.0001;

      rumbleSource.connect(this.rumbleFilter);
      this.rumbleFilter.connect(this.rumbleGain);
      this.rumbleGain.connect(this.ctx.destination);
      rumbleSource.start(0);

      // Wind rush for high speeds
      const windSource = this.ctx.createBufferSource();
      windSource.buffer = rumbleNoise;
      windSource.loop = true;

      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 400;
      this.windFilter.Q.value = 1.2;

      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.0001;

      windSource.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.ctx.destination);
      windSource.start(0);

      this.isInitialized = true;
    } catch (e) {
      console.warn("Web Audio API could not be initialized:", e);
    }
  }

  ensureContext() {
    if (!this.isInitialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  createNoiseBuffer(seconds = 3) {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * seconds;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Pink noise filter
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted && this.ctx) {
      if (this.rumbleGain) this.rumbleGain.gain.value = 0.0001;
      if (this.windGain) this.windGain.gain.value = 0.0001;
    }
    return this.isMuted;
  }

  updateRumble(speedKmH, isMoving) {
    if (!this.isInitialized || this.isMuted) return;

    const absSpeed = Math.abs(speedKmH);
    if (!isMoving || absSpeed < 1) {
      this.rumbleGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.1);
      this.windGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.1);
      return;
    }

    // Speed up to ~140 km/h
    const normSpeed = Math.min(absSpeed / 120, 1.4);

    // Rumble volume & cutoff
    const rumbleVol = Math.min(0.28 * normSpeed, 0.35);
    const rumbleFreq = 80 + normSpeed * 320;

    this.rumbleGain.gain.setTargetAtTime(rumbleVol, this.ctx.currentTime, 0.05);
    this.rumbleFilter.frequency.setTargetAtTime(rumbleFreq, this.ctx.currentTime, 0.05);

    // Wind volume kicks in above 35 km/h
    if (absSpeed > 35) {
      const windNorm = Math.min((absSpeed - 35) / 80, 1.2);
      const windVol = 0.22 * windNorm;
      const windFreq = 250 + windNorm * 600;
      this.windGain.gain.setTargetAtTime(windVol, this.ctx.currentTime, 0.08);
      this.windFilter.frequency.setTargetAtTime(windFreq, this.ctx.currentTime, 0.08);
    } else {
      this.windGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.1);
    }
  }

  playChainClick(speed = 1) {
    if (!this.isInitialized || this.isMuted) return;
    const now = performance.now();
    // Throttle clicks based on speed
    const interval = Math.max(120 / speed, 70);
    if (now - this.lastChainClickTime < interval) return;
    this.lastChainClickTime = now;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260 + Math.random() * 80, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.035);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(120, t);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.045);
  }

  playBoostSound() {
    if (!this.isInitialized || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(680, t + 0.45);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.52);
  }

  playMaglevCharge(duration = 1.2) {
    if (!this.isInitialized || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sine';

    osc1.frequency.setValueAtTime(85, t);
    osc1.frequency.exponentialRampToValueAtTime(520, t + duration);

    osc2.frequency.setValueAtTime(170, t);
    osc2.frequency.exponentialRampToValueAtTime(1040, t + duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.exponentialRampToValueAtTime(1200, t + duration);
    filter.Q.value = 3.0;

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.22, t + duration * 0.85);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + duration + 0.02);
    osc2.stop(t + duration + 0.02);
  }

  playMaglevLaunch() {
    if (!this.isInitialized || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(920, t + 0.35);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.7);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.72);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.75);
  }

  playBrakeHiss() {
    if (!this.isInitialized || this.isMuted) return;
    const t = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.5);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.Q.value = 2.0;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);
    noise.stop(t + 0.38);
  }

  playWaterSplash(intensity = 1.0) {
    if (!this.isInitialized || this.isMuted) return;
    const now = performance.now();
    if (this.lastSplashTime && now - this.lastSplashTime < 140) return;
    this.lastSplashTime = now;

    const t = this.ctx.currentTime;
    const dur = 0.45 + Math.min(0.45, intensity * 0.2);
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(dur + 0.1);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, t);
    filter.frequency.exponentialRampToValueAtTime(380, t + dur);
    filter.Q.value = 1.2;

    const gain = this.ctx.createGain();
    const vol = Math.min(0.32, 0.14 * Math.max(0.6, intensity));
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);
    noise.stop(t + dur + 0.02);
  }

  playScream(intensity = 1) {
    if (!this.isInitialized || this.isMuted) return;
    const now = performance.now();
    if (now - this.lastScreamTime < 1800) return; // Don't spam screams
    this.lastScreamTime = now;

    const t = this.ctx.currentTime;
    // Synthesize vocalized "Wooo!" / cheerful yell using resonant formant filters
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    const basePitch = 380 + Math.random() * 180;
    osc.frequency.setValueAtTime(basePitch, t);
    osc.frequency.linearRampToValueAtTime(basePitch * 1.35, t + 0.15);
    osc.frequency.exponentialRampToValueAtTime(basePitch * 0.9, t + 0.65);

    // Formant filter (vowel 'Ooh' / 'Aah')
    const formant = this.ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.setValueAtTime(750, t);
    formant.Q.value = 4.5;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.15 * Math.min(intensity, 1.2), t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

    osc.connect(formant);
    formant.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.7);
  }

  playClick() {
    if (!this.isInitialized || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.04);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.045);
  }

  playCrash() {
    if (!this.isInitialized || this.isMuted) return;
    const t = this.ctx.currentTime;
    // Metal clang + impact explosion
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(1.2);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, t);
    filter.frequency.exponentialRampToValueAtTime(80, t + 0.8);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);
    noise.stop(t + 0.95);
  }
}

window.coasterAudio = new CoasterAudio();

