import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
try {
  process.loadEnvFile('.env');
} catch {}
const target = process.argv[2];
if (!['android', 'ios', 'all'].includes(target)) throw new Error('Choose android, ios, or all');
if (process.env.VITE_SERVER_URL && new URL(process.env.VITE_SERVER_URL).protocol !== 'https:')
  throw new Error('Native builds require an HTTPS VITE_SERVER_URL');
const run = (...args) => {
  const result = spawnSync(
    process.execPath,
    ['node_modules/@capacitor/cli/bin/capacitor', ...args],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
};
const platforms = target === 'all' ? ['android', 'ios'] : [target];
for (const platform of platforms) {
  if (!existsSync(platform)) run('add', platform);
  run('sync', platform);
  if (platform === 'android') {
    const path = 'android/app/src/main/AndroidManifest.xml';
    let manifest = readFileSync(path, 'utf8');
    manifest = manifest.replace('android:allowBackup="true"', 'android:allowBackup="false"');
    if (!manifest.includes('android:usesCleartextTraffic'))
      manifest = manifest.replace(
        '<application',
        '<application android:usesCleartextTraffic="false"',
      );
    if (!manifest.includes('android:scheme="com.boardarena.app"'))
      manifest = manifest.replace(
        '</activity>',
        `<intent-filter>
      <action android:name="android.intent.action.VIEW" />
      <category android:name="android.intent.category.DEFAULT" />
      <category android:name="android.intent.category.BROWSABLE" />
      <data android:scheme="com.boardarena.app" android:host="auth" />
    </intent-filter>
    </activity>`,
      );
    writeFileSync(path, manifest);
  } else {
    const path = 'ios/App/App/Info.plist';
    let plist = readFileSync(path, 'utf8');
    if (!plist.includes('<key>CFBundleURLTypes</key>'))
      plist = plist.replace(
        '<dict>',
        `<dict>
      <key>CFBundleURLTypes</key><array><dict><key>CFBundleURLName</key><string>com.boardarena.app</string><key>CFBundleURLSchemes</key><array><string>com.boardarena.app</string></array></dict></array>
      <key>CFBundleLocalizations</key><array><string>en</string><string>ar</string></array>
      <key>UIUserInterfaceStyle</key><string>Dark</string>`,
      );
    writeFileSync(path, plist);
    writeFileSync(
      'ios/App/App/PrivacyInfo.xcprivacy',
      `<?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
      <plist version="1.0"><dict><key>NSPrivacyTracking</key><false/><key>NSPrivacyAccessedAPITypes</key><array><dict><key>NSPrivacyAccessedAPIType</key><string>NSPrivacyAccessedAPICategoryUserDefaults</string><key>NSPrivacyAccessedAPITypeReasons</key><array><string>CA92.1</string></array></dict></array></dict></plist>`,
    );
    const project = 'ios/App/App.xcodeproj/project.pbxproj';
    let pbx = readFileSync(project, 'utf8');
    if (!pbx.includes('PrivacyInfo.xcprivacy')) {
      const file = 'B0A4DA4E4A00000000000001',
        build = 'B0A4DA4E4A00000000000002';
      pbx = pbx.replace(
        '/* Begin PBXBuildFile section */',
        `/* Begin PBXBuildFile section */\n${build} /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = ${file}; };`,
      );
      pbx = pbx.replace(
        '/* Begin PBXFileReference section */',
        `/* Begin PBXFileReference section */\n${file} /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };`,
      );
      pbx = pbx.replace(
        /(\/\* App \*\/ = \{\s*isa = PBXGroup;\s*children = \()/,
        `$1\n${file} /* PrivacyInfo.xcprivacy */,`,
      );
      pbx = pbx.replace(
        /(isa = PBXResourcesBuildPhase;\s*buildActionMask = [^;]+;\s*files = \()/,
        `$1\n${build} /* PrivacyInfo.xcprivacy in Resources */,`,
      );
      if ((pbx.match(/PrivacyInfo\.xcprivacy/g) ?? []).length !== 5)
        throw new Error('Xcode template changed: review privacy manifest integration');
      writeFileSync(project, pbx);
    }
  }
}
console.log(
  'Native projects synchronized. Build Android in Android Studio / Gradle and iOS in Xcode.',
);
if (!process.env.VITE_SERVER_URL)
  console.log(
    'Local and AI modes are bundled. Set VITE_SERVER_URL to your deployed HTTPS server and rebuild to enable online play.',
  );
