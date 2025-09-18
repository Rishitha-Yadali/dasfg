// src/components/auth/AuthModal.tsx
import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Sparkles, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, User as UserIcon, UserPlus } from 'lucide-react';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { ForgotPasswordForm } from './ForgotPasswordForm'; // Corrected import for named export

import { useAuth } from '../../contexts/AuthContext'; // Uncommented this line

// You will need to create this component as a named export (e.g., export const ResetPasswordForm)
// import { ResetPasswordForm } from './ResetPasswordForm'; 

type AuthView = 'login' | 'signup' | 'forgot-password' | 'success' | 'postSignupPrompt' | 'reset_password';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: AuthView;
  onProfileFillRequest?: (mode?: 'profile' | 'wallet') => void;
  onPromptDismissed?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialView = 'login',
  onProfileFillRequest = () => {},
  onPromptDismissed = () => {}
}) => {
  const { user, isAuthenticated } = useAuth();
  const [currentView, setCurrentView] = useState<AuthView>(initialView);
  const [signupEmail, setSignupEmail] = useState<string>('');

  useEffect(() => {
    console.log('AuthModal isOpen prop changed:', isOpen);
    if (!isOpen && currentView === 'postSignupPrompt') {
      onPromptDismissed();
      setCurrentView('login');
    }
    // When the modal closes, reset the initial view to login
    if (!isOpen) {
      setCurrentView('login');
    }
  }, [isOpen, currentView, onPromptDismissed]);

  useEffect(() => {
    console.log('AuthModal useEffect: Running. isAuthenticated:', isAuthenticated, 'user:', user, 'isOpen:', isOpen, 'currentView:', currentView);

    // Wait until authentication state and user profile are fully loaded
    if (isAuthenticated && user && (user.hasSeenProfilePrompt === null || user.hasSeenProfilePrompt === undefined)) {
      console.log('AuthModal useEffect: User authenticated, but profile prompt status not yet loaded. Waiting...');
      return;
    }

    // If user is authenticated and profile is incomplete (hasSeenProfilePrompt is false)
    if (isAuthenticated && user && user.hasSeenProfilePrompt === false && isOpen) {
      console.log('AuthModal useEffect: User authenticated and profile incomplete, opening UserProfileManagement.');
      // Call onProfileFillRequest to open the UserProfileManagement modal
      onProfileFillRequest('profile');
      // Immediately close this AuthModal as its job of prompting is done
      onClose(); 
    } else if (isAuthenticated && user && user.hasSeenProfilePrompt === true && isOpen) {
      // If user is authenticated and profile is complete, ensure AuthModal is closed
      console.log('AuthModal useEffect: User authenticated and profile complete, ensuring AuthModal is closed.');
      onClose(); 
    } else if (!isAuthenticated && isOpen) {
      // If user is not authenticated and modal is open, ensure it's in a login/signup state
      console.log('AuthModal useEffect: User not authenticated and modal is open. Ensuring login/signup view.');
      // No explicit action needed here, as initialView is already set by App.tsx
    }
  }, [isAuthenticated, user, isOpen, onClose, onProfileFillRequest]);

  if (!isOpen) {
    console.log('AuthModal is NOT open, returning null');
    return null;
  }
  
  console.log('AuthModal IS open, rendering content');

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleCloseClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  const handleSignupSuccess = (email: string) => {
    setSignupEmail(email);
  };

  const handleForgotPasswordSuccess = () => {
    setCurrentView('success');
    setTimeout(() => {
      onClose();
      setCurrentView('login');
    }, 2500);
  };

  const getTitle = () => {
    switch (currentView) {
      case 'login': return 'Welcome Back';
      case 'signup': return 'Join Resume Optimizer';
      case 'forgot-password': return 'Reset Password';
      case 'reset_password': return 'Reset Your Password';
      case 'success': return 'Success!';
      case 'postSignupPrompt': return 'Account Created!';
      default: return 'Authentication';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-sm dark:bg-black/80" onClick={handleBackdropClick}>
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-[95vw] sm:max-w-md max-h-[98vh] sm:max-h-[95vh] border border-gray-100 flex flex-col dark:bg-dark-100 dark:border-dark-300 dark:shadow-dark-xl">
        <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50 px-4 sm:px-6 py-4 sm:py-8 border-b border-gray-100 flex-shrink-0 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
          <button
            onClick={handleCloseClick}
            className="absolute top-2 sm:top-4 right-2 sm:right-4 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-white/50 z-10 min-w-[44px] min-h-[44px] dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-dark-300/50"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          <div className="text-center">
            <div className="bg-gradient-to-br from-neon-cyan-500 to-neon-blue-500 w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg dark:shadow-neon-cyan">
              <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 px-4">
              {getTitle()}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm px-4">
              {currentView === 'login' && 'Sign in to optimize your resume with AI'}
              {currentView === 'signup' && 'Create your account and start optimizing'}
              {currentView === 'forgot-password' && 'We\'ll help you reset your password'}
              {currentView === 'reset_password' && 'Enter your new password below.'}
              {currentView === 'success' && 'Everything is set up perfectly!'}
              {currentView === 'postSignupPrompt' && 'Your account is ready!'}
            </p>
          </div>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
          {currentView === 'login' && (
            <LoginForm
              onSwitchToSignup={() => setCurrentView('signup')}
              onForgotPassword={() => setCurrentView('forgot-password')}
            />
          )}

          {currentView === 'signup' && (
            <SignupForm
              onSwitchToLogin={() => setCurrentView('login')}
              onSignupSuccess={(needsVerification: boolean, email: string) => {
                setSignupEmail(email);
                if (needsVerification) {
                  setCurrentView('success');
                } else {
                  setCurrentView('postSignupPrompt');
                }
              }}
            />
          )}

          {currentView === 'forgot-password' && (
            <ForgotPasswordForm
              onBackToLogin={() => setCurrentView('login')}
              onSuccess={handleForgotPasswordSuccess}
            />
          )}

          {currentView === 'reset_password' && (
            // You will need to create a ResetPasswordForm component as a named export
            // import { ResetPasswordForm } from './ResetPasswordForm';
            // Make sure to pass necessary props like onSuccess and onBackToLogin
            // <ResetPasswordForm
            //   onSuccess={() => {
            //     setCurrentView('success');
            //     setTimeout(() => onClose(), 2500);
            //   }}
            //   onBackToLogin={() => setCurrentView('login')}
            // />
            <div className="text-center py-6 sm:py-8">
              <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                You can now set a new password. Please implement the `ResetPasswordForm` component.
              </p>
              <button
                onClick={() => setCurrentView('login')}
                className="w-full bg-indigo-600 hover:bg-indigo-700 dark:bg-neon-blue-500 dark:hover:bg-neon-blue-600 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Back to Login
              </button>
            </div>
          )}

          {currentView === 'success' && (
            <div className="text-center py-6 sm:py-8">
              <div className="bg-green-100 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-6 dark:bg-neon-cyan-500/20 dark:shadow-neon-cyan">
                <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-green-600 dark:text-neon-cyan-400" />
              </div>
              <h2 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">All Set!</h2>
              {signupEmail ? (
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed px-4">
                    A verification email has been sent to <br />
                    <strong className="text-gray-900 dark:text-gray-100">{signupEmail}</strong>
                  </p>
                ) : (
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed px-4">
                  Password reset email sent. Check your inbox!
                </p>
              )}
              <button
                onClick={() => onClose()}
                className="w-full mt-6 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-xl text-sm transition-colors dark:bg-dark-200 dark:hover:bg-dark-300 dark:text-gray-300"
              >
                Close
              </button>
            </div>
          )}

          {currentView === 'postSignupPrompt' && (
            <div className="text-center py-6 sm:py-8">
              <div className="bg-blue-100 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-6 dark:bg-neon-cyan-500/20 dark:shadow-neon-cyan">
                <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600 dark:text-neon-cyan-400" />
              </div>
              <h2 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">Welcome!</h2>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed px-4 mb-6">
                Your account for **{signupEmail}** has been created successfully!
                Would you like to complete your profile now?
              </p>
              <div className="flex flex-col sm:flex-row gap-3 px-4">
                <button
                  onClick={() => {
                    onProfileFillRequest(); // This will now pass isPostSignup: true
                    // AuthModal will close itself via useEffect
                  }}
                  className="w-full btn-primary py-3 px-4 rounded-xl font-semibold text-sm transition-colors"
                >
                  Complete Profile
                </button>
                <button
                  onClick={() => {
                    onPromptDismissed();
                    // AuthModal will close itself via useEffect
                  }}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-xl text-sm transition-colors dark:bg-dark-200 dark:hover:bg-dark-300 dark:text-gray-300"
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
