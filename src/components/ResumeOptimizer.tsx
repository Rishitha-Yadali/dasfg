// src/components/ResumeOptimizer.tsx
import React, { useState, useEffect, useCallback } from 'react'; // Import useCallback
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { FileText, AlertCircle, Plus, Sparkles, ArrowLeft, X } from 'lucide-react';
import { ResumePreview } from './ResumePreview';
import { ResumeExportSettings } from './ResumeExportSettings';
import { ProjectAnalysisModal } from './ProjectAnalysisModal';
import { MobileOptimizedInterface } from './MobileOptimizedInterface';
import { ProjectEnhancement } from './ProjectEnhancement';
import { SubscriptionPlans } from './payment/SubscriptionPlans';
import { SubscriptionStatus } from './payment/SubscriptionStatus';
import { MissingSectionsModal } from './MissingSectionsModal';
import { InputWizard } from './InputWizard';
import { LoadingAnimation } from './LoadingAnimation';
import { optimizeResume } from '../services/geminiService';
import { generateBeforeScore, generateAfterScore, getDetailedResumeScore, reconstructResumeText } from '../services/scoringService';
import { paymentService } from '../services/paymentService';
import { ResumeData, UserType, MatchScore, DetailedScore, ExtractionResult, ScoringMode } from '../types/resume';
import { ExportOptions, defaultExportOptions } from '../types/export';
import { exportToPDF, exportToWord } from '../utils/exportUtils';
import { useNavigate } from 'react-router-dom';
import { ExportButtons } from './ExportButtons';

// src/components/ResumeOptimizer.tsx
const cleanResumeText = (text: string): string => {
  let cleaned = text;
  // Remove "// Line XXX" patterns anywhere in the text
  cleaned = cleaned.replace(/\/\/\s*Line\s*\d+\s*/g, '');
  // Remove "// MODIFIED:" patterns anywhere in the text (e.g., "// MODIFIED: listStyleType to 'none'")
  cleaned = cleaned.replace(/\/\/\s*MODIFIED:\s*.*?(?=\n|$)/g, ''); // Catches the whole comment line
  // Also remove any remaining single-line comments that might have slipped through or were on their own line
  cleaned = cleaned.split('\n')
                   .filter(line => !line.trim().startsWith('//')) // Remove lines that start with //
                   .join('\n');
  return cleaned;
};


interface ResumeOptimizerProps {
  isAuthenticated: boolean;
  onShowAuth: () => void;
  onShowProfile: (mode?: 'profile' | 'wallet') => void;
  onNavigateBack: () => void;
  userSubscription: any;
  refreshUserSubscription: () => Promise<void>;
  onShowPlanSelection: (featureId?: string) => void;
  toolProcessTrigger: (() => void) | null;
  setToolProcessTrigger: React.Dispatch<React.SetStateAction<(() => void) | null>>;
}

type ManualProject = {
  title: string;
  startDate: string;
  endDate: string;
  techStack: string[];
  oneLiner: string;
};

