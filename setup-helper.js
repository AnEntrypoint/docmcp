// Shared setup utilities
import { writeFileSync } from 'fs';
import { dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';

export function createServerConfig(url, headers = {}) {
  if (!url) {
    throw new Error('Server URL is required');
  }
  return {
    url,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    timeout: 30000,
  };
}

export function mergeEnv(baseEnv = {}) {
  return {
    ...process.env,
    ...baseEnv,
  };
}

export function buildAuthHeaders(token) {
  if (!token) {
    throw new Error('Auth token is required');
  }
  return {
    'Authorization': `Bearer ${token}`,
  };
}

export function writeConfigFile(filepath, config) {
  if (!filepath) {
    throw new Error('Filepath is required');
  }
  const dir = dirname(filepath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filepath, JSON.stringify(config, null, 2), 'utf8');
  console.log(`Config written to ${filepath}`);
}
