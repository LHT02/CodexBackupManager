const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { DatabaseSync } = require('node:sqlite');
const { createBackup } = require('../electron/services/backup-engine.cjs');
const { restoreBackup } = require('../electron/services/restore-engine.cjs');
const {
  buildPathMappings,
  inferLegacySourceEnvironment,
  replacePathReferences,
} = require('../electron/services/path-migration.cjs');

function environmentFor(root) {
  return {
    USERPROFILE: root,
    APPDATA: path.join(root, 'AppData', 'Roaming'),
    LOCALAPPDATA: path.join(root, 'AppData', 'Local'),
    CODEX_HOME: path.join(root, '.codex'),
  };
}

async function write(filePath, content) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, content, 'utf8');
}

function createStateDatabase(filePath, source) {
  const db = new DatabaseSync(filePath);
  db.exec(`
    CREATE TABLE threads (
      id TEXT PRIMARY KEY,
      rollout_path TEXT,
      cwd TEXT,
      sandbox_policy TEXT,
      agent_path TEXT,
      title TEXT
    );
    CREATE TABLE project_roots (project_id TEXT, position INTEGER, path TEXT);
  `);
  db.prepare('INSERT INTO threads VALUES (?, ?, ?, ?, ?, ?)').run(
    'thread-1',
    path.join(source.CODEX_HOME, 'archived_sessions', 'rollout.jsonl'),
    path.join(source.USERPROFILE, 'Documents', 'Codex', 'project'),
    JSON.stringify({ writableRoots: [path.join(source.USERPROFILE, 'Documents', 'Codex')] }),
    path.join(source.CODEX_HOME, 'skills', 'agent', 'AGENT.md'),
    `历史文本保留原样 ${source.USERPROFILE}`,
  );
  db.prepare('INSERT INTO project_roots VALUES (?, ?, ?)').run(
    'project-1',
    0,
    path.join(source.USERPROFILE, 'Documents', 'Project'),
  );
  db.close();
}

function createCodexDevDatabase(filePath, source) {
  const db = new DatabaseSync(filePath);
  db.exec(`
    CREATE TABLE local_thread_catalog (
      host_id TEXT,
      thread_id TEXT,
      cwd TEXT,
      source_detail TEXT
    );
    CREATE TABLE automations (
      id TEXT,
      cwds TEXT,
      local_environment_config_path TEXT
    );
  `);
  db.prepare('INSERT INTO local_thread_catalog VALUES (?, ?, ?, ?)').run(
    'local',
    'thread-1',
    path.join(source.USERPROFILE, 'Documents', 'Codex', 'project'),
    JSON.stringify({ writableRoot: path.join(source.USERPROFILE, 'Documents', 'Codex') }),
  );
  db.prepare('INSERT INTO automations VALUES (?, ?, ?)').run(
    'automation-1',
    JSON.stringify([path.join(source.USERPROFILE, 'Documents', 'Codex')]),
    path.join(source.CODEX_HOME, 'config.toml'),
  );
  db.close();
}

test('rewrites Windows paths case-insensitively, including JSON-escaped paths', () => {
  const mappings = buildPathMappings(
    {
      USERPROFILE: 'C:\\Users\\OldUser',
      CODEX_HOME: 'C:\\Users\\OldUser\\.codex',
    },
    {
      USERPROFILE: 'D:\\Users\\NewUser',
      CODEX_HOME: 'D:\\Users\\NewUser\\.codex',
    },
  );
  const input = String.raw`{"cwd":"c:\\users\\olduser\\Documents","rollout":"C:\\Users\\OldUser\\.codex\\sessions\\one.jsonl"}`;
  const migrated = replacePathReferences(input, mappings);
  assert.equal(migrated.replacements, 2);
  assert.match(migrated.value, /D:\\\\Users\\\\NewUser\\\\Documents/);
  assert.match(migrated.value, /D:\\\\Users\\\\NewUser\\\\\.codex\\\\sessions/);
});

