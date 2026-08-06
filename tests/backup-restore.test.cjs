const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createBackup } = require('../electron/services/backup-engine.cjs');
const { inspectBackup } = require('../electron/services/backup-inspector.cjs');
const { restoreBackup } = require('../electron/services/restore-engine.cjs');

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

test('creates compressed encrypted single-file backup and restores it to another user', async (t) => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'codex-backup-test-'));
  t.after(() => fsp.rm(root, { recursive: true, force: true }));
  const source = environmentFor(path.join(root, 'source'));
  const target = environmentFor(path.join(root, 'target'));
  await write(path.join(source.CODEX_HOME, 'config.toml'), 'model = "gpt-test"\n');
  await write(path.join(source.CODEX_HOME, 'sessions', '2026', 'session.jsonl'), '{"hello":"world"}\n'.repeat(32));
  await write(path.join(source.CODEX_HOME, 'skills', 'sample', 'SKILL.md'), '# Sample\n');

  const destination = path.join(root, 'encrypted.cxbak');
  const result = await createBackup({
    destination,
    componentIds: ['settings', 'sessions', 'customization'],
    password: 'correct horse battery staple',
    compressionLevel: 9,
    pathEnvironment: source,
    appVersion: 'test',
  });
  assert.equal(result.manifest.totals.files, 3);
  assert.equal(result.outputSha256.length, 64);

  const prefix = await fsp.readFile(destination).then((buffer) => buffer.subarray(0, 9).toString('ascii'));
  assert.equal(prefix, 'CXBAKENC1');
  const locked = await inspectBackup(destination);
  assert.equal(locked.requiresPassword, true);
  await assert.rejects(() => inspectBackup(destination, 'wrong password'), /密码错误|已损坏/);

  const inspection = await inspectBackup(destination, 'correct horse battery staple');
  assert.equal(inspection.requiresPassword, false);
  assert.equal(inspection.totals.files, 3);

  const restored = await restoreBackup({
    filePath: destination,
    password: 'correct horse battery staple',
    componentIds: ['settings', 'sessions', 'customization'],
    mode: 'overwrite',
    createRollback: false,
    pathEnvironment: target,
  });
  assert.equal(restored.restoredFiles, 3);
  assert.equal(await fsp.readFile(path.join(target.CODEX_HOME, 'config.toml'), 'utf8'), 'model = "gpt-test"\n');
  assert.equal(await fsp.readFile(path.join(target.CODEX_HOME, 'skills', 'sample', 'SKILL.md'), 'utf8'), '# Sample\n');
});

test('creates a ZIP-compatible unencrypted .cxbak file', async (t) => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'codex-backup-zip-test-'));
  t.after(() => fsp.rm(root, { recursive: true, force: true }));
  const source = environmentFor(path.join(root, 'source'));
  await write(path.join(source.CODEX_HOME, 'config.toml'), 'approval_policy = "never"\n'.repeat(24));
  const destination = path.join(root, 'plain.cxbak');
  await createBackup({
    destination,
    componentIds: ['settings'],
    compressionLevel: 9,
    pathEnvironment: source,
  });
  const prefix = await fsp.readFile(destination).then((buffer) => buffer.subarray(0, 2).toString('ascii'));
  assert.equal(prefix, 'PK');
  const inspection = await inspectBackup(destination);
  assert.equal(inspection.encrypted, false);
  assert.equal(inspection.totals.files, 1);
});
