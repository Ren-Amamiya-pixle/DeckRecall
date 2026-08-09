import asyncio
import hashlib
import os
import tempfile
import tarfile
import unittest
import zipfile
from pathlib import Path

from backend.main import Plugin


class BackendTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        os.environ["DECKRECALL_STEAM_ROOT"] = str(root / "steam")
        os.environ["DECKRECALL_DATA_DIR"] = str(root / "data")
        os.environ["DECKRECALL_USER_HOME"] = str(root / "user")
        self.plugin = Plugin()
        self.reg = self.plugin.steam_root / "steamapps/compatdata/480/pfx/user.reg"
        self.reg.parent.mkdir(parents=True); self.reg.write_text("healthy", encoding="utf-8")

    def tearDown(self):
        os.environ.pop("DECKRECALL_USER_HOME", None)
        self.temp.cleanup()
    def run_async(self, method, *args): return asyncio.run(method(*args))

    def test_snapshot_diagnose_restore_and_undo(self):
        saved = self.run_async(self.plugin.create_snapshot, "480", "Spacewar")
        snapshot_id = saved["snapshot"]["id"]
        self.reg.write_text("changed", encoding="utf-8")
        diagnostic = self.run_async(self.plugin.get_diagnostics, "480")
        self.assertEqual(diagnostic["changes"][0]["code"], "file_changed")
        restored = self.run_async(self.plugin.restore_snapshot, "480", snapshot_id)
        self.assertEqual(self.reg.read_text(encoding="utf-8"), "healthy")
        self.run_async(self.plugin.undo_restore, "480", restored["undo_id"])
        self.assertEqual(self.reg.read_text(encoding="utf-8"), "changed")

    def test_rejects_traversal_app_id(self):
        with self.assertRaises(ValueError): self.run_async(self.plugin.get_diagnostics, "../1")

    def test_launch_profile_persists_per_game(self):
        profile = {
            "trainer_enabled": True, "trainer_path": "/home/deck/trainers/game.exe",
            "lsfg_enabled": True, "fsr4_enabled": True, "original_options": "-dx11",
            "managed_options": "Dx12Upscaler=fsr31 ~/lsfg -- ~/fgmod/fgmod %command% -dx11"
        }
        saved = self.run_async(self.plugin.save_launch_profile, "480", profile)
        loaded = self.run_async(self.plugin.get_launch_profile, "480")
        self.assertEqual(saved, loaded)
        self.assertTrue(loaded["trainer_enabled"])
        self.assertTrue(loaded["lsfg_enabled"])
        self.assertTrue(loaded["fsr4_enabled"])

    def test_fsr4_uninstall_profile_disables_normal_fsr4(self):
        saved = self.run_async(self.plugin.save_launch_profile, "480", {
            "trainer_enabled": False, "trainer_path": "", "lsfg_enabled": False,
            "fsr4_enabled": True, "fsr4_uninstall_enabled": True,
            "original_options": "", "managed_options": "~/fgmod/fgmod-uninstaller.sh %command%",
        })
        self.assertTrue(saved["fsr4_uninstall_enabled"])
        self.assertFalse(saved["fsr4_enabled"])

    def test_launch_profile_rejects_injectable_path(self):
        profile = {
            "trainer_enabled": True, "trainer_path": "/home/deck/duck'bad.exe",
            "lsfg_enabled": False, "fsr4_enabled": False, "original_options": "", "managed_options": ""
        }
        with self.assertRaisesRegex(ValueError, "invalid_executable_path"):
            self.run_async(self.plugin.save_launch_profile, "480", profile)

    def test_finds_game_state_on_sd_card_library(self):
        sd_library = Path(self.temp.name) / "sdcard"
        sd_reg = sd_library / "steamapps/compatdata/620/pfx/user.reg"
        sd_manifest = sd_library / "steamapps/appmanifest_620.acf"
        sd_reg.parent.mkdir(parents=True); sd_reg.write_text("registry", encoding="utf-8")
        sd_manifest.write_text('"AppState" {}', encoding="utf-8")
        folders = self.plugin.steam_root / "steamapps/libraryfolders.vdf"
        folders.parent.mkdir(parents=True, exist_ok=True)
        folders.write_text(f'"libraryfolders" {{ "1" {{ "path" "{sd_library}" }} }}', encoding="utf-8")
        snapshot = self.run_async(self.plugin.create_snapshot, "620", "Portal 2")
        records = {record["path"]: record for record in snapshot["snapshot"]["files"]}
        self.assertTrue(records["appmanifest.acf"]["exists"])
        self.assertTrue(records["compatdata/pfx/user.reg"]["exists"])

    def test_ge_archive_extraction_rejects_links_and_keeps_valid_proton_tree(self):
        archive = Path(self.temp.name) / "GE-Proton10-1.tar.gz"
        source = Path(self.temp.name) / "source"
        (source / "GE-Proton10-1").mkdir(parents=True)
        (source / "GE-Proton10-1/proton").write_text("runner", encoding="utf-8")
        (source / "GE-Proton10-1/compatibilitytool.vdf").write_text("tool", encoding="utf-8")
        (source / "GE-Proton10-1/toolmanifest.vdf").write_text("manifest", encoding="utf-8")
        with tarfile.open(archive, "w:gz") as bundle:
            bundle.add(source / "GE-Proton10-1", arcname="GE-Proton10-1")
        installed = self.plugin._safe_extract_ge(archive, self.plugin.steam_root / "compatibilitytools.d", archive.name)
        self.assertEqual(installed, "GE-Proton10-1")
        self.assertTrue((self.plugin.steam_root / "compatibilitytools.d/GE-Proton10-1/proton").is_file())

        evil = Path(self.temp.name) / "GE-Proton10-2.tar.gz"
        with tarfile.open(evil, "w:gz") as bundle:
            link = tarfile.TarInfo("GE-Proton10-2/proton")
            link.type = tarfile.SYMTYPE; link.linkname = "/etc/passwd"
            bundle.addfile(link)
        with self.assertRaisesRegex(ValueError, "ge_proton_archive_invalid"):
            self.plugin._safe_extract_ge(evil, self.plugin.steam_root / "compatibilitytools.d", evil.name)

    def test_plugin_archive_safe_install(self):
        archive = Path(self.temp.name) / "lsfg-zh.zip"
        source = Path(self.temp.name) / "source"
        plugin_root = source / "Decky LSFG-VK"
        (plugin_root / "dist").mkdir(parents=True)
        (plugin_root / "plugin.json").write_text('{"name":"小黄鸭"}', encoding="utf-8")
        (plugin_root / "dist/index.js").write_text("frontend", encoding="utf-8")
        with zipfile.ZipFile(archive, "w") as bundle:
            for file in source.rglob("*"):
                if file.is_file():
                    bundle.write(file, file.relative_to(source))
        self.plugin._safe_install_plugin_archive(archive, "Decky LSFG-VK")
        final = self.plugin.user_home / "homebrew/plugins/Decky LSFG-VK"
        self.assertTrue((final / "plugin.json").is_file())
        self.assertTrue((final / "dist/index.js").is_file())

    def test_plugin_download_uses_ghfast_then_github(self):
        payload = b"verified plugin archive"
        expected = hashlib.sha256(payload).hexdigest()
        source_url = "https://github.com/example/plugin.zip"
        calls = []

        async def fake_download(url, destination, plugin_id, expected_size):
            calls.append(url)
            if url.startswith("https://ghfast.top/"):
                raise ValueError("plugin_install_download_failed")
            destination.write_bytes(payload)

        self.plugin._download_plugin_source = fake_download  # type: ignore[method-assign]
        release = {
            "url": source_url,
            "sha256": expected,
            "directory": "Decky LSFG-VK",
            "size": len(payload),
        }
        archive = self.run_async(self.plugin._download_plugin_archive, release, "lsfg")
        self.assertEqual(calls, [f"https://ghfast.top/{source_url}", source_url])
        self.assertEqual(self.plugin._hash(archive), expected)
        archive.unlink(missing_ok=True)
