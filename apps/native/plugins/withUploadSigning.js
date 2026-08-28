const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { withGradleProperties } = require("expo/config-plugins");

/**
 * Scopes the Android upload-signing credentials to this project.
 *
 * AGP signs a release build with whatever `android.injected.signing.*` project
 * properties it finds, overriding the `signingConfig` in build.gradle -- which
 * is why ConPaws has always produced correctly signed bundles even though the
 * generated `android/app/build.gradle` still says `signingConfigs.debug`, and
 * why `expo prebuild` rewriting that file has never mattered.
 *
 * Those properties used to live in `~/.gradle/gradle.properties`, which Gradle
 * applies to *every* project on the machine. Any other Android app released
 * from this Mac -- `eas build --local` on official-app, for instance -- would
 * have been signed with the ConPaws upload key without a word about it. Signing
 * the wrong artifact with the wrong key is not something a build reports; it is
 * something a store rejects days later, or worse, accepts.
 *
 * So the credentials moved to a file outside the repo, and this plugin writes
 * them into the generated `android/gradle.properties`, where they apply to
 * ConPaws alone. `android/` is gitignored in its entirety, so the values never
 * reach version control.
 *
 * The source file is `~/.keystores/conpaws-signing.properties`:
 *
 *     android.injected.signing.store.file=/Users/you/.keystores/conpaws-upload.jks
 *     android.injected.signing.store.password=...
 *     android.injected.signing.key.alias=...
 *     android.injected.signing.key.password=...
 *
 * When that file is absent -- CI, a fresh clone, anyone who is not the release
 * machine -- the plugin does nothing and Gradle falls back to the debug key.
 * That is deliberate: prebuild is run constantly during development and must
 * not fail because release credentials are missing. It does mean a release
 * build on a machine without the file produces a debug-signed bundle that looks
 * completely normal, so verify the signer before every upload:
 *
 *     keytool -printcert -jarfile build/ConPaws-<version>-<build>.aab
 *
 * RELEASING.md carries the expected fingerprint.
 */

const SIGNING_PROPERTIES_PATH = path.join(
  os.homedir(),
  ".keystores/conpaws-signing.properties",
);

const INJECTED_KEYS = [
  "android.injected.signing.store.file",
  "android.injected.signing.store.password",
  "android.injected.signing.key.alias",
  "android.injected.signing.key.password",
];

/**
 * Minimal `.properties` reader: `key=value`, `#` or `!` comments, blank lines.
 * Values are taken verbatim after the first `=`, because a keystore password is
 * allowed to contain anything, including further `=` characters.
 */
function parseProperties(contents) {
  const parsed = {};
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("!")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    parsed[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1);
  }
  return parsed;
}

function readSigningProperties() {
  let contents;
  try {
    contents = fs.readFileSync(SIGNING_PROPERTIES_PATH, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }

  const parsed = parseProperties(contents);
  const missing = INJECTED_KEYS.filter((key) => !parsed[key]);
  if (missing.length > 0) {
    // Loud, because a half-filled file is a typo, not a machine without
    // credentials, and it would otherwise sign with the debug key in silence.
    throw new Error(
      `${SIGNING_PROPERTIES_PATH} is missing: ${missing.join(", ")}`,
    );
  }

  return INJECTED_KEYS.map((key) => ({
    type: "property",
    key,
    value: parsed[key],
  }));
}

module.exports = function withUploadSigning(config) {
  return withGradleProperties(config, (config) => {
    const signing = readSigningProperties();
    if (!signing) return config;

    // Replace rather than append: prebuild can run against an android/ that
    // already carries a previous pass's values.
    const existing = config.modResults.filter(
      (item) => !(item.type === "property" && INJECTED_KEYS.includes(item.key)),
    );

    config.modResults = [...existing, ...signing];
    return config;
  });
};
