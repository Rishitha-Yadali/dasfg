export interface ProjectSuggestion {
  id: string;
  title: string;
  techStack: string[];
  description: string;
  githubLink?: string;
  demoLink?: string;
  relevanceScore: number; // 1-5
  skillsCovered: string[];
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  estimatedTime: string;
  category: string;
}

export interface ProjectEnhancementResult {
  suggestions: ProjectSuggestion[];
  beforeScore: {
    atsMatch: number;
    projectRelevance: number;
    overallScore: number;
  };
  afterScore: {
    atsMatch: number;
    projectRelevance: number;
    overallScore: number;
  };
  missingSkills: string[];
  recommendedProjects: number;
}

export interface ManualProjectInput {
  name: string;
  startDate: string;
  endDate: string;
  techStack: string[];
  oneLiner?: string;
}

export interface SerpAPIResult {
  title: string;
  link: string;
  snippet: string;
  source: string;
  repoPath?: string;
  repoPath?: string;
}

export type ProjectMode = 'manual' | 'auto' | 'ai-score';