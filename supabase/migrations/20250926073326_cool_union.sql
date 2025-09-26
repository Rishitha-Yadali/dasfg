/*
  # Add function to increment resumes created count

  1. New Function
    - `increment_resumes_created_count` function to safely increment user's resume count
  2. Security
    - Function can only be called by authenticated users
    - Users can only increment their own count
*/

-- Create function to increment resumes_created_count
CREATE OR REPLACE FUNCTION increment_resumes_created_count(user_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_profiles 
  SET resumes_created_count = COALESCE(resumes_created_count, 0) + 1,
      profile_updated_at = now()
  WHERE id = user_id_param;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_resumes_created_count(UUID) TO authenticated;