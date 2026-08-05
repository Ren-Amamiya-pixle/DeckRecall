import assert from "node:assert/strict";
import test from "node:test";
import { booleanLike, runningFromList, runningFromObject } from "../src/running";

test("normalizes Steam running-state values", () => {
  assert.equal(booleanLike(true), true);
  assert.equal(booleanLike("stopped"), false);
  assert.equal(booleanLike({ bRunning: false }), false);
  assert.equal(booleanLike(undefined), undefined);
});

test("reads live methods before cached-looking fields", () => {
  assert.equal(runningFromObject({ BIsAppRunning: () => false, running: true }), false);
  assert.equal(runningFromObject({ BIsRunning: () => true }), true);
});

test("an empty live running-app list means the game is stopped", () => {
  assert.equal(runningFromList([], 123), false);
  assert.equal(runningFromList([{ appid: 456 }], 123), false);
  assert.equal(runningFromList([{ unAppID: 123 }], 123), true);
});
