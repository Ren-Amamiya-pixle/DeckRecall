export function booleanLike(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (["true", "running", "1", "yes"].includes(normalized)) return true;
    if (["false", "stopped", "0", "no", "none"].includes(normalized)) return false;
  }
  if (value && typeof value === "object") {
    for (const key of ["running", "bRunning", "isRunning", "bIsRunning", "result"]) {
      if (key in value) {
        const nested = booleanLike((value as Record<string, unknown>)[key]);
        if (typeof nested === "boolean") return nested;
      }
    }
  }
  return undefined;
}

export function runningFromObject(value: any): boolean | undefined {
  if (!value) return undefined;
  for (const methodName of ["BIsRunning", "BIsAppRunning", "BIsPlaying", "IsRunning", "IsAppRunning", "GetIsRunning"]) {
    try {
      if (typeof value[methodName] === "function") {
        const result = booleanLike(value[methodName].call(value));
        if (typeof result === "boolean") return result;
      }
    } catch {
      // Try the next SteamUI method.
    }
  }
  for (const fieldName of ["bRunning", "m_bRunning", "isRunning", "running", "bIsRunning", "m_bIsRunning", "bPlaying", "m_bPlaying", "nRunning"]) {
    if (fieldName in value) {
      const result = booleanLike(value[fieldName]);
      if (typeof result === "boolean") return result;
    }
  }
  return undefined;
}

export function runningFromList(value: unknown, appId: number): boolean | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.some((item: any) => Number(item?.appid ?? item?.app_id ?? item?.unAppID ?? item?.nAppID ?? item) === appId);
}

async function safeMethod(owner: any, methodName: string, appId: number): Promise<boolean | undefined> {
  try {
    if (typeof owner?.[methodName] !== "function") return undefined;
    const value = owner[methodName].call(owner, appId);
    return booleanLike(value && typeof value.then === "function" ? await value : value);
  } catch {
    return undefined;
  }
}

async function safeList(owner: any, methodName: string, appId: number): Promise<boolean | undefined> {
  try {
    if (typeof owner?.[methodName] !== "function") return undefined;
    const value = owner[methodName].call(owner);
    return runningFromList(value && typeof value.then === "function" ? await value : value, appId);
  } catch {
    return undefined;
  }
}

export async function readAppRunningState(appId: number): Promise<boolean | undefined> {
  const steam = globalThis as any;
  const appStore = steam.appStore;
  const apps = steam.SteamClient?.Apps;
  for (const methodName of ["BIsAppRunning", "IsAppRunning", "GetAppRunning", "GetAppRunState"]) {
    const storeResult = await safeMethod(appStore, methodName, appId);
    if (typeof storeResult === "boolean") return storeResult;
    const clientResult = await safeMethod(apps, methodName, appId);
    if (typeof clientResult === "boolean") return clientResult;
  }
  for (const methodName of ["GetRunningAppIDs", "GetRunningApps", "GetRunningAppIds", "GetRunningAppIDList"]) {
    const storeResult = await safeList(appStore, methodName, appId);
    if (typeof storeResult === "boolean") return storeResult;
    const clientResult = await safeList(apps, methodName, appId);
    if (typeof clientResult === "boolean") return clientResult;
    const sessionResult = await safeList(steam.SteamClient?.GameSessions, methodName, appId);
    if (typeof sessionResult === "boolean") return sessionResult;
  }
  try {
    const overview = appStore?.GetAppOverviewByAppID?.(appId);
    const overviewResult = runningFromObject(overview);
    if (typeof overviewResult === "boolean") return overviewResult;
    const appData = steam.appDetailsStore?.GetAppData?.(appId);
    for (const candidate of [appData, appData?.details, appData?.overview, appData?.appinfo, appData?.appInfo]) {
      const result = runningFromObject(candidate);
      if (typeof result === "boolean") return result;
    }
  } catch {
    return undefined;
  }
  return undefined;
}
