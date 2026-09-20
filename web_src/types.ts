export interface EnginePreset {
  id: string;
  name: string;
  badge: string;
  description: string;
  cylinders: number;
  layout: 'I4' | 'I5' | 'I6' | 'V8' | 'Boxer4' | 'V2';
  displacementLiters: number;
  boreMm: number;
  strokeMm: number;
  rodLengthMm: number;
  compressionRatio: number;
  maxRpm: number;
  idleRpm: number;
  firingOrder: number[];
  cylinderPhases: number[];
  soundTimbre: {
    roughness: number;
    bassBoost: number;
    highPitchGain: number;
    pulseDistortion: number;
  };
}

export interface EngineState {
  rpm: number;
  crankAngle: number;
  throttle: number; // 0 to 1
  ignition: boolean;
  starter: boolean;
  clutchEngaged: boolean;
  gear: number; // -1 = R, 0 = N, 1..6
  dynoLoad: number; // Nm
  mapKpa: number; // 30 to 180 kPa
  torqueNm: number;
  hp: number;
  cylinderPressures: number[];
  sparkFlags: boolean[];
  intakeLifts: number[];
  exhaustLifts: number[];
}
