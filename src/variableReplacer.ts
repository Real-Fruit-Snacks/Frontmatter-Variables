/**
 * Variable replacement engine - core logic
 */

import { Frontmatter, ReplacementResult, PluginSettings, Variable, FORBIDDEN_KEYS } from './types';

// Cached regex pattern for performance
let patternCache: { key: string; pattern: RegExp } | null = null;

/**
 * Escape special regex characters
 */
export function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build regex pattern based on settings (cached for performance)
 */
export function getVariablePattern(settings: PluginSettings): RegExp {
    // Validate delimiter length to prevent performance issues
    const MAX_DELIMITER_LEN = 10;
    
    if (settings.openDelimiter.length > MAX_DELIMITER_LEN ||
        settings.closeDelimiter.length > MAX_DELIMITER_LEN ||
        settings.defaultSeparator.length > MAX_DELIMITER_LEN) {
        // Fallback to default pattern
        return /\{\{\s*([\w.[\]-]+)\s*(?::\s*(.*?))?\s*\}\}/g;
    }
    
    const cacheKey = `${settings.openDelimiter}|${settings.closeDelimiter}|${settings.defaultSeparator}`;
    
    // Return cached pattern if settings haven't changed
    if (patternCache?.key === cacheKey) {
        // Reset lastIndex for global regex reuse
        patternCache.pattern.lastIndex = 0;
        return patternCache.pattern;
    }
    
    const open = escapeRegex(settings.openDelimiter);
    const close = escapeRegex(settings.closeDelimiter);
    const sep = escapeRegex(settings.defaultSeparator);
    
    // Pattern: {{varName}} or {{varName:defaultValue}}
    // Supports: word chars, dots, brackets, and hyphens in variable names
    const pattern = new RegExp(`${open}\\s*([\\w.\\[\\]\\-]+)\\s*(?:${sep}\\s*(.*?))?\\s*${close}`, 'g');
    
    patternCache = { key: cacheKey, pattern };
    return pattern;
}

/**
 * Invalidate pattern cache (call when settings change)
 */
export function invalidatePatternCache(): void {
    patternCache = null;
}

/**
 * Find a key in an object, optionally case-insensitive
 */
export function findKey(obj: any, key: string, caseInsensitive: boolean): string | undefined {
    if (!obj || typeof obj !== 'object') {
        return undefined;
    }
    
    // Guard against prototype pollution
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
        return undefined;
    }
    
    // Try exact match first
    if (key in obj) {
        return key;
    }
    
    // If case-insensitive, search for matching key
    if (caseInsensitive) {
        const lowerKey = key.toLowerCase();
        for (const k of Object.keys(obj)) {
            if (k.toLowerCase() === lowerKey) {
                return k;
            }
        }
    }
    
    return undefined;
}

/**
 * Get nested property value using dot notation
 */
export function getNestedValue(obj: any, path: string, caseInsensitive: boolean = false): any {
    if (!obj) {
        return undefined;
    }
    
    const keys = path.split('.');
    let value = obj;
    
    for (const key of keys) {
        if (value === undefined || value === null) {
            return undefined;
        }
        
        // Handle array index notation like "items[0]"
        const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
        if (arrayMatch) {
            const propName = arrayMatch[1];
            const foundKey = findKey(value, propName, caseInsensitive);
            if (!foundKey) {
                return undefined;
            }
            value = value[foundKey];
            if (Array.isArray(value)) {
                value = value[parseInt(arrayMatch[2])];
            } else {
                return undefined;
            }
        } else {
            const foundKey = findKey(value, key, caseInsensitive);
            if (!foundKey) {
                return undefined;
            }
            value = value[foundKey];
        }
    }
    
    return value;
}

/**
 * Replace variables in a string with frontmatter values
 */
export function replaceVariables(
    text: string,
    frontmatter: Frontmatter,
    settings: PluginSettings
): ReplacementResult {
    const pattern = getVariablePattern(settings);
    pattern.lastIndex = 0; // Reset for loop reuse
    let replacementCount = 0;
    let missingCount = 0;
    
    const result = text.replace(pattern, (match, varName, defaultValue) => {
        const value = getNestedValue(frontmatter, varName.trim(), settings.caseInsensitive);
        
        // Treat empty strings as missing (don't replace with nothing)
        if (value !== undefined && value !== null && value !== '') {
            replacementCount++;
            // Handle arrays and objects
            if (Array.isArray(value)) {
                return value.join(settings.arrayJoinSeparator || ', ');
            } else if (typeof value === 'object') {
                try {
                    return JSON.stringify(value);
                } catch (e) {
                    return '[Complex Object]';
                }
            }
            return String(value);
        }
        
        // Variable not found or empty - use default value if provided
        if (defaultValue !== undefined) {
            replacementCount++;
            return defaultValue;
        }
        
        missingCount++;
        // Preserve original or use missing text based on setting
        return settings.preserveOriginalOnMissing ? match : settings.missingValueText;
    });
    
    return { result, replacementCount, missingCount };
}

/**
 * Find if cursor is inside a {{variable}} pattern
 */
export function getVariableAtPosition(
    line: string,
    character: number,
    settings: PluginSettings
): Variable | null {
    const pattern = getVariablePattern(settings);
    pattern.lastIndex = 0; // Reset for loop reuse
    
    let match;
    while ((match = pattern.exec(line)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        
        if (character >= start && character < end) {
            const varName = match[1].trim();
            const defaultValue = match[2];
            
            return {
                name: varName,
                value: undefined,
                defaultValue: defaultValue,
                status: defaultValue !== undefined ? 'has-default' : 'missing',
                position: {
                    line: 0, // Will be set by caller
                    start,
                    end
                },
                fullMatch: match[0]
            };
        }
    }
    
    return null;
}

/**
 * Scan entire document for all variables and their status
 */
export function scanDocumentVariables(
    text: string,
    frontmatter: Frontmatter,
    frontmatterEnd: number,
    settings: PluginSettings
): Variable[] {
    const bodyPart = text.slice(frontmatterEnd);
    const pattern = getVariablePattern(settings);
    pattern.lastIndex = 0;
    const variables: Variable[] = [];
    const seen = new Set<string>();
    
    // Calculate line offset for frontmatter
    const frontmatterLines = text.slice(0, frontmatterEnd).split('\n').length - 1;
    
    let match;
    while ((match = pattern.exec(bodyPart)) !== null) {
        const varName = match[1].trim();
        const defaultValue = match[2];
        
        // Skip if we've already seen this variable
        if (seen.has(varName)) {
            continue;
        }
        seen.add(varName);
        
        const value = getNestedValue(frontmatter, varName, settings.caseInsensitive);
        
        // Determine status (empty strings are treated as missing)
        let status: Variable['status'];
        if (value !== undefined && value !== null && value !== '') {
            status = 'exists';
        } else if (defaultValue !== undefined) {
            status = 'has-default';
        } else {
            status = 'missing';
        }
        
        // Calculate line number from offset in bodyPart
        const textBeforeMatch = bodyPart.slice(0, match.index);
        const linesBeforeMatch = textBeforeMatch.split('\n').length - 1;
        const lineNum = frontmatterLines + linesBeforeMatch;
        
        // Calculate character position within line
        const lastNewline = textBeforeMatch.lastIndexOf('\n');
        const charPos = lastNewline === -1 ? match.index : match.index - lastNewline - 1;
        
        variables.push({
            name: varName,
            status: status,
            value: value,
            defaultValue: defaultValue,
            fullMatch: match[0],
            position: {
                line: lineNum,
                start: charPos,
                end: charPos + match[0].length
            }
        });
    }
    
    return variables;
}
