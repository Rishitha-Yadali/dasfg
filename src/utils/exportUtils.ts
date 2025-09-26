// src/utils/exportUtils.ts
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';
import * as mammoth from 'mammoth';
import { ResumeData, UserType, AdditionalSection } from '../types/resume';
import { ExportOptions, defaultExportOptions, layoutConfigs, paperSizeConfigs } from '../types/export';

// Helper function to convert mm to points (for jsPDF)
const mmToPt = (mm: number) => mm * 2.83465;

// Helper function to convert points to mm (for calculations)
const ptToMm = (pt: number) => pt / 2.83465;

// Helper function to convert mm to pixels (for HTML rendering, if needed)
const mmToPx = (mm: number) => mm * 3.779528; // 1mm = 3.779528px at 96 DPI

// Function to create PDF configuration based on options
const createPDFConfig = (options: ExportOptions) => {
  const layoutConfig = layoutConfigs[options.layoutType];
  const paperConfig = paperSizeConfigs[options.paperSize];

  return {
    pageWidth: paperConfig.width,
    pageHeight: paperConfig.height,
    margins: {
      top: layoutConfig.margins.top,
      bottom: layoutConfig.margins.bottom,
      left: layoutConfig.margins.left,
      right: layoutConfig.margins.right,
    },
    get contentWidth() {
      return this.pageWidth - this.margins.left - this.margins.right;
    },
    get contentHeight() {
      return this.pageHeight - this.margins.top - this.margins.bottom;
    },
    fonts: {
      name: { size: options.nameSize, style: 'bold' as const },
      contact: { size: options.bodyTextSize - 0.5, style: 'normal' as const },
      sectionTitle: { size: options.sectionHeaderSize, style: 'bold' as const },
      jobTitle: { size: options.subHeaderSize, style: 'bold' as const },
      company: { size: options.subHeaderSize, style: 'bold' as const },
      year: { size: options.subHeaderSize, style: 'normal' as const },
      body: { size: options.bodyTextSize, style: 'normal' as const },
    },
    spacing: {
      nameFromTop: 13, // mm
      afterName: 0, // mm
      afterContact: 1, // mm
      sectionSpacingBefore: options.sectionSpacing, // mm
      sectionSpacingAfter: 2, // mm
      bulletListSpacing: options.entrySpacing * 0.3, // mm
      afterSubsection: 3, // mm
      lineHeight: 1.2, // Multiplier
      bulletIndent: 4, // mm
      entrySpacing: options.entrySpacing, // mm
    },
    colors: {
      primary: [0, 0, 0] as [number, number, number], // Black
      secondary: [80, 80, 80] as [number, number, number], // Gray
      accent: [37, 99, 235] as [number, number, number], // Blue
    },
    fontFamily: options.fontFamily,
  };
};

