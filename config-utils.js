// Shared configuration utilities
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
  const path = require('path');
  const fs = require('fs');
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filepath, JSON.stringify(config, null, 2), 'utf8');
  console.log(`Config written to ${filepath}`);
}
