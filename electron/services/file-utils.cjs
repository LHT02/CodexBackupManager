const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_EXCLUDED_DIRECTORIES = new Set([
  'Cache',
  'Code Cache',
  'GPUCache',
  'DawnCache',
  'GrShaderCache',
  'ShaderCache',
  'Crashpad',
  'blob_storage',
  'logs',
  'Logs',
  'Temp',
  'tmp',
]);

async function pathExists(target) {
  try {
    await fsp.access(target);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(root, options = {}) {
  const files = [];
  const warnings = [];
  const stack = [root];
  const excludedDirectoryNames = options.excludedDirectoryNames || new Set();

  while (stack.length > 0) {
    if (options.signal?.aborted) throw new Error('操作已取消');
    const current = stack.pop();
    let stat;
    try {
      stat = await fsp.lstat(current);
    } catch (error) {
      warnings.push({ path: current, message: error.message });
      continue;
    }

    if (stat.isSymbolicLink()) {
      warnings.push({ path: current, message: '已跳过符号链接或目录联接' });
      continue;
    }
    if (stat.isFile()) {
      files.push({ absolutePath: current, stat });
      continue;
    }
    if (!stat.isDirectory()) continue;

    let children;
    try {
      children = await fsp.readdir(current, { withFileTypes: true });
    } catch (error) {
      warnings.push({ path: current, message: error.message });
      continue;
    }

    for (const child of children) {
      if (child.isDirectory() && excludedDirectoryNames.has(child.name)) continue;
      const childPath = path.join(current, child.name);
      if (options.exclude?.(childPath, child)) continue;
      stack.push(childPath);
    }
  }

  return { files, warnings };
}

function hashFile(filePath, algorithm = 'sha256') {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    const input = fs.createReadStream(filePath);
    input.on('error', reject);
    input.on('data', (chunk) => hash.update(chunk));
    input.on('end', () => resolve(hash.digest('hex')));
  });
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function atomicReplace(tempPath, targetPath) {
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  try {
    await fsp.rename(tempPath, targetPath);
  } catch (error) {
    if (!['EEXIST', 'EPERM'].includes(error.code)) throw error;
    await fsp.rm(targetPath, { force: true });
    await fsp.rename(tempPath, targetPath);
  }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

module.exports = {
  DEFAULT_EXCLUDED_DIRECTORIES,
  pathExists,
  walkFiles,
  hashFile,
  mapWithConcurrency,
  atomicReplace,
  formatBytes,
};
