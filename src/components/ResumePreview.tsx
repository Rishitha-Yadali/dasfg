// src/components/ResumePreview.tsx

import React from 'react';
import { ResumeData, UserType } from '../types/resume';

// --- FIX: Define necessary types and defaults locally to resolve import error ---
interface ExportOptions {
  layoutType: 'standard' | 'compact';
  paperSize: 'a4' | 'letter';
  fontFamily: 'Helvetica' | 'Times' | 'Courier' | 'Roboto';
  nameSize: number;
  sectionHeaderSize: number;
  subHeaderSize: number;
  bodyTextSize: number;
  sectionSpacing: number;
  entrySpacing: number;
}

const defaultExportOptions: ExportOptions = {
  layoutType: 'standard',
  paperSize: 'a4',
  fontFamily: 'Helvetica',
  nameSize: 22,
  sectionHeaderSize: 12,
  subHeaderSize: 10,
  bodyTextSize: 10,
  sectionSpacing: 4,
  entrySpacing: 2,
};
// --- END FIX ---


// ---------- Helper Functions (replicated from exportUtils.ts for consistency) ----------
const mmToPx = (mm: number) => mm * 3.779528; // 1mm = 3.779528px at 96 DPI
const ptToPx = (pt: number) => pt * 1.333; // 1pt = 1.333px at 96 DPI

// Replicate PDF_CONFIG creation logic from exportUtils.ts
const createPDFConfigForPreview = (options: ExportOptions) => {
  const layoutConfig = options.layoutType === 'compact' ?
    { margins: { top: 10, bottom: 10, left: 15, right: 15 } } :
    { margins: { top: 15, bottom: 10, left: 20, right: 20 } }; // MODIFIED: Changed bottom margin to 10 for standard

  const paperConfig = options.paperSize === 'letter' ?
    { pageWidth: 216, pageHeight: 279 } :
    { pageWidth: 210, pageHeight: 297 };

  return {
    pageWidth: paperConfig.pageWidth,
    pageHeight: paperConfig.pageHeight,
    margins: layoutConfig.margins,
    get contentWidth() {
      return this.pageWidth - this.margins.left - this.margins.right;
    },
    get contentHeight() {
      return this.pageHeight - this.margins.top - this.margins.bottom;
    },
    fonts: {
      name: { size: options.nameSize, weight: 'bold' as const },
      contact: { size: options.bodyTextSize - 0.5, weight: 'bold' as const },
      sectionTitle: { size: options.sectionHeaderSize, weight: 'bold' as const },
      jobTitle: { size: options.subHeaderSize, weight: 'bold' as const },
      company: { size: options.subHeaderSize, weight: 'bold' as const },
      year: { size: options.subHeaderSize, weight: 'normal' as const },
      body: { size: options.bodyTextSize, weight: 'normal' as const },
    },
    spacing: {
      nameFromTop: 13,
      afterName: 0,
      afterContact: 1,
      sectionSpacingBefore: options.sectionSpacing,
      sectionSpacingAfter: 2,
      bulletListSpacing: options.entrySpacing * 0.3,
      afterSubsection: 3,
      lineHeight: 1.2,
      bulletIndent: 4,
      entrySpacing: options.entrySpacing,
    },
    colors: {
      primary: [0, 0, 0] as [number, number, number],
      secondary: [80, 80, 80] as [number, number, number],
      accent: [37, 99, 235] as [number, number, number],
    },
    fontFamily: options.fontFamily,
  };
};

interface ResumePreviewProps {
  resumeData: ResumeData;
  userType?: UserType;
  exportOptions?: ExportOptions;
}

