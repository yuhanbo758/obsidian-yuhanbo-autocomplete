import fs from "node:fs";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, "\t")}\n`, "utf8");
}

function parseVersion(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  if (!match) throw new Error(`Version must use x.y.z format: ${version}`);
  return match.slice(1).map(Number);
}

function bumpPatch(version) {
  const [major, minor, patch] = parseVersion(version);
  return `${major}.${minor}.${patch + 1}`;
}

const mode = process.argv[2];
if (!["--bump-patch", "--sync-manifest", "--from-package"].includes(mode)) {
  throw new Error("Use --bump-patch, --sync-manifest, or --from-package");
}

const manifest = readJson("manifest.json");
const packageJson = readJson("package.json");
const packageLock = fs.existsSync("package-lock.json") ? readJson("package-lock.json") : null;
const versions = readJson("versions.json");

const targetVersion =
  mode === "--bump-patch"
    ? bumpPatch(manifest.version)
    : mode === "--from-package"
      ? packageJson.version
      : manifest.version;

parseVersion(targetVersion);
manifest.version = targetVersion;
packageJson.version = targetVersion;
if (packageLock) packageLock.version = targetVersion;

if (packageLock) {
  if (!packageLock.packages?.[""]) throw new Error("Invalid package-lock root");
  packageLock.packages[""].version = targetVersion;
}
versions[targetVersion] = manifest.minAppVersion;

writeJson("manifest.json", manifest);
writeJson("package.json", packageJson);
if (packageLock) writeJson("package-lock.json", packageLock);
writeJson("versions.json", versions);

console.log(`Prepared Obsidian plugin version ${targetVersion}`);
