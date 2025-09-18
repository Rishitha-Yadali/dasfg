// src/components/GuidedResumeBuilder.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  User,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Github,
  Briefcase,
  GraduationCap,
  Code,
  Award,
  Target,
  Sparkles,
  Save,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
  Plus,
  Trash2,
  Edit3,
  Zap,
  BookOpen,
  Star
} from 'lucide-react';
import { ResumeData, UserType } from '../types/resume';
import { ExportOptions, defaultExportOptions } from '../types/export';
import { ResumePreview } from './ResumePreview';
import { ResumeExportSettings } from './ResumeExportSettings';
import { ExportButtons } from './ExportButtons';
import { LoadingAnimation } from './LoadingAnimation';
import { generateAtsOptimizedSection } from '../services/geminiService';
import { useAuth } from '../contexts/AuthContext';
import { paymentService } from '../services/paymentService';
import { useNavigate } from 'react-router-dom';

interface GuidedResumeBuilderProps {
  onNavigateBack: () => void;
  isAuthenticated: boolean;
  onShowAuth: (callback?: () => void) => void;
  userSubscription: any;
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

interface FormStep {
  id: string;
  title: string;
  icon: React.ReactNode;
  component: React.ReactNode;
  isValid: () => boolean;
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
  setToolProcessTrigger
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Core state
  const [currentStep, setCurrentStep] = useState(0);
  const [userType, setUserType] = useState<UserType>('fresher');
  const [exportOptions, setExportOptions] = useState<ExportOptions>(defaultExportOptions);
  const [isGenerating, setIsGenerating] = useState(false);
  const [buildInterrupted, setBuildInterrupted] = useState(false);

  // Resume data state
  const [resumeData, setResumeData] = useState<ResumeData>({
    name: '',
    phone: '',
    email: '',
    linkedin: '',
    github: '',
    location: '',
    targetRole: '',
    summary: '',
    careerObjective: '',
    education: [],
    workExperience: [],
    projects: [],
    skills: [],
    certifications: [],
    achievements: [],
    extraCurricularActivities: [],
    languagesKnown: [],
    personalDetails: '',
    origin: 'guided'
  });

  // Form state for each section
  const [contactForm, setContactForm] = useState({
    name: '',
    phone: '',
    email: '',
    linkedin: '',
    github: '',
    location: '',
    targetRole: ''
  });

  const [educationForm, setEducationForm] = useState([
    { degree: '', school: '', year: '', cgpa: '', location: '' }
  ]);

  const [workForm, setWorkForm] = useState([
    { role: '', company: '', year: '', location: '', description: '' }
  ]);

  const [projectForm, setProjectForm] = useState([
    { title: '', description: '', techStack: '' }
  ]);

  const [skillsForm, setSkillsForm] = useState([
    { category: '', skills: '' }
  ]);

  const [certsForm, setCertsForm] = useState(['']);

