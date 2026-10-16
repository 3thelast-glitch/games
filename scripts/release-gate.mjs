import { existsSync, readFileSync } from 'node:fs';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing release setting: ${name}`);
  return value;
}

function releaseOrigin(value) {
  let url;
  try { url = new URL(value); }
  catch { throw new Error('VITE_SERVER_URL must be a valid public HTTPS origin'); }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || !hostname || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash ||
      hostname === 'localhost' || hostname === '0.0.0.0' ||
      hostname.endsWith('.localhost') || hostname.endsWith('.local') ||
      hostname.endsWith('.internal') || hostname.endsWith('.test') ||
      hostname.endsWith('.invalid') || hostname === 'example.com' ||
      hostname.endsWith('.example.com') || /^\[?[0-9a-f:.]+\]?$/.test(hostname) ||
      !hostname.includes('.')) {
    throw new Error('VITE_SERVER_URL must be a public DNS HTTPS origin without credentials, paths or placeholders');
  }
  if (url.port && url.port !== '443')
    throw new Error('VITE_SERVER_URL must use the normal HTTPS port for this release process');
  return url.origin;
}

function identity(config) {
  const match = /\bappId:\s*['"]([^'"]+)['"]/.exec(config);
  if (!match) throw new Error('Could not read stable appId from capacitor.config.ts');
  return match[1];
}

/** Runs before any expensive native release build. Does NOT test server availability. */
export function checkAndroidRelease(env = process.env) {
  const currentEnv = process.env;
  try {
    process.env = env;
    const origin = releaseOrigin(required('VITE_SERVER_URL'));
    const confirmedId = required('NAQLA_RELEASE_APP_ID');
    const actualId = identity(readFileSync('capacitor.config.ts', 'utf8'));
    if (confirmedId !== actualId)
      throw new Error('NAQLA_RELEASE_APP_ID differs from capacitor.config.ts; review Android/iOS OAuth identities before release');
    if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,}$/.test(actualId))
      throw new Error('Invalid Android application ID in capacitor.config.ts');
    const versionCode = required('NAQLA_ANDROID_VERSION_CODE');
    if (!/^[1-9][0-9]*$/.test(versionCode) || Number(versionCode) > 2100000000)
      throw new Error('NAQLA_ANDROID_VERSION_CODE must be a positive Play-compatible integer');
    const packageVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(packageVersion))
      throw new Error('package.json version must be a valid numeric SemVer for an Android release');
    const keystore = required('NAQLA_RELEASE_KEYSTORE_PATH');
    if (!existsSync(keystore)) throw new Error('Signing keystore file does not exist');
    for (const key of ['NAQLA_RELEASE_KEY_ALIAS','NAQLA_RELEASE_STORE_PASSWORD','NAQLA_RELEASE_KEY_PASSWORD'])
      required(key);
    if (required('NAQLA_RELEASE_TRACK') !== 'internal')
      throw new Error('Only the internal test track is supported; no public release can be created by this workflow');
    return { origin, appId: actualId, versionCode: Number(versionCode), versionName: packageVersion };
  } finally {
    process.env = currentEnv;
  }
}

if (process.argv[1]?.endsWith('/release-gate.mjs') || process.argv[1] === 'scripts/release-gate.mjs') {
  try {
    const safe = checkAndroidRelease();
    console.log(`NAQLA internal Android release preflight passed: ${safe.appId} v${safe.versionName} (${safe.versionCode}) -> ${safe.origin}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Invalid release configuration');
    process.exitCode = 1;
  }
}
