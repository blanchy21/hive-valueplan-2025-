export interface ProjectKPI {
  // Event metrics
  eventAttendance?: number;
  swcAthletes?: number;
  externalAthletes?: number;
  
  // Budget metrics
  totalBudgetHbd?: number;
  
  // Social media metrics
  totalSocialMediaViews?: number;
  
  // Engagement metrics
  athletesInterestedInHive?: number;
  costPerPersonInterested?: number;
  
  // Additional metrics from the sheet
  partnerShoppingCenter?: string;
  results?: string;
  lastUpdated?: string;
  
  // Any other KPI fields that might be in the sheet
  [key: string]: string | number | undefined;
}

export interface ProjectVerticalsData {
  category?: string;
  type?: string;
  status?: string;
  totalHbd?: number;
  totalHive?: number;
  totalHiveInHbd?: number;
  combinedTotalHbd?: number;
}

export interface Project {
  name: string;
  url?: string;
  kpis?: ProjectKPI;
  verticals?: ProjectVerticalsData;
}

export interface ProjectsData {
  projects: Project[];
  totalProjects: number;
  projectsWithKPIs: number;
}