  useEffect(() => {
    if (user) {
      setContactForm(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        linkedin: user.linkedin || '',
        github: user.github || ''
      }));
    }
  }, [user]);

  // Register build process trigger
  useEffect(() => {
    setToolProcessTrigger(() => handleStartBuild);
    return () => {
      setToolProcessTrigger(null);
    };
  }, [setToolProcessTrigger]);

  // Re-trigger build if interrupted and credits are available
  useEffect(() => {
    if (buildInterrupted && userSubscription && (userSubscription.guidedBuildsTotal - userSubscription.guidedBuildsUsed) > 0) {
      console.log('GuidedResumeBuilder: Build was interrupted, credits now available. Resetting flag.');
      setBuildInterrupted(false);
    }
  }, [buildInterrupted, userSubscription]);

  const handleStartBuild = useCallback(async () => {
    if (!isAuthenticated) {
      onShowAlert(
        'Authentication Required',
        'Please sign in to build your resume.',
        'error',
        'Sign In',
        onShowAuth
      );
      return;
    }

    // Check credits
    const creditsLeft = (userSubscription?.guidedBuildsTotal || 0) - (userSubscription?.guidedBuildsUsed || 0);
    if (!userSubscription || creditsLeft <= 0) {
      setBuildInterrupted(true);
      onShowAlert(
        'Guided Build Credits Exhausted',
        'You have used all your guided resume build credits. Please upgrade your plan to continue.',
        'warning',
        'Upgrade Plan',
        () => onShowSubscriptionPlans('guided-builder')
      );
      return;
    }

    setIsGenerating(true);
    try {
      await generateCompleteResume();
      
      // Decrement usage
      if (userSubscription) {
        const usageResult = await paymentService.useGuidedBuild(userSubscription.userId);
        if (usageResult.success) {
          await refreshUserSubscription();
        }
      }
    } catch (error: any) {
      onShowAlert(
        'Generation Failed',
        `Failed to generate resume: ${error?.message || 'Unknown error'}. Please try again.`,
        'error'
      );
    } finally {
      setIsGenerating(false);
    }
  }, [isAuthenticated, onShowAuth, userSubscription, onShowSubscriptionPlans, onShowAlert, refreshUserSubscription]);

  const generateCompleteResume = async () => {
    try {
      // Start with contact info
      const baseResume: ResumeData = {
        ...resumeData,
        name: contactForm.name,
        phone: contactForm.phone,
        email: contactForm.email,
        linkedin: contactForm.linkedin,
        github: contactForm.github,
        location: contactForm.location,
        targetRole: contactForm.targetRole,
        origin: 'guided'
      };

      // Generate summary/objective based on user type
      if (userType === 'experienced') {
        const summaryData = {
          userType,
          targetRole: contactForm.targetRole,
          experience: workForm.filter(w => w.role && w.company)
        };
        const summary = await generateAtsOptimizedSection('summary', summaryData);
        baseResume.summary = summary;
      } else {
        const objectiveData = {
          userType,
          targetRole: contactForm.targetRole,
          education: educationForm.filter(e => e.degree && e.school)
        };
        const objective = await generateAtsOptimizedSection('careerObjective', objectiveData);
        baseResume.careerObjective = objective;
      }

      // Process education
      baseResume.education = educationForm
        .filter(edu => edu.degree && edu.school && edu.year)
        .map(edu => ({
          degree: edu.degree,
          school: edu.school,
          year: edu.year,
          cgpa: edu.cgpa || undefined,
          location: edu.location || undefined
        }));

      // Generate work experience bullets
      if (workForm.some(w => w.role && w.company)) {
        const workExperience = [];
        for (const work of workForm.filter(w => w.role && w.company)) {
          const bullets = await generateAtsOptimizedSection('workExperienceBullets', {
            role: work.role,
            company: work.company,
            year: work.year,
            description: work.description,
            userType
          });
          workExperience.push({
            role: work.role,
            company: work.company,
            year: work.year,
            location: work.location || undefined,
            bullets: Array.isArray(bullets) ? bullets : [bullets]
          });
        }
        baseResume.workExperience = workExperience;
      }

      // Generate project bullets
      if (projectForm.some(p => p.title)) {
        const projects = [];
        for (const project of projectForm.filter(p => p.title)) {
          const bullets = await generateAtsOptimizedSection('projectBullets', {
            title: project.title,
            description: project.description,
            techStack: project.techStack,
            userType
          });
          projects.push({
            title: project.title,
            bullets: Array.isArray(bullets) ? bullets : [bullets]
          });
        }
        baseResume.projects = projects;
      }

      // Process skills
      baseResume.skills = skillsForm
        .filter(skill => skill.category && skill.skills)
        .map(skill => ({
          category: skill.category,
          list: skill.skills.split(',').map(s => s.trim()).filter(s => s),
          count: skill.skills.split(',').map(s => s.trim()).filter(s => s).length
        }));

      // Process certifications
      baseResume.certifications = certsForm
        .filter(cert => cert.trim())
        .map(cert => ({ title: cert.trim(), description: '' }));

      setResumeData(baseResume);
      setCurrentStep(steps.length - 1); // Move to preview step
    } catch (error) {
      console.error('Error generating complete resume:', error);
      throw error;
    }
  };

  const handleExportFile = async (options: ExportOptions, format: 'pdf' | 'word') => {
    if (!resumeData.name) {
      onShowAlert('Resume Not Ready', 'Please complete building your resume before exporting.', 'warning');
      return;
    }

    try {
      const { exportToPDF, exportToWord } = await import('../utils/exportUtils');
      
      if (format === 'pdf') {
        await exportToPDF(resumeData, userType, options);
      } else {
        await exportToWord(resumeData, userType);
      }
      
      onShowAlert('Export Successful', `Resume exported as ${format.toUpperCase()} successfully!`, 'success');
    } catch (error) {
      console.error('Export failed:', error);
      onShowAlert('Export Failed', `Failed to export resume. Please try again.`, 'error');
    }
  };

  // Form handlers
  const addEducationEntry = () => {
    setEducationForm([...educationForm, { degree: '', school: '', year: '', cgpa: '', location: '' }]);
  };

  const removeEducationEntry = (index: number) => {
    if (educationForm.length > 1) {
      setEducationForm(educationForm.filter((_, i) => i !== index));
    }
  };

  const updateEducationEntry = (index: number, field: string, value: string) => {
    const updated = [...educationForm];
    updated[index] = { ...updated[index], [field]: value };
    setEducationForm(updated);
  };

  const addWorkEntry = () => {
    setWorkForm([...workForm, { role: '', company: '', year: '', location: '', description: '' }]);
  };

  const removeWorkEntry = (index: number) => {
    if (workForm.length > 1) {
      setWorkForm(workForm.filter((_, i) => i !== index));
    }
  };

  const updateWorkEntry = (index: number, field: string, value: string) => {
    const updated = [...workForm];
    updated[index] = { ...updated[index], [field]: value };
    setWorkForm(updated);
  };

  const addProjectEntry = () => {
    setProjectForm([...projectForm, { title: '', description: '', techStack: '' }]);
  };

  const removeProjectEntry = (index: number) => {
    if (projectForm.length > 1) {
      setProjectForm(projectForm.filter((_, i) => i !== index));
    }
  };

  const updateProjectEntry = (index: number, field: string, value: string) => {
    const updated = [...projectForm];
    updated[index] = { ...updated[index], [field]: value };
    setProjectForm(updated);
  };

  const addSkillCategory = () => {
    setSkillsForm([...skillsForm, { category: '', skills: '' }]);
  };

  const removeSkillCategory = (index: number) => {
    if (skillsForm.length > 1) {
      setSkillsForm(skillsForm.filter((_, i) => i !== index));
    }
  };

  const updateSkillCategory = (index: number, field: string, value: string) => {
    const updated = [...skillsForm];
    updated[index] = { ...updated[index], [field]: value };
    setSkillsForm(updated);
  };

  const addCertification = () => {
    setCertsForm([...certsForm, '']);
  };

  const removeCertification = (index: number) => {
    if (certsForm.length > 1) {
      setCertsForm(certsForm.filter((_, i) => i !== index));
    }
  };

  const updateCertification = (index: number, value: string) => {
    const updated = [...certsForm];
    updated[index] = value;
    setCertsForm(updated);
  };

  // Define form steps
  const steps: FormStep[] = [
    {
      id: 'userType',
      title: 'Experience Level',
      icon: <User className="w-6 h-6" />,
      component: (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">What's your experience level?</h2>
            <p className="text-gray-600 dark:text-gray-300">This helps us tailor the resume format for you</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { 
                id: 'fresher', 
                title: 'Fresher/New Graduate', 
                description: 'Recent graduate or entry-level professional',
                icon: <GraduationCap className="w-8 h-8" />
              },
              { 
                id: 'experienced', 
                title: 'Experienced Professional', 
                description: 'Professional with 1+ years of experience',
                icon: <Briefcase className="w-8 h-8" />
              },
              { 
                id: 'student', 
                title: 'Current Student', 
                description: 'Currently pursuing education, looking for internships',
                icon: <BookOpen className="w-8 h-8" />
              }
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => setUserType(type.id as UserType)}
                className={`p-6 rounded-2xl border-2 transition-all duration-300 text-center hover:scale-105 ${
                  userType === type.id
                    ? 'border-blue-500 bg-blue-50 shadow-lg ring-4 ring-blue-200 dark:border-neon-cyan-500 dark:bg-neon-cyan-500/20'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 dark:border-dark-300 dark:hover:border-neon-cyan-400'
                }`}
              >
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  userType === type.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                }`}>
                  {type.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{type.title}</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">{type.description}</p>
              </button>
            ))}
          </div>
        </div>
      ),
      isValid: () => !!userType
    },
    {
      id: 'contact',
      title: 'Contact Info',
      icon: <Mail className="w-6 h-6" />,
      component: (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Personal Information</h2>
            <p className="text-gray-600 dark:text-gray-300">Let's start with your contact details</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Full Name *</label>
              <input
                type="text"
                value={contactForm.name}
                onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="John Doe"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone Number *</label>
              <input
                type="tel"
                value={contactForm.phone}
                onChange={(e) => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+1 (555) 123-4567"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email Address *</label>
              <input
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="john.doe@email.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Location *</label>
              <input
                type="text"
                value={contactForm.location}
                onChange={(e) => setContactForm(prev => ({ ...prev, location: e.target.value }))}
                placeholder="City, State"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">LinkedIn URL</label>
              <input
                type="url"
                value={contactForm.linkedin}
                onChange={(e) => setContactForm(prev => ({ ...prev, linkedin: e.target.value }))}
                placeholder="https://linkedin.com/in/johndoe"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">GitHub URL</label>
              <input
                type="url"
                value={contactForm.github}
                onChange={(e) => setContactForm(prev => ({ ...prev, github: e.target.value }))}
                placeholder="https://github.com/johndoe"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Target Role/Position</label>
              <input
                type="text"
                value={contactForm.targetRole}
                onChange={(e) => setContactForm(prev => ({ ...prev, targetRole: e.target.value }))}
                placeholder="e.g., Software Engineer, Data Analyst"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
              />
            </div>
          </div>
        </div>
      ),
      isValid: () => !!(contactForm.name && contactForm.phone && contactForm.email && contactForm.location)
    },
    {
      id: 'education',
      title: 'Education',
      icon: <GraduationCap className="w-6 h-6" />,
      component: (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Education Details</h2>
            <p className="text-gray-600 dark:text-gray-300">Add your educational background</p>
          </div>
          {educationForm.map((edu, index) => (
            <div key={index} className="border border-gray-200 rounded-xl p-6 space-y-4 dark:border-dark-300">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Education #{index + 1}</h3>
                {educationForm.length > 1 && (
                  <button
                    onClick={() => removeEducationEntry(index)}
                    className="text-red-600 hover:text-red-700 p-2"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Degree *</label>
                  <input
                    type="text"
                    value={edu.degree}
                    onChange={(e) => updateEducationEntry(index, 'degree', e.target.value)}
                    placeholder="Bachelor of Technology"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Institution *</label>
                  <input
                    type="text"
                    value={edu.school}
                    onChange={(e) => updateEducationEntry(index, 'school', e.target.value)}
                    placeholder="University Name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Year *</label>
                  <input
                    type="text"
                    value={edu.year}
                    onChange={(e) => updateEducationEntry(index, 'year', e.target.value)}
                    placeholder="2020-2024"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">CGPA/GPA</label>
                  <input
                    type="text"
                    value={edu.cgpa}
                    onChange={(e) => updateEducationEntry(index, 'cgpa', e.target.value)}
                    placeholder="8.5/10 or 3.8/4.0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Location</label>
                  <input
                    type="text"
                    value={edu.location}
                    onChange={(e) => updateEducationEntry(index, 'location', e.target.value)}
                    placeholder="City, State"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={addEducationEntry}
            className="w-full border-2 border-dashed border-gray-300 rounded-xl p-4 text-gray-600 hover:text-gray-800 hover:border-gray-400 transition-colors flex items-center justify-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Another Education Entry
          </button>
        </div>
      ),
      isValid: () => educationForm.some(edu => edu.degree && edu.school && edu.year)
    },
    {
      id: 'experience',
      title: 'Work Experience',
      icon: <Briefcase className="w-6 h-6" />,
      component: (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Work Experience</h2>
            <p className="text-gray-600 dark:text-gray-300">Add your professional experience, internships, or training</p>
          </div>
          {workForm.map((work, index) => (
            <div key={index} className="border border-gray-200 rounded-xl p-6 space-y-4 dark:border-dark-300">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Experience #{index + 1}</h3>
                {workForm.length > 1 && (
                  <button
                    onClick={() => removeWorkEntry(index)}
                    className="text-red-600 hover:text-red-700 p-2"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Job Title *</label>
                  <input
                    type="text"
                    value={work.role}
                    onChange={(e) => updateWorkEntry(index, 'role', e.target.value)}
                    placeholder="Software Engineer"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Company *</label>
                  <input
                    type="text"
                    value={work.company}
                    onChange={(e) => updateWorkEntry(index, 'company', e.target.value)}
                    placeholder="TechCorp Inc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Duration *</label>
                  <input
                    type="text"
                    value={work.year}
                    onChange={(e) => updateWorkEntry(index, 'year', e.target.value)}
                    placeholder="Jan 2023 - Present"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Location</label>
                  <input
                    type="text"
                    value={work.location}
                    onChange={(e) => updateWorkEntry(index, 'location', e.target.value)}
                    placeholder="City, State"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Key Responsibilities/Achievements</label>
                  <textarea
                    value={work.description}
                    onChange={(e) => updateWorkEntry(index, 'description', e.target.value)}
                    placeholder="Describe your main responsibilities and achievements..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 resize-none dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={addWorkEntry}
            className="w-full border-2 border-dashed border-gray-300 rounded-xl p-4 text-gray-600 hover:text-gray-800 hover:border-gray-400 transition-colors flex items-center justify-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Another Experience
          </button>
        </div>
      ),
      isValid: () => true // Work experience is optional
    },
    {
      id: 'projects',
      title: 'Projects',
      icon: <Code className="w-6 h-6" />,
      component: (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Projects</h2>
            <p className="text-gray-600 dark:text-gray-300">Add your academic or professional projects</p>
          </div>
          {projectForm.map((project, index) => (
            <div key={index} className="border border-gray-200 rounded-xl p-6 space-y-4 dark:border-dark-300">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Project #{index + 1}</h3>
                {projectForm.length > 1 && (
                  <button
                    onClick={() => removeProjectEntry(index)}
                    className="text-red-600 hover:text-red-700 p-2"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Project Title *</label>
                  <input
                    type="text"
                    value={project.title}
                    onChange={(e) => updateProjectEntry(index, 'title', e.target.value)}
                    placeholder="E-commerce Website"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                  <textarea
                    value={project.description}
                    onChange={(e) => updateProjectEntry(index, 'description', e.target.value)}
                    placeholder="Brief description of what you built and achieved..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 resize-none dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tech Stack</label>
                  <input
                    type="text"
                    value={project.techStack}
                    onChange={(e) => updateProjectEntry(index, 'techStack', e.target.value)}
                    placeholder="React, Node.js, MongoDB"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={addProjectEntry}
            className="w-full border-2 border-dashed border-gray-300 rounded-xl p-4 text-gray-600 hover:text-gray-800 hover:border-gray-400 transition-colors flex items-center justify-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Another Project
          </button>
        </div>
      ),
      isValid: () => true // Projects are optional
    },
    {
      id: 'skills',
      title: 'Skills',
      icon: <Target className="w-6 h-6" />,
      component: (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Technical Skills</h2>
            <p className="text-gray-600 dark:text-gray-300">Organize your skills by category</p>
          </div>
          {skillsForm.map((skill, index) => (
            <div key={index} className="border border-gray-200 rounded-xl p-6 space-y-4 dark:border-dark-300">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Skill Category #{index + 1}</h3>
                {skillsForm.length > 1 && (
                  <button
                    onClick={() => removeSkillCategory(index)}
                    className="text-red-600 hover:text-red-700 p-2"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category Name *</label>
                  <input
                    type="text"
                    value={skill.category}
                    onChange={(e) => updateSkillCategory(index, 'category', e.target.value)}
                    placeholder="Programming Languages, Frameworks, Tools"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Skills (comma-separated)</label>
                  <input
                    type="text"
                    value={skill.skills}
                    onChange={(e) => updateSkillCategory(index, 'skills', e.target.value)}
                    placeholder="JavaScript, React, Node.js, MongoDB"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={addSkillCategory}
            className="w-full border-2 border-dashed border-gray-300 rounded-xl p-4 text-gray-600 hover:text-gray-800 hover:border-gray-400 transition-colors flex items-center justify-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Another Skill Category
          </button>
        </div>
      ),
      isValid: () => skillsForm.some(skill => skill.category && skill.skills)
    },
    {
      id: 'certifications',
      title: 'Certifications',
      icon: <Award className="w-6 h-6" />,
      component: (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Certifications</h2>
            <p className="text-gray-600 dark:text-gray-300">Add your professional certifications and achievements</p>
          </div>
          {certsForm.map((cert, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={cert}
                onChange={(e) => updateCertification(index, e.target.value)}
                placeholder="AWS Certified Solutions Architect"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
              />
              {certsForm.length > 1 && (
                <button
                  onClick={() => removeCertification(index)}
                  className="text-red-600 hover:text-red-700 p-2"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addCertification}
            className="w-full border-2 border-dashed border-gray-300 rounded-xl p-4 text-gray-600 hover:text-gray-800 hover:border-gray-400 transition-colors flex items-center justify-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Another Certification
          </button>
        </div>
      ),
      isValid: () => true // Certifications are optional
    },
    {
      id: 'preview',
      title: 'Preview & Export',
      icon: <FileText className="w-6 h-6" />,
      component: (
        <div className="space-y-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Your ATS-Optimized Resume</h2>
            <p className="text-gray-600 dark:text-gray-300">Review your resume and export in your preferred format</p>
          </div>

          {resumeData.name ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-blue-600" />
                    Resume Preview
                  </h3>
                  <ResumePreview resumeData={resumeData} userType={userType} exportOptions={exportOptions} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                    <Save className="w-5 h-5 mr-2 text-green-600" />
                    Export Settings
                  </h3>
                  <ResumeExportSettings
                    resumeData={resumeData}
                    userType={userType}
                    onExport={handleExportFile}
                  />
                </div>
              </div>
              
              <div className="mt-8">
                <ExportButtons
                  resumeData={resumeData}
                  userType={userType}
                  targetRole={contactForm.targetRole}
                />
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 dark:bg-neon-cyan-500/20">
                <Sparkles className="w-10 h-10 text-blue-600 dark:text-neon-cyan-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Ready to Build Your Resume?</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">Click the button below to generate your ATS-optimized resume</p>
              <button
                onClick={handleStartBuild}
                disabled={isGenerating}
                className="bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 hover:from-neon-cyan-400 hover:to-neon-blue-400 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-300 shadow-lg hover:shadow-neon-cyan flex items-center space-x-2 mx-auto"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Generating Resume...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    <span>Generate My Resume</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      ),
      isValid: () => true
    }
  ];

  const currentStepData = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1 && currentStepData.isValid()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (isGenerating) {
    return (
      <LoadingAnimation
        message="Building Your ATS-Optimized Resume..."
        submessage="Our AI is crafting professional content tailored to your experience"
        type="generation"
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 transition-colors duration-300">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40 dark:bg-dark-50 dark:border-dark-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={onNavigateBack}
              className="bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 text-white hover:from-neon-cyan-400 hover:to-neon-blue-400 shadow-md hover:shadow-neon-cyan py-3 px-5 rounded-xl inline-flex items-center space-x-2 transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:block">Back to Home</span>
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Guided Resume Builder</h1>
            <div className="w-24" />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Indicator */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200 mb-8 dark:bg-dark-100 dark:border-dark-300">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Build Your Resume</h2>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Step {currentStep + 1} of {steps.length}
            </div>
          </div>

          <div className="flex items-center justify-between mb-6">
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                      index < currentStep
                        ? 'bg-green-500 text-white'
                        : index === currentStep
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-500 dark:bg-dark-200 dark:text-gray-400'
                    }`}
                  >
                    {index < currentStep ? (
                      <CheckCircle className="w-6 h-6" />
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
                  <div className={`flex-1 h-1 rounded-full mx-4 transition-all duration-300 ${
                    index < currentStep ? 'bg-green-500' : 'bg-gray-200 dark:bg-dark-200'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200 mb-8 dark:bg-dark-100 dark:border-dark-300">
          {currentStepData.component}
        </div>

        {/* Navigation */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200 dark:bg-dark-100 dark:border-dark-300">
          <div className="flex justify-between items-center">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                currentStep === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-dark-200 dark:text-gray-500'
                  : 'bg-gray-600 hover:bg-gray-700 text-white shadow-lg hover:shadow-xl'
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Previous</span>
            </button>

            <div className="text-center">
              <div className="text-sm text-gray-500 mb-1 dark:text-gray-400">Progress</div>
              <div className="w-48 bg-gray-200 rounded-full h-2 dark:bg-dark-200">
                <div
                  className="bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                />
              </div>
            </div>

            {currentStep < steps.length - 1 ? (
              <button
                onClick={handleNext}
                disabled={!currentStepData.isValid()}
                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                  !currentStepData.isValid()
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 hover:from-neon-cyan-400 hover:to-neon-blue-400 text-white shadow-lg hover:shadow-neon-cyan'
                }`}
              >
                <span>Next</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-24" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};