export type MemorySwap = {
  name: string;
  type: string;
  size_kib: number | undefined;
  used_kib: number | undefined;
  priority: number | undefined;
};

export type MemoryManaged = {
  main_swap_complete: boolean;
  fallback_swap_complete: boolean;
  zram_config: boolean;
  sysctl_config: boolean;
  main_unit: boolean;
  fallback_unit: boolean;
};

export type MemoryStatus = {
  steamos: boolean;
  device: { family: "steam_deck" | "rog_ally" | "other"; name: string; supported: boolean; profile: string };
  root: boolean;
  recommended_swap_gib: number | undefined;
  swappiness: number | undefined;
  swaps: MemorySwap[];
  zram_count: number;
  space_kib: number | undefined;
  required_kib: number | undefined;
  power_ok: boolean | undefined;
  managed: MemoryManaged;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeSwap(value: unknown): MemorySwap | undefined {
  if (!isRecord(value) || typeof value.name !== "string" || typeof value.type !== "string") return undefined;
  return {
    name: value.name,
    type: value.type,
    size_kib: asNumber(value.size_kib),
    used_kib: asNumber(value.used_kib),
    priority: asNumber(value.priority),
  };
}

export function normalizeMemoryStatus(value: unknown): MemoryStatus | undefined {
  if (!isRecord(value)) return undefined;
  const managed = isRecord(value.managed) ? value.managed : {};
  return {
    steamos: value.steamos === true,
    device: isRecord(value.device) ? {
      family: value.device.family === "steam_deck" || value.device.family === "rog_ally" ? value.device.family : "other",
      name: typeof value.device.name === "string" ? value.device.name : "Unknown",
      supported: value.device.supported === true,
      profile: typeof value.device.profile === "string" ? value.device.profile : "unsupported",
    } : { family: "other", name: "Unknown", supported: false, profile: "unsupported" },
    root: value.root === true,
    recommended_swap_gib: asNumber(value.recommended_swap_gib),
    swappiness: asNumber(value.swappiness),
    swaps: Array.isArray(value.swaps) ? value.swaps.map(normalizeSwap).filter((swap): swap is MemorySwap => !!swap) : [],
    zram_count: asNumber(value.zram_count) ?? 0,
    space_kib: asNumber(value.space_kib),
    required_kib: asNumber(value.required_kib),
    power_ok: asBoolean(value.power_ok),
    managed: {
      main_swap_complete: managed.main_swap_complete === true,
      fallback_swap_complete: managed.fallback_swap_complete === true,
      zram_config: managed.zram_config === true,
      sysctl_config: managed.sysctl_config === true,
      main_unit: managed.main_unit === true,
      fallback_unit: managed.fallback_unit === true,
    },
  };
}

export function memoryTuningConfigured(status: MemoryStatus | undefined): boolean {
  return !!status && Object.values(status.managed).some(Boolean);
}
