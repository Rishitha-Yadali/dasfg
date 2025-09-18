// src/services/paymentService.ts
import { supabase } from '../lib/supabaseClient';

// ---------- Types ----------
export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;                    // Offer price (in INR)
  mrp: number;                      // MRP (in INR)
  discountPercentage: number;       // Derived display value
  duration: string;                 // Display label
  optimizations: number;
  scoreChecks: number;
  linkedinMessages: number;
  guidedBuilds: number;
  tag: string;
  tagColor: string;
  gradient: string;
  icon: string;
  features: string[];
  popular?: boolean;
  durationInHours: number;          // Actual duration used to compute end_date
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: string;
  startDate: string;
  endDate: string;
  optimizationsUsed: number;
  optimizationsTotal: number;
  paymentId: string | null;
  couponUsed: string | null;
  scoreChecksUsed: number;
  scoreChecksTotal: number;
  linkedinMessagesUsed: number;
  linkedinMessagesTotal: number;
  guidedBuildsUsed: number;
  guidedBuildsTotal: number;
}

// Credit types map 1:1 with addon_types.type_key and with our internal useCredit API
type CreditType = 'optimization' | 'score_check' | 'linkedin_messages' | 'guided_build';

// ---------- Service ----------
class PaymentService {
  // ----- Plans (static catalog) -----
  private plans: SubscriptionPlan[] = [
    {
      id: 'career_pro_max',
      name: 'Career Pro Max',
      price: 2299,
      mrp: 10000,
      discountPercentage: 77.01,
      duration: 'One-time Purchase',
      optimizations: 50,
      scoreChecks: 50,
      linkedinMessages: 500,
      guidedBuilds: 5,
      tag: 'Ultimate Value',
      tagColor: 'text-purple-800 bg-purple-100',
      gradient: 'from-purple-500 to-indigo-500',
      icon: 'crown',
      features: [
        '✅ 50 Resume Optimizations',
        '✅ 50 Score Checks',
        '✅ 500 LinkedIn Messages',
        '✅ 5 Guided Resume Builds',
        '✅ Priority Support',
      ],
      popular: false,
      durationInHours: 8760, // 365 days
    },
    {
      id: 'career_boost_plus',
      name: 'Career Boost+',
      price: 1699,
      mrp: 7500,
      discountPercentage: 77.34,
      duration: 'One-time Purchase',
      optimizations: 30,
      scoreChecks: 30,
      linkedinMessages: 300,
      guidedBuilds: 3,
      tag: 'Best Seller',
      tagColor: 'text-blue-800 bg-blue-100',
      gradient: 'from-blue-500 to-cyan-500',
      icon: 'zap',
      features: [
        '✅ 30 Resume Optimizations',
        '✅ 30 Score Checks',
        '✅ 300 LinkedIn Messages',
        '✅ 3 Guided Resume Builds',
        '✅ Standard Support',
      ],
      popular: true,
      durationInHours: 8760,
    },
    {
      id: 'pro_resume_kit',
      name: 'Pro Resume Kit',
      price: 1199,
      mrp: 5000,
      discountPercentage: 76.02,
      duration: 'One-time Purchase',
      optimizations: 20,
      scoreChecks: 20,
      linkedinMessages: 100,
      guidedBuilds: 2,
      tag: 'Great Start',
      tagColor: 'text-green-800 bg-green-100',
      gradient: 'from-green-500 to-emerald-500',
      icon: 'rocket',
      features: [
        '✅ 20 Resume Optimizations',
        '✅ 20 Score Checks',
        '✅ 100 LinkedIn Messages',
        '✅ 2 Guided Resume Builds',
        '✅ Email Support',
      ],
      popular: false,
      durationInHours: 8760,
    },
    {
      id: 'smart_apply_pack',
      name: 'Smart Apply Pack',
      price: 599,
      mrp: 2500,
      discountPercentage: 76.04,
      duration: 'One-time Purchase',
      optimizations: 10,
      scoreChecks: 10,
      linkedinMessages: 50,
      guidedBuilds: 1,
      tag: 'Quick Boost',
      tagColor: 'text-yellow-800 bg-yellow-100',
      gradient: 'from-yellow-500 to-orange-500',
      icon: 'target',
      features: [
        '✅ 10 Resume Optimizations',
        '✅ 10 Score Checks',
        '✅ 50 LinkedIn Messages',
        '✅ 1 Guided Resume Build',
        '✅ Basic Support',
      ],
      popular: false,
      durationInHours: 8760,
    },
    {
      id: 'resume_fix_pack',
      name: 'Resume Fix Pack',
      price: 249,
      mrp: 999,
      discountPercentage: 75.07,
      duration: 'One-time Purchase',
      optimizations: 5,
      scoreChecks: 2,
      linkedinMessages: 0,
      guidedBuilds: 0,
      tag: 'Essential',
      tagColor: 'text-red-800 bg-red-100',
      gradient: 'from-red-500 to-pink-500',
      icon: 'wrench',
      features: [
        '✅ 5 Resume Optimizations',
        '✅ 2 Score Checks',
        '❌ LinkedIn Messages',
        '❌ Guided Builds',
        '❌ Priority Support',
      ],
      popular: false,
      durationInHours: 8760,
    },
    {
      id: 'lite_check',
      name: 'Lite Check',
      price: 129,
      mrp: 499,
      discountPercentage: 74.15,
      duration: 'One-time Purchase',
      optimizations: 2,
      scoreChecks: 2,
      linkedinMessages: 10,
      guidedBuilds: 0,
      tag: 'Trial',
      tagColor: 'text-gray-800 bg-gray-100',
      gradient: 'from-gray-500 to-gray-700',
      icon: 'check_circle',
      features: [
        '✅ 2 Resume Optimizations',
        '✅ 2 Score Checks',
        '✅ 10 LinkedIn Messages',
        '❌ Guided Builds',
        '❌ Priority Support',
      ],
      popular: false,
      durationInHours: 168, // 7 days
    },
  ];

