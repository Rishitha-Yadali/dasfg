// src/utils/exportUtils.ts
import jsPDF from 'jspdf';
import { ResumeData, Certification } from '../types/resume';
import { saveAs } from 'file-saver';
import { ExportOptions, defaultExportOptions } from '../types/export';
import { UserType } from '../types/resume';

// ---------- Safety Helpers ----------
const safeSetFont = (
  doc: jsPDF,
  family: string | undefined,
  style: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal'
) => {
  try {
    if (!family) throw new Error('no-family');
    doc.setFont(family, style);
  } catch {
    // Fallback to a built-in font that always exists
    doc.setFont('helvetica', style);
  }
};

const safeGetTextWidth = (doc: jsPDF, text?: string | null): number => {
  if (typeof text !== 'string' || text.length === 0) return 0;
  try {
    return doc.getTextWidth(text);
  } catch {
    return 0;
  }
};

const toSafeText = (v?: unknown): string => (typeof v === 'string' ? v : '');

// ---------- Config ----------
const createPDFConfig = (options: ExportOptions) => {
  const layoutConfig = options.layoutType === 'compact' ? 
    { margins: { top: 10, bottom: 10, left: 15, right: 15 } } : // Adjusted compact margins
    { margins: { top: 15, bottom: 15, left: 20, right: 20 } }; // Adjusted standard margins
  
  const paperConfig = options.paperSize === 'letter' ?
    { pageWidth: 216, pageHeight: 279 } :
    { pageWidth: 210, pageHeight: 297 };

  return {
  // A4 in mm
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

interface PageState {
  currentPage: number;
  currentY: number;
  doc: jsPDF;
}

const isValidField = (
  field?: string | null,
  fieldType: 'phone' | 'email' | 'url' | 'text' = 'text'
): boolean => {
  console.log(`[isValidField] Checking field: "${field}" | type: ${fieldType}`);
  let result = true;

  if (!field || field.trim() === '') {
    result = false;
  } else {
    const lower = field.trim().toLowerCase();
    const invalidValues = ['n/a', 'not specified', 'none'];
    if (invalidValues.includes(lower)) {
      result = false;
    } else {
      switch (fieldType) {
        case 'phone': {
          const digitCount = (field.match(/\d/g) || []).length;
          result = digitCount >= 7 && digitCount <= 15; // More reasonable phone number length
          break;
        }
        case 'email':
          result = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field);
          break;
        case 'url':
          // Accept URLs with or without protocol, and common social media patterns
          result = /^https?:\/\//.test(field) || 
                   /^(www\.)?linkedin\.com\/in\//.test(field) ||
                   /^(www\.)?github\.com\//.test(field) ||
                   /linkedin\.com\/in\//.test(field) ||
                   /github\.com\//.test(field);
          break;
        case 'text':
        default:
          result = true;
          break;
      }
    }
  }
  
  console.log(`[isValidField] Result for "${field}": ${result}`);
  return result;
};

const isMobileDevice = (): boolean =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

const triggerMobileDownload = (blob: Blob, filename: string): void => {
  try {
    if (isMobileDevice()) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else {
      saveAs(blob, filename);
    }
  } catch (error) {
    console.error('Download failed:', error);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};

function checkPageSpace(state: PageState, requiredHeight: number, PDF_CONFIG: any): boolean {
  const maxY = PDF_CONFIG.pageHeight - PDF_CONFIG.margins.bottom;
  return state.currentY + requiredHeight <= maxY;
}

function addNewPage(state: PageState, PDF_CONFIG: any): void {
  state.doc.addPage();
  state.currentPage++;
  state.currentY = PDF_CONFIG.margins.top;

  const pageText = `Page ${state.currentPage}`;
  safeSetFont(state.doc, PDF_CONFIG.fontFamily, 'normal');
  state.doc.setFontSize(9);
  state.doc.setTextColor(128, 128, 128);

  const pageWidth = state.doc.internal.pageSize.getWidth();
  const textWidth = safeGetTextWidth(state.doc, pageText);
  state.doc.text(
    pageText,
    pageWidth - PDF_CONFIG.margins.right - textWidth,
    PDF_CONFIG.pageHeight - PDF_CONFIG.margins.bottom / 2
  );
}

// Points -> mm factor for height estimation
const PT_TO_MM = 0.352778;

// Draw text with wrapping
function drawText(
  state: PageState,
  text: string,
  x: number,
  PDF_CONFIG: any,
  options: {
    fontSize?: number;
    fontWeight?: 'normal' | 'bold' | 'italic' | 'bolditalic';
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
    align = 'left',
  } = options;

  safeSetFont(state.doc, PDF_CONFIG.fontFamily, fontWeight);
  state.doc.setFontSize(fontSize);
  state.doc.setTextColor(color[0], color[1], color[2]);

  const safe = text ?? '';
  const lines = state.doc.splitTextToSize(safe, maxWidth);
  const lineHeight = fontSize * PDF_CONFIG.spacing.lineHeight * PT_TO_MM;
  const totalHeight = lines.length * lineHeight;

  if (!checkPageSpace(state, totalHeight, PDF_CONFIG)) addNewPage(state, PDF_CONFIG);

  let textX = x;
  if (align === 'center') textX = PDF_CONFIG.margins.left + PDF_CONFIG.contentWidth / 2;
  if (align === 'right') textX = PDF_CONFIG.margins.left + PDF_CONFIG.contentWidth;

  lines.forEach((line: string, index: number) => {
    const yPos = state.currentY + index * lineHeight;
    if (align === 'center') {
      const lineWidth = safeGetTextWidth(state.doc, line);
      state.doc.text(line, textX - lineWidth / 2, yPos);
    } else if (align === 'right') {
      const lineWidth = safeGetTextWidth(state.doc, line);
      state.doc.text(line, textX - lineWidth, yPos);
    } else {
      state.doc.text(line, textX, yPos);
    }
  });

  state.currentY += totalHeight;
  return totalHeight;
}

function drawSectionTitle(state: PageState, title: string, PDF_CONFIG: any): number {
  state.currentY += 1;
  const estimatedHeight =
    PDF_CONFIG.fonts.sectionTitle.size * PDF_CONFIG.spacing.lineHeight * PT_TO_MM + 2;

  if (!checkPageSpace(state, estimatedHeight, PDF_CONFIG)) addNewPage(state, PDF_CONFIG);

  const titleHeight = drawText(
    state,
    (title || '').toUpperCase(),
    PDF_CONFIG.margins.left,
    PDF_CONFIG,
    {
      fontSize: PDF_CONFIG.fonts.sectionTitle.size,
      fontWeight: PDF_CONFIG.fonts.sectionTitle.weight,
      color: PDF_CONFIG.colors.primary,
    }
  );

  const underlineY = state.currentY - PDF_CONFIG.fonts.sectionTitle.size * 0.3;
  state.doc.setDrawColor(128, 128, 128);
  state.doc.setLineWidth(0.5);
  state.doc.line(
    PDF_CONFIG.margins.left,
    underlineY,
    PDF_CONFIG.margins.left + PDF_CONFIG.contentWidth,
    underlineY
  );
  state.currentY += PDF_CONFIG.spacing.sectionSpacingAfter;
  return (
    titleHeight +
    PDF_CONFIG.spacing.sectionSpacingBefore +
    PDF_CONFIG.spacing.sectionSpacingAfter
  );
}

// Contact info (centered)
function drawContactInfo(state: PageState, resumeData: ResumeData, PDF_CONFIG: any): number {
  console.log('[drawContactInfo] Received resumeData:', resumeData);
  console.log('[drawContactInfo] Individual contact fields:');
  console.log('  - location:', resumeData.location);
  console.log('  - phone:', resumeData.phone);
  console.log('  - email:', resumeData.email);
  console.log('  - linkedin:', resumeData.linkedin);
  console.log('  - github:', resumeData.github);
  
  const contactParts: { value: string; type: 'phone' | 'email' | 'url' | 'text' }[] = [];

  const add = (
    fieldValue: string | null | undefined,
    fieldType: 'phone' | 'email' | 'url' | 'text' = 'text'
  ) => {
    console.log(`[drawContactInfo] Adding field: "${fieldValue}" | type: ${fieldType}`);
    const safeFieldValue = toSafeText(fieldValue);
    if (!safeFieldValue) return;

    let processedValue = safeFieldValue;
    if (fieldType === 'url' && !safeFieldValue.startsWith('http')) {
      processedValue = `https://${safeFieldValue}`; // Prepend https if missing
    }
    
    if (isValidField(processedValue, fieldType)) { // Line 163
      contactParts.push({ value: processedValue, type: fieldType });
      console.log(`[drawContactInfo] Successfully added: "${processedValue}"`);
    } else {
      console.log(`[drawContactInfo] Field rejected by validation: "${processedValue}"`);
    }
  };

  add(resumeData.phone, 'phone');
  add(resumeData.email, 'email');
  add(resumeData.location, 'text');
  add(resumeData.linkedin, 'url');
  add(resumeData.github, 'url');

  if (contactParts.length === 0) return 0;
  const contactText = contactParts.map(part => part.value).join(' | ');
  console.log('[drawContactInfo] Final contact text:', contactText);
  
  const height = drawText(state, contactText, PDF_CONFIG.margins.left, PDF_CONFIG, {
    fontSize: PDF_CONFIG.fonts.contact.size,
    fontWeight: PDF_CONFIG.fonts.contact.weight,
    color: PDF_CONFIG.colors.primary,
    align: 'center',
  });

  state.currentY += PDF_CONFIG.spacing.afterContact;
  return height + PDF_CONFIG.spacing.afterContact;
}

function drawWorkExperience(
  state: PageState,
  workExperience: any[] = [],
  userType: UserType = 'experienced',
  PDF_CONFIG: any
): number {
  if (!workExperience || workExperience.length === 0) return 0;
  const sectionTitle = userType === 'fresher' ? 'WORK EXPERIENCE' : 'EXPERIENCE';
  let totalHeight = drawSectionTitle(state, sectionTitle, PDF_CONFIG);

  workExperience.forEach((job, index) => {
    const role = toSafeText(job?.role);
    const company = toSafeText(job?.company);
    const location = isValidField(job?.location) ? `, ${job.location}` : '';
    const combinedTitle =
      (role || company) ? `${role}${role && company ? ' | ' : ''}${company}${location}` : '';
    const yearText = isValidField(job?.year) ? String(job.year) : '';

    const estimatedHeader = PDF_CONFIG.fonts.jobTitle.size * PDF_CONFIG.spacing.lineHeight * PT_TO_MM;
    const estimatedBullet = PDF_CONFIG.fonts.body.size * PDF_CONFIG.spacing.lineHeight * PT_TO_MM;
    const minBlock =
      estimatedHeader +
      estimatedBullet +
      PDF_CONFIG.spacing.bulletListSpacing * 2 +
      PDF_CONFIG.spacing.afterSubsection;

    if (!checkPageSpace(state, minBlock, PDF_CONFIG)) addNewPage(state, PDF_CONFIG);

    const initialY = state.currentY;

    // Right-aligned year
    safeSetFont(state.doc, PDF_CONFIG.fontFamily, 'bold');
    state.doc.setFontSize(PDF_CONFIG.fonts.year.size);
    state.doc.setTextColor(
      PDF_CONFIG.colors.primary[0],
      PDF_CONFIG.colors.primary[1],
      PDF_CONFIG.colors.primary[2]
    );
    const yearWidth = safeGetTextWidth(state.doc, yearText);
    const yearX = PDF_CONFIG.margins.left + PDF_CONFIG.contentWidth - yearWidth;
    const yearY = initialY + PDF_CONFIG.fonts.jobTitle.size * PT_TO_MM * 0.5;
    if (yearText) state.doc.text(yearText, yearX, yearY);

    // Title line
    safeSetFont(state.doc, PDF_CONFIG.fontFamily, PDF_CONFIG.fonts.jobTitle.weight);
    drawText(state, combinedTitle, PDF_CONFIG.margins.left, PDF_CONFIG, {
      fontSize: PDF_CONFIG.fonts.jobTitle.size,
      fontWeight: PDF_CONFIG.fonts.jobTitle.weight,
      maxWidth: PDF_CONFIG.contentWidth - yearWidth - 5,
    });

    state.currentY += PDF_CONFIG.spacing.bulletListSpacing;

    const validBullets =
      Array.isArray(job?.bullets) ? job.bullets.filter((b: string) => isValidField(b)) : [];
    if (validBullets.length > 0) {
      state.currentY += PDF_CONFIG.spacing.bulletListSpacing;
      validBullets.forEach((bullet: string) => {
        const bulletText = `• ${bullet}`;
        const bulletHeight = drawText(
          state,
          bulletText,
          PDF_CONFIG.margins.left + PDF_CONFIG.spacing.bulletIndent,
          PDF_CONFIG,
          {
            fontSize: PDF_CONFIG.fonts.body.size,
            maxWidth: PDF_CONFIG.contentWidth - PDF_CONFIG.spacing.bulletIndent,
          }
        );
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

function drawEducation(state: PageState, education: any[] = [], PDF_CONFIG: any): number {
  if (!education || education.length === 0) return 0;
  let totalHeight = drawSectionTitle(state, 'EDUCATION', PDF_CONFIG);

  education.forEach((edu, index) => {
    if (!checkPageSpace(state, 20, PDF_CONFIG)) addNewPage(state, PDF_CONFIG);

    const degree = toSafeText(edu?.degree);
    const school = toSafeText(edu?.school);
    const loc = isValidField(edu?.location) ? `, ${edu.location}` : '';
    const year = isValidField(edu?.year) ? String(edu.year) : '';
    const cgpa = isValidField(edu?.cgpa) ? `CGPA: ${edu.cgpa}` : '';

    const initialY = state.currentY;

    const degreeHeight = drawText(state, degree, PDF_CONFIG.margins.left, PDF_CONFIG, {
      fontSize: PDF_CONFIG.fonts.jobTitle.size,
      fontWeight: PDF_CONFIG.fonts.jobTitle.weight,
    });

    const schoolHeight = drawText(
      state,
      `${school}${loc}`,
      PDF_CONFIG.margins.left,
      PDF_CONFIG,
      {
        fontSize: PDF_CONFIG.fonts.company.size,
        fontWeight: 'normal',
        color: PDF_CONFIG.colors.primary,
      }
    );

    let cgpaHeight = 0;
    if (cgpa) {
      cgpaHeight = drawText(state, cgpa, PDF_CONFIG.margins.left, PDF_CONFIG, {
        fontSize: PDF_CONFIG.fonts.body.size,
        fontWeight: PDF_CONFIG.fonts.body.weight,
        color: PDF_CONFIG.colors.secondary,
      });
    }

    const validCourses = Array.isArray(edu?.relevantCoursework)
      ? edu.relevantCoursework.filter((c: string) => isValidField(c))
      : [];
    if (validCourses.length > 0) {
      const courseworkText = `Relevant Coursework: ${validCourses.join(', ')}`;
      const courseworkHeight = drawText(
        state,
        courseworkText,
        PDF_CONFIG.margins.left,
        PDF_CONFIG,
        {
          fontSize: PDF_CONFIG.fonts.body.size,
          fontWeight: PDF_CONFIG.fonts.body.weight,
          color: PDF_CONFIG.colors.secondary,
          maxWidth: PDF_CONFIG.contentWidth,
        }
      );
      totalHeight += courseworkHeight;
    }

    safeSetFont(state.doc, PDF_CONFIG.fontFamily, 'bold'); // Line 272
    state.doc.setFontSize(PDF_CONFIG.fonts.year.size);
    state.doc.setTextColor(
      PDF_CONFIG.colors.primary[0],
      PDF_CONFIG.colors.primary[1],
      PDF_CONFIG.colors.primary[2]
    );
    const yearWidth = safeGetTextWidth(state.doc, year);
    const yearX = PDF_CONFIG.margins.left + PDF_CONFIG.contentWidth - yearWidth;
    const yearY = initialY + PDF_CONFIG.fonts.jobTitle.size * PT_TO_MM * 0.5;
    if (year) state.doc.text(year, yearX, yearY);

    totalHeight += degreeHeight + schoolHeight + cgpaHeight;

    if (index < education.length - 1) {
      state.currentY += 1;
      totalHeight += 1;
    }
  });

  return totalHeight;
}

function drawProjects(state: PageState, projects: any[] = [], PDF_CONFIG: any): number {
  if (!projects || projects.length === 0) return 0;
  let totalHeight = drawSectionTitle(state, 'PROJECTS', PDF_CONFIG);

  projects.forEach((project, index) => {
    if (!checkPageSpace(state, 25, PDF_CONFIG)) addNewPage(state, PDF_CONFIG);

    const title = toSafeText(project?.title);
    const titleHeight = drawText(state, title, PDF_CONFIG.margins.left, PDF_CONFIG, {
      fontSize: PDF_CONFIG.fonts.jobTitle.size,
      fontWeight: PDF_CONFIG.fonts.jobTitle.weight,
    });
    totalHeight += titleHeight;
    state.currentY += PDF_CONFIG.spacing.bulletListSpacing;

    const validBullets =
      Array.isArray(project?.bullets) ? project.bullets.filter((b: string) => isValidField(b)) : [];
    if (validBullets.length > 0) {
      state.currentY += PDF_CONFIG.spacing.bulletListSpacing;
      validBullets.forEach((bullet: string) => {
        const bulletText = `• ${bullet}`;
        const bulletHeight = drawText(
          state,
          bulletText,
          PDF_CONFIG.margins.left + PDF_CONFIG.spacing.bulletIndent,
          PDF_CONFIG,
          {
            fontSize: PDF_CONFIG.fonts.body.size,
            maxWidth: PDF_CONFIG.contentWidth - PDF_CONFIG.spacing.bulletIndent,
          }
        );
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

function drawSkills(state: PageState, skills: any[] = [], PDF_CONFIG: any): number {
  const validSkills = Array.isArray(skills)
    ? skills.filter(
        (skill) =>
          isValidField(skill?.category) &&
          Array.isArray(skill?.list) &&
          skill.list.filter((item: string) => isValidField(item)).length > 0
      )
    : [];

  if (validSkills.length === 0) return 0;

  let totalHeight = drawSectionTitle(state, 'SKILLS', PDF_CONFIG);
  const estLine = PDF_CONFIG.fonts.body.size * PDF_CONFIG.spacing.lineHeight * PT_TO_MM;

  validSkills.forEach((skill, i) => { // Line 343
    if (!checkPageSpace(state, 15, PDF_CONFIG)) addNewPage(state, PDF_CONFIG);

    const x = PDF_CONFIG.margins.left;
    const categoryText = `${skill.category}: `;
    const validList = skill.list.filter((item: string) => isValidField(item));
    const listText = validList.join(', ');

    safeSetFont(state.doc, PDF_CONFIG.fontFamily, 'bold');
    state.doc.setFontSize(PDF_CONFIG.fonts.body.size);
    state.doc.setTextColor(
      PDF_CONFIG.colors.primary[0],
      PDF_CONFIG.colors.primary[1],
      PDF_CONFIG.colors.primary[2]
    ); // Line 354

    const categoryWidth = safeGetTextWidth(state.doc, categoryText);
    state.doc.text(categoryText, x, state.currentY);

    safeSetFont(state.doc, PDF_CONFIG.fontFamily, 'normal');
    const remainingWidth = PDF_CONFIG.contentWidth - categoryWidth;
    const lines = state.doc.splitTextToSize(listText, remainingWidth);

    lines.forEach((line: string, lineIndex: number) => {
      if (lineIndex === 0) {
        state.doc.text(line, x + categoryWidth, state.currentY);
      } else {
        state.doc.text(line, x, state.currentY + lineIndex * estLine);
      }
    });

    state.currentY += lines.length * estLine;
    totalHeight += lines.length * estLine;

    if (i < validSkills.length - 1) {
      state.currentY += 1;
      totalHeight += 1;
    }
  });

  return totalHeight;
}

function drawCertifications(
  state: PageState,
  certifications: (string | Certification)[] = [],
  PDF_CONFIG: any
): number {
  const validCerts = Array.isArray(certifications)
    ? certifications.filter((cert) => {
        if (typeof cert === 'string') return isValidField(cert);
        if (typeof cert === 'object' && cert !== null) return isValidField((cert as any).title);
        return false;
      })
    : [];

  if (validCerts.length === 0) return 0;

  let totalHeight = drawSectionTitle(state, 'CERTIFICATIONS', PDF_CONFIG);

  validCerts.forEach((cert) => { // Line 400
    if (!checkPageSpace(state, 10, PDF_CONFIG)) addNewPage(state, PDF_CONFIG);

    if (typeof cert === 'object' && cert !== null && (cert as any).title) {
      const titleText = `• ${(cert as any).title}`;
      const titleHeight = drawText(
        state,
        titleText,
        PDF_CONFIG.margins.left + PDF_CONFIG.spacing.bulletIndent,
        PDF_CONFIG,
        {
          fontWeight: 'bold',
          maxWidth: PDF_CONFIG.contentWidth - PDF_CONFIG.spacing.bulletIndent,
        }
      );
      totalHeight += titleHeight;

      if (isValidField((cert as any).description)) {
        state.currentY += 1;
        const descHeight = drawText(
          state,
          (cert as any).description,
          PDF_CONFIG.margins.left + PDF_CONFIG.spacing.bulletIndent * 2,
          PDF_CONFIG,
          {
            maxWidth: PDF_CONFIG.contentWidth - PDF_CONFIG.spacing.bulletIndent * 2,
          }
        );
        totalHeight += descHeight + 1;
      }
    } else {
      const bulletText = `• ${String(cert)}`;
      const certHeight = drawText(
        state,
        bulletText,
        PDF_CONFIG.margins.left + PDF_CONFIG.spacing.bulletIndent,
        PDF_CONFIG,
        {
          fontSize: PDF_CONFIG.fonts.body.size,
          maxWidth: PDF_CONFIG.contentWidth - PDF_CONFIG.spacing.bulletIndent,
        }
      );
      totalHeight += certHeight;
    }
    state.currentY += PDF_CONFIG.spacing.bulletListSpacing;
  });

  return totalHeight;
}

function drawProfessionalSummary(state: PageState, summary: string, PDF_CONFIG: any): number {
  if (!isValidField(summary)) return 0;
  let totalHeight = drawSectionTitle(state, 'PROFESSIONAL SUMMARY', PDF_CONFIG);
  const summaryHeight = drawText(state, summary, PDF_CONFIG.margins.left, PDF_CONFIG, {
    fontSize: PDF_CONFIG.fonts.body.size,
    fontWeight: PDF_CONFIG.fonts.body.weight,
    maxWidth: PDF_CONFIG.contentWidth,
  });
  totalHeight += summaryHeight;
  state.currentY += 3;
  return totalHeight;
}

function drawCareerObjective(state: PageState, objective: string, PDF_CONFIG: any): number {
  if (!isValidField(objective)) return 0;
  let totalHeight = drawSectionTitle(state, 'CAREER OBJECTIVE', PDF_CONFIG);
  state.currentY += 0;
  const objectiveHeight = drawText(state, objective, PDF_CONFIG.margins.left, PDF_CONFIG, {
    fontSize: PDF_CONFIG.fonts.body.size,
    fontWeight: PDF_CONFIG.fonts.body.weight,
    maxWidth: PDF_CONFIG.contentWidth,
  });
  totalHeight += objectiveHeight;
  state.currentY += 0;
  return totalHeight;
}

function drawAchievementsAndExtras(
  state: PageState,
  resumeData: ResumeData,
  PDF_CONFIG: any
): number {
  const validAchievements = Array.isArray(resumeData.achievements)
    ? resumeData.achievements.filter((a) => isValidField(a))
    : [];
  if (validAchievements.length === 0) return 0;

  let totalHeight = drawSectionTitle(state, 'ACHIEVEMENTS', PDF_CONFIG);
  validAchievements.forEach((item) => {
    if (!checkPageSpace(state, 10, PDF_CONFIG)) addNewPage(state, PDF_CONFIG);
    const itemHeight = drawText(
      state,
      `• ${item}`,
      PDF_CONFIG.margins.left + PDF_CONFIG.spacing.bulletIndent,
      PDF_CONFIG,
      {
        fontSize: PDF_CONFIG.fonts.body.size,
        maxWidth: PDF_CONFIG.contentWidth - PDF_CONFIG.spacing.bulletIndent,
      }
    );
    totalHeight += itemHeight;
  });
  state.currentY += 2;
  return totalHeight;
}

// ---------- Main: PDF ----------
export const exportToPDF = async (
  resumeData: ResumeData,
  userType: UserType = 'experienced',
  options: ExportOptions = defaultExportOptions
): Promise<void> => {
  const PDF_CONFIG = createPDFConfig(options);
  try {
    if (isMobileDevice()) {
      console.log('Starting PDF generation for mobile device...');
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const state: PageState = { currentPage: 1, currentY: PDF_CONFIG.margins.top, doc };

    // Safe properties
    doc.setProperties({
      title: `${toSafeText(resumeData.name)} - Resume`,
      subject: 'Professional Resume',
      author: toSafeText(resumeData.name),
      creator: 'Resume Optimizer',
      producer: 'Resume Optimizer PDF Generator',
    });

    // Header (Name + Contact)
    state.currentY = PDF_CONFIG.spacing.nameFromTop;
    drawText(state, (resumeData.name || '').toUpperCase(), PDF_CONFIG.margins.left, PDF_CONFIG, {
      fontSize: PDF_CONFIG.fonts.name.size,
      fontWeight: PDF_CONFIG.fonts.name.weight,
      align: 'center',
    });
    state.currentY += PDF_CONFIG.spacing.afterName;

    drawContactInfo(state, resumeData, PDF_CONFIG);
    state.currentY += PDF_CONFIG.spacing.entrySpacing * 0.5; // Use configured spacing

    // Summary / Objective
    if ((userType === 'fresher' || userType === 'student') && isValidField(resumeData.careerObjective)) {
      drawCareerObjective(state, resumeData.careerObjective!, PDF_CONFIG);
    } else if (isValidField(resumeData.summary)) {
      drawProfessionalSummary(state, resumeData.summary!, PDF_CONFIG);
    }

    // Sections by userType
    if (userType === 'experienced') {
      drawWorkExperience(state, resumeData.workExperience, userType, PDF_CONFIG);
      drawProjects(state, resumeData.projects, PDF_CONFIG);
      drawSkills(state, resumeData.skills, PDF_CONFIG);
      drawCertifications(state, resumeData.certifications as any[], PDF_CONFIG);
      drawEducation(state, resumeData.education, PDF_CONFIG);
    } else if (userType === 'student') {
      drawEducation(state, resumeData.education, PDF_CONFIG);
      drawSkills(state, resumeData.skills, PDF_CONFIG);
      drawProjects(state, resumeData.projects, PDF_CONFIG);
      drawWorkExperience(state, resumeData.workExperience, userType, PDF_CONFIG);
      drawCertifications(state, resumeData.certifications as any[], PDF_CONFIG);
      drawAchievementsAndExtras(state, resumeData, PDF_CONFIG);
    } else {
      // Fresher
      drawEducation(state, resumeData.education, PDF_CONFIG);
      drawWorkExperience(state, resumeData.workExperience, userType, PDF_CONFIG);
      drawProjects(state, resumeData.projects, PDF_CONFIG);
      drawSkills(state, resumeData.skills, PDF_CONFIG);
      drawCertifications(state, resumeData.certifications as any[], PDF_CONFIG);
      drawAchievementsAndExtras(state, resumeData, PDF_CONFIG);
    }

    // Footer (Page X of Y)
    const totalPages = state.currentPage;
    if (totalPages > 1) {
      for (let i = 1; i <= totalPages; i++) {
        if (i > 1) doc.setPage(i); // Line 512
        const pageText = `Page ${i} of ${totalPages}`;
        safeSetFont(doc, PDF_CONFIG.fontFamily, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        const textWidth = safeGetTextWidth(doc, pageText);
        doc.text(
          pageText,
          PDF_CONFIG.pageWidth / 2 - textWidth / 2,
          PDF_CONFIG.pageHeight - PDF_CONFIG.margins.bottom / 2
        );
      }
    }

    const fileName = getFileName(resumeData, 'pdf');
    if (isMobileDevice()) {
      const pdfBlob = doc.output('blob');
      triggerMobileDownload(pdfBlob, fileName);
    } else {
      doc.save(fileName);
    }
  } catch (error: any) {
    console.error('Error exporting to PDF (raw):', error);
    if (error?.message?.includes('jsPDF')) {
      throw new Error(
        `PDF generation failed inside jsPDF: ${error.message}. Try a different font or reduce content.`
      );
    }
    throw new Error(
      `An error occurred while creating the PDF. ${error?.message ? `Details: ${error.message}` : ''
      }`
    );
  }
};

// ---------- Filename Helper ----------
export const getFileName = (
  resumeData: ResumeData,
  fileExtension: 'pdf' | 'doc'
): string => {
  const namePart =
    toSafeText(resumeData.name).replace(/\s+/g, '') || 'Resume';

  const rolePart = resumeData.targetRole
    ? toSafeText(resumeData.targetRole).replace(/\s+/g, '')
    : '';

  return rolePart
    ? `${namePart}_${rolePart}.${fileExtension}`
    : `${namePart}.${fileExtension}`;
};



// ---------- Word Export ----------
export const exportToWord = async (
  resumeData: ResumeData,
  userType: UserType = 'experienced'
): Promise<void> => {
  const fileName = getFileName(resumeData, 'doc');
  try {
    const htmlContent = generateWordHTMLContent(resumeData, userType);
    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-word' });
    triggerMobileDownload(blob, fileName);
  } catch (error) {
    console.error('Error exporting to Word:', error);
    throw new Error('Word export failed. Please try again.');
  }
};

const generateWordHTMLContent = (
  data: ResumeData,
  userType: UserType = 'experienced'
): string => {
  const contactParts: string[] = [];

  const addContactFieldHtml = (
    label: string,
    fieldValue?: string | null,
    fieldType: 'phone' | 'email' | 'url' | 'text' = 'text',
    linkType?: 'tel' | 'mailto' | 'http'
  ) => {
    const safeFieldValue = toSafeText(fieldValue);
    if (!safeFieldValue) return;

    let processedValue = safeFieldValue;
    if (fieldType === 'url' && !safeFieldValue.startsWith('http')) {
      processedValue = `https://${safeFieldValue}`; // Prepend https if missing
    }

    if (isValidField(processedValue, fieldType)) {
      const content = `<a href="${linkType === 'tel' ? 'tel:' : linkType === 'mailto' ? 'mailto:' : ''}${processedValue}" ${linkType === 'http' ? 'target="_blank" rel="noopener noreferrer"' : ''} style="color: #2563eb !important; text-decoration: underline !important;">${processedValue}</a>`;
      contactParts.push(`<b>${label}:</b> <b>${content}</b>`);
    }
  };

  addContactFieldHtml('Phone no', data.phone, 'phone', 'tel');
  addContactFieldHtml('Email', data.email, 'email', 'mailto');
  addContactFieldHtml('LinkedIn', data.linkedin, 'url', 'http');
  addContactFieldHtml('GitHub', data.github, 'url', 'http');
  addContactFieldHtml('Location', data.location, 'text');

  if (contactParts.length === 0) return ''; // Return empty string if no valid contact info
  const contactInfo = contactParts.join(' | ');

  const summaryHtml =
    data.summary && data.summary.trim() !== ''
      ? `
  <div style="margin-top: 5pt;">
    <div class="section-title" style="font-size: 10pt; font-weight: bold; margin-bottom: 4pt; text-transform: uppercase; letter-spacing: 0.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">PROFESSIONAL SUMMARY</div>
    <div class="section-underline" style="border-bottom: 0.5pt solid #808080; margin-bottom: 4pt; height: 1px;"></div>
    <p style="margin-bottom: 12pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 10pt;">${data.summary}</p>
  </div>`
      : '';

  const educationHtml =
    data.education && data.education.length > 0
      ? `
    <div style="margin-top: 5pt;">
      <div class="section-title" style="font-size: 10pt; font-weight: bold; margin-bottom: 4pt; text-transform: uppercase; letter-spacing: 0.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">EDUCATION</div>
      <div class="section-underline" style="border-bottom: 0.5pt solid #808080; margin-bottom: 4pt; height: 1px;"></div>
      ${data.education
        .map(
          (edu) => `
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 2pt;">
          <tr>
            <td style="padding: 0; vertical-align: top; text-align: left;">
              <div class="degree" style="font-size: 9.5pt; font-weight: bold; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${edu.degree || ''}</div>
              <div class="school" style="font-size: 9.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${edu.school || ''}${isValidField(edu.location) ? `, ${edu.location}` : ''}</div>

              ${
                isValidField(edu.cgpa)
                  ? `<div style="font-size: 9.5pt; color: #4B5563; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">CGPA: ${edu.cgpa}</div>`
                  : ''
              }
              ${
                (edu as any).relevantCoursework && (edu as any).relevantCoursework.length > 0
                  ? `<div style="font-size: 9.5pt; color: #4B5563; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Relevant Coursework: ${(edu as any).relevantCoursework.join(
                      ', '
                    )}</div>`
                  : ''
              }
            </td>
            <td style="padding: 0; vertical-align: top; text-align: right; white-space: nowrap;">
              <div class="year" style="font-size: 9.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-weight: bold;">${
                edu.year || ''
              }</div>
            </td>
          </tr>
        </table>`
        )
        .join('')}
    </div>`
      : '';

  const workExperienceHtml =
    data.workExperience && data.workExperience.length > 0
      ? `
    <div style="margin-top: 5pt;">
      <div class="section-title" style="font-size: 10pt; font-weight: bold; margin-bottom: 4pt; text-transform: uppercase; letter-spacing: 0.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${
        userType === 'fresher' ? 'WORK EXPERIENCE' : 'EXPERIENCE'
      }</div>
      <div class="section-underline" style="border-bottom: 0.5pt solid #808080; margin-bottom: 4pt; height: 1px;"></div>
      ${data.workExperience
        .map(
          (job) => `
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 1pt;">
          <tr>
            <td style="padding: 0; vertical-align: top; text-align: left;">
              <div class="job-title" style="font-size: 9.5pt; font-weight: bold; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${
                job.role || ''
              } | ${job.company || ''}${isValidField(job.location) ? `, ${job.location}` : ''}</div>
            </td>
            <td style="padding: 0; vertical-align: top; text-align: right; white-space: nowrap;">
              <div class="year" style="font-size: 9.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-weight: bold;">${
                job.year || ''
              }</div>
            </td>
          </tr>
        </table>
        ${
          job.bullets && job.bullets.length > 0
            ? `
          <ul class="bullets" style="margin-left: 5mm; margin-bottom: 6pt; margin-top: 2pt; list-style-type: disc;">
            ${job.bullets
              .map(
                (bullet) =>
                  `<li class="bullet" style="font-size: 9.5pt; line-height: 1.4; margin: 0 0 2pt 0; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${bullet}</li>`
              )
              .join('')}
          </ul>`
            : ''
        }`
        )
        .join('')}
    </div>`
      : '';

  const projectsHtml =
    data.projects && data.projects.length > 0
      ? `
    <div style="margin-top: 5pt;">
      <div class="section-title" style="font-size: 10pt; font-weight: bold; margin-bottom: 4pt; text-transform: uppercase; letter-spacing: 0.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">PROJECTS</div>
      <div class="section-underline" style="border-bottom: 0.5pt solid #808080; margin-bottom: 4pt; height: 1px;"></div>
      ${data.projects
        .map(
          (project) => `
        <div style="margin-bottom: 6pt;">
          <div class="project-title" style="font-size: 9.5pt; font-weight: bold; margin-bottom: 1pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${
            project.title || ''
          }</div>
          ${
            project.bullets && project.bullets.length > 0
              ? `
            <ul class="bullets" style="margin-left: 5mm; margin-bottom: 6pt; margin-top: 2pt; list-style-type: disc;">
              ${project.bullets
                .map(
                  (bullet) =>
                    `<li class="bullet" style="font-size: 9.5pt; line-height: 1.4; margin: 0 0 2pt 0; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${bullet}</li>`
                )
                .join('')}
            </ul>`
              : ''
          }
        </div>`
        )
        .join('')}
    </div>`
      : '';

  const skillsHtml =
    data.skills && data.skills.length > 0
      ? `
    <div style="margin-top: 5pt;">
      <div class="section-title" style="font-size: 10pt; font-weight: bold; margin-bottom: 4pt; text-transform: uppercase; letter-spacing: 0.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">SKILLS</div>
      <div class="section-underline" style="border-bottom: 0.5pt solid #808080; margin-bottom: 4pt; height: 1px;"></div>
      ${data.skills
        .map(
          (skill) => `
        <div class="skills-item" style="font-size: 9.5pt; margin: 0.5pt 0; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <span class="skill-category" style="font-weight: bold; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${
            skill.category || ''
          }:</span> ${skill.list ? skill.list.join(', ') : ''}
        </div>`
        )
        .join('')}
    </div>`
      : '';

  const certificationsHtml =
    data.certifications && data.certifications.length > 0
      ? `
    <div style="margin-top: 5pt;">
      <div class="section-title" style="font-size: 10pt; font-weight: bold; margin-bottom: 4pt; text-transform: uppercase; letter-spacing: 0.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">CERTIFICATIONS</div>
      <div class="section-underline" style="border-bottom: 0.5pt solid #808080; margin-bottom: 4pt; height: 1px;"></div>
      <ul class="bullets" style="margin-left: 5mm; margin-bottom: 6pt; margin-top: 6pt; list-style-type: disc;">
        ${data.certifications
          .map((cert) => {
            let certText = '';
            if (typeof cert === 'object' && cert !== null && (cert as any).title) {
              const title = `<b style="font-weight: bold;">${(cert as any).title}</b>`;
              const description = (cert as any).description ? ` - ${(cert as any).description}` : '';
              certText = `${title}${description}`;
            } else {
              certText = String(cert);
            }
            return `<li class="bullet" style="font-size: 9.5pt; line-height: 1.4; margin: 0 0 2pt 0; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${certText}</li>`;
          })
          .join('')}
      </ul>
    </div>`
      : '';

  const achievementsHtml =
    data.achievements && data.achievements.length > 0
      ? `
    <div style="margin-top: 5pt;">
      <div class="section-title" style="font-size: 10pt; font-weight: bold; margin-bottom: 4pt; text-transform: uppercase; letter-spacing: 0.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">ACHIEVEMENTS</div>
      <div class="section-underline" style="border-bottom: 0.5pt solid #808080; margin-bottom: 4pt; height: 1px;"></div>
      <ul class="bullets" style="margin-left: 7.5mm; margin-bottom: 6pt; margin-top: 2pt; list-style-type: disc;">
        ${data.achievements
          .map(
            (item) =>
              `<li class="bullet" style="font-size: 9.5pt; line-height: 1.4; margin: 0 0 2pt 0; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">${item}</li>`
          )
          .join('')}
      </ul>
    </div>`
      : '';

  const careerObjectiveHtml =
    data.careerObjective && data.careerObjective.trim() !== ''
      ? `
  <div style="margin-top: 5pt;">
    <div class="section-title" style="font-size: 10pt; font-weight: bold; margin-bottom: 4pt; text-transform: uppercase; letter-spacing: 0.5pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">CAREER OBJECTIVE</div>
    <div class="section-underline" style="border-bottom: 0.5pt solid #808080; margin-bottom: 4pt; height: 1px;"></div>
    <p style="margin-bottom: 12pt; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 10pt;">${data.careerObjective}</p>
  </div>`
      : '';

  let objectiveOrSummaryHtml = '';
  if ((userType === 'fresher' || userType === 'student') && data.careerObjective && data.careerObjective.trim() !== '') {
    objectiveOrSummaryHtml = careerObjectiveHtml;
  } else if (data.summary && data.summary.trim() !== '') {
    objectiveOrSummaryHtml = summaryHtml;
  }

  let sectionOrderHtml = '';
  if (userType === 'student') {
    sectionOrderHtml = `
      ${objectiveOrSummaryHtml}
      ${educationHtml}
      ${skillsHtml}
      ${projectsHtml}
      ${workExperienceHtml}
      ${certificationsHtml}
      ${achievementsHtml}
    `;
  } else if (userType === 'experienced') {
    sectionOrderHtml = `
      ${objectiveOrSummaryHtml}
      ${workExperienceHtml}
      ${projectsHtml}
      ${skillsHtml}
      ${certificationsHtml}
      ${educationHtml}
    `;
  } else {
    // Fresher
    sectionOrderHtml = `
      ${objectiveOrSummaryHtml}
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
      <title>${(data.name || 'Resume').toUpperCase()} - Resume</title>
      <style>
        @page {
          margin-top: 17.78mm !important;
          margin-bottom: 17.78mm !important;
          margin-left: 17.78mm !important;
          margin-right: 17.78mm !important;
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
        a:hover { color: #1d4ed8 !important; text-decoration: underline !important; }
        b, strong { font-weight: bold !important; color: #000 !important; }
        .header { text-align: center !important; margin-bottom: 6mm !important; }
        .name {
          font-size: 18pt !important;
          font-weight: bold !important;
          letter-spacing: 1pt !important;
          margin-bottom: 4pt !important;
          text-transform: uppercase !important;
          font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }
        .contact { font-size: 9pt !important; margin-bottom: 6pt !important; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important; }
        .section-title {
          font-size: 10pt !important; font-weight: bold !important; margin-top: 10pt !important; margin-bottom: 4pt !important;
          text-transform: uppercase !important; letter-spacing: 0.5pt !important; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }
        .section-underline { border-bottom: 0.5pt solid #808080 !important; margin-bottom: 4pt !important; height: 1px !important; }
        .job-title, .degree { font-size: 9.5pt !important; font-weight: bold !important; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important; }
        .company, .school, .year { font-size: 9.5pt !important; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important; }
        .bullets { margin-left: 4mm !important; margin-bottom: 4pt !important; margin-top: 2pt !important; }
        .bullet { font-size: 9.5pt !important; line-height: 1.4 !important; margin: 0 0 2pt 0 !important; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important; }
        .skills-item { font-size: 9.5pt !important; margin: 0.5pt 0 !important; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important; }
        .skill-category { font-weight: bold !important; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important; }
        .project-title { font-size: 9.5pt !important; font-weight: bold !important; margin-bottom: 2pt !important; font-family: Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important; }
        @media print { body { margin: 0 !important; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="name">${(data.name || '').toUpperCase()}</div>
        ${contactInfo ? `<div class="contact">${contactInfo}</div>` : ''}
      </div>
      ${sectionOrderHtml}
    </body>
    </html>
  `;
};
