// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { FlightInputBindings } from "../src/runtime/FlightInputBindings.js";

class FakeKeyboardTarget {
  listeners = { keydown: new Set(), keyup: new Set(), blur: new Set() };

  addEventListener(type, listener) { this.listeners[type].add(listener); }
  removeEventListener(type, listener) { this.listeners[type].delete(listener); }
  dispatch(type, code = "", repeat = false, target = null) {
    const event = { code, repeat, target, prevented: false, preventDefault() { this.prevented = true; } };
    for (const listener of this.listeners[type]) listener(event);
    return event;
  }
}

test("flight input bindings expose held six-axis controls, cutter/tether holds, and detach cleanly", () => {
  const target = new FakeKeyboardTarget();
  let resets = 0;
  const input = new FlightInputBindings(target, { reset: () => { resets += 1; } });

  input.attach();
  input.attach();
  assert.equal(target.listeners.keydown.size, 1);
  assert.equal(target.listeners.keyup.size, 1);
  assert.equal(target.listeners.blur.size, 1);

  target.dispatch("keydown", "KeyW");
  target.dispatch("keydown", "KeyD");
  target.dispatch("keydown", "KeyR");
  target.dispatch("keydown", "ArrowLeft");
  target.dispatch("keydown", "ArrowDown");
  target.dispatch("keydown", "KeyQ");
  target.dispatch("keydown", "Space");
  target.dispatch("keydown", "KeyC");
  target.dispatch("keydown", "KeyT");

  assert.deepEqual(input.getState(), {
    forward: 1,
    strafe: 1,
    vertical: 1,
    pitch: 1,
    yaw: 1,
    roll: 1,
    brake: true,
  });
  assert.equal(input.isCutActive(), true);
  assert.equal(input.isTetherActive(), true);

  for (const code of ["KeyW", "KeyD", "KeyR", "ArrowLeft", "ArrowDown", "KeyQ", "Space", "KeyC", "KeyT"]) {
    target.dispatch("keyup", code);
  }
  assert.deepEqual(input.getState(), {
    forward: 0,
    strafe: 0,
    vertical: 0,
    pitch: 0,
    yaw: 0,
    roll: 0,
    brake: false,
  });
  assert.equal(input.isCutActive(), false);
  assert.equal(input.isTetherActive(), false);

  target.dispatch("keydown", "KeyX");
  target.dispatch("keydown", "KeyX", true);
  assert.equal(resets, 1);

  input.detach();
  assert.equal(target.listeners.keydown.size, 0);
  assert.equal(target.listeners.keyup.size, 0);
  assert.equal(target.listeners.blur.size, 0);
  assert.equal(input.isAttached(), false);
  assert.equal(input.isCutActive(), false);
  assert.equal(input.isTetherActive(), false);
});

test("focus loss clears held movement and tool controls when keyup is lost", () => {
  const target = new FakeKeyboardTarget();
  const input = new FlightInputBindings(target, { reset: () => {} });
  input.attach();

  target.dispatch("keydown", "KeyW");
  target.dispatch("keydown", "Space");
  target.dispatch("keydown", "KeyC");
  target.dispatch("keydown", "KeyT");
  assert.equal(input.getState().forward, 1);
  assert.equal(input.getState().brake, true);
  assert.equal(input.isCutActive(), true);
  assert.equal(input.isTetherActive(), true);

  target.dispatch("blur");
  assert.deepEqual(input.getState(), {
    forward: 0,
    strafe: 0,
    vertical: 0,
    pitch: 0,
    yaw: 0,
    roll: 0,
    brake: false,
  });
  assert.equal(input.isCutActive(), false);
  assert.equal(input.isTetherActive(), false);
});

test("focused interactive controls keep normal keyboard activation instead of being stolen by flight shortcuts", () => {
  const target = new FakeKeyboardTarget();
  let resets = 0;
  const input = new FlightInputBindings(target, { reset: () => { resets += 1; } });
  input.attach();
  const button = { tagName: "BUTTON", isContentEditable: false };

  const spaceDown = target.dispatch("keydown", "Space", false, button);
  const resetDown = target.dispatch("keydown", "KeyX", false, button);
  assert.equal(spaceDown.prevented, false);
  assert.equal(resetDown.prevented, false);
  assert.equal(input.getState().brake, false);
  assert.equal(resets, 0);

  target.dispatch("keydown", "KeyW");
  assert.equal(input.getState().forward, 1);
  const interactiveKeyUp = target.dispatch("keyup", "KeyW", false, button);
  assert.equal(interactiveKeyUp.prevented, false);
  assert.equal(input.getState().forward, 0, "interactive keyup did not release a previously held gameplay key");
});
