// client/src/App.jsx

import { useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, CircularProgress, Box, GlobalStyles, Paper, Typography } from '@mui/material';

// Import Contexts and Themes
import { ColorModeContext } from './contexts/ThemeContext';
import { UserProvider, useUser } from './contexts/UserContext';
import { getDesignTokens } from './theme';

// Import Components and Pages
import MainLayout from './components/MainLayout';
import AuthPage from './AuthPage';
import DashboardPage from './pages/DashboardPage';
import AssistantsPage from './pages/AssistantsPage';
import AssistantDetailPage from './pages/AssistantDetailPage';
import SettingsPage from './pages/SettingsPage';
import ChatPage from './pages/ChatPage';
import BillingPage from './pages/BillingPage';
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

// This is a new, simple component to show to unverified users
function UnverifiedPage({ userEmail }) {
    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'grey.100' }}>
            <Paper sx={{ p: 4, textAlign: 'center', maxWidth: '500px' }}>
                <Typography variant="h5" gutterBottom>Check Your Email</Typography>
                <Typography color="text.secondary">
                    We've sent a verification link to <strong>{userEmail}</strong>.
                    <br/>
                    Please click the link in that email to continue.
                </Typography>
            </Paper>
        </Box>
    );
}

// This new component consumes the context to decide what to render
function AppContent() {
    const { user, isLoading, refetchUser } = useUser();

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }
    
    return (
        <BrowserRouter>
            <Routes>
                {!user ? (
                  <>
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/verify-email" element={<VerifyEmailPage />} />
                    // If no user, show the AuthPage for all routes
                    <Route path="*" element={<AuthPage onLoginSuccess={refetchUser} />} />
                  </>
                  ) : !user.isVerified ? (
                    // --- NEW: If user is logged in but NOT verified, show this dedicated page ---
                    <Route path="*" element={<UnverifiedPage userEmail={user.email} />} />
                ) : (
                  <>
                    // If user exists, show the main application layout and pages
                     <Route path="/" element={<MainLayout />}>
                        <Route index element={<DashboardPage />} />
                        <Route path="assistants" element={<AssistantsPage />} />
                        <Route path="assistant/:id" element={<AssistantDetailPage />} />
                        <Route path="chat" element={<ChatPage />} />
                        <Route path="billing" element={<BillingPage />} />
                        <Route path="settings" element={<SettingsPage />} />
                        <Route path="*" element={<Navigate to="/" />} />
                    </Route>
                    <Route path="/payment-success" element={<PaymentSuccessPage />} />
                  </>
                )}
            </Routes>
        </BrowserRouter>
    );
}

// The main App component is now just for setting up providers
function App() {
  const [mode, setMode] = useState('dark');

  const colorMode = useMemo(
    () => ({
     mode,
     setMode,
     toggleColorMode: () =>
       setMode((prev) => (prev === 'light' ? 'dark' : 'light')),
   }),
   [mode]
 );

  const theme = useMemo(() => createTheme(getDesignTokens(mode)), [mode]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <UserProvider>
        <ThemeProvider theme={theme}>
          <GlobalStyles styles={{
            html: { scrollbarWidth: 'thin', scrollbarColor: '#00e5ff66 #1f2a2f' },
            '::-webkit-scrollbar': { width: '8px', height: '8px' },
            '::-webkit-scrollbar-track': { background: '#1f2a2f', borderRadius: 8 },
            '::-webkit-scrollbar-thumb': { background: '#00e5ff66', borderRadius: 8 },
            '::-webkit-scrollbar-thumb:hover': { background: '#00e5ffaa' },
            '.Mui-focusVisible, .Mui-focusVisible *': {
        outline: 'none !important',
        boxShadow: 'none !important',
        border: 'none !important',
      }
          }} />
          <CssBaseline />
          <AppContent />
        </ThemeProvider>
      </UserProvider>
    </ColorModeContext.Provider>
  );
}

export default App;







