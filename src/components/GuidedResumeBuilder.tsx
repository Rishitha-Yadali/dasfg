// src/components/GuidedResumeBuilder.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Eye,
  User,
  Briefcase,
  Target,
  GraduationCap,
  Code,
  Award, // For Certifications and Achievements
  Sparkles,
  Loader2,
  Mail,
  Phone,
  Linkedin,
  Github,
  MapPin,
  FileText,
  Plus,
  X,
  Building,
  Calendar,
  Link as LinkIcon, // <-- fix: import the Link icon
} from 'lucide-react';
// Removed useNavigate (unused)
// import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ResumeData, UserType } from '../types/resume';
import { ResumePreview } from './ResumePreview';
import { LoadingAnimation } from './LoadingAnimation';
import { paymentService } from '../services/paymentService';
import { getDetailedResumeScore } from '../services/scoringService';

// --- Interfaces (Copied from separate files) ---
interface PersonalInfoData {
  fullName: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  location: string;
  // summary and careerObjective removed
  targetRole: string;
}

interface EducationData {
  degree: string;
  school: string;
  year: string;
  cgpa?: string;
  location?: string;
}

interface WorkExperienceData {
  role: string;
  company: string;
  year: string;
  bullets: string[];
}

interface ProjectData {
  title: string;
  bullets: string[];
  githubUrl?: string;
}

interface SkillData {
  category: string;
  count: number;
  list: string[];
}

interface CertificationData {
  title: string;
  description: string;
}

// --- Main Component ---
interface GuidedResumeBuilderProps {
  isAuthenticated: boolean;
  onShowAuth: () => void;
  onShowProfile: (mode?: 'profile' | 'wallet') => void;
  onNavigateBack: () => void;
  userSubscription: any;
  refreshUserSubscription: () => Promise<void>;
  onShowSubscriptionPlans: (featureId?: string) => void;
  toolProcessTrigger: (() => void) | null;
  setToolProcessTrigger: React.Dispatch<React.SetStateAction<(() => void) | null>>;
}

