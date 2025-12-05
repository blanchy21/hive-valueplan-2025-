export interface Vertical {
  project: string;
  category: string;
  type: string;
  status: string;
  year?: string;
}

export interface VerticalCategory {
  name: string;
  description: string;
  projects: Vertical[];
  totalHbd?: number;
  totalHive?: number;
  totalHiveInHbd?: number;
  combinedTotalHbd?: number;
}

export interface VerticalsData {
  categories: VerticalCategory[];
  projects: Vertical[];
  byStatus: Record<string, Vertical[]>;
  byCategory: Record<string, Vertical[]>;
}

