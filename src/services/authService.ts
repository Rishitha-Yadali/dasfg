// src/services/authService.ts
import { User, LoginCredentials, SignupCredentials, ForgotPasswordData } from '../types/auth';
import { supabase } from '../lib/supabaseClient';
import { deviceTrackingService } from './deviceTrackingService';
import { paymentService } from './paymentService'; // This line is essential

class AuthService {
  // Add a static variable to track the last time device activity was logged
  private static lastDeviceActivityLog: number = 0;
  private static readonly DEVICE_ACTIVITY_LOG_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

private isValidGmail(email: string): boolean {
  console.log('DEBUG: isValidGmail received email:', email);
  const trimmedEmail = (email || '').trim();
  console.log('DEBUG: isValidGmail trimmedEmail:', trimmedEmail);
  const gmailRegex = /^[^\s@]+@gmail\.com$/;
  const isValid = gmailRegex.test(trimmedEmail);
  console.log('DEBUG: isValidGmail regex test result:', isValid);
  return isValid;
}



  private validatePasswordStrength(password: string): { isValid: boolean; message?: string } {
    if (password.length < 8) return { isValid: false, message: 'Password must be at least 8 characters long' };
    if (!/(?=.*[a-z])/.test(password)) return { isValid: false, message: 'Password must contain at least one lowercase letter' };
    if (!/(?=.*[A-Z])/.test(password)) return { isValid: false, message: 'Password must contain at least one uppercase letter' };
    if (!/(?=.*\d)/.test(password)) return { isValid: false, message: 'Password must contain at least one number' };
    if (!/(?=.*[@$!%*?&])/.test(password)) return { isValid: false, message: 'Password must contain at least one special character (@$!%*?&)' };
    return { isValid: true };
  }

