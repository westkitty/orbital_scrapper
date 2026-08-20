export type PresentationAudioInput = {
  severityScore: number;
  severityState: string;
  warningCue: string;
  thrustLevel: number;
  tetherLoadRatio: number;
  cutterProgress01: number;
  cutterActive: boolean;
  impactImpulse: number;
  hullIntegrity: number;
};

export type PresentationAudioMix = {
  shipHum: number;
  thrusterConduction: number;
  tetherConduction: number;
  cutterConduction: number;
  impactStructure: number;
  warningInstrumentation: number;
  collapseMusic: number;
};

export type PresentationAudioDiagnostics = {
  state: "muted" | "ready" | "unavailable";
  enabled: boolean;
  severityGain: number;
  mix: PresentationAudioMix;
  channels: readonly string[];
};

export const VACUUM_AUDIO_CHANNELS = Object.freeze([
  "ship-hum",
  "thruster-conduction",
  "tether-conduction",
  "cutter-conduction",
  "impact-structure",
  "warning-instrumentation",
  "collapse-music",
]);

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : 0));
}

export function derivePresentationAudioMix(input: PresentationAudioInput): PresentationAudioMix {
  const severity = clamp(input.severityScore / 100);
  const thrust = clamp(input.thrustLevel);
  const tether = clamp(input.tetherLoadRatio);
  const cutter = input.cutterActive ? clamp(Math.max(0.2, input.cutterProgress01)) : 0;
  const impact = clamp(input.impactImpulse / 12);
  const damaged = clamp((100 - input.hullIntegrity) / 100);
  const warning = input.warningCue === "hull-failure"
    ? 1
    : input.warningCue === "critical-alarm"
      ? 0.82
      : input.warningCue === "danger-pulse"
        ? 0.58
        : input.warningCue === "caution-pulse"
          ? 0.32
          : 0;

  return {
    shipHum: 0.055 + damaged * 0.018,
    thrusterConduction: 0.015 + thrust * 0.12,
    tetherConduction: tether * 0.11,
    cutterConduction: cutter * 0.095,
    impactStructure: impact * 0.16,
    warningInstrumentation: warning * 0.13,
    collapseMusic: 0.015 + severity * 0.16,
  };
}

function setGain(node: any, value: number, time: number): void {
  if (!node?.gain) return;
  const target = clamp(value, 0, 0.3);
  if (typeof node.gain.cancelScheduledValues === "function") node.gain.cancelScheduledValues(time);
  if (typeof node.gain.setTargetAtTime === "function") node.gain.setTargetAtTime(target, time, 0.035);
  else node.gain.value = target;
}

export class ProductionAudio {
  private context: any = null;
  private master: any = null;
  private nodes = new Map<string, { oscillator: any; gain: any }>();
  private enabled = false;
  private unavailable = false;
  private lastMix: PresentationAudioMix = derivePresentationAudioMix({
    severityScore: 0,
    severityState: "stable",
    warningCue: "quiet",
    thrustLevel: 0,
    tetherLoadRatio: 0,
    cutterProgress01: 0,
    cutterActive: false,
    impactImpulse: 0,
    hullIntegrity: 100,
  });

  constructor(private readonly contextFactory: (() => any) | null = null) {}

  async enable(): Promise<boolean> {
    if (this.enabled) return true;
    if (this.unavailable) return false;
    try {
      const factory = this.contextFactory ?? (() => {
        const Ctor = (globalThis as any).AudioContext ?? (globalThis as any).webkitAudioContext;
        if (!Ctor) return null;
        return new Ctor();
      });
      this.context = factory();
      if (!this.context) {
        this.unavailable = true;
        return false;
      }
      this.master = this.context.createGain();
      this.master.gain.value = 0.72;
      this.master.connect(this.context.destination);

      this.createTone("ship-hum", 52, "sine");
      this.createTone("thruster-conduction", 88, "sawtooth");
      this.createTone("tether-conduction", 154, "triangle");
      this.createTone("cutter-conduction", 232, "square");
      this.createTone("impact-structure", 72, "triangle");
      this.createTone("warning-instrumentation", 620, "sine");
      this.createTone("collapse-music", 108, "sine");

      if (typeof this.context.resume === "function") await this.context.resume();
      this.enabled = true;
      this.applyMix(this.lastMix);
      return true;
    } catch {
      this.unavailable = true;
      this.enabled = false;
      return false;
    }
  }

  disable(): void {
    this.enabled = false;
    if (this.master?.gain) this.master.gain.value = 0;
  }

  update(input: PresentationAudioInput): void {
    this.lastMix = derivePresentationAudioMix(input);
    if (!this.enabled || !this.context) return;
    this.applyMix(this.lastMix);
  }

  getDiagnostics(): PresentationAudioDiagnostics {
    return {
      state: this.unavailable ? "unavailable" : this.enabled ? "ready" : "muted",
      enabled: this.enabled,
      severityGain: this.lastMix.collapseMusic,
      mix: { ...this.lastMix },
      channels: VACUUM_AUDIO_CHANNELS,
    };
  }

  async dispose(): Promise<void> {
    for (const { oscillator } of this.nodes.values()) {
      try { oscillator.stop(); } catch {}
    }
    this.nodes.clear();
    this.enabled = false;
    if (this.context?.close) {
      try { await this.context.close(); } catch {}
    }
    this.context = null;
    this.master = null;
  }

  private createTone(id: string, frequency: number, type: string): void {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    gain.gain.value = 0;
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start();
    this.nodes.set(id, { oscillator, gain });
  }

  private applyMix(mix: PresentationAudioMix): void {
    if (!this.context) return;
    if (this.master?.gain && this.master.gain.value === 0) this.master.gain.value = 0.72;
    const time = this.context.currentTime ?? 0;
    setGain(this.nodes.get("ship-hum")?.gain, mix.shipHum, time);
    setGain(this.nodes.get("thruster-conduction")?.gain, mix.thrusterConduction, time);
    setGain(this.nodes.get("tether-conduction")?.gain, mix.tetherConduction, time);
    setGain(this.nodes.get("cutter-conduction")?.gain, mix.cutterConduction, time);
    setGain(this.nodes.get("impact-structure")?.gain, mix.impactStructure, time);
    setGain(this.nodes.get("warning-instrumentation")?.gain, mix.warningInstrumentation, time);
    setGain(this.nodes.get("collapse-music")?.gain, mix.collapseMusic, time);
  }
}
