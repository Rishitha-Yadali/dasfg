import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export const ThemeToggle: React.FC = () => {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
      className="p-2 rounded-full transition-colors duration-300 focus:outline-none"
    >
      {isDarkMode ? (
        // In dark mode, show a larger Sun icon to switch to light mode
        <Sun className="w-10 h-10 text-yellow-500" />
      ) : (
        // In light mode, show a larger Moon icon to switch to dark mode
        <Moon className="w-9 h-9 text-black" />
      )}
    </button>
  );
};