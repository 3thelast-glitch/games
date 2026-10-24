#!/usr/bin/env bash
# Manually build the upstream, STANDALONE STK Android target for validation.
# This does not integrate STK into the NAQLA APK.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$ROOT/native/supertuxkart/stk-code"
ASSETS="$ROOT/native/supertuxkart/stk-assets"

if [[ ! -f "$SOURCE/android/ANDROID.md" ]]; then
  echo "STK source missing. Run: git submodule update --init native/supertuxkart/stk-code" >&2
  exit 1
fi
if [[ ! -d "$ASSETS/tracks" || ! -d "$ASSETS/karts" ]]; then
  echo "STK assets missing. Checkout official stk-assets to native/supertuxkart/stk-assets" >&2
  echo "See native/supertuxkart/README.md" >&2
  exit 1
fi
if [[ ! -d "$SOURCE/lib/curl" || ! -d "$SOURCE/lib/freetype" ]]; then
  echo "Upstream native dependency sources missing from stk-code/lib." >&2
  echo "Read stk-code/android/ANDROID.md and install matching dependencies-android-src.tar.xz" >&2
  exit 1
fi
if [[ -z "${SDK_PATH:-}" || -z "${NDK_PATH:-}" ]]; then
  echo "Export SDK_PATH and NDK_PATH before building (see upstream ANDROID.md)." >&2
  exit 1
fi
if [[ ! -d "$SDK_PATH" || ! -d "$NDK_PATH" ]]; then
  echo "SDK_PATH or NDK_PATH is not an existing directory." >&2
  exit 1
fi
echo "Building upstream SuperTuxKart standalone Android target; NOT the NAQLA APK."
cd "$SOURCE/android"
./generate_assets.sh
./make_deps.sh
./make.sh "$@"
