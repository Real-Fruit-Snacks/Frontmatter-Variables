/**
 * Copy commands - copy text with variables replaced
 */

import * as vscode from 'vscode';
import { parseFrontmatterFromDocument, findFrontmatterEnd } from '../frontmatterParser';
import { replaceVariables } from '../variableReplacer';
import { getSettings } from '../utils/settings';
import { notify } from '../utils/notifications';

/**
 * Copy current line with variables replaced
 */
export async function copyLineReplaced(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        notify('No active editor', 'error');
        return;
    }
    
    if (editor.document.languageId !== 'markdown') {
        notify('This command only works with markdown files', 'error');
        return;
    }
    
    try {
        const settings = getSettings();
        const frontmatter = parseFrontmatterFromDocument(editor.document);
        const cursor = editor.selection.active;
        const line = editor.document.lineAt(cursor.line);
        
        const { result, replacementCount } = replaceVariables(line.text, frontmatter, settings);
        
        await vscode.env.clipboard.writeText(result);
        notify(`Copied line (${replacementCount} variable(s) replaced)`);
    } catch (error) {
        notify('Failed to copy to clipboard', 'error');
        console.error('Copy line error:', error);
    }
}

/**
 * Copy selection with variables replaced
 */
export async function copySelectionReplaced(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        notify('No active editor', 'error');
        return;
    }
    
    if (editor.document.languageId !== 'markdown') {
        notify('This command only works with markdown files', 'error');
        return;
    }
    
    try {
        const settings = getSettings();
        const frontmatter = parseFrontmatterFromDocument(editor.document);
        const selection = editor.document.getText(editor.selection);
        
        if (!selection || selection.length === 0) {
            // Fall back to current line
            return copyLineReplaced();
        }
        
        const { result, replacementCount } = replaceVariables(selection, frontmatter, settings);
        
        await vscode.env.clipboard.writeText(result);
        notify(`Copied selection (${replacementCount} variable(s) replaced)`);
    } catch (error) {
        notify('Failed to copy to clipboard', 'error');
        console.error('Copy selection error:', error);
    }
}

/**
 * Copy entire document with variables replaced
 */
export async function copyDocumentReplaced(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        notify('No active editor', 'error');
        return;
    }
    
    if (editor.document.languageId !== 'markdown') {
        notify('This command only works with markdown files', 'error');
        return;
    }
    
    try {
        const settings = getSettings();
        const content = editor.document.getText();
        const frontmatter = parseFrontmatterFromDocument(editor.document);
        
        // Find the end of frontmatter
        const frontmatterEnd = findFrontmatterEnd(content);
        const bodyPart = content.slice(frontmatterEnd);
        
        const { result, replacementCount } = replaceVariables(bodyPart, frontmatter, settings);
        
        await vscode.env.clipboard.writeText(result);
        notify(`Copied document (${replacementCount} variable(s) replaced)`);
    } catch (error) {
        notify('Failed to copy to clipboard', 'error');
        console.error('Copy document error:', error);
    }
}
