-- Drop existing policies if they exist to avoid conflicts
DO $$ 
BEGIN
    -- Try to drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view own survey subscriptions" ON survey_subscriptions;
    DROP POLICY IF EXISTS "Users can create own survey subscriptions" ON survey_subscriptions;
    DROP POLICY IF EXISTS "Users can update own survey subscriptions" ON survey_subscriptions;
    DROP POLICY IF EXISTS "Users can view own survey transactions" ON survey_payment_transactions;
    DROP POLICY IF EXISTS "Users can create own survey transactions" ON survey_payment_transactions;
EXCEPTION
    WHEN undefined_table THEN
        -- Tables don't exist yet, continue
        NULL;
END $$;

-- Create survey_subscriptions table
CREATE TABLE IF NOT EXISTS survey_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  plan_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'expired', 'cancelled')),
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  responses_used integer DEFAULT 0 NOT NULL,
  responses_total integer NOT NULL,
  payment_id text,
  coupon_used text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create survey_payment_transactions table
CREATE TABLE IF NOT EXISTS survey_payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  subscription_id uuid REFERENCES survey_subscriptions(id) ON DELETE CASCADE,
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
ALTER TABLE survey_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_payment_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for survey_subscriptions
CREATE POLICY "Users can view own survey subscriptions"
  ON survey_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own survey subscriptions"
  ON survey_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own survey subscriptions"
  ON survey_subscriptions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create policies for survey_payment_transactions
CREATE POLICY "Users can view own survey transactions"
  ON survey_payment_transactions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own survey transactions"
  ON survey_payment_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create function to update survey subscription timestamp
CREATE OR REPLACE FUNCTION update_survey_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for survey subscription timestamp updates
DROP TRIGGER IF EXISTS update_survey_subscriptions_timestamp ON survey_subscriptions;
CREATE TRIGGER update_survey_subscriptions_timestamp
  BEFORE UPDATE ON survey_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_survey_subscription_timestamp();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS survey_subscriptions_user_id_idx ON survey_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS survey_subscriptions_status_idx ON survey_subscriptions(status);
CREATE INDEX IF NOT EXISTS survey_subscriptions_end_date_idx ON survey_subscriptions(end_date);
CREATE INDEX IF NOT EXISTS survey_payment_transactions_user_id_idx ON survey_payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS survey_payment_transactions_payment_id_idx ON survey_payment_transactions(payment_id);
CREATE INDEX IF NOT EXISTS survey_payment_transactions_status_idx ON survey_payment_transactions(status);

-- Function to get active survey subscription for user
CREATE OR REPLACE FUNCTION get_active_survey_subscription(user_uuid uuid)
RETURNS TABLE (
  subscription_id uuid,
  plan_id text,
  responses_remaining integer,
  end_date timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.plan_id,
    (s.responses_total - s.responses_used) as responses_remaining,
    s.end_date
  FROM survey_subscriptions s
  WHERE s.user_id = user_uuid
    AND s.status = 'active'
    AND s.end_date > now()
  ORDER BY s.end_date DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to use survey response (decrement count)
CREATE OR REPLACE FUNCTION use_survey_response(user_uuid uuid)
RETURNS TABLE (
  success boolean,
  remaining integer,
  message text
) AS $$
DECLARE
  subscription_record survey_subscriptions%ROWTYPE;
  remaining_count integer;
BEGIN
  -- Get active subscription
  SELECT * INTO subscription_record
  FROM survey_subscriptions
  WHERE user_id = user_uuid
    AND status = 'active'
    AND end_date > now()
    AND responses_used < responses_total
  ORDER BY end_date DESC
  LIMIT 1;

  -- Check if subscription exists and has remaining responses
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'No active subscription or responses exhausted'::text;
    RETURN;
  END IF;

  -- Update response count
  UPDATE survey_subscriptions
  SET responses_used = responses_used + 1,
      updated_at = now()
  WHERE id = subscription_record.id;

  -- Calculate remaining responses
  remaining_count := subscription_record.responses_total - subscription_record.responses_used - 1;

  RETURN QUERY SELECT true, remaining_count, 'Response used successfully'::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset monthly response counts (to be triggered by cron job)
CREATE OR REPLACE FUNCTION reset_monthly_responses()
RETURNS integer AS $$
DECLARE
  updated_count integer;
BEGIN
  WITH updated_subscriptions AS (
    UPDATE survey_subscriptions
    SET responses_used = 0,
        updated_at = now()
    WHERE status = 'active'
      AND end_date > now()
      AND date_trunc('month', start_date) <> date_trunc('month', now())
    RETURNING id
  )
  SELECT COUNT(*) INTO updated_count FROM updated_subscriptions;

  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for expired subscriptions and update status
CREATE OR REPLACE FUNCTION update_expired_subscriptions()
RETURNS integer AS $$
DECLARE
  updated_count integer;
BEGIN
  WITH updated_subscriptions AS (
    UPDATE survey_subscriptions
    SET status = 'expired',
        updated_at = now()
    WHERE status = 'active'
      AND end_date < now()
    RETURNING id
  )
  SELECT COUNT(*) INTO updated_count FROM updated_subscriptions;

  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to upgrade subscription
CREATE OR REPLACE FUNCTION upgrade_survey_subscription(
  user_uuid uuid,
  new_plan_id text,
  payment_id_param text DEFAULT NULL
)
RETURNS TABLE (
  success boolean,
  subscription_id uuid,
  message text
) AS $$
DECLARE
  subscription_record survey_subscriptions%ROWTYPE;
  new_plan_responses integer;
  updated_subscription_id uuid;
BEGIN
  -- Get active subscription
  SELECT * INTO subscription_record
  FROM survey_subscriptions
  WHERE user_id = user_uuid
    AND status = 'active'
    AND end_date > now()
  ORDER BY end_date DESC
  LIMIT 1;

  -- Determine new plan responses
  CASE new_plan_id
    WHEN 'single' THEN new_plan_responses := 1;
    WHEN 'small' THEN new_plan_responses := 5;
    WHEN 'medium' THEN new_plan_responses := 10;
    WHEN 'large' THEN new_plan_responses := 25;
    WHEN 'xlarge' THEN new_plan_responses := 50;
    WHEN 'xxlarge' THEN new_plan_responses := 75;
    WHEN 'enterprise' THEN new_plan_responses := 100;
    ELSE new_plan_responses := 25; -- Default to 'large' plan
  END CASE;

  -- If no active subscription, return error
  IF subscription_record.id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, 'No active subscription found'::text;
    RETURN;
  END IF;

  -- Update subscription with new plan
  UPDATE survey_subscriptions
  SET plan_id = new_plan_id,
      responses_total = new_plan_responses,
      payment_id = COALESCE(payment_id_param, payment_id),
      updated_at = now()
  WHERE id = subscription_record.id
  RETURNING id INTO updated_subscription_id;

  RETURN QUERY SELECT true, updated_subscription_id, 'Subscription upgraded successfully'::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;