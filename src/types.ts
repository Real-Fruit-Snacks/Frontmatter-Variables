/**
 * Type definitions for YAML Variable Templater
 */

export interface PluginSettings {
    openDelimiter: string;
    closeDelimiter: string;
    defaultSeparator: string;
    missingValueText: string;
    supportNestedProperties: boolean;
    caseInsensitive: boolean;
    arrayJoinSeparator: string;
    preserveOriginalOnMissing: boolean;
    notificationLevel: 'all' | 'errors' | 'none';
    highlightVariables: boolean;
    highlightColors: {
        exists: string;
        missing: string;
        hasDefault: string;
    };
}

export interface Variable {
    name: string;
    value: string | undefined;
    defaultValue?: string;
    status: 'exists' | 'missing' | 'has-default' | 'frontmatter-only';
    position?: {
        line: number;
        start: number;
        end: number;
    };
    fullMatch?: string;
}

export interface Frontmatter {
    [key: string]: any;
}

export interface ReplacementResult {
    result: string;
    replacementCount: number;
    missingCount: number;
}

export const DEFAULT_SETTINGS: PluginSettings = {
    openDelimiter: '{{',
    closeDelimiter: '}}',
    defaultSeparator: ':',
    missingValueText: '[MISSING]',
    supportNestedProperties: true,
    caseInsensitive: false,
    arrayJoinSeparator: ', ',
    preserveOriginalOnMissing: false,
    notificationLevel: 'all',
    highlightVariables: true,
    highlightColors: {
        exists: '',
        missing: '',
        hasDefault: ''
    }
};

// Default colors for variable state highlighting (light/dark theme variants)
export const DEFAULT_HIGHLIGHT_COLORS = {
    exists: { light: '#28a745', dark: '#4ade80' },
    missing: { light: '#dc3545', dark: '#f87171' },
    hasDefault: { light: '#e6a700', dark: '#fbbf24' }
};

// Forbidden keys to prevent prototype pollution
export const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Maximum allowed array index to prevent unbounded array creation
export const MAX_ARRAY_INDEX = 1000;
