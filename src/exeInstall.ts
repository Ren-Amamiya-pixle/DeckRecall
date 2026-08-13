export type ExeInstallCandidate = {
  id: string;
  name: string;
  relative: string;
  path: string;
  directory: string;
  size: number;
  new: boolean;
  score: number;
};

type SteamApps = {
  AddShortcut(name: string, exe: string, directory: string, options: string): Promise<number>;
  RemoveShortcut(appId: number): void;
  SetShortcutName(appId: number, name: string): void;
  SetShortcutExe(appId: number, exe: string): void;
  SetShortcutStartDir(appId: number, directory: string): void;
  SetAppLaunchOptions(appId: number, options: string): void;
  SpecifyCompatTool(appId: number, tool: string): void;
  CreateDesktopShortcutForApp(appId: number): void;
  RunGame(gameId: string, options: string, param2: number, source: number): void;
};

export function cleanExeName(path: string): string {
  const file = path.split(/[\\/]/).pop() || "Windows app";
  return file.replace(/\.[^.]+$/, "").trim() || "Windows app";
}

export function exeSelectionPath(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as { realpath?: unknown; path?: unknown };
  const path = typeof record.realpath === "string" ? record.realpath
    : typeof record.path === "string" ? record.path : "";
  if (typeof path !== "string" || !path.startsWith("/") || !/\.exe$/i.test(path)) return undefined;
  return path;
}

export function folderSelectionPath(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as { realpath?: unknown; path?: unknown };
  const path = typeof record.realpath === "string" ? record.realpath
    : typeof record.path === "string" ? record.path : "";
  if (!path.startsWith("/")) return undefined;
  return path.replace(/\/+$/, "") || "/";
}

export async function createInstallerShortcut(
  apps: SteamApps,
  name: string,
  installer: string,
  compatTool = "proton_experimental",
): Promise<number> {
  const appId = await apps.AddShortcut(name, installer, installer.replace(/[/\\][^/\\]+$/, ""), "");
  if (!Number.isInteger(appId) || appId <= 0) throw new Error("exe_install_shortcut_failed");
  apps.SetShortcutName(appId, name);
  apps.SetShortcutExe(appId, installer);
  apps.SetShortcutStartDir(appId, installer.replace(/[/\\][^/\\]+$/, ""));
  apps.SetAppLaunchOptions(appId, "");
  apps.SpecifyCompatTool(appId, compatTool);
  return appId;
}

export async function createGameShortcut(
  apps: SteamApps,
  candidate: Pick<ExeInstallCandidate, "name" | "path" | "directory">,
  compatTool = "proton_experimental",
): Promise<number> {
  const appId = await apps.AddShortcut(candidate.name, candidate.path, candidate.directory, "");
  if (!Number.isInteger(appId) || appId <= 0) throw new Error("exe_install_shortcut_failed");
  finalizeInstallerShortcut(apps, appId, candidate, candidate.name);
  apps.SpecifyCompatTool(appId, compatTool);
  return appId;
}

export function launchInstaller(apps: SteamApps, appId: number): void {
  const gameId = (BigInt(appId >>> 0) << 32n) | 0x02000000n;
  apps.RunGame(gameId.toString(), "", -1, 100);
}

export function finalizeInstallerShortcut(
  apps: SteamApps,
  appId: number,
  candidate: Pick<ExeInstallCandidate, "name" | "path" | "directory">,
  displayName: string,
): void {
  const name = displayName.trim() || candidate.name;
  apps.SetShortcutName(appId, name);
  apps.SetShortcutExe(appId, candidate.path);
  apps.SetShortcutStartDir(appId, candidate.directory);
  apps.SetAppLaunchOptions(appId, "");
  apps.CreateDesktopShortcutForApp(appId);
}
