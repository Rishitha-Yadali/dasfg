/*
  # Add granular subscription tracking fields

  1. New Columns
    - `score_checks_used` (integer, default 0)
    - `score_checks_total` (integer, default 0)
    - `linkedin_messages_used` (integer, default 0)
    - `linkedin_messages_total` (integer, default 0)
    - `guided_builds_used` (integer, default 0)
    - `guided_builds_total` (integer, default 0)

  2. Indexes
    - Add indexes for performance on usage tracking queries

  3. Constraints
    - Ensure used counts don't exceed total counts
    - Ensure non-negative values
*/

-- Step 1: Add new columns for granular subscription tracking
-- IF NOT EXISTS is a safe guard, but checks are good for idempotency.
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS score_checks_used INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS score_checks_total INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS linkedin_messages_used INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS linkedin_messages_total INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS guided_builds_used INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS guided_builds_total INTEGER DEFAULT 0 NOT NULL;

---

-- Step 2: Add indexes for performance, gracefully handling existence
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'subscriptions' AND indexname = 'idx_subscriptions_usage_tracking'
  ) THEN
    CREATE INDEX idx_subscriptions_usage_tracking ON public.subscriptions
    (user_id, status, score_checks_used, linkedin_messages_used, guided_builds_used);
  END IF;
END $$;

---

-- Step 3: Add check constraints to ensure data integrity
-- Wrap each ALTER TABLE ... ADD CONSTRAINT in a DO block to make it idempotent.

-- Constraint: Used counts must not exceed total counts for score checks
DO $$
BEGIN
  ALTER TABLE public.subscriptions
  ADD CONSTRAINT check_score_checks_usage CHECK (score_checks_used <= score_checks_total);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Constraint: Used counts must not exceed total counts for LinkedIn messages
DO $$
BEGIN
  ALTER TABLE public.subscriptions
  ADD CONSTRAINT check_linkedin_messages_usage CHECK (linkedin_messages_used <= linkedin_messages_total);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Constraint: Used counts must not exceed total counts for guided builds
DO $$
BEGIN
  ALTER TABLE public.subscriptions
  ADD CONSTRAINT check_guided_builds_usage CHECK (guided_builds_used <= guided_builds_total);
EXCEPTION
  WHEN duplicate_object THEN NULL;
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
  WHEN duplicate_object THEN NULL;
END $$;