export const GuidedResumeBuilder: React.FC<GuidedResumeBuilderProps> = ({
  isAuthenticated,
  onShowAuth,
  onShowProfile,
  onNavigateBack,
  userSubscription,
  refreshUserSubscription,
  onShowSubscriptionPlans,
  toolProcessTrigger,
  setToolProcessTrigger,
}) => {
  const { user } = useAuth();
  // const navigate = useNavigate(); // removed (unused)

  const [currentStep, setCurrentStep] = useState(0);
  const [userType, setUserType] = useState<UserType>('fresher');
  const [personalInfo, setPersonalInfo] = useState<PersonalInfoData>({
    fullName: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    linkedin: user?.linkedin || '',
    github: user?.github || '',
    location: '',
    targetRole: '',
  });
  const [education, setEducation] = useState<EducationData[]>([
    { degree: '', school: '', year: '', cgpa: '', location: '' },
  ]);
  const [workExperience, setWorkExperience] = useState<WorkExperienceData[]>([
    { role: '', company: '', year: '', bullets: [''] },
  ]);
  const [projects, setProjects] = useState<ProjectData[]>([
    { title: '', bullets: [''] },
  ]);
  const [skills, setSkills] = useState<SkillData[]>([
    { category: '', count: 0, list: [] },
  ]);

  // NEW: per-category input value so users can actually type skills
  const [skillInputs, setSkillInputs] = useState<Record<number, string>>({});

  const [certifications, setCertifications] = useState<CertificationData[]>([
    { title: '', description: '' },
  ]);
  const [achievements, setAchievements] = useState<string[]>(['']);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResume, setGeneratedResume] = useState<ResumeData | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [loadingScore, setLoadingScore] = useState(false);

  const generateResumeData = useCallback((): ResumeData => {
    return {
      name: personalInfo.fullName,
      phone: personalInfo.phone,
      email: personalInfo.email,
      linkedin: personalInfo.linkedin,
      github: personalInfo.github,
      location: personalInfo.location,
      targetRole: personalInfo.targetRole,
      education: education.filter(
        (edu) => edu.degree.trim() || edu.school.trim() || edu.year.trim()
      ),
      workExperience: workExperience
        .filter((we) => we.role.trim() || we.company.trim() || we.year.trim())
        .map((we) => ({
          ...we,
          bullets: we.bullets.filter((b) => b.trim()),
        })),
      projects: projects
        .filter((p) => p.title.trim() || p.bullets.some((b) => b.trim()))
        .map((p) => ({
          ...p,
          bullets: p.bullets.filter((b) => b.trim()),
        })),
      skills: skills
        .filter((s) => s.category.trim() || s.list.some((item) => item.trim()))
        .map((s) => ({
          ...s,
          list: s.list.filter((item) => item.trim()),
        })),
      certifications: certifications.filter((c) => c.title.trim() || c.description.trim()),
      achievements: achievements.filter((a) => a.trim()),
      origin: 'guided',
    };
  }, [personalInfo, education, workExperience, projects, skills, certifications, achievements]);

  const handleGenerateResume = useCallback(async () => {
    if (!isAuthenticated) {
      onShowAuth();
      return;
    }

    const creditsLeft =
      (userSubscription?.guidedBuildsTotal || 0) - (userSubscription?.guidedBuildsUsed || 0);

    if (!userSubscription || creditsLeft <= 0) {
      onShowSubscriptionPlans('guided-builder');
      return;
    }

    setIsGenerating(true);
    try {
      const resumeData = generateResumeData();
      setGeneratedResume(resumeData);

      // Decrement usage
      const usageResult = await paymentService.useGuidedBuild(userSubscription.userId);
      if (usageResult.success) {
        await refreshUserSubscription();
      } else {
        console.error('Failed to decrement guided build usage:', usageResult.error);
      }

      // Calculate score
      setLoadingScore(true);
      const detailedScore = await getDetailedResumeScore(resumeData, '', setLoadingScore);
      setScore(detailedScore.totalScore);
    } catch (error) {
      console.error('Error generating resume:', error);
      alert('Failed to generate resume. Please try again.');
    } finally {
      setIsGenerating(false);
      setLoadingScore(false);
    }
  }, [
    isAuthenticated,
    onShowAuth,
    userSubscription,
    onShowSubscriptionPlans,
    generateResumeData,
    refreshUserSubscription,
  ]);

  useEffect(() => {
    setToolProcessTrigger(() => handleGenerateResume);
    return () => {
      setToolProcessTrigger(null);
    };
  }, [setToolProcessTrigger, handleGenerateResume]);

  // --- Inline Component Logic ---

  // GuidedPersonalInfo Logic
  const handlePersonalInfoChange = (data: PersonalInfoData) => {
    setPersonalInfo(data);
  };

  // GuidedExperienceLevel Logic
  const handleUserTypeChange = (type: UserType) => {
    setUserType(type);
  };

  // GuidedEducation Logic
  const handleEducationChange = (data: EducationData[]) => {
    setEducation(data);
  };
  const addEducation = () => {
    setEducation([...education, { degree: '', school: '', year: '', cgpa: '', location: '' }]);
  };
  const updateEducation = (index: number, field: keyof EducationData, value: string) => {
    const updated = [...education];
    updated[index] = { ...updated[index], [field]: value };
    setEducation(updated);
  };
  const removeEducation = (index: number) => {
    if (education.length > 1) {
      setEducation(education.filter((_, i) => i !== index));
    } else {
      setEducation([{ degree: '', school: '', year: '', cgpa: '', location: '' }]);
    }
  };

  // GuidedWorkExperience Logic
  const handleWorkExperienceChange = (data: WorkExperienceData[]) => {
    setWorkExperience(data);
  };
  const addWorkExperience = () => {
    setWorkExperience([...workExperience, { role: '', company: '', year: '', bullets: [''] }]);
  };
  const updateWorkExperience = (index: number, field: keyof WorkExperienceData, value: string) => {
    const updated = [...workExperience];
    updated[index] = { ...updated[index], [field]: value };
    setWorkExperience(updated);
  };
  const removeWorkExperience = (index: number) => {
    if (workExperience.length > 1) {
      setWorkExperience(workExperience.filter((_, i) => i !== index));
    } else {
      setWorkExperience([{ role: '', company: '', year: '', bullets: [''] }]);
    }
  };
  const addWorkBullet = (workIndex: number) => {
    const updated = [...workExperience];
    updated[workIndex].bullets.push('');
    setWorkExperience(updated);
  };
  const updateWorkBullet = (workIndex: number, bulletIndex: number, value: string) => {
    const updated = [...workExperience];
    updated[workIndex].bullets[bulletIndex] = value;
    setWorkExperience(updated);
  };
  const removeWorkBullet = (workIndex: number, bulletIndex: number) => {
    const updated = [...workExperience];
    if (updated[workIndex].bullets.length > 1) {
      updated[workIndex].bullets.splice(bulletIndex, 1);
      setWorkExperience(updated);
    }
  };

  // GuidedProjects Logic
  const handleProjectsChange = (data: ProjectData[]) => {
    setProjects(data);
  };
  const addProject = () => {
    setProjects([...projects, { title: '', bullets: [''], githubUrl: '' }]);
  };
  const updateProject = (index: number, field: keyof ProjectData, value: string) => {
    const updated = [...projects];
    updated[index] = { ...updated[index], [field]: value };
    setProjects(updated);
  };
  const removeProject = (index: number) => {
    if (projects.length > 1) {
      setProjects(projects.filter((_, i) => i !== index));
    } else {
      setProjects([{ title: '', bullets: [''], githubUrl: '' }]);
    }
  };
  const addProjectBullet = (projectIndex: number) => {
    const updated = [...projects];
    updated[projectIndex].bullets.push('');
    setProjects(updated);
  };
  const updateProjectBullet = (projectIndex: number, bulletIndex: number, value: string) => {
    const updated = [...projects];
    updated[projectIndex].bullets[bulletIndex] = value;
    setProjects(updated);
  };
  const removeProjectBullet = (projectIndex: number, bulletIndex: number) => {
    const updated = [...projects];
    if (updated[projectIndex].bullets.length > 1) {
      updated[projectIndex].bullets.splice(bulletIndex, 1);
      setProjects(updated);
    }
  };

  // GuidedSkills Logic
  const handleSkillsChange = (data: SkillData[]) => {
    setSkills(data);
  };
  const addSkillCategory = () => {
    setSkills([...skills, { category: '', count: 0, list: [] }]);
  };
  const updateSkillCategory = (
    index: number,
    field: keyof SkillData,
    value: string | string[]
  ) => {
    const updated = [...skills];
    if (field === 'list') {
      updated[index] = { ...updated[index], list: value as string[], count: (value as string[]).length };
    } else {
      updated[index] = { ...updated[index], [field]: value as string };
    }
    setSkills(updated);
  };
  const removeSkillCategory = (index: number) => {
    if (skills.length > 1) {
      setSkills(skills.filter((_, i) => i !== index));
    } else {
      setSkills([{ category: '', count: 0, list: [] }]);
    }
    setSkillInputs((prev) => {
      const copy = { ...prev };
      delete copy[index];
      return copy;
    });
  };

  // Helper: add skill(s) from input; supports comma-separated
  const addSkillToCategory = (categoryIndex: number, raw: string) => {
    const text = raw.trim();
    if (!text) return;

    const entries = text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const updated = [...skills];
    const currentList = [...updated[categoryIndex].list];

    for (const item of entries) {
      if (!currentList.includes(item)) currentList.push(item);
    }

    updateSkillCategory(categoryIndex, 'list', currentList);
    setSkillInputs((prev) => ({ ...prev, [categoryIndex]: '' }));
  };

  const removeSkillFromCategory = (categoryIndex: number, skillIndex: number) => {
    const updated = [...skills];
    const newSkillList = updated[categoryIndex].list.filter((_, i) => i !== skillIndex);
    updateSkillCategory(categoryIndex, 'list', newSkillList);
  };

  // GuidedCertifications Logic
  const handleCertificationsChange = (data: CertificationData[]) => {
    setCertifications(data);
  };
  const addCertification = () => {
    setCertifications([...certifications, { title: '', description: '' }]);
  };
  const updateCertification = (index: number, field: keyof CertificationData, value: string) => {
    const updated = [...certifications];
    updated[index] = { ...updated[index], [field]: value };
    setCertifications(updated);
  };
  const removeCertification = (index: number) => {
    if (certifications.length > 1) {
      setCertifications(certifications.filter((_, i) => i !== index));
    } else {
      setCertifications([{ title: '', description: '' }]);
    }
  };

  // GuidedAchievements Logic
  const handleAchievementsChange = (data: string[]) => {
    setAchievements(data);
  };
  const addAchievement = () => {
    setAchievements([...achievements, '']);
  };
  const updateAchievement = (index: number, value: string) => {
    const updated = [...achievements];
    updated[index] = value;
    setAchievements(updated);
  };
  const removeAchievement = (index: number) => {
    if (achievements.length > 1) {
      setAchievements(achievements.filter((_, i) => i !== index));
    } else {
      setAchievements(['']);
    }
  };

  // --- Steps Definition ---
  const steps = [
    {
      id: 'personalInfo',
      title: 'Personal Information',
      icon: <User className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
          <div className="text-center mb-6">
            <div className="bg-blue-100 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <User className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Personal Information</h3>
            <p className="text-sm sm:text-base text-gray-600">Let's start with your basic contact details.</p>
          </div>
          <div className="space-y-4 sm:space-y-6">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Full Name *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={personalInfo.fullName}
                  onChange={(e) =>
                    handlePersonalInfoChange({ ...personalInfo, fullName: e.target.value })
                  }
                  placeholder="Your full name"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm min-h-[44px]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Email *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={personalInfo.email}
                  onChange={(e) =>
                    handlePersonalInfoChange({ ...personalInfo, email: e.target.value })
                  }
                  placeholder="your.email@example.com"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm min-h-[44px]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="tel"
                  value={personalInfo.phone}
                  onChange={(e) =>
                    handlePersonalInfoChange({ ...personalInfo, phone: e.target.value })
                  }
                  placeholder="+1 (555) 123-4567"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm min-h-[44px]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                LinkedIn Profile URL
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Linkedin className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="url"
                  value={personalInfo.linkedin}
                  onChange={(e) =>
                    handlePersonalInfoChange({ ...personalInfo, linkedin: e.target.value })
                  }
                  placeholder="https://linkedin.com/in/yourprofile"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm min-h-[44px]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                GitHub Profile URL
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Github className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="url"
                  value={personalInfo.github}
                  onChange={(e) =>
                    handlePersonalInfoChange({ ...personalInfo, github: e.target.value })
                  }
                  placeholder="https://github.com/yourusername"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm min-h-[44px]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Location</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MapPin className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={personalInfo.location}
                  onChange={(e) =>
                    handlePersonalInfoChange({ ...personalInfo, location: e.target.value })
                  }
                  placeholder="City, State, Country"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm min-h-[44px]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                Target Role (Optional)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Briefcase className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={personalInfo.targetRole}
                  onChange={(e) =>
                    handlePersonalInfoChange({ ...personalInfo, targetRole: e.target.value })
                  }
                  placeholder="e.g., Software Engineer, Product Manager"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm min-h-[44px]"
                />
              </div>
            </div>
          </div>
        </div>
      ),
      isValid: personalInfo.fullName.trim() !== '' && personalInfo.email.trim() !== '',
    },
    {
      id: 'experienceLevel',
      title: 'Experience Level',
      icon: <Briefcase className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
          <div className="text-center mb-6">
            <div className="bg-purple-100 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Briefcase className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Experience Level</h3>
            <p className="text-sm sm:text-base text-gray-600">
              This helps us tailor the resume sections to your needs.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <button
              onClick={() => handleUserTypeChange('fresher')}
              className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all cursor-pointer ${
                userType === 'fresher'
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              <User
                className={`w-8 h-8 mb-3 ${
                  userType === 'fresher' ? 'text-blue-600' : 'text-gray-500'
                }`}
              />
              <span
                className={`font-semibold text-lg mb-2 ${
                  userType === 'fresher' ? 'text-blue-600' : 'text-gray-900'
                }`}
              >
                Fresher
              </span>
              <span className="text-sm text-gray-500 text-center">
                Just starting out, less than 1 year experience.
              </span>
            </button>
            <button
              onClick={() => handleUserTypeChange('student')}
              className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all cursor-pointer ${
                userType === 'student'
                  ? 'border-green-500 bg-green-50 shadow-md'
                  : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
              }`}
            >
              <GraduationCap
                className={`w-8 h-8 mb-3 ${
                  userType === 'student' ? 'text-green-600' : 'text-gray-500'
                }`}
              />
              <span
                className={`font-semibold text-lg mb-2 ${
                  userType === 'student' ? 'text-green-600' : 'text-gray-900'
                }`}
              >
                Student
              </span>
              <span className="text-sm text-gray-500 text-center">
                Currently enrolled in a degree program.
              </span>
            </button>
            <button
              onClick={() => handleUserTypeChange('experienced')}
              className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all cursor-pointer ${
                userType === 'experienced'
                  ? 'border-purple-500 bg-purple-50 shadow-md'
                  : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
              }`}
            >
              <Briefcase
                className={`w-8 h-8 mb-3 ${
                  userType === 'experienced' ? 'text-purple-600' : 'text-gray-500'
                }`}
              />
              <span
                className={`font-semibold text-lg mb-2 ${
                  userType === 'experienced' ? 'text-purple-600' : 'text-gray-900'
                }`}
              >
                Experienced
              </span>
              <span className="text-sm text-gray-500 text-center">
                1+ years of professional work experience.
              </span>
            </button>
          </div>
        </div>
      ),
      isValid: true,
    },
    {
      id: 'education',
      title: 'Education',
      icon: <GraduationCap className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
          <div className="text-center mb-6">
            <div className="bg-green-100 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <GraduationCap className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Education</h3>
            <p className="text-sm sm:text-base text-gray-600">Tell us about your academic background.</p>
          </div>
          <div className="space-y-4 sm:space-y-6">
            {education.map((edu, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg sm:rounded-xl p-3 sm:p-4 space-y-3 sm:space-y-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900 text-sm sm:text-base">
                    Education #{index + 1}
                  </h4>
                  {education.length > 1 && (
                    <button
                      onClick={() => removeEducation(index)}
                      className="text-red-600 hover:text-red-700 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                      <X className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Degree/Major *
                  </label>
                  <input
                    type="text"
                    value={edu.degree}
                    onChange={(e) => updateEducation(index, 'degree', e.target.value)}
                    placeholder="e.g., Bachelor of Technology in Computer Science"
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Institution *
                  </label>
                  <input
                    type="text"
                    value={edu.school}
                    onChange={(e) => updateEducation(index, 'school', e.target.value)}
                    placeholder="e.g., Indian Institute of Technology Bombay"
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm min-h-[44px]"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                      Year *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Calendar className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={edu.year}
                        onChange={(e) => updateEducation(index, 'year', e.target.value)}
                        placeholder="e.g., 2020-2024"
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm min-h-[44px]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                      CGPA/GPA (Optional)
                    </label>
                    <input
                      type="text"
                      value={edu.cgpa || ''}
                      onChange={(e) => updateEducation(index, 'cgpa', e.target.value)}
                      placeholder="e.g., 8.5/10 or 3.8/4.0"
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm min-h-[44px]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Location (Optional)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MapPin className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={edu.location || ''}
                      onChange={(e) => updateEducation(index, 'location', e.target.value)}
                      placeholder="e.g., Mumbai, India"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm min-h-[44px]"
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={addEducation}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg sm:rounded-xl p-3 sm:p-4 text-gray-600 hover:text-gray-800 hover:border-gray-400 transition-colors flex items-center justify-center text-sm min-h-[44px]"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Add Another Education Entry
            </button>
          </div>
        </div>
      ),
      isValid: education.some(
        (edu) => edu.degree.trim() !== '' && edu.school.trim() !== '' && edu.year.trim() !== ''
      ),
    },
    {
      id: 'workExperience',
      title: 'Work Experience',
      icon: <Briefcase className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
          <div className="text-center mb-6">
            <div className="bg-blue-100 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Briefcase className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Work Experience</h3>
            <p className="text-sm sm:text-base text-gray-600">
              List your professional work experience, internships, or significant roles.
            </p>
          </div>
          <div className="space-y-4 sm:space-y-6">
            {workExperience.map((work, workIndex) => (
              <div
                key={workIndex}
                className="border border-gray-200 rounded-lg sm:rounded-xl p-3 sm:p-4 space-y-3 sm:space-y-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900 text-sm sm:text-base">
                    Experience #{workIndex + 1}
                  </h4>
                  {workExperience.length > 1 && (
                    <button
                      onClick={() => removeWorkExperience(workIndex)}
                      className="text-red-600 hover:text-red-700 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                      <X className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Job Title *
                  </label>
                  <input
                    type="text"
                    value={work.role}
                    onChange={(e) => updateWorkExperience(workIndex, 'role', e.target.value)}
                    placeholder="e.g., Software Engineer"
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Company *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={work.company}
                      onChange={(e) => updateWorkExperience(workIndex, 'company', e.target.value)}
                      placeholder="e.g., TechCorp Inc."
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm min-h-[44px]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Duration *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={work.year}
                      onChange={(e) => updateWorkExperience(workIndex, 'year', e.target.value)}
                      placeholder="e.g., Jan 2023 - Present"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm min-h-[44px]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Key Responsibilities
                  </label>
                  {work.bullets.map((bullet, bulletIndex) => (
                    <div key={bulletIndex} className="flex flex-col sm:flex-row gap-2 mb-2">
                      <input
                        type="text"
                        value={bullet}
                        onChange={(e) =>
                          updateWorkBullet(workIndex, bulletIndex, e.target.value)
                        }
                        placeholder="Describe your responsibility/achievement"
                        className="w-full sm:flex-1 px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm min-h-[44px]"
                      />
                      {work.bullets.length > 1 && (
                        <button
                          onClick={() => removeWorkBullet(workIndex, bulletIndex)}
                          className="w-full sm:w-auto text-red-600 hover:text-red-700 p-3 sm:p-2 min-w-[44px] min-h-[44px] flex items-center justify-center border border-red-300 rounded-lg sm:border-none"
                        >
                          <X className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => addWorkBullet(workIndex)}
                    className="text-blue-600 hover:text-blue-700 text-xs sm:text-sm font-medium flex items-center min-h-[44px] w-full sm:w-auto justify-center sm:justify-start p-2 border border-blue-300 rounded-lg sm:border-none sm:p-0"
                  >
                    <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    Add Responsibility
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={addWorkExperience}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg sm:rounded-xl p-3 sm:p-4 text-gray-600 hover:text-gray-800 hover:border-gray-400 transition-colors flex items-center justify-center text-sm min-h-[44px]"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Add Another Experience
            </button>
          </div>
        </div>
      ),
      isValid: workExperience.some(
        (we) => we.role.trim() !== '' && we.company.trim() !== '' && we.year.trim() !== ''
      ),
    },
    {
      id: 'projects',
      title: 'Projects',
      icon: <Code className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
          <div className="text-center mb-6">
            <div className="bg-purple-100 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Code className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Projects</h3>
            <p className="text-sm sm:text-base text-gray-600">
              Showcase your personal or academic projects.
            </p>
          </div>
          <div className="space-y-4 sm:space-y-6">
            {projects.map((project, projectIndex) => (
              <div
                key={projectIndex}
                className="border border-gray-200 rounded-lg sm:rounded-xl p-3 sm:p-4 space-y-3 sm:space-y-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900 text-sm sm:text-base">
                    Project #{projectIndex + 1}
                  </h4>
                {projects.length > 1 && (
                  <button
                    onClick={() => removeProject(projectIndex)}
                    className="text-red-600 hover:text-red-700 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                )}
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Project Title *
                  </label>
                  <input
                    type="text"
                    value={project.title}
                    onChange={(e) => updateProject(projectIndex, 'title', e.target.value)}
                    placeholder="e.g., E-commerce Website"
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    GitHub URL (Optional)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <LinkIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="url"
                      value={project.githubUrl || ''}
                      onChange={(e) => updateProject(projectIndex, 'githubUrl', e.target.value)}
                      placeholder="https://github.com/yourproject"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm min-h-[44px]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Project Details
                  </label>
                  {project.bullets.map((bullet, bulletIndex) => (
                    <div key={bulletIndex} className="flex flex-col sm:flex-row gap-2 mb-2">
                      <input
                        type="text"
                        value={bullet}
                        onChange={(e) =>
                          updateProjectBullet(projectIndex, bulletIndex, e.target.value)
                        }
                        placeholder="Describe what you built/achieved"
                        className="w-full sm:flex-1 px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm min-h-[44px]"
                      />
                      {project.bullets.length > 1 && (
                        <button
                          onClick={() => removeProjectBullet(projectIndex, bulletIndex)}
                          className="w-full sm:w-auto text-red-600 hover:text-red-700 p-3 sm:p-2 min-w-[44px] min-h-[44px] flex items-center justify-center border border-red-300 rounded-lg sm:border-none"
                        >
                          <X className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => addProjectBullet(projectIndex)}
                    className="text-purple-600 hover:text-purple-700 text-xs sm:text-sm font-medium flex items-center min-h-[44px] w-full sm:w-auto justify-center sm:justify-start p-2 border border-purple-300 rounded-lg sm:border-none sm:p-0"
                  >
                    <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    Add Detail
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={addProject}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg sm:rounded-xl p-3 sm:p-4 text-gray-600 hover:text-gray-800 hover:border-gray-400 transition-colors flex items-center justify-center text-sm min-h-[44px]"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Add Another Project
            </button>
          </div>
        </div>
      ),
      isValid: projects.some((p) => p.title.trim() !== '' && p.bullets.some((b) => b.trim() !== '')),
    },
    {
      id: 'skills',
      title: 'Skills',
      icon: <Target className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
          <div className="text-center mb-6">
            <div className="bg-green-100 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Target className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Skills</h3>
            <p className="text-sm sm:text-base text-gray-600">Categorize your technical and soft skills.</p>
          </div>
          <div className="space-y-4 sm:space-y-6">
            {skills.map((skillCategory, categoryIndex) => (
              <div
                key={categoryIndex}
                className="border border-gray-200 rounded-lg sm:rounded-xl p-3 sm:p-4 space-y-3 sm:space-y-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900 text-sm sm:text-base">
                    Skill Category #{categoryIndex + 1}
                  </h4>
                  {skills.length > 1 && (
                    <button
                      onClick={() => removeSkillCategory(categoryIndex)}
                      className="text-red-600 hover:text-red-700 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                      <X className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    value={skillCategory.category}
                    onChange={(e) =>
                      updateSkillCategory(categoryIndex, 'category', e.target.value)
                    }
                    placeholder="e.g., Programming Languages, Frameworks"
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Skills (comma-separated or add individually)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2 mb-2">
                    <input
                      type="text"
                      value={skillInputs[categoryIndex] ?? ''}
                      onChange={(e) =>
                        setSkillInputs((prev) => ({
                          ...prev,
                          [categoryIndex]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addSkillToCategory(categoryIndex, skillInputs[categoryIndex] ?? '');
                        }
                      }}
                      placeholder="e.g., JavaScript, React, Node.js"
                      className="w-full sm:flex-1 px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm min-h-[44px]"
                    />
                    <button
                      onClick={() =>
                        addSkillToCategory(categoryIndex, skillInputs[categoryIndex] ?? '')
                      }
                      className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-3 py-3 rounded-lg transition-colors text-sm min-h-[44px]"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {skillCategory.list.map((skill: string, skillIndex: number) => (
                      <span
                        key={skillIndex}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800"
                      >
                        {skill}
                        <button
                          onClick={() => removeSkillFromCategory(categoryIndex, skillIndex)}
                          className="ml-2 text-green-600 hover:text-green-800"
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
              onClick={addSkillCategory}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg sm:rounded-xl p-3 sm:p-4 text-gray-600 hover:text-gray-800 hover:border-gray-400 transition-colors flex items-center justify-center text-sm min-h-[44px]"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Add Another Skill Category
            </button>
          </div>
        </div>
      ),
      isValid: skills.some((s) => s.category.trim() !== '' && s.list.some((item) => item.trim() !== '')),
    },
    {
      id: 'certifications',
      title: 'Certifications',
      icon: <Award className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
          <div className="text-center mb-6">
            <div className="bg-yellow-100 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Award className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-600" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Certifications</h3>
            <p className="text-sm sm:text-base text-gray-600">
              List any relevant certifications or licenses you hold.
            </p>
          </div>
          <div className="space-y-4 sm:space-y-6">
            {certifications.map((cert, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg sm:rounded-xl p-3 sm:p-4 space-y-3 sm:space-y-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900 text-sm sm:text-base">
                    Certification #{index + 1}
                  </h4>
                  {certifications.length > 1 && (
                    <button
                      onClick={() => removeCertification(index)}
                      className="text-red-600 hover:text-red-700 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                      <X className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={cert.title}
                    onChange={(e) => updateCertification(index, 'title', e.target.value)}
                    placeholder="e.g., AWS Certified Solutions Architect"
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-sm min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={cert.description}
                    onChange={(e) => updateCertification(index, 'description', e.target.value)}
                    placeholder="Brief description or issuing body (e.g., Issued by Amazon Web Services)"
                    rows={2}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-sm min-h-[44px] resize-y"
                  />
                </div>
              </div>
            ))}
            <button
              onClick={addCertification}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg sm:rounded-xl p-3 sm:p-4 text-gray-600 hover:text-gray-800 hover:border-gray-400 transition-colors flex items-center justify-center text-sm min-h-[44px]"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Add Another Certification
            </button>
          </div>
        </div>
      ),
      isValid: true, // optional
    },
    {
      id: 'achievements',
      title: 'Achievements',
      icon: <Award className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
          <div className="text-center mb-6">
            <div className="bg-orange-100 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Award className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
              Achievements & Awards
            </h3>
            <p className="text-sm sm:text-base text-gray-600">
              Highlight your notable accomplishments, awards, or recognitions.
            </p>
          </div>
          <div className="space-y-4 sm:space-y-6">
            {achievements.map((achievement, index) => (
              <div key={index} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={achievement}
                  onChange={(e) => updateAchievement(index, e.target.value)}
                  placeholder="e.g., Dean's List (Fall 2023)"
                  className="w-full sm:flex-1 px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm min-h-[44px]"
                />
                {achievements.length > 1 && (
                  <button
                    onClick={() => removeAchievement(index)}
                    className="w-full sm:w-auto text-red-600 hover:text-red-700 p-3 sm:p-2 min-w-[44px] min-h-[44px] flex items-center justify-center border border-red-300 rounded-lg sm:border-none"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addAchievement}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg sm:rounded-xl p-3 sm:p-4 text-gray-600 hover:text-gray-800 hover:border-gray-400 transition-colors flex items-center justify-center text-sm min-h-[44px]"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Add Another Achievement
            </button>
          </div>
        </div>
      ),
      isValid: true, // optional
    },
    {
      id: 'review',
      title: 'Review & Generate',
      icon: <Eye className="w-6 h-6" />,
      component: (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-50 dark:border-dark-400">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Eye className="w-5 h-5 mr-2 text-blue-600" />
            Review Your Resume
          </h2>
          <div className="mb-6">
            <ResumePreview resumeData={generateResumeData()} userType={userType} />
          </div>
          <button
            onClick={handleGenerateResume}
            disabled={isGenerating || loadingScore}
            className="w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl"
          >
            {isGenerating || loadingScore ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{loadingScore ? 'Calculating Score...' : 'Generating Resume...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-6 h-6" />
                <span>Generate Final Resume</span>
              </>
            )}
          </button>
          {score !== null && (
            <div className="mt-4 text-center text-lg font-semibold text-gray-900">
              Resume Score: {score}%
            </div>
          )}
        </div>
      ),
      isValid: true,
    },
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

  const currentStepData = steps[currentStep];

  if (isGenerating || loadingScore) {
    return (
      <LoadingAnimation
        message={loadingScore ? 'Calculating Resume Score...' : 'Generating Your Resume...'}
        submessage={
          loadingScore
            ? 'Analyzing your resume against ATS standards.'
            : 'Compiling your details into a professional resume.'
        }
      />
    );
    }

  if (generatedResume && currentStep === steps.length - 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pb-16 dark:from-dark-50 dark:to-dark-200 transition-colors duration-300">
        <div className="container-responsive py-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-100 dark:border-dark-300">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center dark:text-gray-100">
                <CheckCircle className="w-6 h-6 mr-2 text-green-600" />
                Your Resume is Ready!
              </h2>
              <p className="text-gray-600 mb-6 dark:text-gray-300">
                You can now review, download, or further optimize your new resume.
              </p>
              <ResumePreview resumeData={generatedResume} userType={userType} />
              <div className="mt-6 flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => alert('Download PDF functionality here')}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors shadow-lg"
                >
                  Download PDF
                </button>
                <button
                  onClick={() => alert('Download DOCX functionality here')}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors shadow-lg"
                >
                  Download DOCX
                </button>
              </div>
              <button
                onClick={() => {
                  setGeneratedResume(null);
                  setCurrentStep(0);
                  setPersonalInfo({
                    fullName: user?.name || '',
                    email: user?.email || '',
                    phone: user?.phone || '',
                    linkedin: user?.linkedin || '',
                    github: user?.github || '',
                    location: '',
                    targetRole: '',
                  });
                  setEducation([{ degree: '', school: '', year: '', cgpa: '', location: '' }]);
                  setWorkExperience([{ role: '', company: '', year: '', bullets: [''] }]);
                  setProjects([{ title: '', bullets: [''] }]);
                  setSkills([{ category: '', count: 0, list: [] }]);
                  setCertifications([{ title: '', description: '' }]);
                  setAchievements(['']);
                  setSkillInputs({});
                }}
                className="mt-6 w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                Start New Resume
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Guided Resume Builder
              </h1>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Step {currentStep + 1} of {steps.length}
              </div>
            </div>

            {/* Step Progress Bar - Carousel Effect */}
            <div className="relative overflow-x-auto overflow-hidden w-[320px] mx-auto md:w-auto">
              <div
                className="flex items-center space-x-4 mb-6 transition-transform duration-300"
                style={{ transform: `translateX(-${currentStep * 96}px)` }}
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
                        {index < currentStep ? <CheckCircle className="w-5 h-5" /> : step.icon}
                      </div>
                      <span
                        className={`text-xs mt-2 font-medium text-center ${
                          index <= currentStep
                            ? 'text-gray-900 dark:text-gray-100'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {step.title}
                      </span>
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                          index < currentStep ? 'bg-green-500' : 'bg-gray-200 dark:bg-dark-200'
                        }`}
                      />
                    )}
                  </React.Fragment>
                ))}
              </div>
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
                      ? 'bg-gray-400 text-gray-400 cursor-not-allowed dark:bg-dark-200 dark:text-gray-500'
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
