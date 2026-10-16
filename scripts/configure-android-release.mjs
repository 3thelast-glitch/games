import { readFileSync, writeFileSync } from 'node:fs';
import { checkAndroidRelease } from './release-gate.mjs';

const settings = checkAndroidRelease();
const buildFile = 'android/app/build.gradle';
let source = readFileSync(buildFile, 'utf8');
const marker = '// NAQLA_INTERNAL_RELEASE_SIGNING_V1';
if (source.includes(marker)) throw new Error('Release signing configuration has already been installed');
if (!/android\s*\{/.test(source)) throw new Error('Generated Android Gradle project not found');

// The upload keystore is kept in the runner's ephemeral temporary directory.
// Passwords and alias are resolved by Gradle through environment variables.
// Do NOT interpolate or write credentials into any Gradle file or logs.
const signing = `
${marker}
android {
    defaultConfig {
        versionCode ${settings.versionCode}
        versionName "${settings.versionName}"
    }
    signingConfigs {
        naqlaUpload {
            storeFile file(System.getenv('NAQLA_RELEASE_KEYSTORE_PATH'))
            storePassword System.getenv('NAQLA_RELEASE_STORE_PASSWORD')
            keyAlias System.getenv('NAQLA_RELEASE_KEY_ALIAS')
            keyPassword System.getenv('NAQLA_RELEASE_KEY_PASSWORD')
        }
    }
    buildTypes {
        release {
            // Override any Capacitor template's debug signing default.
            signingConfig signingConfigs.naqlaUpload
        }
    }
}
`;
source += signing;
writeFileSync(buildFile, source);
console.log('Android generated project configured for ephemeral signed internal AAB build.');
