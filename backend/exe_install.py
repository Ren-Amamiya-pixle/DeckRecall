"""Constrained EXE discovery for DeckRecall's Steam/Proton installer flow."""
from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any

APP_ID = re.compile(r"^[1-9][0-9]{0,9}$")
MAX_EXE_FILES = 20_000
MAX_CANDIDATES = 80
MAX_GAME_FOLDERS = 120
LOW_VALUE_NAMES = re.compile(
    r"(?:^|[-_. ])(?:unins(?:tall)?[0-9]*|uninstaller|setup|installer|update|updater|"
    r"crash(?:pad|reporter)?|reportcrash|helper|bootstrap|vc_redist|vcredist|"
    r"dxsetup|dotnet|prereq|cefprocess|subprocess)(?:[-_. ]|$)",
    re.IGNORECASE,
)


class ExeInstallManager:
    """Scans only one validated Steam compatdata prefix selected by AppID."""

    def __init__(self, steam_root: Path, data_root: Path) -> None:
        self.steam_root = steam_root
        self.data_root = data_root

    def begin(self, app_id: str) -> dict[str, Any]:
        app_id = self._app_id(app_id)
        files = self._scan(app_id)
        state = {
            "app_id": app_id,
            "baseline": sorted(files),
        }
        self._write_state(app_id, state)
        return {"ok": True, "app_id": app_id, "baseline_count": len(files)}

    def candidates(self, app_id: str) -> dict[str, Any]:
        app_id = self._app_id(app_id)
        state = self._read_state(app_id)
        drive = self._prefix_drive(app_id)
        current = self._scan(app_id)
        baseline = set(state.get("baseline", []))
        ranked = []
        for relative, metadata in current.items():
            is_new = relative not in baseline
            score = self._score(relative, metadata, is_new)
            ranked.append(self._candidate(drive, relative, metadata, is_new, score))
        ranked.sort(key=lambda item: (-item["score"], item["relative"].casefold()))
        preferred = [item for item in ranked if item["new"] and item["score"] >= 0]
        visible = preferred or [item for item in ranked if item["score"] >= 0]
        return {
            "ok": True,
            "app_id": app_id,
            "candidates": visible[:MAX_CANDIDATES],
            "new_count": sum(1 for item in ranked if item["new"]),
        }

    def resolve(self, app_id: str, candidate_id: str) -> dict[str, str]:
        app_id = self._app_id(app_id)
        if not re.fullmatch(r"[0-9a-f]{16}", candidate_id):
            raise ValueError("exe_install_candidate_invalid")
        result = self.candidates(app_id)
        for candidate in result["candidates"]:
            if candidate["id"] == candidate_id:
                return {
                    "path": candidate["path"],
                    "directory": candidate["directory"],
                    "name": candidate["name"],
                }
        raise ValueError("exe_install_candidate_invalid")

    def list_game_folders(self) -> dict[str, Any]:
        """Enumerate EXE-bearing folders below fixed user and removable-media roots."""
        folders: list[dict[str, str]] = []
        seen: set[Path] = set()
        for root in self._game_roots():
            if not root.is_dir() or root.is_symlink():
                continue
            for directory in self._walk_game_folders(root):
                try:
                    resolved = directory.resolve(strict=True)
                except OSError:
                    continue
                if resolved in seen:
                    continue
                seen.add(resolved)
                token = self._folder_token(resolved)
                folders.append({
                    "id": token,
                    "name": resolved.name,
                    "location": str(resolved),
                })
                if len(folders) >= MAX_GAME_FOLDERS:
                    break
            if len(folders) >= MAX_GAME_FOLDERS:
                break
        folders.sort(key=lambda item: (item["name"].casefold(), item["location"].casefold()))
        self._write_folder_index(folders)
        return {"ok": True, "folders": folders}

    def game_folder_candidates(self, folder_id: str) -> dict[str, Any]:
        directory = self._resolve_folder(folder_id)
        candidates = []
        for path in self._folder_exes(directory):
            try:
                stat = path.stat()
                relative = path.relative_to(directory).as_posix()
            except (OSError, ValueError):
                continue
            metadata = {"size": stat.st_size, "mtime_ns": stat.st_mtime_ns}
            score = self._game_folder_score(directory, relative, metadata)
            item = self._candidate(directory, relative, metadata, True, score)
            candidates.append(item)
        candidates.sort(key=lambda item: (-item["score"], item["relative"].casefold()))
        visible = [item for item in candidates if item["score"] >= 0]
        return {"ok": True, "folder_id": folder_id, "candidates": visible[:MAX_CANDIDATES]}

    def resolve_game_folder_candidate(
        self, folder_id: str, candidate_id: str
    ) -> dict[str, str]:
        if not re.fullmatch(r"[0-9a-f]{16}", candidate_id):
            raise ValueError("exe_install_candidate_invalid")
        result = self.game_folder_candidates(folder_id)
        for candidate in result["candidates"]:
            if candidate["id"] == candidate_id:
                return {
                    "path": candidate["path"],
                    "directory": candidate["directory"],
                    "name": candidate["name"],
                }
        raise ValueError("exe_install_candidate_invalid")

    def _prefix_drive(self, app_id: str) -> Path:
        drive = self.steam_root / "steamapps" / "compatdata" / app_id / "pfx" / "drive_c"
        compatdata = (self.steam_root / "steamapps" / "compatdata").resolve(strict=False)
        resolved = drive.resolve(strict=False)
        if resolved != compatdata and compatdata not in resolved.parents:
            raise ValueError("exe_install_prefix_invalid")
        return drive

    def _scan(self, app_id: str) -> dict[str, dict[str, int]]:
        drive = self._prefix_drive(app_id)
        if not drive.is_dir() or drive.is_symlink():
            return {}
        found: dict[str, dict[str, int]] = {}
        count = 0
        for root, directories, files in os.walk(drive, followlinks=False):
            directories[:] = [
                name for name in directories
                if not (Path(root) / name).is_symlink()
            ]
            for filename in files:
                if not filename.casefold().endswith(".exe"):
                    continue
                path = Path(root) / filename
                try:
                    if path.is_symlink() or not path.is_file():
                        continue
                    stat = path.stat()
                    relative = path.relative_to(drive).as_posix()
                except (OSError, ValueError):
                    continue
                found[relative] = {"size": stat.st_size, "mtime_ns": stat.st_mtime_ns}
                count += 1
                if count >= MAX_EXE_FILES:
                    return found
        return found

    @staticmethod
    def _score(relative: str, metadata: dict[str, int], is_new: bool) -> int:
        name = Path(relative).name
        lowered = relative.casefold()
        score = 100 if is_new else 0
        if "/program files/" in f"/{lowered}" or "/program files (x86)/" in f"/{lowered}":
            score += 25
        if metadata["size"] >= 1024 * 1024:
            score += 15
        if metadata["size"] >= 16 * 1024 * 1024:
            score += 10
        if LOW_VALUE_NAMES.search(Path(name).stem):
            score -= 250
        if any(part.casefold() in {"windows", "system32", "syswow64", "temp"}
               for part in Path(relative).parts[:-1]):
            score -= 100
        score -= min(20, max(0, len(Path(relative).parts) - 4) * 2)
        return score

    @staticmethod
    def _game_folder_score(
        directory: Path, relative: str, metadata: dict[str, int]
    ) -> int:
        path = Path(relative)
        stem = path.stem.casefold()
        folder = directory.name.casefold()
        score = 40
        if len(path.parts) == 1:
            score += 45
        elif path.parts[0].casefold() in {"bin", "binaries", "game", "win64", "x64"}:
            score += 25
        compact_stem = re.sub(r"[^a-z0-9]", "", stem)
        compact_folder = re.sub(r"[^a-z0-9]", "", folder)
        if compact_stem and compact_folder and (
            compact_stem in compact_folder or compact_folder in compact_stem
        ):
            score += 50
        if metadata["size"] >= 4 * 1024 * 1024:
            score += 15
        if metadata["size"] >= 32 * 1024 * 1024:
            score += 15
        if LOW_VALUE_NAMES.search(path.stem):
            score -= 250
        if any(part.casefold() in {"redist", "redistributables", "support", "installer", "prerequisites"}
               for part in path.parts[:-1]):
            score -= 150
        score -= min(30, max(0, len(path.parts) - 2) * 4)
        return score

    def _candidate(
        self, drive: Path, relative: str, metadata: dict[str, int], is_new: bool, score: int
    ) -> dict[str, Any]:
        path = drive / Path(relative)
        candidate_id = hashlib.sha256(relative.encode("utf-8")).hexdigest()[:16]
        return {
            "id": candidate_id,
            "name": Path(relative).stem,
            "relative": relative,
            "path": str(path),
            "directory": str(path.parent),
            "size": metadata["size"],
            "new": is_new,
            "score": score,
        }

    def _state_path(self, app_id: str) -> Path:
        return self.data_root / "exe-installs" / f"{app_id}.json"

    def _game_roots(self) -> list[Path]:
        home = self.steam_root.parent.parent.parent
        configured_home = Path(os.environ.get("DECKRECALL_USER_HOME", str(home)))
        roots = [
            configured_home / "Downloads",
            configured_home / "Documents",
            configured_home / "Desktop",
            Path("/run/media/deck"),
        ]
        extra = os.environ.get("DECKRECALL_GAME_ROOTS", "")
        if extra:
            roots.extend(Path(item) for item in extra.split(os.pathsep) if item)
        return roots

    @staticmethod
    def _walk_game_folders(root: Path):
        yielded: set[Path] = set()
        for current, directories, files in os.walk(root, followlinks=False):
            current_path = Path(current)
            try:
                depth = len(current_path.relative_to(root).parts)
            except ValueError:
                continue
            directories[:] = [name for name in directories if not (current_path / name).is_symlink()]
            if depth > 3:
                directories[:] = []
                continue
            if any(filename.casefold().endswith(".exe") for filename in files):
                candidates = [current_path]
                try:
                    relative_parts = current_path.relative_to(root).parts
                    if relative_parts:
                        candidates.append(root / relative_parts[0])
                except ValueError:
                    pass
                for candidate in candidates:
                    if candidate not in yielded:
                        yielded.add(candidate)
                        yield candidate

    @staticmethod
    def _folder_exes(directory: Path):
        count = 0
        for current, directories, files in os.walk(directory, followlinks=False):
            current_path = Path(current)
            directories[:] = [name for name in directories if not (current_path / name).is_symlink()]
            try:
                depth = len(current_path.relative_to(directory).parts)
            except ValueError:
                continue
            if depth > 5:
                directories[:] = []
                continue
            for filename in files:
                if filename.casefold().endswith(".exe"):
                    path = current_path / filename
                    if path.is_file() and not path.is_symlink():
                        yield path
                        count += 1
                        if count >= MAX_EXE_FILES:
                            return

    @staticmethod
    def _folder_token(path: Path) -> str:
        return hashlib.sha256(str(path).encode("utf-8")).hexdigest()[:16]

    def _folder_index_path(self) -> Path:
        return self.data_root / "exe-installs" / "game-folders.json"

    def _write_folder_index(self, folders: list[dict[str, str]]) -> None:
        path = self._folder_index_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps({"folders": folders}, ensure_ascii=False), encoding="utf-8")
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)

    def _resolve_folder(self, folder_id: str) -> Path:
        if not re.fullmatch(r"[0-9a-f]{16}", folder_id):
            raise ValueError("exe_game_folder_invalid")
        index = self._folder_index_path()
        if not index.is_file() or index.is_symlink():
            raise ValueError("exe_game_folder_invalid")
        try:
            payload = json.loads(index.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise ValueError("exe_game_folder_invalid") from error
        for item in payload.get("folders", []):
            if isinstance(item, dict) and item.get("id") == folder_id:
                candidate = Path(str(item.get("location", "")))
                try:
                    resolved = candidate.resolve(strict=True)
                except OSError as error:
                    raise ValueError("exe_game_folder_invalid") from error
                allowed = False
                for root in self._game_roots():
                    try:
                        allowed_root = root.resolve(strict=True)
                    except OSError:
                        continue
                    if resolved == allowed_root or allowed_root in resolved.parents:
                        allowed = True
                        break
                if not allowed or not resolved.is_dir() or resolved.is_symlink():
                    raise ValueError("exe_game_folder_invalid")
                return resolved
        raise ValueError("exe_game_folder_invalid")

    def _read_state(self, app_id: str) -> dict[str, Any]:
        path = self._state_path(app_id)
        if not path.is_file() or path.is_symlink():
            raise ValueError("exe_install_not_started")
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise ValueError("exe_install_not_started") from error
        if payload.get("app_id") != app_id or not isinstance(payload.get("baseline"), list):
            raise ValueError("exe_install_not_started")
        return payload

    def _write_state(self, app_id: str, payload: dict[str, Any]) -> None:
        path = self._state_path(app_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)

    @staticmethod
    def _app_id(app_id: str) -> str:
        if not APP_ID.fullmatch(app_id):
            raise ValueError("invalid_app_id")
        return app_id
