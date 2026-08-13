# DeckRecall

DeckRecall 0.4.2 fixes system `curl` under Decky Loader's PyInstaller runtime:

- restores the host library path only for system `curl` subprocesses, avoiding `_MEI` OpenSSL conflicts on current SteamOS;
- keeps the existing Gitee chunks, GitHub fallbacks, proxy settings, size limits, SHA-256 verification, extraction checks, and installation behavior unchanged.

DeckRecall 0.4.1 fixes SteamOS downloads and the Windows EXE picker:

- uses the system `curl` certificate store instead of Decky's broken embedded Python certificate chain;
- downloads DeckRecall, Chinese plugin bundles, fixed trainer compatibility layers, and the latest GE-Proton from fixed Gitee manifests/chunks first, with vetted GitHub fallbacks;
- verifies expected sizes and the complete upstream SHA-256 before any archive is installed;
- moves the latest GE-Proton download into the persistent backend queue;
- opens an EXE-only picker that accepts both Decky `path` and `realpath` results, and reports picker failures visibly.

DeckRecall 0.4 adds a guided Windows EXE workflow for Steam Deck:

- choose an installer EXE and run it as a Steam non-Steam shortcut with Proton;
- scan only that shortcut's fixed Proton prefix after installation and rank newly created EXEs;
- confirm the real program, reuse the same prefix, and create a Steam desktop shortcut;
- scan extracted games under Downloads, Documents, Desktop, and removable storage, rank likely game EXEs, then add the confirmed executable with Proton;
- never download or assign artwork automatically.

The final executable is always confirmed by the user. Installers, uninstallers, updaters, crash reporters, redistributables, and Windows system tools are deprioritized or filtered.

