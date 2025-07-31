import { analyzeCode } from './aiDetection';
import type { AnalysisResult, LineAnalysis } from './aiDetection';

export interface FileAnalysis {
  path: string;
  language: string;
  analysis: AnalysisResult;
  size: number;
}

export interface CommitAnalysis {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  committer: {
    name: string;
    email: string;
    date: string;
  };
  stats: {
    additions: number;
    deletions: number;
    total: number;
  };
  isAI: boolean;
  confidence: number;
  reasons: string[];
  url: string;
}

export interface ContributorStats {
  name: string;
  email: string;
  totalCommits: number;
  totalAdditions: number;
  totalDeletions: number;
  estimatedHours: number;
  aiCommitPercentage: number;
  firstCommit: string;
  lastCommit: string;
  commitDays: string[];
}

export interface TimelineStats {
  date: string;
  commits: number;
  additions: number;
  deletions: number;
  aiCommits: number;
  estimatedHours: number;
  contributors: string[];
}

export interface RepositoryAnalysis {
  repositoryUrl: string;
  originalRepositoryUrl?: string;
  isForked: boolean;
  totalFiles: number;
  analyzedFiles: number;
  totalBranches: number;
  files: FileAnalysis[];
  overallStats: {
    totalLines: number;
    aiLines: number;
    humanLines: number;
    aiPercentage: number;
    humanPercentage: number;
    overallConfidence: number;
  };
  hasLovableLabel: boolean;
  commitAnalysis?: {
    totalCommits: number;
    commits: CommitAnalysis[];
    contributors: ContributorStats[];
    timeline: TimelineStats[];
    totalEstimatedHours: number;
    aiCommitPercentage: number;
    projectStartDate: string;
    projectEndDate: string;
  };
}

interface GitHubFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  download_url?: string;
  size: number;
  branch?: string;
}

interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
  };
}

interface GitHubRepo {
  fork: boolean;
  parent?: {
    full_name: string;
    html_url: string;
  };
}

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
  };
  html_url: string;
  stats?: {
    additions: number;
    deletions: number;
    total: number;
  };
}

// Language detection based on file extensions
const LANGUAGE_MAP: Record<string, string> = {
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.py': 'python',
  '.java': 'java',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.c++': 'cpp',
  '.cs': 'csharp',
  '.go': 'go',
  '.rs': 'rust',
  '.php': 'php',
  '.rb': 'ruby',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.sh': 'bash',
  '.sql': 'sql',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.xml': 'xml',
  '.md': 'markdown'
};

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.toLowerCase().match(/\.[^.]*$/)?.[0];
  return ext ? LANGUAGE_MAP[ext] || 'text' : 'text';
}

