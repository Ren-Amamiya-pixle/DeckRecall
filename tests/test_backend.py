import asyncio
import hashlib
import io
import os
import subprocess
import tempfile
import tarfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock

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
        os.environ.pop("DECKRECALL_PLUGIN_DIR", None)
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

    def test_plugin_download_uses_gitee_then_ghfast_then_github(self):
        payload = b"verified plugin archive"
        expected = hashlib.sha256(payload).hexdigest()
        source_url = "https://github.com/example/plugin.zip"
        calls = []

        async def fake_gitee(*args, **kwargs):
            calls.append("gitee")
            raise ValueError("download_transport_failed")

        async def fake_download(url, destination, plugin_id, expected_size):
            calls.append(url)
            if url.startswith("https://ghfast.top/"):
                raise ValueError("plugin_install_download_failed")
            destination.write_bytes(payload)

        self.plugin._download_plugin_source = fake_download  # type: ignore[method-assign]
        self.plugin._download_gitee_mirror = fake_gitee  # type: ignore[method-assign]
        release = {
            "url": source_url,
            "sha256": expected,
            "directory": "Decky LSFG-VK",
            "size": len(payload),
            "mirror_repo": "zhoukeer-toolbox-mirror-3",
            "mirror_id": "deckrecall-lsfg-zh",
        }
        archive = self.run_async(self.plugin._download_plugin_archive, release, "lsfg")
        self.assertEqual(calls, ["gitee", f"https://ghfast.top/{source_url}", source_url])
        self.assertEqual(self.plugin._hash(archive), expected)
        archive.unlink(missing_ok=True)

    def test_external_curl_environment_restores_pyinstaller_library_path(self):
        cases = (
            ({"LD_LIBRARY_PATH": "/tmp/_MEI123"}, None),
            ({"LD_LIBRARY_PATH": "/tmp/_MEI123:/custom", "LD_LIBRARY_PATH_ORIG": "/custom"}, "/custom"),
            ({"LD_LIBRARY_PATH": "/tmp/_MEI123", "LD_LIBRARY_PATH_ORIG": ""}, ""),
        )
        for source, expected in cases:
            with self.subTest(source=source), mock.patch.dict(
                os.environ, {**source, "HTTPS_PROXY": "http://proxy.invalid"}, clear=True
            ):
                parent = dict(os.environ)
                child = self.plugin._external_command_environment()
                if expected is None:
                    self.assertNotIn("LD_LIBRARY_PATH", child)
                else:
                    self.assertEqual(child["LD_LIBRARY_PATH"], expected)
                self.assertEqual(child["HTTPS_PROXY"], "http://proxy.invalid")
                self.assertEqual(dict(os.environ), parent)

    def test_both_curl_paths_receive_sanitized_environment(self):
        sync_destination = Path(self.temp.name) / "sync.download"

        def fake_run(*args, **kwargs):
            sync_destination.write_bytes(b"x")
            return subprocess.CompletedProcess(args[0], 0)

        poisoned = {"LD_LIBRARY_PATH": "/tmp/_MEI123", "PATH": "/usr/bin:/bin"}
        with mock.patch.dict(os.environ, poisoned, clear=True), mock.patch(
            "backend.main.subprocess.run", side_effect=fake_run
        ) as run:
            self.plugin._curl_download_sync(
                "https://api.github.com/repos/Ren-Amamiya-pixle/DeckRecall/releases/latest",
                sync_destination, 1,
            )
            self.assertNotIn("LD_LIBRARY_PATH", run.call_args.kwargs["env"])

        async_destination = Path(self.temp.name) / "async.download"
        async_destination.write_bytes(b"x")
        process = mock.Mock()
        process.poll.return_value = 0
        process.returncode = 0
        process.stderr = io.BytesIO()
        with mock.patch.dict(os.environ, poisoned, clear=True), mock.patch(
            "backend.main.subprocess.Popen", return_value=process
        ) as popen:
            self.run_async(
                self.plugin._curl_download_progress,
                "https://github.com/Ren-Amamiya-pixle/DeckRecall/releases/download/v0.4.2/DeckRecall.zip",
                async_destination, 1, 1,
            )
            self.assertNotIn("LD_LIBRARY_PATH", popen.call_args.kwargs["env"])

    def test_progress_can_be_polled_when_decky_events_are_unavailable(self):
        self.plugin._record_plugin_progress("lsfg", "plugin_download_phase", 27)
        plugin_progress = self.run_async(self.plugin.get_plugin_install_progress, "lsfg")
        self.assertEqual(plugin_progress, {"phase": "plugin_download_phase", "percent": 27})

        self.plugin.compat_download_progress["GE-Proton10-29"] = {
            "phase": "compat_download_phase", "percent": 31,
        }
        compat_progress = self.run_async(
            self.plugin.get_trainer_compat_progress, "GE-Proton10-29"
        )
        self.assertEqual(compat_progress["percent"], 31)

        self.plugin.self_update_progress = {"phase": "self_update_verify_phase", "percent": 96}
        update_progress = self.run_async(self.plugin.get_deckrecall_update_progress)
        self.assertEqual(update_progress["phase"], "self_update_verify_phase")

    def test_gitee_manifest_is_strict_and_url_allowlist_rejects_unknown_hosts(self):
        manifest = self.plugin._parse_gitee_manifest(
            "id=deckrecall\nname=DeckRecall\nversion=v0.4.1\nfile=DeckRecall.zip\n"
            "source_url=https://github.com/Ren-Amamiya-pixle/DeckRecall/releases/download/v0.4.1/DeckRecall.zip\n"
            f"sha256={'a' * 64}\nsize=123\nchunks=0\nchunk_size=0\n"
        )
        self.assertEqual(manifest["id"], "deckrecall")
        self.assertTrue(self.plugin._approved_https_url(
            "https://gitee.com/zliu9732-hub/zhoukeer-toolbox-mirror-3/raw/main/deckrecall/latest.txt"
        ))
        self.assertFalse(self.plugin._approved_https_url("https://example.com/archive.zip"))
        with self.assertRaisesRegex(ValueError, "download_manifest_invalid"):
            self.plugin._parse_gitee_manifest("id=deckrecall\nid=duplicate\n")

    def test_progress_queries_reject_non_allowlisted_downloads(self):
        with self.assertRaisesRegex(ValueError, "plugin_install_invalid"):
            self.run_async(self.plugin.get_plugin_install_progress, "other")
        with self.assertRaisesRegex(ValueError, "trainer_compat_invalid"):
            self.run_async(self.plugin.get_trainer_compat_progress, "GE-Proton99-99")

    def test_download_queue_runs_in_background_and_records_result(self):
        async def scenario():
            started = asyncio.Event()
            finish = asyncio.Event()

            async def operation():
                started.set()
                await finish.wait()
                return {"ok": True}

            queued = self.plugin._enqueue_download_job(
                "plugin:lsfg", "plugin_download_phase", operation
            )
            self.assertEqual(queued["status"], "queued")
            await started.wait()
            running = (await self.plugin.get_download_jobs())[0]
            self.assertEqual(running["status"], "running")
            finish.set()
            for _ in range(20):
                await asyncio.sleep(0)
                completed = (await self.plugin.get_download_jobs())[0]
                if completed["status"] == "done":
                    break
            self.assertEqual(completed["status"], "done")
            self.assertEqual(completed["percent"], 100)
            await self.plugin._unload()

        asyncio.run(scenario())

    def test_download_queue_deduplicates_active_target_and_records_failure(self):
        async def scenario():
            release = asyncio.Event()

            async def first_operation():
                await release.wait()
                raise ValueError("plugin_install_download_failed")

            first = self.plugin._enqueue_download_job(
                "plugin:fsr4", "plugin_download_phase", first_operation
            )
            duplicate = self.plugin._enqueue_download_job(
                "plugin:fsr4", "plugin_download_phase", first_operation
            )
            self.assertEqual(first["job_id"], duplicate["job_id"])
            release.set()
            for _ in range(20):
                await asyncio.sleep(0)
                failed = (await self.plugin.get_download_jobs())[0]
                if failed["status"] == "failed":
                    break
            self.assertEqual(failed["error"], "plugin_install_download_failed")
            await self.plugin._unload()

        asyncio.run(scenario())

    def test_trainer_resolver_accepts_only_official_fling_links(self):
        pages = {
            "search": '<a href="https://flingtrainer.com/trainer/portal-2-trainer/" rel="bookmark">Portal 2 Trainer</a>',
            "page": '<a href="https://flingtrainer.com/downloads/AbCd1234,," title="Portal 2 Trainer.exe" class="attachment-link">Download</a>',
        }
        self.plugin._fetch_fling_html = lambda url: pages["search"] if "?s=" in url else pages["page"]  # type: ignore[method-assign]
        result = self.plugin._prepare_trainer_download(" Portal   2 ")
        self.assertEqual(result["url"], "https://flingtrainer.com/downloads/AbCd1234,,")
        self.assertEqual(result["directory"], str(self.plugin.user_home / "Documents"))
        with self.assertRaisesRegex(ValueError, "trainer_search_invalid"):
            self.plugin._prepare_trainer_download("bad\nname")

    def test_trainer_compat_rejects_non_allowlisted_version(self):
        with self.assertRaisesRegex(ValueError, "trainer_compat_invalid"):
            self.run_async(self.plugin.install_trainer_compat, "GE-Proton99-99")

    def test_update_status_reads_installed_package_not_source_version(self):
        installed = Path(self.temp.name) / "plugins/DeckRecall"
        installed.mkdir(parents=True)
        (installed / "package.json").write_text('{"version":"0.2.8"}', encoding="utf-8")
        self.plugin.plugin_dir = installed
        self.plugin._deckrecall_release = lambda: {  # type: ignore[method-assign]
            "version": "0.3.0", "tag": "v0.3.0", "url": "https://example.invalid",
            "sha256": "0" * 64, "size": 1,
        }
        status = self.plugin._deckrecall_update_status()
        self.assertEqual(status["installed_version"], "0.2.8")
        self.assertEqual(status["latest_version"], "0.3.0")
        self.assertTrue(status["update_available"])

    def test_update_status_uses_semantic_not_decimal_comparison(self):
        installed = Path(self.temp.name) / "plugins/DeckRecall"
        installed.mkdir(parents=True)
        (installed / "package.json").write_text('{"version":"0.10.0"}', encoding="utf-8")
        self.plugin.plugin_dir = installed
        self.plugin._deckrecall_release = lambda: {  # type: ignore[method-assign]
            "version": "0.9.0", "tag": "v0.9.0", "url": "https://example.invalid",
            "sha256": "0" * 64, "size": 1,
        }
        self.assertFalse(self.plugin._deckrecall_update_status()["update_available"])

    def test_self_update_archive_replaces_atomically_and_keeps_offline_assets(self):
        plugin_root = Path(self.temp.name) / "plugins"
        installed = plugin_root / "DeckRecall"
        (installed / "assets").mkdir(parents=True)
        (installed / "package.json").write_text('{"version":"0.2.8"}', encoding="utf-8")
        (installed / "assets/lsfg-zh.zip").write_bytes(b"offline-lsfg")
        (installed / "assets/fsr4-zh.zip").write_bytes(b"offline-fsr4")
        self.plugin.plugin_dir = installed
        archive = Path(self.temp.name) / "DeckRecall.zip"
        files = {
            "DeckRecall/plugin.json": b'{"name":"DeckRecall"}',
            "DeckRecall/package.json": b'{"version":"0.3.1"}',
            "DeckRecall/main.py": b"entry",
            "DeckRecall/backend/main.py": b"backend",
            "DeckRecall/dist/index.js": b"frontend",
        }
        with zipfile.ZipFile(archive, "w") as bundle:
            for name, payload in files.items():
                bundle.writestr(name, payload)
        expected_hashes = {
            "lsfg-zh.zip": "278d0fe9bc81c2f3c68e53efa00b66bbb3cbba07f0b7fa2937cf881426f2fe56",
            "fsr4-zh.zip": "f578ea48296eb7b4a5645aeaef084f0e6368ec285b79f845183e13fb9c4d5e53",
        }
        with mock.patch("os.geteuid", return_value=1000), mock.patch.object(
            self.plugin, "_hash", side_effect=lambda path: expected_hashes[path.name]
        ):
            self.plugin._safe_install_deckrecall_archive(archive, "0.3.1")
        self.assertEqual((installed / "package.json").read_text(), '{"version":"0.3.1"}')
        self.assertEqual((installed / "assets/lsfg-zh.zip").read_bytes(), b"offline-lsfg")
        self.assertEqual((installed / "assets/fsr4-zh.zip").read_bytes(), b"offline-fsr4")

    def test_self_update_rejects_release_package_version_mismatch(self):
        installed = Path(self.temp.name) / "plugins/DeckRecall"
        installed.mkdir(parents=True)
        (installed / "package.json").write_text('{"version":"0.2.8"}', encoding="utf-8")
        self.plugin.plugin_dir = installed
        archive = Path(self.temp.name) / "DeckRecall.zip"
        with zipfile.ZipFile(archive, "w") as bundle:
            bundle.writestr("DeckRecall/plugin.json", '{}')
            bundle.writestr("DeckRecall/package.json", '{"version":"9.9.9"}')
            bundle.writestr("DeckRecall/main.py", "entry")
            bundle.writestr("DeckRecall/backend/main.py", "backend")
            bundle.writestr("DeckRecall/dist/index.js", "frontend")
        with self.assertRaisesRegex(ValueError, "self_update_version_mismatch"):
            self.plugin._safe_install_deckrecall_archive(archive, "0.3.1")
        self.assertEqual((installed / "package.json").read_text(), '{"version":"0.2.8"}')
