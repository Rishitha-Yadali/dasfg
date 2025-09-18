/*
  # Add Profile Prompt Tracking

  1. Schema Changes
    - Add `has_seen_profile_prompt` column to `user_profiles` table
    - Set default value to FALSE for new users
    - Update existing users to FALSE (they can see the prompt once)

  2. Security
    - No additional RLS policies needed as this uses existing user_profiles policies
*/

-- Add the profile prompt tracking column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'has_seen_profile_prompt'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN has_seen_profile_prompt boolean DEFAULT FALSE NOT NULL;
  END IF;
END $$;

-- Update existing users to have not seen the prompt (they can see it once)
UPDATE user_profiles SET has_seen_profile_prompt = FALSE WHERE has_seen_profile_prompt IS NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_profile_prompt ON user_profiles(has_seen_profile_prompt);