import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

// CORS headers to allow requests from any origin
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// Interface for the payment verification request body
interface PaymentVerificationRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  transactionId: string;
}

// Interface for plan configuration
interface PlanConfig {
  id: string;
  name: string; // Plan name
  price: number; // Offer price in Rupees
  mrp: number; // MRP in Rupees
  discountPercentage: number; // Calculated discount percentage
  duration: string;
  optimizations: number;
  scoreChecks: number;
  linkedinMessages: number;
  guidedBuilds: number;
  durationInHours: number;
  tag: string;
  tagColor: string;
  gradient: string;
  icon: string;
  features: string[];
  popular?: boolean;
}

// Defined plans with their respective features and durations
// This list should ideally be fetched from a centralized source or database
// to avoid discrepancies between frontend, backend, and functions.
const plans: PlanConfig[] = [
  {
    id: 'leader_plan',
    name: 'Leader Plan',
    price: 6400,
    mrp: 12800,
    discountPercentage: 50,
    duration: 'One-time Purchase',
    optimizations: 100,
    scoreChecks: 100,
    linkedinMessages: 0,
    guidedBuilds: 0,
    tag: 'Top Tier',
    tagColor: 'text-purple-800 bg-purple-100',
    gradient: 'from-purple-500 to-indigo-500',
    icon: 'crown',
    features: [
      '✅ 100 Resume Optimizations',
      '✅ 100 Score Checks',
      '❌ LinkedIn Messages',
      '❌ Guided Builds',
      '✅ Priority Support',
    ],
    popular: true,
    durationInHours: 8760, // 1 year
  },
  {
    id: 'achiever_plan',
    name: 'Achiever Plan',
    price: 3200,
    mrp: 6400,
    discountPercentage: 50,
    duration: 'One-time Purchase',
    optimizations: 50,
    scoreChecks: 50,
    linkedinMessages: 0,
    guidedBuilds: 0,
    tag: 'Best Value',
    tagColor: 'text-blue-800 bg-blue-100',
    gradient: 'from-blue-500 to-cyan-500',
    icon: 'zap',
    features: [
      '✅ 50 Resume Optimizations',
      '✅ 50 Score Checks',
      '❌ LinkedIn Messages',
      '❌ Guided Builds',
      '✅ Standard Support',
    ],
    popular: false,
    durationInHours: 8760,
  },
  {
    id: 'accelerator_plan',
    name: 'Accelerator Plan',
    price: 1600,
    mrp: 3200,
    discountPercentage: 50,
    duration: 'One-time Purchase',
    optimizations: 25,
    scoreChecks: 25,
    linkedinMessages: 0,
    guidedBuilds: 0,
    tag: 'Great Start',
    tagColor: 'text-green-800 bg-green-100',
    gradient: 'from-green-500 to-emerald-500',
    icon: 'rocket',
    features: [
      '✅ 25 Resume Optimizations',
      '✅ 25 Score Checks',
      '❌ LinkedIn Messages',
      '❌ Guided Builds',
      '✅ Email Support',
    ],
    popular: false,
    durationInHours: 8760,
  },
  {
    id: 'starter_plan',
    name: 'Starter Plan',
    price: 640,
    mrp: 1280,
    discountPercentage: 50,
    duration: 'One-time Purchase',
    optimizations: 10,
    scoreChecks: 10,
    linkedinMessages: 0,
    guidedBuilds: 0,
    tag: 'Quick Boost',
    tagColor: 'text-yellow-800 bg-yellow-100',
    gradient: 'from-yellow-500 to-orange-500',
    icon: 'target',
    features: [
      '✅ 10 Resume Optimizations',
      '✅ 10 Score Checks',
      '❌ LinkedIn Messages',
      '❌ Guided Builds',
      '✅ Basic Support',
    ],
    popular: false,
    durationInHours: 8760,
  },
  {
    id: 'kickstart_plan',
    name: 'Kickstart Plan',
    price: 320,
    mrp: 640,
    discountPercentage: 50,
    duration: 'One-time Purchase',
    optimizations: 5,
    scoreChecks: 5,
    linkedinMessages: 0,
    guidedBuilds: 0,
    tag: 'Essential',
    tagColor: 'text-red-800 bg-red-100',
    gradient: 'from-red-500 to-pink-500',
    icon: 'wrench',
    features: [
      '✅ 5 Resume Optimizations',
      '✅ 5 Score Checks',
      '❌ LinkedIn Messages',
      '❌ Guided Builds',
      '❌ Priority Support',
    ],
    popular: false,
    durationInHours: 8760,
  },
];

