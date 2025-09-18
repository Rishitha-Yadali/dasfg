import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Since coupon functionality has been removed, this endpoint is no longer supported
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: 'Free subscriptions are no longer supported. Please choose a paid plan.' 
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    },
  )
})