  // ----- Add-ons (static catalog) -----
  private addOns = [
    { id: 'jd_optimization_single',            name: 'JD-Based Optimization (1x)',        price: 49,  type: 'optimization',      quantity: 1 },
    { id: 'guided_resume_build_single',        name: 'Guided Resume Build (1x)',          price: 99,  type: 'guided_build',      quantity: 1 },
    { id: 'resume_score_check_single',         name: 'Resume Score Check (1x)',           price: 19,  type: 'score_check',       quantity: 1 },
    { id: 'linkedin_messages_50',              name: 'LinkedIn Messages (50x)',           price: 29,  type: 'linkedin_messages', quantity: 50 },
    { id: 'linkedin_optimization_single',      name: 'LinkedIn Optimization (1x Review)', price: 199, type: 'linkedin_optimization', quantity: 1 },
    { id: 'resume_guidance_session',           name: 'Resume Guidance Session (Live)',    price: 299, type: 'guidance_session',  quantity: 1 },

    // Purchasable singles
    { id: 'jd_optimization_single_purchase',   name: 'JD-Based Optimization (1 Use)',     price: 19,  type: 'optimization',      quantity: 1 },
    { id: 'guided_resume_build_single_purchase', name: 'Guided Resume Build (1 Use)',     price: 99,  type: 'guided_build',      quantity: 1 },
    { id: 'resume_score_check_single_purchase',  name: 'Resume Score Check (1 Use)',      price: 9,   type: 'score_check',       quantity: 1 },
    { id: 'linkedin_messages_50_purchase',     name: 'LinkedIn Messages (50 Uses)',       price: 29,  type: 'linkedin_messages', quantity: 50 },
  ];

  // ---------- Catalog helpers ----------
  getPlans(): SubscriptionPlan[] {
    return this.plans;
  }
  getAddOns(): any[] {
    return this.addOns;
  }
  getPlanById(id: string): SubscriptionPlan | undefined {
    return this.plans.find((p) => p.id === id);
  }
  getAddOnById(id: string): any | undefined {
    return this.addOns.find((a) => a.id === id);
  }

