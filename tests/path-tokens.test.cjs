const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { tokenizePath, resolveTokenPath } = require('../electron/services/path-tokens.cjs');

const sourceRoot = path.resolve('test-fixtures', 'Source');
const environment = {
  USERPROFILE: sourceRoot,
  APPDATA: path.join(sourceRoot, 'AppData', 'Roaming'),
  LOCALAPPDATA: path.join(sourceRoot, 'AppData', 'Local'),
  CODEX_HOME: path.resolve('test-fixtures', 'PortableCodex'),
};

test('tokenizes the most specific known root and resolves on another user', () => {
  const source = path.join(environment.CODEX_HOME, 'skills', 'demo', 'SKILL.md');
  const token = tokenizePath(source, environment);
  assert.equal(token, '%CODEX_HOME%/skills/demo/SKILL.md');

  const restoredCodexHome = path.resolve('test-fixtures', 'RestoredCodex');
  const destination = resolveTokenPath(token, {
    ...environment,
    CODEX_HOME: restoredCodexHome,
  });
  assert.equal(destination, path.join(restoredCodexHome, 'skills', 'demo', 'SKILL.md'));
});

test('rejects path traversal and unknown tokens', () => {
  assert.throws(() => resolveTokenPath('%CODEX_HOME%/../secret.txt', environment), /不安全/);
  assert.throws(() => resolveTokenPath('%SYSTEMROOT%/secret.txt', environment), /无效/);
});
