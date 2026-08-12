const manifest = {"name":"DeckRecall"};
const API_VERSION = 2;
const internalAPIConnection = window.__DECKY_SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED_deckyLoaderAPIInit;
if (!internalAPIConnection) {
    throw new Error('[@decky/api]: Failed to connect to the loader as as the loader API was not initialized. This is likely a bug in Decky Loader.');
}
let api;
try {
    api = internalAPIConnection.connect(API_VERSION, manifest.name);
}
catch {
    api = internalAPIConnection.connect(1, manifest.name);
    console.warn(`[@decky/api] Requested API version ${API_VERSION} but the running loader only supports version 1. Some features may not work.`);
}
if (api._version != API_VERSION) {
    console.warn(`[@decky/api] Requested API version ${API_VERSION} but the running loader only supports version ${api._version}. Some features may not work.`);
}
const callable = api.callable;
const addEventListener = api.addEventListener;
const removeEventListener = api.removeEventListener;
const routerHook = api.routerHook;
const toaster = api.toaster;
const openFilePicker = api.openFilePicker;

var DefaultContext = {
  color: undefined,
  size: undefined,
  className: undefined,
  style: undefined,
  attr: undefined
};
var IconContext = SP_REACT.createContext && /*#__PURE__*/SP_REACT.createContext(DefaultContext);

var _excluded = ["attr", "size", "title"];
function _objectWithoutProperties(e, t) { if (null == e) return {}; var o, r, i = _objectWithoutPropertiesLoose(e, t); if (Object.getOwnPropertySymbols) { var n = Object.getOwnPropertySymbols(e); for (r = 0; r < n.length; r++) o = n[r], -1 === t.indexOf(o) && {}.propertyIsEnumerable.call(e, o) && (i[o] = e[o]); } return i; }
function _objectWithoutPropertiesLoose(r, e) { if (null == r) return {}; var t = {}; for (var n in r) if ({}.hasOwnProperty.call(r, n)) { if (-1 !== e.indexOf(n)) continue; t[n] = r[n]; } return t; }
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), true).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: true, configurable: true, writable: true }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function Tree2Element(tree) {
  return tree && tree.map((node, i) => /*#__PURE__*/SP_REACT.createElement(node.tag, _objectSpread({
    key: i
  }, node.attr), Tree2Element(node.child)));
}
function GenIcon(data) {
  return props => /*#__PURE__*/SP_REACT.createElement(IconBase, _extends({
    attr: _objectSpread({}, data.attr)
  }, props), Tree2Element(data.child));
}
function IconBase(props) {
  var elem = conf => {
    var attr = props.attr,
      size = props.size,
      title = props.title,
      svgProps = _objectWithoutProperties(props, _excluded);
    var computedSize = size || conf.size || "1em";
    var className;
    if (conf.className) className = conf.className;
    if (props.className) className = (className ? className + " " : "") + props.className;
    return /*#__PURE__*/SP_REACT.createElement("svg", _extends({
      stroke: "currentColor",
      fill: "currentColor",
      strokeWidth: "0"
    }, conf.attr, attr, svgProps, {
      className: className,
      style: _objectSpread(_objectSpread({
        color: props.color || conf.color
      }, conf.style), props.style),
      height: computedSize,
      width: computedSize,
      xmlns: "http://www.w3.org/2000/svg"
    }), title && /*#__PURE__*/SP_REACT.createElement("title", null, title), props.children);
  };
  return IconContext !== undefined ? /*#__PURE__*/SP_REACT.createElement(IconContext.Consumer, null, conf => elem(conf)) : elem(DefaultContext);
}

// THIS FILE IS AUTO GENERATED
function FaHistory (props) {
  return GenIcon({"attr":{"viewBox":"0 0 512 512"},"child":[{"tag":"path","attr":{"d":"M504 255.531c.253 136.64-111.18 248.372-247.82 248.468-59.015.042-113.223-20.53-155.822-54.911-11.077-8.94-11.905-25.541-1.839-35.607l11.267-11.267c8.609-8.609 22.353-9.551 31.891-1.984C173.062 425.135 212.781 440 256 440c101.705 0 184-82.311 184-184 0-101.705-82.311-184-184-184-48.814 0-93.149 18.969-126.068 49.932l50.754 50.754c10.08 10.08 2.941 27.314-11.313 27.314H24c-8.837 0-16-7.163-16-16V38.627c0-14.254 17.234-21.393 27.314-11.314l49.372 49.372C129.209 34.136 189.552 8 256 8c136.81 0 247.747 110.78 248 247.531zm-180.912 78.784l9.823-12.63c8.138-10.463 6.253-25.542-4.21-33.679L288 256.349V152c0-13.255-10.745-24-24-24h-16c-13.255 0-24 10.745-24 24v135.651l65.409 50.874c10.463 8.137 25.541 6.253 33.679-4.21z"},"child":[]}]})(props);
}function FaFolderOpen (props) {
  return GenIcon({"attr":{"viewBox":"0 0 576 512"},"child":[{"tag":"path","attr":{"d":"M572.694 292.093L500.27 416.248A63.997 63.997 0 0 1 444.989 448H45.025c-18.523 0-30.064-20.093-20.731-36.093l72.424-124.155A64 64 0 0 1 152 256h399.964c18.523 0 30.064 20.093 20.73 36.093zM152 224h328v-48c0-26.51-21.49-48-48-48H272l-64-64H48C21.49 64 0 85.49 0 112v278.046l69.077-118.418C86.214 242.25 117.989 224 152 224z"},"child":[]}]})(props);
}

const PROTON_EXPERIMENTAL_APP_ID = 1493710;
const PROTON_10_APP_ID = 3658110;
const BUILTIN_COMPAT_TOOLS = [
    { strToolName: "proton_experimental", strDisplayName: "Proton Experimental" },
    { strToolName: "proton_10", strDisplayName: "Proton 10.0-4" },
];
function isRecord$2(value) {
    return typeof value === "object" && value !== null;
}
function normalizeCompatTools(value) {
    const items = Array.isArray(value) ? value
        : isRecord$2(value) && Array.isArray(value.rgTools) ? value.rgTools
            : isRecord$2(value) && Array.isArray(value.tools) ? value.tools
                : isRecord$2(value) && Array.isArray(value.compatTools) ? value.compatTools
                    : isRecord$2(value) && Array.isArray(value.compat_tools) ? value.compat_tools
                        : [];
    const seen = new Set();
    return items.filter((tool) => {
        if (!isRecord$2(tool) || typeof tool.strToolName !== "string" || typeof tool.strDisplayName !== "string" || !tool.strToolName)
            return false;
        if (seen.has(tool.strToolName))
            return false;
        seen.add(tool.strToolName);
        return true;
    });
}
function mergeCompatTools(...groups) {
    return normalizeCompatTools(groups.flat());
}
function compatToolFamily(tool) {
    const identity = `${tool.strToolName} ${tool.strDisplayName}`.toLowerCase();
    if (identity.includes("proton experimental") || identity.includes("proton_experimental"))
        return "experimental";
    if (/proton[^\d]*10(?:\.0)?[- ._]?4/.test(identity) || identity.includes("proton_10"))
        return "proton10";
    if (identity.includes("ge-proton") || identity.includes("proton-ge") || identity.includes("ge_proton"))
        return "ge";
    return undefined;
}
function isRecommendedCompatTool(tool) {
    return compatToolFamily(tool) !== undefined;
}

const MENU_KEY = "deck-recall";
function resolveAppId(tree, fallback) {
    try {
        const roots = Array.isArray(tree) ? tree : [tree];
        // Steam can reuse a cached menu component. Prefer the app ID carried by
        // the actual menu items over the render callback's previous app ID.
        for (const root of roots) {
            const ownerId = root?._owner?.pendingProps?.overview?.appid;
            if (Number.isInteger(ownerId) && ownerId > 0 && ownerId !== fallback)
                return ownerId;
        }
        for (const root of roots) {
            const ownerId = root?._owner?.pendingProps?.overview?.appid;
            if (Number.isInteger(ownerId) && ownerId > 0)
                return ownerId;
            const found = DFL.findInTree(root, (node) => Number.isInteger(node?.app?.appid), {
                walkable: ["props", "children"],
            });
            if (Number.isInteger(found?.app?.appid) && found.app.appid > 0)
                return found.app.appid;
        }
        return fallback;
    }
    catch {
        return fallback;
    }
}
function isGameContextMenu(items) {
    if (!Array.isArray(items) || items.length === 0)
        return false;
    try {
        const hasLaunchSource = Boolean(DFL.findInReactTree(items, (node) => node?.props?.onSelected?.toString?.().includes("launchSource")));
        if (hasLaunchSource)
            return true;
        // Non-Steam shortcuts can have compatdata and a valid Steam shortcut ID,
        // but their library menu does not always contain Steam's launchSource.
        const hasProperties = Boolean(DFL.findInReactTree(items, (node) => node?.props?.onSelected?.toString?.().includes("AppProperties")));
        return hasProperties && resolveAppId(items, 0) > 0;
    }
    catch {
        return false;
    }
}
function insertMenuItem(items, fallbackAppId) {
    if (!isGameContextMenu(items))
        return;
    const duplicateIndex = items.findIndex((item) => item?.key === MENU_KEY);
    if (duplicateIndex >= 0)
        items.splice(duplicateIndex, 1);
    const appId = resolveAppId(items, fallbackAppId);
    if (!Number.isInteger(appId) || appId <= 0)
        return;
    const propertiesIndex = items.findIndex((item) => {
        try {
            return Boolean(DFL.findInReactTree(item, (node) => node?.onSelected?.toString?.().includes("AppProperties")));
        }
        catch {
            return false;
        }
    });
    const insertionIndex = propertiesIndex >= 0 ? propertiesIndex : items.length;
    items.splice(insertionIndex, 0, SP_JSX.jsx(DFL.MenuItem, { onSelected: () => {
            DFL.Navigation.Navigate(`/deckrecall/${appId}`);
        }, children: "DeckRecall" }, MENU_KEY));
}
function findLibraryContextMenu() {
    try {
        const module = DFL.findModuleByExport((candidate) => candidate?.toString?.().includes("().LibraryContextMenu"));
        if (!module || (typeof module !== "object" && typeof module !== "function"))
            return undefined;
        const candidate = Object.values(module).find((sibling) => sibling?.toString?.().includes("navigator:"));
        if (!candidate)
            return undefined;
        return DFL.fakeRenderComponent(candidate).type;
    }
    catch (error) {
        console.warn("[DeckRecall] Could not locate the Steam game context menu", error);
        return undefined;
    }
}
function installGameContextMenuPatch() {
    const LibraryContextMenu = findLibraryContextMenu();
    if (!LibraryContextMenu?.prototype?.render)
        return { unpatch() { } };
    let innerPatch;
    let menuRenderPatch;
    let menuUpdatePatch;
    const outerPatch = DFL.afterPatch(LibraryContextMenu.prototype, "render", (_args, component) => {
        try {
            const appId = resolveAppId(component, 0);
            if (!innerPatch && component?.type) {
                innerPatch = DFL.afterPatch(component, "type", (_innerArgs, rendered) => {
                    try {
                        if (!menuRenderPatch && rendered?.type?.prototype?.render) {
                            menuRenderPatch = DFL.afterPatch(rendered.type.prototype, "render", (_renderArgs, menu) => {
                                try {
                                    insertMenuItem(menu?.props?.children?.[0], appId);
                                }
                                catch (error) {
                                    console.warn("[DeckRecall] Could not add the game menu item", error);
                                }
                                return menu;
                            });
                        }
                        if (!menuUpdatePatch && rendered?.type?.prototype?.shouldComponentUpdate) {
                            menuUpdatePatch = DFL.afterPatch(rendered.type.prototype, "shouldComponentUpdate", ([nextProps], shouldUpdate) => {
                                try {
                                    if (shouldUpdate === true)
                                        insertMenuItem(nextProps?.children, appId);
                                }
                                catch (error) {
                                    console.warn("[DeckRecall] Could not refresh the game menu item", error);
                                }
                                return shouldUpdate;
                            });
                        }
                    }
                    catch (error) {
                        console.warn("[DeckRecall] Could not patch the inner game menu", error);
                    }
                    return rendered;
                });
            }
            else {
                insertMenuItem(component?.props?.children, appId);
            }
        }
        catch (error) {
            console.warn("[DeckRecall] Game menu patch skipped", error);
        }
        return component;
    });
    return {
        unpatch() {
            menuUpdatePatch?.unpatch();
            menuRenderPatch?.unpatch();
            innerPatch?.unpatch();
            outerPatch?.unpatch();
        },
    };
}

