import { analyzeCode } from './aiDetection';
import type { AnalysisResult, LineAnalysis } from './aiDetection';

export interface FileAnalysis {
  path: string;
  language: string;
  analysis: AnalysisResult;
  size: number;
}

export interface RepositoryAnalysis {
  repositoryUrl: string;
  totalFiles: number;
  analyzedFiles: number;
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
}

interface GitHubFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  download_url?: string;
  size: number;
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
  const ext = filePath.toLowerCase().match(/\.[^.]*$/)?.[0];
  if (!ext) return false;
  
  // Only analyze code files
  const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.cc', '.cxx', '.c++', '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.scala', '.vue', '.svelte'];
  if (!codeExtensions.includes(ext)) return false;
  
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
    
    // Documentation
    /\.md$/,
    /\.mdx$/,
    
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

async function fetchGitHubContents(owner: string, repo: string, path: string = ''): Promise<GitHubFile[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return Array.isArray(data) ? data : [data];
  } catch (error) {
    console.error(`Error fetching GitHub contents for ${owner}/${repo}/${path}:`, error);
    throw error;
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

async function getAllFiles(owner: string, repo: string, path: string = '', maxDepth: number = 4): Promise<GitHubFile[]> {
  if (maxDepth <= 0) return [];
  
  const contents = await fetchGitHubContents(owner, repo, path);
  const allFiles: GitHubFile[] = [];
  
  for (const item of contents) {
    if (item.type === 'file') {
      allFiles.push(item);
    } else if (item.type === 'dir' && !shouldSkipDirectory(item.path, item.name)) {
      // Recursively fetch directory contents
      try {
        const subFiles = await getAllFiles(owner, repo, item.path, maxDepth - 1);
        allFiles.push(...subFiles);
      } catch (error) {
        console.warn(`Skipping directory ${item.path}:`, error);
      }
    }
  }
  
  return allFiles;
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

export async function analyzeGitHubRepository(
  repositoryUrl: string,
  onProgress?: (current: number, total: number, currentFile: string) => void
): Promise<RepositoryAnalysis> {
  // Parse GitHub URL
  const urlMatch = repositoryUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!urlMatch) {
    throw new Error('Invalid GitHub repository URL. Please use format: https://github.com/owner/repo');
  }
  
  const [, owner, repo] = urlMatch;
  
  // Fetch all files in the repository
  onProgress?.(0, 1, 'Fetching repository structure...');
  const allFiles = await getAllFiles(owner, repo);
  
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
    onProgress?.(i + 1, analyzeableFiles.length, file.path);
    
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
  
  return {
    repositoryUrl,
    totalFiles: allFiles.length,
    analyzedFiles: fileAnalyses.length,
    files: fileAnalyses,
    overallStats,
    hasLovableLabel
  };
}