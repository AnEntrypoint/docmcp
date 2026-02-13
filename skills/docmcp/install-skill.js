import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const SKILL_NAME = 'docmcp';
const SOURCE_DIR = path.dirname(new URL(import.meta.url).pathname);

const TARGETS = [
  { name: 'claude-code', global: path.join(os.homedir(), '.claude', 'skills', SKILL_NAME), project: path.join(process.cwd(), '.claude', 'skills', SKILL_NAME) },
  { name: 'cursor', global: path.join(os.homedir(), '.cursor', 'skills', SKILL_NAME), project: path.join(process.cwd(), '.cursor', 'skills', SKILL_NAME) },
];

const FILES_TO_COPY = ['SKILL.md', 'reference.md', 'examples.md'];

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function install(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const file of FILES_TO_COPY) {
    const src = path.join(SOURCE_DIR, file);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(targetDir, file));
  }
  const scriptsSource = path.join(SOURCE_DIR, 'scripts');
  const scriptsDest = path.join(targetDir, 'scripts');
  if (fs.existsSync(scriptsSource)) {
    copyDir(scriptsSource, scriptsDest);
    const pkgJson = path.join(scriptsDest, 'package.json');
    if (fs.existsSync(pkgJson)) {
      try { execSync('npm install --production', { cwd: scriptsDest, stdio: 'pipe' }); }
      catch (_) { console.log(`  Note: Run 'npm install' in ${scriptsDest} to install dependencies`); }
    }
  }
}

const isGlobal = process.env.npm_config_global === 'true' || process.argv.includes('-g');

for (const target of TARGETS) {
  const agentDir = isGlobal
    ? path.dirname(target.global)
    : path.dirname(target.project);

  if (fs.existsSync(path.dirname(agentDir)) || isGlobal) {
    const dir = isGlobal ? target.global : target.project;
    try {
      install(dir);
      console.log(`Installed ${SKILL_NAME} skill to ${dir}`);
    } catch (e) {
      if (isGlobal || fs.existsSync(path.dirname(agentDir))) {
        console.log(`Skipped ${target.name}: ${e.message}`);
      }
    }
  }
}

const claudeGlobal = path.join(os.homedir(), '.claude', 'skills', SKILL_NAME);
if (!fs.existsSync(claudeGlobal)) {
  try {
    install(claudeGlobal);
    console.log(`Installed ${SKILL_NAME} skill to ${claudeGlobal} (global)`);
  } catch (_) {}
}
