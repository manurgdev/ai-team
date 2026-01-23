import { useState } from 'react';
import { ExportPreview as ExportPreviewType, ExportPreviewFile } from '@/lib/types/github.types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, FileText, FilePlus, FileEdit, CheckCircle, XCircle, ChevronDown, ChevronRight } from 'lucide-react';

interface ExportPreviewProps {
  preview: ExportPreviewType;
  onApprove: () => void;
  onReject: () => void;
  isLoading?: boolean;
}

export function ExportPreview({ preview, onApprove, onReject, isLoading }: ExportPreviewProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const toggleFile = (path: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFiles(newExpanded);
  };

  const getStatusIcon = (status: ExportPreviewFile['status']) => {
    switch (status) {
      case 'new':
        return <FilePlus className="h-4 w-4 text-green-500" />;
      case 'modified':
        return <FileEdit className="h-4 w-4 text-yellow-500" />;
      case 'unchanged':
        return <FileText className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: ExportPreviewFile['status']) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      new: 'default',
      modified: 'secondary',
      unchanged: 'outline',
    };
    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status}
      </Badge>
    );
  };

  const newFiles = preview.files.filter(f => f.status === 'new');
  const modifiedFiles = preview.files.filter(f => f.status === 'modified');
  const unchangedFiles = preview.files.filter(f => f.status === 'unchanged');

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Review Changes Before Export</span>
          <div className="flex gap-2">
            <Button
              onClick={onReject}
              variant="outline"
              disabled={isLoading}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Review & Fix Again
            </Button>
            <Button
              onClick={onApprove}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Committing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve & Commit
                </>
              )}
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          Review the changes that will be committed to GitHub
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <FilePlus className="h-5 w-5 text-green-500" />
            <span className="font-semibold">{newFiles.length}</span>
            <span className="text-sm text-muted-foreground">new</span>
          </div>
          <div className="flex items-center gap-2">
            <FileEdit className="h-5 w-5 text-yellow-500" />
            <span className="font-semibold">{modifiedFiles.length}</span>
            <span className="text-sm text-muted-foreground">modified</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-400" />
            <span className="font-semibold">{unchangedFiles.length}</span>
            <span className="text-sm text-muted-foreground">unchanged</span>
          </div>
        </div>

        {/* Warning if unchanged files present */}
        {unchangedFiles.length > 0 && (
          <Alert>
            <AlertDescription>
              {unchangedFiles.length} file(s) have no changes and will be skipped during export.
            </AlertDescription>
          </Alert>
        )}

        {/* Files list */}
        <div className="space-y-2">
          {preview.files.map((file) => (
            <div
              key={file.path}
              className="border rounded-lg overflow-hidden"
            >
              {/* File header */}
              <div
                className="flex items-center justify-between p-3 bg-muted/50 cursor-pointer hover:bg-muted"
                onClick={() => toggleFile(file.path)}
              >
                <div className="flex items-center gap-3 flex-1">
                  {expandedFiles.has(file.path) ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  {getStatusIcon(file.status)}
                  <span className="font-mono text-sm">{file.path}</span>
                </div>
                {getStatusBadge(file.status)}
              </div>

              {/* File diff (expandable) */}
              {expandedFiles.has(file.path) && (
                <div className="p-4 bg-background">
                  {file.status === 'new' ? (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">New file content:</p>
                      <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs">
                        <code className={`language-${file.language}`}>
                          {file.newContent}
                        </code>
                      </pre>
                    </div>
                  ) : file.status === 'modified' ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Old content:</p>
                        <pre className="bg-red-50 dark:bg-red-950/20 p-3 rounded-md overflow-x-auto text-xs border border-red-200 dark:border-red-900">
                          <code className={`language-${file.language}`}>
                            {file.oldContent}
                          </code>
                        </pre>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">New content:</p>
                        <pre className="bg-green-50 dark:bg-green-950/20 p-3 rounded-md overflow-x-auto text-xs border border-green-200 dark:border-green-900">
                          <code className={`language-${file.language}`}>
                            {file.newContent}
                          </code>
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">No changes</p>
                      <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs">
                        <code className={`language-${file.language}`}>
                          {file.newContent}
                        </code>
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
