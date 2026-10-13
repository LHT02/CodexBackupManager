const fsp = require('node:fs/promises');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { atomicReplace, pathExists } = require('./file-utils.cjs');

const PATH_ENVIRONMENT_KEYS = ['CODEX_HOME', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE'];
const TOP_LEVEL_TEXT_NAMES = new Set([
  'config.toml',
  '.codex-global-state.json',
  '.codex-global-state.json.bak',
  'session_index.jsonl',
  'history.jsonl',
  'external_agent_session_imports.json',
  'chrome-native-hosts-v2.json',
]);

const STATE_DATABASE_COLUMNS = {
  external_agent_config_imports: ['successes', 'failures'],
  project_roots: ['path'],
  projects: ['metadata'],
  rollout_migration_skipped_rollouts: ['rollout_path'],
  thread_attachments: ['identity_key', 'payload'],
  threads: ['rollout_path', 'cwd', 'sandbox_policy', 'agent_path'],
};

const CODEX_DEV_DATABASE_COLUMNS = {
  automation_runs: ['source_cwd'],
  automations: ['cwds', 'local_environment_config_path'],
  local_thread_catalog: ['cwd', 'source_detail'],
  local_thread_catalog_scan_checkpoints: ['checkpoint'],
};

function normalizedPath(value) {
  return String(value || '').replace(/[\\/]+$/, '').replaceAll('/', '\\').toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addMappingVariant(variants, source, target) {
  if (!source || !target || source.toLowerCase() === target.toLowerCase()) return;
  const identity = source.toLowerCase();
  if (variants.some((item) => item.source.toLowerCase() === identity)) return;
  variants.push({ source, target });
}

function buildPathMappings(sourceEnvironment = {}, targetEnvironment = {}) {
  const mappings = [];
  const seen = new Set();
  for (const key of PATH_ENVIRONMENT_KEYS) {
    const source = sourceEnvironment[key];
    const target = targetEnvironment[key];
    if (typeof source !== 'string' || typeof target !== 'string') continue;
    const identity = normalizedPath(source);
    if (!identity || identity === normalizedPath(target) || seen.has(identity)) continue;
    seen.add(identity);
    mappings.push({ key, source: source.replace(/[\\/]+$/, ''), target: target.replace(/[\\/]+$/, '') });
  }
  return mappings.sort((a, b) => b.source.length - a.source.length);
}

function mappingVariants(mappings) {
  const variants = [];
  for (const mapping of mappings) {
    addMappingVariant(variants, mapping.source, mapping.target);
    addMappingVariant(variants, mapping.source.replaceAll('\\', '/'), mapping.target.replaceAll('\\', '/'));
    addMappingVariant(variants, mapping.source.replaceAll('\\', '\\\\'), mapping.target.replaceAll('\\', '\\\\'));
  }
  return variants.sort((a, b) => b.source.length - a.source.length);
}

function replacePathReferences(value, mappings) {
  let output = String(value);
  let replacements = 0;
  for (const variant of mappingVariants(mappings)) {
    const expression = new RegExp(`${escapeRegExp(variant.source)}(?=$|[\\\\/])`, 'gi');
    output = output.replace(expression, () => {
      replacements += 1;
      return variant.target;
    });
  }
  return { value: output, replacements };
}

function validateStructuredText(filePath, content) {
  const name = path.basename(filePath).toLowerCase();
  if (name.endsWith('.json') || name === '.codex-global-state.json.bak') {
    JSON.parse(content);
    return;
  }
  if (name.endsWith('.jsonl')) {
    for (const line of content.split(/\r?\n/)) {
      if (line.trim()) JSON.parse(line);
    }
  }
}

async function migrateTextFile(filePath, mappings) {
  const content = await fsp.readFile(filePath, 'utf8');
  const migrated = replacePathReferences(content, mappings);
  if (migrated.replacements === 0) return { changed: false, replacements: 0 };
  validateStructuredText(filePath, migrated.value);
  const stat = await fsp.stat(filePath);
  const tempPath = `${filePath}.path-migration-${process.pid}-${Date.now()}.tmp`;
  try {
    await fsp.writeFile(tempPath, migrated.value, { encoding: 'utf8', mode: stat.mode });
    await atomicReplace(tempPath, filePath);
  } catch (error) {
    await fsp.rm(tempPath, { force: true });
    throw error;
  }
  return { changed: true, replacements: migrated.replacements };
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function databaseRules(filePath) {
  const name = path.basename(filePath).toLowerCase();
  if (/^state_\d+\.sqlite$/.test(name)) return STATE_DATABASE_COLUMNS;
  if (name === 'codex-dev.db') return CODEX_DEV_DATABASE_COLUMNS;
  return null;
}

function migrateSqliteDatabase(filePath, mappings) {
  const rules = databaseRules(filePath);
  if (!rules) return { changed: false, replacements: 0, rows: 0 };
  const db = new DatabaseSync(filePath);
  let replacements = 0;
  let rowsChanged = 0;
  try {
    db.exec('PRAGMA busy_timeout = 5000');
    const existingTables = new Set(
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name),
    );
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const [table, columns] of Object.entries(rules)) {
        if (!existingTables.has(table)) continue;
        const quotedTable = quoteIdentifier(table);
        const existingColumns = new Set(
          db.prepare(`PRAGMA table_info(${quotedTable})`).all().map((column) => column.name),
        );
        for (const column of columns) {
          if (!existingColumns.has(column)) continue;
          const quotedColumn = quoteIdentifier(column);
          const rows = db.prepare(
            `SELECT rowid AS migration_rowid, ${quotedColumn} AS migration_value `
              + `FROM ${quotedTable} WHERE typeof(${quotedColumn}) = 'text'`,
          ).all();
          const update = db.prepare(
            `UPDATE ${quotedTable} SET ${quotedColumn} = ? WHERE rowid = ?`,
          );
          for (const row of rows) {
            const migrated = replacePathReferences(row.migration_value, mappings);
            if (migrated.replacements === 0) continue;
            update.run(migrated.value, row.migration_rowid);
            replacements += migrated.replacements;
            rowsChanged += 1;
          }
        }
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    const integrity = db.prepare('PRAGMA quick_check').get();
    if (!integrity || Object.values(integrity)[0] !== 'ok') {
      throw new Error(`SQLite 完整性检查失败：${filePath}`);
    }
    try {
      db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').all();
    } catch {
      // 非 WAL 数据库无需执行检查点。
    }
  } finally {
    db.close();
  }
  return { changed: rowsChanged > 0, replacements, rows: rowsChanged };
}

function extractWindowsProfiles(value) {
  const decoded = String(value).replaceAll('\\\\', '\\');
  return decoded.match(/[a-z]:[\\/]users[\\/][^\\/\r\n\t"'<>|]+/gi) || [];
}

async function collectLegacyProfileCandidates(filePaths) {
  const candidates = new Map();
  const add = (value) => {
    for (const profile of extractWindowsProfiles(value)) {
      const cleaned = profile.replace(/[ ,;:)}\]]+$/, '');
      const identity = normalizedPath(cleaned);
      const current = candidates.get(identity) || { value: cleaned, count: 0 };
      current.count += 1;
      candidates.set(identity, current);
    }
  };

  for (const filePath of filePaths) {
    const name = path.basename(filePath).toLowerCase();
    if (TOP_LEVEL_TEXT_NAMES.has(name)) {
      const stat = await fsp.stat(filePath).catch(() => null);
      if (stat && stat.size <= 32 * 1024 * 1024) add(await fsp.readFile(filePath, 'utf8'));
      continue;
    }
    const rules = databaseRules(filePath);
    if (!rules) continue;
    const db = new DatabaseSync(filePath, { readOnly: true });
    try {
      const existingTables = new Set(
        db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name),
      );
      for (const [table, columns] of Object.entries(rules)) {
        if (!existingTables.has(table)) continue;
        const quotedTable = quoteIdentifier(table);
        const existingColumns = new Set(
          db.prepare(`PRAGMA table_info(${quotedTable})`).all().map((column) => column.name),
        );
        for (const column of columns) {
          if (!existingColumns.has(column)) continue;
          const quotedColumn = quoteIdentifier(column);
          const rows = db.prepare(
            `SELECT ${quotedColumn} AS migration_value FROM ${quotedTable} `
              + `WHERE typeof(${quotedColumn}) = 'text' LIMIT 10000`,
          ).all();
          rows.forEach((row) => add(row.migration_value));
        }
      }
    } finally {
      db.close();
    }
  }
  return candidates;
}

