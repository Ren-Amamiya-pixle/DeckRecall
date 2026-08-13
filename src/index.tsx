import { addEventListener, callable, FileSelectionType, openFilePicker, removeEventListener, routerHook, toaster } from "@decky/api";
import {
  ButtonItem,
  definePlugin,
  DropdownItem,
  Focusable,
  Navigation,
  PanelSection,
  PanelSectionRow,
  SidebarNavigation,
  staticClasses,
  ToggleField,
  useParams,
} from "@decky/ui";
import { Component, ErrorInfo, ReactNode, useEffect, useMemo, useState } from "react";
import { FaFolderOpen, FaHistory } from "react-icons/fa";
import {
  CompatTool,
  BUILTIN_COMPAT_TOOLS,
  isRecommendedCompatTool,
  mergeCompatTools,
  normalizeCompatTools,
  PROTON_10_APP_ID,
  PROTON_EXPERIMENTAL_APP_ID,
} from "./compat";
import { installGameContextMenuPatch } from "./contextMenuPatch";
import { normalizeError } from "./errors";
import {
  cleanExeName,
  createGameShortcut,
  createInstallerShortcut,
  ExeInstallCandidate,
  exeSelectionPath,
  folderSelectionPath,
  finalizeInstallerShortcut,
  launchInstaller,
} from "./exeInstall";
import { Language, resolveLanguage, translate } from "./i18n";
import { buildLaunchOptions, EMPTY_PROFILE, LaunchProfile, rebaseLaunchProfile } from "./launch";
import { MemoryStatus, memoryTuningConfigured, normalizeMemoryStatus } from "./memory";
import { readAppRunningState } from "./running";

type Game = { id: string; name: string };
type Change = { code: string; path: string };
type Diagnostic = { app_id: string; baseline_exists: boolean; status: string; changes: Change[] };
type Snapshot = { id: string; created_at: string; game_name: string };
type ActivityEvent = { at: string; code: string };
type CreateResult = { ok: boolean; snapshot: Snapshot; diagnostics: Diagnostic };
type RestoreResult = { ok: boolean; undo_id: string; diagnostics: Diagnostic };
type GeProtonResult = { ok: boolean; version: string; source: string };
type DeckRecallUpdateStatus = { installed_version: string; latest_version: string; update_available: boolean };
type DeckRecallUpdateResult = DeckRecallUpdateStatus & { ok: boolean; updated: boolean; restart_required?: boolean };
type DownloadProgress = { phase: string; percent: number };
type DownloadJob = DownloadProgress & {
  job_id: string;
  target: string;
  status: "queued" | "running" | "done" | "failed";
  error: string;
};
type TrainerDownload = { url: string; title: string; directory: string };
type TrainerSaved = { path: string; title: string; directory: string };
type TrainerCompatVersion = "GE-Proton7-55" | "GE-Proton8-25" | "GE-Proton9-27" | "GE-Proton10-29";
type ExeGameFolder = { id: string; name: string; location: string };
type AppDetails = { strLaunchOptions: string; strCompatToolName: string; strCompatToolDisplayName: string };

const getDiagnostics = callable<[appId: string], Diagnostic>("get_diagnostics");
const createSnapshot = callable<[appId: string, gameName: string], CreateResult>("create_snapshot");
const listSnapshots = callable<[appId: string], Snapshot[]>("list_snapshots");
const restoreSnapshot = callable<[appId: string, snapshotId: string], RestoreResult>("restore_snapshot");
const undoRestore = callable<[appId: string, undoId: string], { ok: boolean; diagnostics: Diagnostic }>("undo_restore");
const getEvents = callable<[appId: string], ActivityEvent[]>("get_events");
const getLaunchProfile = callable<[appId: string], LaunchProfile>("get_launch_profile");
const saveLaunchProfile = callable<[appId: string, profile: LaunchProfile], LaunchProfile>("save_launch_profile");
const installLatestGeProton = callable<[], GeProtonResult>("install_latest_ge_proton");
const openProtontricks = callable<[appId: string], { ok: boolean }>("open_protontricks");
const prepareTrainerDownload = callable<[gameName: string], TrainerDownload>("prepare_trainer_download");
const downloadTrainerToDocuments = callable<[gameName: string], TrainerSaved>("download_trainer_to_documents");
const startChinesePluginInstall = callable<[pluginId: "lsfg" | "fsr4"], DownloadJob>("start_chinese_plugin_install");
const startTrainerCompatInstall = callable<[version: TrainerCompatVersion], DownloadJob>("start_trainer_compat_install");
const getMemoryStatus = callable<[], MemoryStatus>("get_memory_status");
const applyRecommendedMemory = callable<[], { ok: boolean; profile: string; recommended_swap_gib: number; swap_path: string }>("apply_recommended_memory");
const restoreMemoryTuning = callable<[], { ok: boolean }>("restore_memory_tuning");
const getDeckRecallUpdateStatus = callable<[], DeckRecallUpdateStatus>("get_deckrecall_update_status");
const startDeckRecallUpdate = callable<[], DownloadJob>("start_deckrecall_update");
const getDownloadJobs = callable<[], DownloadJob[]>("get_download_jobs");
const beginExeInstall = callable<[appId: string], { ok: boolean; baseline_count: number }>("begin_exe_install");
const listExeInstallCandidates = callable<[appId: string], { ok: boolean; candidates: ExeInstallCandidate[]; new_count: number }>("list_exe_install_candidates");
const resolveExeInstallCandidate = callable<[appId: string, candidateId: string], { path: string; directory: string; name: string }>("resolve_exe_install_candidate");
const listExeGameFolders = callable<[], { ok: boolean; folders: ExeGameFolder[] }>("list_exe_game_folders");
const listExeGameCandidates = callable<[folderId: string], { ok: boolean; candidates: ExeInstallCandidate[] }>("list_exe_game_candidates");
const resolveExeGameCandidate = callable<[folderId: string, candidateId: string], { path: string; directory: string; name: string }>("resolve_exe_game_candidate");


const GAME_KEY = "deckRecall.lastGame";
const LANGUAGE_KEY = "deckRecall.language";
const AUTO_SNAPSHOT_KEY = "deckRecall.autoSnapshot";

function currentSteamLanguage(): string | undefined {
  try {
    const language = (globalThis as any).SteamClient?.Settings?.GetCurrentLanguage?.();
    return typeof language === "string" ? language : undefined;
  } catch {
    return undefined;
  }
}

function activeGame(): Game | undefined {
  try {
    const steam = globalThis as any;
    const candidates = [steam.SteamUIStore?.MainRunningApp, steam.SteamUIStore?.RunningApps?.[0]];
    const sessions = steam.SteamClient?.GameSessions?.GetRunningApps?.();
    if (Array.isArray(sessions) && sessions.length) {
      const session = sessions[0];
      const sessionId = typeof session === "number" ? session : session?.appid ?? session?.appId ?? session?.unAppID;
      candidates.push(steam.appStore?.GetAppOverviewByAppID?.(Number(sessionId)), session);
    }
    for (const overview of candidates) {
      const id = (overview?.appid ?? overview?.appId ?? overview?.unAppID)?.toString();
      if (id && /^[1-9]\d{0,9}$/.test(id)) {
        const displayName = overview?.display_name ?? overview?.displayName ?? overview?.strDisplayName;
        return { id, name: typeof displayName === "string" && displayName ? displayName : `Steam ${id}` };
      }
    }
  } catch (error) {
    console.warn("[DeckRecall] Active-game detection failed", error);
  }
  return undefined;
}

function gameFromAppId(appId: string): Game | undefined {
  if (!/^[1-9]\d{0,9}$/.test(appId)) return undefined;
  try {
    const overview = (globalThis as any).appStore?.GetAppOverviewByAppID?.(Number(appId));
    const displayName = overview?.display_name ?? overview?.displayName ?? overview?.strDisplayName;
    return { id: appId, name: typeof displayName === "string" && displayName ? displayName : `Steam ${appId}` };
  } catch {
    return { id: appId, name: `Steam ${appId}` };
  }
}

const automaticSnapshotInFlight = new Set<string>();

function installAutomaticSnapshotMonitor(): { unregister?: () => void } {
  const seenRunning = new Set<string>();
  try {
    return (globalThis as any).SteamClient?.GameSessions?.RegisterForAppLifetimeNotifications?.((notification: any) => {
      const appId = String(notification?.unAppID ?? "");
      if (!/^[1-9]\d{0,9}$/.test(appId) || typeof notification?.bRunning !== "boolean") return;
      if (notification.bRunning) {
        seenRunning.add(appId);
        return;
      }
      if (!seenRunning.delete(appId) || storageGet(AUTO_SNAPSHOT_KEY) === "false" || automaticSnapshotInFlight.has(appId)) return;
      const game = gameFromAppId(appId);
      if (!game) return;
      automaticSnapshotInFlight.add(appId);
      void (async () => {
        try {
          const snapshots = normalizeSnapshots(await withTimeout(listSnapshots(appId)));
          if (!snapshots.length) await withTimeout(createSnapshot(appId, game.name));
        } catch (error) {
          console.warn("[DeckRecall] Automatic healthy-state snapshot failed", error);
        } finally {
          automaticSnapshotInFlight.delete(appId);
        }
      })();
    }) ?? {};
  } catch (error) {
    console.warn("[DeckRecall] Automatic snapshot monitor unavailable", error);
    return {};
  }
}

