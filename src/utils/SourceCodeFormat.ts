import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import './prism-ghcolors.css';




/**
 * Formats source code for HTML display by removing function wrappers and normalizing indentation
 * @param sourceCode - The raw source code string to format
 * @returns HTML string with formatted source code
 */
export function formatSourceCodeHtml(sourceCode: string | undefined | null, lang: 'javascript' | 'typescript' | 'tsx' = 'typescript'): string {
    if (!sourceCode) return '';

    // Remove wrapper if needed
    const cleanedCode = removeFunctionWrapper(sourceCode);

    // Highlight code using Prism
    const highlightedCode = Prism.highlight(cleanedCode, Prism.languages[lang], lang);

    // Wrap in pre/code for HTML display
    return `<div class="source-code"><pre class="language-${lang}"><code>${highlightedCode}</code></pre></div>`;
}



/**
 * Removes function wrappers from source code while preserving the actual test code
 * Handles various function formats including async, arrow functions, and complex blocks
 */
function removeFunctionWrapper(sourceCode: string): string {
    if (!sourceCode) return '';

    let code = sourceCode.trim();

    // More robust pattern matching that handles complex code blocks
    const patterns = [
        // Async function: async function() { ... }
        /^async\s+function\s*[^(]*\([^)]*\)\s*{([\s\S]*)}\s*$/,
        // Async arrow function: async () => { ... }
        /^async\s*\([^)]*\)\s*=>\s*{([\s\S]*)}\s*$/,
        // Regular function: function name() { ... }
        /^function\s*[^(]*\([^)]*\)\s*{([\s\S]*)}\s*$/,
        // Arrow functions with braces: () => { ... }
        /^\([^)]*\)\s*=>\s*{([\s\S]*)}\s*$/,
        // Arrow functions without braces: () => ... 
        /^\([^)]*\)\s*=>\s*([^{][\s\S]*)$/,
        // Method syntax: name() { ... }
        /^[a-zA-Z_$][a-zA-Z0-9_$]*\s*\([^)]*\)\s*{([\s\S]*)}\s*$/
    ];

    // Try each pattern until one matches
    for (const pattern of patterns) {
        const match = pattern.exec(code);
        if (match && match[1]) {
            code = match[1].trim();
            break;
        }
    }

    // For complex code blocks with multiple nested braces (like try-catch-finally),
    // we need a more sophisticated approach
    code = extractCodeFromBraces(code);

    // Remove excessive indentation while preserving relative indentation
    code = normalizeIndentation(code);

    return code;
}

/**
 * Extracts code from the outermost braces, handling nested structures
 * This is necessary for complex code blocks with try-catch-finally, if-else, etc.
 */
function extractCodeFromBraces(code: string): string {
    // If the code doesn't start with '{', it's already extracted or doesn't need extraction
    if (!code.startsWith('{')) {
        return code;
    }

    let braceCount = 0;
    let startIndex = -1;
    let endIndex = -1;

    // Find the matching closing brace for the first opening brace
    for (let i = 0; i < code.length; i++) {
        const char = code[i];

        if (char === '{') {
            if (braceCount === 0) {
                startIndex = i + 1; // Start after the opening brace
            }
            braceCount++;
        } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
                endIndex = i;
                break;
            }
        }
    }

    // If we found matching braces, extract the content
    if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
        return code.substring(startIndex, endIndex).trim();
    }

    // If brace matching failed, fall back to simple brace removal
    return code.replace(/^{|}$/g, '').trim();
}

/**
 * Normalizes indentation while handling blocks like "try { ... }".
 * If the first line has no indentation, the minimum indent is calculated
 * from the following lines instead of forcing everything flush left.
 */
function normalizeIndentation(code: string): string {
    const lines = code.split('\n');

    if (lines.length <= 1) {
        return code.trim();
    }

    // Trim right side for consistency (but keep left spaces for indent analysis)
    const rawLines = lines.map(l => l.replace(/\s+$/, ''));

    // Detect if the very first line is "flush left" (indent = 0)
    const firstLineIndent = rawLines[0].match(/^\s*/)?.[0].length ?? 0;

    // Find the minimum indent across all non-empty lines
    // If first line has 0 indent, skip it when calculating minIndent
    let minIndent = Infinity;
    for (let i = 0; i < rawLines.length; i++) {
        if (rawLines[i].trim().length === 0) continue;
        if (i === 0 && firstLineIndent === 0) continue; // skip first line if flush left
        const indent = rawLines[i].match(/^\s*/)?.[0].length ?? 0;
        if (indent < minIndent) {
            minIndent = indent;
        }
    }

    if (minIndent === Infinity) {
        return code.trim();
    }

    // Remove the detected indent from all lines (except empty ones)
    const normalizedLines = rawLines.map((line, i) => {
        if (line.trim().length === 0) return line;
        if (i === 0 && firstLineIndent === 0) {
            // keep first line exactly as-is
            return line.trim();
        }
        return line.slice(minIndent);
    });

    return normalizedLines.join('\n').trim();
}


/**
 * Simple HTML escape for safe insertion of text content
 * Prevents XSS attacks and ensures proper HTML rendering
 */
export function escapeHtml(value: string): string {
    if (!value) return '';

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Enhanced HTML escape that preserves formatting for pre tags
 */
export function escapeHtmlWithFormatting(value: string): string {
    if (!value) return '';

    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/ /g, '&nbsp;')  // Preserve spaces
        .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;') // Convert tabs to 4 spaces
        .replace(/\n/g, '<br>');  // Preserve line breaks
}


export function formatErrorsHtml(errors: string[]): string {
    if (!errors?.length) return '';

    const errorText = errors.join('\n\n');
    const highlighted = Prism.highlight(errorText, Prism.languages.javascript, 'javascript');

    return `<div class="error-details"><pre class="error-output">${highlighted}</pre></div>`;
}

export const ERRORS_STYLES = `/* Error details styling */
.jest-browser-reporter .error-details { 
    display: none; 
    margin-top: 12px; 
    padding: 12px 14px; 
    background: #fff7f7;
    border-radius: 6px; 
    border-left: 4px solid #ef4444; 
}

.jest-browser-reporter .error-details pre.error-output { 
    white-space: pre-wrap; 
    font-family: 'Consolas', 'Monaco', monospace; 
    font-size: 13px; 
    color: #991b1b; 
    line-height: 1.45;
    margin: 0;
    overflow-x: auto;
}

/* Use Prism theme colors for consistency */
.jest-browser-reporter .error-details .token.keyword { color: #b91c1c; }
.jest-browser-reporter .error-details .token.string { color: #9a3412; }
.jest-browser-reporter .error-details .token.function { color: #7f1d1d; }
.jest-browser-reporter .error-details .token.number { color: #7c2d12; }

/* Dark theme */
@media (prefers-color-scheme: dark) {
    .jest-browser-reporter .error-details {
        background: #2a1e1e;
        border-left-color: #f87171;
    }
    .jest-browser-reporter .error-details pre.error-output {
        color: #fca5a5;
    }
}`;