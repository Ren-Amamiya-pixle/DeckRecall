export const ERROR_CODES = [
  "backend_error", "unknown_error", "invalid_app_id", "snapshot_not_found",
  "snapshot_integrity_failed", "undo_not_found", "file_too_large",
  "invalid_launch_profile", "invalid_executable_path", "executable_required",
  "invalid_launch_options", "launch_options_changed", "steam_root_not_found",
  "trainer_search_invalid", "trainer_search_failed", "trainer_not_found",
  "trainer_download_unavailable", "trainer_download_failed", "trainer_download_too_large",
  "trainer_download_invalid", "trainer_documents_unavailable", "trainer_compat_invalid",
  "protontricks_not_installed", "protontricks_launch_failed", "ge_proton_release_unavailable",
  "ge_proton_release_invalid", "ge_proton_download_failed", "ge_proton_download_too_large",
  "ge_proton_checksum_missing", "ge_proton_checksum_failed", "ge_proton_archive_invalid",
  "ge_proton_archive_too_large", "ge_proton_owner_failed", "plugin_install_invalid",
  "plugin_install_bundled_missing", "plugin_install_download_failed",
  "plugin_install_checksum_failed", "plugin_install_archive_invalid", "plugin_install_too_large",
  "plugin_install_owner_failed", "self_update_installed_version_invalid",
  "self_update_release_unavailable", "self_update_release_invalid", "self_update_download_failed",
  "self_update_checksum_failed", "self_update_archive_invalid", "self_update_version_mismatch",
  "self_update_target_invalid", "self_update_too_large", "self_update_install_failed",
  "memory_steamos_required", "memory_device_unsupported", "memory_root_required",
  "memory_command_missing", "memory_read_failed", "memory_backend_unavailable",
  "memory_path_invalid", "memory_space_insufficient", "memory_battery_low",
  "memory_config_conflict", "memory_swap_create_failed", "memory_swap_unit_failed",
  "memory_apply_failed", "memory_restore_failed",
] as const;

const ERROR_FIELDS = ["code", "error", "message", "detail", "reason", "data", "cause"] as const;

function errorStrings(value: unknown, seen: Set<unknown>, depth: number): string[] {
  if (depth > 6 || value === null || value === undefined) return [];
  if (typeof value === "string") return [value];
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (seen.has(value)) return [];
  seen.add(value);
  if (value instanceof Error) return [value.message, ...errorStrings(value.cause, seen, depth + 1)];
  if (Array.isArray(value)) return value.flatMap((item) => errorStrings(item, seen, depth + 1));
  if (typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  return ERROR_FIELDS.flatMap((field) => errorStrings(record[field], seen, depth + 1));
}

export function normalizeError(error: unknown): string {
  const messages = errorStrings(error, new Set(), 0);
  for (const message of messages) {
    const code = ERROR_CODES.find((candidate) => message.includes(candidate));
    if (code) return code;
  }
  return "unknown_error";
}
