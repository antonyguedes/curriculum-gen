/** Linha da listagem de vagas (GET /api/jobs). */
export interface JobRow {
  id: string;
  createdAt: string;
  title: string;
  company: string;
  language: string;
  versions: number;
  bestScore: number | null;
  reviewed: boolean;
  downloaded: boolean;
}
