// src/utils/exportUtils.ts
import jsPDF from 'jspdf';
import { ResumeData, Certification } from '../types/resume'; // Import Certification type
import { saveAs } from 'file-saver';
import { ExportOptions, defaultExportOptions } from '../types/export';
import { UserType } from '../types/resume';

// Professional PDF Layout Constants - Updated to meet specifications
const createPDFConfig = (options: ExportOptions) => ({
  // A4 dimensions in mm
  pageWidth: 210,
  pageHeight: 297, // Changed from 300 to 297 for standard A4

  // Professional margins in mm (0.7 inch = 17.78mm)
  margins: {
    top: options.layoutType === 'compact' ? 12 : 17.78, // Adjusted for standard
    bottom: options.layoutType === 'compact' ? 12 : 17.78, // Adjusted for standard
    left: options.layoutType === 'compact' ? 12 : 17.78, // Adjusted for standard
    right: options.layoutType === 'compact' ? 12 : 17.78 // Adjusted for standard
  },

  // Calculated content area
  get contentWidth() { return this.pageWidth - this.margins.left - this.margins.right },
  get contentHeight() { return this.pageHeight - this.margins.top - this.margins.bottom },

  // Typography settings - Professional specifications
  fonts: {
    name: { size: options.nameSize, weight: 'bold' },
    contact: { size: options.bodyTextSize - 0.5, weight: 'normal' },
    sectionTitle: { size: options.sectionHeaderSize, weight: 'bold' },
    jobTitle: { size: options.subHeaderSize, weight: 'bold' },
    company: { size: options.subHeaderSize, weight: 'normal' },
    year: { size: options.subHeaderSize, weight: 'normal' },
    body: { size: options.bodyTextSize, weight: 'normal' }
  },
  spacing: {
    nameFromTop: 10, // Changed from 13 to 10
    afterName: 0,
    afterContact: 2, // Changed from 3 to 2
    sectionSpacingBefore: options.sectionSpacing, // Space before section title
    sectionSpacingAfter: 2, // Space after section underline
    bulletListSpacing: 0.5, // Changed from options.entrySpacing * 0.3 to 0.5
    afterSubsection: 3, // Space between sub-sections (e.g., jobs, projects)
    lineHeight: 1.2, // Tighter line height
    bulletIndent: 5, // Changed from 4 to 5
    entrySpacing: options.entrySpacing
  },
  colors: {
    primary: [0, 0, 0],
    secondary: [80, 80, 80],
    accent: [37, 99, 235]
  },
  fontFamily: options.fontFamily
});

interface DrawPosition {
  x: number;
  y: number;
}

interface PageState {
  currentPage: number;
  currentY: number;
  doc: jsPDF;
}

// NEW: Helper function to validate fields
const isValidField = (field?: string | null, fieldType: 'phone' | 'email' | 'url' | 'text' = 'text'): boolean => {
  if (!field || field.trim() === '') {
    return false;
  }
  const lowercasedField = field.trim().toLowerCase();
  const invalidValues = ['n/a', 'not specified', 'none'];
  if (invalidValues.includes(lowercasedField)) {
    return false;
  }
  
  switch (fieldType) {
    case 'phone':
      const digitCount = (field.match(/\d/g) || []).length;
      return digitCount > 6;
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field);
    case 'url':
      return /^https?:\/\//.test(field);
    case 'text':
    default:
      return true;
  }
};

// Helper function to detect mobile device
const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Helper function to trigger download on mobile
const triggerMobileDownload = (blob: Blob, filename: string): void => {
  try {
    // For mobile devices, use a more reliable download method
    if (isMobileDevice()) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';

      // Add to DOM, click, and remove
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Clean up the URL object after a delay
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    } else {
      // For desktop, use saveAs
      saveAs(blob, filename);
    }
  } catch (error) {
    console.error('Download failed:', error);
    // Fallback: try to open in new window
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }
};

// Helper function to check if content fits on current page
function checkPageSpace(state: PageState, requiredHeight: number, PDF_CONFIG: any): boolean {
  const maxY = PDF_CONFIG.pageHeight - PDF_CONFIG.margins.bottom; // Corrected calculation
  return (state.currentY + requiredHeight) <= maxY;
}

// Add new page and reset position
function addNewPage(state: PageState, PDF_CONFIG: any): void {
  state.doc.addPage();
  state.currentPage++;
  state.currentY = PDF_CONFIG.margins.top;

  // Add page number
  const pageText = `Page ${state.currentPage}`;
  state.doc.setFont(PDF_CONFIG.fontFamily, 'normal');
  state.doc.setFontSize(9);
  state.doc.setTextColor(128, 128, 128); // Gray

  const pageWidth = state.doc.internal.pageSize.getWidth();
  const textWidth = state.doc.getTextWidth(pageText);
  state.doc.text(pageText, pageWidth - PDF_CONFIG.margins.right - textWidth, PDF_CONFIG.pageHeight - PDF_CONFIG.margins.bottom / 2); // Adjusted Y for page number
}