async function inferLegacySourceEnvironment(filePaths, targetEnvironment) {
  const candidates = await collectLegacyProfileCandidates(filePaths);
  const targetIdentity = normalizedPath(targetEnvironment.USERPROFILE);
  const source = [...candidates.entries()]
    .filter(([identity]) => identity !== targetIdentity)
    .sort((a, b) => b[1].count - a[1].count)[0]?.[1]?.value;
  if (!source) return null;
  return {
    USERPROFILE: source,
    APPDATA: path.win32.join(source, 'AppData', 'Roaming'),
    LOCALAPPDATA: path.win32.join(source, 'AppData', 'Local'),
    CODEX_HOME: path.win32.join(source, '.codex'),
  };
}

function sourceEnvironmentFromManifest(manifest) {
  const source = manifest?.source?.pathEnvironment;
  if (!source || typeof source !== 'object') return null;
  const result = {};
  for (const key of PATH_ENVIRONMENT_KEYS) {
    if (typeof source[key] === 'string' && source[key].length > 0) result[key] = source[key];
  }
  return result.USERPROFILE ? result : null;
}

function isTopLevelMigratableText(filePath, targetEnvironment) {
  const relative = path.relative(targetEnvironment.CODEX_HOME, filePath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
    && !relative.includes(path.sep) && TOP_LEVEL_TEXT_NAMES.has(relative.toLowerCase());
}

async function migrateRestoredPathReferences(actions, manifest, targetEnvironment, options = {}) {
  const restoredPaths = [...new Set(actions.map((action) => action.targetPath))];
  const existingPaths = [];
  for (const filePath of restoredPaths) {
    if (await pathExists(filePath)) existingPaths.push(filePath);
  }
  let sourceEnvironment = sourceEnvironmentFromManifest(manifest);
  let inferred = false;
  if (!sourceEnvironment) {
    sourceEnvironment = await inferLegacySourceEnvironment(existingPaths, targetEnvironment);
    inferred = Boolean(sourceEnvironment);
  }
  const mappings = buildPathMappings(sourceEnvironment || {}, targetEnvironment);
  if (mappings.length === 0) {
    return { files: 0, databases: 0, rows: 0, replacements: 0, inferred };
  }

  let files = 0;
  let databases = 0;
  let rows = 0;
  let replacements = 0;
  const candidates = existingPaths.filter((filePath) =>
    isTopLevelMigratableText(filePath, targetEnvironment) || databaseRules(filePath));
  for (let index = 0; index < candidates.length; index += 1) {
    if (options.signal?.aborted) throw new Error('操作已取消');
    const filePath = candidates[index];
    const sqliteRules = databaseRules(filePath);
    const result = sqliteRules
      ? migrateSqliteDatabase(filePath, mappings)
      : await migrateTextFile(filePath, mappings);
    if (result.changed) {
      if (sqliteRules) databases += 1;
      else files += 1;
    }
    rows += result.rows || 0;
    replacements += result.replacements;
    options.onProgress?.({
      phase: 'migrate',
      completed: index + 1,
      total: candidates.length,
      message: `正在迁移当前用户路径：${path.basename(filePath)}`,
    });
  }
  return { files, databases, rows, replacements, inferred };
}

module.exports = {
  PATH_ENVIRONMENT_KEYS,
  buildPathMappings,
  replacePathReferences,
  migrateTextFile,
  migrateSqliteDatabase,
  inferLegacySourceEnvironment,
  migrateRestoredPathReferences,
};
