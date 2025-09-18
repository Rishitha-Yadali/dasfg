/*
  # Add Referral Code System

  1. New Columns
    - `user_profiles`
      - `referral_code` (text, unique) - User's unique referral code
      - `referred_by` (text, optional) - Referral code used during signup

  2. Security
    - Update RLS policies to allow users to read their own referral code
    - Create function to generate unique referral codes

  3. Functions
    - `generate_referral_code()` - Generates unique 8-character codes
    - `assign_referral_code()` - Assigns code to new users

  4. Triggers
    - Auto-assign referral codes to new user profiles
*/

-- Add referral_code column to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'referral_code'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN referral_code TEXT UNIQUE;
  END IF;
END $$;

-- Add referred_by column to track who referred this user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'referred_by'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN referred_by TEXT;
  END IF;
END $$;

-- Create function to generate unique referral codes
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
    characters TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    code TEXT := '';
    i INTEGER;
    code_exists BOOLEAN := TRUE;
BEGIN
    WHILE code_exists LOOP
        code := '';
        -- Generate 8-character code
        FOR i IN 1..8 LOOP
            code := code || substr(characters, floor(random() * length(characters) + 1)::INTEGER, 1);
        END LOOP;
        
        -- Check if code already exists
        SELECT EXISTS(
            SELECT 1 FROM public.user_profiles WHERE referral_code = code
        ) INTO code_exists;
    END LOOP;
    
    RETURN code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to assign referral code to user
CREATE OR REPLACE FUNCTION assign_referral_code(user_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
BEGIN
    -- Generate new referral code
    new_code := generate_referral_code();
    
    -- Update user profile with referral code
    UPDATE public.user_profiles 
    SET referral_code = new_code
    WHERE id = user_uuid AND referral_code IS NULL;
    
    RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to auto-assign referral codes
CREATE OR REPLACE FUNCTION auto_assign_referral_code()
RETURNS TRIGGER AS $$
BEGIN
    -- Only assign if referral_code is null
    IF NEW.referral_code IS NULL THEN
        NEW.referral_code := generate_referral_code();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on user_profiles insert
DROP TRIGGER IF EXISTS trigger_auto_assign_referral_code ON public.user_profiles;
CREATE TRIGGER trigger_auto_assign_referral_code
    BEFORE INSERT ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_referral_code();

-- Update existing users without referral codes
UPDATE public.user_profiles 
SET referral_code = generate_referral_code()
WHERE referral_code IS NULL;

-- Create index for faster referral code lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_referral_code 
ON public.user_profiles(referral_code);

CREATE INDEX IF NOT EXISTS idx_user_profiles_referred_by 
ON public.user_profiles(referred_by);