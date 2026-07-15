import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const moves = [
  ["src/app/api", "src/app/_api_backup"],
  ["src/middleware.ts", "src/_middleware_backup.ts"],
];

function moveAside(from, to) {
  const fromPath = path.join(root, from);
  const toPath = path.join(root, to);

  if (!fs.existsSync(fromPath)) {
    return;
  }

  if (fs.existsSync(toPath)) {
    fs.rmSync(toPath, { recursive: true, force: true });
  }

  try {
    fs.renameSync(fromPath, toPath);
    return;
  } catch {
    fs.cpSync(fromPath, toPath, { recursive: true });
    fs.rmSync(fromPath, { recursive: true, force: true });
  }
}

function restore(from, to) {
  const fromPath = path.join(root, from);
  const toPath = path.join(root, to);

  if (!fs.existsSync(toPath)) {
    return;
  }

  if (fs.existsSync(fromPath)) {
    fs.rmSync(fromPath, { recursive: true, force: true });
  }

  try {
    fs.renameSync(toPath, fromPath);
  } catch {
    fs.cpSync(toPath, fromPath, { recursive: true });
    fs.rmSync(toPath, { recursive: true, force: true });
  }
}

for (const [from, to] of moves) {
  moveAside(from, to);
}

  execSync("node scripts/generate-sw.mjs", {
    stdio: "inherit",
    env: {
      ...process.env,
      GITHUB_PAGES: "true",
      NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH ?? "/stapke",
      NEXT_PUBLIC_API_ORIGIN:
        process.env.NEXT_PUBLIC_API_ORIGIN ?? "https://stapke.onrender.com",
    },
  });
  execSync("next build", {
    stdio: "inherit",
    env: { ...process.env, GITHUB_PAGES: "true" },
  });
  execSync("node scripts/prepare-pages.mjs", {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH ?? "/stapke",
    },
  });
} finally {
  for (const [from, to] of moves) {
    restore(from, to);
  }
}
