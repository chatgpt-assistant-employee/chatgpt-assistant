// client/src/AuthPage.jsx

import { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Paper, TextField, Typography, Link, CircularProgress } from '@mui/material';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function AuthPage({ onLoginSuccess }) {
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const [selectedPlan, setSelectedPlan] = useState(null);

  useEffect(() => {
    // Check if a plan was passed in the URL
    const plan = searchParams.get('plan');
    if (plan) {
      setSelectedPlan(plan);
      setIsLoginView(false); // Default to register view if a plan is selected
    }
  }, [searchParams]);

  const handleAuth = async (event) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    const endpoint = isLoginView ? '/auth/login' : '/auth/register';
    
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Something went wrong');

      // If the backend sent a checkout URL, redirect to Stripe
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        onLoginSuccess();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 4, width: '100%', maxWidth: '420px', textAlign: 'center' }}>
        {/* --- NEW: Logo is added here --- */}
        <Box sx={{ mb: 3 }}>
            <img src="/logo.png" alt="App Logo" style={{ height: '180px', filter: 'drop-shadow(0 0 8px rgba(124, 244, 248, .45))' }} />
        </Box>
        {selectedPlan && !isLoginView && (
                <Box sx={{mb: 2, p: 2, bgcolor: 'primary.lighter', borderRadius: 2}}>
                    <Typography variant="h6">You've selected the {selectedPlan.toUpperCase()} plan!</Typography>
                    <Typography variant="body2">Create your account to continue to payment.</Typography>
                </Box>
            )}
        <Typography variant="h4" component="h1" gutterBottom fontWeight="700">
          {isLoginView ? 'Welcome Back' : 'Create an Account'}
        </Typography>
        <Typography variant="body1" color="textSecondary" sx={{ mb: 4 }}>
          {isLoginView ? 'Please log in to access your dashboard.' : 'Get started with your AI assistant.'}
        </Typography>
        <Box component="form" onSubmit={handleAuth} noValidate>
          <TextField
            label="Email Address"
            type="email"
            fullWidth
            required
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            required
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Box sx={{ textAlign: 'right', my: 1 }}>
              <Link component={RouterLink} to="/forgot-password" variant="body2">
                  Forgot Password?
              </Link>
          </Box>
          {error && <Typography color="error" sx={{ mt: 2, mb: 1 }}>{error}</Typography>}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={isLoading}
            sx={{ mt: 3, mb: 2, py: 1.5, fontSize: '1rem' }}
          >
            {isLoading ? <CircularProgress size={24} color="inherit" /> : (isLoginView ? 'Login' : 'Create Account')}
          </Button>
          <Typography variant="body2">
            {isLoginView ? "Don't have an account?" : 'Already have an account?'}
            <Link component="button" variant="body2" onClick={() => setIsLoginView(!isLoginView)} sx={{ ml: 1 }}>
              {isLoginView ? 'Sign Up' : 'Login'}
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}

export default AuthPage;