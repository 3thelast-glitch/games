# SuperTuxKart upstream source (native integration staging)

The source checkout at `stk-code/` is a **Git submodule** of
https://github.com/supertuxkart/stk-code, pinned to
`2997f192e6876047909d909498dbb4810e5dbb8d` for reproducibility.

**Status: source import only.** This is **not yet a playable NAQLA game**, a
Capacitor/React port, a bundled Android game, or an iOS/web implementation.
Do not add it to NAQLA's game catalog until a working same-app native runtime
has been integrated and tested.

## Obtain source

From the NAQLA repository root:

```sh
git submodule update --init native/supertuxkart/stk-code
```

The official source repository does **not** contain all required gameplay assets.
Obtain them separately, into the adjacent `stk-assets/` directory:

```sh
svn checkout https://svn.code.sf.net/p/supertuxkart/code/stk-assets native/supertuxkart/stk-assets
```

The exact licensing terms for textures, models, sounds and other assets vary.
Review the `licenses.txt` files in asset subdirectories before redistributing
any asset.

## Standalone Android upstream build (integration prerequisite)

Read `stk-code/android/ANDROID.md` in full. Install its Linux build
dependencies, Android SDK/NDK and the matching dependency-source archive from
https://github.com/supertuxkart/dependencies/releases.
Extract the archive into `stk-code/lib/` as instructed upstream.
Then run:

```sh
export SDK_PATH=/path/to/Android/Sdk
export NDK_PATH=/path/to/Android/Sdk/ndk
bash scripts/build-supertuxkart-android.sh -j4
```

This produces the upstream **standalone** Android output for technical
validation. It does **not** integrate the game into NAQLA's Android APK.
Nothing is downloaded implicitly by the build helper, except build-side
operations explicitly performed by upstream build scripts.

## Integration requirements

See [the technical integration plan](../../docs/SUPERTUXKART_INTEGRATION.md).
The native runtime, gameplay assets, Android packaging, launcher and license
compliance are separate release gates.
