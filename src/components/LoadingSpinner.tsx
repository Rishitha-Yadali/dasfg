import React from 'react';

export const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex items-center space-x-2">
      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
      <span>Optimizing...</span>
    </div>
  );
};