var title$1 = "DeckRecall";
var noGame$1 = "No running Steam game detected.";
var normal$1 = "No changes detected.";
var changesDetected$1 = "Changes detected";
var save$1 = "Save healthy state";
var restore$1 = "Restore safely";
var restoreLatestHealthyState$1 = "Return to the last healthy state";
var restoreOlderSnapshot$1 = "Restore an earlier healthy state";
var undo$1 = "Undo restore";
var snapshots$1 = "Snapshots";
var diagnostics$1 = "Diagnostics";
var logs$1 = "Activity log";
var language$1 = "Language";
var system$1 = "Follow Steam / system";
var english$1 = "English";
var chinese$1 = "简体中文";
var autoSnapshot$1 = "Automatically save healthy state";
var autoSnapshotDescription$1 = "On by default. When a running game closes, DeckRecall saves one snapshot if none exists yet.";
var file_missing$1 = "Tracked file is now missing: {path}";
var file_added$1 = "New tracked file: {path}";
var file_changed$1 = "Tracked file changed: {path}";
var snapshot_created$1 = "Healthy state saved.";
var snapshot_restored$1 = "Snapshot restored safely. An undo point was created.";
var restore_undone$1 = "Restore undone.";
var error$1 = "Operation failed: {message}";
var backend_error$1 = "The backend did not complete the request.";
var unknown_error$1 = "An unexpected error occurred.";
var partial_refresh$1 = "Some data could not be loaded; available features remain usable.";
var invalid_app_id$1 = "Invalid Steam app ID.";
var snapshot_not_found$1 = "Snapshot was not found.";
var snapshot_integrity_failed$1 = "Snapshot integrity check failed.";
var undo_not_found$1 = "Undo point was not found.";
var file_too_large$1 = "A tracked state file is too large to snapshot safely.";
var gameRunning$1 = "Running";
var gameStopped$1 = "Ready for launch-option changes, snapshot, or restore";
var closeGameFirst$1 = "Close the game before changing launch options, saving, or restoring state.";
var noSnapshots$1 = "No saved snapshots yet.";
var noActivity$1 = "No activity yet.";
var trainerLauncher$1 = "Trainer";
var trainerLauncherDescription$1 = "Browse FLiNG in Steam's built-in browser, then use Steam's native downloader to save the latest trainer to Documents.";
var trainerPath$1 = "Trainer EXE";
var openFlingWebsite$1 = "Open website in Steam browser";
var downloadLatestTrainer$1 = "Download latest trainer with Steam";
var trainerSearching$1 = "Finding this game's trainer on the official site…";
var trainerDownloadStarted$1 = "Steam download started: {title}. It will be saved to {directory}; select the file below when it finishes.";
var trainerDownloadSaved$1 = "Steam download was invoked; DeckRecall also safely saved {title} to {directory} and selected it.";
var trainerDownloadStartedFallbackFailed$1 = "Steam download started for {title}; the Documents fallback failed: {error}";
var selectTrainerFile$1 = "Select the downloaded trainer EXE";
var changeTrainerFile$1 = "Change trainer file";
var trainer_search_invalid$1 = "This game name cannot be searched.";
var trainer_search_failed$1 = "Could not reach the FLiNG website.";
var trainer_not_found$1 = "No trainer for this game was found on the official site.";
var trainer_download_unavailable$1 = "This Steam version does not expose the built-in download service.";
var trainer_download_failed$1 = "The trainer download failed.";
var trainer_download_too_large$1 = "The trainer exceeds the 128 MB safety limit.";
var trainer_download_invalid$1 = "The download is not a valid Windows EXE and was deleted.";
var trainer_documents_unavailable$1 = "The Documents folder cannot be written safely.";
var trainer_compat_invalid$1 = "The selected trainer compatibility layer is not in the fixed allowlist.";
var trainerFileNotSelected$1 = "No trainer file selected";
var trainerFileRequiredHint$1 = "Select an .exe or .bat file from Documents before applying the trainer launch option.";
var lsfgLauncher$1 = "Little Yellow Duck / LSFG-VK";
var lsfgLauncherDescription$1 = "Adds ~/lsfg; requires Lossless Scaling (open its gear → Properties → Betas → linux-testing, then return to the LSFG plugin and choose “Install LSFG”) and the decky-lsfg-vk plugin.";
var installLsfgPlugin$1 = "Install bundled Little Yellow Duck";
var installFsr4Plugin$1 = "Install bundled FSR4 plugin";
var requestingPluginInstall$1 = "Verifying and installing plugin…";
var pluginInstallComplete$1 = "Installed. Restart Decky Loader so the new plugin can load.";
var plugin_install_invalid$1 = "The plugin installation request is invalid.";
var plugin_install_bundled_missing$1 = "The complete DeckRecall package is missing a bundled plugin archive.";
var plugin_install_download_failed$1 = "The plugin download failed.";
var plugin_install_checksum_failed$1 = "File verification failed; nothing was installed.";
var plugin_install_archive_invalid$1 = "The plugin archive is unsafe or invalid; nothing was installed.";
var plugin_install_too_large$1 = "The plugin exceeds the safe size limit; it was not installed.";
var plugin_install_owner_failed$1 = "The installed plugin files could not be returned to the Steam Deck user; nothing was installed.";
var plugin_download_phase$1 = "Downloading";
var plugin_verify_phase$1 = "Verifying";
var plugin_install_phase$1 = "Installing";
var plugin_complete_phase$1 = "Installation complete";
var skipLauncher$1 = "Skip the game launcher";
var skipLauncherDescription$1 = "Adds the common --skip-launcher argument. Some games do not support it; turn this off and apply launch options again if it does not work.";
var fsr4Launcher$1 = "FSR4 / OptiScaler";
var fsr4LauncherDescription$1 = "Adds ~/fgmod/fgmod; requires the Decky-Framegen plugin.";
var fsr4UninstallLauncher$1 = "Game will not launch after FSR4: remove FSR4";
var fsr4UninstallLauncherDescription$1 = "Use only when a game cannot launch after FSR4 was enabled. Apply it, then run the game once so the uninstaller can remove its FSR4 patch.";
var fsr4UninstallWarning$1 = "This is a recovery option. Use it only when a game cannot launch after enabling FSR4. Run the game once to finish removal, then turn this off and apply launch options again or restore the original options.";
var applyLaunchOptions$1 = "Apply launch options";
var restoreLaunchOptions$1 = "Restore original launch options";
var previewLaunchOptions$1 = "Preview final launch options";
var repairTools$1 = "Repair tools";
var openProtontricks$2 = "Repair this game with Protontricks";
var protontricks_not_installed$1 = "Protontricks is not installed. Install it from Discover first.";
var protontricks_launch_failed$1 = "Could not start Protontricks.";
var protontricks_opened$1 = "Protontricks opened.";
var launch_options_applied$1 = "Game launch options applied.";
var launch_options_restored$1 = "Original game launch options restored.";
var invalid_launch_profile$1 = "The launch profile is invalid.";
var invalid_executable_path$1 = "Choose a valid absolute .exe or .bat path without quotes.";
var executable_required$1 = "Choose an executable for the selected launcher.";
var invalid_launch_options$1 = "Steam launch options are invalid or too long.";
var launch_options_changed$1 = "Steam launch options changed outside DeckRecall. They were not overwritten; restore or reconcile them manually first.";
var renderError$1 = "DeckRecall compatibility error";
var renderErrorHint$1 = "Please photograph the technical message below. DeckRecall contained the error so the Decky menu can remain usable.";
var compatibilityReady$1 = "The minimal Decky interface loaded successfully. Continue to test DeckRecall features.";
var loadFeatures$1 = "Load DeckRecall features";
var currentGame$1 = "Current game";
var refresh$1 = "Refresh game data";
var refreshing$1 = "Refreshing…";
var refreshRequired$1 = "Select Refresh game data before changing this game's settings.";
var launchOptions$1 = "Launch features";
var errorTitle$1 = "Error";
var gameMenuEntry$1 = "Open from game details";
var gameMenuInstructions$1 = "Open the gear / Manage menu on a Steam game details page and select DeckRecall. The game does not need to be running.";
var openRecentGame$1 = "Open recent game";
var gameSettings$1 = "Game settings";
var compatibilityTool$1 = "Compatibility tool";
var compatibilityToolDescription$1 = "Choose a commonly used Proton compatibility tool installed in Steam and available to this game.";
var installCompatibilityTools$1 = "Install Steam compatibility tools";
var steamDefaultCompat$1 = "Steam default (automatic)";
var applyCompatibilityTool$1 = "Apply compatibility tool";
var noRecommendedCompatTools$1 = "Proton Experimental, Proton 10.0-4, or GE-Proton was not detected.";
var protonExperimentalName$1 = "Proton Experimental";
var proton10Name$1 = "Proton 10.0-4";
var downloadProtonExperimental$1 = "Install / update Proton Experimental";
var downloadProton10$1 = "Install / update Proton 10.0-4";
var officialProtonDownloadHint$1 = "These buttons always open SteamOS's native installer. After you confirm, Steam handles the download and updates. Return to DeckRecall and select Refresh game data when finished. Only installed GE-Proton versions are shown.";
var officialInstallerOpened$1 = "SteamOS installer opened: {tool}";
var openTrainerCompatMenu$1 = "Install trainer compatibility layers (4 independent choices)";
var hideTrainerCompatMenu$1 = "Hide trainer compatibility menu";
var installTrainerCompatVersion$1 = "Install {version} independently";
var trainerCompatInstalling$1 = "Installing {version}…";
var trainerCompatLatestHint$1 = "For current game/trainer versions; verify per game.";
var trainerCompatOlderHint$1 = "For older game/trainer versions.";
var trainerCompatInstalled$1 = "Compatibility layer installed: {version}. Restart Steam, then refresh.";
var compat_download_phase$1 = "Downloading";
var compat_verify_phase$1 = "Verifying";
var compat_install_phase$1 = "Installing";
var compat_complete_phase$1 = "Installation complete";
var installGeProton$1 = "Download and install latest GE-Proton";
var geProtonInstalling$1 = "Downloading, verifying, and installing GE-Proton…";
var geProtonInstallHint$1 = "Uses the GE-Proton author's GitHub Release for the latest version and SHA-256, then falls back to a fixed verified version when the API is unavailable. A configured mirror is used if the download fails, and installation into Steam's compatibilitytools.d happens only after SHA-256 verification.";
var geProtonInstalled$1 = "GE-Proton installed: {version}";
var ge_proton_release_unavailable$1 = "Could not reach the GE-Proton author release or mirror.";
var ge_proton_release_invalid$1 = "GE-Proton release metadata is invalid; installation was cancelled.";
var ge_proton_download_failed$1 = "GE-Proton download failed.";
var ge_proton_download_too_large$1 = "The GE-Proton download exceeds the safe size limit.";
var ge_proton_checksum_missing$1 = "The release does not provide a GE-Proton SHA-256 checksum.";
var ge_proton_checksum_failed$1 = "GE-Proton SHA-256 verification failed; no files were installed.";
var ge_proton_archive_invalid$1 = "The GE-Proton archive is unsafe or invalid.";
var ge_proton_archive_too_large$1 = "The GE-Proton unpacked contents exceed the safe size limit.";
var ge_proton_owner_failed$1 = "Installed GE-Proton files could not be returned to the Steam Deck user.";
var steam_root_not_found$1 = "Steam's user directory was not found. Fully start Steam once, then try again.";
var virtualMemory$1 = "Virtual memory";
var memoryStatusUnknown$1 = "Virtual memory status could not be read.";
var memoryNotSupported$1 = "This device was identified, but virtual-memory changes are not supported yet.";
var memoryDetectedDevice$1 = "Detected device: {name}";
var memorySteamDeckPlan$1 = "Steam Deck plan: zram plus 8–16 GB disk swap, swappiness 1.";
var memoryRogAllyPlan$1 = "ROG Ally / Ally X on Bazzite: zram only (half RAM, max 16 GB), swappiness 180; no Steam Deck disk swap.";
var memoryRootRequired$1 = "DeckRecall is not running with root privileges; virtual memory was not changed.";
var recommendedSwap$1 = "Recommended disk swap: {size} GB";
var currentSwappiness$1 = "swappiness: {value}";
var activeSwapCount$1 = "Active swaps: {count}";
var zramCount$1 = "zram devices: {count}";
var memorySpaceInsufficient$1 = "Not enough free storage for the recommended disk swap.";
var memoryBatteryLow$1 = "Battery is below 20%; connect power before applying virtual memory.";
var memoryConfigured$1 = "DeckRecall virtual memory settings are in place.";
var memoryNotConfigured$1 = "DeckRecall virtual memory settings are not in place yet.";
var applyRecommendedMemory$2 = "Apply recommended virtual memory";
var restoreMemoryTuning$2 = "Restore system defaults";
var memoryApplying$1 = "Applying recommended virtual memory…";
var memoryRestoring$1 = "Restoring system defaults…";
var memoryOptimized$1 = "Applied: zram = half of physical RAM, {size} GB disk swap, swappiness 1. Restart to fully activate zram.";
var memoryOptimizedRogAlly$1 = "Applied the ROG Ally / Bazzite plan: zram is half RAM (max 16 GB), swappiness 180, with no disk swap. Restart to fully activate it.";
var memoryRestored$1 = "DeckRecall virtual memory settings removed; the system swap file was kept. Restart to fully complete the change.";
var memory_steamos_required$1 = "The Steam Deck plan requires SteamOS.";
var memory_device_unsupported$1 = "This device or its current operating system is not supported for virtual-memory changes yet.";
var memory_root_required$1 = "The Decky backend is not running as root, so virtual memory was not changed.";
var memory_command_missing$1 = "A required system command is missing; nothing was changed.";
var memory_backend_unavailable$1 = "The virtual-memory backend module is missing; install the complete plugin package and restart Decky.";
var memory_read_failed$1 = "Could not read the virtual memory status.";
var memory_path_invalid$1 = "A virtual memory path is unsafe; nothing was changed.";
var memory_space_insufficient$1 = "Not enough free storage for the recommended disk swap.";
var memory_battery_low$1 = "Battery is below 20%; connect power before applying virtual memory.";
var memory_config_conflict$1 = "A memory config exists that DeckRecall does not own; it was left untouched.";
var memory_swap_create_failed$1 = "The recommended disk swap could not be created safely; the previous swap was kept.";
var memory_swap_unit_failed$1 = "The swap start-up unit could not be enabled.";
var memory_apply_failed$1 = "Virtual memory application failed; the previous state was kept where possible.";
var memory_restore_failed$1 = "Removing DeckRecall virtual memory settings failed; existing files were kept.";
var enUS = {
	title: title$1,
	noGame: noGame$1,
	normal: normal$1,
	changesDetected: changesDetected$1,
	save: save$1,
	restore: restore$1,
	restoreLatestHealthyState: restoreLatestHealthyState$1,
	restoreOlderSnapshot: restoreOlderSnapshot$1,
	undo: undo$1,
	snapshots: snapshots$1,
	diagnostics: diagnostics$1,
	logs: logs$1,
	language: language$1,
	system: system$1,
	english: english$1,
	chinese: chinese$1,
	autoSnapshot: autoSnapshot$1,
	autoSnapshotDescription: autoSnapshotDescription$1,
	file_missing: file_missing$1,
	file_added: file_added$1,
	file_changed: file_changed$1,
	snapshot_created: snapshot_created$1,
	snapshot_restored: snapshot_restored$1,
	restore_undone: restore_undone$1,
	error: error$1,
	backend_error: backend_error$1,
	unknown_error: unknown_error$1,
	partial_refresh: partial_refresh$1,
	invalid_app_id: invalid_app_id$1,
	snapshot_not_found: snapshot_not_found$1,
	snapshot_integrity_failed: snapshot_integrity_failed$1,
	undo_not_found: undo_not_found$1,
	file_too_large: file_too_large$1,
	gameRunning: gameRunning$1,
	gameStopped: gameStopped$1,
	closeGameFirst: closeGameFirst$1,
	noSnapshots: noSnapshots$1,
	noActivity: noActivity$1,
	trainerLauncher: trainerLauncher$1,
	trainerLauncherDescription: trainerLauncherDescription$1,
	trainerPath: trainerPath$1,
	openFlingWebsite: openFlingWebsite$1,
	downloadLatestTrainer: downloadLatestTrainer$1,
	trainerSearching: trainerSearching$1,
	trainerDownloadStarted: trainerDownloadStarted$1,
	trainerDownloadSaved: trainerDownloadSaved$1,
	trainerDownloadStartedFallbackFailed: trainerDownloadStartedFallbackFailed$1,
	selectTrainerFile: selectTrainerFile$1,
	changeTrainerFile: changeTrainerFile$1,
	trainer_search_invalid: trainer_search_invalid$1,
	trainer_search_failed: trainer_search_failed$1,
	trainer_not_found: trainer_not_found$1,
	trainer_download_unavailable: trainer_download_unavailable$1,
	trainer_download_failed: trainer_download_failed$1,
	trainer_download_too_large: trainer_download_too_large$1,
	trainer_download_invalid: trainer_download_invalid$1,
	trainer_documents_unavailable: trainer_documents_unavailable$1,
	trainer_compat_invalid: trainer_compat_invalid$1,
	trainerFileNotSelected: trainerFileNotSelected$1,
	trainerFileRequiredHint: trainerFileRequiredHint$1,
	lsfgLauncher: lsfgLauncher$1,
	lsfgLauncherDescription: lsfgLauncherDescription$1,
	installLsfgPlugin: installLsfgPlugin$1,
	installFsr4Plugin: installFsr4Plugin$1,
	requestingPluginInstall: requestingPluginInstall$1,
	pluginInstallComplete: pluginInstallComplete$1,
	plugin_install_invalid: plugin_install_invalid$1,
	plugin_install_bundled_missing: plugin_install_bundled_missing$1,
	plugin_install_download_failed: plugin_install_download_failed$1,
	plugin_install_checksum_failed: plugin_install_checksum_failed$1,
	plugin_install_archive_invalid: plugin_install_archive_invalid$1,
	plugin_install_too_large: plugin_install_too_large$1,
	plugin_install_owner_failed: plugin_install_owner_failed$1,
	plugin_download_phase: plugin_download_phase$1,
	plugin_verify_phase: plugin_verify_phase$1,
	plugin_install_phase: plugin_install_phase$1,
	plugin_complete_phase: plugin_complete_phase$1,
	skipLauncher: skipLauncher$1,
	skipLauncherDescription: skipLauncherDescription$1,
	fsr4Launcher: fsr4Launcher$1,
	fsr4LauncherDescription: fsr4LauncherDescription$1,
	fsr4UninstallLauncher: fsr4UninstallLauncher$1,
	fsr4UninstallLauncherDescription: fsr4UninstallLauncherDescription$1,
	fsr4UninstallWarning: fsr4UninstallWarning$1,
	applyLaunchOptions: applyLaunchOptions$1,
	restoreLaunchOptions: restoreLaunchOptions$1,
	previewLaunchOptions: previewLaunchOptions$1,
	repairTools: repairTools$1,
	openProtontricks: openProtontricks$2,
	protontricks_not_installed: protontricks_not_installed$1,
	protontricks_launch_failed: protontricks_launch_failed$1,
	protontricks_opened: protontricks_opened$1,
	launch_options_applied: launch_options_applied$1,
	launch_options_restored: launch_options_restored$1,
	invalid_launch_profile: invalid_launch_profile$1,
	invalid_executable_path: invalid_executable_path$1,
	executable_required: executable_required$1,
	invalid_launch_options: invalid_launch_options$1,
	launch_options_changed: launch_options_changed$1,
	renderError: renderError$1,
	renderErrorHint: renderErrorHint$1,
	compatibilityReady: compatibilityReady$1,
	loadFeatures: loadFeatures$1,
	currentGame: currentGame$1,
	refresh: refresh$1,
	refreshing: refreshing$1,
	refreshRequired: refreshRequired$1,
	launchOptions: launchOptions$1,
	errorTitle: errorTitle$1,
	gameMenuEntry: gameMenuEntry$1,
	gameMenuInstructions: gameMenuInstructions$1,
	openRecentGame: openRecentGame$1,
	gameSettings: gameSettings$1,
	compatibilityTool: compatibilityTool$1,
	compatibilityToolDescription: compatibilityToolDescription$1,
	installCompatibilityTools: installCompatibilityTools$1,
	steamDefaultCompat: steamDefaultCompat$1,
	applyCompatibilityTool: applyCompatibilityTool$1,
	noRecommendedCompatTools: noRecommendedCompatTools$1,
	protonExperimentalName: protonExperimentalName$1,
	proton10Name: proton10Name$1,
	downloadProtonExperimental: downloadProtonExperimental$1,
	downloadProton10: downloadProton10$1,
	officialProtonDownloadHint: officialProtonDownloadHint$1,
	officialInstallerOpened: officialInstallerOpened$1,
	openTrainerCompatMenu: openTrainerCompatMenu$1,
	hideTrainerCompatMenu: hideTrainerCompatMenu$1,
	installTrainerCompatVersion: installTrainerCompatVersion$1,
	trainerCompatInstalling: trainerCompatInstalling$1,
	trainerCompatLatestHint: trainerCompatLatestHint$1,
	trainerCompatOlderHint: trainerCompatOlderHint$1,
	trainerCompatInstalled: trainerCompatInstalled$1,
	compat_download_phase: compat_download_phase$1,
	compat_verify_phase: compat_verify_phase$1,
	compat_install_phase: compat_install_phase$1,
	compat_complete_phase: compat_complete_phase$1,
	installGeProton: installGeProton$1,
	geProtonInstalling: geProtonInstalling$1,
	geProtonInstallHint: geProtonInstallHint$1,
	geProtonInstalled: geProtonInstalled$1,
	ge_proton_release_unavailable: ge_proton_release_unavailable$1,
	ge_proton_release_invalid: ge_proton_release_invalid$1,
	ge_proton_download_failed: ge_proton_download_failed$1,
	ge_proton_download_too_large: ge_proton_download_too_large$1,
	ge_proton_checksum_missing: ge_proton_checksum_missing$1,
	ge_proton_checksum_failed: ge_proton_checksum_failed$1,
	ge_proton_archive_invalid: ge_proton_archive_invalid$1,
	ge_proton_archive_too_large: ge_proton_archive_too_large$1,
	ge_proton_owner_failed: ge_proton_owner_failed$1,
	steam_root_not_found: steam_root_not_found$1,
	virtualMemory: virtualMemory$1,
	memoryStatusUnknown: memoryStatusUnknown$1,
	memoryNotSupported: memoryNotSupported$1,
	memoryDetectedDevice: memoryDetectedDevice$1,
	memorySteamDeckPlan: memorySteamDeckPlan$1,
	memoryRogAllyPlan: memoryRogAllyPlan$1,
	memoryRootRequired: memoryRootRequired$1,
	recommendedSwap: recommendedSwap$1,
	currentSwappiness: currentSwappiness$1,
	activeSwapCount: activeSwapCount$1,
	zramCount: zramCount$1,
	memorySpaceInsufficient: memorySpaceInsufficient$1,
	memoryBatteryLow: memoryBatteryLow$1,
	memoryConfigured: memoryConfigured$1,
	memoryNotConfigured: memoryNotConfigured$1,
	applyRecommendedMemory: applyRecommendedMemory$2,
	restoreMemoryTuning: restoreMemoryTuning$2,
	memoryApplying: memoryApplying$1,
	memoryRestoring: memoryRestoring$1,
	memoryOptimized: memoryOptimized$1,
	memoryOptimizedRogAlly: memoryOptimizedRogAlly$1,
	memoryRestored: memoryRestored$1,
	memory_steamos_required: memory_steamos_required$1,
	memory_device_unsupported: memory_device_unsupported$1,
	memory_root_required: memory_root_required$1,
	memory_command_missing: memory_command_missing$1,
	memory_backend_unavailable: memory_backend_unavailable$1,
	memory_read_failed: memory_read_failed$1,
	memory_path_invalid: memory_path_invalid$1,
	memory_space_insufficient: memory_space_insufficient$1,
	memory_battery_low: memory_battery_low$1,
	memory_config_conflict: memory_config_conflict$1,
	memory_swap_create_failed: memory_swap_create_failed$1,
	memory_swap_unit_failed: memory_swap_unit_failed$1,
	memory_apply_failed: memory_apply_failed$1,
	memory_restore_failed: memory_restore_failed$1
};

