import { createHash } from "node:crypto";
import {
  access,
  readdir,
  readFile,
  realpath,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const workspaceDirectory = path.resolve(appDirectory, "../..");
const outputPath = path.join(
  appDirectory,
  "src/generated/open-source-licenses.json",
);
const checkOnly = process.argv.includes("--check");
const packageJson = JSON.parse(
  await readFile(path.join(appDirectory, "package.json"), "utf8"),
);

const pendingDirectories = Object.keys(packageJson.dependencies ?? {}).map(
  (name) => path.join(workspaceDirectory, "node_modules", name),
);
const visitedDirectories = new Set();
const packagesByVersion = new Map();
const texts = {};

function repositoryUrl(repository) {
  const value =
    typeof repository === "string" ? repository : (repository?.url ?? "");
  const normalized = value
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/^ssh:\/\/git@github\.com\//, "https://github.com/")
    .replace(/^github:/, "")
    .replace(/\.git$/, "");
  return /^[\w.-]+\/[\w.-]+$/.test(normalized)
    ? `https://github.com/${normalized}`
    : normalized;
}

function licenseName(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => item?.type)
      .filter(Boolean)
      .join(" OR ");
  }
  return value?.type ?? "Unknown";
}

async function resolveDependency(packageDirectory, dependencyName) {
  let directory = packageDirectory;
  while (directory.startsWith(workspaceDirectory)) {
    const candidate = path.join(directory, "node_modules", dependencyName);
    try {
      await access(path.join(candidate, "package.json"));
      return candidate;
    } catch {
      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
  }
  return null;
}

while (pendingDirectories.length > 0) {
  const requestedDirectory = pendingDirectories.shift();
  let packageDirectory;
  try {
    packageDirectory = await realpath(requestedDirectory);
  } catch {
    continue;
  }
  if (visitedDirectories.has(packageDirectory)) continue;

  const metadata = JSON.parse(
    await readFile(path.join(packageDirectory, "package.json"), "utf8"),
  );
  visitedDirectories.add(packageDirectory);

  const fileNames = await readdir(packageDirectory);
  const noticeFiles = fileNames
    .filter((name) => /^(licen[cs]e|copying|copyright|notice)/i.test(name))
    .sort((left, right) => left.localeCompare(right));
  const noticeParts = [];
  for (const fileName of noticeFiles) {
    const content = (
      await readFile(path.join(packageDirectory, fileName), "utf8")
    ).trim();
    if (!content) continue;
    if (noticeFiles.length > 1) noticeParts.push(`--- ${fileName} ---`);
    noticeParts.push(content);
  }
  const notice = noticeParts.join("\n\n");
  const textId = notice
    ? createHash("sha256").update(notice).digest("hex").slice(0, 16)
    : "";
  if (textId && !texts[textId]) texts[textId] = notice;

  const packageNotice = {
    name: metadata.name ?? path.basename(packageDirectory),
    version: String(metadata.version ?? ""),
    license: licenseName(metadata.license ?? metadata.licenses),
    repository: repositoryUrl(metadata.repository),
    homepage: typeof metadata.homepage === "string" ? metadata.homepage : "",
    textId,
  };
  const packageKey = `${packageNotice.name}@${packageNotice.version}`;
  const existingPackage = packagesByVersion.get(packageKey);
  if (!existingPackage || (!existingPackage.textId && packageNotice.textId)) {
    packagesByVersion.set(packageKey, packageNotice);
  }

  const requiredPeers = Object.fromEntries(
    Object.entries(metadata.peerDependencies ?? {}).filter(
      ([name]) => metadata.peerDependenciesMeta?.[name]?.optional !== true,
    ),
  );
  const dependencyNames = Object.keys({
    ...metadata.dependencies,
    ...metadata.optionalDependencies,
    ...requiredPeers,
  });
  for (const dependencyName of dependencyNames) {
    const dependencyDirectory = await resolveDependency(
      packageDirectory,
      dependencyName,
    );
    if (dependencyDirectory) pendingDirectories.push(dependencyDirectory);
  }
}

const packages = [...packagesByVersion.values()].sort(
  (left, right) =>
    left.name.localeCompare(right.name) ||
    left.version.localeCompare(right.version),
);

let existingManifest = null;
try {
  existingManifest = JSON.parse(await readFile(outputPath, "utf8"));
} catch {
  // The first generation creates the manifest.
}

const manifest = {
  generatedAt:
    checkOnly && existingManifest?.generatedAt
      ? existingManifest.generatedAt
      : new Date().toISOString(),
  packages,
  texts,
};
const output = `${JSON.stringify(manifest, null, 2)}\n`;

if (checkOnly) {
  const existing = await readFile(outputPath, "utf8").catch(() => "");
  if (existing !== output) {
    console.error(
      "Open-source license manifest is stale. Run `bun run licenses:generate`.",
    );
    process.exitCode = 1;
  }
} else {
  await writeFile(outputPath, output);
  console.log(
    `Generated ${packages.length} package notices with ${Object.keys(texts).length} unique license texts.`,
  );
}
