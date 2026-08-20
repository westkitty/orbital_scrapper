import assert from "node:assert/strict";
import test from "node:test";
import { FixedStepLoop } from "../src/runtime/FixedStepLoop.js";

test("fixed-step loop advances simulation independently of render delta", () => {
  const loop = new FixedStepLoop(1 / 60, 5);
  let steps = 0;
  const step = () => { steps += 1; };

  loop.advance(1 / 120, step);
  assert.equal(steps, 0);
  loop.advance(1 / 120, step);
  assert.equal(steps, 1);
  loop.advance(1 / 30, step);
  assert.equal(steps, 3);
});

test("fixed-step loop caps catch-up work", () => {
  const loop = new FixedStepLoop(1 / 60, 5);
  let steps = 0;
  loop.advance(10, () => { steps += 1; });
  assert.equal(steps, 5);
});