var title = "DeckRecall";
var noGame = "未检测到正在运行的 Steam 游戏。";
var normal = "未发现变化。";
var changesDetected = "检测到变化";
var save = "保存正常运行状态";
var restore = "安全恢复";
var restoreLatestHealthyState = "回归上一个正常运行状态";
var restoreOlderSnapshot = "恢复较早的正常状态";
var undo = "撤销恢复";
var snapshots = "状态快照";
var diagnostics = "诊断结果";
var logs = "活动日志";
var language = "语言";
var system = "跟随 Steam／系统";
var english = "English";
var chinese = "简体中文";
var autoSnapshot = "自动保存正常运行状态";
var autoSnapshotDescription = "默认开启。检测到游戏从运行变为关闭后，如尚无快照则自动保存一次。";
var file_missing = "受跟踪文件已缺失：{path}";
var file_added = "新增受跟踪文件：{path}";
var file_changed = "受跟踪文件已变更：{path}";
var snapshot_created = "已保存正常运行状态。";
var snapshot_restored = "已安全恢复快照，并创建撤销点。";
var restore_undone = "已撤销恢复。";
var error = "操作失败：{message}";
var backend_error = "后端未能完成请求。";
var unknown_error = "发生了意外错误。";
var partial_refresh = "部分数据未能读取；可用功能仍可继续使用。";
var invalid_app_id = "Steam 游戏 ID 无效。";
var snapshot_not_found = "未找到状态快照。";
var snapshot_integrity_failed = "状态快照完整性校验失败。";
var undo_not_found = "未找到撤销点。";
var file_too_large = "受跟踪的状态文件过大，无法安全创建快照。";
var gameRunning = "游戏运行中";
var gameStopped = "可以修改启动项、创建快照或恢复";
var closeGameFirst = "请先关闭游戏，再修改启动项、保存或恢复状态。";
var noSnapshots = "还没有保存状态快照。";
var noActivity = "还没有活动记录。";
var trainerLauncher = "修改器";
var trainerLauncherDescription = "可在 Steam 内置浏览器查看风灵月影官网；点“用 Steam 下载最新修改器”会调用 Steam 自带下载器并保存到 Documents。";
var trainerPath = "修改器 EXE";
var openFlingWebsite = "用 Steam 内置浏览器打开官网";
var downloadLatestTrainer = "用 Steam 下载最新修改器";
var trainerSearching = "正在官网查找当前游戏的修改器…";
var trainerDownloadStarted = "Steam 下载已启动：{title}。文件将保存到 {directory}，完成后点下方选择文件。";
var trainerDownloadSaved = "Steam 下载已调用，DeckRecall 也已安全保存 {title} 到 {directory} 并自动选中。";
var trainerDownloadStartedFallbackFailed = "Steam 下载已启动：{title}；Documents 直存兜底失败：{error}";
var selectTrainerFile = "选择下载的修改器 EXE 文件";
var changeTrainerFile = "更换修改器文件";
var trainer_search_invalid = "当前游戏名无法用于搜索。";
var trainer_search_failed = "无法连接风灵月影官网。";
var trainer_not_found = "官网未找到当前游戏的修改器。";
var trainer_download_unavailable = "当前 Steam 版本没有提供内置下载接口。";
var trainer_download_failed = "修改器下载失败。";
var trainer_download_too_large = "修改器超过 128 MB 安全上限。";
var trainer_download_invalid = "下载内容不是有效的 Windows EXE，已删除。";
var trainer_documents_unavailable = "Documents 文件夹不可安全写入。";
var trainer_compat_invalid = "所选修改器兼容层不在固定白名单中。";
var trainerFileNotSelected = "尚未选择修改器文件";
var trainerFileRequiredHint = "必须先选择 Documents 文件夹中的 .exe 或 .bat 文件，才能应用修改器启动项。";
var lsfgLauncher = "小黄鸭／LSFG-VK";
var lsfgLauncherDescription = "添加 ~/lsfg；需要 Lossless Scaling（点软件右边齿轮 → 属性 → 游戏版本及测试版 → linux-testing；随后回到 LSFG 插件点“Install LSFG”）和 decky-lsfg-vk 插件。";
var installLsfgPlugin = "离线安装小黄鸭插件";
var installFsr4Plugin = "离线安装 FSR4 插件";
var requestingPluginInstall = "正在校验并安装插件…";
var pluginInstallComplete = "已安装。请重启 Decky Loader，让新插件完成加载。";
var plugin_install_invalid = "插件安装请求无效。";
var plugin_install_bundled_missing = "DeckRecall 完整包缺少内置插件文件，请重新安装完整版。";
var plugin_install_download_failed = "插件下载失败。";
var plugin_install_checksum_failed = "文件校验失败，未安装任何内容。";
var plugin_install_archive_invalid = "插件压缩包不安全或结构无效，未安装。";
var plugin_install_too_large = "插件文件超过安全大小限制，未安装。";
var plugin_install_owner_failed = "安装后的插件文件无法归还给 Steam Deck 用户，未安装。";
var plugin_download_phase = "正在下载";
var plugin_verify_phase = "正在校验";
var plugin_install_phase = "正在安装";
var plugin_complete_phase = "安装完成";
var skipLauncher = "跳过游戏启动器";
var skipLauncherDescription = "添加常见参数 --skip-launcher。部分游戏不支持；若无效，请关闭此项并重新应用启动项。";
var fsr4Launcher = "FSR4／OptiScaler";
var fsr4LauncherDescription = "添加 ~/fgmod/fgmod；需要 Decky-Framegen 插件。";
var fsr4UninstallLauncher = "游戏启用 FSR4 后打不开时：卸载 FSR4";
var fsr4UninstallLauncherDescription = "仅在启用 FSR4 后游戏无法启动时使用。应用后运行该游戏一次，让卸载脚本清理 FSR4 补丁。";
var fsr4UninstallWarning = "这是故障恢复功能：仅当启用 FSR4 后游戏打不开时使用。启用后运行游戏一次完成卸载；随后关闭此项并重新应用启动项，或恢复原始启动项。";
var applyLaunchOptions = "应用启动项";
var restoreLaunchOptions = "恢复原始启动项";
var previewLaunchOptions = "预览最终启动项";
var repairTools = "修复工具";
var openProtontricks$1 = "用 Protontricks 修复此游戏";
var protontricks_not_installed = "未安装 Protontricks。请先在 Discover 中安装后再试。";
var protontricks_launch_failed = "无法启动 Protontricks。";
var protontricks_opened = "已打开 Protontricks。";
var launch_options_applied = "已应用游戏启动项。";
var launch_options_restored = "已恢复游戏原始启动项。";
var invalid_launch_profile = "启动配置无效。";
var invalid_executable_path = "请选择不含引号的有效绝对 .exe 或 .bat 路径。";
var executable_required = "请先为所选启动器选择可执行文件。";
var invalid_launch_options = "Steam 启动项无效或过长。";
var launch_options_changed = "Steam 启动项已被 DeckRecall 之外的程序修改，因此未覆盖；请先手动确认或恢复。";
var renderError = "DeckRecall 兼容性错误";
var renderErrorHint = "请拍下方技术信息。DeckRecall 已拦截异常，避免整个 Decky 菜单崩溃。";
var compatibilityReady = "Decky 最小界面已成功加载，请继续测试 DeckRecall 功能。";
var loadFeatures = "加载 DeckRecall 功能";
var currentGame = "当前游戏";
var refresh = "刷新游戏数据";
var refreshing = "正在刷新…";
var refreshRequired = "请先点击“刷新游戏数据”读取该游戏的设置。";
var launchOptions = "启动项功能";
var errorTitle = "错误";
var gameMenuEntry = "从游戏详情进入";
var gameMenuInstructions = "在 Steam 游戏详情页打开齿轮／管理菜单，选择 DeckRecall。无需先启动游戏。";
var openRecentGame = "打开最近游戏";
var gameSettings = "游戏设置";
var compatibilityTool = "兼容层";
var compatibilityToolDescription = "选择 Steam 已安装并为此游戏提供的常用 Proton 兼容层。";
var installCompatibilityTools = "安装 Steam 兼容层";
var steamDefaultCompat = "Steam 默认（自动选择）";
var applyCompatibilityTool = "应用兼容层";
var noRecommendedCompatTools = "未检测到 Proton Experimental、Proton 10.0-4 或 GE-Proton。";
var protonExperimentalName = "Proton Experimental";
var proton10Name = "Proton 10.0-4";
var downloadProtonExperimental = "安装／更新 Proton Experimental";
var downloadProton10 = "安装／更新 Proton 10.0-4";
var officialProtonDownloadHint = "这两个按钮始终会调用 SteamOS 原生安装界面；确认安装后，Steam 会自行下载和更新。完成后返回 DeckRecall 并点击“刷新游戏数据”。GE-Proton 只显示已经安装的版本。";
var officialInstallerOpened = "已打开 SteamOS 安装界面：{tool}";
var openTrainerCompatMenu = "安装修改器所需兼容层（4 个独立安装）";
var hideTrainerCompatMenu = "收起修改器兼容层菜单";
var installTrainerCompatVersion = "独立安装 {version}";
var trainerCompatInstalling = "正在安装 {version}…";
var trainerCompatLatestHint = "适合最新游戏版本／新修改器，仍应以具体游戏测试为准。";
var trainerCompatOlderHint = "适合旧版游戏／旧修改器。";
var trainerCompatInstalled = "兼容层已安装：{version}；重启 Steam 后刷新列表。";
var compat_download_phase = "正在下载";
var compat_verify_phase = "正在校验";
var compat_install_phase = "正在安装";
var compat_complete_phase = "安装完成";
var installGeProton = "下载并安装最新版 GE-Proton";
var geProtonInstalling = "正在下载、校验并安装 GE-Proton…";
var geProtonInstallHint = "优先从 GE-Proton 作者的 GitHub Release 获取最新版本及 SHA-256；API 不可用时回退固定已校验版本。下载失败时会使用配置的镜像回退，并且仅在 SHA-256 校验通过后安装到 Steam 的 compatibilitytools.d。";
var geProtonInstalled = "GE-Proton 已安装：{version}";
var ge_proton_release_unavailable = "无法连接 GE-Proton 作者 Release 或镜像。";
var ge_proton_release_invalid = "GE-Proton Release 元数据无效，已取消安装。";
var ge_proton_download_failed = "GE-Proton 下载失败。";
var ge_proton_download_too_large = "GE-Proton 下载文件超过安全大小限制。";
var ge_proton_checksum_missing = "Release 中未找到 GE-Proton SHA-256 校验信息。";
var ge_proton_checksum_failed = "GE-Proton SHA-256 校验失败，未安装任何文件。";
var ge_proton_archive_invalid = "GE-Proton 压缩包内容不安全或无效。";
var ge_proton_archive_too_large = "GE-Proton 解压内容超过安全大小限制。";
var ge_proton_owner_failed = "已安装的 GE-Proton 文件无法归还给 Steam Deck 用户。";
var steam_root_not_found = "未找到 Steam 用户目录；请先完整启动 Steam 一次后重试。";
var virtualMemory = "虚拟内存";
var memoryStatusUnknown = "无法读取虚拟内存状态。";
var memoryNotSupported = "已识别该机型，但暂不支持修改虚拟内存。";
var memoryDetectedDevice = "检测到机型：{name}";
var memorySteamDeckPlan = "Steam Deck 方案：zram + 8–16 GB 磁盘 swap，swappiness 1。";
var memoryRogAllyPlan = "ROG Ally／Ally X 的 Bazzite 方案：仅配置 zram（半内存、最高 16 GB）和 swappiness 180，不创建 Steam Deck 磁盘 swap。";
var memoryRootRequired = "DeckRecall 未以管理员权限运行，未修改虚拟内存。";
var recommendedSwap = "推荐磁盘 swap：{size} GB";
var currentSwappiness = "swappiness：{value}";
var activeSwapCount = "启用中的 swap：{count}";
var zramCount = "zram 设备：{count}";
var memorySpaceInsufficient = "内部存储空间不足以创建推荐的磁盘 swap。";
var memoryBatteryLow = "电量低于 20%，请连接电源后再调整虚拟内存。";
var memoryConfigured = "DeckRecall 虚拟内存设置已生效。";
var memoryNotConfigured = "尚未应用 DeckRecall 虚拟内存设置。";
var applyRecommendedMemory$1 = "一键应用推荐虚拟内存";
var restoreMemoryTuning$1 = "恢复系统默认设置";
var memoryApplying = "正在应用推荐虚拟内存…";
var memoryRestoring = "正在恢复系统默认设置…";
var memoryOptimized = "已应用：zram 为物理内存一半、{size} GB 磁盘 swap、swappiness 1；重启后 zram 完全生效。";
var memoryOptimizedRogAlly = "已应用 ROG Ally／Bazzite 方案：zram 为物理内存一半（最高 16 GB）、swappiness 180，不创建磁盘 swap；重启后完全生效。";
var memoryRestored = "已撤销 DeckRecall 虚拟内存设置，系统原 swap 已保留；重启后完全生效。";
var memory_steamos_required = "Steam Deck 方案需要 SteamOS。";
var memory_device_unsupported = "该机型或其当前系统暂不支持修改虚拟内存。";
var memory_root_required = "Decky 后端未以管理员权限运行，未修改虚拟内存。";
var memory_command_missing = "缺少必要的系统命令，未修改任何内容。";
var memory_backend_unavailable = "虚拟内存后端模块缺失；请安装完整插件包并重启 Decky。";
var memory_read_failed = "无法读取虚拟内存状态。";
var memory_path_invalid = "虚拟内存路径不安全，未修改任何内容。";
var memory_space_insufficient = "可用空间不足，无法创建推荐的磁盘 swap。";
var memory_battery_low = "电量低于 20%，请连接电源后再调整虚拟内存。";
var memory_config_conflict = "检测到并非 DeckRecall 管理的内存配置，已保留原文件。";
var memory_swap_create_failed = "推荐磁盘 swap 创建失败，已保留原 swap。";
var memory_swap_unit_failed = "磁盘 swap 开机配置启用失败。";
var memory_apply_failed = "虚拟内存应用失败，已尽可能保留原状态。";
var memory_restore_failed = "撤销虚拟内存设置失败，已保留现有文件。";
var zhCN = {
	title: title,
	noGame: noGame,
	normal: normal,
	changesDetected: changesDetected,
	save: save,
	restore: restore,
	restoreLatestHealthyState: restoreLatestHealthyState,
	restoreOlderSnapshot: restoreOlderSnapshot,
	undo: undo,
	snapshots: snapshots,
	diagnostics: diagnostics,
	logs: logs,
	language: language,
	system: system,
	english: english,
	chinese: chinese,
	autoSnapshot: autoSnapshot,
	autoSnapshotDescription: autoSnapshotDescription,
	file_missing: file_missing,
	file_added: file_added,
	file_changed: file_changed,
	snapshot_created: snapshot_created,
	snapshot_restored: snapshot_restored,
	restore_undone: restore_undone,
	error: error,
	backend_error: backend_error,
	unknown_error: unknown_error,
	partial_refresh: partial_refresh,
	invalid_app_id: invalid_app_id,
	snapshot_not_found: snapshot_not_found,
	snapshot_integrity_failed: snapshot_integrity_failed,
	undo_not_found: undo_not_found,
	file_too_large: file_too_large,
	gameRunning: gameRunning,
	gameStopped: gameStopped,
	closeGameFirst: closeGameFirst,
	noSnapshots: noSnapshots,
	noActivity: noActivity,
	trainerLauncher: trainerLauncher,
	trainerLauncherDescription: trainerLauncherDescription,
	trainerPath: trainerPath,
	openFlingWebsite: openFlingWebsite,
	downloadLatestTrainer: downloadLatestTrainer,
	trainerSearching: trainerSearching,
	trainerDownloadStarted: trainerDownloadStarted,
	trainerDownloadSaved: trainerDownloadSaved,
	trainerDownloadStartedFallbackFailed: trainerDownloadStartedFallbackFailed,
	selectTrainerFile: selectTrainerFile,
	changeTrainerFile: changeTrainerFile,
	trainer_search_invalid: trainer_search_invalid,
	trainer_search_failed: trainer_search_failed,
	trainer_not_found: trainer_not_found,
	trainer_download_unavailable: trainer_download_unavailable,
	trainer_download_failed: trainer_download_failed,
	trainer_download_too_large: trainer_download_too_large,
	trainer_download_invalid: trainer_download_invalid,
	trainer_documents_unavailable: trainer_documents_unavailable,
	trainer_compat_invalid: trainer_compat_invalid,
	trainerFileNotSelected: trainerFileNotSelected,
	trainerFileRequiredHint: trainerFileRequiredHint,
	lsfgLauncher: lsfgLauncher,
	lsfgLauncherDescription: lsfgLauncherDescription,
	installLsfgPlugin: installLsfgPlugin,
	installFsr4Plugin: installFsr4Plugin,
	requestingPluginInstall: requestingPluginInstall,
	pluginInstallComplete: pluginInstallComplete,
	plugin_install_invalid: plugin_install_invalid,
	plugin_install_bundled_missing: plugin_install_bundled_missing,
	plugin_install_download_failed: plugin_install_download_failed,
	plugin_install_checksum_failed: plugin_install_checksum_failed,
	plugin_install_archive_invalid: plugin_install_archive_invalid,
	plugin_install_too_large: plugin_install_too_large,
	plugin_install_owner_failed: plugin_install_owner_failed,
	plugin_download_phase: plugin_download_phase,
	plugin_verify_phase: plugin_verify_phase,
	plugin_install_phase: plugin_install_phase,
	plugin_complete_phase: plugin_complete_phase,
	skipLauncher: skipLauncher,
	skipLauncherDescription: skipLauncherDescription,
	fsr4Launcher: fsr4Launcher,
	fsr4LauncherDescription: fsr4LauncherDescription,
	fsr4UninstallLauncher: fsr4UninstallLauncher,
	fsr4UninstallLauncherDescription: fsr4UninstallLauncherDescription,
	fsr4UninstallWarning: fsr4UninstallWarning,
	applyLaunchOptions: applyLaunchOptions,
	restoreLaunchOptions: restoreLaunchOptions,
	previewLaunchOptions: previewLaunchOptions,
	repairTools: repairTools,
	openProtontricks: openProtontricks$1,
	protontricks_not_installed: protontricks_not_installed,
	protontricks_launch_failed: protontricks_launch_failed,
	protontricks_opened: protontricks_opened,
	launch_options_applied: launch_options_applied,
	launch_options_restored: launch_options_restored,
	invalid_launch_profile: invalid_launch_profile,
	invalid_executable_path: invalid_executable_path,
	executable_required: executable_required,
	invalid_launch_options: invalid_launch_options,
	launch_options_changed: launch_options_changed,
	renderError: renderError,
	renderErrorHint: renderErrorHint,
	compatibilityReady: compatibilityReady,
	loadFeatures: loadFeatures,
	currentGame: currentGame,
	refresh: refresh,
	refreshing: refreshing,
	refreshRequired: refreshRequired,
	launchOptions: launchOptions,
	errorTitle: errorTitle,
	gameMenuEntry: gameMenuEntry,
	gameMenuInstructions: gameMenuInstructions,
	openRecentGame: openRecentGame,
	gameSettings: gameSettings,
	compatibilityTool: compatibilityTool,
	compatibilityToolDescription: compatibilityToolDescription,
	installCompatibilityTools: installCompatibilityTools,
	steamDefaultCompat: steamDefaultCompat,
	applyCompatibilityTool: applyCompatibilityTool,
	noRecommendedCompatTools: noRecommendedCompatTools,
	protonExperimentalName: protonExperimentalName,
	proton10Name: proton10Name,
	downloadProtonExperimental: downloadProtonExperimental,
	downloadProton10: downloadProton10,
	officialProtonDownloadHint: officialProtonDownloadHint,
	officialInstallerOpened: officialInstallerOpened,
	openTrainerCompatMenu: openTrainerCompatMenu,
	hideTrainerCompatMenu: hideTrainerCompatMenu,
	installTrainerCompatVersion: installTrainerCompatVersion,
	trainerCompatInstalling: trainerCompatInstalling,
	trainerCompatLatestHint: trainerCompatLatestHint,
	trainerCompatOlderHint: trainerCompatOlderHint,
	trainerCompatInstalled: trainerCompatInstalled,
	compat_download_phase: compat_download_phase,
	compat_verify_phase: compat_verify_phase,
	compat_install_phase: compat_install_phase,
	compat_complete_phase: compat_complete_phase,
	installGeProton: installGeProton,
	geProtonInstalling: geProtonInstalling,
	geProtonInstallHint: geProtonInstallHint,
	geProtonInstalled: geProtonInstalled,
	ge_proton_release_unavailable: ge_proton_release_unavailable,
	ge_proton_release_invalid: ge_proton_release_invalid,
	ge_proton_download_failed: ge_proton_download_failed,
	ge_proton_download_too_large: ge_proton_download_too_large,
	ge_proton_checksum_missing: ge_proton_checksum_missing,
	ge_proton_checksum_failed: ge_proton_checksum_failed,
	ge_proton_archive_invalid: ge_proton_archive_invalid,
	ge_proton_archive_too_large: ge_proton_archive_too_large,
	ge_proton_owner_failed: ge_proton_owner_failed,
	steam_root_not_found: steam_root_not_found,
	virtualMemory: virtualMemory,
	memoryStatusUnknown: memoryStatusUnknown,
	memoryNotSupported: memoryNotSupported,
	memoryDetectedDevice: memoryDetectedDevice,
	memorySteamDeckPlan: memorySteamDeckPlan,
	memoryRogAllyPlan: memoryRogAllyPlan,
	memoryRootRequired: memoryRootRequired,
	recommendedSwap: recommendedSwap,
	currentSwappiness: currentSwappiness,
	activeSwapCount: activeSwapCount,
	zramCount: zramCount,
	memorySpaceInsufficient: memorySpaceInsufficient,
	memoryBatteryLow: memoryBatteryLow,
	memoryConfigured: memoryConfigured,
	memoryNotConfigured: memoryNotConfigured,
	applyRecommendedMemory: applyRecommendedMemory$1,
	restoreMemoryTuning: restoreMemoryTuning$1,
	memoryApplying: memoryApplying,
	memoryRestoring: memoryRestoring,
	memoryOptimized: memoryOptimized,
	memoryOptimizedRogAlly: memoryOptimizedRogAlly,
	memoryRestored: memoryRestored,
	memory_steamos_required: memory_steamos_required,
	memory_device_unsupported: memory_device_unsupported,
	memory_root_required: memory_root_required,
	memory_command_missing: memory_command_missing,
	memory_backend_unavailable: memory_backend_unavailable,
	memory_read_failed: memory_read_failed,
	memory_path_invalid: memory_path_invalid,
	memory_space_insufficient: memory_space_insufficient,
	memory_battery_low: memory_battery_low,
	memory_config_conflict: memory_config_conflict,
	memory_swap_create_failed: memory_swap_create_failed,
	memory_swap_unit_failed: memory_swap_unit_failed,
	memory_apply_failed: memory_apply_failed,
	memory_restore_failed: memory_restore_failed
};

