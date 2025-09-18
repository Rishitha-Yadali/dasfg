import React, { useState, useEffect } from 'react';
import { MatchScore, DetailedScore, ResumeData } from '../types/resume';
import { RecommendedProject } from '../types/analysis'; // This import seems unused, but I'll leave it as it was in original
import { TrendingUp, Target,   ArrowRight, BarChart3, Award, BookOpen, Code, Lightbulb, Clock, Star, ChevronDown, ChevronUp, Zap, Palette, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';
import { getDetailedResumeScore } from '../services/scoringService'; // This import seems unused, but I'll leave it as it was in original
import { analyzeProjectAlignment } from '../services/projectAnalysisService'; // This import seems unused, but I'll leave it as it was in original

interface ComprehensiveAnalysisProps {
  initialDetailedScore: DetailedScore;
  finalDetailedScore: DetailedScore;
  changedSections: string[];
  resumeData: ResumeData; // This prop seems unused here, but I'll leave it as it was in original
  jobDescription: string; // This prop seems unused here, but I'll leave it as it was in original
  targetRole: string; // This prop seems unused here, but I'll leave it as it was in original
}

export const ComprehensiveAnalysis: React.FC<ComprehensiveAnalysisProps> = ({
  initialDetailedScore,
  finalDetailedScore,
  changedSections,
  resumeData,
  jobDescription,
  targetRole
}) => {
  const improvement = finalDetailedScore.totalScore - initialDetailedScore.totalScore;

  // State to manage the open/close state of each collapsible section
  const [openSections, setOpenSections] = useState<{[key: string]: boolean}>({});

  // Toggle function for collapsible sections
  const toggleSection = (sectionKey: string) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  // Pie chart component
  const PieChart: React.FC<{ score: number; size?: number; strokeWidth?: number; showLabel?: boolean }> = ({
    score,
    size = 120,
    strokeWidth = 8,
    showLabel = true
  }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (score / 100) * circumference;
    
    const getColor = (score: number) => {
      if (score >= 90) return '#10B981'; // Green
      if (score >= 80) return '#3B82F6'; // Blue
      if (score >= 70) return '#F59E0B'; // Yellow
      if (score >= 60) return '#F97316'; // Orange
      return '#EF4444'; // Red
    };

    return (
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size} // Use 'size' prop for SVG width
          height={size} // Use 'size' prop for SVG height
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E5E7EB"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={getColor(score)}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        {/* Score text */}
        {showLabel && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-gray-900">{score}%</div>
              <div className="text-xs sm:text-sm text-gray-500">Score</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const getSectionDisplayName = (section: keyof DetailedScore['breakdown'] | string) => {
    const sectionNames: { [key: string]: string } = {
      'summary': 'Professional Summary',
      'workExperience': 'Work Experience',
      'education': 'Education',
      'projects': 'Projects',
      'skills': 'Technical Skills',
      'certifications': 'Certifications',
      'achievements': 'Achievements',
      'extraCurricularActivities': 'Extra-curricular Activities',
      'languagesKnown': 'Languages Known',
      'personalDetails': 'Personal Details',
      // Detailed score breakdown keys
      'atsCompatibility': 'ATS Compatibility',
      'keywordSkillMatch': 'Keyword & Skill Match',
      'projectWorkRelevance': 'Project & Work Relevance',
      'structureFlow': 'Structure & Flow',
      'criticalFixesRedFlags': 'Critical Fixes & Red Flags',
     'impactScore': 'Impact Score',       
      'brevityScore': 'Brevity Score',    
      'styleScore': 'Style Score',      
      'skillsScore': 'Skills Score'
    };
    return sectionNames[section] || section;
  };

  // Helper to determine icon for breakdown section
  const getBreakdownIcon = (key: keyof DetailedScore['breakdown']) => {
    switch (key) {
      case 'atsCompatibility': return <Code className="w-5 h-5" />;
      case 'keywordSkillMatch': return <Target className="w-5 h-5" />;
      case 'projectWorkRelevance': return <Lightbulb className="w-5 h-5" />;
      case 'structureFlow': return <BookOpen className="w-5 h-5" />;
      case 'criticalFixesRedFlags': return <AlertCircle className="w-5 h-5" />;
      case 'impactScore': return <Zap className="w-5 h-5" />;
      case 'brevityScore': return <Clock className="w-5 h-5" />;
      case 'styleScore': return <Palette className="w-5 h-5" />;
      case 'skillsScore': return <Sparkles className="w-5 h-5" />;
      default: return <Star className="w-5 h-5" />;
    }
  };

  return (
    <div className="card border border-secondary-100 dark:border-dark-300">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-50 to-green-50 p-4 sm:p-6 border-b border-secondary-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mr-3 sm:mr-4 shadow-neon-cyan">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h2 className="text-fluid-lg sm:text-fluid-xl font-bold text-secondary-900 dark:text-gray-100">Resume Analysis Complete</h2>
              <p className="text-fluid-xs sm:text-fluid-sm text-secondary-600 dark:text-gray-300">Score Improvement & Optimization Results</p>
            </div>
          </div>
          
          {/* Improvement Badge */}
          <div className={`px-3 sm:px-4 py-2 rounded-full font-bold text-fluid-sm ${
            improvement > 0 
              ? 'bg-green-100 text-green-800 dark:bg-neon-cyan-500/20 dark:text-neon-cyan-300' 
              : (improvement < 0 
                ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' 
                : 'bg-secondary-100 text-secondary-800 dark:bg-dark-200 dark:text-gray-300')
          }`}>
            {improvement} points
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {/* Score Comparison Section */}
        <div className="mb-6 lg:mb-8">
          <h3 className="text-fluid-lg sm:text-fluid-xl font-bold text-secondary-900 dark:text-gray-100 mb-4 lg:mb-6 flex items-center">
            <BarChart3 className="w-5 h-5 sm:w-6 h-6 mr-2 text-primary-600 dark:text-neon-cyan-400" />
            Score Comparison
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-4 lg:mb-6">
            {/* Before Score */}
            <div className="text-center">
              <h4 className="text-fluid-base sm:text-fluid-lg font-semibold text-secondary-900 dark:text-gray-100 mb-3 sm:mb-4">Before Optimization</h4>
              <div className="flex justify-center mb-3 sm:mb-4">
                <PieChart score={initialDetailedScore.totalScore} size={100} strokeWidth={6} />
              </div>
              <div className="mb-3">
                <span className="px-3 py-1 rounded-full text-fluid-sm font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300">
                  Needs Improvement
                </span>
              </div>
              <p className="text-fluid-xs sm:text-fluid-sm text-secondary-600 dark:text-gray-300 leading-relaxed">
                {initialDetailedScore.analysis}
              </p>
            </div>

            {/* Arrow */}
            <div className="flex items-center justify-center">
              <div className="hidden lg:flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full dark:bg-dark-200">
                <ArrowRight className="w-8 h-8 text-primary-600 dark:text-neon-cyan-400" />
              </div>
              <div className="lg:hidden flex items-center justify-center py-4">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center rotate-90 dark:bg-dark-200">
                  <ArrowRight className="w-6 h-6 text-primary-600 dark:text-neon-cyan-400" />
                </div>
              </div>
            </div>

            {/* After Score */}
            <div className="text-center">
              <h4 className="text-fluid-base sm:text-fluid-lg font-semibold text-secondary-900 dark:text-gray-100 mb-3 sm:mb-4">After Optimization</h4>
              <div className="flex justify-center mb-3 sm:mb-4">
                <PieChart score={finalDetailedScore.totalScore} size={100} strokeWidth={6} />
              </div>
              <div className="mb-3">
                <span className="px-3 py-1 rounded-full text-fluid-sm font-medium bg-green-100 text-green-800 dark:bg-neon-cyan-500/20 dark:text-neon-cyan-300">
                  Excellent
                </span>
              </div>
              <p className="text-fluid-xs sm:text-fluid-sm text-secondary-600 dark:text-gray-300 leading-relaxed">
                {finalDetailedScore.analysis}
              </p>
            </div>
          </div>

          {/* Changed Sections */}
          {changedSections.length > 0 && (
            <div className="bg-gradient-to-r from-green-50 to-primary-50 rounded-xl p-4 sm:p-6 mb-4 lg:mb-6 dark:from-dark-200 dark:to-dark-300">
              <h4 className="text-fluid-base sm:text-fluid-lg font-semibold text-secondary-900 dark:text-gray-100 mb-3 sm:mb-4 flex items-center">
                <Target className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-green-600 dark:text-neon-cyan-400" />
                Sections Optimized
              </h4>
              <div className="grid-responsive gap-2 sm:gap-3">
                {changedSections.map((section, index) => (
                  <div key={index} className="flex items-center bg-white rounded-lg p-2 sm:p-3 shadow-sm dark:bg-dark-100">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-neon-cyan-400 mr-2 flex-shrink-0" />
                    <span className="text-fluid-xs sm:text-fluid-sm font-medium text-secondary-900 dark:text-gray-100">
                      {getSectionDisplayName(section)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* --- DETAILED SCORE BREAKDOWN SECTION --- */}
        <div className="mb-6 lg:mb-8">
          <h3 className="text-fluid-lg sm:text-fluid-xl font-bold text-secondary-900 dark:text-gray-100 mb-4 lg:mb-6 flex items-center">
            <BarChart3 className="w-5 h-5 sm:w-6 h-6 mr-2 text-purple-600 dark:text-neon-purple-400" />
            Detailed Score Breakdown
          </h3>

          {/* Iterate through each breakdown category in afterScore.breakdown */}
          {Object.entries(finalDetailedScore.breakdown).map(([key, category]) => (
            <div key={key} className="bg-white rounded-xl shadow-sm border border-gray-200 mb-3 dark:bg-dark-100 dark:border-dark-300">
              <button
                onClick={() => toggleSection(key)}
                className="w-full flex items-center justify-between p-4 sm:p-5 text-left font-semibold text-secondary-900 dark:text-gray-100 transition-colors hover:bg-gray-50 dark:hover:bg-dark-200"
              >
                <div className="flex items-center space-x-3">
                  {getBreakdownIcon(key as keyof DetailedScore['breakdown'])}
                  <span className="text-fluid-sm sm:text-fluid-base">{getSectionDisplayName(key)}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`text-fluid-base sm:text-fluid-lg font-bold ${
                    category.score >= (category.maxScore * 0.9) ? 'text-green-600' :
                    category.score >= (category.maxScore * 0.7) ? 'text-orange-600' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {category.score}/{category.maxScore}
                  </span>
                  {openSections[key] ? <ChevronUp className="w-5 h-5 text-secondary-600 dark:text-gray-400" /> : <ChevronDown className="w-5 h-5 text-secondary-600 dark:text-gray-400" />}
                </div>
              </button>
              {openSections[key] && (
                <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50 text-secondary-700 dark:border-dark-300 dark:bg-dark-200 dark:text-gray-300 text-fluid-xs sm:text-fluid-sm leading-relaxed">
                  <p className="mb-3">
                    {category.details}
                  </p>
                  {/* You can add more specific bullet points for sub-checks here if needed */}
                  {/* Example: {category.noTablesColumnsFonts !== undefined && <p>• No tables/columns: {category.noTablesColumnsFonts ? 'Yes' : 'No'}</p>} */}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Overall Recommendations */}
        {finalDetailedScore.recommendations && finalDetailedScore.recommendations.length > 0 && (
          <div className="bg-primary-50 rounded-xl p-4 sm:p-6 border border-primary-200 mb-6 lg:mb-8 dark:bg-dark-200 dark:border-dark-300">
            <h4 className="text-fluid-base sm:text-fluid-lg font-semibold text-secondary-900 dark:text-gray-100 mb-3 sm:mb-4 flex items-center">
              <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-primary-600 dark:text-neon-cyan-400" />
              Overall Recommendations
            </h4>
            <ul className="space-y-2">
              {finalDetailedScore.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start">
                  <div className="w-2 h-2 bg-primary-500 rounded-full mr-3 mt-2 flex-shrink-0 dark:bg-neon-cyan-400"></div>
                  <span className="text-fluid-xs sm:text-fluid-sm text-secondary-700 dark:text-gray-300">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Summary */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-primary-50 to-accent-50 rounded-xl border border-primary-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
          <div className="text-center">
            <div className="flex items-center justify-center mb-3">
              <Award className="w-6 h-6 text-yellow-500 dark:text-neon-cyan-400 mr-2" />
              <h3 className="text-fluid-base sm:text-fluid-lg font-bold text-secondary-900 dark:text-gray-100">
                🎉 Optimization Complete!
              </h3>
            </div>
            <p className="text-fluid-xs sm:text-fluid-sm text-secondary-700 dark:text-gray-300 mb-3">
              Your resume score improved by <strong>{improvement} points</strong> (from {initialDetailedScore.totalScore}% to {finalDetailedScore.totalScore}%),
              making it significantly more competitive and likely to pass ATS systems.
            </p>
            <div className="flex flex-wrap justify-center gap-2 text-fluid-xs">
              <span className="px-2 py-1 bg-primary-100 text-primary-800 rounded-full dark:bg-neon-cyan-500/20 dark:text-neon-cyan-300">
                ATS Optimized
              </span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full dark:bg-neon-blue-500/20 dark:text-neon-blue-300">
                Keyword Enhanced
              </span>
              <span className="px-2 py-1 bg-accent-100 text-accent-800 rounded-full dark:bg-neon-purple-500/20 dark:text-neon-purple-300">
                Industry Aligned
              </span>
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full dark:bg-neon-pink-500/20 dark:text-neon-pink-300">
                {finalDetailedScore.totalScore >= 90 ? 'Excellent Score' : 'Good Score'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

