import { Box, Checkbox, Chip, Paper, Typography } from '@mui/material';
import type { ComponentInfo } from '../types/api';
import { formatBytes } from '../utils';
import { MaterialSymbol } from './MaterialSymbol';

export function ComponentCard({
  component,
  selected,
  disabled,
  onChange,
}: {
  component: ComponentInfo;
  selected: boolean;
  disabled?: boolean;
  onChange: (selected: boolean) => void;
}) {
  return (
    <Paper
      variant="outlined"
      onClick={() => !disabled && onChange(!selected)}
      sx={{
        p: 1.5,
        minHeight: 92,
        display: 'flex',
        gap: 1.25,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? 'rgba(3, 131, 135, 0.08)' : 'background.paper',
        transition: 'border-color 120ms, background-color 120ms',
        '&:hover': disabled ? undefined : { borderColor: 'primary.main' },
      }}
    >
      <Checkbox
        checked={selected}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        onClick={(event) => event.stopPropagation()}
        sx={{ alignSelf: 'flex-start', p: 0.25 }}
      />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
          <MaterialSymbol name={component.icon} size={20} style={{ color: '#038387' }} />
          <Typography variant="subtitle2" noWrap sx={{ fontWeight: 500 }}>
            {component.name}
          </Typography>
          {component.sensitive && <Chip size="small" label="敏感" color="warning" variant="outlined" />}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.45, lineHeight: 1.35 }}>
          {component.description}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', mt: 0.65, color: 'text.primary' }}>
          {component.available === false
            ? '当前未发现数据'
            : `${component.files?.toLocaleString() ?? '—'} 个文件 · ${formatBytes(component.bytes ?? 0)}`}
        </Typography>
      </Box>
    </Paper>
  );
}
