/*
  # Create New Authentication System Tables

  1. New Tables
    - `user_profiles` (completely new table name)
      - `id` (uuid, primary key) - References auth.users.id
      - `full_name` (text, not null) - User's complete name
      - `email_address` (text, not null) - User's email
      - `is_active` (boolean, default true) - Account status
      - `profile_created_at` (timestamptz, default now()) - Creation timestamp
      - `profile_updated_at` (timestamptz, default now()) - Last update timestamp

  2. Security
    - Enable RLS on `user_profiles` table
    - Add policies for authenticated users to manage their own data
    - Secure data access with proper permissions

  3. Functions & Triggers
    - Auto-update timestamp trigger
    - Auto-create profile on user signup
    - Handle user data management
*/

-- Create the new user_profiles table
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email_address text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  profile_created_at timestamptz DEFAULT now() NOT NULL,
  profile_updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create security policies
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can create own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can modify own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Function to automatically update the timestamp
CREATE OR REPLACE FUNCTION update_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.profile_updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for automatic timestamp updates
CREATE TRIGGER update_user_profiles_timestamp
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_timestamp();

-- Function to create profile when user signs up
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id, 
    full_name, 
    email_address, 
    is_active,
    profile_created_at, 
    profile_updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'User'),
    NEW.email,
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), user_profiles.full_name),
    email_address = NEW.email,
    profile_updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on user signup
CREATE TRIGGER create_profile_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- Create performance indexes
CREATE INDEX user_profiles_id_index ON user_profiles(id);
CREATE INDEX user_profiles_email_index ON user_profiles(email_address);
CREATE INDEX user_profiles_created_index ON user_profiles(profile_created_at);
CREATE INDEX user_profiles_active_index ON user_profiles(is_active);