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
        <div className="text-gray-600">Loading projects data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <h3 className="font-semibold mb-2">Unable to load projects data</h3>
        <p>Please check the browser console for detailed error messages</p>
      </div>
    );
  }

  // Check if there's an error in the response
  if (data && 'error' in data && data.error) {
    const errorData = data as ProjectsData & { error: string; details?: string };
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-yellow-800">
        <h3 className="font-semibold mb-2 text-lg">Warning: {String(errorData.error)}</h3>
        {errorData.details && (
          <p className="mb-2 text-sm">{String(errorData.details)}</p>
        )}
      </div>
    );
  }

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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Project Reports</h1>
        <p className="mt-2 text-lg text-gray-600">
          Projects and their KPIs from project organizers
        </p>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-medium text-gray-600">Total Projects</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">{data.totalProjects}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-medium text-gray-600">Projects with KPIs</h3>
          <p className="mt-2 text-3xl font-bold text-green-600">{data.projectsWithKPIs}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-medium text-gray-600">Projects without KPIs</h3>
          <p className="mt-2 text-3xl font-bold text-orange-600">
            {data.totalProjects - data.projectsWithKPIs}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Search Projects
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by project name..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyWithKPIs}
                onChange={e => setShowOnlyWithKPIs(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Show only projects with KPIs
              </span>
            </label>
          </div>
        </div>
        {(searchQuery || showOnlyWithKPIs) && (
          <button
            onClick={() => {
              setSearchQuery('');
              setShowOnlyWithKPIs(false);
            }}
            className="mt-4 text-sm text-blue-600 hover:text-blue-800"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-gray-500">No projects found matching your filters.</p>
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

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex-1">
          {project.name}
        </h3>
        {hasKPIs && (
          <span className="ml-2 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
            Has KPIs
          </span>
        )}
      </div>

      {project.url && (
        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:text-blue-800 mb-4 inline-block"
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
            <div className="rounded-md bg-gray-50 p-3">
              <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                Event Metrics
              </div>
              <div className="space-y-1">
                {project.kpis!.eventAttendance !== undefined && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Event Attendance:</span>
                    <span className="font-semibold text-gray-900">
                      {project.kpis!.eventAttendance.toLocaleString()}
                    </span>
                  </div>
                )}
                {project.kpis!.swcAthletes !== undefined && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">SWC Athletes:</span>
                    <span className="font-semibold text-gray-900">
                      {project.kpis!.swcAthletes.toLocaleString()}
                    </span>
                  </div>
                )}
                {project.kpis!.externalAthletes !== undefined && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">External Athletes:</span>
                    <span className="font-semibold text-gray-900">
                      {project.kpis!.externalAthletes.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Budget Metrics */}
          {project.kpis!.totalBudgetHbd !== undefined && (
            <div className="rounded-md bg-blue-50 p-3">
              <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">
                Budget
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-600">Total Budget:</span>
                <span className="text-base font-bold text-blue-900">
                  {formatCurrency(project.kpis!.totalBudgetHbd, 2)} HBD
                </span>
              </div>
            </div>
          )}

          {/* Social Media Metrics */}
          {project.kpis!.totalSocialMediaViews !== undefined && (
            <div className="rounded-md bg-purple-50 p-3">
              <div className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">
                Social Media
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-purple-600">Total Views:</span>
                <span className="text-base font-bold text-purple-900">
                  {project.kpis!.totalSocialMediaViews.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Engagement Metrics */}
          {(project.kpis!.athletesInterestedInHive !== undefined ||
            project.kpis!.costPerPersonInterested !== undefined) && (
            <div className="rounded-md bg-green-50 p-3">
              <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">
                Engagement
              </div>
              <div className="space-y-1">
                {project.kpis!.athletesInterestedInHive !== undefined && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-600">Athletes Interested:</span>
                    <span className="font-semibold text-green-900">
                      {project.kpis!.athletesInterestedInHive.toLocaleString()}
                    </span>
                  </div>
                )}
                {project.kpis!.costPerPersonInterested !== undefined && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-600">Cost per Person:</span>
                    <span className="font-semibold text-green-900">
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
            <div className="rounded-md bg-gray-50 p-3">
              <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                Additional Info
              </div>
              <div className="space-y-1 text-sm">
                {project.kpis!.partnerShoppingCenter && (
                  <div>
                    <span className="text-gray-600">Partner: </span>
                    <span className="text-gray-900">{project.kpis!.partnerShoppingCenter}</span>
                  </div>
                )}
                {project.kpis!.results && (
                  <div>
                    <span className="text-gray-600">Results: </span>
                    <span className="text-gray-900">{project.kpis!.results}</span>
                  </div>
                )}
                {project.kpis!.lastUpdated && (
                  <div>
                    <span className="text-gray-600">Last Updated: </span>
                    <span className="text-gray-900">{project.kpis!.lastUpdated}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 text-sm text-gray-500 italic">
          No KPIs available for this project
        </div>
      )}
    </div>
  );
}

