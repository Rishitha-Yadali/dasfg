import React from 'react';
import {
  Users,
  Target,
  Award,
  Sparkles,
  TrendingUp,
  Shield,
  Clock,
  CheckCircle,
  Star,
  Zap,
  Heart,
  Globe
} from 'lucide-react';

export const AboutUs: React.FC = () => {
  const stats = [
    { number: '50,000+', label: 'Resumes Optimized', icon: <TrendingUp className="w-6 h-6" /> },
    { number: '95%', label: 'Success Rate', icon: <Award className="w-6 h-6" /> },
    { number: '24/7', label: 'AI Support', icon: <Clock className="w-6 h-6" /> },
    { number: '100+', label: 'Countries Served', icon: <Globe className="w-6 h-6" /> }
  ];

  const features = [
    {
      icon: <Sparkles className="w-8 h-8" />,
      title: 'AI-Powered Optimization',
      description: 'Our advanced AI analyzes your resume against job requirements and optimizes it for maximum impact.'
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: 'ATS-Friendly Formatting',
      description: 'Ensure your resume passes through Applicant Tracking Systems with our specialized formatting.'
    },
    {
      icon: <Target className="w-8 h-8" />,
      title: 'JD-Based Projects',
      description: 'Get targeted project suggestions based on your job description to make your resume more relevant.'
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: 'Instant Results',
      description: 'Get your optimized resume in seconds, not hours. Fast, efficient, and reliable.'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-dark-50 dark:to-dark-200 transition-colors duration-300">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-700 text-white dark:from-dark-100 dark:to-dark-300">
        <div className="absolute inset-0 bg-black/20 dark:bg-black/40"></div>
        <div className="relative container mx-auto px-4 py-20 sm:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg dark:bg-neon-cyan-500/20 dark:shadow-neon-cyan">
              <Heart className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Empowering Careers with
              <span className="block bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent dark:from-neon-cyan-300 dark:to-neon-blue-300">
                AI Innovation
              </span>
            </h1>
            <p className="text-xl sm:text-2xl text-blue-100 dark:text-gray-300 mb-8 leading-relaxed">
              We're on a mission to help professionals land their dream jobs through intelligent resume optimization and career guidance.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <div className="bg-white/10 backdrop-blur-sm px-6 py-3 rounded-full border border-white/20 dark:bg-neon-cyan-500/20 dark:border-neon-cyan-400/30">
                <span className="text-lg font-semibold">🚀 Trusted by 50,000+ professionals</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-16 bg-white px-4 sm:px-0 dark:bg-dark-100">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center group">
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 text-blue-600 dark:from-neon-cyan-500/20 dark:to-neon-blue-500/20 dark:text-neon-cyan-400 dark:shadow-neon-cyan">
                  {stat.icon}
                </div>
                <div className="text-2xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3">{stat.number}</div>
                <div className="text-gray-600 dark:text-gray-400 font-medium text-sm sm:text-base">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Our Story Section */}
      <div className="py-20 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-dark-200 dark:to-dark-300">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-6">Our Story</h2>
              <div className="w-24 h-1 bg-gradient-to-r from-blue-600 to-purple-600 mx-auto mb-8 dark:from-neon-cyan-400 dark:to-neon-blue-400"></div>
            </div>
            
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                  From Frustration to Innovation
                </h3>
                <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                  PrimoBoost AI was born from a moment of frustration turned into purpose: seeing skilled professionals overlooked because their resumes weren’t optimized for modern hiring. Rishitha, our founder, lived that pain and chose to solve it by using intelligent AI to give applicants the clarity and alignment recruiters actually respond to.
                </p>
                <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                  Today, as the first platform of its kind in India, we make hyper-personalized, JD-aligned resume optimization affordable and accessible. We believe opportunity should come from fit, not luck—so we equip serious job seekers with tailored resumes, project-level suggestions, and outreach that convert
                </p>
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-blue-100 dark:bg-dark-100 dark:border-neon-cyan-400/50 dark:shadow-dark-xl">
                  <div className="flex items-start space-x-4">
                    <div className="bg-blue-100 p-3 rounded-full dark:bg-neon-cyan-500/20">
                      <Target className="w-6 h-6 text-blue-600 dark:text-neon-cyan-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Our Mission</h4>
                      <p className="text-gray-700 dark:text-gray-300">
                        To democratize career success by making professional resume optimization accessible, affordable, and effective for everyone.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="relative">
                <div className="bg-gradient-to-br from-blue-600 to-purple-700 rounded-3xl p-8 text-white shadow-2xl dark:from-neon-cyan-500 dark:to-neon-purple-500 dark:shadow-neon-cyan">
                  <div className="space-y-6">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-6 h-6 text-green-300 dark:text-neon-cyan-200" />
                      <span className="text-lg">Founded in 2025</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-6 h-6 text-green-300 dark:text-neon-cyan-200" />
                      <span className="text-lg">AI-first approach</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-6 h-6 text-green-300 dark:text-neon-cyan-200" />
                      <span className="text-lg">Global reach</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-6 h-6 text-green-300 dark:text-neon-cyan-200" />
                      <span className="text-lg">Continuous innovation</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-white dark:bg-dark-100">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-6">What Makes Us Different</h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                We combine cutting-edge AI technology with deep understanding of hiring processes to deliver unmatched results.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              {features.map((feature, index) => (
                <div key={index} className="group">
                  <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl p-8 h-full border border-gray-100 hover:shadow-xl transition-all duration-300 hover:scale-105 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400 dark:hover:shadow-neon-cyan/20">
                    <div className="text-blue-600 dark:text-neon-cyan-400 mb-6 group-hover:scale-110 transition-transform duration-300">
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">{feature.title}</h3>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Values Section */}
      <div className="py-20 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-dark-200 dark:to-dark-300">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-12">Our Core Values</h2>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="group">
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 dark:from-neon-cyan-500/20 dark:to-neon-blue-500/20 dark:shadow-neon-cyan">
                  <Users className="w-8 h-8 text-blue-600 dark:text-neon-cyan-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">People First</h3>
                <p className="text-gray-700 dark:text-gray-300">
                  Every decision we make is centered around helping people achieve their career goals and unlock their potential.
                </p>
              </div>
              
              <div className="group">
                <div className="bg-gradient-to-br from-green-50 to-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 dark:from-neon-blue-500/20 dark:to-neon-purple-500/20 dark:shadow-neon-blue">
                  <Sparkles className="w-8 h-8 text-green-600 dark:text-neon-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Innovation</h3>
                <p className="text-gray-700 dark:text-gray-300">
                  We continuously push the boundaries of what's possible with AI to deliver cutting-edge solutions.
                </p>
              </div>
              
              <div className="group">
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 dark:from-neon-purple-500/20 dark:to-neon-pink-500/20 dark:shadow-neon-purple">
                  <Shield className="w-8 h-8 text-purple-600 dark:text-neon-purple-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Trust</h3>
                <p className="text-gray-700 dark:text-gray-300">
                  We maintain the highest standards of security, privacy, and reliability in everything we do.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 bg-gradient-to-r from-blue-600 to-purple-700 text-white dark:from-neon-cyan-500 dark:to-neon-purple-500">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">Ready to Transform Your Career?</h2>
            <p className="text-xl text-blue-100 dark:text-gray-200 mb-8">
              Join thousands of professionals who have already upgraded their resumes and landed their dream jobs.
            </p>
            <button className="bg-white text-blue-600 font-bold py-4 px-8 rounded-2xl hover:bg-gray-100 transition-colors duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 dark:bg-dark-100 dark:text-neon-cyan-400 dark:hover:bg-dark-200 dark:shadow-neon-cyan">
              Start Optimizing Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
