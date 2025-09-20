// src/components/GuidedResumeBuilder.tsx
import React, { useState, useEffect, useCallback } from 'react'; // Import useCallback
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { FileText, AlertCircle, Plus, Sparkles, ArrowLeft, X, ArrowRight, User, Mail, Phone, Linkedin, Github, GraduationCap, Briefcase, Code, Award, Lightbulb, CheckCircle, Trash2, RotateCcw, ChevronDown, ChevronUp, Edit3, Target, Download, Loader2 } from 'lucide-react'; // Added Download, Loader2
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
import { optimizeResume, generateAtsOptimizedSection, generateMultipleAtsVariations } from '../services/geminiService';
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

const GuidedResumeBuilder: React.FC<ResumeOptimizerProps> = ({
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

  // --- NEW: State for sequential UI flow ---
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const resumeSections = [
    'experience_level', // NEW: Experience Level Selection
    'profile', // Contact Info
    'objective_summary', // Career Objective/Summary
    'education',
    'work_experience',
    'projects',
    'skills',
    'certifications',
    'additional_sections',
    'review',
    'final_resume',
  ];
  // --- END NEW ---

  const [extractionResult, setExtractionResult] = useState<ExtractionResult>({ text: '', extraction_mode: 'TEXT', trimmed: false });
  const [jobDescription, setJobDescription] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [userType, setUserType] = useState<UserType>('fresher'); // Default to fresher
  const [scoringMode, setScoringMode] = useState<ScoringMode>('general');
  const [autoScoreOnUpload, setAutoScoreOnUpload] = useState(true);

  const [optimizedResume, setOptimizedResume] = useState<ResumeData | null>({
    name: '', phone: '', email: '', linkedin: '', github: '',
    education: [], workExperience: [], projects: [], skills: [], certifications: [], additionalSections: []
  });
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
  // const [currentStep, setCurrentStep] = useState(0); // This state is now replaced by currentSectionIndex

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

  // NEW STATE: To control visibility of PDF/Word export buttons
  const [showExportOptions, setShowExportOptions] = useState(false);

  const userName = (user as any)?.user_metadata?.name || '';
  const userEmail = user?.email || ''; // Correctly accesses email from user object
  const userPhone = user?.phone || ''; // Correctly accesses phone from user object
  const userLinkedin = user?.linkedin || ''; // Correctly accesses linkedin from user object
  const userGithub = user?.github || ''; // Correctly accesses github from user object

  // --- AI Bullet Generation States ---
  const [showAIBulletOptions, setShowAIBulletOptions] = useState(false);
  const [aiGeneratedBullets, setAIGeneratedBullets] = useState<string[][]>([]);
  const [isGeneratingBullets, setIsGeneratingBullets] = useState(false);
  const [currentBulletGenerationIndex, setCurrentBulletGenerationIndex] = useState<number | null>(null);
  const [currentBulletGenerationSection, setCurrentBulletGenerationSection] = useState<'workExperience' | 'projects' | 'skills' | 'certifications' | 'additionalSections' | null>(null);
  // --- End AI Bullet Generation States ---

  // --- AI Objective/Summary Generation States ---
  const [showAIOptionsModal, setShowAIOptionsModal] = useState(false);
  const [aiGeneratedOptions, setAIGeneratedOptions] = useState<string[]>([]);
  const [isGeneratingOptions, setIsGeneratingOptions] = useState(false);
  // --- End AI Objective/Summary Generation States ---

  // --- Review Section State ---
  const [expandedReviewSections, setExpandedReviewSections] = useState<Set<string>>(new Set());
  // --- End Review Section State ---

  const handleStartNewResume = useCallback(() => { // Memoize
    setOptimizedResume({
      name: '', phone: '', email: '', linkedin: '', github: '',
      education: [], workExperience: [], projects: [], skills: [], certifications: [], additionalSections: []
    });
    setExtractionResult({ text: '', extraction_mode: 'TEXT', trimmed: false });
    setJobDescription('');
    setTargetRole('');
    setUserType('fresher'); // Reset to default
    setBeforeScore(null);
    setAfterScore(null);
    setInitialResumeScore(null);
    setFinalResumeScore(null);
    setParsedResumeData(null);
    setManualProject({ title: '', startDate: '', endDate: '', techStack: [], oneLiner: '' });
    setNewTechStack('');
    setLowScoringProjects([]);
    setChangedSections([]);
    setCurrentSectionIndex(0); // Reset to first section
    setActiveTab('resume');
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

  // useEffect(() => {
  //   if (extractionResult.text.trim().length > 0 && currentStep === 0) {
  //     setCurrentStep(1);
  //   }
  // }, [extractionResult.text, currentStep]);

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
      // MODIFIED: Directly proceed to final optimization, skipping project analysis
      await proceedWithFinalOptimization(resumeData, initialScore, accessToken);
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
    if (!optimizedResume) {
      alert('Resume data is empty. Please fill in the sections.');
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
      const { data: refreshData, error: refreshError } = await supabase.auth.getSession(); // Changed to getSession
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
        // Directly use optimizedResume as the base for final processing
        // MODIFIED: Removed checkForMissingSections and related modal logic
        await continueOptimizationProcess(optimizedResume, session.access_token);

        // After successful optimization, ensure the UI transitions to the final_resume step
        setCurrentSectionIndex(resumeSections.indexOf('final_resume'));

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
    optimizedResume, // Now depends on optimizedResume directly
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
    continueOptimizationProcess,
    resumeSections // Added resumeSections to dependencies
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
    if (!manualProject.title || manualProject.techStack.length === 0 || !optimizedResume) { // Changed parsedResumeData to optimizedResume
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
      const updatedResume = { ...optimizedResume, projects: [...(optimizedResume.projects || []), newProject] }; // Changed parsedResumeData to optimizedResume
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
  }, [manualProject, optimizedResume, generateProjectDescription, jobDescription, initialResumeScore, proceedWithFinalOptimization]); // Changed parsedResumeData to optimizedResume in dependencies

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
    // MODIFIED: Add authentication check
    if (!isAuthenticated) {
      alert('Please sign in to download your resume.');
      onShowAuth(); // Prompt user to sign in
      return; // Stop the function execution
    }

    if (!optimizedResume) return;
    
    // ADDED: Debug logging for export data
    console.log('[ResumeOptimizer] handleExportFile - optimizedResume data being exported:', optimizedResume);
    console.log('[ResumeOptimizer] Contact details in export data:');
    console.log('  - name:', optimizedResume.name);
    console.log('  - - phone:', optimizedResume.phone);
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
        message: 'PDF export failed. Please try again.'
      });
      
      setTimeout(() => { setExportStatus({ type: null, status: null, message: '' }); }, 5000);
    } finally {
      if (format === 'pdf') {
        setIsExportingPDF(false);
      } else {
        setIsExportingWord(false);
      }
    }
  }, [isAuthenticated, onShowAuth, optimizedResume, userType, isExportingPDF, isExportingWord]); // Added isAuthenticated and onShowAuth to dependencies

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
      submessage = "We're updating your resume with the new sections you provided.";
    }
    return <LoadingAnimation message={loadingMessage} submessage={submessage} />;
  }

  // --- NEW: Navigation Handlers ---
  const handleNextSection = () => {
    // Basic validation for the current section before moving next
    let isValid = true;
    if (optimizedResume) {
      switch (resumeSections[currentSectionIndex]) {
        case 'experience_level':
          isValid = !!userType; // Ensure a user type is selected
          break;
        case 'profile':
          isValid = !!optimizedResume.name && !!optimizedResume.email;
          break;
        case 'objective_summary':
          if (userType === 'experienced') {
            isValid = !!optimizedResume.summary && optimizedResume.summary.trim().length > 0;
          } else {
            isValid = !!optimizedResume.careerObjective && optimizedResume.careerObjective.trim().length > 0;
          }
          break;
        case 'education':
          isValid = optimizedResume.education.some(edu => edu.degree.trim() && edu.school.trim() && edu.year.trim());
          break;
        case 'work_experience':
          isValid = optimizedResume.workExperience.some(we => we.role.trim() && we.company.trim() && we.year.trim());
          break;
        case 'projects':
          isValid = optimizedResume.projects.some(p => p.title.trim() && p.bullets.some(b => b.trim()));
          break;
        case 'skills':
          isValid = optimizedResume.skills.some(s => s.category.trim() && s.list.some(item => item.trim()));
          break;
        case 'certifications':
          isValid = optimizedResume.certifications.some(c => (typeof c === 'string' ? c.trim() : c.title?.trim()));
          break;
        case 'additional_sections':
          isValid = true; // Additional sections are optional, so always valid to proceed
          break;
        case 'review':
          isValid = true; // Review section is just a display, always valid
          break;
        case 'final_resume':
          isValid = true; // Final step, always valid
          break;
        default:
          isValid = true; // Assume valid for unimplemented sections
      }
    } else {
      isValid = false; // No resume data, so not valid
    }

    if (isValid && currentSectionIndex < resumeSections.length - 1) {
      setCurrentSectionIndex(prev => prev + 1);
    } else if (!isValid) {
      alert('Please fill in all required fields for the current section before proceeding.');
    }
  };

  const handlePreviousSection = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(prev => prev - 1);
    }
  };

  // --- Education Section Handlers ---
  const handleAddEducation = () => {
    setOptimizedResume(prev => ({
      ...prev!,
      education: [...(prev?.education || []), { degree: '', school: '', year: '' }]
    }));
  };

  const handleUpdateEducation = (index: number, field: keyof ResumeData['education'][0], value: string) => {
    setOptimizedResume(prev => {
      const updatedEducation = [...(prev?.education || [])];
      updatedEducation[index] = { ...updatedEducation[index], [field]: value };
      return { ...prev!, education: updatedEducation };
    });
  };

  const handleRemoveEducation = (index: number) => {
    setOptimizedResume(prev => {
      const updatedEducation = (prev?.education || []).filter((_, i) => i !== index);
      return { ...prev!, education: updatedEducation };
    });
  };
  // --- End Education Section Handlers ---

  // --- Work Experience Section Handlers ---
  const handleAddWorkExperience = () => {
    setOptimizedResume(prev => ({
      ...prev!,
      workExperience: [...(prev?.workExperience || []), { role: '', company: '', year: '', bullets: [''] }]
    }));
  };

  const handleUpdateWorkExperience = (index: number, field: keyof ResumeData['workExperience'][0], value: string) => {
    setOptimizedResume(prev => {
      const updatedWorkExperience = [...(prev?.workExperience || [])];
      updatedWorkExperience[index] = { ...updatedWorkExperience[index], [field]: value };
      return { ...prev!, workExperience: updatedWorkExperience };
    });
  };

  const handleRemoveWorkExperience = (index: number) => {
    setOptimizedResume(prev => {
      const updatedWorkExperience = (prev?.workExperience || []).filter((_, i) => i !== index);
      return { ...prev!, workExperience: updatedWorkExperience };
    });
  };

  const handleAddWorkBullet = (workIndex: number) => {
    setOptimizedResume(prev => {
      const updatedWorkExperience = [...(prev?.workExperience || [])];
      updatedWorkExperience[workIndex].bullets.push('');
      return { ...prev!, workExperience: updatedWorkExperience };
    });
  };

  const handleUpdateWorkBullet = (workIndex: number, bulletIndex: number, value: string) => {
    setOptimizedResume(prev => {
      const updatedWorkExperience = [...(prev?.workExperience || [])];
      updatedWorkExperience[workIndex].bullets[bulletIndex] = value;
      return { ...prev!, workExperience: updatedWorkExperience };
    });
  };

  const handleRemoveWorkBullet = (workIndex: number, bulletIndex: number) => {
    setOptimizedResume(prev => {
      const updatedWorkExperience = [...(prev?.workExperience || [])];
      updatedWorkExperience[workIndex].bullets = updatedWorkExperience[workIndex].bullets.filter((_, i) => i !== bulletIndex);
      return { ...prev!, workExperience: updatedWorkExperience };
    });
  };

  const handleGenerateWorkExperienceBullets = async (workIndex: number) => {
    if (!optimizedResume) return;
    setIsGeneratingBullets(true);
    setCurrentBulletGenerationIndex(workIndex);
    setCurrentBulletGenerationSection('workExperience');
    try {
      const currentWork = optimizedResume.workExperience[workIndex];
      const generated = await generateAtsOptimizedSection(
        'workExperienceBullets',
        {
          role: currentWork.role,
          company: currentWork.company,
          year: currentWork.year,
          description: currentWork.bullets.join(' '),
          userType: userType,
        }
      );
      setAIGeneratedBullets([generated as string[]]); // FIX: Wrap in an array
      setShowAIBulletOptions(true);
    } catch (error) {
      console.error('Error generating bullets:', error);
      alert('Failed to generate bullets. Please try again.');
    } finally {
      setIsGeneratingBullets(false);
    }
  };

  const handleSelectAIBullets = (bullets: string[]) => {
    if (currentBulletGenerationIndex !== null && currentBulletGenerationSection === 'workExperience') {
      setOptimizedResume(prev => {
        const updatedWorkExperience = [...(prev?.workExperience || [])];
        updatedWorkExperience[currentBulletGenerationIndex].bullets = bullets;
        return { ...prev!, workExperience: updatedWorkExperience };
      });
    } else if (currentBulletGenerationIndex !== null && currentBulletGenerationSection === 'projects') {
      setOptimizedResume(prev => {
        const updatedProjects = [...(prev?.projects || [])];
        updatedProjects[currentBulletGenerationIndex].bullets = bullets;
        return { ...prev!, projects: updatedProjects };
      });
    } else if (currentBulletGenerationIndex !== null && currentBulletGenerationSection === 'additionalSections') {
      setOptimizedResume(prev => {
        const updatedAdditionalSections = [...(prev?.additionalSections || [])];
        updatedAdditionalSections[currentBulletGenerationIndex].bullets = bullets;
        return { ...prev!, additionalSections: updatedAdditionalSections };
      });
    } else if (currentBulletGenerationIndex !== null && currentBulletGenerationSection === 'skills') { // NEW: Handle skills
      setOptimizedResume(prev => {
        const updatedSkills = [...(prev?.skills || [])];
        updatedSkills[currentBulletGenerationIndex].list = bullets;
        updatedSkills[currentBulletGenerationIndex].count = bullets.length; // Update count
        return { ...prev!, skills: updatedSkills };
      });
    }
    setShowAIBulletOptions(false);
    setAIGeneratedBullets([]);
    setCurrentBulletGenerationIndex(null);
    setCurrentBulletGenerationSection(null);
  };

  const handleRegenerateAIBullets = async () => {
    if (currentBulletGenerationIndex !== null && optimizedResume) {
      setIsGeneratingBullets(true);
      try {
        let generated: string[] | string[][];
        if (currentBulletGenerationSection === 'workExperience') {
          const currentWork = optimizedResume.workExperience[currentBulletGenerationIndex];
          generated = await generateAtsOptimizedSection(
            'workExperienceBullets',
            {
              role: currentWork.role,
              company: currentWork.company,
              year: currentWork.year,
              description: currentWork.bullets.join(' '),
              userType: userType,
            }
          );
        } else if (currentBulletGenerationSection === 'projects') {
          const currentProject = optimizedResume.projects[currentBulletGenerationIndex];
          generated = await generateAtsOptimizedSection(
            'projectBullets',
            {
              title: currentProject.title,
              description: currentProject.bullets.join(' '),
              userType: userType,
            }
          );
        } else if (currentBulletGenerationSection === 'additionalSections') {
          const currentSection = optimizedResume.additionalSections![currentBulletGenerationIndex];
          generated = await generateAtsOptimizedSection(
            'additionalSectionBullets',
            {
              title: currentSection.title,
              details: currentSection.bullets.join(' '),
              userType: userType,
            }
          );
        } else if (currentBulletGenerationSection === 'certifications') { // ADDED: Certifications regeneration logic
          generated = await generateAtsOptimizedSection(
            'certifications',
            {
              userType: userType,
              jobDescription: jobDescription,
              skills: optimizedResume.skills,
            }
          );
        } else {
          throw new Error("Unknown section for bullet regeneration");
        }
        setAIGeneratedBullets([generated as string[]]);
      } catch (error) {
        console.error('Error regenerating bullets:', error);
        alert('Failed to regenerate bullets. Please try again.');
      } finally {
        setIsGeneratingBullets(false);
      }
    }
  };
  // --- End Work Experience Section Handlers ---

  // --- Projects Section Handlers ---
  const handleAddProject = () => {
    setOptimizedResume(prev => ({
      ...prev!,
      projects: [...(prev?.projects || []), { title: '', bullets: [''] }]
    }));
  };

  const handleUpdateProject = (index: number, field: keyof ResumeData['projects'][0], value: string) => {
    setOptimizedResume(prev => {
      const updatedProjects = [...(prev?.projects || [])];
      updatedProjects[index] = { ...updatedProjects[index], [field]: value };
      return { ...prev!, projects: updatedProjects };
    });
  };

  const handleRemoveProject = (index: number) => {
    setOptimizedResume(prev => {
      const updatedProjects = (prev?.projects || []).filter((_, i) => i !== index);
      return { ...prev!, projects: updatedProjects };
    });
  };

  const handleAddProjectBullet = (projectIndex: number) => {
    setOptimizedResume(prev => {
      const updatedProjects = [...(prev?.projects || [])];
      updatedProjects[projectIndex].bullets.push('');
      return { ...prev!, projects: updatedProjects };
    });
  };

  const handleUpdateProjectBullet = (projectIndex: number, bulletIndex: number, value: string) => {
    setOptimizedResume(prev => {
      const updatedProjects = [...(prev?.projects || [])];
      updatedProjects[projectIndex].bullets[bulletIndex] = value;
      return { ...prev!, projects: updatedProjects };
    });
  };

  const handleRemoveProjectBullet = (projectIndex: number, bulletIndex: number) => {
    setOptimizedResume(prev => {
      const updatedProjects = [...(prev?.projects || [])];
      updatedProjects[projectIndex].bullets = updatedProjects[projectIndex].bullets.filter((_, i) => i !== bulletIndex);
      return { ...prev!, projects: updatedProjects };
    });
  };

  const handleGenerateProjectBullets = async (projectIndex: number) => {
    if (!optimizedResume) return;
    setIsGeneratingBullets(true);
    setCurrentBulletGenerationIndex(projectIndex);
    setCurrentBulletGenerationSection('projects');
    try {
      const currentProject = optimizedResume.projects[projectIndex];
      const generated = await generateAtsOptimizedSection(
        'projectBullets',
        {
          title: currentProject.title,
          description: currentProject.bullets.join(' '),
          userType: userType,
        }
      );
      setAIGeneratedBullets([generated as string[]]);
      setShowAIBulletOptions(true);
    } catch (error) {
      console.error('Error generating project bullets:', error);
      alert('Failed to generate project bullets. Please try again.');
    } finally {
      setIsGeneratingBullets(false);
    }
  };
  // --- End Projects Section Handlers ---

  // --- Skills Section Handlers ---
  const handleAddSkillCategory = () => {
    setOptimizedResume(prev => ({
      ...prev!,
      skills: [...(prev?.skills || []), { category: '', count: 0, list: [''] }]
    }));
  };

  const handleUpdateSkillCategory = (index: number, field: keyof ResumeData['skills'][0], value: string) => {
    setOptimizedResume(prev => {
      const updatedSkills = [...(prev?.skills || [])];
      updatedSkills[index] = { ...updatedSkills[index], [field]: value };
      return { ...prev!, skills: updatedSkills };
    });
  };

  const handleRemoveSkillCategory = (index: number) => {
    setOptimizedResume(prev => {
      const updatedSkills = (prev?.skills || []).filter((_, i) => i !== index);
      return { ...prev!, skills: updatedSkills };
    });
  };

  const handleAddSkill = (categoryIndex: number) => {
    setOptimizedResume(prev => {
      const updatedSkills = [...(prev?.skills || [])];
      updatedSkills[categoryIndex].list.push('');
      updatedSkills[categoryIndex].count = updatedSkills[categoryIndex].list.length;
      return { ...prev!, skills: updatedSkills };
    });
  };

  const handleUpdateSkill = (categoryIndex: number, skillIndex: number, value: string) => {
    setOptimizedResume(prev => {
      const updatedSkills = [...(prev?.skills || [])];
      updatedSkills[categoryIndex].list[skillIndex] = value;
      return { ...prev!, skills: updatedSkills };
    });
  };

  const handleRemoveSkill = (categoryIndex: number, skillIndex: number) => {
    setOptimizedResume(prev => {
      const updatedSkills = [...(prev?.skills || [])];
      updatedSkills[categoryIndex].list = updatedSkills[categoryIndex].list.filter((_, i) => i !== skillIndex);
      updatedSkills[categoryIndex].count = updatedSkills[categoryIndex].list.length;
      return { ...prev!, skills: updatedSkills };
    });
  };

  const handleGenerateSkills = async (categoryIndex: number) => {
    if (!optimizedResume) return;
    setIsGeneratingBullets(true); // Reusing bullet generation loading state
    setCurrentBulletGenerationIndex(categoryIndex);
    setCurrentBulletGenerationSection('skills');
    try {
      const currentCategory = optimizedResume.skills[categoryIndex];
      const generated = await generateAtsOptimizedSection(
        'skillsList',
        {
          category: currentCategory.category,
          existingSkills: currentCategory.list.join(', '),
          userType: userType,
          jobDescription: jobDescription, // Pass JD for relevance
        }
      );
      setAIGeneratedBullets([generated as string[]]); // Expecting string[] of skills
      setShowAIBulletOptions(true);
    } catch (error) {
      console.error('Error generating skills:', error);
      alert('Failed to generate skills. Please try again.');
    } finally {
      setIsGeneratingBullets(false);
    }
  };

  const handleSelectAISkills = (skillsList: string[]) => {
    if (currentBulletGenerationIndex !== null && currentBulletGenerationSection === 'skills') {
      setOptimizedResume(prev => {
        const updatedSkills = [...(prev?.skills || [])];
        updatedSkills[currentBulletGenerationIndex].list = skillsList;
        updatedSkills[currentBulletGenerationIndex].count = skillsList.length; // Update count
        return { ...prev!, skills: updatedSkills };
      });
    }
    setShowAIBulletOptions(false);
    setAIGeneratedBullets([]);
    setCurrentBulletGenerationIndex(null);
    setCurrentBulletGenerationSection(null);
  };
  // --- End Skills Section Handlers ---

  // --- Certifications Section Handlers ---
  const handleAddCertification = () => {
    setOptimizedResume(prev => ({
      ...prev!,
      certifications: [...(prev?.certifications || []), { title: '', description: '' }]
    }));
  };

  const handleUpdateCertification = (index: number, field: keyof ResumeData['certifications'][0], value: string) => {
    setOptimizedResume(prev => {
      const updatedCertifications = [...(prev?.certifications || [])];
      updatedCertifications[index] = { ...updatedCertifications[index], [field]: value };
      return { ...prev!, certifications: updatedCertifications };
    });
  };

  const handleRemoveCertification = (index: number) => {
    setOptimizedResume(prev => {
      const updatedCertifications = (prev?.certifications || []).filter((_, i) => i !== index);
      return { ...prev!, certifications: updatedCertifications };
    });
  };

  const handleGenerateCertifications = async () => {
    if (!optimizedResume) return;
    setIsGeneratingBullets(true);
    setCurrentBulletGenerationIndex(null); // Not tied to a specific entry
    setCurrentBulletGenerationSection('certifications');
    try {
      const generated = await generateAtsOptimizedSection(
        'certifications',
        {
          userType: userType,
          jobDescription: jobDescription,
          skills: optimizedResume.skills,
        }
      );
      // Assuming generated is an array of {title: string, description: string}
      setAIGeneratedBullets([generated as string[]]); // Cast to string[] for display in generic modal
      setShowAIBulletOptions(true);
    } catch (error) {
      console.error('Error generating certifications:', error);
      alert('Failed to generate certifications. Please try again.');
    } finally {
      setIsGeneratingBullets(false);
    }
  };

  const handleSelectAICertifications = (certs: string[]) => {
    setOptimizedResume(prev => ({
      ...prev!,
      certifications: certs.map(c => ({ title: c, description: '' })) // Convert back to structured if needed
    }));
    setShowAIBulletOptions(false);
    setAIGeneratedBullets([]);
    setCurrentBulletGenerationIndex(null);
    setCurrentBulletGenerationSection(null);
  };
  // --- End Certifications Section Handlers ---

  // --- Additional Sections Handlers ---
  const handleAddAdditionalSection = () => {
    setOptimizedResume(prev => ({
      ...prev!,
      additionalSections: [...(prev?.additionalSections || []), { title: '', bullets: [''] }]
    }));
  };

  const handleUpdateAdditionalSection = (index: number, field: keyof ResumeData['additionalSections'][0], value: string) => {
    setOptimizedResume(prev => {
      const updatedSections = [...(prev?.additionalSections || [])];
      updatedSections[index] = { ...updatedSections[index], [field]: value };
      return { ...prev!, additionalSections: updatedSections };
    });
  };

  const handleRemoveAdditionalSection = (index: number) => {
    setOptimizedResume(prev => {
      const updatedSections = (prev?.additionalSections || []).filter((_, i) => i !== index);
      return { ...prev!, additionalSections: updatedSections };
    });
  };

  const handleAddAdditionalBullet = (sectionIndex: number) => {
    setOptimizedResume(prev => {
      const updatedSections = [...(prev?.additionalSections || [])];
      updatedSections[sectionIndex].bullets.push('');
      return { ...prev!, additionalSections: updatedSections };
    });
  };

  const handleUpdateAdditionalBullet = (sectionIndex: number, bulletIndex: number, value: string) => {
    setOptimizedResume(prev => {
      const updatedSections = [...(prev?.additionalSections || [])];
      updatedSections[sectionIndex].bullets[bulletIndex] = value;
      return { ...prev!, additionalSections: updatedSections };
    });
  };

  const handleRemoveAdditionalBullet = (sectionIndex: number, bulletIndex: number) => {
    setOptimizedResume(prev => {
      const updatedSections = [...(prev?.additionalSections || [])];
      updatedSections[sectionIndex].bullets = updatedSections[sectionIndex].bullets.filter((_, i) => i !== bulletIndex);
      return { ...prev!, additionalSections: updatedSections };
    });
  };

  const handleGenerateAdditionalBullets = async (sectionIndex: number) => {
    if (!optimizedResume) return;
    setIsGeneratingBullets(true);
    setCurrentBulletGenerationIndex(sectionIndex);
    setCurrentBulletGenerationSection('additionalSections');
    try {
      const currentSection = optimizedResume.additionalSections![sectionIndex];
      const generated = await generateAtsOptimizedSection(
        'additionalSectionBullets',
        {
          title: currentSection.title,
          details: currentSection.bullets.join(' '),
          userType: userType,
        }
      );
      setAIGeneratedBullets([generated as string[]]);
      setShowAIBulletOptions(true);
    } catch (error) {
      console.error('Error generating additional section bullets:', error);
      alert('Failed to generate additional section bullets. Please try again.');
    } finally {
      setIsGeneratingBullets(false);
    }
  };
  // --- End Additional Sections Handlers ---

  // --- Objective/Summary AI Generation Handlers ---
  const handleGenerateObjectiveSummary = async () => {
    if (!optimizedResume) return;
    setIsGeneratingOptions(true);
    try {
      const sectionType = userType === 'experienced' ? 'summary' : 'careerObjective';
      const generated = await generateMultipleAtsVariations(
        sectionType,
        {
          userType: userType,
          targetRole: targetRole, // Pass target role if available
          experience: optimizedResume.workExperience,
          education: optimizedResume.education,
        },
        undefined, // modelOverride
        3 // Request 3 variations
      );
      setAIGeneratedOptions(generated);
      setShowAIOptionsModal(true);
    } catch (error) {
      console.error('Error generating objective/summary:', error);
      alert('Failed to generate objective/summary. Please try again.');
    } finally {
      setIsGeneratingOptions(false);
    }
  };

  const handleSelectAIOption = (selectedText: string) => {
    setOptimizedResume(prev => ({
      ...prev!,
      [userType === 'experienced' ? 'summary' : 'careerObjective']: selectedText
    }));
    setShowAIOptionsModal(false);
    setAIGeneratedOptions([]);
  };

  const handleRegenerateAIOptions = () => {
    handleGenerateObjectiveSummary(); // Simply call the generation function again
  };
  // --- End Objective/Summary AI Generation Handlers ---

  // --- Review Section State ---
  const toggleReviewSection = (sectionKey: string) => {
    setExpandedReviewSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionKey)) {
        newSet.delete(sectionKey);
      } else {
        newSet.add(sectionKey);
      }
      return newSet;
    });
  };

  const reviewSectionMap: { [key: string]: number } = {
    'profile': 1,
    'objective_summary': 2,
    'education': 3,
    'work_experience': 4,
    'projects': 5,
    'skills': 6,
    'certifications': 7,
    'additional_sections': 8,
  };
  // --- End Review Section State ---

  // --- NEW: Conditional Section Rendering ---
  const renderCurrentSection = () => {
    if (!optimizedResume) {