function resolveLanguage(preference, steamLanguage) {
    if (preference !== "system")
        return preference;
    const browserLanguage = typeof navigator !== "undefined" && typeof navigator.language === "string" ? navigator.language : "en-US";
    return (steamLanguage || browserLanguage).toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
}
function translate(language, key, values = {}) {
    const dictionary = language === "zh-CN" ? zhCN : enUS;
    const fallback = enUS;
    return (dictionary[key] || fallback[key] || key).replace(/\{(\w+)\}/g, (_match, name) => values[name] ?? `{${name}}`);
}

const EMPTY_PROFILE = {
    trainer_enabled: false, trainer_path: "", lsfg_enabled: false, fsr4_enabled: false, fsr4_uninstall_enabled: false, skip_launcher_enabled: false,
    original_options: "", managed_options: ""
};
function validateLaunchProfile(profile) {
    if (!profile.trainer_enabled)
        return;
    if (!profile.trainer_path)
        throw new Error("executable_required");
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
function rebaseLaunchProfile(currentOptions, profile) {
    const originalOptions = profile.managed_options && currentOptions === profile.managed_options
        ? profile.original_options
        : currentOptions;
    return { ...profile, original_options: originalOptions, managed_options: "" };
}
/** Compose CheatDeck-compatible layers without rewriting the user's original options. */
function buildLaunchOptions(original, profile) {
    validateLaunchProfile(profile);
    const environment = [];
    const prefixes = [];
    if (profile.trainer_enabled) {
        const directory = profile.trainer_path.replace(/\/[^/]+$/, "");
        environment.push(`PROTON_REMOTE_DEBUG_CMD="'${profile.trainer_path}'"`);
        environment.push(`PRESSURE_VESSEL_FILESYSTEMS_RW="${directory}"`);
    }
    if (profile.lsfg_enabled)
        prefixes.push("~/lsfg");
    if (profile.fsr4_uninstall_enabled) {
        prefixes.push("~/fgmod/fgmod-uninstaller.sh");
    }
    else if (profile.fsr4_enabled) {
        prefixes.push("~/fgmod/fgmod");
    }
    if (!environment.length && !prefixes.length && !profile.skip_launcher_enabled)
        return original.trim();
    const base = original.trim();
    const skipLauncher = profile.skip_launcher_enabled && !/(?:^|\s)--skip-launcher(?:\s|$)/.test(base) ? " --skip-launcher" : "";
    const command = base.includes("%command%")
        ? (prefixes.length ? base.replace("%command%", `${prefixes.join(" -- ")} %command%`) : base)
        : `${prefixes.length ? `${prefixes.join(" -- ")} ` : ""}%command%${base ? ` ${base}` : ""}`;
    return `${environment.join(" ")}${environment.length ? " " : ""}${command}${skipLauncher}`;
}

function isRecord$1(value) {
    return typeof value === "object" && value !== null;
}
function asNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function asBoolean(value) {
    return typeof value === "boolean" ? value : undefined;
}
function normalizeSwap(value) {
    if (!isRecord$1(value) || typeof value.name !== "string" || typeof value.type !== "string")
        return undefined;
    return {
        name: value.name,
        type: value.type,
        size_kib: asNumber(value.size_kib),
        used_kib: asNumber(value.used_kib),
        priority: asNumber(value.priority),
    };
}
function normalizeMemoryStatus(value) {
    if (!isRecord$1(value))
        return undefined;
    const managed = isRecord$1(value.managed) ? value.managed : {};
    return {
        steamos: value.steamos === true,
        device: isRecord$1(value.device) ? {
            family: value.device.family === "steam_deck" || value.device.family === "rog_ally" ? value.device.family : "other",
            name: typeof value.device.name === "string" ? value.device.name : "Unknown",
            supported: value.device.supported === true,
            profile: typeof value.device.profile === "string" ? value.device.profile : "unsupported",
        } : { family: "other", name: "Unknown", supported: false, profile: "unsupported" },
        root: value.root === true,
        recommended_swap_gib: asNumber(value.recommended_swap_gib),
        swappiness: asNumber(value.swappiness),
        swaps: Array.isArray(value.swaps) ? value.swaps.map(normalizeSwap).filter((swap) => !!swap) : [],
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
function memoryTuningConfigured(status) {
    return !!status && Object.values(status.managed).some(Boolean);
}

function booleanLike(value) {
    if (typeof value === "boolean")
        return value;
    if (typeof value === "number")
        return value > 0;
    if (typeof value === "string") {
        const normalized = value.toLowerCase();
        if (["true", "running", "1", "yes"].includes(normalized))
            return true;
        if (["false", "stopped", "0", "no", "none"].includes(normalized))
            return false;
    }
    if (value && typeof value === "object") {
        for (const key of ["running", "bRunning", "isRunning", "bIsRunning", "result"]) {
            if (key in value) {
                const nested = booleanLike(value[key]);
                if (typeof nested === "boolean")
                    return nested;
            }
        }
    }
    return undefined;
}
function runningFromObject(value) {
    if (!value)
        return undefined;
    for (const methodName of ["BIsRunning", "BIsAppRunning", "BIsPlaying", "IsRunning", "IsAppRunning", "GetIsRunning"]) {
        try {
            if (typeof value[methodName] === "function") {
                const result = booleanLike(value[methodName].call(value));
                if (typeof result === "boolean")
                    return result;
            }
        }
        catch {
            // Try the next SteamUI method.
        }
    }
    for (const fieldName of ["bRunning", "m_bRunning", "isRunning", "running", "bIsRunning", "m_bIsRunning", "bPlaying", "m_bPlaying", "nRunning"]) {
        if (fieldName in value) {
            const result = booleanLike(value[fieldName]);
            if (typeof result === "boolean")
                return result;
        }
    }
    return undefined;
}
function runningFromList(value, appId) {
    if (!Array.isArray(value))
        return undefined;
    return value.some((item) => Number(item?.appid ?? item?.app_id ?? item?.unAppID ?? item?.nAppID ?? item) === appId);
}
async function safeMethod(owner, methodName, appId) {
    try {
        if (typeof owner?.[methodName] !== "function")
            return undefined;
        const value = owner[methodName].call(owner, appId);
        return booleanLike(value && typeof value.then === "function" ? await value : value);
    }
    catch {
        return undefined;
    }
}
async function safeList(owner, methodName, appId) {
    try {
        if (typeof owner?.[methodName] !== "function")
            return undefined;
        const value = owner[methodName].call(owner);
        return runningFromList(value && typeof value.then === "function" ? await value : value, appId);
    }
    catch {
        return undefined;
    }
}
async function readAppRunningState(appId) {
    const steam = globalThis;
    const appStore = steam.appStore;
    const apps = steam.SteamClient?.Apps;
    for (const methodName of ["BIsAppRunning", "IsAppRunning", "GetAppRunning", "GetAppRunState"]) {
        const storeResult = await safeMethod(appStore, methodName, appId);
        if (typeof storeResult === "boolean")
            return storeResult;
        const clientResult = await safeMethod(apps, methodName, appId);
        if (typeof clientResult === "boolean")
            return clientResult;
    }
    for (const methodName of ["GetRunningAppIDs", "GetRunningApps", "GetRunningAppIds", "GetRunningAppIDList"]) {
        const storeResult = await safeList(appStore, methodName, appId);
        if (typeof storeResult === "boolean")
            return storeResult;
        const clientResult = await safeList(apps, methodName, appId);
        if (typeof clientResult === "boolean")
            return clientResult;
        const sessionResult = await safeList(steam.SteamClient?.GameSessions, methodName, appId);
        if (typeof sessionResult === "boolean")
            return sessionResult;
    }
    try {
        const overview = appStore?.GetAppOverviewByAppID?.(appId);
        const overviewResult = runningFromObject(overview);
        if (typeof overviewResult === "boolean")
            return overviewResult;
        const appData = steam.appDetailsStore?.GetAppData?.(appId);
        for (const candidate of [appData, appData?.details, appData?.overview, appData?.appinfo, appData?.appInfo]) {
            const result = runningFromObject(candidate);
            if (typeof result === "boolean")
                return result;
        }
    }
    catch {
        return undefined;
    }
    return undefined;
}

const getDiagnostics = callable("get_diagnostics");
const createSnapshot = callable("create_snapshot");
const listSnapshots = callable("list_snapshots");
const restoreSnapshot = callable("restore_snapshot");
const undoRestore = callable("undo_restore");
const getEvents = callable("get_events");
const getLaunchProfile = callable("get_launch_profile");
const saveLaunchProfile = callable("save_launch_profile");
const installLatestGeProton = callable("install_latest_ge_proton");
const openProtontricks = callable("open_protontricks");
const prepareTrainerDownload = callable("prepare_trainer_download");
const downloadTrainerToDocuments = callable("download_trainer_to_documents");
const installChinesePlugin = callable("install_chinese_plugin");
const installTrainerCompat = callable("install_trainer_compat");
const getMemoryStatus = callable("get_memory_status");
const applyRecommendedMemory = callable("apply_recommended_memory");
const restoreMemoryTuning = callable("restore_memory_tuning");
const GAME_KEY = "deckRecall.lastGame";
const LANGUAGE_KEY = "deckRecall.language";
const AUTO_SNAPSHOT_KEY = "deckRecall.autoSnapshot";
const ERROR_CODES = ["backend_error", "unknown_error", "invalid_app_id", "snapshot_not_found", "snapshot_integrity_failed", "undo_not_found", "file_too_large", "invalid_launch_profile", "invalid_executable_path", "executable_required", "invalid_launch_options", "launch_options_changed", "steam_root_not_found", "trainer_search_invalid", "trainer_search_failed", "trainer_not_found", "trainer_download_unavailable", "trainer_download_failed", "trainer_download_too_large", "trainer_download_invalid", "trainer_documents_unavailable", "trainer_compat_invalid", "protontricks_not_installed", "protontricks_launch_failed", "ge_proton_release_unavailable", "ge_proton_release_invalid", "ge_proton_download_failed", "ge_proton_download_too_large", "ge_proton_checksum_missing", "ge_proton_checksum_failed", "ge_proton_archive_invalid", "ge_proton_archive_too_large", "ge_proton_owner_failed", "plugin_install_invalid", "plugin_install_bundled_missing", "plugin_install_download_failed", "plugin_install_checksum_failed", "plugin_install_archive_invalid", "plugin_install_too_large", "plugin_install_owner_failed", "memory_steamos_required", "memory_device_unsupported", "memory_root_required", "memory_command_missing", "memory_read_failed", "memory_backend_unavailable", "memory_path_invalid", "memory_space_insufficient", "memory_battery_low", "memory_config_conflict", "memory_swap_create_failed", "memory_swap_unit_failed", "memory_apply_failed", "memory_restore_failed"];
function currentSteamLanguage() {
    try {
        const language = globalThis.SteamClient?.Settings?.GetCurrentLanguage?.();
        return typeof language === "string" ? language : undefined;
    }
    catch {
        return undefined;
    }
}
function activeGame() {
    try {
        const steam = globalThis;
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
    }
    catch (error) {
        console.warn("[DeckRecall] Active-game detection failed", error);
    }
    return undefined;
}
function gameFromAppId(appId) {
    if (!/^[1-9]\d{0,9}$/.test(appId))
        return undefined;
    try {
        const overview = globalThis.appStore?.GetAppOverviewByAppID?.(Number(appId));
        const displayName = overview?.display_name ?? overview?.displayName ?? overview?.strDisplayName;
        return { id: appId, name: typeof displayName === "string" && displayName ? displayName : `Steam ${appId}` };
    }
    catch {
        return { id: appId, name: `Steam ${appId}` };
    }
}
const automaticSnapshotInFlight = new Set();
function installAutomaticSnapshotMonitor() {
    const seenRunning = new Set();
    try {
        return globalThis.SteamClient?.GameSessions?.RegisterForAppLifetimeNotifications?.((notification) => {
            const appId = String(notification?.unAppID ?? "");
            if (!/^[1-9]\d{0,9}$/.test(appId) || typeof notification?.bRunning !== "boolean")
                return;
            if (notification.bRunning) {
                seenRunning.add(appId);
                return;
            }
            if (!seenRunning.delete(appId) || storageGet(AUTO_SNAPSHOT_KEY) === "false" || automaticSnapshotInFlight.has(appId))
                return;
            const game = gameFromAppId(appId);
            if (!game)
                return;
            automaticSnapshotInFlight.add(appId);
            void (async () => {
                try {
                    const snapshots = normalizeSnapshots(await withTimeout(listSnapshots(appId)));
                    if (!snapshots.length)
                        await withTimeout(createSnapshot(appId, game.name));
                }
                catch (error) {
                    console.warn("[DeckRecall] Automatic healthy-state snapshot failed", error);
                }
                finally {
                    automaticSnapshotInFlight.delete(appId);
                }
            })();
        }) ?? {};
    }
    catch (error) {
        console.warn("[DeckRecall] Automatic snapshot monitor unavailable", error);
        return {};
    }
}
function storageGet(key) {
    try {
        return globalThis.localStorage?.getItem(key) ?? null;
    }
    catch {
        return null;
    }
}
function storageSet(key, value) {
    try {
        globalThis.localStorage?.setItem(key, value);
    }
    catch (error) {
        console.warn("[DeckRecall] Could not persist UI state", error);
    }
}
function loadLastGame() {
    try {
        const value = JSON.parse(storageGet(GAME_KEY) || "null");
        return value && /^[1-9]\d{0,9}$/.test(value.id) && typeof value.name === "string" ? value : undefined;
    }
    catch {
        return undefined;
    }
}
function normalizeError(error) {
    const message = error instanceof Error ? error.message : String(error);
    return ERROR_CODES.find((code) => message.includes(code)) || "unknown_error";
}
function withTimeout(promise, timeoutMs = 6000) {
    return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error("backend_error")), timeoutMs);
        promise.then((value) => { window.clearTimeout(timer); resolve(value); }, (error) => { window.clearTimeout(timer); reject(error); });
    });
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function normalizeDiagnostic(value) {
    if (!isRecord(value))
        return undefined;
    const changes = Array.isArray(value.changes)
        ? value.changes.filter((change) => isRecord(change) && typeof change.code === "string" && typeof change.path === "string")
        : [];
    return {
        app_id: typeof value.app_id === "string" ? value.app_id : "",
        baseline_exists: value.baseline_exists === true,
        status: typeof value.status === "string" ? value.status : "unknown",
        changes,
    };
}
function normalizeSnapshots(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((snapshot) => isRecord(snapshot)
        && typeof snapshot.id === "string"
        && typeof snapshot.created_at === "string"
        && typeof snapshot.game_name === "string");
}
function normalizeEvents(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((event) => isRecord(event)
        && typeof event.at === "string"
        && typeof event.code === "string");
}
function normalizeLaunchProfile(value) {
    if (!isRecord(value))
        return { ...EMPTY_PROFILE };
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
function launchProfileKey(appId) {
    return `deckRecall.launchProfile.${appId}`;
}
function loadLocalLaunchProfile(appId) {
    try {
        return normalizeLaunchProfile(JSON.parse(storageGet(launchProfileKey(appId)) || "null"));
    }
    catch {
        return { ...EMPTY_PROFILE };
    }
}
function saveLocalLaunchProfile(appId, profile) {
    storageSet(launchProfileKey(appId), JSON.stringify(profile));
}
function readAppDetails(appId) {
    return new Promise((resolve, reject) => {
        let registration;
        const timeout = window.setTimeout(() => {
            registration?.unregister();
            reject(new Error("backend_error"));
        }, 3000);
        const finish = (details) => {
            window.clearTimeout(timeout);
            registration?.unregister();
            resolve({
                strLaunchOptions: typeof details?.strLaunchOptions === "string" ? details.strLaunchOptions : "",
                strCompatToolName: typeof details?.strCompatToolName === "string" ? details.strCompatToolName : "",
                strCompatToolDisplayName: typeof details?.strCompatToolDisplayName === "string" ? details.strCompatToolDisplayName : "",
            });
        };
        try {
            const apps = globalThis.SteamClient?.Apps;
            if (typeof apps?.RegisterForAppDetails !== "function")
                throw new Error("backend_error");
            registration = apps.RegisterForAppDetails(Number(appId), (details) => {
                if (details && typeof details === "object")
                    finish(details);
            });
        }
        catch (error) {
            window.clearTimeout(timeout);
            reject(error);
        }
    });
}
async function readLaunchOptions(appId) {
    return (await readAppDetails(appId)).strLaunchOptions;
}
async function chooseExecutable(startPath) {
    let result;
    try {
        result = await openFilePicker(0 /* FileSelectionType.FILE */, startPath || "/home/deck/Documents", true, true, undefined, undefined, false, true);
    }
    catch {
        return undefined;
    }
    const path = typeof result?.path === "string" ? result.path : typeof result?.realpath === "string" ? result.realpath : "";
    if (!/\.(?:exe|bat)$/i.test(path))
        throw new Error("invalid_executable_path");
    return path;
}
function openOfficialProtonInstaller(appIds) {
    const installs = globalThis.SteamClient?.Installs;
    if (typeof installs?.OpenInstallWizard !== "function")
        throw new Error("backend_error");
    return installs.OpenInstallWizard(appIds);
}
const pendingOfficialProtonInstalls = new Set();
let officialProtonInstallTimer;
let officialProtonInstallWaiters = [];
/** Steam accepts one installer dialog at a time. Batch rapid taps into one dialog. */
function queueOfficialProtonInstaller(appId) {
    pendingOfficialProtonInstalls.add(appId);
    return new Promise((resolve, reject) => {
        officialProtonInstallWaiters.push({ resolve, reject });
        if (officialProtonInstallTimer !== undefined)
            window.clearTimeout(officialProtonInstallTimer);
        officialProtonInstallTimer = window.setTimeout(() => {
            const appIds = [...pendingOfficialProtonInstalls];
            const waiters = officialProtonInstallWaiters;
            pendingOfficialProtonInstalls.clear();
            officialProtonInstallWaiters = [];
            officialProtonInstallTimer = undefined;
            Promise.resolve().then(() => openOfficialProtonInstaller(appIds)).then(() => waiters.forEach((waiter) => waiter.resolve()), (error) => waiters.forEach((waiter) => waiter.reject(error)));
        }, 650);
    });
}
function MemoryTuningPanel({ t }) {
    const [status, setStatus] = SP_REACT.useState();
    const [busy, setBusy] = SP_REACT.useState(false);
    const [feedback, setFeedback] = SP_REACT.useState("");
    const [memoryError, setMemoryError] = SP_REACT.useState("");
    const refreshMemory = async (silent = false) => {
        if (!silent)
            setBusy(true);
        setMemoryError("");
        try {
            setStatus(normalizeMemoryStatus(await withTimeout(getMemoryStatus(), 8000)));
        }
        catch (nextError) {
            setMemoryError(t(normalizeError(nextError)));
        }
        finally {
            if (!silent)
                setBusy(false);
        }
    };
    SP_REACT.useEffect(() => {
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
        }
        catch (nextError) {
            setMemoryError(t(normalizeError(nextError)));
        }
        finally {
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
        }
        catch (nextError) {
            setMemoryError(t(normalizeError(nextError)));
        }
        finally {
            setBusy(false);
        }
    };
    const ready = status?.device.supported === true && status?.root === true;
    const configured = memoryTuningConfigured(status);
    return SP_JSX.jsxs(DFL.PanelSection, { title: t("virtualMemory"), children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy, onClick: () => void refreshMemory(), children: t("refresh") }) }), !status && !memoryError ? SP_JSX.jsx(DFL.PanelSectionRow, { children: t("memoryStatusUnknown") }) : null, status ? SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { children: t("memoryDetectedDevice", { name: status.device.name }) }) }), !status.device.supported && SP_JSX.jsx(DFL.PanelSectionRow, { children: t("memoryNotSupported") }), status.device.supported && !status.root && SP_JSX.jsx(DFL.PanelSectionRow, { children: t("memoryRootRequired") }), status.device.family === "steam_deck" && SP_JSX.jsx(DFL.PanelSectionRow, { children: t("memorySteamDeckPlan") }), status.device.family === "rog_ally" && SP_JSX.jsx(DFL.PanelSectionRow, { children: t("memoryRogAllyPlan") }), status.recommended_swap_gib !== undefined && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { children: t("recommendedSwap", { size: String(status.recommended_swap_gib) }) }) }), status.swappiness !== undefined && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { children: t("currentSwappiness", { value: String(status.swappiness) }) }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs("div", { children: [t("activeSwapCount", { count: String(status.swaps.length) }), " \u00B7 ", t("zramCount", { count: String(status.zram_count) })] }) }), status.space_kib !== undefined && status.required_kib !== undefined && status.space_kib < status.required_kib && SP_JSX.jsx(DFL.PanelSectionRow, { children: t("memorySpaceInsufficient") }), status.power_ok === false && SP_JSX.jsx(DFL.PanelSectionRow, { children: t("memoryBatteryLow") }), SP_JSX.jsx(DFL.PanelSectionRow, { children: configured ? t("memoryConfigured") : t("memoryNotConfigured") })] }) : null, SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || !ready, onClick: () => void applyMemory(), children: busy ? t("memoryApplying") : t("applyRecommendedMemory") }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || !ready, onClick: () => void restoreMemory(), children: busy ? t("memoryRestoring") : t("restoreMemoryTuning") }) }), feedback && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { color: "#7dd3fc", fontWeight: 600 }, children: feedback }) }), memoryError && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { color: "#f5d547", fontWeight: 600 }, children: memoryError }) })] });
}
function GameContent({ appId }) {
    const savedLanguage = storageGet(LANGUAGE_KEY);
    const initialLanguage = savedLanguage === "en-US" || savedLanguage === "zh-CN" ? savedLanguage : "system";
    const [preference, setPreference] = SP_REACT.useState(initialLanguage);
    const language = SP_REACT.useMemo(() => resolveLanguage(preference, currentSteamLanguage()), [preference]);
    const t = (key, values) => translate(language, key, values);
    const selectedGame = gameFromAppId(appId);
    const [game, setGame] = SP_REACT.useState(selectedGame);
    const [running, setRunning] = SP_REACT.useState(false);
    const [diagnostic, setDiagnostic] = SP_REACT.useState();
    const [snapshots, setSnapshots] = SP_REACT.useState([]);
    const [events, setEvents] = SP_REACT.useState([]);
    const [undoId, setUndoId] = SP_REACT.useState();
    const [error, setError] = SP_REACT.useState();
    const [busy, setBusy] = SP_REACT.useState(false);
    const [launchProfile, setLaunchProfile] = SP_REACT.useState(() => loadLocalLaunchProfile(appId));
    const [compatTools, setCompatTools] = SP_REACT.useState(BUILTIN_COMPAT_TOOLS);
    const [selectedCompatTool, setSelectedCompatTool] = SP_REACT.useState("");
    const [currentCompatDisplayName, setCurrentCompatDisplayName] = SP_REACT.useState("");
    const [compatToolsLoaded, setCompatToolsLoaded] = SP_REACT.useState(false);
    const [officialInstallerOpened, setOfficialInstallerOpened] = SP_REACT.useState();
    const [installingGe, setInstallingGe] = SP_REACT.useState(false);
    const [geStatus, setGeStatus] = SP_REACT.useState("");
    const [trainerDownloadStatus, setTrainerDownloadStatus] = SP_REACT.useState("");
    const [downloadingTrainer, setDownloadingTrainer] = SP_REACT.useState(false);
    const [requestingPluginInstall, setRequestingPluginInstall] = SP_REACT.useState();
    const [pluginInstallStatus, setPluginInstallStatus] = SP_REACT.useState("");
    const [pluginInstallProgress, setPluginInstallProgress] = SP_REACT.useState();
    const [showTrainerCompat, setShowTrainerCompat] = SP_REACT.useState(false);
    const [installingTrainerCompat, setInstallingTrainerCompat] = SP_REACT.useState();
    const [trainerCompatProgress, setTrainerCompatProgress] = SP_REACT.useState({});
    const [trainerCompatStatus, setTrainerCompatStatus] = SP_REACT.useState("");
    const [launchPreview, setLaunchPreview] = SP_REACT.useState("");
    const [autoSnapshot, setAutoSnapshot] = SP_REACT.useState(() => storageGet(AUTO_SNAPSHOT_KEY) !== "false");
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
            if (diagnosticResult.status === "fulfilled")
                setDiagnostic(normalizeDiagnostic(diagnosticResult.value));
            if (snapshotsResult.status === "fulfilled")
                setSnapshots(normalizeSnapshots(snapshotsResult.value));
            if (eventsResult.status === "fulfilled")
                setEvents(normalizeEvents(eventsResult.value));
            if (profileResult.status === "fulfilled" && isRecord(profileResult.value)) {
                const profile = normalizeLaunchProfile(profileResult.value);
                setLaunchProfile(profile);
                saveLocalLaunchProfile(selected.id, profile);
            }
            else {
                setLaunchProfile(loadLocalLaunchProfile(selected.id));
            }
            try {
                const apps = globalThis.SteamClient?.Apps;
                const [tools, details] = await withTimeout(Promise.all([
                    typeof apps?.GetAvailableCompatTools === "function" ? apps.GetAvailableCompatTools(Number(selected.id)) : Promise.resolve([]),
                    readAppDetails(selected.id),
                ]), 4000);
                setCompatTools(mergeCompatTools(BUILTIN_COMPAT_TOOLS, normalizeCompatTools(tools)));
                setCompatToolsLoaded(true);
                setSelectedCompatTool(details.strCompatToolName);
                setCurrentCompatDisplayName(details.strCompatToolDisplayName);
            }
            catch (compatError) {
                console.warn("[DeckRecall] Could not read compatibility tools", compatError);
                setCompatTools([]);
                setCompatToolsLoaded(false);
            }
            const failedBackendReads = [diagnosticResult, snapshotsResult, eventsResult, profileResult]
                .filter((result) => result.status === "rejected").length;
            // A background read must not leave a frightening permanent error at the
            // bottom of the page. Direct snapshot/restore operations still surface
            // their own errors when the user explicitly invokes them.
            if (failedBackendReads)
                console.warn("[DeckRecall] Some background backend reads failed", failedBackendReads);
        }
        catch (nextError) {
            setError(normalizeError(nextError));
        }
        finally {
            setBusy(false);
        }
    };
    SP_REACT.useEffect(() => {
        void refresh();
        try {
            const registration = globalThis.SteamClient?.GameSessions?.RegisterForAppLifetimeNotifications?.((notification) => {
                if (Number(notification?.unAppID) === Number(appId) && typeof notification?.bRunning === "boolean") {
                    setRunning(notification.bRunning);
                }
            });
            return () => registration?.unregister?.();
        }
        catch {
            return undefined;
        }
    }, [appId]);
    const action = async (operation) => {
        setBusy(true);
        setError(undefined);
        try {
            return await operation();
        }
        catch (nextError) {
            setError(normalizeError(nextError));
            return undefined;
        }
        finally {
            setBusy(false);
        }
    };
    const refreshAfter = async (operation) => {
        const result = await action(operation);
        await refresh();
        return result;
    };
    const applyLaunchProfile = async () => {
        if (!game)
            return;
        await action(async () => {
            const currentOptions = await readLaunchOptions(game.id);
            const proposed = rebaseLaunchProfile(currentOptions, launchProfile);
            const managedOptions = buildLaunchOptions(proposed.original_options, proposed);
            const saved = { ...proposed, managed_options: managedOptions };
            const apps = globalThis.SteamClient?.Apps;
            if (typeof apps?.SetAppLaunchOptions !== "function")
                throw new Error("backend_error");
            await Promise.resolve(apps.SetAppLaunchOptions(Number(game.id), managedOptions));
            saveLocalLaunchProfile(game.id, saved);
            try {
                await withTimeout(saveLaunchProfile(game.id, saved));
            }
            catch (profileError) {
                console.warn("[DeckRecall] Launch profile saved locally only", profileError);
            }
            setLaunchProfile(saved);
        });
    };
    const previewLaunchProfile = async () => {
        if (!game)
            return;
        await action(async () => {
            const currentOptions = await readLaunchOptions(game.id);
            const proposed = rebaseLaunchProfile(currentOptions, launchProfile);
            setLaunchPreview(buildLaunchOptions(proposed.original_options, proposed));
        });
    };
    const restoreLaunchOptions = async () => {
        if (!game || !launchProfile.managed_options)
            return;
        await action(async () => {
            const currentOptions = await readLaunchOptions(game.id);
            if (currentOptions !== launchProfile.managed_options) {
                const externallyChanged = { ...launchProfile, trainer_enabled: false, lsfg_enabled: false, fsr4_enabled: false, fsr4_uninstall_enabled: false, skip_launcher_enabled: false, original_options: "", managed_options: "" };
                saveLocalLaunchProfile(game.id, externallyChanged);
                try {
                    await withTimeout(saveLaunchProfile(game.id, externallyChanged));
                }
                catch (profileError) {
                    console.warn("[DeckRecall] Externally changed profile saved locally only", profileError);
                }
                setLaunchProfile(externallyChanged);
                return;
            }
            const apps = globalThis.SteamClient?.Apps;
            if (typeof apps?.SetAppLaunchOptions !== "function")
                throw new Error("backend_error");
            await Promise.resolve(apps.SetAppLaunchOptions(Number(game.id), launchProfile.original_options));
            const restored = { ...launchProfile, trainer_enabled: false, lsfg_enabled: false, fsr4_enabled: false, fsr4_uninstall_enabled: false, skip_launcher_enabled: false, original_options: "", managed_options: "" };
            saveLocalLaunchProfile(game.id, restored);
            try {
                await withTimeout(saveLaunchProfile(game.id, restored));
            }
            catch (profileError) {
                console.warn("[DeckRecall] Restored profile saved locally only", profileError);
            }
            setLaunchProfile(restored);
        });
    };
    const applyCompatTool = async () => {
        if (!game)
            return;
        await action(async () => {
            const apps = globalThis.SteamClient?.Apps;
            if (typeof apps?.SpecifyCompatTool !== "function")
                throw new Error("backend_error");
            await Promise.resolve(apps.SpecifyCompatTool(Number(game.id), selectedCompatTool));
            const selected = compatTools.find((tool) => tool.strToolName === selectedCompatTool);
            setCurrentCompatDisplayName(selected?.strDisplayName || "");
        });
    };
    const requestOfficialProtonInstall = async (toolAppId, toolName) => {
        try {
            await queueOfficialProtonInstaller(toolAppId);
            setOfficialInstallerOpened(toolName);
            toaster.toast({
                title: "DeckRecall",
                body: t("officialInstallerOpened", { tool: toolName }),
                duration: 4000,
                showToast: true,
            });
        }
        catch (nextError) {
            setError(normalizeError(nextError));
        }
    };
    const installGeProton = async () => {
        setInstallingGe(true);
        setGeStatus("");
        try {
            const result = await installLatestGeProton();
            setGeStatus(t("geProtonInstalled", { version: result.version }));
        }
        catch (nextError) {
            setGeStatus(t(normalizeError(nextError)));
        }
        finally {
            setInstallingGe(false);
        }
    };
    const requestDeckyPluginInstall = async (kind) => {
        setRequestingPluginInstall(kind);
        setPluginInstallStatus("");
        setPluginInstallProgress({ phase: "plugin_download_phase", percent: 0 });
        try {
            await installChinesePlugin(kind);
            setPluginInstallStatus(t("pluginInstallComplete"));
        }
        catch (nextError) {
            console.warn("[DeckRecall] Could not install Chinese plugin", nextError);
            setPluginInstallStatus(t(normalizeError(nextError)));
        }
        finally {
            setRequestingPluginInstall(undefined);
        }
    };
    const downloadLatestTrainer = async () => {
        if (!game)
            return;
        setDownloadingTrainer(true);
        setTrainerDownloadStatus(t("trainerSearching"));
        setError(undefined);
        try {
            const result = await withTimeout(prepareTrainerDownload(game.name), 45000);
            const browser = globalThis.SteamClient?.Browser;
            if (typeof browser?.StartDownload !== "function")
                throw new Error("trainer_download_unavailable");
            browser.StartDownload(result.url);
            try {
                const saved = await withTimeout(downloadTrainerToDocuments(game.name), 180000);
                setLaunchProfile({ ...launchProfile, trainer_path: saved.path });
                setTrainerDownloadStatus(t("trainerDownloadSaved", { title: saved.title, directory: saved.directory }));
            }
            catch (fallbackError) {
                setTrainerDownloadStatus(t("trainerDownloadStartedFallbackFailed", { title: result.title, error: t(normalizeError(fallbackError)) }));
            }
        }
        catch (nextError) {
            const code = normalizeError(nextError);
            setTrainerDownloadStatus(t(code));
        }
        finally {
            setDownloadingTrainer(false);
        }
    };
    const installOneTrainerCompat = async (version) => {
        setInstallingTrainerCompat(version);
        setTrainerCompatStatus("");
        setTrainerCompatProgress((current) => ({ ...current, [version]: { phase: "compat_download_phase", percent: 0 } }));
        try {
            const result = await installTrainerCompat(version);
            setTrainerCompatStatus(t("trainerCompatInstalled", { version: result.version }));
        }
        catch (nextError) {
            setTrainerCompatStatus(t(normalizeError(nextError)));
        }
        finally {
            setInstallingTrainerCompat(undefined);
        }
    };
    SP_REACT.useEffect(() => {
        const listener = addEventListener("plugin_install_progress", (kind, phase, percent) => {
            if ((kind === "lsfg" || kind === "fsr4") && typeof phase === "string" && typeof percent === "number") {
                setPluginInstallProgress({ phase, percent });
            }
        });
        return () => removeEventListener("plugin_install_progress", listener);
    }, []);
    SP_REACT.useEffect(() => {
        const listener = addEventListener("trainer_compat_progress", (version, phase, percent) => {
            if (typeof version === "string" && typeof phase === "string" && typeof percent === "number") {
                setTrainerCompatProgress((current) => ({ ...current, [version]: { phase, percent } }));
            }
        });
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
    return SP_JSX.jsxs(DFL.Focusable, { style: { display: "flex", flexDirection: "column" }, children: [SP_JSX.jsxs(DFL.PanelSection, { title: t("language"), children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.DropdownItem, { label: t("language"), selectedOption: preference, rgOptions: [
                                { label: t("system"), data: "system" },
                                { label: t("english"), data: "en-US" },
                                { label: t("chinese"), data: "zh-CN" },
                            ], onChange: ({ data }) => {
                                const value = data;
                                storageSet(LANGUAGE_KEY, value);
                                setPreference(value);
                            } }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ToggleField, { label: t("autoSnapshot"), description: t("autoSnapshotDescription"), checked: autoSnapshot, disabled: busy, onChange: (enabled) => {
                                storageSet(AUTO_SNAPSHOT_KEY, enabled ? "true" : "false");
                                setAutoSnapshot(enabled);
                            } }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ToggleField, { label: t("skipLauncher"), description: t("skipLauncherDescription"), bottomSeparator: "standard", disabled: busy || running, checked: launchProfile.skip_launcher_enabled === true, onChange: (enabled) => setLaunchProfile({ ...launchProfile, skip_launcher_enabled: enabled }) }) })] }), SP_JSX.jsxs(DFL.PanelSection, { title: t("currentGame"), children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy, onClick: () => void refresh(), children: busy ? t("refreshing") : t("refresh") }) }), !compatToolsLoaded && !busy && SP_JSX.jsx(DFL.PanelSectionRow, { children: t("refreshRequired") }), !game ? SP_JSX.jsx(DFL.PanelSectionRow, { children: t("noGame") }) : SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs("div", { children: [game.name, SP_JSX.jsx("div", { style: { opacity: 0.7 }, children: running ? t("gameRunning") : t("gameStopped") })] }) }), running && SP_JSX.jsx(DFL.PanelSectionRow, { children: t("closeGameFirst") })] })] }), game && SP_JSX.jsxs(DFL.PanelSection, { title: t("compatibilityTool"), children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.DropdownItem, { label: t("compatibilityTool"), description: t("compatibilityToolDescription"), disabled: busy || running, selectedOption: selectedCompatTool, rgOptions: compatOptions, onChange: ({ data }) => setSelectedCompatTool(typeof data === "string" ? data : "") }) }), compatToolsLoaded && recommendedCompatTools.length === 0 && SP_JSX.jsx(DFL.PanelSectionRow, { children: t("noRecommendedCompatTools") }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy, onClick: () => requestOfficialProtonInstall(PROTON_EXPERIMENTAL_APP_ID, t("protonExperimentalName")), children: t("downloadProtonExperimental") }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy, onClick: () => requestOfficialProtonInstall(PROTON_10_APP_ID, t("proton10Name")), children: t("downloadProton10") }) }), officialInstallerOpened && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { color: "#7dd3fc", fontWeight: 600 }, children: t("officialInstallerOpened", { tool: officialInstallerOpened }) }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: () => setShowTrainerCompat(!showTrainerCompat), children: showTrainerCompat ? t("hideTrainerCompatMenu") : t("openTrainerCompatMenu") }) }), showTrainerCompat && ["GE-Proton7-55", "GE-Proton8-25", "GE-Proton9-27", "GE-Proton10-29"].map((version) => {
                        const progress = trainerCompatProgress[version];
                        return SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs("div", { style: { width: "100%" }, children: [SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: !!installingTrainerCompat, onClick: () => void installOneTrainerCompat(version), children: installingTrainerCompat === version ? t("trainerCompatInstalling", { version }) : t("installTrainerCompatVersion", { version }) }), SP_JSX.jsx("div", { style: { fontSize: "12px", opacity: 0.78, marginTop: "5px" }, children: version === "GE-Proton10-29" ? t("trainerCompatLatestHint") : t("trainerCompatOlderHint") }), progress && SP_JSX.jsxs("div", { style: { marginTop: "7px" }, children: [SP_JSX.jsxs("div", { style: { marginBottom: "4px" }, children: [t(progress.phase), " ", progress.percent, "%"] }), SP_JSX.jsx("div", { style: { height: "8px", borderRadius: "4px", background: "rgba(255,255,255,0.18)", overflow: "hidden" }, children: SP_JSX.jsx("div", { style: { height: "100%", width: `${Math.max(2, progress.percent)}%`, background: "#67c1f5", transition: "width 0.25s ease" } }) })] })] }) }, version);
                    }), trainerCompatStatus && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { color: "#7dd3fc", fontWeight: 600 }, children: trainerCompatStatus }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || installingGe, onClick: () => void installGeProton(), children: installingGe ? t("geProtonInstalling") : t("installGeProton") }) }), geStatus && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { color: "#7dd3fc", fontWeight: 600 }, children: geStatus }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || running, onClick: () => void applyCompatTool(), children: t("applyCompatibilityTool") }) })] }), game && SP_JSX.jsxs(DFL.PanelSection, { title: t("launchOptions"), children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ToggleField, { label: t("trainerLauncher"), description: t("trainerLauncherDescription"), bottomSeparator: "standard", disabled: busy || running, checked: launchProfile.trainer_enabled, onChange: (enabled) => setLaunchProfile({ ...launchProfile, trainer_enabled: enabled }) }) }), launchProfile.trainer_enabled && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs("div", { style: { width: "100%" }, children: [SP_JSX.jsx("div", { style: { fontWeight: 600, marginBottom: "8px" }, children: t("trainerPath") }), SP_JSX.jsx("div", { style: {
                                        background: "rgba(0, 0, 0, 0.25)",
                                        borderRadius: "4px",
                                        padding: "10px",
                                        marginBottom: "8px",
                                        fontFamily: launchProfile.trainer_path ? "monospace" : undefined,
                                        overflowWrap: "anywhere",
                                        color: launchProfile.trainer_path ? "inherit" : "#f5d547",
                                        fontWeight: launchProfile.trainer_path ? 400 : 600,
                                    }, children: launchProfile.trainer_path || t("trainerFileNotSelected") }), !launchProfile.trainer_path && SP_JSX.jsx("div", { style: { color: "#f5d547", marginBottom: "8px" }, children: t("trainerFileRequiredHint") }), SP_JSX.jsxs(DFL.ButtonItem, { layout: "below", disabled: busy || running, onClick: async () => {
                                        try {
                                            const selected = await chooseExecutable(launchProfile.trainer_path.replace(/\/[^/]+$/, ""));
                                            if (selected) {
                                                setError(undefined);
                                                setLaunchProfile({ ...launchProfile, trainer_path: selected });
                                            }
                                        }
                                        catch (nextError) {
                                            setError(normalizeError(nextError));
                                        }
                                    }, children: [SP_JSX.jsx(FaFolderOpen, { style: { marginRight: "8px" } }), launchProfile.trainer_path ? t("changeTrainerFile") : t("selectTrainerFile")] })] }) }), launchProfile.trainer_enabled && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: () => {
                                const query = game?.name ? `?s=${encodeURIComponent(game.name)}` : "";
                                DFL.Navigation.NavigateToExternalWeb(`https://flingtrainer.com/${query}`);
                            }, children: t("openFlingWebsite") }) }), launchProfile.trainer_enabled && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || running || downloadingTrainer, onClick: () => void downloadLatestTrainer(), children: downloadingTrainer ? t("trainerSearching") : t("downloadLatestTrainer") }) }), launchProfile.trainer_enabled && trainerDownloadStatus && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { color: "#7dd3fc", fontWeight: 600, overflowWrap: "anywhere" }, children: trainerDownloadStatus }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ToggleField, { label: t("lsfgLauncher"), description: t("lsfgLauncherDescription"), bottomSeparator: "standard", disabled: busy || running, checked: launchProfile.lsfg_enabled, onChange: (enabled) => setLaunchProfile({ ...launchProfile, lsfg_enabled: enabled }) }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || running || !!requestingPluginInstall, onClick: () => void requestDeckyPluginInstall("lsfg"), children: requestingPluginInstall === "lsfg" ? t("requestingPluginInstall") : t("installLsfgPlugin") }) }), pluginInstallStatus && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { color: "#7dd3fc", fontWeight: 600 }, children: pluginInstallStatus }) }), requestingPluginInstall && pluginInstallProgress && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs("div", { style: { width: "100%" }, children: [SP_JSX.jsxs("div", { style: { marginBottom: "6px" }, children: [t(pluginInstallProgress.phase), " ", pluginInstallProgress.percent, "%"] }), SP_JSX.jsx("div", { style: { height: "8px", borderRadius: "4px", background: "rgba(255,255,255,0.18)", overflow: "hidden" }, children: SP_JSX.jsx("div", { style: { height: "100%", width: `${Math.max(2, pluginInstallProgress.percent)}%`, background: "#67c1f5", transition: "width 0.25s ease" } }) })] }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ToggleField, { label: t("fsr4Launcher"), description: t("fsr4LauncherDescription"), bottomSeparator: "standard", disabled: busy || running, checked: launchProfile.fsr4_enabled, onChange: (enabled) => setLaunchProfile({ ...launchProfile, fsr4_enabled: enabled, fsr4_uninstall_enabled: enabled ? false : launchProfile.fsr4_uninstall_enabled }) }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || running || !!requestingPluginInstall, onClick: () => void requestDeckyPluginInstall("fsr4"), children: requestingPluginInstall === "fsr4" ? t("requestingPluginInstall") : t("installFsr4Plugin") }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ToggleField, { label: t("fsr4UninstallLauncher"), description: t("fsr4UninstallLauncherDescription"), bottomSeparator: "standard", disabled: busy || running, checked: launchProfile.fsr4_uninstall_enabled, onChange: (enabled) => setLaunchProfile({ ...launchProfile, fsr4_uninstall_enabled: enabled, fsr4_enabled: enabled ? false : launchProfile.fsr4_enabled }) }) }), launchProfile.fsr4_uninstall_enabled && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { color: "#f5d547", fontWeight: 600 }, children: t("fsr4UninstallWarning") }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || running, onClick: () => void applyLaunchProfile(), children: t("applyLaunchOptions") }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || running, onClick: () => void previewLaunchProfile(), children: t("previewLaunchOptions") }) }), launchPreview && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontFamily: "monospace", fontSize: "11px", overflowWrap: "anywhere" }, children: launchPreview }) }), launchProfile.managed_options && SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontFamily: "monospace", fontSize: "11px", overflowWrap: "anywhere" }, children: launchProfile.managed_options }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || running, onClick: () => void restoreLaunchOptions(), children: t("restoreLaunchOptions") }) })] })] }), game && SP_JSX.jsxs(DFL.PanelSection, { title: t("snapshots"), children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || running, onClick: () => void refreshAfter(() => createSnapshot(game.id, game.name)), children: t("save") }) }), snapshots.length === 0 && SP_JSX.jsx(DFL.PanelSectionRow, { children: t("noSnapshots") }), snapshots[0] && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || running, onClick: async () => {
                                const result = await refreshAfter(() => restoreSnapshot(game.id, snapshots[0].id));
                                if (result && isRecord(result) && typeof result.undo_id === "string")
                                    setUndoId(result.undo_id);
                            }, children: t("restoreLatestHealthyState") }) }), snapshots.map((snapshot) => SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs(DFL.ButtonItem, { layout: "below", disabled: busy || running, onClick: async () => {
                                const result = await refreshAfter(() => restoreSnapshot(game.id, snapshot.id));
                                if (result && isRecord(result) && typeof result.undo_id === "string")
                                    setUndoId(result.undo_id);
                            }, children: [t("restoreOlderSnapshot"), " \u00B7 ", new Date(snapshot.created_at).toLocaleString(language)] }) }, snapshot.id)), undoId && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || running, onClick: () => void refreshAfter(() => undoRestore(game.id, undoId)), children: t("undo") }) })] }), game && SP_JSX.jsx(DFL.PanelSection, { title: t("repairTools"), children: SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || running, onClick: () => void action(() => openProtontricks(game.id)), children: t("openProtontricks") }) }) }), SP_JSX.jsx(MemoryTuningPanel, { t: t }), game && SP_JSX.jsxs(DFL.PanelSection, { title: t("diagnostics"), children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { children: diagnostic?.changes?.length
                                ? diagnostic.changes.map((change) => SP_JSX.jsx("div", { children: t(change.code, { path: change.path }) }, `${change.code}:${change.path}`))
                                : SP_JSX.jsx("div", { children: t("normal") }) }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs("div", { children: [t("logs"), ": ", events.length
                                    ? events.slice(-3).reverse().map((event, index) => SP_JSX.jsx("div", { children: t(event.code) }, `${event.at}:${event.code}:${index}`))
                                    : SP_JSX.jsx("div", { children: t("noActivity") })] }) })] }), error && SP_JSX.jsx(DFL.PanelSection, { title: t("errorTitle"), children: SP_JSX.jsx(DFL.PanelSectionRow, { children: t("error", { message: t(error) }) }) })] });
}
class DeckRecallErrorBoundary extends SP_REACT.Component {
    state = {};
    static getDerivedStateFromError(error) { return { error }; }
    componentDidCatch(error, info) { console.error("[DeckRecall] Render failure", error, info); }
    render() {
        if (!this.state.error)
            return this.props.children;
        const language = resolveLanguage("system", currentSteamLanguage());
        return SP_JSX.jsxs("div", { style: { padding: "16px", overflowWrap: "anywhere" }, children: [SP_JSX.jsx("h3", { children: translate(language, "renderError") }), SP_JSX.jsx("p", { children: translate(language, "renderErrorHint") }), SP_JSX.jsxs("pre", { style: { whiteSpace: "pre-wrap" }, children: [this.state.error.name, ": ", this.state.error.message] })] });
    }
}
function QuickAccessContent() {
    const savedLanguage = storageGet(LANGUAGE_KEY);
    const initialLanguage = savedLanguage === "en-US" || savedLanguage === "zh-CN" ? savedLanguage : "system";
    const [preference, setPreference] = SP_REACT.useState(initialLanguage);
    const language = SP_REACT.useMemo(() => resolveLanguage(preference, currentSteamLanguage()), [preference]);
    const t = (key, values = {}) => translate(language, key, values);
    const recentGame = activeGame() || loadLastGame();
    const [officialInstallerOpened, setOfficialInstallerOpened] = SP_REACT.useState("");
    const [installingGe, setInstallingGe] = SP_REACT.useState(false);
    const [geStatus, setGeStatus] = SP_REACT.useState("");
    const requestOfficialProtonInstall = async (toolAppId, toolName) => {
        try {
            await queueOfficialProtonInstaller(toolAppId);
            setOfficialInstallerOpened(toolName);
            toaster.toast({
                title: "DeckRecall",
                body: t("officialInstallerOpened", { tool: toolName }),
                duration: 4000,
                showToast: true,
            });
        }
        catch (error) {
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
        }
        catch (error) {
            const code = normalizeError(error);
            setGeStatus(t(code));
            toaster.toast({ title: "DeckRecall", body: t(code), duration: 5000, showToast: true });
        }
        finally {
            setInstallingGe(false);
        }
    };
    return SP_JSX.jsxs(DFL.Focusable, { style: { display: "flex", flexDirection: "column" }, children: [SP_JSX.jsx(DFL.PanelSection, { title: t("language"), children: SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.DropdownItem, { label: t("language"), selectedOption: preference, rgOptions: [
                            { label: t("system"), data: "system" },
                            { label: t("english"), data: "en-US" },
                            { label: t("chinese"), data: "zh-CN" },
                        ], onChange: ({ data }) => {
                            const value = data;
                            storageSet(LANGUAGE_KEY, value);
                            setPreference(value);
                        } }) }) }), SP_JSX.jsxs(DFL.PanelSection, { title: t("installCompatibilityTools"), children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: () => requestOfficialProtonInstall(PROTON_EXPERIMENTAL_APP_ID, t("protonExperimentalName")), children: t("downloadProtonExperimental") }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: () => requestOfficialProtonInstall(PROTON_10_APP_ID, t("proton10Name")), children: t("downloadProton10") }) }), officialInstallerOpened && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { color: "#7dd3fc", fontWeight: 600 }, children: t("officialInstallerOpened", { tool: officialInstallerOpened }) }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: installingGe, onClick: () => void installGeProton(), children: installingGe ? t("geProtonInstalling") : t("installGeProton") }) }), geStatus && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { color: "#7dd3fc", fontWeight: 600 }, children: geStatus }) })] }), SP_JSX.jsx(MemoryTuningPanel, { t: t }), SP_JSX.jsxs(DFL.PanelSection, { title: t("gameMenuEntry"), children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: t("gameMenuInstructions") }), recentGame && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs(DFL.ButtonItem, { layout: "below", onClick: () => DFL.Navigation.Navigate(`/deckrecall/${recentGame.id}`), children: [t("openRecentGame"), " \u00B7 ", recentGame.name] }) })] })] });
}
function PageRouter() {
    const params = DFL.useParams();
    const appId = String(params.appid ?? "");
    const language = resolveLanguage("system", currentSteamLanguage());
    if (!/^[1-9]\d{0,9}$/.test(appId)) {
        return SP_JSX.jsx("div", { style: { padding: "24px" }, children: translate(language, "invalid_app_id") });
    }
    return SP_JSX.jsx(DFL.SidebarNavigation, { title: "DeckRecall", showTitle: true, pages: [{
                title: translate(language, "gameSettings"),
                content: SP_JSX.jsx(DeckRecallErrorBoundary, { children: SP_JSX.jsx(GameContent, { appId: appId }) }),
                icon: SP_JSX.jsx(FaHistory, {}),
                hideTitle: false,
            }] });
}
var index = DFL.definePlugin(() => {
    routerHook.addRoute("/deckrecall/:appid", PageRouter, { exact: true });
    const contextMenuPatch = installGameContextMenuPatch();
    const automaticSnapshotMonitor = installAutomaticSnapshotMonitor();
    return {
        title: SP_JSX.jsx("div", { className: DFL.staticClasses.Title, children: "DeckRecall" }),
        content: SP_JSX.jsx(DeckRecallErrorBoundary, { children: SP_JSX.jsx(QuickAccessContent, {}) }),
        icon: SP_JSX.jsx(FaHistory, {}),
        onDismount() {
            contextMenuPatch.unpatch();
            automaticSnapshotMonitor.unregister?.();
            routerHook.removeRoute("/deckrecall/:appid");
        },
    };
});

export { index as default };
//# sourceMappingURL=index.js.map
