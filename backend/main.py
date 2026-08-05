"""DeckRecall's Decky backend: constrained snapshots, diagnostics and rollback."""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
import shutil
import subprocess
import tarfile
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import decky  # type: ignore
except ImportError:  # The core remains testable outside SteamOS/Decky.
    decky = None

APP_ID = re.compile(r"^[1-9][0-9]{0,9}$")
MAX_TRACKED_FILE_SIZE = 32 * 1024 * 1024
MAX_OPTIONS_LENGTH = 16 * 1024
MAX_GE_ARCHIVE_SIZE = 1024 * 1024 * 1024
MAX_GE_UNPACKED_SIZE = 2 * 1024 * 1024 * 1024
MAX_PLUGIN_ARCHIVE_SIZE = 256 * 1024 * 1024
MAX_PLUGIN_UNPACKED_SIZE = 512 * 1024 * 1024
GE_RELEASE_API = "https://api.github.com/repos/GloriousEggroll/proton-ge-custom/releases/latest"
GE_FIXED_VERSION = "GE-Proton11-3"
GE_FIXED_URL = "https://github.com/GloriousEggroll/proton-ge-custom/releases/download/GE-Proton11-3/GE-Proton11-3.tar.gz"
GE_FIXED_SHA256 = "861c2edc8d40d051fb1e7a692deb953be52bd339c46d90f2b7dde50ddad91266"
# Same fixed HTTPS GitHub mirrors as the toolbox. They are transport fallbacks
# only; every archive is checked against the author API SHA-256 digest.
GE_MIRROR_PREFIXES = (
    "https://ghproxy.net/", "https://gh.api.99988866.xyz/", "https://github.moeyy.xyz/",
    "https://gh.llkk.cc/", "https://mirror.ghproxy.com/", "https://gh.ddlc.com/",
    "https://gh-proxy.lanqier.me/", "https://ghfast.top/", "",
)
PLUGIN_MIRROR_PREFIXES = GE_MIRROR_PREFIXES
GITEE_ARCHIVE_URL = "https://gitee.com/zliu9732-hub/zhoukeer-toolbox/repository/archive/v6.0.4.zip"
GITEE_ARCHIVE_SHA256 = "cbe50c9dcd64bba1433713c1945ec73de2fa1cc51f8a8327ef0f9cdd0ace147a"
GITEE_ARCHIVE_PREFIX = "zhoukeer-toolbox-v6.0.4"
GITEE_ARCHIVE_SIZE = 138306798
MAX_GITEE_ARCHIVE_SIZE = 256 * 1024 * 1024
CHINESE_PLUGIN_RELEASES = {
    "lsfg": {
        "url": "https://github.com/Ren-Amamiya-pixle/plugin-Chinese/releases/download/v1.1/lsfg-zh.zip",
        "sha256": "221794b84b2835b432905c3b69ddb90989749b08a6427e651399e22480756ef2",
        "gitee_member": f"{GITEE_ARCHIVE_PREFIX}/dist/Decky-LSFG-VK-XiaoHuangYa-v0.12.5.zip",
        "gitee_sha256": "11e3c13673e19662364cd86d77d6df7bf636c026ccaa2842421c37b982f73277",
        "directory": "Decky LSFG-VK",
        "size": 16437127,
    },
    "fsr4": {
        "url": "https://github.com/Ren-Amamiya-pixle/plugin-Chinese/releases/download/v1.1/fsr4-zh.zip",
        "sha256": "631c6da6d91f082148c5e752d81cd41bae3e117948daaff63acbabe8ace1ec92",
        "gitee_member": f"{GITEE_ARCHIVE_PREFIX}/dist/Decky-Framegen-FSR4-v0.15.6.zip",
        "gitee_sha256": "467e755f97c6ce1949f44980228490636d731d6f5451dc38553d1dd8b1d5609e",
        "directory": "Decky-Framegen",
        "size": 75874728,
    },
}


