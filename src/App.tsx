// src/App.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Menu, X, Home, Info, BookOpen, Phone, FileText, LogIn, LogOut, User, Wallet, Briefcase } from 'lucide-react'; // Added Briefcase import
import { useAuth } from './contexts/AuthContext';
import { Header } from './components/Header';
import { Navigation } from './components/navigation/Navigation';
import ResumeOptimizer from './components/ResumeOptimizer';
import { HomePage } from './components/pages/HomePage';
import { GuidedResumeBuilder } from './components/GuidedResumeBuilder';
import { ResumeScoreChecker } from './components/ResumeScoreChecker';
import { LinkedInMessageGenerator } from './components/LinkedInMessageGenerator';
import { AboutUs } from './components/pages/AboutUs';
import { Contact } from './components/pages/Contact';
import { Tutorials } from './components/pages/Tutorials';
import { AuthModal } from './components/auth/AuthModal';
import { UserProfileManagement } from './components/UserProfileManagement';
import { SubscriptionPlans } from './components/payment/SubscriptionPlans';
import { paymentService } from './services/paymentService';
import { AlertModal } from './components/AlertModal';
import { ToolsAndPagesNavigation } from './components/pages/ToolsAndPagesNavigation';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { PlanSelectionModal } from './components/payment/PlanSelectionModal';
import { PricingPage } from './components/pages/PricingPage';
import { OfferOverlay } from './components/OfferOverlay';
import { CareersPage } from './components/pages/CareersPage';
import { JobDetailsPage } from './components/pages/JobDetailsPage'; // Import JobDetailsPage