  // ---------- Core subscription fetch (combined with add-ons) ----------
  async getUserSubscription(userId: string): Promise<Subscription | null> {
    console.log('PaymentService: Fetching user subscription for userId:', userId);
    try {
      // All active subscriptions
      const { data: subscriptions, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('PaymentService: Error fetching user subscriptions:', error.message, error.details);
        return null;
      }

      // Cumulate credits across *all* active subscriptions
      let cumulativeOptimizationsUsed = 0;
      let cumulativeOptimizationsTotal = 0;
      let cumulativeScoreChecksUsed = 0;
      let cumulativeScoreChecksTotal = 0;
      let cumulativeLinkedinMessagesUsed = 0;
      let cumulativeLinkedinMessagesTotal = 0;
      let cumulativeGuidedBuildsUsed = 0;
      let cumulativeGuidedBuildsTotal = 0;

      let latestSubscriptionId: string | null = null;
      let latestPlanId: string | null = null;
      let latestStatus = 'inactive';
      let latestStartDate = '';
      let latestEndDate = '';
      let latestPaymentId: string | null = null;
      let latestCouponUsed: string | null = null;

      if (subscriptions && subscriptions.length > 0) {
        subscriptions.forEach((sub: any) => {
          cumulativeOptimizationsUsed  += Number(sub.optimizations_used  ?? 0);
          cumulativeOptimizationsTotal += Number(sub.optimizations_total ?? 0);
          cumulativeScoreChecksUsed    += Number(sub.score_checks_used   ?? 0);
          cumulativeScoreChecksTotal   += Number(sub.score_checks_total  ?? 0);
          cumulativeLinkedinMessagesUsed  += Number(sub.linkedin_messages_used  ?? 0);
          cumulativeLinkedinMessagesTotal += Number(sub.linkedin_messages_total ?? 0);
          cumulativeGuidedBuildsUsed   += Number(sub.guided_builds_used  ?? 0);
          cumulativeGuidedBuildsTotal  += Number(sub.guided_builds_total ?? 0);
        });

        const latestSub = subscriptions[0];
        latestSubscriptionId = latestSub.id;
        latestPlanId = latestSub.plan_id;
        latestStatus = latestSub.status;
        latestStartDate = latestSub.start_date;
        latestEndDate = latestSub.end_date;
        latestPaymentId = latestSub.payment_id;
        latestCouponUsed = latestSub.coupon_used;
      }

      // Include ALL user add-on credits (used + remaining), for accurate "used" derivation
      const { data: addonCreditsData, error: addonCreditsError } = await supabase
        .from('user_addon_credits')
        .select(`
          id,
          user_id,
          addon_type_id,
          quantity_purchased,
          quantity_remaining,
          addon_types(type_key)
        `)
        .eq('user_id', userId); // IMPORTANT: scope to user

      console.log('PaymentService: Fetched raw add-on credits data:', addonCreditsData);

      if (addonCreditsError) {
        console.error('PaymentService: Error fetching add-on credits:', addonCreditsError.message, addonCreditsError.details);
      }

      // Aggregate add-on totals/used by type_key
      const aggregatedAddonCredits: Record<string, { total: number; used: number }> = {
        optimization: { total: 0, used: 0 },
        score_check: { total: 0, used: 0 },
        linkedin_messages: { total: 0, used: 0 },
        guided_build: { total: 0, used: 0 },
      };

      (addonCreditsData || []).forEach((credit: any) => {
        const typeKey = (credit.addon_types as { type_key: string })?.type_key;
        const purchased = Number(credit.quantity_purchased ?? 0);
        const remaining = Number(credit.quantity_remaining ?? 0);
        if (aggregatedAddonCredits[typeKey]) {
          aggregatedAddonCredits[typeKey].total += purchased;
          aggregatedAddonCredits[typeKey].used  += Math.max(0, purchased - remaining);
        }
        console.log(
          `PaymentService: Processing add-on credit - typeKey: ${typeKey}, purchased: ${purchased}, remaining: ${remaining}`
        );
      });

      console.log('PaymentService: Aggregated add-on credits:', aggregatedAddonCredits);

      const finalOptimizationsTotal   = cumulativeOptimizationsTotal   + aggregatedAddonCredits.optimization.total;
      const finalScoreChecksTotal     = cumulativeScoreChecksTotal     + aggregatedAddonCredits.score_check.total;
      const finalLinkedinMessagesTotal= cumulativeLinkedinMessagesTotal+ aggregatedAddonCredits.linkedin_messages.total;
      const finalGuidedBuildsTotal    = cumulativeGuidedBuildsTotal    + aggregatedAddonCredits.guided_build.total;

      const finalOptimizationsUsed    = cumulativeOptimizationsUsed    + aggregatedAddonCredits.optimization.used;
      const finalScoreChecksUsed      = cumulativeScoreChecksUsed      + aggregatedAddonCredits.score_check.used;
      const finalLinkedinMessagesUsed = cumulativeLinkedinMessagesUsed + aggregatedAddonCredits.linkedin_messages.used;
      const finalGuidedBuildsUsed     = cumulativeGuidedBuildsUsed     + aggregatedAddonCredits.guided_build.used;

      // If no plan and no add-ons → no credits
      const hasAnyCredits =
        finalOptimizationsTotal > 0 ||
        finalScoreChecksTotal > 0 ||
        finalLinkedinMessagesTotal > 0 ||
        finalGuidedBuildsTotal > 0;

      if (!hasAnyCredits) {
        console.log('PaymentService: No active subscription or add-on credits found for user:', userId);
        return null;
      }

      const currentSubscription: Subscription = {
        id: latestSubscriptionId || 'virtual-addon-subscription',
        userId,
        planId: latestPlanId || 'addon_only',
        status: latestStatus,
        startDate: latestStartDate || new Date().toISOString(),
        endDate: latestEndDate || new Date(8640000000000000).toISOString(),
        paymentId: latestPaymentId,
        couponUsed: latestCouponUsed,

        optimizationsUsed: finalOptimizationsUsed,
        optimizationsTotal: finalOptimizationsTotal,

        scoreChecksUsed: finalScoreChecksUsed,
        scoreChecksTotal: finalScoreChecksTotal,

        linkedinMessagesUsed: finalLinkedinMessagesUsed,
        linkedinMessagesTotal: finalLinkedinMessagesTotal,

        guidedBuildsUsed: finalGuidedBuildsUsed,
        guidedBuildsTotal: finalGuidedBuildsTotal,
      };

      if ((subscriptions?.length ?? 0) === 0 && hasAnyCredits) {
        currentSubscription.status = 'active';
        currentSubscription.endDate = new Date(8640000000000000).toISOString();
      }

      console.log('PaymentService: Final combined subscription and add-on credits object:', currentSubscription);
      console.log('PaymentService: Successfully fetched combined subscription and add-on credits:', currentSubscription);
      return currentSubscription;
    } catch (err: any) {
      console.error('PaymentService: Unexpected error in getUserSubscription:', err.message);
      return null;
    }
  }

