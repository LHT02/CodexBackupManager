# Codex 备份管家

## 项目目标

- 在 Windows 上一键备份、校验、迁移和还原 Codex 配置、会话、技能、规则、记忆、插件、MCP/浏览器状态、桌面端资料及可选缓存。
- 备份产物为单个 `.cxbak` 文件，内置 Deflate 压缩；敏感备份可使用 AES-256-GCM 加密。
- 软件成品为 Electron 42 的 x64 便携式单文件 EXE，无需安装即可运行。
- UI 使用 React + MUI，遵循 Material Design 2，自动跟随 Windows 亮暗色。
- 主题色固定为 `#038387`；暗色主题下仍使用原色，不提亮。
- UI 图标使用 Material Symbols Sharp、`FILL=0`。应用图标为 `#038387` 满方形底和白色 `settings_backup_restore` 图标。

## 工作目录

- 源码：`D:\CodexBackupManager`
- 构建输出：`D:\CodexBackupManager\release`
- 已存在的旧备份目录 `D:\CODEXBACKUP` 保持不变。

## 设计记录

### 2026-08-06 初始方案

- Electron 固定到 42 系列当前补丁版 `42.8.1`。
- 备份格式：普通模式为 ZIP 兼容容器（扩展名 `.cxbak`），压缩算法 Deflate；加密模式用带版本头的容器包裹 ZIP 密文。
- 路径令牌化：使用 `%USERPROFILE%`、`%APPDATA%`、`%LOCALAPPDATA%`、`%CODEX_HOME%`，支持跨 Windows 用户还原。
- 备份前扫描文件数量和体积；备份中生成逐文件 SHA-256 清单；还原前进行结构、路径穿越和哈希校验。
- 还原支持“安全合并”和“覆盖同名文件”；覆盖前为目标文件创建单文件回滚包。
- 凭据类数据单独分类，并提示必须使用加密备份。
- 代码按发现、归档、备份、还原、IPC、UI 组件拆分，避免上帝文件。

## 当前状态

- [x] 本机数据目录盘点
- [x] 项目骨架与构建配置
- [x] 备份与还原引擎
- [x] MUI 桌面界面（含自绘单行标题栏）
- [x] 自动化测试
- [x] 便携式单文件 EXE

## 验证与产物

### 2026-08-07 最终验证

- 当前机器完整扫描：10 个组件类别，29,384 个文件，7,967,502,320 字节（约 7.42 GiB）；1 个正在占用或不可访问的插件项目被明确报告并跳过。
- `npm run check`：TypeScript 类型检查通过；4/4 Node 测试通过；Vite 生产构建通过。
- 测试覆盖：普通 ZIP 兼容 `.cxbak`、Deflate 压缩、AES-256-GCM 加密、错误密码、清单读取、跨用户令牌映射、还原和路径穿越拦截。
- `npm run smoke:electron`：开发 Electron 42.8.1 实机 UI 冒烟通过。
- `npm run smoke:packaged`：打包后的 ASAR / `win-unpacked` 实机 UI 冒烟通过，无 console error 和 page error。
- 亮色 BrowserWindow 原生背景：`#F6F8F8`；暗色：`#121414`。
- 亮色与暗色 MUI 主色均为 `rgb(3, 131, 135)`，暗色模式未提亮。
- 自定义滚动条计算值：亮色 thumb `rgb(138, 146, 146)` / track `rgb(246, 248, 248)`，悬停色由 CSS 固定为 `#038387`。
- 自绘标题栏拖拽、窗口最大化/还原、三态原生主题切换、侧栏 Sharp 图标字体均已自动验证。
- 便携 EXE 直接启动成功，主窗口标题为“Codex 备份管家”，ProductVersion 为 `1.0.0`。

### 最终产物

- 路径：`D:\CodexBackupManager\release\Codex-Backup-Manager-1.0.0-Portable.exe`
- 文件大小：108,106,891 字节（约 103.10 MiB）
- SHA-256：`BF78A7D11B0FFA0939101A93F004BEB219428EEBD6AAD8870098C04CB2292A4C`
- Authenticode：未签名；在部分 Windows 机器上首次运行可能出现 SmartScreen 提示。
- `release` 目录已整理为仅保留上述便携 EXE；`win-unpacked` 与 builder 调试信息移至被忽略的 `work\build-intermediates-final`，不作为成品。

### 2026-08-07 开源发布准备

- 目标公开仓库：`https://github.com/LHT02/CodexBackupManager`，默认分支 `main`，许可证 MIT。
- `package.json` 已补充 repository、homepage、issues、keywords 与 Node.js 版本要求。
- README 已加入 CI、Release、许可证徽章和公开下载入口。
- 新增 `CONTRIBUTING.md`、`SECURITY.md` 与 Windows GitHub Actions CI。
- `.gitignore` 明确排除 Node 依赖、构建输出、工作目录、`.cxbak`、凭据/证书和环境文件。
- `.gitattributes` 统一源码为 LF，并将 EXE、ICO、PNG、CXBAK 标记为二进制，保持跨平台检出一致。
- 发布前敏感模式扫描未发现 Token、API Key、真实 `auth.json` 或 `.codex` 用户数据。
- 公共仓库已创建并推送：`https://github.com/LHT02/CodexBackupManager`；默认分支为 `main`，首次源码提交为 `a665d135f30706ee655534243afc7db8e82107ab`。
- 仓库已启用 Issues、Discussions 和 Private vulnerability reporting，关闭 Wiki，并配置 `codex`、`backup`、`restore`、`migration`、`electron`、`windows`、`typescript`、`mui` Topics。
- 首个公开版本：`https://github.com/LHT02/CodexBackupManager/releases/tag/v1.0.0`，附件使用已验证的便携 EXE 与既有 SHA-256。
- GitHub Actions 固定使用 `windows-2022` Runner，避免 `windows-latest` 镜像在代码步骤开始前反复卡在远端“Set up job”。

### 2026-08-07 实现记录

- 品牌区直接使用 `settings_backup_restore`；自绘标题栏为单行布局，包含最小化、最大化/还原和关闭按钮。
- 应用/EXE 图标仍按要求使用 `#038387` 满方形底与白色 `settings_backup_restore`。
- 核心代码拆分为 `catalog`、`discovery`、`path-tokens`、`archive-format`、`backup-engine`、`restore-engine`、`process-guard` 和 IPC 层。
- 备份页提供精简、推荐、完整三档和逐项选择；还原页支持加密检查、安全合并、覆盖同名文件及自动回滚。
- 备份在 ZIP 写入完成后会重新解压每个项目并核对 SHA-256，源文件在备份期间变化时直接失败，不交付不一致文件。
- Electron Playwright 实机冒烟已覆盖自绘标题栏拖拽、最大化/还原、备份/还原导航、系统亮暗色切换、主题色恒定和渲染进程错误检查。
- 标题栏加入“跟随系统 / 亮色 / 暗色”窗口主题模式并持久化；主题设置同时驱动 `nativeTheme`、BrowserWindow 原生背景层和 MUI 页面，避免启动及调整大小时闪白。
- 滚动条使用亮暗自适应的自绘样式，悬停色固定为 `#038387`。
