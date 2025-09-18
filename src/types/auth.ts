export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  username?: string;
  referralCode?: string;
  isVerified: boolean;
  createdAt: string;
  lastLogin: string;
  hasSeenProfilePrompt?: boolean;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  referralCode?: string;
  referralCode?: string;
}

export interface ForgotPasswordData {
  email: string;
}

interface ResetPasswordData {
  password: string;
  confirmPassword: string;
}