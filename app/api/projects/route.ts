import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import { Project, ProjectKPI, ProjectsData } from '@/lib/types/projects';

const PROJECT_REPORTS_URL = 'https://valueplanreports.com/projectreports.html';
const PROJECT_SHEETS_ID = '1LWXPu-rVk7kH1tU-F1Io-0HIQaVZEBrbiBTH1O8Fxwk';

// Helper function to get Google Sheets CSV URL
function getProjectSheetsCsvUrl(gid: string = '0'): string {
  return `https://docs.google.com/spreadsheets/d/${PROJECT_SHEETS_ID}/export?format=csv&gid=${gid}`;
}

// Fetch projects from the website
async function fetchProjectsFromWebsite(): Promise<Project[]> {
  try {
    const response = await fetch(PROJECT_REPORTS_URL, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      console.error(`Failed to fetch project reports: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const projects: Project[] = [];

    // Try to extract project names from the HTML
    // The page might have project links or names in various formats
    // This is a basic parser - might need adjustment based on actual HTML structure
    
    // Look for common patterns in the HTML
    // Pattern 1: Links with project names
    const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
    let match;
    const seenProjects = new Set<string>();

    while ((match = linkPattern.exec(html)) !== null) {
      const url = match[1];
      const name = match[2].trim();
      
      // Filter out navigation links and common non-project links
      if (name && 
          name.length > 3 && 
          !name.toLowerCase().includes('hive') &&
          !name.toLowerCase().includes('logo') &&
          !name.toLowerCase().includes('explore') &&
          !name.toLowerCase().includes('browse') &&
          !name.toLowerCase().includes('read') &&
          !name.toLowerCase().includes('copy') &&
          !seenProjects.has(name)) {
        seenProjects.add(name);
        projects.push({
          name,
          url: url.startsWith('http') ? url : `https://valueplanreports.com${url}`,
        });
      }
    }

    // If no projects found via links, try to find text patterns
    if (projects.length === 0) {
      // Look for text that might be project names
      // This is a fallback - adjust based on actual page structure
      const textPattern = /<[^>]*>([A-Z][a-zA-Z\s]{3,50})<\/[^>]*>/g;
      while ((match = textPattern.exec(html)) !== null) {
        const name = match[1].trim();
        if (name && 
            name.length > 3 && 
            name.length < 50 &&
            !name.toLowerCase().includes('hive') &&
            !name.toLowerCase().includes('value plan') &&
            !name.toLowerCase().includes('project reports') &&
            !seenProjects.has(name)) {
          seenProjects.add(name);
          projects.push({ name });
        }
      }
    }

    return projects;
  } catch (error) {
    console.error('Error fetching projects from website:', error);
    return [];
  }
}

