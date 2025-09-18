// src/components/VideoModal.tsx
import React from 'react';
import { X } from 'lucide-react';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string; // Now expects a direct video file URL (e.g., .mp4)
  title: string;
}

export const VideoModal: React.FC<VideoModalProps> = ({ isOpen, onClose, videoUrl, title }) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden dark:bg-dark-100">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-gray-800 text-white hover:bg-gray-700 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Close video"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Video Player */}
        <div className="aspect-w-16 aspect-h-9 bg-black">
          {/* Changed from iframe back to video tag */}
          <video
            controls
            autoPlay
            src={videoUrl}
            title={title}
            className="w-full h-full"
          >
            Your browser does not support the video tag.
          </video>
        </div>

        {/* Optional: Video Title/Description below player */}
        <div className="p-4 bg-gray-900 text-white dark:bg-dark-200">
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
      </div>
    </div>
  );
};
