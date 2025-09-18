// src/components/ProjectEnhancement.tsx
import React, { useState, useEffect } from 'react';
import {
  Plus,
  Zap,
  Target,
  TrendingUp,
  Calendar,
  Code,
  ExternalLink,
  Star,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  Github,
  Globe,
  Award,
  Clock,
  Lightbulb,
  X
} from 'lucide-react';
import { ProjectSuggestion, ProjectEnhancementResult, ManualProjectInput, ProjectMode } from '../types/projectEnhancement';
import { ResumeData } from '../types/resume';
import { projectEnhancementService } from '../services/projectEnhancementService';

interface ProjectEnhancementProps {
  isOpen: boolean;
  onClose: () => void;
  currentResume: ResumeData;
  jobDescription: string;
  onProjectsAdded: (updatedResume: ResumeData) => void;
}

export const ProjectEnhancement: React.FC<ProjectEnhancementProps> = ({
  isOpen,
  onClose,
  currentResume,
  jobDescription,
  onProjectsAdded
}) => {
  const [mode, setMode] = useState<ProjectMode>('auto');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ProjectEnhancementResult | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [manualProject, setManualProject] = useState<ManualProjectInput>({
    name: '',
    startDate: '',
    endDate: '',
    techStack: [],
    oneLiner: ''
  });
  const [newTech, setNewTech] = useState('');
  const [generatingDescription, setGeneratingDescription] = useState(false);

  useEffect(() => {
    if (isOpen && mode === 'auto') {
      analyzeMissingProjects();
    }
  }, [isOpen, mode]);

  const analyzeMissingProjects = async () => {
    setLoading(true);
    try {
      // Extract required skills from job description
      const requiredSkills = extractSkillsFromJD(jobDescription);

      // Search for relevant projects
      const serpResults = await projectEnhancementService.searchRelevantProjects(jobDescription, requiredSkills);

      // Generate suggestions
      const result = await projectEnhancementService.generateProjectSuggestions(
        jobDescription,
        currentResume,
        serpResults
      );

      setSuggestions(result);

      // Auto-select top 3 projects, but only add top 2 to the set by default
      const topProjects = result.suggestions.slice(0, 3).map(p => p.id);
      setSelectedProjects(new Set(topProjects.slice(0, 2))); // Select only top 2 projects by default
    } catch (error) {
      console.error('Error analyzing projects:', error);
      alert('Failed to analyze projects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to extract skills from a job description
  const extractSkillsFromJD = (jd: string): string[] => {
    const skillPatterns = [
      /\b(React|Angular|Vue|JavaScript|TypeScript|Node\.js|Python|Java|C\+\+|C#|PHP|Ruby|Go|Rust|Swift|Kotlin)\b/gi,
      /\b(MongoDB|MySQL|PostgreSQL|Redis|Elasticsearch|Firebase|Supabase)\b/gi,
      /\b(AWS|Azure|GCP|Docker|Kubernetes|Jenkins|Git|GitHub|GitLab)\b/gi
    ];

    const skills = new Set<string>();
    skillPatterns.forEach(pattern => {
      const matches = jd.match(pattern);
      if (matches) {
        matches.forEach(match => skills.add(match));
      }
    });

    return Array.from(skills);
  };

  // Toggles selection of a project
  const handleProjectToggle = (projectId: string) => {
    const newSelected = new Set(selectedProjects);
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId);
    } else {
      newSelected.add(projectId);
    }
    setSelectedProjects(newSelected);
  };

  // Adds a new technology to the manual project's tech stack
  const addTechToStack = () => {
    if (newTech.trim() && !manualProject.techStack.includes(newTech.trim())) {
      setManualProject(prev => ({
        ...prev,
        techStack: [...prev.techStack, newTech.trim()]
      }));
      setNewTech('');
    }
  };

  // Removes a technology from the manual project's tech stack
  const removeTechFromStack = (tech: string) => {
    setManualProject(prev => ({
      ...prev,
      techStack: prev.techStack.filter(t => t !== tech)
    }));
  };

  // Generates a description for a manually added project using AI
  const generateManualDescription = async () => {
    if (!manualProject.name || manualProject.techStack.length === 0) {
      alert('Please provide project name and at least one technology');
      return;
    }

    setGeneratingDescription(true);
    try {
      const description = await projectEnhancementService.generateProjectDescription(
        manualProject,
        jobDescription
      );

      // Convert description to bullet points
      const bullets = description.split('\n').filter(line => line.trim().startsWith('•')).map(line => line.replace('•', '').trim());

      const newProject = {
        title: manualProject.name,
        bullets: bullets
      };

      onProjectsAdded({
        ...currentResume,
        projects: [...(currentResume.projects || []), newProject]
      });
      onClose();
    } catch (error) {
      console.error('Error generating description:', error);
      alert('Failed to generate project description. Please try again.');
    } finally {
      setGeneratingDescription(false);
    }
  };

  // Applies selected AI-suggested projects to the resume
  const applySelectedProjects = () => {
    if (!suggestions || selectedProjects.size === 0) return;

    // Create new projects from selected suggestions
    const newProjects = suggestions.suggestions
      .filter(p => selectedProjects.has(p.id))
      .map(p => ({
        title: p.title,
        bullets: p.bullets && p.bullets.length > 0 ? p.bullets : [p.description]
      }));

    // Create updated resume with new projects added to existing ones
    const updatedResume = {
      ...currentResume,
      projects: [...(currentResume.projects || []), ...newProjects]
    };

    // Call the callback with the complete updated resume
    onProjectsAdded(updatedResume);
    onClose();
  };

  // Returns Tailwind CSS classes for difficulty colors
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200';
      case 'Intermediate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200';
      case 'Advanced': return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-dark-700 dark:text-gray-300';
    }
  };

  // Returns Tailwind CSS classes for score colors
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-neon-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-none shadow-2xl w-full h-screen overflow-hidden flex flex-col dark:bg-dark-100 dark:shadow-dark-xl">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-purple-50 to-blue-50 p-3 sm:p-6 border-b border-gray-200 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
          <button
            onClick={onClose}
            className="absolute top-2 right-2 sm:top-4 sm:right-4 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-white/50 min-w-[44px] min-h-[44px] dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-dark-300/50"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          <div className="text-center">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg">
              <Lightbulb className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2 px-4 dark:text-gray-100">
              Project Enhancement
            </h1>
            <p className="text-sm sm:text-base text-gray-600 px-4 dark:text-gray-300">
              Add relevant projects to boost your resume score and match job requirements
            </p>
          </div>
        </div>

        <div className="p-3 sm:p-6 overflow-y-auto flex-1 min-h-0">
          {/* Mode Selection */}
          <div className="mb-4 sm:mb-6 flex-shrink-0">
            <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2 sm:gap-3">
              <button
                onClick={() => setMode('manual')}
                className={`flex items-center justify-center space-x-2 px-3 sm:px-4 py-3 rounded-lg sm:rounded-xl font-medium transition-all text-sm min-h-[44px] ${
                  mode === 'manual'
                    ? 'bg-blue-100 text-blue-700 border-2 border-blue-300 dark:bg-neon-cyan-500/20 dark:text-neon-cyan-300 dark:border-neon-cyan-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-dark-200 dark:text-gray-300 dark:hover:bg-dark-300'
                }`}
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Manual Add</span>
              </button>
              <button
                onClick={() => setMode('auto')}
                className={`flex items-center justify-center space-x-2 px-3 sm:px-4 py-3 rounded-lg sm:rounded-xl font-medium transition-all text-sm min-h-[44px] ${
                  mode === 'auto'
                    ? 'bg-purple-100 text-purple-700 border-2 border-purple-300 dark:bg-neon-purple-500/20 dark:text-neon-purple-300 dark:border-neon-purple-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-dark-200 dark:text-gray-300 dark:hover:bg-dark-300'
                }`}
              >
                <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>AI Suggestions</span>
              </button>
              <button
                onClick={() => setMode('ai-score')}
                className={`flex items-center justify-center space-x-2 px-3 sm:px-4 py-3 rounded-lg sm:rounded-xl font-medium transition-all text-sm min-h-[44px] ${
                  mode === 'ai-score'
                    ? 'bg-green-100 text-green-700 border-2 border-green-300 dark:bg-neon-green-500/20 dark:text-neon-green-300 dark:border-neon-green-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-dark-200 dark:text-gray-300 dark:hover:bg-dark-300'
                }`}
              >
                <Target className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>AI + Scoring</span>
              </button>
            </div>
          </div>

          {/* Manual Mode */}
          {mode === 'manual' && (
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-blue-50 rounded-lg sm:rounded-xl p-4 sm:p-6 border border-blue-200 dark:bg-neon-cyan-500/20 dark:border-neon-cyan-700">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center dark:text-gray-100">
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600 dark:text-neon-cyan-400" />
                  Add Project Manually
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                      Project Name *
                    </label>
                    <input
                      type="text"
                      value={manualProject.name}
                      onChange={(e) => setManualProject(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., E-commerce Website"
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm min-h-[44px] dark:bg-dark-700 dark:border-dark-600 dark:text-gray-100 dark:placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                      One-liner (Optional)
                    </label>
                    <input
                      type="text"
                      value={manualProject.oneLiner}
                      onChange={(e) => setManualProject(prev => ({ ...prev, oneLiner: e.target.value }))}
                      placeholder="Brief description of the project"
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm min-h-[44px] dark:bg-dark-700 dark:border-dark-600 dark:text-gray-100 dark:placeholder-gray-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                      Start Date *
                    </label>
                    <input
                      type="month"
                      value={manualProject.startDate}
                      onChange={(e) => setManualProject(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm min-h-[44px] dark:bg-dark-700 dark:border-dark-600 dark:text-gray-100 dark:placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                      End Date *
                    </label>
                    <input
                      type="month"
                      value={manualProject.endDate}
                      onChange={(e) => setManualProject(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm min-h-[44px] dark:bg-dark-700 dark:border-dark-600 dark:text-gray-100 dark:placeholder-gray-400"
                    />
                  </div>
                </div>

                <div className="mb-3 sm:mb-4">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                    Tech Stack *
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2 mb-2">
                    <input
                      type="text"
                      value={newTech}
                      onChange={(e) => setNewTech(e.target.value)}
                      placeholder="Add technology (e.g., React, Node.js)"
                      className="w-full sm:flex-1 px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm min-h-[44px] dark:bg-dark-700 dark:border-dark-600 dark:text-gray-100 dark:placeholder-gray-400"
                    />
                    <button
                      onClick={addTechToStack}
                      className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-4 sm:px-6 rounded-lg sm:rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm min-h-[44px] dark:from-neon-purple-600 dark:to-neon-cyan-600 dark:hover:from-neon-purple-700 dark:hover:to-neon-cyan-700"
                    >
                      <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span>Add Technology</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {manualProject.techStack.map((tech, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm bg-blue-100 text-blue-800 dark:bg-neon-cyan-500/20 dark:text-neon-cyan-200"
                      >
                        {tech}
                        <button
                          onClick={() => removeTechFromStack(tech)}
                          className="ml-1 sm:ml-2 text-blue-600 hover:text-blue-800 min-w-[20px] min-h-[20px] flex items-center justify-center dark:text-neon-cyan-300 dark:hover:text-neon-cyan-200"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={generateManualDescription}
                  disabled={generatingDescription || !manualProject.name || manualProject.techStack.length === 0}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-4 sm:px-6 rounded-lg sm:rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm min-h-[44px] dark:from-neon-cyan-600 dark:to-neon-purple-600 dark:hover:from-neon-cyan-700 dark:hover:to-neon-purple-700"
                >
                  {generatingDescription ? (
                    <>
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                      <span>Generating Description...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span>Generate & Add Project</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Auto Mode */}
          {(mode === 'auto' || mode === 'ai-score') && (
            <div className="space-y-4 sm:space-y-6">
              {loading ? (
                <div className="text-center py-8 sm:py-12">
                  <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-blue-600 mx-auto mb-4 dark:text-neon-cyan-400" />
                  <p className="text-sm sm:text-base text-gray-600 px-4 dark:text-gray-300">Analyzing job requirements and searching for relevant projects...</p>
                </div>
              ) : suggestions ? (
                <>
                  {/* Score Comparison */}
                  {mode === 'ai-score' && (
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg sm:rounded-xl p-4 sm:p-6 border border-green-200 mb-4 sm:mb-6 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center dark:text-gray-100">
                        <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-green-600 dark:text-neon-green-400" />
                        Resume Score Improvement
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                        <div className="text-center">
                          <div className="text-xs sm:text-sm text-gray-600 mb-1 dark:text-gray-300">ATS Match</div>
                          <div className="flex items-center justify-center space-x-2">
                            <span className={`text-base sm:text-lg font-bold ${getScoreColor(suggestions.beforeScore.atsMatch)}`}>
                              {suggestions.beforeScore.atsMatch}%
                            </span>
                            <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 dark:text-gray-500" />
                            <span className={`text-base sm:text-lg font-bold ${getScoreColor(suggestions.afterScore.atsMatch)}`}>
                              {suggestions.afterScore.atsMatch}%
                            </span>
                          </div>
                        </div>

                        <div className="text-center">
                          <div className="text-xs sm:text-sm text-gray-600 mb-1 dark:text-gray-300">Project Relevance</div>
                          <div className="flex items-center justify-center space-x-2">
                            <span className="text-base sm:text-lg font-bold text-red-600 dark:text-red-400">
                              {suggestions.beforeScore.projectRelevance}/5
                            </span>
                            <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 dark:text-gray-500" />
                            <span className="text-base sm:text-lg font-bold text-green-600 dark:text-neon-green-400">
                              {suggestions.afterScore.projectRelevance}/5
                            </span>
                          </div>
                        </div>

                        <div className="text-center">
                          <div className="text-xs sm:text-sm text-gray-600 mb-1 dark:text-gray-300">Overall Score</div>
                          <div className="flex items-center justify-center space-x-2">
                            <span className={`text-base sm:text-lg font-bold ${getScoreColor(suggestions.beforeScore.overallScore)}`}>
                              {suggestions.beforeScore.overallScore}
                            </span>
                            <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 dark:text-gray-500" />
                            <span className={`text-base sm:text-lg font-bold ${getScoreColor(suggestions.afterScore.overallScore)}`}>
                              {suggestions.afterScore.overallScore}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Missing Skills */}
                  {suggestions.missingSkills.length > 0 && (
                    <div className="bg-orange-50 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-orange-200 mb-4 sm:mb-6 dark:bg-orange-500/20 dark:border-orange-700">
                      <div className="flex items-start space-x-3">
                        <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 mt-0.5 flex-shrink-0 dark:text-orange-400" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-orange-800 mb-2 text-sm sm:text-base dark:text-orange-200">Missing Skills Detected</h4>
                          <div className="flex flex-wrap gap-2">
                            {suggestions.missingSkills.map((skill, index) => (
                              <span key={index} className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs break-words dark:bg-orange-900/40 dark:text-orange-200">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Project Suggestions */}
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center dark:text-gray-100">
                      <Target className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-purple-600 dark:text-neon-purple-400" />
                      Recommended Projects ({suggestions.suggestions.length})
                    </h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
                      {suggestions.suggestions.map((project) => (
                        <div
                          key={project.id}
                          className={`border-2 rounded-lg sm:rounded-xl p-3 sm:p-4 transition-all cursor-pointer ${
                            selectedProjects.has(project.id)
                              ? 'border-purple-500 bg-purple-50 dark:border-neon-purple-400 dark:bg-neon-purple-500/20'
                              : 'border-gray-200 hover:border-purple-300 dark:border-dark-700 dark:hover:border-neon-purple-400'
                          }`}
                          onClick={() => handleProjectToggle(project.id)}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-3 sm:space-y-0 mb-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base break-words dark:text-gray-100">{project.title}</h4>
                              <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2 mb-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(project.difficulty)} w-fit`}>
                                  {project.difficulty}
                                </span>
                                <span className="flex items-center text-xs text-gray-500 w-fit dark:text-gray-400">
                                  <Clock className="w-3 h-3 mr-1 flex-shrink-0" />
                                  {project.estimatedTime}
                                </span>
                                <div className="flex items-center w-fit">
                                  {[...Array(5)].map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`w-2 h-2 sm:w-3 sm:h-3 ${
                                        i < project.relevanceScore ? 'text-yellow-400 fill-current dark:text-yellow-300' : 'text-gray-300 dark:text-dark-500'
                                      }`}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              selectedProjects.has(project.id)
                                ? 'border-purple-500 bg-purple-500 dark:border-neon-purple-400 dark:bg-neon-purple-400'
                                : 'border-gray-300 dark:border-dark-500'
                            }`}>
                              {selectedProjects.has(project.id) && (
                                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                              )}
                            </div>
                          </div>

                          <p className="text-xs sm:text-sm text-gray-700 mb-3 break-words line-clamp-3 dark:text-gray-300">{project.description}</p>

                          <div className="flex flex-wrap gap-1 mb-3 max-h-20 overflow-y-auto">
                            {project.techStack.map((tech, index) => (
                              <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs break-words dark:bg-dark-700 dark:text-gray-300">
                                {tech}
                              </span>
                            ))}
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                            <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2">
                              {project.githubLink && (
                                <a
                                  href={project.githubLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center text-xs text-blue-600 hover:text-blue-800 min-h-[44px] w-fit dark:text-neon-cyan-400 dark:hover:text-neon-cyan-200"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Github className="w-3 h-3 mr-1 flex-shrink-0" />
                                  GitHub
                                </a>
                              )}
                              {project.demoLink && (
                                <a
                                  href={project.demoLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center text-xs text-green-600 hover:text-green-800 min-h-[44px] w-fit dark:text-neon-green-400 dark:hover:text-neon-green-200"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Globe className="w-3 h-3 mr-1 flex-shrink-0" />
                                  Demo
                                </a>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 w-fit dark:text-gray-400">{project.category}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
                      <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left dark:text-gray-300">
                        {selectedProjects.size} project{selectedProjects.size !== 1 ? 's' : ''} selected
                      </div>
                      <button
                        onClick={applySelectedProjects}
                        disabled={selectedProjects.size === 0}
                        className="w-full sm:w-auto bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-semibold py-3 px-4 sm:px-6 rounded-lg sm:rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm min-h-[44px] dark:from-neon-green-600 dark:to-neon-cyan-600 dark:hover:from-neon-green-700 dark:hover:to-neon-cyan-700"
                      >
                        <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span>Add Projects & Show Preview</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-6 sm:py-8">
                  <button
                    onClick={analyzeMissingProjects}
                    className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-4 sm:px-6 rounded-lg sm:rounded-xl transition-all duration-300 flex items-center justify-center space-x-2 mx-auto text-sm min-h-[44px] dark:from-neon-purple-600 dark:to-neon-cyan-600 dark:hover:from-neon-purple-700 dark:hover:to-neon-cyan-700"
                  >
                    <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Analyze & Suggest Projects</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
