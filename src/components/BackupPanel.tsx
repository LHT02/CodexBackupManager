import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BackupResult, ComponentInfo } from '../types/api';
import { errorMessage, formatBytes } from '../utils';
import { ComponentCard } from './ComponentCard';
import { MaterialSymbol } from './MaterialSymbol';
import { SectionHeader } from './SectionHeader';

type Props = {
  components: ComponentInfo[];
  scanning: boolean;
  busy: boolean;
  onRescan: () => Promise<void>;
  onBusyChange: (busy: boolean) => void;
  onNotify: (message: string, severity?: 'success' | 'error' | 'info' | 'warning') => void;
};

const CORE_IDS = ['settings', 'sessions', 'customization', 'plugins'];

export function BackupPanel({
  components,
  scanning,
  busy,
  onRescan,
  onBusyChange,
  onNotify,
}: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [preset, setPreset] = useState<'core' | 'recommended' | 'full'>('recommended');
  const [encrypt, setEncrypt] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [compressionLevel, setCompressionLevel] = useState(9);
  const [destination, setDestination] = useState('');
  const [result, setResult] = useState<BackupResult | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || components.length === 0) return;
    initialized.current = true;
    setSelected(components.filter((item) => item.recommended && item.available !== false).map((item) => item.id));
  }, [components]);

  const selectedComponents = useMemo(
    () => components.filter((component) => selected.includes(component.id)),
    [components, selected],
  );
  const selectedBytes = selectedComponents.reduce((sum, item) => sum + (item.bytes || 0), 0);
  const selectedFiles = selectedComponents.reduce((sum, item) => sum + (item.files || 0), 0);
  const hasSensitive = selectedComponents.some((item) => item.sensitive);
  const requiresEncryption = selectedComponents.some((item) => item.requiresEncryption);

  function applyPreset(next: 'core' | 'recommended' | 'full') {
    setPreset(next);
    const available = components.filter((item) => item.available !== false);
    if (next === 'core') setSelected(available.filter((item) => CORE_IDS.includes(item.id)).map((item) => item.id));
    if (next === 'recommended') setSelected(available.filter((item) => item.recommended).map((item) => item.id));
    if (next === 'full') setSelected(available.map((item) => item.id));
  }

  function toggleComponent(id: string, value: boolean) {
    setPreset('recommended');
    setSelected((current) => (value ? [...new Set([...current, id])] : current.filter((item) => item !== id)));
    const component = components.find((item) => item.id === id);
    if (value && component?.requiresEncryption) setEncrypt(true);
  }

  async function chooseDestination() {
    const chosen = await window.codexBackup.chooseBackupOutput();
    if (chosen) setDestination(chosen);
    return chosen;
  }

  async function startBackup() {
    if (selected.length === 0) return onNotify('请至少选择一个备份项目', 'warning');
    if (requiresEncryption && !encrypt) return onNotify('登录凭据必须使用加密备份', 'warning');
    if (encrypt && password.length < 8) return onNotify('加密密码至少需要 8 个字符', 'warning');
    const target = destination || (await chooseDestination());
    if (!target) return;
    setResult(null);
    onBusyChange(true);
    try {
      const backupResult = await window.codexBackup.createBackup({
        destination: target,
        componentIds: selected,
        encrypt,
        password: encrypt ? password : undefined,
        compressionLevel,
      });
      setDestination(target);
      setResult(backupResult);
      onNotify('单文件备份创建并校验完成', 'success');
    } catch (error) {
      onNotify(errorMessage(error), 'error');
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        icon="archive"
        title="创建单文件备份"
        description="扫描本机 Codex 数据，压缩为可校验、可加密、可跨用户迁移的 .cxbak 文件。"
      />

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>备份范围</Typography>
            <Typography variant="body2" color="text.secondary">
              已选 {selectedFiles.toLocaleString()} 个文件，原始体积 {formatBytes(selectedBytes)}
            </Typography>
          </Box>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={preset}
              onChange={(_event, value) => value && applyPreset(value)}
              aria-label="备份范围预设"
            >
              <ToggleButton value="core">精简</ToggleButton>
              <ToggleButton value="recommended">推荐</ToggleButton>
              <ToggleButton value="full">完整</ToggleButton>
            </ToggleButtonGroup>
            <Tooltip title="重新扫描">
              <span>
                <IconButton disabled={scanning || busy} onClick={onRescan} aria-label="重新扫描">
                  <MaterialSymbol name="refresh" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        <Box className="component-grid" sx={{ mt: 2 }}>
          {components.map((component) => (
            <ComponentCard
              key={component.id}
              component={component}
              selected={selected.includes(component.id)}
              disabled={component.available === false || busy}
              onChange={(value) => toggleComponent(component.id, value)}
            />
          ))}
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>压缩与安全</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 1.5, alignItems: { md: 'center' } }}>
          <Select
            size="small"
            value={compressionLevel}
            onChange={(event) => setCompressionLevel(Number(event.target.value))}
            sx={{ minWidth: 190 }}
          >
            <MenuItem value={6}>标准压缩（较快）</MenuItem>
            <MenuItem value={9}>最大压缩（推荐）</MenuItem>
            <MenuItem value={0}>仅打包（不压缩）</MenuItem>
          </Select>
          <FormControlLabel
            control={<Switch checked={encrypt} onChange={(event) => setEncrypt(event.target.checked)} />}
            label="AES-256 加密"
          />
          {encrypt && (
            <TextField
              size="small"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              label="备份密码（至少 8 位）"
              autoComplete="new-password"
              sx={{ minWidth: 260, flex: 1 }}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword((value) => !value)} edge="end" aria-label="显示密码">
                        <MaterialSymbol name={showPassword ? 'visibility_off' : 'visibility'} />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          )}
        </Stack>
        {hasSensitive && !encrypt && (
          <Alert severity="warning" variant="outlined" sx={{ mt: 1.5 }}>
            当前范围包含登录或桌面端用户资料。未加密备份可以被普通 ZIP 工具读取，建议开启 AES-256 加密。
          </Alert>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>保存位置</Typography>
        <Stack direction="row" sx={{ mt: 1.5, gap: 1.25 }}>
          <TextField
            fullWidth
            size="small"
            value={destination}
            placeholder="点击右侧按钮选择 .cxbak 文件位置"
            slotProps={{ input: { readOnly: true } }}
          />
          <Button variant="outlined" onClick={chooseDestination} disabled={busy} startIcon={<MaterialSymbol name="folder_open" />}>
            选择
          </Button>
          <Button
            variant="contained"
            onClick={startBackup}
            disabled={busy || scanning || selected.length === 0}
            startIcon={<MaterialSymbol name="backup" />}
            sx={{ minWidth: 132 }}
          >
            开始备份
          </Button>
        </Stack>
      </Paper>

      {result && (
        <Alert severity="success" icon={<MaterialSymbol name="verified" />}>
          <Stack spacing={0.5}>
            <Typography variant="subtitle2">备份已完成：{formatBytes(result.outputBytes)}</Typography>
            <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>SHA-256：{result.outputSha256}</Typography>
            <Divider sx={{ my: 0.5 }} />
            <Box><Button size="small" onClick={() => window.codexBackup.showItem(result.destination)}>在资源管理器中显示</Button></Box>
          </Stack>
        </Alert>
      )}
    </Stack>
  );
}
