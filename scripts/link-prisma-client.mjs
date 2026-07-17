import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const nodeModulesDirs = [
  path.join(repoRoot, "node_modules"),
  path.join(repoRoot, "apps", "web", "node_modules"),
  path.join(repoRoot, "apps", "worker", "node_modules"),
];

async function pathExists(targetPath) {
  try {
    await fs.lstat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensurePrismaLink(nodeModulesDir) {
  const prismaClientPath = path.join(nodeModulesDir, "@prisma", "client");
  if (!(await pathExists(prismaClientPath))) {
    return;
  }

  const realClientPath = await fs.realpath(prismaClientPath);
  const realPrismaDir = path.resolve(realClientPath, "..", "..", ".prisma");
  const localPrismaDir = path.join(nodeModulesDir, ".prisma");

  if (!(await pathExists(realPrismaDir))) {
    throw new Error(`Generated Prisma directory not found for ${prismaClientPath}`);
  }

  if (await pathExists(localPrismaDir)) {
    const localRealPath = await fs.realpath(localPrismaDir);
    const targetRealPath = await fs.realpath(realPrismaDir);
    if (localRealPath === targetRealPath) {
      return;
    }

    const stat = await fs.lstat(localPrismaDir);
    if (!stat.isSymbolicLink()) {
      throw new Error(`Refusing to replace non-symlink path: ${localPrismaDir}`);
    }

    await fs.unlink(localPrismaDir);
  }

  const relativeTarget = path.relative(nodeModulesDir, realPrismaDir);
  await fs.symlink(relativeTarget, localPrismaDir, "dir");
}

await Promise.all(nodeModulesDirs.map(ensurePrismaLink));
