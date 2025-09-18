import React from 'react';
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  MessageCircle,
  Headphones,
  Globe,
  Star,
  Zap,
  Award,
  Heart,
  CheckCircle,
  TrendingUp,
  FileText
} from 'lucide-react';

export const Contact: React.FC = () => {
  const contactInfo = [
    {
      icon: <Mail className="w-6 h-6" />,
      title: 'Email Support',
      details: 'primoboostai@gmail.com',
      description: 'Get help within 24 hours',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: <MessageCircle className="w-6 h-6" />,
      title: 'Live Chat',
      details: 'Available 24/7',
      description: 'Instant support via chat',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: 'Global Presence',
      details: 'Serving customers worldwide',
      description: 'Available in 100+ countries',
      color: 'from-orange-500 to-red-500'
    },
    {
      icon: <Headphones className="w-6 h-6" />,
      title: 'Customer Service',
      details: 'Dedicated support team',
      description: 'Mon-Fri, 9 AM - 6 PM PST',
      color: 'from-green-500 to-emerald-500'
    }
  ];

  const faqs = [
    {
      question: 'How does the AI resume optimization work?',
      answer: 'Our AI analyzes your resume against job descriptions, identifies gaps, and suggests improvements for better ATS compatibility and recruiter appeal.'
    },
    {
      question: 'Is my data secure and private?',
      answer: 'Yes, we use enterprise-grade security measures. Your data is encrypted and never shared with third parties. You can delete your data anytime.'
    },
    {
      question: 'What file formats do you support?',
      answer: 'We support PDF, DOCX, and TXT files for upload. You can export your optimized resume in both PDF and Word formats.'
    },
    {
      question: 'Can I get a refund if not satisfied?',
      answer: 'We offer a 7-day money-back guarantee. If you\'re not satisfied with the results, contact us for a full refund.'
    },
    {
      question: 'Do you offer bulk discounts for teams?',
      answer: 'Yes, we have special pricing for teams and organizations. Contact our sales team for custom enterprise solutions.'
    }
  ];

  const stats = [
    { number: '2hrs', label: 'Avg Response', icon: <Clock className="w-5 h-5" /> },
    { number: '98%', label: 'Satisfaction', icon: <Heart className="w-5 h-5" /> },
    { number: '24/7', label: 'Availability', icon: <Zap className="w-5 h-5" /> },
    { number: '5★', label: 'Rating', icon: <Star className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 font-inter dark:from-dark-50 dark:to-dark-200 transition-colors duration-300">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-700 text-white dark:from-neon-cyan-500 dark:to-neon-purple-500">
        <div className="absolute inset-0 bg-black/20 dark:bg-black/40"></div>
        <div className="relative container mx-auto px-4 py-20 sm:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg dark:bg-neon-cyan-500/20 dark:shadow-neon-cyan">
              <Headphones className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Get in Touch
              <span className="block bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent dark:from-neon-cyan-300 dark:to-neon-blue-300">
                We're Here to Help
              </span>
            </h1>
            <p className="text-xl sm:text-2xl text-blue-100 dark:text-gray-200 mb-8 leading-relaxed">
              Have questions about our AI resume optimization? Need support? We'd love to hear from you.
            </p>
          </div>
        </div>
      </div>

      {/* Contact Info Cards */}
      <div className="py-16 bg-white px-4 sm:px-0 dark:bg-dark-100">
        <div className="container mx-auto">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">Multiple Ways to Reach Us</h2>
              <p className="text-xl text-gray-600 dark:text-gray-300">Choose the method that works best for you</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {contactInfo.map((info, index) => (
                <div key={index} className="group">
                  <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl p-8 h-full border border-gray-100 hover:shadow-xl transition-all duration-300 hover:scale-105 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400 dark:hover:shadow-neon-cyan/20">
                    <div className={`bg-gradient-to-r ${info.color} w-12 h-12 rounded-xl flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      {info.icon}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">{info.title}</h3>
                    <p className="text-blue-600 dark:text-neon-cyan-400 font-semibold mb-2">{info.details}</p>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">{info.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Developer Info */}
      <div className="py-16 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-dark-200 dark:to-dark-300">
        <div className="container mx-auto">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 dark:bg-dark-100 dark:border-dark-300 dark:shadow-dark-xl">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-6 rounded-2xl md:w-1/3 dark:from-neon-purple-500/20 dark:to-neon-blue-500/20">
                  <div className="text-center">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold dark:from-neon-purple-500 dark:to-neon-blue-500 dark:shadow-neon-purple">
                      WO
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">WorthyOne</h3>
                    <p className="text-purple-600 dark:text-neon-purple-400 font-medium">Developer</p>
                  </div>
                </div>
                
                <div className="md:w-2/3">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                    One Developer, Complete Solution
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    PrimoBoost was built by a single developer with a passion for creating accessible, high-quality tools for students and professionals. The platform is committed to continuous improvement and new feature updates.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-500 dark:text-neon-cyan-400 mr-2" />
                      <span className="text-gray-700 dark:text-gray-300">All-in-one resume optimization platform</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-500 dark:text-neon-cyan-400 mr-2" />
                      <span className="text-gray-700 dark:text-gray-300">Built with a focus on user needs</span>
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-500 dark:text-neon-cyan-400 mr-2" />
                      <span className="text-gray-700 dark:text-gray-300">Continuous updates and new features</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="py-20 bg-white dark:bg-dark-100">
        <div className="container mx-auto">
          <div className="max-w-6xl mx-auto">
            <div className="max-w-4xl mx-auto">
              <div className="mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4 text-center">Frequently Asked Questions</h2>
                <p className="text-gray-600 dark:text-gray-300 text-center">Quick answers to common questions</p>
              </div>

              <div className="space-y-4">
                {faqs.map((faq, index) => (
                  <div key={index} className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden dark:bg-dark-100 dark:border-dark-300 dark:shadow-dark-xl">
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-start">
                        <div className="bg-blue-100 w-6 h-6 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0 dark:bg-neon-cyan-500/20">
                          <span className="text-blue-600 dark:text-neon-cyan-400 text-sm font-bold">{index + 1}</span>
                        </div>
                        {faq.question}
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed ml-9">{faq.answer}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Stats */}
              <div className="mt-8 bg-gradient-to-r from-blue-600 to-purple-700 rounded-2xl p-6 text-white dark:from-neon-cyan-500 dark:to-neon-purple-500 dark:shadow-neon-cyan">
                <h3 className="text-xl font-bold mb-4">Why Choose Our Support?</h3>
                <div className="grid grid-cols-2 gap-4">
                  {stats.map((stat, index) => (
                    <div key={index} className="text-center">
                      <div className="text-2xl font-bold mb-1">{stat.number}</div>
                      <div className="text-blue-100 dark:text-gray-200 text-sm">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
