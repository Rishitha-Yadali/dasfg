/*
  # IP Address Tracking for Coupon Usage

  1. New Table
    - `ip_coupon_usage` - Track IP addresses that have used specific coupons
      - `id` (uuid, primary key)
      - `ip_address` (inet, not null) - IP address of the user
      - `coupon_code` (text, not null) - Coupon code used
      - `user_id` (uuid, references user_profiles.id) - User who used the coupon
      - `used_at` (timestamptz, default now()) - When the coupon was used
      
  2. Purpose
    - Prevent abuse of one-time coupons like FREETRIAL
    - Block multiple accounts from same IP using free trial
    - Track coupon usage patterns
    
  3. Security
    - Enable RLS on table
    - Only service role can access this table
*/

-- Create ip_coupon_usage table
CREATE TABLE IF NOT EXISTS ip_coupon_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address inet NOT NULL,
  coupon_code text NOT NULL,
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  used_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE ip_coupon_usage ENABLE ROW LEVEL SECURITY;

-- Create policy for service role only
CREATE POLICY "Only service role can access IP tracking"
  ON ip_coupon_usage
  FOR ALL
  TO service_role
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS ip_coupon_usage_ip_idx ON ip_coupon_usage(ip_address);
CREATE INDEX IF NOT EXISTS ip_coupon_usage_coupon_idx ON ip_coupon_usage(coupon_code);
CREATE INDEX IF NOT EXISTS ip_coupon_usage_user_idx ON ip_coupon_usage(user_id);

-- Function to check if IP has used a specific coupon
CREATE OR REPLACE FUNCTION has_ip_used_coupon(
  ip_address_param inet,
  coupon_code_param text
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM ip_coupon_usage
    WHERE ip_address = ip_address_param
      AND coupon_code = coupon_code_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has used a specific coupon
CREATE OR REPLACE FUNCTION has_user_used_coupon(
  user_uuid uuid,
  coupon_code_param text
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = user_uuid
      AND coupon_used = coupon_code_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate coupon eligibility
CREATE OR REPLACE FUNCTION validate_coupon_eligibility(
  user_uuid uuid,
  ip_address_param inet,
  coupon_code_param text
)
RETURNS TABLE (
  is_eligible boolean,
  message text
) AS $$
DECLARE
  user_used boolean;
  ip_used boolean;
BEGIN
  -- Check if user has used this coupon before
  SELECT has_user_used_coupon(user_uuid, coupon_code_param) INTO user_used;
  
  -- Check if IP has used this coupon before
  SELECT has_ip_used_coupon(ip_address_param, coupon_code_param) INTO ip_used;
  
  -- Determine eligibility
  IF user_used THEN
    RETURN QUERY SELECT false, 'You have already used this coupon code.'::text;
  ELSIF ip_used THEN
    RETURN QUERY SELECT false, 'This coupon has already been used from your network.'::text;
  ELSE
    RETURN QUERY SELECT true, 'Coupon is eligible for use.'::text;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;