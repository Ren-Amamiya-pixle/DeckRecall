import assert from "node:assert/strict";
import test from "node:test";
import { normalizeError } from "../src/errors";

test("reads Decky RPC error codes from nested response objects", () => {
  assert.equal(normalizeError({ error: { message: "ValueError: memory_root_required" } }), "memory_root_required");
  assert.equal(normalizeError({ detail: { cause: "self_update_release_unavailable" } }), "self_update_release_unavailable");
});

test("reads ordinary Error causes and keeps unknown fallback", () => {
  assert.equal(normalizeError(new Error("memory_space_insufficient")), "memory_space_insufficient");
  assert.equal(normalizeError({ error: { message: "unclassified failure" } }), "unknown_error");
});
