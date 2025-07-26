import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Brain, User, Zap, AlertTriangle, CheckCircle, Github, FileCode, Eye, Heart } from "lucide-react";
import { analyzeCode } from "@/lib/aiDetection";
import { analyzeGitHubRepository } from "@/lib/githubAnalyzer";
import type { AnalysisResult } from "@/lib/aiDetection";
import type { RepositoryAnalysis, FileAnalysis } from "@/lib/githubAnalyzer";

const SUPPORTED_LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "jsx", label: "JSX" },
  { value: "tsx", label: "TSX" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
];

export function CodeAnalyzer() {
  const [mode, setMode] = useState<"code" | "github">("code");
  const [code, setCode] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [repoAnalysis, setRepoAnalysis] = useState<RepositoryAnalysis | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, file: "" });

  const getAIConfidenceLevel = (aiPercentage: number) => {
    if (aiPercentage > 30) return { label: "Strong AI Usage", color: "bg-red-500", description: "Code likely AI-generated" };
    if (aiPercentage > 20) return { label: "High AI Usage", color: "bg-orange-500", description: "Significant AI assistance" };
    if (aiPercentage > 15) return { label: "Moderate AI Usage", color: "bg-yellow-500", description: "Some AI help detected" };
    if (aiPercentage > 10) return { label: "Little AI Help", color: "bg-blue-500", description: "Minor AI assistance" };
    if (aiPercentage > 5) return { label: "Professional Code", color: "bg-green-500", description: "Well-written, minimal AI" };
    return { label: "Human Code", color: "bg-emerald-600", description: "Likely human-written" };
  };

  const handleAnalyze = async () => {
    if (mode === "code" && !code.trim()) return;
    if (mode === "github" && !githubUrl.trim()) return;
    
    setIsAnalyzing(true);
    setProgress({ current: 0, total: 0, file: "" });
    
    try {
      if (mode === "code") {
        const result = await analyzeCode(code, language);
        setAnalysis(result);
        setRepoAnalysis(null);
      } else {
        const result = await analyzeGitHubRepository(
          githubUrl,
          (current, total, file) => setProgress({ current, total, file })
        );
        setRepoAnalysis(result);
        setAnalysis(null);
      }
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getLineIndicator = (lineAnalysis: any) => {
    if (lineAnalysis.isAI) {
      return <Brain className="w-4 h-4 text-ai" />;
    } else if (lineAnalysis.confidence > 0.7) {
      return <User className="w-4 h-4 text-human" />;
    }
    return <AlertTriangle className="w-4 h-4 text-neutral" />;
  };

  const getConfidenceBadge = (confidence: number, isAI: boolean) => {
    const percentage = Math.round(confidence * 100);
    return (
      <Badge 
        variant="outline" 
        className={`${isAI ? 'border-ai text-ai' : 'border-human text-human'} text-xs`}
      >
        {percentage}%
      </Badge>
    );
  };

  const FileCodeDialog = ({ file }: { file: FileAnalysis }) => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Eye className="w-4 h-4" />
          View Code
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode className="w-5 h-5" />
            {file.path}
          </DialogTitle>
          <DialogDescription>
            Line-by-line AI detection analysis
          </DialogDescription>
        </DialogHeader>
        
        <div className="overflow-hidden">
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all" className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                All Lines ({file.analysis.totalLines})
              </TabsTrigger>
              <TabsTrigger value="ai" className="flex items-center gap-2">
                <Brain className="w-4 h-4" />
                AI Only ({file.analysis.aiLines})
              </TabsTrigger>
              <TabsTrigger value="human" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Human Only ({file.analysis.humanLines})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {file.analysis.lineAnalysis.map((lineAnalysis, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border transition-all hover:bg-muted/50 ${
                      lineAnalysis.isAI ? 'border-ai/30 bg-ai/5' : 'border-human/30 bg-human/5'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-muted-foreground w-8">
                          {index + 1}
                        </span>
                        {getLineIndicator(lineAnalysis)}
                        {getConfidenceBadge(lineAnalysis.confidence, lineAnalysis.isAI)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <pre className="text-sm font-mono overflow-x-auto whitespace-pre-wrap break-all">
                          {lineAnalysis.content}
                        </pre>
                        
                        {lineAnalysis.reasons.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {lineAnalysis.reasons.map((reason, idx) => (
                              <div
                                key={idx}
                                className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded"
                              >
                                {reason}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="ai" className="mt-4">
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {file.analysis.lineAnalysis.filter(line => line.isAI).map((lineAnalysis, index) => {
                  const originalIndex = file.analysis.lineAnalysis.findIndex(line => line === lineAnalysis);
                  return (
                    <div
                      key={originalIndex}
                      className="p-3 rounded-lg border transition-all hover:bg-muted/50 border-ai/30 bg-ai/5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground w-8">
                            {originalIndex + 1}
                          </span>
                          {getLineIndicator(lineAnalysis)}
                          {getConfidenceBadge(lineAnalysis.confidence, lineAnalysis.isAI)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <pre className="text-sm font-mono overflow-x-auto whitespace-pre-wrap break-all">
                            {lineAnalysis.content}
                          </pre>
                          
                          {lineAnalysis.reasons.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {lineAnalysis.reasons.map((reason, idx) => (
                                <div
                                  key={idx}
                                  className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded"
                                >
                                  {reason}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="human" className="mt-4">
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {file.analysis.lineAnalysis.filter(line => !line.isAI).map((lineAnalysis, index) => {
                  const originalIndex = file.analysis.lineAnalysis.findIndex(line => line === lineAnalysis);
                  return (
                    <div
                      key={originalIndex}
                      className="p-3 rounded-lg border transition-all hover:bg-muted/50 border-human/30 bg-human/5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground w-8">
                            {originalIndex + 1}
                          </span>
                          {getLineIndicator(lineAnalysis)}
                          {getConfidenceBadge(lineAnalysis.confidence, lineAnalysis.isAI)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <pre className="text-sm font-mono overflow-x-auto whitespace-pre-wrap break-all">
                            {lineAnalysis.content}
                          </pre>
                          
                          {lineAnalysis.reasons.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {lineAnalysis.reasons.map((reason, idx) => (
                                <div
                                  key={idx}
                                  className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded"
                                >
                                  {reason}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      <Card className="border-code-border bg-gradient-to-br from-card to-code-bg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            AI Code Detection
          </CardTitle>
          <CardDescription>
            Analyze code snippets or entire GitHub repositories for AI vs human patterns
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={mode} onValueChange={(value) => setMode(value as "code" | "github")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="code" className="flex items-center gap-2">
                <FileCode className="w-4 h-4" />
                Code Snippet
              </TabsTrigger>
              <TabsTrigger value="github" className="flex items-center gap-2">
                <Github className="w-4 h-4" />
                GitHub Repository
              </TabsTrigger>
            </TabsList>

            <TabsContent value="code" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Programming Language</label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="bg-code-bg border-code-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={handleAnalyze} 
                    disabled={!code.trim() || isAnalyzing}
                    className="w-full"
                  >
                    {isAnalyzing ? "Analyzing..." : "Analyze Code"}
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Code Input</label>
                <Textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste your code here..."
                  className="min-h-[300px] font-mono text-sm bg-code-bg border-code-border"
                />
              </div>
            </TabsContent>

            <TabsContent value="github" className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">GitHub Repository URL</label>
                <Input
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/owner/repository"
                  className="bg-code-bg border-code-border"
                />
                <p className="text-xs text-muted-foreground">
                  Enter a public GitHub repository URL to analyze all code files
                </p>
              </div>
              
              <Button 
                onClick={handleAnalyze} 
                disabled={!githubUrl.trim() || isAnalyzing}
                className="w-full"
              >
                {isAnalyzing ? "Analyzing Repository..." : "Analyze Repository"}
              </Button>
              
              {isAnalyzing && progress.total > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress: {progress.current} / {progress.total}</span>
                    <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                  </div>
                  <Progress value={(progress.current / progress.total) * 100} className="h-2" />
                  {progress.file && (
                    <p className="text-xs text-muted-foreground truncate">
                      Analyzing: {progress.file}
                    </p>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {repoAnalysis && (
        <div className="space-y-6">
          {/* Repository Overview */}
          <Card className="border-code-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Github className="w-5 h-5 text-primary" />
                Repository Analysis
                {repoAnalysis.hasLovableLabel && (
                  <Badge className="bg-gradient-to-r from-pink-500 to-purple-600 text-white">
                    <Heart className="w-3 h-3 mr-1" />
                    Lovable
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {repoAnalysis.repositoryUrl}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Brain className="w-4 h-4 text-ai" />
                        AI Generated
                      </span>
                      <span className="text-sm font-bold text-ai">
                        {Math.round(repoAnalysis.overallStats.aiPercentage)}%
                      </span>
                    </div>
                    <Progress value={repoAnalysis.overallStats.aiPercentage} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <User className="w-4 h-4 text-human" />
                        Human Written
                      </span>
                      <span className="text-sm font-bold text-human">
                        {Math.round(repoAnalysis.overallStats.humanPercentage)}%
                      </span>
                    </div>
                    <Progress value={repoAnalysis.overallStats.humanPercentage} className="h-2" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="font-medium">Total Files:</span> {repoAnalysis.totalFiles}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Analyzed Files:</span> {repoAnalysis.analyzedFiles}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Total Lines:</span> {repoAnalysis.overallStats.totalLines}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">AI Lines:</span> {repoAnalysis.overallStats.aiLines}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Human Lines:</span> {repoAnalysis.overallStats.humanLines}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Overall Confidence:</span> {Math.round(repoAnalysis.overallStats.overallConfidence * 100)}%
                  </div>
                  <div className="mt-3">
                    <Badge 
                      className={`${getAIConfidenceLevel(repoAnalysis.overallStats.aiPercentage).color} text-white`}
                    >
                      {getAIConfidenceLevel(repoAnalysis.overallStats.aiPercentage).label}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getAIConfidenceLevel(repoAnalysis.overallStats.aiPercentage).description}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* File-by-file Analysis */}
          <Card className="border-code-border">
            <CardHeader>
              <CardTitle>File Analysis</CardTitle>
              <CardDescription>
                Analysis results for each file in the repository
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {repoAnalysis.files.map((file, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-lg border border-code-border bg-card/50 hover:bg-card transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-muted-foreground" />
                        <span className="font-mono text-sm font-medium">{file.path}</span>
                        <Badge variant="outline" className="text-xs">
                          {file.language}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileCodeDialog file={file} />
                        <Badge 
                          className={`${getAIConfidenceLevel(file.analysis.aiPercentage).color} text-white text-xs`}
                        >
                          {getAIConfidenceLevel(file.analysis.aiPercentage).label}
                        </Badge>
                        {getConfidenceBadge(file.analysis.overallConfidence, file.analysis.aiLines > file.analysis.humanLines)}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Total Lines:</span>
                        <div className="font-medium">{file.analysis.totalLines}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">AI Lines:</span>
                        <div className="font-medium text-ai">{file.analysis.aiLines}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Human Lines:</span>
                        <div className="font-medium text-human">{file.analysis.humanLines}</div>
                      </div>
                    </div>
                    
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-ai">AI: {Math.round(file.analysis.aiPercentage)}%</span>
                        <span className="text-human">Human: {Math.round(file.analysis.humanPercentage)}%</span>
                      </div>
                      <div className="flex gap-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="bg-ai transition-all" 
                          style={{ width: `${file.analysis.aiPercentage}%` }}
                        />
                        <div 
                          className="bg-human transition-all" 
                          style={{ width: `${file.analysis.humanPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {analysis && (
        <div className="space-y-6">
          {/* Overall Statistics */}
          <Card className="border-code-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-primary" />
                Analysis Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Brain className="w-4 h-4 text-ai" />
                        AI Generated
                      </span>
                      <span className="text-sm font-bold text-ai">
                        {Math.round(analysis.aiPercentage)}%
                      </span>
                    </div>
                    <Progress value={analysis.aiPercentage} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <User className="w-4 h-4 text-human" />
                        Human Written
                      </span>
                      <span className="text-sm font-bold text-human">
                        {Math.round(analysis.humanPercentage)}%
                      </span>
                    </div>
                    <Progress value={analysis.humanPercentage} className="h-2" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="font-medium">Total Lines:</span> {analysis.totalLines}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">AI Lines:</span> {analysis.aiLines}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Human Lines:</span> {analysis.humanLines}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Overall Confidence:</span> {Math.round(analysis.overallConfidence * 100)}%
                  </div>
                  <div className="mt-3">
                    <Badge 
                      className={`${getAIConfidenceLevel(analysis.aiPercentage).color} text-white`}
                    >
                      {getAIConfidenceLevel(analysis.aiPercentage).label}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getAIConfidenceLevel(analysis.aiPercentage).description}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line-by-line Analysis */}
          <Card className="border-code-border">
            <CardHeader>
              <CardTitle>Line-by-Line Analysis</CardTitle>
              <CardDescription>
                Detailed breakdown with confidence scores and reasoning
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="all" className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    All Lines ({analysis.totalLines})
                  </TabsTrigger>
                  <TabsTrigger value="ai" className="flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    AI Only ({analysis.aiLines})
                  </TabsTrigger>
                  <TabsTrigger value="human" className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Human Only ({analysis.humanLines})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="mt-4">
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {analysis.lineAnalysis.map((lineAnalysis, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border transition-all hover:bg-muted/50 ${
                          lineAnalysis.isAI ? 'border-ai/30 bg-ai/5' : 'border-human/30 bg-human/5'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs text-muted-foreground w-8">
                              {index + 1}
                            </span>
                            {getLineIndicator(lineAnalysis)}
                            {getConfidenceBadge(lineAnalysis.confidence, lineAnalysis.isAI)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <pre className="text-sm font-mono overflow-x-auto whitespace-pre-wrap break-all">
                              {lineAnalysis.content}
                            </pre>
                            
                            {lineAnalysis.reasons.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {lineAnalysis.reasons.map((reason, idx) => (
                                  <div
                                    key={idx}
                                    className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded"
                                  >
                                    {reason}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="ai" className="mt-4">
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {analysis.lineAnalysis.filter(line => line.isAI).map((lineAnalysis, index) => {
                      const originalIndex = analysis.lineAnalysis.findIndex(line => line === lineAnalysis);
                      return (
                        <div
                          key={originalIndex}
                          className="p-3 rounded-lg border transition-all hover:bg-muted/50 border-ai/30 bg-ai/5"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs text-muted-foreground w-8">
                                {originalIndex + 1}
                              </span>
                              {getLineIndicator(lineAnalysis)}
                              {getConfidenceBadge(lineAnalysis.confidence, lineAnalysis.isAI)}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <pre className="text-sm font-mono overflow-x-auto whitespace-pre-wrap break-all">
                                {lineAnalysis.content}
                              </pre>
                              
                              {lineAnalysis.reasons.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {lineAnalysis.reasons.map((reason, idx) => (
                                    <div
                                      key={idx}
                                      className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded"
                                    >
                                      {reason}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="human" className="mt-4">
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {analysis.lineAnalysis.filter(line => !line.isAI).map((lineAnalysis, index) => {
                      const originalIndex = analysis.lineAnalysis.findIndex(line => line === lineAnalysis);
                      return (
                        <div
                          key={originalIndex}
                          className="p-3 rounded-lg border transition-all hover:bg-muted/50 border-human/30 bg-human/5"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs text-muted-foreground w-8">
                                {originalIndex + 1}
                              </span>
                              {getLineIndicator(lineAnalysis)}
                              {getConfidenceBadge(lineAnalysis.confidence, lineAnalysis.isAI)}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <pre className="text-sm font-mono overflow-x-auto whitespace-pre-wrap break-all">
                                {lineAnalysis.content}
                              </pre>
                              
                              {lineAnalysis.reasons.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {lineAnalysis.reasons.map((reason, idx) => (
                                    <div
                                      key={idx}
                                      className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded"
                                    >
                                      {reason}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}