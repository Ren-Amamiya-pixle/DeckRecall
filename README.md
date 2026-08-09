# DeckRecall

An independent [Decky Loader](https://decky.xyz/) plugin for SteamOS that remembers a known-good Steam game compatibility state, reports later changes, and restores it with a one-step undo.

## First-version scope

- Detects the active Steam game in the Decky frontend (with a safe "no game" state when Steam does not expose one).
- Saves a per-app baseline of Steam's app manifest and Proton `user.reg` compatibility state.
- Compares current file hashes to the most recent baseline and returns structured diagnostic codes.
- Restores only those allowlisted files, checks backup integrity, and creates an undo snapshot first.
- Provides full Simplified Chinese and English strings for UI, diagnostics and activity logs. The default follows Steam/system language; it can be overridden in settings.
- Manages composable per-game trainer, LSFG-VK (Little Yellow Duck), and FSR4/OptiScaler launch presets while preserving the original Steam launch options.
- Adds a DeckRecall entry to each Steam game's gear/manage menu, so settings can be changed without launching the game first.
- Supports Proton-launched non-Steam shortcuts for launch presets, compatibility-tool selection, and their `compatdata` registry snapshot. A non-Steam shortcut normally has no `appmanifest.acf`; DeckRecall records that absence and never creates one.
- Selects from installed Proton Experimental, Proton 10.0-4, and GE-Proton compatibility tools, with an option to return to Steam's automatic default.
- Adjusts virtual memory with one click to the recommended zram + disk swap + swappiness combination, and removes only DeckRecall-managed settings while preserving the system swap file.

## Game launch presets

- **Trainer** links to [flingtrainer.com](https://flingtrainer.com/), starts the file picker in `/home/deck/Documents` (Steam's built-in browser default), and launches the selected Windows `.exe` or `.bat` with Proton's remote-debug command support.
- **Little Yellow Duck / LSFG-VK** adds `~/lsfg`; it requires Lossless Scaling and the `decky-lsfg-vk` plugin.
- **FSR4 / OptiScaler** adds `~/fgmod/fgmod`; it requires the `Decky-Framegen` plugin and the appropriate FSR4 runtime configured there.
- Chinese LSFG/FSR plugin bundles are downloaded directly as individual archives through ghfast, with resumable transfers, live progress, SHA-256 verification, and direct GitHub fallback.
- **Fully remove FSR4 / OptiScaler** replaces the normal FSR4 wrapper with Decky-Framegen's `~/fgmod/fgmod-uninstaller.sh %command%`. Apply it and run the affected game once to remove its patch; then turn the option off and apply again, or restore the original launch options.
- All three options are independent and can be composed into one launch command, using `--` between wrapper commands.
- DeckRecall records the exact original launch options before its first change. “Restore original launch options” puts them back verbatim.
- If another tool or the user changes or clears Steam launch options after DeckRecall applies a preset, DeckRecall treats the current value as a new baseline and safely rebuilds the selected DeckRecall layers on top of it.

## Compatibility tools

- DeckRecall reads the compatibility tools Steam exposes for the selected game and offers Proton Experimental, Proton 10.0-4, installed GE-Proton versions, and Steam's automatic default.
- DeckRecall always provides native SteamOS install/update actions for Proton Experimental (Steam app 1493710) and Proton 10.0 (Steam app 3658110), even before the compatibility-tool list has loaded. Steam remains responsible for licensing, storage selection, download progress, updates, and integrity checks.
- GE-Proton is third-party software. DeckRecall reads the author's newest GitHub Release SHA-256 digest, falls back to a pinned verified version if the API is unavailable, uses the toolbox's fixed GitHub mirror fallback list for the archive, and safely installs it to Steam's `compatibilitytools.d` directory only after verification.

## Virtual memory

DeckRecall's Quick Access panel reads the current virtual-memory state and can apply a recommended combination: zram sized to half of physical RAM with priority 100, an 8-16 GB disk swap with priority 10, and `vm.swappiness = 1`.

The backend needs Decky's root flag, which DeckRecall requests through `plugin.json`. Only files whose managed line is `# Managed by DeckRecall` are replaced or removed. If a system memory config was created by another tool, DeckRecall leaves it untouched. Restore disables DeckRecall's swap unit, removes only DeckRecall's zram, sysctl and fallback swap files, and never deletes SteamOS's original `/home/swapfile`.

## Safety model

Snapshot APIs accept only a numeric Steam app ID and game display name. They cannot receive a filesystem path. The backend has a fixed per-app snapshot allowlist in `backend/main.py`; snapshots remain under Decky's plugin runtime directory. Restore validates snapshot IDs and SHA-256 checksums before atomically replacing a file. User-selected launcher executables are stored only as launch-profile values and are never read, copied, modified, or executed by the backend.

## Development

Install frontend dependencies and build:

```sh
npm install
npm run build
```

Run backend tests:

```sh
npm test
```

Build an installable ZIP:

```sh
npm run package
```

## Install on SteamOS / Decky Loader

1. Build the frontend with `npm install && npm run build`, or use the committed `dist/index.js` release build.
2. Copy this repository into Decky Loader's plugin directory as `DeckRecall`, preserving `main.py`, `backend/main.py`, `backend/memory.py`, `backend/__init__.py`, `dist/index.js`, `plugin.json`, and `package.json`. Decky uses `package.json` to select the ESM plugin loader.
3. Restart Decky Loader. Since v0.2.1 the backend runs with root privileges and adds new APIs, so replacing plugin files without a restart leaves the old backend loaded. After restarting, open a Steam game's gear/manage menu and select DeckRecall; the Quick Access entry also links to the most recently configured game.

DeckRecall is a Decky Loader plugin for SteamOS; it is not a standalone desktop application.
