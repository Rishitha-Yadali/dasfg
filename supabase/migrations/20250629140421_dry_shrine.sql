/*
  # Device Tracking and Session Management System

  1. New Tables
    - `user_devices` - Track user devices and their metadata
    - `user_sessions` - Manage active sessions across devices
    - `device_activity_logs` - Log all device-related activities

  2. Security
    - Enable RLS on all tables
    - Add policies for users to manage their own data
    - Service role policies for system operations

  3. Functions
    - Device registration and fingerprinting
    - Session management with limits
    - Activity logging and risk assessment
    - Suspicious activity detection
*/

-- Create user_devices table
CREATE TABLE IF NOT EXISTS user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  device_fingerprint text NOT NULL,
  device_name text,
  device_type text, -- 'desktop', 'mobile', 'tablet'
  browser_name text,
  browser_version text,
  os_name text,
  os_version text,
  screen_resolution text,
  timezone text,
  language text,
  is_trusted boolean DEFAULT false NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  last_seen_at timestamptz DEFAULT now() NOT NULL,
  last_ip_address inet,
  last_location jsonb, -- {country, region, city, lat, lng}
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE(user_id, device_fingerprint)
);

-- Create user_sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  device_id uuid REFERENCES user_devices(id) ON DELETE CASCADE NOT NULL,
  session_token text NOT NULL,
  refresh_token text,
  ip_address inet NOT NULL,
  user_agent text NOT NULL,
  location jsonb, -- {country, region, city, lat, lng}
  is_active boolean DEFAULT true NOT NULL,
  expires_at timestamptz NOT NULL,
  last_activity_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  ended_at timestamptz,
  end_reason text, -- 'logout', 'timeout', 'security', 'device_limit'
  
  UNIQUE(session_token)
);

-- Create device_activity_logs table
CREATE TABLE IF NOT EXISTS device_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  device_id uuid REFERENCES user_devices(id) ON DELETE CASCADE,
  session_id uuid REFERENCES user_sessions(id) ON DELETE CASCADE,
  activity_type text NOT NULL, -- 'login', 'logout', 'device_registered', 'device_trusted', 'suspicious_activity'
  activity_details jsonb,
  ip_address inet,
  location jsonb,
  user_agent text,
  risk_score integer DEFAULT 0, -- 0-100, higher = more suspicious
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_activity_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for user_devices
CREATE POLICY "Users can view own devices"
  ON user_devices
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own devices"
  ON user_devices
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can manage devices"
  ON user_devices
  FOR ALL
  TO service_role
  USING (true);

-- Create policies for user_sessions
CREATE POLICY "Users can view own sessions"
  ON user_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can manage sessions"
  ON user_sessions
  FOR ALL
  TO service_role
  USING (true);

-- Create policies for device_activity_logs
CREATE POLICY "Users can view own activity logs"
  ON device_activity_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can manage activity logs"
  ON device_activity_logs
  FOR ALL
  TO service_role
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS user_devices_user_id_idx ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS user_devices_fingerprint_idx ON user_devices(device_fingerprint);
CREATE INDEX IF NOT EXISTS user_devices_last_seen_idx ON user_devices(last_seen_at);
CREATE INDEX IF NOT EXISTS user_devices_is_active_idx ON user_devices(is_active);

CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS user_sessions_device_id_idx ON user_sessions(device_id);
CREATE INDEX IF NOT EXISTS user_sessions_token_idx ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS user_sessions_active_idx ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS user_sessions_expires_idx ON user_sessions(expires_at);

CREATE INDEX IF NOT EXISTS device_activity_logs_user_id_idx ON device_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS device_activity_logs_device_id_idx ON device_activity_logs(device_id);
CREATE INDEX IF NOT EXISTS device_activity_logs_type_idx ON device_activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS device_activity_logs_created_idx ON device_activity_logs(created_at);
CREATE INDEX IF NOT EXISTS device_activity_logs_risk_idx ON device_activity_logs(risk_score);

-- Function to update device timestamp
CREATE OR REPLACE FUNCTION update_device_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for device timestamp updates
CREATE TRIGGER update_user_devices_timestamp
  BEFORE UPDATE ON user_devices
  FOR EACH ROW
  EXECUTE FUNCTION update_device_timestamp();

-- Function to generate device fingerprint
CREATE OR REPLACE FUNCTION generate_device_fingerprint(
  user_agent_param text,
  screen_resolution_param text,
  timezone_param text,
  language_param text
)
RETURNS text AS $$
BEGIN
  RETURN encode(
    digest(
      COALESCE(user_agent_param, '') || '|' ||
      COALESCE(screen_resolution_param, '') || '|' ||
      COALESCE(timezone_param, '') || '|' ||
      COALESCE(language_param, ''),
      'sha256'
    ),
    'hex'
  );
END;
$$ LANGUAGE plpgsql;

