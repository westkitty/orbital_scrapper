export type PhaseZeroActions = {
  reset: () => void;
  toggleConstraint: () => void;
};

export type KeyboardTarget = {
  addEventListener(type: "keydown", listener: (event: KeyboardEvent) => void): void;
  removeEventListener(type: "keydown", listener: (event: KeyboardEvent) => void): void;
};

export class InputBindings {
  private attached = false;

  constructor(
    private readonly target: KeyboardTarget,
    private readonly actions: PhaseZeroActions,
  ) {}

  attach(): void {
    if (this.attached) return;
    this.target.addEventListener("keydown", this.onKeyDown);
    this.attached = true;
  }

  detach(): void {
    if (!this.attached) return;
    this.target.removeEventListener("keydown", this.onKeyDown);
    this.attached = false;
  }

  isAttached(): boolean {
    return this.attached;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    if (event.code === "KeyR") this.actions.reset();
    if (event.code === "KeyC") this.actions.toggleConstraint();
  };
}
