import React from 'react';
import { FileText, Briefcase, AlertCircle } from 'lucide-react';

interface InputSectionProps {
  resumeText: string;
  jobDescription: string;
  onResumeChange: (value: string) => void;
  onJobDescriptionChange: (value: string) => void;
}

export const InputSection: React.FC<InputSectionProps> = ({
  resumeText,
  jobDescription,
  onResumeChange,
  onJobDescriptionChange,
}) => {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Resume Text Section */}
      <div className="relative">
        <div className="flex items-center mb-2 sm:mb-3">
          <FileText className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600 dark:text-neon-cyan-400" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">Resume Content</h3>
          <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium dark:bg-neon-cyan-500/20 dark:text-neon-cyan-300">
            Required
          </span>
        </div>
        <textarea
          value={resumeText}
          onChange={(e) => onResumeChange(e.target.value)}
          placeholder="Your resume content will appear here after uploading a file, or you can type/paste it directly..."
          className="w-full h-32 sm:h-48 p-3 sm:p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-neon-cyan-500 focus:border-neon-cyan-500 resize-none transition-all duration-200 bg-gray-50 focus:bg-white text-sm sm:text-base dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100 dark:focus:bg-dark-100"
        />
        <div className="flex justify-between items-center mt-2">
          <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {resumeText.length} characters
          </div>
          {resumeText.length > 0 && (
            <div className="flex items-center text-green-600 dark:text-neon-cyan-400 text-xs sm:text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-1 dark:bg-neon-cyan-400"></div>
              Content loaded
            </div>
          )}
        </div>
      </div>

      {/* Job Description Section */}
      <div className="relative">
        <div className="flex items-center mb-2 sm:mb-3">
          <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-green-600 dark:text-neon-blue-400" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">Target Job Description</h3>
          <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium dark:bg-neon-blue-500/20 dark:text-neon-blue-300">
            Required
          </span>
        </div>
        <textarea
          value={jobDescription}
          onChange={(e) => onJobDescriptionChange(e.target.value)}
          placeholder="Paste the complete job description here. Include requirements, responsibilities, and preferred qualifications for best optimization results..."
          className="w-full h-32 sm:h-48 p-3 sm:p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-neon-blue-500 focus:border-neon-blue-500 resize-none transition-all duration-200 bg-gray-50 focus:bg-white text-sm sm:text-base dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100 dark:focus:bg-dark-100"
        />
        <div className="flex justify-between items-center mt-2">
          <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {jobDescription.length} characters
          </div>
          {jobDescription.length > 0 && (
            <div className="flex items-center text-green-600 dark:text-neon-blue-400 text-xs sm:text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-1 dark:bg-neon-blue-400"></div>
              Job details added
            </div>
          )}
        </div>
      </div>

      {/* Help Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 sm:p-4 dark:bg-neon-cyan-500/10 dark:border-neon-cyan-400/50">
        <div className="flex items-start space-x-2 sm:space-x-3">
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-neon-cyan-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs sm:text-sm">
            <p className="font-medium text-blue-900 dark:text-neon-cyan-300 mb-2">💡 Tips for better optimization:</p>
            <ul className="text-blue-800 dark:text-gray-300 space-y-1 list-disc list-inside">
              <li>Include the complete job posting with requirements and responsibilities</li>
              <li>Make sure your resume content is comprehensive and up-to-date</li>
              <li className="hidden sm:list-item">The more detailed the job description, the better the optimization</li>
              <li className="hidden sm:list-item">Include specific skills, technologies, and qualifications mentioned in the job</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};