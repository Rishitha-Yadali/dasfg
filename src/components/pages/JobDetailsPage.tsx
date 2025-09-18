// src/components/pages/JobDetailsPage.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Clock,
  Users,
  Briefcase,
  Target,
  Zap,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  Send,
  Monitor,
  Database,
  Brain,
  Cpu,
  Cloud,
  Palette,
  BarChart3,
  MessageCircle,
  Share2
} from 'lucide-react';
import { careersData } from '../../data/careersData'; // Import the new data file
import { useAuth } from '../../contexts/AuthContext';

interface Job {
  id: string;
  title: string;
  domain: string;
  location: string;
  type: string;
  team: string;
  summary: string;
  mustHaveSkills: string[];
  tools: string[];
  eligibility: {
    experience: string;
    education: string;
  };
  perks: string[];
}

interface ApplicationForm {
  fullName: string;
  phone: string;
  email: string;
  college: string;
  passedOutYear: string;
  github: string;
  linkedin: string;
  resumeDrive: string;
  portfolioOrOther: string;
  whyYou: string;
}

interface JobDetailsPageProps {
  onShowAuth: (callback?: () => void) => void;
}

export const JobDetailsPage: React.FC<JobDetailsPageProps> = ({ onShowAuth }) => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [applicationForm, setApplicationForm] = useState<ApplicationForm>({
    fullName: '',
    phone: '',
    email: '',
    college: '',
    passedOutYear: '',
    github: '',
    linkedin: '',
    resumeDrive: '',
    portfolioOrOther: '',
    whyYou: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [pendingJobApplication, setPendingJobApplication] = useState<Job | null>(null);

  useEffect(() => {
    const foundJob = careersData.jobs.find((j) => j.id === jobId);
    if (foundJob) {
      setJob(foundJob);
    } else {
      navigate('/careers'); // Redirect if job not found
    }
  }, [jobId, navigate]);

  const getDomainIcon = (domain: string) => {
    switch (domain) {
      case 'Frontend': return <Monitor className="w-6 h-6" />;
      case 'Backend': return <Database className="w-6 h-6" />;
      case 'Full-Stack': return <Briefcase className="w-6 h-6" />;
      case 'Mobile': return <Briefcase className="w-6 h-6" />;
      case 'Data': return <BarChart3 className="w-6 h-6" />;
      case 'ML': return <Brain className="w-6 h-6" />;
      case 'AI': return <Cpu className="w-6 h-6" />;
      case 'Prompt': return <MessageCircle className="w-6 h-6" />;
      case 'DevOps': return <Cloud className="w-6 h-6" />;
      case 'Design': return <Palette className="w-6 h-6" />;
      case 'Marketing': return <Share2 className="w-6 h-6" />;
      case 'Content': return <FileText className="w-6 h-6" />;
      case 'SEO': return <Search className="w-6 h-6" />;
      case 'Social': return <Users className="w-6 h-6" />;
      case 'Video': return <Video className="w-6 h-6" />;
      default: return <Briefcase className="w-6 h-6" />;
    }
  };

  const getDomainColor = (domain: string) => {
    switch (domain) {
      case 'Frontend': return 'from-blue-500 to-cyan-500';
      case 'Backend': return 'from-green-500 to-emerald-500';
      case 'Full-Stack': return 'from-purple-500 to-pink-500';
      case 'Mobile': return 'from-orange-500 to-red-500';
      case 'Data': return 'from-indigo-500 to-blue-500';
      case 'ML': return 'from-violet-500 to-purple-500';
      case 'AI': return 'from-pink-500 to-rose-500';
      case 'Prompt': return 'from-teal-500 to-cyan-500';
      case 'DevOps': return 'from-gray-500 to-slate-500';
      case 'Design': return 'from-yellow-500 to-orange-500';
      case 'Marketing': return 'from-red-500 to-orange-500';
      case 'Content': return 'from-blue-500 to-purple-500';
      case 'SEO': return 'from-green-500 to-blue-500';
      case 'Social': return 'from-pink-500 to-purple-500';
      case 'Video': return 'from-orange-500 to-yellow-500';
      default: return 'from-gray-500 to-slate-500';
    }
  };

  const initiateJobApplication = useCallback((jobToApply: Job) => {
    setJob(jobToApply); // Ensure the job state is set for the modal
    setShowApplicationModal(true);
    setSubmitSuccess(false);
    setSubmitError('');
    setPendingJobApplication(null);
  }, []);

  const handleApplyClick = () => {
    if (!job) return; // Should not happen if component is rendered correctly

    if (!isAuthenticated) {
      setPendingJobApplication(job);
      onShowAuth(() => initiateJobApplication(job));
    } else {
      initiateJobApplication(job);
    }
  };

  const handleInputChange = (field: keyof ApplicationForm, value: string) => {
    setApplicationForm((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = (): boolean => {
    const required = [
      'fullName', 'phone', 'email', 'college', 'passedOutYear',
      'github', 'linkedin', 'resumeDrive', 'whyYou'
    ] as (keyof ApplicationForm)[];
    return required.every((field) => applicationForm[field].trim() !== '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      setSubmitError('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const today = new Date();
      const applicationDate = today.toISOString().split('T')[0];
      const companyName = 'PrimoBoost AI';

      const submitData = {
        jobId: job?.id,
        jobTitle: job?.title,
        fullName: applicationForm.fullName,
        phone: applicationForm.phone,
        email: applicationForm.email,
        college: applicationForm.college,
        passedOutYear: parseInt(applicationForm.passedOutYear),
        github: applicationForm.github,
        linkedin: applicationForm.linkedin,
        resumeDrive: applicationForm.resumeDrive,
        portfolioOrOther: applicationForm.portfolioOrOther,
        whyYou: applicationForm.whyYou,
        companyName,
        applicationDate
      };

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-job-application`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify(submitData)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Submission failed');
      }

      await response.json();
      setSubmitSuccess(true);
      setApplicationForm({
        fullName: '', phone: '', email: '', college: '', passedOutYear: '',
        github: '', linkedin: '', resumeDrive: '', portfolioOrOther: '', whyYou: ''
      });

      setTimeout(() => {
        setShowApplicationModal(false);
        setSubmitSuccess(false);
      }, 2500);
    } catch (error) {
      setSubmitError('Failed to submit application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    setShowApplicationModal(false);
    setSubmitSuccess(false);
    setSubmitError('');
  };

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        <p className="ml-3 text-lg text-gray-700">Loading job details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 transition-colors duration-300">
      <div className="container mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/careers')}
          className="mb-6 bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 text-white hover:from-neon-cyan-400 hover:to-neon-blue-400 active:from-neon-cyan-600 active:to-neon-blue-600 shadow-md hover:shadow-neon-cyan py-3 px-5 rounded-xl inline-flex items-center space-x-2 transition-all duration-200"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Careers</span>
        </button>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 dark:bg-dark-100 dark:border-dark-300">
          <div className="p-8">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div
                  className={`bg-gradient-to-r ${getDomainColor(job.domain)} w-16 h-16 rounded-xl flex items-center justify-center text-white shadow-lg`}
                >
                  {getDomainIcon(job.domain)}
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    {job.title}
                  </h1>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full font-medium">
                      {job.domain}
                    </span>
                    <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full font-medium">
                      {job.type}
                    </span>
                    <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full font-medium">
                      {job.location}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Job Description</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
              {job.summary}
            </p>

            <div className="space-y-6 mb-8">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                  <Target className="w-5 h-5 mr-2 text-blue-600" />
                  Must-Have Skills
                </h3>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                  {job.mustHaveSkills.map((skill, index) => (
                    <li key={index}>{skill}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                  <Zap className="w-5 h-5 mr-2 text-purple-600" />
                  Tools & Technologies
                </h3>
                <div className="flex flex-wrap gap-2">
                  {job.tools.map((tool, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full font-medium"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-green-600" />
                  Eligibility
                </h3>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Experience: {job.eligibility.experience}</li>
                  <li>Education: {job.eligibility.education}</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-orange-600" />
                  Perks & Benefits
                </h3>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                  {job.perks.map((perk, index) => (
                    <li key={index}>{perk}</li>
                  ))}
                </ul>
              </div>
            </div>

            <button
              onClick={handleApplyClick}
              className={`w-full bg-gradient-to-r ${getDomainColor(job.domain)} hover:opacity-90 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105`}
            >
              <Send className="w-5 h-5" />
              <span>Apply Now</span>
            </button>
          </div>
        </div>
      </div>

      {showApplicationModal && job && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto dark:bg-dark-100">
            {submitSuccess ? (
              <div className="p-8 text-center">
                <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Application Submitted!
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Thanks for applying to <strong>{job.title}</strong>. We'll review your
                  application and get back to you within 3–5 days.
                </p>
                <button
                  onClick={closeModal}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="relative bg-gradient-to-r from-blue-50 to-purple-50 p-6 border-b border-gray-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
                  <button
                    onClick={closeModal}
                    className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-white/50"
                  >
                    <X className="w-6 h-6" />
                  </button>

                  <div className="text-center pr-12">
                    <div
                      className={`bg-gradient-to-r ${getDomainColor(job.domain)} w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-lg`}
                    >
                      {getDomainIcon(job.domain)}
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                      Apply for {job.title}
                    </h1>
                    <p className="text-gray-600 dark:text-gray-300">
                      Fill out the form below to submit your application
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  {submitError && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl dark:bg-red-900/20 dark:border-red-500/50">
                      <div className="flex items-center">
                        <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                        <p className="text-red-700 font-medium">{submitError}</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={applicationForm.fullName}
                        onChange={(e) => handleInputChange('fullName', e.target.value)}
                        placeholder="Enter your full name"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone *
                      </label>
                      <input
                        type="tel"
                        value={applicationForm.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        placeholder="+91 9876543210"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={applicationForm.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="your.email@example.com"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        College / University *
                      </label>
                      <input
                        type="text"
                        value={applicationForm.college}
                        onChange={(e) => handleInputChange('college', e.target.value)}
                        placeholder="Your college or university"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Passed-out Year *
                      </label>
                      <input
                        type="number"
                        value={applicationForm.passedOutYear}
                        onChange={(e) => handleInputChange('passedOutYear', e.target.value)}
                        placeholder="2024"
                        min={2018}
                        max={2026}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        GitHub URL *
                      </label>
                      <input
                        type="url"
                        value={applicationForm.github}
                        onChange={(e) => handleInputChange('github', e.target.value)}
                        placeholder="https://github.com/yourusername"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        LinkedIn URL *
                      </label>
                      <input
                        type="url"
                        value={applicationForm.linkedin}
                        onChange={(e) => handleInputChange('linkedin', e.target.value)}
                        placeholder="https://linkedin.com/in/yourprofile"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                        required
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Resume (Google Drive link) *
                      </label>
                      <input
                        type="url"
                        value={applicationForm.resumeDrive}
                        onChange={(e) => handleInputChange('resumeDrive', e.target.value)}
                        placeholder="https://drive.google.com/file/..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Make sure Drive link is set to "Anyone with the link → Viewer"
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Portfolio / Other links
                    </label>
                    <input
                      type="url"
                      value={applicationForm.portfolioOrOther}
                      onChange={(e) => handleInputChange('portfolioOrOther', e.target.value)}
                      placeholder="https://yourportfolio.com (optional)"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Why you&apos;re a fit (2–3 lines) *
                    </label>
                    <textarea
                      value={applicationForm.whyYou}
                      onChange={(e) => handleInputChange('whyYou', e.target.value)}
                      placeholder="Tell us why you're perfect for this role..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 resize-none dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100"
                      maxLength={600}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {applicationForm.whyYou.length}/600 characters
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !validateForm()}
                    className={`w-full py-4 px-6 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center space-x-2 ${
                      isSubmitting || !validateForm()
                        ? 'bg-gray-400 cursor-not-allowed text-white'
                        : `bg-gradient-to-r ${getDomainColor(job.domain)} hover:opacity-90 text-white shadow-lg hover:shadow-xl`
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Submitting Application...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        <span>Submit Application</span>
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
