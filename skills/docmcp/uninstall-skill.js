import fs from 'fs';
import path from 'path';
import os from 'os';

const SKILL_NAME = 'docmcp';

const DIRS = [
  path.join(os.homedir(), '.claude', 'skills', SKILL_NAME),
  path.join(process.cwd(), '.claude', 'skills', SKILL_NAME),
  path.join(os.homedir(), '.cursor', 'skills', SKILL_NAME),
  path.join(process.cwd(), '.cursor', 'skills', SKILL_NAME),
];

for (const dir of DIRS) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`Removed ${SKILL_NAME} skill from ${dir}`);
  }
}
