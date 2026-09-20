package com.enginesim.app;

import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;

public class AudioSynthesizer implements Runnable {
    private static final int SAMPLE_RATE = 44100;
    private AudioTrack audioTrack;
    private volatile boolean isRunning = false;
    private Thread audioThread;

    private volatile double targetRpm = 0.0;
    private volatile double currentRpm = 0.0;
    private volatile double throttle = 0.0;
    private volatile int cylinderCount = 4;
    private volatile boolean isIgnition = false;

    public AudioSynthesizer() {
        int minBufferSize = AudioTrack.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        );

        audioTrack = new AudioTrack.Builder()
            .setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_GAME)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build())
            .setAudioFormat(new AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(SAMPLE_RATE)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .build())
            .setBufferSizeInBytes(Math.max(minBufferSize, 4096))
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build();
    }

    public synchronized void start() {
        if (isRunning) return;
        isRunning = true;
        audioTrack.play();
        audioThread = new Thread(this, "EngineAudioThread");
        audioThread.setPriority(Thread.MAX_PRIORITY);
        audioThread.start();
    }

    public synchronized void stop() {
        isRunning = false;
        if (audioThread != null) {
            try {
                audioThread.join(200);
            } catch (InterruptedException ignored) {}
            audioThread = null;
        }
        if (audioTrack != null) {
            try {
                audioTrack.stop();
                audioTrack.flush();
            } catch (Exception ignored) {}
        }
    }

    public void updateEngineState(double rpm, double throttle, int cylinders, boolean ignition) {
        this.targetRpm = rpm;
        this.throttle = throttle;
        this.cylinderCount = Math.max(1, cylinders);
        this.isIgnition = ignition;
    }

    @Override
    public void run() {
        final int bufferSize = 1024;
        final short[] buffer = new short[bufferSize];
        double phase = 0.0;
        double subPhase = 0.0;
        double harmonicPhase = 0.0;

        while (isRunning) {
            // Smooth RPM interpolation
            currentRpm += (targetRpm - currentRpm) * 0.05;

            if (currentRpm < 80.0 || !isIgnition) {
                // Silence or subtle mechanical hum
                for (int i = 0; i < bufferSize; i++) {
                    buffer[i] = 0;
                }
                audioTrack.write(buffer, 0, bufferSize);
                continue;
            }

            // Fundamental firing frequency: f = (RPM / 60) * (cylinders / 2)
            double fundamentalFreq = (currentRpm / 60.0) * (cylinderCount / 2.0);
            double phaseIncrement = (2.0 * Math.PI * fundamentalFreq) / SAMPLE_RATE;
            double subHarmonicInc = phaseIncrement * 0.5; // Half-order crank wobble
            double secondHarmonicInc = phaseIncrement * 2.0;

            double volume = Math.min(0.85, 0.25 + (throttle * 0.5) + (currentRpm / 10000.0) * 0.2);

            for (int i = 0; i < bufferSize; i++) {
                phase += phaseIncrement;
                if (phase > 2.0 * Math.PI) phase -= 2.0 * Math.PI;

                subPhase += subHarmonicInc;
                if (subPhase > 2.0 * Math.PI) subPhase -= 2.0 * Math.PI;

                harmonicPhase += secondHarmonicInc;
                if (harmonicPhase > 2.0 * Math.PI) harmonicPhase -= 2.0 * Math.PI;

                // Synthesize asymmetric exhaust pulse wave shape
                // Triangle wave base + sine harmonics + overdrive clipping for aggressive engine growl
                double pulse = Math.sin(phase) + (0.45 * Math.sin(harmonicPhase)) + (0.35 * Math.sin(subPhase));

                // Distortion / exhaust throat saturation based on throttle
                double drive = 1.0 + (throttle * 2.2);
                double saturated = Math.tanh(pulse * drive);

                // Convert to 16-bit PCM
                buffer[i] = (short) (saturated * volume * 28000.0);
            }

            audioTrack.write(buffer, 0, bufferSize);
        }
    }
}
