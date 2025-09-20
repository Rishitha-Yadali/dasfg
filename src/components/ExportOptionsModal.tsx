// src/components/ExportOptionsModal.tsx
import React from 'react';
import { X, FileText, Download, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { ExportOptions } from '../types/export';
import { ResumeData, UserType } from '../types/resume';

interface ExportOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  optimizedResume: ResumeData | null;
  userType: UserType;
  handleExportFile: (options: ExportOptions, format: 'pdf' | 'word') => Promise<void>;
  isExportingPDF: boolean;
  isExportingWord: boolean;
  exportStatus: {
    type: 'pdf' | 'word' | null;
    status: 'success' | 'error' | null;
    message: string;
  };
}

export const ExportOptionsModal: React.FC<ExportOptionsModalProps> = ({
  isOpen,
  onClose,
  optimizedResume,
  userType,
  handleExportFile,
  isExportingPDF,
  isExportingWord,
  exportStatus,
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Default export options for the modal (can be customized if needed)
  const defaultModalExportOptions = {
    layoutType: 'standard',
    paperSize: 'a4',
    fontFamily: 'Calibri',
    nameSize: 26,
    sectionHeaderSize: 11,
    subHeaderSize: 10.5,
    bodyTextSize: 10,
    sectionSpacing: 3,
    entrySpacing: 2,
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in" onClick={handleBackdropClick}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[95vh] overflow-y-auto dark:bg-dark-100 dark:shadow-dark-xl animate-scale-in">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-blue-50 to-purple-50 p-6 border-b border-gray-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-white/50 z-10 min-w-[44px] min-h-[44px] dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-dark-300/50"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="text-center">
            <div className="bg-gradient-to-br from-neon-cyan-500 to-neon-blue-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg dark:shadow-neon-cyan">
              <Download className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Download Your Resume
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Choose your preferred format for download.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <button
            onClick={() => optimizedResume && handleExportFile(defaultModalExportOptions, 'pdf')}
            disabled={isExportingPDF || isExportingWord || !optimizedResume}
            className={`w-full py-4 px-6 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl ${
              isExportingPDF || isExportingWord || !optimizedResume
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {isExportingPDF ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Exporting PDF...</span>
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                <span>Download by PDF</span>
              </>
            )}
          </button>

          <button
            onClick={() => optimizedResume && handleExportFile(defaultModalExportOptions, 'word')}
            disabled={isExportingWord || isExportingPDF || !optimizedResume}
            className={`w-full py-4 px-6 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl ${
              isExportingWord || isExportingPDF || !optimizedResume
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 hover:from-neon-cyan-400 hover:to-neon-blue-400 text-white hover:shadow-neon-cyan'
            }`}
          >
            {isExportingWord ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Exporting Word...</span>
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                <span>Download by Word(.docx)</span>
              </>
            )}
          </button>

          {/* Export Status Message */}
          {exportStatus.status && (
            <div
              className={`mt-4 p-4 rounded-xl border transition-all ${
                exportStatus.status === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800 dark:bg-neon-cyan-500/10 dark:border-neon-cyan-400/50 dark:text-neon-cyan-300'
                  : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-500/50 dark:text-red-300'
              }`}
            >
              <div className="flex items-center">
                {exportStatus.status === 'success' ? (
                  <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                )}
                <span className="font-medium">{exportStatus.message}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
