export interface LineAnalysis {
  content: string;
  isAI: boolean;
  confidence: number;
  reasons: string[];
}

export interface AnalysisResult {
  totalLines: number;
  aiLines: number;
  humanLines: number;
  aiPercentage: number;
  humanPercentage: number;
  overallConfidence: number;
  lineAnalysis: LineAnalysis[];
}

interface DetectionPattern {
  pattern: RegExp;
  weight: number;
  reason: string;
  aiIndicator: boolean;
}

// AI detection patterns based on real AI vs human coding characteristics
const AI_PATTERNS: DetectionPattern[] = [
  // ChatGPT signature: Sectioned comments with dashes
  {
    pattern: /\/\/\s*---\s*.*\s*---\s*$/gm,
    weight: 0.9,
    reason: "Section-based comments with dashes — signature of AI structure",
    aiIndicator: true
  },
  
  // ChatGPT signature: Perfect formatting comment
  {
    pattern: /\/\/\s*Generated with.*ChatGPT|\/\/.*AI Code Style Guide/gi,
    weight: 1.0,
    reason: "Explicit AI generation comment",
    aiIndicator: true
  },
  
  // Step-by-step comments (very common in AI code)
  {
    pattern: /\/\/\s*Step\s*\d+:|\/\/\s*\d+\./gi,
    weight: 0.8,
    reason: "Contains step-by-step comments typical of AI explanations",
    aiIndicator: true
  },
  
  // Overly descriptive comments explaining obvious code
  {
    pattern: /\/\/\s*(Get|Parse|Check|Validate|Perform|Display|Calculate|Initialize|Handle|Process).*$/gm,
    weight: 0.6,
    reason: "Contains verbose explanatory comments typical of AI generation",
    aiIndicator: true
  },
  
  // Generic error messages with examples
  {
    pattern: /(Usage:|Example:|Error:).*$/gm,
    weight: 0.7,
    reason: "Contains structured error messages with examples",
    aiIndicator: true
  },
  
  // ChatGPT signature: try/catch in CLI/sync contexts  
  {
    pattern: /try\s*{[\s\S]*?catch\s*\([^)]*\)\s*{[\s\S]*?(console\.(error|log)|process\.exit)/g,
    weight: 0.6,
    reason: "try/catch with console output in CLI context — typical ChatGPT pattern",
    aiIndicator: true
  },

  // Perfect input validation patterns (enhanced)
  {
    pattern: /(process\.exit\(1\)|isNaN\(|\.length\s*[!=]=|args\.length|Missing\s+(argument|parameter))/g,
    weight: 0.7,
    reason: "Contains comprehensive input validation typical of AI first-draft code",
    aiIndicator: true
  },

  // ChatGPT signature: Polite error handling with usage examples
  {
    pattern: /(Usage:\s*|Example:\s*|Please\s+(provide|ensure|check))/gi,
    weight: 0.8,
    reason: "Polite, structured error messages with usage examples",
    aiIndicator: true
  },
  
  // Overly descriptive variable names
  {
    pattern: /\b(commandLineArguments|userInput|calculationResult|operatorSymbol)\b/gi,
    weight: 0.6,
    reason: "Uses overly descriptive variable names",
    aiIndicator: true
  },
  
  // Perfect switch/case structure with all cases
  {
    pattern: /switch\s*\([^)]+\)\s*{[\s\S]*default:\s*[\s\S]*}/g,
    weight: 0.4,
    reason: "Contains comprehensive switch statement with default case",
    aiIndicator: true
  },
  
  // AI-style shebang and perfect formatting
  {
    pattern: /^#!/,
    weight: 0.3,
    reason: "Includes shebang line typical of AI-generated scripts",
    aiIndicator: true
  },
  
  // Human indicators
  
  // Debug console logs left in code
  {
    pattern: /console\.log\((?!.*Result:|.*Error:|.*Usage:)/g,
    weight: 0.6,
    reason: "Contains debug console.log statements",
    aiIndicator: false
  },
  
  // TODO/FIXME comments (humans leave these)
  {
    pattern: /(TODO|FIXME|HACK|XXX):/gi,
    weight: 0.7,
    reason: "Contains TODO/FIXME comments indicating human planning",
    aiIndicator: false
  },
  
  // Terse or minimal comments
  {
    pattern: /\/\/\s*[a-z][^.]*$/gm,
    weight: 0.3,
    reason: "Contains short, terse comments typical of human code",
    aiIndicator: false
  },
  
  // Abbreviated variable names
  {
    pattern: /\b(btn|txt|img|nav|auth|cfg|opts|params|ctx|req|res|db|api|temp|tmp|val|str|num|arr|obj)\b/gi,
    weight: 0.4,
    reason: "Uses abbreviated variable names common in human code",
    aiIndicator: false
  },
  
  // Inconsistent spacing or formatting
  {
    pattern: /\s{3,}(?!\s*\/\/)|[;}]\s*[;}]|\t\s+|\s+\t/g,
    weight: 0.5,
    reason: "Has inconsistent spacing typical of human editing",
    aiIndicator: false
  },
  
  // Quick and dirty solutions (missing error handling)
  {
    pattern: /\[[^\]]*\]\.map\(|\.filter\(|\.reduce\(/g,
    weight: 0.2,
    reason: "Uses functional programming without extensive validation",
    aiIndicator: false
  }
];

// Language-specific patterns
const LANGUAGE_PATTERNS: Record<string, DetectionPattern[]> = {
  javascript: [
    {
      pattern: /console\.log\([^)]*\)/g,
      weight: 0.2,
      reason: "Contains debug console.log statements",
      aiIndicator: false
    },
    {
      pattern: /function\s+\w+\s*\([^)]*\)\s*{/g,
      weight: 0.1,
      reason: "Uses function declarations",
      aiIndicator: true
    }
  ],
  python: [
    {
      pattern: /print\([^)]*\)/g,
      weight: 0.2,
      reason: "Contains debug print statements",
      aiIndicator: false
    },
    {
      pattern: /def\s+\w+\s*\([^)]*\):/g,
      weight: 0.1,
      reason: "Uses function definitions",
      aiIndicator: true
    }
  ],
  typescript: [
    {
      pattern: /:\s*(string|number|boolean|any|unknown|void|never)\b/g,
      weight: 0.2,
      reason: "Contains explicit type annotations",
      aiIndicator: true
    }
  ]
};

