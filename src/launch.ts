export type LaunchProfile = {
  trainer_enabled: boolean;
  trainer_path: string;
  lsfg_enabled: boolean;
  fsr4_enabled: boolean;
  fsr4_uninstall_enabled: boolean;
  skip_launcher_enabled?: boolean;
  original_options: string;
  managed_options: string;
};

export const EMPTY_PROFILE: LaunchProfile = {
  trainer_enabled: false, trainer_path: "", lsfg_enabled: false, fsr4_enabled: false, fsr4_uninstall_enabled: false, skip_launcher_enabled: false,
  original_options: "", managed_options: ""
};

export function validateLaunchProfile(profile: LaunchProfile): void {
  if (!profile.trainer_enabled) return;
  if (!profile.trainer_path) throw new Error("executable_required");
  if (!profile.trainer_path.startsWith("/")
    || !/\.(?:exe|bat)$/i.test(profile.trainer_path)
    || /[\x00\r\n"']/.test(profile.trainer_path)) {
    throw new Error("invalid_executable_path");
  }
}

/**
 * Preserve manual Steam changes as the new baseline. This makes a manually
 * cleared launch-option field safe to configure again without reusing stale
 * DeckRecall-managed text.
 */
export function rebaseLaunchProfile(currentOptions: string, profile: LaunchProfile): LaunchProfile {
  const originalOptions = profile.managed_options && currentOptions === profile.managed_options
    ? profile.original_options
    : currentOptions;
  return { ...profile, original_options: originalOptions, managed_options: "" };
}

/** Compose CheatDeck-compatible layers without rewriting the user's original options. */
export function buildLaunchOptions(original: string, profile: LaunchProfile): string {
  validateLaunchProfile(profile);
  const environment: string[] = [];
  const prefixes: string[] = [];
  if (profile.trainer_enabled) {
    const directory = profile.trainer_path.replace(/\/[^/]+$/, "");
    environment.push(`PROTON_REMOTE_DEBUG_CMD="'${profile.trainer_path}'"`);
    environment.push(`PRESSURE_VESSEL_FILESYSTEMS_RW="${directory}"`);
  }
  if (profile.lsfg_enabled) prefixes.push("~/lsfg");
  if (profile.fsr4_uninstall_enabled) {
    prefixes.push("~/fgmod/fgmod-uninstaller.sh");
  } else if (profile.fsr4_enabled) {
    prefixes.push("~/fgmod/fgmod");
  }
  if (!environment.length && !prefixes.length && !profile.skip_launcher_enabled) return original.trim();
  const base = original.trim();
  const skipLauncher = profile.skip_launcher_enabled && !/(?:^|\s)--skip-launcher(?:\s|$)/.test(base) ? " --skip-launcher" : "";
  const command = base.includes("%command%")
    ? (prefixes.length ? base.replace("%command%", `${prefixes.join(" -- ")} %command%`) : base)
    : `${prefixes.length ? `${prefixes.join(" -- ")} ` : ""}%command%${base ? ` ${base}` : ""}`;
  return `${environment.join(" ")}${environment.length ? " " : ""}${command}${skipLauncher}`;
}
