// src/components/ResumePreview.tsx

import React, { useRef, useEffect, useState } from 'react'; // Import useRef, useEffect, useState
import { ResumeData, UserType } from '../types/resume';

// --- FIX: Define necessary types and defaults locally to resolve import error ---
interface ExportOptions {
  layoutType: 'standard' | 'compact';
  paperSize: 'a4' | 'letter';
  fontFamily: 'Helvetica' | 'Times' | 'Courier' | 'Roboto' | 'Calibri'; // Added Calibri
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
  fontFamily: 'Calibri', // Changed default font
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
    { margins: { top: 12, bottom: 12, left: 12, right: 12 } } : // Adjusted for compact
    { margins: { top: 17.78, bottom: 17.78, left: 17.78, right: 17.78 } }; // Adjusted for standard

  const paperConfig = options.paperSize === 'letter' ?
    { pageWidth: 216, pageHeight: 279 } :
    { pageWidth: 210, pageHeight: 297 }; // Changed from 300 to 297

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
      contact: { size: options.bodyTextSize - 0.5, weight: 'normal' as const },
      sectionTitle: { size: options.sectionHeaderSize, weight: 'bold' as const },
      jobTitle: { size: options.subHeaderSize, weight: 'bold' as const },
      company: { size: options.subHeaderSize, weight: 'normal' as const }, // Changed to normal
      year: { size: options.subHeaderSize, weight: 'normal' as const }, // Changed to normal
      body: { size: options.bodyTextSize, weight: 'normal' as const },
    },
    spacing: {
      nameFromTop: 10, // Changed from 13 to 10
      afterName: 0,
      afterContact: 2, // Changed from 1 to 2
      sectionSpacingBefore: options.sectionSpacing,
      sectionSpacingAfter: 2,
      bulletListSpacing: 0.5, // Changed from options.entrySpacing * 0.3 to 0.5
      afterSubsection: 3,
      lineHeight: 1.2,
      bulletIndent: 5, // Changed from 4 to 5
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

  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const [scaleFactor, setScaleFactor] = useState(1);

  useEffect(() => {
    const calculateScale = () => {
      if (contentWrapperRef.current) {
        const availableWidth = contentWrapperRef.current.offsetWidth; // Width of the scrollable container
        const resumeNaturalWidthPx = mmToPx(PDF_CONFIG.pageWidth); // The target width of the resume page

        if (resumeNaturalWidthPx > availableWidth) {
          setScaleFactor(availableWidth / resumeNaturalWidthPx);
        } else {
          setScaleFactor(1); // No scaling needed if content fits
        }
      }
    };

    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, [PDF_CONFIG.pageWidth]); // Recalculate if page width changes (e.g., A4 to Letter)


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
    marginTop: mmToPx(PDF_CONFIG.spacing.sectionSpacingBefore), // Adjusted
    marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter), // Adjusted
    fontFamily: `${PDF_CONFIG.fontFamily}, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`,
    letterSpacing: '0.5pt',
    textTransform: 'uppercase',
  } as const;

  const sectionUnderlineStyle: React.CSSProperties = {
    borderBottomWidth: '0.5pt',
    borderColor: '#404040', // Changed to darker gray
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
      return ['summary', 'workExperience', 'projects', 'skills', 'certifications', 'education'];
    } else if (userType === 'student') {
      return ['careerObjective', 'education', 'skills', 'projects', 'workExperience', 'certifications', 'achievementsAndExtras'];
    } else { // 'fresher'
      return ['careerObjective', 'education', 'skills', 'projects', 'workExperience', 'certifications', 'achievementsAndExtras'];
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
              <div style={sectionUnderlineStyle}></div>
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
              {userType === 'fresher' ? 'WORK EXPERIENCE' : 'EXPERIENCE'}
            </h2>
            <div style={sectionUnderlineStyle}></div>
            {resumeData.workExperience.map((job, index) => (
              <div key={index} style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 2) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 0.5) }}>
                  <div>
                    <div style={{ fontSize: ptToPx(PDF_CONFIG.fonts.jobTitle.size), fontWeight: 'bold', fontFamily: `${PDF_CONFIG.fontFamily}, sans-serif` }}>
                      {job.role} | {job.company}{job.location ? `, ${job.location}` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: ptToPx(PDF_CONFIG.fonts.year.size), fontFamily: `${PDF_CONFIG.fontFamily}, sans-serif`, fontWeight: 'normal' }}> {/* Changed to normal */}
                    {job.year}
                  </div>
                </div>
                {job.bullets && job.bullets.length > 0 && (
                  <ul style={{ marginLeft: mmToPx(PDF_CONFIG.spacing.bulletIndent), listStyleType: 'disc' }}> {/* Changed to disc */}
                    {job.bullets.map((bullet, bulletIndex) => (
                      <li key={bulletIndex} style={listItemStyle}>
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
                    <div style={{ fontSize: ptToPx(PDF_CONFIG.fonts.company.size), fontWeight: 'normal', fontFamily: `${PDF_CONFIG.fontFamily}, sans-serif` }}> {/* Changed to normal */}
                      {edu.school}{edu.location ? `, ${edu.location}` : ''}
                    </div>
                    {edu.cgpa && (
                      <div style={{ fontSize: ptToPx(PDF_CONFIG.fonts.body.size), fontFamily: `${PDF_CONFIG.fontFamily}, sans-serif`, color: '#4B5563' }}>
                        CGPA: {edu.cgpa}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: ptToPx(PDF_CONFIG.fonts.year.size), fontFamily: `${PDF_CONFIG.fontFamily}, sans-serif`, fontWeight: 'bold' }}> {/* Changed to bold */}
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
              PROJECTS
            </h2>
            <div style={sectionUnderlineStyle}></div>
            {resumeData.projects.map((project, index) => (
              <div key={index} style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 2) }}>
                <div style={{ fontSize: ptToPx(PDF_CONFIG.fonts.jobTitle.size), fontWeight: 'bold', fontFamily: `${PDF_CONFIG.fontFamily}, sans-serif`, marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 0.5) }}> {/* Already bold */}
                  {project.title}
                </div>
                {project.bullets && project.bullets.length > 0 && (
                  <ul style={{ marginLeft: mmToPx(PDF_CONFIG.spacing.bulletIndent), listStyleType: 'disc' }}> {/* Changed to disc */}
                    {project.bullets.map((bullet, bulletIndex) => (
                      <li key={bulletIndex} style={listItemStyle}>
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
            <h2 style={sectionTitleStyle}>SKILLS</h2>
            <div style={sectionUnderlineStyle}></div>
            {resumeData.skills.map((skillCategory, index) => (
              <div key={index} style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 0.5) }}>
                <span style={{ fontSize: ptToPx(PDF_CONFIG.fonts.body.size), fontFamily: `${PDF_CONFIG.fontFamily}, sans-serif` }}>
                  <strong style={{ fontWeight: 'bold' }}>{skillCategory.category}:</strong>{' '} {/* Already bold */}
                  {skillCategory.list && skillCategory.list.join(', ')}
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
            <ul style={{ marginLeft: mmToPx(PDF_CONFIG.spacing.bulletIndent), listStyleType: 'disc' }}> {/* Changed to disc */}
              {resumeData.certifications.map((cert, index) => {
                if (!cert) {
                  return null;
                }
                
                let certText = '';
                if (typeof cert === 'string') {
                  certText = cert;
                } else if (cert && typeof cert === 'object' && 'title' in cert) {
                  certText = <><b style={{fontWeight: 'bold'}}>{cert.title}</b>{'description' in cert && cert.description ? `: ${cert.description}` : ''}</> as any; // Bold title
                } else {
                  certText = String(cert);
                }
                return (
                  <li key={index} style={listItemStyle}>
                    <span>{certText}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        );

      case 'achievementsAndExtras':
        const hasAchievements = resumeData.achievements && resumeData.achievements.length > 0;

        if (!hasAchievements) return null;

        return (
          <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter) }}>
            <h2 style={sectionTitleStyle}>ACHIEVEMENTS</h2>
            <div style={sectionUnderlineStyle}></div>
            {hasAchievements && (
              <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing) }}>
                <ul style={{ marginLeft: mmToPx(PDF_CONFIG.spacing.bulletIndent), listStyleType: 'disc' }}> {/* Changed to disc */}
                  {resumeData.achievements!.map((item, index) => (
                    <li key={index} style={listItemStyle}>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
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
      <div
        ref={contentWrapperRef} // Attach ref to the scrollable container
        className="max-h-[70vh] sm:max-h-[80vh] lg:max-h-[800px] overflow-y-auto overflow-x-hidden" // Add overflow-x-hidden
      >
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
            width: mmToPx(PDF_CONFIG.pageWidth), // Explicitly set the natural width of the page
            transform: `scale(${scaleFactor})`,
            transformOrigin: 'top left', // Scale from top-left corner
            boxSizing: 'border-box', // Ensure padding is included in the width calculation
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
                justifyContent: 'center', // Centered
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                {contactElements}
              </div>
            )}

            <div style={{
              borderBottomWidth: '0.5pt',
              borderColor: '#404040', // Changed to darker gray
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

