"""Decky Loader entry point."""

import sys
from pathlib import Path

# Decky loads plugin entry points through importlib without adding the plugin
# directory to sys.path; make the backend package importable explicitly.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from backend.main import Plugin

__all__ = ["Plugin"]
