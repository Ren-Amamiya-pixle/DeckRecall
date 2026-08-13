import os
import tempfile
import unittest
from pathlib import Path

from backend.exe_install import ExeInstallManager


class ExeInstallTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.steam_root = root / "steam"
        self.data_root = root / "data"
        self.drive = self.steam_root / "steamapps/compatdata/1234/pfx/drive_c"
        self.drive.mkdir(parents=True)
        self.manager = ExeInstallManager(self.steam_root, self.data_root)

    def tearDown(self):
        self.temp.cleanup()

    def write_exe(self, relative: str, size: int = 1024) -> Path:
        target = self.drive / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(b"MZ" + b"x" * max(0, size - 2))
        return target

    def test_prefers_new_main_executable_and_filters_install_helpers(self):
        self.write_exe("windows/system32/notepad.exe")
        self.manager.begin("1234")
        game = self.write_exe("Program Files/My Game/MyGame.exe", 2 * 1024 * 1024)
        self.write_exe("Program Files/My Game/unins000.exe", 3 * 1024 * 1024)
        self.write_exe("Program Files/My Game/updater.exe", 3 * 1024 * 1024)

        result = self.manager.candidates("1234")
        self.assertEqual(result["candidates"][0]["name"], "MyGame")
        self.assertTrue(result["candidates"][0]["new"])
        self.assertEqual(result["candidates"][0]["path"], str(game))
        self.assertNotIn("unins000", [item["name"] for item in result["candidates"]])

    def test_candidate_resolution_uses_opaque_id_and_current_scan(self):
        self.manager.begin("1234")
        game = self.write_exe("Program Files/Game/Game.exe", 2 * 1024 * 1024)
        candidate = self.manager.candidates("1234")["candidates"][0]
        resolved = self.manager.resolve("1234", candidate["id"])
        self.assertEqual(resolved["path"], str(game))
        self.assertEqual(resolved["directory"], str(game.parent))
        with self.assertRaisesRegex(ValueError, "exe_install_candidate_invalid"):
            self.manager.resolve("1234", "../../etc/passwd")

    def test_rejects_prefix_symlink_escape(self):
        other = Path(self.temp.name) / "outside"
        other.mkdir()
        drive = self.steam_root / "steamapps/compatdata/9999/pfx/drive_c"
        drive.parent.mkdir(parents=True)
        os.symlink(other, drive)
        with self.assertRaisesRegex(ValueError, "exe_install_prefix_invalid"):
            self.manager.begin("9999")

    def test_requires_begin_before_candidate_scan(self):
        with self.assertRaisesRegex(ValueError, "exe_install_not_started"):
            self.manager.candidates("1234")

    def test_ranks_main_exe_in_allowlisted_extracted_game_folder(self):
        game_root = Path(self.temp.name) / "games"
        os.environ["DECKRECALL_GAME_ROOTS"] = str(game_root)
        try:
            game = game_root / "Cool Game"
            game.mkdir(parents=True)
            (game / "CoolGame.exe").write_bytes(b"MZ" + b"x" * (5 * 1024 * 1024))
            (game / "config.exe").write_bytes(b"MZ" + b"x" * 1024)
            redist = game / "redist"
            redist.mkdir()
            (redist / "DXSETUP.exe").write_bytes(b"MZ" + b"x" * (8 * 1024 * 1024))

            folders = self.manager.list_game_folders()["folders"]
            selected = next(item for item in folders if item["name"] == "Cool Game")
            candidates = self.manager.game_folder_candidates(selected["id"])["candidates"]
            self.assertEqual(candidates[0]["name"], "CoolGame")
            resolved = self.manager.resolve_game_folder_candidate(selected["id"], candidates[0]["id"])
            self.assertEqual(Path(resolved["path"]), (game / "CoolGame.exe").resolve())
        finally:
            os.environ.pop("DECKRECALL_GAME_ROOTS", None)

    def test_game_folder_id_cannot_be_forged(self):
        self.manager.list_game_folders()
        with self.assertRaisesRegex(ValueError, "exe_game_folder_invalid"):
            self.manager.game_folder_candidates("../../home/deck")


if __name__ == "__main__":
    unittest.main()