  // ---------- Helper: authoritative remaining calculation from tables ----------
  private async computeRemainingFromTables(userId: string, creditField: CreditType): Promise<number> {
    const dbFieldMap: Record<CreditType, string> = {
      optimization: 'optimizations',
      score_check: 'score_checks',
      linkedin_messages: 'linkedin_messages',
      guided_build: 'guided_builds',
    };
    const base = dbFieldMap[creditField];
    const totalField = `${base}_total`;
    const usedField = `${base}_used`;

    // Plan remaining
    const { data: subs, error: subsErr } = await supabase
      .from('subscriptions')
      .select(`id, ${totalField}, ${usedField}`)
      .eq('user_id', userId)
      .eq('status', 'active');

    if (subsErr) {
      console.error('computeRemainingFromTables: subsErr', subsErr.message, subsErr.details);
    }

    const planRemaining = (subs || []).reduce((sum, s: any) => {
      const t = Number(s[totalField] ?? 0);
      const u = Number(s[usedField] ?? 0);
      return sum + Math.max(0, t - u);
    }, 0);

    // Add-on remaining
    const { data: addons, error: addErr } = await supabase
      .from('user_addon_credits')
      .select(`quantity_remaining, addon_types(type_key)`)
      .eq('user_id', userId);

    if (addErr) {
      console.error('computeRemainingFromTables: addErr', addErr.message, addErr.details);
    }

    const addonRemaining = (addons || []).reduce((sum, r: any) => {
      const key = (r.addon_types as { type_key: string })?.type_key;
      if (key === creditField) {
        return sum + Number(r.quantity_remaining ?? 0);
      }
      return sum;
    }, 0);

    return planRemaining + addonRemaining;
  }