function shouldAnalyzeFile(filePath: string): boolean {
  // Skip files in node_modules
  if (filePath.includes('node_modules/')) return false;
  
  const ext = filePath.toLowerCase().match(/\.[^.]*$/)?.[0];
  if (!ext) return false;
  
  // Analyze all text-based files including markdown, code, config files, etc.
  const textExtensions = [
    '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.cc', '.cxx', '.c++', 
    '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.scala', '.vue', '.svelte',
    '.html', '.css', '.scss', '.sass', '.md', '.mdx', '.txt', '.json', '.yaml', '.yml',
    '.xml', '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd', '.sql', '.r',
    '.dart', '.lua', '.perl', '.pl', '.clj', '.cljs', '.elm', '.ex', '.exs', '.fs',
    '.fsx', '.fsi', '.ml', '.mli', '.hs', '.lhs', '.jl', '.nim', '.cr', '.d', '.pas',
    '.pp', '.dpr', '.dfm', '.inc', '.asm', '.s', '.S', '.dockerfile', '.cmake',
    '.mk', '.makefile', '.gradle', '.sbt', '.pom', '.csproj', '.fsproj', '.vbproj',
    '.vcxproj', '.pbxproj', '.xcconfig', '.plist', '.ini', '.cfg', '.conf', '.config',
    '.toml', '.lock', '.env', '.gitignore', '.gitattributes', '.editorconfig'
  ];
  if (!textExtensions.includes(ext)) return false;
  
  // Skip framework-provided and generated files
  const excludePatterns = [
    // Framework UI components (shadcn/ui, etc.)
    /\/components\/ui\//,
    /\/ui\//,
    /\.shadcn\//,
    
    // Build and dependency folders
    /node_modules\//,
    /dist\//,
    /build\//,
    /\.next\//,
    /\.nuxt\//,
    /coverage\//,
    
    // Generated files
    /\.generated\./,
    /\.gen\./,
    /\.d\.ts$/,
    /types\.ts$/,
    /index\.d\.ts$/,
    
    // Configuration files (usually auto-generated or boilerplate)
    /tailwind\.config\./,
    /vite\.config\./,
    /webpack\.config\./,
    /next\.config\./,
    /nuxt\.config\./,
    /rollup\.config\./,
    /babel\.config\./,
    /jest\.config\./,
    /vitest\.config\./,
    /postcss\.config\./,
    /eslint\.config\./,
    /prettier\.config\./,
    
    // Package files
    /package\.json$/,
    /package-lock\.json$/,
    /yarn\.lock$/,
    /pnpm-lock\.yaml$/,
    /bun\.lockb$/,
    
    // Common boilerplate files
    /\/(main|index)\.(js|ts|jsx|tsx)$/,
    /App\.(js|ts|jsx|tsx)$/,
    
    // Test files (unless specifically requested)
    /\.(test|spec)\.(js|ts|jsx|tsx)$/,
    /__tests__\//,
    /\.test\//,
    
    
    // Hidden and config folders
    /\/\./,
    /\.git\//,
    /\.vscode\//,
    /\.idea\//
  ];
  
  // Check if file should be excluded
  for (const pattern of excludePatterns) {
    if (pattern.test(filePath)) {
      return false;
    }
  }
  
  // Additional checks for boilerplate files in src folder
  if (filePath.includes('src/') && 
      (filePath.match(/\/(main|index)\.(js|ts|jsx|tsx)$/) || 
       filePath.match(/App\.(js|ts|jsx|tsx)$/))) {
    return false;
  }
  
  return true;
}

async function fetchGitHubContents(owner: string, repo: string, path: string = '', branch: string = 'main'): Promise<GitHubFile[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      // Try 'master' branch if 'main' fails
      if (branch === 'main') {
        return fetchGitHubContents(owner, repo, path, 'master');
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const files = Array.isArray(data) ? data : [data];
    return files.map(file => ({ ...file, branch }));
  } catch (error) {
    console.error(`Error fetching GitHub contents for ${owner}/${repo}/${path} (branch: ${branch}):`, error);
    throw error;
  }
}