export const ResumePreview: React.FC<ResumePreviewProps> = ({
  resumeData,
  userType = 'experienced',
  exportOptions
}) => {
  // Use defaultExportOptions if exportOptions is not provided
  const currentExportOptions = exportOptions || defaultExportOptions;
  const PDF_CONFIG = createPDFConfigForPreview(currentExportOptions);

  // Debug logging to check what data we're receiving
  console.log('ResumePreview received data:', resumeData);

  // Add validation to ensure we have valid resume data
  if (!resumeData) {
    return (
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="p-8 text-center">
          <div className="text-gray-500 mb-4">No resume data available</div>
          <div className="text-sm text-gray-400">Please ensure your resume has been properly optimized</div>
        </div>
      </div>
    );
  }

  // Ensure we have at least a name to display
  if (!resumeData.name || resumeData.name.trim() === '') {
    return (
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="p-8 text-center">
          <div className="text-gray-500 mb-4">Start building your resume!</div>
          <div className="text-sm text-gray-400">Fill in your details on the left to generate a live preview here</div>
        </div>
      </div>
    );
  }

  // --- Style constants ---
  const sectionTitleStyle: React.CSSProperties = {
    fontSize: ptToPx(PDF_CONFIG.fonts.sectionTitle.size),
    fontWeight: 'bold',
    marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter),
    marginTop: mmToPx(PDF_CONFIG.spacing.sectionSpacingBefore),
    fontFamily: `${PDF_CONFIG.fontFamily}, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`,
    letterSpacing: '0.5pt',
    textTransform: 'uppercase',
  } as const;

  const sectionUnderlineStyle: React.CSSProperties = {
    borderBottomWidth: '0.5pt',
    borderColor: '#808080',
    height: '1px',
    marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter),
    width: `${mmToPx(PDF_CONFIG.contentWidth)}px`,
    margin: '0 auto',
  };

  const bodyTextStyle: React.CSSProperties = {
    fontSize: ptToPx(PDF_CONFIG.fonts.body.size),
    fontFamily: `${PDF_CONFIG.fontFamily}, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`,
    lineHeight: PDF_CONFIG.spacing.lineHeight,
  };

  const listItemStyle: React.CSSProperties = {
    ...bodyTextStyle,
    marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 0.25),
    display: 'flex',
    alignItems: 'flex-start',
  };

  // Build contact information with proper separators
  const buildContactInfo = () => {
    const parts: React.ReactNode[] = [];

    const isValidField = (field?: string | null, fieldType: 'phone' | 'email' | 'url' | 'text' = 'text'): boolean => {
      if (!field || field.trim() === '') return false;
      const lower = field.trim().toLowerCase();
      const invalidValues = ['n/a', 'not specified', 'none'];
      if (invalidValues.includes(lower)) return false;
      
      switch (fieldType) {
        case 'phone': {
          const digitCount = (field.match(/\d/g) || []).length;
          return digitCount >= 7 && digitCount <= 15;
        }
        case 'email':
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field);
        case 'url':
          return /^https?:\/\//.test(field) ||
                 /^(www\.)?linkedin\.com\/in\//.test(field) ||
                 /^(www\.)?github\.com\//.test(field) ||
                 /linkedin\.com\/in\//.test(field) ||
                 /github\.com\//.test(field);
        case 'text':
        default:
          return true;
      }
    };

    if (isValidField(resumeData.phone, 'phone')) {
      parts.push(<span key="phone" style={{ fontSize: ptToPx(PDF_CONFIG.fonts.contact.size) }}>{resumeData.phone}</span>);
    }
    if (isValidField(resumeData.email, 'email')) {
      parts.push(<span key="email" style={{ fontSize: ptToPx(PDF_CONFIG.fonts.contact.size) }}>{resumeData.email}</span>);
    }
    if (isValidField(resumeData.location, 'text')) {
      parts.push(<span key="location" style={{ fontSize: ptToPx(PDF_CONFIG.fonts.contact.size) }}>{resumeData.location}</span>);
    }
    if (isValidField(resumeData.linkedin, 'url')) {
      let processedLinkedin = resumeData.linkedin!;
      if (!processedLinkedin.startsWith('http')) {
        processedLinkedin = `https://${processedLinkedin}`;
      }
      parts.push(<span key="linkedin" style={{ fontSize: ptToPx(PDF_CONFIG.fonts.contact.size) }}>{processedLinkedin}</span>);
    }
    if (isValidField(resumeData.github, 'url')) {
      let processedGithub = resumeData.github!;
      if (!processedGithub.startsWith('http')) {
        processedGithub = `https://${processedGithub}`;
      }
      parts.push(<span key="github" style={{ fontSize: ptToPx(PDF_CONFIG.fonts.contact.size) }}>{processedGithub}</span>);
    }

    return parts.map((part, index) => (
      <React.Fragment key={index}>
        {part}
        {index < parts.length - 1 && <span className="mx-1" style={{ fontSize: ptToPx(PDF_CONFIG.fonts.contact.size) }}>|</span>}
      </React.Fragment>
    ));
  };

  const contactElements = buildContactInfo();

  const getSectionOrder = () => {
    if (userType === 'experienced') {
      return ['summary', 'workExperience', 'skills', 'projects', 'certifications', 'additionalSections', 'education'];
    } else if (userType === 'student') {
      return ['summary', 'education', 'skills', 'projects', 'workExperience', 'certifications', 'additionalSections', 'achievementsAndExtras'];
    } else { // 'fresher'
      return ['summary', 'education', 'workExperience', 'projects', 'skills', 'certifications', 'additionalSections', 'achievementsAndExtras'];
    }
  };

  const sectionOrder = getSectionOrder();

  const renderSection = (sectionName: string) => {
    switch (sectionName) {
      case 'summary':
        if (userType === 'student' || userType === 'fresher') {
          if (!String(resumeData.careerObjective || '').trim()) return null;
          return (
            <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter) }}>
              <h2 style={sectionTitleStyle}>CAREER OBJECTIVE</h2>
              <p style={{ ...bodyTextStyle, marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing) }}>
                {resumeData.careerObjective || ''}
              </p>
            </div>
          );
        } else {
          if (!String(resumeData.summary || '').trim()) return null;
          return (
            <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter) }}>
              <h2 style={sectionTitleStyle}>PROFESSIONAL SUMMARY</h2>
              <div style={sectionUnderlineStyle}></div>
              <p style={{ ...bodyTextStyle, marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing) }}>
                {resumeData.summary || ''}
              </p>
            </div>
          );
        }

      case 'workExperience':
        if (!resumeData.workExperience || resumeData.workExperience.length === 0) return null;
        return (
          <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter) }}>
            <h2 style={sectionTitleStyle}>
              {userType === 'fresher' || userType === 'student' ? 'INTERNSHIPS & TRAINING' : 'PROFESSIONAL EXPERIENCE'}
            </h2>
            <div style={sectionUnderlineStyle}></div>
            {resumeData.workExperience.map((job, index) => (
              <div key={index} style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 2) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 0.5) }}>
                  <div>
                    <div style={{ fontSize: ptToPx(PDF_CONFIG.fonts.jobTitle.size), fontWeight: 'bold', fontFamily: `${PDF_CONFIG.fontFamily}, sans-serif` }}>
                      {job.role}
                    </div>
                    <div style={{ fontSize: ptToPx(PDF_CONFIG.fonts.company.size), fontWeight: 'bold', fontFamily: `${PDF_CONFIG.fontFamily}, sans-serif` }}>
                      {job.company}{job.location ? `, ${job.location}` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: ptToPx(PDF_CONFIG.fonts.year.size), fontFamily: `${PDF_CONFIG.fontFamily}, sans-serif` }}>
                    {job.year}
                  </div>
                </div>
                {job.bullets && job.bullets.length > 0 && (
                  <ul style={{ marginLeft: mmToPx(PDF_CONFIG.spacing.bulletIndent), listStyleType: 'none' }}>
                    {job.bullets.map((bullet, bulletIndex) => (
                      <li key={bulletIndex} style={listItemStyle}>
                        <span style={{ marginRight: '4px' }}>•</span>
                        <span>{typeof bullet === 'string' ? bullet : (bullet as any).description || JSON.stringify(bullet)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        );

      case 'education':
        if (!resumeData.education || resumeData.education.length === 0) return null;
        return (
          <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter) }}>
            <h2 style={sectionTitleStyle}>EDUCATION</h2>
            <div style={sectionUnderlineStyle}></div>
            {resumeData.education.map((edu, index) => (
              <div key={index} style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 2) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: ptToPx(PDF_CONFIG.fonts.jobTitle.size), fontWeight: 'bold', fontFamily: `${PDF_CONFIG.fontFamily}, sans-serif` }}>
                      {edu.degree}
                    </div>
                    <div style={{ fontSize: ptToPx(PDF_CONFIG.fonts.company.size), fontWeight: 'bold', fontFamily: `${PDF_CONFIG.fontFamily}, sans-serif` }}>
                      {edu.school}{edu.location ? `, ${edu.location}` : ''}
                    </div>
                    {edu.cgpa && (
                      <div style={{ fontSize: ptToPx(PDF_CONFIG.fonts.body.size), fontFamily: `${PDF_CONFIG.fontFamily}, sans-serif`, color: '#4B5563' }}>
                        CGPA: {edu.cgpa}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: ptToPx(PDF_CONFIG.fonts.year.size), fontFamily: `${PDF_CONFIG.fontFamily}, sans-serif` }}>
                    {edu.year}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case 'projects':
        if (!resumeData.projects || resumeData.projects.length === 0) return null;
        return (
          <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter) }}>
            <h2 style={sectionTitleStyle}>
              {userType === 'fresher' || userType === 'student' ? 'ACADEMIC PROJECTS' : 'PROJECTS'}
            </h2>
            <div style={sectionUnderlineStyle}></div>
            {resumeData.projects.map((project, index) => (
              <div key={index} style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 2) }}>
                <div style={{ fontSize: ptToPx(PDF_CONFIG.fonts.jobTitle.size), fontWeight: 'bold', fontFamily: `${PDF_CONFIG.fontFamily}, sans-serif`, marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 0.5) }}>
                  {project.title}
                </div>
                {project.bullets && project.bullets.length > 0 && (
                  <ul style={{ marginLeft: mmToPx(PDF_CONFIG.spacing.bulletIndent), listStyleType: 'none' }}>
                    {project.bullets.map((bullet, bulletIndex) => (
                      <li key={bulletIndex} style={listItemStyle}>
                        <span style={{ marginRight: '4px' }}>•</span>
                      <span>{typeof bullet === 'string' ? bullet : (bullet as any).description || JSON.stringify(bullet)}</span>


                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        );

      case 'skills':
        if (!resumeData.skills || resumeData.skills.length === 0) return null;
        return (
          <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter) }}>
            <h2 style={sectionTitleStyle}>TECHNICAL SKILLS</h2>
            <div style={sectionUnderlineStyle}></div>
            {resumeData.skills.map((skill, index) => (
              <div key={index} style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 0.5) }}>
                <span style={{ fontSize: ptToPx(PDF_CONFIG.fonts.body.size), fontFamily: `${PDF_CONFIG.fontFamily}, sans-serif` }}>
                  <strong style={{ fontWeight: 'bold' }}>{skill.category}:</strong>{' '}
                  {skill.list && skill.list.join(', ')}
                </span>
              </div>
            ))}
          </div>
        );

      case 'certifications':
        if (!resumeData.certifications || resumeData.certifications.length === 0) return null;
        return (
          <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter) }}>
            <h2 style={sectionTitleStyle}>CERTIFICATIONS</h2>
            <div style={sectionUnderlineStyle}></div>
            <ul style={{ marginLeft: mmToPx(PDF_CONFIG.spacing.bulletIndent), listStyleType: 'none' }}>
              {resumeData.certifications.map((cert, index) => {
                // --- FIX: Add a check for null or undefined cert objects ---
                if (!cert) {
                  return null; // Skip rendering if the cert item is null/undefined
                }
                // --- END FIX ---
                
                let certText = '';
                if (typeof cert === 'string') {
                  certText = cert;
                } else if (cert && typeof cert === 'object') {
                  if ('title' in cert && 'issuer' in cert) certText = `${String(cert.title)} - ${String(cert.issuer)}`;
                  else if ('title' in cert && 'description' in cert) certText = `${String(cert.title)} - ${String(cert.description)}`;
                  else if ('name' in cert) certText = String(cert.name);
                  else if ('title' in cert) certText = String(cert.title);
                  else if ('description' in cert) certText = (cert as any).description;
                  else certText = Object.values(cert).filter(Boolean).join(' - ');
                } else {
                  certText = String(cert);
                }
                return (
                  <li key={index} style={listItemStyle}>
                    <span style={{ marginRight: '4px' }}>•</span>
                    <span>{certText}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        );

      // --- DYNAMIC ADDITIONAL SECTIONS LOGIC ---
      case 'additionalSections':
        // FIXED: Comprehensive check to ensure additionalSections is a valid array
        if (!resumeData.additionalSections || !Array.isArray(resumeData.additionalSections) || resumeData.additionalSections.length === 0) {
          console.log('ResumePreview: Skipping additionalSections - not a valid array');
          return null;
        }
        return (
          <>
            {resumeData.additionalSections.map((section, index) => {
              if (!section || !section.title || !section.bullets || !Array.isArray(section.bullets)) {
                console.log(`ResumePreview: Skipping section ${index} - invalid structure`);
                return null;
              }
              return (
                <div key={index} style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter) }}>
                  <h2 style={sectionTitleStyle}>
                    {section.title.toUpperCase()}
                  </h2>
                  <div style={sectionUnderlineStyle}></div>
                  {section.bullets.length > 0 && (
                    <ul style={{ marginLeft: mmToPx(PDF_CONFIG.spacing.bulletIndent), listStyleType: 'none', marginTop: mmToPx(PDF_CONFIG.spacing.entrySpacing) }}>
                      {section.bullets.map((bullet, bulletIndex) => (
                        <li key={bulletIndex} style={listItemStyle}>
                          <span style={{ marginRight: '4px' }}>•</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </>
        );

      case 'achievementsAndExtras':
        const hasAchievements = resumeData.achievements && resumeData.achievements.length > 0;
        const hasLanguages = resumeData.languagesKnown && resumeData.languagesKnown.length > 0;
        const hasPersonalDetails = typeof resumeData.personalDetails === 'string' && resumeData.personalDetails.trim() !== '';

        if (!hasAchievements && !hasLanguages && !hasPersonalDetails) return null;

        return (
          <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter) }}>
            <h2 style={sectionTitleStyle}>ACHIEVEMENTS</h2>
            <div style={sectionUnderlineStyle}></div>
            {hasAchievements && (
              <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing) }}>
                <p style={{ ...bodyTextStyle, fontWeight: 'bold', marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 0.5) }}>Achievements:</p>
                <ul style={{ marginLeft: mmToPx(PDF_CONFIG.spacing.bulletIndent), listStyleType: 'none' }}>
                  {resumeData.achievements!.map((item, index) => (
                    <li key={index} style={listItemStyle}>
                      <span style={{ marginRight: '4px' }}>•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {hasLanguages && (
              <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing) }}>
                <p style={{ ...bodyTextStyle, fontWeight: 'bold', marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 0.5) }}>Languages Known:</p>
                <ul style={{ marginLeft: mmToPx(PDF_CONFIG.spacing.bulletIndent), listStyleType: 'none' }}>
                  {resumeData.languagesKnown!.map((item, index) => (
                    <li key={index} style={listItemStyle}>
                      <span style={{ marginRight: '4px' }}>•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {hasPersonalDetails && (
              <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing) }}>
                <p style={{ ...bodyTextStyle, fontWeight: 'bold', marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 0.5) }}>Personal Details:</p>
                <p style={{ ...bodyTextStyle, marginLeft: mmToPx(PDF_CONFIG.spacing.bulletIndent) }}>{resumeData.personalDetails}</p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`card dark:bg-dark-100 dark:border-dark-300 resume-one-column ${currentExportOptions.layoutType === 'compact' ? 'resume-compact' : 'resume-standard'
      } ${currentExportOptions.paperSize === 'letter' ? 'resume-letter' : 'resume-a4'
      }`}>
      <div className="max-h-[70vh] sm:max-h-[80vh] lg:max-h-[800px] overflow-y-auto">
        <div
          style={{
            fontFamily: `${PDF_CONFIG.fontFamily}, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`,
            fontSize: ptToPx(PDF_CONFIG.fonts.body.size),
            lineHeight: PDF_CONFIG.spacing.lineHeight,
            color: 'inherit',
            paddingTop: mmToPx(PDF_CONFIG.margins.top),
            paddingBottom: mmToPx(PDF_CONFIG.margins.bottom),
            paddingLeft: mmToPx(PDF_CONFIG.margins.left),
            paddingRight: mmToPx(PDF_CONFIG.margins.right),
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: mmToPx(PDF_CONFIG.spacing.afterContact) }}>
            <h1 style={{
              fontSize: ptToPx(PDF_CONFIG.fonts.name.size),
              fontWeight: 'bold',
              letterSpacing: '1pt',
              marginBottom: mmToPx(PDF_CONFIG.spacing.afterName),
              fontFamily: `${PDF_CONFIG.fontFamily}, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`,
              textTransform: 'uppercase'
            }}>
              {resumeData.name}
            </h1>

            {contactElements.length > 0 && (
              <div style={{
                fontSize: ptToPx(PDF_CONFIG.fonts.contact.size),
                fontWeight: 'bold',
                fontFamily: `${PDF_CONFIG.fontFamily}, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`,
                marginBottom: mmToPx(PDF_CONFIG.spacing.afterContact),
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                {contactElements}
              </div>
            )}

            <div style={{
              borderBottomWidth: '0.5pt',
              borderColor: '#808080',
              height: '1px',
              margin: '0 auto',
              width: `${mmToPx(PDF_CONFIG.contentWidth)}px`,
            }}></div>
          </div>

          {/* Dynamic sections */}
          {(Array.isArray(sectionOrder) ? sectionOrder : []).map((sectionName) => renderSection(sectionName))}
        </div>
      </div>
    </div>
  );
};