An independent [Decky Loader](https://decky.xyz/) plugin for SteamOS that remembers a known-good Steam game compatibility state, reports later changes, and restores it with a one-step undo.

## v0.3 scope

- Detects the active Steam game in the Decky frontend (with a safe "no game" state when Steam does not expose one).
- Saves a per-app baseline of Steam's app manifest and Proton `user.reg` compatibility state.
- Compares current file hashes to the most recent baseline and returns structured diagnostic codes.
- Restores only those allowlisted files, checks backup integrity, and creates an undo snapshot first.
- Provides full Simplified Chinese and English strings for UI, diagnostics and activity logs. The default follows Steam/system language; it can be overridden in settings.
- Manages composable per-game trainer, LSFG-VK (Little Yellow Duck), and FSR4/OptiScaler launch presets while preserving the original Steam launch options.
- Adds a DeckRecall entry to each Steam game's gear/manage menu, so settings can be changed without launching the game first.
- Supports Proton-launched non-Steam shortcuts for launch presets, compatibility-tool selection, and their `compatdata` registry snapshot. A non-Steam shortcut normally has no `appmanifest.acf`; DeckRecall records that absence and never creates one.
- Selects from installed Proton Experimental, Proton 10.0-4, and GE-Proton compatibility tools, with an option to return to Steam's automatic default.
- Detects Steam Deck, ROG Ally, and ROG Ally X before exposing virtual-memory changes; other handhelds are reported as unsupported rather than receiving a guessed profile.

## Game launch presets

- **Trainer** resolves only a `flingtrainer.com` attachment, calls Steam's native `SteamClient.Browser.StartDownload`, and also performs a constrained fallback save to `/home/deck/Documents`. The fallback rejects redirects off the official host, files above 128 MB, and non-PE downloads before atomically saving and selecting the EXE.
- **Little Yellow Duck / LSFG-VK** adds `~/lsfg`; it requires Lossless Scaling and the `decky-lsfg-vk` plugin.
- **FSR4 / OptiScaler** adds `~/fgmod/fgmod`; it requires the `Decky-Framegen` plugin and the appropriate FSR4 runtime configured there.
- Chinese LSFG and FSR4 plugin ZIPs are both included in the complete DeckRecall release package. Each is SHA-256 verified, traversal/symlink checked, size bounded, and installed with live verify/install progress without depending on game-mode network access.
- **Fully remove FSR4 / OptiScaler** replaces the normal FSR4 wrapper with Decky-Framegen's `~/fgmod/fgmod-uninstaller.sh %command%`. Apply it and run the affected game once to remove its patch; then turn the option off and apply again, or restore the original launch options.
- All three options are independent and can be composed into one launch command, using `--` between wrapper commands.
- DeckRecall records the exact original launch options before its first change. “Restore original launch options” puts them back verbatim.
- If another tool or the user changes or clears Steam launch options after DeckRecall applies a preset, DeckRecall treats the current value as a new baseline and safely rebuilds the selected DeckRecall layers on top of it.

## Compatibility tools

- DeckRecall reads the compatibility tools Steam exposes for the selected game and offers Proton Experimental, Proton 10.0-4, installed GE-Proton versions, and Steam's automatic default.
- DeckRecall always provides native SteamOS install/update actions for Proton Experimental (Steam app 1493710) and Proton 10.0 (Steam app 3658110), even before the compatibility-tool list has loaded. Steam remains responsible for licensing, storage selection, download progress, updates, and integrity checks.
- GE-Proton is third-party software. DeckRecall reads the author's newest GitHub Release SHA-256 digest, falls back to a pinned verified version if the API is unavailable, tries a fixed checksummed Gitee chunk mirror before the GitHub fallback list, and safely installs it to Steam's `compatibilitytools.d` directory only after verification.
- The trainer compatibility submenu provides four independent, checksummed upstream installs with separate progress: GE-Proton7-55, 8-25, 9-27, and 10-29. The UI labels 10-29 for current game/trainer versions and the other three for older versions, while still requiring per-game testing.
- Large plugin, compatibility-layer, and DeckRecall-update downloads run in a serialized backend queue. Starting a download returns immediately; the backend remains the source of truth for queued/running/completed/failed state, so leaving and reopening the page restores live progress instead of pinning a long Decky RPC at 0%.

## Virtual memory

DeckRecall first reads DMI product IDs. Steam Deck (`Jupiter` / `Galileo`) receives zram at half RAM, an 8-16 GB disk swap, and `vm.swappiness = 1`. ROG Ally RC71L and Ally X RC72LA on Bazzite receive Bazzite's published zram policy (`min(ram / 2, 16384)`) and `vm.swappiness = 180`, with no Steam Deck disk swap. Other models are read-only and show an explicit unsupported message.

The backend needs Decky's root flag, which DeckRecall requests through `plugin.json`. Only files whose managed line is `# Managed by DeckRecall` are replaced or removed. If another tool owns a config, DeckRecall leaves it untouched. “Restore system defaults” removes DeckRecall overrides; on Steam Deck it restores the published 1 GB `/home/swapfile` and swappiness 100, while Bazzite returns to swappiness 180.

## Safety model

Snapshot APIs accept only a numeric Steam app ID and game display name. They cannot receive a filesystem path. Download/install APIs likewise accept only a game name, one of two fixed plugin IDs, or one of four fixed GE-Proton IDs; callers cannot provide a URL or destination. Restore validates snapshot IDs and SHA-256 checksums before atomically replacing a file.

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

1. Prefer the complete release ZIP, which includes both offline plugin assets. Source packaging also requires the two audited ZIPs under the local `work/release-assets` directory.
2. Copy this repository into Decky Loader's plugin directory as `DeckRecall`, preserving `main.py`, `backend/main.py`, `backend/memory.py`, `backend/__init__.py`, `dist/index.js`, `plugin.json`, and `package.json`. Decky uses `package.json` to select the ESM plugin loader.
3. Restart Decky Loader. Since v0.2.1 the backend runs with root privileges and adds new APIs, so replacing plugin files without a restart leaves the old backend loaded. After restarting, open a Steam game's gear/manage menu and select DeckRecall; the Quick Access entry also links to the most recently configured game.

DeckRecall is a Decky Loader plugin for SteamOS; it is not a standalone desktop application.
