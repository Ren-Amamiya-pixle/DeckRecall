"""DeckRecall's Decky backend: constrained snapshots, diagnostics and rollback."""
from __future__ import annotations

import asyncio
import hashlib
import html
import json
import os
import posixpath
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
from collections.abc import Awaitable, Callable
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
MAX_TRAINER_PAGE_SIZE = 4 * 1024 * 1024
MAX_TRAINER_FILE_SIZE = 128 * 1024 * 1024
FLING_ORIGIN = "https://flingtrainer.com"
GE_RELEASE_API = "https://api.github.com/repos/GloriousEggroll/proton-ge-custom/releases/latest"
GE_FIXED_VERSION = "GE-Proton11-3"
GE_FIXED_URL = "https://github.com/GloriousEggroll/proton-ge-custom/releases/download/GE-Proton11-3/GE-Proton11-3.tar.gz"
GE_FIXED_SHA256 = "861c2edc8d40d051fb1e7a692deb953be52bd339c46d90f2b7dde50ddad91266"
GE_FIXED_SIZE = 532524366
GITEE_MIRROR_OWNER = "zliu9732-hub"
GITEE_PRIMARY_REPO = "zhoukeer-toolbox-mirror"
GITEE_SECONDARY_REPO = "zhoukeer-toolbox-mirror-2"
GITEE_DECKRECALL_REPO = "zhoukeer-toolbox-mirror-3"
GITEE_RAW_ORIGIN = f"https://gitee.com/{GITEE_MIRROR_OWNER}/"
GITEE_CHUNK_SIZE = 8 * 1024 * 1024
GITEE_ALLOWED_REPOS = {
    GITEE_PRIMARY_REPO, GITEE_SECONDARY_REPO, GITEE_DECKRECALL_REPO,
    "zhoukeer-toolbox-mirror-4", "zhoukeer-toolbox-mirror-5",
    "zhoukeer-toolbox-mirror-6", "zhoukeer-toolbox-mirror-7",
}
# Same fixed HTTPS GitHub mirrors as the toolbox. They are transport fallbacks
# only; every archive is checked against the author API SHA-256 digest.
GE_MIRROR_PREFIXES = (
    "https://ghproxy.net/", "https://gh.api.99988866.xyz/", "https://github.moeyy.xyz/",
    "https://gh.llkk.cc/", "https://mirror.ghproxy.com/", "https://gh.ddlc.com/",
    "https://gh-proxy.lanqier.me/", "https://ghfast.top/", "",
)
PLUGIN_DOWNLOAD_PREFIXES = ("https://ghfast.top/", "")
PLUGIN_DOWNLOAD_CHUNK_SIZE = 64 * 1024
PLUGIN_DOWNLOAD_STALL_TIMEOUT = 30
PLUGIN_DOWNLOAD_MAX_STALLS = 8
DECKRECALL_RELEASE_API = "https://api.github.com/repos/Ren-Amamiya-pixle/DeckRecall/releases/latest"
DECKRECALL_RELEASE_ASSET = "DeckRecall.zip"
DECKRECALL_RELEASE_ORIGIN = "https://github.com/Ren-Amamiya-pixle/DeckRecall/releases/download/"
CHINESE_PLUGIN_RELEASES = {
    "lsfg": {
        "bundled": "assets/lsfg-zh.zip",
        "url": "https://github.com/Ren-Amamiya-pixle/DeckRecall/releases/download/v0.3.1/lsfg-zh.zip",
        "sha256": "278d0fe9bc81c2f3c68e53efa00b66bbb3cbba07f0b7fa2937cf881426f2fe56",
        "directory": "Decky LSFG-VK",
        "size": 16437127,
        "mirror_repo": GITEE_DECKRECALL_REPO,
        "mirror_id": "deckrecall-lsfg-zh",
    },
    "fsr4": {
        "bundled": "assets/fsr4-zh.zip",
        "url": "https://github.com/Ren-Amamiya-pixle/DeckRecall/releases/download/v0.3.1/fsr4-zh.zip",
        "sha256": "f578ea48296eb7b4a5645aeaef084f0e6368ec285b79f845183e13fb9c4d5e53",
        "directory": "Decky-Framegen",
        "size": 198763093,
        "mirror_repo": GITEE_DECKRECALL_REPO,
        "mirror_id": "deckrecall-fsr4-zh",
    },
}

