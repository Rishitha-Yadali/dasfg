// src/components/ResumeScoreChecker.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Upload,
  FileText,
  TrendingUp,
  Award,
  Lightbulb,
  ArrowLeft,
  Target,
  Zap,
  Clock,
  Palette,
  Sparkles,
  FileCheck,
  Search,
  Briefcase,
  LayoutDashboard,
  Bug,
  ArrowRight,
  BarChart3,
  Info,
  Eye,
  RefreshCw,
  Calendar,
  Shield,
} from 'lucide-react';
import { FileUpload } from './FileUpload';
import { getComprehensiveScore } from '../services/scoringService';
import { LoadingAnimation } from './LoadingAnimation';
import { ComprehensiveScore, ScoringMode, ExtractionResult, ConfidenceLevel, MatchBand, DetailedScore } from '../types/resume';
import type { Subscription } from '../types/payment';
import { paymentService } from '../services/paymentService';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth to get the user object

interface ResumeScoreCheckerProps {
  onNavigateBack: () => void;
  isAuthenticated: boolean;
  onShowAuth: () => void;
  userSubscription: Subscription | null;
  onShowSubscriptionPlans: (featureId?: string) => void;
  onShowAlert: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error', actionText?: string, onAction?: () => void) => void;
  refreshUserSubscription: () => Promise<void>;
  toolProcessTrigger: (() => void) | null;
  setToolProcessTrigger: React.Dispatch<React.SetStateAction<(() => void) | null>>;
}

