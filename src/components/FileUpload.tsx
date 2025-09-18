import React, { useRef, useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';
import { parseFile } from '../utils/fileParser'; // Make sure this path is correct

interface FileUploadProps {
  onFileUpload: (result: ExtractionResult) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null); // New state for error messages

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null); // Clear any previous error before processing a new file
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setIsUploading(true);
    setUploadError(null); // Clear error at the start of processing
    try {
      const result = await parseFile(file);
      onFileUpload(result);
      setUploadedFile(file.name);
    } catch (error: any) { // Catch the error to display to the user
      console.error('Error parsing file:', error);
      // Set the specific error message from parsePDF if it exists, otherwise a generic one
      setUploadError(error.message || 'Failed to parse file. Please try again or use a different file.');
      setUploadedFile(null); // Clear uploaded file name on error
      onFileUpload({ text: '', extraction_mode: 'TEXT', trimmed: false }); // Clear previous content on error
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    
    const file = event.dataTransfer.files[0];
    if (!file) return;

    setUploadError(null); // Clear any previous error before processing a new file
    await processFile(file);
  };

  const clearFile = () => {
    setUploadedFile(null);
    setUploadError(null); // Also clear error when file is removed manually
    onFileUpload({ text: '', extraction_mode: 'TEXT', trimmed: false });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleTryAgain = () => {
    clearFile(); // Clear the error state and file if any
    fileInputRef.current?.click(); // Open file dialog
  };

  return (
    <div className="space-y-2">
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-2 sm:p-4 lg:p-6 text-center transition-all duration-200 cursor-pointer ${
          isUploading
            ? 'border-primary-400 bg-primary-50 scale-105 dark:border-neon-cyan-400 dark:bg-neon-cyan-500/10'
            : uploadError
            ? 'border-red-400 bg-red-50 dark:border-red-500 dark:bg-red-900/20' // Error state styling
            : uploadedFile
            ? 'border-green-400 bg-green-50 dark:border-neon-cyan-400 dark:bg-neon-cyan-500/10'
            : 'border-secondary-300 bg-secondary-50 hover:border-primary-400 hover:bg-primary-50 dark:border-dark-300 dark:bg-dark-200 dark:hover:border-neon-cyan-400 dark:hover:bg-neon-cyan-500/10'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        {isUploading ? (
          <div className="flex flex-col items-center">
            <div className="spinner h-10 w-10 sm:h-12 sm:w-12 mb-4"></div> {/* Placeholder for a spinner */}
            <p className="text-fluid-lg font-medium text-secondary-900 dark:text-gray-100 mb-2">Processing your file...</p>
            <p className="text-fluid-sm text-secondary-600 dark:text-gray-300">Please wait while we extract the content</p>
          </div>
        ) : uploadError ? (
          <div className="flex flex-col items-center">
            <div className="bg-red-100 p-3 rounded-full mb-4 dark:bg-red-900/20">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <p className="text-fluid-lg font-medium text-red-900 dark:text-red-300 mb-2">Upload Failed</p>
            <p className="text-fluid-sm text-red-700 dark:text-red-400 mb-4">{uploadError}</p>
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent re-triggering file input click
                handleTryAgain();
              }}
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-medium text-fluid-sm transition-colors min-h-touch px-2 dark:text-neon-cyan-400 dark:hover:text-neon-cyan-300"
            >
              <span>Try again</span>
            </button>
          </div>
        ) : uploadedFile ? (
          <div className="flex flex-col items-center">
            <div className="bg-green-100 p-3 rounded-full mb-4 dark:bg-neon-cyan-500/20 dark:shadow-neon-cyan">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-neon-cyan-400" />
            </div>
            <p className="text-fluid-lg font-medium text-green-900 dark:text-neon-cyan-300 mb-2">File uploaded successfully!</p>
            <p className="text-fluid-sm text-green-700 dark:text-gray-300 mb-4 text-truncate-1">{uploadedFile}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearFile();
              }}
              className="flex items-center space-x-2 text-red-600 hover:text-red-700 font-medium text-fluid-sm transition-colors min-h-touch px-2 dark:text-red-400 dark:hover:text-red-300"
            >
              <X className="w-4 h-4" />
              <span>Remove file</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className={`p-3 sm:p-4 rounded-full mb-4 transition-colors ${
              isDragging ? 'bg-blue-200 dark:bg-neon-cyan-500/30' : 'bg-gray-200 dark:bg-dark-300'
            }`}>
              <Upload className={`w-6 h-6 sm:w-8 sm:h-8 transition-colors ${
                isDragging ? 'text-primary-600 dark:text-neon-cyan-400' : 'text-secondary-400 dark:text-gray-500'
              }`} />
            </div>
            <p className="text-fluid-lg font-medium text-secondary-900 dark:text-gray-100 mb-2">
              {isDragging ? 'Drop your file here' : 'Upload your resume'}
            </p>
            <p className="text-fluid-sm text-secondary-600 dark:text-gray-300 mb-4">
              Drag and drop your file here, or click to browse
            </p>
            <div className="flex items-center space-x-2 text-fluid-xs text-secondary-500 dark:text-gray-400">
              <FileText className="w-4 h-4" />
              <span>Supports PDF, DOCX, and TXT files</span>
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* File Format Info */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 dark:bg-dark-100 dark:border-dark-400"> {/* Changed dark:bg-dark-200 to dark:bg-dark-100 and dark:border-dark-300 to dark:border-dark-400 */}
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-primary-600 dark:text-neon-cyan-400 mt-0.5 flex-shrink-0" />
          <div className="text-fluid-sm">
            <p className="font-medium text-primary-900 dark:text-gray-100 mb-2">Supported file formats:</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-primary-800 dark:text-gray-300">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-red-500 rounded-full dark:bg-red-400"></div>
                <span>PDF files (.pdf)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-primary-500 rounded-full dark:bg-neon-cyan-400"></div>
                <span>Word documents (.docx)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-secondary-500 rounded-full dark:bg-gray-400"></div>
                <span>Text files (.txt)</span>
              </div>
            </div>
            <p className="text-primary-700 dark:text-gray-400 mt-2 text-fluid-xs">
              Maximum file size: 10MB. For best results, ensure your resume is well-formatted and readable.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
