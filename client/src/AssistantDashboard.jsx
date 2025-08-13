// client/src/AssistantDashboard.jsx

import { useState, useEffect } from 'react';
import CreateAssistantPage from './CreateAssistantPage';

// This is the main UI for a logged-in user
function AssistantDashboard({ handleLogout }) {
  const [user, setUser] = useState(null);
  const [emails, setEmails] = useState([]);
  const [currentThread, setCurrentThread] = useState(null);
  const [aiReply, setAiReply] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // THIS IS THE MISSING FUNCTION
  const fetchUser = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/me', { credentials: 'include' });
      console.log('--- DIAGNOSTIC: Frontend requesting /api/me ---');
      const data = await response.json();
      
      console.log('--- DIAGNOSTIC: Data received from server: ---');
      console.log(data); // This is the most important log on the frontend.

      if (response.ok) {
        console.log('DIAGNOSTIC: Response is OK. Setting user state.');
        setUser(data);
      } else {
        console.log('DIAGNOSTIC: Response not OK. Setting user to null.');
        setUser(null);
      }
    } catch (error) {
      console.error("DIAGNOSTIC: Failed to fetch user:", error);
      setUser(null);
    }
  };

  // This useEffect now calls our new function
  useEffect(() => {
    fetchUser();
  }, []);

  // Fetch emails only if the user has connected their Google account
  useEffect(() => {
    if (user && user.googleTokens) {
      fetch('http://localhost:3001/api/emails', { credentials: 'include' })
        .then((res) => res.json())
        .then((data) => setEmails(data.emails || []));
    }
  }, [user]);

  const handleAssistantCreated = (updatedUser) => {
    setUser(updatedUser);
  };

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

  // NEW function to handle disconnecting Google
  const handleGoogleDisconnect = async () => {
    try {
        await fetch('http://localhost:3001/auth/google/disconnect', {
            method: 'POST',
            credentials: 'include',
        });
        // Refetch user data to update the UI
        fetchUser();
    } catch (error) {
        console.error("Failed to disconnect Google account:", error);
    }
  };


  // If we are still fetching user data, show a loading message
  if (!user) {
    return <div>Loading...</div>;
  }

  if (!user.openaiAssistantId) {
    return <CreateAssistantPage onAssistantCreated={handleAssistantCreated} />;
  }

  // If the user has NOT connected their Google account, show a button
  if (!user.googleTokens) {
    return (
      <div className="App">
        <h1>Welcome, {user.email}!</h1>
        <p>To get started, please connect your Google Account.</p>
        <a href="http://localhost:3001/auth/google" className="auth-button">
          Connect Google Account
        </a>
        <br />
        <button onClick={handleLogout} className="logout-button">Logout</button>
      </div>
    );
  }

  // If the user IS fully authenticated, show the main email assistant UI
  return (
      <div className="App">
            <h1>Welcome, {user.email}!!</h1>
            <button onClick={handleGoogleDisconnect} className="disconnect-button">Disconnect Google Account</button>
            <button onClick={handleLogout} className="logout-button">Logout</button>
            
            <hr />
            
          <div className="main-content">
            <div className="email-list-container">
              <h2>Your 5 Most Recent Emails:</h2>
              <div className="email-list">
                {emails.map((email) => {
                    // This check prevents the app from crashing if an email object is not valid
                    if (!email) return null; 

                    return (
                    <div key={email.id} className="email-item" onClick={() => handleEmailClick(email.id)}>
                        <p><strong>From:</strong> {email.from}</p>
                        <p><strong>Subject:</strong> {email.subject}</p>
                        <p>{email.snippet}...</p>
                    </div>
                    );
                })}
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
                {currentThread.map((message) => {
                    // This check prevents the app from crashing
                    if (!message) return null; 
                    
                    return (
                        <div key={message.id} className="email-item">
                        <p><strong>From:</strong> {message.from}</p>
                        <p><strong>Subject:</strong> {message.subject}</p>
                        <hr/>
                        <pre className="email-body">{message.body}</pre>
                        </div>
                    );
                })}
              </div>
            )}
          </div>
        </div>
  );
}

export default AssistantDashboard;