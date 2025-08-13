// client/src/contexts/ThemeContext.jsx

import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

export const ColorModeContext = createContext({
  toggleColorMode: () => {},
  setMode: () => {},
  forceDark: () => {},
  mode: 'dark'
});

export const useColorMode = () => {
    return useContext(ColorModeContext);
};