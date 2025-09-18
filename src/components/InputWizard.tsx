// src/components/InputWizard.tsx
import React, { useState } from 'react';
import {
  Upload,
  FileText,
  User,
  Briefcase,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  CheckCircle,
  Edit3
} from 'lucide-react';
import { FileUpload } from './FileUpload';
import { InputSection } from './InputSection';
import { UserType } from '../types/resume';
import { User as AuthUser } from '../types/auth';

interface InputWizardProps {
  extractionResult: ExtractionResult;
  setExtractionResult: (value: ExtractionResult) => void;
  jobDescription: string;
  setJobDescription: (value: string) => void;
  targetRole: string;
  setTargetRole: (value: string) => void;
  userType: UserType;
  setUserType: (value: UserType) => void;
  scoringMode: ScoringMode;
  setScoringMode: (value: ScoringMode) => void;
  autoScoreOnUpload: boolean;
  setAutoScoreOnUpload: (value: boolean) => void;
  handleOptimize: () => void;
  isAuthenticated: boolean;
  onShowAuth: () => void;
  user: AuthUser | null;
  onShowProfile: (mode?: 'profile' | 'wallet') => void;
}

export const InputWizard: React.FC<InputWizardProps> = ({
  extractionResult,
  setExtractionResult,
  jobDescription,
  setJobDescription,
  targetRole,
  setTargetRole,
  userType,
  setUserType,
  scoringMode,
  setScoringMode,
  autoScoreOnUpload,
  setAutoScoreOnUpload,
  handleOptimize,
  isAuthenticated,
  onShowAuth,
  user,
  onShowProfile
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      id: 'upload',
      title: 'Upload Resume',
      icon: <Upload className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
            <Upload className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Upload Resume
          </h2>
          <FileUpload onFileUpload={setExtractionResult} />
        </div>
      ),
      isValid: extractionResult.text.trim().length > 0
    },
    {
      id: 'details',
      title: 'Job Details',
      icon: <FileText className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
            <FileText className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
            Resume & Job Details
          </h2>
          <InputSection
            resumeText={extractionResult.text}
            jobDescription={jobDescription}
            onResumeChange={(text) => setExtractionResult({ ...extractionResult, text })}
            onJobDescriptionChange={setJobDescription}
          />
        </div>
      ),
     isValid: extractionResult.text.trim().length > 0 && (jobDescription.trim().length === 0 || jobDescription.trim().length >= 250)
    },
    {
      id: 'social',
      title: 'Target Role',
      icon: <User className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
            <User className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
            Target Role (Optional)
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                Role Title
              </label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g., Senior Software Engineer, Product Manager..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100 dark:placeholder-gray-400"
              />
              <p className="text-xs text-gray-500 mt-2 dark:text-gray-400">
                Specify the exact role title for more targeted project recommendations
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 dark:bg-neon-cyan-500/10 dark:border-neon-cyan-400/50">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0 dark:bg-neon-cyan-400"></div>
                <div className="text-sm text-blue-800 dark:text-neon-cyan-300">
                  <p className="font-medium mb-1">📝 Profile Information</p>
                  <p className="text-blue-700 dark:text-gray-300">
                    Your name, email, phone, LinkedIn, and GitHub details will be automatically populated from your profile settings. You can update these in your profile settings from the user menu.
                  </p>
                </div>
              </div>
              {isAuthenticated && user && (
                <button
                  onClick={() => onShowProfile('profile')}
                  className="mt-4 w-full flex items-center justify-center space-x-2 btn-primary py-3 px-6 rounded-xl text-basse"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Update Your Details</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ),
      isValid: true
    },
    {
      id: 'experience',
      title: 'Experience Level',
      icon: <Briefcase className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
            <Briefcase className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
            Experience Level
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => setUserType('fresher')}
              className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all cursor-pointer ${
                userType === 'fresher'
                  ? 'border-green-500 bg-green-50 shadow-md dark:border-green-600 dark:bg-green-900/20'
                  : 'border-gray-200 hover:border-green-300 hover:bg-green-50 dark:border-dark-200 dark:hover:border-green-900 dark:hover:bg-green-900/10'
              }`}
            >
              <User className={`w-8 h-8 mb-3 ${userType === 'fresher' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-300'}`} />
              <span className={`font-semibold text-lg mb-2 ${userType === 'fresher' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'}`}>Fresher/New Graduate</span>
              <span className={`text-sm text-gray-500 text-center dark:text-gray-300`}>Recent graduate or entry-level professional</span>
            </button>

            <button
              onClick={() => setUserType('experienced')}
              className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all cursor-pointer ${
                userType === 'experienced'
                  ? 'border-green-500 bg-green-50 shadow-md dark:border-green-600 dark:bg-green-900/20'
                  : 'border-gray-200 hover:border-green-300 hover:bg-green-50 dark:border-dark-200 dark:hover:border-green-900 dark:hover:bg-green-900/10'
              }`}
            >
              <Briefcase className={`w-8 h-8 mb-3 ${userType === 'experienced' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-300'}`} />
              <span className={`font-semibold text-lg mb-2 ${userType === 'experienced' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'}`}>Experienced Professional</span>
              <span className={`text-sm text-gray-500 text-center dark:text-gray-300`}>Professional with 1+ years of work experience</span>
            </button>
          </div>
        </div>
      ),
      isValid: true
    },
    {
      id: 'optimize',
      title: 'Optimize',
      icon: <Sparkles className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
            <Sparkles className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
            Ready to Optimize
          </h2>
          <div className="text-center space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 dark:from-blue-900/20 dark:to-purple-900/20">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 dark:text-gray-100">Review Your Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-white rounded-lg p-4 border border-gray-200 dark:bg-dark-200 dark:border-dark-300">
                  <div className="flex items-center mb-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2 dark:text-green-400" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">Resume Uploaded</span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300">{extractionResult.text.length} characters</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200 dark:bg-dark-200 dark:border-dark-300">
                  <div className="flex items-center mb-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2 dark:text-green-400" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">Job Description</span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300">{jobDescription.length} characters</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200 dark:bg-dark-200 dark:border-dark-300">
                  <div className="flex items-center mb-2">
                    <User className="w-4 h-4 text-blue-600 mr-2 dark:text-blue-400" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">Experience Level</span>
                  </div>
                  <p className="text-gray-600 capitalize dark:text-gray-300">
                    {userType === 'student' ? 'College Student' : userType}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200 dark:bg-dark-200 dark:border-dark-300">
                  <div className="flex items-center mb-2">
                    <Briefcase className="w-4 h-4 text-purple-600 mr-2 dark:text-purple-400" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">Target Role</span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300">{targetRole || 'Not specified'}</p>
                </div>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isAuthenticated) {
                  handleOptimize();
                } else {
                  onShowAuth();
                }
              }}
              disabled={!extractionResult.text.trim() || (scoringMode === 'jd_based' && (!jobDescription.trim() || !targetRole.trim()))}
              className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center space-x-3 ${
                !extractionResult.text.trim() || (scoringMode === 'jd_based' && (!jobDescription.trim() || !targetRole.trim()))
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-xl hover:shadow-2xl cursor-pointer'
              }`}
              type="button"
            >
              <Sparkles className="w-6 h-6" />
              <span>{isAuthenticated ? 'Optimize My Resume' : 'Sign In to Optimize'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            {!isAuthenticated && (
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                You need to be signed in to optimize your resume.
              </p>
            )}
          </div>
        </div>
      ),
      isValid: extractionResult.text.trim().length > 0 && (scoringMode === 'general' || (jobDescription.trim().length > 0 && targetRole.trim().length > 0))
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const itemBaseWidth = 96;
  const itemMarginRight = 16;
  const itemFullWidth = itemBaseWidth + itemMarginRight;

  const visibleIconsCount = 3;

  const maxScrollLeft = -(Math.max(0, steps.length - visibleIconsCount) * itemFullWidth);

  let translateX = 0;
  const targetCenterIndex = Math.floor(visibleIconsCount / 2);

  if (currentStep > targetCenterIndex) {
    translateX = -(currentStep - targetCenterIndex) * itemFullWidth;
  }

  translateX = Math.max(maxScrollLeft, translateX);
  translateX = Math.min(0, translateX);

  const currentStepData = steps[currentStep];

  return (
     <div className="container-responsive space-y-12">
      {/* Progress Indicator */}
      <div className="bg-white rounded-xl shadow-lg p-3 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Resume Optimization </h1>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Step {currentStep + 1} of {steps.length}
          </div>
        </div>

        {/* Step Progress Bar - Carousel Effect */}
        <div className="relative overflow-x-auto overflow-hidden w-[320px] mx-auto md:w-auto">
          <div
            className="flex items-center space-x-4 mb-6 transition-transform duration-300"
            style={{ transform: `translateX(${translateX}px)` }}
          >
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center w-24 flex-shrink-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                      index < currentStep
                        ? 'bg-green-500 text-white'
                        : index === currentStep
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-500 dark:bg-dark-200 dark:text-gray-400'
                    }`}
                  >
                    {index < currentStep ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      step.icon
                    )}
                  </div>
                  <span className={`text-xs mt-2 font-medium text-center ${
                    index <= currentStep ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                    index < currentStep ? 'bg-green-500' : 'bg-gray-200 dark:bg-dark-200'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Current Step Content */}
      <div className="transition-all duration-300">
        {currentStepData.component}
      </div>

      {/* Navigation Buttons */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
        <div className="flex justify-between items-center gap-2">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 sm:w-auto flex-shrink-0 ${ // Removed w-1/3
              currentStep === 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-dark-200 dark:text-gray-500'
                : 'bg-gray-600 hover:bg-gray-700 text-white shadow-lg hover:shadow-xl dark:bg-gray-700 dark:hover:bg-gray-800'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Previous</span>
          </button>

          <div className="text-center flex-grow sm:w-48 flex-shrink-0"> {/* Removed w-1/3, added flex-grow */}
            <div className="text-sm text-gray-500 mb-1 dark:text-gray-400">Progress</div>
            <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-dark-200">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!currentStepData.isValid}
              className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 sm:w-auto flex-shrink-0 ${ // Removed w-1/3
                !currentStepData.isValid
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-dark-200 dark:text-gray-500'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl dark:bg-blue-700 dark:hover:bg-blue-800'
              }`}
            >
              <span>Next</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <div className="sm:w-24 flex-shrink-0" /> 
          )}
        </div>
      </div>
    </div>
  );
};
