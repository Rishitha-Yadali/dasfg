// src/components/payment/PlanSelectionModal.tsx
import React, { useState } from 'react';
import { X, Sparkles, Target, Briefcase, Loader2, CheckCircle, AlertCircle, PlusCircle, TrendingUp, MessageCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { paymentService } from '../../services/paymentService';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

interface PlanSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCareerPlans: () => void;
  onSubscriptionSuccess: () => void;
  onShowAlert: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error', actionText?: string, onAction?: () => void) => void;
  triggeredByFeatureId?: string;
  // NEW PROP: Callback for successful add-on purchase
  onAddonPurchaseSuccess?: (featureId: string) => void;
}

export const PlanSelectionModal: React.FC<PlanSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelectCareerPlans,
  onSubscriptionSuccess,
  onShowAlert,
  triggeredByFeatureId,
  onAddonPurchaseSuccess, // Destructure the new prop
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getFeatureConfig = () => {
    switch (triggeredByFeatureId) {
      case 'guided-builder':
        return {
          title: 'Get Guided Resume Build',
          description: 'Purchase a single guided resume build session',
          icon: <PlusCircle className="w-5 h-5" />,
          addOnId: 'guided_resume_build_single_purchase',
          redirectPath: '/guided-builder',
          price: 29, // New discounted price
          mrp: 99, // Original price
          discountPercentage: ((99 - 29) / 99 * 100).toFixed(0), // Calculate discount
        };
      case 'score-checker':
        return {
          title: 'Get Resume Score Check',
          description: 'Purchase a single resume score analysis',
          icon: <TrendingUp className="w-5 h-5" />,
          addOnId: 'resume_score_check_single_purchase',
          redirectPath: '/score-checker',
          price: 9, // New discounted price
          mrp: 19, // Original price
          discountPercentage: ((19 - 9) / 19 * 100).toFixed(0), // Calculate discount
        };
      case 'linkedin-generator':
        return {
          title: 'Get LinkedIn Messages',
          description: 'Purchase LinkedIn message generation credits',
          icon: <MessageCircle className="w-5 h-5" />,
          addOnId: 'linkedin_messages_50_purchase',
          redirectPath: '/linkedin-generator',
          price: 29,
          mrp: 29, // Assuming no discount for this one, or adjust as needed
          discountPercentage: 0,
        };
      default: // This will be for 'optimizer' by default
        return {
          title: 'Get JD-Based Optimization',
          description: 'Purchase a single resume optimization',
          icon: <Target className="w-5 h-5" />,
          addOnId: 'jd_optimization_single_purchase',
          redirectPath: '/optimizer',
          price: 19, // New discounted price
          mrp: 49, // Original price
          discountPercentage: ((49 - 19) / 49 * 100).toFixed(0), // Calculate discount
        };
    }
  };

  const featureConfig = getFeatureConfig();

  const handlePurchaseFeature = async () => {
    if (!user) {
      onShowAlert('Authentication Required', 'Please sign in to complete your purchase.', 'error', 'Sign In', () => {});
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const addOn = paymentService.getAddOnById(featureConfig.addOnId);
      if (!addOn) {
        throw new Error(`${featureConfig.title} product not found.`);
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session || !session.access_token) {
        throw new Error('No active session found. Please log in again.');
      }

      const paymentData = {
        planId: 'addon_only_purchase',
        amount: featureConfig.price * 100, // Use the new discounted price
        currency: 'INR',
      };

      const selectedAddOns = {
        [addOn.id]: addOn.quantity,
      };

      const result = await paymentService.processPayment(
        paymentData,
        user.email,
        user.name,
        session.access_token,
        undefined, // No coupon
        0, // No wallet deduction for this direct purchase
        featureConfig.price * 100, // Use the new discounted price for addOnsTotal
        selectedAddOns
      );

      if (result.success) {
        onSubscriptionSuccess();
        onShowAlert('Purchase Successful!', `Your ${featureConfig.title} credit has been added.`, 'success');

        // Check if it was a single-use add-on purchase (triggeredByFeatureId is present)
        if (triggeredByFeatureId) {
            // Call the new callback for add-on purchase success
            if (onAddonPurchaseSuccess) {
                console.log("PlanSelectionModal: Calling onAddonPurchaseSuccess for feature:", triggeredByFeatureId); // ADD LOG
                onAddonPurchaseSuccess(triggeredByFeatureId);
            }
            onClose(); // CRITICAL: Close the modal after successful purchase and callback
        } else {
            // For full plan purchases or general plan selection, navigate to pricing page
            navigate('/pricing');
            onClose(); // CRITICAL: Close the modal
        }
      } else {
        setError(result.error || 'Payment failed. Please try again.');
        onShowAlert('Payment Failed', result.error || 'Payment processing failed. Please try again.', 'error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      onShowAlert('Error', err instanceof Error ? err.message : 'An unexpected error occurred.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-sm dark:bg-black/80">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[95vh] overflow-y-auto dark:bg-dark-100 dark:shadow-dark-xl transform transition-all duration-300 scale-100 opacity-100">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50 p-6 border-b border-gray-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-white/50 z-10 min-w-[44px] min-h-[44px] dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-dark-300/50"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="text-center">
            <div className="bg-gradient-to-br from-neon-cyan-500 to-neon-blue-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg dark:shadow-neon-cyan animate-pulse">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Choose Your Path to Success
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Select the option that best fits your resume optimization needs.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl dark:bg-red-900/20 dark:border-red-500/50 animate-fadeIn">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 mt-0.5" />
                <p className="text-red-700 dark:text-red-300 text-sm font-medium">{error}</p>
              </div>
            </div>
          )}

          <button
            onClick={handlePurchaseFeature}
            disabled={isProcessing}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed dark:from-neon-cyan-500 dark:to-neon-blue-500 dark:hover:from-neon-cyan-400 dark:hover:to-neon-blue-400 dark:shadow-neon-cyan transform hover:scale-105 active:scale-95"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                {featureConfig.icon}
                <span>
                  {featureConfig.title} -{' '}
                  {featureConfig.mrp && featureConfig.mrp > featureConfig.price ? (
                    <>
                      <span className="line-through">₹{featureConfig.mrp}</span>{' '}
                      <span className="font-bold">₹{featureConfig.price}</span>
                      {featureConfig.discountPercentage && (
                        <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">
                          {featureConfig.discountPercentage}% OFF
                        </span>
                      )}
                    </>
                  ) : (
                    `₹${featureConfig.price}`
                  )}
                </span>
              </>
            )}
          </button>

          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            or
          </div>

          <button
            onClick={onSelectCareerPlans}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed dark:from-neon-purple-500 dark:to-neon-pink-500 dark:hover:from-neon-purple-400 dark:hover:to-neon-pink-400 dark:shadow-neon-purple transform hover:scale-105 active:scale-95"
          >
            <Briefcase className="w-5 h-5" />
            <span>Explore Career Plans</span>
          </button>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 dark:bg-neon-cyan-500/10 dark:border-neon-cyan-400/50">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0 dark:bg-neon-cyan-400"></div>
              <div className="text-sm text-blue-800 dark:text-neon-cyan-300">
                <p className="font-medium mb-1">💡 Pro Tip</p>
                <p className="text-blue-700 dark:text-gray-300">
                  Career plans offer better value with multiple credits and unlimited features. Perfect for job seekers who need ongoing optimization.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
