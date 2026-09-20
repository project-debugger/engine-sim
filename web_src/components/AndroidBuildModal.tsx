import React, { useState } from 'react';
import { Smartphone, GitBranch, CheckCircle2, Download, Copy, Check, Terminal, FileCode2, ExternalLink } from 'lucide-react';

interface AndroidBuildModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidBuildModal: React.FC<AndroidBuildModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const workflowYaml = `name: Build Android APK
on:
  push:
    branches: [ "**" ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
      - run: chmod +x ./gradlew && ./gradlew assembleDebug
      - uses: actions/upload-artifact@v4
        with:
          name: EngineSim-Debug-APK
          path: app/build/outputs/apk/debug/*.apk`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#30363d]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Android App (.apk) Build Center</h2>
              <p className="text-xs text-slate-400">Build via GitHub Actions or Export Android Project</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-[#21262d]"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {/* Status Box */}
          <div className="bg-[#0f141c] border border-emerald-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm mb-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Android Project & GitHub Actions Workflow Configured</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              We have generated the complete Android native Java app (physics engine, custom drawing canvas, real-time AudioTrack sound synthesizer), Gradle build scripts, wrapper, and the automated GitHub Actions workflow file: <code className="text-emerald-300 bg-[#161b22] px-1.5 py-0.5 rounded">.github/workflows/build-apk.yml</code>.
            </p>
          </div>

          {/* GitHub Actions Step-by-Step */}
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
              <GitBranch className="w-4 h-4 text-sky-400" />
              How to build the APK via GitHub:
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex gap-3 bg-[#0d1117] p-3 rounded-lg border border-[#30363d]">
                <div className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-[11px] shrink-0">1</div>
                <div>
                  <div className="text-white font-medium mb-1">Export to your GitHub repository / fork</div>
                  <p className="text-slate-400">
                    In the AI Studio menu at the top right, click <strong>Settings &gt; Export to GitHub</strong> (or download the ZIP). Select your GitHub account and fork.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 bg-[#0d1117] p-3 rounded-lg border border-[#30363d]">
                <div className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-[11px] shrink-0">2</div>
                <div>
                  <div className="text-white font-medium mb-1">GitHub Actions Automatically Builds the APK</div>
                  <p className="text-slate-400">
                    Once pushed, go to the <strong>Actions</strong> tab on your GitHub repository. The workflow <strong>Build Android APK</strong> will automatically trigger, setup JDK 17, execute Gradle, and generate the APK.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 bg-[#0d1117] p-3 rounded-lg border border-[#30363d]">
                <div className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-[11px] shrink-0">3</div>
                <div>
                  <div className="text-white font-medium mb-1">Download your .apk File</div>
                  <p className="text-slate-400">
                    Click the completed workflow run. Under <strong>Artifacts</strong>, click to download <strong>EngineSim-Debug-APK</strong>, transfer it to your Android device, and install!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Project Structure Tree */}
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
              <FileCode2 className="w-4 h-4 text-amber-400" />
              Generated Android Codebase Structure
            </h3>
            <div className="bg-[#0b0e14] p-3 rounded-lg border border-[#30363d] font-mono text-[11px] text-slate-300 space-y-1">
              <div className="text-amber-400">.github/workflows/build-apk.yml <span className="text-slate-500"># GitHub Actions auto APK builder</span></div>
              <div className="text-sky-400">app/src/main/AndroidManifest.xml <span className="text-slate-500"># Permissions, landscape lock</span></div>
              <div className="text-emerald-400">app/src/main/java/com/enginesim/app/</div>
              <div className="pl-4 text-slate-300">├── MainActivity.java <span className="text-slate-500"># UI controls, loop scheduler</span></div>
              <div className="pl-4 text-slate-300">├── EngineSimulationEngine.java <span className="text-slate-500"># Thermodynamic physics</span></div>
              <div className="pl-4 text-slate-300">├── EngineSimulatorView.java <span className="text-slate-500"># 60fps custom View</span></div>
              <div className="pl-4 text-slate-300">├── AudioSynthesizer.java <span className="text-slate-500"># Android AudioTrack synth</span></div>
              <div className="pl-4 text-slate-300">└── EnginePreset.java <span className="text-slate-500"># 2JZ, LS V8, EJ25, K20 presets</span></div>
              <div className="text-purple-400">build.gradle, settings.gradle, gradlew <span className="text-slate-500"># Gradle build system</span></div>
            </div>
          </div>

          {/* Workflow Action Code Snippet */}
          <div>
            <div className="flex justify-between items-center mb-1 text-xs">
              <span className="text-slate-400 font-mono">.github/workflows/build-apk.yml</span>
              <button
                onClick={() => copyToClipboard(workflowYaml, 'yaml')}
                className="flex items-center gap-1 text-sky-400 hover:text-sky-300"
              >
                {copied === 'yaml' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied === 'yaml' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="bg-[#0b0e14] border border-[#30363d] rounded-lg p-3 text-[11px] font-mono text-slate-300 overflow-x-auto">
              {workflowYaml}
            </pre>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-[#30363d] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
