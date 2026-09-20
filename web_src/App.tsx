import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Smartphone,
  Play,
  Volume2,
  VolumeX,
  Gauge,
  Sliders,
  Flame,
  RotateCcw,
  Zap,
  Radio,
  Settings2,
  CheckCircle,
  Sparkles
} from 'lucide-react';
import { ENGINE_PRESETS } from './presets';
import { EnginePreset, EngineState } from './types';
import { EngineAudioSynthesizer } from './audio';
import { EngineCanvas } from './components/EngineCanvas';
import { Gauges } from './components/Gauges';
import { AndroidBuildModal } from './components/AndroidBuildModal';

export const App: React.FC = () => {
  const [selectedPreset, setSelectedPreset] = useState<EnginePreset>(ENGINE_PRESETS[0]);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [isBuildModalOpen, setIsBuildModalOpen] = useState<boolean>(false);

  // Engine state
  const [state, setState] = useState<EngineState>({
    rpm: 0,
    crankAngle: 0,
    throttle: 0,
    ignition: false,
    starter: false,
    clutchEngaged: false,
    gear: 0,
    dynoLoad: 0,
    mapKpa: 101.3,
    torqueNm: 0,
    hp: 0,
    cylinderPressures: new Array(12).fill(1.0),
    sparkFlags: new Array(12).fill(false),
    intakeLifts: new Array(12).fill(0),
    exhaustLifts: new Array(12).fill(0),
  });

  // State refs for high-frequency physics simulation loop without closure staleness
  const engineRef = useRef({
    rpm: 0,
    crankAngle: 0,
    throttle: 0,
    ignition: false,
    starter: false,
    clutchEngaged: false,
    gear: 0,
    dynoLoad: 0,
    mapKpa: 101.3,
    torqueNm: 0,
    hp: 0,
    cylinderPressures: new Array(12).fill(1.0),
    sparkFlags: new Array(12).fill(false),
    intakeLifts: new Array(12).fill(0),
    exhaustLifts: new Array(12).fill(0),
  });

  const audioSynthRef = useRef<EngineAudioSynthesizer | null>(null);

  // Initialize audio synthesizer on first user interaction
  const initAudio = useCallback(() => {
    if (!audioSynthRef.current) {
      const synth = new EngineAudioSynthesizer();
      synth.init();
      audioSynthRef.current = synth;
    }
  }, []);

  // Update preset
  const handlePresetChange = (preset: EnginePreset) => {
    setSelectedPreset(preset);
    const ref = engineRef.current;
    ref.crankAngle = 0;
    ref.rpm = 0;
    ref.cylinderPressures = new Array(12).fill(1.0);
    ref.sparkFlags = new Array(12).fill(false);
    ref.intakeLifts = new Array(12).fill(0);
    ref.exhaustLifts = new Array(12).fill(0);
  };

  // Keyboard controls for throttle (W / Space / ArrowUp)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      initAudio();
      if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
        engineRef.current.throttle = Math.min(1.0, engineRef.current.throttle + 0.35);
        e.preventDefault();
      } else if (e.code === 'KeyI') {
        // Toggle ignition
        engineRef.current.ignition = !engineRef.current.ignition;
      } else if (e.code === 'KeyS') {
        // Starter
        engineRef.current.starter = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
        engineRef.current.throttle = 0;
      } else if (e.code === 'KeyS') {
        engineRef.current.starter = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [initAudio]);

  // Main simulation tick loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let lastUiUpdate = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const ref = engineRef.current;
      const preset = selectedPreset;

      // Sub-stepping for numerical integration
      const subSteps = 4;
      const subDt = dt / subSteps;

      for (let s = 0; s < subSteps; s++) {
        // Target MAP pressure
        const targetMap = 32.0 + ref.throttle * 70.0 + (preset.badge.includes('Turbo') && ref.rpm > 2800 ? ref.throttle * 40.0 : 0.0);
        ref.mapKpa += (targetMap - ref.mapKpa) * Math.min(1.0, subDt * 18.0);

        let netTorque = 0.0;

        // Starter motor
        if (ref.starter) {
          const starterTorque = Math.max(0.0, 190.0 * (1.0 - ref.rpm / 380.0));
          netTorque += starterTorque;
        }

        // Mechanical drag & pumping
        const friction = 14.0 + 0.016 * ref.rpm + 0.0000035 * ref.rpm * ref.rpm;
        netTorque -= friction;

        // Dyno Load
        netTorque -= ref.dynoLoad * 0.45;

        // Combustion torque per cylinder
        let combustionSum = 0;

        for (let i = 0; i < preset.cylinders; i++) {
          const cylAngle = (ref.crankAngle + preset.cylinderPhases[i]) % 720.0;

          // Valve timing
          let inLift = 0;
          if (cylAngle >= 700 || cylAngle <= 220) {
            const camPhase = cylAngle >= 700 ? cylAngle - 700 : cylAngle + 20;
            inLift = Math.sin((camPhase / 240) * Math.PI);
          }
          ref.intakeLifts[i] = Math.max(0, inLift);

          let exLift = 0;
          if (cylAngle >= 490) {
            const camPhase = cylAngle - 490;
            exLift = Math.sin((camPhase / 260) * Math.PI);
          } else if (cylAngle <= 30) {
            const camPhase = cylAngle + 230;
            exLift = Math.sin((camPhase / 260) * Math.PI);
          }
          ref.exhaustLifts[i] = Math.max(0, exLift);

          // Pressure & Spark
          let press = ref.mapKpa / 100.0;
          ref.sparkFlags[i] = false;

          if (cylAngle >= 180 && cylAngle < 360) {
            // Compression
            const comp = (cylAngle - 180) / 180;
            press = (ref.mapKpa / 100.0) * Math.pow(1.0 + (preset.compressionRatio - 1.0) * comp, 1.32);
          } else if (cylAngle >= 360 && cylAngle < 540) {
            // Power stroke
            const pow = (cylAngle - 360) / 180;
            const sparkTimed = cylAngle >= 352 && cylAngle <= 385;
            if (sparkTimed && ref.ignition && ref.rpm > 90 && ref.rpm < preset.maxRpm) {
              ref.sparkFlags[i] = true;
              const peak = (ref.mapKpa / 100.0) * preset.compressionRatio * 4.6;
              press = peak * Math.pow(1.0 - pow * 0.75, 1.25);

              // Torque = Force * Radius * sin(theta)
              const crankRadiusM = preset.strokeMm / 2000.0;
              const pistonAreaM2 = Math.PI * Math.pow(preset.boreMm / 2000.0, 2);
              const forceN = press * 100000.0 * pistonAreaM2;
              const thetaRad = ((cylAngle - 360) * Math.PI) / 180;
              const instTorque = forceN * crankRadiusM * Math.sin(thetaRad);
              if (instTorque > 0) {
                combustionSum += instTorque * 0.16;
              }
            } else {
              press = 1.0 + Math.sin(pow * Math.PI);
            }
          } else if (cylAngle >= 540 && cylAngle < 720) {
            press = 1.2 + 0.35 * (ref.rpm / preset.maxRpm);
          } else {
            press = ref.mapKpa / 100.0;
          }

          ref.cylinderPressures[i] = Math.max(0.5, press);
        }

        netTorque += combustionSum;
        ref.torqueNm = Math.max(0, combustionSum);
        ref.hp = (ref.torqueNm * ref.rpm) / 7127.0;

        // Rotational inertia
        const inertia = 0.12 * (preset.displacementLiters / 2.0);
        const alpha = netTorque / inertia;
        ref.rpm += (alpha * subDt * 60) / (2 * Math.PI);

        // Rev limiter
        if (ref.rpm > preset.maxRpm) {
          ref.rpm = preset.maxRpm;
          if (Math.random() < 0.25) {
            audioSynthRef.current?.triggerBackfire();
          }
        }
        if (ref.rpm < 0) ref.rpm = 0;

        // Advance crank angle
        const degPerSec = (ref.rpm / 60) * 360;
        ref.crankAngle = (ref.crankAngle + degPerSec * subDt) % 720;
      }

      // Audio update
      if (audioSynthRef.current) {
        audioSynthRef.current.update(
          ref.rpm,
          ref.throttle,
          ref.ignition,
          ref.starter,
          preset
        );
      }

      // Render state to React (30fps to keep DOM smooth)
      if (now - lastUiUpdate > 33) {
        lastUiUpdate = now;
        setState({
          rpm: ref.rpm,
          crankAngle: ref.crankAngle,
          throttle: ref.throttle,
          ignition: ref.ignition,
          starter: ref.starter,
          clutchEngaged: ref.clutchEngaged,
          gear: ref.gear,
          dynoLoad: ref.dynoLoad,
          mapKpa: ref.mapKpa,
          torqueNm: ref.torqueNm,
          hp: ref.hp,
          cylinderPressures: [...ref.cylinderPressures],
          sparkFlags: [...ref.sparkFlags],
          intakeLifts: [...ref.intakeLifts],
          exhaustLifts: [...ref.exhaustLifts],
        });
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [selectedPreset]);

  // Telemetry values
  const afr = 14.7 - (state.throttle * 2.2) + (state.rpm > 6500 ? 0.4 : 0.0);

  const toggleIgnition = () => {
    initAudio();
    engineRef.current.ignition = !engineRef.current.ignition;
  };

  const handleStarterDown = () => {
    initAudio();
    engineRef.current.starter = true;
  };

  const handleStarterUp = () => {
    engineRef.current.starter = false;
  };

  const handleThrottleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    initAudio();
    const val = parseFloat(e.target.value);
    engineRef.current.throttle = val;
  };

  const handleDynoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    engineRef.current.dynoLoad = val;
  };

  const toggleAudio = () => {
    initAudio();
    const next = !isAudioMuted;
    setIsAudioMuted(next);
    audioSynthRef.current?.setMuted(next);
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] text-[#e6edf3] flex flex-col selection:bg-red-500/30">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-[#30363d] bg-[#161b22]/90 backdrop-blur px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-600 to-amber-600 flex items-center justify-center font-bold text-white shadow-lg shadow-red-500/20">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm sm:text-base text-white tracking-wide">
                ENGINE SIMULATOR
              </h1>
              <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">
                ANDROID READY
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Thermodynamic physics • 60FPS mechanical visualizer • Audio synthesis
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Audio Mute/Unmute */}
          <button
            onClick={toggleAudio}
            className={`p-2 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition-colors ${
              isAudioMuted
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-[#21262d] border-[#30363d] text-slate-300 hover:text-white'
            }`}
            title="Toggle Engine Sound"
          >
            {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            <span className="hidden md:inline">{isAudioMuted ? 'Muted' : 'Sound ON'}</span>
          </button>

          {/* Android APK Modal Trigger */}
          <button
            onClick={() => setIsBuildModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
          >
            <Smartphone className="w-4 h-4" />
            <span>Build APK (.apk)</span>
          </button>
        </div>
      </header>

      {/* Notice Banner */}
      <div className="bg-[#0f141c] border-b border-[#30363d] px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Android native app source &amp; GitHub Actions workflow configured. Build APK via GitHub or export from menu!
          </span>
        </div>
        <button
          onClick={() => setIsBuildModalOpen(true)}
          className="text-emerald-400 hover:text-emerald-300 font-semibold underline flex items-center gap-1"
        >
          View APK Workflow &amp; Setup &rarr;
        </button>
      </div>

      {/* Main App Body */}
      <main className="flex-1 p-3 sm:p-5 max-w-7xl w-full mx-auto space-y-4">
        {/* Engine Selector & Quick Specs Bar */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5">
              Select Engine Preset
            </label>
            <div className="flex flex-wrap gap-2">
              {ENGINE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetChange(preset)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    selectedPreset.id === preset.id
                      ? 'bg-red-500/20 border-red-500 text-white shadow-sm shadow-red-500/30'
                      : 'bg-[#21262d] border-[#30363d] text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <span className="font-bold">{preset.name}</span>{' '}
                  <span className="text-[10px] text-slate-400 ml-1">({preset.badge})</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-[#30363d] pt-3 md:pt-0 md:pl-4 text-xs font-mono">
            <div>
              <span className="text-slate-500 block text-[10px]">BORE x STROKE</span>
              <span className="text-white font-semibold">
                {selectedPreset.boreMm} x {selectedPreset.strokeMm} mm
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">REDLINE</span>
              <span className="text-red-400 font-semibold">{selectedPreset.maxRpm} RPM</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">FIRING ORDER</span>
              <span className="text-emerald-400 font-semibold">
                {selectedPreset.firingOrder.join(' - ')}
              </span>
            </div>
          </div>
        </div>

        {/* Primary View: Canvas Engine Simulation */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Visualizer & Live Controls */}
          <div className="lg:col-span-2 space-y-4">
            <div className="h-[380px] sm:h-[440px] w-full">
              <EngineCanvas preset={selectedPreset} state={state} />
            </div>

            {/* Interactive Control Deck */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#30363d]">
                <div className="flex items-center gap-2">
                  {/* Master Ignition Switch */}
                  <button
                    onClick={toggleIgnition}
                    className={`px-4 py-2.5 rounded-lg font-mono font-bold text-xs flex items-center gap-2 border transition-all ${
                      state.ignition
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/20'
                        : 'bg-[#21262d] border-[#30363d] text-slate-400 hover:text-white'
                    }`}
                  >
                    <Radio className={`w-4 h-4 ${state.ignition ? 'animate-pulse text-emerald-400' : ''}`} />
                    <span>IGNITION: {state.ignition ? 'ON' : 'OFF'}</span>
                  </button>

                  {/* Starter Button (Hold to Crank) */}
                  <button
                    onMouseDown={handleStarterDown}
                    onMouseUp={handleStarterUp}
                    onTouchStart={handleStarterDown}
                    onTouchEnd={handleStarterUp}
                    className={`px-5 py-2.5 rounded-lg font-mono font-bold text-xs flex items-center gap-2 border select-none transition-all active:scale-95 ${
                      state.starter
                        ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/40 animate-pulse'
                        : 'bg-red-950/40 border-red-800/60 text-red-400 hover:bg-red-900/40'
                    }`}
                  >
                    <Zap className="w-4 h-4" />
                    <span>{state.starter ? 'CRANKING...' : 'HOLD STARTER'}</span>
                  </button>
                </div>

                <div className="text-xs text-slate-400 font-mono flex items-center gap-3">
                  <span className="hidden sm:inline">Shortcuts:</span>
                  <span className="bg-[#21262d] px-2 py-1 rounded border border-[#30363d] text-slate-300">
                    Space / W : Throttle
                  </span>
                  <span className="bg-[#21262d] px-2 py-1 rounded border border-[#30363d] text-slate-300">
                    S : Starter
                  </span>
                </div>
              </div>

              {/* Throttle & Dyno Resistance Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Throttle Slider */}
                <div>
                  <div className="flex justify-between items-center text-xs font-mono mb-1.5">
                    <span className="text-white font-bold flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-amber-400" />
                      THROTTLE PEDAL
                    </span>
                    <span className="text-amber-400 font-bold">
                      {Math.round(state.throttle * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={state.throttle}
                    onChange={handleThrottleChange}
                    className="w-full accent-amber-500 bg-[#21262d] h-2 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                    <span>IDLE</span>
                    <span>50%</span>
                    <span>WOT (100%)</span>
                  </div>
                </div>

                {/* Dyno Load Resistance */}
                <div>
                  <div className="flex justify-between items-center text-xs font-mono mb-1.5">
                    <span className="text-white font-bold flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5 text-sky-400" />
                      DYNO BRAKE LOAD
                    </span>
                    <span className="text-sky-400 font-bold">
                      {Math.round(state.dynoLoad)} Nm
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="450"
                    step="5"
                    value={state.dynoLoad}
                    onChange={handleDynoChange}
                    className="w-full accent-sky-500 bg-[#21262d] h-2 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                    <span>FREE REV</span>
                    <span>200 Nm</span>
                    <span>HEAVY (450 Nm)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Gauges & Engine Telemetry */}
          <div className="space-y-4">
            {/* Gauges Component */}
            <div className="space-y-4">
              <Gauges
                rpm={state.rpm}
                maxRpm={selectedPreset.maxRpm}
                preset={selectedPreset}
                hp={state.hp}
                torque={state.torqueNm}
                mapKpa={state.mapKpa}
                afr={afr}
                throttle={state.throttle}
              />
            </div>

            {/* Cylinder Chamber Live Telemetry Card */}
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                  Cylinder Pressures &amp; Phase
                </h3>
                <span className="text-[10px] font-mono text-slate-400">
                  CRANK: {Math.round(state.crankAngle)}° / 720°
                </span>
              </div>

              <div className="space-y-2">
                {Array.from({ length: selectedPreset.cylinders }).map((_, idx) => {
                  const p = state.cylinderPressures[idx] || 1.0;
                  const isSpark = state.sparkFlags[idx];
                  const inLift = (state.intakeLifts[idx] || 0) > 0.1;
                  const exLift = (state.exhaustLifts[idx] || 0) > 0.1;

                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                        isSpark
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : 'bg-[#0f141c] border-[#30363d] text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 font-bold text-slate-400">#{idx + 1}</span>
                        {isSpark && (
                          <span className="text-[10px] bg-amber-500 text-black font-bold px-1.5 rounded animate-pulse">
                            SPARK
                          </span>
                        )}
                        {inLift && (
                          <span className="text-[10px] text-cyan-400">
                            INTAKE
                          </span>
                        )}
                        {exLift && (
                          <span className="text-[10px] text-red-400">
                            EXHAUST
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-16 bg-[#21262d] h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isSpark ? 'bg-amber-400' : 'bg-sky-400'}`}
                            style={{ width: `${Math.min(100, (p / 45) * 100)}%` }}
                          />
                        </div>
                        <span className="w-16 text-right font-semibold">
                          {p.toFixed(1)} bar
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Android Export CTA Box */}
            <div className="bg-gradient-to-br from-[#161b22] to-[#12221b] border border-emerald-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white mb-1">Android APK Generation</h4>
                  <p className="text-[11px] text-slate-300 leading-relaxed mb-3">
                    The source code includes full Android Java classes and an automated GitHub Actions APK builder.
                  </p>
                  <button
                    onClick={() => setIsBuildModalOpen(true)}
                    className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>View Android Files &amp; GitHub Setup</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Android Build Center Modal */}
      <AndroidBuildModal
        isOpen={isBuildModalOpen}
        onClose={() => setIsBuildModalOpen(false)}
      />
    </div>
  );
};

export default App;
