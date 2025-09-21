// src/components/GuidedResumeBuilder.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  AlertCircle,
  Plus,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  X,
  CheckCircle,
  Edit3,
  ChevronDown,
  ChevronUp,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  User,
  Mail,
  Phone,
  Linkedin,
  Github,
  GraduationCap,
  Briefcase,
  Code,
  Target,
  Award,
  Lightbulb,
  ListChecks,
  Send,
  Loader2
} from 'lucide-react';
import { ResumePreview } from './ResumePreview';
import { ExportOptions, defaultExportOptions } from '../types/export';
import { ResumeData, UserType } from '../types/resume';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { paymentService } from '../services/paymentService';
import { optimizeResume } from '../services/geminiService'; // Assuming this is used for initial parsing
import { getDetailedResumeScore } from '../services/scoringService'; // Assuming this is used for scoring
import { reconstructResumeText } from '../services/scoringService'; // Assuming this is used for text reconstruction

// Define simplified input types for the builder
interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  location: string;
}

interface EducationEntry {
  degree: string;
  school: string;
  year: string;
  cgpa?: string;
  location?: string;
}

interface WorkExperienceEntry {
  role: string;
  company: string;
  year: string;
  bullets: string[];
}

interface ProjectEntry {
  title: string;
  bullets: string[];
}

interface SkillCategory {
  category: string;
  list: string[];
}

interface CertificationEntry {
  title: string;
  description: string;
}

interface AchievementEntry {
  description: string;
}

interface AdditionalSectionEntry {
  title: string;
  bullets: string[];
}

// Helper to clean bullet points (similar to ResumeOptimizer)
const cleanBulletPoints = (resume: ResumeData): ResumeData => {
  const processedResume = { ...resume };

  const processBullets = (bullets: string[] | undefined) => {
    return (bullets || []).filter(bullet => typeof bullet === 'string' && bullet.trim() !== '');
  };

  if (processedResume.workExperience) {
    processedResume.workExperience = processedResume.workExperience.map(exp => ({
      ...exp,
      bullets: processBullets(exp.bullets)
    }));
  }
  if (processedResume.projects) {
    processedResume.projects = processedResume.projects.map(proj => ({
      ...proj,
      bullets: processBullets(proj.bullets)
    }));
  }
  if (processedResume.additionalSections) {
    processedResume.additionalSections = processedResume.additionalSections.map(sec => ({
      ...sec,
      bullets: processBullets(sec.bullets)
    }));
  }
  if (processedResume.certifications) {
    processedResume.certifications = processedResume.certifications.filter(cert => {
      if (typeof cert === 'string') return cert.trim() !== '';
      if (typeof cert === 'object' && cert !== null && 'title' in cert) return cert.title.trim() !== '';
      return false;
    });
  }
  if (processedResume.achievements) {
    processedResume.achievements = processedResume.achievements.filter(ach => typeof ach === 'string' && ach.trim() !== '');
  }

  return processedResume;
};