  async login(credentials: LoginCredentials): Promise<User> {
    console.log('AuthService: Starting login for email:', credentials.email);
    if (!this.isValidGmail(credentials.email)) throw new Error('Please enter a valid Gmail address (@gmail.com)');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password
    });

    if (error) {
      console.error('AuthService: Supabase signInWithPassword error:', error);
      throw new Error(error.message);
    }
    if (!data.user) {
      console.error('AuthService: signInWithPassword returned no user data.');
      throw new Error('Login failed. Please try again.');
    }
    console.log('AuthService: User signed in with Supabase. User ID:', data.user.id);

    // Register device and create session for tracking
    try {
      console.log('AuthService: Attempting device registration and session creation...');
      const deviceId = await deviceTrackingService.registerDevice(data.user.id);
      if (deviceId && data.session) {
        await deviceTrackingService.createSession(data.user.id, deviceId, data.session.access_token);
        // Log activity immediately after login
        await deviceTrackingService.logActivity(data.user.id, 'login', {
          loginMethod: 'email_password',
          success: true
        }, deviceId);
        AuthService.lastDeviceActivityLog = Date.now(); // Update last log time
        console.log('AuthService: Device and session tracking successful.');
      } else {
        console.warn('AuthService: Device ID or session not available for tracking.');
      }
    } catch (deviceError) {
      console.warn('AuthService: Device tracking failed during login:', deviceError);
      // Don't fail login if device tracking fails
    }

    // After login, we don't need to fetch the profile here.
    // The AuthContext will handle fetching the full profile after the SIGNED_IN_ event.
    // We return a minimal User object based on the Supabase auth user.
    const userResult: User = {
      id: data.user.id,
      name: data.user.email?.split('@')[0] || 'User', // Placeholder name
      email: data.user.email!,
      isVerified: data.user.email_confirmed_at !== null,
      createdAt: data.user.created_at || new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
    console.log('AuthService: Login process completed. Returning minimal user data.');
    return userResult;
  }

  async signup(credentials: SignupCredentials): Promise<{ needsVerification: boolean; email: string }> {
    console.log('AuthService: Starting signup for email:', credentials.email);
    if (!credentials.name.trim()) throw new Error('Full name is required');
    if (credentials.name.trim().length < 2) throw new Error('Name must be at least 2 characters long');
    if (!/^[a-zA-Z\s]+$/.test(credentials.name.trim())) throw new Error('Name can only contain letters and spaces');
    if (!credentials.email) throw new Error('Gmail address is required');
    if (!this.isValidGmail(credentials.email)) throw new Error('Please enter a valid Gmail address (@gmail.com)');

    const passwordValidation = this.validatePasswordStrength(credentials.password);
    if (!passwordValidation.isValid) throw new Error(passwordValidation.message!);
    if (credentials.password !== credentials.confirmPassword) throw new Error('Passwords do not match');

    const { data, error } = await supabase.auth.signUp({
      email: credentials.email,
      password: credentials.password,
      options: {
        data: {
          name: credentials.name.trim(),
          referralCode: credentials.referralCode || null
        }
      }
    });

    if (error) {
      console.error('AuthService: Supabase signUp error:', error);
      throw new Error(error.message);
    }
    if (!data.user) {
      console.error('AuthService: signUp returned no user data.');
      throw new Error('Failed to create account. Please try again.');
    }
    console.log('AuthService: User signed up with Supabase. User ID:', data.user.id);

    // Register device for new user
    

    const signupResult = {
      needsVerification: !data.session,
      email: credentials.email
    };
    console.log('AuthService: Signup process completed. Needs verification:', signupResult.needsVerification);
    return signupResult;
  }

  // New public method to fetch user profile
  public async fetchUserProfile(userId: string): Promise<{
    full_name: string,
    email_address: string,
    phone?: string,
    linkedin_profile?: string,
    wellfound_profile?: string,
    username?: string,
    referral_code?: string,
    has_seen_profile_prompt?: boolean
  } | null> {
    console.log('AuthService: Fetching user profile for user ID:', userId);
    try {
      const { data, error }
        = await supabase
        .from('user_profiles')
        .select('full_name, email_address, phone, linkedin_profile, wellfound_profile, username, referral_code, has_seen_profile_prompt')
        .eq('id', userId)
        .maybeSingle();
      if (error) {
        console.error('AuthService: Error fetching user profile from DB:', error);
        return null;
      }
      console.log('AuthService: User profile fetched from DB:', data ? data.full_name : 'none');
      return data;
    } catch (error) {
      console.error('AuthService: Error in fetchUserProfile catch block:', error);
      return null;
    }
  }

  // Streamlined getCurrentUser to primarily handle session validity and return full user object
  async getCurrentUser(): Promise<User | null> {
    console.log('AuthService: Starting getCurrentUser (streamlined)...');
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('AuthService: getSession error in getCurrentUser:', error);
        return null;
      }

      if (!session?.user) {
        console.log('AuthService: No user in session in getCurrentUser.');
        return null;
      }
      console.log('AuthService: Session found. User ID:', session.user.id);

      const now = Math.floor(Date.now() / 1000);
      if (session.expires_at && session.expires_at < now + 300) { // Refresh if expires in 5 minutes
        console.log('AuthService: Session expiring soon, refreshing...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData.session) {
          console.error('AuthService: Session refresh failed:', refreshError);
          if (refreshError?.message === "Invalid Refresh Token: Refresh Token Not Found") {
            console.warn('AuthService: Invalid refresh token detected. Forcing logout.');
            await supabase.auth.signOut();
          }
          return null;
        }
        console.log('AuthService: ✅ Session refreshed successfully in getCurrentUser.');
        session.user = refreshData.session.user; // Update user object from refreshed session
      }

      // Update device activity for current session, but only if interval has passed
      const currentTime = Date.now();
      if (currentTime - AuthService.lastDeviceActivityLog > AuthService.DEVICE_ACTIVITY_LOG_INTERVAL_MS) {
        try {
          console.log('AuthService: Attempting device activity update...');
          const deviceId = await deviceTrackingService.registerDevice(session.user.id);
          if (deviceId) {
            await deviceTrackingService.logActivity(session.user.id, 'session_activity', {
              action: 'session_check',
              timestamp: new Date().toISOString()
            }, deviceId);
            AuthService.lastDeviceActivityLog = currentTime; // Update last log time
            console.log('AuthService: Device activity updated.');
          } else {
            console.warn('AuthService: Device ID not obtained for activity update.');
          }
        } catch (deviceError) {
          console.warn('AuthService: Device activity update failed during session check:', deviceError);
        }
      } else {
        console.log('AuthService: Skipping device activity update (interval not passed).');
      }

      // Fetch the full profile using the new public method
      const profile = await this.fetchUserProfile(session.user.id);
      console.log('AuthService: User profile fetched for getCurrentUser. Profile:', profile ? profile.full_name : 'none');

      const userResult: User = {
        id: session.user.id,
        name: profile?.full_name || session.user.email?.split('@')[0] || 'User',
        email: profile?.email_address || session.user.email!,
        phone: profile?.phone || undefined,
        linkedin: profile?.linkedin_profile || undefined,
        github: profile?.wellfound_profile || undefined,
        referralCode: profile?.referral_code || undefined,
        username: profile?.username || undefined,
        isVerified: session.user.email_confirmed_at !== null,
        createdAt: session.user.created_at || new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        hasSeenProfilePrompt: profile?.has_seen_profile_prompt || false,
      };
      console.log('AuthService: getCurrentUser completed. Returning user data.');
      return userResult;
    } catch (error) {
      console.error('AuthService: Error in getCurrentUser:', error);
      return null;
    }
  }

  async logout(): Promise<void> {
    console.log('AuthService: Starting logout process...');
    // Capture session info BEFORE signing out
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    const accessToken = session?.access_token;

    console.log('AuthService: Calling supabase.auth.signOut() first for immediate UI feedback.');
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('AuthService: supabase.auth.signOut() failed:', error);
      throw new Error('Failed to sign out. Please try again.');
    }

    console.log('AuthService: supabase.auth.signOut() completed. Now handling device tracking.');
    try {
      if (userId && accessToken) {
        console.log('AuthService: Previous session info captured, attempting to log logout activity.');
        const deviceId = await deviceTrackingService.registerDevice(userId); // Use captured userId
        if (deviceId) {
          await deviceTrackingService.logActivity(userId, 'logout', { // Use captured userId
            logoutMethod: 'manual',
            timestamp: new Date().toISOString()
          }, deviceId);
          console.log('AuthService: Logout activity logged. Ending session via device tracking service.');
          await deviceTrackingService.endSession(accessToken, 'logout'); // Use captured accessToken
        } else {
          console.warn('AuthService: Device ID not obtained, skipping device tracking session end.');
        }
      } else {
        console.log('AuthService: No active session info to log for device tracking after sign out.');
      }
    } catch (deviceError) {
      console.warn('AuthService: Failed to log logout activity or end session via device tracking:', deviceError);
    }
    console.log('AuthService: Logout process finished.');
  }

  async forgotPassword(email: string): Promise<void> { // Changed parameter name and type
  console.log('AuthService: Starting forgotPassword for email:', email); // Use 'email' directly
  if (!this.isValidGmail(email)) throw new Error('Please enter a valid Gmail address (@gmail.com)'); // Use 'email' directly
 const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  if (error) {
    console.error('AuthService: resetPasswordForEmail error:', error);
    throw new Error(error.message);
  }
  console.log('AuthService: Forgot password email sent.');
}


  async resetPassword(newPassword: string): Promise<void> {
    console.log('AuthService: Starting resetPassword.');
    const passwordValidation = this.validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) throw new Error(passwordValidation.message!);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      console.error('AuthService: updateUser password error:', error);
      throw new Error(error.message);
    }
    console.log('AuthService: Password reset successfully.');
  }

  async updateUserProfile(userId: string, updates: {
    full_name?: string;
    email_address?: string;
    phone?: string;
    linkedin_profile?: string;
    github_profile?: string;
    has_seen_profile_prompt?: boolean;
  }): Promise<void> {
    console.log('AuthService: Starting updateUserProfile for user ID:', userId, 'updates:', updates);
    try {
      const dbUpdates: { [key: string]: any } = {
        full_name: updates.full_name,
        email_address: updates.email_address,
        phone: updates.phone,
        linkedin_profile: updates.linkedin_profile,
        has_seen_profile_prompt: updates.has_seen_profile_prompt,
        profile_updated_at: new Date().toISOString()
      };

      if (updates.github_profile !== undefined) {
        dbUpdates.wellfound_profile = updates.github_profile;
      }

      const { error } = await supabase
        .from('user_profiles')
        .update(dbUpdates)
        .eq('id', userId);

      if (error) {
        console.error('AuthService: Error updating user profile in DB:', error);
        throw new Error('Failed to update profile');
      }
      console.log('AuthService: User profile updated successfully in DB.');
    } catch (error) {
      console.error('AuthService: Error in updateUserProfile catch block:', error);
      throw error;
    }
  }

  async markProfilePromptSeen(userId: string): Promise<void> {
    console.log('AuthService: Marking profile prompt as seen for user ID:', userId);
    try {
       await this.updateUserProfile(userId, {
        has_seen_profile_prompt: true
      });
      console.log('AuthService: Profile prompt marked as seen successfully.');
    } catch (error) {
      console.error('AuthService: Error marking profile prompt as seen:', error);
      throw new Error('Failed to update profile prompt status');
    }
  }

  async ensureValidSession(): Promise<boolean> {
    console.log('AuthService: Starting ensureValidSession...');
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('AuthService: getSession result - session:', session ? 'exists' : 'null', 'error:', error); // ADDED LOG

      if (error) {
        console.error('AuthService: Session check failed in ensureValidSession:', error);
        console.log('AuthService: Returning false due to getSession error.'); // NEW LOG
        return false;
      }

      if (!session) {
        console.log('AuthService: No active session found in ensureValidSession.');
        console.log('AuthService: Returning false because no session was found.'); // NEW LOG
        return false;
      }
      console.log('AuthService: Session found in ensureValidSession. User ID:', session.user.id);

      const now = Math.floor(Date.now() / 1000);
      if (session.expires_at && session.expires_at < now + 300) {
        console.log('AuthService: Session expiring soon in ensureValidSession, refreshing...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        console.log('AuthService: refreshSession result - session:', refreshData.session ? 'exists' : 'null', 'error:', refreshError); // ADDED LOG
        if (refreshError || !refreshData.session) {
          console.error('AuthService: Session refresh failed in ensureValidSession:', refreshError);
          console.log('AuthService: Returning false due to refreshSession error or no refreshed session.'); // NEW LOG
          return false;
        }
        console.log('AuthService: ✅ Session refreshed successfully in ensureValidSession.');
      }
      console.log('AuthService: ensureValidSession completed. Session is valid.');
      return true;
    } catch (error) {
      console.error('AuthService: Error in ensureValidSession:', error);
      console.log('AuthService: Returning false due to unexpected error in ensureValidSession.'); // NEW LOG
      return false;
    }
  }

  async getUserDevices(userId: string) {
    console.log('AuthService: Getting user devices for user ID:', userId);
    return deviceTrackingService.getUserDevices(userId);
  }

  async getUserSessions(userId: string) {
    console.log('AuthService: Getting user sessions for user ID:', userId);
    return deviceTrackingService.getUserSessions(userId);
  }

  async getUserActivityLogs(userId: string, limit?: number) {
    console.log('AuthService: Getting user activity logs for user ID:', userId);
    return deviceTrackingService.getUserActivityLogs(userId, limit);
  }

  async trustDevice(deviceId: string) {
    console.log('AuthService: Trusting device ID:', deviceId);
    return deviceTrackingService.trustDevice(deviceId);
  }

  async removeDevice(deviceId: string) {
    console.log('AuthService: Removing device ID:', deviceId);
    return deviceTrackingService.removeDevice(deviceId);
  }

  async endSession(sessionId: string) {
    console.log('AuthService: Ending session ID:', sessionId);
    return deviceTrackingService.endSpecificSession(sessionId);
  }

  async endAllOtherSessions(userId: string, currentSessionToken: string) {
    console.log('AuthService: Ending all other sessions for user ID:', userId);
    return deviceTrackingService.endAllOtherSessions(userId, currentSessionToken);
  }
}

export const authService = new AuthService();
