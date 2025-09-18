/*
  # Fix Referral Code System Migration

  This migration fixes the database conflict that was causing signup failures.
  It removes the duplicate trigger and function that conflicts with existing database logic.

  1. Changes
    - Remove duplicate auto_assign_referral_code function
    - Remove duplicate trigger that conflicts with existing system
    - Keep only the Edge Function for manual referral code generation
    - Ensure existing referral system continues to work

  2. Notes
    - The referral_code column already exists in the schema
    - The auto-assignment trigger already exists
    - This migration ensures no conflicts during user signup
*/

-- Only create the Edge Function for manual referral code generation if needed
-- The existing database triggers will handle automatic assignment

-- Drop any duplicate triggers/functions if they exist to prevent conflicts
DROP TRIGGER IF EXISTS trigger_auto_assign_referral_code ON public.user_profiles;
DROP FUNCTION IF EXISTS auto_assign_referral_code();

-- The referral_code column and existing triggers are already in place
-- No additional database changes needed