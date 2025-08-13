// client/src/contexts/UserContext.jsx

import { createContext, useState, useContext, useCallback, useEffect } from 'react';

const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true); // Manages the initial auth check

    // This function checks the server for an active session
    const checkLoginStatus = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch('http://localhost:3001/api/me', { credentials: 'include' });
            if (response.ok) {
                setUser(await response.json());
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error("Session check failed:", error);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Run the check when the provider first mounts
    useEffect(() => {
        checkLoginStatus();
    }, [checkLoginStatus]);
    
    // Function to log the user out
    const logout = async () => {
        await fetch('http://localhost:3001/auth/logout', { credentials: 'include' });
        setUser(null);
    };

    // The value provided to all child components
    const value = { user, isLoading, logout, refetchUser: checkLoginStatus };

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

// Custom hook to easily use the context in other components
export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};