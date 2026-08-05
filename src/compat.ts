export type CompatTool = { strToolName: string; strDisplayName: string };
export type CompatToolFamily = "experimental" | "proton10" | "ge";

export const PROTON_EXPERIMENTAL_APP_ID = 1493710;
export const PROTON_10_APP_ID = 3658110;
export const BUILTIN_COMPAT_TOOLS: CompatTool[] = [
  { strToolName: "proton_experimental", strDisplayName: "Proton Experimental" },
  { strToolName: "proton_10", strDisplayName: "Proton 10.0-4" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeCompatTools(value: unknown): CompatTool[] {
  const items = Array.isArray(value) ? value
    : isRecord(value) && Array.isArray(value.rgTools) ? value.rgTools
    : isRecord(value) && Array.isArray(value.tools) ? value.tools
    : isRecord(value) && Array.isArray(value.compatTools) ? value.compatTools
    : isRecord(value) && Array.isArray(value.compat_tools) ? value.compat_tools
    : [];
  const seen = new Set<string>();
  return items.filter((tool): tool is CompatTool => {
    if (!isRecord(tool) || typeof tool.strToolName !== "string" || typeof tool.strDisplayName !== "string" || !tool.strToolName) return false;
    if (seen.has(tool.strToolName)) return false;
    seen.add(tool.strToolName);
    return true;
  });
}

export function mergeCompatTools(...groups: CompatTool[][]): CompatTool[] {
  return normalizeCompatTools(groups.flat());
}

export function compatToolFamily(tool: CompatTool): CompatToolFamily | undefined {
  const identity = `${tool.strToolName} ${tool.strDisplayName}`.toLowerCase();
  if (identity.includes("proton experimental") || identity.includes("proton_experimental")) return "experimental";
  if (/proton[^\d]*10(?:\.0)?[- ._]?4/.test(identity) || identity.includes("proton_10")) return "proton10";
  if (identity.includes("ge-proton") || identity.includes("proton-ge") || identity.includes("ge_proton")) return "ge";
  return undefined;
}

export function isRecommendedCompatTool(tool: CompatTool): boolean {
  return compatToolFamily(tool) !== undefined;
}
