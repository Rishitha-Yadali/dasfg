// src/components/LinkedInMessageGenerator.tsx
import React, { useState, useEffect, useCallback } from 'react'; // Import useCallback
import {
  ArrowLeft,
  MessageCircle,
  Send,
  Copy,
  RefreshCw,
  User,
  Building,
  Target,
  Loader2,
  CheckCircle,
  AlertCircle,
  Linkedin,
  Users,
  Mail,
  Phone,
  Sparkles,
  Zap,
  Heart,
  ArrowRight,
  Briefcase,
  Share2
} from 'lucide-react';

import { paymentService } from '../services/paymentService';
import { useAuth } from '../contexts/AuthContext';
import { Subscription } from '../types/payment';
import { useNavigate } from 'react-router-dom';

type MessageType = 'connection' | 'cold-outreach' | 'follow-up' | 'job-inquiry' | 'referral';
type MessageTone = 'professional' | 'casual' | 'friendly';

interface MessageForm {
  messageType: MessageType;
  recipientFirstName: string;
  recipientLastName: string;
  recipientCompany: string;
  recipientJobTitle: string;
  senderName: string;
  senderCompany: string;
  senderRole: string;
  messagePurpose: string;
  tone: MessageTone;
  personalizedContext: string;
  industry: string;
  jobId?: string;
  referralContext?: string;
}

interface LinkedInMessageGeneratorProps {
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
  // NEW PROPS: For triggering tool process after add-on purchase
  toolProcessTrigger: (() => void) | null;
  setToolProcessTrigger: React.Dispatch<React.SetStateAction<(() => void) | null>>;
}

/**
 * Placeholder local generator (kept to avoid backend dependency here).
 * Replace with your real API call when wiring to OpenRouter.
 */
const generateLinkedInMessage = async (formData: MessageForm): Promise<string[]> => {
  // Simulate latency
  await new Promise((resolve) => setTimeout(resolve, 1200));

  if (formData.messageType === 'referral') {
    const jobInfo = formData.jobId ? ` (Job ID: ${formData.jobId})` : '';
    return [
      `Hi ${formData.recipientFirstName}, hope you're doing well! ${formData.senderName} suggested I reach out regarding the ${formData.recipientJobTitle}${jobInfo} at ${formData.recipientCompany}. ${formData.referralContext} I'd value a quick chat or a referral if appropriate—happy to share a tailored resume too. Thanks!`,
      `Hello ${formData.recipientFirstName}, I'm contacting you on ${formData.senderName}'s recommendation about the ${formData.recipientJobTitle}${jobInfo} role at ${formData.recipientCompany}. ${formData.referralContext} My background aligns with ${formData.industry || 'this area'} and I’d appreciate your guidance or a referral if possible.`,
      `Hi ${formData.recipientFirstName}, ${formData.senderName} pointed me to you for the ${formData.recipientJobTitle}${jobInfo} opening at ${formData.recipientCompany}. ${formData.referralContext} If there's a referral path, I’d be grateful—open to a 5–10 min chat at your convenience.`
    ];
  }

  // Non‑referral types
  const purpose = formData.messagePurpose || 'connecting further';
  return [
    `Hi ${formData.recipientFirstName}, I came across your work at ${formData.recipientCompany} as ${formData.recipientJobTitle} and was impressed. I'm interested in ${purpose}. Would love to connect and learn from your experience in ${formData.industry || 'this space'}.`,
    `Hello ${formData.recipientFirstName}, your role (${formData.recipientJobTitle} at ${formData.recipientCompany}) overlaps with my background. I’m exploring ${purpose} and think we share common interests. Open to connecting? — ${formData.senderName}`,
    `Hey ${formData.recipientFirstName}, noticing your impact at ${formData.recipientCompany}, especially around ${formData.personalizedContext || 'recent projects'}. I’m reaching out about ${purpose}. Would love to connect and exchange notes. — ${formData.senderName}`
  ];
};

