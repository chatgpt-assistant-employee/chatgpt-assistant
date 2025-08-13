// client/src/pages/PaymentSuccessPage.jsx

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { Box, CircularProgress, Typography } from '@mui/material';

function PaymentSuccessPage() {
    const { refetchUser } = useUser();
    const navigate = useNavigate();

    useEffect(() => {
        const finalizeSubscription = async () => {
            // Refetch the user data to get the new 'active' subscription status
            await refetchUser();
            // After 2 seconds, redirect to the main dashboard
            setTimeout(() => {
                navigate('/billing');
            }, 2000);
        };

        finalizeSubscription();
    }, [refetchUser, navigate]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <CircularProgress sx={{ mb: 4 }} />
            <Typography variant="h5">Payment Successful!</Typography>
            <Typography color="text.secondary">Updating your account and redirecting...</Typography>
        </Box>
    );
}

export default PaymentSuccessPage;