async function fetchGitHubRepo(owner: string, repo: string): Promise<GitHubRepo> {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching repo info for ${owner}/${repo}:`, error);
    throw error;
  }
}

async function fetchGitHubBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/branches`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching branches for ${owner}/${repo}:`, error);
    return [];
  }
}

async function fetchFileContent(downloadUrl: string): Promise<string> {
  try {
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.error(`Error fetching file content from ${downloadUrl}:`, error);
    throw error;
  }
}

function shouldSkipDirectory(dirPath: string, dirName: string): boolean {
  // Skip common directories that don't contain developer-written code
  const skipPatterns = [
    // Dependencies and build outputs
    'node_modules',
    'dist',
    'build',
    '.next',
    '.nuxt',
    'coverage',
    '.nyc_output',
    'public',
    'static',
    'assets',
    
    // Framework generated folders
    'components/ui',
    '.generated',
    '.gen',
    
    // Version control and IDE
    '.git',
    '.svn',
    '.hg',
    '.vscode',
    '.idea',
    '.vs',
    
    // Config folders
    '.husky',
    '.github',
    '.gitlab',
    
    // Temp folders
    'tmp',
    'temp',
    '.cache',
    '.temp'
  ];
  
  // Check exact matches
  if (skipPatterns.includes(dirName)) return true;
  
  // Check path patterns
  if (dirPath.includes('/node_modules/') || 
      dirPath.includes('/components/ui/') ||
      dirPath.includes('/.') ||
      dirPath.includes('/dist/') ||
      dirPath.includes('/build/')) {
    return true;
  }
  
  return false;
}

async function getAllFiles(owner: string, repo: string, path: string = '', maxDepth: number = 4, branch: string = 'main'): Promise<GitHubFile[]> {
  if (maxDepth <= 0) return [];
  
  const contents = await fetchGitHubContents(owner, repo, path, branch);
  const allFiles: GitHubFile[] = [];
  
  for (const item of contents) {
    if (item.type === 'file') {
      allFiles.push(item);
    } else if (item.type === 'dir' && !shouldSkipDirectory(item.path, item.name)) {
      // Recursively fetch directory contents
      try {
        const subFiles = await getAllFiles(owner, repo, item.path, maxDepth - 1, branch);
        allFiles.push(...subFiles);
      } catch (error) {
        console.warn(`Skipping directory ${item.path} on branch ${branch}:`, error);
      }
    }
  }
  
  return allFiles;
}

async function getAllFilesFromAllBranches(owner: string, repo: string): Promise<{ files: GitHubFile[]; totalBranches: number }> {
  const branches = await fetchGitHubBranches(owner, repo);
  const allFiles: GitHubFile[] = [];
  const seenFiles = new Set<string>();
  
  // Prioritize main/master branch
  const sortedBranches = branches.sort((a, b) => {
    if (a.name === 'main' || a.name === 'master') return -1;
    if (b.name === 'main' || b.name === 'master') return 1;
    return a.name.localeCompare(b.name);
  });
  
  for (const branch of sortedBranches) {
    try {
      const branchFiles = await getAllFiles(owner, repo, '', 4, branch.name);
      
      for (const file of branchFiles) {
        const fileKey = `${file.path}-${file.size}`;
        
        // Only add if we haven't seen this exact file before
        if (!seenFiles.has(fileKey)) {
          seenFiles.add(fileKey);
          allFiles.push(file);
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch files from branch ${branch.name}:`, error);
    }
  }
  
  return { files: allFiles, totalBranches: branches.length };
}

async function checkForLovableKeyword(owner: string, repo: string, allFiles: GitHubFile[]): Promise<boolean> {
  // Check index.html and package.json in root
  const specialFiles = ['index.html', 'package.json'];
  
  for (const fileName of specialFiles) {
    const file = allFiles.find(f => f.name === fileName && f.path === fileName);
    if (file && file.download_url) {
      try {
        const content = await fetchFileContent(file.download_url);
        if (content.toLowerCase().includes('lovable')) {
          return true;
        }
      } catch (error) {
        console.warn(`Failed to check ${fileName} for lovable keyword:`, error);
      }
    }
  }
  
  // Check src folder files
  const srcFiles = allFiles.filter(file => file.path.startsWith('src/'));
  
  for (const file of srcFiles) {
    if (file.download_url) {
      try {
        const content = await fetchFileContent(file.download_url);
        if (content.toLowerCase().includes('lovable')) {
          return true;
        }
      } catch (error) {
        console.warn(`Failed to check ${file.path} for lovable keyword:`, error);
      }
    }
  }
  
  return false;
}

