import { ProjectSuggestion, ProjectEnhancementResult, SerpAPIResult, ManualProjectInput } from '../types/projectEnhancement';
import { ResumeData } from '../types/resume';

const SERP_API_KEY = '5a51f510fa66113157ff2d54c84891760bfcdb06f596789550f6cfb13a974b87';
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

if (!OPENROUTER_API_KEY) {
  throw new Error('OpenRouter API key is not configured. Please add VITE_OPENROUTER_API_KEY to your environment variables.');
}

class ProjectEnhancementService {
  // Search for relevant projects using SerpAPI
  async searchRelevantProjects(jobDescription: string, requiredSkills: string[]): Promise<SerpAPIResult[]> {
    try {
      console.log('Starting project search with SerpAPI...');
      // Extract key technologies and role from job description
      const techKeywords = this.extractTechKeywords(jobDescription);
      const roleKeywords = this.extractRoleKeywords(jobDescription);
      
      // Create search queries
      const queries = [
        `${roleKeywords.join(' ')} ${techKeywords.slice(0, 3).join(' ')} open source project site:github.com`,
        `${techKeywords.slice(0, 4).join(' ')} repository stars:>100 site:github.com`
      ];

      const allResults: SerpAPIResult[] = [];

      // Limit to just 2 queries to reduce API calls and potential failures
      for (const query of queries) {
        try {
          console.log(`Searching with query: ${query}`);
          
          // Use a timeout to prevent hanging requests
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${SERP_API_KEY}&num=5&gl=us`, {
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            console.warn(`SerpAPI request failed for query: ${query}. Status: ${response.status}`);
            console.warn(`Response: ${await response.text()}`);
            continue;
          }

          const data = await response.json();
          
          if (data.organic_results) {
            const results = data.organic_results
              .filter((result: any) => {
                // Only include GitHub repository links
                const link = result.link || '';
                return link.includes('github.com/') && 
                       !link.includes('github.com/topics/') && 
                       !link.includes('github.com/search');
              })
              .map((result: any) => ({
                title: this.cleanGitHubTitle(result.title || ''),
                link: result.link || '',
                snippet: result.snippet || '',
                source: 'GitHub'
              }));
            
            allResults.push(...results);
          }
        } catch (error) {
          console.warn(`Error fetching results for query: ${query}`, error);
          // If we've had at least one successful query, continue with what we have
          if (allResults.length > 0) {
            break;
          }
          // Otherwise, continue trying other queries
          continue; 
        }
      }

      // If we got any results, return them (limited to 10)
      if (allResults.length > 0) {
        console.log(`Found ${allResults.length} results from SerpAPI`);
        return allResults.slice(0, 10);
      }
      
      // If no results, use fallback
      console.log('No results from SerpAPI, using fallback projects');
      return this.getFallbackProjects(jobDescription, requiredSkills);
    } catch (error) {
      console.error('Error searching projects:', error);
      // Return fallback results if SerpAPI fails
      console.log('SerpAPI search failed, using fallback projects');
      return this.getFallbackProjects(jobDescription, requiredSkills);
    }
  }
  
  // Clean GitHub repository title
  private cleanGitHubTitle(title: string): string {
    // Remove "GitHub - username/repo: description" format
    const repoMatch = title.match(/GitHub - [^/]+\/([^:]+)(?:: (.+))?/);
    if (repoMatch) {
      // If we have a description, use it, otherwise use the repo name
      return repoMatch[2] ? repoMatch[2] : this.formatRepoName(repoMatch[1]);
    }
    
    // Remove "username/repo: description" format
    const altMatch = title.match(/[^/]+\/([^:]+)(?:: (.+))?/);
    if (altMatch) {
      return altMatch[2] ? altMatch[2] : this.formatRepoName(altMatch[1]);
    }
    
    return title;
  }
  
  // Format repository name to be more readable
  private formatRepoName(repoName: string): string {
    return repoName
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Generate project suggestions using AI
  async generateProjectSuggestions(
    jobDescription: string,
    currentResume: ResumeData,
    serpResults: SerpAPIResult[]
  ): Promise<ProjectEnhancementResult> {
    console.log(`Generating project suggestions with ${serpResults.length} search results`);
    
    // If we have no search results, use fallbacks
    if (serpResults.length === 0) {
      serpResults = this.getFallbackProjects(jobDescription, []);
      console.log('Using fallback projects for suggestion generation');
    }
    
    const prompt = `You are an expert GitHub project recommender and resume enhancer.

### Job Description:
${jobDescription}

### Role:
${currentResume.targetRole || 'Not specified'}

### Current Resume Projects:
${currentResume.projects?.map(p => `- ${p.title}: ${p.bullets?.join('; ')}`).join('\n') || 'No projects listed'}

### Current Skills:
${currentResume.skills?.map(s => `${s.category}: ${s.list?.join(', ')}`).join('\n') || 'No skills listed'}

### GitHub Projects from Search:
${serpResults.map(r => `- Title: ${r.title}\n  Link: ${r.link}\n  Description: ${r.snippet || 'No description available'}`).join('\n\n')}

Your task:

1. Select 5-10 suitable GitHub projects from the search results that match the required stack, tools, and responsibilities in the JD.
2. For each project, provide:
   - Project Title (short and readable)
   - Exact GitHub Link from the search results
   - 3 Bullet Points (each bullet ≤ 20 words, aligned with the JD, highlighting tech, role-specific contributions, or key features)

3. Also provide:
   - A list of missing skills from the job requirements
   - Before/after scores for ATS match, project relevance, and overall score
   - Recommended number of projects to add (1-3)

CRITICAL REQUIREMENTS:
- Each bullet point MUST be EXACTLY 20 words or less
- Start each bullet with a strong action verb (Developed, Implemented, Architected, etc.)
- NO weak verbs like "helped", "assisted", "worked on"
- Include specific technologies from the tech stack
- Focus on achievements and impact, not just responsibilities
- Align with job description requirements
- Include metrics and quantifiable results where possible
- No repeated keywords across bullets for the same project

DO NOT repeat projects across different responses even if the JD is the same - always give new suggestions.

Respond ONLY with valid JSON in this exact structure:

{
  "suggestions": [
    {
      "id": "unique-id",
      "title": "Project Title",
      "githubLink": "exact_github_url_from_search_results",
      "description": "Short project description",
      "bullets": [
        "Bullet 1 - exactly 20 words or less",
        "Bullet 2 - exactly 20 words or less",
        "Bullet 3 - exactly 20 words or less"
      ],
      "relevanceScore": 1-5,
      "techStack": ["tech1", "tech2", "tech3"],
      "difficulty": "Beginner/Intermediate/Advanced",
      "estimatedTime": "2-4 weeks",
      "category": "Web Development/Data Science/Mobile/etc"
    }
  ],
  "beforeScore": {
    "atsMatch": 0-100,
    "projectRelevance": 1-5,
    "overallScore": 0-100
  },
  "afterScore": {
    "atsMatch": 0-100,
    "projectRelevance": 1-5,
    "overallScore": 0-100
  },
  "missingSkills": ["skill1", "skill2"],
  "recommendedProjects": 3-5
}`;

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(30000),
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
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`OpenRouter API error: ${response.status}`, errorText);
        throw new Error(`OpenRouter API error: ${response.status}. ${errorText}`);
      }

      const data = await response.json();
      const result = data?.choices?.[0]?.message?.content;
      
      if (!result) {
        throw new Error('No response content from OpenRouter API');
      }

      const cleanedResult = result.replace(/```json/g, '').replace(/```/g, '').trim();
      console.log('Raw response from OpenRouter:', cleanedResult);
      
      try {
        const parsedResult = JSON.parse(cleanedResult);
        
        // Map the response to match expected structure
        const mappedResult = {
          suggestions: parsedResult.suggestions?.map((suggestion: any) => ({
            id: suggestion.id,
            title: suggestion.title,
            githubLink: suggestion.githubLink || suggestion.githubUrl,
            description: suggestion.description,
            bullets: suggestion.bullets || [],
            relevanceScore: suggestion.relevanceScore,
            techStack: suggestion.techStack || [],
            difficulty: suggestion.difficulty,
            estimatedTime: suggestion.estimatedTime,
            category: suggestion.category
          })) || [],
          beforeScore: parsedResult.beforeScore || { atsMatch: 60, projectRelevance: 2, overallScore: 40 },
          afterScore: parsedResult.afterScore || { atsMatch: 85, projectRelevance: 4, overallScore: 70 },
          missingSkills: parsedResult.missingSkills || [],
          recommendedProjects: parsedResult.recommendedProjects || 3
        };
        
        console.log('Successfully parsed OpenRouter response');
        return mappedResult;
      } catch (parseError) {
        console.error('Error parsing OpenRouter response:', parseError);
        console.log('Raw response that failed to parse:', cleanedResult);
        return this.generateFallbackSuggestions(jobDescription, currentResume, serpResults);
      }
    } catch (error) {
      console.error('Error calling OpenRouter API for project suggestions:', error);
      return this.generateFallbackSuggestions(jobDescription, currentResume, serpResults);
    }
  }

  // Generate fallback suggestions when API calls fail
  private generateFallbackSuggestions(
    jobDescription: string,
    currentResume: ResumeData,
    serpResults: SerpAPIResult[]
  ): ProjectEnhancementResult {
    // Extract some keywords for relevance
    const techKeywords = this.extractTechKeywords(jobDescription);
    const roleKeywords = this.extractRoleKeywords(jobDescription);
    
    // Create basic suggestions from search results or fallbacks
    const suggestions: ProjectSuggestion[] = (serpResults.length > 0 ? serpResults : this.getFallbackProjects(jobDescription, []))
      .slice(0, 5)
      .map((result, index) => ({
        id: `fallback-${index}`,
        title: result.title || `Project ${index + 1}`,
        githubLink: result.link,
        description: result.snippet || `A project related to ${techKeywords.slice(0, 3).join(', ')}`,
        bullets: [
          `Developed ${result.title} using ${techKeywords[0] || 'modern'} technologies to solve business challenges.`,
          `Implemented key features including user authentication, data management, and reporting functionality.`,
          `Optimized application performance through code refactoring and database query optimization techniques.`
        ],
        relevanceScore: 4,
        techStack: techKeywords.slice(0, 5),
        difficulty: "Intermediate",
        estimatedTime: "2-4 weeks",
        category: roleKeywords[0] || "Web Development"
      }));
    
    // Create a basic result
    return {
      suggestions,
      beforeScore: {
        atsMatch: 65,
        projectRelevance: 3,
        overallScore: 70
      },
      afterScore: {
        atsMatch: 85,
        projectRelevance: 4,
        overallScore: 85
      },
      missingSkills: techKeywords.slice(0, 3),
      recommendedProjects: 2
    };
  }

  // Generate project description from manual input
  async generateProjectDescription(input: ManualProjectInput, jobDescription: string): Promise<string> {
    const prompt = `Generate a professional project description for a resume based on the following input:

PROJECT INPUT:
- Name: ${input.name}
- Duration: ${input.startDate} to ${input.endDate}
- Tech Stack: ${input.techStack.join(', ')}
- One-liner: ${input.oneLiner || 'Not provided'}

JOB DESCRIPTION CONTEXT:
${jobDescription}

REQUIREMENTS:
1. Create 3-4 bullet points describing the project
2. Follow the format: Problem → Solution → Technology → Impact
3. Include specific technologies from the tech stack
4. Align with job requirements and keywords
5. Use action verbs and quantifiable results where possible
6. Each bullet should be exactly 20 words

Respond with only the bullet points, one per line, starting with "•"`;

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(20000),
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
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`OpenRouter API error: ${response.status}`, errorText);
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      const result = data?.choices?.[0]?.message?.content;
      
      if (!result) {
        throw new Error('No response content from OpenRouter API');
      }

      return result.trim();
    } catch (error) {
      console.error('Error calling OpenRouter API for project description:', error);
      
      // Return fallback description instead of throwing error
      return `• Developed ${input.name} using ${input.techStack.join(', ')} technologies
• Implemented core features and functionality aligned with industry best practices
• Delivered scalable solution with focus on performance and user experience`;
    }
  }

  // Helper methods
  private extractTechKeywords(jobDescription: string): string[] {
    const techPatterns = [
      /\b(React|Angular|Vue|JavaScript|TypeScript|Node\.js|Python|Java|C\+\+|C#|PHP|Ruby|Go|Rust|Swift|Kotlin)\b/gi,
      /\b(MongoDB|MySQL|PostgreSQL|Redis|Elasticsearch|Firebase|Supabase)\b/gi,
      /\b(AWS|Azure|GCP|Docker|Kubernetes|Jenkins|Git|GitHub|GitLab)\b/gi,
      /\b(HTML|CSS|SASS|SCSS|Tailwind|Bootstrap|Material-UI|Chakra)\b/gi,
      /\b(Express|Django|Flask|Spring|Laravel|Rails|FastAPI)\b/gi,
      /\b(REST|GraphQL|API|Microservices|Serverless|Lambda)\b/gi
    ];

    const keywords = new Set<string>();
    
    techPatterns.forEach(pattern => {
      const matches = jobDescription.match(pattern);
      if (matches) {
        matches.forEach(match => keywords.add(match.toLowerCase()));
      }
    });

    return Array.from(keywords).slice(0, 8);
  }

  private extractRoleKeywords(jobDescription: string): string[] {
    const rolePatterns = [
      /\b(frontend|backend|fullstack|full-stack|web developer|software engineer|data scientist|mobile developer)\b/gi,
      /\b(react developer|node developer|python developer|java developer)\b/gi,
      /\b(ui\/ux|devops|machine learning|ai|artificial intelligence)\b/gi
    ];

    const keywords = new Set<string>();
    
    rolePatterns.forEach(pattern => {
      const matches = jobDescription.match(pattern);
      if (matches) {
        matches.forEach(match => keywords.add(match.toLowerCase()));
      }
    });

    return Array.from(keywords).slice(0, 3);
  }

  private extractSource(url: string): string {
    try {
      const domain = new URL(url).hostname;
      if (domain.includes('github.com')) return 'GitHub';
      if (domain.includes('devpost.com')) return 'DevPost';
      if (domain.includes('codepen.io')) return 'CodePen';
      if (domain.includes('netlify.app')) return 'Netlify';
      if (domain.includes('vercel.app')) return 'Vercel';
      return domain;
    } catch {
      return 'Unknown';
    }
  }

  private getFallbackProjects(jobDescription: string, requiredSkills: string[]): SerpAPIResult[] {
    // Fallback projects when SerpAPI fails
    const fallbackProjects = [
      {
        title: "React E-commerce Platform",
        link: "https://github.com/PERN-E-Commerce/PERN-E-Commerce",
        snippet: "Full-stack e-commerce application built with React, Node.js, Express, and MongoDB. Features include user authentication, product catalog, shopping cart, and payment integration.",
        source: "GitHub"
      },
      {
        title: "MERN Task Manager",
        link: "https://github.com/bradtraversy/mern-task-manager",
        snippet: "Responsive task management application with real-time updates, drag-and-drop functionality, team collaboration features, and data visualization charts.",
        source: "GitHub"
      },
      {
        title: "React Weather App",
        link: "https://github.com/erikflowers/weather-icons",
        snippet: "Modern weather application with location-based forecasts, interactive maps, and responsive design. Built with React and integrated with OpenWeather API.",
        source: "GitHub"
      },
      {
        title: "Social Media Dashboard",
        link: "https://github.com/adrianhajdin/social_media_app",
        snippet: "Data visualization dashboard for social media metrics with real-time charts, user engagement tracking, and automated reporting features.",
        source: "GitHub"
      },
      {
        title: "Inventory Management System",
        link: "https://github.com/pankajkumar005/Inventory-Management-System",
        snippet: "Complete inventory management solution with barcode scanning, stock tracking, supplier management, and automated reorder alerts.",
        source: "GitHub"
      },
      {
        title: "Spring Boot REST API",
        link: "https://github.com/spring-projects/spring-petclinic",
        snippet: "Comprehensive REST API built with Spring Boot, showcasing best practices for Java backend development with proper error handling and documentation.",
        source: "GitHub"
      },
      {
        title: "Node.js Express API",
        link: "https://github.com/hagopj13/node-express-boilerplate",
        snippet: "Production-ready Node.js REST API with Express, featuring authentication, authorization, error handling, validation, and testing.",
        source: "GitHub"
      },
      {
        title: "React Dashboard",
        link: "https://github.com/creativetimofficial/material-dashboard-react",
        snippet: "Beautiful admin dashboard built with React and Material-UI, featuring charts, tables, and responsive design.",
        source: "GitHub"
      },
      {
        title: "Django CRM System",
        link: "https://github.com/MicroPyramid/Django-CRM",
        snippet: "Customer relationship management system built with Django, featuring contact management, deal tracking, and email integration.",
        source: "GitHub"
      },
      {
        title: "Flutter E-commerce App",
        link: "https://github.com/abuanwar072/E-commerce-Complete-Flutter-UI",
        snippet: "Complete e-commerce mobile application UI built with Flutter, featuring product listings, cart management, and checkout process.",
        source: "GitHub"
      }
    ];

    return fallbackProjects;
  }
}

export const projectEnhancementService = new ProjectEnhancementService();