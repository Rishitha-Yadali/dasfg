// src/components/Header.tsx
import React, { useState, useRef, useEffect } from 'react';
import { FileText, User, LogOut, Menu, X, Loader2, Sparkles, Shield, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AuthModal } from './auth/AuthModal';
import { DeviceManagement } from './security/DeviceManagement';
import { ThemeToggle } from './ThemeToggle';
import { useNavigate } from 'react-router-dom'; // Import useNavigate

interface HeaderProps {
  children?: React.ReactNode;
  onMobileMenuToggle?: () => void;
  showMobileMenu?: boolean;
  onShowProfile?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  children,
  onMobileMenuToggle,
  showMobileMenu,
  onShowProfile
}) => {
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showDeviceManagement, setShowDeviceManagement] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Add this console.log statement to inspect the isAuthenticated value
  console.log('Header: isAuthenticated =', isAuthenticated);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsLoggingOut(true);
    try {
      await logout();
      setShowUserMenu(false);
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getUserDisplayName = () => {
    if (!user) return '';
    return user.name.split(' ')[0]; // First name only
  };

  const getUserInitials = () => {
    if (!user) return 'U';
    const names = user.name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return names[0][0].toUpperCase();
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Only show loading spinner for initial load, not for every auth operation
  const showLoadingSpinner = isLoading && !isAuthenticated && !user;

  return (
    <>
      <header className="bg-white/95 backdrop-blur-sm shadow-sm border-b border-secondary-200 sticky top-0 z-40 dark:bg-dark-50/95 dark:border-dark-300">
        <div className="container-responsive">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden shadow-lg">
                <img
                  src="https://res.cloudinary.com/dlkovvlud/image/upload/w_1000,c_fill,ar_1:1,g_auto,r_max,bo_5px_solid_red,b_rgb:262c35/v1751536902/a-modern-logo-design-featuring-primoboos_XhhkS8E_Q5iOwxbAXB4CqQ_HnpCsJn4S1yrhb826jmMDw_nmycqj.jpg"
                  alt="PrimoBoost AI Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="hidden xs:block">
                <h1 className="text-lg sm:text-xl font-bold text-secondary-900 dark:text-gray-100">PrimoBoost AI</h1>
              </div>
              <div className="xs:hidden">
                <h1 className="text-base font-bold text-secondary-900 dark:text-gray-100">PrimoBoost AI</h1>
              </div>
            </div>

            {/* Desktop Navigation and Auth */}
            <div className="hidden lg:flex items-center space-x-4">
              <ThemeToggle />
              {children}

              {isAuthenticated && user ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => {
                      console.log('Profile button clicked. Current showUserMenu:', showUserMenu, 'New state:', !showUserMenu);
                      setShowUserMenu(!showUserMenu);
                    }}
                    className="flex items-center space-x-3 bg-gradient-to-r from-secondary-50 to-secondary-100 hover:from-secondary-100 hover:to-secondary-200 rounded-full px-4 py-1 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-neon-cyan-500 border border-secondary-200 shadow-sm  dark:from-dark-200 dark:to-dark-300 dark:hover:from-dark-300 dark:hover:to-dark-400 dark:border-dark-400"
                  >
                    <div className="bg-gradient-to-br from-neon-cyan-500 to-neon-blue-500 w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-md">
                      {getUserInitials()}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-secondary-900 dark:text-gray-100">
                         {getUserDisplayName()}!
                      </p>
                     
                    </div>
                  </button>

                  {/* User Dropdown Menu */}
                  {console.log('Header: showUserMenu state before rendering dropdown:', showUserMenu)}
                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-secondary-200 py-2 z-50 overflow-hidden dark:bg-dark-100 dark:border-dark-300 dark:shadow-dark-xl">
                      <div className="px-4 py-3 border-b border-secondary-100 bg-gradient-to-r from-primary-50 to-accent-50 dark:border-dark-300 dark:from-dark-200 dark:to-dark-300">
                        <div className="flex items-center space-x-3">
                          <div className="bg-gradient-to-br from-neon-cyan-500 to-neon-blue-500 w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shadow-md">
                            {getUserInitials()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-secondary-900 dark:text-gray-100 truncate">{user.name}</p>
                            <p className="text-xs text-secondary-500 dark:text-gray-400 truncate">{user.email}</p>
                          </div>
                        </div>
                      </div>

                      {/* Wrap these buttons in a Fragment */}
                      <>
                        {/* Profile Settings Option */}
                        <button
                          onClick={() => {
                            if (onShowProfile) {
                              onShowProfile();
                            }
                            setShowUserMenu(false);
                          }}
                          className="w-full text-left px-4 py-3 text-sm text-secondary-700 hover:bg-secondary-50 transition-colors flex items-center space-x-3 min-h-touch dark:text-gray-300 dark:hover:bg-dark-200"
                        >
                          <User className="w-4 h-4" />
                          <span>Profile Settings</span>
                        </button>

                        {/* Device Management Option */}
                        
                      </> {/* End Fragment */}

                      <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center space-x-3 disabled:opacity-50 min-h-touch dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        {isLoggingOut ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <LogOut className="w-4 h-4" />
                        )}
                        <span>{isLoggingOut ? 'Signing Out...' : 'Sign Out'}</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  disabled={showLoadingSpinner}
                  className={`btn-primary px-6 py-2.5 rounded-xl flex items-center space-x-2 shadow-lg hover:shadow-neon-cyan active:scale-[0.98] ${
                    showLoadingSpinner ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {showLoadingSpinner ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                  <span>{showLoadingSpinner ? 'Loading...' : 'Sign In'}</span>
                </button>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="lg:hidden">
              <div className="flex items-center space-x-2">
                <ThemeToggle />
                <button
                  onClick={onMobileMenuToggle}
                  className="min-w-touch min-h-touch p-2 text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-neon-cyan-500 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-dark-200"
                >
                  {showMobileMenu ? (
                    <X className="w-6 h-6" />
                  ) : (
                    <Menu className="w-6 h-6" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

      {/* Device Management Modal */}
      {showDeviceManagement && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm safe-area dark:bg-black/80">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-y-auto dark:bg-dark-100">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-secondary-200 dark:border-dark-300">
              <h2 className="text-lg sm:text-xl font-semibold text-secondary-900 dark:text-gray-100">Device & Security Management</h2>
              <button
                onClick={() => setShowDeviceManagement(false)}
                className="min-w-touch min-h-touch w-8 h-8 flex items-center justify-center text-secondary-400 hover:text-secondary-600 transition-colors rounded-full hover:bg-secondary-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-dark-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6">
              <DeviceManagement />
            </div>
          </div>
        </div>
      )}

    </>
  );
};
