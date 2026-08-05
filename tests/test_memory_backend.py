import subprocess
import tempfile
import unittest
from pathlib import Path

from backend.memory import MANAGEMENT_MARKER, MemoryTuner


class FakeRunner:
    """Logs commands and emulates the subset used by unit tests."""

    def __init__(self) -> None:
        self.calls: list[list[str]] = []

    def __call__(self, args: list[str]) -> subprocess.CompletedProcess[str]:
        self.calls.append(list(args))
        command = args[0]
        if command == "systemd-escape":
            if ".deckrecall-swapfile" in args[-1]:
                return subprocess.CompletedProcess(args, 0, "deckrecall-fallback.swap\n", "")
            return subprocess.CompletedProcess(args, 0, "deckrecall-swap.swap\n", "")
        if command == "sysctl":
            return subprocess.CompletedProcess(args, 0, "1\n", "")
        if command == "df":
            return subprocess.CompletedProcess(
                args, 0,
                "Filesystem 1024-blocks Used Available Capacity Mounted on\n"
                "/dev/mock 1000000000 1 999999999 1% /tmp\n",
                "",
            )
        if command == "blkid":
            return subprocess.CompletedProcess(args, 0, "swap\n", "")
        if command == "fallocate":
            gib = int(args[2].rstrip("G"))
            with open(args[3], "wb") as handle:
                handle.truncate(gib * 1024 * 1024 * 1024)
            return subprocess.CompletedProcess(args, 0, "", "")
        if command in {"mkswap", "swapon", "swapoff", "systemctl", "lsattr", "chattr"}:
            return subprocess.CompletedProcess(args, 0, "", "")
        return subprocess.CompletedProcess(args, 0, "", "")


