import { NextResponse } from 'next/server';

// GitLab repository URLs
const GITLAB_BASE = 'https://gitlab.syncad.com/hive/marketing/-/raw/master';
const VALUE_PLAN_PATH = '/strategy/Value%20Plan';
const PLANNING_PATH = '/planning';

async function fetchGitLabDirectory(path: string, additionalFiles: string[] = []): Promise<string> {
  // Start with common README files, then add path-specific files
  const possibleFiles = ['ReadMe.md', 'README.md', 'readme.md', ...additionalFiles, 'index.md', 'README.txt', 'index.txt'];
  
  // Try multiple possible file names
  for (const filename of possibleFiles) {
    try {
      const fileUrl = `${GITLAB_BASE}${path}/${filename}`;
      const response = await fetch(fileUrl, {
        next: { revalidate: 3600 },
      });

      if (response.ok) {
        const content = await response.text();
        if (content && content.trim().length > 0) {
          return content;
        }
      }
    } catch {
      // Continue to next file
      continue;
    }
  }

  // Try to fetch the directory itself (might be a single file)
  try {
    const dirResponse = await fetch(`${GITLAB_BASE}${path}`, {
      next: { revalidate: 3600 },
    });
    
    if (dirResponse.ok) {
      const contentType = dirResponse.headers.get('content-type');
      if (contentType && contentType.includes('text')) {
        const content = await dirResponse.text();
        if (content && content.trim().length > 0) {
          return content;
        }
      }
    }
  } catch {
    // Continue to error message
  }

  // If all attempts failed, return informative error message
  const displayPath = decodeURIComponent(path);
  return `# Content Not Available

## ${displayPath}

**Status**: Unable to fetch content from GitLab repository

**Possible reasons:**
- The file or directory does not exist at this path
- The GitLab repository requires authentication
- The repository URL or path structure has changed
- Network connectivity issues

**Repository URL**: \`${GITLAB_BASE}${path}\`

Please check:
1. That the GitLab repository is accessible
2. That the files exist at the expected paths
3. That authentication is configured if required
4. The repository URL in the API route configuration

If you need to update the repository URL or paths, please check \`app/api/gitlab-content/route.ts\`.`;
}

export async function GET() {
  try {
    const [valuePlanContent, planningContent] = await Promise.all([
      fetchGitLabDirectory(VALUE_PLAN_PATH, ['projectgoals.md', 'strategy.md', 'valueplan.md']),
      fetchGitLabDirectory(PLANNING_PATH),
    ]);

    return NextResponse.json({
      valuePlan: valuePlanContent,
      planning: planningContent,
    });
  } catch (error) {
    console.error('Error fetching GitLab content:', error);
    return NextResponse.json(
      {
        valuePlan: `Error fetching Value Plan content: ${error instanceof Error ? error.message : 'Unknown error'}`,
        planning: `Error fetching planning content: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}

