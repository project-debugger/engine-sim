import React, { useEffect, useRef } from 'react';
import { EnginePreset, EngineState } from '../types';

interface EngineCanvasProps {
  preset: EnginePreset;
  state: EngineState;
}

export const EngineCanvas: React.FC<EngineCanvasProps> = ({ preset, state }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let animId: number;

    const render = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = rect.width;
      const height = rect.height;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Background grid / blueprint style
      ctx.fillStyle = '#0f141c';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = '#1a2333';
      ctx.lineWidth = 1;
      const gridSize = 24;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const numCyl = preset.cylinders;
      const sectionWidth = width / numCyl;
      const crankCenterY = height * 0.74;
      const strokeRadius = Math.min(height * 0.12, 50);
      const rodLength = Math.min(height * 0.28, 120);

      // Main crank center line
      ctx.strokeStyle = '#2d3748';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(10, crankCenterY);
      ctx.lineTo(width - 10, crankCenterY);
      ctx.stroke();

      for (let i = 0; i < numCyl; i++) {
        const cylCenterX = (i + 0.5) * sectionWidth;

        // Kinematics
        const cylPhase = (state.crankAngle + preset.cylinderPhases[i]) % 360;
        const rad = (cylPhase * Math.PI) / 180;

        // Crankpin position
        const crankPinX = cylCenterX + Math.sin(rad) * strokeRadius;
        const crankPinY = crankCenterY - Math.cos(rad) * strokeRadius;

        // Piston wrist pin position
        const sinTheta = Math.sin(rad);
        const dx = strokeRadius * sinTheta;
        const dy = Math.sqrt(Math.max(0, rodLength * rodLength - dx * dx));
        const pistonY = crankCenterY - (strokeRadius * Math.cos(rad) + dy);

        const cylWidth = Math.min(sectionWidth * 0.75, 110);
        const cylTop = crankCenterY - strokeRadius - rodLength - 40;
        const cylBottom = crankCenterY - rodLength + 25;

        // Cylinder walls
        ctx.strokeStyle = '#4a5568';
        ctx.lineWidth = 4;
        ctx.beginPath();
        // Left wall
        ctx.moveTo(cylCenterX - cylWidth / 2, cylBottom);
        ctx.lineTo(cylCenterX - cylWidth / 2, cylTop);
        // Head deck
        ctx.lineTo(cylCenterX + cylWidth / 2, cylTop);
        // Right wall
        ctx.lineTo(cylCenterX + cylWidth / 2, cylBottom);
        ctx.stroke();

        // Combustion chamber flash / flame
        if (state.sparkFlags[i]) {
          const flameGradient = ctx.createRadialGradient(
            cylCenterX,
            cylTop + 10,
            4,
            cylCenterX,
            pistonY,
            cylWidth * 0.7
          );
          flameGradient.addColorStop(0, '#ffffff');
          flameGradient.addColorStop(0.25, '#ffea00');
          flameGradient.addColorStop(0.6, '#ff5722');
          flameGradient.addColorStop(1, 'rgba(255, 61, 0, 0.05)');

          ctx.fillStyle = flameGradient;
          ctx.beginPath();
          ctx.rect(
            cylCenterX - cylWidth / 2 + 2,
            cylTop + 2,
            cylWidth - 4,
            Math.max(4, pistonY - cylTop - 2)
          );
          ctx.fill();

          // Spark glow point
          ctx.fillStyle = '#64ffda';
          ctx.shadowColor = '#00e5ff';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(cylCenterX, cylTop + 6, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // Intake and Exhaust valves
        const inValveX = cylCenterX - cylWidth * 0.26;
        const exValveX = cylCenterX + cylWidth * 0.26;
        const inLift = (state.intakeLifts[i] || 0) * 14;
        const exLift = (state.exhaustLifts[i] || 0) * 14;

        // Intake Valve (Cyan)
        ctx.fillStyle = '#00e5ff';
        ctx.fillRect(inValveX - 7, cylTop + inLift, 14, 4);
        ctx.strokeStyle = '#00b0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(inValveX, cylTop - 18);
        ctx.lineTo(inValveX, cylTop + inLift);
        ctx.stroke();

        // Exhaust Valve (Red/Orange)
        ctx.fillStyle = '#ff5252';
        ctx.fillRect(exValveX - 7, cylTop + exLift, 14, 4);
        ctx.strokeStyle = '#ff1744';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(exValveX, cylTop - 18);
        ctx.lineTo(exValveX, cylTop + exLift);
        ctx.stroke();

        // Spark plug casing at center
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(cylCenterX - 3, cylTop - 15, 6, 15);

        // Crank Counterweight
        ctx.fillStyle = '#718096';
        ctx.beginPath();
        ctx.arc(
          cylCenterX - Math.sin(rad) * (strokeRadius * 0.7),
          crankCenterY + Math.cos(rad) * (strokeRadius * 0.7),
          strokeRadius * 0.5,
          rad - 1.2,
          rad + 1.2
        );
        ctx.fill();

        // Connecting Rod
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(crankPinX, crankPinY);
        ctx.lineTo(cylCenterX, pistonY);
        ctx.stroke();

        // Crank journal and pin
        ctx.fillStyle = '#ff6b35';
        ctx.beginPath();
        ctx.arc(cylCenterX, crankCenterY, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(crankPinX, crankPinY, 6, 0, Math.PI * 2);
        ctx.fill();

        // Piston Crown and Skirt
        const pistonH = 26;
        const pTop = pistonY - pistonH / 2;
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.roundRect(cylCenterX - cylWidth / 2 + 3, pTop, cylWidth - 6, pistonH, 3);
        ctx.fill();

        // Piston rings
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cylCenterX - cylWidth / 2 + 4, pTop + 5);
        ctx.lineTo(cylCenterX + cylWidth / 2 - 4, pTop + 5);
        ctx.moveTo(cylCenterX - cylWidth / 2 + 4, pTop + 9);
        ctx.lineTo(cylCenterX + cylWidth / 2 - 4, pTop + 9);
        ctx.stroke();

        // Piston wrist pin
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(cylCenterX, pistonY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Cylinder Stats overlay
        ctx.fillStyle = '#94a3b8';
        ctx.font = '600 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`CYL ${i + 1}`, cylCenterX, cylBottom + 26);

        const pVal = (state.cylinderPressures[i] || 1.0).toFixed(1);
        ctx.fillStyle = state.sparkFlags[i] ? '#ff9100' : '#38bdf8';
        ctx.fillText(`${pVal} bar`, cylCenterX, cylBottom + 42);
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [preset, state]);

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[340px] rounded-lg overflow-hidden border border-[#30363d] bg-[#0f141c]">
      <canvas ref={canvasRef} className="w-full h-full block" />
      {/* Legend badge */}
      <div className="absolute top-2 left-3 flex items-center gap-3 text-[11px] font-mono text-slate-400 bg-[#161b22]/90 backdrop-blur px-2.5 py-1 rounded border border-[#30363d]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#00e5ff]"></span>
          <span>Intake</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#ff5252]"></span>
          <span>Exhaust</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#ffd166]"></span>
          <span>Spark</span>
        </div>
      </div>
    </div>
  );
};
