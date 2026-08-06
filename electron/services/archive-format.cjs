const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { ZipArchive } = require('archiver');
const unzipper = require('unzipper');

const ENCRYPTED_MAGIC = Buffer.from('CXBAKENC1', 'ascii');
const AUTH_TAG_BYTES = 16;
const MANIFEST_NAME = 'manifest.json';
const FORMAT_NAME = 'codex-backup-manager';
const FORMAT_VERSION = 1;

function deriveKey(password, salt, parameters) {
  return crypto.scryptSync(password, salt, 32, {
    N: parameters.N,
    r: parameters.r,
    p: parameters.p,
    maxmem: 128 * 1024 * 1024,
  });
}

async function createZipArchive(zipPath, manifest, sourceFiles, options = {}) {
  await fsp.mkdir(path.dirname(zipPath), { recursive: true });
  const output = fs.createWriteStream(zipPath, { flags: 'wx' });
  const archive = new ZipArchive({
    forceZip64: true,
    zlib: { level: options.compressionLevel ?? 9 },
  });

  const completion = new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
    archive.on('warning', (error) => {
      if (error.code !== 'ENOENT') reject(error);
      else options.onWarning?.(error.message);
    });
  });

  archive.on('progress', (progress) => {
    options.onProgress?.({
      phase: 'compress',
      completed: progress.entries.processed,
      total: progress.entries.total,
      bytes: progress.fs.processedBytes,
      message: '正在压缩备份数据',
    });
  });
  archive.pipe(output);
  archive.append(Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'), { name: MANIFEST_NAME });
  for (const source of sourceFiles) {
    archive.file(source.absolutePath, {
      name: source.archivePath,
      date: new Date(source.mtimeMs),
      mode: source.mode,
    });
  }
  await archive.finalize();
  await completion;
}

async function encryptZip(zipPath, destination, password, options = {}) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const parameters = { N: 32768, r: 8, p: 1 };
  const key = deriveKey(password, salt, parameters);
  const header = Buffer.from(
    JSON.stringify({
      format: FORMAT_NAME,
      formatVersion: FORMAT_VERSION,
      encryption: 'AES-256-GCM',
      kdf: 'scrypt',
      parameters,
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      createdAt: new Date().toISOString(),
    }),
    'utf8',
  );
  const length = Buffer.alloc(4);
  length.writeUInt32LE(header.length, 0);
  const output = fs.createWriteStream(destination, { flags: 'wx' });
  output.write(Buffer.concat([ENCRYPTED_MAGIC, length, header]));
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let processed = 0;
  const total = (await fsp.stat(zipPath)).size;
  cipher.on('data', (chunk) => {
    processed += chunk.length;
    options.onProgress?.({
      phase: 'encrypt',
      completed: processed,
      total,
      bytes: processed,
      message: '正在加密单文件备份',
    });
  });
  await pipeline(fs.createReadStream(zipPath), cipher, output);
  await fsp.appendFile(destination, cipher.getAuthTag());
}

async function detectArchive(filePath) {
  const handle = await fsp.open(filePath, 'r');
  try {
    const prefix = Buffer.alloc(Math.max(ENCRYPTED_MAGIC.length, 4));
    const { bytesRead } = await handle.read(prefix, 0, prefix.length, 0);
    if (bytesRead >= ENCRYPTED_MAGIC.length && prefix.subarray(0, ENCRYPTED_MAGIC.length).equals(ENCRYPTED_MAGIC)) {
      return { encrypted: true };
    }
    if (bytesRead >= 2 && prefix[0] === 0x50 && prefix[1] === 0x4b) {
      return { encrypted: false };
    }
    throw new Error('不是受支持的 Codex 备份文件');
  } finally {
    await handle.close();
  }
}

