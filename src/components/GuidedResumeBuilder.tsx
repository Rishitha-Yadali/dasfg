// src/components/GuidedResumeBuilder.tsx
import React, { useState, useEffect, useCallback } from 'react'; // Import useCallback
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { FileText, AlertCircle, Plus, Sparkles, ArrowLeft, X, ArrowRight, User, Mail, Phone, Linkedin, Github, GraduationCap, Briefcase, Code, Award, Lightbulb, CheckCircle, Trash2, RotateCcw, ChevronDown, ChevronUp, CreditCard as Edit3, Target, Download, Loader2 } from 'lucide-react'; // Added Download, Loader2
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
import { authService } from '../services/authService';
import { ResumeData, UserType, MatchScore, DetailedScore, ExtractionResult, ScoringMode } from '../types/resume';
import { ExportOptions, defaultExportOptions } from '../types/export';
import { exportToPDF, exportToWord } from '../utils/exportUtils';
import { useNavigate } from 'react-router-dom';
import { ExportButtons } from './ExportButtons';
import { ExportOptionsModal } from './ExportOptionsModal'; // Import the new modal component

// src/components/ResumeOptimizer.tsx
const cleanResumeText = (text: string): string => {
  let cleaned = text;
  // Remove "// Line XXX" patterns anywhere in the text
  cleaned = cleaned.replace(/\/\/\s*Line\s*\d+\s*/g, '');
  // Remove "// MODIFIED:" patterns anywhere in the text (e.g., "// MODIFIED: listStyleType to 'none'")
  cleaned = cleaned.replace(/\/\/\s*MODIFIED:\s*.*?(?=\n|$)/g, ''); // Catches the whole comment line
  // Also remove any remaining single-line comments that might have slipped through or were on their own line
  cleaned = cleaned.replace(/\/\/\s*Line\s*\d+\s*/g, ''); // Ensure this is also removed
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
const asText = (v: any): string => {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.filter(Boolean).join(' ');
  if (v && typeof v === 'object' && 'text' in v) return String(v.text ?? '');
  return v == null ? '' : String(v);
};

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
  // NEW STATE: To control visibility of the new ExportOptionsModal
  const [showExportOptionsModal, setShowExportOptionsModal] = useState(false);


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
  // NEW: State for selected bullet option
  const [selectedBulletOptionIndex, setSelectedBulletOptionIndex] = useState<number | null>(null);
  // --- End AI Bullet Generation States ---

  // --- AI Objective/Summary Generation States ---
  const [showAIOptionsModal, setShowAIOptionsModal] = useState(false);
  const [aiGeneratedOptions, setAIGeneratedOptions] = useState<string[]>([]);
  const [isGeneratingOptions, setIsGeneratingOptions] = useState(false);
  // NEW: State for selected AI option (summary/objective)
  const [selectedAIOptionIndex, setSelectedAIOptionIndex] = useState<number | null>(null);
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

        // NEW: Increment user's personal resume count after successful guided build
        if (user) {
          try {
            console.log('GuidedResumeBuilder: Incrementing resume count for user:', user.id);
            await authService.incrementResumesCreatedCount(user.id);
            // ADDED: Increment global resumes created count
            await authService.incrementGlobalResumesCreatedCount();
            console.log('GuidedResumeBuilder: Resume count incremented');
          } catch (countError) {
            console.error('GuidedResumeBuilder: Failed to increment resume counts:', countError);
          }
        }

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
      subMessage = "We're updating your resume with the new sections you provided.";
    }
    return <LoadingAnimation message={loadingMessage} subMessage={subMessage} />;
  }

  // --- NEW: Navigation Handlers ---
