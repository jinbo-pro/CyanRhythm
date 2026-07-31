import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const rootUrl = new URL("../", import.meta.url);
const rootDir = fileURLToPath(rootUrl);
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function projectPath(path) {
  return fileURLToPath(new URL(path, rootUrl));
}

function normalizeVersion(inputVersion) {
  return inputVersion.trim().replace(/^app-v/i, "").replace(/^v/i, "");
}

function readJson(path) {
  return JSON.parse(readFileSync(projectPath(path), "utf8"));
}

function writeJson(path, value) {
  writeFileSync(projectPath(path), `${JSON.stringify(value, null, 2)}\n`);
}

function replaceOrFail(path, pattern, replacement) {
  const fullPath = projectPath(path);
  const source = readFileSync(fullPath, "utf8");
  const updated = source.replace(pattern, replacement);

  if (updated === source) {
    throw new Error(`Could not update ${path}`);
  }

  writeFileSync(fullPath, updated);
}

function updateCargoLock(version) {
  const path = "src-tauri/Cargo.lock";
  const fullPath = projectPath(path);

  if (!existsSync(fullPath)) {
    return;
  }

  const source = readFileSync(fullPath, "utf8");
  const updated = source.replace(
    /(\[\[package\]\]\r?\nname = "CyanRhythm"\r?\nversion = ")([^"]+)(")/,
    `$1${version}$3`,
  );

  if (updated !== source) {
    writeFileSync(fullPath, updated);
  }
}

function updateVersions(version) {
  const packageJson = readJson("package.json");
  packageJson.version = version;
  writeJson("package.json", packageJson);

  const tauriConfig = readJson("src-tauri/tauri.conf.json");
  tauriConfig.version = version;
  writeJson("src-tauri/tauri.conf.json", tauriConfig);

  replaceOrFail(
    "src-tauri/Cargo.toml",
    /(\[package\][\s\S]*?\nversion\s*=\s*")([^"]+)(")/,
    `$1${version}$3`,
  );
  updateCargoLock(version);
}

function run(command, args) {
  console.log(`> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

async function main() {
  const rl = createInterface({ input, output });
  let version;

  const currentVersion = readJson("package.json").version;

  try {
    version = normalizeVersion(
      await rl.question(`Current version is ${currentVersion}, new version: `),
    );
  } finally {
    rl.close();
  }

  if (!semverPattern.test(version)) {
    throw new Error("Version must be a valid semver value, for example 1.0.0");
  }

  const tag = `app-v${version}`;

  updateVersions(version);

  run("git", ["add", "."]);
  run("git", ["commit", "-m", `chore: release ${version}`]);
  run("git", ["push", "github", "HEAD:master"]);
  run("git", ["tag", tag]);
  run("git", ["push", "github", tag]);

  console.log(`Released ${tag}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});