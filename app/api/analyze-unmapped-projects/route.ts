import { NextResponse } from 'next/server';
import { getVerticalsData } from '@/lib/data/verticals';
import { Transaction } from '@/lib/types';
import { parseDate, filterSpendingTransactions, calculateTotalSpend } from '@/lib/utils/data';
import { getSheetsCsvUrl, SHEET_TABS } from '@/lib/utils/sheets';
import Papa from 'papaparse';

const SHEETS_CSV_URL = getSheetsCsvUrl(SHEET_TABS.TRANSACTIONS);

async function fetchTransactions(): Promise<Transaction[]> {
  try {
    const response = await fetch(SHEETS_CSV_URL, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Google Sheets data: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();
    
    return new Promise<Transaction[]>((resolve, reject) => {
      Papa.parse(csvText, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const rows: string[][] = results.data as string[][];
            
            // Find the header row (same logic as transactions API)
            let headerRowIndex = -1;
            for (let i = 0; i < Math.min(10, rows.length); i++) {
              const row = rows[i];
              if (row && row.length > 0) {
                const firstCell = String(row[0] || '').toLowerCase().trim();
                if (firstCell === 'wallet' || firstCell.includes('wallet')) {
                  headerRowIndex = i;
                  break;
                }
              }
            }

            if (headerRowIndex === -1) {
              return reject(new Error('Could not find header row in CSV'));
            }

            const headerRow = rows[headerRowIndex];
            const headerMap: Record<string, number> = {};
            
            headerRow.forEach((header, index) => {
              const headerLower = String(header || '').toLowerCase().trim();
              if (headerLower === 'wallet' || headerLower.includes('wallet')) {
                if (!headerMap['wallet']) headerMap['wallet'] = index;
              } else if (headerLower === 'date' || headerLower.includes('date')) {
                if (!headerMap['date']) headerMap['date'] = index;
              } else if (headerLower === 'hbd' || (headerLower.includes('hbd') && !headerLower.includes('total'))) {
                if (!headerMap['hbd']) headerMap['hbd'] = index;
              } else if (headerLower === 'hive' || (headerLower.includes('hive') && !headerLower.includes('total'))) {
                if (!headerMap['hive']) headerMap['hive'] = index;
              } else if ((headerLower.includes('event') || headerLower.includes('project')) && 
                        (headerLower.includes('/') || headerLower.includes('event') && headerLower.includes('project'))) {
                if (!headerMap['eventProject']) headerMap['eventProject'] = index;
              } else if (headerLower === 'category' || headerLower.includes('category')) {
                if (!headerMap['category']) headerMap['category'] = index;
              }
            });

            const transactions: Transaction[] = [];
            
            for (let i = headerRowIndex + 1; i < rows.length; i++) {
              const row = rows[i];
              if (!row || row.length === 0) continue;

              const wallet = String(row[headerMap['wallet']] || '').trim();
              const date = String(row[headerMap['date']] || '').trim();

              if (!wallet || !date) continue;

              try {
                const parsedDate = parseDate(date);
                const year = parsedDate.getFullYear();
                if (year < 2020 || year > 2030) continue;
              } catch {
                continue;
              }

              const hbd = parseFloat(String(row[headerMap['hbd']] || 0)) || 0;
              const hive = parseFloat(String(row[headerMap['hive']] || 0)) || 0;
              
              const transaction: Transaction = {
                wallet,
                date,
                hbd,
                hive,
                eventProject: String(row[headerMap['eventProject']] || '').trim(),
                country: '',
                theme: '',
                eventType: '',
                category: String(row[headerMap['category']] || '').trim(),
              };

              transaction.totalSpend = calculateTotalSpend(transaction);
              transactions.push(transaction);
            }

            resolve(transactions);
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
    console.error('Error fetching transactions:', error);
    return [];
  }
}

function matchesVerticalProject(eventProject: string, verticalProjects: Array<{ project: string }>): boolean {
  const eventProjectLower = (eventProject || '').trim().toLowerCase();
  if (!eventProjectLower) return false;
  
  // Normalize by removing spaces and special characters for better matching (handles "Hive Fest" vs "HiveFest")
  const eventProjectNormalized = eventProjectLower.replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');

  return verticalProjects.some(vp => {
    const projectLower = vp.project.toLowerCase();
    const projectNormalized = projectLower.replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    
    // Try exact match first
    if (eventProjectLower === projectLower) {
      return true;
    }
    
    // Try normalized match (handles "Hive Fest" vs "HiveFest")
    if (eventProjectNormalized === projectNormalized) {
      return true;
    }
    
    // Try partial match with normalized strings (handles "Hive Wrestle Fest" vs "Wrestlefest")
    if (eventProjectNormalized.includes(projectNormalized) || 
        projectNormalized.includes(eventProjectNormalized)) {
      return true;
    }
    
    // Try partial match with original strings (fallback)
    return eventProjectLower.includes(projectLower) || 
           projectLower.includes(eventProjectLower);
  });
}

export async function GET(): Promise<NextResponse> {
  try {
    const year = 2025;
    
    // Get vertical projects
    const verticalsData = getVerticalsData();
    const verticalProjects = verticalsData.projects.map(p => ({ project: p.project }));
    
    // Fetch transactions
    const allTransactions = await fetchTransactions();
    const spendingTransactions = filterSpendingTransactions(allTransactions);
    
    // Filter to 2025
    const transactions2025 = spendingTransactions.filter(tx => {
      try {
        const txDate = parseDate(tx.date);
        return txDate.getFullYear() === year;
      } catch {
        return false;
      }
    });
    
    // Group by eventProject
    const projectsMap = new Map<string, {
      count: number;
      totalHbd: number;
      totalHive: number;
      totalSpend: number;
      wallets: Set<string>;
      categories: Set<string>;
      matched: boolean;
    }>();
    
    transactions2025.forEach(tx => {
      const project = tx.eventProject?.trim() || 'Unknown';
      const existing = projectsMap.get(project) || {
        count: 0,
        totalHbd: 0,
        totalHive: 0,
        totalSpend: 0,
        wallets: new Set<string>(),
        categories: new Set<string>(),
        matched: false
      };
      
      existing.count += 1;
      existing.totalHbd += tx.hbd || 0;
      existing.totalHive += tx.hive || 0;
      existing.totalSpend += tx.totalSpend || 0;
      if (tx.wallet) existing.wallets.add(tx.wallet);
      if (tx.category) existing.categories.add(tx.category);
      existing.matched = matchesVerticalProject(project, verticalProjects);
      
      projectsMap.set(project, existing);
    });
    
    // Separate matched and unmatched
    const matchedProjects: Array<{
      project: string;
      count: number;
      totalSpend: number;
      totalHbd: number;
      totalHive: number;
      wallets: string[];
      categories: string[];
    }> = [];
    
    const unmatchedProjects: Array<{
      project: string;
      count: number;
      totalSpend: number;
      totalHbd: number;
      totalHive: number;
      wallets: string[];
      categories: string[];
    }> = [];
    
    projectsMap.forEach((data, project) => {
      const projectData = {
        project,
        count: data.count,
        totalSpend: data.totalSpend,
        totalHbd: data.totalHbd,
        totalHive: data.totalHive,
        wallets: Array.from(data.wallets),
        categories: Array.from(data.categories)
      };
      
      if (data.matched) {
        matchedProjects.push(projectData);
      } else {
        unmatchedProjects.push(projectData);
      }
    });
    
    // Sort by total spend (descending)
    matchedProjects.sort((a, b) => b.totalSpend - a.totalSpend);
    unmatchedProjects.sort((a, b) => b.totalSpend - a.totalSpend);
    
    const totalMatched = matchedProjects.reduce((sum, p) => sum + p.totalSpend, 0);
    const totalUnmatched = unmatchedProjects.reduce((sum, p) => sum + p.totalSpend, 0);
    const totalSpending = totalMatched + totalUnmatched;
    
    // Check if Refund is in unmatched projects
    const refundProject = unmatchedProjects.find(p => p.project === 'Refund');
    const note = refundProject 
      ? `Note: The unmatched total includes ${refundProject.totalSpend.toFixed(2)} HBD from "Refund" transactions (loan payments), which are intentionally not mapped to vertical projects as they represent loan repayments rather than spending categories.`
      : undefined;
    
    return NextResponse.json({
      year,
      summary: {
        totalProjects: projectsMap.size,
        matchedProjects: matchedProjects.length,
        unmatchedProjects: unmatchedProjects.length,
        totalSpending,
        totalMatched,
        totalUnmatched,
        matchPercentage: (totalMatched / totalSpending * 100).toFixed(2) + '%',
        note
      },
      matchedProjects,
      unmatchedProjects,
      verticalProjects: verticalProjects.map(vp => vp.project)
    });
  } catch (error) {
    console.error('Error analyzing unmapped projects:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze unmapped projects',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
