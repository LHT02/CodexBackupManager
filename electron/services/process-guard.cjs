const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

async function findRunningCodexProcesses() {
  if (process.platform !== 'win32') return [];
  try {
    const { stdout } = await execFileAsync('tasklist.exe', ['/FO', 'CSV', '/NH'], {
      windowsHide: true,
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
    return stdout
      .split(/\r?\n/)
      .map((line) => /^"([^"]+)","(\d+)"/.exec(line))
      .filter(Boolean)
      .map((match) => ({ name: match[1], pid: Number(match[2]) }))
      .filter((item) => /^codex(?:\.exe)?$/i.test(item.name) && item.pid !== process.pid);
  } catch {
    return [];
  }
}

module.exports = { findRunningCodexProcesses };
