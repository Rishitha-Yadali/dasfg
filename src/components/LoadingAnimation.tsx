// src/components/LoadingAnimation.tsx
import React from 'react';
import { Sparkles, Zap, Target, TrendingUp } from 'lucide-react';

interface LoadingAnimationProps {
  message?: string;
  submessage?: string;
  type?: 'optimization' | 'analysis' | 'generation' | 'payment';
}

export const LoadingAnimation: React.FC<LoadingAnimationProps> = ({
  message = "Processing...",
  submessage = "Please wait while we work our magic",
  type = 'optimization'
}) => {
  const getIcon = () => {
    switch (type) {
      case 'optimization': return <Target className="w-16 h-16" />;
      case 'analysis': return <TrendingUp className="w-16 h-16" />;
      case 'generation': return <Sparkles className="w-16 h-16" />;
      case 'payment': return <Zap className="w-16 h-16" />;
      default: return <Sparkles className="w-16 h-16" />;
    }
  };

  const getGradient = () => {
    switch (type) {
      case 'optimization': return 'from-blue-500 to-cyan-500';
      case 'analysis': return 'from-purple-500 to-pink-500';
      case 'generation': return 'from-green-500 to-emerald-500';
      case 'payment': return 'from-orange-500 to-red-500';
      default: return 'from-blue-500 to-purple-500';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md w-full dark:bg-dark-100 transform transition-all duration-500 scale-100">
        {/* Animated Icon */}
        <div className={`bg-gradient-to-r ${getGradient()} w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-white animate-pulse shadow-lg`}>
          {getIcon()}
        </div>

        {/* Animated Dots */}
        <div className="flex justify-center space-x-2 mb-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-3 h-3 bg-gradient-to-r ${getGradient()} rounded-full animate-bounce`}
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>

        {/* Messages */}
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">{message}</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">{submessage}</p>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4 dark:bg-dark-300">
          <div className={`bg-gradient-to-r ${getGradient()} h-2 rounded-full animate-pulse`} style={{ width: '70%' }} />
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400">
          This may take a few moments as we process complex data and apply advanced algorithms.
        </p>
      </div>
    </div>
  );
};