export const ResumeScoreChecker: React.FC<ResumeScoreCheckerProps> = ({
  onNavigateBack,
  isAuthenticated,
  onShowAuth,
  userSubscription, // Keep this prop, but we'll fetch fresh data inside _analyzeResumeInternal
  onShowSubscriptionPlans,
  onShowAlert, // This is the prop in question
  refreshUserSubscription,
  toolProcessTrigger,
  setToolProcessTrigger,
}) => {
  // CRITICAL DEBUGGING STEP: Verify onShowAlert is a function immediately
  if (typeof onShowAlert !== 'function') {
    console.error('CRITICAL ERROR: onShowAlert prop is not a function or is undefined!', onShowAlert);
    // This will cause a React error, but it will confirm if the prop is truly missing at this point.
    throw new Error('onShowAlert prop is missing or invalid in ResumeScoreChecker');
  }

  // ADDED LOG: Check onShowAlert value at component render
  console.log('ResumeScoreChecker: onShowAlert prop value at render:', onShowAlert);

  console.log('ResumeScoreChecker: Component rendered. userSubscription:', userSubscription);
  const { user } = useAuth(); // Get the user object from AuthContext
  const navigate = useNavigate();
  const [extractionResult, setExtractionResult] = useState<ExtractionResult>({ text: '', extraction_mode: 'TEXT', trimmed: false });
  const [jobDescription, setJobDescription] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [scoringMode, setScoringMode] = useState<ScoringMode | null>(null);
  const [autoScoreOnUpload, setAutoScoreOnUpload] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [scoreResult, setScoreResult] = useState<ComprehensiveScore | null>(null);
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasShownCreditExhaustedAlert, setHasShownCreditExhaustedAlert] = useState(false);

  const [analysisInterrupted, setAnalysisInterrupted] = useState(false);

  // NEW useEffect: Reset hasShownCreditExhaustedAlert when userSubscription changes
  useEffect(() => {
    setHasShownCreditExhaustedAlert(false);
  }, [userSubscription]);


  // Renamed analyzeResume to _analyzeResumeInternal
  const _analyzeResumeInternal = useCallback(async () => {
    console.log('_analyzeResumeInternal: Function started. Assuming credits are available.');

    // Ensure user is available before attempting to fetch subscription
    if (!user?.id) {
      console.error('_analyzeResumeInternal: User ID not available, cannot proceed with analysis.');
      onShowAlert('Authentication Required', 'User data not fully loaded. Please try again or sign in.', 'error', 'Sign In', onShowAuth);
      return;
    }

    // Re-fetch subscription to get the latest state for decrementing usage
    const latestUserSubscription = await paymentService.getUserSubscription(user.id);
    if (!latestUserSubscription || (latestUserSubscription.scoreChecksTotal - latestUserSubscription.scoreChecksUsed) <= 0) {
      console.error('_analyzeResumeInternal: Credits unexpectedly exhausted during internal analysis. This should not happen if pre-check worked.');
      onShowAlert('Credits Exhausted', 'Your credits were used up before analysis could complete. Please upgrade.', 'error', 'Upgrade Plan', () => onShowSubscriptionPlans('score-checker'));
      setAnalysisInterrupted(true);
      return;
    }

    if (!extractionResult.text.trim()) {
      onShowAlert('Missing Resume', 'Please upload your resume first to get a score.', 'warning');
      return;
    }

    if (scoringMode === 'jd_based') {
      if (!jobDescription.trim()) {
        onShowAlert('Missing Job Description', 'Job description is required for JD-based scoring.', 'warning');
        return;
      }
      if (!jobTitle.trim()) {
        onShowAlert('Missing Job Title', 'Job title is required for JD-based scoring.', 'warning');
        return;
      }
    }

    setScoreResult(null);
    setIsAnalyzing(true);
    setLoadingStep('Extracting & cleaning your resume...');
    console.log('_analyzeResumeInternal: Starting analysis, setIsAnalyzing(true).');

    try {
      if (scoringMode === 'jd_based') {
        setLoadingStep(`Comparing with Job Title: ${jobTitle}...`);
      }
      
      setLoadingStep('Scoring across 16 criteria...');

      const result = await getComprehensiveScore(
        extractionResult.text,
        scoringMode === 'jd_based' ? jobDescription : undefined,
        scoringMode === 'jd_based' ? jobTitle : undefined,
        scoringMode,
        extractionResult.extraction_mode,
        extractionResult.trimmed,
        uploadedFilename // Pass the filename here
      );

      setScoreResult(result);
      setCurrentStep(2);

      // Decrement usage after successful analysis
      const usageResult = await paymentService.useScoreCheck(latestUserSubscription.userId);
      if (usageResult.success) {
        await refreshUserSubscription(); // Refresh App.tsx state after usage
      } else {
        console.error('Failed to decrement score check usage:', usageResult.error);
        onShowAlert('Usage Update Failed', 'Failed to record score check usage. Please contact support.', 'error');
      }
    } catch (error: any) {
      console.error('_analyzeResumeInternal: Error in try block:', error);
      onShowAlert('Analysis Failed', `Failed to analyze resume: ${error.message || 'Unknown error'}. Please try again.`, 'error');
    } finally {
      setIsAnalyzing(false);
      setLoadingStep('');
      console.log('_analyzeResumeInternal: Analysis finished, setIsAnalyzing(false).');
    }
  }, [extractionResult, jobDescription, jobTitle, scoringMode, isAuthenticated, onShowAuth, onShowSubscriptionPlans, onShowAlert, refreshUserSubscription, user, uploadedFilename]);


  // New public function called by the button click
  const analyzeResume = useCallback(async () => {
    console.log('analyzeResume: Public function called.');

    if (scoringMode === null) {
      onShowAlert('Choose a Scoring Method', 'Please select either "Score Against a Job" or "General Score" to continue.', 'warning');
      return;
    }

    if (!isAuthenticated) {
      onShowAlert('Authentication Required', 'Please sign in to get your resume score.', 'error', 'Sign In', onShowAuth);
      return;
    }

    if (!user?.id) {
      onShowAlert('Authentication Required', 'User data not fully loaded. Please try again or sign in.', 'error', 'Sign In', onShowAuth);
      return;
    }

    if (!extractionResult.text.trim()) {
      onShowAlert('Missing Resume', 'Please upload your resume first to get a score.', 'warning');
      return;
    }

    if (scoringMode === 'jd_based') {
      if (!jobDescription.trim()) {
        onShowAlert('Missing Job Description', 'Job description is required for JD-based scoring.', 'warning');
        return;
      }
      if (!jobTitle.trim()) {
        onShowAlert('Missing Job Title', 'Job title is required for JD-based scoring.', 'warning');
        return;
      }
    }

    // --- Credit Check Logic ---
    const currentSubscription = await paymentService.getUserSubscription(user.id);
    const hasScoreCheckCredits = currentSubscription && (currentSubscription.scoreChecksTotal - currentSubscription.scoreChecksUsed) > 0;
    const liteCheckPlan = paymentService.getPlanById('lite_check');
    const hasFreeTrialAvailable = liteCheckPlan && (!currentSubscription || currentSubscription.planId !== 'lite_check');

    console.log('DEBUG: analyzeResume - currentSubscription:', currentSubscription);
    console.log('DEBUG: analyzeResume - hasScoreCheckCredits:', hasScoreCheckCredits);
    console.log('DEBUG: analyzeResume - hasFreeTrialAvailable:', hasFreeTrialAvailable);

    if (hasScoreCheckCredits) {
      // User has credits, proceed with analysis
      console.log('analyzeResume: User has credits. Proceeding with internal analysis.');
      _analyzeResumeInternal();
    } else if (hasFreeTrialAvailable) {
      // No credits, but free trial is available. Activate it and then analyze.
      console.log('analyzeResume: No credits, but free trial available. Activating free trial...');
      onShowAlert('Activating Free Trial', 'Activating your free trial for Resume Score Check...', 'info');
      try {
        await paymentService.activateFreeTrial(user.id);
        await refreshUserSubscription(); // Refresh subscription state after trial activation
        onShowAlert('Free Trial Activated!', 'Your free trial has been activated. Analyzing your resume now.', 'success');
        _analyzeResumeInternal(); // Proceed with analysis using the newly activated trial credits
      } catch (error: any) {
        console.error('analyzeResume: Error activating free trial:', error);
        onShowAlert('Free Trial Activation Failed', `Failed to activate free trial: ${error.message || 'Unknown error'}. Please try again.`, 'error');
      }
    } else {
      // No credits and no free trial available. Show exhaustion message and prompt for payment.
      console.log('analyzeResume: Credits exhausted and no free trial available. Showing payment prompt.');
      const planName = currentSubscription ? paymentService.getPlanById(currentSubscription.planId)?.name || 'your current plan' : 'your account';
      const totalCredits = currentSubscription?.scoreChecksTotal || 0;
      const usedCredits = currentSubscription?.scoreChecksUsed || 0;
      const remainingCredits = totalCredits - usedCredits;

      let message = '';
      if (currentSubscription && remainingCredits <= 0) {
        message = `You have used all your ${totalCredits} Resume Score Checks from ${planName}.`;
      } else if (!currentSubscription) {
        message = `You don't have any active plan for Resume Score Checks.`;
      } else {
        message = `Your Resume Score Check credits are exhausted.`;
      }
      message += ' Please upgrade your plan to continue checking scores.';

      onShowAlert(
        'Resume Score Check Credits Exhausted',
        message,
        'warning',
        'Upgrade Plan',
        () => onShowSubscriptionPlans('score-checker')
      );
      setHasShownCreditExhaustedAlert(true); // Set flag to prevent repeated alerts
      setAnalysisInterrupted(true); // Indicate analysis was interrupted due to credits
    }

  }, [extractionResult, jobDescription, jobTitle, scoringMode, isAuthenticated, onShowAuth, onShowSubscriptionPlans, onShowAlert, refreshUserSubscription, user, _analyzeResumeInternal]); // Depend on _analyzeResumeInternal


  // The useEffect for re-triggering should remain as is, but now calls _analyzeResumeInternal with retries
  useEffect(() => {
    // Only attempt to re-trigger if analysis was interrupted and user is authenticated
    // AND if credits are now available.
    if (analysisInterrupted && isAuthenticated && userSubscription && (userSubscription.scoreChecksTotal - userSubscription.scoreChecksUsed) > 0) {
      console.log('ResumeScoreChecker: Analysis was interrupted, credits now available, attempting to re-trigger with internal retry.');
      setAnalysisInterrupted(false); // Reset flag as credits are now available
      setHasShownCreditExhaustedAlert(false); // Reset alert flag

      let retryCount = 0;
      let delay = 500;
      const MAX_RETRIES_INTERNAL = 6; // Max retries for internal re-trigger

      const attemptAnalysis = async () => {
        while (retryCount < MAX_RETRIES_INTERNAL) {
          const latestSub = await paymentService.getUserSubscription(user.id); // Re-fetch to be sure
          if (latestSub && (latestSub.scoreChecksTotal - latestSub.scoreChecksUsed) > 0) {
            _analyzeResumeInternal(); // Now call the internal analysis function
            return;
          }
          retryCount++;
          if (retryCount < MAX_RETRIES_INTERNAL) {
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
          }
        }
        console.error('ResumeScoreChecker: Failed to re-trigger analysis after purchase due to persistent credit check failure.');
        onShowAlert('Analysis Not Started', 'We could not confirm your new credits. Please try again manually.', 'error');
      };

      attemptAnalysis();
    }
  }, [analysisInterrupted, isAuthenticated, userSubscription, _analyzeResumeInternal, onShowAlert, user]); // Depend on _analyzeResumeInternal

  useEffect(() => {
    setToolProcessTrigger(() => analyzeResume);
    return () => {
      setToolProcessTrigger(null);
    };
  }, [setToolProcessTrigger, analyzeResume]);

  const handleFileUpload = (result: ExtractionResult) => {
    setExtractionResult(result);
    setHasShownCreditExhaustedAlert(false);
    setUploadedFilename(result.filename || null);
    
    if (scoringMode === 'general' && autoScoreOnUpload && result.text.trim()) {
      setTimeout(() => analyzeResume(), 500);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getMatchBandColor = (band: MatchBand) => {
    if (band.includes('Excellent') || band.includes('Very Good')) return 'text-green-600 dark:text-green-400';
    if (band.includes('Good') || band.includes('Fair')) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getConfidenceColor = (confidence: ConfidenceLevel) => {
    switch (confidence) {
      case 'High': return 'text-green-600 bg-green-100 dark:text-green-900/20';
      case 'Medium': return 'text-yellow-600 bg-yellow-100 dark:text-yellow-900/20';
      case 'Low': return 'text-red-600 bg-red-100 dark:text-red-900/20';
    }
  };

  const getCategoryScoreColor = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleSelectScoringMode = (mode: ScoringMode) => {
    setScoringMode(mode);
    setCurrentStep(1);
  };

  const handleCheckAnotherResume = () => {
    setScoreResult(null);
    setExtractionResult({ text: '', extraction_mode: 'TEXT', trimmed: false });
    setJobDescription('');
    setJobTitle('');
    setCurrentStep(0);
    setHasShownCreditExhaustedAlert(false);
  };

  return (
    <>
      {isAnalyzing ? (
        <LoadingAnimation
          message={loadingStep}
          submessage="Please wait while we analyze your resume."
        />
      ) : (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 px-4 sm:px-0 dark:from-dark-50 dark:to-dark-200 transition-colors duration-300">
          <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40 dark:bg-dark-50 dark:border-dark-300">
            <div className="container-responsive">
              <div className="flex items-center justify-between h-16 py-3">
                <button
                  onClick={onNavigateBack}
                  className="bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 text-white hover:from-neon-cyan-400 hover:to-neon-blue-400 active:from-neon-cyan-600 active:to-neon-blue-600 shadow-md hover:shadow-neon-cyan py-3 px-5 rounded-xl inline-flex items-center space-x-2 transition-all duration-200"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span className="hidden sm:block">Back to Home</span>
                </button>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Resume Score Checker</h1>
                <div className="w-24"></div>
              </div>
            </div>
          </div>

          <div className="flex-grow flex items-center justify-center py-8">
            {currentStep === 0 && (
              <div className="container-responsive">
                 <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden dark:bg-dark-100 dark:border-dark-300 dark:shadow-dark-xl">
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 border-b border-gray-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Choose Scoring Method</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        onClick={() => handleSelectScoringMode('jd_based')}
                        className={`p-6 rounded-xl border-2 transition-all duration-300 text-left ${
                          scoringMode === 'jd_based'
                            ? 'border-blue-500 bg-blue-50 shadow-lg dark:border-neon-cyan-500 dark:bg-neon-cyan-500/20'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 dark:border-dark-300 dark:hover:border-neon-cyan-400 dark:hover:bg-neon-cyan-500/10'
                        }`}
                      >
                        <div className="flex items-center mb-3">
                          <Target className="w-6 h-6 text-blue-600 dark:text-neon-cyan-400 mr-3" />
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Score Against a Job</h3>
                          <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium dark:bg-neon-cyan-500/20 dark:text-neon-cyan-300">Best</span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 text-sm">Get a targeted score by comparing your resume against a specific job description and title.</p>
                      </button>
                      <button
                        onClick={() => handleSelectScoringMode('general')}
                        className={`p-6 rounded-xl border-2 transition-all duration-300 text-left ${
                          scoringMode === 'general'
                            ? 'border-purple-500 bg-purple-50 shadow-lg dark:border-neon-purple-500 dark:bg-neon-purple-500/20'
                            : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50 dark:border-dark-300 dark:hover:border-neon-purple-400 dark:hover:bg-neon-purple-500/10'
                        }`}
                      >
                        <div className="flex items-center mb-3">
                          <BarChart3 className="w-6 h-6 text-purple-600 dark:text-purple-400 mr-3" />
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">General Score</h3>
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 text-sm">Get a general assessment of your resume quality against industry standards.</p>
                        {scoringMode === 'general' && (
                          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-300">
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={autoScoreOnUpload}
                                onChange={(e) => setAutoScoreOnUpload(e.target.checked)}
                                className="form-checkbox h-4 w-4 text-purple-600 rounded focus:ring-purple-500"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">Auto-score on upload</span>
                            </label>
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="container-responsive">
                <div className="max-w-4xl mx-auto">
                  <div className="mb-6">
                    <button
                      onClick={() => setCurrentStep(0)}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-xl transition-colors flex items-center space-x-2 dark:bg-dark-300 dark:hover:bg-dark-400"
                    >
                      <ArrowLeft className="w-5 h-5" />
                      <span>Back to Scoring Method</span>
                    </button>
                  </div>
                  <div className="space-y-8">
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden dark:bg-dark-100 dark:border-dark-300 dark:shadow-dark-xl">
                      <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 border-b border-gray-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                          <Upload className="w-5 h-5 mr-2 text-blue-600 dark:text-neon-cyan-400" />
                          Upload Your Resume
                        </h2>
                        <p className="text-gray-600 dark:text-gray-300 mt-1">Upload your current resume for analysis</p>
                      </div>
                      <div className="p-6">
                        <FileUpload onFileUpload={handleFileUpload} />
                      </div>
                    </div>

                    {scoringMode === 'jd_based' && (
                      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden dark:bg-dark-100 dark:border-dark-300 dark:shadow-dark-xl">
                        <div className="bg-gradient-to-r from-orange-50 to-red-50 p-6 border-b border-gray-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
                          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                            <Briefcase className="w-5 h-5 mr-2 text-orange-600 dark:text-orange-400" />
                            Job Title *
                          </h2>
                          <p className="text-gray-600 dark:text-gray-300 mt-1">Enter the exact job title you're targeting</p>
                        </div>
                        <div className="p-6">
                          <input
                            type="text"
                            value={jobTitle}
                            onChange={(e) => setJobTitle(e.target.value)}
                            placeholder="e.g., Senior Software Engineer, Product Manager, Data Scientist"
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                          />
                        </div>
                      </div>
                    )}

                    {(scoringMode === 'general' || scoringMode === 'jd_based') && (
                      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden dark:bg-dark-100 dark:border-dark-300 dark:shadow-dark-xl">
                        <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 border-b border-gray-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
                          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                            <Target className="w-5 h-5 mr-2 text-green-600 dark:text-neon-blue-400" />
                            Job Description {scoringMode === 'jd_based' ? '*' : '(Optional)'}
                          </h2>
                          <p className="text-gray-600 dark:text-gray-300 mt-1">
                            {scoringMode === 'jd_based'
                              ? 'Paste the complete job description for targeted analysis'
                              : 'Add a job description for more specific analysis. If left empty, we\'ll use general industry standards.'
                            }
                          </p>
                        </div>
                        <div className="p-6">
                          <textarea
                            value={jobDescription}
                            onChange={(e) => setJobDescription(e.target.value)}
                            placeholder={scoringMode === 'jd_based'
                              ? "Paste the complete job description here including requirements, responsibilities, and qualifications..."
                              : "Paste the job description here for more specific analysis. If left empty, we'll use general industry standards."
                            }
                            className="w-full h-32 p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-neon-cyan-500 focus:border-neon-cyan-500 resize-none dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                          />
                        </div>
                      </div>
                    )}

                    <div className="text-center">
                      <button
                        onClick={() => { setHasShownCreditExhaustedAlert(false); analyzeResume(); }}
                        disabled={scoringMode === null || !extractionResult.text.trim() || (scoringMode === 'jd_based' && (!jobDescription.trim() || !jobTitle.trim()))}
                        className={`px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 flex items-center space-x-3 mx-auto shadow-xl hover:shadow-2xl ${
                          scoringMode === null || !extractionResult.text.trim() || (scoringMode === 'jd_based' && (!jobDescription.trim() || !jobTitle.trim()))
                            ? 'bg-gray-400 cursor-not-allowed text-white'
                            : 'bg-gradient-to-r from-neon-cyan-500 to-neon-purple-500 hover:from-neon-cyan-400 hover:to-neon-purple-400 text-white hover:shadow-neon-cyan transform hover:scale-105'
                        }`}
                      >
                        <TrendingUp className="w-6 h-6" />
                        <span>{isAuthenticated ? 'Analyze My Resume' : 'Sign In to Analyze'}</span>
                      </button>
                      {!isAuthenticated && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                          Sign in to access our AI-powered resume analysis
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && scoreResult && (
              <div className="container-responsive">
                <div className="max-w-4xl mx-auto">
                  {scoreResult.cached && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 dark:bg-neon-cyan-500/10 dark:border-neon-cyan-400/50">
                      <div className="flex items-center">
                        <Calendar className="w-5 h-5 text-blue-600 dark:text-neon-cyan-400 mr-2" />
                        <span className="text-blue-800 dark:text-neon-cyan-300 font-medium">
                          Cached Result - This analysis was free (expires {scoreResult.cache_expires_at ? new Date(scoreResult.cache_expires_at).toLocaleDateString() : 'soon'})
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden dark:bg-dark-100 dark:border-dark-300 dark:shadow-dark-xl">
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 border-b border-gray-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                        <Award className="w-5 h-5 mr-2 text-green-600 dark:text-neon-cyan-400" />
                        Your Resume Score
                      </h2>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {extractionResult.extraction_mode === 'OCR' && (
                          <span className="px-3 py-1 bg-orange-100 text-orange-800 text-xs rounded-full font-medium dark:bg-orange-900/20 dark:text-orange-300">
                            <Eye className="w-3 h-3 inline mr-1" />
                            OCR Used
                          </span>
                        )}
                        {extractionResult.trimmed && (
                          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium dark:bg-yellow-900/20 dark:text-yellow-300">
                            <Info className="w-3 h-3 inline mr-1" />
                            Content Trimmed
                          </span>
                        )}
                        <span className={`px-3 py-1 text-xs rounded-full font-medium ${getConfidenceColor(scoreResult.confidence)}`}>
                          <Shield className="w-3 h-3 inline mr-1" />
                          {scoreResult.confidence} Confidence
                        </span>
                      </div>
                    </div>
                    <div className="p-8">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-center">
                        <div className="text-center">
                          <div className="relative w-32 h-32 mx-auto mb-4">
                            <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
                              <circle
                                cx="60"
                                cy="60"
                                r="50"
                                fill="none"
                                stroke="#e5e7eb"
                                strokeWidth="8"
                              />
                              <circle
                                cx="60"
                                cy="60"
                                r="50"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="8"
                                strokeDasharray={`${(scoreResult.overall / 100) * 314} 314`}
                                strokeLinecap="round"
                                className={`${getScoreColor(scoreResult.overall)} dark:stroke-neon-cyan-400`}
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="text-center">
                                <div className={`text-3xl font-bold ${getScoreColor(scoreResult.overall)} dark:text-neon-cyan-400`}>
                                  {scoreResult.overall}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Score</div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="bg-gradient-to-br from-blue-50 to-purple-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 dark:from-neon-cyan-500/20 dark:to-neon-blue-500/20 dark:shadow-neon-cyan">
                            <Award className="w-8 h-8 text-blue-600 dark:text-neon-cyan-400" />
                          </div>
                          <div className={`text-lg font-bold ${getMatchBandColor(scoreResult.match_band)} mb-2`}>
                            {scoreResult.match_band}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">Match Quality</div>
                        </div>
                        <div className="text-center">
                          <div className="bg-gradient-to-br from-green-50 to-emerald-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 dark:from-neon-blue-500/20 dark:to-neon-purple-500/20 dark:shadow-neon-blue">
                            <TrendingUp className="w-8 h-8 text-green-600 dark:text-neon-blue-400" />
                          </div>
                          <div className="text-lg font-bold text-green-600 dark:text-neon-blue-400 mb-2">
                            {scoreResult.interview_probability_range}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">Interview Chance</div>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Overall Analysis</h3>
                          <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm mb-4">{scoreResult.analysis}</p>
                          <div className="space-y-2">
                            <div className="bg-green-50 p-4 rounded-lg border border-green-200 dark:bg-neon-cyan-500/10 dark:border-neon-cyan-400/50">
                              <h4 className="font-medium text-green-800 dark:text-neon-cyan-300 mb-1 text-xs">Key Strengths</h4>
                              <div className="text-xs text-green-700 dark:text-gray-300">
                                {scoreResult.keyStrengths.length} key strengths identified
                              </div>
                            </div>
                            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 dark:bg-orange-900/20 dark:border-orange-500/50">
                              <h4 className="font-medium text-orange-800 dark:text-orange-300 mb-1 text-xs">Areas for Improvement</h4>
                              <div className="text-xs text-orange-700 dark:text-orange-400">
                                {scoreResult.improvementAreas.length} areas for improvement
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden dark:bg-dark-100 dark:border-dark-300 dark:shadow-dark-xl mt-6">
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 border-b border-gray-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                        <BarChart3 className="w-5 h-5 mr-2 text-indigo-600 dark:text-neon-purple-400" />
                        16-Metric Detailed Breakdown
                      </h2>
                      <p className="text-gray-600 dark:text-gray-300 mt-1">Comprehensive analysis across all scoring criteria</p>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {scoreResult.breakdown.map((metric, index) => (
                          <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200 dark:bg-dark-200 dark:border-dark-300">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{metric.name}</h4>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{metric.weight_pct}%</span>
                            </div>
                            <div className="flex items-center mb-2">
                              <span className={`text-lg font-bold ${getCategoryScoreColor(metric.score, metric.max_score)} dark:text-neon-cyan-400`}>
                                {metric.score}
                              </span>
                              <span className="text-gray-500 dark:text-gray-400">/{metric.max_score}</span>
                              <div className="ml-auto text-xs text-gray-600 dark:text-gray-400">
                                +{metric.contribution.toFixed(1)} pts
                              </div>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mb-2 dark:bg-dark-300">
                              <div
                                className={`h-2 rounded-full transition-all duration-300 ${
                                  (metric.score / metric.max_score) >= 0.9 ? 'bg-green-500' :
                                  (metric.score / metric.max_score) >= 0.7 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${(metric.score / metric.max_score) * 100}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-700 dark:text-gray-300">{metric.details}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden dark:bg-dark-100 dark:border-dark-300 dark:shadow-dark-xl mt-6">
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 border-b border-gray-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                        <Lightbulb className="w-5 h-5 mr-2 text-purple-600 dark:text-neon-purple-400" />
                        Actionable Fixes
                      </h2>
                    </div>
                    <div className="p-6">
                      <ul className="space-y-3">
                        {scoreResult.actions.length > 0 ? (
                          scoreResult.actions.map((action, index) => (
                            <li key={index} className="flex items-start">
                              <ArrowRight className="w-5 h-5 text-purple-500 dark:text-neon-purple-400 mr-3 mt-0.5 flex-shrink-0" />
                              <span className="text-gray-700 dark:text-gray-300">{action}</span>
                            </li>
                          ))
                        ) : (
                          <p className="text-gray-600 dark:text-gray-300 italic">No specific recommendations at this time. Your resume looks great!</p>
                        )}
                      </ul>
                    </div>
                  </div>

                  {scoringMode === 'jd_based' && (
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden dark:bg-dark-100 dark:border-dark-300 dark:shadow-dark-xl mt-6">
                      <div className="bg-gradient-to-r from-neon-cyan-50 to-neon-blue-50 p-6 border-b border-gray-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                          <FileText className="w-5 h-5 mr-2 text-neon-cyan-600 dark:text-neon-cyan-400" />
                          Ready to Optimize?
                        </h2>
                      </div>
                      <div className="p-6">
                        <p className="text-gray-700 dark:text-gray-300 mb-4">
                          Your resume score is a great first step. Now, let's use the full power of our JD-based optimizer to generate tailored resume bullets based on your job description.
                        </p>
                        <button
                          onClick={() => navigate('/optimizer')}
                          className="w-full bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 hover:from-neon-cyan-400 hover:to-neon-blue-400 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-neon-cyan flex items-center justify-center space-x-2"
                        >
                          <span>Go to JD-Based Resume Optimizer</span>
                          <ArrowRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}

                  

                  <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden dark:bg-dark-100 dark:border-dark-300 dark:shadow-dark-xl mt-6">
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 border-b border-gray-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                        <Lightbulb className="w-5 h-5 mr-2 text-purple-600 dark:text-neon-purple-400" />
                        Actionable Recommendations
                      </h2>
                    </div>
                    <div className="p-6">
                      <ul className="space-y-3">
                        {scoreResult.recommendations.length > 0 ? (
                          scoreResult.recommendations.map((rec, index) => (
                            <li key={index} className="flex items-start">
                              <ArrowRight className="w-5 h-5 text-purple-500 dark:text-neon-purple-400 mr-3 mt-0.5 flex-shrink-0" />
                              <span className="text-gray-700 dark:text-gray-300">{rec}</span>
                            </li>
                          ))
                        ) : (
                          <p className="text-gray-600 dark:text-gray-300 italic">No specific recommendations at this time. Your resume looks great!</p>
                        )}
                      </ul>
                    </div>
                  </div>

                  <div className="text-center space-y-4 bg-white rounded-2xl shadow-lg border border-gray-200 p-6 dark:bg-dark-100 dark:border-dark-300 dark:shadow-dark-xl mt-6">
                   
                    <button
                      onClick={handleCheckAnotherResume}
                      className="bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 hover:from-neon-cyan-400 hover:to-neon-blue-400 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 mr-4 shadow-neon-cyan"
                    >
                      Check Another Resume
                    </button>
                    <button
                      onClick={onNavigateBack}
                      className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 dark:bg-dark-300 dark:hover:bg-dark-400"
                    >
                      Back to Home
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

