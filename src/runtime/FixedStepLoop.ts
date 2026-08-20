export class FixedStepLoop {
  private accumulator = 0;

  constructor(
    readonly stepSeconds: number,
    readonly maxSubsteps = 5,
  ) {
    if (stepSeconds <= 0) throw new Error("stepSeconds must be positive");
    if (maxSubsteps < 1) throw new Error("maxSubsteps must be at least one");
  }

  advance(frameDeltaSeconds: number, step: () => void): number {
    const boundedDelta = Math.min(Math.max(frameDeltaSeconds, 0), this.stepSeconds * this.maxSubsteps);
    this.accumulator += boundedDelta;

    let count = 0;
    while (this.accumulator >= this.stepSeconds && count < this.maxSubsteps) {
      step();
      this.accumulator -= this.stepSeconds;
      count += 1;
    }

    return count;
  }

  reset(): void {
    this.accumulator = 0;
  }
}