const handleNextSection = () => {
  let isValid = true;

  if (optimizedResume) {
    switch (resumeSections[currentSectionIndex]) {
      case 'experience_level':
        isValid = !!userType;
        break;

      case 'profile':
        isValid =
          asText(optimizedResume.name).trim().length > 0 &&
          asText(optimizedResume.email).trim().length > 0;
        break;

      case 'objective_summary': {
        const raw =
          userType === 'experienced'
            ? optimizedResume.summary
            : optimizedResume.careerObjective;
        isValid = asText(raw).trim().length > 0;
        break;
      }

      case 'education':
        isValid = (optimizedResume.education || []).some(
          (edu) =>
            asText(edu.degree).trim().length > 0 &&
            asText(edu.school).trim().length > 0 &&
            asText(edu.year).trim().length > 0
        );
        break;

      case 'work_experience':
        isValid = (optimizedResume.workExperience || []).some(
          (we) =>
            asText(we.role).trim().length > 0 &&
            asText(we.company).trim().length > 0 &&
            asText(we.year).trim().length > 0
        );
        break;

      case 'projects':
        isValid = (optimizedResume.projects || []).some(
          (p) =>
            asText(p.title).trim().length > 0 &&
            (p.bullets || []).some((b) => asText(b).trim().length > 0)
        );
        break;

      case 'skills':
        isValid = (optimizedResume.skills || []).some(
          (s) =>
            asText(s.category).trim().length > 0 &&
            (s.list || []).some((item) => asText(item).trim().length > 0)
        );
        break;

      case 'certifications':
        isValid = (optimizedResume.certifications || []).some((c: any) =>
          typeof c === 'string'
            ? asText(c).trim().length > 0
            : asText(c?.title).trim().length > 0
        );
        break;

      case 'additional_sections':
      case 'review':
      case 'final_resume':
      default:
        isValid = true;
    }
  } else {
    isValid = false;
  }

  if (isValid && currentSectionIndex < resumeSections.length - 1) {
    setCurrentSectionIndex((prev) => prev + 1);
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
      workExperience: [...(prev?.workExperience || []), { role: '', company: '', year: '', bullets: [] }] // Changed bullets: [''] to bullets: []
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

 const handleGenerateWorkExperienceBullets = async (
  workIndex: number,
  bulletIndex?: number,
  seedText?: string
) => {
  if (!optimizedResume) return;
  setIsGeneratingBullets(true);

  const bullets = optimizedResume.workExperience?.[workIndex]?.bullets || [];

  // choose target bullet:
  // 1) explicit param
  // 2) previously selected (focus)
  // 3) first empty bullet
  // 4) second bullet if exists, else first
  let targetBulletIndex =
    typeof bulletIndex === 'number'
      ? bulletIndex
      : (typeof selectedBulletOptionIndex === 'number'
          ? selectedBulletOptionIndex
          : bullets.findIndex(b => !b || !b.trim()));

  if (targetBulletIndex == null || targetBulletIndex < 0) {
    targetBulletIndex = bullets.length > 1 ? 1 : 0;
  }

  setCurrentBulletGenerationIndex(workIndex);
  setCurrentBulletGenerationSection('workExperience');
  setSelectedBulletOptionIndex(targetBulletIndex);

  try {
    const currentWork = optimizedResume.workExperience[workIndex];
    const seed =
      (typeof seedText === 'string' ? seedText : undefined) ??
      (bullets[targetBulletIndex] ?? '') ??
      '';

    const generated = await generateMultipleAtsVariations(
      'workExperienceBullets',
      {
        role: currentWork.role,
        company: currentWork.company,
        year: currentWork.year,
        description: seed,
        userType,
      },
      undefined,
      3
    );
    setAIGeneratedBullets(generated as string[][]);
    setShowAIBulletOptions(true);
  } catch (e) {
    console.error(e);
  } finally {
    setIsGeneratingBullets(false);
  }
};

  // src/components/GuidedResumeBuilder.tsx

const handleSelectAIGeneratedOption = (selectedOption: string[]) => {
  // Only these sections need a bullet index
  const needsBulletIndex =
    currentBulletGenerationSection === "workExperience" ||
    currentBulletGenerationSection === "projects" ||
    currentBulletGenerationSection === "additionalSections";

  if (
    !optimizedResume ||
    currentBulletGenerationIndex === null ||
    currentBulletGenerationSection === null ||
    (needsBulletIndex && selectedBulletOptionIndex === null)
  ) {
    console.error("Cannot select AI option: Missing resume data or generation context.");
    return;
  }

  // Normalize AI response to plain string
  const normalizeBullet = (bullet: any): string =>
    typeof bullet === "string" ? bullet : bullet?.description || String(bullet || "");

  setOptimizedResume((prev) => {
    const newResume = { ...prev! };

    // replace-only (no append)
    const replaceBullet = (
      currentBullets: (string | { description: string })[] | undefined,
      bulletIndex: number,
      newContent: string
    ): string[] => {
      const bullets = (currentBullets || []).map((b) =>
        typeof b === "string" ? b : b?.description || ""
      );
      if (bulletIndex >= 0 && bulletIndex < bullets.length) {
        bullets[bulletIndex] = newContent;
      }
      return bullets;
    };

    switch (currentBulletGenerationSection) {
      case "workExperience": {
        const newWorkExperience = [...(newResume.workExperience || [])];
        const currentEntry = newWorkExperience[currentBulletGenerationIndex];
        currentEntry.bullets = replaceBullet(
          currentEntry.bullets,
          selectedBulletOptionIndex!, // safe due to guard
          normalizeBullet(selectedOption[0])
        );
        newResume.workExperience = newWorkExperience;
        break;
      }
      case "projects": {
        const newProjects = [...(newResume.projects || [])];
        const currentEntry = newProjects[currentBulletGenerationIndex];
        currentEntry.bullets = replaceBullet(
          currentEntry.bullets,
          selectedBulletOptionIndex!, // safe due to guard
          normalizeBullet(selectedOption[0])
        );
        newResume.projects = newProjects;
        break;
      }
      case "additionalSections": {
        const newAdditionalSections = [...(newResume.additionalSections || [])];
        const currentEntry = newAdditionalSections[currentBulletGenerationIndex];
        currentEntry.bullets = replaceBullet(
          currentEntry.bullets,
          selectedBulletOptionIndex!, // safe due to guard
          normalizeBullet(selectedOption[0])
        );
        newResume.additionalSections = newAdditionalSections;
        break;
      }
     case "skills": {
  const newSkills = [...(newResume.skills || [])];
  const currentEntry = newSkills[currentBulletGenerationIndex];

  // selectedOption may be an array of skills OR a single comma-separated string
  const normalizedList = Array.isArray(selectedOption)
    ? selectedOption.map((s) => normalizeBullet(s))
    : String(selectedOption || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

  currentEntry.list = normalizedList;
  currentEntry.count = normalizedList.length;
  newResume.skills = newSkills;
  break;
}
      case "certifications": {
        const newCertifications = (newResume.certifications || []).map((cert, idx) => {
          if (idx !== currentBulletGenerationIndex) return cert;
          const title = normalizeBullet(selectedOption[0]);
          // handle both string and object shapes
          return typeof cert === "string" ? title : { ...cert, title };
        });
        newResume.certifications = newCertifications;
        break;
      }
      default:
        console.error("Unhandled section for AI bullet selection:", currentBulletGenerationSection);
        return newResume;
    }

    return newResume;
  });

  // Reset AI state after applying
  setShowAIBulletOptions(false);
  setAIGeneratedBullets([]);
  setCurrentBulletGenerationIndex(null);
  setCurrentBulletGenerationSection(null);
  setSelectedAIOptionIndex(null);     // ensure both get cleared
  setSelectedBulletOptionIndex(null);
};



  const handleRegenerateAIBullets = async () => {
    if (currentBulletGenerationIndex !== null && optimizedResume) {
      setIsGeneratingBullets(true);
      setSelectedBulletOptionIndex(null); // Clear selection on regenerate
      try {
        let generated: string[][] | string[]; // Can be string[][] for multiple variations or string[] for single
        if (currentBulletGenerationSection === 'workExperience') {
          const currentWork = optimizedResume.workExperience[currentBulletGenerationIndex];
          generated = await generateMultipleAtsVariations( // Changed to generateMultipleAtsVariations
            'workExperienceBullets',
            {
              role: currentWork.role,
              company: currentWork.company,
              year: currentWork.year,
              description: currentWork.bullets.join(' '), // Pass existing bullets as description
              userType: userType,
            },
            undefined, // modelOverride
            3 // Request 3 variations
          );
        } else if (currentBulletGenerationSection === 'projects') {
          const currentProject = optimizedResume.projects[currentBulletGenerationIndex];
          generated = await generateMultipleAtsVariations( // Changed to generateMultipleAtsVariations
            'projectBullets',
            {
              title: currentProject.title,
              description: currentProject.bullets.join(' '), // Pass existing bullets as description
              userType: userType,
            },
            undefined, // modelOverride
            3 // Request 3 variations
          );
        } else if (currentBulletGenerationSection === 'additionalSections') {
          const currentSection = optimizedResume.additionalSections![currentBulletGenerationIndex];
          generated = await generateMultipleAtsVariations( // Changed to generateMultipleAtsVariations
            'additionalSectionBullets',
            {
              title: currentSection.title,
              details: currentSection.bullets.join(' '), // Pass existing bullets as details
              userType: userType,
            },
            undefined, // modelOverride
            3 // Request 3 variations
          );
        } else if (currentBulletGenerationSection === 'certifications') { // ADDED: Certifications regeneration logic
          const currentCert = optimizedResume.certifications[currentBulletGenerationIndex];
          generated = await generateMultipleAtsVariations( // Changed to generateMultipleAtsVariations
            'certifications',
            {
              userType: userType,
              jobDescription: jobDescription,
              skills: optimizedResume.skills,
              currentCertTitle: currentCert.title,
              currentCertDescription: currentCert.description
            },
            undefined, // modelOverride
            3 // Request 3 variations
          );
        } else if (currentBulletGenerationSection === 'skills') { // ADDED: Skills regeneration logic
          const currentCategory = optimizedResume.skills[currentBulletGenerationIndex];
          generated = await generateMultipleAtsVariations( // Changed to generateMultipleAtsVariations
            'skillsList',
            {
              category: currentCategory.category,
              existingSkills: currentCategory.list.join(', '), // Pass existing skills as existingSkills
              userType: userType,
              jobDescription: jobDescription, // Pass JD for relevance
            },
            undefined, // modelOverride
            3 // Request 3 variations
          );
        }
        setAIGeneratedBullets(generated as string[][]); // Pass directly, it's already string[][]
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
      projects: [...(prev?.projects || []), { title: '', bullets: [] }] // Changed bullets: [''] to bullets: []
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

const handleGenerateProjectBullets = async (
  projectIndex: number,
  bulletIndex?: number,
  seedText?: string
) => {
  if (!optimizedResume) return;
  setIsGeneratingBullets(true);

  const bullets = optimizedResume.projects?.[projectIndex]?.bullets || [];

  // choose target bullet:
  // 1) explicit param
  // 2) previously selected (focus)
  // 3) first empty bullet
  // 4) second bullet if exists, else first
  let targetBulletIndex =
    typeof bulletIndex === 'number'
      ? bulletIndex
      : (typeof selectedBulletOptionIndex === 'number'
          ? selectedBulletOptionIndex
          : bullets.findIndex(b => !b || !b.trim()));

  if (targetBulletIndex == null || targetBulletIndex < 0) {
    targetBulletIndex = bullets.length > 1 ? 1 : 0;
  }

  setCurrentBulletGenerationIndex(projectIndex);
  setCurrentBulletGenerationSection('projects');
  setSelectedBulletOptionIndex(targetBulletIndex);

  try {
    const currentProject = optimizedResume.projects[projectIndex];
    const seed =
      (typeof seedText === 'string' ? seedText : undefined) ??
      (bullets[targetBulletIndex] ?? '') ??
      '';

    const generated = await generateMultipleAtsVariations(
      'projectBullets',
      {
        title: currentProject.title,
        description: seed, // use targeted seed
        userType,
      },
      undefined,
      3
    );

    setAIGeneratedBullets(generated as string[][]);
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
      skills: [...(prev?.skills || []), { category: '', count: 0, list: [] }]
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
      const generated = await generateMultipleAtsVariations( // Changed to generateMultipleAtsVariations
        'skillsList',
        {
          category: currentCategory.category,
          existingSkills: currentCategory.list.join(', '), // Pass existing skills as existingSkills
          userType: userType,
          jobDescription: jobDescription, // Pass JD for relevance
        },
        undefined, // modelOverride
        3 // Request 3 variations
      );
      setAIGeneratedBullets(generated as string[][]); // Pass directly, it's already string[][]
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
    setSelectedBulletOptionIndex(null); // Reset selection
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

  const handleGenerateCertifications = async (index: number) => { // Pass index to know which cert to update
    if (!optimizedResume) return;
    setIsGeneratingBullets(true);
    setCurrentBulletGenerationIndex(index); // Store the index
    setCurrentBulletGenerationSection('certifications');

    const currentCert = optimizedResume.certifications[index]; // Get current cert data

    // --- NEW: Context check and warning ---
    const hasJobDescription = jobDescription.trim().length > 0;
    const hasSkills = optimizedResume.skills && optimizedResume.skills.length > 0 && optimizedResume.skills.some(s => s.list && s.list.length > 0);

    if (!hasJobDescription && !hasSkills) {
      alert('Warning: No job description or skills provided. AI-generated certifications might be very generic. Please fill in more details for better results.');
    }
    // --- END NEW ---

    try {
      console.log('Generating certifications with context:', {
        userType: userType,
        jobDescription: jobDescription,
        skills: optimizedResume.skills,
        currentCertTitle: currentCert.title, // Pass current title
        currentCertDescription: currentCert.description
      });
      const generated = await generateMultipleAtsVariations( // Changed to generateMultipleAtsVariations
        'certifications',
        {
          userType: userType,
          jobDescription: jobDescription,
          skills: optimizedResume.skills,
          currentCertTitle: currentCert.title,
          currentCertDescription: currentCert.description
        },
        undefined, // modelOverride
        3 // Request 3 variations
      );
      setAIGeneratedBullets(generated as string[][]); // Pass directly, it's already string[][]
      setShowAIBulletOptions(true);
    } catch (error) {
      console.error('Error generating certifications:', error);
      alert('Failed to generate certifications. Please try again.');
    } finally {
      setIsGeneratingBullets(false);
    }
  };

  const handleSelectAICertifications = (certs: string[]) => {
    if (currentBulletGenerationIndex !== null && currentBulletGenerationSection === 'certifications') {
      setOptimizedResume(prev => {
        const updatedCertifications = [...(prev?.certifications || [])];
        updatedCertifications[currentBulletGenerationIndex] = { title: certs[0], description: '' }; // Assuming first option is the selected one
        return { ...prev!, certifications: updatedCertifications };
      });
    }
    setShowAIBulletOptions(false);
    setAIGeneratedBullets([]);
    setCurrentBulletGenerationIndex(null);
    setCurrentBulletGenerationSection(null);
    setSelectedBulletOptionIndex(null); // Reset selection
  };
  // --- End Certifications Section Handlers ---

  // --- Additional Sections Handlers ---
  const handleAddAdditionalSection = () => {
    setOptimizedResume(prev => ({
      ...prev!,
      additionalSections: [...(prev?.additionalSections || []), { title: '', bullets: [] }] // Changed bullets: [''] to bullets: []
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
  console.count(`[AdditionalSections] handleAddAdditionalBullet called for index ${sectionIndex}`); // <-- Check for this line
  setOptimizedResume(prev => {
    const currentAdditionalSections = prev?.additionalSections ? [...prev.additionalSections] : [];
    const currentBullets = currentAdditionalSections[sectionIndex]?.bullets ? [...currentAdditionalSections[sectionIndex].bullets] : [];
    
    console.log(`[AdditionalSections] Before push:`, currentBullets); // <-- Check for this line
    
    // Only add a new empty bullet if the last one is not empty, or if there are no bullets yet
    if (currentBullets.length === 0 || currentBullets[currentBullets.length - 1].trim() !== '') {
      const newBullets = [...currentBullets, '']; // Immutable add
      currentAdditionalSections[sectionIndex] = { // Immutable update of the section object
        ...currentAdditionalSections[sectionIndex],
        bullets: newBullets
      };
    }
    
    console.log(`[AdditionalSections] After push:`, currentAdditionalSections[sectionIndex].bullets); // <-- Check for this line
    return { ...prev!, additionalSections: currentAdditionalSections }; // Immutable update of the top-level array
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

  const bullets = optimizedResume.additionalSections?.[sectionIndex]?.bullets || [];

  // choose target bullet:
  // 1) previously selected (focus)
  // 2) first empty bullet
  // 3) second bullet if exists, else first
  let targetBulletIndex =
    typeof selectedBulletOptionIndex === 'number'
      ? selectedBulletOptionIndex
      : bullets.findIndex(b => !b || !b.trim());

  if (targetBulletIndex == null || targetBulletIndex < 0) {
    targetBulletIndex = bullets.length > 1 ? 1 : 0;
  }

  setCurrentBulletGenerationIndex(sectionIndex);
  setCurrentBulletGenerationSection('additionalSections');
  setSelectedBulletOptionIndex(targetBulletIndex);

  try {
    const currentSection = optimizedResume.additionalSections![sectionIndex];
    const seed = (bullets[targetBulletIndex] ?? '') ?? '';

    const generated = await generateMultipleAtsVariations(
      'additionalSectionBullets',
      {
        title: currentSection.title,
        details: seed, // seed with the targeted bullet
        userType,
      },
      undefined,
      3
    );

    setAIGeneratedBullets(generated as string[][]);
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
    setSelectedAIOptionIndex(null); // Clear selection on regenerate
    try {
      const sectionType = userType === 'experienced' ? 'summary' : 'careerObjective';
      const currentDraft = userType === 'experienced' ? optimizedResume.summary : optimizedResume.careerObjective;
      const generated = await generateMultipleAtsVariations(
        sectionType,
        {
          userType: userType,
          targetRole: targetRole, // Pass target role if available
          experience: optimizedResume.workExperience,
          education: optimizedResume.education,
        },
        undefined, // modelOverride
        3, // Request 3 variations
        currentDraft || '' // Pass current draft text
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
    setSelectedAIOptionIndex(null); // Reset selection
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
      return <div className="card p-6 mb-6 shadow-lg">Loading resume data...</div>;
    }

    switch (resumeSections[currentSectionIndex]) {
      case 'experience_level':
        return (
          <div className="card p-6 mb-6 shadow-lg">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
              <Briefcase className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
              Experience Level
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Select your current career stage. This helps tailor the resume content.
            </p>
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
              {/* Add Student option if needed */}
              <button
                onClick={() => setUserType('student')}
                className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all cursor-pointer ${
                  userType === 'student'
                    ? 'border-green-500 bg-green-50 shadow-md dark:border-green-600 dark:bg-green-900/20'
                    : 'border-gray-200 hover:border-green-300 hover:bg-green-50 dark:border-dark-200 dark:hover:border-green-900 dark:hover:bg-green-900/10'
                }`}
              >
                <GraduationCap className={`w-8 h-8 mb-3 ${userType === 'student' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-300'}`} />
                <span className={`font-semibold text-lg mb-2 ${userType === 'student' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'}`}>Student</span>
                <span className={`text-sm text-gray-500 text-center dark:text-gray-300`}>Currently enrolled in a program</span>
              </button>
            </div>
          </div>
        );
      case 'profile':
        return (
          <div className="card p-6 mb-6 shadow-lg">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
              <User className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              Contact Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Full Name *</label>
                <input
                  type="text"
                  name="name"
                  value={optimizedResume?.name || ''}
                  onChange={(e) => setOptimizedResume(prev => ({ ...prev!, name: e.target.value }))}
                  placeholder="Your Full Name"
                  className="input-base"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={optimizedResume?.email || ''}
                  onChange={(e) => setOptimizedResume(prev => ({ ...prev!, email: e.target.value }))}
                  placeholder="your.email@example.com"
                  className="input-base"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Phone (Optional)</label>
                <input
                  type="tel"
                  name="phone"
                  value={optimizedResume?.phone || ''}
                  onChange={(e) => setOptimizedResume(prev => ({ ...prev!, phone: e.target.value }))}
                  placeholder="+1 (123) 456-7890"
                  className="input-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">LinkedIn Profile URL (Optional)</label>
                <input
                  type="url"
                  name="linkedin"
                  value={optimizedResume?.linkedin || ''}
                  onChange={(e) => {
                    let value = e.target.value;
                    if (value && !value.startsWith('http://') && !value.startsWith('https://')) {
                      value = 'https://' + value;
                    }
                    setOptimizedResume(prev => ({ ...prev!, linkedin: value }));
                  }}
                  placeholder="https://linkedin.com/in/yourprofile"
                  className="input-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">GitHub Profile URL (Optional)</label>
                <input
                  type="url"
                  name="github"
                  value={optimizedResume?.github || ''}
                  onChange={(e) => {
                    let value = e.target.value;
                    if (value && !value.startsWith('http://') && !value.startsWith('https://')) {
                      value = 'https://' + value;
                    }
                    setOptimizedResume(prev => ({ ...prev!, github: value }));
                  }}
                  placeholder="https://github.com/yourusername"
                  className="input-base"
                />
              </div>
            </div>
          </div>
        );
      case 'objective_summary':
        return (
          <div className="card p-6 mb-6 shadow-lg">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
              <FileText className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
              {userType === 'experienced' ? 'Professional Summary' : 'Career Objective'}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              {userType === 'experienced'
                ? 'Craft a compelling 2-3 sentence summary highlighting your experience and value.'
                : 'Write a concise 2-sentence objective focusing on your career goals and skills.'}
            </p>
            <textarea
              name={userType === 'experienced' ? 'summary' : 'careerObjective'}
              value={userType === 'experienced' ? (optimizedResume?.summary || '') : (optimizedResume?.careerObjective || '')}
              onChange={(e) => setOptimizedResume(prev => ({ ...prev!, [e.target.name]: e.target.value }))}
              placeholder={
                userType === 'experienced'
                  ? 'e.g., Highly motivated Software Engineer with 5+ years of experience in developing scalable web applications. Proven ability to lead cross-functional teams and deliver high-quality software solutions.'
                  : 'e.g., Enthusiastic Computer Science student seeking an entry-level software development role. Eager to apply strong programming skills and problem-solving abilities to contribute to innovative projects.'
              }
              className="w-full h-32 p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none transition-all duration-200 bg-gray-50 focus:bg-white text-sm dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100 dark:focus:bg-dark-100"
              required
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleGenerateObjectiveSummary}
                className="btn-secondary flex items-center space-x-2"
                disabled={isGeneratingOptions}
              >
                {isGeneratingOptions ? (
                  <RotateCcw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>{isGeneratingOptions ? 'Generating...' : 'Generate with AI'}</span>
              </button>
            </div>
          </div>
        );
      case 'education':
        return (
          <div className="card p-6 mb-6 shadow-lg">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
              <GraduationCap className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
              Education
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Add your educational background.
            </p>
            {(optimizedResume.education || []).map((edu, index) => (
              <div key={index} className="space-y-4 border border-gray-200 p-4 rounded-lg mb-4 dark:border-dark-300">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Education Entry #{index + 1}</h3>
                  <button
                    onClick={() => handleRemoveEducation(index)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Degree *</label>
                  <input
                    type="text"
                    value={edu.degree}
                    onChange={(e) => handleUpdateEducation(index, 'degree', e.target.value)}
                    placeholder="e.g., Bachelor of Technology"
                    className="input-base"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">School/University *</label>
                  <input
                    type="text"
                    value={edu.school}
                    onChange={(e) => handleUpdateEducation(index, 'school', e.target.value)}
                    placeholder="e.g., University of Example"
                    className="input-base"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Year *</label>
                  <input
                    type="text"
                    value={edu.year}
                    onChange={(e) => handleUpdateEducation(index, 'year', e.target.value)}
                    placeholder="e.g., 2020-2024"
                    className="input-base"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">CGPA/GPA (Optional)</label>
                  <input
                    type="text"
                    value={edu.cgpa || ''}
                    onChange={(e) => handleUpdateEducation(index, 'cgpa', e.target.value)}
                    placeholder="e.g., 8.5/10 or 3.8/4.0"
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Location (Optional)</label>
                  <input
                    type="text"
                    value={edu.location || ''}
                    onChange={(e) => handleUpdateEducation(index, 'location', e.target.value)}
                    placeholder="e.g., City, State"
                    className="input-base"
                  />
                </div>
              </div>
            ))}
            <button onClick={handleAddEducation} className="btn-secondary flex items-center space-x-2">
              <Plus className="w-5 h-5" />
              <span>Add Education Entry</span>
            </button>
          </div>
        );
      case 'work_experience':
        return (
          <div className="card p-6 mb-6 shadow-lg">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
              <Briefcase className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              Work Experience
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Add your professional work experience, internships, or significant projects.
            </p>
            {(optimizedResume.workExperience || []).map((work, workIndex) => (
              <div key={workIndex} className="space-y-4 border border-gray-200 p-4 rounded-lg mb-4 dark:border-dark-300">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Work Experience Entry #{workIndex + 1}</h3>
                  <button
                    onClick={() => handleRemoveWorkExperience(workIndex)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Role *</label>
                  <input
                    type="text"
                    value={work.role}
                    onChange={(e) => handleUpdateWorkExperience(workIndex, 'role', e.target.value)}
                    placeholder="e.g., Software Engineer"
                    className="input-base"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Company *</label>
                  <input
                    type="text"
                    value={work.company}
                    onChange={(e) => handleUpdateWorkExperience(workIndex, 'company', e.target.value)}
                    placeholder="e.g., TechCorp Inc."
                    className="input-base"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Year/Duration *</label>
                  <input
                    type="text"
                    value={work.year}
                    onChange={(e) => handleUpdateWorkExperience(workIndex, 'year', e.target.value)}
                    placeholder="e.g., Jan 2023 - Present"
                    className="input-base"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Description</label>
                  {(work.bullets || []).map((bullet, bulletIndex) => (
                    <div key={bulletIndex} className="mb-2">
                      <div className="flex items-center space-x-2">
                        <textarea
                          value={bullet}
                          onChange={(e) => handleUpdateWorkBullet(workIndex, bulletIndex, e.target.value)}
                          onFocus={() => {
                            setCurrentBulletGenerationSection('workExperience');
                            setCurrentBulletGenerationIndex(workIndex);
                            setSelectedBulletOptionIndex(bulletIndex);
                          }}
                          onClick={() => {
                            setCurrentBulletGenerationSection('workExperience');
                            setCurrentBulletGenerationIndex(workIndex);
                            setSelectedBulletOptionIndex(bulletIndex);
                          }}
                          placeholder="Describe your achievement or responsibility"
                          className="input-base flex-grow resize-y"
                          rows={2}
                        />
                        <button
                          onClick={() => handleRemoveWorkBullet(workIndex, bulletIndex)}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                      {bullet.trim().length > 0 && (
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={() => handleGenerateWorkExperienceBullets(workIndex, bulletIndex)}
                            className="btn-secondary flex items-center space-x-2 text-sm"
                            disabled={isGeneratingBullets && currentBulletGenerationIndex === workIndex && selectedBulletOptionIndex === bulletIndex}
                          >
                            {isGeneratingBullets && currentBulletGenerationIndex === workIndex && selectedBulletOptionIndex === bulletIndex ? (
                              <RotateCcw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Sparkles className="w-4 h-4" />
                            )}
                            <span>{isGeneratingBullets && currentBulletGenerationIndex === workIndex && selectedBulletOptionIndex === bulletIndex ? 'Generating...' : 'Generate with AI'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  <button onClick={() => handleAddWorkBullet(workIndex)} className="btn-secondary flex items-center space-x-2">
                    <Plus className="w-5 h-5" />
                    <span>Add Description</span>
                  </button>
                </div>
              </div>
            ))}
            <button onClick={handleAddWorkExperience} className="btn-secondary flex items-center space-x-2">
              <Plus className="w-5 h-5" />
              <span>Add Work Experience</span>
            </button>
          </div>
        );
      case 'projects':
        return (
          <div className="card p-6 mb-6 shadow-lg">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
              <Code className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              Projects
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Showcase your personal or academic projects.
            </p>
            {(optimizedResume.projects || []).map((project, projectIndex) => (
              <div key={projectIndex} className="space-y-4 border border-gray-200 p-4 rounded-lg mb-4 dark:border-dark-300">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Project #{projectIndex + 1}</h3>
                  <button
                    onClick={() => handleRemoveProject(projectIndex)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Project Title *</label>
                  <input
                    type="text"
                    value={project.title}
                    onChange={(e) => handleUpdateProject(projectIndex, 'title', e.target.value)}
                    placeholder="e.g., E-commerce Platform"
                    className="input-base"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Description</label>
                  {(project.bullets || []).map((bullet, bulletIndex) => (
                    <div key={bulletIndex} className="mb-2">
                      <div className="flex items-center space-x-2">
                        <textarea
                          value={bullet}
                          onChange={(e) => handleUpdateProjectBullet(projectIndex, bulletIndex, e.target.value)}
                          onFocus={() => {
                            setCurrentBulletGenerationSection('projects');
                            setCurrentBulletGenerationIndex(projectIndex);
                            setSelectedBulletOptionIndex(bulletIndex);
                          }}
                          onClick={() => {
                            setCurrentBulletGenerationSection('projects');
                            setCurrentBulletGenerationIndex(projectIndex);
                            setSelectedBulletOptionIndex(bulletIndex);
                          }}
                          placeholder="Describe your project's features or impact"
                          className="input-base flex-grow resize-y"
                          rows={2}
                        />
                        <button
                          onClick={() => handleRemoveProjectBullet(projectIndex, bulletIndex)}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                      {bullet.trim().length > 0 && (
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={() => handleGenerateProjectBullets(projectIndex, bulletIndex)}
                            className="btn-secondary flex items-center space-x-2 text-sm"
                            disabled={isGeneratingBullets && currentBulletGenerationIndex === projectIndex && selectedBulletOptionIndex === bulletIndex}
                          >
                            {isGeneratingBullets && currentBulletGenerationIndex === projectIndex && selectedBulletOptionIndex === bulletIndex ? (
                              <RotateCcw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Sparkles className="w-4 h-4" />
                            )}
                            <span>{isGeneratingBullets && currentBulletGenerationIndex === projectIndex && selectedBulletOptionIndex === bulletIndex ? 'Generating...' : 'Generate with AI'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  <button onClick={() => handleAddProjectBullet(projectIndex)} className="btn-secondary flex items-center space-x-2">
                    <Plus className="w-5 h-5" />
                    <span>Add Description</span>
                  </button>
                </div>
              </div>
            ))}
            <button onClick={handleAddProject} className="btn-secondary flex items-center space-x-2">
              <Plus className="w-5 h-5" />
              <span>Add Project</span>
            </button>
          </div>
        );
      case 'skills':
        return (
          <div className="card p-6 mb-6 shadow-lg">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
              <Lightbulb className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              Skills
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              List your technical and soft skills, categorized for clarity.
            </p>
            {(optimizedResume.skills || []).map((skillCategory, categoryIndex) => (
              <div key={categoryIndex} className="space-y-4 border border-gray-200 p-4 rounded-lg mb-4 dark:border-dark-300">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Category #{categoryIndex + 1}</h3>
                  <button
                    onClick={() => handleRemoveSkillCategory(categoryIndex)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Category Name *</label>
                  <input
                    type="text"
                    value={skillCategory.category}
                    onChange={(e) => handleUpdateSkillCategory(categoryIndex, 'category', e.target.value)}
                    placeholder="e.g., Programming Languages, Frameworks"
                    className="input-base"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Skills (comma-separated)</label>
                  {(skillCategory.list || []).map((skill, skillIndex) => (
                    <div key={skillIndex} className="flex items-center space-x-2 mb-2">
                      <textarea
                        value={skill}
                        onChange={(e) => handleUpdateSkill(categoryIndex, skillIndex, e.target.value)}
                        placeholder="e.g., JavaScript, Python"
                        className="input-base flex-grow resize-y"
                        rows={2}
                      />
                      <button
                        onClick={() => handleRemoveSkill(categoryIndex, skillIndex)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  <div className="flex space-x-2">
                    <button onClick={() => handleAddSkill(categoryIndex)} className="btn-secondary flex items-center space-x-2">
                      <Plus className="w-5 h-5" />
                      <span>Add Skill</span>
                    </button>
                    <button
                      onClick={() => handleGenerateSkills(categoryIndex)}
                      className="btn-primary flex items-center space-x-2"
                      disabled={isGeneratingBullets}
                    >
                      {isGeneratingBullets && currentBulletGenerationIndex === categoryIndex && currentBulletGenerationSection === 'skills' ? (
                        <RotateCcw className="w-5 h-5 animate-spin" />
                      ) : (
                        <Sparkles className="w-5 h-5" />
                      )}
                      <span>{isGeneratingBullets && currentBulletGenerationIndex === categoryIndex && currentBulletGenerationSection === 'skills' ? 'Generating...' : 'Generate with AI'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={handleAddSkillCategory} className="btn-secondary flex items-center space-x-2">
              <Plus className="w-5 h-5" />
              <span>Add Skill Category</span>
            </button>
          </div>
        );
      case 'certifications':
        return (
          <div className="card p-6 mb-6 shadow-lg">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
              <Award className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              Certifications
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              List any relevant certifications or licenses you hold.
            </p>
            {(optimizedResume.certifications || []).map((cert, index) => (
              <div key={index} className="space-y-4 border border-gray-200 p-4 rounded-lg mb-4 dark:border-dark-300">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Certification #{index + 1}</h3>
                  <button
                    onClick={() => handleRemoveCertification(index)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Title *</label>
                  <input
                    type="text"
                    value={(cert as any).title || ''}
                    onChange={(e) => handleUpdateCertification(index, 'title', e.target.value)}
                    placeholder="e.g., AWS Certified Solutions Architect"
                    className="input-base"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Description (Optional)</label>
                  <textarea
                    value={(cert as any).description || ''}
                    onChange={(e) => handleUpdateCertification(index, 'description', e.target.value)}
                    placeholder="Brief description or issuing body"
                    className="input-base resize-y"
                    rows={2}
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleGenerateCertifications(index)} // Pass the index of the current certification
                    className="btn-primary flex items-center space-x-2"
                    disabled={isGeneratingBullets}
                  >
                    {isGeneratingBullets && currentBulletGenerationIndex === index && currentBulletGenerationSection === 'certifications' ? (
                      <RotateCcw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Sparkles className="w-5 h-5" />
                    )}
                    <span>{isGeneratingBullets && currentBulletGenerationIndex === index && currentBulletGenerationSection === 'certifications' ? 'Generating...' : 'Generate with AI'}</span>
                  </button>
                </div>
              </div>
            ))}
            <button onClick={handleAddCertification} className="btn-secondary flex items-center space-x-2">
              <Plus className="w-5 h-5" />
              <span>Add Certification</span>
            </button>
          </div>
        );
      case 'additional_sections':
        return (
          <div className="card p-6 mb-6 shadow-lg">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
              <Plus className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
              Additional Sections (Optional)
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Add sections like "Awards", "Publications", "Volunteer Experience", etc.
            </p>
            {(optimizedResume.additionalSections || []).map((section, index) => (
              <div key={index} className="space-y-4 border border-gray-200 p-4 rounded-lg mb-4 dark:border-dark-300">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Section #{index + 1}</h3>
                  <button
                    onClick={() => handleRemoveAdditionalSection(index)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Section Title *</label>
                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) => handleUpdateAdditionalSection(index, 'title', e.target.value)}
                    placeholder="e.g., Awards, Volunteer Experience"
                    className="input-base"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Description</label>
                  {(section.bullets || []).map((bullet, bulletIndex) => (
                    <div key={bulletIndex} className="mb-2">
                      <div className="flex items-center space-x-2">
                        <textarea
                          value={bullet}
                          onChange={(e) => handleUpdateAdditionalBullet(index, bulletIndex, e.target.value)}
                          onFocus={() => {
                            setCurrentBulletGenerationSection('additionalSections');
                            setCurrentBulletGenerationIndex(index);
                            setSelectedBulletOptionIndex(bulletIndex);
                          }}
                          onClick={() => {
                            setCurrentBulletGenerationSection('additionalSections');
                            setCurrentBulletGenerationIndex(index);
                            setSelectedBulletOptionIndex(bulletIndex);
                          }}
                          placeholder="Describe your achievement or experience"
                          className="input-base flex-grow resize-y"
                          rows={2}
                        />
                        <button
                          onClick={() => handleRemoveAdditionalBullet(index, bulletIndex)}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                      {bullet.trim().length > 0 && (
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={() => handleGenerateAdditionalBullets(index, bulletIndex)}
                            className="btn-secondary flex items-center space-x-2 text-sm"
                            disabled={isGeneratingBullets && currentBulletGenerationIndex === index && selectedBulletOptionIndex === bulletIndex}
                          >
                            {isGeneratingBullets && currentBulletGenerationIndex === index && selectedBulletOptionIndex === bulletIndex ? (
                              <RotateCcw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Sparkles className="w-4 h-4" />
                            )}
                            <span>{isGeneratingBullets && currentBulletGenerationIndex === index && selectedBulletOptionIndex === bulletIndex ? 'Generating...' : 'Generate with AI'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  <button onClick={() => handleAddAdditionalBullet(index)} className="btn-secondary flex items-center space-x-2">
                    <Plus className="w-5 h-5" />
                    <span>Add Description</span>
                  </button>
                </div>
              </div>
            ))}
            <button onClick={handleAddAdditionalSection} className="btn-secondary flex items-center space-x-2">
              <Plus className="w-5 h-5" />
              <span>Add Additional Section</span>
            </button>
          </div>
        );
      case 'review':
        return (
          <div className="card p-6 mb-6 shadow-lg">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
              <CheckCircle className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
              Review Your Resume
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Take a moment to review all the information you've entered. Ensure everything is accurate and complete before generating the final AI-optimized resume.
            </p>
            <div className="space-y-4">
              {/* Review Section: Contact Information */}
              <div className="border border-gray-200 rounded-lg shadow-sm dark:border-dark-300">
                <button
                  onClick={() => toggleReviewSection('profile')}
                  className="w-full flex justify-between items-center p-4 font-semibold text-gray-900 dark:text-gray-100"
                >
                  <span>Contact Information</span>
                  <div className="flex items-center space-x-2">
                    <Edit3 className="w-4 h-4 text-blue-600 hover:text-blue-700" onClick={(e) => { e.stopPropagation(); setCurrentSectionIndex(reviewSectionMap['profile']); }} />
                    {expandedReviewSections.has('profile') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </button>
                {expandedReviewSections.has('profile') && (
                  <div className="p-4 border-t border-gray-200 dark:border-dark-300 text-gray-700 dark:text-gray-300">
                    <p>Name: {optimizedResume.name}</p>
                    <p>Email: {optimizedResume.email}</p>
                    {optimizedResume.phone && <p>Phone: {optimizedResume.phone}</p>}
                    {optimizedResume.linkedin && <p>LinkedIn: {optimizedResume.linkedin}</p>}
                    {optimizedResume.github && <p>GitHub: {optimizedResume.github}</p>}
                  </div>
                )}
              </div>

              {/* Review Section: Objective/Summary */}
              <div className="border border-gray-200 rounded-lg shadow-sm dark:border-dark-300">
                <button
                  onClick={() => toggleReviewSection('objective_summary')}
                  className="w-full flex justify-between items-center p-4 font-semibold text-gray-900 dark:text-gray-100"
                >
                  <span>Objective/Summary</span>
                  <div className="flex items-center space-x-2">
                    <Edit3 className="w-4 h-4 text-blue-600 hover:text-blue-700" onClick={(e) => { e.stopPropagation(); setCurrentSectionIndex(reviewSectionMap['objective_summary']); }} />
                    {expandedReviewSections.has('objective_summary') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </button>
                {expandedReviewSections.has('objective_summary') && (
                  <div className="p-4 border-t border-gray-200 dark:border-dark-300 text-gray-700 dark:text-gray-300">
                    {userType === 'experienced' ? (
                      <p>{optimizedResume.summary || 'Not provided'}</p>
                    ) : (
                      <p>{optimizedResume.careerObjective || 'Not provided'}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Review Section: Education */}
              {optimizedResume.education && optimizedResume.education.length > 0 && (
                <div className="border border-gray-200 rounded-lg shadow-sm dark:border-dark-300">
                  <button
                    onClick={() => toggleReviewSection('education')}
                    className="w-full flex justify-between items-center p-4 font-semibold text-gray-900 dark:text-gray-100"
                  >
                    <span>Education ({optimizedResume.education.length} entries)</span>
                    <div className="flex items-center space-x-2">
                      <Edit3 className="w-4 h-4 text-blue-600 hover:text-blue-700" onClick={(e) => { e.stopPropagation(); setCurrentSectionIndex(reviewSectionMap['education']); }} />
                      {expandedReviewSections.has('education') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </button>
                  {expandedReviewSections.has('education') && (
                    <div className="p-4 border-t border-gray-200 dark:border-dark-300 text-gray-700 dark:text-gray-300">
                      {optimizedResume.education.map((edu, idx) => (
                        <p key={idx}>{edu.degree} from {edu.school} ({edu.year})</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Review Section: Work Experience */}
              {optimizedResume.workExperience && optimizedResume.workExperience.length > 0 && (
                <div className="border border-gray-200 rounded-lg shadow-sm dark:border-dark-300">
                  <button
                    onClick={() => toggleReviewSection('work_experience')}
                    className="w-full flex justify-between items-center p-4 font-semibold text-gray-900 dark:text-gray-100"
                  >
                    <span>Work Experience ({optimizedResume.workExperience.length} entries)</span>
                    <div className="flex items-center space-x-2">
                      <Edit3 className="w-4 h-4 text-blue-600 hover:text-blue-700" onClick={(e) => { e.stopPropagation(); setCurrentSectionIndex(reviewSectionMap['work_experience']); }} />
                      {expandedReviewSections.has('work_experience') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </button>
                  {expandedReviewSections.has('work_experience') && (
                    <div className="p-4 border-t border-gray-200 dark:border-dark-300 text-gray-700 dark:text-gray-300">
                      {optimizedResume.workExperience.map((work, idx) => (
                        <p key={idx}>{work.role} at {work.company} ({work.year})</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Review Section: Projects */}
              {optimizedResume.projects && optimizedResume.projects.length > 0 && (
                <div className="border border-gray-200 rounded-lg shadow-sm dark:border-dark-300">
                  <button
                    onClick={() => toggleReviewSection('projects')}
                    className="w-full flex justify-between items-center p-4 font-semibold text-gray-900 dark:text-gray-100"
                  >
                    <span>Projects ({optimizedResume.projects.length} entries)</span>
                    <div className="flex items-center space-x-2">
                      <Edit3 className="w-4 h-4 text-blue-600 hover:text-blue-700" onClick={(e) => { e.stopPropagation(); setCurrentSectionIndex(reviewSectionMap['projects']); }} />
                      {expandedReviewSections.has('projects') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </button>
                  {expandedReviewSections.has('projects') && (
                    <div className="p-4 border-t border-gray-200 dark:border-dark-300 text-gray-700 dark:text-gray-300">
                      {optimizedResume.projects.map((project, idx) => (
                        <p key={idx}>{project.title}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Review Section: Skills */}
              {optimizedResume.skills && optimizedResume.skills.length > 0 && (
                <div className="border border-gray-200 rounded-lg shadow-sm dark:border-dark-300">
                  <button
                    onClick={() => toggleReviewSection('skills')}
                    className="w-full flex justify-between items-center p-4 font-semibold text-gray-900 dark:text-gray-100"
                  >
                    <span>Skills ({optimizedResume.skills.length} categories)</span>
                    <div className="flex items-center space-x-2">
                      <Edit3 className="w-4 h-4 text-blue-600 hover:text-blue-700" onClick={(e) => { e.stopPropagation(); setCurrentSectionIndex(reviewSectionMap['skills']); }} />
                      {expandedReviewSections.has('skills') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </button>
                  {expandedReviewSections.has('skills') && (
                    <div className="p-4 border-t border-gray-200 dark:border-dark-300 text-gray-700 dark:text-gray-300">
                      {optimizedResume.skills.map((skill, idx) => (
                        <p key={idx}>{skill.category}: {skill.list.join(', ')}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Review Section: Certifications */}
              {optimizedResume.certifications && optimizedResume.certifications.length > 0 && (
                <div className="border border-gray-200 rounded-lg shadow-sm dark:border-dark-300">
                  <button
                    onClick={() => toggleReviewSection('certifications')}
                    className="w-full flex justify-between items-center p-4 font-semibold text-gray-900 dark:text-gray-100"
                  >
                    <span>Certifications ({optimizedResume.certifications.length} entries)</span>
                    <div className="flex items-center space-x-2">
                      <Edit3 className="w-4 h-4 text-blue-600 hover:text-blue-700" onClick={(e) => { e.stopPropagation(); setCurrentSectionIndex(reviewSectionMap['certifications']); }} />
                      {expandedReviewSections.has('certifications') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </button>
                  {expandedReviewSections.has('certifications') && (
                    <div className="p-4 border-t border-gray-200 dark:border-dark-300 text-gray-700 dark:text-gray-300">
                      {optimizedResume.certifications.map((cert, idx) => (
                        <p key={idx}>{(cert as any).title || cert}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Review Section: Additional Sections */}
              {optimizedResume.additionalSections && optimizedResume.additionalSections.length > 0 && (
                <div className="border border-gray-200 rounded-lg shadow-sm dark:border-dark-300">
                  <button
                    onClick={() => toggleReviewSection('additional_sections')}
                    className="w-full flex justify-between items-center p-4 font-semibold text-gray-900 dark:text-gray-100"
                  >
                    <span>Additional Sections ({optimizedResume.additionalSections.length} entries)</span>
                    <div className="flex items-center space-x-2">
                      <Edit3 className="w-4 h-4 text-blue-600 hover:text-blue-700" onClick={(e) => { e.stopPropagation(); setCurrentSectionIndex(reviewSectionMap['additional_sections']); }} />
                      {expandedReviewSections.has('additional_sections') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </button>
                  {expandedReviewSections.has('additional_sections') && (
                    <div className="p-4 border-t border-gray-200 dark:border-dark-300 text-gray-700 dark:text-gray-300">
                      {optimizedResume.additionalSections.map((section, idx) => (
                        <p key={idx}>{section.title}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      case 'final_resume':
        return (
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
    <Sparkles className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
    Your Resume is Ready!
  </h2>
  <div className="text-center space-y-6">
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 dark:from-blue-900/20 dark:to-purple-900/20">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 dark:text-gray-100">
        Your resume is ready to export as PDF or Word.
      </h3>
      <p className="text-gray-600 dark:text-gray-300 mb-4">
        You can download it now, or proceed to the JD-Based Optimizer for further tailoring.
      </p>
    </div>

    {isAuthenticated ? (
      <>
        {/* Download Resume Button - now opens the modal */}
        <button
          onClick={() => setShowExportOptionsModal(true)} // Open the modal
          className="w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center space-x-3
            bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-xl hover:shadow-2xl cursor-pointer"
          type="button"
        >
          <Download className="w-6 h-6" />
          <span>Download Resume</span>
        </button>

        {/* Apply JD-Based Optimization Button */}
        <button
          onClick={() => navigate('/optimizer')}
          className="w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center space-x-3
            bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-xl hover:shadow-2xl cursor-pointer"
          type="button"
        >
          <Target className="w-6 h-6" />
          <span>Apply JD-Based Optimization</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </>
    ) : (
      <button
        onClick={onShowAuth}
        className="w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center space-x-3
            bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 hover:from-neon-cyan-400 hover:to-neon-blue-400 text-white shadow-xl hover:shadow-2xl cursor-pointer"
        type="button"
      >
        <User className="w-6 h-6" />
        <span>Sign In to Download & Optimize</span>
      </button>
    )}
  </div>
</div>
        );
      default:
        return <div className="card p-6 mb-6 shadow-lg">Unknown Section</div>;
    }
  };
  // --- END NEW ---

  return (
   <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pb-16 dark:from-dark-50 dark:to-dark-200 transition-colors duration-300">
      <div className="container-responsive py-8">
        {/* Removed the !optimizedResume conditional block to always show the guided builder */}
        {/* Removed the "Back to Home" button from here as it will be part of the navigation */}

        {/* NEW: Back to Home Button */}
        <button
          onClick={onNavigateBack}
          className="mb-6 bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 text-white hover:from-neon-cyan-400 hover:to-neon-blue-400 active:from-neon-cyan-600 active:to-neon-blue-600 shadow-md hover:shadow-neon-cyan py-3 px-5 rounded-xl inline-flex items-center space-x-2 transition-all duration-200"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:block">Back to Home</span>
        </button>
        {/* END NEW */}

        <div className="max-w-7xl mx-auto space-y-6 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6">
          {/* Left Column: Guided Builder Sections & Navigation */}
          <div className="lg:col-span-1 space-y-6">
            {/* Step Progress Bar */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-100 dark:border-dark-300">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Guided Resume Builder
                </h2>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Step {currentSectionIndex + 1} of {resumeSections.length}
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-dark-300">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentSectionIndex + 1) / resumeSections.length) * 100}%` }}
                />
              </div>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                {resumeSections[currentSectionIndex].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </p>
            </div>

            {/* Render Current Section */}
            {renderCurrentSection()}

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-100 dark:border-dark-300">
              <button
                onClick={handlePreviousSection}
                disabled={currentSectionIndex === 0}
                className="btn-secondary flex items-center space-x-2"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Previous</span>
              </button>
              <button
                onClick={handleNextSection}
                // The disabled state will now be handled by the validation inside handleNextSection
                className="btn-primary flex items-center space-x-2"
              >
                <span>Next</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Right Column: Resume Preview & Export Buttons */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden dark:bg-dark-100 dark:border-dark-300 dark:shadow-dark-xl">
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 border-b border-gray-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-blue-600 dark:text-neon-cyan-400" />
                  Live Resume Preview
                </h2>
              </div>
              <div className="p-6">
                {optimizedResume ? (
                  <ResumePreview resumeData={optimizedResume} userType={userType} />
                ) : (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    Fill out the sections to see your resume preview here.
                  </div>
                )}
              </div>
            </div>

            {/* Export Options Modal (rendered outside the main flow) */}
            <ExportOptionsModal
              isOpen={showExportOptionsModal}
              onClose={() => setShowExportOptionsModal(false)}
              optimizedResume={optimizedResume}
              userType={userType}
              handleExportFile={handleExportFile}
              isExportingPDF={isExportingPDF}
              isExportingWord={isExportingWord}
              exportStatus={exportStatus}
            />
          </div>
        </div>
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
        currentResume={optimizedResume || { name: '', phone: '', email: '', linkedin: '', github: '', education: [], workExperience: [], projects: [], skills: [], certifications: [], additionalSections: [] }}
        jobDescription={jobDescription}
        onProjectsAdded={handleProjectsUpdated}
      />

      <ProjectAnalysisModal
        isOpen={showProjectAnalysis}
        onClose={() => setShowProjectAnalysis(false)}
        resumeData={parsedResumeData || optimizedResume || { name: '', phone: '', email: '', linkedin: '', github: '', education: [], workExperience: [], projects: [], skills: [], certifications: [], additionalSections: [] }}
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

      {/* AI Bullet Options Modal */}
      {showAIBulletOptions && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-dark-100 dark:text-gray-100">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Choose Your AI-Generated Options</h2>
                <p className="text-gray-600">Select the best option or regenerate for new suggestions.</p>
              </div>

              {isGeneratingBullets ? (
                <div className="text-center py-8">
                  <RotateCcw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                  <p className="text-gray-600">Generating new options...</p>
                </div>
              ) : (
                <div className="space-y-4">
                 {aiGeneratedBullets.map((option, optionIndex) => (
  <label
    key={optionIndex}
    className={`block border rounded-lg p-4 cursor-pointer transition-all ${
      selectedAIOptionIndex === optionIndex
        ? 'border-blue-500 bg-blue-50 shadow-md'
        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
    }`}
  >
    <input
      type="radio"
      name="aiBulletOption"
      className="hidden"
      checked={selectedAIOptionIndex === optionIndex}
      onChange={() => setSelectedAIOptionIndex(optionIndex)}
    />
    <div className="flex items-start">
      <div className="flex-grow">
        {currentBulletGenerationSection === 'certifications' ? (
          <p className="text-gray-700">{option[0]}</p>
        ) : (
          <ul className="list-disc pl-5 space-y-1 text-gray-700">
            {option.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        )}
      </div>
      <div className="w-5 h-5 rounded-full border-2 flex-shrink-0 ml-4 flex items-center justify-center">
        {selectedAIOptionIndex === optionIndex && (
          <CheckCircle className="w-3 h-3 text-blue-600" />
        )}
      </div>
    </div>
  </label>
))}

<button
  onClick={() =>
    handleSelectAIGeneratedOption(aiGeneratedBullets[selectedAIOptionIndex!])
  }
  className="mt-4 btn-primary w-full"
  disabled={selectedAIOptionIndex === null}
>
  Select This Option
</button>

                  <button onClick={handleRegenerateAIBullets} className="btn-secondary w-full flex items-center space-x-2">
                    <RotateCcw className="w-5 h-5" />
                    <span>Regenerate Options</span>
                  </button>
                </div>
              )}

              <div className="flex justify-end mt-6">
                <button onClick={() => setShowAIBulletOptions(false)} className="btn-secondary">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Options Modal for Objective/Summary */}
      {showAIOptionsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-dark-100 dark:text-gray-100">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Choose Your AI-Generated {userType === 'experienced' ? 'Summary' : 'Objective'}</h2>
                <p className="text-gray-600">Select the best option or regenerate for new suggestions.</p>
              </div>

              {isGeneratingOptions ? (
                <div className="text-center py-8">
                  <RotateCcw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                  <p className="text-gray-600">Generating new options...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {aiGeneratedOptions.map((option, optionIndex) => (
                    <label
                      key={optionIndex}
                      className={`block border rounded-lg p-4 cursor-pointer transition-all ${
                        selectedAIOptionIndex === optionIndex
                          ? 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="aiOption"
                        className="hidden"
                        checked={selectedAIOptionIndex === optionIndex}
                        onChange={() => setSelectedAIOptionIndex(optionIndex)}
                      />
                      <div className="flex items-start">
                        <div className="flex-grow">
                          <p className="text-gray-700">{option}</p>
                        </div>
                        <div className="w-5 h-5 rounded-full border-2 flex-shrink-0 ml-4 flex items-center justify-center">
                          {selectedAIOptionIndex === optionIndex && (
                            <CheckCircle className="w-3 h-3 text-blue-600" />
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                  <button
                    onClick={() => handleSelectAIOption(aiGeneratedOptions[selectedAIOptionIndex!])}
                    className="mt-4 btn-primary w-full"
                    disabled={selectedAIOptionIndex === null}
                  >
                    Select This Option
                  </button>
                  <button onClick={handleRegenerateAIOptions} className="btn-secondary w-full flex items-center space-x-2">
                    <RotateCcw className="w-5 h-5" />
                    <span>Regenerate Options</span>
                  </button>
                </div>
              )}

              <div className="flex justify-end mt-6">
                <button onClick={() => setShowAIOptionsModal(false)} className="btn-secondary">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuidedResumeBuilder;