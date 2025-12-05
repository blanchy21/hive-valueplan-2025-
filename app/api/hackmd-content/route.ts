import { NextResponse } from 'next/server';

const HACKMD_URL = 'https://hackmd.io/@OiDr4jcPSLihtxbMQuzbLg/B1geX8slWl';

export async function GET() {
  try {
    // HackMD documents can be accessed via their API or by fetching the raw markdown
    // Try to fetch the raw markdown version
    const rawUrl = `${HACKMD_URL}/download`;
    
    const response = await fetch(rawUrl, {
      next: { revalidate: 3600 },
      headers: {
        'Accept': 'text/markdown',
      },
    });

    if (!response.ok) {
      // If direct download doesn't work, try the API endpoint
      const apiUrl = `https://api.hackmd.io/v1/notes/${HACKMD_URL.split('/').pop()}`;
      const apiResponse = await fetch(apiUrl, {
        next: { revalidate: 3600 },
      });

      if (apiResponse.ok) {
        const data = await apiResponse.json();
        return NextResponse.json({ content: data.content || 'Content not available' });
      }

      // Fallback: return a message
      return NextResponse.json({
        content: `# HackMD Document\n\nUnable to fetch content directly. Please visit [the document](${HACKMD_URL}) to view the content.\n\nNote: HackMD content may require authentication or API access.`,
      });
    }

    const content = await response.text();
    return NextResponse.json({ content });
  } catch (error) {
    console.error('Error fetching HackMD content:', error);
    return NextResponse.json({
      content: `# HackMD Document\n\nError fetching content: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease visit [the document](${HACKMD_URL}) to view the content.`,
    });
  }
}

