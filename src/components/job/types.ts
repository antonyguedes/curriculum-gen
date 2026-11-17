import type { CoverageItem, JobPosting } from "@/lib/types";

export interface JobPayload {
  job: JobPosting;
  coverage: CoverageItem[];
  years: number;
  targets: { id: string; label: string }[];
  profileReady: boolean;
}
