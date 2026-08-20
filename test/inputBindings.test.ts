import assert from "node:assert/strict";
import test from "node:test";
import { InputBindings, type KeyboardTarget } from "../src/runtime/InputBindings.js";

class FakeKeyboardTarget implements KeyboardTarget {
  listeners = new Set<(event: KeyboardEvent) => void>();
  adds = 0;
  removes = 0;

  addEventListener(_type: "keydown", listener: (event: KeyboardEvent) => void): void {
    this.adds += 1;
    this.listeners.add(listener);
  }

  removeEventListener(_type: "keydown", listener: (event: KeyboardEvent) => void): void {
    this.removes += 1;
    this.listeners.delete(listener);
  }
}

test("input bindings attach exactly once and detach cleanly", () => {
  const target = new FakeKeyboardTarget();
  const bindings = new InputBindings(target, { reset: () => undefined, toggleConstraint: () => undefined });

  for (let index = 0; index < 20; index += 1) bindings.attach();
  assert.equal(target.adds, 1);
  assert.equal(target.listeners.size, 1);

  bindings.detach();
  bindings.detach();
  assert.equal(target.removes, 1);
  assert.equal(target.listeners.size, 0);
});
