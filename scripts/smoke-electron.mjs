import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright-core';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workDirectory = path.join(projectRoot, 'work', 'playwright');
await mkdir(workDirectory, { recursive: true });

const executableArgument = process.argv[2];
const electronPath = executableArgument
  ? path.resolve(projectRoot, executableArgument)
  : path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const launchArguments = executableArgument ? [] : [projectRoot];
const consoleErrors = [];
const pageErrors = [];
const app = await electron.launch({
  executablePath: electronPath,
  args: launchArguments,
  cwd: projectRoot,
  env: { ...process.env, NODE_ENV: 'production' },
  timeout: 30000,
});

try {
  const page = await app.firstWindow();
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.waitForLoadState('domcontentloaded');
  await page.getByText('创建单文件备份').waitFor({ state: 'visible' });
  await page.getByText('Electron 42.8.1').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: /窗口主题模式/ }).click();
  await page.getByRole('menuitem', { name: /亮色/ }).click();
  await page.waitForFunction(() => getComputedStyle(document.body).backgroundColor === 'rgb(246, 248, 248)');

  const titleBar = page.locator('header');
  const titleBarRegion = await titleBar.evaluate((element) => getComputedStyle(element).getPropertyValue('-webkit-app-region'));
  const brandIcon = await titleBar.locator('.material-symbols-sharp').first().textContent();
  const primaryButton = page.getByRole('button', { name: '开始备份' });
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.includes('开始备份'));
    return button && !button.hasAttribute('disabled');
  }, null, { timeout: 30000 });
  const sectionIcon = page.locator('.material-symbols-sharp').filter({ hasText: /^archive$/ }).first();
  const lightPrimaryColor = await sectionIcon.locator('..').evaluate((element) => getComputedStyle(element).backgroundColor);
  const lightWindowBackground = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBackgroundColor());
  const scrollbarColor = await page.locator('main').evaluate((element) => getComputedStyle(element).scrollbarColor);
  const navigationIcons = await page.locator('nav .material-symbols-sharp').evaluateAll((elements) =>
    elements.map((element) => ({
      text: element.textContent?.trim(),
      fontFamily: getComputedStyle(element).fontFamily,
      width: element.getBoundingClientRect().width,
    })),
  );
  await page.screenshot({ path: path.join(workDirectory, 'ui-light.png'), fullPage: true });

  await page.getByRole('button', { name: '最大化' }).click();
  await page.waitForTimeout(150);
  const maximized = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized());
  await page.getByRole('button', { name: '还原窗口' }).click();

  await page.getByRole('tab', { name: '还原' }).click();
  await page.getByText('校验并还原').waitFor({ state: 'visible' });
  await page.screenshot({ path: path.join(workDirectory, 'ui-restore.png'), fullPage: true });

  await page.getByRole('button', { name: /窗口主题模式/ }).click();
  await page.getByRole('menuitem', { name: /暗色/ }).click();
  await page.waitForFunction(() => getComputedStyle(document.body).backgroundColor === 'rgb(18, 20, 20)');
  const darkBackground = await page.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor);
  const darkWindowBackground = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBackgroundColor());
  await page.getByRole('tab', { name: '备份' }).click();
  const darkPrimaryColor = await sectionIcon.locator('..').evaluate((element) => getComputedStyle(element).backgroundColor);
  await page.screenshot({ path: path.join(workDirectory, 'ui-dark.png'), fullPage: true });
  await page.getByRole('button', { name: /窗口主题模式/ }).click();
  await page.getByRole('menuitem', { name: /跟随系统/ }).click();

  const result = {
    title: await page.title(),
    titleBarRegion,
    brandIcon: brandIcon?.trim(),
    maximized,
    lightPrimaryColor,
    lightWindowBackground,
    darkPrimaryColor,
    darkBackground,
    darkWindowBackground,
    scrollbarColor,
    navigationIcons,
    consoleErrors,
    pageErrors,
  };
  await writeFile(path.join(workDirectory, 'smoke-result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  if (result.title !== 'Codex 备份管家') throw new Error(`Unexpected title: ${result.title}`);
  if (result.titleBarRegion !== 'drag') throw new Error('Custom title bar is not draggable');
  if (result.brandIcon !== 'settings_backup_restore') throw new Error('Brand icon is incorrect');
  if (!result.maximized) throw new Error('Custom maximize button did not maximize the window');
  if (result.lightPrimaryColor !== 'rgb(3, 131, 135)') throw new Error(`Unexpected light primary: ${result.lightPrimaryColor}`);
  if (result.darkPrimaryColor !== 'rgb(3, 131, 135)') throw new Error(`Dark theme changed primary: ${result.darkPrimaryColor}`);
  if (result.lightWindowBackground.toLowerCase() !== '#f6f8f8') throw new Error(`Light BrowserWindow background mismatch: ${result.lightWindowBackground}`);
  if (result.darkWindowBackground.toLowerCase() !== '#121414') throw new Error(`Dark BrowserWindow background mismatch: ${result.darkWindowBackground}`);
  if (!result.scrollbarColor.includes('rgb')) throw new Error(`Custom scrollbar color missing: ${result.scrollbarColor}`);
  if (navigationIcons.some((icon) => !icon.fontFamily.includes('Material Symbols Sharp') || icon.width > 40)) {
    throw new Error('Navigation icon font was overridden');
  }
  if (consoleErrors.length || pageErrors.length) throw new Error('Renderer logged errors; inspect smoke-result.json');
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await app.close();
}
