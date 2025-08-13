import { useState, useEffect, useRef } from 'react';
import { useUser } from '../contexts/UserContext'; // <-- Import the useUser hook
import { Box, Paper, Typography, TextField, Button, Grid, CircularProgress, Alert, Avatar, Badge, IconButton } from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';

// Helper function to generate avatar from name/email
function stringToColor(string) {
    let hash = 0;
    let i;
    for (i = 0; i < string.length; i += 1) {
        hash = string.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (i = 0; i < 3; i += 1) {
        const value = (hash >> (i * 8)) & 0xff;
        color += `00${value.toString(16)}`.slice(-2);
    }
    return color;
}

function SettingsPage() {
    // Get user and the global refetch function from our context
    const { user, refetchUser } = useUser(); 
    
    // Local state for form inputs and messages
    const [name, setName] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [message, setMessage] = useState({ type: '', text: '' });
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef(null);

    // When the global user object loads or changes, update the local form state
    useEffect(() => {
        if (user) {
            setName(user.name || '');
        }
    }, [user]);

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });
        setIsSaving(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/user/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            refetchUser(); // <-- Trigger a global user refresh
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handlePasswordUpdate = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });
        setIsSaving(true);
        if (!currentPassword || !newPassword) {
            setMessage({ type: 'error', text: 'Please fill out all password fields.' });
            setIsSaving(false);
            return;
        }
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/user/password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            setMessage({ type: 'success', text: 'Password updated successfully!' });
            setCurrentPassword('');
            setNewPassword('');
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleAvatarUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        setMessage({ type: '', text: '' });
        setIsSaving(true);
        const formData = new FormData();
        formData.append('avatar', file);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/user/avatar`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });
            if (!response.ok) throw new Error((await response.json()).message);
            setMessage({ type: 'success', text: 'Avatar updated!' });
            refetchUser(); // <-- Trigger a global user refresh
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
    }

    return (
        <Box sx={{ mb: 3, textAlign: 'center' }}>
            <Typography variant="h3" fontWeight="bold" sx={{ pb: 1, mb: 1, background: '#7cdff8e3', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Settings</Typography>
            <Grid container spacing={3} sx={{ maxWidth: '1600px', flexGrow: 1 }}>
                <Grid item xs={12} sx={{ width: '100%'}}>
                    <Paper elevation={0} sx={{ 
                        p: 3, 
                        border: '1px solid #7cf4f886',
                        borderRadius: 4, 
                        display: 'flex', // <-- FIX #2: Use Flexbox for centering
                        flexDirection: 'column',
                        alignItems: 'center',
                        bgcolor: 'background.paper',
                    }}>
                        <Typography variant="h6" gutterBottom color="#7cdff8e3">Profile Picture</Typography>
                        <Badge
                            overlap="circular"
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                            badgeContent={
                                <IconButton onClick={() => fileInputRef.current.click()} sx={{ bgcolor: 'background.paper', p: 0.5, border: '1px solid lightgray' }}>
                                    <EditIcon fontSize="small" />
                                </IconButton>
                            }
                        >
                            <Avatar
                                src={user.imageUrl}
                                sx={{ 
                                    width: 120, 
                                    height: 120, 
                                    mb: 2, 
                                    mx: 'auto', 
                                    fontSize: '3rem', 
                                    bgcolor: stringToColor(user.name || user.email) 
                                }}
                            >
                                {(user.name?.[0] || user.email[0])?.toUpperCase()}
                            </Avatar>
                        </Badge>
                        <input
                            type="file"
                            ref={fileInputRef}
                            hidden
                            accept="image/png, image/jpeg"
                            onChange={handleAvatarUpload}
                        />
                        <Typography variant="body2" color="text.secondary">Click the edit icon to upload a new photo.</Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={7} sx={{ width: { xs: '100%', sm: '100%', lg: '49%'} }}>
                    <Paper elevation={0} sx={{ border: '1px solid #7cf4f886', p: 3, borderRadius: 4, height: '100%' }}>
                        <Typography variant="h6" gutterBottom color="#7cdff8e3">Profile Information</Typography>
                        <Box component="form" onSubmit={handleProfileUpdate} noValidate>
                            <TextField label="Display Name" fullWidth margin="normal" value={name} onChange={e => setName(e.target.value)} />
                            <TextField label="Email Address" fullWidth margin="normal" value={user.email} disabled />
                            <Button type="submit" variant="contained" sx={{ mt: 2 }} disabled={isSaving}>
                                {isSaving ? 'Saving...' : 'Save Profile'}
                            </Button>
                        </Box>
                    </Paper>
                </Grid>
                <Grid item xs={12} sx={{width: { xs: '100%', sm: '100%', lg: '49%'}}}>
                    <Paper elevation={0} sx={{ border: '1px solid #7cf4f886', p: 3, borderRadius: 4 }}>
                        <Typography variant="h6" gutterBottom color="#7cdff8e3">Change Password</Typography>
                        <Box component="form" onSubmit={handlePasswordUpdate} noValidate>
                            <TextField label="Current Password" type="password" fullWidth margin="normal" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
                            <TextField label="New Password" type="password" fullWidth margin="normal" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                            <Button type="submit" variant="contained" sx={{ mt: 2 }} disabled={isSaving}>
                                {isSaving ? 'Updating...' : 'Update Password'}
                            </Button>
                        </Box>
                    </Paper>
                </Grid>
                {message.text && (
                    <Grid item xs={12}>
                        <Alert severity={message.type} onClose={() => setMessage({ type: '', text: '' })}>{message.text}</Alert>
                    </Grid>
                )}
            </Grid>
        </Box>
    );
}

export default SettingsPage;