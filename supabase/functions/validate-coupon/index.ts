import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ValidateCouponRequest {
  couponCode: string;
  userId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { couponCode, userId }: ValidateCouponRequest = await req.json();

    // Validate input
    if (!couponCode || !userId) {
      throw new Error('Missing couponCode or userId in request body.');
    }

    // Initialize Supabase client with service role key
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

    // Verify that the requesting user matches the userId provided in the body
    if (user.id !== userId) {
      throw new Error('Unauthorized: User ID mismatch.');
    }

    // Check if the coupon has already been used by this user
    const { count, error: couponUsageError } = await supabase
      .from('payment_transactions')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('coupon_code', couponCode)
      .in('status', ['success', 'pending']); // Check for both successful and pending uses

    if (couponUsageError) {
      console.error('Error checking coupon usage:', couponUsageError);
      throw new Error('Failed to verify coupon usage. Please try again.');
    }

    const isUsed = count && count > 0;

    if (isUsed) {
      return new Response(
        JSON.stringify({
          isValid: false,
          message: `Coupon "${couponCode}" has already been used by this account.`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200, // Return 200 OK even if invalid, as it's a valid response to the query
        },
      );
    } else {
      return new Response(
        JSON.stringify({
          isValid: true,
          message: `Coupon "${couponCode}" is valid.`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      );
    }
  } catch (error) {
    console.error('Error in validate-coupon function:', error.message);
    return new Response(
      JSON.stringify({ isValid: false, message: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400, // Bad Request for client-side errors or internal server error
      },
    );
  }
});