// Parse KPIs from Google Sheet
async function fetchKPIsFromSheet(): Promise<Map<string, ProjectKPI>> {
  const kpiMap = new Map<string, ProjectKPI>();
  
  try {
    // Try default gid first
    const csvUrl = getProjectSheetsCsvUrl('0');
    const response = await fetch(csvUrl, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      console.error(`Failed to fetch Google Sheets data: ${response.status}`);
      return kpiMap;
    }

    const csvText = await response.text();

    return new Promise<Map<string, ProjectKPI>>((resolve, reject) => {
      Papa.parse(csvText, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const rows: string[][] = results.data as string[][];
            
            if (rows.length === 0) {
              return resolve(kpiMap);
            }

            // Find header row - look for common KPI column names
            let headerRowIndex = -1;
            const headerMap: Record<string, number> = {};

            for (let i = 0; i < Math.min(20, rows.length); i++) {
              const row = rows[i];
              if (!row || row.length === 0) continue;

              // Check if this row contains KPI headers
              const rowText = row.join(' ').toLowerCase();
              if (rowText.includes('event attendance') || 
                  rowText.includes('total budget') ||
                  rowText.includes('social media') ||
                  rowText.includes('athletes')) {
                headerRowIndex = i;
                
                // Map headers
                row.forEach((header, index) => {
                  const headerLower = String(header || '').toLowerCase().trim();
                  if (headerLower.includes('event attendance')) {
                    headerMap['eventAttendance'] = index;
                  } else if (headerLower.includes('swc athletes') || headerLower.includes('athletes')) {
                    headerMap['swcAthletes'] = index;
                  } else if (headerLower.includes('external athletes') || headerLower.includes('participation')) {
                    headerMap['externalAthletes'] = index;
                  } else if (headerLower.includes('total budget') && headerLower.includes('hbd')) {
                    headerMap['totalBudgetHbd'] = index;
                  } else if (headerLower.includes('social media') && headerLower.includes('views')) {
                    headerMap['totalSocialMediaViews'] = index;
                  } else if (headerLower.includes('athletes interested') || headerLower.includes('interested in hive')) {
                    headerMap['athletesInterestedInHive'] = index;
                  } else if (headerLower.includes('cost per person') || headerLower.includes('cost per')) {
                    headerMap['costPerPersonInterested'] = index;
                  } else if (headerLower.includes('partner') || headerLower.includes('shopping center')) {
                    headerMap['partnerShoppingCenter'] = index;
                  } else if (headerLower.includes('results') || headerLower.includes('result')) {
                    headerMap['results'] = index;
                  } else if (headerLower.includes('updated') || headerLower.includes('date')) {
                    headerMap['lastUpdated'] = index;
                  }
                });
                break;
              }
            }

            if (headerRowIndex === -1) {
              console.warn('Could not find KPI header row in sheet');
              return resolve(kpiMap);
            }

            // Find project name column - look for a column that might contain project names
            // This might be in a different row or column
            let projectNameColumn = -1;
            for (let i = 0; i < Math.min(10, rows.length); i++) {
              const row = rows[i];
              if (row) {
                for (let j = 0; j < row.length; j++) {
                  const cell = String(row[j] || '').toLowerCase().trim();
                  if (cell.includes('project') || cell.includes('dashboard') || cell.includes('report')) {
                    projectNameColumn = j;
                    break;
                  }
                }
                if (projectNameColumn !== -1) break;
              }
            }

            // Parse data rows
            for (let i = headerRowIndex + 1; i < rows.length; i++) {
              const row = rows[i];
              if (!row || row.length === 0) continue;

              // Try to find project name
              let projectName = '';
              if (projectNameColumn !== -1 && row[projectNameColumn]) {
                projectName = String(row[projectNameColumn]).trim();
              } else {
                // Fallback: use first non-empty cell as project name
                for (const cell of row) {
                  const cellValue = String(cell || '').trim();
                  if (cellValue && cellValue.length > 2 && !cellValue.match(/^\d+$/) && !cellValue.match(/^\$[\d,]+/)) {
                    projectName = cellValue;
                    break;
                  }
                }
              }

              if (!projectName || projectName.length < 3) continue;

              // Parse KPI values
              const kpi: ProjectKPI = {};

              if (headerMap['eventAttendance'] !== undefined) {
                const value = parseFloat(String(row[headerMap['eventAttendance']] || '').replace(/[^\d.-]/g, ''));
                if (!isNaN(value)) kpi.eventAttendance = value;
              }
              if (headerMap['swcAthletes'] !== undefined) {
                const value = parseFloat(String(row[headerMap['swcAthletes']] || '').replace(/[^\d.-]/g, ''));
                if (!isNaN(value)) kpi.swcAthletes = value;
              }
              if (headerMap['externalAthletes'] !== undefined) {
                const value = parseFloat(String(row[headerMap['externalAthletes']] || '').replace(/[^\d.-]/g, ''));
                if (!isNaN(value)) kpi.externalAthletes = value;
              }
              if (headerMap['totalBudgetHbd'] !== undefined) {
                const value = parseFloat(String(row[headerMap['totalBudgetHbd']] || '').replace(/[^\d.-]/g, ''));
                if (!isNaN(value)) kpi.totalBudgetHbd = value;
              }
              if (headerMap['totalSocialMediaViews'] !== undefined) {
                const value = parseFloat(String(row[headerMap['totalSocialMediaViews']] || '').replace(/[^\d.-]/g, ''));
                if (!isNaN(value)) kpi.totalSocialMediaViews = value;
              }
              if (headerMap['athletesInterestedInHive'] !== undefined) {
                const value = parseFloat(String(row[headerMap['athletesInterestedInHive']] || '').replace(/[^\d.-]/g, ''));
                if (!isNaN(value)) kpi.athletesInterestedInHive = value;
              }
              if (headerMap['costPerPersonInterested'] !== undefined) {
                const value = parseFloat(String(row[headerMap['costPerPersonInterested']] || '').replace(/[^\d.-]/g, ''));
                if (!isNaN(value)) kpi.costPerPersonInterested = value;
              }
              if (headerMap['partnerShoppingCenter'] !== undefined) {
                kpi.partnerShoppingCenter = String(row[headerMap['partnerShoppingCenter']] || '').trim();
              }
              if (headerMap['results'] !== undefined) {
                kpi.results = String(row[headerMap['results']] || '').trim();
              }
              if (headerMap['lastUpdated'] !== undefined) {
                kpi.lastUpdated = String(row[headerMap['lastUpdated']] || '').trim();
              }

              // Only add if we have at least one KPI value
              if (Object.keys(kpi).length > 0) {
                kpiMap.set(projectName.toLowerCase(), kpi);
              }
            }

            resolve(kpiMap);
          } catch (error) {
            reject(error);
          }
        },
        error: (error: Error) => {
          reject(error);
        },
      });
    });
  } catch (error) {
    console.error('Error fetching KPIs from sheet:', error);
    return kpiMap;
  }
}

// Match projects with KPIs
function matchProjectsWithKPIs(projects: Project[], kpiMap: Map<string, ProjectKPI>): Project[] {
  return projects.map(project => {
    // Try exact match first
    let kpi = kpiMap.get(project.name.toLowerCase());
    
    // Try partial match if exact match fails
    if (!kpi) {
      for (const [key, value] of kpiMap.entries()) {
        if (project.name.toLowerCase().includes(key) || key.includes(project.name.toLowerCase())) {
          kpi = value;
          break;
        }
      }
    }

    return {
      ...project,
      kpis: kpi,
    };
  });
}

export async function GET(): Promise<NextResponse> {
  try {
    // Fetch projects and KPIs in parallel
    const [projects, kpiMap] = await Promise.all([
      fetchProjectsFromWebsite(),
      fetchKPIsFromSheet(),
    ]);

    // Match projects with their KPIs
    const projectsWithKPIs = matchProjectsWithKPIs(projects, kpiMap);

    const responseData: ProjectsData = {
      projects: projectsWithKPIs,
      totalProjects: projectsWithKPIs.length,
      projectsWithKPIs: projectsWithKPIs.filter(p => p.kpis && Object.keys(p.kpis).length > 0).length,
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching projects data:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch projects data',
        details: error instanceof Error ? error.message : 'Unknown error',
        projects: [],
        totalProjects: 0,
        projectsWithKPIs: 0,
      },
      { status: 500 }
    );
  }
}

