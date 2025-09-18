import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle, CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { LoginCredentials } from '../../types/auth';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid Gmail address'),
  password: z.string().min(1, 'Password is required'),
});

interface LoginFormProps {
  onSwitchToSignup: () => void;
  onForgotPassword: () => void;
  onClose?: () => void; // Keep onClose prop, but it won't be called directly from onSubmit
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToSignup, onForgotPassword, onClose }) => {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false); // isSuccess state still useful for inline message

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginCredentials) => {
    setIsLoading(true);
    setError(null);
    setIsSuccess(false); // Reset success message on new submission

    try {
      await login(data);
      setIsSuccess(true); // Set success state for the inline message

      // --- REMOVED setTimeout BLOCK AND onClose() CALL HERE ---
      // The AuthModal's useEffect will now handle closing based on isAuthenticated and user state.
      
    } catch (err) {
      let errorMessage = 'Sign in failed. Please try again.';
      
      if (err instanceof Error) {
        if (err.message.includes('Invalid login credentials') || err.message.includes('Invalid email or password')) {
          errorMessage = 'Invalid email or password. Please check your credentials.';
        } else if (err.message.includes('Email not confirmed')) {
          errorMessage = 'Please verify your email address before signing in.';
        } else if (err.message.includes('Too many requests')) {
          errorMessage = 'Too many attempts. Please wait a moment and try again.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      // isSuccess is managed here to display the success message temporarily
      // it will be reset by the parent AuthModal's useEffect when it closes.
    }
  };

  if (isSuccess) {
    return (
      <div className="text-center py-8">
        <div className="bg-green-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back!</h2>
        <p className="text-gray-600">You have been signed in successfully.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl dark:bg-red-900/20 dark:border-red-800/50">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-700 dark:text-red-300 text-sm font-medium">{error}</p>
              {error.includes('Invalid email or password') && (
                <button 
                  type="button"
                  onClick={onForgotPassword}
                  className="text-red-600 dark:text-red-400 text-xs mt-1 underline hover:no-underline"
                >
                  Forgot your password?
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Email Input */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Gmail Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              {...register('email')}
              type="email"
              placeholder="your.email@gmail.com"
              className={`w-full pl-12 pr-4 py-4 border-2 rounded-xl focus:ring-2 focus:ring-neon-cyan-500 focus:border-neon-cyan-500 transition-all duration-200 text-gray-900 placeholder-gray-400 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:bg-dark-100 ${
                errors.email ? 'border-red-300 bg-red-50 dark:border-red-500 dark:bg-red-900/20' : 'border-gray-200 bg-gray-50 focus:bg-white hover:border-gray-300 dark:hover:border-dark-400'
              }`}
            />
          </div>
          {errors.email && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password Input */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              className={`w-full pl-12 pr-12 py-4 border-2 rounded-xl focus:ring-2 focus:ring-neon-cyan-500 focus:border-neon-cyan-500 transition-all duration-200 text-gray-900 placeholder-gray-400 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:bg-dark-100 ${
                errors.password ? 'border-red-300 bg-red-50 dark:border-red-500 dark:bg-red-900/20' : 'border-gray-200 bg-gray-50 focus:bg-white hover:border-gray-300 dark:hover:border-dark-400'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors dark:text-gray-500 dark:hover:text-gray-300"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Forgot Password Link */}
        <div className="text-right">
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors hover:underline dark:text-neon-cyan-400 dark:hover:text-neon-cyan-300"
          >
            Forgot your password?
          </button>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-neon-cyan ${
            isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 hover:from-neon-cyan-400 hover:to-neon-blue-400 active:scale-[0.98] hover:shadow-neon-cyan'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Signing In...</span>
            </>
          ) : (
            <>
              <LogIn className="w-5 h-5" />
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Switch to Signup */}
      <div className="text-center pt-6 border-t border-gray-100 dark:border-dark-300">
        <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">
          Don't have an account yet?{' '}
          <button type="button" onClick={onSwitchToSignup} className="text-indigo-600 hover:text-indigo-800 font-medium dark:text-neon-cyan-400 dark:hover:text-neon-cyan-300">
            Sign Up
          </button>
        </p>
      </div>
    </div>
  );
};