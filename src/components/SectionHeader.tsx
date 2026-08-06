import { Box, Typography } from '@mui/material';
import { MaterialSymbol } from './MaterialSymbol';

export function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
      <Box
        sx={{
          width: 42,
          height: 42,
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          borderRadius: 1,
          flexShrink: 0,
        }}
      >
        <MaterialSymbol name={icon} size={25} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 500, lineHeight: 1.25 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
          {description}
        </Typography>
      </Box>
    </Box>
  );
}
