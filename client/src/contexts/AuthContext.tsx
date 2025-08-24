import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService, AuthUser } from '../services/authService';
import { apiService, BackendUser } from '../services/apiService';

interface AuthContextType {
  user: AuthUser | null;
  backendUser: BackendUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [backendUser, setBackendUser] = useState<BackendUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const user = await authService.signInWithGoogle();

      // Check if it's a college email
      if (user.email && !authService.isCollegeEmail(user.email)) {
        await authService.signOut();
        throw new Error('Please use your college email to sign in');
      }

      // Sign in user to backend database
      console.log('🔄 Attempting to sign in user to backend...');
      console.log('User data:', { name: user.displayName, email: user.email });

      try {
        const backendResponse = await apiService.signInUser(
          user.displayName || 'Unknown User',
          user.email || ''
        );
        setBackendUser(backendResponse.user);
        console.log('✅ User successfully signed in to backend:', backendResponse.user);
      } catch (backendError) {
        console.error('❌ Backend sign-in failed:', backendError);
        // Don't throw here - allow Firebase auth to succeed even if backend fails
        // You can show a warning to the user if needed
        alert('Warning: Failed to register in database. Please try again.');
      }

      setUser(user);
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await authService.signOut();
      setUser(null);
      setBackendUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    backendUser,
    loading,
    signInWithGoogle,
    signOut,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
