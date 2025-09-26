/*
  # Create function to increment global resume count

  1. Function: increment_total_resumes_created()
    - Atomically increments the total_resumes_created metric
    - Returns the new count value
    - Thread-safe using atomic operations

  2. Security
    - Function is accessible to authenticated users only
    - Uses SECURITY DEFINER to run with elevated privileges
*/

CREATE OR REPLACE FUNCTION increment_total_resumes_created()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count bigint;
BEGIN
  -- Atomically increment the total resumes created count
  UPDATE app_metrics 
  SET metric_value = metric_value + 1,
      updated_at = now()
  WHERE metric_name = 'total_resumes_created'
  RETURNING metric_value INTO new_count;
  
  -- If the record doesn't exist, create it
  IF new_count IS NULL THEN
    INSERT INTO app_metrics (metric_name, metric_value)
    VALUES ('total_resumes_created', 50001)
    ON CONFLICT (metric_name) DO UPDATE SET
      metric_value = app_metrics.metric_value + 1,
      updated_at = now()
    RETURNING metric_value INTO new_count;
  END IF;
  
  RETURN new_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_total_resumes_created() TO authenticated;