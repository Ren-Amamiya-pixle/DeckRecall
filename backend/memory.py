"""DeckRecall virtual-memory tuning for SteamOS.

The Decky backend runs with root only when plugin.json carries the ``root``
flag. This module therefore writes system configuration directly while keeping
the same safety rules as the Zhoukeer toolbox: only files marked as managed by
DeckRecall are ever replaced or removed, and the system's original swap file
is preserved on restore.
"""
from __future__ import annotations

import math
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Callable


MANAGEMENT_MARKER = "# Managed by DeckRecall"
SAFE_PATH_RE = re.compile(r"^[A-Za-z0-9_./-]+$")

ZRAM_CONFIG_TEXT = """\
# Managed by DeckRecall
[zram0]
zram-size = ram / 2
compression-algorithm = zstd
swap-priority = 100
fs-type = swap
"""

SYSCTL_CONFIG_TEXT = """\
# Managed by DeckRecall
vm.swappiness = 1
"""

SWAP_UNIT_TEMPLATE = """\
# Managed by DeckRecall
[Unit]
Description=DeckRecall disk swap fallback

[Swap]
What={path}
Priority=10

[Install]
WantedBy=swap.target
"""


class MemoryTuner:
    """Read, apply and undo DeckRecall's recommended virtual-memory combo."""

    def __init__(
        self,
        *,
        meminfo: Path | None = None,
        swaps_file: Path | None = None,
        os_release: Path | None = None,
        sys_block_root: Path | None = None,
        power_supply_root: Path | None = None,
        swap_path: Path | None = None,
        fallback_swap_path: Path | None = None,
        zram_config: Path | None = None,
        sysctl_config: Path | None = None,
        systemd_dir: Path | None = None,
        min_free_gib: int | None = None,
        runner: Callable[[list[str]], subprocess.CompletedProcess[str]] | None = None,
    ) -> None:
        env = os.environ
        self.meminfo = meminfo or Path(env.get("DECKRECALL_MEMINFO", "/proc/meminfo"))
        self.swaps_file = swaps_file or Path(env.get("DECKRECALL_SWAPS_FILE", "/proc/swaps"))
        self.os_release = os_release or Path(env.get("DECKRECALL_OS_RELEASE", "/etc/os-release"))
        self.sys_block_root = sys_block_root or Path(env.get("DECKRECALL_SYS_BLOCK", "/sys/block"))
        self.power_supply_root = power_supply_root or Path(
            env.get("DECKRECALL_POWER_SUPPLY_ROOT", "/sys/class/power_supply")
        )
        self.swap_path = swap_path or Path(env.get("DECKRECALL_MEMORY_SWAP_PATH", "/home/swapfile"))
        self.fallback_swap_path = fallback_swap_path or Path(
            env.get("DECKRECALL_MEMORY_FALLBACK_SWAP_PATH", "/home/.deckrecall-swapfile")
        )
        self.zram_config = zram_config or Path(
            env.get("DECKRECALL_MEMORY_ZRAM_CONFIG", "/etc/systemd/zram-generator.conf.d/90-deckrecall.conf")
        )
        self.sysctl_config = sysctl_config or Path(
            env.get("DECKRECALL_MEMORY_SYSCTL_CONFIG", "/etc/sysctl.d/90-deckrecall-memory.conf")
        )
        self.systemd_dir = systemd_dir or Path(env.get("DECKRECALL_MEMORY_SYSTEMD_DIR", "/etc/systemd/system"))
        raw_min_free = min_free_gib if min_free_gib is not None else int(env.get("DECKRECALL_MEMORY_MIN_FREE_GIB", "4"))
        self.min_free_gib = raw_min_free
        self._runner = runner or self._default_runner
        self._was_immutable = False
        self._unit_was_enabled = False

    @staticmethod
    def _default_runner(args: list[str]) -> subprocess.CompletedProcess[str]:
        try:
            return subprocess.run(
                args,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                stdin=subprocess.DEVNULL,
                timeout=600,
                check=False,
            )
        except (OSError, subprocess.SubprocessError) as error:
            return subprocess.CompletedProcess(args, 127, "", str(error))

    def _run(self, args: list[str], *, code: str = "memory_apply_failed") -> subprocess.CompletedProcess[str]:
        result = self._runner(args)
        if result.returncode != 0:
            detail = (result.stderr or "").strip().replace("\n", " | ")[:200]
            raise ValueError(f"{code}: {detail}" if detail else code)
        return result

    def recommended_swap_gib(self) -> int:
        try:
            match = re.search(r"(?m)^MemTotal:\s+([0-9]+)", self.meminfo.read_text(encoding="utf-8"))
            if not match:
                raise ValueError
            memory_kib = int(match.group(1))
            if memory_kib <= 0:
                raise ValueError
        except (OSError, ValueError) as error:
            raise ValueError("memory_read_failed") from error
        memory_gib = math.ceil(memory_kib / 1048576)
        return max(8, min(16, memory_gib))

    def is_steamos(self) -> bool:
        try:
            text = self.os_release.read_text(encoding="utf-8")
        except OSError:
            text = ""
        os_id = re.search(r'(?m)^ID="?(steamos)"?\s*$', text)
        os_like = re.search(r'(?m)^ID_LIKE="?([^"\n]+)"?\s*$', text)
        if os_id or (os_like and "steamos" in os_like.group(1).split()):
            return True
        return shutil.which("steamos-readonly") is not None

    @staticmethod
    def is_root() -> bool:
        return os.geteuid() == 0

    def swap_is_active(self, path: Path) -> bool:
        requested = os.path.realpath(path)
        for entry in self._read_swaps():
            if os.path.realpath(entry["name"]) == requested:
                return True
        return False

    def status(self) -> dict[str, Any]:
        recommended = None
        try:
            recommended = self.recommended_swap_gib()
        except ValueError:
            pass
        return {
            "steamos": self.is_steamos(),
            "root": self.is_root(),
            "recommended_swap_gib": recommended,
            "swappiness": self._current_swappiness(),
            "swaps": self._read_swaps(),
            "zram_count": self._zram_count(),
            "space_kib": self._free_kib(self.swap_path.parent),
            "required_kib": (recommended + self.min_free_gib) * 1048576 if recommended else None,
            "power_ok": self._power_ok(),
            "managed": self._managed_state(recommended),
        }

    def optimize(self) -> dict[str, Any]:
        self._preflight()
        target_gib = self.recommended_swap_gib()
        if self._swapfile_is_complete(self.fallback_swap_path, target_gib):
            self.swap_path = self.fallback_swap_path
        unit_name = self._swap_unit_name(self.swap_path)
        fallback_unit_name = self._swap_unit_name(self.fallback_swap_path)
        self._config_target_is_safe(self.zram_config)
        self._config_target_is_safe(self.sysctl_config)
        self._config_target_is_safe(self.systemd_dir / unit_name)
        if fallback_unit_name != unit_name:
            self._config_target_is_safe(self.systemd_dir / fallback_unit_name)
        if not self._swapfile_is_complete(self.swap_path, target_gib):
            self._create_swapfile(target_gib)
        if self.swap_is_active(self.fallback_swap_path):
            self.swap_path = self.fallback_swap_path
        unit_name = self._swap_unit_name(self.swap_path)

        with tempfile.TemporaryDirectory(prefix="deckrecall-memory-") as tmp_dir:
            tmp = Path(tmp_dir)
            unit_file = tmp / "swap.unit"
            unit_file.write_text(SWAP_UNIT_TEMPLATE.format(path=self.swap_path), encoding="utf-8")
            self._write_config(self.zram_config, ZRAM_CONFIG_TEXT)
            self._write_config(self.sysctl_config, SYSCTL_CONFIG_TEXT)
            self._write_config(self.systemd_dir / unit_name, unit_file.read_text(encoding="utf-8"))

        self._run(["sysctl", "-w", "vm.swappiness=1"], code="memory_apply_failed")
        self._run(["systemctl", "daemon-reload"], code="memory_apply_failed")
        if self.swap_is_active(self.swap_path):
            self._run(["systemctl", "enable", unit_name], code="memory_swap_unit_failed")
        else:
            self._run(["systemctl", "enable", "--now", unit_name], code="memory_swap_unit_failed")
        return {"ok": True, "recommended_swap_gib": target_gib, "swap_path": str(self.swap_path)}

    def restore(self) -> dict[str, Any]:
        self._require_steamos()
        self._require_root()
        self._validate_paths()
        self._require_commands(["blkid", "swapon", "swapoff", "systemctl", "systemd-escape"])
        main_unit = self._swap_unit_name(self.swap_path)
        fallback_unit = self._swap_unit_name(self.fallback_swap_path)
        self._remove_managed_fallback_swap(fallback_unit)
        if fallback_unit != main_unit:
            self._remove_managed_main_unit(main_unit)
        self._remove_managed_config(self.zram_config)
        self._remove_managed_config(self.sysctl_config)
        self._run(["systemctl", "daemon-reload"], code="memory_restore_failed")
        return {"ok": True}

    def _preflight(self) -> None:
        self._require_steamos()
        self._require_root()
        self._validate_paths()
        self._require_commands(
            ["blkid", "df", "fallocate", "mkswap", "swapon", "swapoff", "systemctl", "systemd-escape", "sysctl"]
        )
        target_gib = self.recommended_swap_gib()
        free_kib = self._free_kib(self.swap_path.parent)
        required_kib = (target_gib + self.min_free_gib) * 1048576
        if free_kib is None or free_kib < required_kib:
            raise ValueError("memory_space_insufficient")
        if self._power_ok() is False:
            raise ValueError("memory_battery_low")

    def _require_steamos(self) -> None:
        if not self.is_steamos():
            raise ValueError("memory_steamos_required")

    def _require_root(self) -> None:
        if not self.is_root():
            raise ValueError("memory_root_required")

    def _require_commands(self, names: list[str]) -> None:
        missing = [name for name in names if not shutil.which(name)]
        if missing:
            raise ValueError("memory_command_missing")

    def _validate_paths(self) -> None:
        for path in (self.swap_path, self.fallback_swap_path, self.zram_config, self.sysctl_config, self.systemd_dir):
            if not path.is_absolute() or not SAFE_PATH_RE.fullmatch(str(path)):
                raise ValueError("memory_path_invalid")
        if not self._positive_integer(self.min_free_gib):
            raise ValueError("memory_path_invalid")
        if self.swap_path == self.fallback_swap_path:
            raise ValueError("memory_path_invalid")

    @staticmethod
    def _positive_integer(value: int) -> bool:
        return isinstance(value, int) and value > 0

    def _current_swappiness(self) -> int | None:
        result = self._runner(["sysctl", "-n", "vm.swappiness"])
        if result.returncode != 0:
            return None
        value = result.stdout.strip()
        return int(value) if value.isdigit() else None

    def _read_swaps(self) -> list[dict[str, Any]]:
        try:
            lines = self.swaps_file.read_text(encoding="utf-8").splitlines()
        except OSError:
            return []
        entries: list[dict[str, Any]] = []
        for line in lines[1:]:
            parts = line.split()
            if len(parts) < 5:
                continue
            entries.append({
                "name": parts[0],
                "type": parts[1],
                "size_kib": self._as_int(parts[2]),
                "used_kib": self._as_int(parts[3]),
                "priority": self._as_int(parts[4]),
            })
        return entries

    @staticmethod
    def _as_int(value: str) -> int | None:
        try:
            return int(value)
        except ValueError:
            return None

    def _zram_count(self) -> int:
        if not self.sys_block_root.is_dir():
            return 0
        try:
            return sum(1 for path in self.sys_block_root.glob("zram*") if path.is_dir())
        except OSError:
            return 0

    def _free_kib(self, path: Path) -> int | None:
        result = self._runner(["df", "-Pk", str(path)])
        if result.returncode != 0:
            return None
        lines = [line for line in result.stdout.splitlines() if line.strip()]
        if not lines:
            return None
        fields = lines[-1].split()
        if len(fields) < 5:
            return None
        try:
            return int(fields[3])
        except ValueError:
            return None

    def _power_ok(self) -> bool | None:
        try:
            for online in self.power_supply_root.glob("*/online"):
                if online.read_text(encoding="utf-8").strip() == "1":
                    return True
            for capacity in self.power_supply_root.glob("*/capacity"):
                try:
                    value = int(capacity.read_text(encoding="utf-8").strip())
                except ValueError:
                    continue
                return value >= 20
        except OSError:
            return None
        return None

    def _managed_state(self, recommended: int | None) -> dict[str, bool]:
        return {
            "main_swap_complete": self._swapfile_size_is_recommended(self.swap_path, recommended) if recommended else False,
            "fallback_swap_complete": self._swapfile_size_is_recommended(self.fallback_swap_path, recommended) if recommended else False,
            "zram_config": self._file_is_managed(self.zram_config),
            "sysctl_config": self._file_is_managed(self.sysctl_config),
            "main_unit": self._managed_unit(self.systemd_dir, self.swap_path),
            "fallback_unit": self._managed_unit(self.systemd_dir, self.fallback_swap_path),
        }

    def _swapfile_size_is_recommended(self, path: Path, target_gib: int | None) -> bool:
        if not target_gib or not path.is_file() or path.is_symlink():
            return False
        try:
            return path.stat().st_size == target_gib * 1024 * 1024 * 1024
        except OSError:
            return False

    def _managed_unit(self, systemd_dir: Path, swap_path: Path) -> bool:
        try:
            return self._swap_unit_is_managed(systemd_dir / self._swap_unit_name(swap_path), swap_path)
        except ValueError:
            return False

    def _swapfile_is_complete(self, path: Path, target_gib: int | None) -> bool:
        if not target_gib or not path.is_file() or path.is_symlink():
            return False
        try:
            if path.stat().st_size != target_gib * 1024 * 1024 * 1024:
                return False
        except OSError:
            return False
        result = self._runner(["blkid", "-p", "-s", "TYPE", "-o", "value", str(path)])
        return result.returncode == 0 and result.stdout.strip() == "swap"

    def _file_is_managed(self, path: Path) -> bool:
        if not path.is_file() or path.is_symlink():
            return False
        try:
            return any(line.strip() == MANAGEMENT_MARKER for line in path.read_text(encoding="utf-8").splitlines())
        except (OSError, UnicodeDecodeError):
            return False

    def _swap_unit_is_managed(self, unit_path: Path, swap_path: Path) -> bool:
        return self._file_is_managed(unit_path) and self._file_has_line(unit_path, f"What={swap_path}")

    def _file_has_line(self, path: Path, expected: str) -> bool:
        try:
            return any(line.rstrip("\r\n") == expected for line in path.read_text(encoding="utf-8").splitlines())
        except (OSError, UnicodeDecodeError):
            return False

    def _config_target_is_safe(self, target: Path) -> None:
        if target.exists() and (not target.is_file() or target.is_symlink()):
            raise ValueError("memory_config_conflict")
        if target.exists() and not self._file_is_managed(target):
            raise ValueError("memory_config_conflict")

    def _write_config(self, target: Path, content: str) -> None:
        self._config_target_is_safe(target)
        target.parent.mkdir(parents=True, exist_ok=True)
        descriptor, temporary = tempfile.mkstemp(prefix=f"{target.name}.", dir=str(target.parent), text=True)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
                handle.write(content)
                handle.flush()
                os.fsync(handle.fileno())
            os.chmod(temporary, 0o644)
            os.replace(temporary, target)
        except OSError:
            try:
                os.unlink(temporary)
            except OSError:
                pass
            raise ValueError("memory_apply_failed")

    def _remove_managed_config(self, path: Path) -> None:
        if not path.exists() and not path.is_symlink():
            return
        if not self._file_is_managed(path):
            return
        try:
            path.unlink()
        except OSError as error:
            raise ValueError("memory_restore_failed") from error

    def _swap_unit_name(self, path: Path) -> str:
        result = self._run(["systemd-escape", "--path", "--suffix=swap", str(path)], code="memory_swap_unit_failed")
        name = result.stdout.strip()
        if not name or "\n" in name or "/" in name or "\x00" in name:
            raise ValueError("memory_swap_unit_failed")
        return name

    def _disable_managed_unit(self, unit_name: str) -> None:
        self._unit_was_enabled = False
        state = self._runner(["systemctl", "is-enabled", unit_name]).stdout.strip()
        if state in {"enabled", "enabled-runtime", "linked", "linked-runtime", "alias"}:
            self._unit_was_enabled = True
            self._run(["systemctl", "disable", unit_name], code="memory_swap_unit_failed")
            after = self._runner(["systemctl", "is-enabled", unit_name]).stdout.strip()
            if after not in {"disabled", "static", "indirect", "masked", "not-found"}:
                raise ValueError("memory_swap_unit_failed")

    def _restore_managed_unit_enablement(self, unit_name: str) -> None:
        if not self._unit_was_enabled:
            return
        self._run(["systemctl", "enable", unit_name], code="memory_restore_failed")

    def _remove_managed_main_unit(self, unit_name: str) -> None:
        unit_path = self.systemd_dir / unit_name
        if not unit_path.exists() and not unit_path.is_symlink():
            return
        if not self._swap_unit_is_managed(unit_path, self.swap_path):
            return
        self._disable_managed_unit(unit_name)
        try:
            unit_path.unlink()
        except OSError:
            self._restore_managed_unit_enablement(unit_name)
            raise ValueError("memory_restore_failed")

    def _remove_managed_fallback_swap(self, unit_name: str) -> None:
        unit_path = self.systemd_dir / unit_name
        if not unit_path.exists() and not unit_path.is_symlink():
            return
        if not self._swap_unit_is_managed(unit_path, self.fallback_swap_path):
            return
        if self.fallback_swap_path.exists() or self.fallback_swap_path.is_symlink():
            if not self.fallback_swap_path.is_file() or self.fallback_swap_path.is_symlink():
                raise ValueError("memory_restore_failed")
            result = self._runner(["blkid", "-p", "-s", "TYPE", "-o", "value", str(self.fallback_swap_path)])
            if result.returncode != 0 or result.stdout.strip() != "swap":
                raise ValueError("memory_restore_failed")
        self._disable_managed_unit(unit_name)
        fallback_was_active = self.swap_is_active(self.fallback_swap_path)
        if fallback_was_active:
            try:
                self._run(["swapoff", str(self.fallback_swap_path)], code="memory_restore_failed")
            except ValueError:
                self._restore_managed_unit_enablement(unit_name)
                raise
        if self.fallback_swap_path.exists() or self.fallback_swap_path.is_symlink():
            try:
                self._clear_immutable_attribute(self.fallback_swap_path)
            except ValueError:
                if fallback_was_active:
                    try:
                        self._run(["swapon", "--priority", "10", str(self.fallback_swap_path)], code="memory_restore_failed")
                    except ValueError:
                        pass
                self._restore_managed_unit_enablement(unit_name)
                raise ValueError("memory_restore_failed")
            try:
                self.fallback_swap_path.unlink()
            except OSError:
                try:
                    self._restore_immutable_attribute(self.fallback_swap_path)
                except ValueError:
                    pass
                if fallback_was_active:
                    self._run(["swapon", "--priority", "10", str(self.fallback_swap_path)], code="memory_restore_failed")
                self._restore_managed_unit_enablement(unit_name)
                raise ValueError("memory_restore_failed")
            try:
                self._restore_immutable_attribute(self.fallback_swap_path)
            except ValueError as error:
                raise ValueError("memory_restore_failed") from error
        try:
            unit_path.unlink()
        except OSError as error:
            raise ValueError("memory_restore_failed") from error

    def _clear_immutable_attribute(self, path: Path) -> None:
        self._was_immutable = False
        if not shutil.which("lsattr") or not shutil.which("chattr"):
            return
        result = self._runner(["lsattr", "-d", "--", str(path)])
        if result.returncode != 0:
            return
        attributes = result.stdout.strip().split(None, 1)
        if attributes and "i" in attributes[0]:
            self._run(["chattr", "-i", str(path)], code="memory_swap_create_failed")
            self._was_immutable = True

    def _restore_immutable_attribute(self, path: Path) -> None:
        if not self._was_immutable or not path.exists():
            return
        self._run(["chattr", "+i", str(path)], code="memory_swap_create_failed")

    def _move_swapfile_after_forced_immutable_clear(self, source: Path, backup: Path) -> None:
        if not shutil.which("chattr"):
            raise ValueError("memory_swap_create_failed")
        self._run(["chattr", "-i", str(source)], code="memory_swap_create_failed")
        try:
            os.replace(source, backup)
        except OSError as error:
            raise ValueError("memory_swap_create_failed") from error
        self._was_immutable = True

    def _activate_fallback_swapfile(self, new_file: Path) -> None:
        backup = self.fallback_swap_path.parent / f".{self.fallback_swap_path.name}.backup.{os.getpid()}"
        if backup.exists() or backup.is_symlink():
            raise ValueError("memory_swap_create_failed")
        fallback_was_active = False
        if self.fallback_swap_path.exists() or self.fallback_swap_path.is_symlink():
            if not self.fallback_swap_path.is_file() or self.fallback_swap_path.is_symlink():
                raise ValueError("memory_swap_create_failed")
            if self.swap_is_active(self.fallback_swap_path):
                fallback_was_active = True
                self._run(["swapoff", str(self.fallback_swap_path)], code="memory_swap_create_failed")
            try:
                self._clear_immutable_attribute(self.fallback_swap_path)
            except ValueError:
                if fallback_was_active:
                    try:
                        self._run(["swapon", "--priority", "10", str(self.fallback_swap_path)], code="memory_swap_create_failed")
                    except ValueError:
                        pass
                raise
            try:
                os.replace(self.fallback_swap_path, backup)
            except OSError:
                self._restore_immutable_attribute(self.fallback_swap_path)
                if fallback_was_active:
                    self._run(["swapon", "--priority", "10", str(self.fallback_swap_path)], code="memory_swap_create_failed")
                raise ValueError("memory_swap_create_failed")
        try:
            os.replace(new_file, self.fallback_swap_path)
        except OSError:
            if backup.exists():
                os.replace(backup, self.fallback_swap_path)
            self._restore_immutable_attribute(self.fallback_swap_path)
            if fallback_was_active:
                self._run(["swapon", "--priority", "10", str(self.fallback_swap_path)], code="memory_swap_create_failed")
            raise ValueError("memory_swap_create_failed")
        try:
            self._run(["swapon", "--priority", "10", str(self.fallback_swap_path)], code="memory_swap_create_failed")
        except ValueError:
            self.fallback_swap_path.unlink(missing_ok=True)
            if backup.exists():
                os.replace(backup, self.fallback_swap_path)
            self._restore_immutable_attribute(self.fallback_swap_path)
            if fallback_was_active:
                self._run(["swapon", "--priority", "10", str(self.fallback_swap_path)], code="memory_swap_create_failed")
            raise
        backup.unlink(missing_ok=True)
        self.swap_path = self.fallback_swap_path

    def _create_swapfile(self, target_gib: int) -> None:
        swap_dir = self.swap_path.parent
        if not swap_dir.is_dir() or swap_dir.is_symlink():
            raise ValueError("memory_swap_create_failed")
        new_file = swap_dir / f".deckrecall-swapfile.new.{os.getpid()}"
        backup_file = swap_dir / f".deckrecall-swapfile.backup.{os.getpid()}"
        if new_file.exists() or new_file.is_symlink() or backup_file.exists() or backup_file.is_symlink():
            raise ValueError("memory_swap_create_failed")
        free_kib = self._free_kib(swap_dir)
        required_kib = (target_gib + self.min_free_gib) * 1048576
        if free_kib is None or free_kib < required_kib:
            raise ValueError("memory_space_insufficient")

        self._run(["fallocate", "-l", f"{target_gib}G", str(new_file)], code="memory_swap_create_failed")
        try:
            os.chmod(new_file, 0o600)
        except OSError:
            new_file.unlink(missing_ok=True)
            raise ValueError("memory_swap_create_failed")
        self._run(["mkswap", str(new_file)], code="memory_swap_create_failed")

        was_active = self.swap_is_active(self.swap_path)
        if was_active:
            self._run(["swapoff", str(self.swap_path)], code="memory_swap_create_failed")
            if self.swap_is_active(self.swap_path):
                new_file.unlink(missing_ok=True)
                raise ValueError("memory_swap_create_failed")

        if self.swap_path.exists() or self.swap_path.is_symlink():
            try:
                self._clear_immutable_attribute(self.swap_path)
                try:
                    os.replace(self.swap_path, backup_file)
                except OSError:
                    self._move_swapfile_after_forced_immutable_clear(self.swap_path, backup_file)
            except ValueError:
                try:
                    self._activate_fallback_swapfile(new_file)
                except ValueError:
                    new_file.unlink(missing_ok=True)
                    if was_active:
                        self._run(["swapon", str(self.swap_path)], code="memory_swap_create_failed")
                    raise
                return

        try:
            os.replace(new_file, self.swap_path)
        except OSError:
            if backup_file.exists():
                os.replace(backup_file, self.swap_path)
            self._restore_immutable_attribute(self.swap_path)
            if was_active:
                self._run(["swapon", str(self.swap_path)], code="memory_swap_create_failed")
            raise ValueError("memory_swap_create_failed")

        try:
            self._run(["swapon", "--priority", "10", str(self.swap_path)], code="memory_swap_create_failed")
        except ValueError:
            self.swap_path.unlink(missing_ok=True)
            if backup_file.exists():
                os.replace(backup_file, self.swap_path)
            self._restore_immutable_attribute(self.swap_path)
            if was_active:
                self._run(["swapon", str(self.swap_path)], code="memory_swap_create_failed")
            raise
        backup_file.unlink(missing_ok=True)