// Draw text with automatic wrapping and return height used
function drawText(
  state: PageState,
  text: string,
  x: number,
  PDF_CONFIG: any,
  options: {
    fontSize?: number;
    fontWeight?: string;
    color?: number[];
    maxWidth?: number;
    align?: 'left' | 'center' | 'right';
  } = {}
): number {
  const {
    fontSize = PDF_CONFIG.fonts.body.size,
    fontWeight = 'normal',
    color = PDF_CONFIG.colors.primary,
    maxWidth = PDF_CONFIG.contentWidth,
    align = 'left'
  } = options;

  state.doc.setFont(PDF_CONFIG.fontFamily, fontWeight);
  state.doc.setFontSize(fontSize);
  state.doc.setTextColor(color[0], color[1], color[2]);

  // Split text to fit width
  const lines = state.doc.splitTextToSize(text, maxWidth);
  const lineHeight = fontSize * PDF_CONFIG.spacing.lineHeight * 0.352778; // Convert pt to mm
  const totalHeight = lines.length * lineHeight;

  // Check if we need a new page
  if (!checkPageSpace(state, totalHeight, PDF_CONFIG)) {
    addNewPage(state, PDF_CONFIG);
  }

  // Calculate x position based on alignment
  let textX = x;
  if (align === 'center') {
    textX = PDF_CONFIG.margins.left + (PDF_CONFIG.contentWidth / 2);
  } else if (align === 'right') {
    textX = PDF_CONFIG.margins.left + PDF_CONFIG.contentWidth;
  }

  // Draw each line
  lines.forEach((line: string, index: number) => {
    const yPos = state.currentY + (index * lineHeight);

    if (align === 'center') {
      const lineWidth = state.doc.getTextWidth(line);
      state.doc.text(line, textX - (lineWidth / 2), yPos);
    } else if (align === 'right') {
      const lineWidth = state.doc.getTextWidth(line);
      state.doc.text(line, textX - lineWidth, yPos);
    } else {
      state.doc.text(line, textX, yPos);
    }
  });

  state.currentY += totalHeight;
  return totalHeight;
}

// Draw section title with underline and proper spacing
function drawSectionTitle(state: PageState, title: string, PDF_CONFIG: any): number {
  state.currentY += 1;
  const estimatedSectionHeaderHeight = PDF_CONFIG.fonts.sectionTitle.size * PDF_CONFIG.spacing.lineHeight * 0.352778 + 2;
  if (!checkPageSpace(state, estimatedSectionHeaderHeight, PDF_CONFIG)) {
      addNewPage(state, PDF_CONFIG);
  }
  const titleHeight = drawText(state, title.toUpperCase(), PDF_CONFIG.margins.left, PDF_CONFIG, {
    fontSize: PDF_CONFIG.fonts.sectionTitle.size,
    fontWeight: PDF_CONFIG.fonts.sectionTitle.weight,
    color: PDF_CONFIG.colors.primary
  });
  const underlineY = state.currentY - (PDF_CONFIG.fonts.sectionTitle.size * 0.2); // Changed from 0.3 to 0.2
  state.doc.setDrawColor(64, 64, 64); // Changed from 128, 128, 128 to 64, 64, 64
  state.doc.setLineWidth(0.5);
  state.doc.line(PDF_CONFIG.margins.left, underlineY, PDF_CONFIG.margins.left + PDF_CONFIG.contentWidth, underlineY);
  state.currentY += PDF_CONFIG.spacing.sectionSpacingAfter;
  return titleHeight + PDF_CONFIG.spacing.sectionSpacingBefore + PDF_CONFIG.spacing.sectionSpacingAfter;
}

// Draw contact information with vertical bars as separators
function drawContactInfo(state: PageState, resumeData: ResumeData, PDF_CONFIG: any): number {
  const contactParts: string[] = [];
  const addContactField = (fieldValue?: string | null, fieldType: 'phone' | 'email' | 'url' | 'text' = 'text') => {
    if (!fieldValue) return;
    const parts = fieldValue.split(/[,|]/).map(p => p.trim());
    const validParts = parts.filter(p => isValidField(p, fieldType));
    if (validParts.length > 0) {
      contactParts.push(validParts.join(' | '));
    }
  };

  addContactField(resumeData.location, 'text');
  addContactField(resumeData.phone, 'phone');
  addContactField(resumeData.email, 'email');
  addContactField(resumeData.linkedin, 'url');
  addContactField(resumeData.github, 'url');

  if (contactParts.length === 0) return 0;
  const contactText = contactParts.join(' | ');
  const height = drawText(state, contactText, PDF_CONFIG.margins.left, PDF_CONFIG, {
    fontSize: PDF_CONFIG.fonts.contact.size,
    fontWeight: PDF_CONFIG.fonts.contact.weight,
    color: PDF_CONFIG.colors.primary,
    align: 'center'
  });
  state.currentY += PDF_CONFIG.spacing.afterContact;
  return height + PDF_CONFIG.spacing.afterContact;
}

