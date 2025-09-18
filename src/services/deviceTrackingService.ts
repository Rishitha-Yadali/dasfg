import { supabase } from '../lib/supabaseClient';

interface DeviceInfo {
  fingerprint: string;
  name?: string;
  type: 'desktop' | 'mobile' | 'tablet';
  browser: {
    name: string;
    version: string;
  };
  os: {
    name: string;
    version: string;
  };
  screen: {
    width: number;
    height: number;
    resolution: string;
  };
  timezone: string;
  language: string;
}
export interface Location {
  city: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
}
export interface UserDevice {
  id: string;
  deviceName?: string;
  deviceType: string;
  browserName: string;
  osName: string;
  isTrusted: boolean;
  lastSeenAt: string;
  lastLocation?: Location;
  activeSessions: number;
}

export interface UserSession {
  id: string;
  deviceId: string;
  ipAddress: string;
  userAgent: string;
  location?: Location;
  isActive: boolean;
  expiresAt: string;
  lastActivityAt: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  activityType: string;
  activityDetails?: any;
  ipAddress?: string;
  location?: Location;
  riskScore: number;
  createdAt: string;
}

class DeviceTrackingService {
  // Get comprehensive device information
  async getDeviceInfo(): Promise<DeviceInfo> {
    const userAgent = navigator.userAgent;
    const screen = window.screen;
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isTablet = /iPad|Android(?=.*\bMobile\b)(?=.*\bSafari\b)/i.test(userAgent) ||
                     (screen.width >= 768 && screen.width <= 1024);
    
    const deviceType: 'desktop' | 'mobile' | 'tablet' =
      isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

    const browserInfo = this.parseBrowserInfo(userAgent);
    const osInfo = this.parseOSInfo(userAgent);

    const fingerprintString = `${browserInfo.name}|${browserInfo.version}|${osInfo.name}|${screen.width}x${screen.height}|${Intl.DateTimeFormat().resolvedOptions().timeZone}|${navigator.language}`;
    
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprintString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fingerprint = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return {
      fingerprint,
      name: this.generateDeviceName(deviceType, browserInfo.name, osInfo.name),
      type: deviceType,
      browser: browserInfo,
      os: osInfo,
      screen: {
        width: screen.width,
        height: screen.height,
        resolution: `${screen.width}x${screen.height}`
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language
    };
  }

  // Parse browser information from user agent
  private parseBrowserInfo(userAgent: string): { name: string; version: string } {
    const browsers = [
      { name: 'Chrome', regex: /Chrome\/(\d+\.\d+)/ },
      { name: 'Firefox', regex: /Firefox\/(\d+\.\d+)/ },
      { name: 'Safari', regex: /Safari\/(\d+\.\d+)/ },
      { name: 'Edge', regex: /Edg\/(\d+\.\d+)/ },
      { name: 'Opera', regex: /Opera\/(\d+\.\d+)/ }
    ];

    for (const browser of browsers) {
      const match = userAgent.match(browser.regex);
      if (match) {
        return { name: browser.name, version: match[1] };
      }
    }

    return { name: 'Unknown', version: '0.0' };
  }

  // Parse OS information from user agent
  private parseOSInfo(userAgent: string): { name: string; version: string } {
    const systems = [
      { name: 'Windows', regex: /Windows NT (\d+\.\d+)/ },
      { name: 'macOS', regex: /Mac OS X (\d+[._]\d+)/ },
      { name: 'Linux', regex: /Linux/ },
      { name: 'Android', regex: /Android (\d+\.\d+)/ },
      { name: 'iOS', regex: /OS (\d+_\d+)/ }
    ];

    for (const system of systems) {
      const match = userAgent.match(system.regex);
      if (match) {
        const version = match[1] ? match[1].replace('_', '.') : '0.0';
        return { name: system.name, version };
      }
    }

    return { name: 'Unknown', version: '0.0' };
  }

  // Generate friendly device name
  private generateDeviceName(type: string, browser: string, os: string): string {
    const typeMap = {
      desktop: '🖥️',
      mobile: '📱',
      tablet: '📱'
    };
    
    return `${typeMap[type as keyof typeof typeMap] || '💻'} ${browser} on ${os}`;
  }

  /**
   * @description A placeholder function to get the user's IP address without making external API calls.
   * @returns A default IP address.
   */
  async getUserIP(): Promise<string> {
    console.warn('getUserIP: Skipping external IP lookup due to environment constraints or CORS.');
    return '0.0.0.0';
  }

  /**
   * @description A placeholder function to get the user's location without making external API calls.
   * @returns Always returns null.
   */
  async getLocationFromIP(ip: string): Promise<any> {
    console.warn('getLocationFromIP: Skipping external location lookup due to environment constraints or CORS.');
    return null;
  }

  // Register device for current user
  async registerDevice(userId: string): Promise<string | null> {
    try {
      const deviceInfo = await this.getDeviceInfo();
      
      let ip = '0.0.0.0';
      let location = null;
      
      try {
        ip = await this.getUserIP();
        if (ip !== '0.0.0.0') {
          location = await this.getLocationFromIP(ip);
        }
      } catch (networkError) {
        console.warn('Network requests failed during device registration:', networkError);
      }

      let data, error;
      
      try {
        const rpcResult = await supabase.rpc('register_device', {
          user_uuid: userId,
          device_fingerprint_param: deviceInfo.fingerprint,
          device_name_param: deviceInfo.name,
          device_type_param: deviceInfo.type,
          browser_name_param: deviceInfo.browser.name,
          browser_version_param: deviceInfo.browser.version,
          os_name_param: deviceInfo.os.name,
          os_version_param: deviceInfo.os.version,
          screen_resolution_param: deviceInfo.screen.resolution,
          timezone_param: deviceInfo.timezone,
          language_param: deviceInfo.language,
          ip_address_param: ip,
          location_param: location
        });
        
        data = rpcResult.data;
        error = rpcResult.error;
      } catch (rpcError) {
        console.warn('RPC function register_device not available, using direct table insert:', rpcError);
        
        const { data: existingDevice, error: selectError } = await supabase
          .from('user_devices')
          .select('id')
          .eq('user_id', userId)
          .eq('device_fingerprint', deviceInfo.fingerprint)
          .maybeSingle();
        
        if (selectError) {
          console.error('Error checking existing device:', selectError);
          return null;
        }
        
        if (existingDevice) {
          const { data: updateData, error: updateError } = await supabase
            .from('user_devices')
            .update({
              last_seen_at: new Date().toISOString(),
              last_ip_address: ip,
              last_location: location
            })
            .eq('id', existingDevice.id)
            .select('id')
            .single();
          
          data = updateData?.id;
          error = updateError;
        } else {
          const { data: insertData, error: insertError } = await supabase
            .from('user_devices')
            .insert({
              user_id: userId,
              device_fingerprint: deviceInfo.fingerprint,
              device_name: deviceInfo.name,
              device_type: deviceInfo.type,
              browser_name: deviceInfo.browser.name,
              browser_version: deviceInfo.browser.version,
              os_name: deviceInfo.os.name,
              os_version: deviceInfo.os.version,
              screen_resolution: deviceInfo.screen.resolution,
              timezone: deviceInfo.timezone,
              language: deviceInfo.language,
              last_ip_address: ip,
              last_location: location,
              is_trusted: false,
              is_active: true
            })
            .select('id')
            .single();
          
          data = insertData?.id;
          error = insertError;
        }
      }

      if (error) {
        console.error('Error registering device:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in registerDevice:', error);
      return null;
    }
  }

  // Create session for device
  async createSession(userId: string, deviceId: string, sessionToken: string): Promise<string | null> {
    try {
      let ip = '0.0.0.0';
      let location = null;
      
      try {
        ip = await this.getUserIP();
        if (ip !== '0.0.0.0') {
          location = await this.getLocationFromIP(ip);
        }
      } catch (networkError) {
        console.warn('Network requests failed during session creation:', networkError);
      }

      let data, error;
      
      try {
        const rpcResult = await supabase.rpc('create_session', {
          user_uuid: userId,
          device_uuid: deviceId,
          session_token_param: sessionToken,
          ip_address_param: ip,
          user_agent_param: navigator.userAgent,
          location_param: location
        });
        
        data = rpcResult.data;
        error = rpcResult.error;
      } catch (rpcError) {
        console.warn('RPC function create_session not available, using direct table insert:', rpcError);
        
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        const { data: insertData, error: insertError } = await supabase
          .from('user_sessions')
          .insert({
            user_id: userId,
            device_id: deviceId,
            session_token: sessionToken,
            ip_address: ip,
            user_agent: navigator.userAgent,
            location: location,
            is_active: true,
            expires_at: expiresAt.toISOString(),
            last_activity_at: new Date().toISOString()
          })
          .select('id')
          .single();
        
        data = insertData?.id;
        error = insertError;
      }

      if (error) {
        console.error('Error creating session:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in createSession:', error);
      return null;
    }
  }

  // End session
  async endSession(sessionToken: string, reason: string = 'logout'): Promise<boolean> {
    try {
      let data, error;
      
      try {
        const rpcResult = await supabase.rpc('end_session', {
          session_token_param: sessionToken,
          end_reason_param: reason
        });
        
        data = rpcResult.data;
        error = rpcResult.error;
      } catch (rpcError) {
        console.warn('RPC function end_session not available, using direct table update:', rpcError);
        
        const { data: updateData, error: updateError } = await supabase
          .from('user_sessions')
          .update({
            is_active: false,
            ended_at: new Date().toISOString(),
            end_reason: reason
          })
          .eq('session_token', sessionToken)
          .eq('is_active', true);
        
        data = updateData;
        error = updateError;
      }

      if (error) {
        console.error('Error ending session:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in endSession:', error);
      return false;
    }
  }

  // Log device activity
  async logActivity(
    userId: string,
    activityType: string,
    details?: any,
    deviceId?: string,
    sessionId?: string
  ): Promise<void> {
    try {
      let ip = '0.0.0.0';
      let location = null;
      
      try {
        ip = await this.getUserIP();
        if (ip !== '0.0.0.0') {
          location = await this.getLocationFromIP(ip);
        }
      } catch (networkError) {
        console.warn('Network requests failed during activity logging:', networkError);
      }
      
      const riskScore = await this.calculateRiskScore(userId, ip, location);

      try {
        await supabase.rpc('log_device_activity', {
          user_uuid: userId,
          device_uuid: deviceId,
          session_uuid: sessionId,
          activity_type_param: activityType,
          activity_details_param: details,
          ip_address_param: ip,
          location_param: location,
          user_agent_param: navigator.userAgent,
          risk_score_param: riskScore
        });
      } catch (rpcError) {
        console.warn('RPC function log_device_activity not available, using direct table insert:', rpcError);
        
        await supabase
          .from('device_activity_logs')
          .insert({
            user_id: userId,
            device_id: deviceId,
            session_id: sessionId,
            activity_type: activityType,
            activity_details: details,
            ip_address: ip,
            location: location,
            user_agent: navigator.userAgent,
            risk_score: riskScore
          });
      }
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }

  // Calculate risk score for activity
   private async calculateRiskScore(userId: string, ip: string, location: Location | null): Promise<number> {
    try {
      try {
        const { data, error } = await supabase.rpc('detect_suspicious_activity', {
          user_uuid: userId,
          ip_address_param: ip,
          location_param: location,
          user_agent_param: navigator.userAgent
        });

        if (error) {
          if (error.message?.includes('function') || error.message?.includes('does not exist')) {
            console.warn('Risk scoring function not available, using default score');
            return 0;
          }
          console.error('Error calculating risk score:', error);
          return 0;
        }

        return data || 0;
      } catch (rpcError) {
        console.warn('Risk scoring RPC call failed, using default score:', rpcError);
        return 0;
      }
    } catch (error) {
      console.error('Error in calculateRiskScore:', error);
      return 0;
    }
  }

  // Get user's devices
  async getUserDevices(userId: string): Promise<UserDevice[]> {
    try {
      let data, error;
      
      try {
        const rpcResult = await supabase.rpc('get_user_devices', {
          user_uuid: userId
        });
        
        data = rpcResult.data;
        error = rpcResult.error;
      } catch (rpcError) {
        console.warn('RPC function get_user_devices not available, using direct table query:', rpcError);
        
        const { data: queryData, error: queryError } = await supabase
          .from('user_devices')
          .select(`
            id,
            device_name,
            device_type,
            browser_name,
            os_name,
            is_trusted,
            last_seen_at,
            last_location
          `)
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('last_seen_at', { ascending: false });
        
        data = queryData?.map(device => ({
          device_id: device.id,
          device_name: device.device_name,
          device_type: device.device_type,
          browser_name: device.browser_name,
          os_name: device.os_name,
          is_trusted: device.is_trusted,
          last_seen_at: device.last_seen_at,
          last_location: device.last_location,
          active_sessions: 0
        }));
        error = queryError;
      }

      if (error) {
        console.error('Error getting user devices:', error);
        return [];
      }

      return data.map((device: any) => ({
        id: device.device_id,
        deviceName: device.device_name,
        deviceType: device.device_type,
        browserName: device.browser_name,
        osName: device.os_name,
        isTrusted: device.is_trusted,
        lastSeenAt: device.last_seen_at,
        lastLocation: device.last_location,
        activeSessions: device.active_sessions
      }));
    } catch (error) {
      console.error('Error in getUserDevices:', error);
      return [];
    }
  }

  // Get user's active sessions
  async getUserSessions(userId: string): Promise<UserSession[]> {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select(`
          id,
          device_id,
          ip_address,
          user_agent,
          location,
          is_active,
          expires_at,
          last_activity_at,
          created_at
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_activity_at', { ascending: false });

      if (error) {
        console.error('Error getting user sessions:', error);
        return [];
      }

      return data.map((session: any) => ({
        id: session.id,
        deviceId: session.device_id,
        ipAddress: session.ip_address,
        userAgent: session.user_agent,
        location: session.location,
        isActive: session.is_active,
        expiresAt: session.expires_at,
        lastActivityAt: session.last_activity_at,
        createdAt: session.created_at
      }));
    } catch (error) {
      console.error('Error in getUserSessions:', error);
      return [];
    }
  }

  // Get user's activity logs
  async getUserActivityLogs(userId: string, limit: number = 50): Promise<ActivityLog[]> {
    try {
      const { data, error } = await supabase
        .from('device_activity_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error getting activity logs:', error);
        return [];
      }

      return data.map((log: any) => ({
        id: log.id,
        activityType: log.activity_type,
        activityDetails: log.activity_details,
        ipAddress: log.ip_address,
        location: log.location,
        riskScore: log.risk_score,
        createdAt: log.created_at
      }));
    } catch (error) {
      console.error('Error in getUserActivityLogs:', error);
      return [];
    }
  }

  // Trust a device
  async trustDevice(deviceId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_devices')
        .update({ is_trusted: true })
        .eq('id', deviceId);

      if (error) {
        console.error('Error trusting device:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in trustDevice:', error);
      return false;
    }
  }

  // Remove device
  async removeDevice(deviceId: string): Promise<boolean> {
    try {
      await supabase.rpc('end_session', {
        session_token_param: null,
        end_reason_param: 'device_removed'
      });

      const { error } = await supabase
        .from('user_devices')
        .update({ is_active: false })
        .eq('id', deviceId);

      if (error) {
        console.error('Error removing device:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in removeDevice:', error);
      return false;
    }
  }

  // End specific session
  async endSpecificSession(sessionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({
          is_active: false,
          ended_at: new Date().toISOString(),
          end_reason: 'manual_logout'
        })
        .eq('id', sessionId);

      if (error) {
        console.error('Error ending session:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in endSpecificSession:', error);
      return false;
    }
  }

  // End all other sessions (keep current)
  async endAllOtherSessions(userId: string, currentSessionToken: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({
          is_active: false,
          ended_at: new Date().toISOString(),
          end_reason: 'logout_all_others'
        })
        .eq('user_id', userId)
        .neq('session_token', currentSessionToken)
        .eq('is_active', true);

      if (error) {
        console.error('Error ending other sessions:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in endAllOtherSessions:', error);
      return false;
    }
  }
}

export const deviceTrackingService = new DeviceTrackingService();
