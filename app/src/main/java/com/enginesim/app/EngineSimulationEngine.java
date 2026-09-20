package com.enginesim.app;

public class EngineSimulationEngine {
    private EnginePreset preset;

    // Simulation state
    private double crankAngle = 0.0; // 0 to 720 degrees
    private double rpm = 0.0;
    private double throttle = 0.0; // 0.0 to 1.0
    private boolean ignitionOn = false;
    private boolean starterActive = false;
    private boolean clutchEngaged = false;
    private int currentGear = 0; // -1: R, 0: N, 1-6: 1st-6th
    private double dynoLoadNm = 0.0;

    // Physics metrics
    private double manifoldPressureKpa = 101.3;
    private double currentTorqueNm = 0.0;
    private double currentHp = 0.0;
    private final double[] cylinderPressures;
    private final boolean[] sparkFlags;
    private final double[] intakeValveLifts;
    private final double[] exhaustValveLifts;

    // Listener for acoustic sound generation
    public interface ExhaustPulseListener {
        void onExhaustPulse(int cylinderIndex, double intensity, double rpm);
    }
    private ExhaustPulseListener pulseListener;

    public EngineSimulationEngine(EnginePreset preset) {
        setPreset(preset);
        this.cylinderPressures = new double[12];
        this.sparkFlags = new boolean[12];
        this.intakeValveLifts = new double[12];
        this.exhaustValveLifts = new double[12];
    }

    public synchronized void setPreset(EnginePreset preset) {
        this.preset = preset;
        this.crankAngle = 0.0;
        this.rpm = 0.0;
        this.ignitionOn = false;
        this.starterActive = false;
    }

    public synchronized void setThrottle(double t) {
        this.throttle = Math.max(0.0, Math.min(1.0, t));
    }

    public synchronized void setIgnition(boolean on) {
        this.ignitionOn = on;
    }

    public synchronized void setStarter(boolean active) {
        this.starterActive = active;
    }

    public synchronized void setClutch(boolean engaged) {
        this.clutchEngaged = engaged;
    }

    public synchronized void setDynoLoad(double loadNm) {
        this.dynoLoadNm = Math.max(0.0, loadNm);
    }

    public synchronized void shiftUp() {
        if (currentGear < 6) currentGear++;
    }

    public synchronized void shiftDown() {
        if (currentGear > -1) currentGear--;
    }

    public void setPulseListener(ExhaustPulseListener listener) {
        this.pulseListener = listener;
    }

