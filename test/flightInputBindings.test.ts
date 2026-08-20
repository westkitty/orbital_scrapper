// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { FlightInputBindings } from "../src/runtime/FlightInputBindings.js";

class FakeKeyboardTarget {
  listeners = { keydown: new Set(), keyup: new Set() };

  addEventListener(type, listener) { this.listeners[type].add(listener); }
  removeEventListener(type, listener) { this.listeners[type].delete(listener); }
  dispatch(type, code, repeat = false) {
    const event = { code, repeat, prevented: false, preventDefault() { this.prevented = true; } };
    for (const listener of this.listeners[type]) listener(event);
    return event;
  }
}

test("flight input bindings expose held six-axis controls, cutter hold, and detach cleanly", () => {
  const target = new FakeKeyboardTarget();
  let resets = 0;
  const input = new FlightInputBindings(target, { reset: () => { resets += 1; } });

  input.attach();
  input.attach();
  assert.equal(target.listeners.keydown.size, 1);
  assert.equal(target.listeners.keyup.size, 1);

  target.dispatch("keydown", "KeyW");
  target.dispatch("keydown", "KeyD");
  target.dispatch("keydown", "KeyR");
  target.dispatch("keydown", "ArrowLeft");
  target.dispatch("keydown", "ArrowDown");
  target.dispatch("keydown", "KeyQ");
  target.dispatch("keydown", "Space");
  target.dispatch("keydown", "KeyC");

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

  target.dispatch("keyup", "KeyW");
  target.dispatch("keyup", "KeyD");
  target.dispatch("keyup", "KeyR");
  target.dispatch("keyup", "ArrowLeft");
  target.dispatch("keyup", "ArrowDown");
  target.dispatch("keyup", "KeyQ");
  target.dispatch("keyup", "Space");
  target.dispatch("keyup", "KeyC");
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

  target.dispatch("keydown", "KeyX");
  target.dispatch("keydown", "KeyX", true);
  assert.equal(resets, 1);

  input.detach();
  assert.equal(target.listeners.keydown.size, 0);
  assert.equal(target.listeners.keyup.size, 0);
  assert.equal(input.isAttached(), false);
  assert.equal(input.isCutActive(), false);
});
