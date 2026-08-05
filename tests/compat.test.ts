import assert from "node:assert/strict";
import test from "node:test";
import {
  compatToolFamily,
  isRecommendedCompatTool,
  mergeCompatTools,
  normalizeCompatTools,
  PROTON_10_APP_ID,
  PROTON_EXPERIMENTAL_APP_ID,
} from "../src/compat";

test("finds the three recommended Proton compatibility tool families", () => {
  assert.equal(isRecommendedCompatTool({ strToolName: "proton_experimental", strDisplayName: "Proton Experimental" }), true);
  assert.equal(isRecommendedCompatTool({ strToolName: "proton_10", strDisplayName: "Proton 10.0-4" }), true);
  assert.equal(isRecommendedCompatTool({ strToolName: "GE-Proton10-25", strDisplayName: "GE-Proton10-25" }), true);
  assert.equal(isRecommendedCompatTool({ strToolName: "proton_9", strDisplayName: "Proton 9.0-4" }), false);
  assert.equal(isRecommendedCompatTool({ strToolName: "steamlinuxruntime3", strDisplayName: "Steam Linux Runtime 3.0" }), false);
  assert.equal(compatToolFamily({ strToolName: "proton_experimental", strDisplayName: "Proton Experimental" }), "experimental");
  assert.equal(compatToolFamily({ strToolName: "proton_10", strDisplayName: "Proton 10.0-4" }), "proton10");
  assert.equal(compatToolFamily({ strToolName: "GE-Proton10-25", strDisplayName: "GE-Proton10-25" }), "ge");
  assert.equal(PROTON_EXPERIMENTAL_APP_ID, 1493710);
  assert.equal(PROTON_10_APP_ID, 3658110);
});

test("rejects malformed and duplicate compatibility tools", () => {
  assert.deepEqual(normalizeCompatTools([
    { strToolName: "proton_10", strDisplayName: "Proton 10.0-4" },
    { strToolName: "proton_10", strDisplayName: "Duplicate" },
    { strToolName: "", strDisplayName: "Invalid" },
    null,
  ]), [{ strToolName: "proton_10", strDisplayName: "Proton 10.0-4" }]);
  assert.deepEqual(normalizeCompatTools(undefined), []);
  assert.deepEqual(normalizeCompatTools({ rgTools: [{ strToolName: "proton_experimental", strDisplayName: "Proton Experimental" }] }),
    [{ strToolName: "proton_experimental", strDisplayName: "Proton Experimental" }]);
  assert.deepEqual(normalizeCompatTools({ tools: [{ strToolName: "GE-Proton11-3", strDisplayName: "GE-Proton11-3" }] }),
    [{ strToolName: "GE-Proton11-3", strDisplayName: "GE-Proton11-3" }]);
  assert.deepEqual(mergeCompatTools(
    [{ strToolName: "proton_10", strDisplayName: "Proton 10.0-4" }],
    [{ strToolName: "proton_10", strDisplayName: "Duplicate" }],
  ), [{ strToolName: "proton_10", strDisplayName: "Proton 10.0-4" }]);
});
