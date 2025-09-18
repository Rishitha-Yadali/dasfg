// src/components/GuidedResumeBuilder.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  ArrowLeft,
  User,
  Briefcase,
  GraduationCap,
  Code,
  Award,
  Target,
  Sparkles,
  Loader2,
  Plus,
  X,
  Edit3,
  Save,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Zap,
  Copy,
  Heart,
  FileText,
  ChevronDown,
  ChevronUp,
  Lightbulb
} from 'lucide-react';
import { ResumeData, UserType, AdditionalSection, Certification } from '../types/resume';
import { generateAtsOptimizedSection, generateMultipleAtsVariations } from '../services/geminiService';
import { ResumePreview } from './ResumePreview';
import { ExportButtons } from './ExportButtons';
import { paymentService } from '../services/paymentService';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import type { Subscription } from '../types/payment';

interface GuidedResumeBuilderProps {
  onNavigateBack: () => void;
  isAuthenticated: boolean;
  onShowAuth: () => void;
  userSubscription: Subscription | null;
  onShowSubscriptionPlans: (featureId?: string) => void;
  onShowAlert: (
    title: string,
    message: string,
    type?: 'info' | 'success' | 'warning' | 'error',
    actionText?: string,
    onAction?: () => void
  ) => void;
  refreshUserSubscription: () => Promise<void>;
  toolProcessTrigger: (() => void) | null;
  setToolProcessTrigger: React.Dispatch<React.SetStateAction<(() => void) | null>>;
}

