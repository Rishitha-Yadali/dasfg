
ALTER TABLE public.payment_transactions
ADD COLUMN wallet_deduction_amount INTEGER DEFAULT 0;


ALTER TABLE public.payment_transactions
ADD CONSTRAINT check_wallet_deduction_non_negative CHECK (wallet_deduction_amount >= 0);