test('backs up archived rollouts and migrates structural paths inside text and SQLite state', async (t) => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'codex-cross-user-test-'));
  t.after(() => fsp.rm(root, { recursive: true, force: true }));
  const source = environmentFor(path.join(root, 'OldUser'));
  const target = environmentFor(path.join(root, 'NewUser'));
  await fsp.mkdir(source.CODEX_HOME, { recursive: true });

  await write(
    path.join(source.CODEX_HOME, 'config.toml'),
    `CODEX_HOME = '${source.CODEX_HOME}'\n[projects.'${path.join(source.USERPROFILE, 'Documents', 'Project')}']\n`,
  );
  await write(
    path.join(source.CODEX_HOME, '.codex-global-state.json'),
    JSON.stringify({
      'electron-saved-workspace-roots': [path.join(source.USERPROFILE, 'Documents', 'Project')],
      permission: { writableRoots: [path.join(source.USERPROFILE, 'Documents', 'Codex')] },
    }),
  );
  await write(
    path.join(source.CODEX_HOME, 'archived_sessions', '2026', 'rollout.jsonl'),
    '{"type":"turn","message":"archived"}\n',
  );
  createStateDatabase(path.join(source.CODEX_HOME, 'state_5.sqlite'), source);
  await fsp.mkdir(path.join(source.CODEX_HOME, 'sqlite'), { recursive: true });
  createCodexDevDatabase(path.join(source.CODEX_HOME, 'sqlite', 'codex-dev.db'), source);

  const backupPath = path.join(root, 'migration.cxbak');
  const backup = await createBackup({
    destination: backupPath,
    componentIds: ['settings', 'sessions'],
    pathEnvironment: source,
    appVersion: 'test',
  });
  assert.deepEqual(backup.manifest.source.pathEnvironment, source);
  assert.ok(backup.manifest.entries.some((entry) =>
    entry.targetPath.endsWith('/archived_sessions/2026/rollout.jsonl')));

  const restored = await restoreBackup({
    filePath: backupPath,
    componentIds: ['settings', 'sessions'],
    mode: 'overwrite',
    createRollback: false,
    pathEnvironment: target,
  });
  assert.ok(restored.pathMigration.replacements >= 10);
  assert.ok(restored.pathMigration.databases >= 2);
  assert.equal(
    await fsp.readFile(path.join(target.CODEX_HOME, 'archived_sessions', '2026', 'rollout.jsonl'), 'utf8'),
    '{"type":"turn","message":"archived"}\n',
  );

  const config = await fsp.readFile(path.join(target.CODEX_HOME, 'config.toml'), 'utf8');
  assert.doesNotMatch(config, new RegExp(source.USERPROFILE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  assert.match(config, new RegExp(target.USERPROFILE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const globalState = JSON.parse(await fsp.readFile(
    path.join(target.CODEX_HOME, '.codex-global-state.json'),
    'utf8',
  ));
  assert.equal(globalState['electron-saved-workspace-roots'][0], path.join(target.USERPROFILE, 'Documents', 'Project'));

  const state = new DatabaseSync(path.join(target.CODEX_HOME, 'state_5.sqlite'), { readOnly: true });
  const thread = state.prepare('SELECT * FROM threads WHERE id = ?').get('thread-1');
  const projectRoot = state.prepare('SELECT path FROM project_roots WHERE project_id = ?').get('project-1').path;
  state.close();
  assert.equal(thread.rollout_path, path.join(target.CODEX_HOME, 'archived_sessions', 'rollout.jsonl'));
  assert.equal(thread.cwd, path.join(target.USERPROFILE, 'Documents', 'Codex', 'project'));
  assert.deepEqual(JSON.parse(thread.sandbox_policy).writableRoots, [path.join(target.USERPROFILE, 'Documents', 'Codex')]);
  assert.equal(projectRoot, path.join(target.USERPROFILE, 'Documents', 'Project'));
  assert.match(thread.title, new RegExp(source.USERPROFILE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  const codexDev = new DatabaseSync(path.join(target.CODEX_HOME, 'sqlite', 'codex-dev.db'), { readOnly: true });
  const catalog = codexDev.prepare('SELECT cwd, source_detail FROM local_thread_catalog').get();
  const automation = codexDev.prepare('SELECT cwds, local_environment_config_path FROM automations').get();
  codexDev.close();
  assert.equal(catalog.cwd, path.join(target.USERPROFILE, 'Documents', 'Codex', 'project'));
  assert.equal(JSON.parse(catalog.source_detail).writableRoot, path.join(target.USERPROFILE, 'Documents', 'Codex'));
  assert.deepEqual(JSON.parse(automation.cwds), [path.join(target.USERPROFILE, 'Documents', 'Codex')]);
  assert.equal(automation.local_environment_config_path, path.join(target.CODEX_HOME, 'config.toml'));
});

test('infers the old Windows user profile for legacy backups without source metadata', async (t) => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'codex-legacy-source-test-'));
  t.after(() => fsp.rm(root, { recursive: true, force: true }));
  const filePath = path.join(root, 'config.toml');
  await write(filePath, String.raw`CODEX_HOME = 'C:\Users\LegacyUser\.codex'`);
  const inferred = await inferLegacySourceEnvironment(
    [filePath],
    { USERPROFILE: 'C:\\Users\\CurrentUser' },
  );
  assert.equal(inferred.USERPROFILE, 'C:\\Users\\LegacyUser');
  assert.equal(inferred.CODEX_HOME, 'C:\\Users\\LegacyUser\\.codex');
});