async function analyzeCommitMessage(message: string): Promise<{ isAI: boolean; confidence: number; reasons: string[] }> {
  const reasons: string[] = [];
  let confidence = 0;
  
  // Check for invisible Unicode characters
  const invisibleChars = /[\u200B-\u200D\uFEFF\u2060\u180E\u2061-\u2064]/;
  if (invisibleChars.test(message)) {
    reasons.push('Contains invisible Unicode characters');
    confidence = 1.0;
    return { isAI: true, confidence, reasons };
  }
  
  // Check for emojis
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
  if (emojiRegex.test(message)) {
    reasons.push('Contains emojis');
    confidence = Math.max(confidence, 0.9);
  }
  
  // AI-generated commit message patterns
  const aiPatterns = [
    // Perfect formatting patterns
    /^(feat|fix|docs|style|refactor|test|chore|ci|build|perf)(\(.+\))?\:\s.+$/i,
    /^(add|update|implement|create|fix|remove|delete|improve)\s/i,
    
    // Too formal/structured patterns
    /^(initial commit|first commit)$/i,
    /update\s+(readme|documentation)/i,
    /^(resolve|address)\s+issue/i,
    
    // Generic AI phrases
    /minor\s+(changes|updates|fixes)/i,
    /code\s+(cleanup|optimization|refactoring)/i,
    /improve\s+(performance|functionality|user\s+experience)/i,
    /enhance\s+(feature|component|ui)/i,
    /update\s+(dependencies|packages)/i,
  ];
  
  let patternMatches = 0;
  for (const pattern of aiPatterns) {
    if (pattern.test(message)) {
      patternMatches++;
      reasons.push(`Matches AI pattern: ${pattern.source}`);
    }
  }
  
  if (patternMatches > 0) {
    confidence = Math.max(confidence, Math.min(0.8, 0.3 + (patternMatches * 0.15)));
  }
  
  // Length patterns
  if (message.length > 100) {
    reasons.push('Unusually long commit message');
    confidence = Math.max(confidence, 0.6);
  }
  
  // Perfect grammar indicators
  const perfectGrammarIndicators = [
    /^\w[^.!?]*[.!?]$/,  // Starts with capital, ends with punctuation
    /\b(implement|establish|utilize|facilitate|optimize)\b/i,
    /\b(furthermore|additionally|moreover|consequently)\b/i,
  ];
  
  let grammarScore = 0;
  for (const indicator of perfectGrammarIndicators) {
    if (indicator.test(message)) {
      grammarScore++;
      reasons.push('Perfect grammar/formal language');
    }
  }
  
  if (grammarScore > 0) {
    confidence = Math.max(confidence, 0.5 + (grammarScore * 0.1));
  }
  
  const isAI = confidence > 0.5;
  return { isAI, confidence, reasons };
}

function estimateWorkHours(commits: CommitAnalysis[], timeWindow: number = 4): number {
  if (commits.length === 0) return 0;
  
  // Sort commits by date
  const sortedCommits = [...commits].sort((a, b) => 
    new Date(a.author.date).getTime() - new Date(b.author.date).getTime()
  );
  
  let totalHours = 0;
  let lastCommitTime: Date | null = null;
  
  for (const commit of sortedCommits) {
    const commitTime = new Date(commit.author.date);
    
    if (lastCommitTime) {
      const timeDiff = (commitTime.getTime() - lastCommitTime.getTime()) / (1000 * 60 * 60); // hours
      
      // If commits are within the time window, add the time difference
      // If gap is too large, assume it's a new session and add base time
      if (timeDiff <= timeWindow) {
        totalHours += timeDiff;
      } else {
        // New session, add base time for the commit
        totalHours += 0.5; // 30 minutes base time per isolated commit
      }
    } else {
      // First commit, add base time
      totalHours += 0.5;
    }
    
    // Add time based on commit size
    const commitComplexity = Math.min(commit.stats.total / 10, 2); // Max 2 hours per commit
    totalHours += commitComplexity;
    
    lastCommitTime = commitTime;
  }
  
  return Math.round(totalHours * 10) / 10; // Round to 1 decimal place
}