function storageGet(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch (error) {
    console.warn("[DeckRecall] Could not persist UI state", error);
  }
}

function loadLastGame(): Game | undefined {
  try {
    const value = JSON.parse(storageGet(GAME_KEY) || "null");
    return value && /^[1-9]\d{0,9}$/.test(value.id) && typeof value.name === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs = 6000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("backend_error")), timeoutMs);
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error) => { window.clearTimeout(timer); reject(error); },
    );
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeDiagnostic(value: unknown): Diagnostic | undefined {
  if (!isRecord(value)) return undefined;
  const changes = Array.isArray(value.changes)
    ? value.changes.filter((change): change is Change => isRecord(change) && typeof change.code === "string" && typeof change.path === "string")
    : [];
  return {
    app_id: typeof value.app_id === "string" ? value.app_id : "",
    baseline_exists: value.baseline_exists === true,
    status: typeof value.status === "string" ? value.status : "unknown",
    changes,
  };
}

function normalizeSnapshots(value: unknown): Snapshot[] {
  if (!Array.isArray(value)) return [];
  return value.filter((snapshot): snapshot is Snapshot => isRecord(snapshot)
    && typeof snapshot.id === "string"
    && typeof snapshot.created_at === "string"
    && typeof snapshot.game_name === "string");
}

function normalizeEvents(value: unknown): ActivityEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter((event): event is ActivityEvent => isRecord(event)
    && typeof event.at === "string"
    && typeof event.code === "string");
}

function normalizeLaunchProfile(value: unknown): LaunchProfile {
  if (!isRecord(value)) return { ...EMPTY_PROFILE };
  const fsr4UninstallEnabled = value.fsr4_uninstall_enabled === true;
  return {
    trainer_enabled: value.trainer_enabled === true,
    trainer_path: typeof value.trainer_path === "string" ? value.trainer_path : "",
    lsfg_enabled: value.lsfg_enabled === true,
    fsr4_enabled: fsr4UninstallEnabled ? false : value.fsr4_enabled === true,
    fsr4_uninstall_enabled: fsr4UninstallEnabled,
    skip_launcher_enabled: value.skip_launcher_enabled === true,
    original_options: typeof value.original_options === "string" ? value.original_options : "",
    managed_options: typeof value.managed_options === "string" ? value.managed_options : "",
  };
}

function launchProfileKey(appId: string): string {
  return `deckRecall.launchProfile.${appId}`;
}

