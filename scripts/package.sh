#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
package_root="$project_dir/build/DeckRecall"
full_package_root="$project_dir/build/full/DeckRecall"

test -f "$project_dir/dist/index.js"
test -f "$project_dir/work/release-assets/lsfg-zh.zip"
test -f "$project_dir/work/release-assets/fsr4-zh.zip"
rm -rf "$project_dir/build"
mkdir -p "$package_root/dist" "$package_root/backend" "$package_root/locales"
cp "$project_dir/main.py" "$project_dir/plugin.json" "$project_dir/package.json" "$project_dir/README.md" "$package_root/"
cp "$project_dir/dist/index.js" "$package_root/dist/"
cp "$project_dir/backend/main.py" "$project_dir/backend/__init__.py" "$project_dir/backend/memory.py" "$package_root/backend/"
cp "$project_dir/locales/en-US.json" "$project_dir/locales/zh-CN.json" "$package_root/locales/"
cd "$project_dir/build"
zip -qr DeckRecall.zip DeckRecall
mkdir -p "$full_package_root/assets"
cp -R "$package_root/." "$full_package_root/"
cp "$project_dir/work/release-assets/lsfg-zh.zip" "$project_dir/work/release-assets/fsr4-zh.zip" "$full_package_root/assets/"
cd "$project_dir/build/full"
zip -qr ../DeckRecall-full.zip DeckRecall
echo "Created lightweight $project_dir/build/DeckRecall.zip and offline $project_dir/build/DeckRecall-full.zip"
