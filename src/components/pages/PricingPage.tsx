// src/components/pages/PricingPage.tsx
import React, { useState, useEffect } from 'react';
import {
  Check,
  Star,
  Zap,
  Crown,
  Target,
  TrendingUp,
  PlusCircle,
  MessageCircle,
  ArrowRight,
  Sparkles,
  Award,
  Shield,
  Clock,
  Users,
  CheckCircle,
  X,
  Info,
  Wrench // Added Wrench icon for Resume Fix Pack
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { paymentService } from '../../services/paymentService';
import { SubscriptionPlan } from '../../types/payment'; // Import SubscriptionPlan

interface PricingPageProps {
  onShowAuth: () => void;
  onShowSubscriptionPlans: (featureId?: string, expandAddons?: boolean) => void; // Updated prop signature
}

export const PricingPage: React.FC<PricingPageProps> = ({
  onShowAuth,
  onShowSubscriptionPlans
}) => {
  const { isAuthenticated } = useAuth();
  const plans: SubscriptionPlan[] = paymentService.getPlans();

  // Countdown Timer State
  const calculateTimeLeft = () => {
    // Set your offer end date here (e.g., September 1, 2025)
    const difference = +new Date('2025-09-01T00:00:00') - +new Date();
    let timeLeft: { hours?: number; minutes?: number; seconds?: number } = {};

    if (difference > 0) {
      timeLeft = {
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    }
    return timeLeft;
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearTimeout(timer);
  });

  const timerComponents: JSX.Element[] = [];

  Object.keys(timeLeft).forEach((interval) => {
    if (!timeLeft[interval as keyof typeof timeLeft]) {
      return;
    }

    timerComponents.push(
      <span key={interval} className="text-xl sm:text-2xl font-bold text-white">
        {String(timeLeft[interval as keyof typeof timeLeft]).padStart(2, '0')}
        <span className="text-base sm:text-lg font-medium ml-1 mr-2">{interval.charAt(0).toUpperCase()}</span>
      </span>
    );
  });

  const getPlanIcon = (iconType: string) => {
    switch (iconType) {
      case 'crown': return <Crown className="w-6 h-6" />;
      case 'zap': return <Zap className="w-6 h-6" />;
      case 'rocket': return <Award className="w-6 h-6" />; // Changed from Award to Rocket
      case 'target': return <Target className="w-6 h-6" />;
      case 'wrench': return <Wrench className="w-6 h-6" />;
      case 'check_circle': return <CheckCircle className="w-6 h-6" />;
      default: return <Sparkles className="w-6 h-6" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 transition-colors duration-300">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-700 text-white dark:from-neon-cyan-500 dark:to-neon-purple-500">
        <div className="absolute inset-0 bg-black/20 dark:bg-black/40"></div>
        <div className="relative container mx-auto px-4 py-20 sm:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg dark:bg-neon-cyan-500/20 dark:shadow-neon-cyan">
              <Crown className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Choose Your
              <span className="block bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent dark:from-neon-cyan-300 dark:to-neon-blue-300">
                Success Plan
              </span>
            </h1>
            <p className="text-xl sm:text-2xl text-blue-100 dark:text-gray-200 mb-8 leading-relaxed">
              Flexible pricing for every career stage. Start free, upgrade when you need more power.
            </p>
          </div>
        </div>
      </div>

      {/* Pricing Plans Section */}
      <div className="py-16 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-dark-200 dark:to-dark-300">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto">
            {/* Countdown Banner */}
            <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl p-4 sm:p-6 text-center mb-12 shadow-lg">
              <p className="text-lg sm:text-xl font-bold mb-2">Launch Offer 🎉</p>
              {timerComponents.length ? (
                <div className="flex justify-center items-center">
                  <Clock className="w-6 h-6 sm:w-8 h-8 mr-2" />
                  <span className="text-xl sm:text-2xl font-bold">Offer ends in:</span>
                  {timerComponents}
                </div>
              ) : (
                <span className="text-xl sm:text-2xl font-bold">Offer has ended!</span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl border-2 transition-all duration-300 hover:scale-105 ${
                    plan.popular ? 'border-blue-500 shadow-2xl shadow-blue-500/20 ring-4 ring-blue-100' : 'border-gray-200 hover:border-blue-300'
                  } dark:border-dark-300 dark:hover:border-neon-cyan-400 dark:bg-dark-100`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg">
                        {plan.id === 'career_boost_plus' ? 'Most Popular' : 'Best Value'}
                      </span>
                    </div>
                  )}

                  <div className="p-8">
                    <div className="text-center mb-8">
                      <div className={`bg-gradient-to-r ${plan.gradient} w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-lg`}>
                        {getPlanIcon(plan.icon)}
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{plan.name}</h3>
                      <p className="text-gray-600 dark:text-gray-300 mb-4">{plan.optimizations} Credits</p>

                      {/* Price Display */}
                      <div className="flex flex-col items-center mb-2">
                        <span className="text-sm text-red-500 line-through">₹{plan.mrp}</span>
                        <div className="flex items-center">
                          <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">₹{plan.price}</span>
                          <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">
                            {plan.discountPercentage}% OFF
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 text-sm">One-time purchase</p>
                    </div>

                    <ul className="space-y-4 mb-8">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start">
                          <Check className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => {
                        if (isAuthenticated) {
                          onShowSubscriptionPlans(plan.id, false); // Pass plan.id and false for expandAddons
                        } else {
                          onShowAuth();
                        }
                      }}
                      className={`w-full py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                        plan.popular
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-dark-200 dark:text-gray-300 dark:hover:bg-dark-300'
                      }`}
                    >
                      {isAuthenticated ? 'Select Plan' : 'Sign Up & Select'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Microcopy below buttons */}
            <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-8">
              Inclusive of GST where applicable. Limited-time launch offer.
            </p>
          </div>
        </div>
      </div>

      {/* Trust Strip */}
      <div className="py-8 bg-white dark:bg-dark-100">
        <div className="container mx-auto px-4 text-center">
          <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-8">
            <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
              <Users className="w-5 h-5 text-blue-600" />
              <span>Loved by 10,000+ job seekers</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
              <Star className="w-5 h-5 text-yellow-500 fill-current" />
              <span>Avg. rating 4.8/5</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span>ATS-friendly outputs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
