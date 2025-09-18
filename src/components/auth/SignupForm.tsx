// src/components/auth/SignupForm.tsx
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Mail, Lock, Eye, EyeOff, UserPlus, AlertCircle, CheckCircle, Loader2, Shield, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { SignupCredentials } from '../../types/auth';

const signupSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),
  email: z.string()
    .email('Please enter a valid Gmail address')
    .refine((email) => email.endsWith('@gmail.com'), {
      message: 'Please use a Gmail address (@gmail.com)',
    }),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/(?=.*[a-z])/, 'Must contain at least one lowercase letter')
    .regex(/(?=.*[A-Z])/, 'Must contain at least one uppercase letter')
    .regex(/(?=.*\d)/, 'Must contain at least one number')
    .regex(/(?=.*[@$!%*?&])/, 'Must contain at least one special character (@$!%*?&)'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  referralCode: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

interface SignupFormProps {
  onSwitchToLogin: () => void;
  onSignupSuccess: (needsVerification: boolean, email: string) => void;
}

export const SignupForm: React.FC<SignupFormProps> = ({ onSwitchToLogin, onSignupSuccess }) => {
  const { signup } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Removed local needsVerification and userEmail states as AuthModal will manage them

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<SignupCredentials>({
    resolver: zodResolver(signupSchema),
  });

  const password = watch('password');

  const getPasswordStrength = (password: string) => {
    if (!password) return { strength: 0, label: '', color: '' };
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/(?=.*[a-z])/.test(password)) strength++;
    if (/(?=.*[A-Z])/.test(password)) strength++;
    if (/(?=.*\d)/.test(password)) strength++;
    if (/(?=.*[@$!%*?&])/.test(password)) strength++;

    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
    
    return {
      strength,
      label: labels[strength - 1] || 'Very Weak',
      color: colors[strength - 1] || 'bg-red-500'
    };
  };

  const passwordStrength = getPasswordStrength(password || '');

  const onSubmit = async (data: SignupCredentials) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await signup(data);
      // Call onSignupSuccess here, passing the result from the signup service
      onSignupSuccess(result.needsVerification, data.email); // <--- THIS IS THE CRITICAL CHANGE

      // The local state setNeedsVerification is no longer needed here as AuthModal handles the view
      // if (result.needsVerification) {
      //   setNeedsVerification(true);
      // }
    } catch (err) {
      let errorMessage = 'Account creation failed. Please try again.';
      
      if (err instanceof Error) {
        if (err.message.includes('already registered') || err.message.includes('already exists')) {
          errorMessage = 'An account with this email already exists. Please sign in instead.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // The conditional return for needsVerification is now handled by AuthModal
  // if (needsVerification) {
  //   return (
  //     <div className="text-center py-8">
  //       <div className="bg-blue-100 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6">
  //         <Mail className="w-10 h-10 text-blue-600" />
  //       </div>
  //       <h2 className="text-2xl font-bold text-gray-900 mb-3">Check Your Email</h2>
  //       <p className="text-gray-600 mb-4 leading-relaxed">
  //         We've sent a verification link to <br />
  //         <strong className="text-gray-900">{userEmail}</strong>
  //       </p>
  //       <p className="text-gray-500 text-sm mb-6">
  //         Click the link in your email to verify your account and complete the signup process.
  //       </p>
  //       <button
  //         onClick={onSwitchToLogin}
  //         className="text-blue-600 hover:text-blue-700 font-semibold transition-colors hover:underline"
  //       >
  //         ← Back to Sign In
  //       </button>
  //     </div>
  //   );
  // }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-700 text-sm font-medium">{error}</p>
              {error.includes('already exists') && (
                <button
                  onClick={onSwitchToLogin}
                  className="text-red-600 text-xs mt-1 underline hover:no-underline"
                >
                  Sign in instead
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Name Input */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Full Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-gray-400" />
            </div>
            <input
              {...register('name')}
              type="text"
              placeholder="Enter your full name"
              className={`w-full pl-12 pr-4 py-4 border-2 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                errors.name ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white hover:border-gray-300'
              }`}
            />
          </div>
          {errors.name && (
            <p className="mt-2 text-sm text-red-600 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {errors.name.message}
            </p>
          )}
        </div>

        {/* Email Input */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Gmail Address <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-gray-400" />
            </div>
            <input
              {...register('email')}
              type="email"
              placeholder="your.email@gmail.com"
              className={`w-full pl-12 pr-4 py-4 border-2 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                errors.email ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white hover:border-gray-300'
              }`}
            />
          </div>
          {errors.email && (
            <p className="mt-2 text-sm text-red-600 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password Input */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400" />
            </div>
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a strong password"
              className={`w-full pl-12 pr-12 py-4 border-2 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                errors.password ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white hover:border-gray-300'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
          
          {/* Password Strength Indicator */}
          {password && (
            <div className="mt-3">
              <div className="flex items-center space-x-2 mb-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                    style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                  ></div>
                </div>
                <span className="text-xs font-medium text-gray-600 min-w-[60px]">{passwordStrength.label}</span>
              </div>
            </div>
          )}
          
          {errors.password && (
            <p className="mt-2 text-sm text-red-600 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Confirm Password Input */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Confirm Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400" />
            </div>
            <input
              {...register('confirmPassword')}
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm your password"
              className={`w-full pl-12 pr-12 py-4 border-2 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                errors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white hover:border-gray-300'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="mt-2 text-sm text-red-600 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* Referral Code Input */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Referral Code (Optional)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-gray-400" />
            </div>
            <input
              {...register('referralCode')}
              type="text"
              placeholder="Enter referral code (optional)"
              className={`w-full pl-12 pr-4 py-4 border-2 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 text-gray-900 placeholder-gray-400 ${
                errors.referralCode ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white hover:border-gray-300'
              }`}
            />
          </div>
          {errors.referralCode && (
            <p className="mt-2 text-sm text-red-600 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1" />
              {errors.referralCode.message}
            </p>
          )}
          <p className="mt-2 text-xs text-green-600">
            💰 Get ₹10 bonus in your wallet when you use a valid referral code!
          </p>
        </div>


        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-300 flex items-center justify-center space-x-2 ${
            isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 active:scale-[0.98] shadow-lg hover:shadow-xl'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Creating Account...</span>
            </>
          ) : (
            <>
              <UserPlus className="w-5 h-5" />
              <span>Create Account</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Switch to Login */}
      <div className="text-center pt-6 border-t border-gray-100">
        <p className="text-gray-600 text-sm mb-3">
          Already have an account?
        </p>
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-green-600 hover:text-green-700 font-semibold transition-colors hover:underline"
        >
          Sign in here →
        </button>
      </div>
    </div>
  );
};