const ResumeOptimizer: React.FC<ResumeOptimizerProps> = ({
  isAuthenticated,
  onShowAuth,
  onShowProfile,
  onNavigateBack,
  userSubscription,
  refreshUserSubscription,
  onShowPlanSelection,
  toolProcessTrigger,
  setToolProcessTrigger
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [extractionResult, setExtractionResult] = useState<ExtractionResult>({ text: '', extraction_mode: 'TEXT', trimmed: false });
  const [jobDescription, setJobDescription] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [userType, setUserType] = useState<UserType>('fresher');
  const [scoringMode, setScoringMode] = useState<ScoringMode>('general');
  const [autoScoreOnUpload, setAutoScoreOnUpload] = useState(true);

  const [optimizedResume, setOptimizedResume] = useState<ResumeData | null>(null);
  const [parsedResumeData, setParsedResumeData] = useState<ResumeData | null>(null);
  const [pendingResumeData, setPendingResumeData] = useState<ResumeData | null>(null);

  const [beforeScore, setBeforeScore] = useState<MatchScore | null>(null);
  const [afterScore, setAfterScore] = useState<MatchScore | null>(null);
  const [initialResumeScore, setInitialResumeScore] = useState<DetailedScore | null>(null);
  const [finalResumeScore, setFinalResumeScore] = useState<DetailedScore | null>(null);
  const [changedSections, setChangedSections] = useState<string[]>([]);

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isCalculatingScore, setIsCalculatingScore] = useState(false);
  const [isProcessingMissingSections, setIsProcessingMissingSections] = useState(false);
  const [activeTab, setActiveTab] = useState<'resume'>('resume');
  const [currentStep, setCurrentStep] = useState(0);

  const [showProjectAnalysis, setShowProjectAnalysis] = useState(false);
  const [showMissingSectionsModal, setShowMissingSectionsModal] = useState(false);
  const [missingSections, setMissingSections] = useState<string[]>([]);

  const [showMobileInterface, setShowMobileInterface] = useState(false);
  const [showProjectMismatch, setShowProjectMismatch] = useState(false);
  const [showProjectOptions, setShowProjectOptions] = useState(false);
  const [showManualProjectAdd, setShowManualProjectAdd] = useState(false);
  const [lowScoringProjects, setLowScoringProjects] = useState<any[]>([]);
  const [manualProject, setManualProject] = useState<ManualProject>({
    title: '',
    startDate: '',
    endDate: '',
    techStack: [],
    oneLiner: ''
  });
  const [newTechStack, setNewTechStack] = useState('');

  const [showProjectEnhancement, setShowProjectEnhancement] = useState(false);

  const [subscription, setSubscription] = useState<any>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [walletRefreshKey, setWalletRefreshKey] = useState(0);

  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');

  const [exportOptions, setExportOptions] = useState<ExportOptions>(defaultExportOptions);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingWord, setIsExportingWord] = useState(false);
  const [exportStatus, setExportStatus] = useState<{
    type: 'pdf' | 'word' | null;
    status: 'success' | 'error' | null;
    message: string;
  }>({ type: null, status: null, message: '' });

  const [optimizationInterrupted, setOptimizationInterrupted] = useState(false);

  const userName = (user as any)?.user_metadata?.name || '';
  const userEmail = user?.email || ''; // Correctly accesses email from user object
  const userPhone = user?.phone || ''; // Correctly accesses phone from user object
  const userLinkedin = user?.linkedin || ''; // Correctly accesses linkedin from user object
  const userGithub = user?.github || ''; // Correctly accesses github from user object

  const handleStartNewResume = useCallback(() => { // Memoize
    setOptimizedResume(null);
    setExtractionResult({ text: '', extraction_mode: 'TEXT', trimmed: false });
    setJobDescription('');
    setTargetRole('');
    setUserType('fresher');
    setBeforeScore(null);
    setAfterScore(null);
    setInitialResumeScore(null);
    setFinalResumeScore(null);
    setParsedResumeData(null);
    setManualProject({ title: '', startDate: '', endDate: '', techStack: [], oneLiner: '' });
    setNewTechStack('');
    setLowScoringProjects([]);
    setChangedSections([]);
    setCurrentStep(0);
    setActiveTab('resume');
    setShowMobileInterface(false);
    setOptimizationInterrupted(false);
  }, []);

  const checkSubscriptionStatus = useCallback(async () => { // Memoize
    if (!user) return;
    try {
      const userSubscriptionData = await paymentService.getUserSubscription(user.id);
      setSubscription(userSubscriptionData);
    } catch (error) {
      console.error('Error checking subscription:', error);
    } finally {
      setLoadingSubscription(false);
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated && user) {
      checkSubscriptionStatus();
    } else {
      setLoadingSubscription(false);
    }
  }, [isAuthenticated, user, checkSubscriptionStatus]); // Add checkSubscriptionStatus to dependencies

  useEffect(() => {
    if (extractionResult.text.trim().length > 0 && currentStep === 0) {
      setCurrentStep(1);
    }
  }, [extractionResult.text, currentStep]);

  const checkForMissingSections = useCallback((resumeData: ResumeData): string[] => { // Memoize
    const missing: string[] = [];
    if (!resumeData.workExperience || resumeData.workExperience.length === 0 || resumeData.workExperience.every(exp => !exp.role?.trim())) {
      missing.push('workExperience');
    }
    if (!resumeData.projects || resumeData.projects.length === 0 || resumeData.projects.every(proj => !proj.title?.trim())) {
      missing.push('projects');
    }
    if (!resumeData.skills || resumeData.skills.length === 0 || resumeData.skills.every(skillCat => !skillCat.list || skillCat.list.every(s => !s.trim()))) {
      missing.push('skills');
    }
    if (!resumeData.education || resumeData.education.length === 0 || resumeData.education.every(edu => !edu.degree?.trim() || !edu.school?.trim() || !edu.year?.trim())) {
      missing.push('education');
    }
    // Check for certifications
    if (!resumeData.certifications || resumeData.certifications.length === 0 || resumeData.certifications.every(cert => (typeof cert === 'string' ? !cert.trim() : !cert.title?.trim()))) {
      missing.push('certifications');
    }
    return missing;
  }, []);

  const proceedWithFinalOptimization = useCallback(async (resumeData: ResumeData, initialScore: DetailedScore, accessToken: string) => { // Memoize
    try {
      setIsOptimizing(true);
      const finalOptimizedResume = await optimizeResume(
        reconstructResumeText(resumeData),
        jobDescription,
        userType,
        userName,
        userEmail,
        userPhone,
        userLinkedin,
        userGithub,
        undefined,
        undefined,
        targetRole
      );
      const beforeScoreData = generateBeforeScore(reconstructResumeText(resumeData));
      setBeforeScore(beforeScoreData);
      const finalScore = await getDetailedResumeScore(finalOptimizedResume, jobDescription, setIsCalculatingScore);
      setFinalResumeScore(finalScore);
      const afterScoreData = await generateAfterScore(finalOptimizedResume, jobDescription);
      setAfterScore(afterScoreData);
      setChangedSections(['workExperience', 'education', 'projects', 'skills', 'certifications']);
      const optimizationResult = await paymentService.useOptimization(user!.id);
      if (optimizationResult.success) {
        await checkSubscriptionStatus();
        setWalletRefreshKey(prevKey => prevKey + 1);
      } else {
        console.error('Failed to decrement optimization usage:', optimizationResult.error);
      }
      if (window.innerWidth < 768) {
        setShowMobileInterface(true);
      }
      setActiveTab('resume');
      setOptimizedResume(finalOptimizedResume);
    } catch (error) {
      console.error('Error in final optimization pass:', error);
      alert('Failed to complete resume optimization. Please try again.');
    } finally {
      setIsOptimizing(false);
      setIsCalculatingScore(false);
    }
  }, [jobDescription, userType, userName, userEmail, userPhone, userLinkedin, userGithub, targetRole, user, checkSubscriptionStatus]); // Dependencies for memoized function

  const handleInitialResumeProcessing = useCallback(async (resumeData: ResumeData, accessToken: string) => { // Memoize
    try {
      setIsCalculatingScore(true);
      const initialScore = await getDetailedResumeScore(resumeData, jobDescription, setIsCalculatingScore);
      setInitialResumeScore(initialScore);
      setOptimizedResume(resumeData);
      setParsedResumeData(resumeData);
      if (resumeData.projects && resumeData.projects.length > 0) {
        setShowProjectAnalysis(true);
      } else {
        await proceedWithFinalOptimization(resumeData, initialScore, accessToken);
      }
    } catch (error) {
      console.error('Error in initial resume processing:', error);
      alert('Failed to process resume. Please try again.');
    } finally {
      setIsCalculatingScore(false);
    }
  }, [jobDescription, proceedWithFinalOptimization]); // Dependencies for memoized function

  const continueOptimizationProcess = useCallback(async (resumeData: ResumeData, accessToken: string) => { // Memoize
    try {
      await handleInitialResumeProcessing(resumeData, accessToken);
    } catch (error) {
      console.error('Error in optimization process:', error);
      alert('Failed to continue optimization. Please try again.');
      setIsOptimizing(false);
    }
  }, [handleInitialResumeProcessing]); // Dependencies for memoized function

  const handleMissingSectionsProvided = useCallback(async (data: any) => {
    setIsProcessingMissingSections(true);
    try {
      if (!pendingResumeData) {
        throw new Error('No pending resume data to update.');
      }
      const updatedResume: ResumeData = {
        ...pendingResumeData,
        ...(data.workExperience && data.workExperience.length > 0 && { workExperience: data.workExperience }),
        ...(data.projects && data.projects.length > 0 && { projects: data.projects }),
        ...(data.skills && data.skills.length > 0 && { skills: data.skills }),
        ...(data.education && data.education.length > 0 && { education: data.education }),
        ...(data.certifications && data.certifications.length > 0 && { certifications: data.certifications }), // Add certifications
        ...(data.summary && { summary: data.summary })
      };
      setShowMissingSectionsModal(false);
      setMissingSections([]);
      setPendingResumeData(null);
      setIsOptimizing(false);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || '';
      await handleInitialResumeProcessing(updatedResume, accessToken);
    } catch (error) {
      console.error('Error processing missing sections:', error);
      alert('Failed to process the provided information. Please try again.');
    } finally {
      setIsProcessingMissingSections(false);
    }
  }, [pendingResumeData, handleInitialResumeProcessing]);

  const handleOptimize = useCallback(async () => { // Memoize
    if (!extractionResult.text.trim() || !jobDescription.trim()) {
      alert('Please provide both resume content and job description');
      return;
    }
    if (!user) {
      alert('User information not available. Please sign in again.');
      onShowAuth();
      return;
    }

    // Clear any previous interruption state at the start of optimization attempt
    setOptimizationInterrupted(false);
    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        alert('Your session has expired. Please sign in again.');
        onShowAuth();
        return;
      }
      const session = refreshData.session;
      if (!session || !session.access_token) {
        alert('Your session has expired. Please sign in again.');
        onShowAuth();
        return;
      }
      if (!userSubscription || (userSubscription.optimizationsTotal - userSubscription.optimizationsUsed) <= 0) {
        // Re-fetch userSubscription here to ensure it's the absolute latest before checking credits
        const latestUserSubscription = await paymentService.getUserSubscription(user.id);
        if (!latestUserSubscription || (latestUserSubscription.optimizationsTotal - latestUserSubscription.optimizationsUsed) <= 0) {
        onShowPlanSelection('optimizer');
        return;
        }
      }
      setIsOptimizing(true);
      try {
        // ⬇️ NEW LOGIC: prefer already-parsed + complete data; skip re-parsing if possible
        let baseResume: ResumeData;
        let processedResumeText = cleanResumeText(extractionResult.text); // Add this line to clean the text

        if (parsedResumeData && checkForMissingSections(parsedResumeData).length === 0) {
          // Already have a complete parsed resume (perhaps after user filled missing sections)
          baseResume = parsedResumeData;
        } else {
          // Parse from extractionResult.text via AI as before
          const parsedResume = await optimizeResume(
           extractionResult.text,
            jobDescription,
            userType,
            userName,
            userEmail,
            userPhone,
            userLinkedin,
            userGithub,
            undefined,
            undefined,
            targetRole
          );
          baseResume = parsedResume;
          setParsedResumeData(parsedResume);
        }

        const missing = checkForMissingSections(baseResume);
        if (missing.length > 0) {
          setMissingSections(missing);
          setPendingResumeData(baseResume);
          setShowMissingSectionsModal(true);
          setIsOptimizing(false);
          return;
        }

        await continueOptimizationProcess(baseResume, session.access_token);
      } catch (error: any) {
        console.error('Error optimizing resume:', error);
        alert('Failed to optimize resume. Please try again.');
      } finally {
        setIsOptimizing(false);
      }
    } catch (error: any) {
      console.error('Error during session validation or subscription check:', error);
      alert(`An error occurred: ${error.message || 'Failed to validate session or check subscription.'}`);
      setIsOptimizing(false);
    }
  }, [
    extractionResult,
    jobDescription,
    user, // Keep user as a dependency
    onShowAuth,
    onShowPlanSelection, // Keep onShowPlanSelection as a dependency
    userSubscription, // Keep userSubscription as a dependency for the useEffect below
    userType,
    userName,
    userEmail,
    userPhone,
    userLinkedin,
    userGithub,
    targetRole,
    checkForMissingSections,
    continueOptimizationProcess,
    parsedResumeData // ⬅️ added dependency because we branch on it
  ]); // Dependencies for memoized function

  useEffect(() => {
    setToolProcessTrigger(() => handleOptimize);
    return () => {
      setToolProcessTrigger(null);
    };
  }, [setToolProcessTrigger, handleOptimize]);

  useEffect(() => {
    // This useEffect should now primarily reset the flag, not re-trigger the process
    // The actual re-triggering will be handled by toolProcessTrigger from App.tsx
    if (optimizationInterrupted && userSubscription && (userSubscription.optimizationsTotal - userSubscription.optimizationsUsed) > 0) {
      console.log('ResumeOptimizer: Optimization was interrupted, credits now available. Resetting flag.');
      setOptimizationInterrupted(false); // Reset the flag
    }
  }, [optimizationInterrupted, refreshUserSubscription, userSubscription, handleOptimize]);

  const handleProjectMismatchResponse = useCallback(async (proceed: boolean) => { // Memoize
    setShowProjectMismatch(false);
    if (proceed) {
      setShowProjectOptions(true);
    } else {
      if (parsedResumeData && initialResumeScore) {
        const { data: sessionData } = await supabase.auth.getSession();
        await proceedWithFinalOptimization(parsedResumeData, initialResumeScore, sessionData?.session?.access_token || '');
      }
    }
  }, [parsedResumeData, initialResumeScore, proceedWithFinalOptimization]);

  const handleProjectOptionSelect = useCallback((option: 'manual' | 'ai') => { // Memoize
    setShowProjectOptions(false);
    if (option === 'manual') {
      setShowManualProjectAdd(true);
    } else {
      setShowProjectEnhancement(true);
    }
  }, []);

  const addTechToStack = useCallback(() => { // Memoize
    if (newTechStack.trim() && !manualProject.techStack.includes(newTechStack.trim())) {
      setManualProject(prev => ({ ...prev, techStack: [...prev.techStack, newTechStack.trim()] }));
      setNewTechStack('');
    }
  }, [newTechStack, manualProject.techStack]);

  const removeTechFromStack = useCallback((tech: string) => { // Memoize
    setManualProject(prev => ({ ...prev, techStack: prev.techStack.filter(t => t !== tech) }));
  }, []);

  const generateProjectDescription = useCallback(async (project: ManualProject, jd: string): Promise<string> => { // Memoize
    return `• Developed ${project.title} using ${project.techStack.join(', ')} technologies
• Implemented core features and functionality aligned with industry best practices
• Delivered scalable solution with focus on performance and user experience`;
  }, []);

  const handleManualProjectSubmit = useCallback(async () => { // Memoize
    if (!manualProject.title || manualProject.techStack.length === 0 || !parsedResumeData) {
      alert('Please provide project title and tech stack.');
      return;
    }
    setIsOptimizing(true);
    try {
      const projectDescriptionText = await generateProjectDescription(manualProject, jobDescription);
      const newProject = {
        title: manualProject.title,
        bullets: projectDescriptionText.split('\n').filter(line => line.trim().startsWith('•')).map(line => line.replace('•', '').trim()),
        githubUrl: ''
      };
      const updatedResume = { ...parsedResumeData, projects: [...(parsedResumeData.projects || []), newProject] };
      setShowManualProjectAdd(false);
      const { data: sessionData } = await supabase.auth.getSession();
      if (initialResumeScore) {
        await proceedWithFinalOptimization(updatedResume, initialResumeScore, sessionData?.session?.access_token || '');
      } else {
        const newInitialScore = await getDetailedResumeScore(updatedResume, jobDescription, setIsCalculatingScore);
        await proceedWithFinalOptimization(updatedResume, newInitialScore, sessionData?.session?.access_token || '');
      }
    } catch (error) {
      console.error('Error creating manual project:', error);
      alert('Failed to create project. Please try again.');
    } finally {
      setIsOptimizing(false);
    }
  }, [manualProject, parsedResumeData, generateProjectDescription, jobDescription, initialResumeScore, proceedWithFinalOptimization]); // Dependencies for memoized function

  const generateScoresAfterProjectAdd = useCallback(async (updatedResume: ResumeData, accessToken: string) => { // Memoize
    try {
      setIsCalculatingScore(true);
      const freshInitialScore = await getDetailedResumeScore(updatedResume, jobDescription, setIsCalculatingScore);
      setInitialResumeScore(freshInitialScore);
      await proceedWithFinalOptimization(updatedResume, freshInitialScore, accessToken);
    } catch (error) {
      console.error('Error generating scores after project add:', error);
      alert('Failed to generate updated scores. Please try again.');
    } finally {
      setIsCalculatingScore(false);
    }
  }, [jobDescription, proceedWithFinalOptimization]); // Dependencies for memoized function

  const handleProjectsUpdated = useCallback(async (updatedResumeData: ResumeData) => { // Memoize
    setOptimizedResume(updatedResumeData);
    setParsedResumeData(updatedResumeData);
    const { data: sessionData } = await supabase.auth.getSession();
    if (initialResumeScore) {
      await proceedWithFinalOptimization(updatedResumeData, initialResumeScore, sessionData?.session?.access_token || '');
    } else {
      await generateScoresAfterProjectAdd(updatedResumeData, sessionData?.session?.access_token || '');
    }
  }, [initialResumeScore, proceedWithFinalOptimization, generateScoresAfterProjectAdd]); // Dependencies for memoized function

  const handleSubscriptionSuccess = useCallback(() => { // Memoize
    checkSubscriptionStatus();
    onShowPlanSelection();
    setWalletRefreshKey(prevKey => prevKey + 1);
  }, [checkSubscriptionStatus, onShowPlanSelection]); // Dependencies for memoized function

  const handleExportFile = useCallback(async (options: ExportOptions, format: 'pdf' | 'word') => {
    if (!optimizedResume) return;
    
    // ADDED: Debug logging for export data
    console.log('[ResumeOptimizer] handleExportFile - optimizedResume data being exported:', optimizedResume);
    console.log('[ResumeOptimizer] Contact details in export data:');
    console.log('  - name:', optimizedResume.name);
    console.log('  - phone:', optimizedResume.phone);
    console.log('  - email:', optimizedResume.email);
    console.log('  - linkedin:', optimizedResume.linkedin);
    console.log('  - github:', optimizedResume.github);
    console.log('  - location:', optimizedResume.location);
    
    if (format === 'pdf') {
      if (isExportingPDF || isExportingWord) return;
      setIsExportingPDF(true);
    } else {
      if (isExportingWord || isExportingPDF) return;
      setIsExportingWord(true);
    }
    
    setExportStatus({ type: null, status: null, message: '' });
    
    try {
      if (format === 'pdf') {
        await exportToPDF(optimizedResume, userType, options);
      } else {
        await exportToWord(optimizedResume, userType);
      }
      
      setExportStatus({
        type: format,
        status: 'success',
        message: `${format.toUpperCase()} exported successfully!`
      });
      
      setTimeout(() => {
        setExportStatus({ type: null, status: null, message: '' });
      }, 3000);
    } catch (error) {
      console.error(`${format.toUpperCase()} export failed:`, error);
      setExportStatus({
        type: format,
        status: 'error',
        message: `${format.toUpperCase()} export failed. Please try again.`
      });
      
      setTimeout(() => { setExportStatus({ type: null, status: null, message: '' }); }, 5000);
    } finally {
      if (format === 'pdf') {
        setIsExportingPDF(false);
      } else {
        setIsExportingWord(false);
      }
    }
  }, [optimizedResume, userType, isExportingPDF, isExportingWord]);

  if (showMobileInterface && optimizedResume) {
    const mobileSections = [
      {
        id: 'resume',
        title: 'Optimized Resume',
        icon: <FileText className="w-5 h-5" />,
        component: (
          <>
            {optimizedResume ? <ResumePreview resumeData={optimizedResume} userType={userType} /> : null}
            {optimizedResume && (
              <ExportButtons
                resumeData={optimizedResume}
                userType={userType}
                targetRole={targetRole}
                onShowProfile={onShowProfile}
                walletRefreshKey={walletRefreshKey}
              />
            )}
          </>
        ),
        resumeData: optimizedResume
      }
    ];
    return <MobileOptimizedInterface sections={mobileSections} onStartNewResume={handleStartNewResume} />;
  }

  if (isOptimizing || isCalculatingScore || isProcessingMissingSections) {
    let loadingMessage = 'Optimizing Your Resume...';
    let subMessage = 'Please wait while our AI analyzes your resume and job description to generate the best possible match.';
    if (isCalculatingScore) {
      loadingMessage = 'OPTIMIZING RESUME...';
      subMessage = 'Our AI is evaluating your resume based on comprehensive criteria.';
    } else if (isProcessingMissingSections) {
      loadingMessage = 'Processing Your Information...';
      subMessage = "We're updating your resume with the new sections you provided.";
    }
    return <LoadingAnimation message={loadingMessage} submessage={subMessage} />;
  }
  return (
   <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pb-16 dark:from-dark-50 dark:to-dark-200 transition-colors duration-300">
      <div className="container-responsive py-8">
        {!optimizedResume ? (
          <>
            <button
              onClick={() => navigate('/')}
              className="mb-6 bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 text-white hover:from-neon-cyan-400 hover:to-neon-blue-400 active:from-neon-cyan-600 active:to-neon-blue-600 shadow-md hover:shadow-neon-cyan py-3 px-5 rounded-xl inline-flex items-center space-x-2 transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:block">Back to Home</span>
            </button>

            {isAuthenticated && !loadingSubscription && (
              <div className="relative text-center mb-8 z-10">
                <button className="inline-flex items-center space-x-2 px-6 py-3 rounded-full transition-all duration-200 font-semibold text-sm bg-gradient-to-r from-neon-purple-500 to-neon-blue-600 text-white shadow-md hover:shadow-neon-purple focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neon-cyan-500 max-w-[300px] mx-auto justify-center dark:shadow-neon-purple">
                  <span>
                    {userSubscription
                      ? `Optimizations Left: ${userSubscription.optimizationsTotal - userSubscription.optimizationsUsed}`
                      : 'No Active Plan'}
                  </span>
                </button>
              </div>
            )}

            <div className="max-w-7xl mx-auto space-y-6">
              <InputWizard
                extractionResult={extractionResult}
                setExtractionResult={setExtractionResult}
                scoringMode={scoringMode}
                setScoringMode={setScoringMode}
                autoScoreOnUpload={autoScoreOnUpload}
                setAutoScoreOnUpload={setAutoScoreOnUpload}
                jobDescription={jobDescription}
                setJobDescription={setJobDescription}
                targetRole={targetRole}
                setTargetRole={setTargetRole}
                userType={userType}
                setUserType={setUserType}
                handleOptimize={handleOptimize}
                isAuthenticated={isAuthenticated}
                onShowAuth={onShowAuth}
                user={user}
                onShowProfile={onShowProfile}
              />
            </div>
          </>
        ) : (
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="text-center flex flex-col items-center gap-4">
              <button
                onClick={() => setActiveTab('resume')}
                className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl transition-colors font-medium text-sm shadow-lg ${
                  activeTab === 'resume'
                    ? 'bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 text-white shadow-neon-cyan'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-dark-200 dark:text-gray-300 dark:hover:bg-dark-300'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Resume Preview</span>
              </button>

              <button
                onClick={handleStartNewResume}
                className="inline-flex items-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-xl shadow transition-colors dark:bg-dark-300 dark:hover:bg-dark-400"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Create New Resume</span>
              </button>
            </div>

            {optimizedResume && activeTab === 'resume' && (
              <>
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden dark:bg-dark-100 dark:border-dark-300 dark:shadow-dark-xl">
                   <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 border-b border-gray-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                      <FileText className="w-5 h-5 mr-2 text-green-600 dark:text-neon-cyan-400" />
                      Export Resume
                    </h2>
                     <ExportButtons
                    resumeData={optimizedResume}
                      userType={userType}
                     // No need to pass onShowProfile or walletRefreshKey here unless ExportButtons directly uses them for its own UI
                   />
                  </div>
                  <div className="p-6">
                    <ResumeExportSettings
                      resumeData={optimizedResume}
                      userType={userType}
                      onExport={handleExportFile}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {showProjectMismatch && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-orange-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Project Mismatch Detected</h2>
                <p className="text-gray-600">
                  Your current projects don't align well with the job description. Would you like to add a relevant project to improve your resume score?
                </p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600 mb-1">{initialResumeScore?.totalScore}/100</div>
                  <div className="text-sm text-red-700">Current Resume Score</div>
                </div>
              </div>
              <div className="flex space-x-3">
                <button onClick={() => handleProjectMismatchResponse(true)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors">
                  Yes, Add Project
                </button>
                <button onClick={() => handleProjectMismatchResponse(false)} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 font-semibold py-3 px-4 rounded-xl transition-colors">
                  Skip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showProjectOptions && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Choose Project Addition Method</h2>
                <p className="text-gray-600">How would you like to add a relevant project to your resume?</p>
              </div>
              <div className="space-y-3">
                <button onClick={() => handleProjectOptionSelect('manual')} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-4 rounded-xl transition-colors flex items-center justify-center space-x-2">
                  <FileText className="w-5 h-5" />
                  <span>Manual Add - I'll provide project details</span>
                </button>
                <button onClick={() => handleProjectOptionSelect('ai')} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-4 px-4 rounded-xl transition-colors flex items-center justify-center space-x-2">
                  <Sparkles className="w-5 h-5" />
                  <span>AI-Suggested - Generate automatically</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showManualProjectAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Add Project Manually</h2>
                <p className="text-gray-600">Provide project details and AI will generate a professional description</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Project Title *</label>
                  <input
                    type="text"
                    value={manualProject.title}
                    onChange={(e) => setManualProject(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., E-commerce Website"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
                    <input
                      type="month"
                      value={manualProject.startDate}
                      onChange={(e) => setManualProject(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Date *</label>
                    <input
                      type="month"
                      value={manualProject.endDate}
                      onChange={(e) => setManualProject(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tech Stack *</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newTechStack}
                      onChange={(e) => setNewTechStack(e.target.value)}
                      placeholder="e.g., React, Node.js"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      onKeyDown={(e) => e.key === 'Enter' && addTechToStack()}
                    />
                    <button
                      onClick={addTechToStack}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {manualProject.techStack.map((tech, index) => (
                      <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                        {tech}
                        <button onClick={() => removeTechFromStack(tech)} className="ml-2 text-green-600 hover:text-green-800">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">One-liner Description (Optional)</label>
                  <input
                    type="text"
                    value={manualProject.oneLiner}
                    onChange={(e) => setManualProject(prev => ({ ...prev, oneLiner: e.target.value }))}
                    placeholder="Brief description of the project"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={handleManualProjectSubmit}
                  disabled={!manualProject.title || manualProject.techStack.length === 0}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
                >
                  Generate & Add Project
                </button>
                <button onClick={() => setShowManualProjectAdd(false)} className="px-6 py-3 bg-gray-300 hover:bg-gray-400 text-gray-700 font-semibold rounded-xl transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ProjectEnhancement
        isOpen={showProjectEnhancement}
        onClose={() => setShowProjectEnhancement(false)}
        currentResume={parsedResumeData || optimizedResume || { name: '', phone: '', email: '', linkedin: '', github: '', education: [], workExperience: [], projects: [], skills: [], certifications: [] }}
        jobDescription={jobDescription}
        onProjectsAdded={handleProjectsUpdated}
      />

      <ProjectAnalysisModal
        isOpen={showProjectAnalysis}
        onClose={() => setShowProjectAnalysis(false)}
        resumeData={parsedResumeData || optimizedResume || { name: '', phone: '', email: '', linkedin: '', github: '', education: [], workExperience: [], projects: [], skills: [], certifications: [] }}
        jobDescription={jobDescription}
        targetRole={targetRole}
        onProjectsUpdated={handleProjectsUpdated}
      />

      <MissingSectionsModal
        isOpen={showMissingSectionsModal}
        onClose={() => {
          setShowMissingSectionsModal(false);
          setMissingSections([]);
          setPendingResumeData(null);
          setIsOptimizing(false);
        }}
        missingSections={missingSections}
        onSectionsProvided={handleMissingSectionsProvided}
      />
    </div>
  );
};

export default ResumeOptimizer;