function App() {
  const { isAuthenticated, user, markProfilePromptSeen, isLoading } = useAuth();
  const navigate = useNavigate();

  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileManagement, setShowProfileManagement] = useState(false);
  const [showSubscriptionPlans, setShowSubscriptionPlans] = useState(false);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [profileViewMode, setProfileViewMode] = useState<'profile' | 'wallet'>('profile');
  const [userSubscription, setUserSubscription] = useState<any>(null);

  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'info' | 'success' | 'warning' | 'error'>('info');
  const [alertActionText, setAlertActionText] = useState<string | undefined>(undefined);
  const [alertActionCallback, setAlertActionCallback] = useState<(() => void) | undefined>(undefined);

  const [authModalInitialView, setAuthModalInitialView] = useState<
    'login' | 'signup' | 'forgot-password' | 'success' | 'postSignupPrompt' | 'reset_password'
  >('login');

  const [isPostSignupProfileFlow, setIsPostSignupProfileFlow] = useState(false);
  const [walletRefreshKey, setWalletRefreshKey] = useState(0);
  const [isAuthModalOpenedByHash, setIsAuthModalOpenedByHash] = useState(false);

  const [showPlanSelectionModal, setShowPlanSelectionModal] = useState(false);
  const [planSelectionFeatureId, setPlanSelectionFeatureId] = useState<string | undefined>(undefined);
  const [initialExpandAddons, setInitialExpandAddons] = useState(true);

  const [showVinayakaOffer, setShowVinayakaOffer] = useState(false);

  // NEW STATE: Callback to execute after successful authentication
  const [postAuthCallback, setPostAuthCallback] = useState<(() => void) | null>(null);

  // Tool trigger shared state
  const [toolProcessTrigger, setToolProcessTrigger] = useState<(() => void) | null>(null);

  const logoImage =
    'https://res.cloudinary.com/dlkovvlud/image/upload/w_1000,c_fill,ar_1:1,g_auto,r_max,bo_5px_solid_red,b_rgb:262c35/v1751536902/a-modern-logo-design-featuring-primoboos_XhhkS8E_Q5iOwxbAXB4CqQ_HnpCsJn4S1yrhb826jmMDw_nmycqj.jpg';

  const handleMobileMenuToggle = useCallback(() => {
    setShowMobileMenu((v) => !v);
  }, []);

  // MODIFIED: handleShowAuth to accept an optional callback
  const handleShowAuth = useCallback((callback?: () => void) => {
    console.log('handleShowAuth called in App.tsx');
    setShowAuthModal(true);
    setAuthModalInitialView('login');
    console.log('showAuthModal set to true');
    setShowMobileMenu(false);
    if (callback) {
      setPostAuthCallback(() => callback);
    }
  }, []);

  const handleNavigateHome = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const fetchSubscription = useCallback(async () => {
    if (isAuthenticated && user) {
      const sub = await paymentService.getUserSubscription(user.id);
      setUserSubscription(sub);
      console.log('App.tsx: fetchSubscription - Fetched subscription:', sub);
    } else {
      setUserSubscription(null);
    }
  }, [isAuthenticated, user]);

  const refreshUserSubscription = useCallback(async () => {
    if (isAuthenticated && user) {
      console.log('App.tsx: Refreshing user subscription...');
      const sub = await paymentService.getUserSubscription(user.id);
      setUserSubscription(sub);
      console.log('App.tsx: refreshUserSubscription - Fetched subscription:', sub);
    }
  }, [isAuthenticated, user]);

  const handleShowAlert = useCallback(
    (
      title: string,
      message: string,
      type: 'info' | 'success' | 'warning' | 'error' = 'info',
      actionText?: string,
      onAction?: () => void
    ) => {
      setAlertTitle(title);
      setAlertMessage(message);
      setAlertType(type);
      setAlertActionText(actionText);
      setAlertActionCallback(() => {
        if (onAction) onAction();
        setShowAlertModal(false); // Always close on action
      });
      setShowAlertModal(true);

      // Auto-dismiss if no action button is present
      if (!actionText) {
        setTimeout(() => {
          setShowAlertModal(false);
        }, 5000); // Dismiss after 5 seconds
      }
    },
    []
  );

  // 🔑 Trigger analysis immediately after subscription success
  const handleSubscriptionSuccess = useCallback(async () => {
    setShowSubscriptionPlans(false);
    setShowPlanSelectionModal(false);
    setSuccessMessage('Subscription activated successfully!');
    setShowSuccessNotification(true);
    setTimeout(() => {
      setShowSuccessNotification(false);
      setSuccessMessage('');
    }, 3000);

    await fetchSubscription();
    setWalletRefreshKey((prev) => prev + 1);

    // Give React a microtask to propagate new props to children, then trigger the tool
    queueMicrotask(() => {
      if (toolProcessTrigger) {
        console.log('App.tsx: Running toolProcessTrigger after subscription success');
        toolProcessTrigger();
      }
    });
  }, [fetchSubscription, toolProcessTrigger]);

  const handleAddonPurchaseSuccess = useCallback(
    async (featureId: string) => {
      console.log(`App.tsx: Add-on purchase successful for feature: ${featureId}. Triggering tool process.`);
      await refreshUserSubscription();
      console.log(`App.tsx: User subscription refreshed. Now attempting to trigger tool process.`);

      let message = 'Add-on credit(s) added successfully!';
      switch (featureId) {
        case 'score-checker':
          message = '1 Resume Score Check credit added successfully!';
          break;
        case 'optimizer':
          message = '1 JD-Based Optimization credit added successfully!';
          break;
        case 'guided-builder':
          message = '1 Guided Resume Build credit added successfully!';
          break;
        case 'linkedin-generator':
          message = 'LinkedIn Message credits added successfully!';
          break;
      }
      handleShowAlert('Purchase Complete', message, 'success');

      // Ensure the modal is closed before triggering the tool
      setShowPlanSelectionModal(false); // Close the PlanSelectionModal
      setShowSubscriptionPlans(false); // Also close SubscriptionPlans if it was open

      // Give React a microtask to propagate new props to children, then trigger the tool
      queueMicrotask(() => {
        if (toolProcessTrigger) {
          console.log('App.tsx: Executing toolProcessTrigger for feature:', featureId);
          toolProcessTrigger();
          // setToolProcessTrigger(null); // Only nullify if you want it to fire only once per session
        }
      });
    },
    [refreshUserSubscription, handleShowAlert, toolProcessTrigger]
  );

  const handleShowProfile = useCallback((mode: 'profile' | 'wallet' = 'profile', isPostSignup: boolean = false) => {
    setProfileViewMode(mode);
    setShowProfileManagement(true);
    setShowMobileMenu(false);
    setIsPostSignupProfileFlow(isPostSignup);
    console.log('App.tsx: handleShowProfile called. showProfileManagement set to true.');
  }, []);

  const handleShowPlanSelection = useCallback(
    (featureId?: string, expandAddons: boolean = false, planId?: string, couponCode?: string) => {
      console.log(
        'App.tsx: handleShowPlanSelection called with featureId:',
        featureId,
        'expandAddons:',
        expandAddons,
        'planId:',
        planId,
        'couponCode:',
        couponCode
      );
      setPlanSelectionFeatureId(featureId);
      setInitialExpandAddons(expandAddons);
      setShowPlanSelectionModal(true);
    },
    []
  );

  const handleSelectCareerPlans = useCallback(() => {
    console.log(
      'handleSelectCareerPlans called. Attempting to close PlanSelectionModal and open SubscriptionPlans modal.'
    );
    setShowPlanSelectionModal(false);
    setShowSubscriptionPlans(true);
  }, []);

  const handleShowSubscriptionPlansDirectly = useCallback(() => {
    console.log('App.tsx: handleShowSubscriptionPlansDirectly called. Opening SubscriptionPlans modal directly.');
    setShowSubscriptionPlans(true);
    setInitialExpandAddons(false);
  }, []);

  const handlePageChange = useCallback(
    (path: string) => {
      if (path === 'menu') {
        handleMobileMenuToggle();
      } else if (path === 'profile') {
        handleShowProfile();
        setShowMobileMenu(false);
      } else if (path === 'wallet') {
        handleShowProfile('wallet');
        setShowMobileMenu(false);
      } else if (path === 'subscription-plans') {
        handleShowPlanSelection(undefined, false);
        setShowMobileMenu(false);
      } else {
        navigate(path);
        setShowMobileMenu(false);
      }
    },
    [handleMobileMenuToggle, handleShowProfile, handleShowPlanSelection, navigate]
  );

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setShowMobileMenu(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener(
      'resize', handleResize);
  }, []);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      console.log('App.tsx: Detected password recovery link in URL hash.');
      setAuthModalInitialView('reset_password');
      setShowAuthModal(true);
      setIsAuthModalOpenedByHash(true);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  useEffect(() => {
    console.log(
      'App.tsx useEffect: isAuthenticated:',
      isAuthenticated,
      'user:',
      user?.id,
      'hasSeenProfilePrompt:',
      user?.hasSeenProfilePrompt,
      'isLoadingAuth:',
      isLoading,
      'isAuthModalOpenedByHash:',
      isAuthModalOpenedByHash
    );

    if (isLoading) {
      console.log('App.tsx useEffect: AuthContext is still loading, deferring AuthModal logic.');
      return;
    }

    if (isAuthModalOpenedByHash) {
      if (isAuthenticated && user && user.hasSeenProfilePrompt === true) {
        console.log('App.tsx useEffect: Hash-opened modal, user authenticated and profile complete. Closing modal.');
        setShowAuthModal(false);
        setIsAuthModalOpenedByHash(false);
        setAuthModalInitialView('login');
        // Execute post-auth callback if any
        if (postAuthCallback) {
          postAuthCallback();
          setPostAuthCallback(null);
        }
      }
      return;
    }

    if (isAuthenticated && user) {
      if (user.hasSeenProfilePrompt === undefined) {
        console.log('App.tsx useEffect: user.hasSeenProfilePrompt is undefined, waiting for full profile load.');
        return;
      }
      if (user.hasSeenProfilePrompt === false) {
        console.log('App.tsx useEffect: User authenticated and profile incomplete, opening AuthModal to prompt.');
        setAuthModalInitialView('postSignupPrompt');
        setShowAuthModal(true);
      } else {
        console.log('App.tsx useEffect: User authenticated and profile complete, ensuring AuthModal is closed.');
        setShowAuthModal(false);
        setAuthModalInitialView('login');
        // Execute post-auth callback if any
        if (postAuthCallback) {
          postAuthCallback();
          setPostAuthCallback(null);
        }
      }
    } else {
      console.log('App.tsx useEffect: User not authenticated, ensuring AuthModal is closed.');
      // REMOVED: setShowAuthModal(false);
      setAuthModalInitialView('login');
    }
  }, [isAuthenticated, user, user?.hasSeenProfilePrompt, isLoading, isAuthModalOpenedByHash, postAuthCallback]);

  // NEW useEffect to monitor showProfileManagement
  useEffect(() => {
    console.log('App.tsx: showProfileManagement state changed to:', showProfileManagement);
  }, [showProfileManagement]);

  useEffect(() => {
    const offerSeenKey = 'vinayakaChavithiOfferSeen';
    const offerExpiryDate = new Date('2025-09-10T23:59:59');

    const hasSeenOffer = localStorage.getItem(offerSeenKey);
    const now = new Date();

    if (!hasSeenOffer && now < offerExpiryDate) {
      const timer = setTimeout(() => {
        setShowVinayakaOffer(true);
        localStorage.setItem(offerSeenKey, 'true');
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, []);

  const commonPageProps = {
    isAuthenticated: isAuthenticated,
    onShowAuth: handleShowAuth,
    onShowSubscriptionPlans: handleShowPlanSelection,
    onShowSubscriptionPlansDirectly: handleShowSubscriptionPlansDirectly,
    userSubscription: userSubscription,
    onShowAlert: handleShowAlert,
    refreshUserSubscription: refreshUserSubscription,
    onNavigateBack: handleNavigateHome,
    toolProcessTrigger,
    setToolProcessTrigger,
  };

  console.log('App.tsx: showPlanSelectionModal state before PlanSelectionModal render:', showPlanSelectionModal);

  return (
    <div className="min-h-screen pb-safe-bottom safe-area bg-white dark:bg-dark-50 transition-colors duration-300">
      {showSuccessNotification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 p-3 bg-green-500 text-white rounded-lg shadow-lg animate-fade-in-down dark:bg-neon-cyan-500 dark:shadow-neon-cyan">
          {successMessage}
        </div>
      )}

      <Header onMobileMenuToggle={handleMobileMenuToggle} showMobileMenu={showMobileMenu} onShowProfile={handleShowProfile}>
        <Navigation onPageChange={handlePageChange} />
      </Header>

      <Routes>
        <Route path="/" element={<HomePage {...commonPageProps} />} />
        <Route
          path="/optimizer"
          element={
            <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
              <ResumeOptimizer
                isAuthenticated={isAuthenticated}
                onShowAuth={handleShowAuth}
                onShowProfile={handleShowProfile}
                onNavigateBack={handleNavigateHome}
                onShowPlanSelection={handleShowPlanSelection}
                userSubscription={userSubscription}
                refreshUserSubscription={refreshUserSubscription}
                toolProcessTrigger={toolProcessTrigger}
                setToolProcessTrigger={setToolProcessTrigger}
              />
            </main>
          }
        />
        <Route path="/score-checker" element={<ResumeScoreChecker {...commonPageProps} />} />
        <Route path="/guided-builder" element={<GuidedResumeBuilder {...commonPageProps} />} />
        <Route path="/linkedin-generator" element={<LinkedInMessageGenerator {...commonPageProps} />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/tutorials" element={<Tutorials />} />
        <Route path="/all-tools" element={<ToolsAndPagesNavigation {...commonPageProps} />} />
        <Route path="/pricing" element={<PricingPage onShowAuth={handleShowAuth} onShowSubscriptionPlans={handleShowPlanSelection} />} />
        <Route path="/careers" element={<CareersPage {...commonPageProps} />} />
        <Route path="/careers/:jobId" element={<JobDetailsPage {...commonPageProps} />} /> {/* NEW ROUTE */}
      </Routes>

      {showMobileMenu && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm dark:bg-black/70" onClick={() => setShowMobileMenu(false)} />
          <div className="fixed top-0 right-0 h-full w-80 max-w-[90vw] bg-white shadow-2xl overflow-y-auto safe-area dark:bg-dark-100 dark:shadow-dark-xl">
            <div className="flex flex-col space-y-4 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden shadow-lg">
                    <img src={logoImage} alt="PrimoBoost AI Logo" className="w-full h-full object-cover" />
                  </div>
                  <h1 className="text-lg sm:text-xl font-bold text-secondary-900 dark:text-gray-100">PrimoBoost AI</h1>
                </div>
                <button
                  onClick={() => setShowMobileMenu(false)}
                  className="min-w-touch min-h-touch p-2 text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100 rounded-lg transition-colors dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-dark-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="border-t border-secondary-200 pt-4 dark:border-dark-300">
                <nav className="flex flex-col space-y-4">
                  {[
                    { id: '/', label: 'Home', icon: <Home className="w-5 h-5" /> },
                    { id: '/about', label: 'About Us', icon: <Info className="w-5 h-5" /> },
                    { id: '/careers', label: 'Careers', icon: <Briefcase className="w-5 h-5" /> }, // ADDED: Careers link
                    { id: '/tutorials', label: 'Tutorials', icon: <BookOpen className="w-5 h-5" /> },
                    { id: '/contact', label: 'Contact', icon: <Phone className="w-5 h-5" /> },
                    ...(isAuthenticated ? [{ id: 'wallet', label: 'Referral & Wallet', icon: <Wallet className="w-5 h-5" /> }] : []),
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        handlePageChange(item.id);
                      }}
                      className={`flex items-center space-x-3 min-h-touch px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                        window.location.pathname === item.id
                          ? 'bg-primary-100 text-primary-700 shadow-md dark:bg-dark-200 dark:text-neon-cyan-400'
                          : 'text-secondary-700 hover:text-primary-600 hover:bg-primary-50 dark:text-gray-300 dark:hover:text-neon-cyan-400 dark:hover:bg-dark-200'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  ))}
                </nav>
              </div>

              <div className="border-t border-secondary-200 pt-4 dark:border-dark-300">
                <AuthButtons
                  onPageChange={handlePageChange}
                  onClose={() => setShowMobileMenu(false)}
                  onShowAuth={handleShowAuth}
                  onShowProfile={handleShowProfile}
                />
              </div>

              <div className="mt-auto pt-4 border-t border-secondary-200 dark:border-dark-300">
                <div className="bg-gradient-to-r from-primary-50 to-accent-50 rounded-xl p-4 dark:from-dark-200 dark:to-dark-300">
                  <p className="text-sm text-secondary-700 mb-2 dark:text-gray-300">Need help with your resume?</p>
                  <button
                    onClick={() => {
                      handlePageChange('/');
                      setShowMobileMenu(false);
                    }}
                    className="w-full btn-primary text-sm flex items-center justify-center space-x-2 shadow-neon-cyan"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Optimize Now</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <AuthModal
         isOpen={showAuthModal}
  onClose={() => {
    // 👇 mark seen if user closed the post-signup prompt via X/backdrop
    if (authModalInitialView === 'postSignupPrompt' && user) {
      markProfilePromptSeen();
    }
    setShowAuthModal(false);
    setAuthModalInitialView('login');
    setIsAuthModalOpenedByHash(false);
  }}
        onProfileFillRequest={() => handleShowProfile('profile', true)}
        initialView={authModalInitialView}
        onPromptDismissed={() => {
          if (user) {
            markProfilePromptSeen();
          }
          setShowAuthModal(false);
          setAuthModalInitialView('login');
          setIsAuthModalOpenedByHash(false);
        }}
      />

      <PlanSelectionModal
        isOpen={showPlanSelectionModal}
        onClose={() => setShowPlanSelectionModal(false)}
        onSelectCareerPlans={handleSelectCareerPlans}
        onSubscriptionSuccess={handleSubscriptionSuccess}
        onShowAlert={handleShowAlert}
        triggeredByFeatureId={planSelectionFeatureId}
        onAddonPurchaseSuccess={handleAddonPurchaseSuccess}
      />

      {showSubscriptionPlans && (
        <SubscriptionPlans
          isOpen={showSubscriptionPlans}
          onNavigateBack={() => setShowSubscriptionPlans(false)}
          onSubscriptionSuccess={handleSubscriptionSuccess}
          onShowAlert={handleShowAlert}
          initialExpandAddons={initialExpandAddons}
          initialPlanId={showVinayakaOffer ? 'career_pro_max' : undefined}
          initialCouponCode={showVinayakaOffer ? 'VNKR50%' : undefined}
        />
      )}

      <AlertModal
        isOpen={showAlertModal}
        onClose={() => setShowAlertModal(false)}
        title={alertTitle}
        message={alertMessage}
        type={alertType}
        actionText={alertActionText}
        onAction={alertActionCallback}
      />

      {showVinayakaOffer && (
        <OfferOverlay
          isOpen={showVinayakaOffer}
          onClose={() => setShowVinayakaOffer(false)}
          onAction={() => {
            navigate('/pricing');
            setShowVinayakaOffer(false);
          }}
        />
      )}

      {showProfileManagement && (
        <UserProfileManagement
          isOpen={showProfileManagement}
          onClose={() => setShowProfileManagement(false)}
          viewMode={profileViewMode}
          walletRefreshKey={walletRefreshKey}
          setWalletRefreshKey={setWalletRefreshKey}
        />
      )}
    </div>
  );
}

const AuthButtons: React.FC<{
  onPageChange: (path: string) => void;
  onClose: () => void;
  onShowAuth: (callback?: () => void) => void;
  onShowProfile: (mode?: 'profile' | 'wallet') => void;
}> = ({ onPageChange, onClose, onShowAuth, onShowProfile }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      onClose();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };
  const handleLogin = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Sign in button clicked - calling onShowAuth');
    onShowAuth();
    console.log('showAuthModal set to true');
  };
  return (
    <div>
      <h3 className="text-sm font-semibold text-secondary-500 mb-3">Account</h3>
      {isAuthenticated && user ? (
        <div className="space-y-3">
          <div className="flex items-center space-x-3 px-4 py-3 bg-primary-50 rounded-xl dark:bg-dark-200">
            <div className="bg-gradient-to-br from-neon-cyan-500 to-neon-blue-500 w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold">
              {user.name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2)}
            </div>
            <div className="overflow-hidden">
              <p className="font-medium text-secondary-900 dark:text-gray-100 truncate">{user.name}</p>
              <p className="text-xs text-secondary-500 dark:text-gray-400 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={() => onShowProfile('profile')}
            className="w-full flex items-center space-x-3 min-h-touch px-4 py-3 rounded-xl font-medium transition-all duration-200 text-secondary-700 hover:text-primary-600 hover:bg-primary-50 dark:text-gray-300 dark:hover:text-neon-cyan-400 dark:hover:bg-dark-200"
          >
            <User className="w-5 h-5" />
            <span>Profile Settings</span>
          </button>
          <button
            onClick={() => onShowProfile('wallet')}
            className="w-full flex items-center space-x-3 min-h-touch px-4 py-3 rounded-xl font-medium transition-all duration-200 text-secondary-700 hover:text-primary-600 hover:bg-primary-50 dark:text-gray-300 dark:hover:text-neon-cyan-400 dark:hover:bg-dark-200"
          >
            <Wallet className="w-5 h-5" />
            <span>My Wallet</span>
          </button>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center space-x-3 min-h-touch px-4 py-3 rounded-xl font-medium transition-all duration-200 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <LogOut className="w-5 h-5" />
            <span>{isLoggingOut ? 'Signing Out...' : 'Sign Out'}</span>
          </button>
        </div>
      ) : (
        <button
          onClick={handleLogin}
          className="w-full flex items-center space-x-3 min-h-touch px-4 py-3 rounded-xl font-medium transition-all duration-200 btn-primary shadow-neon-cyan"
          type="button"
        >
          <LogIn className="w-5 h-5" />
          <span>Sign In</span>
        </button>
      )}
    </div>
  );
};

export default App;
