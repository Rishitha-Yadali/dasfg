// src/components/payment/SubscriptionPlans.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  Check,
  Star,
  Zap,
  Crown,
  Clock,
  X, // Ensure X is imported
  Tag,
  Sparkles,
  ArrowRight,
  Info,
  ChevronLeft,
  ChevronRight,
  Timer,
  Target,
  Rocket,
  Briefcase,
  Infinity,
  CheckCircle,
  AlertCircle,
  Wrench,
  Gift,
  Plus,
  ChevronDown, // Added for add-ons toggle
  ChevronUp,   // Added for add-ons toggle
  Wallet     // Added for wallet section
} from 'lucide-react';
import { SubscriptionPlan } from '../../types/payment';
import { paymentService } from '../../services/paymentService';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

interface SubscriptionPlansProps {
  isOpen: boolean;
  onNavigateBack: () => void;
  onSubscriptionSuccess: () => void;
  // ADDED: onShowAlert prop
  onShowAlert: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error', actionText?: string, onAction?: () => void) => void;
  initialExpandAddons?: boolean; // NEW PROP
}

type AddOn = {
  id: string;
  name: string;
  price: number;
};

type AppliedCoupon = {
  code: string;
  discount: number; // In paise
  finalAmount: number; // In paise
};

export const SubscriptionPlans: React.FC<SubscriptionPlansProps> = ({
  isOpen,
  onNavigateBack,
  onSubscriptionSuccess,
  onShowAlert, // ADDED: Destructure onShowAlert
  initialExpandAddons, // NEW: Destructure initialExpandAddons
}) => {
  const { user } = useAuth();
  // MODIFIED: Change initial state to 'career_boost_plus'
  const [selectedPlan, setSelectedPlan] = useState<string>('career_boost_plus');
  const [isProcessing, setIsProcessing] = useState(false);
  // Initial slide set to index 2 to correspond to 'career_boost_plus' if it's the 3rd plan in the array (0-indexed).
  // This might need adjustment if the order of plans changes.
  const [currentSlide, setCurrentSlide] = useState(2);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [walletBalance, setWalletBalance] = useState<number>(0); // Stored in paise
  const [useWalletBalance, setUseWalletBalance] = useState<boolean>(false);
  const [loadingWallet, setLoadingWallet] = useState<boolean>(true);
  const [showAddOns, setShowAddOns] = useState<boolean>(initialExpandAddons || false); // MODIFIED: Initialize with new prop
  const [selectedAddOns, setSelectedAddOns] = useState<{ [key: string]: number }>({});
  const carouselRef = useRef<HTMLDivElement>(null);

  const plans: SubscriptionPlan[] = paymentService.getPlans();
  const addOns: AddOn[] = paymentService.getAddOns();

  // Combine regular plans with the special "Add-ons Only" option
  const allPlansWithAddOnOption = [
    ...plans,
    
  ];

  // REMOVED: The useEffect block that sets selectedPlan based on currentSlide.
  // This was causing the selected plan to be overwritten by the carousel's state.

  // Fetch wallet balance when the component mounts or when it becomes open/user changes
  useEffect(() => {
    if (user && isOpen) {
      fetchWalletBalance();
    }
  }, [user, isOpen]);

  // Function to fetch the user's wallet balance from Supabase
  const fetchWalletBalance = async () => {
    if (!user) return;
    setLoadingWallet(true);
    try {
      const { data: transactions, error } = await supabase
        .from('wallet_transactions')
        .select('amount, status')
        .eq('user_id', user.id);
      if (error) {
        console.error('Error fetching wallet balance:', error);
        return;
      }
      // Filter for completed transactions and sum the amounts
      const completed = (transactions || []).filter((t: any) => t.status === 'completed');
      // Wallet balance is stored in Rupees in DB, convert to paise for internal use
      const balance = completed.reduce((sum: number, tr: any) => sum + parseFloat(tr.amount), 0) * 100;
      setWalletBalance(Math.max(0, balance)); // Ensure balance is not negative
    } catch (err) {
      console.error('Error fetching wallet data:', err);
    } finally {
      setLoadingWallet(false);
    }
  };

  if (!isOpen) return null;

  // Helper function to return the correct Lucide icon component based on string input
  const getPlanIcon = (iconType: string) => {
    switch (iconType) {
      case 'crown':
        return <Crown className="w-5 h-5 sm:w-6 sm:h-6" />;
      case 'zap':
        return <Zap className="w-5 h-5 sm:w-6 sm:h-6" />;
      case 'rocket':
        return <Rocket className="w-5 h-5 sm:w-6 sm:h-6" />;
      case 'target':
        return <Target className="w-5 h-5 sm:w-6 sm:h-6" />;
      case 'wrench':
        return <Wrench className="w-5 h-5 sm:w-6 sm:h-6" />;
      case 'check_circle':
        return <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6" />;
      case 'gift':
        return <Gift className="w-5 h-5 sm:w-6 sm:h-6" />;
      case 'briefcase':
        return <Briefcase className="w-5 h-5 sm:w-6 sm:h-6" />;
      case 'infinity':
        return <Infinity className="w-5 h-5 sm:w-6 sm:h-6" />;
      default:
        return <Star className="w-5 h-5 sm:w-6 sm:h-6" />;
    }
  };

  // Carousel navigation functions
  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % allPlansWithAddOnOption.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + allPlansWithAddOnOption.length) % allPlansWithAddOnOption.length);
  };

  const goToSlide = (index: number) => {
    // This function can be used to directly jump to a slide (e.g., from dots)
    setCurrentSlide(index);
  };

  // Handles applying a coupon code
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      onShowAlert('Coupon Error', 'Please enter a coupon code.', 'warning');
      return;
    }
    if (!user) {
      onShowAlert('Authentication Required', 'Please sign in to apply coupon.', 'error', 'Sign In', () => {});
      return;
    }

    // paymentService.applyCoupon now returns isValid and message
    const result = await paymentService.applyCoupon(selectedPlan, couponCode.trim(), user.id);

    if (result.isValid) {
      setAppliedCoupon({
        code: result.couponApplied!, // Use non-null assertion as isValid implies couponApplied is not null
        discount: result.discountAmount,
        finalAmount: result.finalAmount,
      });
      setCouponError('');
      onShowAlert('Coupon Applied!', result.message, 'success');
    } else {
      setCouponError(result.message); // Display the specific error message from the service
      setAppliedCoupon(null);
      onShowAlert('Coupon Error', result.message, 'warning');
    }
  };

  // Handles removing an applied coupon
  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  // Find the currently selected plan data
  const selectedPlanData = allPlansWithAddOnOption.find((p) => p.id === selectedPlan);

  // Calculate add-ons total in paise
  const addOnsTotal = Object.entries(selectedAddOns).reduce((total, [addOnId, qty]) => {
    const addOn = paymentService.getAddOnById(addOnId);
    return total + (addOn ? addOn.price * 100 * qty : 0); // Multiply addOn.price by 100 for paise
  }, 0);

  // Initialize plan price from selected plan, convert to paise
  let planPrice = (selectedPlanData?.price || 0) * 100;
  // If a coupon is applied, use the final amount from the coupon calculation
  if (appliedCoupon) {
    planPrice = appliedCoupon.finalAmount; // appliedCoupon.finalAmount is already in paise
  }

  // Calculate wallet deduction, limited by available wallet balance and plan price
  const walletDeduction = useWalletBalance ? Math.min(walletBalance, planPrice) : 0; // walletBalance is in paise

  // Calculate the final plan price after wallet deduction, ensuring it's not negative
  const finalPlanPrice = Math.max(0, planPrice - walletDeduction);

  // Calculate the grand total including final plan price and add-ons
  const grandTotal = finalPlanPrice + addOnsTotal;

  // Handles the payment process
  const handlePayment = async () => {
    if (!user || !selectedPlanData) return;
    setIsProcessing(true);

    // ADDED DEBUGGING LOGS
    console.log('DEBUG: handlePayment - walletBalance (paise):', walletBalance);
    console.log('DEBUG: handlePayment - planPrice (paise, after coupon):', planPrice);
    console.log('DEBUG: handlePayment - walletDeduction (paise):', walletDeduction);
    console.log('DEBUG: handlePayment - finalPlanPrice (paise):', finalPlanPrice);
    console.log('DEBUG: handlePayment - addOnsTotal (paise):', addOnsTotal);
    console.log('DEBUG: handlePayment - grandTotal (paise):', grandTotal);

    try {
      // Retrieve the session and access token for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      console.log('SubscriptionPlans: session object after getSession:', session);
      console.log('SubscriptionPlans: session.access_token after getSession:', session?.access_token);

      if (sessionError || !session || !session.access_token) {
        console.error('SubscriptionPlans: No active session found for payment:', sessionError);
        // Show an authentication required message to the user
        onShowAlert('Authentication Required', 'Please log in to complete your purchase.', 'error', 'Sign In', () => {});
        setIsProcessing(false);
        return;
      }

      const accessToken = session.access_token;

      console.log('SubscriptionPlans: Value of accessToken before calling processPayment:', accessToken);

      // Handle zero-amount transactions (e.g., fully covered by wallet or free plan/coupon)
      if (grandTotal === 0) {
        // Call processFreeSubscription with all relevant data
        const result = await paymentService.processFreeSubscription(
          selectedPlan,
          user.id,
          appliedCoupon ? appliedCoupon.code : undefined,
          addOnsTotal, // addOnsTotal is already in paise
          selectedAddOns, // Pass selectedAddOns to processFreeSubscription
          selectedPlanData.price * 100, // Pass original plan price in paise
          walletDeduction // Pass walletDeduction
        );
        if (result.success) {
          // Refresh wallet balance after any successful payment or free activation
          await fetchWalletBalance();
          onSubscriptionSuccess();
          onShowAlert('Subscription Activated!', 'Your free plan has been activated successfully.', 'success');
        } else {
          console.error(result.error || 'Failed to activate free plan.');
          onShowAlert('Activation Failed', result.error || 'Failed to activate free plan.', 'error');
        }
      } else {
        // Process paid subscription
        const paymentData = {
          planId: selectedPlan,
          amount: grandTotal, // grandTotal is already in paise
          currency: 'INR',
        };
        const result = await paymentService.processPayment(
          paymentData,
          user.email,
          user.name,
          accessToken, // Pass the access token for authentication
          appliedCoupon ? appliedCoupon.code : undefined,
          walletDeduction, // walletDeduction is already in paise
          addOnsTotal, // addOnsTotal is already in paise
          selectedAddOns
        );
        if (result.success) {
          // Refresh wallet balance after any successful payment
          await fetchWalletBalance();
          onSubscriptionSuccess();
          onShowAlert('Payment Successful!', 'Your subscription has been activated.', 'success');
        } else {
          console.error('Payment failed:', result.error);
          // If payment failed, and it was due to user cancellation, show a specific message
          if (result.error && result.error.includes('Payment cancelled by user')) {
            onShowAlert('Payment Cancelled', 'You have cancelled the payment. Please try again if you wish to proceed.', 'info');
          } else {
            onShowAlert('Payment Failed', result.error || 'Payment processing failed. Please try again.', 'error');
          }
        }
      }
    } catch (error) {
      console.error('Payment process error:', error);
      onShowAlert('Payment Error', error instanceof Error ? error.message : 'An unexpected error occurred during payment.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handles changing the quantity of an add-on
  const handleAddOnQuantityChange = (addOnId: string, quantity: number) => {
    console.log('DEBUG: handleAddOnQuantityChange called for:', addOnId, 'with quantity:', quantity);
    setSelectedAddOns((prev) => ({
      ...prev,
      [addOnId]: Math.max(0, quantity), // Ensure quantity doesn't go below zero
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-sm dark:bg-black/80 flex flex-col">
      <div className="bg-white rounded-xl sm:rounded-2xl lg:rounded-3xl w-full max-w-7xl max-h-[95vh] overflow-y-auto flex flex-col dark:bg-dark-100 dark:shadow-dark-xl">
        {/* Header Section */}
        <div className="relative bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 px-3 sm:px-6 py-4 sm:py-8 border-b border-gray-100 flex-shrink-0 dark:from-dark-200 dark:via-dark-300 dark:to-dark-400 dark:border-dark-500">
          {/* Back button */}
          <button
            onClick={onNavigateBack}
            className="absolute top-2 sm:top-4 left-2 sm:left-4 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-white/50 z-10 min-w-[44px] min-h-[44px] dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-dark-300/50"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {/* New X (close) button */}
          <button
            onClick={onNavigateBack}
            className="absolute top-2 sm:top-4 right-2 sm:right-4 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-white/50 z-10 min-w-[44px] min-h-[44px] dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-dark-300/50"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          <div className="text-center max-w-4xl mx-auto px-8">
            <div className="bg-gradient-to-r from-neon-cyan-500 to-neon-purple-500 w-12 h-12 sm:w-20 sm:h-20 rounded-xl sm:rounded-3xl flex items-center justify-center mx-auto mb-3 sm:mb-6 shadow-lg dark:shadow-neon-cyan">
              <Sparkles className="w-6 h-6 sm:w-10 h-10 text-white" />
            </div>
            <h1 className="text-lg sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2 sm:mb-3">
              🏆 Ultimate Resume & Job Prep Plans
            </h1>
            <p className="text-sm sm:text-lg lg:text-xl text-gray-600 dark:text-gray-300 mb-3 sm:mb-6">
              AI-powered resume optimization with secure payment
            </p>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="p-3 sm:p-6 lg:p-8 overflow-y-auto flex-1 flex-grow">
          {/* Mobile Carousel */}
          <div className="block md:hidden mb-4 sm:mb-8">
            <div className="relative">
              <div className="overflow-hidden rounded-xl sm:rounded-3xl">
                <div
                  ref={carouselRef}
                  className="flex transition-transform duration-300 ease-in-out"
                  style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                >
                  {allPlansWithAddOnOption.map((plan, index) => (
                    <div key={plan.id} className="w-full flex-shrink-0 px-4 sm:px-6"> {/* Changed px-2 to px-4 for mobile */}
                      <div
                        className={`relative rounded-xl sm:rounded-3xl border-2 transition-all duration-300 ${
                          selectedPlan === plan.id
                            ? 'border-indigo-500 shadow-2xl shadow-indigo-500/20 ring-4 ring-indigo-100'
                            : 'border-gray-200'
                        } ${plan.popular ? 'ring-2 ring-green-500 ring-offset-4' : ''}`}
                        // Removed onClick from here to prevent entire card from being clickable
                      >
                        {plan.popular && (
                          <div className="absolute -top-4 sm:-top-2 left-1/2 transform -translate-x-1/2">
                            <span className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 sm:px-6 py-1 sm:py-2 rounded-full text-xs font-bold shadow-lg">
                              🏆 Most Popular
                            </span>
                          </div>
                        )}
                        <div className="p-3 sm:p-6">
                          <div className="text-center mb-3 sm:mb-6">
                            <div
                              className={`bg-gradient-to-r ${plan.gradient || ''} w-10 h-10 sm:w-16 sm:h-16 rounded-lg sm:rounded-2xl flex items-center justify-center mx-auto mb-2 sm:mb-4 text-white shadow-lg`}
                            >
                              {getPlanIcon(plan.icon || '')}
                            </div>
                            <div
                              className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium border mb-2 sm:mb-3 ${
                                plan.tagColor || ''
                              }`}
                            >
                              {plan.tag}
                            </div>
                            <h3 className="text-base sm:text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                            <div className="text-center mb-4"> {/* Increased mb to push credits down */}
                              <span className="text-sm text-red-500 line-through">₹{plan.mrp}</span>
                              <div className="flex items-center justify-center">
                                <span className="block text-xl sm:text-3xl font-bold text-gray-900 dark:text-dark-900"> {/* Added 'block' */}
                                  ₹{plan.price}
                                </span>
                                <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">
                                  {plan.discountPercentage}% OFF
                                </span>
                              </div>
                              <span className="block text-gray-600 text-xs sm:text-base"> {/* Added 'block', removed ml-1 */}
                                One-time purchase
                              </span>
                            </div>
                          </div>
                          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg sm:rounded-2xl p-2 sm:p-4 text-center mb-4"> {/* Adjusted mb */}
                            <div className="text-lg sm:text-2xl font-bold text-indigo-600">{plan.optimizations}</div>
                            <div className="text-xs sm:text-sm text-gray-600">Resume Credits</div>
                          </div>
                          {/* MODIFIED LINE BELOW */}
                          <ul className="space-y-1 sm:space-y-3 mb-3 sm:mb-6 max-h-32 sm:max-h-none overflow-y-auto sm:overflow-visible">
                            {(plan.features || []).slice(0, 4).map((feature: string, fi: number) => (
                              <li key={fi} className="flex items-start">
                                <Check className="w-4 h-4 sm:w-5 h-5 text-emerald-500 mr-2 sm:mr-3 mt-0.5 flex-shrink-0" /> {/* Increased icon size slightly for better alignment with larger text */}
                                <span className="text-gray-700 text-sm sm:text-base break-words dark:text-gray-300">{feature}</span> {/* Changed text-xs to text-sm, and sm:text-sm to sm:text-base */}
                              </li>
                            ))}
                          </ul>
                          {/* ADDED: Select Plan button for mobile carousel */}
                          <button // This button is now part of the plan card, not the sticky footer
                            onClick={() => setSelectedPlan(plan.id)}
                            className={`w-full py-2 sm:py-3 px-2 sm:px-4 rounded-lg sm:rounded-xl font-semibold transition-all duration-300 text-xs sm:text-base min-h-[44px] mt-2 ${
                              selectedPlan === plan.id
                                ? `bg-gradient-to-r ${plan.gradient || ''} text-white shadow-lg transform scale-105`
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {selectedPlan === plan.id ? (
                              <span className="flex items-center justify-center">
                                <Check className="w-3 h-3 sm:w-5 h-5 mr-1 sm:mr-2" />
                                Selected
                              </span>
                            ) : (
                              'Select Plan'
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={prevSlide}
                className="absolute left-1 sm:left-2 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white text-gray-700 p-2 rounded-full shadow-lg transition-all duration-200 z-10 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <ChevronLeft className="w-4 h-4 sm:w-6 h-6" />
              </button>
              <button
                onClick={nextSlide}
                className="absolute right-1 sm:right-2 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white text-gray-700 p-2 rounded-full shadow-lg transition-all duration-200 z-10 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <ChevronRight className="w-4 h-4 sm:w-6 h-6" />
              </button>
              <div className="flex justify-center space-x-2 mt-3 sm:mt-6">
                {allPlansWithAddOnOption.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => goToSlide(idx)}
                    className={`w-2 h-2 sm:w-3 h-3 rounded-full transition-all duration-200 ${
                      idx === currentSlide ? 'bg-indigo-600 scale-125' : 'bg-gray-300 hover:bg-gray-400'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Desktop Grid */}
          <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-6 mb-4 lg:mb-8">
            {allPlansWithAddOnOption.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-xl lg:rounded-3xl border-2 transition-all duration-300 cursor-pointer transform hover:scale-105 ${
                  selectedPlan === plan.id
                    ? 'border-neon-cyan-500 shadow-2xl shadow-neon-cyan/20 ring-4 ring-neon-cyan-100 dark:border-neon-cyan-400 dark:ring-neon-cyan-400/30'
                    : 'border-gray-200 hover:border-neon-cyan-300 hover:shadow-xl dark:border-dark-300 dark:hover:border-neon-cyan-400'
                } ${plan.popular ? 'ring-2 ring-green-500 ring-offset-4' : ''}`}
                // Removed onClick from here to prevent entire card from being clickable
              >
                {plan.popular && (
                 <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span
                      className="inline-flex items-center bg-gradient-to-r from-green-500 to-emerald-500 text-white px-2 lg:px-4 py-1 lg:py-2 rounded-full text-xs lg:text-sm font-bold shadow-lg"
                      style={{ fontSize: '10px', lineHeight: '1rem' }}
                    >
                      <span className="mr-1 text-sm">🏆</span> {plan.id === 'career_boost_plus' ? 'Most Popular' : 'Best Value'}
                    </span>
                  </div>


                )}
                <div className="p-3 lg:p-6">
                  <div className="text-center mb-3 lg:mb-6">
                    {/* Plan Name */}
                    <h3 className="text-sm lg:text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 break-words">{plan.name}</h3>
                    {/* Price Display */}
                    <div className="flex flex-col items-center mb-2">
                      <span className="text-sm text-red-500 line-through">₹{plan.mrp}</span>
                      <div className="flex items-center">
                        <span className="text-xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">₹{plan.price}</span>
                        <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">
                          {plan.discountPercentage}% OFF
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">One-time purchase</p>
                  </div>
                  {/* Resume Credits - Adjusted mb */}
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg lg:rounded-2xl p-2 lg:p-4 text-center mb-4"> {/* Adjusted mb */}
                    <div className="text-lg lg:text-2xl font-bold text-indigo-600">{plan.optimizations}</div>
                    <div className="text-xs lg:text-sm text-gray-600">Resume Credits</div>
                  </div>
                  {/* MODIFIED LINE BELOW */}
                  <ul className="space-y-1 lg:space-y-3 mb-3 lg:mb-6 max-h-32 lg:max-h-none overflow-y-auto lg:overflow-visible">
                    {(plan.features || []).slice(0, 4).map((feature: string, fi: number) => (
                      <li key={fi} className="flex items-start">
                        <Check className="w-4 h-4 lg:w-5 h-5 text-emerald-500 mr-2 lg:mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-sm lg:text-base text-gray-700 break-words dark:text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => setSelectedPlan(plan.id)} // This button is now part of the plan card, not the sticky footer
                    className={`w-full py-2 lg:py-3 px-2 lg:px-4 rounded-lg lg:rounded-xl font-semibold transition-all duration-300 text-sm lg:text-base min-h-[44px] mt-2 ${
                      selectedPlan === plan.id
                        ? `bg-gradient-to-r ${plan.gradient || ''} text-white shadow-lg transform scale-105`
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {selectedPlan === plan.id ? (
                      <span className="flex items-center justify-center">
                        <Check className="w-3 h-3 lg:w-5 h-5 mr-1 lg:mr-2" />
                        Selected
                      </span>
                    ) : (
                      'Select Plan'
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add-ons Section */}
          <div className="mb-4 lg:mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
                <Plus className="w-5 h-5 mr-2 text-purple-600 dark:text-neon-purple-400" />
                Add-ons
              </h2>
              <button
                onClick={() => setShowAddOns(!showAddOns)}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center space-x-1 dark:text-neon-cyan-400 dark:hover:text-neon-cyan-300"
              >
                <span>{showAddOns ? 'Hide' : 'Show'} Add-ons</span>
                {showAddOns ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
            {showAddOns && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fadeIn">
                {addOns.map((addOn) => (
                  <div key={addOn.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200 dark:bg-dark-200 dark:border-dark-300">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{addOn.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">₹{addOn.price}</p>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleAddOnQuantityChange(addOn.id, (selectedAddOns[addOn.id] || 0) - 1)}
                        disabled={(selectedAddOns[addOn.id] || 0) === 0}
                        className="btn-secondary p-2 rounded-full min-w-[32px] min-h-[32px] flex items-center justify-center"
                      >
                        -
                      </button>
                      <span className="font-bold text-lg text-gray-900 dark:text-gray-100">
                        {selectedAddOns[addOn.id] || 0}
                      </span>
                      <button
                        onClick={() => handleAddOnQuantityChange(addOn.id, (selectedAddOns[addOn.id] || 0) + 1)}
                        className="btn-secondary p-2 rounded-full min-w-[32px] min-h-[32px] flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Coupon Code Section */}
          <div className="mb-4 lg:mb-8">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              <Tag className="w-5 h-5 mr-2 text-orange-600 dark:text-orange-400" />
              Apply Coupon Code
            </h2>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Enter coupon code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="input-base flex-1"
                disabled={!!appliedCoupon}
              />
              {!appliedCoupon ? (
                <button
                  onClick={handleApplyCoupon}
                  className="btn-primary px-4 py-2"
                  disabled={!couponCode.trim()}
                >
                  Apply
                </button>
              ) : (
                <button
                  onClick={handleRemoveCoupon}
                  className="btn-secondary px-4 py-2"
                >
                  Remove
                </button>
              )}
            </div>
            {couponError && (
              <p className="text-red-600 text-sm mt-2 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {couponError}
              </p>
            )}
            {appliedCoupon && (
              <p className="text-green-600 text-sm mt-2 flex items-center">
                <CheckCircle className="w-4 h-4 mr-1" />
                Coupon "{appliedCoupon.code}" applied! You saved ₹{(appliedCoupon.discount / 100).toFixed(2)}.
              </p>
            )}
          </div>

          {/* Wallet Balance Section */}
          <div className="mb-4 lg:mb-8">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              <Wallet className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
              Wallet Balance
            </h2>
            {loadingWallet ? (
              <div className="text-gray-600 dark:text-gray-300">Loading wallet...</div>
            ) : (
              <div className="flex items-center space-x-3">
                <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  ₹{(walletBalance / 100).toFixed(2)}
                </span>
                {walletBalance > 0 && (
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useWalletBalance}
                      onChange={(e) => setUseWalletBalance(e.target.checked)}
                      className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300 text-sm">
                      Use wallet balance
                    </span>
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="bg-gray-50 rounded-xl p-4 lg:p-6 border border-gray-200 dark:bg-dark-200 dark:border-dark-300 mb-4 lg:mb-8">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              <Info className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              Order Summary
            </h2>
            <div className="space-y-2 text-gray-700 dark:text-gray-300">
              <div className="flex justify-between">
                <span>Plan Price:</span>
                <span>₹{(planPrice / 100).toFixed(2)}</span>
              </div>
              {Object.keys(selectedAddOns).length > 0 && (
                <div className="flex justify-between">
                  <span>Add-ons:</span>
                  <span>₹{(addOnsTotal / 100).toFixed(2)}</span>
                </div>
              )}
              {appliedCoupon && (
                <div className="flex justify-between text-green-600 dark:text-green-400">
                  <span>Coupon Discount:</span>
                  <span>- ₹{(appliedCoupon.discount / 100).toFixed(2)}</span>
                </div>
              )}
              {useWalletBalance && walletDeduction > 0 && (
                <div className="flex justify-between text-red-600 dark:text-red-400">
                  <span>Wallet Deduction:</span>
                  <span>- ₹{(walletDeduction / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg text-gray-900 dark:text-gray-100 border-t border-gray-300 pt-2">
                <span>Grand Total:</span>
                <span>₹{(grandTotal / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Checkout Button */}
          <div className="p-3 sm:p-6 lg:p-8 border-t border-gray-100 flex-shrink-0 bg-white dark:bg-dark-100 dark:border-dark-500">
            <button
              onClick={handlePayment}
              disabled={isProcessing}
              className="w-full btn-primary py-3 sm:py-4 flex items-center justify-center text-lg sm:text-xl font-semibold rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {isProcessing ? (
                <span className="flex items-center">
                  <Clock className="w-5 h-5 mr-2 animate-spin" /> Processing...
                </span>
              ) : (
                <span className="flex items-center">
                  Proceed to Checkout <ArrowRight className="w-5 h-5 ml-2" />
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