TRAINER_COMPAT_RELEASES = {
    "GE-Proton7-55": {
        "url": "https://github.com/GloriousEggroll/proton-ge-custom/releases/download/GE-Proton7-55/GE-Proton7-55.tar.gz",
        "size": 414899774,
        "sha512": "8fa9ad9d0e1957ced72cf48a0e5234203b4abec28bd039df8f57aea71d7fe8da5e1cbef0d208d324ebc77559b0e278abf54aa7f6c15bfcb4fb1a136de0652903",
        "sha256": "ffbd03b40a5c8dafba53e45bd6551c132512ad6fcba9120e25f0d510d0cd0485",
        "mirror_repo": "zhoukeer-toolbox-mirror-4",
        "mirror_id": "ge-proton-trainer-7-55",
    },
    "GE-Proton8-25": {
        "url": "https://github.com/GloriousEggroll/proton-ge-custom/releases/download/GE-Proton8-25/GE-Proton8-25.tar.gz",
        "size": 428716716,
        "sha512": "287b10bad211e471772017da801089dae2a83a1da50a584b75e3c1c25339768e5a9f25c4cd0cf7db07aa6c5887abe3e8928cae835a5b21c58c95e5fd0dd3f65e",
        "sha256": "b37160b27ab36e0068f73ab09ac0c936323cf934c6f36edb171cd642bd7ce18a",
        "mirror_repo": "zhoukeer-toolbox-mirror-5",
        "mirror_id": "ge-proton-trainer-8-25",
    },
    "GE-Proton9-27": {
        "url": "https://github.com/GloriousEggroll/proton-ge-custom/releases/download/GE-Proton9-27/GE-Proton9-27.tar.gz",
        "size": 488766224,
        "sha512": "86a2b2962a2509104201b3532bc829d058d666bc8220417f71bd4af660b6d05781e9f684b3982339d695a5fd4babe19e97ec42a82a78311faf99fc1257280623",
        "sha256": "bbd3108ba8dcf173dd2a60ef4eb1b8d07e0fb3c9a1061b5b9310c5355c151937",
        "mirror_repo": "zhoukeer-toolbox-mirror-6",
        "mirror_id": "ge-proton-trainer-9-27",
    },
    "GE-Proton10-29": {
        "url": "https://github.com/GloriousEggroll/proton-ge-custom/releases/download/GE-Proton10-29/GE-Proton10-29.tar.gz",
        "size": 514575201,
        "sha256": "29a42ff004e9e5c79e22fa9a0595490284167d4a2e7cabbe570b1f9c2f3295c0",
        "mirror_repo": "zhoukeer-toolbox-mirror-7",
        "mirror_id": "ge-proton-trainer-10-29",
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
        installed_dir = os.environ.get("DECKRECALL_PLUGIN_DIR")
        self.plugin_dir = Path(installed_dir) if installed_dir else Path(__file__).resolve().parent.parent
        self.data_root.mkdir(parents=True, exist_ok=True)
        self.plugin_download_progress: dict[str, dict[str, Any]] = {}
        self.compat_download_progress: dict[str, dict[str, Any]] = {}
        self.self_update_progress: dict[str, Any] = {"phase": "self_update_download_phase", "percent": 0}
        self.download_jobs: dict[str, dict[str, Any]] = {}
        self.download_job_operations: dict[str, Callable[[], Awaitable[dict[str, Any]]]] = {}
        self.active_download_targets: dict[str, str] = {}
        self.download_queue: asyncio.Queue[str] | None = None
        self.download_worker: asyncio.Task[None] | None = None
        self.download_job_sequence = 0
        self.restart_after_queue = ""
        self.memory: Any = None
        self.exe_installs: Any = None

    @staticmethod
    def _approved_https_url(url: str) -> bool:
        """Keep every backend transfer inside the fixed release/mirror allowlist."""
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != "https" or parsed.username or parsed.password or parsed.query or parsed.fragment:
            return False
        if parsed.hostname == "api.github.com":
            return parsed.path in {
                "/repos/Ren-Amamiya-pixle/DeckRecall/releases/latest",
                "/repos/GloriousEggroll/proton-ge-custom/releases/latest",
            }
        if parsed.hostname == "github.com":
            return parsed.path.startswith((
                "/Ren-Amamiya-pixle/DeckRecall/releases/download/",
                "/GloriousEggroll/proton-ge-custom/releases/download/",
            ))
        if parsed.hostname == "gitee.com":
            parts = parsed.path.strip("/").split("/")
            return (
                len(parts) >= 6 and parts[0] == GITEE_MIRROR_OWNER
                and parts[1] in GITEE_ALLOWED_REPOS and parts[2:4] == ["raw", "main"]
            )
        mirror_hosts = {urllib.parse.urlparse(prefix).hostname for prefix in (*GE_MIRROR_PREFIXES, *PLUGIN_DOWNLOAD_PREFIXES) if prefix}
        if parsed.hostname in mirror_hosts:
            embedded = parsed.path.lstrip("/")
            return embedded.startswith("https://github.com/") and Plugin._approved_https_url(embedded)
        return False

    @classmethod
    def _curl_command(cls, url: str, destination: Path, maximum: int, timeout: int) -> list[str]:
        if not cls._approved_https_url(url):
            raise ValueError("download_source_invalid")
        if maximum < 1:
            raise ValueError("download_source_invalid")
        return [
            "curl", "--fail", "--location", "--silent", "--show-error",
            "--proto", "=https", "--proto-redir", "=https",
            "--connect-timeout", "8", "--max-time", str(timeout),
            "--retry", "1", "--retry-delay", "1", "--retry-connrefused",
            "--speed-limit", "1024", "--speed-time", "25",
            "--max-filesize", str(maximum), "--user-agent", "DeckRecall",
            "--output", str(destination), url,
        ]

    @staticmethod
    def _external_command_environment() -> dict[str, str]:
        """Run system tools outside Decky Loader's PyInstaller library path."""
        environment = os.environ.copy()
        if "LD_LIBRARY_PATH_ORIG" in environment:
            environment["LD_LIBRARY_PATH"] = environment["LD_LIBRARY_PATH_ORIG"]
        else:
            environment.pop("LD_LIBRARY_PATH", None)
        return environment

    @classmethod
    def _curl_download_sync(cls, url: str, destination: Path, maximum: int, timeout: int = 120) -> None:
        try:
            result = subprocess.run(
                cls._curl_command(url, destination, maximum, timeout),
                stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=False, timeout=timeout + 5,
                env=cls._external_command_environment(),
            )
        except (OSError, subprocess.TimeoutExpired) as error:
            raise ValueError("download_transport_failed") from error
        if result.returncode != 0 or not destination.is_file() or destination.stat().st_size > maximum:
            raise ValueError("download_transport_failed")

    @classmethod
    def _curl_read_json(cls, url: str, maximum: int = 2 * 1024 * 1024) -> dict[str, Any]:
        descriptor, name = tempfile.mkstemp(prefix="deckrecall-json-")
        os.close(descriptor)
        temporary = Path(name)
        try:
            cls._curl_download_sync(url, temporary, maximum, 30)
            payload = json.loads(temporary.read_text(encoding="utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("download_manifest_invalid")
            return payload
        except (OSError, json.JSONDecodeError) as error:
            raise ValueError("download_manifest_invalid") from error
        finally:
            temporary.unlink(missing_ok=True)

    @classmethod
    def _curl_read_text(cls, url: str, maximum: int = 2 * 1024 * 1024) -> str:
        descriptor, name = tempfile.mkstemp(prefix="deckrecall-text-")
        os.close(descriptor)
        temporary = Path(name)
        try:
            cls._curl_download_sync(url, temporary, maximum, 30)
            return temporary.read_text(encoding="utf-8")
        except UnicodeDecodeError as error:
            raise ValueError("download_manifest_invalid") from error
        finally:
            temporary.unlink(missing_ok=True)

    @staticmethod
    def _parse_gitee_manifest(text: str) -> dict[str, str]:
        fields: dict[str, str] = {}
        allowed = {
            "id", "name", "version", "file", "source_url", "sha256", "size",
            "chunks", "chunk_size", "repo1", "repo2", "parts_repo1",
        }
        for raw in text.splitlines():
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            key, separator, value = line.partition("=")
            if not separator or key not in allowed or key in fields or not value:
                raise ValueError("download_manifest_invalid")
            fields[key] = value
        required = {"id", "version", "file", "source_url", "sha256", "size", "chunks", "chunk_size"}
        if not required.issubset(fields) or not re.fullmatch(r"[0-9a-f]{64}", fields["sha256"]):
            raise ValueError("download_manifest_invalid")
        for key in ("size", "chunks", "chunk_size", "parts_repo1"):
            if key in fields and not fields[key].isdigit():
                raise ValueError("download_manifest_invalid")
        return fields

    async def _curl_download_progress(
        self, url: str, destination: Path, expected_size: int, maximum: int,
        progress: Callable[[int], Awaitable[None]] | None = None,
    ) -> None:
        process: subprocess.Popen[bytes] | None = None
        try:
            process = subprocess.Popen(
                self._curl_command(url, destination, maximum, 1200),
                stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
                env=self._external_command_environment(),
            )
            last_size = -1
            while process.poll() is None:
                current = destination.stat().st_size if destination.exists() else 0
                if progress and current != last_size:
                    last_size = current
                    await progress(current)
                await asyncio.sleep(0.25)
            stderr = process.stderr.read() if process.stderr else b""
            if process.returncode != 0:
                raise ValueError("download_transport_failed") from RuntimeError(stderr.decode("utf-8", errors="replace")[:500])
            actual_size = destination.stat().st_size if destination.is_file() else -1
            if actual_size != expected_size or actual_size > maximum:
                raise ValueError("download_size_mismatch")
            if progress:
                await progress(actual_size)
        except OSError as error:
            raise ValueError("download_transport_failed") from error
        finally:
            if process and process.poll() is None:
                process.kill()
                process.wait()

    async def _download_gitee_mirror(
        self, repo: str, mirror_id: str, expected_url: str, expected_sha256: str,
        expected_size: int, suffix: str,
        progress: Callable[[int], Awaitable[None]] | None = None,
    ) -> Path:
        if repo not in GITEE_ALLOWED_REPOS or not re.fullmatch(r"[a-z0-9-]+", mirror_id):
            raise ValueError("download_manifest_invalid")
        base = f"{GITEE_RAW_ORIGIN}{repo}/raw/main/{mirror_id}"
        manifest = self._parse_gitee_manifest(await asyncio.to_thread(self._curl_read_text, f"{base}/latest.txt"))
        if (
            manifest["id"] != mirror_id or manifest["source_url"] != expected_url
            or manifest["sha256"] != expected_sha256.lower()
            or int(manifest["size"]) != expected_size
        ):
            raise ValueError("download_manifest_mismatch")
        chunks, chunk_size = int(manifest["chunks"]), int(manifest["chunk_size"])
        if chunks < 0 or chunks > 256 or (chunks and chunk_size != GITEE_CHUNK_SIZE):
            raise ValueError("download_manifest_invalid")
        version, filename = manifest["version"], manifest["file"]
        if not re.fullmatch(r"[A-Za-z0-9._-]+", version) or not re.fullmatch(r"[A-Za-z0-9._-]+", filename):
            raise ValueError("download_manifest_invalid")
        descriptor, name = tempfile.mkstemp(dir=self.data_root, prefix=f"{mirror_id}-", suffix=suffix)
        os.close(descriptor)
        destination = Path(name)
        try:
            if chunks == 0:
                await self._curl_download_progress(
                    f"{base}/{version}/{filename}", destination, expected_size, expected_size, progress
                )
            else:
                repo1 = manifest.get("repo1", repo)
                repo2 = manifest.get("repo2", repo)
                parts_repo1 = int(manifest.get("parts_repo1", str(chunks)))
                if repo1 not in GITEE_ALLOWED_REPOS or repo2 not in GITEE_ALLOWED_REPOS or not 0 <= parts_repo1 <= chunks:
                    raise ValueError("download_manifest_invalid")
                downloaded = 0
                with destination.open("wb") as output:
                    for index in range(1, chunks + 1):
                        selected_repo = repo1 if index <= parts_repo1 else repo2
                        part_size = min(chunk_size, expected_size - downloaded)
                        descriptor, part_name = tempfile.mkstemp(dir=self.data_root, prefix=f"{mirror_id}-part-")
                        os.close(descriptor)
                        part = Path(part_name)
                        try:
                            async def part_progress(current: int, base_bytes: int = downloaded) -> None:
                                if progress:
                                    await progress(base_bytes + current)
                            part_url = (
                                f"{GITEE_RAW_ORIGIN}{selected_repo}/raw/main/{mirror_id}/"
                                f"{version}/part.{index:04d}"
                            )
                            await self._curl_download_progress(part_url, part, part_size, chunk_size, part_progress)
                            with part.open("rb") as source:
                                shutil.copyfileobj(source, output, 1024 * 1024)
                            downloaded += part_size
                        finally:
                            part.unlink(missing_ok=True)
                if downloaded != expected_size:
                    raise ValueError("download_size_mismatch")
            if await asyncio.to_thread(self._hash, destination) != expected_sha256.lower():
                raise ValueError("download_checksum_failed")
            return destination
        except Exception:
            destination.unlink(missing_ok=True)
            raise

    async def _main(self) -> None:
        if decky: decky.logger.info("DeckRecall backend started")

    async def _unload(self) -> None:
        if self.download_worker and not self.download_worker.done():
            self.download_worker.cancel()
            await asyncio.gather(self.download_worker, return_exceptions=True)
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

    async def get_deckrecall_update_status(self) -> dict[str, Any]:
        """Compare the package installed on this Deck with the latest final release."""
        return await asyncio.to_thread(self._deckrecall_update_status)

    async def install_deckrecall_update(self) -> dict[str, Any]:
        """Download, verify and atomically replace this installed DeckRecall package."""
        status = await asyncio.to_thread(self._deckrecall_update_status)
        if not status["update_available"]:
            return {"ok": True, "updated": False, **status}
        release = status["release"]
        await self._emit_self_update_progress("self_update_download_phase", 1)
        archive = await self._download_deckrecall_update_archive(release)
        try:
            await self._emit_self_update_progress("self_update_verify_phase", 96)
            actual = await asyncio.to_thread(self._hash, archive)
            if actual.lower() != release["sha256"]:
                raise ValueError("self_update_checksum_failed")
            await self._emit_self_update_progress("self_update_install_phase", 98)
            await asyncio.to_thread(
                self._safe_install_deckrecall_archive, archive, release["version"]
            )
            await self._emit_self_update_progress("self_update_complete_phase", 100)
            self._event("0", "deckrecall_updated", {"version": release["version"]})
            self.restart_after_queue = "decky"
            return {
                "ok": True,
                "updated": True,
                "installed_version": status["installed_version"],
                "latest_version": release["version"],
                "restart_required": True,
            }
        finally:
            archive.unlink(missing_ok=True)

    async def start_deckrecall_update(self) -> dict[str, Any]:
        return self._enqueue_download_job(
            "self_update", "self_update_download_phase", self.install_deckrecall_update
        )

    async def prepare_trainer_download(self, game_name: str) -> dict[str, str]:
        """Resolve one official FLiNG attachment for Steam's native downloader.

        The frontend receives no arbitrary-path or arbitrary-origin capability:
        searches and downloads are pinned to flingtrainer.com, while the target
        is always the Steam browser's established Documents directory.
        """
        return await asyncio.to_thread(self._prepare_trainer_download, game_name)

    async def download_trainer_to_documents(self, game_name: str) -> dict[str, str]:
        """Download one vetted FLiNG executable to the fixed Documents folder."""
        prepared = await asyncio.to_thread(self._prepare_trainer_download, game_name)
        return await asyncio.to_thread(self._save_trainer_to_documents, prepared)

    async def open_protontricks(self, app_id: str) -> dict[str, Any]:
        """Open the Flatpak Protontricks GUI for one validated Steam app."""
        app_id = self._app_id(app_id)
        try:
            available = subprocess.run(
                ["flatpak", "info", "com.github.Matoking.protontricks"],
                stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                timeout=10, check=False, env=self._external_command_environment(),
            ).returncode == 0
        except (OSError, subprocess.SubprocessError):
            available = False
        if not available: raise ValueError("protontricks_not_installed")
        try:
            subprocess.Popen(
                ["flatpak", "run", "com.github.Matoking.protontricks", "--gui", app_id],
                stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                start_new_session=True, env=self._external_command_environment(),
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

    async def begin_exe_install(self, app_id: str) -> dict[str, Any]:
        """Record one fixed compatdata prefix before Steam launches an installer."""
        result = await asyncio.to_thread(self._exe_install_manager().begin, app_id)
        self._event(self._app_id(app_id), "exe_install_started", {})
        return result

    async def list_exe_install_candidates(self, app_id: str) -> dict[str, Any]:
        """List ranked EXEs from the fixed compatdata prefix; no UI path is accepted."""
        return await asyncio.to_thread(self._exe_install_manager().candidates, app_id)

    async def resolve_exe_install_candidate(
        self, app_id: str, candidate_id: str
    ) -> dict[str, str]:
        """Resolve an opaque candidate ID back into the already-scanned fixed prefix."""
        result = await asyncio.to_thread(
            self._exe_install_manager().resolve, app_id, candidate_id
        )
        self._event(self._app_id(app_id), "exe_install_completed", {})
        return result

    async def list_exe_game_folders(self) -> dict[str, Any]:
        """Return EXE-bearing folders below fixed user/removable-media roots."""
        return await asyncio.to_thread(self._exe_install_manager().list_game_folders)

    async def list_exe_game_candidates(self, folder_id: str) -> dict[str, Any]:
        """Rank likely game executables for one opaque allowlisted folder ID."""
        return await asyncio.to_thread(
            self._exe_install_manager().game_folder_candidates, folder_id
        )

    async def resolve_exe_game_candidate(
        self, folder_id: str, candidate_id: str
    ) -> dict[str, str]:
        """Resolve only a candidate previously returned from a fixed game root."""
        return await asyncio.to_thread(
            self._exe_install_manager().resolve_game_folder_candidate,
            folder_id,
            candidate_id,
        )

    def _memory_tuner(self) -> Any:
        if self.memory is None:
            try:
                from backend.memory import MemoryTuner
            except ImportError as error:
                raise ValueError("memory_backend_unavailable") from error
            self.memory = MemoryTuner()
        return self.memory

    def _exe_install_manager(self) -> Any:
        if self.exe_installs is None:
            try:
                from backend.exe_install import ExeInstallManager
            except ImportError as error:
                raise ValueError("exe_install_backend_unavailable") from error
            self.exe_installs = ExeInstallManager(self.steam_root, self.data_root)
        return self.exe_installs

    async def install_latest_ge_proton(self) -> dict[str, Any]:
        """Download, verify and install the latest author-published GE-Proton."""
        release = await asyncio.to_thread(self._ge_release)
        await self._update_download_job("ge_latest", "compat_download_phase", 1)
        archive = await self._download_latest_ge_archive(release)
        try:
            if self._hash(archive).lower() != release["sha256"].lower():
                raise ValueError("ge_proton_checksum_failed")
            destination = self._compatibilitytools_dir()
            installed = await asyncio.to_thread(
                self._safe_extract_ge, archive, destination, release["tag"]
            )
            self._event("0", "ge_proton_installed", {"version": installed})
            self.restart_after_queue = "steam"
            return {"ok": True, "version": installed, "source": release["source"]}
        finally:
            archive.unlink(missing_ok=True)

    async def start_latest_ge_proton_install(self) -> dict[str, Any]:
        return self._enqueue_download_job(
            "ge_latest", "compat_download_phase", self.install_latest_ge_proton
        )

    async def install_trainer_compat(self, version: str) -> dict[str, Any]:
        """Install one independently selected, fixed upstream GE-Proton release."""
        if version not in TRAINER_COMPAT_RELEASES:
            raise ValueError("trainer_compat_invalid")
        release = TRAINER_COMPAT_RELEASES[version]
        await self._emit_compat_progress(version, "compat_download_phase", 1)
        archive = await self._download_compat_archive(version, release)
        try:
            await self._emit_compat_progress(version, "compat_verify_phase", 96)
            actual = await asyncio.to_thread(self._hash, archive)
            expected = release["sha256"]
            if actual.lower() != expected:
                raise ValueError("ge_proton_checksum_failed")
            await self._emit_compat_progress(version, "compat_install_phase", 98)
            installed = await asyncio.to_thread(
                self._safe_extract_ge, archive, self._compatibilitytools_dir(), f"{version}.tar.gz"
            )
            await self._emit_compat_progress(version, "compat_complete_phase", 100)
            self._event("0", "trainer_compat_installed", {"version": installed})
            self.restart_after_queue = "steam"
            return {"ok": True, "version": installed}
        finally:
            archive.unlink(missing_ok=True)

    async def start_trainer_compat_install(self, version: str) -> dict[str, Any]:
        if version not in TRAINER_COMPAT_RELEASES:
            raise ValueError("trainer_compat_invalid")
        return self._enqueue_download_job(
            f"compat:{version}",
            "compat_download_phase",
            lambda: self.install_trainer_compat(version),
        )

    async def get_trainer_compat_status(self) -> dict[str, Any]:
        destination = self._compatibilitytools_dir()
        result: dict[str, Any] = {}
        for version in TRAINER_COMPAT_RELEASES:
            root = destination / version
            result[version] = {
                "installed": all((root / name).is_file() for name in ("compatibilitytool.vdf", "proton", "toolmanifest.vdf")),
                "progress": dict(self.compat_download_progress.get(version, {"phase": "compat_download_phase", "percent": 0})),
            }
        return result

    async def install_chinese_plugin(self, plugin_id: str) -> dict[str, Any]:
        """Install one fixed, checksummed plugin archive without arbitrary URLs."""
        if plugin_id not in CHINESE_PLUGIN_RELEASES:
            raise ValueError("plugin_install_invalid")
        release = CHINESE_PLUGIN_RELEASES[plugin_id]
        await self._emit_plugin_progress(plugin_id, "plugin_download_phase", 1)
        archive = await self._plugin_archive(release, plugin_id)
        try:
            await self._emit_plugin_progress(plugin_id, "plugin_verify_phase", 96)
            actual_sha256 = await asyncio.to_thread(self._hash, archive)
            if actual_sha256.lower() != release["sha256"]:
                raise ValueError("plugin_install_checksum_failed")
            await self._emit_plugin_progress(plugin_id, "plugin_install_phase", 98)
            await asyncio.to_thread(self._safe_install_plugin_archive, archive, release["directory"])
            await self._emit_plugin_progress(plugin_id, "plugin_complete_phase", 100)
            self._event("0", "plugin_installed", {"plugin": plugin_id})
            if self.restart_after_queue != "steam":
                self.restart_after_queue = "decky"
            return {"ok": True, "plugin": plugin_id}
        finally:
            archive.unlink(missing_ok=True)

    async def start_chinese_plugin_install(self, plugin_id: str) -> dict[str, Any]:
        if plugin_id not in CHINESE_PLUGIN_RELEASES:
            raise ValueError("plugin_install_invalid")
        return self._enqueue_download_job(
            f"plugin:{plugin_id}",
            "plugin_download_phase",
            lambda: self.install_chinese_plugin(plugin_id),
        )

    async def restart_decky_loader(self) -> dict[str, bool]:
        """Return the RPC result before restarting the service that hosts us."""
        asyncio.create_task(self._restart_decky_loader_delayed())
        return {"ok": True}

    async def _restart_decky_loader_delayed(self) -> None:
        await asyncio.sleep(1)
        try:
            await asyncio.to_thread(
                subprocess.run,
                ["systemctl", "restart", "plugin_loader.service"],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=15,
                check=False,
                env=self._external_command_environment(),
            )
        except (OSError, subprocess.SubprocessError):
            if decky:
                decky.logger.exception("DeckRecall could not restart Decky Loader")

    async def _plugin_archive(self, release: dict[str, Any], plugin_id: str) -> Path:
        bundled = release.get("bundled")
        if isinstance(bundled, str):
            source = Path(__file__).resolve().parent.parent / bundled
            if not source.is_file():
                if isinstance(release.get("url"), str):
                    return await self._download_plugin_archive(release, plugin_id)
                raise ValueError("plugin_install_bundled_missing")
            await self._emit_plugin_progress(plugin_id, "plugin_verify_phase", 40)
            if (await asyncio.to_thread(self._hash, source)).lower() != release["sha256"]:
                raise ValueError("plugin_install_checksum_failed")
            descriptor, temporary_name = tempfile.mkstemp(
                dir=self.data_root, prefix=f"{plugin_id}-", suffix=".zip"
            )
            os.close(descriptor)
            temporary = Path(temporary_name)
            try:
                await asyncio.to_thread(shutil.copyfile, source, temporary)
                await self._emit_plugin_progress(plugin_id, "plugin_install_phase", 90)
                return temporary
            except Exception:
                temporary.unlink(missing_ok=True)
                raise
        return await self._download_plugin_archive(release, plugin_id)

    def _prepare_trainer_download(self, game_name: str) -> dict[str, str]:
        if not isinstance(game_name, str):
            raise ValueError("trainer_search_invalid")
        if any(char in game_name for char in "\x00\r\n"):
            raise ValueError("trainer_search_invalid")
        query = " ".join(game_name.strip().split())
        if not query or len(query) > 256:
            raise ValueError("trainer_search_invalid")
        search_url = f"{FLING_ORIGIN}/?{urllib.parse.urlencode({'s': query})}"
        search_html = self._fetch_fling_html(search_url)
        result_match = re.search(
            r'<a\s+href="(https://flingtrainer\.com/trainer/[^"?#]+/)"\s+rel="bookmark">([^<]+)</a>',
            search_html,
            flags=re.IGNORECASE,
        )
        if not result_match:
            raise ValueError("trainer_not_found")
        page_url = html.unescape(result_match.group(1))
        page_html = self._fetch_fling_html(page_url)
        attachment_match = re.search(
            r'<a\s+href="(https://flingtrainer\.com/downloads/[A-Za-z0-9_-]+,,)"[^>]*'
            r'title="([^"]+)"[^>]*class="attachment-link"',
            page_html,
            flags=re.IGNORECASE,
        )
        if not attachment_match:
            raise ValueError("trainer_not_found")
        download_url = html.unescape(attachment_match.group(1))
        title = html.unescape(attachment_match.group(2)).strip()[:256]
        self._event("0", "trainer_download_prepared", {"game": query, "title": title})
        return {"url": download_url, "title": title, "directory": str(self.user_home / "Documents")}

    def _save_trainer_to_documents(self, prepared: dict[str, str]) -> dict[str, str]:
        url = prepared["url"]
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != "https" or parsed.hostname != "flingtrainer.com" or not parsed.path.startswith("/downloads/"):
            raise ValueError("trainer_search_invalid")
        documents = self.user_home / "Documents"
        documents.mkdir(parents=True, exist_ok=True)
        if documents.is_symlink() or not documents.is_dir():
            raise ValueError("trainer_documents_unavailable")
        request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 DeckRecall/0.3.3"})
        temporary: Path | None = None
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                final = urllib.parse.urlparse(response.geturl())
                if final.scheme != "https" or final.hostname != "flingtrainer.com":
                    raise ValueError("trainer_search_invalid")
                disposition = response.headers.get("Content-Disposition", "")
                match = re.search(r'filename\*?=(?:UTF-8\'\')?["\']?([^"\';]+)', disposition, re.IGNORECASE)
                raw_name = urllib.parse.unquote(match.group(1)) if match else prepared["title"]
                filename = Path(raw_name).name
                filename = re.sub(r"[^A-Za-z0-9._ ()\[\]-]+", "_", filename).strip(" .")[:180]
                if not filename.lower().endswith(".exe"):
                    filename += ".exe"
                target = documents / filename
                counter = 1
                while target.exists():
                    target = documents / f"{Path(filename).stem} ({counter}).exe"
                    counter += 1
                descriptor, temporary_name = tempfile.mkstemp(prefix=".deckrecall-trainer-", dir=documents)
                os.close(descriptor)
                temporary = Path(temporary_name)
                total = 0
                with temporary.open("wb") as output:
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        total += len(chunk)
                        if total > MAX_TRAINER_FILE_SIZE:
                            raise ValueError("trainer_download_too_large")
                        output.write(chunk)
                with temporary.open("rb") as downloaded:
                    signature = downloaded.read(2)
                if total < 2 or signature != b"MZ":
                    raise ValueError("trainer_download_invalid")
                os.chmod(temporary, 0o644)
                os.replace(temporary, target)
                temporary = None
                self._event("0", "trainer_downloaded", {"file": target.name})
                return {"path": str(target), "title": prepared["title"], "directory": str(documents)}
        except ValueError:
            raise
        except (OSError, urllib.error.URLError) as error:
            raise ValueError("trainer_download_failed") from error
        finally:
            if temporary:
                temporary.unlink(missing_ok=True)

    @staticmethod
    def _fetch_fling_html(url: str) -> str:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != "https" or parsed.hostname != "flingtrainer.com":
            raise ValueError("trainer_search_invalid")
        request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 DeckRecall/0.3.3"})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                final = urllib.parse.urlparse(response.geturl())
                if final.scheme != "https" or final.hostname != "flingtrainer.com":
                    raise ValueError("trainer_search_invalid")
                payload = response.read(MAX_TRAINER_PAGE_SIZE + 1)
                if len(payload) > MAX_TRAINER_PAGE_SIZE:
                    raise ValueError("trainer_search_failed")
                return payload.decode("utf-8", errors="replace")
        except ValueError:
            raise
        except (OSError, urllib.error.URLError) as error:
            raise ValueError("trainer_search_failed") from error

    async def get_plugin_install_progress(self, plugin_id: str) -> dict[str, Any]:
        if plugin_id not in CHINESE_PLUGIN_RELEASES:
            raise ValueError("plugin_install_invalid")
        return dict(self.plugin_download_progress.get(plugin_id, {"phase": "plugin_download_phase", "percent": 0}))

    async def get_trainer_compat_progress(self, version: str) -> dict[str, Any]:
        if version not in TRAINER_COMPAT_RELEASES:
            raise ValueError("trainer_compat_invalid")
        return dict(self.compat_download_progress.get(version, {"phase": "compat_download_phase", "percent": 0}))

    async def get_deckrecall_update_progress(self) -> dict[str, Any]:
        return dict(self.self_update_progress)

    async def get_download_jobs(self) -> list[dict[str, Any]]:
        return [dict(job) for job in self.download_jobs.values()]

    async def clear_download_job(self, job_id: str) -> dict[str, Any]:
        job = self.download_jobs.get(job_id)
        if not job:
            raise ValueError("download_job_invalid")
        if job["status"] not in {"done", "failed"}:
            raise ValueError("download_job_active")
        self.download_jobs.pop(job_id, None)
        self.download_job_operations.pop(job_id, None)
        await self._emit_download_jobs()
        return {"ok": True}

    def _enqueue_download_job(
        self,
        target: str,
        phase: str,
        operation: Callable[[], Awaitable[dict[str, Any]]],
    ) -> dict[str, Any]:
        active_id = self.active_download_targets.get(target)
        if active_id and active_id in self.download_jobs:
            return dict(self.download_jobs[active_id])
        self.download_job_sequence += 1
        job_id = f"{int(time.time() * 1000)}-{self.download_job_sequence}"
        job = {
            "job_id": job_id,
            "target": target,
            "status": "queued",
            "phase": phase,
            "percent": 0,
            "error": "",
        }
        self.download_jobs[job_id] = job
        self.download_job_operations[job_id] = operation
        self.active_download_targets[target] = job_id
        if self.download_queue is None:
            self.download_queue = asyncio.Queue()
        self.download_queue.put_nowait(job_id)
        if self.download_worker is None or self.download_worker.done():
            self.download_worker = asyncio.create_task(self._run_download_jobs())
        asyncio.create_task(self._emit_download_jobs())
        return dict(job)

    async def _run_download_jobs(self) -> None:
        assert self.download_queue is not None
        while True:
            job_id = await self.download_queue.get()
            job = self.download_jobs.get(job_id)
            operation = self.download_job_operations.get(job_id)
            if not job or not operation:
                continue
            job["status"] = "running"
            await self._emit_download_jobs()
            try:
                result = await operation()
                job.update(status="done", percent=100, error="", result=result)
            except asyncio.CancelledError:
                raise
            except Exception as error:
                job.update(status="failed", error=str(error) or "backend_error")
                if decky:
                    decky.logger.exception(f"DeckRecall download job {job_id} failed")
            finally:
                self.download_job_operations.pop(job_id, None)
                if self.active_download_targets.get(job["target"]) == job_id:
                    self.active_download_targets.pop(job["target"], None)
                await self._emit_download_jobs()
                if self.download_queue.empty() and self.restart_after_queue:
                    restart = self.restart_after_queue
                    self.restart_after_queue = ""
                    if decky:
                        await decky.emit("deckrecall_restart_required", restart)

    async def _emit_download_jobs(self) -> None:
        if decky:
            await decky.emit("download_jobs_changed", [dict(job) for job in self.download_jobs.values()])

    async def _update_download_job(self, target: str, phase: str, percent: int) -> None:
        job_id = self.active_download_targets.get(target)
        job = self.download_jobs.get(job_id) if job_id else None
        if job:
            job.update(phase=phase, percent=max(0, min(100, int(percent))))
            await self._emit_download_jobs()

    def _record_plugin_progress(self, plugin_id: str, phase: str, percent: int) -> dict[str, Any]:
        progress = {"phase": phase, "percent": max(0, min(100, int(percent)))}
        self.plugin_download_progress[plugin_id] = progress
        return progress

    async def _emit_plugin_progress(self, plugin_id: str, phase: str, percent: int) -> None:
        """Persist progress and publish the backend-owned job snapshot."""
        progress = self._record_plugin_progress(plugin_id, phase, percent)
        await self._update_download_job(f"plugin:{plugin_id}", progress["phase"], progress["percent"])
        if decky:
            await decky.emit("plugin_install_progress", plugin_id, progress["phase"], progress["percent"])

    async def _emit_compat_progress(self, version: str, phase: str, percent: int) -> None:
        progress = {"phase": phase, "percent": max(0, min(100, int(percent)))}
        self.compat_download_progress[version] = progress
        await self._update_download_job(f"compat:{version}", progress["phase"], progress["percent"])
        if decky:
            await decky.emit("trainer_compat_progress", version, progress["phase"], progress["percent"])

    async def _emit_self_update_progress(self, phase: str, percent: int) -> None:
        progress = {"phase": phase, "percent": max(0, min(100, int(percent)))}
        self.self_update_progress = progress
        await self._update_download_job("self_update", progress["phase"], progress["percent"])
        if decky:
            await decky.emit("deckrecall_update_progress", progress["phase"], progress["percent"])

    @staticmethod
    def _semantic_version(value: str, error_code: str) -> tuple[int, int, int]:
        match = re.fullmatch(r"v?([0-9]+)[.]([0-9]+)[.]([0-9]+)", value)
        if not match:
            raise ValueError(error_code)
        return tuple(int(part) for part in match.groups())  # type: ignore[return-value]

    def _installed_deckrecall_version(self) -> str:
        manifest = self.plugin_dir / "package.json"
        try:
            payload = json.loads(manifest.read_text(encoding="utf-8"))
            version = payload.get("version") if isinstance(payload, dict) else None
            if not isinstance(version, str):
                raise ValueError()
            self._semantic_version(version, "self_update_installed_version_invalid")
            return version
        except (OSError, json.JSONDecodeError, ValueError) as error:
            if isinstance(error, ValueError) and str(error) == "self_update_installed_version_invalid":
                raise
            raise ValueError("self_update_installed_version_invalid") from error

    def _deckrecall_release(self) -> dict[str, Any]:
        try:
            payload = self._curl_read_json(DECKRECALL_RELEASE_API)
            if not isinstance(payload, dict) or payload.get("draft") is True or payload.get("prerelease") is True:
                raise ValueError()
            tag = payload.get("tag_name")
            if not isinstance(tag, str):
                raise ValueError()
            self._semantic_version(tag, "self_update_release_invalid")
            assets = payload.get("assets")
            if not isinstance(assets, list):
                raise ValueError()
            asset = next(
                (item for item in assets if isinstance(item, dict) and item.get("name") == DECKRECALL_RELEASE_ASSET),
                None,
            )
            if not isinstance(asset, dict):
                raise ValueError()
            url, digest, size = asset.get("browser_download_url"), asset.get("digest"), asset.get("size")
            if not isinstance(url, str) or not url.startswith(DECKRECALL_RELEASE_ORIGIN):
                raise ValueError()
            expected_url = f"{DECKRECALL_RELEASE_ORIGIN}{tag}/{DECKRECALL_RELEASE_ASSET}"
            if url != expected_url or not isinstance(digest, str) or not isinstance(size, int):
                raise ValueError()
            match = re.fullmatch(r"sha256:([0-9a-fA-F]{64})", digest)
            if not match or size < 1 or size > MAX_PLUGIN_ARCHIVE_SIZE:
                raise ValueError()
            return {
                "version": tag.removeprefix("v"),
                "tag": tag,
                "url": url,
                "sha256": match.group(1).lower(),
                "size": size,
            }
        except (OSError, json.JSONDecodeError, ValueError) as error:
            if isinstance(error, ValueError) and str(error) == "self_update_release_invalid":
                raise
            raise ValueError("self_update_release_unavailable") from error

    def _deckrecall_update_status(self) -> dict[str, Any]:
        installed = self._installed_deckrecall_version()
        release = self._deckrecall_release()
        available = self._semantic_version(
            release["version"], "self_update_release_invalid"
        ) > self._semantic_version(installed, "self_update_installed_version_invalid")
        return {
            "installed_version": installed,
            "latest_version": release["version"],
            "update_available": available,
            "release": release,
        }

    async def _download_deckrecall_update_archive(self, release: dict[str, Any]) -> Path:
        last_error: Exception | None = None
        async def progress(downloaded: int) -> None:
            await self._emit_self_update_progress(
                "self_update_download_phase", min(95, downloaded * 95 // int(release["size"]))
            )
        try:
            return await self._download_gitee_mirror(
                GITEE_DECKRECALL_REPO, "deckrecall", release["url"], release["sha256"],
                int(release["size"]), ".zip", progress,
            )
        except ValueError as error:
            last_error = error
        for prefix in PLUGIN_DOWNLOAD_PREFIXES:
            candidate = release["url"] if not prefix else prefix + release["url"]
            descriptor, temporary_name = tempfile.mkstemp(
                dir=self.data_root, prefix="deckrecall-update-", suffix=".zip"
            )
            os.close(descriptor)
            temporary = Path(temporary_name)
            try:
                await self._download_self_update_source(candidate, temporary, int(release["size"]))
                return temporary
            except ValueError as error:
                last_error = error
                temporary.unlink(missing_ok=True)
                if str(error) == "self_update_too_large":
                    raise
            except (OSError, ValueError) as error:
                last_error = error
                temporary.unlink(missing_ok=True)
        raise ValueError("self_update_download_failed") from last_error

    async def _download_self_update_source(self, url: str, destination: Path, expected_size: int) -> None:
        async def progress(downloaded: int) -> None:
            await self._emit_self_update_progress(
                "self_update_download_phase", min(95, downloaded * 95 // expected_size)
            )
        try:
            await self._curl_download_progress(
                url, destination, expected_size, MAX_PLUGIN_ARCHIVE_SIZE, progress
            )
        except ValueError as error:
            raise ValueError("self_update_download_failed") from error

    def _safe_install_deckrecall_archive(self, archive: Path, expected_version: str) -> None:
        target = self.plugin_dir
        if target.name != "DeckRecall" or target.is_symlink() or not target.is_dir():
            raise ValueError("self_update_target_invalid")
        target_root = target.parent
        with zipfile.ZipFile(archive) as bundle:
            members = bundle.infolist()
            total = 0
            for member in members:
                path = Path(member.filename)
                if path.is_absolute() or ".." in path.parts or not member.filename.startswith("DeckRecall/"):
                    raise ValueError("self_update_archive_invalid")
                if (member.external_attr >> 16) & 0o170000 == 0o120000:
                    raise ValueError("self_update_archive_invalid")
                total += member.file_size
                if total > MAX_PLUGIN_UNPACKED_SIZE:
                    raise ValueError("self_update_too_large")
            required = {
                "DeckRecall/plugin.json", "DeckRecall/package.json", "DeckRecall/main.py",
                "DeckRecall/backend/main.py", "DeckRecall/dist/index.js",
            }
            if not required.issubset({member.filename.rstrip("/") for member in members}):
                raise ValueError("self_update_archive_invalid")
            staging = Path(tempfile.mkdtemp(prefix=".DeckRecall.update-", dir=target_root))
            backup = target_root / f".DeckRecall.previous-{os.urandom(3).hex()}"
            try:
                bundle.extractall(staging)
                extracted = staging / "DeckRecall"
                try:
                    package = json.loads((extracted / "package.json").read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError) as error:
                    raise ValueError("self_update_archive_invalid") from error
                if not isinstance(package, dict) or package.get("version") != expected_version:
                    raise ValueError("self_update_version_mismatch")
                for asset_name, release in CHINESE_PLUGIN_RELEASES.items():
                    bundled = release.get("bundled")
                    if not isinstance(bundled, str):
                        continue
                    old_asset = target / bundled
                    new_asset = extracted / bundled
                    if new_asset.exists() or not old_asset.is_file():
                        continue
                    if self._hash(old_asset).lower() != release["sha256"]:
                        continue
                    new_asset.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(old_asset, new_asset)
                os.replace(target, backup)
                try:
                    os.replace(extracted, target)
                    self._chown_to_deck_user(target)
                except Exception:
                    shutil.rmtree(target, ignore_errors=True)
                    if backup.exists():
                        os.replace(backup, target)
                    raise
                shutil.rmtree(backup, ignore_errors=True)
            except ValueError:
                raise
            except OSError as error:
                raise ValueError("self_update_install_failed") from error
            finally:
                shutil.rmtree(staging, ignore_errors=True)

    async def _download_compat_archive(self, version: str, release: dict[str, Any]) -> Path:
        expected_size = int(release["size"])
        last_error: Exception | None = None
        async def progress(downloaded: int) -> None:
            await self._emit_compat_progress(
                version, "compat_download_phase", min(95, downloaded * 95 // expected_size)
            )
        try:
            return await self._download_gitee_mirror(
                str(release["mirror_repo"]), str(release["mirror_id"]),
                str(release["url"]), str(release["sha256"]), expected_size, ".tar.gz", progress,
            )
        except ValueError as error:
            last_error = error
        for prefix in GE_MIRROR_PREFIXES:
            candidate = release["url"] if not prefix else prefix + release["url"]
            descriptor, temporary_name = tempfile.mkstemp(dir=self.data_root, prefix=f"{version}-", suffix=".tar.gz")
            os.close(descriptor)
            temporary = Path(temporary_name)
            try:
                await self._download_compat_source(candidate, temporary, version, expected_size)
                return temporary
            except ValueError as error:
                last_error = error
                temporary.unlink(missing_ok=True)
                if str(error) == "ge_proton_download_too_large":
                    raise
            except (OSError, ValueError) as error:
                last_error = error
                temporary.unlink(missing_ok=True)
        raise ValueError("ge_proton_download_failed") from last_error

    async def _download_compat_source(self, url: str, destination: Path, version: str, expected_size: int) -> None:
        try:
            async def progress(downloaded: int) -> None:
                await self._emit_compat_progress(
                    version, "compat_download_phase", min(95, downloaded * 95 // expected_size)
                )
            await self._curl_download_progress(url, destination, expected_size, MAX_GE_ARCHIVE_SIZE, progress)
        except ValueError as error:
            raise ValueError("ge_proton_download_failed") from error

    @staticmethod
    def _hash_algorithm(path: Path, algorithm: str) -> str:
        digest = hashlib.new(algorithm)
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    def _compatibilitytools_dir(self) -> Path:
        """Use Steam's primary root first, matching the toolbox install location."""
        for steam_root in (self.user_home / ".steam/root", self.user_home / ".steam/steam", self.steam_root):
            if steam_root.is_dir(): return steam_root / "compatibilitytools.d"
        raise ValueError("steam_root_not_found")

    def _ge_release(self) -> dict[str, str]:
        try:
            payload = self._curl_read_json(GE_RELEASE_API)
            if not isinstance(payload, dict) or not isinstance(payload.get("tag_name"), str): raise ValueError()
            tag = payload["tag_name"]
            if not re.fullmatch(r"GE-Proton[0-9]+-[0-9]+", tag): raise ValueError()
            assets = payload.get("assets")
            if not isinstance(assets, list): raise ValueError()
            archive = next((item for item in assets if isinstance(item, dict) and item.get("name") == f"{tag}.tar.gz"), None)
            if not isinstance(archive, dict): raise ValueError()
            asset_url, digest, size = archive.get("browser_download_url"), archive.get("digest"), archive.get("size")
            if not isinstance(asset_url, str) or not isinstance(digest, str) or not isinstance(size, int) or not asset_url.startswith("https://github.com/"):
                raise ValueError()
            match = re.fullmatch(r"sha256:([0-9a-fA-F]{64})", digest)
            if not match: raise ValueError()
            return {"tag": tag, "asset_name": f"{tag}.tar.gz", "asset_url": asset_url, "sha256": match.group(1), "size": str(size), "source": "github-release"}
        except (OSError, ValueError, json.JSONDecodeError):
            return {"tag": GE_FIXED_VERSION, "asset_name": f"{GE_FIXED_VERSION}.tar.gz", "asset_url": GE_FIXED_URL, "sha256": GE_FIXED_SHA256, "size": str(GE_FIXED_SIZE), "source": "fixed-fallback"}

    async def _download_latest_ge_archive(self, release: dict[str, str]) -> Path:
        manifest_url = str(release["asset_url"])
        expected_sha256 = str(release["sha256"]).lower()
        expected_size = int(release["size"])
        try:
            mirror_text = await asyncio.to_thread(
                self._curl_read_text,
                f"{GITEE_RAW_ORIGIN}{GITEE_PRIMARY_REPO}/raw/main/ge-proton/latest.txt",
            )
            manifest = self._parse_gitee_manifest(mirror_text)
            if manifest["source_url"] == manifest_url and manifest["sha256"] == expected_sha256 and int(manifest["size"]) == expected_size:
                return await self._download_gitee_mirror(
                    GITEE_PRIMARY_REPO, "ge-proton", manifest_url, expected_sha256,
                    expected_size, ".tar.gz", self._emit_latest_ge_bytes(expected_size),
                )
        except ValueError:
            pass
        last_error: Exception | None = None
        for prefix in GE_MIRROR_PREFIXES:
            candidate = manifest_url if not prefix else prefix + manifest_url
            descriptor, name = tempfile.mkstemp(dir=self.data_root, prefix="ge-", suffix=".download")
            os.close(descriptor)
            temporary = Path(name)
            try:
                await self._curl_download_progress(
                    candidate, temporary, expected_size,
                    MAX_GE_ARCHIVE_SIZE,
                    self._emit_latest_ge_bytes(expected_size),
                )
                return temporary
            except ValueError as error:
                last_error = error
                temporary.unlink(missing_ok=True)
        raise ValueError("ge_proton_download_failed") from last_error

    def _emit_latest_ge_bytes(self, expected_size: int) -> Callable[[int], Awaitable[None]]:
        async def progress(downloaded: int) -> None:
            await self._update_download_job(
                "ge_latest", "compat_download_phase", min(95, downloaded * 95 // expected_size)
            )
        return progress

    def _download_ge_file(self, url: str, name: str, maximum: int) -> Path:
        if not re.fullmatch(r"[A-Za-z0-9._-]+(?:\.tar\.gz)?", name): raise ValueError("ge_proton_release_invalid")
        last_error: Exception | None = None
        for prefix in GE_MIRROR_PREFIXES:
            candidate = url if not prefix else prefix + url
            temporary: Path | None = None
            try:
                descriptor, name_path = tempfile.mkstemp(dir=self.data_root, prefix="ge-", suffix=".download")
                os.close(descriptor)
                temporary = Path(name_path)
                self._curl_download_sync(candidate, temporary, maximum, 1200)
                return temporary
            except (OSError, ValueError) as error:
                if temporary: temporary.unlink(missing_ok=True)
                last_error = error
        raise ValueError("ge_proton_download_failed") from last_error

    async def _download_plugin_archive(self, release: dict[str, Any], plugin_id: str) -> Path:
        """Use the fixed Gitee chunks first, then vetted GitHub transports."""
        last_error: Exception | None = None
        expected_size = int(release["size"])
        async def progress(downloaded: int) -> None:
            await self._emit_plugin_progress(
                plugin_id, "plugin_download_phase", min(95, downloaded * 95 // expected_size)
            )
        try:
            return await self._download_gitee_mirror(
                str(release["mirror_repo"]), str(release["mirror_id"]),
                str(release["url"]), str(release["sha256"]), expected_size, ".zip", progress,
            )
        except ValueError as error:
            last_error = error
        for prefix in PLUGIN_DOWNLOAD_PREFIXES:
            candidate = release["url"] if not prefix else prefix + release["url"]
            temporary: Path | None = None
            try:
                with tempfile.NamedTemporaryFile(
                    dir=self.data_root, prefix=f"{plugin_id}-", suffix=".zip", delete=False
                ) as handle:
                    temporary = Path(handle.name)
                await self._download_plugin_source(
                    candidate, temporary, plugin_id, expected_size
                )
                if (await asyncio.to_thread(self._hash, temporary)).lower() != release["sha256"]:
                    raise ValueError("plugin_install_checksum_failed")
                return temporary
            except ValueError as error:
                last_error = error
                if temporary:
                    temporary.unlink(missing_ok=True)
                if str(error) == "plugin_install_too_large":
                    raise
            except (OSError, ValueError) as error:
                last_error = error
                if temporary:
                    temporary.unlink(missing_ok=True)
        raise ValueError("plugin_install_download_failed") from last_error

    async def _download_plugin_source(
        self, url: str, destination: Path, plugin_id: str, expected_size: int
    ) -> None:
        try:
            async def progress(downloaded: int) -> None:
                await self._emit_plugin_progress(
                    plugin_id, "plugin_download_phase", min(95, downloaded * 95 // expected_size)
                )
            await self._curl_download_progress(
                url, destination, expected_size, MAX_PLUGIN_ARCHIVE_SIZE, progress
            )
        except ValueError as error:
            raise ValueError("plugin_install_download_failed") from error

    def _safe_install_plugin_archive(self, archive: Path, directory: str) -> None:
        if directory not in {"Decky LSFG-VK", "Decky-Framegen"}:
            raise ValueError("plugin_install_invalid")
        current_plugin_dir = getattr(decky, "DECKY_PLUGIN_DIR", None) if decky else None
        target_root = Path(current_plugin_dir).parent if current_plugin_dir else self.user_home / "homebrew" / "plugins"
        target_root.mkdir(parents=True, exist_ok=True)
        try:
            self._chown_deck_user_directory(target_root)
        except ValueError:
            raise ValueError("plugin_install_owner_failed")
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
                if member.issym() or member.islnk():
                    if member.linkname.startswith("/"):
                        raise ValueError("ge_proton_archive_invalid")
                    raw_link = (
                        member.linkname if member.islnk()
                        else posixpath.join(posixpath.dirname(member.name), member.linkname)
                    )
                    resolved_link = posixpath.normpath(raw_link)
                    if resolved_link == root_name or not resolved_link.startswith(f"{root_name}/"):
                        raise ValueError("ge_proton_archive_invalid")
                if target.is_absolute() or ".." in target.parts or not (member.isdir() or member.isfile() or member.issym() or member.islnk()):
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
                # Members were fully validated above. Extract them manually so
                # installs do not depend on Python 3.12+'s tarfile filter API.
                for member in members:
                    target = staging.joinpath(*Path(member.name).parts)
                    if member.isdir():
                        target.mkdir(parents=True, exist_ok=True)
                        os.chmod(target, (member.mode or 0o755) & 0o777)
                hard_links: list[tuple[Path, Path]] = []
                for member in members:
                    target = staging.joinpath(*Path(member.name).parts)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    if member.isfile():
                        source = bundle.extractfile(member)
                        if source is None:
                            raise ValueError("ge_proton_archive_invalid")
                        with target.open("wb") as output:
                            shutil.copyfileobj(source, output, 1024 * 1024)
                        os.chmod(target, (member.mode or 0o644) & 0o777)
                    elif member.issym():
                        os.symlink(member.linkname, target)
                    elif member.islnk():
                        resolved = posixpath.normpath(member.linkname)
                        hard_links.append(
                            (staging.joinpath(*Path(resolved).parts), target)
                        )
                for source, target in hard_links:
                    os.link(source, target)
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
