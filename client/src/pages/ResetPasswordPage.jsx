// client/src/pages/ResetPasswordPage.jsx

import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Paper, Typography, TextField, Button, Alert } from '@mui/material';

function ResetPasswordPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState({ type: '', text: '' });
    const token = searchParams.get('token');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('http://localhost:3001/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            setMessage({ type: 'success', text: data.message });
            setTimeout(() => navigate('/login'), 3000);
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        }
    };

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
            <Paper sx={{ p: 4, width: '100%', maxWidth: '420px', textAlign: 'center' }}>
                <Typography variant="h5" gutterBottom>Reset Your Password</Typography>
                <Box component="form" onSubmit={handleSubmit}>
                    <TextField label="New Password" type="password" fullWidth required margin="normal" value={password} onChange={e => setPassword(e.target.value)} />
                    {message.text && <Alert severity={message.type} sx={{ mt: 2 }}>{message.text}</Alert>}
                    <Button type="submit" variant="contained" fullWidth sx={{ mt: 2, py: 1.5 }}>Set New Password</Button>
                </Box>
            </Paper>
        </Box>
    );
}

export default ResetPasswordPage;