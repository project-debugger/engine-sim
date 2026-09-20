package com.enginesim.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.MotionEvent;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.SeekBar;
import android.widget.Spinner;
import android.widget.TextView;

public class MainActivity extends Activity {
    private EnginePreset[] presets;
    private EngineSimulationEngine engine;
    private AudioSynthesizer audioSynthesizer;
    private EngineSimulatorView simView;

    private TextView tvRpmDisplay;
    private TextView tvPowerDisplay;
    private TextView tvMapPressure;
    private TextView tvAfr;
    private TextView tvGear;
    private TextView tvThrottleLabel;
    private TextView tvDynoLabel;

    private Button btnIgnition;
    private Button btnStarter;
    private Button btnClutch;
    private Button btnGearUp;
    private Button btnGearDown;

    private SeekBar seekThrottle;
    private SeekBar seekDyno;
    private Spinner spinnerPreset;

    private volatile boolean isSimRunning = false;
    private Thread simThread;
    private final Handler uiHandler = new Handler(Looper.getMainLooper());

    @SuppressLint("ClickableViewAccessibility")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        presets = EnginePreset.getPresets();
        engine = new EngineSimulationEngine(presets[0]);
        audioSynthesizer = new AudioSynthesizer();

        simView = findViewById(R.id.engine_sim_view);
        simView.setEngine(engine);

        tvRpmDisplay = findViewById(R.id.tv_rpm_display);
        tvPowerDisplay = findViewById(R.id.tv_power_display);
        tvMapPressure = findViewById(R.id.tv_map_pressure);
        tvAfr = findViewById(R.id.tv_afr);
        tvGear = findViewById(R.id.tv_gear);
        tvThrottleLabel = findViewById(R.id.tv_throttle_label);
        tvDynoLabel = findViewById(R.id.tv_dyno_label);

        btnIgnition = findViewById(R.id.btn_ignition);
        btnStarter = findViewById(R.id.btn_starter);
        btnClutch = findViewById(R.id.btn_clutch);
        btnGearUp = findViewById(R.id.btn_gear_up);
        btnGearDown = findViewById(R.id.btn_gear_down);

        seekThrottle = findViewById(R.id.seek_throttle);
        seekDyno = findViewById(R.id.seek_dyno);
        spinnerPreset = findViewById(R.id.spinner_engine_preset);

