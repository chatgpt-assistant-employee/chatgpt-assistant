// client/src/pages/VerifyEmailPage.jsx

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Paper, Typography, CircularProgress, Alert, Button } from '@mui/material';
import { useUser } from '../contexts/UserContext';

function VerifyEmailPage() {
    const [searchParams] = useSearchParams();
    const { refetchUser } = useUser();
    const navigate = useNavigate();
    const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error'
    const [message, setMessage] = useState('');

    useEffect(() => {
        const token = searchParams.get('token');
        if (!token) {
            setStatus('error');
            setMessage('No verification token found. Please check your link.');
            return;
        }

        const verifyToken = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/verify-email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ token }),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                
                setStatus('success');
                setMessage(data.message);
                await refetchUser(); // Refresh the global user state
                setTimeout(() => navigate('/'), 3000); // Redirect to dashboard after 3s

            } catch (error) {
                setStatus('error');
                setMessage(error.message);
            }
        };
        verifyToken();
    }, [searchParams, refetchUser, navigate]);

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <Paper sx={{ p: 4, textAlign: 'center' }}>
                {status === 'verifying' && <CircularProgress />}
                <Typography variant="h5" sx={{ mt: 2 }}>
                    {status === 'verifying' && 'Verifying Your Email...'}
                    {status === 'success' && 'Verification Successful!'}
                    {status === 'error' && 'Verification Failed'}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                    {message}
                </Typography>
                {status === 'success' && <Typography color="text.secondary">Redirecting you now...</Typography>}
                {status === 'error' && <Button variant="contained" sx={{mt:2}} onClick={() => navigate('/login')}>Back to Login</Button>}
            </Paper>
        </Box>
    );
}

export default VerifyEmailPage;