// Draw work experience section
function drawWorkExperience(state: PageState, workExperience: any[], userType: UserType = 'experienced', PDF_CONFIG: any): number {
  if (!workExperience || workExperience.length === 0) return 0;

  const sectionTitle = userType === 'fresher' ? 'WORK EXPERIENCE' : 'EXPERIENCE';
  let totalHeight = drawSectionTitle(state, sectionTitle, PDF_CONFIG);

  workExperience.forEach((job, index) => {
    const estimatedJobHeaderHeight = (PDF_CONFIG.fonts.jobTitle.size) * PDF_CONFIG.spacing.lineHeight * 0.352778;
    const estimatedMinBulletHeight = PDF_CONFIG.fonts.body.size * PDF_CONFIG.spacing.lineHeight * 0.352778;
    if (!checkPageSpace(state, estimatedJobHeaderHeight + estimatedMinBulletHeight + PDF_CONFIG.spacing.bulletListSpacing * 2 + PDF_CONFIG.spacing.afterSubsection, PDF_CONFIG)) {
      addNewPage(state, PDF_CONFIG);
    }

    const initialYForJob = state.currentY;
    const combinedTitle = `${job.role} | ${job.company}${isValidField(job.location) ? `, ${job.location}` : ''}`;

    const yearText = job.year;
    
    // MODIFIED: Added isValidField check for job.year
    if (isValidField(yearText)) {
      state.doc.setFont(PDF_CONFIG.fontFamily, 'normal'); // Changed to normal
      state.doc.setFontSize(PDF_CONFIG.fonts.year.size);
      const yearWidth = state.doc.getTextWidth(yearText);
      const yearX = PDF_CONFIG.margins.left + PDF_CONFIG.contentWidth - yearWidth;
      const yearY = initialYForJob + (PDF_CONFIG.fonts.jobTitle.size * 0.352778 * 0.5);
      state.doc.setFont(PDF_CONFIG.fontFamily, 'normal');
      state.doc.text(yearText, yearX, yearY);
    }

    drawText(state, combinedTitle, PDF_CONFIG.margins.left, PDF_CONFIG, {
      fontSize: PDF_CONFIG.fonts.jobTitle.size,
      fontWeight: 'bold', // Changed to bold
      maxWidth: PDF_CONFIG.contentWidth - (isValidField(yearText) ? state.doc.getTextWidth(yearText) : 0) - 5 // Adjust maxWidth if year is present
    });

    state.currentY += PDF_CONFIG.spacing.bulletListSpacing;

    if (job.bullets && job.bullets.length > 0) {
      state.currentY += PDF_CONFIG.spacing.bulletListSpacing;
      job.bullets.forEach((bullet: string) => {
        const bulletText = `• ${bullet}`;
        const bulletHeight = drawText(state, bulletText, PDF_CONFIG.margins.left + PDF_CONFIG.spacing.bulletIndent, PDF_CONFIG, {
          fontSize: PDF_CONFIG.fonts.body.size,
          maxWidth: PDF_CONFIG.contentWidth - PDF_CONFIG.spacing.bulletIndent
        });
        totalHeight += bulletHeight;
      });
      state.currentY += PDF_CONFIG.spacing.bulletListSpacing;
    }

    if (index < workExperience.length - 1) {
      state.currentY += 1;
      totalHeight += 1;
    }
  });

  return totalHeight;
}

// Draw education section
function drawEducation(state: PageState, education: any[], PDF_CONFIG: any): number {
  if (!education || education.length === 0) return 0;
  let totalHeight = drawSectionTitle(state, 'EDUCATION', PDF_CONFIG);

  education.forEach((edu, index) => {
    const initialYForEdu = state.currentY;
    if (!checkPageSpace(state, 20, PDF_CONFIG)) {
      addNewPage(state, PDF_CONFIG);
    }
    const degreeHeight = drawText(state, edu.degree, PDF_CONFIG.margins.left, PDF_CONFIG, {
      fontSize: PDF_CONFIG.fonts.jobTitle.size,
      fontWeight: PDF_CONFIG.fonts.jobTitle.weight // Already bold
    });
    const schoolText = `${edu.school}${isValidField(edu.location) ? `, ${edu.location}` : ''}`;
    const schoolHeight = drawText(state, schoolText, PDF_CONFIG.margins.left, PDF_CONFIG, {
      fontSize: PDF_CONFIG.fonts.company.size,
      fontWeight: 'normal', // Changed to normal
      color: PDF_CONFIG.colors.primary
    });
    let cgpaHeight = 0;
    if (isValidField(edu.cgpa)) {
      cgpaHeight = drawText(state, `CGPA: ${edu.cgpa}`, PDF_CONFIG.margins.left, PDF_CONFIG, {
        fontSize: PDF_CONFIG.fonts.body.size,
        fontWeight: PDF_CONFIG.fonts.body.weight,
        color: PDF_CONFIG.colors.secondary
      });
    }
    // Removed edu.relevantCoursework block
    // MODIFIED: Removed redundant setFont call and added isValidField check
    state.doc.setFontSize(PDF_CONFIG.fonts.year.size);
    state.doc.setTextColor(PDF_CONFIG.colors.primary[0], PDF_CONFIG.colors.primary[1], PDF_CONFIG.colors.primary[2]);
    
    if (isValidField(edu.year)) { // ADDED: Check if edu.year is valid
      const yearText = edu.year;
      state.doc.setFont(PDF_CONFIG.fontFamily, 'bold'); // Ensure year is bold
      const yearWidth = state.doc.getTextWidth(yearText);
      const yearX = PDF_CONFIG.margins.left + PDF_CONFIG.contentWidth - yearWidth; // CORRECTED calculation
      const yearY = initialYForEdu + (PDF_CONFIG.fonts.jobTitle.size * 0.352778 * 0.5);
      state.doc.text(yearText, yearX, yearY);
      state.doc.setFont(PDF_CONFIG.fontFamily, 'normal'); // Reset font to normal after drawing year
    }
    totalHeight += degreeHeight + schoolHeight + cgpaHeight;
    if (index < education.length - 1) {
      state.currentY += 1;
      totalHeight += 1;
    }
  });
  return totalHeight;
}