-- Function to register or update device
CREATE OR REPLACE FUNCTION register_device(
  user_uuid uuid,
  device_fingerprint_param text,
  device_name_param text DEFAULT NULL,
  device_type_param text DEFAULT NULL,
  browser_name_param text DEFAULT NULL,
  browser_version_param text DEFAULT NULL,
  os_name_param text DEFAULT NULL,
  os_version_param text DEFAULT NULL,
  screen_resolution_param text DEFAULT NULL,
  timezone_param text DEFAULT NULL,
  language_param text DEFAULT NULL,
  ip_address_param inet DEFAULT NULL,
  location_param jsonb DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  device_id uuid;
BEGIN
  -- Insert or update device
  INSERT INTO user_devices (
    user_id,
    device_fingerprint,
    device_name,
    device_type,
    browser_name,
    browser_version,
    os_name,
    os_version,
    screen_resolution,
    timezone,
    language,
    last_seen_at,
    last_ip_address,
    last_location
  )
  VALUES (
    user_uuid,
    device_fingerprint_param,
    device_name_param,
    device_type_param,
    browser_name_param,
    browser_version_param,
    os_name_param,
    os_version_param,
    screen_resolution_param,
    timezone_param,
    language_param,
    now(),
    ip_address_param,
    location_param
  )
  ON CONFLICT (user_id, device_fingerprint)
  DO UPDATE SET
    device_name = COALESCE(EXCLUDED.device_name, user_devices.device_name),
    device_type = COALESCE(EXCLUDED.device_type, user_devices.device_type),
    browser_name = COALESCE(EXCLUDED.browser_name, user_devices.browser_name),
    browser_version = COALESCE(EXCLUDED.browser_version, user_devices.browser_version),
    os_name = COALESCE(EXCLUDED.os_name, user_devices.os_name),
    os_version = COALESCE(EXCLUDED.os_version, user_devices.os_version),
    screen_resolution = COALESCE(EXCLUDED.screen_resolution, user_devices.screen_resolution),
    timezone = COALESCE(EXCLUDED.timezone, user_devices.timezone),
    language = COALESCE(EXCLUDED.language, user_devices.language),
    last_seen_at = now(),
    last_ip_address = COALESCE(EXCLUDED.last_ip_address, user_devices.last_ip_address),
    last_location = COALESCE(EXCLUDED.last_location, user_devices.last_location),
    is_active = true,
    updated_at = now()
  RETURNING id INTO device_id;

  RETURN device_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create session
CREATE OR REPLACE FUNCTION create_session(
  user_uuid uuid,
  device_uuid uuid,
  session_token_param text,
  refresh_token_param text DEFAULT NULL,
  ip_address_param inet DEFAULT NULL,
  user_agent_param text DEFAULT NULL,
  location_param jsonb DEFAULT NULL,
  expires_at_param timestamptz DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  session_id uuid;
  max_sessions integer := 5; -- Maximum sessions per user
  session_count integer;
BEGIN
  -- Check current active session count
  SELECT COUNT(*) INTO session_count
  FROM user_sessions
  WHERE user_id = user_uuid AND is_active = true;

  -- If at limit, end oldest session
  IF session_count >= max_sessions THEN
    UPDATE user_sessions
    SET is_active = false,
        ended_at = now(),
        end_reason = 'device_limit'
    WHERE id = (
      SELECT id FROM user_sessions
      WHERE user_id = user_uuid AND is_active = true
      ORDER BY last_activity_at ASC
      LIMIT 1
    );
  END IF;

  -- Create new session
  INSERT INTO user_sessions (
    user_id,
    device_id,
    session_token,
    refresh_token,
    ip_address,
    user_agent,
    location,
    expires_at
  )
  VALUES (
    user_uuid,
    device_uuid,
    session_token_param,
    refresh_token_param,
    ip_address_param,
    user_agent_param,
    location_param,
    COALESCE(expires_at_param, now() + interval '24 hours')
  )
  RETURNING id INTO session_id;

  RETURN session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to end session (fixed version without GET DIAGNOSTICS)
CREATE OR REPLACE FUNCTION end_session(
  session_token_param text,
  end_reason_param text DEFAULT 'logout'
)
RETURNS boolean AS $$
DECLARE
  updated_count integer;
BEGIN
  -- Update the session and count affected rows
  WITH updated_sessions AS (
    UPDATE user_sessions
    SET is_active = false,
        ended_at = now(),
        end_reason = end_reason_param
    WHERE session_token = session_token_param AND is_active = true
    RETURNING id
  )
  SELECT COUNT(*) INTO updated_count FROM updated_sessions;

  -- Return true if at least one row was updated
  RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log device activity
CREATE OR REPLACE FUNCTION log_device_activity(
  user_uuid uuid,
  device_uuid uuid DEFAULT NULL,
  session_uuid uuid DEFAULT NULL,
  activity_type_param text DEFAULT NULL,
  activity_details_param jsonb DEFAULT NULL,
  ip_address_param inet DEFAULT NULL,
  location_param jsonb DEFAULT NULL,
  user_agent_param text DEFAULT NULL,
  risk_score_param integer DEFAULT 0
)
RETURNS uuid AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO device_activity_logs (
    user_id,
    device_id,
    session_id,
    activity_type,
    activity_details,
    ip_address,
    location,
    user_agent,
    risk_score
  )
  VALUES (
    user_uuid,
    device_uuid,
    session_uuid,
    activity_type_param,
    activity_details_param,
    ip_address_param,
    location_param,
    user_agent_param,
    risk_score_param
  )
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's active devices
CREATE OR REPLACE FUNCTION get_user_devices(user_uuid uuid)
RETURNS TABLE (
  device_id uuid,
  device_name text,
  device_type text,
  browser_name text,
  os_name text,
  is_trusted boolean,
  last_seen_at timestamptz,
  last_location jsonb,
  active_sessions integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.device_name,
    d.device_type,
    d.browser_name,
    d.os_name,
    d.is_trusted,
    d.last_seen_at,
    d.last_location,
    COALESCE(s.session_count, 0)::integer
  FROM user_devices d
  LEFT JOIN (
    SELECT 
      device_id,
      COUNT(*) as session_count
    FROM user_sessions
    WHERE is_active = true
    GROUP BY device_id
  ) s ON d.id = s.device_id
  WHERE d.user_id = user_uuid AND d.is_active = true
  ORDER BY d.last_seen_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to detect suspicious activity
CREATE OR REPLACE FUNCTION detect_suspicious_activity(
  user_uuid uuid,
  ip_address_param inet,
  location_param jsonb,
  user_agent_param text
)
RETURNS integer AS $$
DECLARE
  risk_score integer := 0;
  recent_locations jsonb[];
  location_count integer;
  recent_ips inet[];
  ip_count integer;
BEGIN
  -- Check for multiple locations in short time
  SELECT array_agg(DISTINCT last_location) INTO recent_locations
  FROM user_devices
  WHERE user_id = user_uuid 
    AND last_seen_at > now() - interval '1 hour'
    AND last_location IS NOT NULL;

  location_count := array_length(recent_locations, 1);
  IF location_count > 2 THEN
    risk_score := risk_score + 30;
  END IF;

  -- Check for multiple IP addresses
  SELECT array_agg(DISTINCT last_ip_address) INTO recent_ips
  FROM user_devices
  WHERE user_id = user_uuid 
    AND last_seen_at > now() - interval '1 hour'
    AND last_ip_address IS NOT NULL;

  ip_count := array_length(recent_ips, 1);
  IF ip_count > 3 THEN
    risk_score := risk_score + 25;
  END IF;

  -- Check for new device
  IF NOT EXISTS (
    SELECT 1 FROM user_devices
    WHERE user_id = user_uuid 
      AND last_ip_address = ip_address_param
      AND created_at < now() - interval '1 day'
  ) THEN
    risk_score := risk_score + 20;
  END IF;

  -- Check for unusual time (outside normal hours)
  IF EXTRACT(hour FROM now()) < 6 OR EXTRACT(hour FROM now()) > 23 THEN
    risk_score := risk_score + 15;
  END IF;

  RETURN LEAST(risk_score, 100);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to end all sessions for a user except current
CREATE OR REPLACE FUNCTION end_other_sessions(
  user_uuid uuid,
  current_session_token text
)
RETURNS integer AS $$
DECLARE
  ended_count integer;
BEGIN
  WITH ended_sessions AS (
    UPDATE user_sessions
    SET is_active = false,
        ended_at = now(),
        end_reason = 'security'
    WHERE user_id = user_uuid 
      AND session_token != current_session_token 
      AND is_active = true
    RETURNING id
  )
  SELECT COUNT(*) INTO ended_count FROM ended_sessions;

  RETURN ended_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to trust/untrust device
CREATE OR REPLACE FUNCTION set_device_trust(
  device_uuid uuid,
  user_uuid uuid,
  is_trusted_param boolean
)
RETURNS boolean AS $$
DECLARE
  updated_count integer;
BEGIN
  WITH updated_devices AS (
    UPDATE user_devices
    SET is_trusted = is_trusted_param,
        updated_at = now()
    WHERE id = device_uuid AND user_id = user_uuid
    RETURNING id
  )
  SELECT COUNT(*) INTO updated_count FROM updated_devices;

  RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove device and end its sessions
CREATE OR REPLACE FUNCTION remove_device(
  device_uuid uuid,
  user_uuid uuid
)
RETURNS boolean AS $$
DECLARE
  device_exists boolean := false;
BEGIN
  -- Check if device exists and belongs to user
  SELECT EXISTS(
    SELECT 1 FROM user_devices 
    WHERE id = device_uuid AND user_id = user_uuid
  ) INTO device_exists;

  IF NOT device_exists THEN
    RETURN false;
  END IF;

  -- End all active sessions for this device
  UPDATE user_sessions
  SET is_active = false,
      ended_at = now(),
      end_reason = 'device_removed'
  WHERE device_id = device_uuid AND is_active = true;

  -- Mark device as inactive
  UPDATE user_devices
  SET is_active = false,
      updated_at = now()
  WHERE id = device_uuid;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;