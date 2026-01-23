import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface CodeDisplayProps {
  code: string;
  language?: string;
  filename?: string;
}

export function CodeDisplay({ code, language, filename }: CodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      {filename && (
        <div className="flex items-center justify-between px-4 py-2 bg-muted border border-border rounded-t-lg">
          <span className="text-sm font-mono text-muted-foreground">{filename}</span>
          {language && (
            <span className="text-xs px-2 py-1 bg-background rounded">
              {language}
            </span>
          )}
        </div>
      )}

      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity",
            filename ? "top-14" : ""
          )}
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </>
          )}
        </Button>

        <pre
          className={cn(
            "overflow-x-auto p-4 bg-slate-950 text-slate-50 text-sm",
            filename ? "rounded-b-lg border border-t-0" : "rounded-lg border",
            "border-border"
          )}
        >
          <code className="font-mono">{code}</code>
        </pre>
      </div>
    </div>
  );
}