async function fetchGitHubCommits(owner: string, repo: string): Promise<GitHubCommit[]> {
  const commits: GitHubCommit[] = [];
  let page = 1;
  const perPage = 100;
  
  try {
    while (page <= 10) { // Limit to 1000 commits max
      const url = `https://api.github.com/repos/${owner}/${repo}/commits?page=${page}&per_page=${perPage}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.length === 0) break;
      
      // Fetch detailed stats for each commit
      const commitsWithStats = await Promise.all(
        data.map(async (commit: any) => {
          try {
            const statsUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${commit.sha}`;
            const statsResponse = await fetch(statsUrl);
            const statsData = await statsResponse.json();
            
            return {
              ...commit,
              stats: statsData.stats || { additions: 0, deletions: 0, total: 0 }
            };
          } catch (error) {
            console.warn(`Failed to fetch stats for commit ${commit.sha}:`, error);
            return {
              ...commit,
              stats: { additions: 0, deletions: 0, total: 0 }
            };
          }
        })
      );
      
      commits.push(...commitsWithStats);
      if (data.length < perPage) break;
      page++;
    }
  } catch (error) {
    console.error(`Error fetching commits for ${owner}/${repo}:`, error);
    throw error;
  }
  
  return commits;
}

async function analyzeCommitHistory(owner: string, repo: string): Promise<{
  totalCommits: number;
  commits: CommitAnalysis[];
  contributors: ContributorStats[];
  timeline: TimelineStats[];
  totalEstimatedHours: number;
  aiCommitPercentage: number;
  projectStartDate: string;
  projectEndDate: string;
}> {
  const githubCommits = await fetchGitHubCommits(owner, repo);
  
  if (githubCommits.length === 0) {
    return {
      totalCommits: 0,
      commits: [],
      contributors: [],
      timeline: [],
      totalEstimatedHours: 0,
      aiCommitPercentage: 0,
      projectStartDate: '',
      projectEndDate: ''
    };
  }
  
  // Analyze each commit
  const commits: CommitAnalysis[] = [];
  for (const githubCommit of githubCommits) {
    const analysis = await analyzeCommitMessage(githubCommit.commit.message);
    
    commits.push({
      sha: githubCommit.sha,
      message: githubCommit.commit.message,
      author: githubCommit.commit.author,
      committer: githubCommit.commit.committer,
      stats: githubCommit.stats || { additions: 0, deletions: 0, total: 0 },
      isAI: analysis.isAI,
      confidence: analysis.confidence,
      reasons: analysis.reasons,
      url: githubCommit.html_url
    });
  }
  
  // Calculate contributor stats
  const contributorMap = new Map<string, ContributorStats>();
  
  for (const commit of commits) {
    const key = `${commit.author.name}-${commit.author.email}`;
    
    if (!contributorMap.has(key)) {
      contributorMap.set(key, {
        name: commit.author.name,
        email: commit.author.email,
        totalCommits: 0,
        totalAdditions: 0,
        totalDeletions: 0,
        estimatedHours: 0,
        aiCommitPercentage: 0,
        firstCommit: commit.author.date,
        lastCommit: commit.author.date,
        commitDays: []
      });
    }
    
    const stats = contributorMap.get(key)!;
    stats.totalCommits++;
    stats.totalAdditions += commit.stats.additions;
    stats.totalDeletions += commit.stats.deletions;
    
    const commitDate = commit.author.date.split('T')[0];
    if (!stats.commitDays.includes(commitDate)) {
      stats.commitDays.push(commitDate);
    }
    
    if (new Date(commit.author.date) < new Date(stats.firstCommit)) {
      stats.firstCommit = commit.author.date;
    }
    if (new Date(commit.author.date) > new Date(stats.lastCommit)) {
      stats.lastCommit = commit.author.date;
    }
  }
  
  // Calculate hours and AI percentages for contributors
  for (const [key, stats] of contributorMap) {
    const contributorCommits = commits.filter(c => 
      `${c.author.name}-${c.author.email}` === key
    );
    stats.estimatedHours = estimateWorkHours(contributorCommits);
    const aiCommits = contributorCommits.filter(c => c.isAI).length;
    stats.aiCommitPercentage = stats.totalCommits > 0 ? (aiCommits / stats.totalCommits) * 100 : 0;
  }
  
  // Create timeline data
  const timelineMap = new Map<string, TimelineStats>();
  
  for (const commit of commits) {
    const date = commit.author.date.split('T')[0];
    
    if (!timelineMap.has(date)) {
      timelineMap.set(date, {
        date,
        commits: 0,
        additions: 0,
        deletions: 0,
        aiCommits: 0,
        estimatedHours: 0,
        contributors: []
      });
    }
    
    const timeline = timelineMap.get(date)!;
    timeline.commits++;
    timeline.additions += commit.stats.additions;
    timeline.deletions += commit.stats.deletions;
    
    if (commit.isAI) {
      timeline.aiCommits++;
    }
    
    if (!timeline.contributors.includes(commit.author.name)) {
      timeline.contributors.push(commit.author.name);
    }
  }
  
  // Calculate daily hours
  for (const [date, timeline] of timelineMap) {
    const dayCommits = commits.filter(c => c.author.date.split('T')[0] === date);
    timeline.estimatedHours = estimateWorkHours(dayCommits);
  }
  
  const contributors = Array.from(contributorMap.values())
    .sort((a, b) => b.totalCommits - a.totalCommits);
  
  const timeline = Array.from(timelineMap.values())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const totalEstimatedHours = contributors.reduce((sum, c) => sum + c.estimatedHours, 0);
  const aiCommits = commits.filter(c => c.isAI).length;
  const aiCommitPercentage = commits.length > 0 ? (aiCommits / commits.length) * 100 : 0;
  
  const sortedDates = commits.map(c => c.author.date).sort();
  
  return {
    totalCommits: commits.length,
    commits: commits.sort((a, b) => new Date(b.author.date).getTime() - new Date(a.author.date).getTime()),
    contributors,
    timeline,
    totalEstimatedHours,
    aiCommitPercentage,
    projectStartDate: sortedDates[0] || '',
    projectEndDate: sortedDates[sortedDates.length - 1] || ''
  };
}

