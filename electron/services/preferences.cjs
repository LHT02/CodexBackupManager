const fsp = require('node:fs/promises');
const path = require('node:path');

const THEME_SOURCES = new Set(['system', 'light', 'dark']);

function preferencesPath(app) {
  return path.join(app.getPath('userData'), 'preferences.json');
}

async function loadPreferences(app) {
  try {
    const content = await fsp.readFile(preferencesPath(app), 'utf8');
    const parsed = JSON.parse(content);
    return {
      themeSource: THEME_SOURCES.has(parsed.themeSource) ? parsed.themeSource : 'system',
    };
  } catch {
    return { themeSource: 'system' };
  }
}

async function saveThemeSource(app, themeSource) {
  if (!THEME_SOURCES.has(themeSource)) throw new Error('无效的窗口主题模式');
  const target = preferencesPath(app);
  await fsp.mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.${process.pid}.tmp`;
  await fsp.writeFile(temp, `${JSON.stringify({ themeSource }, null, 2)}\n`, 'utf8');
  await fsp.rename(temp, target).catch(async (error) => {
    if (!['EEXIST', 'EPERM'].includes(error.code)) throw error;
    await fsp.rm(target, { force: true });
    await fsp.rename(temp, target);
  });
}

module.exports = { THEME_SOURCES, loadPreferences, saveThemeSource };
