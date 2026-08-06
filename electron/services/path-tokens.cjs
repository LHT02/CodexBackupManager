const path = require('node:path');

const TOKEN_NAMES = ['CODEX_HOME', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE'];

function normalizeForCompare(value) {
  const resolved = path.resolve(value).replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function getPathEnvironment(overrides = {}) {
  const env = { ...process.env, ...overrides };
  const userProfile = env.USERPROFILE || env.HOME;
  return {
    USERPROFILE: userProfile,
    APPDATA: env.APPDATA || (userProfile && path.join(userProfile, 'AppData', 'Roaming')),
    LOCALAPPDATA:
      env.LOCALAPPDATA || (userProfile && path.join(userProfile, 'AppData', 'Local')),
    CODEX_HOME: env.CODEX_HOME || (userProfile && path.join(userProfile, '.codex')),
  };
}

function tokenizePath(absolutePath, pathEnvironment = getPathEnvironment()) {
  const absolute = path.resolve(absolutePath);
  const normalized = normalizeForCompare(absolute);
  const candidates = TOKEN_NAMES.map((name) => ({
    name,
    value: pathEnvironment[name],
  }))
    .filter((item) => item.value)
    .sort((a, b) => b.value.length - a.value.length);

  for (const candidate of candidates) {
    const root = path.resolve(candidate.value);
    const normalizedRoot = normalizeForCompare(root);
    if (normalized === normalizedRoot) {
      return `%${candidate.name}%`;
    }
    if (normalized.startsWith(`${normalizedRoot}${path.sep}`)) {
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      return `%${candidate.name}%/${relative}`;
    }
  }

  throw new Error(`路径不在允许备份的用户目录中：${absolute}`);
}

function resolveTokenPath(tokenPath, pathEnvironment = getPathEnvironment()) {
  const match = /^%([A-Z_]+)%(?:\/(.*))?$/.exec(tokenPath);
  if (!match || !TOKEN_NAMES.includes(match[1])) {
    throw new Error(`无效的目标路径令牌：${tokenPath}`);
  }
  const root = pathEnvironment[match[1]];
  if (!root) {
    throw new Error(`当前系统无法解析路径令牌：%${match[1]}%`);
  }
  const relative = match[2] || '';
  const segments = relative.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '..' || segment.includes('\0'))) {
    throw new Error(`目标路径包含不安全片段：${tokenPath}`);
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...segments);
  const normalizedRoot = normalizeForCompare(resolvedRoot);
  const normalized = normalizeForCompare(resolved);
  if (normalized !== normalizedRoot && !normalized.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new Error(`目标路径越界：${tokenPath}`);
  }
  return resolved;
}

module.exports = {
  TOKEN_NAMES,
  getPathEnvironment,
  tokenizePath,
  resolveTokenPath,
};
