const fsp = require('node:fs/promises');
const { detectArchive, prepareReadableArchive, openAndReadManifest } = require('./archive-format.cjs');

async function inspectBackup(filePath, password, options = {}) {
  const detected = await detectArchive(filePath);
  if (detected.encrypted && !password) {
    const stat = await fsp.stat(filePath);
    return {
      encrypted: true,
      requiresPassword: true,
      fileBytes: stat.size,
      filePath,
    };
  }

  const prepared = await prepareReadableArchive(filePath, password, options);
  try {
    const { manifest, declaredBytes } = await openAndReadManifest(prepared.zipPath);
    const stat = await fsp.stat(filePath);
    return {
      encrypted: prepared.encrypted,
      requiresPassword: false,
      filePath,
      fileBytes: stat.size,
      createdAt: manifest.createdAt,
      appVersion: manifest.appVersion,
      source: manifest.source,
      compression: manifest.compression,
      components: manifest.components,
      totals: manifest.totals,
      declaredBytes,
    };
  } finally {
    await prepared.cleanup();
  }
}

module.exports = { inspectBackup };
