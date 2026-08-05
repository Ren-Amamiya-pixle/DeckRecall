import assert from "node:assert/strict";
import test from "node:test";
import { buildLaunchOptions, EMPTY_PROFILE, LaunchProfile, rebaseLaunchProfile } from "../src/launch";

test("trainer, LSFG-VK and FSR4 compose without losing original flags", () => {
  const profile: LaunchProfile = {
    trainer_enabled: true,
    trainer_path: "/home/deck/Trainers/Game.exe",
    lsfg_enabled: true,
    fsr4_enabled: true,
    fsr4_uninstall_enabled: false,
    original_options: "-dx11",
    managed_options: ""
  };
  assert.equal(
    buildLaunchOptions(profile.original_options, profile),
    `PROTON_REMOTE_DEBUG_CMD="'/home/deck/Trainers/Game.exe'" PRESSURE_VESSEL_FILESYSTEMS_RW="/home/deck/Trainers" ~/lsfg -- ~/fgmod/fgmod %command% -dx11`
  );
});

test("existing environment variables and command placeholder are preserved", () => {
  const profile: LaunchProfile = {
    trainer_enabled: false,
    trainer_path: "",
    lsfg_enabled: true,
    fsr4_enabled: true,
    fsr4_uninstall_enabled: false,
    original_options: "MANGOHUD=1 %command% --safe-mode",
    managed_options: ""
  };
  assert.equal(
    buildLaunchOptions(profile.original_options, profile),
    "MANGOHUD=1 ~/lsfg -- ~/fgmod/fgmod %command% --safe-mode"
  );
});

test("trainer options require a safe executable before Steam is changed", () => {
  assert.throws(() => buildLaunchOptions("", {
    trainer_enabled: true,
    trainer_path: "",
    lsfg_enabled: false,
    fsr4_enabled: false,
    fsr4_uninstall_enabled: false,
    original_options: "",
    managed_options: "",
  }), /executable_required/);
  assert.throws(() => buildLaunchOptions("", {
    trainer_enabled: true,
    trainer_path: "/home/deck/Downloads/bad'path.exe",
    lsfg_enabled: false,
    fsr4_enabled: false,
    fsr4_uninstall_enabled: false,
    original_options: "",
    managed_options: "",
  }), /invalid_executable_path/);
  assert.doesNotThrow(() => buildLaunchOptions("", {
    trainer_enabled: true,
    trainer_path: "/home/deck/Downloads/Trainer.EXE",
    lsfg_enabled: false,
    fsr4_enabled: false,
    fsr4_uninstall_enabled: false,
    original_options: "",
    managed_options: "",
  }));
});

test("FSR4 removal uses the Decky-Framegen uninstaller instead of the normal FSR4 wrapper", () => {
  const profile: LaunchProfile = {
    trainer_enabled: false,
    trainer_path: "",
    lsfg_enabled: false,
    fsr4_enabled: false,
    fsr4_uninstall_enabled: true,
    original_options: "-dx12",
    managed_options: "",
  };
  assert.equal(buildLaunchOptions(profile.original_options, profile), "~/fgmod/fgmod-uninstaller.sh %command% -dx12");
});

test("skip launcher adds the common argument once", () => {
  const profile: LaunchProfile = { ...EMPTY_PROFILE, skip_launcher_enabled: true };
  assert.equal(buildLaunchOptions("", profile), "%command% --skip-launcher");
  assert.equal(buildLaunchOptions("%command% --skip-launcher", profile), "%command% --skip-launcher");
});

test("a manually cleared Steam launch option becomes a new clean baseline", () => {
  const prior: LaunchProfile = {
    trainer_enabled: false,
    trainer_path: "",
    lsfg_enabled: true,
    fsr4_enabled: true,
    fsr4_uninstall_enabled: false,
    original_options: "-dx11",
    managed_options: "~/lsfg -- ~/fgmod/fgmod %command% -dx11",
  };
  const rebased = rebaseLaunchProfile("", prior);
  assert.equal(rebased.original_options, "");
  assert.equal(rebased.managed_options, "");
  assert.equal(buildLaunchOptions(rebased.original_options, rebased), "~/lsfg -- ~/fgmod/fgmod %command%");
});
