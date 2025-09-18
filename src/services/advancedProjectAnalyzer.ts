import { ResumeData } from '../types/resume';

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  throw new Error('OpenRouter API key is not configured. Please add VITE_OPENROUTER_API_KEY to your environment variables.');
}

interface ProjectScore {
  title: string;
  score: number;
  reason: string;
}

interface ReplacementSuggestion {
  title: string;
  githubUrl: string;
  bullets: string[];
}

interface ProjectAnalysisResult {
  projectsToReplace: ProjectScore[];
  replacementSuggestions: ReplacementSuggestion[];
}

class AdvancedProjectAnalyzer {
  async analyzeAndReplaceProjects(
    resumeData: ResumeData,
    jobRole: string,
    jobDescription: string,
    setLoading: (loading: boolean) => void // Added setLoading parameter
  ): Promise<ProjectAnalysisResult> {
    // MODIFICATION START: Summarize resume projects for the prompt
    const summarizedResumeProjects = resumeData.projects?.map(p => ({
      title: p.title,
      summary: p.bullets?.[0] || '' // Use the first bullet as a summary
    })) || [];
    // MODIFICATION END

    const prompt = `You are an expert resume optimizer.

Given:
- Existing projects: ${JSON.stringify(summarizedResumeProjects)}
- Job Role: ${jobRole}
- Job Description: ${jobDescription}

1. Score each resume project (0-100) based on how well it fits the job description and role.
2. Replace any project with score below 80.
3. Recommend 5 GitHub open-source projects with exact GitHub URLs.
4. For each project, write 3 bullet points (up to 20 words) showing how it fits the JD and role.
5. Highlight tech stack, role relevance, and contributions using action verbs.
6. Avoid suggesting the same project twice.
7. Output in this JSON format:

{
  "projectsToReplace": [
    {
      "title": "Project Name",
      "score": 0-100,
      "reason": "Why this project scores low for the role"
    }
  ],
  "replacementSuggestions": [
    {
      "title": "GitHub Project Name",
      "githubUrl": "https://github.com/username/repo",
      "bullets": [
        "Bullet point 1 - up to 20 words",
        "Bullet point 2 - up to 20 words",
        "Bullet point 3 - up to 20 words"
      ]
    }
  ]
}

CRITICAL REQUIREMENTS:
- Each bullet point MUST be up to 20 words
- Start each bullet with strong action verbs (Developed, Implemented, Architected, etc.)
- NO weak verbs like "helped", "assisted", "worked on"
- Include specific technologies from the job description
- Focus on achievements and impact, not just responsibilities
- Provide real GitHub URLs that exist
- Only replace projects scoring below 80

Respond ONLY with valid JSON.`;

    try {
      setLoading(true); // Set loading to true
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          "HTTP-Referer": "https://primoboost.ai",
          "X-Title": "PrimoBoost AI"
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: prompt
            }
          ]
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenRouter API error response:', errorText);
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      const result = data?.choices?.[0]?.message?.content;
      
      if (!result) {
        throw new Error('No response content from OpenRouter API');
      }

      // Clean the response to ensure it's valid JSON
      const cleanedResult = result.replace(/```json/g, '').replace(/```/g, '').trim();
      
      try {
        const parsedResult = JSON.parse(cleanedResult);
        return parsedResult;
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        console.error('Raw response:', cleanedResult);
        throw new Error('Invalid JSON response from Gemini API');
      }
    } catch (error) {
      console.error('Error calling Gemini API for project analysis:', error);
      throw new Error('Failed to analyze projects. Please try again.');
    } finally {
      setLoading(false); // Set loading to false
    }
  }

  // Apply the analysis results to update the resume
  applyProjectReplacements(
    resumeData: ResumeData,
    analysisResult: ProjectAnalysisResult
  ): ResumeData {
    const projectsToReplaceSet = new Set(
      analysisResult.projectsToReplace.map(p => p.title)
    );

    // Keep projects that don't need replacement
    const keptProjects = resumeData.projects?.filter(
      project => !projectsToReplaceSet.has(project.title)
    ) || [];

    // Add replacement projects
    const newProjects = analysisResult.replacementSuggestions.map(suggestion => ({
      title: suggestion.title,
      bullets: suggestion.bullets,
      githubUrl: suggestion.githubUrl
    }));

    return {
      ...resumeData,
      projects: [...keptProjects, ...newProjects]
    };
  }
}

export const advancedProjectAnalyzer = new AdvancedProjectAnalyzer();
