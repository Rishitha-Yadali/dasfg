// src/components/OfferOverlay.tsx
import React from 'react';
import { X, Sparkles, ArrowRight } from 'lucide-react';

interface OfferOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onAction?: () => void;
}

export const OfferOverlay: React.FC<OfferOverlayProps> = ({
  isOpen,
  onClose,
  onAction,
}) => {
  if (!isOpen) return null;

  const handleActionClick = () => {
    if (onAction) {
      onAction();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in-down">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full mx-auto text-center p-8 border border-gray-200 relative dark:bg-dark-100 dark:border-dark-300 dark:shadow-dark-xl transform scale-100 opacity-100 transition-all duration-300">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors dark:text-gray-500 dark:hover:text-gray-300"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Thumbnail Image */}
        <div className="mb-6">
          {/* MODIFIED LINE 30: Updated img src */}
          <img
            src="https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=600"
            alt="Welcome Offer"
            className="w-full h-40 object-cover rounded-2xl shadow-md mx-auto"
          />
        </div>

        {/* Title */}
        {/* MODIFIED LINE 34: Changed h2 title */}
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Build ATS Resume Free of Cost!
        </h2>

        {/* Description */}
        {/* MODIFIED LINES 38-41: Changed p description */}
        <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
          Get a free ATS-friendly resume build and unlock powerful features like our all-in-one Outreach Message Generator for LinkedIn and cold emails. Start your job search strong!
        </p>

        {/* Call to Action */}
        <button
          onClick={handleActionClick}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          <Sparkles className="w-5 h-5" />
          {/* MODIFIED LINE 45: Updated button text */}
          <span>Start Your Free ATS Resume</span>
          <ArrowRight className="w-5 h-5" />
        </button>

        {/* REMOVED LINES 54-57: Removed small print div */}
      </div>
    </div>
  );
};

