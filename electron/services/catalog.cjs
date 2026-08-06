const path = require('node:path');

const COMPONENTS = [
  {
    id: 'settings',
    name: '配置与全局状态',
    description: '模型、功能开关、全局界面状态和安装标识',
    icon: 'tune',
    recommended: true,
    locations: [
      {
        token: 'CODEX_HOME',
        names: [
          'config.toml',
          '.codex-global-state.json',
          '.codex-global-state.json.bak',
          'models_cache.json',
          'installation_id',
          'cap_sid',
          '.personality_migration',
          '.sandbox_migration',
          '.app-server-state-reconciled-v1',
          'external_agent_session_imports.json',
        ],
      },
    ],
  },
  {
    id: 'sessions',
    name: '会话、任务与运行状态',
    description: '完整会话记录、索引、任务状态、目标数据库和历史',
    icon: 'forum',
    recommended: true,
    locations: [
      { token: 'CODEX_HOME', names: ['sessions', 'sqlite', 'session_index.jsonl', 'history.jsonl'] },
      { token: 'CODEX_HOME', topLevelPattern: /^(state|goals)_\d+\.sqlite(?:-(?:shm|wal))?$/i },
    ],
  },
  {
    id: 'customization',
    name: '技能、规则、记忆与个性化',
    description: 'Skills、Rules、Memories、Pets、AGENTS.md 和导入内容',
    icon: 'psychology',
    recommended: true,
    locations: [
      {
        token: 'CODEX_HOME',
        names: ['skills', 'rules', 'memories', 'vendor_imports', 'pets', 'ambient-suggestions', 'AGENTS.md'],
      },
      { token: 'CODEX_HOME', topLevelPattern: /^memories_\d+\.sqlite(?:-(?:shm|wal))?$/i },
    ],
  },
  {
    id: 'plugins',
    name: '插件与本地扩展',
    description: '已安装插件、插件缓存及浏览器原生主机配置',
    icon: 'extension',
    recommended: true,
    locations: [
      { token: 'CODEX_HOME', names: ['plugins', 'chrome-native-hosts-v2.json'] },
    ],
  },
  {
    id: 'artifacts',
    name: '附件与生成内容',
    description: '附件、生成图片、可视化、听写和转录历史',
    icon: 'attachment',
    recommended: true,
    locations: [
      {
        token: 'CODEX_HOME',
        names: [
          'attachments',
          'generated_images',
          'visualizations',
          'dictation-history',
          'transcription-history.jsonl',
        ],
      },
    ],
  },
  {
    id: 'integrations',
    name: 'MCP、浏览器与工具状态',
    description: '浏览器控制、Computer Use、MCP OAuth 锁和进程工具状态',
    icon: 'hub',
    recommended: true,
    locations: [
      {
        token: 'CODEX_HOME',
        names: ['browser', 'computer-use', 'mcp-oauth-locks', 'node_repl', 'process_manager'],
      },
    ],
  },
  {
    id: 'credentials',
    name: '登录凭据',
    description: 'Codex 登录令牌；跨设备还原可能需要重新登录',
    icon: 'key',
    recommended: false,
    sensitive: true,
    requiresEncryption: true,
    locations: [{ token: 'CODEX_HOME', names: ['auth.json'] }],
  },
  {
    id: 'desktop-profile',
    name: '桌面端用户资料',
    description: 'Codex 桌面端 Chromium 用户数据，排除可重建缓存',
    icon: 'desktop_windows',
    recommended: true,
    sensitive: true,
    excludeCaches: true,
    locations: [
      { token: 'APPDATA', names: ['Codex'] },
      { token: 'LOCALAPPDATA', names: ['Codex'] },
      { token: 'LOCALAPPDATA', names: [path.join('OpenAI', 'Codex')] },
    ],
  },
  {
    id: 'editor-integrations',
    name: '编辑器集成状态',
    description: 'VS Code、Cursor 等编辑器中的 OpenAI/Codex 扩展数据',
    icon: 'code',
    recommended: true,
    locations: [
      { token: 'APPDATA', names: [path.join('Code', 'User', 'globalStorage', 'openai.chatgpt')] },
      { token: 'APPDATA', names: [path.join('Cursor', 'User', 'globalStorage', 'openai.chatgpt')] },
      { token: 'LOCALAPPDATA', names: [path.join('OpenAI', 'extension')] },
    ],
  },
  {
    id: 'diagnostics',
    name: '日志、沙箱与缓存',
    description: '诊断日志、临时沙箱和可重建缓存；体积可能很大',
    icon: 'troubleshoot',
    recommended: false,
    locations: [
      { token: 'CODEX_HOME', names: ['.sandbox', '.sandbox-bin', '.tmp', 'tmp', 'cache', 'thread-writer-locks'] },
      { token: 'CODEX_HOME', topLevelPattern: /^logs_\d+\.sqlite(?:-(?:shm|wal))?$/i },
    ],
  },
];

const COMPONENT_MAP = new Map(COMPONENTS.map((component) => [component.id, component]));

module.exports = { COMPONENTS, COMPONENT_MAP };
