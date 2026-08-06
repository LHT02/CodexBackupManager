const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { prepareReadableArchive, openAndReadManifest } = require('./archive-format.cjs');
const { createRollbackBackup } = require('./backup-engine.cjs');
const { atomicReplace, pathExists } = require('./file-utils.cjs');
const { getPathEnvironment, resolveTokenPath, tokenizePath } = require('./path-tokens.cjs');

function createHashingTransform() {
  const hash = crypto.createHash('sha256');
  let bytes = 0;
  const stream = new Transform({
    transform(chunk, encoding, callback) {
      hash.update(chunk);
      bytes += chunk.length;
      callback(null, chunk);
    },
  });
  return {
    stream,
    result: () => ({ sha256: hash.digest('hex'), bytes }),
  };
}

async function planRestore(entries, mode, pathEnvironment) {
  const actions = [];
  const skipped = [];
  for (const entry of entries) {
    if (!/^[a-f0-9]{64}$/i.test(entry.sha256)) throw new Error(`校验值无效：${entry.targetPath}`);
    const targetPath = resolveTokenPath(entry.targetPath, pathEnvironment);
    const exists = await pathExists(targetPath);
    if (mode === 'merge' && exists) {
      const stat = await fsp.stat(targetPath);
      if (stat.mtimeMs >= entry.mtimeMs) {
        skipped.push({ targetPath, reason: '目标文件相同或更新' });
        continue;
      }
    }
    actions.push({ ...entry, targetPath, exists });
  }
  return { actions, skipped };
}

async function collectRollbackFiles(actions, pathEnvironment) {
  const files = [];
  for (const action of actions) {
    if (!action.exists) continue;
    const stat = await fsp.stat(action.targetPath);
    if (!stat.isFile()) continue;
    files.push({
      componentId: action.componentId,
      absolutePath: action.targetPath,
      targetPath: tokenizePath(action.targetPath, pathEnvironment),
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      mode: stat.mode,
    });
  }
  return files;
}

async function restoreBackup(options) {
  const mode = options.mode === 'overwrite' ? 'overwrite' : 'merge';
  const pathEnvironment = getPathEnvironment(options.pathEnvironment);
  const prepared = await prepareReadableArchive(options.filePath, options.password, {
    onProgress: options.onProgress,
  });
  let rollback = null;
  try {
    const { manifest, payloadEntries } = await openAndReadManifest(prepared.zipPath);
    const selectedIds = options.componentIds?.length
      ? new Set(options.componentIds)
      : new Set(manifest.components.map((component) => component.id));
    const selectedEntries = manifest.entries.filter((entry) => selectedIds.has(entry.componentId));
    if (selectedEntries.length === 0) throw new Error('备份中没有所选项目');

    const plan = await planRestore(selectedEntries, mode, pathEnvironment);
    if (plan.actions.length === 0) {
      return {
        restoredFiles: 0,
        restoredBytes: 0,
        skipped: plan.skipped,
        rollback: null,
        message: '没有需要还原的文件',
      };
    }

    if (options.createRollback !== false) {
      const rollbackFiles = await collectRollbackFiles(plan.actions, pathEnvironment);
      rollback = await createRollbackBackup(rollbackFiles, {
        password: options.password,
        appVersion: options.appVersion,
        userProfile: pathEnvironment.USERPROFILE,
        rollbackDirectory: options.rollbackDirectory,
        signal: options.signal,
        onProgress: (progress) => options.onProgress?.({
          ...progress,
          phase: 'rollback',
          message: '正在创建覆盖前回滚包',
        }),
      });
    }

    let restoredBytes = 0;
    let restoredFiles = 0;
    const totalRestoreBytes = plan.actions.reduce((sum, item) => sum + item.size, 0);
    for (let index = 0; index < plan.actions.length; index += 1) {
      if (options.signal?.aborted) throw new Error('操作已取消');
      const action = plan.actions[index];
      const payload = payloadEntries.get(action.archivePath);
      if (!payload) throw new Error(`备份数据缺失：${action.targetPath}`);
      await fsp.mkdir(path.dirname(action.targetPath), { recursive: true });
      const tempPath = path.join(
        path.dirname(action.targetPath),
        `.${path.basename(action.targetPath)}.codex-restore-${crypto.randomUUID()}.tmp`,
      );
      const hashing = createHashingTransform();
      try {
        await pipeline(
          payload.stream(),
          hashing.stream,
          fs.createWriteStream(tempPath, { flags: 'wx', mode: action.mode }),
        );
        const result = hashing.result();
        if (result.bytes !== action.size || result.sha256 !== action.sha256) {
          throw new Error(`文件校验失败：${action.targetPath}`);
        }
        await atomicReplace(tempPath, action.targetPath);
        await fsp.utimes(action.targetPath, new Date(), new Date(action.mtimeMs));
      } catch (error) {
        await fsp.rm(tempPath, { force: true });
        throw error;
      }
      restoredFiles += 1;
      restoredBytes += action.size;
      options.onProgress?.({
        phase: 'restore',
        completed: index + 1,
        total: plan.actions.length,
        bytes: restoredBytes,
        totalBytes: totalRestoreBytes,
        message: `正在还原：${action.targetPath}`,
      });
    }

    return {
      restoredFiles,
      restoredBytes,
      skipped: plan.skipped,
      rollback: rollback
        ? {
            destination: rollback.destination,
            outputBytes: rollback.outputBytes,
            outputSha256: rollback.outputSha256,
          }
        : null,
    };
  } finally {
    await prepared.cleanup();
  }
}

module.exports = { restoreBackup, planRestore };
