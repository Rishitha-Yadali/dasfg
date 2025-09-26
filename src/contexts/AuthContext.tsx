// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthState, LoginCredentials, SignupCredentials, ForgotPasswordData } from '../types/auth';
import { authService } from '../services/authService';
import { supabase } from '../lib/supabaseClient';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (credentials: SignupCredentials) => Promise<{ needsVerification: boolean; email: string }>;
  logout: () => Promise<void>;
  forgotPassword: (data: ForgotPasswordData) => Promise<void>;
  resetPassword: (newPassword: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  revalidateUserSession: () => Promise<void>;
  markProfilePromptSeen: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  // Diagnostic log to check the context value
  console.log('useAuth hook: context value is', context);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true, // Start as loading
  });

  const [sessionRefreshTimer, setSessionRefreshTimer] = useState<NodeJS.Timeout | null>(null);

  const scheduleSessionRefresh = () => {
    // Only schedule if authenticated
    if (!authState.isAuthenticated) {
      console.log('AuthContext: Not authenticated, not scheduling session refresh.');
      if (sessionRefreshTimer) clearTimeout(sessionRefreshTimer); // Ensure any existing timer is cleared
      return;
    }

    if (sessionRefreshTimer) clearTimeout(sessionRefreshTimer);
    const timer = setTimeout(async () => {
      try {
        console.log('AuthContext: Attempting scheduled session refresh...');
        await refreshSession();
        scheduleSessionRefresh(); // Schedule next refresh only if successful
      } catch (error) {
        console.error('AuthContext: Scheduled session refresh failed:', error);
        // If refresh fails, do not reschedule here. The onAuthStateChange listener will handle SIGNED_OUT.
      }
    }, 45 * 60 * 1000); // 45 minutes
    setSessionRefreshTimer(timer);
  };

  const refreshSession = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('AuthContext: Session refresh error:', error);
        throw error;
      }
      console.log('AuthContext: ✅ Session refreshed successfully');
      return data;
    } catch (error) {
      console.error('AuthContext: Failed to refresh session:', error);
      throw error;
    }
  };

  const revalidateUserSession = async () => {
    try {
      console.log('AuthContext: Revalidating user session...');
      // This method will now fetch the full profile directly
      const user = await authService.getCurrentUser(); // This method is now streamlined in authService
      console.log('AuthContext: User revalidated. User:', user ? user.id : 'none');
      setAuthState(prev => ({
        ...prev,
        user,
        isAuthenticated: !!user,
        isLoading: false, // Ensure isLoading is false after revalidation
      }));
    } catch (error) {
      console.error('AuthContext: Error revalidating user session:', error);
      setAuthState(prev => ({ ...prev, isLoading: false })); // Ensure isLoading is false on error
    }
  };

  useEffect(() => {
    let mounted = true;
    let initialLoadProcessed = false; // Flag to ensure isLoading is set to false only once initially

    // Use onAuthStateChange to handle all auth state transitions, including initial load
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        console.log('AuthContext: Auth state changed event:', event, 'Session:', session ? session.user?.id : 'none');

        // This block ensures isLoading is set to false after the very first auth state check
        if (!initialLoadProcessed) {
          setAuthState(prev => ({ ...prev, isLoading: false }));
          initialLoadProcessed = true;
        }

        if (event === 'SIGNED_IN' && session?.user) {
          try {
            console.log('AuthContext: SIGNED_IN event. Setting basic user info and fetching full profile...');
            // Set basic user info immediately for faster UI update
            setAuthState(prev => ({
              ...prev,
              user: {
                id: session.user.id,
                name: session.user.email?.split('@')[0] || 'User', // Placeholder name
                email: session.user.email!,
                isVerified: session.user.email_confirmed_at !== null,
                createdAt: session.user.created_at || new Date().toISOString(),
                lastLogin: new Date().toISOString(),
                // Other fields will be undefined until full profile is fetched
              },
              isAuthenticated: true,
              isLoading: false,
            }));

            // Defer fetching the full profile to avoid blocking the main thread
            setTimeout(async () => {
              if (!mounted) return; // Check mounted status again inside setTimeout
              const fullProfile = await authService.fetchUserProfile(session.user.id);
              console.log('AuthContext: Full user profile fetched:', fullProfile ? fullProfile.full_name : 'none');

              setAuthState(prev => ({
                ...prev,
                user: prev.user ? {
                  ...prev.user, // Use existing basic user data
                  name: fullProfile?.full_name || prev.user?.name || 'User',
                  email: fullProfile?.email_address || prev.user?.email!,
                  phone: fullProfile?.phone || undefined,
                  linkedin: fullProfile?.linkedin_profile || undefined,
                  github: fullProfile?.wellfound_profile || undefined,
                  username: fullProfile?.username || undefined,
                  referralCode: fullProfile?.referral_code || undefined,
                  // Ensure hasSeenProfilePrompt defaults to false if null/undefined
                  hasSeenProfilePrompt: fullProfile?.has_seen_profile_prompt ?? false,
                } : null,
                isAuthenticated: true,
                isLoading: false,
              }));
            }, 0); // Defer with setTimeout(0)

            scheduleSessionRefresh();
          } catch (error) {
            console.error('AuthContext: Error getting user after sign in:', error);
            setAuthState({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('AuthContext: SIGNED_OUT event.');
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
          if (sessionRefreshTimer) clearTimeout(sessionRefreshTimer);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('AuthContext: ✅ Token refreshed automatically.');
          // No need to fetch current user again here, as the session is just refreshed
          setAuthState(prev => ({
            ...prev,
            isLoading: false,
          }));
          scheduleSessionRefresh(); // Reschedule the timer after an automatic token refresh
        } else if (event === 'USER_UPDATED' && session?.user) {
          console.log('AuthContext: USER_UPDATED event. Revalidating user session...');
          revalidateUserSession(); // Revalidate to get updated user profile
        }
      }
    );

    return () => {
      mounted = false;
      if (sessionRefreshTimer) clearTimeout(sessionRefreshTimer);
      subscription.unsubscribe();
      console.log('AuthContext: AuthProvider unmounted. Cleaned up timers and subscriptions.');
    };
  }, []); // Empty dependency array ensures this effect runs only once on mount

  const login = async (credentials: LoginCredentials) => {
    try {
      console.log('AuthContext: Calling authService.login...');
      // authService.login will handle Supabase signInWithPassword
      await authService.login(credentials);
      console.log('AuthContext: authService.login completed.');
      // The onAuthStateChange listener will pick up the SIGNED_IN event and update state
    } catch (error) {
      console.error('AuthContext: Login failed:', error);
      setAuthState(prev => ({ ...prev, isLoading: false })); // Ensure loading is off on error
      throw error;
    }
  };

  const signup = async (credentials: SignupCredentials) => {
    try {
      console.log('AuthContext: Calling authService.signup...');
      const result = await authService.signup(credentials);
      console.log('AuthContext: authService.signup completed. Needs verification:', result.needsVerification);
      // The onAuthStateChange listener will pick up the SIGNED_IN event if auto-signed in
      if (result.needsVerification) {
        setAuthState(prev => ({ ...prev, isLoading: false })); // Ensure loading is off if verification is needed
      }
      return result;
    } catch (error) {
      console.error('AuthContext: Signup failed:', error);
      setAuthState(prev => ({ ...prev, isLoading: false })); // Ensure loading is off on error
      throw error;
    }
  };

  const logout = async () => { // Removed event parameter from here
    try {
      console.log('AuthContext: Initiating logout...');
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: true, // Set loading to true during logout process
      });
      await authService.logout(); // Added await here
      console.log('AuthContext: authService.logout completed.');
    } catch (error) {
      console.error('AuthContext: Logout error:', error);
    } finally {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false, // Ensure isLoading is false after logout attempt
      });
      if (sessionRefreshTimer) clearTimeout(sessionRefreshTimer);
      console.log('AuthContext: Logout process finished.');
    }
  };

  const forgotPassword = async (data: ForgotPasswordData) => {
    console.log('AuthContext: Calling authService.forgotPassword...');
    await authService.forgotPassword(data.email); // FIX: Pass data.email instead of data
    console.log('AuthContext: authService.forgotPassword completed.');
  };

  const resetPassword = async (newPassword: string) => {
    console.log('AuthContext: Calling authService.resetPassword...');
    await authService.resetPassword(newPassword);
    console.log('AuthContext: authService.resetPassword completed.');
  };

  const markProfilePromptSeen = async () => {
    if (!authState.user) return;
    console.log('AuthContext: Marking profile prompt as seen for user:', authState.user.id);
    try {
      await authService.markProfilePromptSeen(authState.user.id);
      setAuthState(prev => ({
        ...prev,
        user: prev.user ? { ...prev.user, hasSeenProfilePrompt: true } : null
      }));
      console.log('AuthContext: Profile prompt marked as seen.');
    } catch (error) {
      console.error('AuthContext: Error marking profile prompt as seen:', error);
    }
  };

  console.log('AuthContext: AuthProvider is rendering and providing context.'); // Added console.log

  const value: AuthContextType = {
    ...authState,
    login,
    signup,
    logout,
    forgotPassword,
    resetPassword,
    refreshSession,
    revalidateUserSession,
    markProfilePromptSeen,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
