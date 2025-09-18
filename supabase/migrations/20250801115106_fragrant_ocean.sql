/*
  # Add granular subscription tracking fields

  1. New Columns
    - `score_checks_used` (integer) - Number of score checks used
    - `score_checks_total` (integer) - Total score checks available
    - `linkedin_messages_used` (integer) - Number of LinkedIn messages used
    - `linkedin_messages_total` (integer) - Total LinkedIn messages available
    - `guided_builds_used` (integer) - Number of guided builds used
    - `guided_builds_total` (integer) - Total guided builds available

  2. Purpose
    - Enable granular tracking of different subscription features
    - Support feature-specific usage limits and availability checks
    - Provide detailed analytics for subscription usage
*/

-- Step 1: Add new columns to subscriptions table
-- Using IF NOT EXISTS makes this part of the script idempotent
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS score_checks_used INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS score_checks_total INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS linkedin_messages_used INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS linkedin_messages_total INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS guided_builds_used INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS guided_builds_total INTEGER DEFAULT 0 NOT NULL;

---

-- Step 2: Add indexes for performance
-- Using IF NOT EXISTS makes this part of the script idempotent
CREATE INDEX IF NOT EXISTS idx_subscriptions_score_checks ON public.subscriptions(score_checks_used, score_checks_total);
CREATE INDEX IF NOT EXISTS idx_subscriptions_linkedin_messages ON public.subscriptions(linkedin_messages_used, linkedin_messages_total);
CREATE INDEX IF NOT EXISTS idx_subscriptions_guided_builds ON public.subscriptions(guided_builds_used, guided_builds_total);

---

-- Step 3: Add check constraints to ensure data integrity
-- Wrap each constraint addition in a DO block to handle duplicates gracefully.

-- Constraint: Used counts don't exceed total counts for score checks
DO $$
BEGIN
    ALTER TABLE public.subscriptions
    ADD CONSTRAINT check_score_checks_usage CHECK (score_checks_used <= score_checks_total);
EXCEPTION
    WHEN duplicate_object THEN NULL; -- Ignore if constraint already exists
END $$;

-- Constraint: Used counts don't exceed total counts for LinkedIn messages
DO $$
BEGIN
    ALTER TABLE public.subscriptions
    ADD CONSTRAINT check_linkedin_messages_usage CHECK (linkedin_messages_used <= linkedin_messages_total);
EXCEPTION
    WHEN duplicate_object THEN NULL; -- Ignore if constraint already exists
END $$;

-- Constraint: Used counts don't exceed total counts for guided builds
DO $$
BEGIN
    ALTER TABLE public.subscriptions
    ADD CONSTRAINT check_guided_builds_usage CHECK (guided_builds_used <= guided_builds_total);
EXCEPTION
    WHEN duplicate_object THEN NULL; -- Ignore if constraint already exists
END $$;

-- Constraint: All usage and total counts must be non-negative
DO $$
BEGIN
    ALTER TABLE public.subscriptions
    ADD CONSTRAINT check_non_negative_usage CHECK (
        score_checks_used >= 0 AND score_checks_total >= 0 AND
        linkedin_messages_used >= 0 AND linkedin_messages_total >= 0 AND
        guided_builds_used >= 0 AND guided_builds_total >= 0
    );
EXCEPTION
    WHEN duplicate_object THEN NULL; -- Ignore if constraint already exists
END $$;
