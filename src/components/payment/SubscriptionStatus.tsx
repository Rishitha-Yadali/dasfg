import React, { useState, useEffect } from 'react';
import { Crown, Calendar, Zap, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { Subscription } from '../../types/payment';
import { paymentService } from '../../services/paymentService';
import { useAuth } from '../../contexts/AuthContext';

interface SubscriptionStatusProps {
  onUpgrade: () => void;
}

export const SubscriptionStatus: React.FC<SubscriptionStatusProps> = ({ onUpgrade }) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscription();
  }, [user]);

  const loadSubscription = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const userSubscription = await paymentService.getUserSubscription(user.id);
      setSubscription(userSubscription);
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const getUsagePercentage = () => {
    if (!subscription) return 0;
    return (subscription.optimizationsUsed / subscription.optimizationsTotal) * 100;
  };

  const getStatusColor = () => {
    if (!subscription) return 'text-gray-500';
    
    const remaining = subscription.optimizationsTotal - subscription.optimizationsUsed;
    const percentage = getUsagePercentage();
    
    if (remaining === 0) return 'text-red-500';
    if (percentage > 80) return 'text-orange-500';
    return 'text-green-500';
  };

  const getStatusIcon = () => {
    if (!subscription) return <AlertCircle className="w-5 h-5" />;
    
    const remaining = subscription.optimizationsTotal - subscription.optimizationsUsed;
    
    if (remaining === 0) return <AlertCircle className="w-5 h-5" />;
    return <CheckCircle className="w-5 h-5" />;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading subscription...</span>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl shadow-lg p-6 border border-blue-200">
        <div className="text-center">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Crown className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Active Subscription</h3>
          <p className="text-gray-600 mb-6">
            Subscribe to start optimizing your resume with AI-powered tools
          </p>
          <button
            onClick={onUpgrade}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            Choose Your Plan
          </button>
        </div>
      </div>
    );
  }

  const remaining = subscription.optimizationsTotal - subscription.optimizationsUsed;
  const daysLeft = getDaysRemaining(subscription.endDate);
  const usagePercentage = getUsagePercentage();

  // --- NEW LOGIC FOR DISPLAYING DAYS REMAINING ---
  const fullPlanDetails = paymentService.getPlanById(subscription.planId);
  let displayDaysRemaining: string | number;

  if (fullPlanDetails?.id === 'lifetime') {
    displayDaysRemaining = 'Infinite';
  } else if (daysLeft === 0) {
    // If daysLeft is 0, but it's not a lifetime plan, display 30 days (assuming monthly cycle reset)
    // You might want to refine this logic based on your specific plan cycles
    displayDaysRemaining = '30';
  } else {
    displayDaysRemaining = daysLeft;
  }
  // --- END NEW LOGIC ---

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mr-4">
              <Crown className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Active Subscription</h3>
              <p className="text-gray-600">
                {paymentService.getPlanById(subscription.planId)?.name}
              </p>
            </div>
          </div>
          <div className={`flex items-center ${getStatusColor()}`}>
            {getStatusIcon()}
            <span className="ml-2 font-medium">
              {remaining > 0 ? 'Active' : 'Exhausted'}
            </span>
          </div>
        </div>
      </div>

      {/* Usage Stats */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Optimizations Left */}
          <div className="text-center">
            <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{remaining}</div>
            <div className="text-sm text-gray-600">Optimizations Left</div>
          </div>

          {/* Days Remaining */}
          <div className="text-center">
            <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{displayDaysRemaining}</div> {/* Renders the new display value */}
            <div className="text-sm text-gray-600">Days Remaining</div>
          </div>

          {/* Usage Percentage */}
          <div className="text-center">
            <div className="bg-orange-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <RefreshCw className="w-6 h-6 text-orange-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{Math.round(usagePercentage)}%</div>
            <div className="text-sm text-gray-600">Used</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Usage Progress</span>
            <span>{subscription.optimizationsUsed} / {subscription.optimizationsTotal}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${
                usagePercentage > 90 ? 'bg-red-500' :
                usagePercentage > 70 ? 'bg-orange-500' :
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Subscription Details */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Start Date:</span>
              <span className="ml-2 font-medium">{formatDate(subscription.startDate)}</span>
            </div>
            <div>
              <span className="text-gray-600">End Date:</span>
              <span className="ml-2 font-medium">{formatDate(subscription.endDate)}</span>
            </div>
            {subscription.couponUsed && (
              <div className="md:col-span-2">
                <span className="text-gray-600">Coupon Used:</span>
                <span className="ml-2 font-medium text-green-600">{subscription.couponUsed}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {remaining === 0 && (
            <button
              onClick={onUpgrade}
              className="flex-1 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Renew Subscription
            </button>
          )}
          
          {remaining > 0 && remaining < 5 && (
            <button
              onClick={onUpgrade}
              className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Upgrade Plan
            </button>
          )}

          {remaining >= 5 && (
            <button
              onClick={onUpgrade}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Upgrade Plan
            </button>
          )}
        </div>

        {/* Low Usage Warning */}
        {remaining <= 2 && remaining > 0 && (
          <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-orange-600 mr-3 mt-0.5" />
              <div>
                <div className="font-medium text-orange-800">Running Low on Optimizations</div>
                <div className="text-orange-700 text-sm mt-1">
                  You have only {remaining} optimization{remaining !== 1 ? 's' : ''} left. Consider upgrading your plan to continue optimizing your resume.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};