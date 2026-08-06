import { Alert, Box, Chip, Paper, Stack, Typography } from '@mui/material';
import type { SystemInfo } from '../types/api';
import { MaterialSymbol } from './MaterialSymbol';
import { SectionHeader } from './SectionHeader';

export function AboutPanel({ info }: { info: SystemInfo | null }) {
  const features = [
    ['folder_zip', '单文件压缩', 'ZIP64 + Deflate，普通备份也可由通用 ZIP 工具读取。'],
    ['encrypted', '可选强加密', 'scrypt 密钥派生与 AES-256-GCM 完整性认证。'],
    ['verified_user', '安全还原', '路径越界拦截、逐文件 SHA-256、原子替换与自动回滚。'],
    ['move_down', '跨用户迁移', '用户目录令牌化，不把旧电脑用户名写死到目标路径。'],
  ];
  return (
    <Stack spacing={2.5}>
      <SectionHeader icon="info" title="关于与格式说明" description="为 Windows Codex 桌面端与 CLI 设计的本地离线迁移工具。" />
      <Box className="about-grid">
        {features.map(([icon, title, description]) => (
          <Paper key={title} variant="outlined" sx={{ p: 2 }}>
            <MaterialSymbol name={icon} size={27} style={{ color: '#038387' }} />
            <Typography variant="subtitle1" sx={{ mt: 1, fontWeight: 500 }}>{title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{description}</Typography>
          </Paper>
        ))}
      </Box>
      <Alert severity="warning" variant="outlined">
        登录令牌和 Chromium Cookie 可能受 Windows DPAPI 及设备状态约束；即使文件完整还原，换机后仍可能需要重新登录。
      </Alert>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>运行环境</Typography>
        <Stack direction="row" sx={{ mt: 1.25, gap: 1, flexWrap: 'wrap' }}>
          <Chip label={`Codex 备份管家 ${info?.appVersion || '—'}`} />
          <Chip label={`Electron ${info?.electronVersion || '42'}`} />
          <Chip label={`${info?.platform || 'win32'} ${info?.arch || 'x64'}`} />
          <Chip label="Material Design 2" />
          <Chip label="#038387" sx={{ bgcolor: '#038387', color: '#fff' }} />
        </Stack>
      </Paper>
    </Stack>
  );
}
