import {
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useState, type MouseEvent } from 'react';
import { MaterialSymbol } from './MaterialSymbol';

type ThemeSource = 'system' | 'light' | 'dark';

const themeOptions: Array<{ value: ThemeSource; label: string; icon: string }> = [
  { value: 'system', label: '跟随系统', icon: 'brightness_auto' },
  { value: 'light', label: '亮色', icon: 'light_mode' },
  { value: 'dark', label: '暗色', icon: 'dark_mode' },
];

export function TitleBar({
  themeSource,
  onThemeSourceChange,
}: {
  themeSource: ThemeSource;
  onThemeSourceChange: (state: { themeSource: ThemeSource; darkMode: boolean }) => void;
}) {
  const [maximized, setMaximized] = useState(false);
  const [themeAnchor, setThemeAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => window.codexBackup.onWindowState(({ maximized: value }) => setMaximized(value)), []);

  const currentTheme = themeOptions.find((option) => option.value === themeSource) || themeOptions[0];

  async function selectTheme(value: ThemeSource) {
    setThemeAnchor(null);
    const state = await window.codexBackup.setThemeSource(value);
    onThemeSourceChange(state);
  }

  return (
    <Box
      component="header"
      sx={{
        height: 52,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        userSelect: 'none',
        WebkitAppRegion: 'drag',
      }}
    >
      <Box sx={{ px: 2, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1.1, flex: 1 }}>
        <MaterialSymbol name="settings_backup_restore" size={25} style={{ color: '#038387' }} />
        <Typography
          variant="subtitle1"
          noWrap
          sx={{ fontWeight: 500, letterSpacing: 0.1, lineHeight: 1 }}
        >
          Codex 备份管家
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ ml: 0.5 }}>
          配置 · 会话 · 技能 · 完整迁移
        </Typography>
      </Box>
      <Box sx={{ height: '100%', display: 'flex', WebkitAppRegion: 'no-drag' }}>
        <Tooltip title={`窗口主题：${currentTheme.label}`}>
          <IconButton
            aria-label={`窗口主题模式：${currentTheme.label}`}
            onClick={(event: MouseEvent<HTMLElement>) => setThemeAnchor(event.currentTarget)}
            disableRipple
            sx={titleButtonSx}
          >
            <MaterialSymbol name={currentTheme.icon} size={20} />
          </IconButton>
        </Tooltip>
        <Menu
          anchorEl={themeAnchor}
          open={Boolean(themeAnchor)}
          onClose={() => setThemeAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          {themeOptions.map((option) => (
            <MenuItem
              key={option.value}
              selected={option.value === themeSource}
              onClick={() => selectTheme(option.value)}
              sx={{ minWidth: 154 }}
            >
              <ListItemIcon><MaterialSymbol name={option.icon} size={20} /></ListItemIcon>
              <ListItemText>{option.label}</ListItemText>
              {option.value === themeSource && <MaterialSymbol name="check" size={18} />}
            </MenuItem>
          ))}
        </Menu>
        <IconButton
          aria-label="最小化"
          onClick={() => window.codexBackup.controlWindow('minimize')}
          disableRipple
          sx={titleButtonSx}
        >
          <MaterialSymbol name="remove" size={20} />
        </IconButton>
        <IconButton
          aria-label={maximized ? '还原窗口' : '最大化'}
          onClick={() => window.codexBackup.controlWindow('maximize')}
          disableRipple
          sx={titleButtonSx}
        >
          <MaterialSymbol name={maximized ? 'filter_none' : 'check_box_outline_blank'} size={18} />
        </IconButton>
        <IconButton
          aria-label="关闭"
          onClick={() => window.codexBackup.controlWindow('close')}
          disableRipple
          sx={{ ...titleButtonSx, '&:hover': { bgcolor: '#c42b1c', color: '#fff' } }}
        >
          <MaterialSymbol name="close" size={20} />
        </IconButton>
      </Box>
    </Box>
  );
}

const titleButtonSx = {
  width: 48,
  height: '100%',
  borderRadius: 0,
  color: 'text.secondary',
  '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
};
