#!/usr/bin/env bash
# Build the ORIGINAL SuperTux C++/Emscripten engine with a real SDL3_image
# static archive. The old prebuilt WASM aborts at runtime at IMG_Load_IO.
set -euo pipefail
SRC="$1"
IMAGE_SRC="$2"
OUT="$3"
: "$VCPKG_INSTALLATION_ROOT"
source "$RUNNER_TEMP/emsdk/emsdk_env.sh"
command -v emcmake
command -v emcc
command -v ninja

# Emscripten SDL3 port supplies SDL itself. Compile SDL3_image from original
# upstream sources, not a link-time stub or an SDL2 ABI compatibility shim.
embuilder build sdl3
IMAGE_BUILD="$RUNNER_TEMP/naqla-sdl3-image"
# Emscripten's SDL3 port is 3.4.2 and meets SDL3_image's >=3.4 requirement,
# but its generated CMake config reports version 'unknown'. Remove only that
# CMake version check; this leaves the actual upstream SDL implementation intact.
sed -i 's/find_package(SDL3 ${SDL_REQUIRED_VERSION} REQUIRED COMPONENTS/find_package(SDL3 REQUIRED COMPONENTS/' "$IMAGE_SRC/CMakeLists.txt"
emcmake cmake -S "$IMAGE_SRC" -B "$IMAGE_BUILD" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_PREFIX_PATH="$RUNNER_TEMP/emsdk/upstream/emscripten/cache/sysroot" \
  -DBUILD_SHARED_LIBS=OFF \
  -DSDLIMAGE_DEPS_SHARED=OFF \
  -DSDLIMAGE_VENDORED=OFF \
  -DSDLIMAGE_SAMPLES=OFF \
  -DSDLIMAGE_TESTS=OFF \
  -DSDLIMAGE_INSTALL=OFF \
  -DSDLIMAGE_BACKEND_STB=ON \
  -DSDLIMAGE_AVIF=OFF \
  -DSDLIMAGE_JXL=OFF \
  -DSDLIMAGE_TIF=OFF \
  -DSDLIMAGE_WEBP=OFF \
  -DSDLIMAGE_PNG=ON \
  -DSDLIMAGE_PNG_LIBPNG=OFF \
  -DSDLIMAGE_PNG_SAVE=OFF
cmake --build "$IMAGE_BUILD" --parallel 4
IMAGE_LIB="$(find "$IMAGE_BUILD" -name 'libSDL3_image*.a' -type f | head -n 1)"
if test -z "$IMAGE_LIB" || ! test -s "$IMAGE_LIB"; then
  echo >&2 "Original SDL3_image static library did not build"; exit 1
fi
echo "Static original SDL3_image: $IMAGE_LIB"

# The upstream WASM flags incorrectly permit unresolved SDL3_image symbols,
# producing WASM that links but aborts with missing function IMG_Load_IO.
CMAKE_PATCH="$SRC/mk/cmake/SuperTux/Emscripten.cmake"
grep -q -- '-sUSE_SDL_IMAGE=3' "$CMAKE_PATCH"
grep -q -- '-sERROR_ON_UNDEFINED_SYMBOLS=0' "$CMAKE_PATCH"
sed -i 's/ -sUSE_SDL_IMAGE=3//g' "$CMAKE_PATCH"
sed -i 's/-sERROR_ON_UNDEFINED_SYMBOLS=0/-sERROR_ON_UNDEFINED_SYMBOLS=1/g' "$CMAKE_PATCH"
printf '\nset(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} %s")\n' "$IMAGE_LIB" >> "$CMAKE_PATCH"

mkdir -p "$SRC/build" "$OUT"
emcmake cmake -S "$SRC" -B "$SRC/build" \
  -DCMAKE_BUILD_TYPE=Release -DWARNINGS=ON \
  -DCMAKE_TOOLCHAIN_FILE="$VCPKG_INSTALLATION_ROOT/scripts/buildsystems/vcpkg.cmake" \
  -DVCPKG_CHAINLOAD_TOOLCHAIN_FILE="$RUNNER_TEMP/emsdk/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake" \
  -DVCPKG_TARGET_TRIPLET=wasm32-emscripten \
  -DCMAKE_POLICY_VERSION_MINIMUM=3.5 -DVCPKG_MANIFEST_FEATURES=core
rsync -a "$SRC/data/" "$SRC/build/data/"
cmake --build "$SRC/build" --parallel 4
for file in supertux2.js supertux2.wasm supertux2.data; do
  test -s "$SRC/build/$file"
  cp "$SRC/build/$file" "$OUT/"
done
cp "$SRC/build/template.html" "$OUT/supertux2.html"
cp "$SRC/LICENSE.txt" "$OUT/"
printf 'SuperTux commit: %s\nSDL3_image commit: %s\n' \
  "$(git -C "$SRC" rev-parse HEAD)" "$(git -C "$IMAGE_SRC" rev-parse HEAD)" \
  > "$OUT/ORIGINAL-SOURCE-PINS.txt"
echo "Complete original SuperTux WASM built with SDL3_image symbols: $OUT"