export const exportToPDF = async (
  resumeData: ResumeData,
  userType: UserType,
  options: ExportOptions = defaultExportOptions
) => {
  try {
    const PDF_CONFIG = createPDFConfig(options);
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: PDF_CONFIG.pageWidth === 210 ? 'a4' : 'letter', // Determine format based on width
      compress: true,
    });

    let cursorY = PDF_CONFIG.margins.top;

    const addPageIfNeeded = (heightNeeded: number) => {
      if (cursorY + heightNeeded > PDF_CONFIG.pageHeight - PDF_CONFIG.margins.bottom) {
        doc.addPage();
        cursorY = PDF_CONFIG.margins.top;
      }
    };

    const addSectionTitle = (title: string) => {
      addPageIfNeeded(mmToPt(PDF_CONFIG.spacing.sectionSpacingBefore + PDF_CONFIG.fonts.sectionTitle.size / 2.83465 + PDF_CONFIG.spacing.sectionSpacingAfter));
      cursorY += PDF_CONFIG.spacing.sectionSpacingBefore;
      doc.setFont(PDF_CONFIG.fontFamily, PDF_CONFIG.fonts.sectionTitle.style);
      doc.setFontSize(PDF_CONFIG.fonts.sectionTitle.size);
      doc.setTextColor(...PDF_CONFIG.colors.primary);
      doc.text(title, PDF_CONFIG.margins.left, cursorY);
      cursorY += PDF_CONFIG.fonts.sectionTitle.size / 2.83465; // Convert pt to mm
      doc.setDrawColor(...PDF_CONFIG.colors.secondary);
      doc.line(
        PDF_CONFIG.margins.left,
        cursorY + PDF_CONFIG.spacing.sectionSpacingAfter / 2,
        PDF_CONFIG.margins.left + PDF_CONFIG.contentWidth,
        cursorY + PDF_CONFIG.spacing.sectionSpacingAfter / 2
      );
      cursorY += PDF_CONFIG.spacing.sectionSpacingAfter;
    };

    const addBulletPoint = (text: string, indent: number = PDF_CONFIG.spacing.bulletIndent) => {
      doc.setFont(PDF_CONFIG.fontFamily, PDF_CONFIG.fonts.body.style);
      doc.setFontSize(PDF_CONFIG.fonts.body.size);
      doc.setTextColor(...PDF_CONFIG.colors.primary);
      const bulletText = `• ${text}`;
      const lines = doc.splitTextToSize(bulletText, PDF_CONFIG.contentWidth - indent);
      const lineHeight = PDF_CONFIG.fonts.body.size * PDF_CONFIG.spacing.lineHeight / 2.83465; // Convert pt to mm
      
      lines.forEach((line: string) => {
        addPageIfNeeded(lineHeight);
        doc.text(line, PDF_CONFIG.margins.left + indent, cursorY);
        cursorY += lineHeight;
      });
      cursorY += PDF_CONFIG.spacing.bulletListSpacing;
    };

    // --- Header ---
    doc.setFont(PDF_CONFIG.fontFamily, PDF_CONFIG.fonts.name.style);
    doc.setFontSize(PDF_CONFIG.fonts.name.size);
    doc.setTextColor(...PDF_CONFIG.colors.primary);
    doc.text(resumeData.name, PDF_CONFIG.margins.left, cursorY + PDF_CONFIG.spacing.nameFromTop);
    cursorY += PDF_CONFIG.spacing.nameFromTop + PDF_CONFIG.fonts.name.size / 2.83465;

    doc.setFont(PDF_CONFIG.fontFamily, PDF_CONFIG.fonts.contact.style);
    doc.setFontSize(PDF_CONFIG.fonts.contact.size);
    doc.setTextColor(...PDF_CONFIG.colors.secondary);

    const contactInfoParts: string[] = [];
    if (resumeData.phone) contactInfoParts.push(resumeData.phone);
    if (resumeData.email) contactInfoParts.push(resumeData.email);
    if (resumeData.location) contactInfoParts.push(resumeData.location);
    if (resumeData.linkedin) contactInfoParts.push(resumeData.linkedin);
    if (resumeData.github) contactInfoParts.push(resumeData.github);

    const contactInfoText = contactInfoParts.join(' | ');
    const contactInfoLines = doc.splitTextToSize(contactInfoText, PDF_CONFIG.contentWidth);
    contactInfoLines.forEach((line: string) => {
      doc.text(line, PDF_CONFIG.margins.left, cursorY);
      cursorY += PDF_CONFIG.fonts.contact.size * PDF_CONFIG.spacing.lineHeight / 2.83465;
    });
    cursorY += PDF_CONFIG.spacing.afterContact;

    doc.setDrawColor(...PDF_CONFIG.colors.secondary);
    doc.line(
      PDF_CONFIG.margins.left,
      cursorY,
      PDF_CONFIG.pageWidth - PDF_CONFIG.margins.right,
      cursorY
    );
    cursorY += PDF_CONFIG.spacing.sectionSpacingAfter;

    // --- Section Order ---
    const sectionOrder =
      userType === 'experienced'
        ? ['summary', 'workExperience', 'skills', 'projects', 'certifications', 'additionalSections', 'education']
        : ['careerObjective', 'education', 'workExperience', 'projects', 'skills', 'certifications', 'additionalSections', 'achievements'];

    sectionOrder.forEach((sectionName) => {
      switch (sectionName) {
        case 'summary':
          if (resumeData.summary) {
            addSectionTitle('PROFESSIONAL SUMMARY');
            doc.setFont(PDF_CONFIG.fontFamily, PDF_CONFIG.fonts.body.style);
            doc.setFontSize(PDF_CONFIG.fonts.body.size);
            doc.setTextColor(...PDF_CONFIG.colors.primary);
            const lines = doc.splitTextToSize(resumeData.summary, PDF_CONFIG.contentWidth);
            lines.forEach((line: string) => {
              addPageIfNeeded(PDF_CONFIG.fonts.body.size * PDF_CONFIG.spacing.lineHeight / 2.83465);
              doc.text(line, PDF_CONFIG.margins.left, cursorY);
              cursorY += PDF_CONFIG.fonts.body.size * PDF_CONFIG.spacing.lineHeight / 2.83465;
            });
            cursorY += PDF_CONFIG.spacing.sectionSpacingAfter;
          }
          break;

        case 'careerObjective':
          if (resumeData.careerObjective) {
            addSectionTitle('CAREER OBJECTIVE');
            doc.setFont(PDF_CONFIG.fontFamily, PDF_CONFIG.fonts.body.style);
            doc.setFontSize(PDF_CONFIG.fonts.body.size);
            doc.setTextColor(...PDF_CONFIG.colors.primary);
            const lines = doc.splitTextToSize(resumeData.careerObjective, PDF_CONFIG.contentWidth);
            lines.forEach((line: string) => {
              addPageIfNeeded(PDF_CONFIG.fonts.body.size * PDF_CONFIG.spacing.lineHeight / 2.83465);
              doc.text(line, PDF_CONFIG.margins.left, cursorY);
              cursorY += PDF_CONFIG.fonts.body.size * PDF_CONFIG.spacing.lineHeight / 2.83465;
            });
            cursorY += PDF_CONFIG.spacing.sectionSpacingAfter;
          }
          break;

        case 'workExperience':
          if (resumeData.workExperience && resumeData.workExperience.length > 0) {
            addSectionTitle(userType === 'experienced' ? 'PROFESSIONAL EXPERIENCE' : 'INTERNSHIPS & WORK EXPERIENCE');
            resumeData.workExperience.forEach((job) => {
              const jobTitleText = `${job.role} at ${job.company}${job.location ? `, ${job.location}` : ''}`;
              const jobYearText = job.year;

              doc.setFont(PDF_CONFIG.fontFamily, PDF_CONFIG.fonts.jobTitle.style);
              doc.setFontSize(PDF_CONFIG.fonts.jobTitle.size);
              doc.setTextColor(...PDF_CONFIG.colors.primary);

              const jobTitleLines = doc.splitTextToSize(jobTitleText, PDF_CONFIG.contentWidth * 0.7); // Allocate 70% width for title
              const jobYearLines = doc.splitTextToSize(jobYearText, PDF_CONFIG.contentWidth * 0.3); // Allocate 30% width for year

              const lineHeight = PDF_CONFIG.fonts.jobTitle.size * PDF_CONFIG.spacing.lineHeight / 2.83465;
              const totalHeightNeeded = Math.max(jobTitleLines.length, jobYearLines.length) * lineHeight;
              addPageIfNeeded(totalHeightNeeded);

              let currentLineY = cursorY;
              jobTitleLines.forEach((line: string, index: number) => {
                doc.text(line, PDF_CONFIG.margins.left, currentLineY);
                currentLineY += lineHeight;
              });

              currentLineY = cursorY; // Reset for year
              jobYearLines.forEach((line: string, index: number) => {
                doc.text(line, PDF_CONFIG.margins.left + PDF_CONFIG.contentWidth - doc.getTextWidth(line), currentLineY);
                currentLineY += lineHeight;
              });
              cursorY = Math.max(cursorY + totalHeightNeeded, currentLineY); // Advance cursor by max height

              cursorY += PDF_CONFIG.spacing.entrySpacing * 0.5; // Small space after title/year

              job.bullets.forEach((bullet) => addBulletPoint(bullet));
              cursorY += PDF_CONFIG.spacing.entrySpacing;
            });
          }
          break;

        case 'education':
          if (resumeData.education && resumeData.education.length > 0) {
            addSectionTitle('EDUCATION');
            resumeData.education.forEach((edu) => {
              const eduTitleText = `${edu.degree}`;
              const eduSchoolText = `${edu.school}${edu.location ? `, ${edu.location}` : ''}`;
              const eduYearText = edu.year;

              doc.setFont(PDF_CONFIG.fontFamily, PDF_CONFIG.fonts.jobTitle.style);
              doc.setFontSize(PDF_CONFIG.fonts.jobTitle.size);
              doc.setTextColor(...PDF_CONFIG.colors.primary);

              const eduTitleLines = doc.splitTextToSize(eduTitleText, PDF_CONFIG.contentWidth * 0.7);
              const eduSchoolLines = doc.splitTextToSize(eduSchoolText, PDF_CONFIG.contentWidth * 0.7);
              const eduYearLines = doc.splitTextToSize(eduYearText, PDF_CONFIG.contentWidth * 0.3);

              const lineHeight = PDF_CONFIG.fonts.jobTitle.size * PDF_CONFIG.spacing.lineHeight / 2.83465;
              const totalHeightNeeded = (eduTitleLines.length + eduSchoolLines.length) * lineHeight;
              addPageIfNeeded(totalHeightNeeded);

              let currentLineY = cursorY;
              eduTitleLines.forEach((line: string) => {
                doc.text(line, PDF_CONFIG.margins.left, currentLineY);
                currentLineY += lineHeight;
              });
              eduSchoolLines.forEach((line: string) => {
                doc.text(line, PDF_CONFIG.margins.left, currentLineY);
                currentLineY += lineHeight;
              });

              currentLineY = cursorY; // Reset for year
              eduYearLines.forEach((line: string) => {
                doc.text(line, PDF_CONFIG.margins.left + PDF_CONFIG.contentWidth - doc.getTextWidth(line), currentLineY);
                currentLineY += lineHeight;
              });
              cursorY = Math.max(cursorY + totalHeightNeeded, currentLineY);

              if (edu.cgpa) {
                doc.setFont(PDF_CONFIG.fontFamily, PDF_CONFIG.fonts.body.style);
                doc.setFontSize(PDF_CONFIG.fonts.body.size);
                doc.setTextColor(...PDF_CONFIG.colors.secondary);
                const cgpaLines = doc.splitTextToSize(`CGPA: ${edu.cgpa}`, PDF_CONFIG.contentWidth);
                cgpaLines.forEach((line: string) => {
                  addPageIfNeeded(PDF_CONFIG.fonts.body.size * PDF_CONFIG.spacing.lineHeight / 2.83465);
                  doc.text(line, PDF_CONFIG.margins.left, cursorY);
                  cursorY += PDF_CONFIG.fonts.body.size * PDF_CONFIG.spacing.lineHeight / 2.83465;
                });
              }
              cursorY += PDF_CONFIG.spacing.entrySpacing;
            });
          }
          break;

        case 'projects':
          if (resumeData.projects && resumeData.projects.length > 0) {
            addSectionTitle(userType === 'experienced' ? 'PROJECTS' : 'ACADEMIC PROJECTS');
            resumeData.projects.forEach((project) => {
              const projectTitleText = project.title;
              doc.setFont(PDF_CONFIG.fontFamily, PDF_CONFIG.fonts.jobTitle.style);
              doc.setFontSize(PDF_CONFIG.fonts.jobTitle.size);
              doc.setTextColor(...PDF_CONFIG.colors.primary);
              const lines = doc.splitTextToSize(projectTitleText, PDF_CONFIG.contentWidth);
              lines.forEach((line: string) => {
                addPageIfNeeded(PDF_CONFIG.fonts.jobTitle.size * PDF_CONFIG.spacing.lineHeight / 2.83465);
                doc.text(line, PDF_CONFIG.margins.left, cursorY);
                cursorY += PDF_CONFIG.fonts.jobTitle.size * PDF_CONFIG.spacing.lineHeight / 2.83465;
              });
              cursorY += PDF_CONFIG.spacing.entrySpacing * 0.5;

              project.bullets.forEach((bullet) => addBulletPoint(bullet));
              cursorY += PDF_CONFIG.spacing.entrySpacing;
            });
          }
          break;

        case 'skills':
          if (resumeData.skills && resumeData.skills.length > 0) {
            addSectionTitle('TECHNICAL SKILLS');
            doc.setFont(PDF_CONFIG.fontFamily, PDF_CONFIG.fonts.body.style);
            doc.setFontSize(PDF_CONFIG.fonts.body.size);
            doc.setTextColor(...PDF_CONFIG.colors.primary);
            resumeData.skills.forEach((skillCategory) => {
              if (skillCategory.list && skillCategory.list.length > 0) {
                const skillText = `${skillCategory.category}: ${skillCategory.list.join(', ')}`;
                const lines = doc.splitTextToSize(skillText, PDF_CONFIG.contentWidth);
                lines.forEach((line: string) => {
                  addPageIfNeeded(PDF_CONFIG.fonts.body.size * PDF_CONFIG.spacing.lineHeight / 2.83465);
                  doc.text(line, PDF_CONFIG.margins.left, cursorY);
                  cursorY += PDF_CONFIG.fonts.body.size * PDF_CONFIG.spacing.lineHeight / 2.83465;
                });
              }
            });
            cursorY += PDF_CONFIG.spacing.sectionSpacingAfter;
          }
          break;

        case 'certifications':
          if (resumeData.certifications && resumeData.certifications.length > 0) {
            addSectionTitle('CERTIFICATIONS');
            resumeData.certifications.forEach((cert) => {
              let certText = '';
              if (typeof cert === 'string') {
                certText = cert;
              } else if (cert && typeof cert === 'object' && 'title' in cert) {
                certText = cert.title;
                if ('description' in cert && cert.description) {
                  certText += `: ${cert.description}`;
                }
              }
              if (certText) {
                addBulletPoint(certText);
              }
            });
            cursorY += PDF_CONFIG.spacing.sectionSpacingAfter;
          }
          break;

        case 'achievements':
          if (resumeData.achievements && resumeData.achievements.length > 0) {
            addSectionTitle('ACHIEVEMENTS');
            resumeData.achievements.forEach((achievement) => addBulletPoint(achievement));
            cursorY += PDF_CONFIG.spacing.sectionSpacingAfter;
          }
          break;

        case 'additionalSections':
          // FIXED: Ensure additionalSections is an array before iterating
          if (resumeData.additionalSections && Array.isArray(resumeData.additionalSections) && resumeData.additionalSections.length > 0) {
            resumeData.additionalSections.forEach((section: AdditionalSection) => {
              if (section.title && section.bullets && section.bullets.length > 0) {
                addSectionTitle(section.title.toUpperCase());
                section.bullets.forEach((bullet) => addBulletPoint(bullet));
                cursorY += PDF_CONFIG.spacing.sectionSpacingAfter;
              }
            });
          } else {
            // Skip additionalSections if not an array or empty
            console.log('Skipping additionalSections: not an array or empty');
          }
          break;

        default:
          break;
      }
    });

    doc.save(`${resumeData.name || 'resume'}.pdf`);
  } catch (error: any) {
    console.error('PDF generation failed:', error);
    throw new Error(
      `PDF generation failed: ${error.message || 'Unknown error'}. Please check your resume content and try again. If the issue persists, try using Word export instead.`
    );
  }
};

