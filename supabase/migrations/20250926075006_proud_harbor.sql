/*
  # Create app_metrics table for global counters

  1. New Tables
    - `app_metrics`
      - `id` (uuid, primary key)
      - `metric_name` (text, unique)
      - `metric_value` (bigint)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Initial Data
    - Insert initial record for total_resumes_created starting at 50000

  3. Security
    - Enable RLS on `app_metrics` table
    - Add policy for public read access (for displaying stats)
    - Add policy for system role write access (for incrementing)
*/

CREATE TABLE IF NOT EXISTS app_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text UNIQUE NOT NULL,
  metric_value bigint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_metrics ENABLE ROW LEVEL SECURITY;

-- Allow public read access for displaying stats
CREATE POLICY "Public can read app metrics"
  ON app_metrics
  FOR SELECT
  TO public
  USING (true);

-- Allow service role to update metrics
CREATE POLICY "Service role can update app metrics"
  ON app_metrics
  FOR UPDATE
  TO service_role
  USING (true);

-- Allow service role to insert metrics
CREATE POLICY "Service role can insert app metrics"
  ON app_metrics
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Insert initial record for total resumes created
INSERT INTO app_metrics (metric_name, metric_value) 
VALUES ('total_resumes_created', 50000)
ON CONFLICT (metric_name) DO NOTHING;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_app_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_app_metrics_updated_at_trigger
  BEFORE UPDATE ON app_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_app_metrics_updated_at();