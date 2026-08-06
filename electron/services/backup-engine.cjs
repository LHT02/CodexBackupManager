const crypto = require('node:crypto');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { COMPONENT_MAP } = require('./catalog.cjs');
const { scanComponents } = require('./discovery.cjs');
const {
  createZipArchive,
  encryptZip,
  verifyZipPayloads,
  FORMAT_NAME,
  FORMAT_VERSION,
} = require('./archive-format.cjs');
const { atomicReplace, hashFile, mapWithConcurrency } = require('./file-utils.cjs');

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function createArchiveFromFiles(files, options) {
  const destination = path.resolve(options.destination);
  const partialPath = `${destination}.${crypto.randomUUID()}.partial`;
  const zipPath = options.password
    ? `${destination}.${crypto.randomUUID()}.zip.partial`
    : partialPath;
  let completedBytes = 0;
  let completedFiles = 0;
  const totalSourceBytes = files.reduce((sum, item) => sum + item.size, 0);

  try {
    const hashed = await mapWithConcurrency(files, 2, async (file, index) => {
      if (options.signal?.aborted) throw new Error('操作已取消');
      const sha256 = await hashFile(file.absolutePath);
      completedBytes += file.size;
      completedFiles += 1;
      options.onProgress?.({
        phase: 'hash',
        completed: completedFiles,
        total: files.length,
        bytes: completedBytes,
        totalBytes: totalSourceBytes,
        message: '正在计算文件校验值',
      });
      return {
        ...file,
        archivePath: `payload/${index.toString(16).padStart(8, '0')}`,
        sha256,
      };
    });

    const componentIds = [...new Set(hashed.map((item) => item.componentId))];
    const manifest = {
      format: FORMAT_NAME,
      formatVersion: FORMAT_VERSION,
      appVersion: options.appVersion || 'development',
      createdAt: new Date().toISOString(),
      backupType: options.backupType || 'user',
      compression: {
        algorithm: 'deflate',
        level: options.compressionLevel ?? 9,
      },
      encrypted: Boolean(options.password),
      source: {
        platform: process.platform,
        arch: process.arch,
        hostname: os.hostname(),
        release: os.release(),
      },
      components: componentIds.map((id) => {
        const definition = COMPONENT_MAP.get(id);
        const componentFiles = hashed.filter((entry) => entry.componentId === id);
        return {
          id,
          name: definition?.name || id,
          files: componentFiles.length,
          bytes: componentFiles.reduce((sum, entry) => sum + entry.size, 0),
        };
      }),
      totals: {
        files: hashed.length,
        bytes: hashed.reduce((sum, item) => sum + item.size, 0),
      },
      entries: hashed.map((item) => ({
        archivePath: item.archivePath,
        componentId: item.componentId,
        targetPath: item.targetPath,
        size: item.size,
        mtimeMs: item.mtimeMs,
        mode: item.mode,
        sha256: item.sha256,
      })),
      notes: options.notes || undefined,
    };

    await createZipArchive(zipPath, manifest, hashed, {
      compressionLevel: options.compressionLevel,
      onProgress: options.onProgress,
    });
    await verifyZipPayloads(zipPath, {
      signal: options.signal,
      onProgress: options.onProgress,
    });
    if (options.password) {
      await encryptZip(zipPath, partialPath, options.password, { onProgress: options.onProgress });
      await fsp.rm(zipPath, { force: true });
    }
    await atomicReplace(partialPath, destination);
    const outputStat = await fsp.stat(destination);
    const outputSha256 = await hashFile(destination);
    return {
      destination,
      outputBytes: outputStat.size,
      outputSha256,
      manifest,
      warnings: options.warnings || [],
    };
  } catch (error) {
    await Promise.allSettled([fsp.rm(partialPath, { force: true }), fsp.rm(zipPath, { force: true })]);
    throw error;
  }
}

async function createBackup(options) {
  const selected = options.componentIds || [];
  if (selected.length === 0) throw new Error('请至少选择一个备份项目');
  const requiresEncryption = selected.some((id) => COMPONENT_MAP.get(id)?.requiresEncryption);
  if (requiresEncryption && !options.password) throw new Error('登录凭据必须使用加密备份');
  if (options.password && options.password.length < 8) throw new Error('加密密码至少需要 8 个字符');

  const scan = await scanComponents({
    componentIds: selected,
    pathEnvironment: options.pathEnvironment,
    signal: options.signal,
    onProgress: options.onProgress,
  });
  if (scan.files.length === 0) throw new Error('所选项目没有可备份文件');
  return createArchiveFromFiles(scan.files, {
    ...options,
    backupType: 'user',
    warnings: scan.warnings,
  });
}

async function createRollbackBackup(files, options = {}) {
  if (files.length === 0) return null;
  const rollbackDirectory = options.rollbackDirectory || path.join(
    options.userProfile || process.env.USERPROFILE || os.homedir(),
    'Documents',
    'Codex Backups',
  );
  await fsp.mkdir(rollbackDirectory, { recursive: true });
  const destination = path.join(rollbackDirectory, `Rollback-${safeTimestamp()}.cxbak`);
  return createArchiveFromFiles(files, {
    destination,
    password: options.password,
    compressionLevel: 6,
    appVersion: options.appVersion,
    backupType: 'rollback',
    notes: '由还原操作自动生成，可用于撤销覆盖。',
    signal: options.signal,
    onProgress: options.onProgress,
  });
}

module.exports = { createBackup, createArchiveFromFiles, createRollbackBackup };
