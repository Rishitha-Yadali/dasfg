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
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full mx-auto text-center border border-gray-200 relative dark:bg-dark-100 dark:border-dark-300 dark:shadow-dark-xl transform scale-100 opacity-100 transition-all duration-300">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 p-2 rounded-full bg-gray-800/50 text-gray-100 hover:bg-gray-700 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content Wrapper with Padding */}
        <div className="p-8">
          {/* Thumbnail Image */}
          <div className="mb-6">
            <img
              src="https://res.cloudinary.com/dvue2zenh/image/upload/v1758805010/fgpap0m2tmjox3mshgzx.png"
              alt="Welcome Offer"
              className="w-full h-40 object-cover rounded-2xl shadow-md mx-auto"
            />
          </div>

          {/* Title */}
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Build ATS Resume Free of Cost!
          </h2>

          {/* Description */}
          <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
            Get a free ATS-friendly resume build and unlock powerful features like our all-in-one Outreach Message Generator for LinkedIn and cold emails. Start your job search strong!
          </p>

          {/* Call to Action */}
          <button
            onClick={handleActionClick}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <Sparkles className="w-5 h-5" />
            <span>Start Your Free ATS Resume</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