export async function analyzeGitHubRepository(
  repositoryUrl: string,
  onProgress?: (current: number, total: number, currentFile: string) => void,
  includeCommitHistory: boolean = true
): Promise<RepositoryAnalysis> {
  // Parse GitHub URL
  const urlMatch = repositoryUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!urlMatch) {
    throw new Error('Invalid GitHub repository URL. Please use format: https://github.com/owner/repo');
  }
  
  let [, owner, repo] = urlMatch;
  let originalRepositoryUrl: string | undefined;
  let isForked = false;
  
  // Check if repository is a fork
  onProgress?.(0, 1, 'Checking repository info...');
  try {
    const repoInfo = await fetchGitHubRepo(owner, repo);
    
    if (repoInfo.fork && repoInfo.parent) {
      // This is a fork, analyze the original repository instead
      isForked = true;
      originalRepositoryUrl = repoInfo.parent.html_url;
      
      const parentMatch = repoInfo.parent.full_name.match(/([^\/]+)\/([^\/]+)/);
      if (parentMatch) {
        [, owner, repo] = parentMatch;
        onProgress?.(0, 1, `Fork detected, analyzing original repository: ${repoInfo.parent.full_name}`);
      }
    }
  } catch (error) {
    console.warn('Failed to fetch repository info, proceeding with original URL:', error);
  }
  
  // Fetch all files from all branches in the repository
  onProgress?.(0, 1, 'Fetching files from all branches...');
  const { files: allFiles, totalBranches } = await getAllFilesFromAllBranches(owner, repo);
  
  // Check for lovable keyword in src files, index.html, and package.json
  onProgress?.(0, 1, 'Checking for Lovable keyword...');
  const hasLovableLabel = await checkForLovableKeyword(owner, repo, allFiles);
  
  // Filter files we can analyze
  const analyzeableFiles = allFiles.filter(file => 
    shouldAnalyzeFile(file.path) && 
    file.size && 
    file.size < 1024 * 1024 && // Skip files larger than 1MB
    file.download_url
  );
  
  if (analyzeableFiles.length === 0) {
    throw new Error('No analyzeable code files found in this repository');
  }
  
  const fileAnalyses: FileAnalysis[] = [];
  let totalLines = 0;
  let totalAiLines = 0;
  let totalHumanLines = 0;
  let totalConfidence = 0;
  let analyzedCount = 0;
  
  // Analyze each file
  for (let i = 0; i < analyzeableFiles.length; i++) {
    const file = analyzeableFiles[i];
    const displayPath = file.branch ? `${file.path} (${file.branch})` : file.path;
    onProgress?.(i + 1, analyzeableFiles.length, displayPath);
    
    try {
      const content = await fetchFileContent(file.download_url!);
      const language = getLanguageFromPath(file.path);
      
      // Skip empty files
      if (!content.trim()) continue;
      
      const analysis = await analyzeCode(content, language);
      
      fileAnalyses.push({
        path: file.path,
        language,
        analysis,
        size: file.size || 0
      });
      
      totalLines += analysis.totalLines;
      totalAiLines += analysis.aiLines;
      totalHumanLines += analysis.humanLines;
      totalConfidence += analysis.overallConfidence;
      analyzedCount++;
      
    } catch (error) {
      console.warn(`Failed to analyze ${file.path}:`, error);
    }
  }
  
  const overallStats = {
    totalLines,
    aiLines: totalAiLines,
    humanLines: totalHumanLines,
    aiPercentage: totalLines > 0 ? (totalAiLines / totalLines) * 100 : 0,
    humanPercentage: totalLines > 0 ? (totalHumanLines / totalLines) * 100 : 0,
    overallConfidence: analyzedCount > 0 ? totalConfidence / analyzedCount : 0
  };
  
  // Sort files to prioritize those with emoji/invisible character detections
  const sortedFiles = fileAnalyses.sort((a, b) => {
    // Priority 1: Files with invisible characters (highest priority)
    const aHasInvisible = a.analysis.lineAnalysis.some(line => 
      line.isAI && line.reasons.some(r => r.includes('invisible Unicode'))
    );
    const bHasInvisible = b.analysis.lineAnalysis.some(line => 
      line.isAI && line.reasons.some(r => r.includes('invisible Unicode'))
    );
    if (aHasInvisible && !bHasInvisible) return -1;
    if (!aHasInvisible && bHasInvisible) return 1;
    
    // Priority 2: Files with emojis (second priority)
    const aHasEmoji = a.analysis.lineAnalysis.some(line => 
      line.isAI && line.reasons.some(r => r.includes('emojis'))
    );
    const bHasEmoji = b.analysis.lineAnalysis.some(line => 
      line.isAI && line.reasons.some(r => r.includes('emojis'))
    );
    if (aHasEmoji && !bHasEmoji) return -1;
    if (!aHasEmoji && bHasEmoji) return 1;
    
    // Priority 3: Files with higher AI percentage
    return b.analysis.aiPercentage - a.analysis.aiPercentage;
  });

  // Analyze commit history if requested
  let commitAnalysis;
  if (includeCommitHistory) {
    try {
      onProgress?.(analyzeableFiles.length, analyzeableFiles.length + 1, 'Analyzing commit history...');
      commitAnalysis = await analyzeCommitHistory(owner, repo);
    } catch (error) {
      console.warn('Failed to analyze commit history:', error);
    }
  }

  return {
    repositoryUrl: isForked ? originalRepositoryUrl! : repositoryUrl,
    originalRepositoryUrl: isForked ? originalRepositoryUrl : undefined,
    isForked,
    totalFiles: allFiles.length,
    analyzedFiles: fileAnalyses.length,
    totalBranches,
    files: sortedFiles,
    overallStats,
    hasLovableLabel,
    commitAnalysis
  };
}