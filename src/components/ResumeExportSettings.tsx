// src/components/ResumeExportSettings.tsx
import React, { useState, useEffect } from 'react';
import { Download, Settings, Type, Layout, Ruler, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { ExportOptions, defaultExportOptions, LayoutType, PaperSize, layoutConfigs, paperSizeConfigs } from '../types/export';
import { ResumePreview } from './ResumePreview';
import { ResumeData, UserType } from '../types/resume';

interface ResumeExportSettingsProps {
  resumeData: ResumeData;
  userType?: UserType;
  onExport: (options: ExportOptions, format: 'pdf' | 'word') => void;
}

export const ResumeExportSettings: React.FC<ResumeExportSettingsProps> = ({
  resumeData,
  userType = 'experienced',
  onExport
}) => {
  const [options, setOptions] = useState<ExportOptions>(defaultExportOptions);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleOptionChange = (key: keyof ExportOptions, value: any) => {
    setOptions(prev => {
      const newOptions = { ...prev, [key]: value };

      if (key === 'layoutType') {
        const selectedLayoutConfig = layoutConfigs[value as LayoutType];
        newOptions.sectionSpacing = selectedLayoutConfig.spacing.section;
        newOptions.entrySpacing = selectedLayoutConfig.spacing.entry;
        // Update margins based on the selected layout
        newOptions.margins = selectedLayoutConfig.margins;
      }
      return newOptions;
    });
  };

  const handleExportClick = (format: 'pdf' | 'word') => {
    try {
      onExport(options, format);
      setStatusMessage(`${format.toUpperCase()} export initiated successfully!`);
      setTimeout(() => {
        setStatusMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Error during export:', error);
      setStatusMessage(`Error initiating ${format.toUpperCase()} export. Please try again.`);
      setTimeout(() => {
        setStatusMessage(null);
      }, 5000);
    }
  };

  const fontFamilies = [ 'Times New Roman', 'Arial', 'Verdana', 'Georgia','Calibri'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* Left Side - Controls */}
      <div className="space-y-6 overflow-y-auto">
        {/* Resume Template Selection */}
        <div className="card p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
            <Layout className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600 dark:text-neon-cyan-400" />
            Resume Template
          </h3>
          
          {/* Layout Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3 dark:text-gray-300">Layout Type</label>
            <div className="grid grid-cols-2 gap-4">
                        {Object.entries(layoutConfigs)
              .filter(([key]) => key === 'standard') // Add this filter
              .map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => handleOptionChange('layoutType', key as LayoutType)}
                  className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all dark:bg-dark-100 ${
                    options.layoutType === key
                      ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20'
                      : 'border-gray-200 hover:border-blue-300 dark:border-gray-700 dark:hover:border-blue-500'
                  }`}
                >
                  <div className="w-20 h-28 bg-gray-100 rounded mb-2 flex items-center justify-center text-xs text-gray-500 dark:bg-dark-200">
                    {config.name}
                  </div>
                  <span className="font-medium text-sm dark:text-gray-100">{config.name}</span>
                  <span className="text-xs text-gray-500 text-center dark:text-gray-300">{config.description}</span>
                  {key === 'standard' && (
                    <div className="mt-2 flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                      <span className="text-xs text-green-600 font-medium">★ Recommended</span>
                    </div>
                  )}
                </button>
              ))}

            </div>
          </div>

          {/* Paper Size Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3 dark:text-gray-300">Paper Size</label>
            <div className="space-y-2">
              {Object.entries(paperSizeConfigs).map(([key, config]) => (
                <label key={key} className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="paperSize"
                    value={key}
                    checked={options.paperSize === key}
                    onChange={(e) => handleOptionChange('paperSize', e.target.value as PaperSize)}
                    className="form-radio h-4 w-4 text-blue-600 focus:ring-blue-500 dark:bg-dark-200 dark:border-dark-300"
                  />
                  <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">{config.name}</span>
                  {key === 'a4' && (
                    <div className="ml-2 flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                      <span className="text-xs text-green-600 font-medium">★ Recommended</span>
                    </div>
                  )}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Font Settings */}
        <div className="card p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
            <Type className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-purple-600 dark:text-neon-purple-400" />
            Font
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Font Family</label>
              <select
                value={options.fontFamily}
                onChange={(e) => handleOptionChange('fontFamily', e.target.value)}
                className="input-base"
              >
                {fontFamilies.map(font => (
                  <option key={font} value={font}>{font}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Name</label>
                <input
                  type="number"
                  value={options.nameSize}
                  onChange={(e) => handleOptionChange('nameSize', parseFloat(e.target.value))}
                  className="input-base"
                  min="16" max="30" step="0.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Section Headers</label>
                <input
                  type="number"
                  value={options.sectionHeaderSize}
                  onChange={(e) => handleOptionChange('sectionHeaderSize', parseFloat(e.target.value))}
                  className="input-base"
                  min="8" max="14" step="0.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Sub-Headers</label>
                <input
                  type="number"
                  value={options.subHeaderSize}
                  onChange={(e) => handleOptionChange('subHeaderSize', parseFloat(e.target.value))}
                  className="input-base"
                  min="8" max="12" step="0.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Body Text</label>
                <input
                  type="number"
                  value={options.bodyTextSize}
                  onChange={(e) => handleOptionChange('bodyTextSize', parseFloat(e.target.value))}
                  className="input-base"
                  min="8" max="12" step="0.5"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Spacing & Margin Settings */}
        <div className="card p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
            <Ruler className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-green-600 dark:text-neon-green-400" />
            Spacing & Margins
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Section Spacing</label>
              <input
                type="range"
                value={options.sectionSpacing}
                onChange={(e) => handleOptionChange('sectionSpacing', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-dark-300"
                min="0" max="10" step="0.5"
              />
              <div className="text-right text-sm text-gray-600 dark:text-gray-400">{options.sectionSpacing} mm</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Entry Spacing</label>
              <input
                type="range"
                value={options.entrySpacing}
                onChange={(e) => handleOptionChange('entrySpacing', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-dark-300"
                min="0" max="5" step="0.25"
              />
              <div className="text-right text-sm text-gray-600 dark:text-gray-400">{options.entrySpacing} mm</div>
            </div>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="card p-4 sm:p-6">
          <div className="space-y-4">
            <button
              onClick={() => handleExportClick('pdf')}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
            >
              <FileText className="w-5 h-5" />
              <span>Download by PDF</span>
            </button>

            <button
              onClick={() => handleExportClick('word')}
              className="w-full btn-primary py-4 px-6 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-neon-cyan"
            >
              <FileText className="w-5 h-5" />
              <span>Download by Word(.docx)</span>
            </button>
          </div>

          {/* Export Status Message */}
          {statusMessage && (
            <div className={`mt-4 p-3 rounded-lg border transition-all ${
              statusMessage.includes('Error') 
                ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-500/50 dark:text-red-300' 
                : 'bg-green-50 border-green-200 text-green-800 dark:bg-neon-cyan-500/10 dark:border-neon-cyan-400/50 dark:text-neon-cyan-300'
            }`}>
              <div className="flex items-center">
                {statusMessage.includes('Error') ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle className="w-4 h-4 flex-shrink-0" />}
                <span className="text-sm font-medium">{statusMessage}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Live Preview */}
      <div className="bg-gray-50 rounded-xl p-4 h-full flex flex-col dark:bg-dark-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
          <Layout className="w-5 h-5 mr-2 text-green-600 dark:text-neon-green-400" />
          Live Preview
        </h3>
        <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 dark:bg-dark-100 dark:border-dark-300 overflow-hidden">
          <div className="h-full overflow-y-auto">
            <ResumePreview
              resumeData={resumeData}
              userType={userType}
              exportOptions={options}
            />
          </div>
        </div>
        <div className="mt-3 text-xs text-gray-500 text-center dark:text-gray-400">
          Preview updates as you change settings
        </div>
      </div>
    </div>
  );
};

