import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Batch grouping helper for participant roll numbers
// Returns one of: '25' | '24' | '23' | 'senior'
export function getBatchGroup(rollNumber: string | undefined | null): '25' | '24' | '23' | 'senior' {
  if (!rollNumber || rollNumber.length < 2) return 'senior';
  const prefix = rollNumber.slice(0, 2);
  if (prefix === '25' || prefix === '24' || prefix === '23') return prefix as '25'|'24'|'23';
  return 'senior';
}
