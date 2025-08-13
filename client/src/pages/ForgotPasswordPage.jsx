// client/src/pages/ForgotPasswordPage.jsx

import { useState } from 'react';
import { Box, Paper, Typography, TextField, Button, Alert } from '@mui/material';

function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('http://localhost:3001/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await response.json();
            setMessage(data.message);
        } catch (error) {
            setMessage('An error occurred. Please try again.');
        }
    };

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
            <Paper sx={{ p: 4, width: '100%', maxWidth: '420px', textAlign: 'center' }}>
                <Typography variant="h5" gutterBottom>Forgot Password</Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>Enter your email address and we'll send you a link to reset your password.</Typography>
                <Box component="form" onSubmit={handleSubmit}>
                    <TextField label="Email Address" type="email" fullWidth required margin="normal" value={email} onChange={e => setEmail(e.target.value)} />
                    {message && <Alert severity="info" sx={{ mt: 2 }}>{message}</Alert>}
                    <Button type="submit" variant="contained" fullWidth sx={{ mt: 2, py: 1.5 }}>Send Reset Link</Button>
                </Box>
            </Paper>
        </Box>
    );
}

export default ForgotPasswordPage;