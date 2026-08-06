const fsp = require('node:fs/promises');
const path = require('node:path');
const { COMPONENTS } = require('./catalog.cjs');
const { getPathEnvironment, tokenizePath } = require('./path-tokens.cjs');
const { DEFAULT_EXCLUDED_DIRECTORIES, pathExists, walkFiles } = require('./file-utils.cjs');

async function expandLocation(location, pathEnvironment) {
  const root = pathEnvironment[location.token];
  if (!root || !(await pathExists(root))) return [];
  const targets = (location.names || []).map((name) => path.join(root, name));
  if (location.topLevelPattern) {
    const children = await fsp.readdir(root, { withFileTypes: true }).catch(() => []);
    for (const child of children) {
      if (location.topLevelPattern.test(child.name)) targets.push(path.join(root, child.name));
    }
  }
  return targets;
}

async function scanComponents(options = {}) {
  const pathEnvironment = getPathEnvironment(options.pathEnvironment);
  const selectedIds = options.componentIds || COMPONENTS.map((item) => item.id);
  const selected = COMPONENTS.filter((item) => selectedIds.includes(item.id));
  const seen = new Set();
  const allFiles = [];
  const warnings = [];
  const summaries = [];

  for (let componentIndex = 0; componentIndex < selected.length; componentIndex += 1) {
    const component = selected[componentIndex];
    let componentBytes = 0;
    let componentFiles = 0;
    const componentWarnings = [];

    for (const location of component.locations) {
      const targets = await expandLocation(location, pathEnvironment);
      for (const target of targets) {
        if (!(await pathExists(target))) continue;
        const result = await walkFiles(target, {
          signal: options.signal,
          excludedDirectoryNames: component.excludeCaches
            ? DEFAULT_EXCLUDED_DIRECTORIES
            : new Set(),
        });
        componentWarnings.push(...result.warnings);
        for (const file of result.files) {
          const identity = process.platform === 'win32'
            ? path.resolve(file.absolutePath).toLowerCase()
            : path.resolve(file.absolutePath);
          if (seen.has(identity)) continue;
          seen.add(identity);
          const entry = {
            componentId: component.id,
            absolutePath: file.absolutePath,
            targetPath: tokenizePath(file.absolutePath, pathEnvironment),
            size: file.stat.size,
            mtimeMs: file.stat.mtimeMs,
            mode: file.stat.mode,
          };
          allFiles.push(entry);
          componentFiles += 1;
          componentBytes += file.stat.size;
        }
      }
    }

    warnings.push(...componentWarnings.map((warning) => ({ ...warning, componentId: component.id })));
    summaries.push({
      id: component.id,
      name: component.name,
      description: component.description,
      icon: component.icon,
      recommended: component.recommended,
      sensitive: Boolean(component.sensitive),
      files: componentFiles,
      bytes: componentBytes,
      available: componentFiles > 0,
      warnings: componentWarnings.length,
    });
    options.onProgress?.({
      phase: 'scan',
      completed: componentIndex + 1,
      total: selected.length,
      message: `正在扫描：${component.name}`,
    });
  }

  return {
    files: allFiles,
    components: summaries,
    warnings,
    totals: {
      files: allFiles.length,
      bytes: allFiles.reduce((sum, item) => sum + item.size, 0),
    },
    pathEnvironment,
  };
}

module.exports = { scanComponents };
