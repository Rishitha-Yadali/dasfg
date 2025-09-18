// src/components/navigation/Navigation.tsx
import React, { useState } from 'react';
import { Home, Info, Phone, BookOpen, MessageCircle, ChevronDown, Target, TrendingUp, PlusCircle, Zap, Sparkles, Crown, Users } from 'lucide-react'; // ADD Users for careers icon
import { useAuth } from '../../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom'; // Import Link and useNavigate

interface NavigationProps {
  // currentPage: string; // REMOVED: currentPage prop is no longer needed here
  onPageChange: (path: string) => void; // MODIFIED: onPageChange now expects a path string
}

export const Navigation: React.FC<NavigationProps> = ({ onPageChange }) => { // REMOVED currentPage from props
  const [showAIToolsDropdown, setShowAIToolsDropdown] = useState(false);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate(); // Initialize useNavigate

  const navigationItems = [
    { id: '/', label: 'Home', icon: <Home className="w-4 h-4" /> }, // MODIFIED: id to path
   
    { id: '/about', label: 'About Us', icon: <Info className="w-4 h-4" /> }, // MODIFIED: id to path
    { id: '/careers', label: 'Careers', icon: <Users className="w-4 h-4" /> }, // ADDED: careers link
    { id: '/tutorials', label: 'Tutorials', icon: <BookOpen className="w-4 h-4" /> }, // MODIFIED: id to path
    { id: '/contact', label: 'Contact', icon: <Phone className="w-4 h-4" /> }, // MODIFIED: id to path
  ];

  const aiTools = [
    { id: '/optimizer', label: 'Resume Optimizer', icon: <Target className="w-4 h-4" /> }, // MODIFIED: id to path
    { id: '/score-checker', label: 'Score Checker', icon: <TrendingUp className="w-4 h-4" /> }, // MODIFIED: id to path
    { id: '/guided-builder', label: 'Guided Builder', icon: <PlusCircle className="w-4 h-4" /> }, // MODIFIED: id to path
    { id: '/linkedin-generator', label: 'LinkedIn Messages', icon: <MessageCircle className="w-4 h-4" /> }, // MODIFIED: id to path
  ];

  const handlePageChange = (path: string) => { // MODIFIED: parameter name to path
    navigate(path); // Use navigate for routing
    setShowAIToolsDropdown(false);
  };

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden lg:flex items-center space-x-8">
        {navigationItems.map((item) => (
          <Link // MODIFIED: Use Link component
            key={item.id}
            to={item.id} // Link to the path
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              window.location.pathname === item.id // Check current path for active state
                ? 'bg-blue-100 text-blue-700 shadow-md dark:bg-neon-cyan-500/20 dark:text-neon-cyan-300'
                : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-300 dark:hover:text-neon-cyan-400 dark:hover:bg-dark-200'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}

        {/* AI Tools Dropdown - Conditional Rendering */}
        {isAuthenticated && (
          <div className="relative">
           

            {showAIToolsDropdown && (
              <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 dark:bg-dark-100 dark:border-dark-300 dark:shadow-dark-xl">
                {aiTools.map((tool) => (
                  <Link // MODIFIED: Use Link component
                    key={tool.id}
                    to={tool.id} // Link to the path
                    onClick={() => setShowAIToolsDropdown(false)} // Close dropdown on click
                    className="w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-primary-50 transition-colors text-gray-700 hover:text-primary-700 dark:text-gray-300 dark:hover:bg-dark-200 dark:hover:text-neon-cyan-400"
                  >
                    {tool.icon}
                    <span className="font-medium">{tool.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>
    </>
  );
};