const GuidedResumeBuilder: React.FC = () => {
  const { user, isAuthenticated, onShowAuth } = useAuth();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(0);
  const [userType, setUserType] = useState<UserType>('fresher'); // Default to fresher

  // Resume Data States
  const [contactInfo, setContactInfo] = useState<ContactInfo>({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    linkedin: user?.linkedin || '',
    github: user?.github || '',
    location: ''
  });
  const [summaryObjective, setSummaryObjective] = useState('');
  const [education, setEducation] = useState<EducationEntry[]>([{ degree: '', school: '', year: '', cgpa: '', location: '' }]);
  const [workExperience, setWorkExperience] = useState<WorkExperienceEntry[]>([{ role: '', company: '', year: '', bullets: [''] }]);
  const [projects, setProjects] = useState<ProjectEntry[]>([{ title: '', bullets: [''] }]);
  const [skills, setSkills] = useState<SkillCategory[]>([{ category: '', list: [''] }]);
  const [certifications, setCertifications] = useState<CertificationEntry[]>([]);
  const [achievements, setAchievements] = useState<AchievementEntry[]>([]);
  const [additionalSections, setAdditionalSections] = useState<AdditionalSectionEntry[]>([]);

  const [optimizedResume, setOptimizedResume] = useState<ResumeData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Resume Preview Zoom State
  const [zoomLevel, setZoomLevel] = useState(1);

  // Review Section Expanded State
  const [expandedReviewSections, setExpandedReviewSections] = useState<Set<string>>(new Set());

  // Map step index to section key for review and navigation
  const stepToSectionMap: { [key: number]: string } = {
    1: 'contactInfo',
    2: 'summaryObjective',
    3: 'education',
    4: 'workExperience',
    5: 'projects',
    6: 'skills',
    7: 'certifications',
    8: 'achievements',
    9: 'additionalSections',
  };

  // Update contact info from authenticated user on load
  useEffect(() => {
    if (user) {
      setContactInfo(prev => ({
        ...prev,
        name: user.name || prev.name,
        email: user.email || prev.email,
        phone: user.phone || prev.phone,
        linkedin: user.linkedin || prev.linkedin,
        github: user.github || prev.github,
      }));
    }
  }, [user]);

  // Function to compile resume data for preview and generation
  const compileResumeData = useCallback((): ResumeData => {
    return cleanBulletPoints({
      name: contactInfo.name,
      phone: contactInfo.phone,
      email: contactInfo.email,
      linkedin: contactInfo.linkedin,
      github: contactInfo.github,
      location: contactInfo.location,
      targetRole: '', // Guided builder doesn't have a target role input directly
      summary: userType === 'experienced' ? summaryObjective : undefined,
      careerObjective: (userType === 'fresher' || userType === 'student') ? summaryObjective : undefined,
      education: education.filter(e => e.degree && e.school && e.year),
      workExperience: workExperience.filter(we => we.role && we.company && we.year),
      projects: projects.filter(p => p.title && p.bullets.some(b => b.trim())),
      skills: skills.filter(s => s.category && s.list.some(l => l.trim())),
      certifications: certifications.filter(c => c.title).map(c => c.title), // Simplified for now
      achievements: achievements.filter(a => a.description).map(a => a.description),
      additionalSections: additionalSections.filter(s => s.title && s.bullets.some(b => b.trim())),
    });
  }, [contactInfo, summaryObjective, education, workExperience, projects, skills, certifications, achievements, additionalSections, userType]);

  // Update optimizedResume whenever input data changes and it's not generating
  useEffect(() => {
    if (!isGenerating) {
      setOptimizedResume(compileResumeData());
    }
  }, [compileResumeData, isGenerating]);

  // Navigation Handlers
  const totalSteps = 11; // 0-indexed steps (0 to 10)
  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Validation for current step
  const validateCurrentStep = useCallback(() => {
    switch (currentStep) {
      case 0: return userType !== null;
      case 1: return contactInfo.name && contactInfo.email;
      case 2: return summaryObjective.length > 0;
      case 3: return education.some(e => e.degree && e.school && e.year);
      case 4: return workExperience.some(we => we.role && we.company && we.year);
      case 5: return projects.some(p => p.title && p.bullets.some(b => b.trim()));
      case 6: return skills.some(s => s.category && s.list.some(l => l.trim()));
      case 7: return true; // Certifications are optional
      case 8: return true; // Achievements are optional
      case 9: return true; // Additional sections are optional
      case 10: return true; // Review step is always valid to proceed
      default: return false;
    }
  }, [currentStep, userType, contactInfo, summaryObjective, education, workExperience, projects, skills]);

  // Finalize Resume Generation
  const handleFinalizeResume = async () => {
    if (!user) {
      alert('Please sign in to finalize your resume.');
      onShowAuth();
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    try {
      const finalResumeData = compileResumeData();
      // Here you might call an AI service to "finalize" or "optimize" the compiled data
      // For this example, we'll just set the compiled data as the optimized resume
      // In a real scenario, this would involve an API call similar to ResumeOptimizer
      const reconstructedText = reconstructResumeText(finalResumeData);
      const optimized = await optimizeResume(
        reconstructedText,
        '', // No job description for guided builder optimization
        userType,
        user.name,
        user.email,
        user.phone,
        user.linkedin,
        user.github,
        undefined,
        undefined,
        '' // No target role for guided builder optimization
      );

      setOptimizedResume(optimized);
      setIsGenerating(false);
      alert('Resume finalized successfully!');
      // Optionally, navigate to a success page or show a modal
    } catch (error: any) {
      console.error('Error finalizing resume:', error);
      setGenerationError('Failed to finalize resume. Please try again.');
      setIsGenerating(false);
    }
  };

  // Zoom handlers
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.1, 0.5));

  // Toggle review section expansion
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

  // Navigate to edit step from review
  const navigateToEditStep = (stepIndex: number) => {
    setCurrentStep(stepIndex);
    setOptimizedResume(null); // Clear optimized resume to show input wizard
  };

  // Render functions for each step's form
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Select Your Experience Level</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setUserType('fresher')}
                className={`p-4 border rounded-xl flex flex-col items-center ${userType === 'fresher' ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-300'}`}
              >
                <User className="w-8 h-8 text-blue-600 mb-2" />
                <span className="font-medium">Fresher / New Graduate</span>
              </button>
              <button
                onClick={() => setUserType('experienced')}
                className={`p-4 border rounded-xl flex flex-col items-center ${userType === 'experienced' ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-300'}`}
              >
                <Briefcase className="w-8 h-8 text-blue-600 mb-2" />
                <span className="font-medium">Experienced Professional</span>
              </button>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Contact Information</h2>
            <input type="text" placeholder="Full Name" value={contactInfo.name} onChange={e => setContactInfo({...contactInfo, name: e.target.value})} className="input-base" />
            <input type="email" placeholder="Email" value={contactInfo.email} onChange={e => setContactInfo({...contactInfo, email: e.target.value})} className="input-base" />
            <input type="tel" placeholder="Phone" value={contactInfo.phone} onChange={e => setContactInfo({...contactInfo, phone: e.target.value})} className="input-base" />
            <input type="text" placeholder="LinkedIn Profile URL" value={contactInfo.linkedin} onChange={e => setContactInfo({...contactInfo, linkedin: e.target.value})} className="input-base" />
            <input type="text" placeholder="GitHub Profile URL" value={contactInfo.github} onChange={e => setContactInfo({...contactInfo, github: e.target.value})} className="input-base" />
            <input type="text" placeholder="Location (City, State, Country)" value={contactInfo.location} onChange={e => setContactInfo({...contactInfo, location: e.target.value})} className="input-base" />
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">{userType === 'experienced' ? 'Professional Summary' : 'Career Objective'}</h2>
            <textarea placeholder={userType === 'experienced' ? 'A concise summary of your professional experience...' : 'Your career goals and aspirations...'} value={summaryObjective} onChange={e => setSummaryObjective(e.target.value)} className="input-base h-32" />
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Education</h2>
            {education.map((edu, index) => (
              <div key={index} className="card p-4 mb-4 space-y-2">
                <input type="text" placeholder="Degree" value={edu.degree} onChange={e => { const newEdu = [...education]; newEdu[index].degree = e.target.value; setEducation(newEdu); }} className="input-base" />
                <input type="text" placeholder="School/University" value={edu.school} onChange={e => { const newEdu = [...education]; newEdu[index].school = e.target.value; setEducation(newEdu); }} className="input-base" />
                <input type="text" placeholder="Year (e.g., 2020-2024)" value={edu.year} onChange={e => { const newEdu = [...education]; newEdu[index].year = e.target.value; setEducation(newEdu); }} className="input-base" />
                <input type="text" placeholder="CGPA/GPA (Optional)" value={edu.cgpa} onChange={e => { const newEdu = [...education]; newEdu[index].cgpa = e.target.value; setEducation(newEdu); }} className="input-base" />
                <input type="text" placeholder="Location (Optional)" value={edu.location} onChange={e => { const newEdu = [...education]; newEdu[index].location = e.target.value; setEducation(newEdu); }} className="input-base" />
                {education.length > 1 && <button onClick={() => setEducation(education.filter((_, i) => i !== index))} className="btn-secondary mt-2">Remove</button>}
              </div>
            ))}
            <button onClick={() => setEducation([...education, { degree: '', school: '', year: '' }])} className="btn-secondary">Add Education</button>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Work Experience</h2>
            {workExperience.map((exp, index) => (
              <div key={index} className="card p-4 mb-4 space-y-2">
                <input type="text" placeholder="Role" value={exp.role} onChange={e => { const newExp = [...workExperience]; newExp[index].role = e.target.value; setWorkExperience(newExp); }} className="input-base" />
                <input type="text" placeholder="Company" value={exp.company} onChange={e => { const newExp = [...workExperience]; newExp[index].company = e.target.value; setWorkExperience(newExp); }} className="input-base" />
                <input type="text" placeholder="Year (e.g., Jan 2022 - Present)" value={exp.year} onChange={e => { const newExp = [...workExperience]; newExp[index].year = e.target.value; setWorkExperience(newExp); }} className="input-base" />
                <h4 className="font-medium text-gray-700 mt-3">Bullet Points</h4>
                {exp.bullets.map((bullet, bIndex) => (
                  <div key={bIndex} className="flex space-x-2">
                    <input type="text" placeholder="Achievement/Responsibility" value={bullet} onChange={e => { const newExp = [...workExperience]; newExp[index].bullets[bIndex] = e.target.value; setWorkExperience(newExp); }} className="input-base flex-grow" />
                    {exp.bullets.length > 1 && <button onClick={() => { const newExp = [...workExperience]; newExp[index].bullets.splice(bIndex, 1); setWorkExperience(newExp); }} className="btn-secondary">Remove</button>}
                  </div>
                ))}
                <button onClick={() => { const newExp = [...workExperience]; newExp[index].bullets.push(''); setWorkExperience(newExp); }} className="btn-secondary">Add Bullet</button>
                {workExperience.length > 1 && <button onClick={() => setWorkExperience(workExperience.filter((_, i) => i !== index))} className="btn-secondary mt-2">Remove Experience</button>}
              </div>
            ))}
            <button onClick={() => setWorkExperience([...workExperience, { role: '', company: '', year: '', bullets: [''] }])} className="btn-secondary">Add Work Experience</button>
          </div>
        );
      case 5:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Projects</h2>
            {projects.map((proj, index) => (
              <div key={index} className="card p-4 mb-4 space-y-2">
                <input type="text" placeholder="Project Title" value={proj.title} onChange={e => { const newProj = [...projects]; newProj[index].title = e.target.value; setProjects(newProj); }} className="input-base" />
                <h4 className="font-medium text-gray-700 mt-3">Bullet Points</h4>
                {proj.bullets.map((bullet, bIndex) => (
                  <div key={bIndex} className="flex space-x-2">
                    <input type="text" placeholder="Project Detail" value={bullet} onChange={e => { const newProj = [...projects]; newProj[index].bullets[bIndex] = e.target.value; setProjects(newProj); }} className="input-base flex-grow" />
                    {proj.bullets.length > 1 && <button onClick={() => { const newProj = [...projects]; newProj[index].bullets.splice(bIndex, 1); setProjects(newProj); }} className="btn-secondary">Remove</button>}
                  </div>
                ))}
                <button onClick={() => { const newProj = [...projects]; newProj[index].bullets.push(''); setProjects(newProj); }} className="btn-secondary">Add Bullet</button>
                {projects.length > 1 && <button onClick={() => setProjects(projects.filter((_, i) => i !== index))} className="btn-secondary mt-2">Remove Project</button>}
              </div>
            ))}
            <button onClick={() => setProjects([...projects, { title: '', bullets: [''] }])} className="btn-secondary">Add Project</button>
          </div>
        );
      case 6:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Skills</h2>
            {skills.map((skillCat, index) => (
              <div key={index} className="card p-4 mb-4 space-y-2">
                <input type="text" placeholder="Category (e.g., Programming Languages)" value={skillCat.category} onChange={e => { const newSkills = [...skills]; newSkills[index].category = e.target.value; setSkills(newSkills); }} className="input-base" />
                <h4 className="font-medium text-gray-700 mt-3">Skills (comma-separated)</h4>
                <input type="text" placeholder="e.g., JavaScript, Python, React" value={skillCat.list.join(', ')} onChange={e => { const newSkills = [...skills]; newSkills[index].list = e.target.value.split(',').map(s => s.trim()); setSkills(newSkills); }} className="input-base" />
                {skills.length > 1 && <button onClick={() => setSkills(skills.filter((_, i) => i !== index))} className="btn-secondary mt-2">Remove Category</button>}
              </div>
            ))}
            <button onClick={() => setSkills([...skills, { category: '', list: [''] }])} className="btn-secondary">Add Skill Category</button>
          </div>
        );
      case 7:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Certifications (Optional)</h2>
            {certifications.length === 0 && <p className="text-gray-600">No certifications added yet.</p>}
            {certifications.map((cert, index) => (
              <div key={index} className="card p-4 mb-4 space-y-2">
                <input type="text" placeholder="Certification Title" value={cert.title} onChange={e => { const newCerts = [...certifications]; newCerts[index].title = e.target.value; setCertifications(newCerts); }} className="input-base" />
                <textarea placeholder="Description (Optional)" value={cert.description} onChange={e => { const newCerts = [...certifications]; newCerts[index].description = e.target.value; setCertifications(newCerts); }} className="input-base h-20" />
                <button onClick={() => setCertifications(certifications.filter((_, i) => i !== index))} className="btn-secondary mt-2">Remove Certification</button>
              </div>
            ))}
            <button onClick={() => setCertifications([...certifications, { title: '', description: '' }])} className="btn-secondary">Add Certification</button>
          </div>
        );
      case 8:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Achievements (Optional)</h2>
            {achievements.length === 0 && <p className="text-gray-600">No achievements added yet.</p>}
            {achievements.map((ach, index) => (
              <div key={index} className="card p-4 mb-4 space-y-2">
                <textarea placeholder="Describe an achievement" value={ach.description} onChange={e => { const newAchs = [...achievements]; newAchs[index].description = e.target.value; setAchievements(newAchs); }} className="input-base h-20" />
                <button onClick={() => setAchievements(achievements.filter((_, i) => i !== index))} className="btn-secondary mt-2">Remove Achievement</button>
              </div>
            ))}
            <button onClick={() => setAchievements([...achievements, { description: '' }])} className="btn-secondary">Add Achievement</button>
          </div>
        );
      case 9:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Additional Sections (Optional)</h2>
            {additionalSections.length === 0 && <p className="text-gray-600">No additional sections added yet.</p>}
            {additionalSections.map((sec, index) => (
              <div key={index} className="card p-4 mb-4 space-y-2">
                <input type="text" placeholder="Section Title (e.g., Awards, Publications)" value={sec.title} onChange={e => { const newSecs = [...additionalSections]; newSecs[index].title = e.target.value; setAdditionalSections(newSecs); }} className="input-base" />
                <h4 className="font-medium text-gray-700 mt-3">Bullet Points</h4>
                {sec.bullets.map((bullet, bIndex) => (
                  <div key={bIndex} className="flex space-x-2">
                    <input type="text" placeholder="Detail" value={bullet} onChange={e => { const newSecs = [...additionalSections]; newSecs[index].bullets[bIndex] = e.target.value; setAdditionalSections(newSecs); }} className="input-base flex-grow" />
                    {sec.bullets.length > 1 && <button onClick={() => { const newSecs = [...additionalSections]; newSecs[index].bullets.splice(bIndex, 1); setAdditionalSections(newSecs); }} className="btn-secondary">Remove</button>}
                  </div>
                ))}
                <button onClick={() => { const newSecs = [...additionalSections]; newSecs[index].bullets.push(''); setAdditionalSections(newSecs); }} className="btn-secondary">Add Bullet</button>
                {additionalSections.length > 1 && <button onClick={() => setAdditionalSections(additionalSections.filter((_, i) => i !== index))} className="btn-secondary mt-2">Remove Section</button>}
              </div>
            ))}
            <button onClick={() => setAdditionalSections([...additionalSections, { title: '', bullets: [''] }])} className="btn-secondary">Add Additional Section</button>
          </div>
        );
      case 10: // Review Step
        const currentResumeData = compileResumeData();
        const sectionsToReview = [
          { key: 'contactInfo', title: 'Contact Information', data: contactInfo, icon: <User className="w-5 h-5" />, step: 1 },
          { key: 'summaryObjective', title: userType === 'experienced' ? 'Professional Summary' : 'Career Objective', data: summaryObjective, icon: <FileText className="w-5 h-5" />, step: 2 },
          { key: 'education', title: 'Education', data: education, icon: <GraduationCap className="w-5 h-5" />, step: 3 },
          { key: 'workExperience', title: 'Work Experience', data: workExperience, icon: <Briefcase className="w-5 h-5" />, step: 4 },
          { key: 'projects', title: 'Projects', data: projects, icon: <Code className="w-5 h-5" />, step: 5 },
          { key: 'skills', title: 'Skills', data: skills, icon: <Target className="w-5 h-5" />, step: 6 },
          { key: 'certifications', title: 'Certifications', data: certifications, icon: <Award className="w-5 h-5" />, step: 7 },
          { key: 'achievements', title: 'Achievements', data: achievements, icon: <Sparkles className="w-5 h-5" />, step: 8 },
          { key: 'additionalSections', title: 'Additional Sections', data: additionalSections, icon: <Plus className="w-5 h-5" />, step: 9 },
        ];

        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Review Your Resume</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Panel: Collapsible Sections */}
              <div className="space-y-4">
                {sectionsToReview.map(section => (
                  <div key={section.key} className="card p-4">
                    <button
                      onClick={() => toggleReviewSection(section.key)}
                      className="w-full flex justify-between items-center font-semibold text-lg text-gray-900 dark:text-gray-100"
                    >
                      <span className="flex items-center space-x-2">
                        {section.icon}
                        <span>{section.title}</span>
                      </span>
                      {expandedReviewSections.has(section.key) ? <ChevronUp /> : <ChevronDown />}
                    </button>
                    {expandedReviewSections.has(section.key) && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-300 text-gray-700 dark:text-gray-300 text-sm">
                        {/* Display content based on section key */}
                        {section.key === 'contactInfo' && (
                          <div className="space-y-1">
                            <p><strong>Name:</strong> {contactInfo.name}</p>
                            <p><strong>Email:</strong> {contactInfo.email}</p>
                            <p><strong>Phone:</strong> {contactInfo.phone}</p>
                            <p><strong>LinkedIn:</strong> {contactInfo.linkedin}</p>
                            <p><strong>GitHub:</strong> {contactInfo.github}</p>
                            <p><strong>Location:</strong> {contactInfo.location}</p>
                          </div>
                        )}
                        {section.key === 'summaryObjective' && <p>{summaryObjective}</p>}
                        {section.key === 'education' && education.map((edu, idx) => (
                          <p key={idx}>{edu.degree} from {edu.school} ({edu.year})</p>
                        ))}
                        {section.key === 'workExperience' && workExperience.map((exp, idx) => (
                          <div key={idx} className="mb-2">
                            <p><strong>{exp.role}</strong> at {exp.company} ({exp.year})</p>
                            <ul className="list-disc list-inside ml-4">
                              {exp.bullets.map((b, bIdx) => <li key={bIdx}>{b}</li>)}
                            </ul>
                          </div>
                        ))}
                        {section.key === 'projects' && projects.map((proj, idx) => (
                          <div key={idx} className="mb-2">
                            <p><strong>{proj.title}</strong></p>
                            <ul className="list-disc list-inside ml-4">
                              {proj.bullets.map((b, bIdx) => <li key={bIdx}>{b}</li>)}
                            </ul>
                          </div>
                        ))}
                        {section.key === 'skills' && skills.map((skillCat, idx) => (
                          <p key={idx}><strong>{skillCat.category}:</strong> {skillCat.list.join(', ')}</p>
                        ))}
                        {section.key === 'certifications' && certifications.map((cert, idx) => (
                          <p key={idx}><strong>{cert.title}</strong>: {cert.description}</p>
                        ))}
                        {section.key === 'achievements' && achievements.map((ach, idx) => (
                          <p key={idx}>{ach.description}</p>
                        ))}
                        {section.key === 'additionalSections' && additionalSections.map((sec, idx) => (
                          <div key={idx} className="mb-2">
                            <p><strong>{sec.title}</strong></p>
                            <ul className="list-disc list-inside ml-4">
                              {sec.bullets.map((b, bIdx) => <li key={bIdx}>{b}</li>)}
                            </ul>
                          </div>
                        ))}
                        <button
                          onClick={() => navigateToEditStep(section.step)}
                          className="btn-secondary btn-sm mt-4 flex items-center space-x-1"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span>Edit</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Right Panel: Resume Preview */}
              <div className="card p-4 flex flex-col items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Live Preview</h3>
                <div className="flex space-x-2 mb-4">
                  <button onClick={handleZoomOut} className="btn-secondary btn-sm"><ZoomOut className="w-4 h-4" /></button>
                  <span className="text-gray-700 dark:text-gray-300">{Math.round(zoomLevel * 100)}%</span>
                  <button onClick={handleZoomIn} className="btn-secondary btn-sm"><ZoomIn className="w-4 h-4" /></button>
                </div>
                <div className="flex-grow w-full overflow-hidden border border-gray-200 rounded-lg" style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}>
                  <ResumePreview resumeData={currentResumeData} userType={userType} />
                </div>
              </div>
            </div>
          </div>
        );
      case 11: // Finalize Step
        return (
          <div className="space-y-6 text-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Finalize Your Resume</h2>
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
                <p className="text-lg text-gray-700">Generating your optimized resume...</p>
              </div>
            ) : optimizedResume ? (
              <div className="space-y-4">
                <div className="bg-green-100 text-green-800 p-4 rounded-xl flex items-center justify-center space-x-2">
                  <CheckCircle className="w-6 h-6" />
                  <span className="text-lg font-medium">Resume Generated Successfully!</span>
                </div>
                <div className="card p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Checklist</h3>
                  <ul className="list-none space-y-2 text-left">
                    <li className="flex items-center space-x-2 text-green-700">
                      <CheckCircle className="w-5 h-5" />
                      <span>All steps completed.</span>
                    </li>
                    <li className="flex items-center space-x-2 text-green-700">
                      <CheckCircle className="w-5 h-5" />
                      <span>Resume preview ready.</span>
                    </li>
                    <li className="flex items-center space-x-2 text-green-700">
                      <CheckCircle className="w-5 h-5" />
                      <span>Ready for final optimization.</span>
                    </li>
                  </ul>
                </div>
                <div className="flex justify-center space-x-4 mt-6">
                  <button onClick={() => { /* Implement PDF export */ alert('PDF Export not implemented yet'); }} className="btn-primary">Download PDF</button>
                  <button onClick={() => { /* Implement Word export */ alert('Word Export not implemented yet'); }} className="btn-secondary">Download Word</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-600">Click the button below to generate your final optimized resume.</p>
                <button onClick={handleFinalizeResume} className="btn-primary flex items-center justify-center mx-auto space-x-2">
                  <Sparkles className="w-5 h-5" />
                  <span>Generate Final Resume</span>
                </button>
                {generationError && (
                  <div className="bg-red-100 text-red-800 p-4 rounded-xl flex items-center justify-center space-x-2">
                    <AlertCircle className="w-6 h-6" />
                    <span>{generationError}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pb-16 dark:from-dark-50 dark:to-dark-200 transition-colors duration-300">
      <div className="container-responsive py-8">
        <button
          onClick={() => navigate('/')}
          className="mb-6 bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 text-white hover:from-neon-cyan-400 hover:to-neon-blue-400 active:from-neon-cyan-600 active:to-neon-blue-600 shadow-md hover:shadow-neon-cyan py-3 px-5 rounded-xl inline-flex items-center space-x-2 transition-all duration-200"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="hidden sm:block">Back to Home</span>
        </button>

        {/* Progress Bar */}
        <div className="bg-white rounded-xl shadow-lg p-3 border border-gray-200 dark:bg-dark-50 dark:border-dark-400 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Guided Resume Builder</h1>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Step {currentStep + 1} of {totalSteps}
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-dark-300">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        <div className="max-w-7xl mx-auto space-y-6">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-100 dark:border-dark-300 dark:shadow-dark-xl">
            {renderStepContent()}
          </div>

          {/* Navigation Buttons */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 dark:bg-dark-100 dark:border-dark-300 dark:shadow-dark-xl">
            <div className="flex justify-between items-center">
              <button
                onClick={handlePrevious}
                disabled={currentStep === 0 || isGenerating}
                className="btn-secondary flex items-center space-x-2"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Previous</span>
              </button>
              {currentStep < totalSteps - 1 ? (
                <button
                  onClick={handleNext}
                  disabled={!validateCurrentStep() || isGenerating}
                  className="btn-primary flex items-center space-x-2"
                >
                  <span>Next</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={handleFinalizeResume}
                  disabled={isGenerating}
                  className="btn-primary flex items-center space-x-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>Finalize Resume</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuidedResumeBuilder;