// Defined add-ons with their types and quantities
// This list MUST match the addOns array in src/services/paymentService.ts
const addOns = [
  // NEW ADD-ON: Single JD-Based Optimization Purchase
  {
    id: 'jd_optimization_single_purchase',
    name: 'JD-Based Optimization (1 Use)',
    price: 49, // Example price in Rupees
    type: 'optimization',
    quantity: 1,
  },
  // NEW ADD-ON: Single Resume Score Check Purchase
  {
    id: 'resume_score_check_single_purchase',
    name: 'Resume Score Check (1 Use)',
    price: 19,
    type: 'score_check',
    quantity: 1,
  },
];

// Main serverless function handler
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let transactionStatus = "failed";
  let subscriptionId: string | null = null;
  let transactionIdFromRequest: string | null = null;

  try {
    // Parse the request body
    const requestBody: PaymentVerificationRequest = await req.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      transactionId,
    } = requestBody;
    transactionIdFromRequest = transactionId;
    console.log(`[${new Date().toISOString()}] - verify-payment received. transactionId: ${transactionIdFromRequest}`);
    console.log(`[${new Date().toISOString()}] - Request Body: ${JSON.stringify(requestBody)}`); // Added log

    // Get authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user with Supabase
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error(`[${new Date().toISOString()}] - User authentication failed:`, userError); // Added log
      throw new Error("Invalid user token");
    }
    console.log(`[${new Date().toISOString()}] - User authenticated. User ID: ${user.id}`); // Added log

    // Get Razorpay secret from environment variables
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!razorpayKeySecret) {
      console.error(`[${new Date().toISOString()}] - Razorpay secret not configured.`); // Added log
      throw new Error("Razorpay secret not configured");
    }

    // Verify Razorpay signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = createHmac("sha256", razorpayKeySecret)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.error(`[${new Date().toISOString()}] - Invalid payment signature. Expected: ${expectedSignature}, Received: ${razorpay_signature}`); // Added log
      throw new Error("Invalid payment signature");
    }
    console.log(`[${new Date().toISOString()}] - Razorpay signature verified successfully.`); // Added log

    // Fetch order details from Razorpay
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    const orderResponse = await fetch(
      `https://api.razorpay.com/v1/orders/${razorpay_order_id}`,
      {
        headers: {
          "Authorization": `Basic ${auth}`,
        },
      },
    );

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      console.error(`[${new Date().toISOString()}] - Failed to fetch order details from Razorpay. Status: ${orderResponse.status}, Response: ${errorText}`); // Added log
      throw new Error("Failed to fetch order details from Razorpay");
    }

    const orderData = await orderResponse.json();
    console.log(`[${new Date().toISOString()}] - Order Data from Razorpay: ${JSON.stringify(orderData)}`); // Added log

    const planId = orderData.notes.planId;
    const couponCode = orderData.notes.couponCode;
    // Explicitly parse walletDeduction and discountAmount as numbers
    const discountAmount = parseFloat(orderData.notes.discountAmount || "0");
    const walletDeduction = parseFloat(orderData.notes.walletDeduction || "0");
    const selectedAddOns = JSON.parse(orderData.notes.selectedAddOns || "{}");

    console.log(`[${new Date().toISOString()}] - Retrieved from orderData.notes: planId=${planId}, couponCode=${couponCode}, walletDeduction=${walletDeduction}, selectedAddOns=${JSON.stringify(selectedAddOns)}`);

    // Update payment transaction status in Supabase
    console.log(`[${new Date().toISOString()}] - Attempting to update payment_transactions record with ID: ${transactionId}`);
    const { data: updatedTransaction, error: updateTransactionError } = await supabase
      .from("payment_transactions")
      .update({
        payment_id: razorpay_payment_id,
        status: "success",
        order_id: razorpay_order_id,
        wallet_deduction_amount: walletDeduction, // Stored as a number (rupees)
        coupon_code: couponCode,
        discount_amount: discountAmount,
      })
      .eq("id", transactionId)
      .select()
      .single();

    if (updateTransactionError) {
      console.error(`[${new Date().toISOString()}] - Error updating payment transaction to success:`, updateTransactionError);
      throw new Error("Failed to update payment transaction status.");
    }
    console.log(`[${new Date().toISOString()}] - Payment transaction updated to success. Record ID: ${updatedTransaction.id}, coupon_code: ${updatedTransaction.coupon_code}`);
    transactionStatus = "success";

    // Process add-on credits
    if (Object.keys(selectedAddOns).length > 0) {
      console.log(`[${new Date().toISOString()}] - Processing add-on credits for user: ${user.id}`);
      for (const addOnKey in selectedAddOns) {
        const quantity = selectedAddOns[addOnKey];
        console.log(`[${new Date().toISOString()}] - Processing add-on with key: ${addOnKey} and quantity: ${quantity}`);

        const addOn = addOns.find((a) => a.id === addOnKey);
        if (!addOn) {
          console.error(`[${new Date().toISOString()}] - Add-on with ID ${addOnKey} not found in configuration. Skipping.`);
          continue;
        }
        console.log(`[${new Date().toISOString()}] - Found addOn config: ${JSON.stringify(addOn)}`);

        console.log(`[${new Date().toISOString()}] - Looking up addon_type for type_key: ${addOn.type}`);
        const { data: addonType, error: addonTypeError } = await supabase
          .from("addon_types")
          .select("id")
          .eq("type_key", addOn.type)
          .single();

        if (addonTypeError || !addonType) {
          console.error(`[${new Date().toISOString()}] - Error finding addon_type for key ${addOn.type}:`, addonTypeError);
          continue;
        }
        console.log(`[${new Date().toISOString()}] - Found addon_type with ID: ${addonType.id} for key: ${addOn.type}`);

        console.log(`[${new Date().toISOString()}] - Preparing to insert add-on credits with values: user_id: ${user.id}, addon_type_id: ${addonType.id}, quantity: ${quantity}, transactionId: ${transactionId}`);
        const { error: creditInsertError } = await supabase
          .from("user_addon_credits")
          .insert({
            user_id: user.id,
            addon_type_id: addonType.id,
            quantity_purchased: quantity,
            quantity_remaining: quantity,
            payment_transaction_id: transactionId,
          });

        if (creditInsertError) {
          console.error(`[${new Date().toISOString()}] - Error inserting add-on credits for ${addOn.type}:`, creditInsertError);
        } else {
          console.log(`[${new Date().toISOString()}] - Successfully inserted ${quantity} credits for add-on: ${addOn.type}`);
        }
      }
    }

    // Handle plan subscription (if not an add-on only purchase)
    if (planId && planId !== "addon_only_purchase") {
      // Check for existing active subscription to upgrade it
      const { data: existingSubscription, error: existingSubError } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .gt("end_date", new Date().toISOString())
        .order("end_date", { ascending: false })
        .limit(1)
        .maybeSingle(); // Use maybeSingle()

      if (existingSubError) {
        console.error(`[${new Date().toISOString()}] - Error checking existing subscription:`, existingSubError);
      }

      if (existingSubscription) {
        console.log(`[${new Date().toISOString()}] - Found existing active subscription, upgrading...`);
        await supabase
          .from("subscriptions")
          .update({
            status: "upgraded",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingSubscription.id);
      }

      // Create new subscription
      const plan = plans.find((p) => p.id === planId);
      if (!plan) {
        console.error(`[${new Date().toISOString()}] - Invalid plan ID: ${planId}`); // Added log
        throw new Error("Invalid plan");
      }
      console.log(`[${new Date().toISOString()}] - Creating new subscription for plan: ${plan.name}`); // Added log

      const { data: subscription, error: subscriptionError } = await supabase
        .from("subscriptions")
        .insert({
          user_id: user.id,
          plan_id: planId,
          status: "active",
          start_date: new Date().toISOString(),
          end_date: new Date(new Date().getTime() + (plan.durationInHours * 60 * 60 * 1000)).toISOString(),
          optimizations_used: 0,
          optimizations_total: plan.optimizations,
          score_checks_used: 0,
          score_checks_total: plan.scoreChecks,
          linkedin_messages_used: 0,
          linkedin_messages_total: plan.linkedinMessages,
          guided_builds_used: 0,
          guided_builds_total: plan.guidedBuilds,
          payment_id: razorpay_payment_id,
          coupon_used: couponCode,
        })
        .select()
        .single();

      if (subscriptionError) {
        console.error(`[${new Date().toISOString()}] - Subscription creation error:`, subscriptionError);
        throw new Error("Failed to create subscription");
      }
      subscriptionId = subscription.id;
      console.log(`[${new Date().toISOString()}] - New subscription created with ID: ${subscriptionId}`); // Added log

      // Update payment transaction with subscription ID
      const { error: updateSubscriptionIdError } = await supabase
        .from("payment_transactions")
        .update({ subscription_id: subscription.id })
        .eq("id", transactionId);

      if (updateSubscriptionIdError) {
        console.error(`[${new Date().toISOString()}] - Error updating payment transaction with subscription_id:`, updateSubscriptionIdError);
      }
    } else {
      subscriptionId = null; // No subscription created for add-on only purchases
      console.log(`[${new Date().toISOString()}] - No main plan purchase, only add-ons.`); // Added log
    }

    // Handle wallet deduction
    if (walletDeduction > 0) {
      console.log(`[${new Date().toISOString()}] - Attempting to record wallet deduction for user: ${user.id}`);
      console.log(`[${new Date().toISOString()}] - Wallet deduction amount for insert: ${-(walletDeduction)}`);
      const { error: walletError } = await supabase
        .from("wallet_transactions")
        .insert({
          user_id: user.id,
          type: "purchase_use",
          amount: -(walletDeduction), // Store as negative for deduction
          status: "completed",
          transaction_ref: razorpay_payment_id,
          redeem_details: {
            subscription_id: subscriptionId,
            plan_id: planId,
            original_amount: orderData.amount / 100, // Convert paise to rupees
            addons_included: selectedAddOns,
          },
        });

      if (walletError) {
        console.error(`[${new Date().toISOString()}] - Wallet deduction recording error:`, walletError);
      } else {
        console.log(`[${new Date().toISOString()}] - Wallet deduction successfully recorded.`);
      }
    }

    // Referral commission processing
    try {
      // Fetch user profile to check for referral code
      const { data: userProfile, error: profileError } = await supabase
        .from("user_profiles")
        .select("referred_by")
        .eq("id", user.id)
        .maybeSingle(); // Changed from .single() to .maybeSingle()

      if (profileError) {
        console.error(`[${new Date().toISOString()}] - Error fetching user profile for referral check:`, profileError);
      }
      console.log(`[${new Date().toISOString()}] - User profile for referral check:`, userProfile);

      if (userProfile?.referred_by) {
        console.log(`[${new Date().toISOString()}] - User referred by: ${userProfile.referred_by}`);
        // Find the referrer's profile using the referral code
        const { data: referrerProfile, error: referrerError } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("referral_code", userProfile.referred_by)
          .maybeSingle(); // Changed from .single() to .maybeSingle()

        if (referrerError) {
          console.error(`[${new Date().toISOString()}] - Error fetching referrer profile:`, referrerError);
        }
        console.log(`[${new Date().toISOString()}] - Referrer profile found:`, referrerProfile);

        if (referrerProfile) {
          const totalPurchaseAmount = orderData.amount / 100; // orderData.amount is in paise, convert to rupees
          const commissionAmount = Math.floor(totalPurchaseAmount * 0.1); // Calculate 10% commission
          console.log(`[${new Date().toISOString()}] - Total purchase amount (Rupees): ${totalPurchaseAmount}`);
          console.log(`[${new Date().toISOString()}] - Calculated commission amount (Rupees): ${commissionAmount}`);

          if (commissionAmount > 0) {
            const { error: commissionError } = await supabase
              .from("wallet_transactions")
              .insert({
                user_id: referrerProfile.id,
                source_user_id: user.id,
                type: "referral",
                amount: commissionAmount,
                status: "completed",
                transaction_ref: `referral_${razorpay_payment_id}`,
                redeem_details: {
                  referred_user_id: user.id,
                  plan_purchased: planId,
                  total_purchase_amount: totalPurchaseAmount,
                  commission_rate: 0.1,
                  addons_included: selectedAddOns,
                },
              });

            if (commissionError) {
              console.error(`[${new Date().toISOString()}] - Referral commission insertion error:`, commissionError);
            } else {
              console.log(`[${new Date().toISOString()}] - Referral commission of ₹${commissionAmount} credited to referrer successfully.`);
            }
          } else {
            console.log(`[${new Date().toISOString()}] - Commission amount is 0 or less, no referral credit added.`);
          }
        } else {
          console.log(`[${new Date().toISOString()}] - Referrer profile not found for code: ${userProfile.referred_by}`);
        }
      } else {
        console.log(`[${new Date().toISOString()}] - User did not use a referral code.`);
      }
    } catch (referralError) {
      console.error(`[${new Date().toISOString()}] - General referral processing error:`, referralError);
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        subscriptionId: subscriptionId,
        message: "Payment verified and credits granted successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    // Handle errors and update transaction status to failed
    console.error(`[${new Date().toISOString()}] - Payment verification error:`, error);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    if (transactionIdFromRequest) {
      console.log(`[${new Date().toISOString()}] - Marking transaction ${transactionIdFromRequest} as failed.`);
      await supabase
        .from("payment_transactions")
        .update({ status: "failed" })
        .eq("id", transactionIdFromRequest);
    }

    // Return error response
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }
});

