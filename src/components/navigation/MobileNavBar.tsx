import React from 'react';
import { Home, Info, BookOpen, Phone, Menu, Wallet, User, Briefcase } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext'; // Import useAuth
import { Link } from 'react-router-dom'; // Import Link

interface MobileNavBarProps {
  currentPage: string; // This prop will become less relevant as Link handles active state
  onPageChange: (page: string) => void; // This prop will be used for non-Link navigation
}

export const MobileNavBar: React.FC<MobileNavBarProps> = ({ currentPage, onPageChange }) => {
  const { isAuthenticated } = useAuth(); // Destructure isAuthenticated from useAuth()

  // Conditionally include the 'profile' item
  const navItems = [
    { id: '/', label: 'Home', icon: <Home className="w-5 h-5" /> }, // Changed id to path
    { id: '/about', label: 'About', icon: <Info className="w-5 h-5" /> }, // Changed id to path
    { id: '/careers', label: 'Careers', icon: <Briefcase className="w-5 h-5" /> }, // Added careers to mobile nav
    { id: '/tutorials', label: 'Tutorials', icon: <BookOpen className="w-5 h-5" /> }, // Changed id to path
    { id: '/contact', label: 'Contact', icon: <Phone className="w-5 h-5" /> }, // Changed id to path
    // Conditionally render the 'profile' and 'wallet' items if isAuthenticated is true
    ...(isAuthenticated ? [{ id: 'profile', label: 'Profile', icon: <User className="w-5 h-5" /> }] : []),
    ...(isAuthenticated ? [{ id: 'wallet', label: 'Wallet', icon: <Wallet className="w-5 h-5" /> }] : []),
    { id: 'menu', label: 'Menu', icon: <Menu className="w-5 h-5" /> }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-secondary-200 shadow-lg lg:hidden safe-area">
      <div className="flex items-center justify-around pb-safe-bottom">
        {navItems.map((item) => (
          // Use Link for direct navigation, or a button for special actions like 'menu', 'profile', 'wallet'
          item.id === 'menu' || item.id === 'profile' || item.id === 'wallet' ? (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`flex flex-col items-center justify-center py-2 sm:py-3 px-2 min-w-touch min-h-touch transition-colors touch-spacing ${
                currentPage === item.id
                  ? 'text-primary-600'
                  : 'text-secondary-600 hover:text-primary-600'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className={`p-1.5 rounded-full mb-1 transition-colors ${
                currentPage === item.id ? 'bg-primary-100' : 'hover:bg-secondary-100'
              }`}>
                {item.icon}
              </div>
              <span className="text-xs font-medium leading-tight">{item.label}</span>
            </button>
          ) : (
            <Link
              key={item.id}
              to={item.id}
              className={`flex flex-col items-center justify-center py-2 sm:py-3 px-2 min-w-touch min-h-touch transition-colors touch-spacing ${
                window.location.pathname === item.id // Check current path for active state
                  ? 'text-primary-600'
                  : 'text-secondary-600 hover:text-primary-600'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className={`p-1.5 rounded-full mb-1 transition-colors ${
                window.location.pathname === item.id ? 'bg-primary-100' : 'hover:bg-secondary-100'
              }`}>
                {item.icon}
              </div>
              <span className="text-xs font-medium leading-tight">{item.label}</span>
            </Link>
          )
        ))}
      </div>
    </div>
  );
};
