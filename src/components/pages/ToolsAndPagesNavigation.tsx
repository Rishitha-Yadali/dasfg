// src/components/pages/ToolsAndPagesNavigation.tsx
import React from 'react';
import {
  Home,
  Info,
  BookOpen,
  Phone,
  Target,
  TrendingUp,
  PlusCircle,
  MessageCircle,
  Sparkles,
  ArrowRight,
  Users,
  Briefcase,
  Award,
  Crown,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Subscription } from '../../types/payment'; // Assuming this path is correct

interface ToolsAndPagesNavigationProps {
  onPageChange: (page: string) => void;
  isAuthenticated: boolean;
  onShowAuth: () => void;
  userSubscription: Subscription | null;
  onShowSubscriptionPlans: () => void; // MODIFIED: This now calls the PlanSelectionModal
}

interface FeatureCardProps {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  colorClass: string;
  onPageChange: (page: string) => void;
  isAuthenticated: boolean;
  onShowAuth: () => void;
  requiresAuth?: boolean;
  userSubscription: Subscription | null;
  onShowSubscriptionPlans: () => void; // MODIFIED: This now calls the PlanSelectionModal
  isTool?: boolean;
}

const FeatureCard: React.FC<FeatureCardProps> = ({
  id,
  title,
  description,
  icon,
  colorClass,
  onPageChange,
  isAuthenticated,
  onShowAuth,
  requiresAuth = false,
  userSubscription,
  onShowSubscriptionPlans, // MODIFIED: Destructure the new prop
  isTool = false,
}) => {
  const handleCardClick = () => {
    if (requiresAuth && !isAuthenticated) {
      onShowAuth();
      return;
    }

    // REMOVED: The conditional block that checked for credits and showed plan selection.
    // The credit check will now happen on the tool's dedicated page.

    onPageChange(id);
  };

  const getUsageText = () => {
    if (!isAuthenticated) return null;
    if (!userSubscription) return <span className="text-xs font-medium text-red-600 dark:text-red-400">No active plan</span>;

    let used: number | undefined;
    let total: number | undefined;

    switch (id) {
      case 'optimizer':
        used = userSubscription.optimizationsUsed;
        total = userSubscription.optimizationsTotal;
        break;
      case 'score-checker':
        used = userSubscription.scoreChecksUsed;
        total = userSubscription.scoreChecksTotal;
        break;
      case 'guided-builder':
        used = userSubscription.guidedBuildsUsed;
        total = userSubscription.guidedBuildsTotal;
        break;
      case 'linkedin-generator':
        used = userSubscription.linkedinMessagesUsed;
        total = userSubscription.linkedinMessagesTotal;
        break;
      default:
        return null;
    }

    if (used !== undefined && total !== undefined) {
      const remaining = total - used;
      if (total === Infinity) {
        return <span className="text-xs font-medium text-green-600 dark:text-green-400">Unlimited</span>;
      } else if (remaining <= 0) {
        return <span className="text-xs font-medium text-red-600 dark:text-red-400">Used all {total}</span>;
      } else {
        return <span className="text-xs font-medium text-green-600 dark:text-green-400">{remaining} remaining</span>;
      }
    }
    return null;
  };

  const isDisabled = requiresAuth && !isAuthenticated;
  const usageText = getUsageText();
  const isUsageExhausted = usageText && usageText.props.className.includes('text-red-600');

  return (
    <button
      onClick={handleCardClick}
      disabled={isDisabled}
      className={`card-hover p-6 flex flex-col items-start sm:flex-row sm:items-center justify-between transition-all duration-300 bg-gradient-to-br from-white to-primary-50 border border-secondary-100 shadow-lg hover:shadow-xl group rounded-2xl dark:from-dark-100 dark:to-dark-200 dark:border-dark-300 dark:hover:shadow-neon-cyan/20 ${
        isDisabled ? 'opacity-70 cursor-not-allowed' : ''
      } ${isUsageExhausted ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : ''}`}
    >
      <div className="flex items-center space-x-4">
        <div className={`rounded-xl p-3 group-hover:bg-gradient-to-r ${colorClass} group-hover:text-white transition-all duration-300 shadow-sm flex-shrink-0 group-hover:scale-110 dark:group-hover:shadow-neon-cyan`}>
          {React.cloneElement(icon as React.ReactElement, { className: "w-8 h-8" })}
        </div>
        <div>
          <span className="text-lg font-bold text-secondary-900 dark:text-gray-100">{title}</span>
          <p className="text-sm text-secondary-700 dark:text-gray-300">{description}</p>
          {usageText}
        </div>
      </div>
      <ArrowRight className={`w-6 h-6 text-secondary-400 group-hover:text-neon-cyan-400 group-hover:translate-x-1 transition-transform duration-300 flex-shrink-0 dark:text-gray-500 dark:group-hover:text-neon-cyan-400 ${isDisabled ? 'opacity-50' : ''}`} />
    </button>
  );
};

