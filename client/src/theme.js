import { createTheme } from '@mui/material/styles';

// These settings are shared between both light and dark modes
const commonSettings = {
  typography: {
    fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif',
    h4: {
      fontWeight: 700,
    },
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12, // Rounded corners for cards
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8, // Rounded corners for buttons
          fontWeight: 600,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.05)',
          borderRadius: 16,
        },
      },
    },
  },
};

// This function returns the appropriate theme based on the selected mode
export const getDesignTokens = (mode) => ({
  ...commonSettings, // Start with the common settings
  palette: {
    mode, // This is either 'light' or 'dark'
    ...(mode === 'light'
      // --- Your Existing Light Theme Palette (Unchanged) ---
      ? {
          primary: {
            main: '#7e57c2',
          },
          secondary: {
            main: '#ab47bc',
          },
          background: {
            default: '#f4f7f6',
            paper: '#ffffff',
            tick: '#000000'
          },
        }
      // --- New, Professional Dark Theme Palette ---
      : {
          primary: {
            main: '#7cdff8e3', // A slightly lighter purple for dark backgrounds
          },
          secondary: {
            main: '#3e7988e3',
          },
          divider: 'rgba(255, 255, 255, 0.12)',
          background: {
            default: '#0c1319a4', // A standard, deep charcoal for the background
            paper: '#0a111756',   // A slightly lighter gray for cards and surfaces
            tick: '#7cf4f8',
            mPaper: '#0a1117ff',
          },
          text: {
            primary: '#d3ceceff',   // Soft off-white for primary text (easy on the eyes)
            secondary: 'rgba(255, 255, 255, 0.7)', // Lighter gray for secondary text
          },
        }),
  },
});