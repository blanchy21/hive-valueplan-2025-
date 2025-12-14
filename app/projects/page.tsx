'use client';

import { useEffect, useState } from 'react';
import { Project, ProjectsData } from '@/lib/types/projects';
import { formatCurrency } from '@/lib/utils/format';

type ProjectsResponse = ProjectsData | (ProjectsData & {
  error?: string;
  details?: string;
});

export default function ProjectsPage() {
  const [data, setData] = useState<ProjectsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyWithKPIs, setShowOnlyWithKPIs] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    fetch('/api/projects')
      .then(res => res.json())
      .then(fetchedData => {
        setData(fetchedData);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching projects:', err);
        setLoading(false);
      });
    return () => clearTimeout(timer);
  }, []);

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-[#94a3b8]">Loading projects data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-[#ef4444]/50 bg-[#ef4444]/10 p-4 text-[#ef4444]">
        <h3 className="font-semibold mb-2">Unable to load projects data</h3>
        <p>Please check the browser console for detailed error messages</p>
      </div>
    );
  }

  // Check if there's an error in the response
  if (data && 'error' in data && data.error) {
    const errorData = data as ProjectsData & { error: string; details?: string };
    return (
      <div className="rounded-lg border border-[#475569] bg-[#1e293b] p-6 text-[#94a3b8]">
        <h3 className="font-semibold mb-2 text-lg text-white">Warning: {String(errorData.error)}</h3>
        {errorData.details && (
          <p className="mb-2 text-sm">{String(errorData.details)}</p>
        )}
      </div>
    );
  }

  // Get unique categories from projects with verticals data
  const categories = Array.from(
    new Set(
      data.projects
        .filter(p => p.verticals?.category)
        .map(p => p.verticals!.category!)
    )
  ).sort();

  // Filter projects
  let filteredProjects = data.projects;
  if (searchQuery) {
    filteredProjects = filteredProjects.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }
  if (showOnlyWithKPIs) {
    filteredProjects = filteredProjects.filter(p => 
      p.kpis && Object.keys(p.kpis).length > 0
    );
  }
  if (selectedCategory) {
    filteredProjects = filteredProjects.filter(p =>
      p.verticals?.category === selectedCategory
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white">Project Reports</h1>
        <p className="mt-2 text-lg text-[#94a3b8]">
          Projects and their KPIs from project organizers
        </p>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="rounded-lg border border-[#334155] bg-[#1e293b] p-6 shadow-sm">
          <h3 className="text-sm font-medium text-[#94a3b8]">Total Projects</h3>
          <p className="mt-2 text-3xl font-bold text-white">{data.totalProjects}</p>
        </div>
        <div className="rounded-lg border border-[#334155] bg-[#1e293b] p-6 shadow-sm">
          <h3 className="text-sm font-medium text-[#94a3b8]">Projects with KPIs</h3>
          <p className="mt-2 text-3xl font-bold text-[#ef4444]">{data.projectsWithKPIs}</p>
        </div>
        <div className="rounded-lg border border-[#334155] bg-[#1e293b] p-6 shadow-sm">
          <h3 className="text-sm font-medium text-[#94a3b8]">Projects with Verticals</h3>
          <p className="mt-2 text-3xl font-bold text-[#ef4444]">
            {data.projects.filter(p => p.verticals && (p.verticals.category || p.verticals.status)).length}
          </p>
        </div>
        <div className="rounded-lg border border-[#334155] bg-[#1e293b] p-6 shadow-sm">
          <h3 className="text-sm font-medium text-[#94a3b8]">Categories</h3>
          <p className="mt-2 text-3xl font-bold text-white">{categories.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-lg border border-[#334155] bg-[#1e293b] p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-[#94a3b8]">
              Search Projects
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by project name..."
              className="w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white placeholder-[#64748b] focus:border-[#ef4444] focus:outline-none focus:ring-1 focus:ring-[#ef4444]"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[#94a3b8]">
              Filter by Category
            </label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-white focus:border-[#ef4444] focus:outline-none focus:ring-1 focus:ring-[#ef4444]"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyWithKPIs}
                onChange={e => setShowOnlyWithKPIs(e.target.checked)}
                className="rounded border-[#334155] text-[#ef4444] focus:ring-[#ef4444]"
              />
              <span className="text-sm font-medium text-[#94a3b8]">
                Show only projects with KPIs
              </span>
            </label>
          </div>
        </div>
        {(searchQuery || showOnlyWithKPIs || selectedCategory) && (
          <button
            onClick={() => {
              setSearchQuery('');
              setShowOnlyWithKPIs(false);
              setSelectedCategory('');
            }}
            className="mt-4 text-sm text-[#ef4444] hover:text-[#dc2626]"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="rounded-lg border border-[#334155] bg-[#1e293b] p-8 text-center">
          <p className="text-[#94a3b8]">No projects found matching your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project, index) => (
            <ProjectCard key={index} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const hasKPIs = project.kpis && Object.keys(project.kpis).length > 0;
  const hasVerticals = project.verticals && (
    project.verticals.category || 
    project.verticals.status || 
    project.verticals.type
  );

  // Get status color
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'Ongoing':
        return 'bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30';
      case 'Transitioning':
        return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
      case 'Concluded':
        return 'bg-[#94a3b8]/20 text-[#94a3b8] border border-[#94a3b8]/30';
      case 'Initiating':
        return 'bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30';
      default:
        return 'bg-[#94a3b8]/20 text-[#94a3b8] border border-[#94a3b8]/30';
    }
  };

  return (
    <div className="rounded-lg border border-[#334155] bg-[#1e293b] p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex-1">
          {project.name}
        </h3>
        <div className="ml-2 flex flex-col gap-1 items-end">
          {hasKPIs && (
            <span className="rounded-full bg-[#ef4444]/20 px-2 py-1 text-xs font-medium text-[#ef4444] border border-[#ef4444]/30">
              Has KPIs
            </span>
          )}
          {project.verticals?.status && (
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(project.verticals.status)}`}>
              {project.verticals.status}
            </span>
          )}
        </div>
      </div>

      {/* Verticals Data */}
      {hasVerticals && project.verticals && (
        <div className="mb-4 rounded-md bg-[#0f172a] border border-[#334155] p-3">
          <div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-2">
            Project Category
          </div>
          <div className="space-y-1">
            {project.verticals.category && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#94a3b8]">Category:</span>
                <span className="font-semibold text-white">{project.verticals.category}</span>
              </div>
            )}
            {project.verticals.type && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#94a3b8]">Type:</span>
                <span className="font-semibold text-white">{project.verticals.type}</span>
              </div>
            )}
            {project.verticals.combinedTotalHbd !== undefined && project.verticals.combinedTotalHbd > 0 && (
              <div className="pt-2 mt-2 border-t border-[#334155] flex items-center justify-between">
                <span className="text-sm font-semibold text-[#94a3b8]">Category Spending:</span>
                <span className="text-base font-bold text-[#ef4444]">
                  {formatCurrency(project.verticals.combinedTotalHbd, 2)} HBD
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {project.url && (
        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[#ef4444] hover:text-[#dc2626] mb-4 inline-block"
        >
          View Report →
        </a>
      )}

      {hasKPIs ? (
        <div className="mt-4 space-y-3">
          {/* Event Metrics */}
          {(project.kpis!.eventAttendance !== undefined ||
            project.kpis!.swcAthletes !== undefined ||
            project.kpis!.externalAthletes !== undefined) && (
            <div className="rounded-md bg-[#0f172a] border border-[#334155] p-3">
              <div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-2">
                Event Metrics
              </div>
              <div className="space-y-1">
                {project.kpis!.eventAttendance !== undefined && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#94a3b8]">Event Attendance:</span>
                    <span className="font-semibold text-white">
                      {project.kpis!.eventAttendance.toLocaleString()}
                    </span>
                  </div>
                )}
                {project.kpis!.swcAthletes !== undefined && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#94a3b8]">SWC Athletes:</span>
                    <span className="font-semibold text-white">
                      {project.kpis!.swcAthletes.toLocaleString()}
                    </span>
                  </div>
                )}
                {project.kpis!.externalAthletes !== undefined && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#94a3b8]">External Athletes:</span>
                    <span className="font-semibold text-white">
                      {project.kpis!.externalAthletes.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Budget Metrics */}
          {project.kpis!.totalBudgetHbd !== undefined && (
            <div className="rounded-md bg-[#0f172a] border border-[#334155] p-3">
              <div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-2">
                Budget
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#94a3b8]">Total Budget:</span>
                <span className="text-base font-bold text-[#ef4444]">
                  {formatCurrency(project.kpis!.totalBudgetHbd, 2)} HBD
                </span>
              </div>
            </div>
          )}

          {/* Social Media Metrics */}
          {project.kpis!.totalSocialMediaViews !== undefined && (
            <div className="rounded-md bg-[#0f172a] border border-[#334155] p-3">
              <div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-2">
                Social Media
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#94a3b8]">Total Views:</span>
                <span className="text-base font-bold text-[#ef4444]">
                  {project.kpis!.totalSocialMediaViews.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Engagement Metrics */}
          {(project.kpis!.athletesInterestedInHive !== undefined ||
            project.kpis!.costPerPersonInterested !== undefined) && (
            <div className="rounded-md bg-[#0f172a] border border-[#334155] p-3">
              <div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-2">
                Engagement
              </div>
              <div className="space-y-1">
                {project.kpis!.athletesInterestedInHive !== undefined && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#94a3b8]">Athletes Interested:</span>
                    <span className="font-semibold text-white">
                      {project.kpis!.athletesInterestedInHive.toLocaleString()}
                    </span>
                  </div>
                )}
                {project.kpis!.costPerPersonInterested !== undefined && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#94a3b8]">Cost per Person:</span>
                    <span className="font-semibold text-[#ef4444]">
                      {formatCurrency(project.kpis!.costPerPersonInterested, 2)} HBD
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Additional Info */}
          {(project.kpis!.partnerShoppingCenter ||
            project.kpis!.results ||
            project.kpis!.lastUpdated) && (
            <div className="rounded-md bg-[#0f172a] border border-[#334155] p-3">
              <div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-2">
                Additional Info
              </div>
              <div className="space-y-1 text-sm">
                {project.kpis!.partnerShoppingCenter && (
                  <div>
                    <span className="text-[#94a3b8]">Partner: </span>
                    <span className="text-white">{project.kpis!.partnerShoppingCenter}</span>
                  </div>
                )}
                {project.kpis!.results && (
                  <div>
                    <span className="text-[#94a3b8]">Results: </span>
                    <span className="text-white">{project.kpis!.results}</span>
                  </div>
                )}
                {project.kpis!.lastUpdated && (
                  <div>
                    <span className="text-[#94a3b8]">Last Updated: </span>
                    <span className="text-white">{project.kpis!.lastUpdated}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 text-sm text-[#94a3b8] italic">
          No KPIs available for this project
        </div>
      )}
    </div>
  );
}

