import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, amount, redeemMethod, redeemDetails } = await req.json();

    // Validate input
    if (!userId || !amount || !redeemMethod || !redeemDetails) {
      throw new Error('Missing required redemption details.');
    }

    // Initialize Supabase client with service role key for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user via JWT from request header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authorization header missing.');
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized: Invalid user token.');
    }

    // Get user's profile for email and name
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, full_name, email_address')
      .eq('user_id', user.id)
      .single();

    if (profileError || !userProfile) {
      throw new Error('Could not fetch user profile.');
    }

    // Verify user has sufficient wallet balance
    const { data: walletData, error: walletError } = await supabase
      .from('wallet_transactions')
      .select('amount')
      .eq('user_id', userProfile.id)
      .eq('status', 'completed');

    if (walletError) {
      throw new Error('Could not fetch wallet balance.');
    }

    const currentBalance = walletData.reduce((sum, transaction) => sum + parseFloat(transaction.amount), 0);
    
    if (currentBalance < amount) {
      throw new Error('Insufficient wallet balance.');
    }

    if (amount < 100) {
      throw new Error('Minimum redemption amount is ₹100.');
    }

    // Insert redemption request into wallet_transactions table
    const { data: transaction, error: transactionError } = await supabase
      .from('wallet_transactions')
      .insert({
        user_id: userProfile.id,
        type: 'redeem',
        amount: -amount, // Amount is negative for redemption
        status: 'processing',
        redeem_method: redeemMethod,
        redeem_details: redeemDetails,
        transaction_ref: `redeem_${Date.now()}_${userProfile.id.substring(0, 8)}`,
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Error inserting redemption transaction:', transactionError);
      throw new Error('Failed to record redemption request.');
    }

    // For now, we'll simulate email sending since we don't have email service configured
    // In production, you would integrate with SendGrid, Mailgun, or similar service
    console.log(`Redemption email would be sent to primoboostai@gmail.com:`);
    console.log(`User: ${userProfile.full_name} (${userProfile.email_address})`);
    console.log(`Amount: ₹${amount.toFixed(2)}`);
    console.log(`Method: ${redeemMethod}`);
    console.log(`Details: ${JSON.stringify(redeemDetails, null, 2)}`);
    console.log(`Transaction ID: ${transaction.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Redemption request submitted successfully. The money will be credited to your account within 2 hours.',
        transactionId: transaction.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Redemption request failed:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});