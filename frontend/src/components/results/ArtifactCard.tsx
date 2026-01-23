import { useState } from 'react';
import { Download, FileCode, FileText, Image, Settings } from 'lucide-react';
import { Artifact } from '../../lib/types/agent.types';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { CodeDisplay } from './CodeDisplay';

interface ArtifactCardProps {
  artifact: Artifact;
}

export function ArtifactCard({ artifact }: ArtifactCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getArtifactIcon = () => {
    switch (artifact.type) {
      case 'code':
        return <FileCode className="h-5 w-5" />;
      case 'config':
        return <Settings className="h-5 w-5" />;
      case 'diagram':
        return <Image className="h-5 w-5" />;
      case 'document':
        return <FileText className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const getArtifactColor = () => {
    switch (artifact.type) {
      case 'code':
        return 'text-blue-600';
      case 'config':
        return 'text-purple-600';
      case 'diagram':
        return 'text-green-600';
      case 'document':
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  };

  const handleDownload = () => {
    const blob = new Blob([artifact.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = artifact.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={getArtifactColor()}>{getArtifactIcon()}</div>
            <div>
              <p className="font-mono text-sm font-medium">{artifact.filename}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {artifact.type}
                </Badge>
                {artifact.language && (
                  <Badge variant="outline" className="text-xs">
                    {artifact.language}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Hide' : 'Show'}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4">
            <CodeDisplay
              code={artifact.content}
              language={artifact.language}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
