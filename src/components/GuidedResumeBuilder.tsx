// src/components/GuidedResumeBuilder.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft,
  CheckCircle,
  Plus,
  X,
  User,
  Briefcase,
  GraduationCap,
  Code,
  Target,
  Award,
  Sparkles,
  ArrowRight,
  FileText,
  Loader2,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { LoadingAnimation } from './LoadingAnimation';
import { optimizeResume, generateAtsOptimizedSection } from '../services/geminiService';
import { getDetailedResumeScore, generateAfterScore } from '../services/scoringService';
import { paymentService } from '../services/paymentService';
import { ResumeData, UserType, DetailedScore, AdditionalSection } from '../types/resume'; // Import AdditionalSection
import { MissingSectionsModal } from './MissingSectionsModal';
import { ResumePreview } from './ResumePreview';
import { ResumeExportSettings } from './ResumeExportSettings';
import { ExportOptions, defaultExportOptions } from '../types/export';
import { exportToPDF, exportToWord } from '../utils/exportUtils';
import { useNavigate } from 'react-router-dom';

interface GuidedResumeBuilderProps {
  isAuthenticated: boolean;
  onShowAuth: () => void;
  onShowSubscriptionPlans: (featureId?: string) => void;
  onShowAlert: (
    title: string,
    message: string,
    type?: 'info' | 'success' | 'warning' | 'error',
    actionText?: string,
    onAction?: () => void
  ) => void;
  onNavigateBack: () => void;
  userSubscription: any;
  refreshUserSubscription: () => Promise<void>;
  toolProcessTrigger: (() => void) | null;
  setToolProcessTrigger: React.Dispatch<React.SetStateAction<(() => void) | null>>;
}

