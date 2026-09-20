package com.enginesim.app;

public class EnginePreset {
    public final String name;
    public final String description;
    public final int cylinders;
    public final String layout; // "I4", "I6", "V8", "V10", "Boxer4", "I5", "V2"
    public final double displacementLiters;
    public final double boreMm;
    public final double strokeMm;
    public final double rodLengthMm;
    public final double compressionRatio;
    public final int maxRpm;
    public final int idleRpm;
    public final int[] firingOrder;
    public final double[] cylinderPhases; // crank angle degrees for TDC of each cylinder
    public final double bankAngle; // for V engines

    public EnginePreset(String name, String description, int cylinders, String layout,
                        double displacementLiters, double boreMm, double strokeMm,
                        double rodLengthMm, double compressionRatio, int maxRpm, int idleRpm,
                        int[] firingOrder, double[] cylinderPhases, double bankAngle) {
        this.name = name;
        this.description = description;
        this.cylinders = cylinders;
        this.layout = layout;
        this.displacementLiters = displacementLiters;
        this.boreMm = boreMm;
        this.strokeMm = strokeMm;
        this.rodLengthMm = rodLengthMm;
        this.compressionRatio = compressionRatio;
        this.maxRpm = maxRpm;
        this.idleRpm = idleRpm;
        this.firingOrder = firingOrder;
        this.cylinderPhases = cylinderPhases;
        this.bankAngle = bankAngle;
    }

    public static EnginePreset[] getPresets() {
        return new EnginePreset[] {
            new EnginePreset(
                "Toyota 2JZ-GTE (3.0L Inline-6)",
                "Twin Turbo DOHC 24V I6 - 8,200 RPM",
                6, "I6", 3.0, 86.0, 86.0, 142.0, 8.5, 8200, 750,
                new int[]{1, 5, 3, 6, 2, 4},
                new double[]{0, 120, 240, 360, 480, 600},
                0.0
            ),
            new EnginePreset(
                "Chevrolet LS 454 (7.4L V8)",
                "Big Block OHV 16V V8 - 6,500 RPM Crossplane",
                8, "V8", 7.4, 107.9, 101.6, 155.7, 10.2, 6500, 680,
                new int[]{1, 8, 7, 2, 6, 5, 4, 3},
                new double[]{0, 90, 180, 270, 360, 450, 540, 630},
                90.0
            ),
            new EnginePreset(
                "Subaru EJ25 (2.5L Boxer-4)",
                "Turbocharged Flat-4 Boxer - 7,200 RPM",
                4, "Boxer4", 2.5, 99.5, 79.0, 130.5, 8.2, 7200, 700,
                new int[]{1, 3, 2, 4},
                new double[]{0, 180, 360, 540},
                180.0
            ),
            new EnginePreset(
                "Honda VTEC K20 (2.0L Inline-4)",
                "High-revving DOHC i-VTEC - 9,000 RPM",
                4, "I4", 2.0, 86.0, 86.0, 139.0, 11.5, 9000, 850,
                new int[]{1, 3, 4, 2},
                new double[]{0, 180, 360, 540},
                0.0
            ),
            new EnginePreset(
                "Audi Quattro (2.2L Inline-5 Turbo)",
                "Iconic Group B rally 5-cylinder warble - 8,000 RPM",
                5, "I5", 2.2, 81.0, 86.4, 144.0, 9.3, 8000, 800,
                new int[]{1, 2, 4, 5, 3},
                new double[]{0, 144, 288, 432, 576},
                0.0
            ),
            new EnginePreset(
                "Ferrari F136 (4.5L Flat-Plane V8)",
                "Naturally aspirated flat-plane V8 scream - 9,200 RPM",
                8, "V8", 4.5, 94.0, 81.0, 140.0, 12.5, 9200, 1000,
                new int[]{1, 8, 3, 6, 4, 5, 2, 7},
                new double[]{0, 90, 180, 270, 360, 450, 540, 630},
                90.0
            ),
            new EnginePreset(
                "Kohler CH750 (0.75L V-Twin)",
                "Small Utility 90-degree V-Twin - 3,800 RPM",
                2, "V2", 0.75, 83.0, 69.0, 110.0, 9.1, 4000, 1200,
                new int[]{1, 2},
                new double[]{0, 270},
                90.0
            )
        };
    }

    @Override
    public String toString() {
        return name;
    }
}