export const GuidedResumeBuilder: React.FC<GuidedResumeBuilderProps> = ({
  onNavigateBack,
  isAuthenticated,
  onShowAuth,
  userSubscription,
  onShowSubscriptionPlans,
  onShowAlert,
  refreshUserSubscription,
  toolProcessTrigger,
  setToolProcessTrigger,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Core resume data state
  const [resumeData, setResumeData] = useState<ResumeData>({
    name: '',
    phone: '',
    email: '',
    linkedin: '',
    github: '',
    location: '',
    targetRole: '',
    education: [{ degree: '', school: '', year: '', cgpa: '', location: '' }],
    workExperience: [{ role: '', company: '', year: '', bullets: [''] }],
    projects: [{ title: '', bullets: [''] }],
    skills: [{ category: '', count: 0, list: [] }],
    certifications: [],
    additionalSections: [],
    origin: 'guided'
  });

  const [userType, setUserType] = useState<UserType>('fresher');
  const [currentStep, setCurrentStep] = useState(0);
  const [isGeneratingAIContent, setIsGeneratingAIContent] = useState(false);
  const [buildInterrupted, setBuildInterrupted] = useState(false);

  // Multiple variations state
  const [summaryVariations, setSummaryVariations] = useState<string[]>([]);
  const [objectiveVariations, setObjectiveVariations] = useState<string[]>([]);
  const [certificationsVariations, setCertificationsVariations] = useState<string[][]>([]);
  const [achievementsVariations, setAchievementsVariations] = useState<string[][]>([]);
  
  // Selection state for variations
  const [selectedSummaryIndex, setSelectedSummaryIndex] = useState<number>(0);
  const [selectedObjectiveIndex, setSelectedObjectiveIndex] = useState<number>(0);
  const [selectedCertificationsIndex, setSelectedCertificationsIndex] = useState<number>(0);
  const [selectedAchievementsIndex, setSelectedAchievementsIndex] = useState<number>(0);

  // Additional sections state
  const [customSectionTitle, setCustomSectionTitle] = useState('');
  const [customSectionDetails, setCustomSectionDetails] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState('');
  const [newSkillItems, setNewSkillItems] = useState('');

  // UI state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic-info']));
  const [showVariationsFor, setShowVariationsFor] = useState<string | null>(null);

  // Pre-fill user data when authenticated
  useEffect(() => {
    if (user) {
      setResumeData(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        linkedin: user.linkedin || '',
        github: user.github || '',
      }));
    }
  }, [user]);

  // Generate content with loading state management
  const generateContent = useCallback(
    async (sectionType: string, data: any, modelToUse?: string, getMultiple: boolean = false): Promise<string | string[]> => {
      setIsGeneratingAIContent(true);
      try {
        if (getMultiple) {
          return await generateMultipleAtsVariations(
            sectionType as any,
            data,
            modelToUse || 'deepseek/deepseek-r1:free',
            3
          );
        } else {
          return await generateAtsOptimizedSection(sectionType as any, data, modelToUse || 'deepseek/deepseek-r1:free');
        }
      } catch (error: any) {
        onShowAlert('Generation Failed', `Failed to generate ${sectionType}: ${error.message}`, 'error');
        throw error;
      } finally {
        setIsGeneratingAIContent(false);
      }
    },
    [onShowAlert]
  );

  // Check credits and handle guided builds
  const checkGuidedBuildCredits = useCallback(async (): Promise<boolean> => {
    if (!isAuthenticated || !user) {
      onShowAlert('Authentication Required', 'Please sign in to use the guided resume builder.', 'error', 'Sign In', onShowAuth);
      return false;
    }

    const latestUserSubscription = await paymentService.getUserSubscription(user.id);
    if (!latestUserSubscription || (latestUserSubscription.guidedBuildsTotal - latestUserSubscription.guidedBuildsUsed) <= 0) {
      const planDetails = paymentService.getPlanById(latestUserSubscription?.planId);
      const planName = planDetails?.name || 'your current plan';
      const guidedBuildsTotal = planDetails?.guidedBuilds || 0;

      setBuildInterrupted(true);
      onShowAlert(
        'Guided Build Credits Exhausted',
        `You have used all your ${guidedBuildsTotal} Guided Resume Builds from ${planName}. Please upgrade your plan to continue building resumes.`,
        'warning',
        'Upgrade Plan',
        () => onShowSubscriptionPlans('guided-builder')
      );
      return false;
    }

    return true;
  }, [isAuthenticated, user, onShowAuth, onShowAlert, onShowSubscriptionPlans]);

  // Generate multiple variations for a section
  const generateVariations = async (sectionType: string, sectionData: any) => {
    if (!(await checkGuidedBuildCredits())) return;

    try {
      const variations = await generateContent(sectionType, sectionData, 'deepseek/deepseek-r1:free', true) as string[];
      
      switch (sectionType) {
        case 'summary':
          setSummaryVariations(variations);
          setShowVariationsFor('summary');
          break;
        case 'careerObjective':
          setObjectiveVariations(variations);
          setShowVariationsFor('careerObjective');
          break;
        case 'certifications':
          setCertificationsVariations(variations as string[][]);
          setShowVariationsFor('certifications');
          break;
        case 'achievements':
          setAchievementsVariations(variations as string[][]);
          setShowVariationsFor('achievements');
          break;
      }
    } catch (error) {
      console.error(`Error generating ${sectionType} variations:`, error);
    }
  };

  // Select a variation and apply it
  const selectVariation = (sectionType: string, index: number) => {
    switch (sectionType) {
      case 'summary':
        setSelectedSummaryIndex(index);
        setResumeData(prev => ({ ...prev, summary: summaryVariations[index] }));
        break;
      case 'careerObjective':
        setSelectedObjectiveIndex(index);
        setResumeData(prev => ({ ...prev, careerObjective: objectiveVariations[index] }));
        break;
      case 'certifications':
        setSelectedCertificationsIndex(index);
        const selectedCerts = certificationsVariations[index].map(cert => ({ title: cert, description: '' }));
        setResumeData(prev => ({ ...prev, certifications: selectedCerts }));
        break;
      case 'achievements':
        setSelectedAchievementsIndex(index);
        // Note: achievements would need to be added to ResumeData type if not already present
        break;
    }
    setShowVariationsFor(null);
  };

  // Generate single AI content for bullets
  const generateBullets = async (sectionType: string, index: number, sectionData: any) => {
    if (!(await checkGuidedBuildCredits())) return;

    try {
      const bullets = await generateContent(sectionType, sectionData, 'deepseek/deepseek-r1:free') as string[];
      
      if (sectionType === 'workExperienceBullets') {
        const updated = [...resumeData.workExperience];
        updated[index].bullets = bullets;
        setResumeData(prev => ({ ...prev, workExperience: updated }));
      } else if (sectionType === 'projectBullets') {
        const updated = [...resumeData.projects];
        updated[index].bullets = bullets;
        setResumeData(prev => ({ ...prev, projects: updated }));
      }
    } catch (error) {
      console.error(`Error generating ${sectionType}:`, error);
    }
  };

  // Add custom section
  const addCustomSection = async () => {
    if (!customSectionTitle.trim() || !customSectionDetails.trim()) {
      onShowAlert('Missing Information', 'Please provide both section title and details.', 'warning');
      return;
    }

    if (!(await checkGuidedBuildCredits())) return;

    try {
      const bullets = await generateContent('additionalSectionBullets', {
        title: customSectionTitle,
        details: customSectionDetails,
        userType: userType,
      }, 'deepseek/deepseek-r1:free') as string[];

      const newSection: AdditionalSection = {
        title: customSectionTitle,
        bullets: bullets,
      };

      setResumeData(prev => ({
        ...prev,
        additionalSections: [...(prev.additionalSections || []), newSection],
      }));

      setCustomSectionTitle('');
      setCustomSectionDetails('');
      onShowAlert('Section Added!', `${customSectionTitle} section has been added to your resume.`, 'success');
    } catch (error) {
      console.error('Error generating custom section:', error);
    }
  };

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  // Handle optimize entire resume
  const handleOptimizeResume = useCallback(async () => {
    if (!(await checkGuidedBuildCredits())) return;

    try {
      setIsGeneratingAIContent(true);
      
      // Use guided build credit
      const usageResult = await paymentService.useGuidedBuild(user!.id);
      if (usageResult.success) {
        await refreshUserSubscription();
        onShowAlert(
          'Resume Optimized!',
          'Your guided resume has been successfully built and optimized.',
          'success'
        );
      } else {
        console.error('Failed to use guided build credit:', usageResult.error);
        onShowAlert('Usage Update Failed', 'Failed to record guided build usage.', 'error');
      }
    } catch (error: any) {
      console.error('Error optimizing resume:', error);
      onShowAlert('Optimization Failed', `Failed to optimize resume: ${error.message}`, 'error');
    } finally {
      setIsGeneratingAIContent(false);
    }
  }, [user, checkGuidedBuildCredits, refreshUserSubscription, onShowAlert]);

  // Set up tool process trigger
  useEffect(() => {
    setToolProcessTrigger(() => handleOptimizeResume);
    return () => {
      setToolProcessTrigger(null);
    };
  }, [setToolProcessTrigger, handleOptimizeResume]);

  // Re-trigger on credit replenishment
  useEffect(() => {
    if (buildInterrupted && userSubscription && (userSubscription.guidedBuildsTotal - userSubscription.guidedBuildsUsed) > 0) {
      console.log('GuidedResumeBuilder: Credits replenished, resetting interruption flag.');
      setBuildInterrupted(false);
    }
  }, [buildInterrupted, userSubscription]);

  const steps = [
    { id: 'basic-info', title: 'Basic Information', icon: <User className="w-5 h-5" /> },
    { id: 'education', title: 'Education', icon: <GraduationCap className="w-5 h-5" /> },
    { id: 'experience', title: 'Work Experience', icon: <Briefcase className="w-5 h-5" /> },
    { id: 'projects', title: 'Projects', icon: <Code className="w-5 h-5" /> },
    { id: 'skills', title: 'Skills', icon: <Target className="w-5 h-5" /> },
    { id: 'certifications', title: 'Certifications', icon: <Award className="w-5 h-5" /> },
    { id: 'additional', title: 'Additional Sections', icon: <Plus className="w-5 h-5" /> },
    { id: 'preview', title: 'Preview & Export', icon: <FileText className="w-5 h-5" /> },
  ];

  const renderVariationSelector = (
    sectionType: string,
    variations: string[] | string[][],
    selectedIndex: number,
    onSelect: (index: number) => void
  ) => {
    if (!variations.length) return null;

    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto dark:bg-dark-100">
          <div className="p-6 border-b border-gray-200 dark:border-dark-300">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Choose Your Preferred {sectionType}
              </h3>
              <button
                onClick={() => setShowVariationsFor(null)}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-dark-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Select the variation that best represents your professional profile
            </p>
          </div>

          <div className="p-6 space-y-4">
            {(variations as string[]).map((variation, index) => (
              <div
                key={index}
                className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                  selectedIndex === index
                    ? 'border-blue-500 bg-blue-50 dark:border-neon-cyan-500 dark:bg-neon-cyan-500/20'
                    : 'border-gray-200 hover:border-blue-300 dark:border-dark-300 dark:hover:border-neon-cyan-400'
                }`}
                onClick={() => onSelect(index)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        Option {index + 1}
                      </span>
                      {selectedIndex === index && (
                        <CheckCircle className="w-4 h-4 text-blue-600 ml-2 dark:text-neon-cyan-400" />
                      )}
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {typeof variation === 'string' ? variation : variation.join(', ')}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(typeof variation === 'string' ? variation : variation.join('\n'));
                      onShowAlert('Copied!', 'Content copied to clipboard.', 'success');
                    }}
                    className="text-gray-400 hover:text-gray-600 p-2 ml-2 dark:text-gray-500 dark:hover:text-gray-300"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-dark-300">
              <button
                onClick={() => setShowVariationsFor(null)}
                className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl transition-colors dark:bg-dark-200 dark:hover:bg-dark-300 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  selectVariation(sectionType, selectedIndex);
                }}
                className="px-6 py-3 bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 hover:from-neon-cyan-400 hover:to-neon-blue-400 text-white font-semibold rounded-xl transition-colors shadow-neon-cyan"
              >
                Use Selected Option
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSection = (sectionId: string) => {
    const isExpanded = expandedSections.has(sectionId);

    const sectionContent = () => {
      switch (sectionId) {
        case 'basic-info':
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={resumeData.name}
                    onChange={(e) => setResumeData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Your full name"
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={resumeData.email}
                    onChange={(e) => setResumeData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="your.email@example.com"
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    value={resumeData.phone}
                    onChange={(e) => setResumeData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+1 (555) 123-4567"
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={resumeData.location}
                    onChange={(e) => setResumeData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="City, State/Country"
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    LinkedIn Profile
                  </label>
                  <input
                    type="url"
                    value={resumeData.linkedin}
                    onChange={(e) => setResumeData(prev => ({ ...prev, linkedin: e.target.value }))}
                    placeholder="https://linkedin.com/in/yourprofile"
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    GitHub Profile
                  </label>
                  <input
                    type="url"
                    value={resumeData.github}
                    onChange={(e) => setResumeData(prev => ({ ...prev, github: e.target.value }))}
                    placeholder="https://github.com/yourusername"
                    className="input-base"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Target Role
                </label>
                <input
                  type="text"
                  value={resumeData.targetRole}
                  onChange={(e) => setResumeData(prev => ({ ...prev, targetRole: e.target.value }))}
                  placeholder="e.g., Software Engineer, Product Manager"
                  className="input-base"
                />
              </div>

              {/* User Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Experience Level
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(['fresher', 'experienced', 'student'] as UserType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setUserType(type)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        userType === type
                          ? 'border-blue-500 bg-blue-50 dark:border-neon-cyan-500 dark:bg-neon-cyan-500/20'
                          : 'border-gray-200 hover:border-blue-300 dark:border-dark-300 dark:hover:border-neon-cyan-400'
                      }`}
                    >
                      <div className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                        {type === 'student' ? 'College Student' : type}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* AI-Generated Summary/Objective */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {userType === 'experienced' ? 'Professional Summary' : 'Career Objective'}
                  </label>
                  <button
                    onClick={() => generateVariations(userType === 'experienced' ? 'summary' : 'careerObjective', {
                      userType: userType,
                      targetRole: resumeData.targetRole,
                      experience: resumeData.workExperience,
                      education: resumeData.education,
                    })}
                    disabled={isGeneratingAIContent}
                    className="btn-primary px-4 py-2 text-sm flex items-center space-x-2"
                  >
                    {isGeneratingAIContent ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Generate 3 Options</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  value={userType === 'experienced' ? (resumeData.summary || '') : (resumeData.careerObjective || '')}
                  onChange={(e) => {
                    if (userType === 'experienced') {
                      setResumeData(prev => ({ ...prev, summary: e.target.value }));
                    } else {
                      setResumeData(prev => ({ ...prev, careerObjective: e.target.value }));
                    }
                  }}
                  placeholder={userType === 'experienced' 
                    ? "Write a compelling professional summary highlighting your experience and achievements..."
                    : "Write a career objective focusing on your learning goals and aspirations..."
                  }
                  rows={3}
                  className="input-base resize-none"
                />
              </div>
            </div>
          );

        case 'education':
          return (
            <div className="space-y-6">
              {resumeData.education.map((edu, index) => (
                <div key={index} className="border border-gray-200 rounded-xl p-4 space-y-4 dark:border-dark-300">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">Education #{index + 1}</h4>
                    {resumeData.education.length > 1 && (
                      <button
                        onClick={() => {
                          const updated = resumeData.education.filter((_, i) => i !== index);
                          setResumeData(prev => ({ ...prev, education: updated }));
                        }}
                        className="text-red-600 hover:text-red-700 p-2 dark:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Degree *
                      </label>
                      <input
                        type="text"
                        value={edu.degree}
                        onChange={(e) => {
                          const updated = [...resumeData.education];
                          updated[index].degree = e.target.value;
                          setResumeData(prev => ({ ...prev, education: updated }));
                        }}
                        placeholder="e.g., Bachelor of Science in Computer Science"
                        className="input-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Institution *
                      </label>
                      <input
                        type="text"
                        value={edu.school}
                        onChange={(e) => {
                          const updated = [...resumeData.education];
                          updated[index].school = e.target.value;
                          setResumeData(prev => ({ ...prev, education: updated }));
                        }}
                        placeholder="University/College Name"
                        className="input-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Year *
                      </label>
                      <input
                        type="text"
                        value={edu.year}
                        onChange={(e) => {
                          const updated = [...resumeData.education];
                          updated[index].year = e.target.value;
                          setResumeData(prev => ({ ...prev, education: updated }));
                        }}
                        placeholder="e.g., 2020-2024"
                        className="input-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        CGPA/GPA
                      </label>
                      <input
                        type="text"
                        value={edu.cgpa}
                        onChange={(e) => {
                          const updated = [...resumeData.education];
                          updated[index].cgpa = e.target.value;
                          setResumeData(prev => ({ ...prev, education: updated }));
                        }}
                        placeholder="e.g., 8.5/10 or 3.8/4.0"
                        className="input-base"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={() => {
                  setResumeData(prev => ({
                    ...prev,
                    education: [...prev.education, { degree: '', school: '', year: '', cgpa: '', location: '' }]
                  }));
                }}
                className="btn-secondary w-full py-3 flex items-center justify-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Another Education</span>
              </button>
            </div>
          );

        case 'experience':
          return (
            <div className="space-y-6">
              {resumeData.workExperience.map((work, index) => (
                <div key={index} className="border border-gray-200 rounded-xl p-4 space-y-4 dark:border-dark-300">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">Experience #{index + 1}</h4>
                    {resumeData.workExperience.length > 1 && (
                      <button
                        onClick={() => {
                          const updated = resumeData.workExperience.filter((_, i) => i !== index);
                          setResumeData(prev => ({ ...prev, workExperience: updated }));
                        }}
                        className="text-red-600 hover:text-red-700 p-2 dark:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Job Title *
                      </label>
                      <input
                        type="text"
                        value={work.role}
                        onChange={(e) => {
                          const updated = [...resumeData.workExperience];
                          updated[index].role = e.target.value;
                          setResumeData(prev => ({ ...prev, workExperience: updated }));
                        }}
                        placeholder="e.g., Software Engineer"
                        className="input-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Company *
                      </label>
                      <input
                        type="text"
                        value={work.company}
                        onChange={(e) => {
                          const updated = [...resumeData.workExperience];
                          updated[index].company = e.target.value;
                          setResumeData(prev => ({ ...prev, workExperience: updated }));
                        }}
                        placeholder="Company Name"
                        className="input-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Duration *
                      </label>
                      <input
                        type="text"
                        value={work.year}
                        onChange={(e) => {
                          const updated = [...resumeData.workExperience];
                          updated[index].year = e.target.value;
                          setResumeData(prev => ({ ...prev, workExperience: updated }));
                        }}
                        placeholder="e.g., Jan 2023 - Present"
                        className="input-base"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Key Responsibilities
                      </label>
                      <button
                        onClick={() => generateBullets('workExperienceBullets', index, {
                          role: work.role,
                          company: work.company,
                          year: work.year,
                          description: work.bullets.join(' '),
                          userType: userType,
                        })}
                        disabled={isGeneratingAIContent}
                        className="btn-primary px-3 py-1 text-sm flex items-center space-x-1"
                      >
                        {isGeneratingAIContent ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" />
                            <span>Generate with AI</span>
                          </>
                        )}
                      </button>
                    </div>
                    {work.bullets.map((bullet, bulletIndex) => (
                      <div key={bulletIndex} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={bullet}
                          onChange={(e) => {
                            const updated = [...resumeData.workExperience];
                            updated[index].bullets[bulletIndex] = e.target.value;
                            setResumeData(prev => ({ ...prev, workExperience: updated }));
                          }}
                          placeholder="Describe your responsibility/achievement"
                          className="input-base flex-1"
                        />
                        {work.bullets.length > 1 && (
                          <button
                            onClick={() => {
                              const updated = [...resumeData.workExperience];
                              updated[index].bullets.splice(bulletIndex, 1);
                              setResumeData(prev => ({ ...prev, workExperience: updated }));
                            }}
                            className="text-red-600 hover:text-red-700 p-2 dark:text-red-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const updated = [...resumeData.workExperience];
                        updated[index].bullets.push('');
                        setResumeData(prev => ({ ...prev, workExperience: updated }));
                      }}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center dark:text-neon-cyan-400"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Responsibility
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => {
                  setResumeData(prev => ({
                    ...prev,
                    workExperience: [...prev.workExperience, { role: '', company: '', year: '', bullets: [''] }]
                  }));
                }}
                className="btn-secondary w-full py-3 flex items-center justify-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Work Experience</span>
              </button>
            </div>
          );

        case 'projects':
          return (
            <div className="space-y-6">
              {resumeData.projects.map((project, index) => (
                <div key={index} className="border border-gray-200 rounded-xl p-4 space-y-4 dark:border-dark-300">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">Project #{index + 1}</h4>
                    {resumeData.projects.length > 1 && (
                      <button
                        onClick={() => {
                          const updated = resumeData.projects.filter((_, i) => i !== index);
                          setResumeData(prev => ({ ...prev, projects: updated }));
                        }}
                        className="text-red-600 hover:text-red-700 p-2 dark:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Project Title *
                    </label>
                    <input
                      type="text"
                      value={project.title}
                      onChange={(e) => {
                        const updated = [...resumeData.projects];
                        updated[index].title = e.target.value;
                        setResumeData(prev => ({ ...prev, projects: updated }));
                      }}
                      placeholder="e.g., E-commerce Website"
                      className="input-base"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Project Details
                      </label>
                      <button
                        onClick={() => generateBullets('projectBullets', index, {
                          title: project.title,
                          description: project.bullets.join(' '),
                          techStack: 'Modern technologies',
                          userType: userType,
                        })}
                        disabled={isGeneratingAIContent}
                        className="btn-primary px-3 py-1 text-sm flex items-center space-x-1"
                      >
                        {isGeneratingAIContent ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" />
                            <span>Generate with AI</span>
                          </>
                        )}
                      </button>
                    </div>
                    {project.bullets.map((bullet, bulletIndex) => (
                      <div key={bulletIndex} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={bullet}
                          onChange={(e) => {
                            const updated = [...resumeData.projects];
                            updated[index].bullets[bulletIndex] = e.target.value;
                            setResumeData(prev => ({ ...prev, projects: updated }));
                          }}
                          placeholder="Describe what you built/achieved"
                          className="input-base flex-1"
                        />
                        {project.bullets.length > 1 && (
                          <button
                            onClick={() => {
                              const updated = [...resumeData.projects];
                              updated[index].bullets.splice(bulletIndex, 1);
                              setResumeData(prev => ({ ...prev, projects: updated }));
                            }}
                            className="text-red-600 hover:text-red-700 p-2 dark:text-red-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const updated = [...resumeData.projects];
                        updated[index].bullets.push('');
                        setResumeData(prev => ({ ...prev, projects: updated }));
                      }}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center dark:text-neon-cyan-400"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Detail
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => {
                  setResumeData(prev => ({
                    ...prev,
                    projects: [...prev.projects, { title: '', bullets: [''] }]
                  }));
                }}
                className="btn-secondary w-full py-3 flex items-center justify-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Project</span>
              </button>
            </div>
          );

        case 'skills':
          return (
            <div className="space-y-6">
              {resumeData.skills.map((skillCategory, index) => (
                <div key={index} className="border border-gray-200 rounded-xl p-4 space-y-4 dark:border-dark-300">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">Skill Category #{index + 1}</h4>
                    {resumeData.skills.length > 1 && (
                      <button
                        onClick={() => {
                          const updated = resumeData.skills.filter((_, i) => i !== index);
                          setResumeData(prev => ({ ...prev, skills: updated }));
                        }}
                        className="text-red-600 hover:text-red-700 p-2 dark:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Category Name *
                    </label>
                    <input
                      type="text"
                      value={skillCategory.category}
                      onChange={(e) => {
                        const updated = [...resumeData.skills];
                        updated[index].category = e.target.value;
                        setResumeData(prev => ({ ...prev, skills: updated }));
                      }}
                      placeholder="e.g., Programming Languages, Frameworks"
                      className="input-base"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Skills (comma-separated)
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={newSkillItems}
                        onChange={(e) => setNewSkillItems(e.target.value)}
                        placeholder="e.g., JavaScript, React, Node.js"
                        className="input-base flex-1"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            const items = newSkillItems.split(',').map(item => item.trim()).filter(item => item);
                            const updated = [...resumeData.skills];
                            updated[index].list = [...updated[index].list, ...items];
                            updated[index].count = updated[index].list.length;
                            setResumeData(prev => ({ ...prev, skills: updated }));
                            setNewSkillItems('');
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          const items = newSkillItems.split(',').map(item => item.trim()).filter(item => item);
                          const updated = [...resumeData.skills];
                          updated[index].list = [...updated[index].list, ...items];
                          updated[index].count = updated[index].list.length;
                          setResumeData(prev => ({ ...prev, skills: updated }));
                          setNewSkillItems('');
                        }}
                        className="btn-primary px-4 py-2"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {skillCategory.list.map((skill, skillIndex) => (
                        <span
                          key={skillIndex}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 dark:bg-neon-cyan-500/20 dark:text-neon-cyan-300"
                        >
                          {skill}
                          <button
                            onClick={() => {
                              const updated = [...resumeData.skills];
                              updated[index].list.splice(skillIndex, 1);
                              updated[index].count = updated[index].list.length;
                              setResumeData(prev => ({ ...prev, skills: updated }));
                            }}
                            className="ml-2 text-blue-600 hover:text-blue-800 dark:text-neon-cyan-400"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={() => {
                  setResumeData(prev => ({
                    ...prev,
                    skills: [...prev.skills, { category: '', count: 0, list: [] }]
                  }));
                }}
                className="btn-secondary w-full py-3 flex items-center justify-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Skill Category</span>
              </button>
            </div>
          );

        case 'certifications':
          return (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Certifications</h3>
                <button
                  onClick={() => generateVariations('certifications', {
                    targetRole: resumeData.targetRole,
                    skills: resumeData.skills,
                    userType: userType,
                    jobDescription: '', // You might want to add a job description field
                  })}
                  disabled={isGeneratingAIContent}
                  className="btn-primary px-4 py-2 flex items-center space-x-2"
                >
                  {isGeneratingAIContent ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate 3 Options</span>
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-3">
                {resumeData.certifications.map((cert, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={typeof cert === 'string' ? cert : cert.title}
                      onChange={(e) => {
                        const updated = [...resumeData.certifications];
                        if (typeof cert === 'string') {
                          updated[index] = e.target.value;
                        } else {
                          updated[index] = { ...cert, title: e.target.value };
                        }
                        setResumeData(prev => ({ ...prev, certifications: updated }));
                      }}
                      placeholder="e.g., AWS Certified Solutions Architect"
                      className="input-base flex-1"
                    />
                    <button
                      onClick={() => {
                        const updated = resumeData.certifications.filter((_, i) => i !== index);
                        setResumeData(prev => ({ ...prev, certifications: updated }));
                      }}
                      className="text-red-600 hover:text-red-700 p-2 dark:text-red-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    setResumeData(prev => ({
                      ...prev,
                      certifications: [...prev.certifications, '']
                    }));
                  }}
                  className="btn-secondary w-full py-3 flex items-center justify-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Certification</span>
                </button>
              </div>
            </div>
          );

        case 'additional':
          return (
            <div className="space-y-6">
              {/* Custom Section Creator */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-4 dark:border-dark-300">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                  <Plus className="w-5 h-5 mr-2 text-blue-600 dark:text-neon-cyan-400" />
                  Add Custom Section
                </h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Section Title *
                  </label>
                  <input
                    type="text"
                    value={customSectionTitle}
                    onChange={(e) => setCustomSectionTitle(e.target.value)}
                    placeholder="e.g., Achievements, Languages, Volunteer Work"
                    className="input-base"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Section Details/Context *
                  </label>
                  <textarea
                    value={customSectionDetails}
                    onChange={(e) => setCustomSectionDetails(e.target.value)}
                    placeholder="Provide details or context that AI can use to generate content for this section..."
                    rows={3}
                    className="input-base resize-none"
                  />
                </div>

                <button
                  onClick={addCustomSection}
                  disabled={isGeneratingAIContent || !customSectionTitle.trim() || !customSectionDetails.trim()}
                  className="btn-primary w-full py-3 flex items-center justify-center space-x-2"
                >
                  {isGeneratingAIContent ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating Section...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate & Add Section</span>
                    </>
                  )}
                </button>
              </div>

              {/* Existing Additional Sections */}
              {resumeData.additionalSections && resumeData.additionalSections.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Your Additional Sections</h3>
                  {resumeData.additionalSections.map((section, index) => (
                    <div key={index} className="border border-gray-200 rounded-xl p-4 space-y-3 dark:border-dark-300">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">{section.title}</h4>
                        <button
                          onClick={() => {
                            const updated = resumeData.additionalSections?.filter((_, i) => i !== index) || [];
                            setResumeData(prev => ({ ...prev, additionalSections: updated }));
                          }}
                          className="text-red-600 hover:text-red-700 p-2 dark:text-red-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <ul className="space-y-2">
                        {section.bullets.map((bullet, bulletIndex) => (
                          <li key={bulletIndex} className="flex items-start">
                            <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0 dark:bg-neon-cyan-400"></span>
                            <span className="text-gray-700 dark:text-gray-300">{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {/* Achievements Section */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-4 dark:border-dark-300">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                    <Award className="w-5 h-5 mr-2 text-yellow-600 dark:text-yellow-400" />
                    Achievements
                  </h3>
                  <button
                    onClick={() => generateVariations('achievements', {
                      userType: userType,
                      targetRole: resumeData.targetRole,
                      experienceLevel: userType,
                      context: 'Professional achievements and accomplishments',
                    })}
                    disabled={isGeneratingAIContent}
                    className="btn-primary px-4 py-2 flex items-center space-x-2"
                  >
                    {isGeneratingAIContent ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Generate 3 Options</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Add your professional achievements, awards, or notable accomplishments.
                </p>
              </div>
            </div>
          );

        case 'preview':
          return (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  🎉 Your Resume is Ready!
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Review your AI-generated resume and export it when you're satisfied.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <ResumePreview resumeData={resumeData} userType={userType} />
                </div>
                <div className="space-y-4">
                  <div className="card p-6">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                      Resume Summary
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Experience Level:</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                          {userType === 'student' ? 'College Student' : userType}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Work Experience:</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {resumeData.workExperience.filter(w => w.role.trim()).length} entries
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Projects:</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {resumeData.projects.filter(p => p.title.trim()).length} projects
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Skills Categories:</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {resumeData.skills.filter(s => s.category.trim()).length} categories
                        </span>
                      </div>
                      {resumeData.additionalSections && resumeData.additionalSections.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Additional Sections:</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {resumeData.additionalSections.length} sections
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <ExportButtons
                    resumeData={resumeData}
                    userType={userType}
                    targetRole={resumeData.targetRole}
                  />
                </div>
              </div>
            </div>
          );

        default:
          return <div>Section not implemented</div>;
      }
    };

    return (
      <div className="card">
        <button
          onClick={() => toggleSection(sectionId)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors dark:hover:bg-dark-200"
        >
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isExpanded ? 'bg-blue-100 text-blue-600 dark:bg-neon-cyan-500/20 dark:text-neon-cyan-400' : 'bg-gray-100 text-gray-500 dark:bg-dark-200 dark:text-gray-400'
            }`}>
              {steps.find(s => s.id === sectionId)?.icon}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {steps.find(s => s.id === sectionId)?.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isExpanded ? 'Click to collapse' : 'Click to expand and edit'}
              </p>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {isExpanded && (
          <div className="p-6 border-t border-gray-200 dark:border-dark-300">
            {sectionContent()}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 transition-colors duration-300">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40 dark:bg-dark-50 dark:border-dark-300">
        <div className="container-responsive">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={onNavigateBack}
              className="bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 text-white hover:from-neon-cyan-400 hover:to-neon-blue-400 active:from-neon-cyan-600 active:to-neon-blue-600 shadow-md hover:shadow-neon-cyan py-3 px-5 rounded-xl inline-flex items-center space-x-2 transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:block">Back to Home</span>
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Guided Resume Builder</h1>
            <div className="w-24"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container-responsive py-8">
        <div className="max-w-4xl mx-auto">
          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-100 dark:border-dark-300">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Build Your Professional Resume
                </h2>
                {isAuthenticated && userSubscription && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Guided Builds: {userSubscription.guidedBuildsTotal - userSubscription.guidedBuildsUsed} remaining
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-4">
            {steps.map((step) => renderSection(step.id))}
          </div>

          {/* Final Optimize Button */}
          <div className="mt-8 text-center">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-100 dark:border-dark-300">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Ready to Finalize Your Resume?
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Complete the guided resume building process and get your professional resume.
              </p>
              <button
                onClick={handleOptimizeResume}
                disabled={isGeneratingAIContent || !isAuthenticated}
                className="btn-primary px-8 py-4 text-lg font-bold flex items-center space-x-3 mx-auto shadow-xl hover:shadow-2xl"
              >
                {isGeneratingAIContent ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Finalizing Resume...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-6 h-6" />
                    <span>{isAuthenticated ? 'Complete Resume Build' : 'Sign In to Complete'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Variation Selection Modal */}
      {showVariationsFor === 'summary' && renderVariationSelector(
        'summary',
        summaryVariations,
        selectedSummaryIndex,
        (index) => selectVariation('summary', index)
      )}

      {showVariationsFor === 'careerObjective' && renderVariationSelector(
        'careerObjective',
        objectiveVariations,
        selectedObjectiveIndex,
        (index) => selectVariation('careerObjective', index)
      )}

      {showVariationsFor === 'certifications' && renderVariationSelector(
        'certifications',
        certificationsVariations,
        selectedCertificationsIndex,
        (index) => selectVariation('certifications', index)
      )}

      {showVariationsFor === 'achievements' && renderVariationSelector(
        'achievements',
        achievementsVariations,
        selectedAchievementsIndex,
        (index) => selectVariation('achievements', index)
      )}
    </div>
  );
};