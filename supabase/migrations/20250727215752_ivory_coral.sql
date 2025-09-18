/*
  # Create Wallet System with Referral Support

  1. New Tables
    - `wallet_transactions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to user_profiles.id)
      - `source_user_id` (uuid, nullable, for referral tracking)
      - `type` (text, transaction type)
      - `amount` (numeric, positive for earnings, negative for spending)
      - `status` (text, transaction status)
      - `redeem_method` (text, nullable, for redemptions)
      - `redeem_details` (jsonb, nullable, redemption details)
      - `transaction_ref` (text, nullable, external reference)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Functions
    - `credit_referral_signup_bonus()` - Credits ₹10 for valid referral codes
    - `update_wallet_updated_at()` - Updates timestamp on changes

  3. Triggers
    - `on_new_user_referral_credit` - Automatically processes referral bonuses
    - `update_wallet_transactions_updated_at` - Updates timestamps

  4. Security
    - Enable RLS on `wallet_transactions` table
    - Add policies for users to view/insert their own transactions
*/

-- Create wallet_transactions table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    source_user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    type text NOT NULL CHECK (type IN ('referral', 'redeem', 'purchase_use', 'adjustment', 'referral_signup_bonus')),
    amount numeric(10, 2) NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'processing', 'failed')),
    redeem_method text CHECK (redeem_method IN ('upi', 'bank_transfer')),
    redeem_details jsonb,
    transaction_ref text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own wallet transactions
CREATE POLICY "Users can view their own wallet transactions" ON public.wallet_transactions
FOR SELECT USING (user_id IN (
    SELECT id FROM public.user_profiles WHERE user_id = auth.uid()
));

-- RLS Policy: Users can insert their own transactions (redemptions)
CREATE POLICY "Users can insert their own transactions" ON public.wallet_transactions
FOR INSERT WITH CHECK (user_id IN (
    SELECT id FROM public.user_profiles WHERE user_id = auth.uid()
) AND type IN ('redeem', 'purchase_use'));

-- RLS Policy: System can insert any transaction (for referral bonuses)
CREATE POLICY "System can insert transactions" ON public.wallet_transactions
FOR INSERT WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON public.wallet_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status ON public.wallet_transactions (status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON public.wallet_transactions (type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON public.wallet_transactions (created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_wallet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on wallet_transactions
CREATE TRIGGER update_wallet_transactions_updated_at
    BEFORE UPDATE ON public.wallet_transactions
    FOR EACH ROW EXECUTE FUNCTION public.update_wallet_updated_at();

-- Function to credit referral signup bonus
CREATE OR REPLACE FUNCTION public.credit_referral_signup_bonus()
RETURNS TRIGGER AS $$
DECLARE
    _referral_code TEXT;
    _referrer_user_profile_id UUID;
    _new_user_profile_id UUID;
BEGIN
    -- Get the referral code from the new user's raw_user_meta_data
    _referral_code := NEW.raw_user_meta_data->>'referralCode';

    -- Get the user_profile ID for the new user
    SELECT id INTO _new_user_profile_id 
    FROM public.user_profiles 
    WHERE user_id = NEW.id;

    -- Only proceed if we have a referral code and user profile
    IF _referral_code IS NOT NULL AND _referral_code != '' AND _new_user_profile_id IS NOT NULL THEN
        -- Find the referrer's user_profile ID based on the referral code (username)
        SELECT id INTO _referrer_user_profile_id 
        FROM public.user_profiles 
        WHERE username = _referral_code AND is_active = true;

        -- If referrer found, credit the signup bonus
        IF _referrer_user_profile_id IS NOT NULL THEN
            INSERT INTO public.wallet_transactions (
                user_id, 
                type, 
                amount, 
                status, 
                source_user_id,
                transaction_ref
            )
            VALUES (
                _new_user_profile_id, 
                'referral_signup_bonus', 
                10.00, 
                'completed', 
                _referrer_user_profile_id,
                'signup_bonus_' || NEW.id
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically credit referral signup bonus
CREATE TRIGGER on_new_user_referral_credit
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.credit_referral_signup_bonus();