// Draw projects section
function drawProjects(state: PageState, projects: any[], PDF_CONFIG: any): number {
  if (!projects || projects.length === 0) return 0;

  const githubProjects = projects.filter(project => project.githubUrl);
  let totalHeight = drawSectionTitle(state, 'PROJECTS', PDF_CONFIG);

  projects.forEach((project, index) => {
    if (!checkPageSpace(state, 25, PDF_CONFIG)) {
      addNewPage(state, PDF_CONFIG);
    }

    const titleHeight = drawText(state, project.title, PDF_CONFIG.margins.left, PDF_CONFIG, {
      fontSize: PDF_CONFIG.fonts.jobTitle.size,
      fontWeight: PDF_CONFIG.fonts.jobTitle.weight // Already bold
    });
    totalHeight += titleHeight;
    state.currentY += PDF_CONFIG.spacing.bulletListSpacing;

    if (project.bullets && project.bullets.length > 0) {
      state.currentY += PDF_CONFIG.spacing.bulletListSpacing;
      project.bullets.forEach((bullet: string) => {
        const bulletText = `• ${bullet}`;
        const bulletHeight = drawText(state, bulletText, PDF_CONFIG.margins.left + PDF_CONFIG.spacing.bulletIndent, PDF_CONFIG, {
          fontSize: PDF_CONFIG.fonts.body.size,
          maxWidth: PDF_CONFIG.contentWidth - PDF_CONFIG.spacing.bulletIndent
        });
        totalHeight += bulletHeight;
      });
      state.currentY += PDF_CONFIG.spacing.bulletListSpacing;
    }

    if (index < projects.length - 1) {
      state.currentY += 1;
      totalHeight += 1;
    }
  });

  return totalHeight;
}


// Draw skills section
function drawSkills(state: PageState, skills: any[], PDF_CONFIG: any): number {
  if (!skills || skills.length === 0) return 0;

  let totalHeight = drawSectionTitle(state, 'SKILLS', PDF_CONFIG);
  const estimatedSkillLineHeight = PDF_CONFIG.fonts.body.size * PDF_CONFIG.spacing.lineHeight * 0.352778;

  skills.forEach((skill, index) => {
    if (!checkPageSpace(state, 15, PDF_CONFIG)) {
      addNewPage(state, PDF_CONFIG);
    }

    const x = PDF_CONFIG.margins.left;
    const categoryText = `${skill.category}: `;
    const listText = skill.list ? skill.list.join(', ') : '';

    state.doc.setFont(PDF_CONFIG.fontFamily, 'bold'); // Already bold
    state.doc.setFontSize(PDF_CONFIG.fonts.body.size);
    state.doc.setTextColor(PDF_CONFIG.colors.primary[0], PDF_CONFIG.colors.primary[1], PDF_CONFIG.colors.primary[2]);

    const categoryWidth = state.doc.getTextWidth(categoryText);
    state.doc.text(categoryText, x, state.currentY);
    state.doc.setFont(PDF_CONFIG.fontFamily, 'normal');

    const remainingWidth = PDF_CONFIG.contentWidth - categoryWidth;
    const lines = state.doc.splitTextToSize(listText, remainingWidth);

    lines.forEach((line: string, lineIndex: number) => {
        if (lineIndex === 0) {
            state.doc.text(line, x + categoryWidth, state.currentY);
        } else {
            state.doc.text(line, x, state.currentY + (lineIndex * estimatedSkillLineHeight));
        }
    });

    state.currentY += lines.length * estimatedSkillLineHeight;
    totalHeight += lines.length * estimatedSkillLineHeight;

    if (index < skills.length - 1) {
      state.currentY += 1;
      totalHeight += 1;
    }
  });

  return totalHeight;
}


// Draw certifications section
function drawCertifications(state: PageState, certifications: (string | Certification)[], PDF_CONFIG: any): number {
  if (!certifications || certifications.length === 0) return 0;

  let totalHeight = drawSectionTitle(state, 'CERTIFICATIONS', PDF_CONFIG);

  certifications.forEach((cert) => {
    if (!checkPageSpace(state, 10, PDF_CONFIG)) {
      addNewPage(state, PDF_CONFIG);
    }

    if (typeof cert === 'object' && cert !== null && 'title' in cert) { // Check for 'title' property
      const titleText = `• ${cert.title}`;
      const titleHeight = drawText(state, titleText, PDF_CONFIG.margins.left + PDF_CONFIG.spacing.bulletIndent, PDF_CONFIG, {
        fontWeight: 'bold',
        maxWidth: PDF_CONFIG.contentWidth - PDF_CONFIG.spacing.bulletIndent
      });
      totalHeight += titleHeight;

      if ('description' in cert && cert.description) { // Check for 'description' property
        state.currentY += 1; // Small gap
        const descHeight = drawText(state, cert.description, PDF_CONFIG.margins.left + PDF_CONFIG.spacing.bulletIndent * 2, PDF_CONFIG, {
          maxWidth: PDF_CONFIG.contentWidth - (PDF_CONFIG.spacing.bulletIndent * 2)
        });
        totalHeight += descHeight + 1;
      }
    } else {
      const bulletText = `• ${String(cert)}`;
      const certHeight = drawText(state, bulletText, PDF_CONFIG.margins.left + PDF_CONFIG.spacing.bulletIndent, PDF_CONFIG, {
        fontSize: PDF_CONFIG.fonts.body.size,
        maxWidth: PDF_CONFIG.contentWidth - PDF_CONFIG.spacing.bulletIndent
      });
      totalHeight += certHeight;
    }
    state.currentY += PDF_CONFIG.spacing.bulletListSpacing;
  });

  return totalHeight;
}

