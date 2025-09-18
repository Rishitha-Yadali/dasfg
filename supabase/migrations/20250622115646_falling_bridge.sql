/*
  # Payment and Subscription System

  1. New Tables
    - `subscriptions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles.id)
      - `plan_id` (text, not null) - Plan identifier (daily, weekly, monthly, yearly)
      - `status` (text, not null) - Subscription status (active, expired, cancelled)
      - `start_date` (timestamptz, not null) - Subscription start date
      - `end_date` (timestamptz, not null) - Subscription end date
      - `optimizations_used` (integer, default 0) - Number of optimizations used
      - `optimizations_total` (integer, not null) - Total optimizations allowed
      - `payment_id` (text, nullable) - Razorpay payment ID
      - `coupon_used` (text, nullable) - Coupon code used
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

    - `payment_transactions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles.id)
      - `subscription_id` (uuid, references subscriptions.id)
      - `payment_id` (text, not null) - Razorpay payment ID
      - `order_id` (text, not null) - Razorpay order ID
      - `amount` (integer, not null) - Amount in paise
      - `currency` (text, default 'INR')
      - `status` (text, not null) - Payment status (success, failed, pending)
      - `coupon_code` (text, nullable) - Applied coupon code
      - `discount_amount` (integer, default 0) - Discount amount in paise
      - `final_amount` (integer, not null) - Final amount paid in paise
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on all tables
    - Add policies for users to manage their own data

  3. Functions
    - Auto-update timestamp triggers
    - Helper functions for subscription management
*/

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  plan_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'expired', 'cancelled')),
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  optimizations_used integer DEFAULT 0 NOT NULL,
  optimizations_total integer NOT NULL,
  payment_id text,
  coupon_used text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create payment_transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE CASCADE,
  payment_id text NOT NULL,
  order_id text NOT NULL,
  amount integer NOT NULL,
  currency text DEFAULT 'INR' NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  coupon_code text,
  discount_amount integer DEFAULT 0 NOT NULL,
  final_amount integer NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own subscriptions"
  ON subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own subscriptions"
  ON subscriptions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create policies for payment_transactions
CREATE POLICY "Users can view own transactions"
  ON payment_transactions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own transactions"
  ON payment_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create function to update subscription timestamp
CREATE OR REPLACE FUNCTION update_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for subscription timestamp updates
CREATE TRIGGER update_subscriptions_timestamp
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_timestamp();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);
CREATE INDEX IF NOT EXISTS subscriptions_end_date_idx ON subscriptions(end_date);
CREATE INDEX IF NOT EXISTS payment_transactions_user_id_idx ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS payment_transactions_payment_id_idx ON payment_transactions(payment_id);
CREATE INDEX IF NOT EXISTS payment_transactions_status_idx ON payment_transactions(status);

-- Function to get active subscription for user
CREATE OR REPLACE FUNCTION get_active_subscription(user_uuid uuid)
RETURNS TABLE (
  subscription_id uuid,
  plan_id text,
  optimizations_remaining integer,
  end_date timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.plan_id,
    (s.optimizations_total - s.optimizations_used) as optimizations_remaining,
    s.end_date
  FROM subscriptions s
  WHERE s.user_id = user_uuid
    AND s.status = 'active'
    AND s.end_date > now()
  ORDER BY s.end_date DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to use optimization (decrement count)
CREATE OR REPLACE FUNCTION use_optimization(user_uuid uuid)
RETURNS TABLE (
  success boolean,
  remaining integer,
  message text
) AS $$
DECLARE
  subscription_record subscriptions%ROWTYPE;
  remaining_count integer;
BEGIN
  -- Get active subscription
  SELECT * INTO subscription_record
  FROM subscriptions
  WHERE user_id = user_uuid
    AND status = 'active'
    AND end_date > now()
    AND optimizations_used < optimizations_total
  ORDER BY end_date DESC
  LIMIT 1;

  -- Check if subscription exists and has remaining optimizations
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'No active subscription or optimizations exhausted'::text;
    RETURN;
  END IF;

  -- Update optimization count
  UPDATE subscriptions
  SET optimizations_used = optimizations_used + 1,
      updated_at = now()
  WHERE id = subscription_record.id;

  -- Calculate remaining optimizations
  remaining_count := subscription_record.optimizations_total - subscription_record.optimizations_used - 1;

  RETURN QUERY SELECT true, remaining_count, 'Optimization used successfully'::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;