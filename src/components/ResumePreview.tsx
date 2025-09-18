// src/components/ResumePreview.tsx
import React from 'react';
import { ResumeData, UserType } from '../types/resume';
import { ExportOptions, layoutConfigs, paperSizeConfigs, defaultExportOptions } from '../types/export';

// ---------- Helper Functions (replicated from exportUtils.ts for consistency) ----------
const mmToPx = (mm: number) => mm * 3.779528; // 1mm = 3.779528px at 96 DPI
const ptToPx = (pt: number) => pt * 1.333; // 1pt = 1.333px at 96 DPI

// Replicate PDF_CONFIG creation logic from exportUtils.ts
const createPDFConfigForPreview = (options: ExportOptions) => {
  const layoutConfig = options.layoutType === 'compact' ?
    { margins: { top: 10, bottom: 10, left: 15, right: 15 } } :
    { margins: { top: 15, bottom: 15, left: 20, right: 20 } };

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
      bulletIndent: 4, // This is the key value for bullet indentation
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
          <div className="text-gray-500 mb-4">Invalid resume data</div>
          <div className="text-sm text-gray-400">Resume name is missing or empty</div>
        </div>
      </div>
    );
  }

  // --- Style constants ---
  const sectionTitleStyle: React.CSSProperties = {
    fontSize: ptToPx(PDF_CONFIG.fonts.sectionTitle.size),
    fontWeight: 'bold',
    marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter), // Use sectionSpacingAfter for consistency
    marginTop: mmToPx(PDF_CONFIG.spacing.sectionSpacingBefore), // Use sectionSpacingBefore for consistency
    fontFamily: `${PDF_CONFIG.fontFamily}, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`,
    letterSpacing: '0.5pt',
    textTransform: 'uppercase', // Always uppercase for section titles
  } as const;

  const sectionUnderlineStyle: React.CSSProperties = {
    borderBottomWidth: '0.5pt',
    borderColor: '#808080', // Use a specific gray color for consistency
    height: '1px',
    marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter),
    // Dynamically calculate width based on contentWidth
    width: `${mmToPx(PDF_CONFIG.contentWidth)}px`,
    margin: '0 auto', // Center the underline if needed, though it spans full content width
  };

  const bodyTextStyle: React.CSSProperties = {
    fontSize: ptToPx(PDF_CONFIG.fonts.body.size),
    fontFamily: `${PDF_CONFIG.fontFamily}, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`,
    lineHeight: PDF_CONFIG.spacing.lineHeight,
  };

  const listItemStyle: React.CSSProperties = {
    ...bodyTextStyle,
    marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 0.25),
    display: 'flex', // Use flex to align bullet and text
    alignItems: 'flex-start', // Align items to the start for multi-line bullets
  };

  // Build contact information with proper separators
  const buildContactInfo = () => {
    console.log('[ResumePreview] buildContactInfo - resumeData:', resumeData);
    console.log('[ResumePreview] Individual contact fields:');
    console.log('  - phone:', resumeData.phone);
    console.log('  - email:', resumeData.email);
    console.log('  - location:', resumeData.location);
    console.log('  - linkedin:', resumeData.linkedin);
    console.log('  - github:', resumeData.github);
    
    const parts: React.ReactNode[] = [];

    // Helper function to validate fields (matching exportUtils.ts logic)
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

    // Add contact fields in the same order as PDF export
    if (isValidField(resumeData.phone, 'phone')) {
      parts.push(
        <span key="phone" style={{ fontSize: ptToPx(PDF_CONFIG.fonts.contact.size) }}>
          {resumeData.phone}
        </span>
      );
      console.log('[ResumePreview] Added phone:', resumeData.phone);
    }

    if (isValidField(resumeData.email, 'email')) {
      parts.push(
        <span key="email" style={{ fontSize: ptToPx(PDF_CONFIG.fonts.contact.size) }}>
          {resumeData.email}
        </span>
      );
      console.log('[ResumePreview] Added email:', resumeData.email);
    }

    if (isValidField(resumeData.location, 'text')) {
      parts.push(
        <span key="location" style={{ fontSize: ptToPx(PDF_CONFIG.fonts.contact.size) }}>
          {resumeData.location}
        </span>
      );
      console.log('[ResumePreview] Added location:', resumeData.location);
    }

    if (isValidField(resumeData.linkedin, 'url')) {
      let processedLinkedin = resumeData.linkedin;
      if (!processedLinkedin.startsWith('http')) {
        processedLinkedin = `https://${processedLinkedin}`;
      }
      parts.push(
        <span key="linkedin" style={{ fontSize: ptToPx(PDF_CONFIG.fonts.contact.size) }}>
          {processedLinkedin}
        </span>
      );
      console.log('[ResumePreview] Added linkedin:', processedLinkedin);
    }

    if (isValidField(resumeData.github, 'url')) {
      let processedGithub = resumeData.github;
      if (!processedGithub.startsWith('http')) {
        processedGithub = `https://${processedGithub}`;
      }
      parts.push(
        <span key="github" style={{ fontSize: ptToPx(PDF_CONFIG.fonts.contact.size) }}>
          {processedGithub}
        </span>
      );
      console.log('[ResumePreview] Added github:', processedGithub);
    }

    console.log('[ResumePreview] Total contact parts:', parts.length);
    
    // Join with | separator
    return parts.map((part, index) => (
      <React.Fragment key={index}>
        {part}
        {index < parts.length - 1 && <span className="mx-1" style={{ fontSize: ptToPx(PDF_CONFIG.fonts.contact.size) }}>|</span>}
      </React.Fragment>
    ));
  };

  const contactElements = buildContactInfo();

  // Define section order based on user type
  const getSectionOrder = () => {
    // Fallback to user type based ordering
    if (userType === 'experienced') {
      return ['summary', 'workExperience', 'skills', 'projects', 'certifications', 'education'];
    } else if (userType === 'student') {
      return ['summary', 'education', 'skills', 'projects', 'workExperience', 'certifications', 'achievementsAndExtras'];
    } else { // 'fresher'
      return ['summary', 'education', 'workExperience', 'projects', 'skills', 'certifications', 'achievementsAndExtras'];
    }
  };

  const sectionOrder = getSectionOrder();

  const renderSection = (sectionName: string) => {
    switch (sectionName) {
      case 'summary':
        // Conditional logic for 'Professional Summary' or 'Career Objective' based on userType
        if (userType === 'student' || userType === 'fresher') {
          if (!resumeData.careerObjective || resumeData.careerObjective.trim() === '') return null;
          return (
            <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter) }}>
              <h2 style={sectionTitleStyle}>
                CAREER OBJECTIVE
              </h2>
              {/* No underline for Career Objective as per PDF export */}
              <p style={{ ...bodyTextStyle, marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing) }}>
                {resumeData.careerObjective}
              </p>
            </div>
          );
        } else { // This will now only be for 'experienced'
          if (!resumeData.summary || resumeData.summary.trim() === '') return null;
          return (
            <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter) }}>
              <h2 style={sectionTitleStyle}>
                PROFESSIONAL SUMMARY
              </h2>
              {/* Underline only for Professional Summary */}
              <div style={sectionUnderlineStyle}></div>
              <p style={{ ...bodyTextStyle, marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing) }}>
                {resumeData.summary}
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
              <div key={index} style={{ 
                marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 2),
                // Removed isCompactLayout styling
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 0.5) }}>
                  <div>
                    <div style={{
                      fontSize: ptToPx(PDF_CONFIG.fonts.jobTitle.size),
                      fontWeight: 'bold',
                      fontFamily: `${PDF_CONFIG.fontFamily}, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`
                    }}>
                      {job.role}
                    </div>
                    <div style={{
                      fontSize: ptToPx(PDF_CONFIG.fonts.jobTitle.size),
                      fontWeight: 'bold',
                      fontFamily: `${PDF_CONFIG.fontFamily}, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`
                    }}>
                      {job.company}{job.location ? `, ${job.location}` : ''}
                    </div>
                  </div>
                  <div style={{
                    fontSize: ptToPx(PDF_CONFIG.fonts.jobTitle.size),
                    fontFamily: `${PDF_CONFIG.fontFamily}, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`
                  }}>
                    {job.year}
                  </div>
                </div>
                {job.bullets && job.bullets.length > 0 && (
                  <ul style={{ marginLeft: mmToPx(PDF_CONFIG.spacing.bulletIndent), listStyleType: 'none' }}>
                    {job.bullets.map((bullet, bulletIndex) => (
                      <li key={bulletIndex} style={listItemStyle}>
                        <span style={{ marginRight: '4px' }}>•</span> {/* Bullet character */}
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
        
        // Removed isEducationPriority styling
        
        return (
          <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter) }}>
            <h2 style={sectionTitleStyle}>
              EDUCATION
            </h2>
            <div style={sectionUnderlineStyle}></div>

            {resumeData.education.map((edu, index) => (
              <div key={index} style={{ 
                marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 2),
                // Removed isEducationPriority styling
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{
                      fontSize: ptToPx(PDF_CONFIG.fonts.jobTitle.size),
                      fontWeight: 'bold',
                      fontFamily: `${PDF_CONFIG.fontFamily}, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`
                    }}>
                      {edu.degree}
                    </div>
                    <div style={{
                      fontSize: ptToPx(PDF_CONFIG.fonts.jobTitle.size),
                      fontWeight: 'bold',
                      fontFamily: `${PDF_CONFIG.fontFamily}, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`
                    }}>
                      {edu.school}{edu.location ? `, ${edu.location}` : ''}
                    </div>
                    {edu.cgpa && (
                      <div style={{
                        fontSize: ptToPx(PDF_CONFIG.fonts.body.size),
                        fontFamily: `${PDF_CONFIG.fontFamily}, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`,
                        color: '#4B5563'
                      }}>
                        CGPA: {edu.cgpa}
                      </div>
                    )}
                    {/* Removed relevantCoursework rendering as it's not in PDF export */}
                  </div>
                  <div style={{
                    fontSize: ptToPx(PDF_CONFIG.fonts.jobTitle.size),
                    fontFamily: `${PDF_CONFIG.fontFamily}, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`
                  }}>
                    {edu.year}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case 'projects':
        if (!resumeData.projects || resumeData.projects.length === 0) return null;
        
        // Removed isProjectsFocused styling
        
        return (
          <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter) }}>
            <h2 style={sectionTitleStyle}>
              {userType === 'fresher' || userType === 'student' ? 'ACADEMIC PROJECTS' : 'PROJECTS'}
            </h2>
            <div style={sectionUnderlineStyle}></div>

            {resumeData.projects.map((project, index) => (
              <div key={index} style={{ 
                marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 2),
                // Removed isProjectsFocused styling
              }}>
                <div style={{
                  fontSize: ptToPx(PDF_CONFIG.fonts.jobTitle.size),
                  fontWeight: 'bold',
                  fontFamily: `${PDF_CONFIG.fontFamily}, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`,
                  marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 0.5)
                }}>
                  {project.title}
                </div>
                {project.bullets && project.bullets.length > 0 && (
                  <ul style={{ marginLeft: mmToPx(PDF_CONFIG.spacing.bulletIndent), listStyleType: 'none' }}>
                    {project.bullets.map((bullet, bulletIndex) => (
                      <li key={bulletIndex} style={listItemStyle}>
                        <span style={{ marginRight: '4px' }}>•</span> {/* Bullet character */}
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
        
        // Removed isSkillsFocused conditional rendering
        
        return (
          <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter) }}>
            <h2 style={sectionTitleStyle}>
              TECHNICAL SKILLS
            </h2>
            <div style={sectionUnderlineStyle}></div>

            {/* Standard skills display (linear) */}
            {resumeData.skills.map((skill, index) => (
              <div key={index} style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 0.5) }}>
                <span style={{
                  fontSize: ptToPx(PDF_CONFIG.fonts.body.size),
                  fontFamily: `${PDF_CONFIG.fontFamily}, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`
                }}>
                  <strong style={{ fontWeight: 'bold' }}>{skill.category}:</strong>{' '}
                  {skill.list && skill.list.join(', ')}
                </span>
              </div>
            ))}
          </div>
        );

      case 'certifications':
        if (!resumeData.certifications || resumeData.certifications.length === 0) return null;
        
        // Removed isSidebarTemplate styling
        
        return (
          <div style={{ 
            marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter),
            // Removed isSidebarTemplate styling
          }}>
            <h2 style={sectionTitleStyle}>
              CERTIFICATIONS
            </h2>
            {/* Underline always present for certifications */}
            <div style={sectionUnderlineStyle}></div>

            <ul style={{ marginLeft: mmToPx(PDF_CONFIG.spacing.bulletIndent), listStyleType: 'none' }}>
              {resumeData.certifications.map((cert, index) => {
                let certText = '';
                if (typeof cert === 'string') {
                  certText = cert;
                } else if (cert && typeof cert === 'object') {
                  if ('title' in cert && 'issuer' in cert) {
                    certText = `${String(cert.title)} - ${String(cert.issuer)}`;
                  } else if ('title' in cert && 'description' in cert) {
                    certText = `${String(cert.title)} - ${String(cert.description)}`;
                  } else if ('name' in cert) {
                    certText = String(cert.name);
                  } else if ('title' in cert) {
                    certText = String(cert.title);
                  } else if ('description' in cert) {
                    certText = (cert as any).description;
                  } else {
                    certText = Object.values(cert).filter(Boolean).join(' - ');
                  }
                } else {
                  certText = String(cert);
                }

                return (
                  <li key={index} style={listItemStyle}>
                    <span style={{ marginRight: '4px' }}>•</span> {/* Bullet character */}
                    <span>{certText}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        );

      case 'achievementsAndExtras': // Combined section for freshers and students
        const hasAchievements = resumeData.achievements && resumeData.achievements.length > 0;
        // Removed hasExtraCurricular check
        const hasLanguages = resumeData.languagesKnown && resumeData.languagesKnown.length > 0;
        const hasPersonalDetails = typeof resumeData.personalDetails === 'string' && resumeData.personalDetails.trim() !== '';

        if (!hasAchievements && !hasLanguages && !hasPersonalDetails) return null;

        return (
          <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter) }}>
            <h2 style={sectionTitleStyle}>
              ACHIEVEMENTS
            </h2>
            <div style={sectionUnderlineStyle}></div>

            {hasAchievements && (
              <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing) }}>
                <p style={{ ...bodyTextStyle, fontWeight: 'bold', marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 0.5) }}>Achievements:</p>
                <ul style={{ marginLeft: mmToPx(PDF_CONFIG.spacing.bulletIndent), listStyleType: 'none' }}>
                  {resumeData.achievements!.map((item, index) => (
                    <li key={index} style={listItemStyle}>
                      <span style={{ marginRight: '4px' }}>•</span> {/* Bullet character */}
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Removed Extra-curricular Activities rendering */}
            {hasLanguages && (
              <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing) }}>
                <p style={{ ...bodyTextStyle, fontWeight: 'bold', marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 0.5) }}>Languages Known:</p>
                <ul style={{ marginLeft: mmToPx(PDF_CONFIG.spacing.bulletIndent), listStyleType: 'none' }}>
                  {resumeData.languagesKnown!.map((item, index) => (
                    <li key={index} style={listItemStyle}>
                      <span style={{ marginRight: '4px' }}>•</span> {/* Bullet character */}
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
    <div className={`card dark:bg-dark-100 dark:border-dark-300 resume-one-column ${
      currentExportOptions.layoutType === 'compact' ? 'resume-compact' : 'resume-standard'
    } ${
      currentExportOptions.paperSize === 'letter' ? 'resume-letter' : 'resume-a4'
    }`}>
      {/* New wrapper div for scrolling */}
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
          <div style={{ textAlign: 'center', marginBottom: mmToPx(PDF_CONFIG.spacing.afterContact) }}> {/* Adjusted margin-bottom */}
            <h1 style={{
              fontSize: ptToPx(PDF_CONFIG.fonts.name.size),
              fontWeight: 'bold',
              letterSpacing: '1pt',
              marginBottom: mmToPx(PDF_CONFIG.spacing.afterName), // Use afterName spacing
              fontFamily: `${PDF_CONFIG.fontFamily}, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`,
              textTransform: 'uppercase'
            }}>
              {resumeData.name}
            </h1>

            {contactElements.length > 0 && (
              <div style={{
                fontSize: ptToPx(PDF_CONFIG.fonts.contact.size),
                fontWeight: 'bold', // Contact info is bold in PDF
                fontFamily: `${PDF_CONFIG.fontFamily}, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`,
                marginBottom: mmToPx(PDF_CONFIG.spacing.afterContact), // Use afterContact spacing
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
              borderColor: '#808080', // Consistent gray color
              height: '1px',
              margin: '0 auto',
              width: `${mmToPx(PDF_CONFIG.contentWidth)}px`, // Dynamic width
            }}></div>
          </div>

          {/* Dynamic sections */}
          {(Array.isArray(sectionOrder) ? sectionOrder : []).map((sectionName) => renderSection(sectionName))}
        </div>
      </div>
    </div>
  );
};

