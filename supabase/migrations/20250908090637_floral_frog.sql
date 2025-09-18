/*
  # Add job_listing_id column to job_applications table

  1. New Columns
    - `job_listing_id` (text) - Stores the unique identifier for job listings (e.g., "frontend-developer-intern")

  2. Indexes
    - Add index on `job_listing_id` for faster lookups

  3. Notes
    - This column will store the job ID from the careers page application form
    - Allows tracking which specific job listing each application is for
*/

-- Add job_listing_id column to job_applications table
ALTER TABLE public.job_applications
ADD COLUMN IF NOT EXISTS job_listing_id TEXT;

-- Add an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_job_applications_job_listing_id 
ON public.job_applications (job_listing_id);

-- Add a comment to document the column purpose
COMMENT ON COLUMN public.job_applications.job_listing_id IS 'Unique identifier for the job listing (e.g., frontend-developer-intern)';