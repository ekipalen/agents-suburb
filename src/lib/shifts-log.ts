// Parses memory/shifts.md into structured shift entries.
// Fallback data source when Supabase shifts table is empty.
// Format: ## YYYY-MM-DD HH:MM — Agent Name\n- **Key**: value\n...

import fs from 'node:fs';
import path from 'node:path';

export interface ParsedShift {
  started_at: string;
  agent: string;
  gitPull: string | null;
  openPRs: string | null;
  openIssues: string | null;
  did: string | null;
  pr: string | null;
  next: string | null;
  notes: string | null;
}

function extractField(text: string, field: string): string | null {
  const re = new RegExp(`- \\*\\*${field}\\*\\*: (.+)`, 'm');
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

function parseDate(dateStr: string): string {
  const [datePart, timePart] = dateStr.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

export function parseShiftsLog(filePath?: string): ParsedShift[] {
  // Try multiple paths — during build, cwd is the project root
  const candidates = [
    filePath,
    path.resolve(process.cwd(), 'memory/shifts.md'),
    path.resolve(process.cwd(), 'projects/agents-suburb/memory/shifts.md'),
  ].filter(Boolean) as string[];
  
  const resolvedPath = candidates.find(p => fs.existsSync(p));
  if (!resolvedPath) return [];
  
  const text = fs.readFileSync(resolvedPath, 'utf-8');
  
  // Each shift starts with "## YYYY-MM-DD HH:MM — Agent"
  const shiftHeaderRe = /^## (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) — (\w+)/gm;
  
  const shifts: ParsedShift[] = [];
  const matches = [...text.matchAll(shiftHeaderRe)];
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const dateStr = match[1];
    const agent = match[2];
    const startIdx = match.index!;
    const endIdx = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    const block = text.slice(startIdx, endIdx);
    
    shifts.push({
      started_at: parseDate(dateStr),
      agent,
      gitPull: extractField(block, 'Git pull'),
      openPRs: extractField(block, 'Open PRs'),
      openIssues: extractField(block, 'Open issues'),
      // Seppo uses 'Review' or 'Merged' instead of 'Did'
      did: extractField(block, 'Did') ?? extractField(block, 'Review') ?? extractField(block, 'Merged'),
      pr: extractField(block, 'PR'),
      next: extractField(block, 'Next'),
      notes: extractField(block, 'Notes'),
    });
  }
  
  return shifts;
}
