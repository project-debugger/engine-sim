import React from 'react';
import { EnginePreset } from '../types';

interface GaugesProps {
  rpm: number;
  maxRpm: number;
  preset: EnginePreset;
  hp: number;
  torque: number;
  mapKpa: number;
  afr: number;
  throttle: number;
}

export const Gauges: React.FC<GaugesProps> = ({
  rpm,
  maxRpm,
  preset,
  hp,
  torque,
  mapKpa,
  afr,
  throttle,
}) => {
  // Tachometer needle angle: -135deg to +135deg (total 270deg)
  const rpmRatio = Math.min(1.0, rpm / maxRpm);
  const needleAngle = -135 + rpmRatio * 270;
  const isRedline = rpm >= maxRpm * 0.92;

  // MAP Boost in PSI or bar: 101.3 kPa = 0 boost, > 101.3 = boost
  const boostPsi = Math.max(0, ((mapKpa - 101.3) * 0.145038)).toFixed(1);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Analog Tachometer Gauge */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3 flex flex-col items-center justify-between relative overflow-hidden">
        <div className="w-full flex justify-between items-center text-xs font-mono text-slate-400">
          <span>TACHOMETER</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isRedline ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
            REV LIMIT
          </span>
        </div>

        {/* Dial Face */}
        <div className="relative w-36 h-36 my-1 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background Arc */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#21262d"
              strokeWidth="8"
              strokeDasharray="188.5"
              strokeDashoffset="62.8"
            />
            {/* Redline zone */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#ff3838"
              strokeWidth="8"
              strokeDasharray="25 220"
              strokeDashoffset="-150"
            />
            {/* Active RPM sweep */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={isRedline ? '#ff2a2a' : '#00e676'}
              strokeWidth="8"
              strokeDasharray="188.5"
              strokeDashoffset={188.5 - (rpmRatio * 188.5 * 0.75)}
              strokeLinecap="round"
              className="transition-all duration-75"
            />
          </svg>

          {/* Center needle hub */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="w-1 h-14 bg-red-500 rounded-full origin-bottom transform transition-transform duration-75 shadow-lg shadow-red-500/50"
              style={{
                transform: `rotate(${needleAngle}deg) translateY(-50%)`,
              }}
            />
            <div className="w-4 h-4 bg-slate-200 rounded-full border-2 border-[#161b22] z-10" />
          </div>

          {/* RPM readout center */}
          <div className="absolute bottom-2 text-center pointer-events-none">
            <div className="text-xl font-bold font-mono text-white tracking-tight">
              {Math.round(rpm)}
            </div>
            <div className="text-[10px] font-mono text-slate-400">RPM</div>
          </div>
        </div>

        <div className="w-full flex justify-between text-[11px] font-mono text-slate-400">
          <span>0</span>
          <span>{Math.round(maxRpm / 2)}</span>
          <span className="text-red-400">{maxRpm}</span>
        </div>
      </div>

      {/* Dyno Horsepower & Torque */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3 flex flex-col justify-between">
        <div className="text-xs font-mono text-slate-400 flex justify-between items-center">
          <span>DYNO METRICS</span>
          <span className="text-[10px] bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded">REAL-TIME</span>
        </div>

        <div className="space-y-3 my-2">
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-xs text-slate-400 font-mono">POWER</span>
              <span className="text-xl font-bold font-mono text-sky-400">
                {Math.round(hp)} <span className="text-xs text-slate-400 font-normal">HP</span>
              </span>
            </div>
            <div className="w-full bg-[#21262d] h-2 rounded-full overflow-hidden">
              <div
                className="bg-sky-500 h-full rounded-full transition-all duration-75"
                style={{ width: `${Math.min(100, (hp / 600) * 100)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-xs text-slate-400 font-mono">TORQUE</span>
              <span className="text-xl font-bold font-mono text-emerald-400">
                {Math.round(torque)} <span className="text-xs text-slate-400 font-normal">Nm</span>
              </span>
            </div>
            <div className="w-full bg-[#21262d] h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-75"
                style={{ width: `${Math.min(100, (torque / 750) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="text-[11px] font-mono text-slate-400 flex justify-between pt-1 border-t border-[#30363d]">
          <span>DISPLACEMENT</span>
          <span className="text-white font-semibold">{preset.displacementLiters}L</span>
        </div>
      </div>

      {/* Manifold Absolute Pressure / Turbo Boost */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3 flex flex-col justify-between">
        <div className="text-xs font-mono text-slate-400 flex justify-between items-center">
          <span>MANIFOLD PRESSURE</span>
          <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">MAP</span>
        </div>

        <div className="my-auto py-2 text-center">
          <div className="text-2xl font-bold font-mono text-amber-400 tracking-tight">
            {mapKpa.toFixed(1)} <span className="text-xs text-slate-400">kPa</span>
          </div>
          <div className="text-xs font-mono text-slate-300 mt-1">
            {mapKpa > 101.3 ? `+${boostPsi} PSI BOOST` : `${(mapKpa / 100).toFixed(2)} BAR (VACUUM)`}
          </div>
        </div>

        <div className="space-y-1 pt-1 border-t border-[#30363d]">
          <div className="flex justify-between text-[11px] font-mono text-slate-400">
            <span>THROTTLE POSITION</span>
            <span className="text-white font-semibold">{Math.round(throttle * 100)}%</span>
          </div>
          <div className="w-full bg-[#21262d] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-75"
              style={{ width: `${throttle * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Air-Fuel Ratio (AFR) */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3 flex flex-col justify-between">
        <div className="text-xs font-mono text-slate-400 flex justify-between items-center">
          <span>AIR / FUEL RATIO</span>
          <span className="text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded">LAMBDA</span>
        </div>

        <div className="my-auto py-2 text-center">
          <div className="text-2xl font-bold font-mono text-purple-400 tracking-tight">
            {afr.toFixed(2)} <span className="text-xs text-slate-400">: 1</span>
          </div>
          <div className="text-xs font-mono text-slate-300 mt-1">
            {afr < 14.2 ? 'RICH MIXTURE' : afr > 15.0 ? 'LEAN MIXTURE' : 'STOICHIOMETRIC'}
          </div>
        </div>

        <div className="space-y-1 pt-1 border-t border-[#30363d]">
          <div className="flex justify-between text-[11px] font-mono text-slate-400">
            <span>COMPRESSION</span>
            <span className="text-white font-semibold">{preset.compressionRatio}:1</span>
          </div>
          <div className="flex justify-between text-[11px] font-mono text-slate-400">
            <span>VALVES</span>
            <span className="text-white font-semibold">{preset.cylinders * 4}V DOHC</span>
          </div>
        </div>
      </div>
    </div>
  );
};
