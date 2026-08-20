import type { FlightInput } from "../flight/FlightController.js";

export type FlightKeyboardTarget = {
  addEventListener(type: "keydown" | "keyup", listener: (event: KeyboardEvent) => void): void;
  removeEventListener(type: "keydown" | "keyup", listener: (event: KeyboardEvent) => void): void;
};

export type FlightInputActions = {
  reset: () => void;
};

const CONTROL_CODES = new Set([
  "KeyW", "KeyS", "KeyA", "KeyD", "KeyR", "KeyF",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "KeyQ", "KeyE", "Space", "KeyC", "KeyT", "KeyX",
]);

export class FlightInputBindings {
  private readonly pressed = new Set<string>();
  private attached = false;

  constructor(
    private readonly target: FlightKeyboardTarget,
    private readonly actions: FlightInputActions,
  ) {}

  attach(): void {
    if (this.attached) return;
    this.target.addEventListener("keydown", this.onKeyDown);
    this.target.addEventListener("keyup", this.onKeyUp);
    this.attached = true;
  }

  detach(): void {
    if (!this.attached) return;
    this.target.removeEventListener("keydown", this.onKeyDown);
    this.target.removeEventListener("keyup", this.onKeyUp);
    this.pressed.clear();
    this.attached = false;
  }

  isAttached(): boolean {
    return this.attached;
  }

  clear(): void {
    this.pressed.clear();
  }

  isCutActive(): boolean {
    return this.pressed.has("KeyC");
  }

  isTetherActive(): boolean {
    return this.pressed.has("KeyT");
  }

  getState(): FlightInput {
    return {
      forward: this.axis("KeyW", "KeyS"),
      strafe: this.axis("KeyD", "KeyA"),
      vertical: this.axis("KeyR", "KeyF"),
      pitch: this.axis("ArrowDown", "ArrowUp"),
      yaw: this.axis("ArrowLeft", "ArrowRight"),
      roll: this.axis("KeyQ", "KeyE"),
      brake: this.pressed.has("Space"),
    };
  }

  private axis(positiveCode: string, negativeCode: string): number {
    return Number(this.pressed.has(positiveCode)) - Number(this.pressed.has(negativeCode));
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!CONTROL_CODES.has(event.code)) return;
    event.preventDefault?.();
    if (event.code === "KeyX") {
      if (!event.repeat) this.actions.reset();
      return;
    }
    this.pressed.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (!CONTROL_CODES.has(event.code)) return;
    event.preventDefault?.();
    this.pressed.delete(event.code);
  };
}
