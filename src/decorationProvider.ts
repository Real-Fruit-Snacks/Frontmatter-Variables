/**
 * Decoration provider for variable syntax highlighting
 */

import * as vscode from 'vscode';
import { parseFrontmatterFromDocument, findFrontmatterEnd } from './frontmatterParser';
import { scanDocumentVariables } from './variableReplacer';
import { getSettings } from './utils/settings';
import { DEFAULT_HIGHLIGHT_COLORS } from './types';

export class VariableDecorationProvider {
    private existsDecoration: vscode.TextEditorDecorationType;
    private missingDecoration: vscode.TextEditorDecorationType;
    private hasDefaultDecoration: vscode.TextEditorDecorationType;
    private updateTimeout: NodeJS.Timeout | undefined;
    
    constructor() {
        this.existsDecoration = this.createDecoration('exists');
        this.missingDecoration = this.createDecoration('missing');
        this.hasDefaultDecoration = this.createDecoration('hasDefault');
    }
    
    /**
     * Create decoration type for a variable state
     */
    private createDecoration(state: 'exists' | 'missing' | 'hasDefault'): vscode.TextEditorDecorationType {
        const settings = getSettings();
        const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
        
        let color: string;
        if (settings.highlightColors[state]) {
            color = settings.highlightColors[state];
        } else {
            color = DEFAULT_HIGHLIGHT_COLORS[state][isDark ? 'dark' : 'light'];
        }
        
        return vscode.window.createTextEditorDecorationType({
            color: color,
            backgroundColor: this.hexToRgba(color, 0.15),
            borderRadius: '3px'
        });
    }
    
    /**
     * Convert hex color to rgba with alpha
     */
    private hexToRgba(hex: string, alpha: number): string {
        // Validate hex format
        if (!hex || typeof hex !== 'string' || !hex.match(/^#[0-9A-Fa-f]{6}$/)) {
            return `rgba(128, 128, 128, ${alpha})`;
        }
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    /**
     * Recreate decorations with new colors (call when settings change)
     */
    public refreshDecorations(): void {
        this.existsDecoration.dispose();
        this.missingDecoration.dispose();
        this.hasDefaultDecoration.dispose();
        
        this.existsDecoration = this.createDecoration('exists');
        this.missingDecoration = this.createDecoration('missing');
        this.hasDefaultDecoration = this.createDecoration('hasDefault');
    }
    
    /**
     * Update decorations for an editor
     */
    public updateDecorations(editor: vscode.TextEditor): void {
        const settings = getSettings();
        
        // Check if highlighting is enabled
        if (!settings.highlightVariables) {
            editor.setDecorations(this.existsDecoration, []);
            editor.setDecorations(this.missingDecoration, []);
            editor.setDecorations(this.hasDefaultDecoration, []);
            return;
        }
        
        // Only highlight markdown files
        if (editor.document.languageId !== 'markdown') {
            return;
        }
        
        const content = editor.document.getText();
        const frontmatter = parseFrontmatterFromDocument(editor.document);
        const frontmatterEnd = findFrontmatterEnd(content);
        
        // Scan for variables
        const variables = scanDocumentVariables(content, frontmatter, frontmatterEnd, settings);
        
        // Group ranges by status
        const existsRanges: vscode.Range[] = [];
        const missingRanges: vscode.Range[] = [];
        const hasDefaultRanges: vscode.Range[] = [];
        
        for (const variable of variables) {
            if (!variable.position) {
                continue;
            }
            
            const range = new vscode.Range(
                variable.position.line,
                variable.position.start,
                variable.position.line,
                variable.position.end
            );
            
            if (variable.status === 'exists') {
                existsRanges.push(range);
            } else if (variable.status === 'has-default') {
                hasDefaultRanges.push(range);
            } else {
                missingRanges.push(range);
            }
        }
        
        // Apply decorations
        editor.setDecorations(this.existsDecoration, existsRanges);
        editor.setDecorations(this.missingDecoration, missingRanges);
        editor.setDecorations(this.hasDefaultDecoration, hasDefaultRanges);
    }
    
    /**
     * Update decorations with debouncing
     */
    public updateDecorationsDebounced(editor: vscode.TextEditor): void {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        
        this.updateTimeout = setTimeout(() => {
            this.updateDecorations(editor);
        }, 300);
    }
    
    /**
     * Dispose all decorations
     */
    public dispose(): void {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        this.existsDecoration.dispose();
        this.missingDecoration.dispose();
        this.hasDefaultDecoration.dispose();
    }
}