// Draw professional summary section
function drawProfessionalSummary(state: PageState, summary: string, PDF_CONFIG: any): number {
  if (!summary) return 0;

  let totalHeight = drawSectionTitle(state, 'PROFESSIONAL SUMMARY', PDF_CONFIG);
  const summaryHeight = drawText(state, summary, PDF_CONFIG.margins.left, PDF_CONFIG, {
    fontSize: PDF_CONFIG.fonts.body.size,
    fontWeight: PDF_CONFIG.fonts.body.weight,
    maxWidth: PDF_CONFIG.contentWidth
  });
  totalHeight += summaryHeight;
  state.currentY += 3;
  return totalHeight;
}

// Draw career objective section for students
function drawCareerObjective(state: PageState, objective: string, PDF_CONFIG: any): number {
  if (!objective) return 0;
  let totalHeight = drawSectionTitle(state, 'CAREER OBJECTIVE', PDF_CONFIG);
  state.currentY += 3;
  const objectiveHeight = drawText(state, objective, PDF_CONFIG.margins.left, PDF_CONFIG, {
    fontSize: PDF_CONFIG.fonts.body.size,
    fontWeight: PDF_CONFIG.fonts.body.weight,
    maxWidth: PDF_CONFIG.contentWidth
  });
  totalHeight += objectiveHeight;
  state.currentY += 3;
  return totalHeight;
}

// MODIFIED: Simplified to only draw achievements
function drawAchievementsAndExtras(state: PageState, resumeData: ResumeData, PDF_CONFIG: any): number {
  const hasAchievements = resumeData.achievements && resumeData.achievements.length > 0;
  if (!hasAchievements) return 0;

  let totalHeight = drawSectionTitle(state, 'ACHIEVEMENTS', PDF_CONFIG);

  resumeData.achievements.forEach(item => {
    if (!checkPageSpace(state, 10, PDF_CONFIG)) {
      addNewPage(state, PDF_CONFIG);
    }
    const itemHeight = drawText(state, `• ${item}`, PDF_CONFIG.margins.left + PDF_CONFIG.spacing.bulletIndent, PDF_CONFIG, {
      fontSize: PDF_CONFIG.fonts.body.size,
      maxWidth: PDF_CONFIG.contentWidth - PDF_CONFIG.spacing.bulletIndent
    });
    totalHeight += itemHeight;
  });

  state.currentY += 2;
  return totalHeight;
}


