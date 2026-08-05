import assert from "node:assert/strict";
import test from "node:test";
import { memoryTuningConfigured, normalizeMemoryStatus } from "../src/memory";

test("normalizes a healthy virtual-memory status", () => {
  const status = normalizeMemoryStatus({
    steamos: true,
    root: true,
    recommended_swap_gib: 16,
    swappiness: 1,
    swaps: [{ name: "/home/swapfile", type: "file", size_kib: 16777216, used_kib: 12, priority: -2 }],
    zram_count: 1,
    space_kib: 100000000,
    required_kib: 12582912,
    power_ok: true,
    managed: { main_swap_complete: true, fallback_swap_complete: false, zram_config: true, sysctl_config: true, main_unit: true, fallback_unit: false },
  });
  assert.equal(status?.steamos, true);
  assert.equal(status?.swaps.length, 1);
  assert.equal(status?.managed.zram_config, true);
  assert.equal(memoryTuningConfigured(status), true);
});

test("rejects malformed memory status and ignores bad swap rows", () => {
  assert.equal(normalizeMemoryStatus(null), undefined);
  const status = normalizeMemoryStatus({
    steamos: false,
    root: false,
    swaps: [null, { name: "/dev/zram0", type: "partition" }],
    managed: {},
  });
  assert.equal(status?.steamos, false);
  assert.equal(status?.swaps.length, 1);
  assert.equal(status?.managed.main_unit, false);
  assert.equal(memoryTuningConfigured(status), false);
});