  // ---------- Generic credit use (prefers add-ons) ----------
  private async useCredit(
    userId: string,
    creditField: CreditType
  ): Promise<{ success: boolean; remaining?: number; error?: string }> {
    const dbCreditFieldMap: Record<CreditType, string> = {
      optimization: 'optimizations',
      score_check: 'score_checks',
      linkedin_messages: 'linkedin_messages',
      guided_build: 'guided_builds',
    };
    const dbCreditFieldName = dbCreditFieldMap[creditField];
    if (!dbCreditFieldName) {
      console.error(`PaymentService: Invalid creditField provided: ${creditField}`);
      return { success: false, error: 'Invalid credit type.' };
    }

    const totalField = `${dbCreditFieldName}_total`;
    const usedField = `${dbCreditFieldName}_used`;

    console.log(`PaymentService: Attempting to use ${creditField} (DB field: ${dbCreditFieldName}) for userId:`, userId);

    try {
      // --- Prefer add-on credits first ---
      const { data: addonCredits, error: addonError } = await supabase
        .from('user_addon_credits')
        .select(`id, user_id, quantity_remaining, quantity_purchased, addon_types(type_key)`)
        .eq('user_id', userId)
        .order('purchased_at', { ascending: true });

      if (addonError) {
        console.error(`PaymentService: Error fetching add-on credits for ${creditField}:`, addonError.message, addonError.details);
        // fall through to plan credits even on error
      }

      const relevantAddon = addonCredits?.find(
        (c: any) =>
          (c.addon_types as { type_key: string })?.type_key === creditField &&
          Number(c.quantity_remaining ?? 0) > 0
      );

      if (relevantAddon && Number(relevantAddon.quantity_remaining) > 0) {
        const newRemaining = Number(relevantAddon.quantity_remaining) - 1;

        console.log(`PaymentService: Found add-on credit ${relevantAddon.id}. Current remaining: ${relevantAddon.quantity_remaining}. New remaining: ${newRemaining}`);
        console.log(`PaymentService: Attempting to update add-on credit with ID: ${relevantAddon.id} for user: ${userId}`);
        console.log(`PaymentService: Relevant Addon details for update:`, JSON.stringify(relevantAddon, null, 2));
        console.log(`PaymentService: User ID for update: ${userId}`);

        // Atomic update + return the updated row from writer
        const { data: updated, error: updateAddonError } = await supabase
          .from('user_addon_credits')
          .update({ quantity_remaining: newRemaining })
          .eq('id', relevantAddon.id)
          .eq('user_id', userId) // required for RLS
          // REMOVED: .gt('quantity_remaining', 0) // This line was causing the issue
          .select('id, quantity_remaining'); // Removed .maybeSingle()

        if (updateAddonError) { // Check for error object directly
          console.error(`PaymentService: CRITICAL ERROR updating add-on credit usage for ${creditField}:`, updateAddonError.message, updateAddonError.details);
          return { success: false, error: 'Failed to update add-on credit usage.' };
        }

        if (!updated || updated.length === 0) { // Check if no rows were actually updated
          console.warn(`PaymentService: Add-on credit update returned 0 rows for ID ${relevantAddon.id}. It might have been consumed or updated by another process.`);
          // If no row was updated, it means the credit was already consumed or didn't meet the criteria.
          // In this case, we should fall back to subscription credits or report failure.
          // For now, let's proceed to subscription check if this fails.
        } else {
          console.log(`PaymentService: Successfully updated add-on credit ${relevantAddon.id} to ${newRemaining} remaining.`);
          // Diagnostic delay: Wait a bit to ensure DB update propagates
          await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay

          // Re-calculate total remaining across all subscriptions and add-ons for the return value
          const updatedSubscriptionState = await this.getUserSubscription(userId);
          
          let totalPropName: keyof Subscription;
          let usedPropName: keyof Subscription;

          switch (creditField) {
            case 'optimization':
              totalPropName = 'optimizationsTotal';
              usedPropName = 'optimizationsUsed';
              break;
            case 'score_check':
              totalPropName = 'scoreChecksTotal';
              usedPropName = 'scoreChecksUsed';
              break;
            case 'linkedin_messages':
              totalPropName = 'linkedinMessagesTotal';
              usedPropName = 'linkedinMessagesUsed';
              break;
            case 'guided_build':
              totalPropName = 'guidedBuildsTotal';
              usedPropName = 'guidedBuildsUsed';
              break;
            default:
              throw new Error('Unknown credit type for total/used property names.');
          }

          const totalRemaining = updatedSubscriptionState ? updatedSubscriptionState[totalPropName] - updatedSubscriptionState[usedPropName] : 0;
          console.log(`PaymentService: After update, calculated total remaining: ${totalRemaining}`);
          return { success: true, remaining: totalRemaining };
        }
      }

      // --- Fallback: use plan credits if add-ons are exhausted/not present ---
      const { data: activeSubscriptions, error: fetchError } = await supabase
        .from('subscriptions')
        .select(`id, ${usedField}, ${totalField}`)
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      if (fetchError) {
        console.error(`PaymentService: Error fetching active subscriptions for ${creditField}:`, fetchError.message, fetchError.details);
        return { success: false, error: 'Failed to fetch active subscriptions.' };
      }

      let usedFromSubscription = false;
      for (const sub of activeSubscriptions || []) {
        const currentUsed = Number(sub[usedField] ?? 0);
        const currentTotal = Number(sub[totalField] ?? 0);
        if (currentUsed < currentTotal) {
          const newUsed = currentUsed + 1;

          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({ [usedField]: newUsed, updated_at: new Date().toISOString() })
            .eq('id', sub.id);

          if (updateError) {
            console.error(`PaymentService: Error updating ${usedField} for subscription ${sub.id}:`, updateError.message, updateError.details);
            return { success: false, error: 'Failed to update credit usage in subscription.' };
          }

          const updatedRemaining = await this.computeRemainingFromTables(userId, creditField);
          console.log(`PaymentService: Used 1 ${creditField} plan credit. Remaining total (plan + add-ons): ${updatedRemaining}`);
          usedFromSubscription = true;
          break;
        }
      }

      if (usedFromSubscription) {
        // Re-calculate total remaining across all subscriptions and add-ons for the return value
        const updatedSubscriptionState = await this.getUserSubscription(userId);
        
        let totalPropName: keyof Subscription;
        let usedPropName: keyof Subscription;

        switch (creditField) {
          case 'optimization':
            totalPropName = 'optimizationsTotal';
            usedPropName = 'optimizationsUsed';
            break;
          case 'score_check':
            totalPropName = 'scoreChecksTotal';
            usedPropName = 'scoreChecksUsed';
            break;
          case 'linkedin_messages':
            totalPropName = 'linkedinMessagesTotal';
            usedPropName = 'linkedinMessagesUsed';
            break;
          case 'guided_build':
            totalPropName = 'guidedBuildsTotal';
            usedPropName = 'guidedBuildsUsed';
            break;
          default:
            throw new Error('Unknown credit type for total/used property names.');
        }

        const totalRemaining = updatedSubscriptionState ? updatedSubscriptionState[totalPropName] - updatedSubscriptionState[usedPropName] : 0;
        return { success: true, remaining: totalRemaining };
      }

      console.warn(`PaymentService: No active subscription or add-on credits found for ${creditField} for userId:`, userId);
      return { success: false, error: 'No active subscription or add-on credits found.' };
    } catch (err: any) {
      console.error(`PaymentService: Unexpected error in useCredit (${creditField}):`, err.message);
      return { success: false, error: 'An unexpected error occurred while using credits.' };
    }
  }