class TestTuner(MemoryTuner):
    """Runs the real flow against a fake command runner."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def _require_commands(self, names: list[str]) -> None:
        return None

    def is_root(self) -> bool:
        return True


class EscapedUnitRunner(FakeRunner):
    def __call__(self, args: list[str]) -> subprocess.CompletedProcess[str]:
        if args[0] == "systemd-escape":
            return subprocess.CompletedProcess(args, 0, "home-\\x2edeckrecall-swapfile.swap\n", "")
        return super().__call__(args)


class MemoryTunerTests(unittest.TestCase):
    def test_recommended_swap_clamps_to_8_16_gib(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            meminfo = root / "meminfo"
            tuner = MemoryTuner(meminfo=meminfo, swaps_file=root / "swaps", os_release=root / "os-release")
            for kib, expected in [
                ("4194304", 8),
                ("8388608", 8),
                ("17179869184", 16),
                ("32212254720", 16),
            ]:
                meminfo.write_text(f"MemTotal: {kib} kB\n", encoding="utf-8")
                self.assertEqual(tuner.recommended_swap_gib(), expected)

    def test_status_reads_steamos_swaps_and_swappiness(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            meminfo = root / "meminfo"
            meminfo.write_text("MemTotal: 8388608 kB\n", encoding="utf-8")
            swaps = root / "swaps"
            swaps.write_text(
                "Filename Type Size Used Priority\n"
                "/home/swapfile file 16777212 128 -2\n",
                encoding="utf-8",
            )
            os_release = root / "os-release"
            os_release.write_text('ID=steamos\nVERSION="3.6\n', encoding="utf-8")
            runner = FakeRunner()
            tuner = MemoryTuner(
                meminfo=meminfo,
                swaps_file=swaps,
                os_release=os_release,
                swap_path=root / "swapfile",
                fallback_swap_path=root / ".deckrecall-swapfile",
                runner=runner,
            )
            status = tuner.status()
            self.assertTrue(status["steamos"])
            self.assertEqual(status["recommended_swap_gib"], 8)
            self.assertEqual(status["swappiness"], 1)
            self.assertEqual(status["swaps"][0]["name"], "/home/swapfile")
            self.assertEqual(status["swaps"][0]["priority"], -2)
            self.assertEqual(status["required_kib"], 12 * 1048576)
            self.assertFalse(status["managed"]["zram_config"])
            self.assertNotIn("blkid", [call[0] for call in runner.calls])

    def test_config_safety_refuses_unmanaged_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = root / "90-deckrecall.conf"
            target.write_text("user-owned\n", encoding="utf-8")
            tuner = MemoryTuner(
                meminfo=root / "meminfo",
                swaps_file=root / "swaps",
                os_release=root / "os-release",
                zram_config=target,
                runner=FakeRunner(),
            )
            with self.assertRaisesRegex(ValueError, "memory_config_conflict"):
                tuner._config_target_is_safe(target)
            target.write_text(f"{MANAGEMENT_MARKER}\n[zram0]\n", encoding="utf-8")
            tuner._config_target_is_safe(target)

    def test_swap_unit_name_accepts_systemd_escaped_paths(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            tuner = MemoryTuner(
                meminfo=root / "meminfo",
                swaps_file=root / "swaps",
                os_release=root / "os-release",
                fallback_swap_path=root / ".deckrecall-swapfile",
                runner=EscapedUnitRunner(),
            )
            self.assertEqual(tuner._swap_unit_name(root / ".deckrecall-swapfile"), "home-\\x2edeckrecall-swapfile.swap")

    def test_optimize_writes_managed_zram_sysctl_and_swap_unit(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            meminfo = root / "meminfo"
            meminfo.write_text("MemTotal: 17179869184 kB\n", encoding="utf-8")
            os_release = root / "os-release"
            os_release.write_text('ID=steamos\n', encoding="utf-8")
            swap_path = root / "swapfile"
            fallback = root / ".deckrecall-swapfile"
            zram_config = root / "etc" / "zram.conf"
            sysctl_config = root / "etc" / "memory.conf"
            systemd_dir = root / "etc" / "systemd"
            runner = FakeRunner()
            tuner = TestTuner(
                meminfo=meminfo,
                swaps_file=root / "swaps",
                os_release=os_release,
                swap_path=swap_path,
                fallback_swap_path=fallback,
                zram_config=zram_config,
                sysctl_config=sysctl_config,
                systemd_dir=systemd_dir,
                runner=runner,
            )
            result = tuner.optimize()
            self.assertTrue(result["ok"])
            self.assertEqual(result["recommended_swap_gib"], 16)
            self.assertEqual(result["swap_path"], str(swap_path))
            self.assertTrue(zram_config.read_text(encoding="utf-8").startswith(MANAGEMENT_MARKER))
            self.assertIn("zram-size = ram / 2", zram_config.read_text(encoding="utf-8"))
            self.assertIn("vm.swappiness = 1", sysctl_config.read_text(encoding="utf-8"))
            unit = systemd_dir / "deckrecall-swap.swap"
            self.assertTrue(unit.is_file())
            self.assertIn(f"What={swap_path}", unit.read_text(encoding="utf-8"))
            commands = " ".join(" ".join(call) for call in runner.calls)
            self.assertIn("fallocate -l 16G", commands)
            self.assertIn("mkswap", commands)
            self.assertIn("swapon --priority 10", commands)
            self.assertIn("systemctl enable --now", commands)

    def test_restore_removes_only_deckrecall_managed_settings(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            meminfo = root / "meminfo"
            meminfo.write_text("MemTotal: 8388608 kB\n", encoding="utf-8")
            os_release = root / "os-release"
            os_release.write_text('ID=steamos\n', encoding="utf-8")
            swap_path = root / "swapfile"
            swap_path.write_text("system original\n", encoding="utf-8")
            fallback = root / ".deckrecall-swapfile"
            zram_config = root / "etc" / "zram.conf"
            zram_config.parent.mkdir(parents=True)
            zram_config.write_text(f"{MANAGEMENT_MARKER}\n[zram0]\n", encoding="utf-8")
            sysctl_config = root / "etc" / "memory.conf"
            sysctl_config.parent.mkdir(parents=True, exist_ok=True)
            sysctl_config.write_text(f"{MANAGEMENT_MARKER}\nvm.swappiness = 1\n", encoding="utf-8")
            systemd_dir = root / "etc" / "systemd"
            systemd_dir.mkdir(parents=True)
            unit = systemd_dir / "deckrecall-swap.swap"
            unit.write_text(
                f"{MANAGEMENT_MARKER}\n[Swap]\nWhat={swap_path}\n",
                encoding="utf-8",
            )
            tuner = TestTuner(
                meminfo=meminfo,
                swaps_file=root / "swaps",
                os_release=os_release,
                swap_path=swap_path,
                fallback_swap_path=fallback,
                zram_config=zram_config,
                sysctl_config=sysctl_config,
                systemd_dir=systemd_dir,
                runner=FakeRunner(),
            )
            result = tuner.restore()
            self.assertTrue(result["ok"])
            self.assertFalse(zram_config.exists())
            self.assertFalse(sysctl_config.exists())
            self.assertFalse(unit.exists())
            self.assertTrue(swap_path.exists())

    def test_restore_preserves_user_owned_config(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            meminfo = root / "meminfo"
            meminfo.write_text("MemTotal: 8388608 kB\n", encoding="utf-8")
            os_release = root / "os-release"
            os_release.write_text('ID=steamos\n', encoding="utf-8")
            zram_config = root / "etc" / "zram.conf"
            zram_config.parent.mkdir(parents=True)
            zram_config.write_text("user-owned\n", encoding="utf-8")
            tuner = TestTuner(
                meminfo=meminfo,
                swaps_file=root / "swaps",
                os_release=os_release,
                swap_path=root / "swapfile",
                fallback_swap_path=root / ".deckrecall-swapfile",
                zram_config=zram_config,
                sysctl_config=root / "etc" / "memory.conf",
                systemd_dir=root / "etc" / "systemd",
                runner=FakeRunner(),
            )
            tuner.restore()
            self.assertTrue(zram_config.exists())
            self.assertEqual(zram_config.read_text(encoding="utf-8"), "user-owned\n")


if __name__ == "__main__":
    unittest.main()
