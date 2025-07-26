import { CodeAnalyzer } from "@/components/CodeAnalyzer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Code, Shield, Zap } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-code-bg">
      {/* Header */}
      <div className="border-b border-code-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                <Brain className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">AI Code Detective</h1>
                <p className="text-sm text-muted-foreground">
                  Advanced AI vs Human code analysis
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-primary text-primary">
              v1.0.0
            </Badge>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-code-border bg-gradient-to-br from-card to-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Code className="w-5 h-5 text-ai" />
                Multi-Language
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Supports JavaScript, TypeScript, Python, Java, and more programming languages
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-code-border bg-gradient-to-br from-card to-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="w-5 h-5 text-human" />
                Detailed Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Line-by-line detection with confidence scores and detailed reasoning
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-code-border bg-gradient-to-br from-card to-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="w-5 h-5 text-primary" />
                Advanced Patterns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Uses sophisticated algorithms to detect AI patterns and human coding styles
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Main Analyzer */}
        <CodeAnalyzer />
      </div>
    </div>
  );
};

export default Index;