export const ToolsAndPagesNavigation: React.FC<ToolsAndPagesNavigationProps> = ({
  onPageChange,
  isAuthenticated,
  onShowAuth,
  userSubscription,
  onShowSubscriptionPlans, // MODIFIED: Destructure the new prop
}) => {
  const { user } = useAuth(); // Use useAuth to get user details if needed

  const tools = [
    {
      id: 'optimizer',
      title: 'JD-Based Optimizer',
      description: 'Upload your resume and a job description to get a perfectly tailored resume.',
      icon: <Target />,
      colorClass: 'from-neon-cyan-500 to-neon-blue-500',
      requiresAuth: false,
      isTool: true,
    },
    {
      id: 'score-checker',
      title: 'Resume Score Check',
      description: 'Get an instant ATS score with detailed analysis and improvement suggestions.',
      icon: <TrendingUp />,
      colorClass: 'from-neon-purple-500 to-neon-pink-500',
      requiresAuth: true,
      isTool: true,
    },
    {
      id: 'guided-builder',
      title: 'Guided Resume Builder',
      description: 'Create a professional resume from scratch with our step-by-step AI-powered builder.',
      icon: <PlusCircle />,
      colorClass: 'from-green-500 to-emerald-500',
      requiresAuth: true,
      isTool: true,
    },
    {
      id: 'linkedin-generator',
      title: 'LinkedIn Message Generator',
      description: 'Generate personalized messages for connection requests and cold outreach.',
      icon: <MessageCircle />,
      colorClass: 'from-orange-500 to-red-500',
      requiresAuth: true,
      isTool: true,
    },
  ];

  const pages = [
    {
      id: 'new-home',
      title: 'Home',
      description: 'Return to the main dashboard and feature overview.',
      icon: <Home />,
      colorClass: 'from-blue-500 to-indigo-500',
    },
    {
      id: 'about',
      title: 'About Us',
      description: 'Learn more about our mission, vision, and the team behind PrimoBoost AI.',
      icon: <Info />,
      colorClass: 'from-purple-500 to-fuchsia-500',
    },
    {
      id: 'tutorials',
      title: 'Tutorials',
      description: 'Access video guides and resources to master resume optimization.',
      icon: <BookOpen />,
      colorClass: 'from-pink-500 to-rose-500',
    },
    {
      id: 'contact',
      title: 'Contact Us',
      description: 'Get in touch with our support team for any questions or assistance.',
      icon: <Phone />,
      colorClass: 'from-teal-500 to-cyan-500',
    },
    {
      id: 'profile',
      title: 'Profile Settings',
      description: 'Manage your personal information, social links, and account settings.',
      icon: <Users />,
      colorClass: 'from-gray-500 to-slate-500',
      requiresAuth: true,
    },
    {
      id: 'wallet',
      title: 'Referral & Wallet',
      description: 'Track your referral earnings and manage your wallet balance.',
      icon: <Award />,
      colorClass: 'from-yellow-500 to-orange-500',
      requiresAuth: true,
    },
    {
      id: 'subscription-plans',
      title: 'Subscription Plans',
      description: 'View and upgrade your subscription plan to unlock more features.',
      icon: <Crown />,
      colorClass: 'from-indigo-500 to-blue-500',
      requiresAuth: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 font-inter dark:from-dark-50 dark:via-dark-100 dark:to-dark-200 transition-colors duration-300 py-8">
      <div className="container-responsive">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-8 text-center">
          Explore All Features & Pages
        </h1>

        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center">
            <Sparkles className="w-6 h-6 mr-2 text-purple-600" />
            AI-Powered Tools
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tools.map((tool) => (
              <FeatureCard
                key={tool.id}
                {...tool}
                onPageChange={onPageChange}
                isAuthenticated={isAuthenticated}
                onShowAuth={onShowAuth}
                userSubscription={userSubscription}
                onShowSubscriptionPlans={onShowSubscriptionPlans} // MODIFIED: Pass the new prop
              />
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center">
            <Home className="w-6 h-6 mr-2 text-blue-600" />
            Other Pages
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pages.map((page) => (
              <FeatureCard
                key={page.id}
                {...page}
                onPageChange={onPageChange}
                isAuthenticated={isAuthenticated}
                onShowAuth={onShowAuth}
                userSubscription={userSubscription}
                onShowSubscriptionPlans={onShowSubscriptionPlans} // MODIFIED: Pass the new prop
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

