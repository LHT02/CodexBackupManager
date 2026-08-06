const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { tokenizePath, resolveTokenPath } = require('../electron/services/path-tokens.cjs');

const environment = {
  USERPROFILE: path.resolve('D:\\Users\\Source'),
  APPDATA: path.resolve('D:\\Users\\Source\\AppData\\Roaming'),
  LOCALAPPDATA: path.resolve('D:\\Users\\Source\\AppData\\Local'),
  CODEX_HOME: path.resolve('D:\\PortableCodex'),
};

test('tokenizes the most specific known root and resolves on another user', () => {
  const source = path.join(environment.CODEX_HOME, 'skills', 'demo', 'SKILL.md');
  const token = tokenizePath(source, environment);
  assert.equal(token, '%CODEX_HOME%/skills/demo/SKILL.md');

  const destination = resolveTokenPath(token, {
    ...environment,
    CODEX_HOME: path.resolve('E:\\RestoredCodex'),
  });
  assert.equal(destination, path.resolve('E:\\RestoredCodex\\skills\\demo\\SKILL.md'));
});

test('rejects path traversal and unknown tokens', () => {
  assert.throws(() => resolveTokenPath('%CODEX_HOME%/../secret.txt', environment), /不安全/);
  assert.throws(() => resolveTokenPath('%SYSTEMROOT%/secret.txt', environment), /无效/);
});