function analyzeCodeStructure(code: string): number {
  // Analyze overall code structure for AI patterns
  let aiScore = 0;
  
  const lines = code.split('\n').filter(line => line.trim());
  
  // Enhanced ChatGPT detection: Perfect indentation consistency
  let consistentIndentation = 0;
  let indentPattern = '';
  let perfectlyAlignedLines = 0;
  
  for (const line of lines) {
    const indent = line.match(/^\s*/)?.[0] || '';
    if (!indentPattern && indent) {
      indentPattern = indent;
    }
    if (indent === indentPattern || indent === '' || indent.startsWith(indentPattern)) {
      consistentIndentation++;
    }
    
    // Check for perfectly aligned structures (objects, arrays, etc.)
    if (line.match(/^\s*([\{\}\[\](),;]|\w+:\s*)/)) {
      perfectlyAlignedLines++;
    }
  }
  
  if (consistentIndentation / lines.length > 0.9) {
    aiScore += 0.3; // Very consistent indentation suggests AI
  }
  
  if (perfectlyAlignedLines / lines.length > 0.4) {
    aiScore += 0.2; // Perfect alignment typical of ChatGPT
  }
  
  // ChatGPT signature: Absence of typical human "messiness"
  const messyPatterns = [
    /console\.log\(/,  // Debug logs
    /(TODO|FIXME|HACK)/,  // Planning comments
    /\s{3,}(?!\s*\/\/)/,  // Inconsistent spacing
    /[;}]\s*[;}]/  // Double semicolons/braces
  ];
  
  const messyLines = lines.filter(line => 
    messyPatterns.some(pattern => pattern.test(line))
  ).length;
  
  if (messyLines === 0 && lines.length > 10) {
    aiScore += 0.15; // Lack of human messiness
  }
  
  // Check for overly comprehensive documentation
  const commentLines = code.match(/\/\*[\s\S]*?\*\/|\/\/.*$/gm) || [];
  const commentRatio = commentLines.length / lines.length;
  if (commentRatio > 0.3) {
    aiScore += 0.2;
  }
  
  // Enhanced defensive programming detection
  const errorHandlingCount = (code.match(/(try|catch|throw|Error|Exception)/g) || []).length;
  const validationCount = (code.match(/(isNaN|\.length|args\.length|Missing.*argument)/g) || []).length;
  
  if ((errorHandlingCount + validationCount) > lines.length * 0.1) {
    aiScore += 0.25; // Very defensive = likely AI first draft
  }
  
  // ChatGPT signature: Perfect input validation on first 20 lines
  const earlyLines = lines.slice(0, Math.min(20, lines.length)).join('\n');
  if (earlyLines.match(/(args\.length|Missing.*argument|isNaN|process\.exit)/)) {
    aiScore += 0.2; // Perfect validation upfront
  }
  
  return Math.min(aiScore, 1);
}

