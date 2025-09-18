import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface JobApplicationData {
  jobId: string;
  jobTitle: string;
  fullName: string;
  phone: string;
  email: string;
  college: string;
  passedOutYear: number;
  github: string;
  linkedin: string;
  resumeDrive: string;
  portfolioOrOther?: string;
  whyYou: string;
  companyName: string; // Added
  applicationDate: string; // Added
}

// Google Sheets integration (optional)
async function saveToGoogleSheets(applicationData: JobApplicationData) {
  // TODO: Implement Google Sheets API integration
  // For now, we'll just log the data structure that would be sent
  console.log('Would save to Google Sheets:', {
    timestamp: new Date().toISOString(),
    jobId: applicationData.jobId,
    title: applicationData.jobTitle,
    fullName: applicationData.fullName,
    phone: applicationData.phone,
    email: applicationData.email,
    college: applicationData.college,
    passedOutYear: applicationData.passedOutYear,
    github: applicationData.github,
    linkedin: applicationData.linkedin,
    resumeDrive: applicationData.resumeDrive,
    portfolioOrOther: applicationData.portfolioOrOther || '',
    whyYou: applicationData.whyYou
  });
}

// Email notification (optional)
async function sendNotificationEmail(applicationData: JobApplicationData) {
  // TODO: Implement email notification to HR team
  console.log(`New application received for ${applicationData.jobTitle} from ${applicationData.fullName}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const applicationData: JobApplicationData = await req.json();

    // Validate required fields
    const requiredFields = [
      'jobId', 'jobTitle', 'fullName', 'phone', 'email', 
      'college', 'passedOutYear', 'github', 'linkedin', 
      'resumeDrive', 'whyYou', 'companyName', 'applicationDate' // Added to required fields
    ];

    for (const field of requiredFields) {
      if (!applicationData[field as keyof JobApplicationData]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(applicationData.email)) {
      throw new Error('Invalid email format');
    }

    // Validate URLs
    const urlFields = ['github', 'linkedin', 'resumeDrive'];
    for (const field of urlFields) {
      const url = applicationData[field as keyof JobApplicationData] as string;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        throw new Error(`${field} must be a valid URL`);
      }
    }

    // Validate year range
    if (applicationData.passedOutYear < 2018 || applicationData.passedOutYear > 2026) {
      throw new Error('Passed out year must be between 2018 and 2026');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Save to database
    const { data: application, error } = await supabase
      .from('job_applications')
      .insert({
        job_listing_id: applicationData.jobId,
        job_title: applicationData.jobTitle,
        company_name: applicationData.companyName, // Added
        application_date: applicationData.applicationDate, // Added
        full_name: applicationData.fullName,
        phone: applicationData.phone,
        email: applicationData.email,
        college: applicationData.college,
        passed_out_year: applicationData.passedOutYear,
        github_url: applicationData.github,
        linkedin_url: applicationData.linkedin,
        resume_drive_url: applicationData.resumeDrive,
        portfolio_url: applicationData.portfolioOrOther || null,
        why_fit: applicationData.whyYou,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw new Error('Failed to save application to database');
    }

    console.log(`New job application saved with ID: ${application.id}`);

    // Optional: Save to Google Sheets
    try {
      await saveToGoogleSheets(applicationData);
    } catch (sheetsError) {
      console.warn('Failed to save to Google Sheets:', sheetsError);
      // Don't fail the request if Google Sheets fails
    }

    // Optional: Send notification email
    try {
      await sendNotificationEmail(applicationData);
    } catch (emailError) {
      console.warn('Failed to send notification email:', emailError);
      // Don't fail the request if email fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Application submitted successfully',
        applicationId: application.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error processing job application:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to process application'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