/* // client/src/App.jsx
import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [profile, setProfile] = useState(null);
  const [emails, setEmails] = useState([]); // <-- Add state for emails
  const [currentThread, setCurrentThread] = useState(null); // <-- State for the selected thread
  const [aiReply, setAiReply] = useState(''); // <-- State for the AI reply
  const [isLoading, setIsLoading] = useState(false); // <-- State for loading indicator

  useEffect(() => {
    // Fetch profile info on component mount
    fetch('http://localhost:3001/api/profile', {
      credentials: 'include',
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => data && setProfile(data))
      .catch((err) => console.error("Failed to fetch profile:", err));
  }, []);

  // New useEffect to fetch emails AFTER profile is loaded
  useEffect(() => {
    if (profile) { // Only fetch emails if the user is logged in
      fetch('http://localhost:3001/api/emails', {
        credentials: 'include',
      })
        .then((res) => res.ok ? res.json() : null)
        .then((data) => data && setEmails(data.emails || []))
        .catch((err) => console.error("Failed to fetch emails:", err));
    }
  }, [profile]); // This effect runs whenever the 'profile' state changes

  // Function to handle clicking an email
  const handleEmailClick = (threadId) => {
    setAiReply(''); // Clear previous AI reply
    setCurrentThread(null); // Clear previous thread to show loading
    fetch(`http://localhost:3001/api/thread/${threadId}`, { credentials: 'include' })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => data && setCurrentThread(data.messages));
  };

  // Function to generate AI reply
  const handleGenerateReply = () => {
    if (!currentThread) return;
    setIsLoading(true);
    setAiReply('');

    // Format the conversation for the AI
    const conversationText = currentThread.map(m => `From: ${m.from}\nSubject: ${m.subject}\n\n${m.body}`).join('\n\n---\n\n');

    fetch('http://localhost:3001/api/generate-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ conversation: conversationText }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.reply) {
          setAiReply(data.reply);
        }
      })
      .catch((err) => console.error("AI reply error:", err))
      .finally(() => setIsLoading(false));
  };

  const handleLogin = () => {
    window.location.href = 'http://localhost:3001/auth/google';
  };

  const handleLogout = () => {
    fetch('http://localhost:3001/auth/logout', { credentials: 'include' })
      .then(() => {
        setProfile(null);
        setEmails([]); // Clear emails on logout
      });
  };

  return (
      <div className="App">
        {profile ? (
          <div>
            <h1>Welcome, {profile.names[0].displayName}!</h1>
            <img src={profile.photos[0].url} alt="Profile" style={{ borderRadius: '50%' }} />
            <button onClick={handleLogout}>Logout</button>
            
            <hr />
            
          <div className="main-content">
            <div className="email-list-container">
              <h2>Your 5 Most Recent Emails:</h2>
              <div className="email-list">
                {emails.map((email) => (
                  <div key={email.id} className="email-item" onClick={() => handleEmailClick(email.id)}>
                    <p><strong>From:</strong> {email.from}</p>
                    <p><strong>Subject:</strong> {email.subject}</p>
                    <p>{email.snippet}...</p>
                  </div>
                ))}
              </div>
            </div>

            {currentThread && (
              <div className="thread-view-container">
                <h2>Conversation</h2>
                <button onClick={handleGenerateReply} disabled={isLoading}>
                  {isLoading ? 'Generating...' : '✨ Generate AI Reply'}
                </button>

                {aiReply && (
                  <div className="ai-reply">
                    <h3>Suggested Reply:</h3>
                    <textarea value={aiReply} readOnly />
                  </div>
                )}
                {currentThread.map((message) => (
                  <div key={message.id} className="email-item">
                    <p><strong>From:</strong> {message.from}</p>
                    <p><strong>Subject:</strong> {message.subject}</p>
                    <hr/>
                    <pre className="email-body">{message.body}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        ) : (
          // ... (the login part remains the same)
          <div>
            <h1>AI Email Assistant</h1>
            <p>Please log in to continue.</p>
            <button onClick={handleLogin}>Login with Google</button>
          </div>
        )}
      </div>
  );
}

export default App; */