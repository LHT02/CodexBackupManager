import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import type { BackupInspection, RestoreResult } from '../types/api';
import { errorMessage, formatBytes, formatDate } from '../utils';
import { MaterialSymbol } from './MaterialSymbol';
import { SectionHeader } from './SectionHeader';

type Props = {
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onNotify: (message: string, severity?: 'success' | 'error' | 'info' | 'warning') => void;
};

export function RestorePanel({ busy, onBusyChange, onNotify }: Props) {
  const [filePath, setFilePath] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [inspection, setInspection] = useState<BackupInspection | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<'merge' | 'overwrite'>('merge');
  const [createRollback, setCreateRollback] = useState(true);
  const [result, setResult] = useState<RestoreResult | null>(null);

  async function inspect(targetPath: string, secret = password) {
    onBusyChange(true);
    setResult(null);
    try {
      const value = await window.codexBackup.inspectBackup({ filePath: targetPath, password: secret || undefined });
      setInspection(value);
      setSelected(value.components?.map((component) => component.id) || []);
      if (!value.requiresPassword) onNotify('备份结构检查通过', 'success');
    } catch (error) {
      setInspection(null);
      onNotify(errorMessage(error), 'error');
    } finally {
      onBusyChange(false);
    }
  }

  async function chooseFile() {
    const chosen = await window.codexBackup.chooseRestoreInput();
    if (!chosen) return;
    setFilePath(chosen);
    setPassword('');
    setInspection(null);
    await inspect(chosen, '');
  }

  async function startRestore() {
    if (!inspection || inspection.requiresPassword) return;
    if (selected.length === 0) return onNotify('请至少选择一个还原项目', 'warning');
    onBusyChange(true);
    setResult(null);
    try {
      const value = await window.codexBackup.restoreBackup({
        filePath,
        password: inspection.encrypted ? password : undefined,
        componentIds: selected,
        mode,
        createRollback,
      });
      setResult(value);
      onNotify(value.restoredFiles > 0 ? '还原与逐文件校验完成' : '没有文件需要更新', 'success');
    } catch (error) {
      onNotify(errorMessage(error), 'error');
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        icon="settings_backup_restore"
        title="校验并还原"
        description="读取 .cxbak 清单，映射到当前 Windows 用户目录，并在覆盖前自动生成回滚包。"
      />

      <Alert severity="info" variant="outlined" icon={<MaterialSymbol name="info" />}>
        开始还原前请关闭 Codex 桌面端和正在运行的 Codex CLI。软件会检测进程并阻止不安全覆盖。
      </Alert>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>备份文件</Typography>
        <Stack direction="row" sx={{ mt: 1.5, gap: 1.25 }}>
          <TextField fullWidth size="small" value={filePath} placeholder="选择 .cxbak 单文件备份" slotProps={{ input: { readOnly: true } }} />
          <Button variant="outlined" onClick={chooseFile} disabled={busy} startIcon={<MaterialSymbol name="folder_open" />}>
            浏览
          </Button>
        </Stack>

        {inspection?.requiresPassword && (
          <Stack direction="row" sx={{ mt: 1.5, gap: 1.25 }}>
            <TextField
              fullWidth
              size="small"
              type={showPassword ? 'text' : 'password'}
              label="加密备份密码"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && inspect(filePath)}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword((value) => !value)} edge="end">
                        <MaterialSymbol name={showPassword ? 'visibility_off' : 'visibility'} />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Button variant="contained" onClick={() => inspect(filePath)} disabled={password.length === 0 || busy}>
              解密检查
            </Button>
          </Stack>
        )}
      </Paper>

      {inspection && !inspection.requiresPassword && (
        <>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, justifyContent: 'space-between' }}>
              <Box>
                <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                  <MaterialSymbol name="verified" style={{ color: '#038387' }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>备份清单有效</Typography>
                  {inspection.encrypted && <Chip size="small" color="success" variant="outlined" label="AES-256 加密" />}
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  创建于 {formatDate(inspection.createdAt)} · {inspection.source?.hostname || '未知设备'} · {inspection.source?.arch}
                </Typography>
              </Box>
              <Box sx={{ textAlign: { md: 'right' } }}>
                <Typography variant="h6">{formatBytes(inspection.totals?.bytes || 0)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {(inspection.totals?.files || 0).toLocaleString()} 个文件 · 备份文件 {formatBytes(inspection.fileBytes)}
                </Typography>
              </Box>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>选择还原内容</Typography>
            <Box className="restore-component-grid" sx={{ mt: 1.5 }}>
              {inspection.components?.map((component) => (
                <FormControlLabel
                  key={component.id}
                  control={
                    <Checkbox
                      checked={selected.includes(component.id)}
                      onChange={(event) => setSelected((current) =>
                        event.target.checked
                          ? [...new Set([...current, component.id])]
                          : current.filter((id) => id !== component.id),
                      )}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2">{component.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {component.files.toLocaleString()} 个文件 · {formatBytes(component.bytes)}
                      </Typography>
                    </Box>
                  }
                  sx={{ m: 0, p: 1, border: 1, borderColor: 'divider' }}
                />
              ))}
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>还原策略</Typography>
            <RadioGroup row value={mode} onChange={(event) => setMode(event.target.value as 'merge' | 'overwrite')} sx={{ mt: 0.75 }}>
              <FormControlLabel value="merge" control={<Radio />} label="安全合并（跳过较新的本机文件）" />
              <FormControlLabel value="overwrite" control={<Radio />} label="覆盖同名文件" />
            </RadioGroup>
            <FormControlLabel
              control={<Switch checked={createRollback} onChange={(event) => setCreateRollback(event.target.checked)} />}
              label="覆盖前自动创建单文件回滚包（推荐）"
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
              <Button
                variant="contained"
                color="primary"
                size="large"
                disabled={busy || selected.length === 0}
                onClick={startRestore}
                startIcon={<MaterialSymbol name="settings_backup_restore" />}
              >
                开始还原
              </Button>
            </Box>
          </Paper>
        </>
      )}

      {result && (
        <Alert severity="success" icon={<MaterialSymbol name="task_alt" />}>
          <Typography variant="subtitle2">已还原 {result.restoredFiles.toLocaleString()} 个文件（{formatBytes(result.restoredBytes)}）</Typography>
          <Typography variant="body2">跳过 {result.skipped.length.toLocaleString()} 个本机较新文件。</Typography>
          {result.pathMigration && result.pathMigration.replacements > 0 && (
            <Typography variant="body2">
              已将 {result.pathMigration.replacements.toLocaleString()} 处旧用户路径迁移到当前用户
              （{result.pathMigration.files.toLocaleString()} 个文本文件、
              {result.pathMigration.databases.toLocaleString()} 个数据库）。
            </Typography>
          )}
          {result.rollback && (
            <Button size="small" sx={{ mt: 0.5 }} onClick={() => window.codexBackup.showItem(result.rollback!.destination)}>
              查看自动回滚包
            </Button>
          )}
        </Alert>
      )}
    </Stack>
  );
}