export const exportToWord = async (resumeData: ResumeData, userType: UserType) => {
  try {
    let content = `<h1>${resumeData.name}</h1>`;
    const contactInfoParts: string[] = [];
    if (resumeData.phone) contactInfoParts.push(resumeData.phone);
    if (resumeData.email) contactInfoParts.push(resumeData.email);
    if (resumeData.linkedin) contactInfoParts.push(resumeData.linkedin);
    if (resumeData.github) contactInfoParts.push(resumeData.github);
    content += `<p>${contactInfoParts.join(' | ')}</p><hr>`;

    const sectionOrder =
      userType === 'experienced'
        ? ['summary', 'workExperience', 'skills', 'projects', 'certifications', 'additionalSections', 'education']
        : ['careerObjective', 'education', 'workExperience', 'projects', 'skills', 'certifications', 'additionalSections', 'achievements'];

    sectionOrder.forEach((sectionName) => {
      switch (sectionName) {
        case 'summary':
          if (resumeData.summary) {
            content += `<h2>PROFESSIONAL SUMMARY</h2><p>${resumeData.summary}</p>`;
          }
          break;

        case 'careerObjective':
          if (resumeData.careerObjective) {
            content += `<h2>CAREER OBJECTIVE</h2><p>${resumeData.careerObjective}</p>`;
          }
          break;

        case 'workExperience':
          if (resumeData.workExperience && resumeData.workExperience.length > 0) {
            content += `<h2>${userType === 'experienced' ? 'PROFESSIONAL EXPERIENCE' : 'INTERNSHIPS & WORK EXPERIENCE'}</h2>`;
            resumeData.workExperience.forEach((job) => {
              content += `<h3>${job.role} at ${job.company} (${job.year})</h3><ul>`;
              job.bullets.forEach((bullet) => (content += `<li>${bullet}</li>`));
              content += `</ul>`;
            });
          }
          break;

        case 'education':
          if (resumeData.education && resumeData.education.length > 0) {
            content += `<h2>EDUCATION</h2>`;
            resumeData.education.forEach((edu) => {
              content += `<h3>${edu.degree} from ${edu.school} (${edu.year})</h3>`;
              if (edu.cgpa) content += `<p>CGPA: ${edu.cgpa}</p>`;
            });
          }
          break;

        case 'projects':
          if (resumeData.projects && resumeData.projects.length > 0) {
            content += `<h2>${userType === 'experienced' ? 'PROJECTS' : 'ACADEMIC PROJECTS'}</h2>`;
            resumeData.projects.forEach((project) => {
              content += `<h3>${project.title}</h3><ul>`;
              project.bullets.forEach((bullet) => (content += `<li>${bullet}</li>`));
              content += `</ul>`;
            });
          }
          break;

        case 'skills':
          if (resumeData.skills && resumeData.skills.length > 0) {
            content += `<h2>TECHNICAL SKILLS</h2>`;
            resumeData.skills.forEach((skillCategory) => {
              if (skillCategory.list && skillCategory.list.length > 0) {
                content += `<p><strong>${skillCategory.category}:</strong> ${skillCategory.list.join(', ')}</p>`;
              }
            });
          }
          break;

        case 'certifications':
          if (resumeData.certifications && resumeData.certifications.length > 0) {
            content += `<h2>CERTIFICATIONS</h2><ul>`;
            resumeData.certifications.forEach((cert) => {
              let certText = '';
              if (typeof cert === 'string') {
                certText = cert;
              } else if (cert && typeof cert === 'object' && 'title' in cert) {
                certText = cert.title;
                if ('description' in cert && cert.description) {
                  certText += `: ${cert.description}`;
                }
              }
              if (certText) {
                content += `<li>${certText}</li>`;
              }
            });
            content += `</ul>`;
          }
          break;

        case 'achievements':
          if (resumeData.achievements && resumeData.achievements.length > 0) {
            content += `<h2>ACHIEVEMENTS</h2><ul>`;
            resumeData.achievements.forEach((achievement) => (content += `<li>${achievement}</li>`));
            content += `</ul>`;
          }
          break;

        case 'additionalSections':
          // FIXED: Ensure additionalSections is an array before iterating in Word export
          if (resumeData.additionalSections && Array.isArray(resumeData.additionalSections) && resumeData.additionalSections.length > 0) {
            resumeData.additionalSections.forEach((section: AdditionalSection) => {
              if (section.title && section.bullets && section.bullets.length > 0) {
                content += `<h2>${section.title.toUpperCase()}</h2><ul>`;
                section.bullets.forEach((bullet) => (content += `<li>${bullet}</li>`));
                content += `</ul>`;
              }
            });
          } else {
            // Skip additionalSections if not an array or empty
            console.log('Skipping additionalSections in Word export: not an array or empty');
          }
          break;

        default:
          break;
      }
    });

    const result = await mammoth.convertHtmlToDocx({ html: content });
    const blob = new Blob([result.value], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    saveAs(blob, `${resumeData.name || 'resume'}.docx`);
  } catch (error: any) {
    console.error('Word export failed:', error);
    throw new Error(
      `Word export failed: ${error.message || 'Unknown error'}. Please check your resume content and try again.`
    );
  }
};
