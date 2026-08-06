import { createTheme } from '@mui/material/styles';

export function createAppTheme(mode: 'light' | 'dark') {
  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#038387',
        light: '#038387',
        dark: '#038387',
        contrastText: '#FFFFFF',
      },
      background: mode === 'dark'
        ? { default: '#121414', paper: '#1C1F1F' }
        : { default: '#F6F8F8', paper: '#FFFFFF' },
      divider: mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
    },
    shape: { borderRadius: 4 },
    typography: {
      fontFamily: 'Roboto, "Microsoft YaHei UI", "Segoe UI", sans-serif',
      button: { textTransform: 'none', fontWeight: 500 },
      h5: { letterSpacing: 0 },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: 4, minHeight: 36 } },
      },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiToggleButton: {
        styleOverrides: { root: { textTransform: 'none', paddingInline: 14 } },
      },
      MuiChip: {
        styleOverrides: { root: { borderRadius: 4 } },
      },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: 4 } },
      },
    },
  });
}
