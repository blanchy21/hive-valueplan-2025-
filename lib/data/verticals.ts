import { Vertical, VerticalsData } from '@/lib/types/verticals';

// Manual entry of verticals projects
// You can add, edit, or remove projects here

const projects: Vertical[] = [
  // Ecosystem Marketing - Strategic Partnerships
  {
    project: 'Krolestwo',
    category: 'Ecosystem Marketing',
    type: 'Outreach, Partnership, Onboarding',
    status: 'Ongoing',
    year: '2026'
  },
  {
    project: 'FinFarm (India)',
    category: 'Ecosystem Marketing',
    type: 'Outreach, Partnership',
    status: 'Transitioning',
    year: '2026'
  },
  {
    project: 'Mazer (US)',
    category: 'Ecosystem Marketing',
    type: 'Partnership, Outreach, B2B',
    status: 'Transitioning',
    year: '2026'
  },
  
  // Ecosystem Marketing - Integrations
  {
    project: 'Zapier',
    category: 'Ecosystem Marketing',
    type: 'Partnership',
    status: 'Concluded',
    year: '2026'
  },
  
  // Ecosystem Marketing - Event Creation
  {
    project: 'Code Hive Hackathons',
    category: 'Ecosystem Marketing',
    type: 'Outreach, Partnership, Onboarding',
    status: 'Ongoing',
    year: '2026'
  },
  {
    project: 'ChainCulture',
    category: 'Ecosystem Marketing',
    type: 'Outreach, Partnership, Onboarding',
    status: 'Ongoing',
    year: '2026'
  },
  {
    project: 'Boundl3ss',
    category: 'Ecosystem Marketing',
    type: 'Outreach, Onboarding',
    status: 'Ongoing',
    year: '2026'
  },
  {
    project: 'HiveFest',
    category: 'Ecosystem Marketing',
    type: 'Outreach, Onboarding, Partnership',
    status: 'Ongoing',
    year: '2026'
  },
  {
    project: 'Texas Tech Events',
    category: 'Ecosystem Marketing',
    type: 'Outreach, Partnership',
    status: 'Ongoing',
    year: '2026'
  },
  
  // Ecosystem Marketing - Digital Promotions
  {
    project: 'Hive Creators',
    category: 'Ecosystem Marketing',
    type: 'Outreach, Onboarding, Partnership',
    status: 'Ongoing',
    year: '2026'
  },
  {
    project: 'X Spaces',
    category: 'Ecosystem Marketing',
    type: 'Outreach, Partnership',
    status: 'Ongoing',
    year: '2026'
  },
  {
    project: 'Dual Branded Ads',
    category: 'Ecosystem Marketing',
    type: 'Onboarding, B2B',
    status: 'Initiating',
    year: '2026'
  },
  {
    project: 'SWC Digital',
    category: 'Ecosystem Marketing',
    type: 'Outreach, Partnership, B2B, Onboarding',
    status: 'Ongoing',
    year: '2026'
  },
  {
    project: 'Web3 Online',
    category: 'Ecosystem Marketing',
    type: 'Outreach, Onboarding, Partnership',
    status: 'Ongoing',
    year: '2026'
  },
  {
    project: 'Ad-Hoc Promotions',
    category: 'Ecosystem Marketing',
    type: 'Outreach, Onboarding',
    status: 'Initiating',
    year: '2026'
  },
  
  // Social Impact + Niche Promotion - Brand Recognition
  {
    project: 'WRC Rally Car Races',
    category: 'Social Impact + Niche Promotion',
    type: 'Outreach, Partnership',
    status: 'Transitioning',
    year: '2026'
  },
  {
    project: 'Motorcycle Racing',
    category: 'Social Impact + Niche Promotion',
    type: 'Outreach',
    status: 'Ongoing',
    year: '2026'
  },
  {
    project: 'Wells For All (CWP)',
    category: 'Social Impact + Niche Promotion',
    type: 'Outreach, Partnership',
    status: 'Concluded',
    year: '2026'
  },
  {
    project: 'CWP VZ',
    category: 'Social Impact + Niche Promotion',
    type: 'Partnership, B2B',
    status: 'Concluded',
    year: '2026'
  },
  {
    project: 'Revenga',
    category: 'Social Impact + Niche Promotion',
    type: 'Outreach',
    status: 'Concluded',
    year: '2026'
  },
  {
    project: 'Handball',
    category: 'Social Impact + Niche Promotion',
    type: 'Outreach, Partnership',
    status: 'Ongoing',
    year: '2026'
  },
  {
    project: 'Mountain Bike Racing',
    category: 'Social Impact + Niche Promotion',
    type: 'Outreach, Partnership',
    status: 'Transitioning',
    year: '2026'
  },
  {
    project: 'SWC Events',
    category: 'Social Impact + Niche Promotion',
    type: 'Outreach, Partnership, B2B, Onboarding',
    status: 'Transitioning',
    year: '2026'
  },
  {
    project: 'Wrestlefest',
    category: 'Social Impact + Niche Promotion',
    type: 'Outreach, Onboarding',
    status: 'Ongoing',
    year: '2026'
  },
  
  // Hive and HBD Adoption - B2B
  {
    project: 'Hive B2B',
    category: 'Hive and HBD Adoption',
    type: 'Outreach, Partnership, B2B',
    status: 'Ongoing',
    year: '2026'
  },
  {
    project: 'Workshops',
    category: 'Hive and HBD Adoption',
    type: 'Outreach, B2B, Onboarding',
    status: 'Transitioning',
    year: '2026'
  },
  
  // Conferences - Global Exposure
  {
    project: 'Hive Goes to School',
    category: 'Conferences',
    type: 'Outreach, Partnership, Onboarding',
    status: 'Ongoing',
    year: '2026'
  },
  {
    project: 'Speaking Slots',
    category: 'Conferences',
    type: 'Outreach',
    status: 'Initiating',
    year: '2026'
  },
  {
    project: 'Rally Car Conference Booths',
    category: 'Conferences',
    type: 'Outreach, Partnership, Onboarding',
    status: 'Transitioning',
    year: '2026'
  },
  
  // Add more projects below as needed
  // Example:
  // {
  //   project: 'Project Name',
  //   category: 'Ecosystem Marketing', // or 'Social Impact + Niche Promotion', 'Hive and HBD Adoption', 'Conferences'
  //   type: 'Type1, Type2',
  //   status: 'Ongoing', // or 'Concluded', 'Transitioning', 'Initiating'
  //   year: '2026'
  // },
];

// Helper function to organize projects into the expected data structure
export function getVerticalsData(): VerticalsData {
  const categories = [
    {
      name: 'Ecosystem Marketing',
      description: '',
      projects: [] as Vertical[]
    },
    {
      name: 'Social Impact + Niche Promotion',
      description: '',
      projects: [] as Vertical[]
    },
    {
      name: 'Hive and HBD Adoption',
      description: '',
      projects: [] as Vertical[]
    },
    {
      name: 'Conferences',
      description: '',
      projects: [] as Vertical[]
    }
  ];

  const byCategory: Record<string, Vertical[]> = {};
  const byStatus: Record<string, Vertical[]> = {};

  // Initialize category arrays
  categories.forEach(cat => {
    byCategory[cat.name] = [];
  });

  // Organize projects by category and status
  projects.forEach(project => {
    const category = categories.find(cat => cat.name === project.category);
    if (category) {
      category.projects.push(project);
      byCategory[project.category].push(project);
    }

    if (!byStatus[project.status]) {
      byStatus[project.status] = [];
    }
    byStatus[project.status].push(project);
  });

  return {
    categories,
    projects,
    byStatus,
    byCategory
  };
}

