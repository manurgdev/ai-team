import { GitHubFileContext } from '../types/agent.types';

export class TokenEstimationService {
  /**
   * Estimate tokens of a text
   * Approximation: 1 token ≈ 3.5 characters
   */
  static estimateTokens(text: string): number {
    return Math.ceil(text.length / 3.5);
  }

  /**
   * Estimate tokens of multiple files
   */
  static estimateFilesTokens(files: GitHubFileContext[]): number {
    return files.reduce((total, file) =>
      total + this.estimateTokens(file.content), 0
    );
  }

  /**
   * Prioritize files to include within the limit
   */
  static prioritizeFiles(
    files: GitHubFileContext[],
    maxTokens: number = 2000
  ): GitHubFileContext[] {
    const sorted = [...files].sort((a, b) => a.tokens - b.tokens);
    const selected: GitHubFileContext[] = [];
    let currentTokens = 0;

    for (const file of sorted) {
      if (currentTokens + file.tokens <= maxTokens) {
        selected.push(file);
        currentTokens += file.tokens;
      } else {
        console.warn(`Skipping file ${file.path} - would exceed token limit`);
      }
    }

    return selected;
  }

  /**
   * Detect language by extension
   */
  static detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'rb': 'ruby',
      'php': 'php',
      'md': 'markdown',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'css': 'css',
      'scss': 'scss',
      'html': 'html',
      'sql': 'sql',
      'sh': 'bash',
      'bash': 'bash',
    };
    return languageMap[ext || ''] || 'plaintext';
  }
}
