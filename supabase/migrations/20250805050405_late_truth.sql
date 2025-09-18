/*
  # Create Add-on System Tables

  1. New Tables
    - `addon_types`
      - `id` (uuid, primary key)
      - `name` (text, add-on display name)
      - `type_key` (text, unique identifier for code logic)
      - `unit_price` (integer, price per unit in paise)
      - `description` (text, add-on description)
      - `created_at` (timestamp)
    - `user_addon_credits`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to user_profiles)
      - `addon_type_id` (uuid, foreign key to addon_types)
      - `quantity_purchased` (integer)
      - `quantity_remaining` (integer)
      - `purchased_at` (timestamp)
      - `expires_at` (timestamp, nullable)
      - `payment_transaction_id` (uuid, foreign key to payment_transactions)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to read their own credits
    - Add policy for public to read addon types

  3. Data Population
    - Insert all current add-on types with correct type_keys*/