async function prepareReadableArchive(filePath, password, options = {}) {
  const detected = await detectArchive(filePath);
  if (!detected.encrypted) {
    return { zipPath: filePath, encrypted: false, cleanup: async () => {} };
  }
  if (!password) {
    const error = new Error('此备份已加密，需要输入密码');
    error.code = 'PASSWORD_REQUIRED';
    throw error;
  }

  const handle = await fsp.open(filePath, 'r');
  let header;
  let ciphertextStart;
  let stat;
  let authTag;
  try {
    stat = await handle.stat();
    const lengthBuffer = Buffer.alloc(4);
    await handle.read(lengthBuffer, 0, 4, ENCRYPTED_MAGIC.length);
    const headerLength = lengthBuffer.readUInt32LE(0);
    if (headerLength <= 0 || headerLength > 1024 * 1024) throw new Error('加密备份头损坏');
    const headerBuffer = Buffer.alloc(headerLength);
    await handle.read(headerBuffer, 0, headerLength, ENCRYPTED_MAGIC.length + 4);
    header = JSON.parse(headerBuffer.toString('utf8'));
    ciphertextStart = ENCRYPTED_MAGIC.length + 4 + headerLength;
    if (stat.size <= ciphertextStart + AUTH_TAG_BYTES) throw new Error('加密备份内容不完整');
    authTag = Buffer.alloc(AUTH_TAG_BYTES);
    await handle.read(authTag, 0, AUTH_TAG_BYTES, stat.size - AUTH_TAG_BYTES);
  } finally {
    await handle.close();
  }
  if (header.format !== FORMAT_NAME || header.encryption !== 'AES-256-GCM') {
    throw new Error('不支持的加密备份格式');
  }

  const salt = Buffer.from(header.salt, 'base64');
  const iv = Buffer.from(header.iv, 'base64');
  const key = deriveKey(password, salt, header.parameters);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const tempPath = path.join(os.tmpdir(), `codex-backup-${crypto.randomUUID()}.zip`);
  let processed = 0;
  decipher.on('data', (chunk) => {
    processed += chunk.length;
    options.onProgress?.({
      phase: 'decrypt',
      completed: processed,
      total: stat.size - ciphertextStart - AUTH_TAG_BYTES,
      bytes: processed,
      message: '正在解密并验证备份',
    });
  });
  try {
    await pipeline(
      fs.createReadStream(filePath, {
        start: ciphertextStart,
        end: stat.size - AUTH_TAG_BYTES - 1,
      }),
      decipher,
      fs.createWriteStream(tempPath, { flags: 'wx' }),
    );
  } catch (error) {
    await fsp.rm(tempPath, { force: true });
    const wrapped = new Error('密码错误或加密备份已损坏');
    wrapped.code = 'DECRYPT_FAILED';
    wrapped.cause = error;
    throw wrapped;
  }
  return {
    zipPath: tempPath,
    encrypted: true,
    cleanup: () => fsp.rm(tempPath, { force: true }),
  };
}

async function openAndReadManifest(zipPath) {
  const directory = await unzipper.Open.file(zipPath);
  const manifestEntry = directory.files.find((entry) => entry.path === MANIFEST_NAME);
  if (!manifestEntry) throw new Error('备份缺少 manifest.json');
  if (manifestEntry.uncompressedSize > 64 * 1024 * 1024) throw new Error('备份清单异常大');
  const manifest = JSON.parse((await manifestEntry.buffer()).toString('utf8'));
  if (manifest.format !== FORMAT_NAME || manifest.formatVersion !== FORMAT_VERSION) {
    throw new Error('不支持的备份清单版本');
  }
  if (!Array.isArray(manifest.entries)) throw new Error('备份清单结构无效');
  const payloadEntries = new Map(
    directory.files
      .filter((entry) => entry.type === 'File' && entry.path !== MANIFEST_NAME)
      .map((entry) => [entry.path, entry]),
  );
  const seen = new Set();
  let declaredBytes = 0;
  for (const entry of manifest.entries) {
    if (!/^payload\/[0-9a-f]{8}$/i.test(entry.archivePath)) {
      throw new Error(`清单包含无效归档路径：${entry.archivePath}`);
    }
    if (seen.has(entry.archivePath)) throw new Error('清单包含重复项目');
    seen.add(entry.archivePath);
    const payload = payloadEntries.get(entry.archivePath);
    if (!payload) throw new Error(`备份数据缺失：${entry.archivePath}`);
    if (Number(payload.uncompressedSize) !== Number(entry.size)) {
      throw new Error(`备份项目大小不匹配：${entry.targetPath}`);
    }
    declaredBytes += Number(entry.size);
  }
  return { directory, manifest, payloadEntries, declaredBytes };
}

async function verifyZipPayloads(zipPath, options = {}) {
  const { manifest, payloadEntries, declaredBytes } = await openAndReadManifest(zipPath);
  let verifiedBytes = 0;
  for (let index = 0; index < manifest.entries.length; index += 1) {
    if (options.signal?.aborted) throw new Error('操作已取消');
    const entry = manifest.entries[index];
    const payload = payloadEntries.get(entry.archivePath);
    const hash = crypto.createHash('sha256');
    let bytes = 0;
    for await (const chunk of payload.stream()) {
      hash.update(chunk);
      bytes += chunk.length;
    }
    const sha256 = hash.digest('hex');
    if (bytes !== entry.size || sha256 !== entry.sha256) {
      throw new Error(`归档校验失败，源文件可能在备份时发生了变化：${entry.targetPath}`);
    }
    verifiedBytes += bytes;
    options.onProgress?.({
      phase: 'verify',
      completed: index + 1,
      total: manifest.entries.length,
      bytes: verifiedBytes,
      totalBytes: declaredBytes,
      message: '正在解压复核备份校验值',
    });
  }
  return manifest;
}

module.exports = {
  FORMAT_NAME,
  FORMAT_VERSION,
  createZipArchive,
  encryptZip,
  detectArchive,
  prepareReadableArchive,
  openAndReadManifest,
  verifyZipPayloads,
};