  // ---------- Public credit-usage APIs ----------
  async useOptimization(userId: string) {
    return this.useCredit(userId, 'optimization');
  }
  async useScoreCheck(userId: string) {
    return this.useCredit(userId, 'score_check');
  }
  async useLinkedInMessage(userId: string) {
    return this.useCredit(userId, 'linkedin_messages');
  }
  async useGuidedBuild(userId: string) {
    return this.useCredit(userId, 'guided_build');
  }

  // ---------- Free trial ----------
  async activateFreeTrial(userId: string): Promise<void> {
    console.log('PaymentService: Attempting to activate free trial for userId:', userId);
    try {
      const { data: existingTrial, error: fetchError } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('plan_id', 'lite_check')
        .maybeSingle();

      if (fetchError) {
        console.error('PaymentService: Error checking for existing free trial:', fetchError.message, fetchError.details);
        throw new Error('Failed to check for existing free trial.');
      }
      if (existingTrial) {
        console.log('PaymentService: User already has a free trial, skipping activation.');
        return;
      }

      const freePlan = this.getPlanById('lite_check');
      if (!freePlan) throw new Error('Free trial plan configuration not found.');
      if (typeof freePlan.durationInHours !== 'number' || !isFinite(freePlan.durationInHours)) {
        console.error('PaymentService: Invalid durationInHours detected for plan:', freePlan);
        throw new Error('Invalid plan duration configuration. Please contact support.');
      }

      const { error: insertError } = await supabase.from('subscriptions').insert({
        user_id: userId,
        plan_id: freePlan.id,
        status: 'active',
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + freePlan.durationInHours * 60 * 60 * 1000).toISOString(),
        optimizations_used: 0,
        optimizations_total: freePlan.optimizations,
        score_checks_used: 0,
        score_checks_total: freePlan.scoreChecks,
        linkedin_messages_used: 0,
        linkedin_messages_total: freePlan.linkedinMessages,
        guided_builds_used: 0,
        guided_builds_total: freePlan.guidedBuilds,
        payment_id: null,
        coupon_used: 'free_trial',
      });

      if (insertError) {
        console.error('PaymentService: Error activating free trial:', insertError.message, insertError.details);
        throw new Error('Failed to activate free trial.');
      }
      console.log('PaymentService: Free trial activated successfully for userId:', userId);
    } catch (error: any) {
      console.error('PaymentService: Unexpected error in activateFreeTrial:', error.message);
      throw error;
    }
  }

  // ---------- Coupon helpers ----------
  private async validateCouponServer(couponCode: string, userId: string, accessToken: string) {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-coupon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ couponCode, userId }),
      });

      const result = await response.json();
      if (!response.ok) {
        console.error('Error from validate-coupon Edge Function:', result.message || response.statusText);
        return { isValid: false, message: result.message || 'Failed to validate coupon on server.' };
      }
      return result as { isValid: boolean; message: string };
    } catch (error: any) {
      console.error('Network error during coupon validation:', error.message);
      return { isValid: false, message: 'Network error during coupon validation. Please try again.' };
    }
  }

  async applyCoupon(
    planId: string,
    couponCode: string,
    userId: string | null
  ): Promise<{ couponApplied: string | null; discountAmount: number; finalAmount: number; error?: string; isValid: boolean; message: string }> {
    const plan = this.getPlanById(planId);
    if (!plan && planId !== 'addon_only_purchase') {
      return { couponApplied: null, discountAmount: 0, finalAmount: 0, error: 'Invalid plan selected', isValid: false, message: 'Invalid plan selected' };
    }

    if (userId) {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        return { couponApplied: null, discountAmount: 0, finalAmount: 0, error: 'Authentication required for coupon validation', isValid: false, message: 'Authentication required for coupon validation' };
      }
      const serverValidation = await this.validateCouponServer(couponCode, userId, session.access_token);
      if (!serverValidation.isValid) {
        return { couponApplied: null, discountAmount: 0, finalAmount: 0, error: serverValidation.message, isValid: false, message: serverValidation.message };
      }
    }

    let originalPrice = (plan?.price || 0) * 100;
    if (planId === 'addon_only_purchase') originalPrice = 0;

    let discountAmount = 0;
    let finalAmount = originalPrice;
    let message = 'Coupon applied successfully!';
    const normalizedCoupon = couponCode.toLowerCase().trim();

    if (normalizedCoupon === 'fullsupport' && planId === 'career_pro_max') {
      discountAmount = originalPrice;
      finalAmount = 0;
    } else if (normalizedCoupon === 'first100' && planId === 'lite_check') {
      discountAmount = originalPrice;
      finalAmount = 0;
    } else if (normalizedCoupon === 'first500' && planId === 'lite_check') {
      discountAmount = Math.floor(originalPrice * 0.98);
      finalAmount = originalPrice - discountAmount;
    } else if (normalizedCoupon === 'worthyone' && planId === 'career_pro_max') {
      discountAmount = Math.floor(originalPrice * 0.5);
      finalAmount = originalPrice - discountAmount;
    } else if (normalizedCoupon === 'vnkr50%' && planId === 'career_pro_max') {
      discountAmount = Math.floor(originalPrice * 0.5);
      finalAmount = originalPrice - discountAmount;
      message = 'Vinayaka Chavithi Offer applied! 50% off!';
    } else if (normalizedCoupon === 'vnk50' && planId === 'career_pro_max') {
      discountAmount = Math.floor(originalPrice * 0.5);
      finalAmount = originalPrice - discountAmount;
      message = 'VNK50 coupon applied! 50% off!';
    } else {
      return { couponApplied: null, discountAmount: 0, finalAmount: originalPrice, error: 'Invalid coupon code or not applicable to selected plan', isValid: false, message: 'Invalid coupon code or not applicable to selected plan' };
    }

    return { couponApplied: normalizedCoupon, discountAmount, finalAmount, isValid: true, message };
  }

  // ---------- Payment / free subscription flows ----------
  async processPayment(
    paymentData: { planId: string; amount: number; currency: string },
    userEmail: string,
    userName: string,
    accessToken: string,
    couponCode?: string,
    walletDeduction?: number,
    addOnsTotal?: number,
    selectedAddOns?: { [key: string]: number }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('PaymentService: Calling create-order Edge Function...');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          planId: paymentData.planId,
          amount: paymentData.amount, // paise
          couponCode,
          walletDeduction,
          addOnsTotal,
          selectedAddOns,
        }),
      });

      const orderResult = await response.json();
      if (!response.ok) {
        console.error('PaymentService: Error from create-order:', orderResult.error || response.statusText);
        return { success: false, error: orderResult.error || 'Failed to create order.' };
      }

      const { orderId, amount, keyId, currency, transactionId } = orderResult;

      return new Promise((resolve) => {
        const options = {
          key: keyId,
          amount,
          currency,
          name: 'PrimoBoost AI',
          description: 'Resume Optimization Plan',
          order_id: orderId,
          handler: async (rzpRes: any) => {
            try {
              console.log('PaymentService: Calling verify-payment Edge Function...');
              const verifyResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({
                  razorpay_order_id: rzpRes.razorpay_order_id,
                  razorpay_payment_id: rzpRes.razorpay_payment_id,
                  razorpay_signature: rzpRes.razorpay_signature,
                  transactionId,
                }),
              });

              const verifyResult = await verifyResponse.json();
              if (verifyResponse.ok && verifyResult.success) {
                resolve({ success: true });
              } else {
                console.error('PaymentService: Error from verify-payment:', verifyResult.error || verifyResponse.statusText);
                resolve({ success: false, error: verifyResult.error || 'Payment verification failed.' });
              }
            } catch (error: any) {
              console.error('PaymentService: Error during payment verification:', error.message);
              resolve({ success: false, error: 'An error occurred during payment verification.' });
            }
          },
          prefill: { name: userName, email: userEmail },
          theme: { color: '#4F46E5' },
          modal: {
            ondismiss: () => {
              console.log('PaymentService: Payment modal dismissed.');
              resolve({ success: false, error: 'Payment cancelled by user.' });
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      });
    } catch (error: any) {
      console.error('PaymentService: Error in processPayment:', error.message);
      return { success: false, error: error.message || 'Failed to process payment.' };
    }
  }

  async processFreeSubscription(
    planId: string,
    userId: string,
    couponCode?: string,
    addOnsTotal?: number,
    selectedAddOns?: { [key: string]: number },
    originalPlanAmount?: number, // paise
    walletDeduction?: number     // paise
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('PaymentService: Processing free subscription...');

      const plan = this.getPlanById(planId);
      if (!plan && planId !== 'addon_only_purchase') {
        throw new Error('Invalid plan selected for free subscription.');
      }

      if (plan && (typeof plan.durationInHours !== 'number' || !isFinite(plan.durationInHours))) {
        console.error('PaymentService: Invalid durationInHours detected for plan:', plan);
        throw new Error('Invalid plan duration configuration. Please contact support.');
      }

      // Record transaction (success for free)
      const { data: transaction, error: transactionError } = await supabase
        .from('payment_transactions')
        .insert({
          user_id: userId,
          plan_id: planId === 'addon_only_purchase' ? null : planId,
          status: 'success',
          amount: originalPlanAmount || 0,
          currency: 'INR',
          coupon_code: couponCode,
          discount_amount: originalPlanAmount || 0,
          final_amount: 0,
          purchase_type: planId === 'addon_only_purchase'
            ? 'addon_only'
            : (Object.keys(selectedAddOns || {}).length > 0 ? 'plan_with_addons' : 'plan'),
          wallet_deduction_amount: walletDeduction || 0,
          payment_id: 'FREE_PLAN_ACTIVATION',
          order_id: 'FREE_PLAN_ORDER',
        })
        .select('id')
        .single();

      if (transactionError) {
        console.error('PaymentService: Error inserting free transaction:', transactionError.message, transactionError.details);
        throw new Error('Failed to record free plan activation.');
      }
      const transactionId = transaction.id;

      // Add-ons issuance
      if (selectedAddOns && Object.keys(selectedAddOns).length > 0) {
        console.log(`[${new Date().toISOString()}] - Processing add-on credits for user: ${userId}`);
        for (const addOnKey of Object.keys(selectedAddOns)) {
          const quantity = Number(selectedAddOns[addOnKey] ?? 0);
          if (!quantity) continue;

          const addOnCfg = this.getAddOnById(addOnKey);
          if (!addOnCfg) {
            console.error(`[${new Date().toISOString()}] - Add-on with ID ${addOnKey} not found in configuration. Skipping.`);
            continue;
          }

          const { data: addonType, error: addonTypeError } = await supabase
            .from('addon_types')
            .select('id')
            .eq('type_key', addOnCfg.type)
            .single();

          if (addonTypeError || !addonType) {
            console.error(`[${new Date().toISOString()}] - Error finding addon_type for key ${addOnCfg.type}:`, addonTypeError?.message, addonTypeError?.details);
            continue;
          }

          const { error: creditInsertError } = await supabase
            .from('user_addon_credits')
            .insert({
              user_id: userId,
              addon_type_id: addonType.id,
              quantity_purchased: quantity,
              quantity_remaining: quantity,
              payment_transaction_id: transactionId,
            });

          if (creditInsertError) {
            console.error(`[${new Date().toISOString()}] - Error inserting add-on credits for ${addOnCfg.type}:`, creditInsertError.message, creditInsertError.details);
          }
        }
      }

      // Plan subscription issuance (if not addon-only)
      if (planId && planId !== 'addon_only_purchase' && plan) {
        const { data: subscription, error: subscriptionError } = await supabase
          .from('subscriptions')
          .insert({
            user_id: userId,
            plan_id: planId,
            status: 'active',
            start_date: new Date().toISOString(),
            end_date: new Date(Date.now() + plan.durationInHours * 60 * 60 * 1000).toISOString(),
            optimizations_used: 0,
            optimizations_total: plan.optimizations,
            score_checks_used: 0,
            score_checks_total: plan.scoreChecks,
            linkedin_messages_used: 0,
            linkedin_messages_total: plan.linkedinMessages,
            guided_builds_used: 0,
            guided_builds_total: plan.guidedBuilds,
            payment_id: 'FREE_PLAN_ACTIVATION',
            coupon_used: couponCode,
          })
          .select()
          .single();

        if (subscriptionError) {
          console.error('PaymentService: Subscription creation error for free plan:', subscriptionError.message, subscriptionError.details);
          throw new Error('Failed to create subscription for free plan.');
        }

        const { error: updateSubscriptionIdError } = await supabase
          .from('payment_transactions')
          .update({ subscription_id: subscription.id })
          .eq('id', transactionId);

        if (updateSubscriptionIdError) {
          console.error('Error updating payment transaction with subscription_id for free plan:', updateSubscriptionIdError.message, updateSubscriptionIdError.details);
        }
      }

      // Wallet deduction record (if any)
      if (walletDeduction && walletDeduction > 0) {
        const { error: walletError } = await supabase
          .from('wallet_transactions')
          .insert({
            user_id: userId,
            type: 'purchase_use',
            amount: -(walletDeduction / 100), // Convert paise to Rupees
            status: 'completed',
            transaction_ref: `free_plan_deduction_${transactionId}`,
            redeem_details: {
              plan_id: planId,
              original_amount: (originalPlanAmount ?? 0) / 100,
              addons_purchased: selectedAddOns,
            },
          });

        if (walletError) {
          console.error(`[${new Date().toISOString()}] - Wallet deduction recording error for free plan:`, walletError.message, walletError.details);
        }
      }

      return { success: true };
    } catch (error: any) {
      console.error('PaymentService: Error in processFreeSubscription:', error.message);
      throw error;
    }
  }
}

export const paymentService = new PaymentService();