        // Populate engine presets
        ArrayAdapter<EnginePreset> adapter = new ArrayAdapter<>(
            this, android.R.layout.simple_spinner_dropdown_item, presets
        );
        spinnerPreset.setAdapter(adapter);
        spinnerPreset.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                engine.setPreset(presets[position]);
                updateIgnitionUi();
            }

            @Override
            public void onNothingSelected(AdapterView<?> parent) {}
        });

        // Ignition switch
        btnIgnition.setOnClickListener(v -> {
            boolean next = !engine.isIgnitionOn();
            engine.setIgnition(next);
            updateIgnitionUi();
        });

        // Starter button: hold to crank
        btnStarter.setOnTouchListener((v, event) -> {
            if (event.getAction() == MotionEvent.ACTION_DOWN) {
                engine.setStarter(true);
                btnStarter.setBackgroundColor(getResources().getColor(R.color.primary));
            } else if (event.getAction() == MotionEvent.ACTION_UP || event.getAction() == MotionEvent.ACTION_CANCEL) {
                engine.setStarter(false);
                btnStarter.setBackgroundColor(getResources().getColor(R.color.card_bg));
            }
            return true;
        });

        // Clutch button
        btnClutch.setOnClickListener(v -> {
            boolean next = !engine.isClutchEngaged();
            engine.setClutch(next);
            btnClutch.setText(next ? "CLUTCH: ENGAGED" : "CLUTCH: DISENGAGED");
            btnClutch.setTextColor(next ? getResources().getColor(R.color.accent) : getResources().getColor(R.color.text_main));
        });

        // Gears
        btnGearUp.setOnClickListener(v -> {
            engine.shiftUp();
            updateGearUi();
        });
        btnGearDown.setOnClickListener(v -> {
            engine.shiftDown();
            updateGearUi();
        });

        // Throttle
        seekThrottle.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                double val = progress / 100.0;
                engine.setThrottle(val);
                tvThrottleLabel.setText("THROTTLE: " + progress + "%");
            }

            @Override public void onStartTrackingTouch(SeekBar seekBar) {}
            @Override public void onStopTrackingTouch(SeekBar seekBar) {}
        });

        // Dyno load
        seekDyno.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                engine.setDynoLoad(progress);
                tvDynoLabel.setText("DYNO LOAD: " + progress + " Nm");
            }

            @Override public void onStartTrackingTouch(SeekBar seekBar) {}
            @Override public void onStopTrackingTouch(SeekBar seekBar) {}
        });
    }

    private void updateIgnitionUi() {
        boolean on = engine.isIgnitionOn();
        btnIgnition.setText(on ? "IGNITION: ON" : "IGNITION: OFF");
        btnIgnition.setTextColor(on ? getResources().getColor(R.color.accent) : getResources().getColor(R.color.text_main));
    }

    private void updateGearUi() {
        int g = engine.getCurrentGear();
        String txt = (g == -1) ? "GEAR: REVERSE" : (g == 0) ? "GEAR: NEUTRAL" : "GEAR: " + g;
        tvGear.setText(txt);
    }

    @Override
    protected void onResume() {
        super.onResume();
        startSimulation();
        audioSynthesizer.start();
    }

    @Override
    protected void onPause() {
        super.onPause();
        stopSimulation();
        audioSynthesizer.stop();
    }

    private void startSimulation() {
        if (isSimRunning) return;
        isSimRunning = true;
        simThread = new Thread(() -> {
            long lastTime = System.nanoTime();
            long lastUiUpdate = System.currentTimeMillis();

            while (isSimRunning) {
                long now = System.nanoTime();
                double dt = (now - lastTime) / 1_000_000_000.0;
                lastTime = now;

                // Sub-stepping for numerical precision (~240 Hz)
                int steps = 4;
                double subDt = dt / steps;
                for (int s = 0; s < steps; s++) {
                    engine.update(subDt);
                }

                // Update audio synth
                audioSynthesizer.updateEngineState(
                    engine.getRpm(),
                    engine.getThrottle(),
                    engine.getPreset().cylinders,
                    engine.isIgnitionOn()
                );

                // UI Telemetry updates (25 Hz)
                long currMs = System.currentTimeMillis();
                if (currMs - lastUiUpdate > 40) {
                    lastUiUpdate = currMs;
                    uiHandler.post(this::updateTelemetryUi);
                }

                try {
                    Thread.sleep(4); // ~240 Hz loop
                } catch (InterruptedException ignored) {}
            }
        }, "EnginePhysicsThread");
        simThread.start();
    }

    private void stopSimulation() {
        isSimRunning = false;
        if (simThread != null) {
            try {
                simThread.join(200);
            } catch (InterruptedException ignored) {}
            simThread = null;
        }
    }

    @SuppressLint("DefaultLocale")
    private void updateTelemetryUi() {
        double rpm = engine.getRpm();
        tvRpmDisplay.setText(String.format("%.0f RPM", rpm));
        tvPowerDisplay.setText(String.format("%.0f HP | %.0f Nm", engine.getCurrentHp(), engine.getCurrentTorqueNm()));
        tvMapPressure.setText(String.format("MAP: %.1f kPa", engine.getManifoldPressureKpa()));

        double afr = 14.7 - (engine.getThrottle() * 2.2) + (engine.getRpm() > 6000 ? 0.3 : 0.0);
        tvAfr.setText(String.format("AFR: %.1f : 1", afr));
    }
}