// Main export function with mobile optimization
export const exportToPDF = async (resumeData: ResumeData, userType: UserType = 'experienced', options: ExportOptions = defaultExportOptions): Promise<void> => {
  const PDF_CONFIG = createPDFConfig(options);

  try {
    if (isMobileDevice()) {
      console.log('Starting PDF generation for mobile device...');
    }
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const state: PageState = { currentPage: 1, currentY: PDF_CONFIG.margins.top, doc };
    doc.setProperties({
      title: `${resumeData.name} - Resume`,
      subject: 'Professional Resume',
      author: resumeData.name,
      creator: 'Resume Optimizer',
      producer: 'Resume Optimizer PDF Generator'
    });

    state.currentY = PDF_CONFIG.spacing.nameFromTop;
    drawText(state, resumeData.name.toUpperCase(), PDF_CONFIG.margins.left, PDF_CONFIG, {
      fontSize: PDF_CONFIG.fonts.name.size,
      fontWeight: PDF_CONFIG.fonts.name.weight,
      align: 'center'
    });
    state.currentY += PDF_CONFIG.spacing.afterName;

    drawContactInfo(state, resumeData, PDF_CONFIG);
    
    state.currentY += 3;

    if (userType === 'experienced' && resumeData.summary && resumeData.summary.trim() !== '') {
      drawProfessionalSummary(state, resumeData.summary, PDF_CONFIG);
    } else if ((userType === 'student' || userType === 'fresher') && resumeData.careerObjective && resumeData.careerObjective.trim() !== '') {
      drawCareerObjective(state, resumeData.careerObjective, PDF_CONFIG);
    }

    if (userType === 'experienced') {
        drawWorkExperience(state, resumeData.workExperience, userType, PDF_CONFIG);
        drawProjects(state, resumeData.projects, PDF_CONFIG);
        drawSkills(state, resumeData.skills, PDF_CONFIG);
        drawCertifications(state, resumeData.certifications, PDF_CONFIG);
        drawEducation(state, resumeData.education, PDF_CONFIG);
    } else if (userType === 'student') {
        drawEducation(state, resumeData.education, PDF_CONFIG);
        drawSkills(state, resumeData.skills, PDF_CONFIG);
        drawProjects(state, resumeData.projects, PDF_CONFIG);
        drawWorkExperience(state, resumeData.workExperience, userType, PDF_CONFIG);
        drawCertifications(state, resumeData.certifications, PDF_CONFIG);
        drawAchievementsAndExtras(state, resumeData, PDF_CONFIG);
    } else { // Fresher
        drawEducation(state, resumeData.education, PDF_CONFIG);
        drawWorkExperience(state, resumeData.workExperience, userType, PDF_CONFIG);
        drawProjects(state, resumeData.projects, PDF_CONFIG);
        drawSkills(state, resumeData.skills, PDF_CONFIG);
        drawCertifications(state, resumeData.certifications, PDF_CONFIG);
        drawAchievementsAndExtras(state, resumeData, PDF_CONFIG);
    }

    const totalPages = state.currentPage;
    if (totalPages > 1) {
      for (let i = 1; i <= totalPages; i++) {
        if (i > 1) { doc.setPage(i); }
        const pageText = `Page ${i} of ${totalPages}`;
        doc.setFont(PDF_CONFIG.fontFamily, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        const textWidth = doc.getTextWidth(pageText);
        doc.text(pageText, PDF_CONFIG.pageWidth / 2 - textWidth / 2, PDF_CONFIG.pageHeight - PDF_CONFIG.margins.bottom / 2);
      }
    }

    const fileName = getFileName(resumeData, 'pdf');
    if (isMobileDevice()) {
      const pdfBlob = doc.output('blob');
      triggerMobileDownload(pdfBlob, fileName);
    } else {
      doc.save(fileName);
    }

  } catch (error) {
    console.error('Error exporting to PDF:', error);
    if (error instanceof Error) {
      if (error.message.includes('jsPDF')) {
        throw new Error('PDF generation failed. Please try again or contact support if the issue persists.');
      } else {
        throw new Error('An error occurred while creating the PDF. Please try again.');
      }
    } else {
      throw new Error('An unexpected error occurred while exporting PDF. Please try again.');
    }
  }
};

// Centralized getFileName function (from exportUtils.ts)
export const getFileName = (resumeData: ResumeData, fileExtension: 'pdf' | 'doc'): string => {
    const namePart = resumeData.name.replace(/\s+/g, '_');
    const rolePart = resumeData.targetRole ? `_${resumeData.targetRole.replace(/\s+/g, '_')}` : '';
    return `${namePart}${rolePart}_Resume.${fileExtension}`;
};

// Generate Word document with mobile optimization
export const exportToWord = async (resumeData: ResumeData, userType: UserType = 'experienced'): Promise<void> => {
  const fileName = getFileName(resumeData, 'doc');
  try {
    const htmlContent = generateWordHTMLContent(resumeData, userType);
    console.log('Generated Word HTML Content:', htmlContent); // Temporary log for debugging
    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-word' });
    triggerMobileDownload(blob, fileName);
  } catch (error) {
    console.error('Error exporting to Word:', error);
    throw new Error('Word export failed. Please try again.');
  }
};

const generateWordHTMLContent = (data: ResumeData, userType: UserType = 'experienced'): string => {
  const contactParts: string[] = [];

  const addContactFieldHtml = (label: string, fieldValue?: string | null, fieldType: 'phone' | 'email' | 'url' | 'text' = 'text', linkType?: 'tel' | 'mailto' | 'http') => {
    if (!fieldValue) return;
    const parts = fieldValue.split(/[,|]/).map(p => p.trim());
    const validParts = parts.filter(p => isValidField(p, fieldType));
    if (validParts.length > 0) {
      const content = validParts.map(part => {
        if (linkType === 'tel') return `<a href="tel:${part}" style="color: #2563eb !important; text-decoration: underline !important;">${part}</a>`;
        if (linkType === 'mailto') return `<a href="mailto:${part}" style="color: #2563eb !important; text-decoration: underline !important;">${part}</a>`;
        if (linkType === 'http') return `<a href="${part}" target="_blank" rel="noopener noreferrer" style="color: #2563eb !important; text-decoration: underline !important;">${part}</a>`;
        return part;
      }).join(' | ');
      contactParts.push(`${content}`); // Removed label for cleaner display
    }
  };

  addContactFieldHtml('Phone no', data.phone, 'phone', 'tel');
  addContactFieldHtml('Email', data.email, 'email', 'mailto');
  addContactFieldHtml('LinkedIn', data.linkedin, 'url', 'http');
  addContactFieldHtml('GitHub', data.github, 'url', 'http');
  addContactFieldHtml('Location', data.location, 'text');

  const contactInfo = contactParts.join(' | ');

  const summaryHtml = data.summary ? `
  <div style="margin-top: 5pt;">
    <div class="section-title" style="font-size: 10pt; font-weight: bold; margin-bottom: 4pt; text-transform: uppercase; letter-spacing: 0.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">PROFESSIONAL SUMMARY</div>
    <div class="section-underline" style="border-bottom: 0.5pt solid #808080; margin-bottom: 4pt; height: 1px;"></div>
    <p style="margin-bottom: 12pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 10pt;">${data.summary}</p>
  </div>
` : '';

  const educationHtml = data.education && data.education.length > 0 ? `
    <div style="margin-top: 5pt;">
      <div class="section-title" style="font-size: 10pt; font-weight: bold; margin-bottom: 4pt; text-transform: uppercase; letter-spacing: 0.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">EDUCATION</div>
      <div class="section-underline" style="border-bottom: 0.5pt solid #808080; margin-bottom: 4pt; height: 1px;"></div>
      ${data.education.map(edu => `
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 2pt;">
          <tr>
            <td style="padding: 0; vertical-align: top; text-align: left;">
              <div class="degree" style="font-size: 9.5pt; font-weight: bold; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${edu.degree}</div>
              <div class="school" style="font-size: 9.5pt; font-weight: normal; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${edu.school}${isValidField(edu.location) ? `, ${edu.location}` : ''}</div>
              ${isValidField(edu.cgpa) ? `<div style="font-size: 9.5pt; color: #4B5563; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">CGPA: ${edu.cgpa}</div>` : ''}
            </td>
            <td style="padding: 0; vertical-align: top; text-align: right; white-space: nowrap;">
              <div class="year" style="font-size: 9.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-weight: bold;">${edu.year}</div>
            </td>
          </tr>
        </table>
      `).join('')}
    </div>
  ` : '';

  const workExperienceHtml = data.workExperience && data.workExperience.length > 0 ? `
    <div style="margin-top: 5pt;">
      <div class="section-title" style="font-size: 10pt; font-weight: bold; margin-bottom: 4pt; text-transform: uppercase; letter-spacing: 0.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${userType === 'fresher' ? 'WORK EXPERIENCE' : 'EXPERIENCE'}</div>
      <div class="section-underline" style="border-bottom: 0.5pt solid #808080; margin-bottom: 4pt; height: 1px;"></div>
      ${data.workExperience.map(job => `
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 1pt;">
          <tr>
            <td style="padding: 0; vertical-align: top; text-align: left;">
              <div class="job-title" style="font-size: 9.5pt; font-weight: bold; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${job.role} | ${job.company}${isValidField(job.location) ? `, ${job.location}` : ''}</div>
            </td>
            <td style="padding: 0; vertical-align: top; text-align: right; white-space: nowrap;">
              <div class="year" style="font-size: 9.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-weight: normal;">${job.year}</div>
            </td>
          </tr>
        </table>
        ${job.bullets && job.bullets.length > 0 ? `
          <ul class="bullets" style="margin-left: 5mm; margin-bottom: 6pt; margin-top: 2pt; list-style-type: disc;">
            ${job.bullets.map(bullet => `<li class="bullet" style="font-size: 9.5pt; line-height: 1.4; margin: 0 0 2pt 0; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${bullet}</li>`).join('')}
          </ul>
        ` : ''}
      `).join('')}
    </div>
  ` : '';

  const projectsHtml = data.projects && data.projects.length > 0 ? `
    <div style="margin-top: 5pt;">
      <div class="section-title" style="font-size: 10pt; font-weight: bold; margin-bottom: 4pt; text-transform: uppercase; letter-spacing: 0.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">PROJECTS</div>
      <div class="section-underline" style="border-bottom: 0.5pt solid #808080; margin-bottom: 4pt; height: 1px;"></div>
      ${data.projects.map(project => `
        <div style="margin-bottom: 6pt;">
          <div class="project-title" style="font-size: 9.5pt; font-weight: bold; margin-bottom: 1pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${project.title}</div>
          ${project.bullets && project.bullets.length > 0 ? `
            <ul class="bullets" style="margin-left: 5mm; margin-bottom: 6pt; margin-top: 2pt; list-style-type: disc;">
              ${project.bullets.map(bullet => `<li class="bullet" style="font-size: 9.5pt; line-height: 1.4; margin: 0 0 2pt 0; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${bullet}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
      `).join('')}
    </div>
  ` : '';

  const skillsHtml = data.skills && data.skills.length > 0 ? `
    <div style="margin-top: 5pt;">
      <div class="section-title" style="font-size: 10pt; font-weight: bold; margin-bottom: 4pt; text-transform: uppercase; letter-spacing: 0.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">SKILLS</div>
      <div class="section-underline" style="border-bottom: 0.5pt solid #808080; margin-bottom: 4pt; height: 1px;"></div>
      ${data.skills.map(skill => `
        <div class="skills-item" style="font-size: 9.5pt; margin: 0.5pt 0; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <span class="skill-category" style="font-weight: bold; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${skill.category}:</span> ${skill.list ? skill.list.join(', ') : ''}
        </div>
      `).join('')}
    </div>
  ` : '';

  const certificationsHtml = data.certifications && data.certifications.length > 0 ? `
    <div style="margin-top: 5pt;">
      <div class="section-title" style="font-size: 10pt; font-weight: bold; margin-bottom: 4pt; text-transform: uppercase; letter-spacing: 0.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">CERTIFICATIONS</div>
      <div class="section-underline" style="border-bottom: 0.5pt solid #808080; margin-bottom: 4pt; height: 1px;"></div>
      <ul class="bullets" style="margin-left: 5mm; margin-bottom: 6pt; margin-top: 6pt; list-style-type: disc;">
        ${data.certifications.map(cert => {
          let certText = '';
          if (typeof cert === 'object' && cert !== null && 'title' in cert) {
            const title = `<b style="font-weight: bold;">${cert.title}</b>`;
            const description = 'description' in cert && cert.description ? ` - ${cert.description}` : '';
            certText = `${title}${description}`;
          } else {
            certText = String(cert);
          }
          return `<li class="bullet" style="font-size: 9.5pt; line-height: 1.4; margin: 0 0 2pt 0; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${certText}</li>`;
        }).join('')}
      </ul>
    </div>
  ` : '';

  const achievementsHtml = data.achievements && data.achievements.length > 0 ? `
    <div style="margin-top: 5pt;">
      <div class="section-title" style="font-size: 10pt; font-weight: bold; margin-bottom: 4pt; text-transform: uppercase; letter-spacing: 0.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">ACHIEVEMENTS</div>
      <div class="section-underline" style="border-bottom: 0.5pt solid #808080; margin-bottom: 4pt; height: 1px;"></div>
      <ul class="bullets" style="margin-left: 7.5mm; margin-bottom: 6pt; margin-top: 2pt; list-style-type: disc;">
        ${data.achievements.map(item => `<li class="bullet" style="font-size: 9.5pt; line-height: 1.4; margin: 0 0 2pt 0; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${item}</li>`).join('')}
      </ul>
    </div>
  ` : '';

  let sectionOrderHtml = '';

  const careerObjectiveHtml = data.careerObjective && data.careerObjective.trim() !== '' ? `
  <div style="margin-top: 5pt;">
    <div class="section-title" style="font-size: 10pt; font-weight: bold; margin-bottom: 4pt; text-transform: uppercase; letter-spacing: 0.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">CAREER OBJECTIVE</div>
    <div class="section-underline" style="border-bottom: 0.5pt solid #808080; margin-bottom: 4pt; height: 1px;"></div>
    <p style="margin-bottom: 12pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 10pt;">${data.careerObjective}</p>
  </div>
` : '';


  if (userType === 'experienced') {
    sectionOrderHtml = `
      ${summaryHtml}
      ${workExperienceHtml}
      ${projectsHtml}
      ${skillsHtml}
      ${certificationsHtml}
      ${educationHtml}
    `;
  } else if (userType === 'student') {
    sectionOrderHtml = `
      ${careerObjectiveHtml}
      ${educationHtml}
      ${skillsHtml}
      ${projectsHtml}
      ${workExperienceHtml}
      ${certificationsHtml}
      ${achievementsHtml}
    `;
  } else { // Fresher
    sectionOrderHtml = `
      ${careerObjectiveHtml}
      ${educationHtml}
      ${workExperienceHtml}
      ${projectsHtml}
      ${skillsHtml}
      ${certificationsHtml}
      ${achievementsHtml}
    `;
  }

  return `
    <!DOCTYPE html>
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <meta name="ProgId" content="Word.Document">
      <meta name="Generator" content="Microsoft Word 15">
      <meta name="Originator" content="Microsoft Word 15">
      <title>${data.name} - Resume</title>
      <style>
        @page {
          margin-top: 17.78mm !important; /* ~0.7 inch */
          margin-bottom: 17.78mm !important; /* ~0.7 inch */
          margin-left: 17.78mm !important; /* ~0.7 inch */
          margin-right: 17.78mm !important; /* ~0.7 inch */
        }

        body {
          font-family: "Calibri", sans-serif !important;
          font-size: 10pt !important;
          line-height: 1.25 !important;
          color: #000 !important;
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
        }

        a, a:link, a:visited, a:active {
          color: #2563eb !important;
          text-decoration: underline !important;
          font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
          font-weight: inherit !important;
          font-size: inherit !important;
        }

        a:hover {
          color: #1d4ed8 !important;
          text-decoration: underline !important;
        }

        b, strong {
          font-weight: bold !important;
          color: #000 !important;
        }

        .header {
          text-align: center !important;
          margin-bottom: 6mm !important;
        }
        .name {
          font-size: 18pt !important;
          font-weight: bold !important;
          letter-spacing: 1pt !important;
          margin-bottom: 4pt !important;
          text-transform: uppercase !important;
          font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }
        .contact {
          font-size: 9pt !important;
          margin-bottom: 6pt !important;
          font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }
        .header-line {
          border: none !important;
          border-top: 0.5pt solid #404040 !important;
          margin: 0 0 !important; /* Remove horizontal margin */
          height: 1px !important;
          width: 100% !important; /* Ensure line spans full content width */
        }
        .section-title {
          font-size: 10pt !important;
          font-weight: bold !important;
          margin-top: 10pt !important;
          margin-bottom: 4pt !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5pt !important;
          font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }
        .section-underline {
          border-bottom: 0.5pt solid #808080 !important;
          margin-bottom: 4pt !important;
          height: 1px !important;
        }
        /* Removed .job-header, .edu-header flex styles as they are replaced by table */
        .job-title, .degree {
          font-size: 9.5pt !important;
          font-weight: bold !important;
          font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }
        .company, .school {
          font-size: 9.5pt !important;
          font-weight: normal !important; /* Changed to normal */
          font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }
        .year {
          font-size: 9.5pt !important;
          font-weight: bold !important;
          font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }
        .bullets {
          margin-left: 5mm !important; /* Changed from 4mm to 5mm */
          margin-bottom: 4pt !important;
          margin-top: 2pt !important;
        }
        .bullet {
          font-size: 9.5pt !important;
          line-height: 1.25 !important; /* Changed from 1.4 to 1.25 */
          margin: 0 0 1pt 0 !important; /* Changed from 2pt to 1pt */
          font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }
        .skills-item {
          font-size: 9.5pt !important;
          margin: 1.5pt 0 !important;
          font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }
        .skill-category {
          font-weight: bold !important;
          font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }
        .project-title {
          font-size: 9.5pt !important;
          font-weight: bold !important;
          margin-bottom: 2pt !important;
          font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }

        @media print {
          body { margin: 0 !important; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="name">${data.name.toUpperCase()}</div>
        ${contactInfo ? `<div class="contact">${contactInfo}</div>` : ''}
        
      </div>

      ${sectionOrderHtml}

    </body>
    </html>
  `;
};

