import assert from "node:assert/strict";
import test from "node:test";
import { cleanExeName, createGameShortcut, createInstallerShortcut, exeSelectionPath, finalizeInstallerShortcut, folderSelectionPath, launchInstaller } from "../src/exeInstall";

test("accepts only absolute EXE file-picker results", () => {
  assert.equal(exeSelectionPath({ realpath: "/home/deck/Downloads/setup.EXE" }), "/home/deck/Downloads/setup.EXE");
  assert.equal(exeSelectionPath({ path: "/home/deck/Downloads/setup.exe" }), "/home/deck/Downloads/setup.exe");
  assert.equal(exeSelectionPath({ realpath: "relative/setup.exe" }), undefined);
  assert.equal(exeSelectionPath({ realpath: "/home/deck/Downloads/setup.msi" }), undefined);
});

test("normalizes an absolute selected game folder", () => {
  assert.equal(folderSelectionPath({ realpath: "/home/deck/Downloads/Game/" }), "/home/deck/Downloads/Game");
  assert.equal(folderSelectionPath({ path: "relative/Game" }), undefined);
});

test("creates installer shortcut with Proton and fixed start directory", async () => {
  const calls: string[] = [];
  const apps: any = {
    AddShortcut: async (...args: string[]) => { calls.push(`add:${args.join("|")}`); return 42; },
    SetShortcutName: (id: number, value: string) => calls.push(`name:${id}:${value}`),
    SetShortcutExe: (id: number, value: string) => calls.push(`exe:${id}:${value}`),
    SetShortcutStartDir: (id: number, value: string) => calls.push(`dir:${id}:${value}`),
    SetAppLaunchOptions: () => undefined,
    SpecifyCompatTool: (id: number, value: string) => calls.push(`proton:${id}:${value}`),
  };
  const appId = await createInstallerShortcut(apps, "My Setup", "/home/deck/Downloads/setup.exe");
  assert.equal(appId, 42);
  assert.ok(calls.includes("dir:42:/home/deck/Downloads"));
  assert.ok(calls.includes("proton:42:proton_experimental"));
});

test("finalizes the same shortcut and creates desktop entry without artwork", () => {
  const calls: string[] = [];
  const apps: any = {
    SetShortcutName: (_id: number, value: string) => calls.push(`name:${value}`),
    SetShortcutExe: (_id: number, value: string) => calls.push(`exe:${value}`),
    SetShortcutStartDir: (_id: number, value: string) => calls.push(`dir:${value}`),
    SetAppLaunchOptions: () => undefined,
    CreateDesktopShortcutForApp: (id: number) => calls.push(`desktop:${id}`),
  };
  finalizeInstallerShortcut(apps, 42, {
    name: "Game", path: "/prefix/drive_c/Game/Game.exe", directory: "/prefix/drive_c/Game",
  }, "My Game");
  assert.deepEqual(calls, [
    "name:My Game", "exe:/prefix/drive_c/Game/Game.exe", "dir:/prefix/drive_c/Game", "desktop:42",
  ]);
  assert.equal(cleanExeName("/tmp/Game Setup.exe"), "Game Setup");
});

test("adds an extracted game with the selected Proton tool", async () => {
  const calls: string[] = [];
  const apps: any = {
    AddShortcut: async () => 77,
    SetShortcutName: () => undefined,
    SetShortcutExe: () => undefined,
    SetShortcutStartDir: () => undefined,
    SetAppLaunchOptions: () => undefined,
    CreateDesktopShortcutForApp: (id: number) => calls.push(`desktop:${id}`),
    SpecifyCompatTool: (id: number, tool: string) => calls.push(`proton:${id}:${tool}`),
  };
  await createGameShortcut(apps, {
    name: "Game", path: "/home/deck/Downloads/Game/Game.exe", directory: "/home/deck/Downloads/Game",
  }, "proton_10");
  assert.deepEqual(calls, ["desktop:77", "proton:77:proton_10"]);
});

test("launches the installer with the non-Steam game ID", () => {
  let gameId = "";
  launchInstaller({ RunGame: (id: string) => { gameId = id; } } as any, 42);
  assert.equal(gameId, ((42n << 32n) | 0x02000000n).toString());
});
