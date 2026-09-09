import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const nativeBrand = 'native/branding';

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function copy(source, destination) {
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
}

// Called after every Capacitor sync, including for previously generated projects.
// Stable app IDs, URL schemes, storage keys and LAN discovery names are intentional.
export function applyBranding(platform) {
  if (platform === 'android') {
    const res = 'android/app/src/main/res';
    for (const [density, size] of Object.entries({
      mdpi: 48,
      hdpi: 72,
      xhdpi: 96,
      xxhdpi: 144,
      xxxhdpi: 192,
    })) {
      for (const name of ['ic_launcher', 'ic_launcher_round'])
        copy(`${nativeBrand}/android-icons/icon-${size}.png`, `${res}/mipmap-${density}/${name}.png`);
    }
    copy(`${nativeBrand}/android-icons/icon-adaptive.png`, `${res}/drawable-nodpi/naqla_icon.png`);
    for (const name of ['ic_launcher', 'ic_launcher_round'])
      write(
        `${res}/mipmap-anydpi-v26/${name}.xml`,
        `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@color/naqla_background" />
  <foreground android:drawable="@drawable/naqla_icon" />
</adaptive-icon>
`,
      );
    write(
      `${res}/values/naqla.xml`,
      `<?xml version="1.0" encoding="utf-8"?>
<resources><color name="naqla_background">#0c1018</color></resources>
`,
    );
    const strings = `${res}/values/strings.xml`;
    write(
      strings,
      readFileSync(strings, 'utf8').replace(
        /(<string name="(?:app_name|title_activity_main)">)[\s\S]*?(<\/string>)/g,
        '$1NAQLA$2',
      ),
    );
    write(
      `${res}/values-ar/naqla.xml`,
      `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="app_name">نقلة</string>
  <string name="title_activity_main">نقلة</string>
</resources>
`,
    );
    // Remove density-specific template splash screens so they cannot override the branded XML.
    for (const entry of readdirSync(res, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith('drawable'))
        rmSync(join(res, entry.name, 'splash.png'), { force: true });
    }
    write(
      `${res}/drawable/splash.xml`,
      `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item android:drawable="@color/naqla_background" />
  <item android:width="160dp" android:height="160dp" android:gravity="center">
    <bitmap android:src="@drawable/naqla_icon" android:gravity="fill" />
  </item>
</layer-list>
`,
    );
    const stylesPath = `${res}/values/styles.xml`;
    const styles = readFileSync(stylesPath, 'utf8');
    const nextStyles = styles.replace(
      /<style name="AppTheme\.NoActionBarLaunch"[^>]*>[\s\S]*?<\/style>/,
      `<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@drawable/splash</item>
        <item name="windowSplashScreenBackground">@color/naqla_background</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/naqla_icon</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>`,
    );
    if (!nextStyles.includes('windowSplashScreenAnimatedIcon'))
      throw new Error('Android launch theme changed: review NAQLA branding integration');
    write(stylesPath, nextStyles);
  } else if (platform === 'ios') {
    const assets = 'ios/App/App/Assets.xcassets';
    copy(`${nativeBrand}/icon-1024.png`, `${assets}/AppIcon.appiconset/naqla-1024.png`);
    write(
      `${assets}/AppIcon.appiconset/Contents.json`,
      JSON.stringify(
        {
          images: [
            { filename: 'naqla-1024.png', idiom: 'universal', platform: 'ios', size: '1024x1024' },
          ],
          info: { author: 'xcode', version: 1 },
        },
        null,
        2,
      ) + '\n',
    );
    copy(`${nativeBrand}/splash.png`, `${assets}/Splash.imageset/naqla-splash.png`);
    write(
      `${assets}/Splash.imageset/Contents.json`,
      JSON.stringify(
        {
          images: [{ filename: 'naqla-splash.png', idiom: 'universal', scale: '1x' }],
          info: { author: 'xcode', version: 1 },
        },
        null,
        2,
      ) + '\n',
    );
    const plistPath = 'ios/App/App/Info.plist';
    let plist = readFileSync(plistPath, 'utf8');
    if (plist.includes('<key>CFBundleDisplayName</key>'))
      plist = plist.replace(
        /(<key>CFBundleDisplayName<\/key>\s*<string>)[\s\S]*?(<\/string>)/,
        '$1NAQLA$2',
      );
    else
      plist = plist.replace(
        '<dict>',
        '<dict>\n<key>CFBundleDisplayName</key><string>NAQLA</string>',
      );
    plist = plist.replace('Board Arena uses your local network', 'NAQLA uses your local network');
    write(plistPath, plist);
  } else {
    throw new Error(`Unsupported branding platform: ${platform}`);
  }
}
