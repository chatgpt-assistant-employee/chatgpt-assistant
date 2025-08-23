// client/src/components/MainLayout.jsx

import { useState } from 'react';
import { Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, Divider, AppBar, Toolbar, IconButton, Switch, useTheme, Avatar, Menu, MenuItem } from '@mui/material';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useColorMode } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';

// Import Icons
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ChatIcon from '@mui/icons-material/Chat';
import PaymentIcon from '@mui/icons-material/Payment';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';

const drawerWidth = 260;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { text: 'Assistants', icon: <SmartToyIcon />, path: '/assistants' },
  { text: 'Chat', icon: <ChatIcon />, path: '/chat' },
  { text: 'Billing', icon: <PaymentIcon />, path: '/billing' },
  { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

function stringToColor(string) {
    let hash = 0;
    for (let i = 0; i < string.length; i += 1) {
        hash = string.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i += 1) {
        const value = (hash >> (i * 8)) & 0xff;
        color += `00${value.toString(16)}`.slice(-2);
    }
    return color;
}

function stringAvatar(name, imageUrl) {
    if (imageUrl) {
        return { src: imageUrl, sx: { width: 32, height: 32 } };
    }
    const nameParts = name ? name.split(' ') : ['?'];
    const initials = nameParts.length > 1 ? `${nameParts[0][0]}${nameParts[1][0]}` : nameParts[0][0];
    return {
        sx: { bgcolor: stringToColor(name || '?'), width: 32, height: 32, fontSize: '0.875rem' },
        children: initials.toUpperCase(),
    };
}

function MainLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const colorMode = useColorMode();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const { user, logout } = useUser();

  const handleMenuClick = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // Define the drawer styles once to be reused
  const drawerPaperStyles = {
    width: drawerWidth,
    bgcolor: 'background.paper',
    boxSizing: 'border-box',
    border: '1px solid #7cf4f886',
    borderRadius: 4,
    m: { xs: 1, sm: 2 }, // Different margins for mobile vs desktop
    height: { xs: '100dvh', sm: 'calc(100vh - 32px)' },
    
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  const drawerContent = (
    <>
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '64px', mt: 5, mb: 5 }}>
        <img src="/logo2.png" alt="App Logo" style={{ height: '100px', marginBottom: '8px', filter: 'drop-shadow(0 0 8px rgba(124, 244, 248, .45))' }} />
        <Typography variant="h5" fontWeight="bold" color="primary" sx={{mt: -1, textShadow: '0 0 8px rgba(124,244,248,.45)'}}>
          ChatGPT Assistant
        </Typography>
      </Box>
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding sx={{ px: 2, mb: 1 }}>
              <ListItemButton
                component={Link}
                to={item.path}
                selected={location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))}
                sx={{ borderRadius: 2, '&:hover': {border: '1px solid #7cf4f8ff', color: '#7cf4f8da'}, color: 'primary.main', filter: 'drop-shadow(0 0 8px rgba(124, 244, 248, .45))'}}
                onClick={mobileOpen ? handleDrawerToggle : undefined} // <-- FIX #3: Close drawer on mobile click
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
      <Box>
            <Divider sx={{ mx: 2 }} />
            <List>
                <ListItem sx={{ px: 2 }}>
                    <ListItemIcon>{theme.palette.mode === 'dark' ? '🌙' : '☀️'}</ListItemIcon>
                    <ListItemText primary="Theme" sx={{color: '#7cf4f8ff', textShadow: '0 0 8px rgba(124,244,248,.45)'}}/>
                    <Switch edge="end" onChange={colorMode.toggleColorMode} checked={theme.palette.mode === 'dark'} />
                </ListItem>
                <ListItem disablePadding sx={{ px: 2, my: 1 }}>
                    <ListItemButton onClick={handleMenuClick} sx={{ borderRadius: 2, bgcolor: '#7cdff8b7', color: 'black', '&:hover': {bgcolor: '#7cdff8de'} }}>
                        <ListItemIcon>
                            <Avatar {...stringAvatar(user.name || user.email, user.imageUrl)} />
                        </ListItemIcon>
                        <ListItemText primary={user.name || user.email.split('@')[0]} sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} />
                    </ListItemButton>
                </ListItem>
            </List>
        </Box>
    </>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        sx={{ display: { sm: 'none' } }} // Only display AppBar on mobile
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            disableRipple
            disableFocusRipple
            sx={{
              outline: 'none',
              '&:focus': { outline: 'none' },
              '&:focus-visible': { outline: 'none' },
              '& .MuiTouchRipple-root': { display: 'none' },
            }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            ChatGPT Assistant
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        {/* Mobile Drawer (temporary, hidden by default) */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': drawerPaperStyles, // <-- FIX #1: Apply rounded styles here
          }}
        >
          {drawerContent}
        </Drawer>
        
        {/* Desktop Drawer (permanent, always visible) */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': drawerPaperStyles, // <-- FIX #1: Apply rounded styles here too
          }}
          open
        >
          {drawerContent}
        </Drawer>
        <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleMenuClose}
                onClick={handleMenuClose}
                PaperProps={{
                    elevation: 0,
                    sx: {
                        overflow: 'visible',
                        filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.2))',
                        mt: -7, // Position it higher
                        ml: 1,
                        borderRadius: 2,
                        width: 300, // Make it wider
                        '& .MuiAvatar-root': { width: 48, height: 48, mb: 1.5, },
                        bgcolor: '#6186a1ff',                   },
                }}
                transformOrigin={{ horizontal: 'left', vertical: 'bottom' }}
                anchorOrigin={{ horizontal: 'left', vertical: 'top' }}
            >
                <Box sx={{ px: 2, py: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Avatar {...stringAvatar(user.name || user.email, user.imageUrl)} sx={{ width: 64, height: 64, fontSize: '2rem', mb: 1 }} />
                    <Typography variant="h6">{user.name || 'User'}</Typography>
                    <Typography variant="body2" color="text.secondary">{user.email}</Typography>
                </Box>
                <Divider />
                <MenuItem onClick={logout} sx={{ my: 1, mx: 1, borderRadius: 1 }}> {/* <-- Use logout from context */}
                    <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
                    Logout
                </MenuItem>
            </Menu>
      </Box>
      
      <Box
        component="main"
        sx={{ 
          flexGrow: 1, 
          p: 3, 
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          overflowX: 'hidden' // <-- FIX #2: Prevent horizontal scrolling
          
        }}
      >
        <Toolbar sx={{ display: { sm: 'none' } }} /> {/* Spacer for mobile app bar */}
        <Outlet />
      </Box>
    </Box>
  );
}

export default MainLayout;