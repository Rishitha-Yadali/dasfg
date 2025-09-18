import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface GenerateReferralCodeRequest {
  userId: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId }: GenerateReferralCodeRequest = await req.json()

    // Validate input
    if (!userId) {
      throw new Error('User ID is required')
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Authenticate user via JWT from request header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('Authorization header missing')
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      throw new Error('Unauthorized: Invalid user token')
    }

    // Verify that the requesting user matches the userId
    if (user.id !== userId) {
      throw new Error('Unauthorized: User ID mismatch')
    }

    // Check if user already has a referral code
    const { data: existingProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('referral_code')
      .eq('id', userId)
      .single()

    if (profileError) {
      throw new Error('Could not fetch user profile')
    }

    if (existingProfile.referral_code) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          referralCode: existingProfile.referral_code,
          message: 'Referral code already exists'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    // Generate new referral code using the database function
    const { data: newCode, error: generateError } = await supabase
      .rpc('assign_referral_code', { user_uuid: userId })

    if (generateError) {
      console.error('Error generating referral code:', generateError)
      throw new Error('Failed to generate referral code')
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        referralCode: newCode,
        message: 'Referral code generated successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Generate referral code failed:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})