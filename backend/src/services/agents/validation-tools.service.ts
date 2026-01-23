export class ValidationToolsService {
  /**
   * Validate file syntax and structure
   */
  static validateFileSyntax(filename: string, fileType: string, content: string): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (fileType) {
      case 'json':
        try {
          JSON.parse(content);
        } catch (e: any) {
          errors.push(`JSON syntax error: ${e.message}`);
        }
        break;

      case 'typescript':
      case 'javascript':
        // Check balanced braces, brackets, parentheses
        const braceBalance = this.checkBraceBalance(content);
        if (!braceBalance.balanced) {
          errors.push(`Unbalanced braces: ${braceBalance.message}`);
        }

        // Check for unclosed strings
        const stringCheck = this.checkUnclosedStrings(content);
        if (!stringCheck.valid) {
          errors.push(`Unclosed strings detected: ${stringCheck.message}`);
        }

        // Check for incomplete functions
        const functionCheck = this.checkIncompleteFunctions(content);
        if (functionCheck.incomplete.length > 0) {
          warnings.push(`Potentially incomplete functions: ${functionCheck.incomplete.join(', ')}`);
        }
        break;

      case 'python':
        // Basic Python validation
        const indentCheck = this.checkPythonIndentation(content);
        if (!indentCheck.valid) {
          errors.push(`Indentation errors detected`);
        }
        break;

      case 'html':
        // HTML/Astro/Vue/Svelte validation
        const htmlCheck = this.checkHTMLStructure(content);
        if (!htmlCheck.valid) {
          errors.push(`HTML structure errors: ${htmlCheck.errors.join(', ')}`);
        }
        break;
    }

    // Generic truncation detection for ALL file types
    const truncationCheck = this.checkTruncation(content, filename);
    if (!truncationCheck.valid) {
      errors.push(`File appears truncated: ${truncationCheck.reason}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private static checkBraceBalance(content: string): { balanced: boolean; message: string } {
    const stack: string[] = [];
    const pairs: { [key: string]: string } = { '{': '}', '[': ']', '(': ')' };
    let inString = false;
    let stringChar = '';
    let escaped = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];

      // Handle escape sequences
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      // Handle strings (skip braces inside strings)
      if (char === '"' || char === "'" || char === '`') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = '';
        }
        continue;
      }

      // Skip braces inside strings
      if (inString) {
        continue;
      }

      if (['{', '[', '('].includes(char)) {
        stack.push(char);
      } else if (['}', ']', ')'].includes(char)) {
        const last = stack.pop();
        if (!last || pairs[last] !== char) {
          return { balanced: false, message: `Unexpected '${char}' at position ${i}` };
        }
      }
    }

    if (stack.length > 0) {
      return { balanced: false, message: `Unclosed: ${stack.join(', ')}` };
    }

    return { balanced: true, message: 'All braces balanced' };
  }

  private static checkUnclosedStrings(content: string): { valid: boolean; message: string } {
    // Remove comments first
    const withoutComments = content
      .replace(/\/\/.*$/gm, '') // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

    let inString = false;
    let stringChar = '';
    let escaped = false;

    for (let i = 0; i < withoutComments.length; i++) {
      const char = withoutComments[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\' && inString) {
        escaped = true;
        continue;
      }

      if (char === '"' || char === "'" || char === '`') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = '';
        }
      }
    }

    if (inString) {
      return { valid: false, message: `Unclosed string starting with ${stringChar}` };
    }

    return { valid: true, message: 'All strings properly closed' };
  }

  private static checkIncompleteFunctions(content: string): { incomplete: string[] } {
    const incomplete: string[] = [];

    // Match function declarations (simplified - covers most common patterns)
    const functionRegex = /(?:function|const|let|var)\s+(\w+)\s*(?:=\s*)?(?:async\s*)?\([^)]*\)\s*(?:=>)?\s*\{/g;
    let match;

    const positions: Array<{ name: string; start: number }> = [];

    while ((match = functionRegex.exec(content)) !== null) {
      const functionName = match[1];
      const startIndex = match.index;
      positions.push({ name: functionName, start: startIndex });
    }

    // For each function, check if it has a proper closing
    for (const pos of positions) {
      const afterFunction = content.slice(pos.start);
      let braceCount = 0;
      let foundOpen = false;

      for (let i = 0; i < afterFunction.length; i++) {
        const char = afterFunction[i];

        if (char === '{') {
          braceCount++;
          foundOpen = true;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0 && foundOpen) {
            // Function is properly closed
            break;
          }
        }
      }

      // If we never reached 0 again after opening, the function is incomplete
      if (braceCount > 0) {
        incomplete.push(pos.name);
      }
    }

    return { incomplete };
  }

  private static checkPythonIndentation(content: string): { valid: boolean } {
    const lines = content.split('\n');
    const indentStack: number[] = [0];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (trimmed === '' || trimmed.startsWith('#')) {
        continue;
      }

      // Calculate indentation (count leading spaces)
      const leadingSpaces = line.match(/^ */)?.[0].length || 0;

      // Check if this line starts a new block (ends with :)
      const startsBlock = trimmed.endsWith(':');

      if (startsBlock) {
        // Push current indentation level
        indentStack.push(leadingSpaces);
      } else {
        // Check if indentation is valid
        const currentIndent = indentStack[indentStack.length - 1];

        // Indentation should be >= current level
        if (leadingSpaces < currentIndent) {
          // Dedenting - pop from stack until we find the matching level
          while (indentStack.length > 0 && indentStack[indentStack.length - 1] > leadingSpaces) {
            indentStack.pop();
          }

          // If we still don't match, it's an error
          if (indentStack.length === 0 || indentStack[indentStack.length - 1] !== leadingSpaces) {
            return { valid: false };
          }
        }
      }
    }

    return { valid: true };
  }

  private static checkHTMLStructure(content: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for balanced HTML tags
    const tagStack: string[] = [];
    const selfClosingTags = new Set(['meta', 'link', 'br', 'hr', 'img', 'input', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr']);

    // Simple regex to find tags (not perfect but catches most issues)
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9-]*)[^>]*>/g;
    let match;

    while ((match = tagRegex.exec(content)) !== null) {
      const fullTag = match[0];
      const tagName = match[1].toLowerCase();

      // Skip self-closing tags
      if (selfClosingTags.has(tagName)) {
        continue;
      }

      // Skip tags that are self-closed with />
      if (fullTag.endsWith('/>')) {
        continue;
      }

      if (fullTag.startsWith('</')) {
        // Closing tag
        if (tagStack.length === 0) {
          errors.push(`Unexpected closing tag: </${tagName}>`);
        } else {
          const expected = tagStack.pop();
          if (expected !== tagName) {
            errors.push(`Tag mismatch: expected </${expected}>, got </${tagName}>`);
          }
        }
      } else {
        // Opening tag
        tagStack.push(tagName);
      }
    }

    // Check for unclosed tags
    if (tagStack.length > 0) {
      errors.push(`Unclosed tags: ${tagStack.join(', ')}`);
    }

    // Check for unbalanced quotes in attributes
    const quoteCount = (content.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      errors.push(`Unbalanced quotes (found ${quoteCount}, should be even)`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private static checkTruncation(content: string, filename: string): { valid: boolean; reason: string } {
    // Check if file ends abruptly (common signs of truncation)
    const lastChars = content.slice(-50).trim();

    // Check for incomplete words (ends with partial word)
    const endsWithPartialWord = /[a-zA-Z]{3,}$/.test(lastChars);
    if (endsWithPartialWord) {
      return { valid: false, reason: 'Ends with incomplete word' };
    }

    // Check for unclosed string literals at the end
    const lastLine = content.split('\n').pop()?.trim() || '';
    const quoteMatches = lastLine.match(/["'`]/g);
    if (quoteMatches && quoteMatches.length % 2 !== 0) {
      return { valid: false, reason: 'Ends with unclosed string' };
    }

    // Check for incomplete HTML/JSX attributes (class=" without closing)
    if (/(class|style|id|href|src)=["'][^"']*$/.test(lastChars)) {
      return { valid: false, reason: 'Ends with incomplete HTML attribute' };
    }

    // Check if file is suspiciously small for certain types
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['astro', 'html', 'vue', 'svelte'].includes(ext || '')) {
      const lines = content.split('\n').length;
      // HTML-like files should have at least basic structure
      if (lines < 10 && !content.includes('</html>') && content.includes('<html')) {
        return { valid: false, reason: 'HTML file too short and missing closing tags' };
      }
    }

    return { valid: true, reason: '' };
  }

  /**
   * Detect file type from filename
   */
  static detectFileType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();

    if (ext === 'json') return 'json';
    if (ext === 'ts' || ext === 'tsx') return 'typescript';
    if (ext === 'js' || ext === 'jsx') return 'javascript';
    if (ext === 'py') return 'python';
    // HTML-like files (HTML, Astro, Vue, Svelte)
    if (ext === 'html' || ext === 'htm' || ext === 'astro' || ext === 'vue' || ext === 'svelte') {
      return 'html';
    }

    return 'generic';
  }
}
