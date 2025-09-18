import React, { useState } from 'react';
import { Download, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { exportToPDF, exportToWord } from '../utils/exportUtils';
import { ResumeData, UserType } from '../types/resume';

interface ExportButtonsProps {
  resumeData: ResumeData;
  userType?: UserType;
  targetRole?: string;
  onShowProfile?: (mode?: 'profile' | 'wallet') => void;
  walletRefreshKey?: number;
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({
  resumeData,
  userType = 'experienced',
  targetRole,
  onShowProfile,
  walletRefreshKey
}) => {
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingWord, setIsExportingWord] = useState(false);
  const [exportStatus, setExportStatus] = useState<{
    type: 'pdf' | 'word' | null;
    status: 'success' | 'error' | null;
    message: string;
  }>({ type: null, status: null, message: '' });

  const handleExportPDF = async () => {
    if (isExportingPDF || isExportingWord) return;

    setIsExportingPDF(true);
    setExportStatus({ type: null, status: null, message: '' });

    try {
      await exportToPDF(resumeData, userType);
      setExportStatus({
        type: 'pdf',
        status: 'success',
        message: 'PDF exported successfully!'
      });
      setTimeout(() => {
        setExportStatus({ type: null, status: null, message: '' });
      }, 3000);
    } catch (error) {
      console.error('PDF export failed:', error);
      setExportStatus({
        type: 'pdf',
        status: 'error',
        message: 'PDF export failed. Please try again.'
      });
      setTimeout(() => {
        setExportStatus({ type: null, status: null, message: '' });
      }, 5000);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportWord = async () => {
    if (isExportingWord || isExportingPDF) return;

    setIsExportingWord(true);
    setExportStatus({ type: null, status: null, message: '' });

    try {
      await exportToWord(resumeData, userType);
      setExportStatus({
        type: 'word',
        status: 'success',
        message: 'Word document exported successfully!'
      });
      setTimeout(() => {
        setExportStatus({ type: null, status: null, message: '' });
      }, 3000);
    } catch (error) {
      console.error('Word export failed:', error);
      setExportStatus({
        type: 'word',
        status: 'error',
        message: 'Word export failed. Please try again.'
      });
      setTimeout(() => {
        setExportStatus({ type: null, status: null, message: '' });
      }, 5000);
    } finally {
      setIsExportingWord(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Export Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={handleExportPDF}
          disabled={isExportingPDF || isExportingWord}
          className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl ${
            isExportingPDF || isExportingWord
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
          onClick={handleExportWord}
          disabled={isExportingWord || isExportingPDF}
          className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl ${
            isExportingWord || isExportingPDF
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
      </div>

      {/* Export Status Message */}
      {exportStatus.status && (
        <div
          className={`p-4 rounded-xl border transition-all ${
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
  );
};