export const LinkedInMessageGenerator: React.FC<LinkedInMessageGeneratorProps> = ({
  onNavigateBack,
  isAuthenticated,
  onShowAuth,
  userSubscription,
  onShowSubscriptionPlans,
  onShowAlert,
  refreshUserSubscription,
  toolProcessTrigger, // Destructure
  setToolProcessTrigger, // Destructure
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<MessageForm>({
    messageType: 'connection',
    recipientFirstName: '',
    recipientLastName: '',
    recipientCompany: '',
    recipientJobTitle: '',
    senderName: '',
    senderCompany: '',
    senderRole: '',
    messagePurpose: '',
    tone: 'professional',
    personalizedContext: '',
    industry: '',
    jobId: '',
    referralContext: ''
  });

  const [generatedMessages, setGeneratedMessages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copySuccess, setCopySuccess] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  // NEW STATE: To track if message generation was interrupted due to credit
  const [messageGenerationInterrupted, setMessageGenerationInterrupted] = useState(false);

  useEffect(() => {
    if (user?.name) {
      setFormData((prev) => ({ ...prev, senderName: user.name || prev.senderName }));
    }
  }, [user]);

  const handleInputChange = useCallback(<K extends keyof MessageForm>(field: K, value: MessageForm[K]) => { // Memoize
    setFormData((prev) => ({ ...prev, [field]: value as string }));
  }, []);

  const validateCurrentStep = useCallback((): boolean => { // Memoize
    switch (currentStep) {
      // Step 0 – picked a type
      case 0:
        return !!formData.messageType;

      // Step 1 – recipient details
      case 1: {
        const basicsValid =
          !!formData.recipientFirstName.trim() &&
          !!formData.recipientLastName.trim() &&
          !!formData.recipientCompany.trim() &&
          !!formData.recipientJobTitle.trim();

        if (formData.messageType === 'referral') {
          return basicsValid && !!formData.referralContext?.trim();
        }
        return basicsValid;
      }

      // Step 2 – message details
      case 2:
        if (formData.messageType === 'referral') return true;
        return !!formData.messagePurpose.trim();

      default:
        return false;
    }
  }, [currentStep, formData]); // Dependencies for memoized function

  const handleGenerateMessage = useCallback(async () => { // Memoize
    if (!isAuthenticated) {
      onShowAlert(
        'Authentication Required',
        'Please sign in to generate LinkedIn messages.',
        'error',
        'Sign In',
        onShowAuth
      );
      return;
    }

    // Ensure userSubscription is up-to-date before checking credits
    await refreshUserSubscription();

    const creditsLeft =
      (userSubscription?.linkedinMessagesTotal || 0) - (userSubscription?.linkedinMessagesUsed || 0);

    if (!userSubscription || creditsLeft <= 0) {
      const planDetails = paymentService.getPlanById(userSubscription?.planId);
      const planName = planDetails?.name || 'your current plan';
      const linkedinMessagesTotal = planDetails?.linkedinMessages || 0;

      setMessageGenerationInterrupted(true); // Set flag: message generation was interrupted
      onShowAlert(
        'LinkedIn Message Credits Exhausted',
        `You have used all your ${linkedinMessagesTotal} LinkedIn Message generations from ${planName}. Please upgrade your plan to continue generating messages.`,
        'warning',
        'Upgrade Plan',
        () => onShowSubscriptionPlans('linkedin-generator')
      );
      return;
    }

    // Final guard (should already be green due to validateCurrentStep)
    if (!formData.recipientFirstName || !formData.recipientCompany || !formData.recipientJobTitle) {
      onShowAlert('Missing Recipient Information', 'Please fill in all required recipient details.', 'warning');
      return;
    }
    if (formData.messageType !== 'referral' && !formData.messagePurpose) {
      onShowAlert('Missing Message Purpose', 'Please describe the purpose of your message.', 'warning');
      return;
    }
    if (formData.messageType === 'referral' && !formData.referralContext) {
      onShowAlert('Missing Referral Context', 'Please provide context for the referral.', 'warning');
      return;
    }

    setIsGenerating(true);
    try {
      const messages = await generateLinkedInMessage(formData);
      setGeneratedMessages(messages);

      if (userSubscription) {
        const usageResult = await paymentService.useLinkedInMessage(userSubscription.userId);
        if (usageResult.success) {
          await refreshUserSubscription();
        } else {
          console.error('Failed to decrement LinkedIn message usage:', usageResult.error);
          onShowAlert(
            'Usage Update Failed',
            'Failed to record LinkedIn message usage. Please contact support.',
            'error'
          );
        }
      }
    } catch (error: any) {
      console.error('Error generating LinkedIn message:', error);
      onShowAlert(
        'Generation Failed',
        `Failed to generate message: ${error?.message || 'Unknown error'}. Please try again.`,
        'error'
      );
    } finally {
      setIsGenerating(false);
    }
  }, [isAuthenticated, onShowAuth, userSubscription, onShowSubscriptionPlans, onShowAlert, refreshUserSubscription, formData, validateCurrentStep]); // Dependencies for memoized function

  // Register the handleGenerateMessage function with the App.tsx trigger
  useEffect(() => {
    setToolProcessTrigger(() => handleGenerateMessage);
    return () => {
      setToolProcessTrigger(null); // Clean up on unmount
    };
  }, [setToolProcessTrigger, handleGenerateMessage]); // Dependency on memoized handleGenerateMessage

  // NEW EFFECT: Re-trigger message generation if it was interrupted and credits are now available
  useEffect(() => {
    if (messageGenerationInterrupted && userSubscription) { // Check userSubscription for existence
      // Explicitly refresh userSubscription to get the latest data
      refreshUserSubscription().then(() => {
        // After refresh, check if credits are now available
        if (userSubscription && (userSubscription.linkedinMessagesTotal - userSubscription.linkedinMessagesUsed) > 0) {
          console.log('LinkedInMessageGenerator: Credits replenished, re-attempting message generation.');
          setMessageGenerationInterrupted(false); // Reset the flag immediately
          handleGenerateMessage(); // Re-run the message generation function
        }
      });
    }
  }, [messageGenerationInterrupted, refreshUserSubscription, userSubscription, handleGenerateMessage]); // Dependency on memoized handleGenerateMessage

  const handleCopyMessage = useCallback(async (message: string, index: number) => { // Memoize
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
      } else {
        // Fallback for older browsers
        const el = document.createElement('textarea');
        el.value = message;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopySuccess(index);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  }, []);

  const messageTypes: Array<{
    id: MessageType;
    title: string;
    description: string;
    icon: React.ReactNode;
    color: string;
  }> = [
    {
      id: 'connection',
      title: 'Connection Request',
      description: 'Send a personalized connection request to expand your network',
      icon: <Users className="w-6 h-6" />,
      color: 'from-blue-500 to-cyan-500'
    },
    {
      id: 'cold-outreach',
      title: 'Cold Outreach',
      description: 'Reach out to prospects or potential collaborators',
      icon: <Mail className="w-6 h-6" />,
      color: 'from-green-500 to-emerald-500'
    },
    {
      id: 'follow-up',
      title: 'Follow-up Message',
      description: 'Follow up on previous conversations or meetings',
      icon: <RefreshCw className="w-6 h-6" />,
      color: 'from-purple-500 to-pink-500'
    },
    {
      id: 'job-inquiry',
      title: 'Job Inquiry',
      description: 'Inquire about job opportunities or express interest',
      icon: <Briefcase className="w-6 h-6" />,
      color: 'from-orange-500 to-red-500'
    },
    {
      id: 'referral',
      title: 'Referral',
      description: 'Connect with someone based on a referral or recommendation',
      icon: <Share2 className="w-6 h-6" />,
      color: 'from-yellow-500 to-amber-500'
    }
  ];

  const steps = [
    {
      title: 'Message Type',
      component: (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Choose Message Type</h2>
            <p className="text-gray-600 dark:text-gray-300">Select the type of LinkedIn message you want to generate</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {messageTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => handleInputChange('messageType', type.id)}
                className={`p-6 rounded-2xl border-2 transition-all duration-300 text-left cursor-pointer transform hover:scale-105 ${
                  formData.messageType === type.id
                    ? 'border-blue-500 bg-blue-50 shadow-lg ring-4 ring-blue-200 dark:border-neon-cyan-500 dark:bg-neon-cyan-500/20 dark:ring-neon-cyan-500/30'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 shadow-md dark:border-dark-300 dark:hover:border-neon-cyan-400 dark:hover:bg-dark-200'
                }`}
              >
                <div className={`bg-gradient-to-r ${type.color} w-14 h-14 rounded-full flex items-center justify-center text-white mb-4`}>
                  {type.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{type.title}</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">{type.description}</p>
              </button>
            ))}
          </div>
        </div>
      )
    },
    {
      title: 'Recipient Details',
      component: (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Tell us about the person you’re reaching out to
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              {formData.messageType === 'referral'
                ? 'Provide details about the recipient and the referral context.'
                : 'Provide details about the recipient.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">First Name *</label>
              <input
                type="text"
                value={formData.recipientFirstName}
                onChange={(e) => handleInputChange('recipientFirstName', e.target.value)}
                placeholder="John"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:border-neon-cyan-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Last Name *</label>
              <input
                type="text"
                value={formData.recipientLastName}
                onChange={(e) => handleInputChange('recipientLastName', e.target.value)}
                placeholder="Smith"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:border-neon-cyan-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Company *</label>
              <input
                type="text"
                value={formData.recipientCompany}
                onChange={(e) => handleInputChange('recipientCompany', e.target.value)}
                placeholder="TechCorp Inc."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:border-neon-cyan-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Job Title *</label>
              <input
                type="text"
                value={formData.recipientJobTitle}
                onChange={(e) => handleInputChange('recipientJobTitle', e.target.value)}
                placeholder="Senior Software Engineer"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:border-neon-cyan-400"
              />
            </div>

            {formData.messageType === 'referral' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Job ID (Optional)</label>
                <input
                  type="text"
                  value={formData.jobId || ''}
                  onChange={(e) => handleInputChange('jobId', e.target.value)}
                  placeholder="12345"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:border-neon-cyan-400"
                />
              </div>
            )}

            <div className={formData.messageType === 'referral' ? '' : 'md:col-span-2'}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Industry</label>
              <input
                type="text"
                value={formData.industry}
                onChange={(e) => handleInputChange('industry', e.target.value)}
                placeholder="Technology, Healthcare, Finance, etc."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:border-neon-cyan-400"
              />
            </div>

            {formData.messageType === 'referral' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Referral Context *</label>
                <textarea
                  value={formData.referralContext || ''}
                  onChange={(e) => handleInputChange('referralContext', e.target.value)}
                  placeholder="How do you know this person or why are you referring them? E.g., 'Our mutual connection Y suggested I reach out'."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 resize-none transition-all dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:border-neon-cyan-400"
                />
              </div>
            )}
          </div>
        </div>
      )
    },
    {
      title: 'Message Details',
      component: (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Message Configuration</h2>
            <p className="text-gray-600 dark:text-gray-300">Customize your message tone and purpose</p>
          </div>

          <div className="space-y-6">
            {formData.messageType !== 'referral' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Message Purpose *</label>
                <textarea
                  value={formData.messagePurpose}
                  onChange={(e) => handleInputChange('messagePurpose', e.target.value)}
                  placeholder="Why are you reaching out? What do you want to achieve?"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 resize-none transition-all dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:border-neon-cyan-400"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tone</label>
              <div className="flex rounded-xl gap-1 bg-gray-100 border border-gray-200 shadow-inner dark:bg-dark-200 dark:border-dark-300">
                {(['professional', 'casual', 'friendly'] as MessageTone[]).map((tone) => (
                  <button
                    key={tone}
                    onClick={() => handleInputChange('tone', tone)}
                    className={`flex-1 text-center py-2 px-2 rounded-lg font-medium transition-all duration-300 capitalize ${
                      formData.tone === tone
                        ? 'bg-white shadow-md text-blue-700 dark:bg-dark-100 dark:text-neon-cyan-400'
                        : 'text-gray-600 hover:text-blue-500 dark:text-gray-300 dark:hover:text-neon-cyan-400'
                    }`}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>

            {formData.messageType !== 'referral' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Personalized Context</label>
                <textarea
                  value={formData.personalizedContext}
                  onChange={(e) => handleInputChange('personalizedContext', e.target.value)}
                  placeholder="Any specific details about them or shared connections/interests..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-24 resize-none transition-all dark:bg-dark-200 dark:border-dark-300 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:border-neon-cyan-400"
                />
              </div>
            )}
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 text-gray-900 font-sans dark:from-dark-50 dark:to-dark-200 dark:text-gray-100 transition-colors duration-300">
      {/* Top Bar */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40 dark:bg-dark-50 dark:border-dark-300">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => {
                // prefer prop if provided
                if (onNavigateBack) onNavigateBack();
                else navigate('/');
              }}
              className="mb-6 mt-5 bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 text-white hover:from-neon-cyan-400 hover:to-neon-blue-400 active:from-neon-cyan-600 active:to-neon-blue-600 shadow-md hover:shadow-neon-cyan py-3 px-5 rounded-xl inline-flex items-center space-x-2 transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:block">Back to Home</span>
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">LinkedIn Message Generator</h1>
            <div className="w-16" />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Hero */}
          <div className="text-center mb-8">
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-200 dark:bg-dark-100 dark:border-dark-300 dark:shadow-dark-xl">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 dark:bg-neon-cyan-500/20 dark:shadow-neon-cyan">
                <Linkedin className="w-8 h-8 text-blue-600 dark:text-neon-cyan-400" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4 leading-tight">
                Craft Perfect{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-neon-cyan-400 dark:to-neon-blue-400">
                  LinkedIn Messages
                </span>
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                Generate personalized LinkedIn messages that get responses. Perfect for networking, job hunting, and
                business outreach.
              </p>
            </div>
          </div>

          {!generatedMessages.length ? (
            <div className="space-y-8">
              {/* Stepper */}
              <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-200 dark:bg-dark-100 dark:border-dark-300 dark:shadow-dark-xl">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    Step {currentStep + 1}: {steps[currentStep].title}
                  </h2>
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Progress: {currentStep + 1} of {steps.length}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  {steps.map((step, index) => (
                    <React.Fragment key={index}>
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
                            index < currentStep
                              ? 'bg-green-500 text-white border-green-500 dark:bg-neon-cyan-500 dark:border-neon-cyan-500'
                              : index === currentStep
                              ? 'bg-blue-500 text-white border-blue-500 shadow-md scale-110 dark:bg-neon-blue-500 dark:border-neon-blue-500 dark:shadow-neon-blue'
                              : 'bg-white text-gray-500 border-gray-300 dark:bg-dark-200 dark:text-gray-400 dark:border-dark-300'
                          }`}
                        >
                          {index < currentStep ? <CheckCircle className="w-6 h-6" /> : <span className="text-lg font-bold">{index + 1}</span>}
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
                            index < currentStep ? 'bg-green-500 dark:bg-neon-cyan-500' : 'bg-gray-200 dark:bg-dark-300'
                          }`}
                        />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Step content */}
              <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-200 dark:bg-dark-100 dark:border-dark-300 dark:shadow-dark-xl">
                {steps[currentStep].component}
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Header after generation */}
              <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-200 overflow-hidden dark:bg-dark-100 dark:border-dark-300 dark:shadow-dark-xl">
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-2xl dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Messages Generated!</h3>
                    <button
                      onClick={() => {
                        setGeneratedMessages([]);
                        setCurrentStep(0);
                      }}
                      className="bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 hover:from-neon-cyan-400 hover:to-neon-blue-400 text-white font-semibold py-3 px-6 rounded-xl transition-colors shadow-lg hover:shadow-neon-cyan transform hover:-translate-y-0.5"
                    >
                      Generate New
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-gray-600 dark:text-gray-300">
                    Choose the message that best fits your style, and feel free to edit it before sending.
                  </p>
                </div>
              </div>

              {/* Message cards */}
              <div className="space-y-6">
                {generatedMessages.map((message, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden dark:bg-dark-100 dark:border-dark-300 dark:shadow-dark-xl"
                  >
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 border-b border-gray-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Option {index + 1}</h3>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block">
                            {message.length} characters
                          </span>
                          <button
                            onClick={() => handleCopyMessage(message, index)}
                            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all transform hover:scale-105 shadow-lg ${
                              copySuccess === index
                                ? 'bg-green-600 text-white shadow-md dark:bg-neon-cyan-500 dark:shadow-neon-cyan'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md dark:bg-neon-blue-500 dark:hover:bg-neon-blue-400 dark:shadow-neon-blue'
                            }`}
                          >
                            {copySuccess === index ? (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200 dark:bg-dark-200 dark:border-dark-300">
                        <p className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">{message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tips */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-3xl p-6 border border-blue-200 dark:from-dark-200 dark:to-dark-300 dark:border-neon-cyan-400/50">
                <div className="flex items-start space-x-3">
                  <div className="bg-blue-100 p-2 rounded-full dark:bg-neon-cyan-500/20">
                    <Zap className="w-5 h-5 text-blue-600 dark:text-neon-cyan-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-blue-900 dark:text-neon-cyan-300 mb-2">💡 Tips for Better Results</h4>
                    <ul className="text-blue-800 dark:text-gray-300 text-sm space-y-1">
                      <li>• Personalize with specific details about their work or company.</li>
                      <li>• Keep messages concise and focused on value.</li>
                      <li>• Always include a clear call-to-action.</li>
                      <li>• Follow up if you don't get a response within a week.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom action bar */}
      {!generatedMessages.length && (
        <div className="sticky bottom-0 z-50 bg-white border-t border-gray-200 shadow-2xl dark:bg-dark-50 dark:border-dark-300">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <button
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg ${
                  currentStep === 0
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-600 hover:bg-gray-700 text-white hover:shadow-xl transform hover:-translate-y-0.5 dark:bg-dark-300 dark:hover:bg-dark-400'
                }`}
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Previous</span>
              </button>

              <div className="text-center hidden md:block">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Progress</div>
                <div className="w-48 bg-gray-200 rounded-full h-2 dark:bg-dark-300">
                  <div
                    className="bg-gradient-to-r from-neon-cyan-500 to-neon-purple-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                  />
                </div>
              </div>

              {currentStep < steps.length - 1 ? (
                <button
                  onClick={() => setCurrentStep(currentStep + 1)}
                  disabled={!validateCurrentStep()}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg ${
                    !validateCurrentStep()
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 hover:from-neon-cyan-400 hover:to-neon-blue-400 text-white hover:shadow-neon-cyan transform hover:-translate-y-0.5'
                  }`}
                >
                  <span>Next</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={handleGenerateMessage}
                  disabled={!validateCurrentStep() || isGenerating}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg ${
                    !validateCurrentStep() || isGenerating
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-gradient-to-r from-neon-cyan-500 to-neon-purple-500 hover:from-neon-cyan-400 hover:to-neon-purple-400 text-white hover:shadow-neon-cyan transform hover:-translate-y-0.5'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>{isAuthenticated ? 'Generate Messages' : 'Sign In to Generate'}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
