/*
  # Fix authentication permissions for user_profiles table

  1. Security Changes
    - Grant USAGE permission on auth schema to authenticated role
    - Grant SELECT permission on auth.users table to authenticated role
    
  This fixes the "permission denied for table users" error that occurs when
  RLS policies on user_profiles table try to access auth.users table to
  validate user permissions (e.g., checking user roles in raw_user_meta_data).
  
  The authenticated role needs these permissions to allow RLS policies to
  function correctly when they reference auth.uid() or query auth.users.
*/

-- Grant usage on the auth schema to authenticated users
GRANT USAGE ON SCHEMA auth TO authenticated;

-- Grant select permission on auth.users table to authenticated users
-- This is needed for RLS policies that check user metadata or roles
GRANT SELECT ON TABLE auth.users TO authenticated;