import {
  Alert,
  Box,
  CssBaseline,
  Snackbar,
  Tab,
  Tabs,
  ThemeProvider,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { AboutPanel } from './components/AboutPanel';
import { BackupPanel } from './components/BackupPanel';
import { MaterialSymbol } from './components/MaterialSymbol';
import { ProgressDialog } from './components/ProgressDialog';
import { RestorePanel } from './components/RestorePanel';
import { TitleBar } from './components/TitleBar';
import { createAppTheme } from './theme';
import type { ComponentInfo, OperationProgress, SystemInfo } from './types/api';
import { errorMessage } from './utils';

type Notification = {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
};

export default function App() {
  const [tab, setTab] = useState(0);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [components, setComponents] = useState<ComponentInfo[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [themeSource, setThemeSource] = useState<'system' | 'light' | 'dark'>('system');
  const [scanning, setScanning] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<OperationProgress | null>(null);
  const [notification, setNotification] = useState<Notification>({
    open: false,
    message: '',
    severity: 'info',
  });
  const theme = useMemo(() => createAppTheme(darkMode ? 'dark' : 'light'), [darkMode]);

  function notify(message: string, severity: Notification['severity'] = 'info') {
    setNotification({ open: true, message, severity });
  }

  async function scan() {
    setScanning(true);
    try {
      const info = systemInfo || (await window.codexBackup.getSystemInfo());
      if (!systemInfo) {
        setSystemInfo(info);
        setDarkMode(info.darkMode);
        setThemeSource(info.themeSource);
      }
      const result = await window.codexBackup.scan({ componentIds: info.components.map((item) => item.id) });
      setComponents(result.components);
      if (result.warnings.length > 0) notify(`扫描完成，${result.warnings.length} 个被占用或不可访问的项目已跳过`, 'warning');
    } catch (error) {
      notify(errorMessage(error), 'error');
      if (systemInfo) setComponents(systemInfo.components);
    } finally {
      setScanning(false);
    }
  }

  useEffect(() => {
    scan();
    const removeProgress = window.codexBackup.onProgress((value) => setProgress(value));
    const removeTheme = window.codexBackup.onThemeChanged((state) => {
      setDarkMode(state.darkMode);
      setThemeSource(state.themeSource);
    });
    return () => {
      removeProgress();
      removeTheme();
    };
    // Initial scan intentionally runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
        <TitleBar
          themeSource={themeSource}
          onThemeSourceChange={(state) => {
            setThemeSource(state.themeSource);
            setDarkMode(state.darkMode);
          }}
        />
        <Box sx={{ display: 'flex', minHeight: 0, flex: 1 }}>
          <Box
            component="nav"
            sx={{
              width: 196,
              flexShrink: 0,
              bgcolor: 'background.paper',
              borderRight: 1,
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column',
              py: 1.5,
            }}
          >
            <Tabs
              orientation="vertical"
              value={tab}
              onChange={(_event, value) => setTab(value)}
              sx={{
                '& .MuiTabs-indicator': { left: 0, right: 'auto', width: 3 },
                '& .MuiTab-root': {
                  minHeight: 52,
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  flexDirection: 'row',
                  gap: 1.25,
                  px: 2.25,
                },
              }}
            >
              <Tab icon={<MaterialSymbol name="backup" />} iconPosition="start" label="备份" />
              <Tab icon={<MaterialSymbol name="settings_backup_restore" />} iconPosition="start" label="还原" />
              <Tab icon={<MaterialSymbol name="info" />} iconPosition="start" label="关于" />
            </Tabs>
            <Box sx={{ mt: 'auto', px: 2, pb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Electron {systemInfo?.electronVersion || '42'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                本地离线处理
              </Typography>
            </Box>
          </Box>

          <Box component="main" sx={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
            <Box sx={{ maxWidth: 1040, mx: 'auto', p: { xs: 2.5, lg: 3.5 }, pb: 6 }}>
              {tab === 0 && (
                <BackupPanel
                  components={components}
                  scanning={scanning}
                  busy={busy}
                  onRescan={scan}
                  onBusyChange={setBusy}
                  onNotify={notify}
                />
              )}
              {tab === 1 && <RestorePanel busy={busy} onBusyChange={setBusy} onNotify={notify} />}
              {tab === 2 && <AboutPanel info={systemInfo} />}
            </Box>
          </Box>
        </Box>
      </Box>

      <ProgressDialog open={busy} progress={progress} />
      <Snackbar
        open={notification.open}
        autoHideDuration={5200}
        onClose={() => setNotification((value) => ({ ...value, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setNotification((value) => ({ ...value, open: false }))}
          severity={notification.severity}
          variant="filled"
          sx={{ minWidth: 360 }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}