class Plugin:
    """Only snapshots explicit Steam compatibility files; no arbitrary-path APIs exist."""

    def __init__(self) -> None:
        user_home = os.environ.get(
            "DECKRECALL_USER_HOME",
            getattr(decky, "DECKY_USER_HOME", "/home/deck") if decky else "/home/deck",
        )
        runtime_dir = getattr(decky, "DECKY_RUNTIME_DIR", "/home/deck/homebrew/data/deckrecall") if decky else "/home/deck/homebrew/data/deckrecall"
        self.user_home = Path(user_home)
        self.steam_root = Path(os.environ.get("DECKRECALL_STEAM_ROOT", str(self.user_home / ".local/share/Steam")))
        self.data_root = Path(os.environ.get("DECKRECALL_DATA_DIR", runtime_dir))
        self.data_root.mkdir(parents=True, exist_ok=True)
        self.plugin_download_progress: dict[str, dict[str, Any]] = {}
        self.plugin_event_loop: asyncio.AbstractEventLoop | None = None
        self.memory: Any = None

    async def _main(self) -> None:
        if decky: decky.logger.info("DeckRecall backend started")

    async def _unload(self) -> None:
        if decky: decky.logger.info("DeckRecall backend stopped")

    async def get_diagnostics(self, app_id: str) -> dict[str, Any]:
        return self._diagnostics(self._app_id(app_id))

    async def create_snapshot(self, app_id: str, game_name: str = "") -> dict[str, Any]:
        app_id = self._app_id(app_id)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        snapshot_id = f"{stamp}-{os.urandom(3).hex()}"
        destination = self._snapshot_dir(app_id, snapshot_id)
        destination.mkdir(parents=True)
        files = self._capture(app_id, destination / "files")
        manifest = {"id": snapshot_id, "app_id": app_id, "game_name": game_name[:256],
                    "created_at": datetime.now(timezone.utc).isoformat(), "files": files}
        self._write_json(destination / "manifest.json", manifest)
        self._event(app_id, "snapshot_created", {"snapshot_id": snapshot_id})
        return {"ok": True, "snapshot": manifest, "diagnostics": self._diagnostics(app_id)}

    async def list_snapshots(self, app_id: str) -> list[dict[str, Any]]:
        app_id = self._app_id(app_id)
        root = self.data_root / "snapshots" / app_id
        snapshots = []
        if root.exists():
            for manifest_path in root.glob("*/manifest.json"):
                try:
                    snapshots.append(json.loads(manifest_path.read_text(encoding="utf-8")))
                except (OSError, json.JSONDecodeError):
                    continue
        return sorted(snapshots, key=lambda item: item["created_at"], reverse=True)

    async def restore_snapshot(self, app_id: str, snapshot_id: str) -> dict[str, Any]:
        app_id = self._app_id(app_id)
        manifest = self._load_manifest(app_id, snapshot_id)
        undo_id = f"undo-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{os.urandom(3).hex()}"
        undo_dir = self.data_root / "undo" / app_id / undo_id
        undo_dir.mkdir(parents=True)
        undo_files = self._capture(app_id, undo_dir / "files")
        self._write_json(undo_dir / "manifest.json", {"id": undo_id, "app_id": app_id, "files": undo_files})
        self._restore(app_id, manifest, self._snapshot_dir(app_id, snapshot_id) / "files")
        self._event(app_id, "snapshot_restored", {"snapshot_id": snapshot_id, "undo_id": undo_id})
        return {"ok": True, "undo_id": undo_id, "diagnostics": self._diagnostics(app_id)}

    async def undo_restore(self, app_id: str, undo_id: str) -> dict[str, Any]:
        app_id = self._app_id(app_id)
        manifest_path = self.data_root / "undo" / app_id / undo_id / "manifest.json"
        if not re.fullmatch(r"undo-[0-9TZ]+-[0-9a-f]{6}", undo_id) or not manifest_path.is_file():
            raise ValueError("undo_not_found")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self._restore(app_id, manifest, manifest_path.parent / "files")
        self._event(app_id, "restore_undone", {"undo_id": undo_id})
        return {"ok": True, "diagnostics": self._diagnostics(app_id)}

    async def get_events(self, app_id: str) -> list[dict[str, Any]]:
        app_id = self._app_id(app_id)
        path = self.data_root / "events" / f"{app_id}.jsonl"
        if not path.exists(): return []
        return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()[-100:]]

    async def get_launch_profile(self, app_id: str) -> dict[str, Any]:
        app_id = self._app_id(app_id)
        return self._validate_profile(self._read_profiles().get(app_id, self._empty_profile()))

    async def save_launch_profile(self, app_id: str, profile: dict[str, Any]) -> dict[str, Any]:
        app_id = self._app_id(app_id)
        validated = self._validate_profile(profile)
        profiles = self._read_profiles()
        profiles[app_id] = validated
        self._write_json(self.data_root / "launch-profiles.json", profiles)
        code = "launch_options_applied" if validated["managed_options"] else "launch_options_restored"
        features = ",".join(key for key in ("trainer_enabled", "lsfg_enabled", "fsr4_enabled", "fsr4_uninstall_enabled", "skip_launcher_enabled") if validated[key])
        self._event(app_id, code, {"features": features})
        return validated

    async def get_ge_proton_release(self) -> dict[str, Any]:
        """Return a vetted author release without downloading an archive."""
        return self._ge_release()

    async def open_protontricks(self, app_id: str) -> dict[str, Any]:
        """Open the Flatpak Protontricks GUI for one validated Steam app."""
        app_id = self._app_id(app_id)
        try:
            available = subprocess.run(
                ["flatpak", "info", "com.github.Matoking.protontricks"],
                stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                timeout=10, check=False,
            ).returncode == 0
        except (OSError, subprocess.SubprocessError):
            available = False
        if not available: raise ValueError("protontricks_not_installed")
        try:
            subprocess.Popen(
                ["flatpak", "run", "com.github.Matoking.protontricks", "--gui", "--appid", app_id],
                stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
        except OSError as error:
            raise ValueError("protontricks_launch_failed") from error
        self._event(app_id, "protontricks_opened", {})
        return {"ok": True}

    async def get_memory_status(self) -> dict[str, Any]:
        """Return a read-only snapshot of the current virtual-memory state."""
        return await asyncio.to_thread(self._memory_tuner().status)

    async def apply_recommended_memory(self) -> dict[str, Any]:
        """Apply the recommended zram, disk swap and swappiness combination."""
        result = await asyncio.to_thread(self._memory_tuner().optimize)
        self._event("0", "memory_optimized", {"swap_gib": str(result["recommended_swap_gib"])})
        return result

    async def restore_memory_tuning(self) -> dict[str, Any]:
        """Remove only DeckRecall-managed memory settings and keep the system swap."""
        result = await asyncio.to_thread(self._memory_tuner().restore)
        self._event("0", "memory_restored", {})
        return result

    def _memory_tuner(self) -> Any:
        if self.memory is None:
            try:
                from backend.memory import MemoryTuner
            except ImportError as error:
                raise ValueError("memory_backend_unavailable") from error
            self.memory = MemoryTuner()
        return self.memory

    async def install_latest_ge_proton(self) -> dict[str, Any]:
        """Download, verify and install the latest author-published GE-Proton."""
        release = self._ge_release()
        archive = self._download_ge_asset(release["asset_url"], release["asset_name"])
        try:
            if self._hash(archive).lower() != release["sha256"].lower():
                raise ValueError("ge_proton_checksum_failed")
            destination = self._compatibilitytools_dir()
            installed = self._safe_extract_ge(archive, destination, release["tag"])
            self._event("0", "ge_proton_installed", {"version": installed})
            return {"ok": True, "version": installed, "source": release["source"]}
        finally:
            archive.unlink(missing_ok=True)

    async def install_chinese_plugin(self, plugin_id: str) -> dict[str, Any]:
        """Install one fixed, checksummed plugin archive without arbitrary URLs."""
        if plugin_id not in CHINESE_PLUGIN_RELEASES:
            raise ValueError("plugin_install_invalid")
        self.plugin_event_loop = asyncio.get_running_loop()
        self._set_plugin_progress(plugin_id, "plugin_download_phase", 0)
        result = await asyncio.to_thread(self._install_chinese_plugin_sync, plugin_id)
        self._set_plugin_progress(plugin_id, "plugin_complete_phase", 100)
        self._event("0", "plugin_installed", {"plugin": plugin_id})
        return result

    async def get_plugin_install_progress(self, plugin_id: str) -> dict[str, Any]:
        if plugin_id not in CHINESE_PLUGIN_RELEASES:
            raise ValueError("plugin_install_invalid")
        return dict(self.plugin_download_progress.get(plugin_id, {"phase": "plugin_download_phase", "percent": 0}))

    def _set_plugin_progress(self, plugin_id: str, phase: str, percent: int) -> None:
        progress = {"phase": phase, "percent": max(0, min(100, int(percent)))}
        self.plugin_download_progress[plugin_id] = progress
        if decky and self.plugin_event_loop:
            asyncio.run_coroutine_threadsafe(
                decky.emit("plugin_install_progress", plugin_id, progress["phase"], progress["percent"]),
                self.plugin_event_loop,
            )

    def _install_chinese_plugin_sync(self, plugin_id: str) -> dict[str, Any]:
        release = CHINESE_PLUGIN_RELEASES[plugin_id]
        archive, expected_sha256 = self._download_plugin_archive(release, plugin_id)
        try:
            if self._hash(archive).lower() != expected_sha256:
                raise ValueError("plugin_install_checksum_failed")
            self._set_plugin_progress(plugin_id, "plugin_verify_phase", 96)
            self._safe_install_plugin_archive(archive, release["directory"])
            return {"ok": True, "plugin": plugin_id}
        finally:
            archive.unlink(missing_ok=True)

    def _compatibilitytools_dir(self) -> Path:
        """Use Steam's primary root first, matching the toolbox install location."""
        for steam_root in (self.user_home / ".steam/root", self.user_home / ".steam/steam", self.steam_root):
            if steam_root.is_dir(): return steam_root / "compatibilitytools.d"
        raise ValueError("steam_root_not_found")

    def _ge_release(self) -> dict[str, str]:
        try:
            with urllib.request.urlopen(urllib.request.Request(GE_RELEASE_API, headers={"Accept": "application/vnd.github+json", "User-Agent": "DeckRecall"}), timeout=20) as response:
                payload = json.loads(response.read(2 * 1024 * 1024).decode("utf-8"))
            if not isinstance(payload, dict) or not isinstance(payload.get("tag_name"), str): raise ValueError()
            tag = payload["tag_name"]
            if not re.fullmatch(r"GE-Proton[0-9]+-[0-9]+", tag): raise ValueError()
            assets = payload.get("assets")
            if not isinstance(assets, list): raise ValueError()
            archive = next((item for item in assets if isinstance(item, dict) and item.get("name") == f"{tag}.tar.gz"), None)
            if not isinstance(archive, dict): raise ValueError()
            asset_url, digest = archive.get("browser_download_url"), archive.get("digest")
            if not isinstance(asset_url, str) or not isinstance(digest, str) or not asset_url.startswith("https://github.com/"):
                raise ValueError()
            match = re.fullmatch(r"sha256:([0-9a-fA-F]{64})", digest)
            if not match: raise ValueError()
            return {"tag": tag, "asset_name": f"{tag}.tar.gz", "asset_url": asset_url, "sha256": match.group(1), "source": "github-release"}
        except (urllib.error.URLError, OSError, ValueError, json.JSONDecodeError):
            return {"tag": GE_FIXED_VERSION, "asset_name": f"{GE_FIXED_VERSION}.tar.gz", "asset_url": GE_FIXED_URL, "sha256": GE_FIXED_SHA256, "source": "fixed-fallback"}

    def _download_ge_asset(self, url: str, name: str) -> Path:
        return self._download_ge_file(url, name, MAX_GE_ARCHIVE_SIZE)

    def _download_ge_file(self, url: str, name: str, maximum: int) -> Path:
        if not re.fullmatch(r"[A-Za-z0-9._-]+(?:\.tar\.gz)?", name): raise ValueError("ge_proton_release_invalid")
        last_error: Exception | None = None
        for prefix in GE_MIRROR_PREFIXES:
            candidate = url if not prefix else prefix + url
            temporary: Path | None = None
            try:
                with urllib.request.urlopen(urllib.request.Request(candidate, headers={"User-Agent": "DeckRecall"}), timeout=45) as response:
                    with tempfile.NamedTemporaryFile(dir=self.data_root, prefix="ge-", suffix=".download", delete=False) as handle:
                        temporary = Path(handle.name)
                        total = 0
                        for chunk in iter(lambda: response.read(1024 * 1024), b""):
                            total += len(chunk)
                            if total > maximum: raise ValueError("ge_proton_download_too_large")
                            handle.write(chunk)
                return temporary
            except (urllib.error.URLError, OSError, ValueError) as error:
                if temporary: temporary.unlink(missing_ok=True)
                last_error = error
        raise ValueError("ge_proton_download_failed") from last_error

    def _download_plugin_archive(self, release: dict[str, Any], plugin_id: str) -> tuple[Path, str]:
        """Prefer the toolbox's pinned Gitee archive, then curl-based GitHub mirrors."""
        if release.get("gitee_member"):
            try:
                archive = self._download_gitee_plugin_member(release, plugin_id)
                return archive, release["gitee_sha256"]
            except ValueError:
                pass
        archive = self._download_github_plugin_archive(release["url"], plugin_id, int(release["size"]))
        return archive, release["sha256"]

    def _download_gitee_archive(self, plugin_id: str) -> Path:
        self._set_plugin_progress(plugin_id, "plugin_download_phase", 1)
        temporary: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(dir=self.data_root, prefix="gitee-", suffix=".zip", delete=False) as handle:
                temporary = Path(handle.name)
            request = urllib.request.Request(GITEE_ARCHIVE_URL, headers={"User-Agent": "DeckRecall"})
            with urllib.request.urlopen(request, timeout=60) as response:
                total = 0
                with temporary.open("wb") as target:
                    for chunk in iter(lambda: response.read(1024 * 1024), b""):
                        total += len(chunk)
                        if total > MAX_GITEE_ARCHIVE_SIZE:
                            raise ValueError("plugin_install_too_large")
                        target.write(chunk)
                        self._set_plugin_progress(plugin_id, "plugin_download_phase", min(70, total * 70 // GITEE_ARCHIVE_SIZE))
            if self._hash(temporary).lower() != GITEE_ARCHIVE_SHA256:
                raise ValueError("plugin_install_checksum_failed")
            self._set_plugin_progress(plugin_id, "plugin_download_phase", 70)
            return temporary
        except (urllib.error.URLError, OSError, ValueError) as error:
            if temporary:
                temporary.unlink(missing_ok=True)
            if isinstance(error, ValueError) and str(error) in {"plugin_install_too_large", "plugin_install_checksum_failed"}:
                raise
            raise ValueError("plugin_install_download_failed") from error

    def _download_gitee_plugin_member(self, release: dict[str, Any], plugin_id: str) -> Path:
        archive_path: Path | None = None
        member_path: Path | None = None
        try:
            archive_path = self._download_gitee_archive(plugin_id)
            member = release["gitee_member"]
            with zipfile.ZipFile(archive_path) as bundle:
                if member not in bundle.namelist():
                    raise ValueError("plugin_install_download_failed")
                info = bundle.getinfo(member)
                path = Path(member)
                if path.is_absolute() or ".." in path.parts or info.is_dir() or info.file_size > MAX_PLUGIN_ARCHIVE_SIZE:
                    raise ValueError("plugin_install_download_failed")
                with tempfile.NamedTemporaryFile(dir=self.data_root, prefix=f"{plugin_id}-gitee-", suffix=".zip", delete=False) as handle:
                    member_path = Path(handle.name)
                with bundle.open(info) as source, member_path.open("wb") as target:
                    shutil.copyfileobj(source, target)
            if self._hash(member_path).lower() != release["gitee_sha256"]:
                raise ValueError("plugin_install_checksum_failed")
            self._set_plugin_progress(plugin_id, "plugin_download_phase", 95)
            return member_path
        except Exception:
            if member_path:
                member_path.unlink(missing_ok=True)
            raise
        finally:
            if archive_path:
                archive_path.unlink(missing_ok=True)

    def _download_github_plugin_archive(self, url: str, plugin_id: str, known_size: int) -> Path:
        """Use Python's HTTPS downloader across the toolbox mirror list."""
        last_error: Exception | None = None
        self._set_plugin_progress(plugin_id, "plugin_download_phase", 1)
        for prefix in PLUGIN_MIRROR_PREFIXES:
            temporary: Path | None = None
            try:
                candidate = url if not prefix else prefix + url
                with tempfile.NamedTemporaryFile(dir=self.data_root, prefix=f"{plugin_id}-", suffix=".zip", delete=False) as handle:
                    temporary = Path(handle.name)
                request = urllib.request.Request(candidate, headers={"User-Agent": "DeckRecall"})
                with urllib.request.urlopen(request, timeout=45) as response:
                    total = 0
                    with temporary.open("wb") as target:
                        for chunk in iter(lambda: response.read(1024 * 1024), b""):
                            total += len(chunk)
                            if total > MAX_PLUGIN_ARCHIVE_SIZE:
                                raise ValueError("plugin_install_too_large")
                            target.write(chunk)
                            self._set_plugin_progress(plugin_id, "plugin_download_phase", min(95, total * 95 // known_size))
                self._set_plugin_progress(plugin_id, "plugin_download_phase", 95)
                return temporary
            except (urllib.error.URLError, OSError, ValueError) as error:
                if temporary:
                    temporary.unlink(missing_ok=True)
                last_error = error
        raise ValueError("plugin_install_download_failed") from last_error

    def _safe_install_plugin_archive(self, archive: Path, directory: str) -> None:
        if directory not in {"Decky LSFG-VK", "Decky-Framegen"}:
            raise ValueError("plugin_install_invalid")
        target_root = self.user_home / "homebrew" / "plugins"
        target_root.mkdir(parents=True, exist_ok=True)
        try:
            self._chown_deck_user_directory(target_root)
        except ValueError:
            raise ValueError("plugin_install_owner_failed")
        plugin_id = "lsfg" if directory == "Decky LSFG-VK" else "fsr4"
        self._set_plugin_progress(plugin_id, "plugin_install_phase", 98)
        with zipfile.ZipFile(archive) as bundle:
            members = bundle.infolist()
            total = 0
            for member in members:
                path = Path(member.filename)
                if path.is_absolute() or ".." in path.parts or not member.filename.startswith(f"{directory}/"):
                    raise ValueError("plugin_install_archive_invalid")
                if (member.external_attr >> 16) & 0o170000 == 0o120000:
                    raise ValueError("plugin_install_archive_invalid")
                total += member.file_size
                if total > MAX_PLUGIN_UNPACKED_SIZE:
                    raise ValueError("plugin_install_too_large")
            if not any(member.filename == f"{directory}/plugin.json" for member in members) or not any(member.filename == f"{directory}/dist/index.js" for member in members):
                raise ValueError("plugin_install_archive_invalid")
            staging = Path(tempfile.mkdtemp(prefix=f".{directory}.new-", dir=target_root))
            backup = target_root / f".{directory}.previous-{os.urandom(3).hex()}"
            try:
                # All members were validated above (absolute/traversal/symlink
                # rejection and bounded total size), so the broadly compatible
                # ZipFile API is safe to use on SteamOS's Python runtime.
                bundle.extractall(staging)
                extracted = staging / directory
                final = target_root / directory
                if final.exists(): os.replace(final, backup)
                try:
                    os.replace(extracted, final)
                except OSError:
                    if backup.exists(): os.replace(backup, final)
                    raise
                try:
                    self._chown_to_deck_user(final)
                except ValueError:
                    shutil.rmtree(final, ignore_errors=True)
                    if backup.exists():
                        try:
                            os.replace(backup, final)
                        except OSError:
                            pass
                    raise
                shutil.rmtree(backup, ignore_errors=True)
            finally:
                shutil.rmtree(staging, ignore_errors=True)

    def _chown_to_deck_user(self, path: Path) -> None:
        """Keep Decky-managed plugin trees owned by the host SteamOS user."""
        if os.geteuid() != 0:
            return
        try:
            owner = self.user_home.stat()
        except OSError as error:
            raise ValueError("plugin_install_owner_failed") from error
        for child in sorted(path.rglob("*"), reverse=True):
            try:
                os.chown(child, owner.st_uid, owner.st_gid)
            except OSError as error:
                raise ValueError("plugin_install_owner_failed") from error
        try:
            os.chown(path, owner.st_uid, owner.st_gid)
        except OSError as error:
            raise ValueError("plugin_install_owner_failed") from error

    def _chown_deck_user_directory(self, path: Path) -> None:
        """Chown a container directory without touching unrelated sibling trees."""
        if os.geteuid() != 0:
            return
        try:
            owner = self.user_home.stat()
        except OSError as error:
            raise ValueError("plugin_install_owner_failed") from error
        try:
            os.chown(path, owner.st_uid, owner.st_gid)
        except OSError as error:
            raise ValueError("plugin_install_owner_failed") from error

    def _safe_extract_ge(self, archive: Path, destination: Path, expected_name: str) -> str:
        with tarfile.open(archive, "r:gz") as bundle:
            members = bundle.getmembers()
            root_name = expected_name.removesuffix(".tar.gz")
            roots = {member.name.split("/", 1)[0] for member in members if member.name and not member.name.startswith("/")}
            if roots != {root_name}: raise ValueError("ge_proton_archive_invalid")
            total = 0
            for member in members:
                target = Path(member.name)
                if target.is_absolute() or ".." in target.parts or member.issym() or member.islnk() or not (member.isdir() or member.isfile()):
                    raise ValueError("ge_proton_archive_invalid")
                total += member.size
                if total > MAX_GE_UNPACKED_SIZE: raise ValueError("ge_proton_archive_too_large")
            destination.mkdir(parents=True, exist_ok=True)
            try:
                self._chown_deck_user_directory(destination)
            except ValueError:
                raise ValueError("ge_proton_owner_failed")
            staging = Path(tempfile.mkdtemp(prefix="ge-", dir=destination))
            try:
                bundle.extractall(staging, members=members, filter="data")
                extracted = staging / root_name
                if not all((extracted / name).is_file() for name in ("compatibilitytool.vdf", "proton", "toolmanifest.vdf")):
                    raise ValueError("ge_proton_archive_invalid")
                final = destination / root_name
                backup = destination / f".{root_name}.previous-{os.urandom(3).hex()}"
                if final.exists(): os.replace(final, backup)
                try:
                    os.replace(extracted, final)
                except OSError:
                    if backup.exists(): os.replace(backup, final)
                    raise
                try:
                    self._chown_to_deck_user(final)
                except ValueError:
                    shutil.rmtree(final, ignore_errors=True)
                    if backup.exists():
                        try:
                            os.replace(backup, final)
                        except OSError:
                            pass
                    raise ValueError("ge_proton_owner_failed")
                shutil.rmtree(backup, ignore_errors=True)
                return root_name
            finally:
                shutil.rmtree(staging, ignore_errors=True)

    def _app_id(self, app_id: str) -> str:
        if not isinstance(app_id, str) or not APP_ID.fullmatch(app_id): raise ValueError("invalid_app_id")
        return app_id

    def _tracked(self, app_id: str) -> dict[str, Path]:
        # Keys are fixed, safe relative paths. Never accept a caller-supplied filesystem path.
        library = self._game_library(app_id)
        return {
            "appmanifest.acf": library / "steamapps" / f"appmanifest_{app_id}.acf",
            "compatdata/pfx/user.reg": library / "steamapps" / "compatdata" / app_id / "pfx" / "user.reg"
        }

    def _game_library(self, app_id: str) -> Path:
        libraries = [self.steam_root]
        folders = self.steam_root / "steamapps" / "libraryfolders.vdf"
        if folders.is_file():
            try:
                text = folders.read_text(encoding="utf-8", errors="replace")
                for raw in re.findall(r'"path"\s+"([^"]+)"', text):
                    candidate = Path(raw.replace("\\\\", "\\"))
                    if candidate.is_absolute() and (candidate / "steamapps").is_dir() and candidate not in libraries:
                        libraries.append(candidate)
            except OSError:
                pass
        manifest_name = f"appmanifest_{app_id}.acf"
        for library in libraries:
            if (library / "steamapps" / manifest_name).is_file(): return library
        for library in libraries:
            if (library / "steamapps" / "compatdata" / app_id).is_dir(): return library
        return self.steam_root

    def _snapshot_dir(self, app_id: str, snapshot_id: str) -> Path:
        if not re.fullmatch(r"(?:undo-)?[0-9TZ]+-[0-9a-f]{6}", snapshot_id): raise ValueError("invalid_snapshot_id")
        return self.data_root / "snapshots" / app_id / snapshot_id

    def _capture(self, app_id: str, root: Path) -> list[dict[str, Any]]:
        files = []
        for key, source in self._tracked(app_id).items():
            target = root / key
            if source.is_file():
                if source.stat().st_size > MAX_TRACKED_FILE_SIZE: raise ValueError("file_too_large")
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
                files.append({"path": key, "exists": True, "sha256": self._hash(source), "size": source.stat().st_size})
            else: files.append({"path": key, "exists": False})
        return files

    def _restore(self, app_id: str, manifest: dict[str, Any], archive_root: Path) -> None:
        allowed = self._tracked(app_id)
        for record in manifest.get("files", []):
            key = record.get("path")
            if key not in allowed: raise ValueError("invalid_snapshot_manifest")
            destination = allowed[key]
            archived = archive_root / key
            if record.get("exists"):
                if not archived.is_file() or self._hash(archived) != record.get("sha256"): raise ValueError("snapshot_integrity_failed")
                destination.parent.mkdir(parents=True, exist_ok=True)
                with tempfile.NamedTemporaryFile(dir=destination.parent, delete=False) as tmp:
                    temp_path = Path(tmp.name)
                shutil.copy2(archived, temp_path)
                os.replace(temp_path, destination)
            elif destination.exists():
                destination.unlink()

    def _diagnostics(self, app_id: str) -> dict[str, Any]:
        baseline = self._latest_manifest(app_id)
        changes = []
        if baseline:
            by_path = {item["path"]: item for item in baseline["files"]}
            for key, source in self._tracked(app_id).items():
                previous, exists = by_path[key], source.is_file()
                if previous["exists"] and not exists: changes.append({"code": "file_missing", "path": key})
                elif not previous["exists"] and exists: changes.append({"code": "file_added", "path": key})
                elif exists and previous["sha256"] != self._hash(source): changes.append({"code": "file_changed", "path": key})
        return {"app_id": app_id, "baseline_exists": bool(baseline), "changes": changes,
                "status": "changes_detected" if changes else "normal"}

    def _latest_manifest(self, app_id: str) -> dict[str, Any] | None:
        snapshots = []
        root = self.data_root / "snapshots" / app_id
        for path in root.glob("*/manifest.json") if root.exists() else []:
            try: snapshots.append(json.loads(path.read_text(encoding="utf-8")))
            except (OSError, json.JSONDecodeError): pass
        return max(snapshots, key=lambda item: item["created_at"]) if snapshots else None

    def _load_manifest(self, app_id: str, snapshot_id: str) -> dict[str, Any]:
        path = self._snapshot_dir(app_id, snapshot_id) / "manifest.json"
        if not path.is_file(): raise ValueError("snapshot_not_found")
        return json.loads(path.read_text(encoding="utf-8"))

    def _event(self, app_id: str, code: str, data: dict[str, str]) -> None:
        path = self.data_root / "events" / f"{app_id}.jsonl"; path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps({"at": datetime.now(timezone.utc).isoformat(), "code": code, **data}) + "\n")

    def _read_profiles(self) -> dict[str, Any]:
        path = self.data_root / "launch-profiles.json"
        if not path.exists(): return {}
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
            return value if isinstance(value, dict) else {}
        except (OSError, json.JSONDecodeError):
            return {}

    @staticmethod
    def _empty_profile() -> dict[str, Any]:
        return {"trainer_enabled": False, "trainer_path": "", "lsfg_enabled": False, "fsr4_enabled": False, "fsr4_uninstall_enabled": False, "skip_launcher_enabled": False,
                "original_options": "", "managed_options": ""}

    @staticmethod
    def _validate_profile(profile: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(profile, dict): raise ValueError("invalid_launch_profile")
        result = Plugin._empty_profile()
        # Accept the brief pre-0.2 profile shape as a one-time migration.
        result["trainer_enabled"] = bool(profile.get("trainer_enabled", profile.get("mode") == "trainer"))
        result["lsfg_enabled"] = bool(profile.get("lsfg_enabled", profile.get("mode") == "duck"))
        result["fsr4_enabled"] = bool(profile.get("fsr4_enabled"))
        result["fsr4_uninstall_enabled"] = bool(profile.get("fsr4_uninstall_enabled"))
        result["skip_launcher_enabled"] = bool(profile.get("skip_launcher_enabled"))
        if result["fsr4_uninstall_enabled"]:
            result["fsr4_enabled"] = False
        value = profile.get("trainer_path", "")
        if not isinstance(value, str) or len(value) > 4096 or any(char in value for char in "\x00\r\n\"'"):
            raise ValueError("invalid_executable_path")
        if value and (not Path(value).is_absolute() or Path(value).suffix.lower() not in {".exe", ".bat"}):
            raise ValueError("invalid_executable_path")
        result["trainer_path"] = value
        if result["trainer_enabled"] and not value: raise ValueError("executable_required")
        for key in ("original_options", "managed_options"):
            value = profile.get(key, "")
            if not isinstance(value, str) or len(value) > MAX_OPTIONS_LENGTH or "\x00" in value:
                raise ValueError("invalid_launch_options")
            result[key] = value
        return result

    @staticmethod
    def _hash(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""): digest.update(chunk)
        return digest.hexdigest()

    @staticmethod
    def _write_json(path: Path, payload: dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile("w", dir=path.parent, encoding="utf-8", delete=False) as handle:
            json.dump(payload, handle, indent=2)
            handle.flush(); os.fsync(handle.fileno())
            temporary = Path(handle.name)
        os.replace(temporary, path)
