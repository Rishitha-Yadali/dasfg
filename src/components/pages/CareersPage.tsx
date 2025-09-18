// src/components/pages/CareersPage.tsx
import React, { useState, useCallback } from 'react';
import {
  MapPin,
  Clock,
  Users,
  Briefcase,
  Target,
  TrendingUp,
  MessageCircle,
  Monitor,
  Database,
  Brain,
  Cpu,
  Cloud,
  Palette,
  BarChart3,
  ArrowRight,
  Sparkles,
  Crown,
  Award,
  Zap,
  FileText,
  Search,
  Video,
  Send // Keep Send icon for the Apply Now button in the JobDetailsPage
} from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import { careersData } from '../../data/careersData'; // Import the new data file

interface CareersPageProps {
  isAuthenticated: boolean;
  onShowAuth: (callback?: () => void) => void;
}

export const CareersPage: React.FC<CareersPageProps> = ({ isAuthenticated, onShowAuth }) => {
  const navigate = useNavigate();

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
      case 'Marketing': return <TrendingUp className="w-6 h-6" />;
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

  const handleViewDetails = (jobId: string) => {
    navigate(`/careers/${jobId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 transition-colors duration-300">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-700 text-white dark:from-cyan-500 dark:to-fuchsia-600">
        <div className="absolute inset-0 bg-black/20 dark:bg-black/40" />
        <div className="relative container mx-auto px-4 py-20 sm:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              {careersData.hero.title}
            </h1>
            <p className="text-xl sm:text-2xl text-blue-100 dark:text-gray-200 mb-8 leading-relaxed">
              {careersData.hero.subtitle}
            </p>
            <a
              href={careersData.hero.ctaHref}
              className="inline-flex items-center bg-white text-blue-600 font-bold py-4 px-8 rounded-2xl hover:bg-gray-100 transition-colors duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              {careersData.hero.ctaText}
              <ArrowRight className="w-5 h-5 ml-2" />
            </a>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="py-16 bg-white dark:bg-dark-100 hidden lg:block">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { number: '50,000+', label: 'Users Served', icon: <Users className="w-6 h-6" /> },
              { number: '95%', label: 'Success Rate', icon: <Award className="w-6 h-6" /> },
              { number: '24/7', label: 'AI Support', icon: <Zap className="w-6 h-6" /> },
              { number: '10+', label: 'Open Roles', icon: <Crown className="w-6 h-6" /> }
            ].map((stat, index) => (
              <div key={index} className="text-center group">
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 text-blue-600">
                  {stat.icon}
                </div>
                <div className="text-2xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                  {stat.number}
                </div>
                <div className="text-gray-600 dark:text-gray-400 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Jobs Overview */}
      <div id="open-roles" className="py-20 bg-gray-50 dark:bg-dark-200">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-6">
              Open Positions
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Join our team of innovators and help shape the future of career technology
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {careersData.jobs.map((job) => (
              <div
                key={job.id}
                onClick={() => handleViewDetails(job.id)} // Make the entire card clickable
                className="bg-white rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer dark:bg-dark-100 dark:border-dark-300"
              >
                <div className="p-8">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center space-x-4">
                      <div
                        className={`bg-gradient-to-r ${getDomainColor(job.domain)} w-16 h-16 rounded-xl flex items-center justify-center text-white shadow-lg`}
                      >
                        {getDomainIcon(job.domain)}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                          {job.title}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full font-medium">
                            {job.domain}
                          </span>
                          <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full font-medium">
                            {job.type}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed line-clamp-3">
                    {job.summary}
                  </p>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <MapPin className="w-4 h-4 mr-2" />
                      {job.location}
                    </div>
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <Clock className="w-4 h-4 mr-2" />
                      {job.eligibility.experience}
                    </div>
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <Users className="w-4 h-4 mr-2" />
                      Team: {job.team}
                    </div>
                    <div className="flex items-center text-gray-600 dark:text-gray-400">
                      <Briefcase className="w-4 h-4 mr-2" />
                      Stipend/Salary: {job.perks.find(p => p.includes('Stipend') || p.includes('salary')) || 'Competitive'}
                    </div>
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); handleViewDetails(job.id); }} // Ensure button click also navigates
                    className={`w-full bg-gradient-to-r ${getDomainColor(job.domain)} hover:opacity-90 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105`}
                  >
                    <span>View Details</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Why Join */}
      <div className="py-20 bg-white dark:bg-dark-100">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-6">
              Why PrimoBoost AI?
            </h2>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="group">
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Sparkles className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Cutting-edge Technology
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  Work with the latest AI technologies and contribute to solutions that impact
                  thousands of careers.
                </p>
              </div>

              <div className="group">
                <div className="bg-gradient-to-br from-green-50 to-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Target className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Growth Focused
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  Fast-paced environment with strong mentorship and unlimited learning
                  opportunities.
                </p>
              </div>

              <div className="group">
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Crown className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Impact & Ownership
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  Own projects from conception to deployment and see your work directly impact user
                  success.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
