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

// ---------- Helper Functions ----------
const mmToPx = (mm: number) => mm * 3.779528;
const ptToPx = (pt: number) => pt * 1.333;

const createPDFConfigForPreview = (options: ExportOptions) => {
  const layoutConfig =
    options.layoutType === 'compact'
      ? { margins: { top: 10, bottom: 10, left: 15, right: 15 } }
      : { margins: { top: 15, bottom: 15, left: 20, right: 20 } };

  const paperConfig =
    options.paperSize === 'letter'
      ? { pageWidth: 216, pageHeight: 279 }
      : { pageWidth: 210, pageHeight: 297 };

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
  exportOptions,
}) => {
  const currentExportOptions = exportOptions || defaultExportOptions;
  const PDF_CONFIG = createPDFConfigForPreview(currentExportOptions);

  if (!resumeData) {
    return (
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="p-8 text-center">
          <div className="text-gray-500 mb-4">No resume data available</div>
          <div className="text-sm text-gray-400">
            Please ensure your resume has been properly optimized
          </div>
        </div>
      </div>
    );
  }

  if (!resumeData.name || resumeData.name.trim() === '') {
    return (
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="p-8 text-center">
          <div className="text-gray-500 mb-4">Start building your resume!</div>
          <div className="text-sm text-gray-400">
            Fill in your details on the left to generate a live preview here
          </div>
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
  };

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

  const buildContactInfo = () => {
    const parts: React.ReactNode[] = [];
    const isValidField = (
      field?: string | null,
      fieldType: 'phone' | 'email' | 'url' | 'text' = 'text'
    ): boolean => {
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
          return (
            /^https?:\/\//.test(field) ||
            /^(www\.)?linkedin\.com\/in\//.test(field) ||
            /^(www\.)?github\.com\//.test(field) ||
            /linkedin\.com\/in\//.test(field) ||
            /github\.com\//.test(field)
          );
        case 'text':
        default:
          return true;
      }
    };

    if (isValidField(resumeData.phone, 'phone')) {
      parts.push(<span key="phone">{resumeData.phone}</span>);
    }
    if (isValidField(resumeData.email, 'email')) {
      parts.push(<span key="email">{resumeData.email}</span>);
    }
    if (isValidField(resumeData.location, 'text')) {
      parts.push(<span key="location">{resumeData.location}</span>);
    }
    if (isValidField(resumeData.linkedin, 'url')) {
      let processed = resumeData.linkedin!;
      if (!processed.startsWith('http')) processed = `https://${processed}`;
      parts.push(<span key="linkedin">{processed}</span>);
    }
    if (isValidField(resumeData.github, 'url')) {
      let processed = resumeData.github!;
      if (!processed.startsWith('http')) processed = `https://${processed}`;
      parts.push(<span key="github">{processed}</span>);
    }

    return parts.map((part, i) => (
      <React.Fragment key={i}>
        {part}
        {i < parts.length - 1 && <span className="mx-1">|</span>}
      </React.Fragment>
    ));
  };

  const contactElements = buildContactInfo();

  const getSectionOrder = () => {
    if (userType === 'experienced') {
      return [
        'summary',
        'workExperience',
        'skills',
        'projects',
        'certifications',
        'additionalSections',
        'education',
      ];
    } else if (userType === 'student') {
      return [
        'summary',
        'education',
        'skills',
        'projects',
        'workExperience',
        'certifications',
        'additionalSections',
        'achievementsAndExtras',
      ];
    } else {
      return [
        'summary',
        'education',
        'workExperience',
        'projects',
        'skills',
        'certifications',
        'additionalSections',
        'achievementsAndExtras',
      ];
    }
  };

  const sectionOrder = getSectionOrder();

  const renderSection = (sectionName: string) => {
    switch (sectionName) {
      case 'summary':
        if (userType === 'student' || userType === 'fresher') {
          if (!String(resumeData.careerObjective || '').trim()) return null;
          return (
            <div>
              <h2 style={sectionTitleStyle}>CAREER OBJECTIVE</h2>
              <p style={bodyTextStyle}>{resumeData.careerObjective || ''}</p>
            </div>
          );
        } else {
          if (!String(resumeData.summary || '').trim()) return null;
          return (
            <div>
              <h2 style={sectionTitleStyle}>PROFESSIONAL SUMMARY</h2>
              <div style={sectionUnderlineStyle}></div>
              <p style={bodyTextStyle}>{resumeData.summary || ''}</p>
            </div>
          );
        }

      case 'workExperience':
        if (!resumeData.workExperience?.length) return null;
        return (
          <div>
            <h2 style={sectionTitleStyle}>
              {userType === 'fresher' || userType === 'student'
                ? 'INTERNSHIPS & TRAINING'
                : 'PROFESSIONAL EXPERIENCE'}
            </h2>
            <div style={sectionUnderlineStyle}></div>
            {resumeData.workExperience.map((job, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div>{job.role}</div>
                    <div>
                      {job.company}
                      {job.location ? `, ${job.location}` : ''}
                    </div>
                  </div>
                  <div>{job.year}</div>
                </div>
                {job.bullets?.length ? (
                  <ul>
                    {job.bullets.map((b, j) => (
                      <li key={j} style={listItemStyle}>
                        <span>•</span>
                        <span>
                          {typeof b === 'string'
                            ? b
                            : b && (b as any).description
                            ? (b as any).description
                            : JSON.stringify(b || '')}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        );

      case 'projects':
        if (!resumeData.projects?.length) return null;
        return (
          <div>
            <h2 style={sectionTitleStyle}>
              {userType === 'fresher' || userType === 'student'
                ? 'ACADEMIC PROJECTS'
                : 'PROJECTS'}
            </h2>
            <div style={sectionUnderlineStyle}></div>
            {resumeData.projects.map((proj, i) => (
              <div key={i}>
                <div>{proj.title}</div>
                {proj.bullets?.length ? (
                  <ul>
                    {proj.bullets.map((b, j) => (
                      <li key={j} style={listItemStyle}>
                        <span>•</span>
                        <span>
                          {typeof b === 'string'
                            ? b
                            : b && (b as any).description
                            ? (b as any).description
                            : JSON.stringify(b || '')}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        );

      case 'skills':
        if (!resumeData.skills?.length) return null;
        return (
          <div>
            <h2 style={sectionTitleStyle}>TECHNICAL SKILLS</h2>
            <div style={sectionUnderlineStyle}></div>
            {resumeData.skills.map((s, i) => (
              <div key={i}>
                <strong>{s.category}: </strong>
                {s.list?.join(', ')}
              </div>
            ))}
          </div>
        );

      case 'certifications':
        if (!resumeData.certifications?.length) return null;
        return (
          <div>
            <h2 style={sectionTitleStyle}>CERTIFICATIONS</h2>
            <div style={sectionUnderlineStyle}></div>
            <ul>
              {resumeData.certifications.map((c, i) => {
                let text = '';
                if (typeof c === 'string') text = c;
                else if (c && typeof c === 'object') {
                  if ('title' in c && 'issuer' in c)
                    text = `${c.title} - ${c.issuer}`;
                  else if ('title' in c && 'description' in c)
                    text = `${c.title} - ${c.description}`;
                  else if ('name' in c) text = String(c.name);
                  else if ('title' in c) text = String(c.title);
                  else if ('description' in c)
                    text = String((c as any).description || '');
                  else
                    text = Object.values(c || {})
                      .filter(Boolean)
                      .join(' - ');
                } else text = String(c || '');

                return (
                  <li key={i} style={listItemStyle}>
                    <span>•</span>
                    <span>{text}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="card">
      <div className="max-h-[70vh] overflow-y-auto">
        <div>
          {/* Header */}
          <h1>{resumeData.name}</h1>
          {contactElements}
          <div style={sectionUnderlineStyle}></div>
          {/* Sections */}
          {sectionOrder.map((s) => renderSection(s))}
        </div>
      </div>
    </div>
  );
};
