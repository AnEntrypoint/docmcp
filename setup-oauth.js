import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function setupOAuth() {
  console.log('Google OAuth Setup for DocMCP');
  console.log('==============================\n');

  const envLocalPath = path.join(__dirname, '.env.local');
  const existingEnv = fs.existsSync(envLocalPath) ? 
    fs.readFileSync(envLocalPath, 'utf-8') : '';

  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  console.log('To set up OAuth, you need to:');
  console.log('1. Go to https://console.cloud.google.com/');
  console.log('2. Create a new project or select existing');
  console.log('3. Enable the Google Docs, Sheets, and Drive APIs');
  console.log('4. Create OAuth 2.0 credentials (Desktop application)');
  console.log('5. Copy the Client ID and Client Secret\n');

  const clientId = await question('Enter Google OAuth Client ID: ');
  const clientSecret = await question('Enter Google OAuth Client Secret: ');
  const jwtSecret = await question('Enter JWT Secret (or press Enter for auto-generated): ') || 
    require('crypto').randomBytes(32).toString('hex');

  const envContent = `# Google OAuth Credentials
GOOGLE_OAUTH_CLIENT_ID=${clientId}
GOOGLE_OAUTH_CLIENT_SECRET=${clientSecret}

# JWT Secret for token signing
JWT_SECRET=${jwtSecret}

# Optional: Custom redirect URL (defaults to http://localhost:9998/oauth/callback)
# GOOGLE_OAUTH_REDIRECT_URL=http://localhost:9998/oauth/callback

# Optional: Port for HTTP server
# PORT=9998

# Optional: Log level
# LOG_LEVEL=info
`;

  fs.writeFileSync(envLocalPath, envContent, 'utf-8');
  console.log('\n✓ OAuth credentials saved to .env.local');
  console.log('✓ This file is gitignored and will not be committed\n');

  console.log('Next steps:');
  console.log('1. Run: npm start:http');
  console.log('2. Call POST /auth/init to start authentication');
  console.log('3. Visit the auth URL in your browser');
  console.log('4. Send the code to POST /auth/callback\n');

  rl.close();
  process.exit(0);
}

setupOAuth().catch(err => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