function loadLocalLaunchProfile(appId: string): LaunchProfile {
  try {
    return normalizeLaunchProfile(JSON.parse(storageGet(launchProfileKey(appId)) || "null"));
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

function saveLocalLaunchProfile(appId: string, profile: LaunchProfile): void {
  storageSet(launchProfileKey(appId), JSON.stringify(profile));
}

function readAppDetails(appId: string): Promise<AppDetails> {
  return new Promise((resolve, reject) => {
    let registration: { unregister(): void } | undefined;
    const timeout = window.setTimeout(() => {
      registration?.unregister();
      reject(new Error("backend_error"));
    }, 3000);
    const finish = (details: any) => {
      window.clearTimeout(timeout);
      registration?.unregister();
      resolve({
        strLaunchOptions: typeof details?.strLaunchOptions === "string" ? details.strLaunchOptions : "",
        strCompatToolName: typeof details?.strCompatToolName === "string" ? details.strCompatToolName : "",
        strCompatToolDisplayName: typeof details?.strCompatToolDisplayName === "string" ? details.strCompatToolDisplayName : "",
      });
    };
    try {
      const apps = (globalThis as any).SteamClient?.Apps;
      if (typeof apps?.RegisterForAppDetails !== "function") throw new Error("backend_error");
      registration = apps.RegisterForAppDetails(Number(appId), (details: any) => {
        if (details && typeof details === "object") finish(details);
      });
    } catch (error) {
      window.clearTimeout(timeout);
      reject(error);
    }
  });
}

async function readLaunchOptions(appId: string): Promise<string> {
  return (await readAppDetails(appId)).strLaunchOptions;
}

async function chooseExecutable(startPath: string): Promise<string | undefined> {
  let result: { path?: string; realpath?: string };
  try {
    result = await openFilePicker(
      FileSelectionType.FILE,
      startPath || "/home/deck/Documents",
      true,
      true,
      undefined,
      undefined,
      false,
      true,
    );
  } catch {
    return undefined;
  }
  const path = typeof result?.path === "string" ? result.path : typeof result?.realpath === "string" ? result.realpath : "";
  if (!/\.(?:exe|bat)$/i.test(path)) throw new Error("invalid_executable_path");
  return path;
}

function openOfficialProtonInstaller(appIds: number[]): void | Promise<unknown> {
  const installs = (globalThis as any).SteamClient?.Installs;
  if (typeof installs?.OpenInstallWizard !== "function") throw new Error("backend_error");
  return installs.OpenInstallWizard(appIds);
}

const pendingOfficialProtonInstalls = new Set<number>();
let officialProtonInstallTimer: number | undefined;
let officialProtonInstallWaiters: Array<{ resolve: () => void; reject: (error: unknown) => void }> = [];

/** Steam accepts one installer dialog at a time. Batch rapid taps into one dialog. */
function queueOfficialProtonInstaller(appId: number): Promise<void> {
  pendingOfficialProtonInstalls.add(appId);
  return new Promise((resolve, reject) => {
    officialProtonInstallWaiters.push({ resolve, reject });
    if (officialProtonInstallTimer !== undefined) window.clearTimeout(officialProtonInstallTimer);
    officialProtonInstallTimer = window.setTimeout(() => {
      const appIds = [...pendingOfficialProtonInstalls];
      const waiters = officialProtonInstallWaiters;
      pendingOfficialProtonInstalls.clear();
      officialProtonInstallWaiters = [];
      officialProtonInstallTimer = undefined;
      Promise.resolve().then(() => openOfficialProtonInstaller(appIds)).then(
        () => waiters.forEach((waiter) => waiter.resolve()),
        (error) => waiters.forEach((waiter) => waiter.reject(error)),
      );
    }, 650);
  });
}

function MemoryTuningPanel({ t }: { t: (key: string, values?: Record<string, string>) => string }) {
  const [status, setStatus] = useState<MemoryStatus>();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [memoryError, setMemoryError] = useState("");

  const refreshMemory = async (silent = false) => {
    if (!silent) setBusy(true);
    setMemoryError("");
    try {
      setStatus(normalizeMemoryStatus(await withTimeout(getMemoryStatus(), 8000)));
    } catch (nextError) {
      setMemoryError(t(normalizeError(nextError)));
    } finally {
      if (!silent) setBusy(false);
    }
  };

  useEffect(() => {
    void refreshMemory(true);
  }, []);

  const applyMemory = async () => {
    setBusy(true);
    setMemoryError("");
    setFeedback("");
    try {
      const result = await withTimeout(applyRecommendedMemory(), 180000);
      setFeedback(result.profile === "bazzite_ally"
        ? t("memoryOptimizedRogAlly")
        : t("memoryOptimized", { size: String(result.recommended_swap_gib) }));
      await refreshMemory(true);
    } catch (nextError) {
      setMemoryError(t(normalizeError(nextError)));
    } finally {
      setBusy(false);
    }
  };

  const restoreMemory = async () => {
    setBusy(true);
    setMemoryError("");
    setFeedback("");
    try {
      await withTimeout(restoreMemoryTuning(), 60000);
      setFeedback(t("memoryRestored"));
      await refreshMemory(true);
    } catch (nextError) {
      setMemoryError(t(normalizeError(nextError)));
    } finally {
      setBusy(false);
    }
  };

  const ready = status?.device.supported === true && status?.root === true;
  const configured = memoryTuningConfigured(status);
  return <PanelSection title={t("virtualMemory")}>
    <PanelSectionRow>
      <ButtonItem layout="below" disabled={busy} onClick={() => void refreshMemory()}>{t("refresh")}</ButtonItem>
    </PanelSectionRow>
    {!status && !memoryError ? <PanelSectionRow>{t("memoryStatusUnknown")}</PanelSectionRow> : null}
    {status ? <>
      <PanelSectionRow><div>{t("memoryDetectedDevice", { name: status.device.name })}</div></PanelSectionRow>
      {!status.device.supported && <PanelSectionRow>{t("memoryNotSupported")}</PanelSectionRow>}
      {status.device.supported && !status.root && <PanelSectionRow>{t("memoryRootRequired")}</PanelSectionRow>}
      {status.device.family === "steam_deck" && <PanelSectionRow>{t("memorySteamDeckPlan")}</PanelSectionRow>}
      {status.device.family === "rog_ally" && <PanelSectionRow>{t("memoryRogAllyPlan")}</PanelSectionRow>}
      {status.recommended_swap_gib !== undefined && <PanelSectionRow><div>{t("recommendedSwap", { size: String(status.recommended_swap_gib) })}</div></PanelSectionRow>}
      {status.swappiness !== undefined && <PanelSectionRow><div>{t("currentSwappiness", { value: String(status.swappiness) })}</div></PanelSectionRow>}
      <PanelSectionRow><div>{t("activeSwapCount", { count: String(status.swaps.length) })} · {t("zramCount", { count: String(status.zram_count) })}</div></PanelSectionRow>
      {status.space_kib !== undefined && status.required_kib !== undefined && status.space_kib < status.required_kib && <PanelSectionRow>{t("memorySpaceInsufficient")}</PanelSectionRow>}
      {status.power_ok === false && <PanelSectionRow>{t("memoryBatteryLow")}</PanelSectionRow>}
      <PanelSectionRow>{configured ? t("memoryConfigured") : t("memoryNotConfigured")}</PanelSectionRow>
    </> : null}
    <PanelSectionRow>
      <ButtonItem layout="below" disabled={busy || !ready} onClick={() => void applyMemory()}>{busy ? t("memoryApplying") : t("applyRecommendedMemory")}</ButtonItem>
    </PanelSectionRow>
    <PanelSectionRow>
      <ButtonItem layout="below" disabled={busy || !ready} onClick={() => void restoreMemory()}>{busy ? t("memoryRestoring") : t("restoreMemoryTuning")}</ButtonItem>
    </PanelSectionRow>
    {feedback && <PanelSectionRow><div style={{ color: "#7dd3fc", fontWeight: 600 }}>{feedback}</div></PanelSectionRow>}
    {memoryError && <PanelSectionRow><div style={{ color: "#f5d547", fontWeight: 600 }}>{memoryError}</div></PanelSectionRow>}
  </PanelSection>;
}

function GameContent({ appId }: { appId: string }) {
  const savedLanguage = storageGet(LANGUAGE_KEY);
  const initialLanguage: Language = savedLanguage === "en-US" || savedLanguage === "zh-CN" ? savedLanguage : "system";
  const [preference, setPreference] = useState<Language>(initialLanguage);
  const language = useMemo(() => resolveLanguage(preference, currentSteamLanguage()), [preference]);
  const t = (key: string, values?: Record<string, string>) => translate(language, key, values);
  const selectedGame = gameFromAppId(appId);
  const [game, setGame] = useState<Game | undefined>(selectedGame);
  const [running, setRunning] = useState(false);
  const [diagnostic, setDiagnostic] = useState<Diagnostic>();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [undoId, setUndoId] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [launchProfile, setLaunchProfile] = useState<LaunchProfile>(() => loadLocalLaunchProfile(appId));
  const [compatTools, setCompatTools] = useState<CompatTool[]>(BUILTIN_COMPAT_TOOLS);
  const [selectedCompatTool, setSelectedCompatTool] = useState("");
  const [currentCompatDisplayName, setCurrentCompatDisplayName] = useState("");
  const [compatToolsLoaded, setCompatToolsLoaded] = useState(false);
  const [officialInstallerOpened, setOfficialInstallerOpened] = useState<string>();
  const [installingGe, setInstallingGe] = useState(false);
  const [geStatus, setGeStatus] = useState("");
  const [trainerDownloadStatus, setTrainerDownloadStatus] = useState("");
  const [downloadingTrainer, setDownloadingTrainer] = useState(false);
  const [requestingPluginInstall, setRequestingPluginInstall] = useState<"lsfg" | "fsr4">();
  const [pluginInstallStatus, setPluginInstallStatus] = useState("");
  const [pluginInstallProgress, setPluginInstallProgress] = useState<{ phase: string; percent: number }>();
  const [showTrainerCompat, setShowTrainerCompat] = useState(false);
  const [installingTrainerCompat, setInstallingTrainerCompat] = useState<TrainerCompatVersion>();
  const [trainerCompatProgress, setTrainerCompatProgress] = useState<Record<string, { phase: string; percent: number }>>({});
  const [trainerCompatStatus, setTrainerCompatStatus] = useState("");
  const [downloadJobs, setDownloadJobs] = useState<DownloadJob[]>([]);
  const [launchPreview, setLaunchPreview] = useState("");
  const [autoSnapshot, setAutoSnapshot] = useState(() => storageGet(AUTO_SNAPSHOT_KEY) !== "false");

  const refresh = async () => {
    setBusy(true);
    setError(undefined);
    const selected = gameFromAppId(appId);
    if (selected) {
      setGame(selected);
      storageSet(GAME_KEY, JSON.stringify(selected));
    }
    if (!selected) {
      setGame(undefined);
      setDiagnostic(undefined);
      setSnapshots([]);
      setEvents([]);
      setLaunchProfile({ ...EMPTY_PROFILE });
      setCompatTools([]);
      setSelectedCompatTool("");
      setCurrentCompatDisplayName("");
      setCompatToolsLoaded(false);
      setBusy(false);
      return;
    }
    try {
      const liveRunning = await withTimeout(readAppRunningState(Number(selected.id)), 2000).catch(() => undefined);
      setRunning(liveRunning === true);
      const [diagnosticResult, snapshotsResult, eventsResult, profileResult] = await Promise.allSettled([
        withTimeout(getDiagnostics(selected.id)),
        withTimeout(listSnapshots(selected.id)),
        withTimeout(getEvents(selected.id)),
        withTimeout(getLaunchProfile(selected.id)),
      ]);
      if (diagnosticResult.status === "fulfilled") setDiagnostic(normalizeDiagnostic(diagnosticResult.value));
      if (snapshotsResult.status === "fulfilled") setSnapshots(normalizeSnapshots(snapshotsResult.value));
      if (eventsResult.status === "fulfilled") setEvents(normalizeEvents(eventsResult.value));
      if (profileResult.status === "fulfilled" && isRecord(profileResult.value)) {
        const profile = normalizeLaunchProfile(profileResult.value);
        setLaunchProfile(profile);
        saveLocalLaunchProfile(selected.id, profile);
      } else {
        setLaunchProfile(loadLocalLaunchProfile(selected.id));
      }
      try {
        const apps = (globalThis as any).SteamClient?.Apps;
        const [tools, details] = await withTimeout(Promise.all([
          typeof apps?.GetAvailableCompatTools === "function" ? apps.GetAvailableCompatTools(Number(selected.id)) : Promise.resolve([]),
          readAppDetails(selected.id),
        ]), 4000);
        setCompatTools(mergeCompatTools(BUILTIN_COMPAT_TOOLS, normalizeCompatTools(tools)));
        setCompatToolsLoaded(true);
        setSelectedCompatTool(details.strCompatToolName);
        setCurrentCompatDisplayName(details.strCompatToolDisplayName);
      } catch (compatError) {
        console.warn("[DeckRecall] Could not read compatibility tools", compatError);
        setCompatTools([]);
        setCompatToolsLoaded(false);
      }
      const failedBackendReads = [diagnosticResult, snapshotsResult, eventsResult, profileResult]
        .filter((result) => result.status === "rejected").length;
      // A background read must not leave a frightening permanent error at the
      // bottom of the page. Direct snapshot/restore operations still surface
      // their own errors when the user explicitly invokes them.
      if (failedBackendReads) console.warn("[DeckRecall] Some background backend reads failed", failedBackendReads);
    } catch (nextError) {
      setError(normalizeError(nextError));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
    try {
      const registration = (globalThis as any).SteamClient?.GameSessions?.RegisterForAppLifetimeNotifications?.((notification: any) => {
        if (Number(notification?.unAppID) === Number(appId) && typeof notification?.bRunning === "boolean") {
          setRunning(notification.bRunning);
        }
      });
      return () => registration?.unregister?.();
    } catch {
      return undefined;
    }
  }, [appId]);

  const action = async <T,>(operation: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(undefined);
    try {
      return await operation();
    } catch (nextError) {
      setError(normalizeError(nextError));
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const refreshAfter = async <T,>(operation: () => Promise<T>): Promise<T | undefined> => {
    const result = await action(operation);
    await refresh();
    return result;
  };

  const applyLaunchProfile = async () => {
    if (!game) return;
    await action(async () => {
      const currentOptions = await readLaunchOptions(game.id);
      const proposed = rebaseLaunchProfile(currentOptions, launchProfile);
      const managedOptions = buildLaunchOptions(proposed.original_options, proposed);
      const saved = { ...proposed, managed_options: managedOptions };
      const apps = (globalThis as any).SteamClient?.Apps;
      if (typeof apps?.SetAppLaunchOptions !== "function") throw new Error("backend_error");
      await Promise.resolve(apps.SetAppLaunchOptions(Number(game.id), managedOptions));
      saveLocalLaunchProfile(game.id, saved);
      try { await withTimeout(saveLaunchProfile(game.id, saved)); }
      catch (profileError) { console.warn("[DeckRecall] Launch profile saved locally only", profileError); }
      setLaunchProfile(saved);
    });
  };

  const previewLaunchProfile = async () => {
    if (!game) return;
    await action(async () => {
      const currentOptions = await readLaunchOptions(game.id);
      const proposed = rebaseLaunchProfile(currentOptions, launchProfile);
      setLaunchPreview(buildLaunchOptions(proposed.original_options, proposed));
    });
  };

  const restoreLaunchOptions = async () => {
    if (!game || !launchProfile.managed_options) return;
    await action(async () => {
      const currentOptions = await readLaunchOptions(game.id);
      if (currentOptions !== launchProfile.managed_options) {
        const externallyChanged = { ...launchProfile, trainer_enabled: false, lsfg_enabled: false, fsr4_enabled: false, fsr4_uninstall_enabled: false, skip_launcher_enabled: false, original_options: "", managed_options: "" };
        saveLocalLaunchProfile(game.id, externallyChanged);
        try { await withTimeout(saveLaunchProfile(game.id, externallyChanged)); }
        catch (profileError) { console.warn("[DeckRecall] Externally changed profile saved locally only", profileError); }
        setLaunchProfile(externallyChanged);
        return;
      }
      const apps = (globalThis as any).SteamClient?.Apps;
      if (typeof apps?.SetAppLaunchOptions !== "function") throw new Error("backend_error");
      await Promise.resolve(apps.SetAppLaunchOptions(Number(game.id), launchProfile.original_options));
      const restored = { ...launchProfile, trainer_enabled: false, lsfg_enabled: false, fsr4_enabled: false, fsr4_uninstall_enabled: false, skip_launcher_enabled: false, original_options: "", managed_options: "" };
      saveLocalLaunchProfile(game.id, restored);
      try { await withTimeout(saveLaunchProfile(game.id, restored)); }
      catch (profileError) { console.warn("[DeckRecall] Restored profile saved locally only", profileError); }
      setLaunchProfile(restored);
    });
  };

  const applyCompatTool = async () => {
    if (!game) return;
    await action(async () => {
      const apps = (globalThis as any).SteamClient?.Apps;
      if (typeof apps?.SpecifyCompatTool !== "function") throw new Error("backend_error");
      await Promise.resolve(apps.SpecifyCompatTool(Number(game.id), selectedCompatTool));
      const selected = compatTools.find((tool) => tool.strToolName === selectedCompatTool);
      setCurrentCompatDisplayName(selected?.strDisplayName || "");
    });
  };

  const requestOfficialProtonInstall = async (toolAppId: number, toolName: string) => {
    try {
      await queueOfficialProtonInstaller(toolAppId);
      setOfficialInstallerOpened(toolName);
      toaster.toast({
        title: "DeckRecall",
        body: t("officialInstallerOpened", { tool: toolName }),
        duration: 4000,
        showToast: true,
      });
    } catch (nextError) {
      setError(normalizeError(nextError));
    }
  };

  const installGeProton = async () => {
    setInstallingGe(true);
    setGeStatus("");
    try {
      const result = await installLatestGeProton();
      setGeStatus(t("geProtonInstalled", { version: result.version }));
    } catch (nextError) {
      setGeStatus(t(normalizeError(nextError)));
    } finally {
      setInstallingGe(false);
    }
  };

  const requestDeckyPluginInstall = async (kind: "lsfg" | "fsr4") => {
    setRequestingPluginInstall(kind);
    setPluginInstallStatus("");
    setPluginInstallProgress({ phase: "plugin_download_phase", percent: 0 });
    try {
      await startChinesePluginInstall(kind);
      setDownloadJobs(await getDownloadJobs());
    } catch (nextError) {
      console.warn("[DeckRecall] Could not install Chinese plugin", nextError);
      setPluginInstallStatus(t(normalizeError(nextError)));
      setRequestingPluginInstall(undefined);
    }
  };

  const downloadLatestTrainer = async () => {
    if (!game) return;
    setDownloadingTrainer(true);
    setTrainerDownloadStatus(t("trainerSearching"));
    setError(undefined);
    try {
      const result = await withTimeout(prepareTrainerDownload(game.name), 45000);
      const browser = (globalThis as any).SteamClient?.Browser;
      if (typeof browser?.StartDownload !== "function") throw new Error("trainer_download_unavailable");
      browser.StartDownload(result.url);
      try {
        const saved = await withTimeout(downloadTrainerToDocuments(game.name), 180000);
        setLaunchProfile({ ...launchProfile, trainer_path: saved.path });
        setTrainerDownloadStatus(t("trainerDownloadSaved", { title: saved.title, directory: saved.directory }));
      } catch (fallbackError) {
        setTrainerDownloadStatus(t("trainerDownloadStartedFallbackFailed", { title: result.title, error: t(normalizeError(fallbackError)) }));
      }
    } catch (nextError) {
      const code = normalizeError(nextError);
      setTrainerDownloadStatus(t(code));
    } finally {
      setDownloadingTrainer(false);
    }
  };

  const installOneTrainerCompat = async (version: TrainerCompatVersion) => {
    setInstallingTrainerCompat(version);
    setTrainerCompatStatus("");
    setTrainerCompatProgress((current) => ({ ...current, [version]: { phase: "compat_download_phase", percent: 0 } }));
    try {
      await startTrainerCompatInstall(version);
      setDownloadJobs(await getDownloadJobs());
    } catch (nextError) {
      setTrainerCompatStatus(t(normalizeError(nextError)));
      setInstallingTrainerCompat(undefined);
    }
  };

  useEffect(() => {
    void getDownloadJobs().then(setDownloadJobs).catch((nextError) => {
      console.warn("[DeckRecall] Could not hydrate download queue", nextError);
    });
    const listener = addEventListener<[jobs: DownloadJob[]]>("download_jobs_changed", setDownloadJobs);
    return () => removeEventListener("download_jobs_changed", listener);
  }, []);

  useEffect(() => {
    const activePlugin = [...downloadJobs].reverse().find((job) =>
      job.target.startsWith("plugin:") && (job.status === "queued" || job.status === "running"));
    if (activePlugin) {
      const kind = activePlugin.target.slice("plugin:".length);
      if (kind === "lsfg" || kind === "fsr4") {
        setRequestingPluginInstall(kind);
        setPluginInstallProgress({
          phase: activePlugin.status === "queued" ? "download_queued_phase" : activePlugin.phase,
          percent: activePlugin.percent,
        });
      }
    } else if (requestingPluginInstall) {
      const completed = [...downloadJobs].reverse().find((job) => job.target === `plugin:${requestingPluginInstall}`);
      if (completed?.status === "done") setPluginInstallStatus(t("pluginInstallComplete"));
      if (completed?.status === "failed") setPluginInstallStatus(t(normalizeError(new Error(completed.error))));
      if (completed) setRequestingPluginInstall(undefined);
    }

    const activeCompat = [...downloadJobs].reverse().find((job) =>
      job.target.startsWith("compat:") && (job.status === "queued" || job.status === "running"));
    if (activeCompat) {
      const version = activeCompat.target.slice("compat:".length) as TrainerCompatVersion;
      setInstallingTrainerCompat(version);
      setTrainerCompatProgress((current) => ({ ...current, [version]: {
        phase: activeCompat.status === "queued" ? "download_queued_phase" : activeCompat.phase,
        percent: activeCompat.percent,
      } }));
    } else if (installingTrainerCompat) {
      const completed = [...downloadJobs].reverse().find((job) => job.target === `compat:${installingTrainerCompat}`);
      if (completed?.status === "done") setTrainerCompatStatus(t("trainerCompatInstalled", { version: installingTrainerCompat }));
      if (completed?.status === "failed") setTrainerCompatStatus(t(normalizeError(new Error(completed.error))));
      if (completed) setInstallingTrainerCompat(undefined);
    }
  }, [downloadJobs]);

  useEffect(() => {
    const listener = addEventListener<[kind: string, phase: string, percent: number]>(
      "plugin_install_progress",
      (kind, phase, percent) => {
        if ((kind === "lsfg" || kind === "fsr4") && typeof phase === "string" && typeof percent === "number") {
          setPluginInstallProgress({ phase, percent });
        }
      },
    );
    return () => removeEventListener("plugin_install_progress", listener);
  }, []);

  useEffect(() => {
    const listener = addEventListener<[version: string, phase: string, percent: number]>(
      "trainer_compat_progress",
      (version, phase, percent) => {
        if (typeof version === "string" && typeof phase === "string" && typeof percent === "number") {
          setTrainerCompatProgress((current) => ({ ...current, [version]: { phase, percent } }));
        }
      },
    );
    return () => removeEventListener("trainer_compat_progress", listener);
  }, []);

  const recommendedCompatTools = compatTools.filter(isRecommendedCompatTool);
  const currentCompatTool = compatTools.find((tool) => tool.strToolName === selectedCompatTool);
  const compatOptions = [
    { label: t("steamDefaultCompat"), data: "" },
    ...recommendedCompatTools.map((tool) => ({ label: tool.strDisplayName, data: tool.strToolName })),
  ];
  if (selectedCompatTool && !recommendedCompatTools.some((tool) => tool.strToolName === selectedCompatTool)) {
    compatOptions.push({ label: currentCompatTool?.strDisplayName || currentCompatDisplayName || selectedCompatTool, data: selectedCompatTool });
  }

  return <Focusable style={{ display: "flex", flexDirection: "column" }}>
    <PanelSection title={t("language")}>
      <PanelSectionRow>
        <DropdownItem
          label={t("language")}
          selectedOption={preference}
          rgOptions={[
            { label: t("system"), data: "system" },
            { label: t("english"), data: "en-US" },
            { label: t("chinese"), data: "zh-CN" },
          ]}
          onChange={({ data }) => {
            const value = data as Language;
            storageSet(LANGUAGE_KEY, value);
            setPreference(value);
          }}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ToggleField
          label={t("autoSnapshot")}
          description={t("autoSnapshotDescription")}
          checked={autoSnapshot}
          disabled={busy}
          onChange={(enabled) => {
            storageSet(AUTO_SNAPSHOT_KEY, enabled ? "true" : "false");
            setAutoSnapshot(enabled);
          }}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ToggleField
          label={t("skipLauncher")}
          description={t("skipLauncherDescription")}
          bottomSeparator="standard"
          disabled={busy || running}
          checked={launchProfile.skip_launcher_enabled === true}
          onChange={(enabled) => setLaunchProfile({ ...launchProfile, skip_launcher_enabled: enabled })}
        />
      </PanelSectionRow>
    </PanelSection>

    <PanelSection title={t("currentGame")}>
      <PanelSectionRow>
        <ButtonItem layout="below" disabled={busy} onClick={() => void refresh()}>{busy ? t("refreshing") : t("refresh")}</ButtonItem>
      </PanelSectionRow>
      {!compatToolsLoaded && !busy && <PanelSectionRow>{t("refreshRequired")}</PanelSectionRow>}
      {!game ? <PanelSectionRow>{t("noGame")}</PanelSectionRow> : <>
        <PanelSectionRow>
          <div>{game.name}<div style={{ opacity: 0.7 }}>{running ? t("gameRunning") : t("gameStopped")}</div></div>
        </PanelSectionRow>
        {running && <PanelSectionRow>{t("closeGameFirst")}</PanelSectionRow>}
      </>}
    </PanelSection>

    {game && <PanelSection title={t("compatibilityTool")}>
      <PanelSectionRow>
        <DropdownItem
          label={t("compatibilityTool")}
          description={t("compatibilityToolDescription")}
          disabled={busy || running}
          selectedOption={selectedCompatTool}
          rgOptions={compatOptions}
          onChange={({ data }) => setSelectedCompatTool(typeof data === "string" ? data : "")}
        />
      </PanelSectionRow>
      {compatToolsLoaded && recommendedCompatTools.length === 0 && <PanelSectionRow>{t("noRecommendedCompatTools")}</PanelSectionRow>}
      <PanelSectionRow>
        <ButtonItem layout="below" disabled={busy} onClick={() => requestOfficialProtonInstall(PROTON_EXPERIMENTAL_APP_ID, t("protonExperimentalName"))}>{t("downloadProtonExperimental")}</ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" disabled={busy} onClick={() => requestOfficialProtonInstall(PROTON_10_APP_ID, t("proton10Name"))}>{t("downloadProton10")}</ButtonItem>
      </PanelSectionRow>
      {officialInstallerOpened && <PanelSectionRow><div style={{ color: "#7dd3fc", fontWeight: 600 }}>{t("officialInstallerOpened", { tool: officialInstallerOpened })}</div></PanelSectionRow>}
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={() => setShowTrainerCompat(!showTrainerCompat)}>
          {showTrainerCompat ? t("hideTrainerCompatMenu") : t("openTrainerCompatMenu")}
        </ButtonItem>
      </PanelSectionRow>
      {showTrainerCompat && (["GE-Proton7-55", "GE-Proton8-25", "GE-Proton9-27", "GE-Proton10-29"] as TrainerCompatVersion[]).map((version) => {
        const progress = trainerCompatProgress[version];
        return <PanelSectionRow key={version}><div style={{ width: "100%" }}>
          <ButtonItem layout="below" disabled={!!installingTrainerCompat} onClick={() => void installOneTrainerCompat(version)}>
            {installingTrainerCompat === version ? t("trainerCompatInstalling", { version }) : t("installTrainerCompatVersion", { version })}
          </ButtonItem>
          <div style={{ fontSize: "12px", opacity: 0.78, marginTop: "5px" }}>{version === "GE-Proton10-29" ? t("trainerCompatLatestHint") : t("trainerCompatOlderHint")}</div>
          {progress && <div style={{ marginTop: "7px" }}>
            <div style={{ marginBottom: "4px" }}>{t(progress.phase)} {progress.percent}%</div>
            <div style={{ height: "8px", borderRadius: "4px", background: "rgba(255,255,255,0.18)", overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.max(2, progress.percent)}%`, background: "#67c1f5", transition: "width 0.25s ease" }} /></div>
          </div>}
        </div></PanelSectionRow>;
      })}
      {trainerCompatStatus && <PanelSectionRow><div style={{ color: "#7dd3fc", fontWeight: 600 }}>{trainerCompatStatus}</div></PanelSectionRow>}
      <PanelSectionRow>
        <ButtonItem layout="below" disabled={busy || installingGe} onClick={() => void installGeProton()}>
          {installingGe ? t("geProtonInstalling") : t("installGeProton")}
        </ButtonItem>
      </PanelSectionRow>
      {geStatus && <PanelSectionRow><div style={{ color: "#7dd3fc", fontWeight: 600 }}>{geStatus}</div></PanelSectionRow>}
      <PanelSectionRow>
        <ButtonItem layout="below" disabled={busy || running} onClick={() => void applyCompatTool()}>{t("applyCompatibilityTool")}</ButtonItem>
      </PanelSectionRow>
    </PanelSection>}

    {game && <PanelSection title={t("launchOptions")}>
      <PanelSectionRow>
        <ToggleField
          label={t("trainerLauncher")}
          description={t("trainerLauncherDescription")}
          bottomSeparator="standard"
          disabled={busy || running}
          checked={launchProfile.trainer_enabled}
          onChange={(enabled) => setLaunchProfile({ ...launchProfile, trainer_enabled: enabled })}
        />
      </PanelSectionRow>
      {launchProfile.trainer_enabled && <PanelSectionRow>
        <div style={{ width: "100%" }}>
          <div style={{ fontWeight: 600, marginBottom: "8px" }}>{t("trainerPath")}</div>
          <div style={{
            background: "rgba(0, 0, 0, 0.25)",
            borderRadius: "4px",
            padding: "10px",
            marginBottom: "8px",
            fontFamily: launchProfile.trainer_path ? "monospace" : undefined,
            overflowWrap: "anywhere",
            color: launchProfile.trainer_path ? "inherit" : "#f5d547",
            fontWeight: launchProfile.trainer_path ? 400 : 600,
          }}>
            {launchProfile.trainer_path || t("trainerFileNotSelected")}
          </div>
          {!launchProfile.trainer_path && <div style={{ color: "#f5d547", marginBottom: "8px" }}>{t("trainerFileRequiredHint")}</div>}
          <ButtonItem layout="below" disabled={busy || running} onClick={async () => {
            try {
              const selected = await chooseExecutable(launchProfile.trainer_path.replace(/\/[^/]+$/, ""));
              if (selected) {
                setError(undefined);
                setLaunchProfile({ ...launchProfile, trainer_path: selected });
              }
            } catch (nextError) {
              setError(normalizeError(nextError));
            }
          }}><FaFolderOpen style={{ marginRight: "8px" }} />{launchProfile.trainer_path ? t("changeTrainerFile") : t("selectTrainerFile")}</ButtonItem>
        </div>
      </PanelSectionRow>}
      {launchProfile.trainer_enabled && <PanelSectionRow>
        <ButtonItem layout="below" onClick={() => {
          const query = game?.name ? `?s=${encodeURIComponent(game.name)}` : "";
          Navigation.NavigateToExternalWeb(`https://flingtrainer.com/${query}`);
        }}>{t("openFlingWebsite")}</ButtonItem>
      </PanelSectionRow>}
      {launchProfile.trainer_enabled && <PanelSectionRow>
        <ButtonItem layout="below" disabled={busy || running || downloadingTrainer} onClick={() => void downloadLatestTrainer()}>
          {downloadingTrainer ? t("trainerSearching") : t("downloadLatestTrainer")}
        </ButtonItem>
      </PanelSectionRow>}
      {launchProfile.trainer_enabled && trainerDownloadStatus && <PanelSectionRow><div style={{ color: "#7dd3fc", fontWeight: 600, overflowWrap: "anywhere" }}>{trainerDownloadStatus}</div></PanelSectionRow>}
      <PanelSectionRow>
        <ToggleField
          label={t("lsfgLauncher")}
          description={t("lsfgLauncherDescription")}
          bottomSeparator="standard"
          disabled={busy || running}
          checked={launchProfile.lsfg_enabled}
          onChange={(enabled) => setLaunchProfile({ ...launchProfile, lsfg_enabled: enabled })}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" disabled={busy || running || !!requestingPluginInstall} onClick={() => void requestDeckyPluginInstall("lsfg")}>
          {requestingPluginInstall === "lsfg" ? t("requestingPluginInstall") : t("installLsfgPlugin")}
        </ButtonItem>
      </PanelSectionRow>
      {pluginInstallStatus && <PanelSectionRow><div style={{ color: "#7dd3fc", fontWeight: 600 }}>{pluginInstallStatus}</div></PanelSectionRow>}
      {requestingPluginInstall && pluginInstallProgress && <PanelSectionRow><div style={{ width: "100%" }}>
        <div style={{ marginBottom: "6px" }}>{t(pluginInstallProgress.phase)} {pluginInstallProgress.percent}%</div>
        <div style={{ height: "8px", borderRadius: "4px", background: "rgba(255,255,255,0.18)", overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.max(2, pluginInstallProgress.percent)}%`, background: "#67c1f5", transition: "width 0.25s ease" }} /></div>
      </div></PanelSectionRow>}
      <PanelSectionRow>
        <ToggleField
          label={t("fsr4Launcher")}
          description={t("fsr4LauncherDescription")}
          bottomSeparator="standard"
          disabled={busy || running}
          checked={launchProfile.fsr4_enabled}
          onChange={(enabled) => setLaunchProfile({ ...launchProfile, fsr4_enabled: enabled, fsr4_uninstall_enabled: enabled ? false : launchProfile.fsr4_uninstall_enabled })}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" disabled={busy || running || !!requestingPluginInstall} onClick={() => void requestDeckyPluginInstall("fsr4")}>
          {requestingPluginInstall === "fsr4" ? t("requestingPluginInstall") : t("installFsr4Plugin")}
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ToggleField
          label={t("fsr4UninstallLauncher")}
          description={t("fsr4UninstallLauncherDescription")}
          bottomSeparator="standard"
          disabled={busy || running}
          checked={launchProfile.fsr4_uninstall_enabled}
          onChange={(enabled) => setLaunchProfile({ ...launchProfile, fsr4_uninstall_enabled: enabled, fsr4_enabled: enabled ? false : launchProfile.fsr4_enabled })}
        />
      </PanelSectionRow>
      {launchProfile.fsr4_uninstall_enabled && <PanelSectionRow><div style={{ color: "#f5d547", fontWeight: 600 }}>{t("fsr4UninstallWarning")}</div></PanelSectionRow>}
      <PanelSectionRow>
        <ButtonItem layout="below" disabled={busy || running} onClick={() => void applyLaunchProfile()}>{t("applyLaunchOptions")}</ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" disabled={busy || running} onClick={() => void previewLaunchProfile()}>{t("previewLaunchOptions")}</ButtonItem>
      </PanelSectionRow>
      {launchPreview && <PanelSectionRow><div style={{ fontFamily: "monospace", fontSize: "11px", overflowWrap: "anywhere" }}>{launchPreview}</div></PanelSectionRow>}
      {launchProfile.managed_options && <>
        <PanelSectionRow><div style={{ fontFamily: "monospace", fontSize: "11px", overflowWrap: "anywhere" }}>{launchProfile.managed_options}</div></PanelSectionRow>
        <PanelSectionRow><ButtonItem layout="below" disabled={busy || running} onClick={() => void restoreLaunchOptions()}>{t("restoreLaunchOptions")}</ButtonItem></PanelSectionRow>
      </>}
    </PanelSection>}

    {game && <PanelSection title={t("snapshots")}>
      <PanelSectionRow><ButtonItem layout="below" disabled={busy || running} onClick={() => void refreshAfter(() => createSnapshot(game.id, game.name))}>{t("save")}</ButtonItem></PanelSectionRow>
      {snapshots.length === 0 && <PanelSectionRow>{t("noSnapshots")}</PanelSectionRow>}
      {snapshots[0] && <PanelSectionRow>
        <ButtonItem layout="below" disabled={busy || running} onClick={async () => {
          const result = await refreshAfter(() => restoreSnapshot(game.id, snapshots[0].id));
          if (result && isRecord(result) && typeof result.undo_id === "string") setUndoId(result.undo_id);
        }}>{t("restoreLatestHealthyState")}</ButtonItem>
      </PanelSectionRow>}
      {snapshots.map((snapshot) => <PanelSectionRow key={snapshot.id}>
        <ButtonItem layout="below" disabled={busy || running} onClick={async () => {
          const result = await refreshAfter(() => restoreSnapshot(game.id, snapshot.id));
          if (result && isRecord(result) && typeof result.undo_id === "string") setUndoId(result.undo_id);
        }}>{t("restoreOlderSnapshot")} · {new Date(snapshot.created_at).toLocaleString(language)}</ButtonItem>
      </PanelSectionRow>)}
      {undoId && <PanelSectionRow><ButtonItem layout="below" disabled={busy || running} onClick={() => void refreshAfter(() => undoRestore(game.id, undoId))}>{t("undo")}</ButtonItem></PanelSectionRow>}
    </PanelSection>}

    {game && <PanelSection title={t("repairTools")}>
      <PanelSectionRow><ButtonItem layout="below" disabled={busy || running} onClick={() => void action(() => openProtontricks(game.id))}>{t("openProtontricks")}</ButtonItem></PanelSectionRow>
    </PanelSection>}

    <MemoryTuningPanel t={t} />

    {game && <PanelSection title={t("diagnostics")}>
      <PanelSectionRow>
        <div>{diagnostic?.changes?.length
          ? diagnostic.changes.map((change) => <div key={`${change.code}:${change.path}`}>{t(change.code, { path: change.path })}</div>)
          : <div>{t("normal")}</div>}</div>
      </PanelSectionRow>
      <PanelSectionRow>
        <div>{t("logs")}: {events.length
          ? events.slice(-3).reverse().map((event, index) => <div key={`${event.at}:${event.code}:${index}`}>{t(event.code)}</div>)
          : <div>{t("noActivity")}</div>}</div>
      </PanelSectionRow>
    </PanelSection>}

    {error && <PanelSection title={t("errorTitle")}><PanelSectionRow>{t("error", { message: t(error) })}</PanelSectionRow></PanelSection>}
  </Focusable>;
}

class DeckRecallErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("[DeckRecall] Render failure", error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    const language = resolveLanguage("system", currentSteamLanguage());
    return <div style={{ padding: "16px", overflowWrap: "anywhere" }}>
      <h3>{translate(language, "renderError")}</h3>
      <p>{translate(language, "renderErrorHint")}</p>
      <pre style={{ whiteSpace: "pre-wrap" }}>{this.state.error.name}: {this.state.error.message}</pre>
    </div>;
  }
}

function QuickAccessContent() {
  const savedLanguage = storageGet(LANGUAGE_KEY);
  const initialLanguage: Language = savedLanguage === "en-US" || savedLanguage === "zh-CN" ? savedLanguage : "system";
  const [preference, setPreference] = useState<Language>(initialLanguage);
  const language = useMemo(() => resolveLanguage(preference, currentSteamLanguage()), [preference]);
  const t = (key: string, values: Record<string, string> = {}) => translate(language, key, values);
  const recentGame = activeGame() || loadLastGame();
  const [officialInstallerOpened, setOfficialInstallerOpened] = useState("");
  const [installingGe, setInstallingGe] = useState(false);
  const [geStatus, setGeStatus] = useState("");
  const [updateStatus, setUpdateStatus] = useState<DeckRecallUpdateStatus>();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [updateFeedback, setUpdateFeedback] = useState("");
  const [updateProgress, setUpdateProgress] = useState<DownloadProgress>();
  const [downloadJobs, setDownloadJobs] = useState<DownloadJob[]>([]);
  const [installerAppId, setInstallerAppId] = useState<number>();
  const [installerName, setInstallerName] = useState("");
  const [exeCandidates, setExeCandidates] = useState<ExeInstallCandidate[]>([]);
  const [selectedExeId, setSelectedExeId] = useState("");
  const [exeInstallStatus, setExeInstallStatus] = useState("");
  const [exeInstallBusy, setExeInstallBusy] = useState(false);
  const [exeCompatTool, setExeCompatTool] = useState("proton_experimental");
  const [gameFolders, setGameFolders] = useState<ExeGameFolder[]>([]);
  const [selectedGameFolder, setSelectedGameFolder] = useState("");
  const [gameExeCandidates, setGameExeCandidates] = useState<ExeInstallCandidate[]>([]);
  const [selectedGameExe, setSelectedGameExe] = useState("");

  const chooseAndRunExeInstaller = async () => {
    Navigation.CloseSideMenus();
    setExeInstallBusy(true);
    setExeInstallStatus("");
    try {
      const selected = await openFilePicker(
        FileSelectionType.FILE,
        "/home/deck/Downloads",
        true,
        undefined,
        /\.exe$/i,
        undefined,
        false,
        true,
      );
      const installer = exeSelectionPath(selected);
      if (!installer) throw new Error("exe_install_file_invalid");
      const name = cleanExeName(installer);
      const apps = (globalThis as any).SteamClient?.Apps;
      if (!apps?.AddShortcut || !apps?.RunGame) throw new Error("exe_install_steam_api_unavailable");
      const appId = await createInstallerShortcut(apps, name, installer, exeCompatTool);
      try {
        await beginExeInstall(String(appId));
      } catch (error) {
        apps.RemoveShortcut?.(appId);
        throw error;
      }
      setInstallerAppId(appId);
      setInstallerName(name);
      setExeCandidates([]);
      setSelectedExeId("");
      launchInstaller(apps, appId);
      setExeInstallStatus(t("exeInstallerRunning"));
    } catch (error) {
      const code = normalizeError(error);
      setExeInstallStatus(t(code));
      toaster.toast({ title: "DeckRecall", body: t(code), duration: 6000, showToast: true });
    } finally {
      setExeInstallBusy(false);
    }
  };

  const scanExtractedGames = async () => {
    setExeInstallBusy(true);
    setExeInstallStatus("");
    try {
      const result = await listExeGameFolders();
      setGameFolders(result.folders);
      setSelectedGameFolder(result.folders[0]?.id ?? "");
      setGameExeCandidates([]);
      setSelectedGameExe("");
      setExeInstallStatus(result.folders.length ? t("exeGameFoldersFound", { count: String(result.folders.length) }) : t("exeGameFoldersEmpty"));
    } catch (error) {
      setExeInstallStatus(t(normalizeError(error)));
    } finally {
      setExeInstallBusy(false);
    }
  };

  const chooseExtractedGameFolder = async () => {
    Navigation.CloseSideMenus();
    setExeInstallBusy(true);
    setExeInstallStatus("");
    try {
      const selected = await openFilePicker(
        FileSelectionType.FOLDER,
        "/home/deck/Downloads",
        true,
        true,
        undefined,
        undefined,
        false,
        true,
      );
      const selectedPath = folderSelectionPath(selected);
      if (!selectedPath) throw new Error("exe_game_folder_invalid");
      const result = await listExeGameFolders();
      setGameFolders(result.folders);
      const matched = result.folders.find((folder) => folder.location.replace(/\/+$/, "") === selectedPath);
      if (!matched) throw new Error("exe_game_folder_not_allowed");
      setSelectedGameFolder(matched.id);
      setGameExeCandidates([]);
      setSelectedGameExe("");
      setExeInstallStatus(t("exeGameFolderSelected", { name: matched.name }));
    } catch (error) {
      setExeInstallStatus(t(normalizeError(error)));
    } finally {
      setExeInstallBusy(false);
    }
  };

  const scanSelectedGameFolder = async () => {
    if (!selectedGameFolder) return;
    setExeInstallBusy(true);
    try {
      const result = await listExeGameCandidates(selectedGameFolder);
      setGameExeCandidates(result.candidates);
      setSelectedGameExe(result.candidates[0]?.id ?? "");
      setExeInstallStatus(result.candidates.length ? t("exeCandidatesFound", { count: String(result.candidates.length) }) : t("exeCandidatesEmpty"));
    } catch (error) {
      setExeInstallStatus(t(normalizeError(error)));
    } finally {
      setExeInstallBusy(false);
    }
  };

  const addExtractedGame = async () => {
    if (!selectedGameFolder || !selectedGameExe) return;
    setExeInstallBusy(true);
    try {
      const candidate = await resolveExeGameCandidate(selectedGameFolder, selectedGameExe);
      const apps = (globalThis as any).SteamClient?.Apps;
      if (!apps?.AddShortcut || !apps?.CreateDesktopShortcutForApp) throw new Error("exe_install_steam_api_unavailable");
      await createGameShortcut(apps, candidate, exeCompatTool);
      setExeInstallStatus(t("exeInstallComplete", { name: candidate.name }));
    } catch (error) {
      setExeInstallStatus(t(normalizeError(error)));
    } finally {
      setExeInstallBusy(false);
    }
  };

  const scanInstalledExecutables = async () => {
    if (!installerAppId) return;
    setExeInstallBusy(true);
    try {
      const result = await listExeInstallCandidates(String(installerAppId));
      setExeCandidates(result.candidates);
      setSelectedExeId(result.candidates[0]?.id ?? "");
      setExeInstallStatus(result.candidates.length ? t("exeCandidatesFound", { count: String(result.candidates.length) }) : t("exeCandidatesEmpty"));
    } catch (error) {
      setExeInstallStatus(t(normalizeError(error)));
    } finally {
      setExeInstallBusy(false);
    }
  };

  const finishExeInstall = async () => {
    if (!installerAppId || !selectedExeId) return;
    setExeInstallBusy(true);
    try {
      const candidate = await resolveExeInstallCandidate(String(installerAppId), selectedExeId);
      const apps = (globalThis as any).SteamClient?.Apps;
      if (!apps?.SetShortcutExe || !apps?.CreateDesktopShortcutForApp) throw new Error("exe_install_steam_api_unavailable");
      finalizeInstallerShortcut(apps, installerAppId, candidate, installerName);
      setExeInstallStatus(t("exeInstallComplete", { name: installerName || candidate.name }));
      toaster.toast({ title: "DeckRecall", body: t("exeInstallComplete", { name: installerName || candidate.name }), duration: 6000, showToast: true });
    } catch (error) {
      setExeInstallStatus(t(normalizeError(error)));
    } finally {
      setExeInstallBusy(false);
    }
  };

  const checkDeckRecallUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateFeedback("");
    try {
      const status = await withTimeout(getDeckRecallUpdateStatus(), 30000);
      setUpdateStatus(status);
      setUpdateFeedback(t(status.update_available ? "deckrecallUpdateAvailable" : "deckrecallUpToDate", {
        installed: status.installed_version,
        latest: status.latest_version,
      }));
    } catch (error) {
      setUpdateFeedback(t(normalizeError(error)));
    } finally {
      setCheckingUpdate(false);
    }
  };

  const updateDeckRecall = async () => {
    setInstallingUpdate(true);
    setUpdateFeedback("");
    setUpdateProgress({ phase: "self_update_download_phase", percent: 0 });
    try {
      await startDeckRecallUpdate();
      setDownloadJobs(await getDownloadJobs());
    } catch (error) {
      const code = normalizeError(error);
      setUpdateFeedback(t(code));
      toaster.toast({ title: "DeckRecall", body: t(code), duration: 6000, showToast: true });
      setInstallingUpdate(false);
    }
  };

  useEffect(() => {
    void getDownloadJobs().then(setDownloadJobs).catch((error) => {
      console.warn("[DeckRecall] Could not hydrate download queue", error);
    });
    const listener = addEventListener<[jobs: DownloadJob[]]>("download_jobs_changed", setDownloadJobs);
    return () => removeEventListener("download_jobs_changed", listener);
  }, []);

  useEffect(() => {
    const updateJob = [...downloadJobs].reverse().find((job) => job.target === "self_update");
    if (!updateJob) return;
    setUpdateProgress({
      phase: updateJob.status === "queued" ? "download_queued_phase" : updateJob.phase,
      percent: updateJob.percent,
    });
    if (updateJob.status === "queued" || updateJob.status === "running") {
      setInstallingUpdate(true);
      return;
    }
    setInstallingUpdate(false);
    if (updateJob.status === "done" && updateStatus) {
      const message = t("deckrecallUpdated", { installed: updateStatus.latest_version, latest: updateStatus.latest_version });
      setUpdateStatus({ ...updateStatus, installed_version: updateStatus.latest_version, update_available: false });
      setUpdateFeedback(message);
    } else if (updateJob.status === "failed") {
      setUpdateFeedback(t(normalizeError(new Error(updateJob.error))));
    }
  }, [downloadJobs]);

  const requestOfficialProtonInstall = async (toolAppId: number, toolName: string) => {
    try {
      await queueOfficialProtonInstaller(toolAppId);
      setOfficialInstallerOpened(toolName);
      toaster.toast({
        title: "DeckRecall",
        body: t("officialInstallerOpened", { tool: toolName }),
        duration: 4000,
        showToast: true,
      });
    } catch (error) {
      console.warn("[DeckRecall] Could not open SteamOS Proton installer", error);
      toaster.toast({ title: "DeckRecall", body: t("backend_error"), duration: 4000, showToast: true });
    }
  };

  const installGeProton = async () => {
    setInstallingGe(true);
    setGeStatus("");
    try {
      const result = await installLatestGeProton();
      setGeStatus(t("geProtonInstalled", { version: result.version }));
      toaster.toast({ title: "DeckRecall", body: t("geProtonInstalled", { version: result.version }), duration: 5000, showToast: true });
    } catch (error) {
      const code = normalizeError(error);
      setGeStatus(t(code));
      toaster.toast({ title: "DeckRecall", body: t(code), duration: 5000, showToast: true });
    } finally {
      setInstallingGe(false);
    }
  };

  return <Focusable style={{ display: "flex", flexDirection: "column" }}>
    <PanelSection title={t("deckrecallUpdateTitle")}>
      <PanelSectionRow>
        <ButtonItem layout="below" disabled={checkingUpdate || installingUpdate} onClick={() => void checkDeckRecallUpdate()}>
          {checkingUpdate ? t("deckrecallCheckingUpdate") : t("deckrecallCheckUpdate")}
        </ButtonItem>
      </PanelSectionRow>
      {updateStatus?.update_available && <PanelSectionRow>
        <ButtonItem layout="below" disabled={installingUpdate} onClick={() => void updateDeckRecall()}>
          {installingUpdate ? t("deckrecallUpdating") : t("deckrecallInstallUpdate", { version: updateStatus.latest_version })}
        </ButtonItem>
      </PanelSectionRow>}
      {installingUpdate && updateProgress && <PanelSectionRow><div style={{ width: "100%" }}>
        <div style={{ marginBottom: "6px" }}>{t(updateProgress.phase)} {updateProgress.percent}%</div>
        <div style={{ height: "8px", borderRadius: "4px", background: "rgba(255,255,255,0.18)", overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.max(2, updateProgress.percent)}%`, background: "#67c1f5", transition: "width 0.25s ease" }} /></div>
      </div></PanelSectionRow>}
      {updateFeedback && <PanelSectionRow><div style={{ color: "#7dd3fc", fontWeight: 600 }}>{updateFeedback}</div></PanelSectionRow>}
    </PanelSection>
    <PanelSection title={t("language")}>
      <PanelSectionRow>
        <DropdownItem
          label={t("language")}
          selectedOption={preference}
          rgOptions={[
            { label: t("system"), data: "system" },
            { label: t("english"), data: "en-US" },
            { label: t("chinese"), data: "zh-CN" },
          ]}
          onChange={({ data }) => {
            const value = data as Language;
            storageSet(LANGUAGE_KEY, value);
            setPreference(value);
          }}
        />
      </PanelSectionRow>
    </PanelSection>
    <PanelSection title={t("installCompatibilityTools")}>
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={() => requestOfficialProtonInstall(PROTON_EXPERIMENTAL_APP_ID, t("protonExperimentalName"))}>
          {t("downloadProtonExperimental")}
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={() => requestOfficialProtonInstall(PROTON_10_APP_ID, t("proton10Name"))}>
          {t("downloadProton10")}
        </ButtonItem>
      </PanelSectionRow>
      {officialInstallerOpened && <PanelSectionRow>
        <div style={{ color: "#7dd3fc", fontWeight: 600 }}>{t("officialInstallerOpened", { tool: officialInstallerOpened })}</div>
      </PanelSectionRow>}
      <PanelSectionRow>
        <ButtonItem layout="below" disabled={installingGe} onClick={() => void installGeProton()}>
          {installingGe ? t("geProtonInstalling") : t("installGeProton")}
        </ButtonItem>
      </PanelSectionRow>
      {geStatus && <PanelSectionRow><div style={{ color: "#7dd3fc", fontWeight: 600 }}>{geStatus}</div></PanelSectionRow>}
    </PanelSection>
    <PanelSection title={t("exeInstallTitle")}>
      <PanelSectionRow>{t("exeInstallDescription")}</PanelSectionRow>
      <PanelSectionRow>
        <DropdownItem
          label={t("exeInstallCompatTool")}
          selectedOption={exeCompatTool}
          rgOptions={[
            { data: "proton_experimental", label: t("protonExperimentalName") },
            { data: "proton_10", label: t("proton10Name") },
          ]}
          onChange={({ data }) => setExeCompatTool(String(data))}
        />
      </PanelSectionRow>
      <PanelSectionRow>{t("exeInstallerMode")}</PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" disabled={exeInstallBusy} onClick={() => void chooseAndRunExeInstaller()}>
          {t("chooseExeInstaller")}
        </ButtonItem>
      </PanelSectionRow>
      {installerAppId && <>
        <PanelSectionRow>
          <ButtonItem layout="below" disabled={exeInstallBusy} onClick={() => void scanInstalledExecutables()}>
            {t("scanInstalledExe")}
          </ButtonItem>
        </PanelSectionRow>
        {exeCandidates.length > 0 && <PanelSectionRow>
          <DropdownItem
            label={t("installedExe")}
            selectedOption={selectedExeId}
            rgOptions={exeCandidates.map((candidate) => ({
              data: candidate.id,
              label: `${candidate.name}${candidate.new ? ` · ${t("newExe")}` : ""} · ${candidate.relative}`,
            }))}
            onChange={({ data }) => setSelectedExeId(String(data))}
          />
        </PanelSectionRow>}
        {selectedExeId && <PanelSectionRow>
          <ButtonItem layout="below" disabled={exeInstallBusy} onClick={() => void finishExeInstall()}>
            {t("addInstalledExe")}
          </ButtonItem>
        </PanelSectionRow>}
      </>}
      <PanelSectionRow>{t("exeExtractedMode")}</PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" disabled={exeInstallBusy} onClick={() => void chooseExtractedGameFolder()}>
          {t("chooseExtractedGameFolder")}
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" disabled={exeInstallBusy} onClick={() => void scanExtractedGames()}>
          {t("scanExtractedGames")}
        </ButtonItem>
      </PanelSectionRow>
      {gameFolders.length > 0 && <>
        <PanelSectionRow>
          <DropdownItem
            label={t("exeGameFolder")}
            selectedOption={selectedGameFolder}
            rgOptions={gameFolders.map((folder) => ({ data: folder.id, label: `${folder.name} · ${folder.location}` }))}
            onChange={({ data }) => {
              setSelectedGameFolder(String(data));
              setGameExeCandidates([]);
              setSelectedGameExe("");
            }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" disabled={exeInstallBusy || !selectedGameFolder} onClick={() => void scanSelectedGameFolder()}>
            {t("detectGameExe")}
          </ButtonItem>
        </PanelSectionRow>
      </>}
      {gameExeCandidates.length > 0 && <>
        <PanelSectionRow>
          <DropdownItem
            label={t("installedExe")}
            selectedOption={selectedGameExe}
            rgOptions={gameExeCandidates.map((candidate) => ({ data: candidate.id, label: `${candidate.name} · ${candidate.relative}` }))}
            onChange={({ data }) => setSelectedGameExe(String(data))}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" disabled={exeInstallBusy || !selectedGameExe} onClick={() => void addExtractedGame()}>
            {t("addExtractedGame")}
          </ButtonItem>
        </PanelSectionRow>
      </>}
      {exeInstallStatus && <PanelSectionRow><div style={{ color: "#7dd3fc", fontWeight: 600, overflowWrap: "anywhere" }}>{exeInstallStatus}</div></PanelSectionRow>}
      <PanelSectionRow>{t("exeInstallNoArtwork")}</PanelSectionRow>
    </PanelSection>
    <MemoryTuningPanel t={t} />
    <PanelSection title={t("gameMenuEntry")}>
      <PanelSectionRow>{t("gameMenuInstructions")}</PanelSectionRow>
      {recentGame && <PanelSectionRow>
        <ButtonItem layout="below" onClick={() => Navigation.Navigate(`/deckrecall/${recentGame.id}`)}>
          {t("openRecentGame")} · {recentGame.name}
        </ButtonItem>
      </PanelSectionRow>}
    </PanelSection>
  </Focusable>;
}

function PageRouter() {
  const params = useParams<{ appid: string }>();
  const appId = String(params.appid ?? "");
  const language = resolveLanguage("system", currentSteamLanguage());
  if (!/^[1-9]\d{0,9}$/.test(appId)) {
    return <div style={{ padding: "24px" }}>{translate(language, "invalid_app_id")}</div>;
  }
  return <SidebarNavigation
    title="DeckRecall"
    showTitle={true}
    pages={[{
      title: translate(language, "gameSettings"),
      content: <DeckRecallErrorBoundary><GameContent appId={appId} /></DeckRecallErrorBoundary>,
      icon: <FaHistory />,
      hideTitle: false,
    }]}
  />;
}

export default definePlugin(() => {
  routerHook.addRoute("/deckrecall/:appid", PageRouter, { exact: true });
  const contextMenuPatch = installGameContextMenuPatch();
  const automaticSnapshotMonitor = installAutomaticSnapshotMonitor();
  return {
    title: <div className={staticClasses.Title}>DeckRecall</div>,
    content: <DeckRecallErrorBoundary><QuickAccessContent /></DeckRecallErrorBoundary>,
    icon: <FaHistory />,
    onDismount() {
      contextMenuPatch.unpatch();
      automaticSnapshotMonitor.unregister?.();
      routerHook.removeRoute("/deckrecall/:appid");
    },
  };
});
