import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const distDir = resolve(projectRoot, 'dist');
const releaseDir = resolve(projectRoot, 'releases', 'bundles');
const bucketName = 'app-bundles';
const buildCommand = process.env.BUNDLE_BUILD_COMMAND ?? 'npm run build:operator-mobile';

const parseArgs = (argv) => {
  const options = {
    activate: false,
    platform: 'all',
    notes: null,
    minNativeVersion: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--activate') {
      options.activate = true;
      continue;
    }

    if (arg.startsWith('--platform=')) {
      options.platform = arg.split('=')[1] ?? 'all';
      continue;
    }

    if (arg === '--platform') {
      options.platform = argv[index + 1] ?? 'all';
      index += 1;
      continue;
    }

    if (arg.startsWith('--notes=')) {
      options.notes = arg.slice('--notes='.length) || null;
      continue;
    }

    if (arg === '--notes') {
      options.notes = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (arg.startsWith('--min-native-version=')) {
      options.minNativeVersion = arg.slice('--min-native-version='.length) || null;
      continue;
    }

    if (arg === '--min-native-version') {
      options.minNativeVersion = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
  }

  if (!['all', 'android', 'ios'].includes(options.platform)) {
    throw new Error(`Unsupported platform "${options.platform}". Use all, android or ios.`);
  }

  return options;
};

const loadEnvFile = (filename) => {
  const filePath = resolve(projectRoot, filename);
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    const value = rawValue
      .trim()
      .replace(/^['"]|['"]$/g, '');

    process.env[key] = value;
  }
};

const runBuild = async () => {
  const [command, ...args] = buildCommand.split(' ');
  await execFileAsync(command, args, {
    cwd: projectRoot,
    env: process.env,
    maxBuffer: 1024 * 1024 * 20,
  });
};

const assertDistExists = () => {
  if (!existsSync(distDir)) {
    throw new Error('dist/ was not generated. Build failed or output directory changed.');
  }
};

const createVersionPrefix = () => {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
};

const getNextVersion = async (supabase, prefix) => {
  const { data, error } = await supabase
    .from('app_bundle_versions')
    .select('version')
    .like('version', `${prefix}-%`);

  if (error) {
    throw new Error(`Could not determine next bundle version: ${error.message}`);
  }

  const currentMax = (data ?? []).reduce((max, row) => {
    const match = row.version.match(new RegExp(`^${prefix.replace(/\./g, '\\.')}-([0-9]+)$`));
    const numericPart = match ? Number(match[1]) : 0;
    return Math.max(max, numericPart);
  }, 0);

  return `${prefix}-${currentMax + 1}`;
};

const zipDist = async (version) => {
  const tempDir = mkdtempSync(join(tmpdir(), 'tms-bundle-'));
  const zipPath = join(tempDir, `bundle-${version}.zip`);

  await execFileAsync('zip', ['-qr', zipPath, '.'], {
    cwd: distDir,
    maxBuffer: 1024 * 1024 * 20,
  });

  return { tempDir, zipPath };
};

const sha256ForFile = async (filePath) => {
  const buffer = await readFile(filePath);
  return createHash('sha256').update(buffer).digest('hex');
};

const getPublicUrl = (supabase, storagePath) =>
  supabase.storage.from(bucketName).getPublicUrl(storagePath).data.publicUrl;

const uploadBundle = async (supabase, version, zipPath, platform) => {
  const bundleBuffer = await readFile(zipPath);
  const storagePath = `${platform}/${version}/bundle-${version}.zip`;

  const { error } = await supabase.storage.from(bucketName).upload(storagePath, bundleBuffer, {
    contentType: 'application/zip',
    cacheControl: '3600',
    upsert: true,
  });

  if (error) {
    throw new Error(`Could not upload bundle zip: ${error.message}`);
  }

  return {
    storagePath,
    publicUrl: getPublicUrl(supabase, storagePath),
  };
};

const insertBundleRow = async (supabase, payload) => {
  const { data, error } = await supabase
    .from('app_bundle_versions')
    .insert(payload)
    .select('id, version, platform, is_active')
    .single();

  if (error) {
    throw new Error(`Could not insert bundle version row: ${error.message}`);
  }

  return data;
};

const activateBundle = async (supabase, version) => {
  const { error } = await supabase.rpc('activate_app_bundle_version', {
    p_version: version,
  });

  if (error) {
    throw new Error(`Could not activate bundle version ${version}: ${error.message}`);
  }
};

const writeReleaseMetadata = async (metadata) => {
  await mkdir(releaseDir, { recursive: true });
  const metadataPath = resolve(releaseDir, `${metadata.version}.json`);
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  return metadataPath;
};

const main = async () => {
  loadEnvFile('.env');
  loadEnvFile('.env.local');

  const options = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing required env vars: VITE_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  console.log(`[bundle] Running build with "${buildCommand}"...`);
  await runBuild();
  assertDistExists();

  const versionPrefix = createVersionPrefix();
  const version = await getNextVersion(supabase, versionPrefix);
  const minNativeVersion = options.minNativeVersion ?? process.env.BUNDLE_MIN_NATIVE_VERSION ?? process.env.npm_package_version;

  if (!minNativeVersion) {
    throw new Error('Could not determine min_native_version. Pass --min-native-version or set BUNDLE_MIN_NATIVE_VERSION.');
  }

  const { tempDir, zipPath } = await zipDist(version);

  try {
    const checksum = await sha256ForFile(zipPath);
    const upload = await uploadBundle(supabase, version, zipPath, options.platform);

    const inserted = await insertBundleRow(supabase, {
      version,
      bundle_url: upload.publicUrl,
      checksum,
      min_native_version: minNativeVersion,
      platform: options.platform,
      is_active: false,
      notes: options.notes,
    });

    if (options.activate) {
      await activateBundle(supabase, version);
    }

    const metadataPath = await writeReleaseMetadata({
      id: inserted.id,
      version,
      platform: options.platform,
      min_native_version: minNativeVersion,
      checksum,
      bundle_url: upload.publicUrl,
      storage_path: upload.storagePath,
      activated: options.activate,
      notes: options.notes,
      published_at: new Date().toISOString(),
    });

    console.log(`[bundle] Published ${version}`);
    console.log(`[bundle] Platform: ${options.platform}`);
    console.log(`[bundle] Activated: ${options.activate ? 'yes' : 'no'}`);
    console.log(`[bundle] URL: ${upload.publicUrl}`);
    console.log(`[bundle] Metadata: ${metadataPath}`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error('[bundle] Failed:', error.message);
  process.exitCode = 1;
});
