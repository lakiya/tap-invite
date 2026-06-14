// Reads .env (local dev) or process.env (CI/Vercel) and writes Angular environment files.
// Runs automatically via prestart and prebuild hooks in package.json.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');

// Merge .env file into vars (process.env takes precedence so CI overrides work)
const vars = { ...process.env };
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!(key in vars)) vars[key] = val;
    });
}

const get = k => {
  const v = vars[k];
  if (!v) { console.warn(`[set-env] WARNING: ${k} is not set`); return ''; }
  return v;
};

const template = (production) =>
  `export const environment = {
  production: ${production},
  supabaseUrl: '${get('SUPABASE_URL')}',
  supabaseKey: '${get('SUPABASE_KEY')}',
};\n`;

fs.writeFileSync(path.join(root, 'src/environments/environment.ts'), template(false));
fs.writeFileSync(path.join(root, 'src/environments/environment.prod.ts'), template(true));
console.log('[set-env] environment files generated');