function analyzeLine(line: string, lineNumber: number, language: string): LineAnalysis {
  const content = line.trim();
  let aiScore = 0;
  let humanScore = 0;
  const reasons: string[] = [];
  
  // Skip empty lines
  if (!content) {
    return {
      content: line,
      isAI: false,
      confidence: 0.5,
      reasons: ["Empty line - neutral"]
    };
  }
  
  // Apply general patterns
  for (const pattern of AI_PATTERNS) {
    if (pattern.pattern.test(content)) {
      if (pattern.aiIndicator) {
        aiScore += pattern.weight;
      } else {
        humanScore += pattern.weight;
      }
      reasons.push(pattern.reason);
    }
  }
  
  // Apply language-specific patterns
  const langPatterns = LANGUAGE_PATTERNS[language] || [];
  for (const pattern of langPatterns) {
    if (pattern.pattern.test(content)) {
      if (pattern.aiIndicator) {
        aiScore += pattern.weight;
      } else {
        humanScore += pattern.weight;
      }
      reasons.push(pattern.reason);
    }
  }
  
  // Additional heuristics
  
  // Line length analysis
  if (content.length > 120) {
    aiScore += 0.2;
    reasons.push("Very long line length typical of AI generation");
  } else if (content.length < 20 && !content.match(/[{}();,]/)) {
    humanScore += 0.1;
    reasons.push("Short, concise line suggests human writing");
  }
  
  // Check for perfect syntax
  const hasPerfectSyntax = !content.match(/[^\w\s\(\)\[\]{};:,.<>!@#$%^&*+=|\\?/-]/);
  if (hasPerfectSyntax && content.length > 30) {
    aiScore += 0.1;
    reasons.push("Perfect syntax and structure");
  }
  
  // Check for creative/quirky naming
  if (content.match(/\b(foo|bar|baz|qux|quirky|magic|hack|wtf)\b/i)) {
    humanScore += 0.3;
    reasons.push("Uses creative or placeholder naming typical of humans");
  }
  
  // Calculate final scores
  const totalScore = aiScore + humanScore;
  let confidence = totalScore > 0 ? Math.max(aiScore, humanScore) / totalScore : 0.5;
  confidence = Math.min(Math.max(confidence, 0.1), 0.95); // Clamp between 10% and 95%
  
  const isAI = aiScore > humanScore;
  
  if (reasons.length === 0) {
    reasons.push("No significant patterns detected - neutral classification");
  }
  
  return {
    content: line,
    isAI,
    confidence,
    reasons
  };
}

function isCreativeHumanCode(line: string): boolean {
  const content = line.trim();
  
  // Check for clear human creativity indicators
  const creativePatterns = [
    /(TODO|FIXME|HACK|XXX|NOTE):/gi,
    /\b(foo|bar|baz|qux|quirky|magic|hack|wtf|temp|tmp)\b/i,
    /console\.log\((?!.*Result:|.*Error:|.*Usage:)/,
    /\/\/\s*(FIXME|TODO|HACK|NOTE)/i,
    /\/\/\s*[a-z][^.A-Z]*$/,  // Short, casual comments without proper capitalization
    /\?\?\?|\!\!\!|\.\.\.$/,  // Casual punctuation
    /\/\/\s*(lol|wtf|omg|meh|ugh)/i  // Casual expressions
  ];
  
  return creativePatterns.some(pattern => pattern.test(content));
}

function applyContextualAnalysis(lineAnalysis: LineAnalysis[]): void {
  // Apply sandwiching rule: if a line is between AI lines, mark it as AI unless it's clearly creative human code
  for (let i = 1; i < lineAnalysis.length - 1; i++) {
    const currentLine = lineAnalysis[i];
    const prevLine = lineAnalysis[i - 1];
    const nextLine = lineAnalysis[i + 1];
    
    // Skip empty lines
    if (!currentLine.content.trim()) continue;
    
    // If current line is human but surrounded by AI lines
    if (!currentLine.isAI && prevLine.isAI && nextLine.isAI) {
      // Check if it's genuinely creative human code
      if (!isCreativeHumanCode(currentLine.content)) {
        currentLine.isAI = true;
        currentLine.confidence = Math.max(currentLine.confidence, 0.7);
        currentLine.reasons.push("Line sandwiched between AI-generated code blocks");
      }
    }
  }
  
  // Apply block analysis: look for consecutive AI patterns
  let consecutiveAICount = 0;
  for (let i = 0; i < lineAnalysis.length; i++) {
    const line = lineAnalysis[i];
    
    if (!line.content.trim()) {
      consecutiveAICount = 0;
      continue;
    }
    
    if (line.isAI) {
      consecutiveAICount++;
    } else {
      // If we have a human line after many AI lines, check if it's likely part of the AI block
      if (consecutiveAICount >= 3 && !isCreativeHumanCode(line.content)) {
        // Look ahead to see if AI pattern continues
        let aiContinues = false;
        for (let j = i + 1; j < Math.min(i + 3, lineAnalysis.length); j++) {
          if (lineAnalysis[j].content.trim() && lineAnalysis[j].isAI) {
            aiContinues = true;
            break;
          }
        }
        
        if (aiContinues) {
          line.isAI = true;
          line.confidence = Math.max(line.confidence, 0.6);
          line.reasons.push("Part of extended AI-generated code block");
        }
      }
      consecutiveAICount = 0;
    }
  }
}

export async function analyzeCode(code: string, language: string): Promise<AnalysisResult> {
  // Simulate processing delay for realism
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
  
  const lines = code.split('\n');
  const lineAnalysis: LineAnalysis[] = [];
  
  // Analyze overall structure
  const structureScore = analyzeCodeStructure(code);
  
  // Analyze each line
  for (let i = 0; i < lines.length; i++) {
    const analysis = analyzeLine(lines[i], i + 1, language);
    
    // Adjust confidence based on overall structure
    if (structureScore > 0.5) {
      if (analysis.isAI) {
        analysis.confidence = Math.min(analysis.confidence + 0.1, 0.95);
      }
    }
    
    lineAnalysis.push(analysis);
  }
  
  // Apply contextual analysis to improve accuracy
  applyContextualAnalysis(lineAnalysis);
  
  // Calculate statistics
  const nonEmptyLines = lineAnalysis.filter(l => l.content.trim());
  const aiLines = nonEmptyLines.filter(l => l.isAI).length;
  const humanLines = nonEmptyLines.length - aiLines;
  const totalLines = nonEmptyLines.length;
  
  const aiPercentage = totalLines > 0 ? (aiLines / totalLines) * 100 : 0;
  const humanPercentage = totalLines > 0 ? (humanLines / totalLines) * 100 : 0;
  
  // Calculate overall confidence as weighted average
  const overallConfidence = nonEmptyLines.length > 0 
    ? nonEmptyLines.reduce((sum, line) => sum + line.confidence, 0) / nonEmptyLines.length
    : 0.5;
  
  return {
    totalLines,
    aiLines,
    humanLines,
    aiPercentage,
    humanPercentage,
    overallConfidence,
    lineAnalysis
  };
}