    // Step the physics by dt seconds
    public synchronized void update(double dt) {
        // Manifold Air Pressure (MAP): idle vacuum (~30-40 kPa) to atmospheric/boost (~100-140 kPa)
        double targetMap = 30.0 + (throttle * 75.0);
        if (rpm > 2500 && throttle > 0.7 && preset.description.contains("Turbo")) {
            targetMap += 45.0 * throttle * (rpm / preset.maxRpm); // Turbo boost up to 150 kPa
        }
        manifoldPressureKpa += (targetMap - manifoldPressureKpa) * Math.min(1.0, dt * 15.0);

        // Calculate crank rotational inertia (kg*m^2) proportional to engine size
        double inertia = 0.12 * (preset.displacementLiters / 2.0);

        double netTorque = 0.0;

        // Starter motor torque
        if (starterActive) {
            double starterTorque = Math.max(0.0, 180.0 * (1.0 - (rpm / 400.0)));
            netTorque += starterTorque;
        }

        // Mechanical friction & pumping losses
        double frictionTorque = 12.0 + (0.015 * rpm) + (0.000003 * rpm * rpm);
        netTorque -= frictionTorque;

        // Transmission load if in gear & clutch engaged
        if (clutchEngaged && currentGear != 0) {
            double gearRatio = getGearRatio(currentGear);
            double vehicleDrag = 0.00004 * rpm * rpm * gearRatio;
            netTorque -= (dynoLoadNm + vehicleDrag);
        } else {
            // Unloaded dyno test
            netTorque -= (dynoLoadNm * 0.4);
        }

        // Cylinder cycle combustion torque
        double combustionTorqueSum = 0.0;

        for (int i = 0; i < preset.cylinders; i++) {
            // Local cylinder cycle angle (0° to 720°)
            double cylAngle = (crankAngle + preset.cylinderPhases[i]) % 720.0;
            if (cylAngle < 0) cylAngle += 720.0;

            // Valve lift curves (cam lobes)
            // Intake opens at 700° (20° BTDC) to 220° (40° ABDC)
            double inLift = 0.0;
            if (cylAngle >= 700.0 || cylAngle <= 220.0) {
                double camPhase = (cylAngle >= 700.0) ? (cylAngle - 700.0) : (cylAngle + 20.0);
                inLift = Math.sin(Math.toRadians(camPhase / 240.0 * 180.0));
            }
            intakeValveLifts[i] = Math.max(0.0, inLift);

            // Exhaust opens at 490° (50° BBDC) to 30° (30° ATDC)
            double exLift = 0.0;
            if (cylAngle >= 490.0) {
                double camPhase = (cylAngle - 490.0);
                exLift = Math.sin(Math.toRadians(camPhase / 260.0 * 180.0));
                // Fire pulse listener when exhaust opens
                if (cylAngle >= 490.0 && cylAngle <= 510.0 && pulseListener != null && rpm > 60) {
                    pulseListener.onExhaustPulse(i, cylinderPressures[i] / 50.0, rpm);
                }
            } else if (cylAngle <= 30.0) {
                double camPhase = (cylAngle + 230.0);
                exLift = Math.sin(Math.toRadians(camPhase / 260.0 * 180.0));
            }
            exhaustValveLifts[i] = Math.max(0.0, exLift);

            // Cylinder pressure & spark
            double pressure = manifoldPressureKpa / 100.0; // in bar
            sparkFlags[i] = false;

            if (cylAngle >= 180.0 && cylAngle < 360.0) {
                // Compression stroke
                double compressionProgress = (cylAngle - 180.0) / 180.0;
                pressure = (manifoldPressureKpa / 100.0) * Math.pow(1.0 + (preset.compressionRatio - 1.0) * compressionProgress, 1.33);
            } else if (cylAngle >= 360.0 && cylAngle < 540.0) {
                // Power stroke
                double powerProgress = (cylAngle - 360.0) / 180.0;
                boolean sparkTimed = (cylAngle >= 350.0 && cylAngle <= 385.0);
                if (sparkTimed && ignitionOn && rpm > 100 && rpm < preset.maxRpm) {
                    sparkFlags[i] = true;
                    double peakPressure = (manifoldPressureKpa / 100.0) * preset.compressionRatio * 4.8;
                    double expansionFactor = Math.pow(1.0 - (powerProgress * 0.75), 1.25);
                    pressure = peakPressure * expansionFactor;

                    // Crank arm torque conversion: T = F * r * sin(theta)
                    double crankRadiusM = (preset.strokeMm / 2000.0);
                    double pistonAreaM2 = Math.PI * Math.pow(preset.boreMm / 2000.0, 2);
                    double pistonForceN = pressure * 100000.0 * pistonAreaM2;
                    double thetaRad = Math.toRadians(cylAngle - 360.0);
                    double instantaneousCylTorque = pistonForceN * crankRadiusM * Math.sin(thetaRad);
                    if (instantaneousCylTorque > 0) {
                        combustionTorqueSum += instantaneousCylTorque * 0.18; // scaled for simulation stability
                    }
                } else {
                    // Misfire / engine off compression expansion
                    pressure = 1.0 + Math.sin(Math.toRadians(powerProgress * 180.0));
                }
            } else if (cylAngle >= 540.0 && cylAngle < 720.0) {
                // Exhaust stroke
                pressure = 1.2 + (0.4 * (rpm / preset.maxRpm));
            } else {
                // Intake stroke
                pressure = manifoldPressureKpa / 100.0;
            }

            cylinderPressures[i] = Math.max(0.5, pressure);
        }

        netTorque += combustionTorqueSum;
        currentTorqueNm = Math.max(0.0, combustionTorqueSum);
        currentHp = (currentTorqueNm * rpm) / 7127.0;

        // Angular acceleration alpha = Torque / Inertia
        double alpha = netTorque / inertia;
        rpm += (alpha * dt * 60.0 / (2.0 * Math.PI));

        // Rev limiter cutoff
        if (rpm > preset.maxRpm) {
            rpm = preset.maxRpm;
        }
        if (rpm < 0.0) {
            rpm = 0.0;
        }

        // Advance crank angle
        double degreesPerSecond = (rpm / 60.0) * 360.0;
        crankAngle = (crankAngle + (degreesPerSecond * dt)) % 720.0;
    }

    private double getGearRatio(int gear) {
        switch (gear) {
            case -1: return 3.4; // Reverse
            case 1: return 3.8;
            case 2: return 2.2;
            case 3: return 1.5;
            case 4: return 1.1;
            case 5: return 0.85;
            case 6: return 0.70;
            default: return 0.0;
        }
    }

    // Getters for UI
    public EnginePreset getPreset() { return preset; }
    public double getRpm() { return rpm; }
    public double getCrankAngle() { return crankAngle; }
    public double getThrottle() { return throttle; }
    public boolean isIgnitionOn() { return ignitionOn; }
    public boolean isStarterActive() { return starterActive; }
    public boolean isClutchEngaged() { return clutchEngaged; }
    public int getCurrentGear() { return currentGear; }
    public double getManifoldPressureKpa() { return manifoldPressureKpa; }
    public double getCurrentTorqueNm() { return currentTorqueNm; }
    public double getCurrentHp() { return currentHp; }
    public double[] getCylinderPressures() { return cylinderPressures; }
    public boolean[] getSparkFlags() { return sparkFlags; }
    public double[] getIntakeValveLifts() { return intakeValveLifts; }
    public double[] getExhaustValveLifts() { return exhaustValveLifts; }
}
