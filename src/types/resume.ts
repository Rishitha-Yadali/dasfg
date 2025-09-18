// src/types/resume.ts

interface Education {
  degree: string;
  school: string;
  year: string;
  cgpa?: string;
  location?: string; // Added for education location
}

interface WorkExperience {
  role: string;
  company: string;
  year: string;
  bullets: string[];
}

interface Project {
  title: string;
  bullets: string[];
  githubUrl?: string;
}

interface Skill {
  category: string;
  count: number;
  list: string[];
}

// New interface for structured certifications
export interface Certification {
  title: string;
  description: string;
}

export interface ResumeData {
  name: string;
  phone: string;
  email: string;
  linkedin: string;
  github: string;
  location?: string; // Added for contact information
  targetRole?: string; // Added target role field
  summary?: string; // Professional summary for experienced professionals
  careerObjective?: string; // Career objective for students
  education: Education[];
  workExperience: WorkExperience[];
  projects: Project[];
  skills: Skill[];
  // Updated to allow for both simple strings and structured Certification objects
  certifications: (string | Certification)[];
  achievements?: string[]; // For freshers - awards, achievements
  extraCurricularActivities?: string[]; // For freshers - activities, leadership
  languagesKnown?: string[]; // For freshers - languages spoken
  personalDetails?: string; // For freshers - personal information
  origin?: string;
}

export type UserType = 'fresher' | 'experienced' | 'student';
export type ScoringMode = 'jd_based' | 'general';
export type ExtractionMode = 'TEXT' | 'OCR';
export type MatchBand = 'Excellent Match' | 'Very Good Match' | 'Good Match' | 'Fair Match' | 'Below Average' | 'Poor Match' | 'Very Poor' | 'Inadequate' | 'Minimal Match' | 'No Match';
export type ConfidenceLevel = 'High' | 'Medium' | 'Low';

export interface ExtractionResult {
  text: string;
  extraction_mode: ExtractionMode;
  trimmed: boolean;
  pages?: number;
  chars_pre?: number;
  chars_post?: number;
}

export interface MetricScore {
  key: string;
  name: string;
  weight_pct: number;
  score: number;
  max_score: number;
  contribution: number;
  details: string;
}

export interface ExampleRewrite {
  original: string;
  improved: string;
  explanation: string;
}

export interface ComprehensiveScore {
  overall: number;
  match_band: MatchBand;
  interview_probability_range: string;
  confidence: ConfidenceLevel;
  rubric_version: string;
  weighting_mode: 'JD' | 'GENERAL';
  extraction_mode: ExtractionMode;
  trimmed: boolean;
  job_title?: string;
  breakdown: MetricScore[];
  missing_keywords: string[];
  actions: string[];
  example_rewrites: {
    experience?: ExampleRewrite;
    projects?: ExampleRewrite;
  };
  notes: string[];
  analysis: string;
  keyStrengths: string[];
  improvementAreas: string[];
  recommendations: string[];
  cached?: boolean;
  cache_expires_at?: string;
}

export interface MatchScore {
  score: number;
  analysis: string;
  keyStrengths: string[];
  improvementAreas: string[];
}
interface BreakdownBase {
  score: number;
  maxScore: number;
  details: string;
}

interface ATSCompatibility extends BreakdownBase {
  noTablesColumnsFonts: boolean;
  properFileStructure: boolean;
  consistentBulletFormatting: boolean;
}

interface KeywordSkillMatch extends BreakdownBase {
  technicalSoftSkillsAligned: boolean;
  toolsTechCertsPresent: boolean;
  roleSpecificVerbsUsed: boolean;
}

interface ProjectWorkRelevance extends BreakdownBase {
  projectsAlignedWithJD: boolean;
  quantifiedImpact: boolean;
}

interface StructureFlow extends BreakdownBase {
  logicalSectionOrder: boolean;
  noMissingSections: boolean;
  goodWhitespaceMargins: boolean;
}

interface CriticalFixesRedFlags extends BreakdownBase {
  hasContactInfo: boolean;
  noOverusedWords: boolean;
  usesActionVerbs: boolean;
  noGrammarSpellingErrors: boolean;
}

interface ImpactScore extends BreakdownBase {
  strongActionVerbs: boolean;
  quantifiedAccomplishments: boolean;
  achievementOrientedContent: boolean;
  measurableResults: boolean;
}

interface BrevityScore extends BreakdownBase {
  conciseness: boolean;
  wordEconomy: boolean;
  avoidingRedundancy: boolean;
  directLanguage: boolean;
}

interface StyleScore extends BreakdownBase {
  professionalTone: boolean;
  consistencyInFormatting: boolean;
  clarityOfLanguage: boolean;
  overallPolish: boolean;
}

interface SkillsScore extends BreakdownBase {
  relevanceToJD: boolean;
  proficiencyIndicated: boolean;
  varietyTechnicalSoft: boolean;
  placement: boolean;
}

export interface DetailedScore {
  totalScore: number;
  analysis: string;
  keyStrengths: string[];
  improvementAreas: string[];
  breakdown: ScoreBreakdown;
  recommendations: string[];
  grade: Grade;
}