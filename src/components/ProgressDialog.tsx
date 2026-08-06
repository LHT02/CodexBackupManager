import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Typography,
} from '@mui/material';
import type { OperationProgress } from '../types/api';
import { formatBytes } from '../utils';
import { MaterialSymbol } from './MaterialSymbol';

export function ProgressDialog({ open, progress }: { open: boolean; progress: OperationProgress | null }) {
  const completed = progress?.totalBytes ? progress.bytes : progress?.completed;
  const total = progress?.totalBytes || progress?.total;
  const percent = completed != null && total ? Math.min(100, (completed / total) * 100) : undefined;

  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <MaterialSymbol name="sync" className="spin" style={{ color: '#038387' }} />
        正在处理
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1.5, minHeight: 21 }} noWrap>
          {progress?.message || '正在准备…'}
        </Typography>
        <LinearProgress variant={percent == null ? 'indeterminate' : 'determinate'} value={percent} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {progress?.phase || 'prepare'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {percent != null ? `${percent.toFixed(0)}%` : ''}
            {progress?.bytes != null ? ` · ${formatBytes(progress.bytes)}` : ''}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => window.codexBackup.cancelOperation()} startIcon={<MaterialSymbol name="cancel" />}>
          取消
        </Button>
      </DialogActions>
    </Dialog>
  );
}