export const GuidedResumeBuilder: React.FC<GuidedResumeBuilderProps> = ({
  isAuthenticated,
  onShowAuth,
  onShowSubscriptionPlans,
  onShowAlert,
  onNavigateBack,
  userSubscription,
  refreshUserSubscription,
  toolProcessTrigger,
  setToolProcessTrigger,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // --- State for Resume Data ---
  const [resumeData, setResumeData] = useState<ResumeData>({
    name: user?.name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    linkedin: user?.linkedin || '',
    github: user?.github || '',
    location: '',
    targetRole: '',
    summary: '',
    careerObjective: '',
    education: [],
    workExperience: [],
    projects: [],
    skills: [],
    certifications: [],
    additionalSections: [], // NEW: Initialize additionalSections
  });

  // --- State for Wizard Flow ---
  const [currentStep, setCurrentStep] = useState(0);
  const [userType, setUserType] = useState<UserType>('fresher');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCalculatingScore, setIsCalculatingScore] = useState(false);
  const [optimizedResume, setOptimizedResume] = useState<ResumeData | null>(null);
  const [finalDetailedScore, setFinalDetailedScore] = useState<DetailedScore | null>(null);
  const [initialDetailedScore, setInitialDetailedScore] = useState<DetailedScore | null>(null);
  const [exportOptions, setExportOptions] = useState<ExportOptions>(defaultExportOptions);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingWord, setIsExportingWord] = useState(false);
  const [exportStatus, setExportStatus] = useState<{
    type: 'pdf' | 'word' | null;
    status: 'success' | 'error' | null;
    message: string;
  }>({ type: null, status: null, message: '' });

  // --- Missing Sections Modal State ---
  const [showMissingSectionsModal, setShowMissingSectionsModal] = useState(false);
  const [missingSections, setMissingSections] = useState<string[]>([]);
  const [pendingResumeData, setPendingResumeData] = useState<ResumeData | null>(null);

  // --- Helper to update nested state ---
  const updateResumeData = useCallback((field: keyof ResumeData, value: any) => {
    setResumeData((prev) => ({ ...prev, [field]: value }));
  }, []);

  // --- AI Generation Function (simplified for brevity, full logic is in geminiService) ---
  const generateContent = useCallback(
    async (sectionType: string, data: any) => {
      try {
        const result = await generateAtsOptimizedSection(sectionType, data);
        return result;
      } catch (error) {
        console.error(`Error generating ${sectionType}:`, error);
        onShowAlert(
          'AI Generation Failed',
          `Could not generate content for ${sectionType}. Please try again.`,
          'error'
        );
        return null;
      }
    },
    [onShowAlert]
  );

  // --- Handle AI-powered optimization ---
  const handleGenerateResume = useCallback(async () => {
    if (!isAuthenticated) {
      onShowAuth();
      return;
    }
    if (!userSubscription || (userSubscription.guidedBuildsTotal - userSubscription.guidedBuildsUsed) <= 0) {
      onShowSubscriptionPlans('guided-builder');
      return;
    }

    setIsGenerating(true);
    try {
      // Ensure user data is up-to-date for the AI call
      const currentUserName = user?.name || '';
      const currentUserEmail = user?.email || '';
      const currentUserPhone = user?.phone || '';
      const currentUserLinkedin = user?.linkedin || '';
      const currentUserGithub = user?.github || '';

      const generatedResume = await optimizeResume(
        JSON.stringify(resumeData), // Pass current resumeData as string
        '', // No job description for guided builder
        userType,
        currentUserName,
        currentUserEmail,
        currentUserPhone,
        currentUserLinkedin,
        currentUserGithub,
        undefined, // linkedinUrl
        undefined, // githubUrl
        resumeData.targetRole,
        resumeData.additionalSections // NEW: Pass additionalSections to optimizeResume
      );

      setOptimizedResume(generatedResume);

      // Calculate scores
      setIsCalculatingScore(true);
      const initialScore = await getDetailedResumeScore(generatedResume, '', () => {});
      setInitialDetailedScore(initialScore);

      const finalScore = await getDetailedResumeScore(generatedResume, '', () => {});
      setFinalDetailedScore(finalScore);

      // Decrement usage
      const usageResult = await paymentService.useGuidedBuild(user!.id);
      if (usageResult.success) {
        await refreshUserSubscription();
      } else {
        console.error('Failed to decrement guided build usage:', usageResult.error);
      }

      setCurrentStep(steps.length - 1); // Go to final review step
    } catch (error) {
      console.error('Error generating resume:', error);
      onShowAlert('Resume Generation Failed', 'Could not generate your resume. Please try again.', 'error');
    } finally {
      setIsGenerating(false);
      setIsCalculatingScore(false);
    }
  }, [
    isAuthenticated,
    userSubscription,
    onShowAuth,
    onShowSubscriptionPlans,
    resumeData,
    userType,
    user,
    onShowAlert,
    refreshUserSubscription,
  ]);

  // --- Wizard Steps Configuration ---
  const steps = [
    // ... (existing steps like User Type, Contact, Education, Work Experience, Projects, Skills, Certifications)
    {
      id: 'user-type',
      title: 'Your Profile',
      icon: <User className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
            <User className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Tell us about yourself
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                What best describes your current career stage?
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['fresher', 'student', 'experienced'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setUserType(type as UserType)}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      userType === type
                        ? 'border-green-500 bg-green-50 shadow-md dark:border-green-600 dark:bg-green-900/20'
                        : 'border-gray-200 hover:border-green-300 hover:bg-green-50 dark:border-dark-200 dark:hover:border-green-900 dark:hover:bg-green-900/10'
                    }`}
                  >
                    {type === 'fresher' && <User className={`w-6 h-6 mb-2 ${userType === type ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-300'}`} />}
                    {type === 'student' && <GraduationCap className={`w-6 h-6 mb-2 ${userType === type ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-300'}`} />}
                    {type === 'experienced' && <Briefcase className={`w-6 h-6 mb-2 ${userType === type ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-300'}`} />}
                    <span className={`font-semibold text-sm capitalize ${userType === type ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'}`}>
                      {type === 'fresher' ? 'Fresher' : type}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                Target Role (Optional, but recommended for better optimization)
              </label>
              <input
                type="text"
                value={resumeData.targetRole || ''}
                onChange={(e) => updateResumeData('targetRole', e.target.value)}
                placeholder="e.g., Software Engineer, Data Scientist"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
              />
            </div>
          </div>
        </div>
      ),
      isValid: !!userType,
    },
    {
      id: 'contact-info',
      title: 'Contact Info',
      icon: <FileText className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
            <FileText className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
            Contact Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Full Name</label>
              <input
                type="text"
                value={resumeData.name}
                onChange={(e) => updateResumeData('name', e.target.value)}
                placeholder="Your Full Name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Email</label>
              <input
                type="email"
                value={resumeData.email}
                onChange={(e) => updateResumeData('email', e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Phone</label>
              <input
                type="tel"
                value={resumeData.phone}
                onChange={(e) => updateResumeData('phone', e.target.value)}
                placeholder="+1234567890"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">LinkedIn URL</label>
              <input
                type="url"
                value={resumeData.linkedin}
                onChange={(e) => updateResumeData('linkedin', e.target.value)}
                placeholder="https://linkedin.com/in/yourprofile"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">GitHub URL</label>
              <input
                type="url"
                value={resumeData.github}
                onChange={(e) => updateResumeData('github', e.target.value)}
                placeholder="https://github.com/yourprofile"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Location</label>
              <input
                type="text"
                value={resumeData.location || ''}
                onChange={(e) => updateResumeData('location', e.target.value)}
                placeholder="City, State, Country"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
              />
            </div>
          </div>
        </div>
      ),
      isValid: !!resumeData.name && !!resumeData.email && !!resumeData.phone,
    },
    {
      id: 'summary-objective',
      title: userType === 'experienced' ? 'Summary' : 'Objective',
      icon: <Sparkles className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
            <Sparkles className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
            {userType === 'experienced' ? 'Professional Summary' : 'Career Objective'}
          </h2>
          <textarea
            value={userType === 'experienced' ? resumeData.summary || '' : resumeData.careerObjective || ''}
            onChange={(e) =>
              userType === 'experienced'
                ? updateResumeData('summary', e.target.value)
                : updateResumeData('careerObjective', e.target.value)
            }
            placeholder={
              userType === 'experienced'
                ? 'A concise overview of your professional experience and career goals...'
                : 'A brief statement outlining your career aspirations and what you bring to a role...'
            }
            className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
          />
          <button
            onClick={async () => {
              const generatedContent = await generateContent(
                userType === 'experienced' ? 'summary' : 'careerObjective',
                {
                  userType,
                  targetRole: resumeData.targetRole,
                  experience: resumeData.workExperience,
                  education: resumeData.education,
                }
              );
              if (generatedContent) {
                userType === 'experienced'
                  ? updateResumeData('summary', generatedContent)
                  : updateResumeData('careerObjective', generatedContent);
              }
            }}
            className="mt-4 btn-primary flex items-center space-x-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate with AI</span>
          </button>
        </div>
      ),
      isValid:
        userType === 'experienced'
          ? !!resumeData.summary && resumeData.summary.length > 0
          : !!resumeData.careerObjective && resumeData.careerObjective.length > 0,
    },
    {
      id: 'education',
      title: 'Education',
      icon: <GraduationCap className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
            <GraduationCap className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Education
          </h2>
          {resumeData.education.map((edu, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4 dark:border-dark-300">
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    const updated = [...resumeData.education];
                    updated.splice(index, 1);
                    updateResumeData('education', updated);
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  value={edu.degree}
                  onChange={(e) => {
                    const updated = [...resumeData.education];
                    updated[index].degree = e.target.value;
                    updateResumeData('education', updated);
                  }}
                  placeholder="Degree (e.g., B.Tech in Computer Science)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                />
                <input
                  type="text"
                  value={edu.school}
                  onChange={(e) => {
                    const updated = [...resumeData.education];
                    updated[index].school = e.target.value;
                    updateResumeData('education', updated);
                  }}
                  placeholder="University/Institution Name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                />
                <input
                  type="text"
                  value={edu.year}
                  onChange={(e) => {
                    const updated = [...resumeData.education];
                    updated[index].year = e.target.value;
                    updateResumeData('education', updated);
                  }}
                  placeholder="Year (e.g., 2020-2024)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                />
                <input
                  type="text"
                  value={edu.cgpa || ''}
                  onChange={(e) => {
                    const updated = [...resumeData.education];
                    updated[index].cgpa = e.target.value;
                    updateResumeData('education', updated);
                  }}
                  placeholder="CGPA (e.g., 8.5/10)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                />
                <input
                  type="text"
                  value={edu.location || ''}
                  onChange={(e) => {
                    const updated = [...resumeData.education];
                    updated[index].location = e.target.value;
                    updateResumeData('education', updated);
                  }}
                  placeholder="Location (e.g., City, State)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                />
              </div>
            </div>
          ))}
          <button
            onClick={() =>
              updateResumeData('education', [
                ...resumeData.education,
                { degree: '', school: '', year: '' },
              ])
            }
            className="btn-secondary flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Education</span>
          </button>
        </div>
      ),
      isValid: resumeData.education.length > 0 && resumeData.education.every((edu) => edu.degree && edu.school && edu.year),
    },
    {
      id: 'work-experience',
      title: 'Work Experience',
      icon: <Briefcase className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
            <Briefcase className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Work Experience
          </h2>
          {resumeData.workExperience.map((exp, expIndex) => (
            <div key={expIndex} className="border border-gray-200 rounded-lg p-4 mb-4 dark:border-dark-300">
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    const updated = [...resumeData.workExperience];
                    updated.splice(expIndex, 1);
                    updateResumeData('workExperience', updated);
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2 mb-4">
                <input
                  type="text"
                  value={exp.role}
                  onChange={(e) => {
                    const updated = [...resumeData.workExperience];
                    updated[expIndex].role = e.target.value;
                    updateResumeData('workExperience', updated);
                  }}
                  placeholder="Role (e.g., Software Engineer)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                />
                <input
                  type="text"
                  value={exp.company}
                  onChange={(e) => {
                    const updated = [...resumeData.workExperience];
                    updated[expIndex].company = e.target.value;
                    updateResumeData('workExperience', updated);
                  }}
                  placeholder="Company Name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                />
                <input
                  type="text"
                  value={exp.year}
                  onChange={(e) => {
                    const updated = [...resumeData.workExperience];
                    updated[expIndex].year = e.target.value;
                    updateResumeData('workExperience', updated);
                  }}
                  placeholder="Duration (e.g., Jan 2023 - Present)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                />
              </div>
              <h4 className="text-md font-semibold text-gray-800 mb-2 dark:text-gray-200">Bullet Points</h4>
              {exp.bullets.map((bullet, bulletIndex) => (
                <div key={bulletIndex} className="flex items-center space-x-2 mb-2">
                  <textarea
                    value={bullet}
                    onChange={(e) => {
                      const updated = [...resumeData.workExperience];
                      updated[expIndex].bullets[bulletIndex] = e.target.value;
                      updateResumeData('workExperience', updated);
                    }}
                    placeholder="Describe your achievement/responsibility"
                    className="flex-grow px-3 py-2 border border-gray-300 rounded-lg dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  />
                  <button
                    onClick={() => {
                      const updated = [...resumeData.workExperience];
                      updated[expIndex].bullets.splice(bulletIndex, 1);
                      updateResumeData('workExperience', updated);
                    }}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const updated = [...resumeData.workExperience];
                  updated[expIndex].bullets.push('');
                  updateResumeData('workExperience', updated);
                }}
                className="btn-secondary flex items-center space-x-2 mt-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Bullet</span>
              </button>
              <button
                onClick={async () => {
                  const generatedBullets = await generateContent('workExperienceBullets', {
                    role: exp.role,
                    company: exp.company,
                    year: exp.year,
                    description: exp.bullets.join(' '),
                    userType,
                  });
                  if (generatedBullets && Array.isArray(generatedBullets)) {
                    const updated = [...resumeData.workExperience];
                    updated[expIndex].bullets = generatedBullets;
                    updateResumeData('workExperience', updated);
                  }
                }}
                className="btn-primary flex items-center space-x-2 mt-4"
              >
                <Sparkles className="w-4 h-4" />
                <span>Optimize Bullets with AI</span>
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              updateResumeData('workExperience', [
                ...resumeData.workExperience,
                { role: '', company: '', year: '', bullets: [''] },
              ])
            }
            className="btn-secondary flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Work Experience</span>
          </button>
        </div>
      ),
      isValid:
        resumeData.workExperience.length > 0 &&
        resumeData.workExperience.every(
          (exp) => exp.role && exp.company && exp.year && exp.bullets.every((b) => b.length > 0)
        ),
    },
    {
      id: 'projects',
      title: 'Projects',
      icon: <Code className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
            <Code className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Projects
          </h2>
          {resumeData.projects.map((project, projIndex) => (
            <div key={projIndex} className="border border-gray-200 rounded-lg p-4 mb-4 dark:border-dark-300">
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    const updated = [...resumeData.projects];
                    updated.splice(projIndex, 1);
                    updateResumeData('projects', updated);
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2 mb-4">
                <input
                  type="text"
                  value={project.title}
                  onChange={(e) => {
                    const updated = [...resumeData.projects];
                    updated[projIndex].title = e.target.value;
                    updateResumeData('projects', updated);
                  }}
                  placeholder="Project Title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                />
              </div>
              <h4 className="text-md font-semibold text-gray-800 mb-2 dark:text-gray-200">Bullet Points</h4>
              {project.bullets.map((bullet, bulletIndex) => (
                <div key={bulletIndex} className="flex items-center space-x-2 mb-2">
                  <textarea
                    value={bullet}
                    onChange={(e) => {
                      const updated = [...resumeData.projects];
                      updated[projIndex].bullets[bulletIndex] = e.target.value;
                      updateResumeData('projects', updated);
                    }}
                    placeholder="Describe project achievement/feature"
                    className="flex-grow px-3 py-2 border border-gray-300 rounded-lg dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  />
                  <button
                    onClick={() => {
                      const updated = [...resumeData.projects];
                      updated[projIndex].bullets.splice(bulletIndex, 1);
                      updateResumeData('projects', updated);
                    }}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const updated = [...resumeData.projects];
                  updated[projIndex].bullets.push('');
                  updateResumeData('projects', updated);
                }}
                className="btn-secondary flex items-center space-x-2 mt-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Bullet</span>
              </button>
              <button
                onClick={async () => {
                  const generatedBullets = await generateContent('projectBullets', {
                    title: project.title,
                    description: project.bullets.join(' '),
                    userType,
                  });
                  if (generatedBullets && Array.isArray(generatedBullets)) {
                    const updated = [...resumeData.projects];
                    updated[projIndex].bullets = generatedBullets;
                    updateResumeData('projects', updated);
                  }
                }}
                className="btn-primary flex items-center space-x-2 mt-4"
              >
                <Sparkles className="w-4 h-4" />
                <span>Optimize Bullets with AI</span>
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              updateResumeData('projects', [
                ...resumeData.projects,
                { title: '', bullets: [''] },
              ])
            }
            className="btn-secondary flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Project</span>
          </button>
        </div>
      ),
      isValid:
        resumeData.projects.length > 0 &&
        resumeData.projects.every(
          (proj) => proj.title && proj.bullets.every((b) => b.length > 0)
        ),
    },
    {
      id: 'skills',
      title: 'Skills',
      icon: <Target className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
            <Target className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Skills
          </h2>
          {resumeData.skills.map((skillCategory, catIndex) => (
            <div key={catIndex} className="border border-gray-200 rounded-lg p-4 mb-4 dark:border-dark-300">
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    const updated = [...resumeData.skills];
                    updated.splice(catIndex, 1);
                    updateResumeData('skills', updated);
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2 mb-4">
                <input
                  type="text"
                  value={skillCategory.category}
                  onChange={(e) => {
                    const updated = [...resumeData.skills];
                    updated[catIndex].category = e.target.value;
                    updateResumeData('skills', updated);
                  }}
                  placeholder="Skill Category (e.g., Programming Languages)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                />
              </div>
              <h4 className="text-md font-semibold text-gray-800 mb-2 dark:text-gray-200">Skills List (comma-separated)</h4>
              <textarea
                value={skillCategory.list.join(', ')}
                onChange={(e) => {
                  const updated = [...resumeData.skills];
                  updated[catIndex].list = e.target.value.split(',').map((s) => s.trim());
                  updateResumeData('skills', updated);
                }}
                placeholder="e.g., JavaScript, Python, React, Node.js"
                className="w-full h-24 p-3 border border-gray-300 rounded-lg dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
              />
              <button
                onClick={async () => {
                  const generatedSkills = await generateContent('skillsList', {
                    category: skillCategory.category,
                    existingSkills: skillCategory.list,
                    userType,
                    targetRole: resumeData.targetRole,
                  });
                  if (generatedSkills && Array.isArray(generatedSkills)) {
                    const updated = [...resumeData.skills];
                    updated[catIndex].list = generatedSkills;
                    updateResumeData('skills', updated);
                  }
                }}
                className="btn-primary flex items-center space-x-2 mt-4"
              >
                <Sparkles className="w-4 h-4" />
                <span>Optimize Skills with AI</span>
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              updateResumeData('skills', [
                ...resumeData.skills,
                { category: '', count: 0, list: [] },
              ])
            }
            className="btn-secondary flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Skill Category</span>
          </button>
        </div>
      ),
      isValid:
        resumeData.skills.length > 0 &&
        resumeData.skills.every((skill) => skill.category && skill.list.length > 0),
    },
    {
      id: 'certifications',
      title: 'Certifications',
      icon: <Award className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
            <Award className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Certifications
          </h2>
          {resumeData.certifications.map((cert, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4 dark:border-dark-300">
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    const updated = [...resumeData.certifications];
                    updated.splice(index, 1);
                    updateResumeData('certifications', updated);
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  value={typeof cert === 'string' ? cert : cert.title}
                  onChange={(e) => {
                    const updated = [...resumeData.certifications];
                    updated[index] = { title: e.target.value, description: '' };
                    updateResumeData('certifications', updated);
                  }}
                  placeholder="Certification Name (e.g., AWS Certified Developer)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                />
                <textarea
                  value={typeof cert === 'string' ? '' : cert.description || ''}
                  onChange={(e) => {
                    const updated = [...resumeData.certifications];
                    updated[index] = {
                      title: typeof cert === 'string' ? cert : cert.title,
                      description: e.target.value,
                    };
                    updateResumeData('certifications', updated);
                  }}
                  placeholder="Description (e.g., Issued by Amazon Web Services)"
                  className="w-full h-24 p-3 border border-gray-300 rounded-lg dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                />
              </div>
            </div>
          ))}
          <button
            onClick={() =>
              updateResumeData('certifications', [
                ...resumeData.certifications,
                { title: '', description: '' },
              ])
            }
            className="btn-secondary flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Certification</span>
          </button>
        </div>
      ),
      isValid: true, // Certifications are optional
    },
    // NEW STEP: Additional Sections
    {
      id: 'additional-sections',
      title: 'Additional Sections',
      icon: <Plus className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
            <Plus className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Custom Sections (e.g., Awards, Volunteer Work, Languages)
          </h2>
          {resumeData.additionalSections.map((section, secIndex) => (
            <div key={secIndex} className="border border-gray-200 rounded-lg p-4 mb-4 dark:border-dark-300">
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    const updated = [...resumeData.additionalSections];
                    updated.splice(secIndex, 1);
                    updateResumeData('additionalSections', updated);
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2 mb-4">
                <input
                  type="text"
                  value={section.title}
                  onChange={(e) => {
                    const updated = [...resumeData.additionalSections];
                    updated[secIndex].title = e.target.value;
                    updateResumeData('additionalSections', updated);
                  }}
                  placeholder="Section Title (e.g., Awards, Volunteer Experience)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                />
              </div>
              <h4 className="text-md font-semibold text-gray-800 mb-2 dark:text-gray-200">Bullet Points</h4>
              {section.bullets.map((bullet, bulletIndex) => (
                <div key={bulletIndex} className="flex items-center space-x-2 mb-2">
                  <textarea
                    value={bullet}
                    onChange={(e) => {
                      const updated = [...resumeData.additionalSections];
                      updated[secIndex].bullets[bulletIndex] = e.target.value;
                      updateResumeData('additionalSections', updated);
                    }}
                    placeholder="Describe achievement or detail for this section"
                    className="flex-grow px-3 py-2 border border-gray-300 rounded-lg dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  />
                  <button
                    onClick={() => {
                      const updated = [...resumeData.additionalSections];
                      updated[secIndex].bullets.splice(bulletIndex, 1);
                      updateResumeData('additionalSections', updated);
                    }}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const updated = [...resumeData.additionalSections];
                  updated[secIndex].bullets.push('');
                  updateResumeData('additionalSections', updated);
                }}
                className="btn-secondary flex items-center space-x-2 mt-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Bullet</span>
              </button>
              <button
                onClick={async () => {
                  const generatedBullets = await generateContent('additionalSectionBullets', {
                    title: section.title,
                    details: section.bullets.join(' '),
                    userType,
                  });
                  if (generatedBullets && Array.isArray(generatedBullets)) {
                    const updated = [...resumeData.additionalSections];
                    updated[secIndex].bullets = generatedBullets;
                    updateResumeData('additionalSections', updated);
                  }
                }}
                className="btn-primary flex items-center space-x-2 mt-4"
              >
                <Sparkles className="w-4 h-4" />
                <span>Optimize Bullets with AI</span>
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              updateResumeData('additionalSections', [
                ...resumeData.additionalSections,
                { title: '', bullets: [''] },
              ])
            }
            className="btn-secondary flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Custom Section</span>
          </button>
        </div>
      ),
      isValid: true, // Additional sections are optional
    },
    {
      id: 'review-generate',
      title: 'Review & Generate',
      icon: <Sparkles className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
            <Sparkles className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" />
            Review & Generate Resume
          </h2>
          <div className="text-center space-y-6">
            <p className="text-gray-700 dark:text-gray-300">
              You're all set! Review your details and generate your ATS-optimized resume.
            </p>
            <button
              type="button"
onClick={handleGenerateResume}
disabled={isGenerating}
className="w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center space-x-3 mx-auto shadow-xl hover:shadow-2xl btn-primary"

            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6" />
                  <span>Generate My Resume</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      ),
      isValid: true,
    },
    {
      id: 'final-review',
      title: 'Final Resume',
      icon: <CheckCircle className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center dark:text-gray-100">
            <CheckCircle className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
            Your Optimized Resume
          </h2>
          {optimizedResume ? (
            <>
              <ResumeExportSettings
                resumeData={optimizedResume}
                userType={userType}
                onExport={async (options, format) => {
                  setExportOptions(options);
                  if (format === 'pdf') {
                    setIsExportingPDF(true);
                    try {
                      await exportToPDF(optimizedResume, userType, options);
                      setExportStatus({
                        type: 'pdf',
                        status: 'success',
                        message: 'PDF exported successfully!',
                      });
                    } catch (error) {
                      console.error('PDF export failed:', error);
                      setExportStatus({
                        type: 'pdf',
                        status: 'error',
                        message: 'PDF export failed. Please try again.',
                      });
                    } finally {
                      setIsExportingPDF(false);
                    }
                  } else {
                    setIsExportingWord(true);
                    try {
                      await exportToWord(optimizedResume, userType);
                      setExportStatus({
                        type: 'word',
                        status: 'success',
                        message: 'Word document exported successfully!',
                      });
                    } catch (error) {
                      console.error('Word export failed:', error);
                      setExportStatus({
                        type: 'word',
                        status: 'error',
                        message: 'Word document export failed. Please try again.',
                      });
                    } finally {
                      setIsExportingWord(false);
                    }
                  }
                }}
              />
              {exportStatus.status && (
                <div
                  className={`mt-4 p-3 rounded-lg border ${
                    exportStatus.status === 'success'
                      ? 'bg-green-50 border-green-200 text-green-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  <div className="flex items-center">
                    {exportStatus.status === 'success' ? (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    ) : (
                      <AlertCircle className="w-4 h-4 mr-2" />
                    )}
                    <span className="text-sm font-medium">{exportStatus.message}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-600 dark:text-gray-300">Resume not yet generated.</p>
          )}
        </div>
      ),
      isValid: true,
    },
  ];

  // --- Wizard Navigation ---
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

  // --- Render Logic ---
  if (isGenerating || isCalculatingScore) {
    return (
      <LoadingAnimation
        message={isGenerating ? 'Generating Your Resume...' : 'Calculating Final Score...'}
        submessage={
          isGenerating
            ? 'Our AI is crafting your personalized, ATS-optimized resume.'
            : 'Analyzing your new resume against industry standards.'
        }
      />
    );
  }

  const currentStepData = steps[currentStep];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pb-16 dark:from-dark-50 dark:to-dark-200 transition-colors duration-300">
      <div className="container-responsive py-8">
        <button
          onClick={onNavigateBack}
          className="mb-6 bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 text-white hover:from-neon-cyan-400 hover:to-neon-blue-400 active:from-neon-cyan-600 active:to-neon-blue-600 shadow-md hover:shadow-neon-cyan py-3 px-5 rounded-xl inline-flex items-center space-x-2 transition-all duration-200"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:block">Back to Home</span>
        </button>

        <div className="max-w-7xl mx-auto space-y-6">
          {/* Progress Indicator */}
          <div className="bg-white rounded-xl shadow-lg p-3 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Guided Resume Builder</h1>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Step {currentStep + 1} of {steps.length}
              </div>
            </div>

            <div className="flex items-center justify-between overflow-x-auto pb-2">
              {steps.map((step, index) => (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center flex-shrink-0 px-2">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                        index < currentStep
                          ? 'bg-green-500 text-white'
                          : index === currentStep
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-500 dark:bg-dark-200 dark:text-gray-400'
                      }`}
                    >
                      {index < currentStep ? <CheckCircle className="w-5 h-5" /> : step.icon}
                    </div>
                    <span
                      className={`text-xs mt-2 font-medium text-center ${
                        index <= currentStep ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-1 rounded-full mx-2 transition-all duration-300 ${
                        index < currentStep ? 'bg-green-500' : 'bg-gray-200 dark:bg-dark-200'
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Current Step Content */}
          <div className="transition-all duration-300">{currentStepData.component}</div>

          {/* Navigation Buttons */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
            <div className="flex justify-between items-center gap-2">
              <button
                onClick={handlePrevious}
                disabled={currentStep === 0}
                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 sm:w-auto flex-shrink-0 ${
                  currentStep === 0
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-dark-200 dark:text-gray-500'
                    : 'bg-gray-600 hover:bg-gray-700 text-white shadow-lg hover:shadow-xl dark:bg-gray-700 dark:hover:bg-gray-800'
                }`}
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Previous</span>
              </button>

              <div className="text-center flex-grow sm:w-48 flex-shrink-0">
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
                  className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 sm:w-auto flex-shrink-0 ${
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
      </div>
    </div>
  );
};

export default GuidedResumeBuilder;
