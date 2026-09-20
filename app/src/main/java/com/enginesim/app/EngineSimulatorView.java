package com.enginesim.app;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.util.AttributeSet;
import android.view.View;

public class EngineSimulatorView extends View {
    private EngineSimulationEngine engine;

    private Paint cylinderWallPaint;
    private Paint pistonPaint;
    private Paint connectingRodPaint;
    private Paint crankPaint;
    private Paint valvePaint;
    private Paint sparkPaint;
    private Paint textPaint;
    private Paint flamePaint;

    public EngineSimulatorView(Context context) {
        super(context);
        init();
    }

    public EngineSimulatorView(Context context, AttributeSet attrs) {
        super(context, attrs);
        init();
    }

    private void init() {
        cylinderWallPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        cylinderWallPaint.setColor(Color.parseColor("#37474F"));
        cylinderWallPaint.setStyle(Paint.Style.STROKE);
        cylinderWallPaint.setStrokeWidth(6f);

        pistonPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        pistonPaint.setColor(Color.parseColor("#90A4AE"));
        pistonPaint.setStyle(Paint.Style.FILL);

        connectingRodPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        connectingRodPaint.setColor(Color.parseColor("#CFD8DC"));
        connectingRodPaint.setStyle(Paint.Style.STROKE);
        connectingRodPaint.setStrokeCap(Paint.Cap.ROUND);
        connectingRodPaint.setStrokeWidth(12f);

        crankPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        crankPaint.setColor(Color.parseColor("#FF5722"));
        crankPaint.setStyle(Paint.Style.FILL);

        valvePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        valvePaint.setColor(Color.parseColor("#4DD0E1"));
        valvePaint.setStyle(Paint.Style.FILL);

        sparkPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        sparkPaint.setColor(Color.parseColor("#FFFF00"));
        sparkPaint.setStyle(Paint.Style.FILL);

        flamePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        flamePaint.setColor(Color.parseColor("#FF6D00"));
        flamePaint.setStyle(Paint.Style.FILL);
        flamePaint.setAlpha(190);

        textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        textPaint.setColor(Color.parseColor("#ECEFF1"));
        textPaint.setTextSize(26f);
        textPaint.setTextAlign(Paint.Align.CENTER);
    }

    public void setEngine(EngineSimulationEngine engine) {
        this.engine = engine;
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);

        int width = getWidth();
        int height = getHeight();
        if (width <= 0 || height <= 0 || engine == null) return;

        EnginePreset preset = engine.getPreset();
        int numCyl = preset.cylinders;
        double crankAngle = engine.getCrankAngle();
        double[] pressures = engine.getCylinderPressures();
        boolean[] sparks = engine.getSparkFlags();
        double[] inLifts = engine.getIntakeValveLifts();
        double[] exLifts = engine.getExhaustValveLifts();

        // Layout cylinders horizontally across the view
        float sectionWidth = (float) width / numCyl;
        float crankCenterY = height * 0.76f;
        float strokeScale = height * 0.16f; // crank throw radius
        float rodLength = height * 0.28f;

        for (int i = 0; i < numCyl; i++) {
            float cylCenterX = (i + 0.5f) * sectionWidth;

            // Crank pin position
            double cylPhase = (crankAngle + preset.cylinderPhases[i]) % 360.0;
            double crankRad = Math.toRadians(cylPhase);

            float crankPinX = cylCenterX + (float) (Math.sin(crankRad) * (strokeScale * 0.5f));
            float crankPinY = crankCenterY - (float) (Math.cos(crankRad) * (strokeScale * 0.5f));

            // Piston wrist pin position via slider-crank kinematics
            // y = r*cos(theta) + sqrt(l^2 - (r*sin(theta))^2)
            double sinTheta = Math.sin(crankRad);
            double dx = (strokeScale * 0.5f) * sinTheta;
            double dy = Math.sqrt(Math.max(0.0, (rodLength * rodLength) - (dx * dx)));
            float pistonY = crankCenterY - (float) ((strokeScale * 0.5f) * Math.cos(crankRad) + dy);

            float cylWidth = Math.min(sectionWidth * 0.72f, 130f);
            float cylTop = crankCenterY - strokeScale - rodLength - 40f;
            float cylBottom = crankCenterY - rodLength + 30f;

            // Draw Cylinder Wall
            canvas.drawLine(cylCenterX - cylWidth / 2f, cylTop, cylCenterX - cylWidth / 2f, cylBottom, cylinderWallPaint);
            canvas.drawLine(cylCenterX + cylWidth / 2f, cylTop, cylCenterX + cylWidth / 2f, cylBottom, cylinderWallPaint);
            canvas.drawLine(cylCenterX - cylWidth / 2f, cylTop, cylCenterX + cylWidth / 2f, cylTop, cylinderWallPaint); // Cylinder head

            // Draw Combustion Flame if spark is firing
            if (sparks[i]) {
                canvas.drawRect(cylCenterX - (cylWidth / 2f) + 4f, cylTop + 6f, cylCenterX + (cylWidth / 2f) - 4f, pistonY, flamePaint);
                canvas.drawCircle(cylCenterX, cylTop + 8f, 14f, sparkPaint);
            }

            // Draw Intake and Exhaust Valves in the head
            float inValveX = cylCenterX - (cylWidth * 0.25f);
            float exValveX = cylCenterX + (cylWidth * 0.25f);
            float inLiftPx = (float) (inLifts[i] * 18.0);
            float exLiftPx = (float) (exLifts[i] * 18.0);

            // Intake valve stem & head
            canvas.drawRect(inValveX - 10f, cylTop + inLiftPx, inValveX + 10f, cylTop + inLiftPx + 6f, valvePaint);
            canvas.drawLine(inValveX, cylTop - 20f, inValveX, cylTop + inLiftPx, cylinderWallPaint);

            // Exhaust valve stem & head
            canvas.drawRect(exValveX - 10f, cylTop + exLiftPx, exValveX + 10f, cylTop + exLiftPx + 6f, valvePaint);
            canvas.drawLine(exValveX, cylTop - 20f, exValveX, cylTop + exLiftPx, cylinderWallPaint);

            // Draw Connecting Rod
            canvas.drawLine(crankPinX, crankPinY, cylCenterX, pistonY, connectingRodPaint);

            // Draw Crankshaft journal & counterweight
            canvas.drawCircle(cylCenterX, crankCenterY, 18f, crankPaint);
            canvas.drawCircle(crankPinX, crankPinY, 10f, crankPaint);

            // Draw Piston
            float pistonHeight = 36f;
            RectF pistonRect = new RectF(
                cylCenterX - (cylWidth / 2f) + 3f,
                pistonY - (pistonHeight / 2f),
                cylCenterX + (cylWidth / 2f) - 3f,
                pistonY + (pistonHeight / 2f)
            );
            canvas.drawRoundRect(pistonRect, 4f, 4f, pistonPaint);

            // Cylinder number & pressure label
            canvas.drawText("CYL " + (i + 1), cylCenterX, cylBottom + 40f, textPaint);
            String pressStr = String.format("%.1f bar", pressures[i]);
            canvas.drawText(pressStr, cylCenterX, cylBottom + 70f, textPaint);
        }

        // Request next frame for smooth 60fps rendering
        postInvalidateOnAnimation();
    }
}
