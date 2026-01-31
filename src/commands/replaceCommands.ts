/**
 * Replace commands - permanently replace variables in document
 */

import * as vscode from 'vscode';
import { parseFrontmatterFromDocument, findFrontmatterEnd } from '../frontmatterParser';
import { replaceVariables } from '../variableReplacer';
import { getSettings } from '../utils/settings';
import { notify } from '../utils/notifications';

/**
 * Replace variables in selection (or current line if no selection)
 */
export async function replaceInSelection(): Promise<void> {
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
        
        await editor.edit(editBuilder => {
            if (editor.selection.isEmpty) {
                // No selection - replace current line
                const cursor = editor.selection.active;
                const line = editor.document.lineAt(cursor.line);
                const { result, replacementCount, missingCount } = replaceVariables(line.text, frontmatter, settings);
                
                if (replacementCount === 0 && missingCount === 0) {
                    notify('No variables found in line', 'info');
                    return;
                }
                
                editBuilder.replace(line.range, result);
                notify(`Replaced ${replacementCount} variable(s)${missingCount > 0 ? `, ${missingCount} not found` : ''}`);
            } else {
                // Replace in selection
                const selection = editor.document.getText(editor.selection);
                const { result, replacementCount, missingCount } = replaceVariables(selection, frontmatter, settings);
                
                if (replacementCount === 0 && missingCount === 0) {
                    notify('No variables found in selection', 'info');
                    return;
                }
                
                editBuilder.replace(editor.selection, result);
                notify(`Replaced ${replacementCount} variable(s)${missingCount > 0 ? `, ${missingCount} not found` : ''}`);
            }
        });
    } catch (error) {
        notify('Failed to replace variables', 'error');
        console.error('Replace in selection error:', error);
    }
}

/**
 * Replace all variables in document
 */
export async function replaceInDocument(): Promise<void> {
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
        
        // Find the end of frontmatter to avoid replacing in YAML
        const frontmatterEnd = findFrontmatterEnd(content);
        const bodyPart = content.slice(frontmatterEnd);
        
        const { result, replacementCount, missingCount } = replaceVariables(bodyPart, frontmatter, settings);
        
        // Skip if nothing to replace
        if (replacementCount === 0 && missingCount === 0) {
            notify('No variables found in document', 'info');
            return;
        }
        
        // Save cursor position
        const cursorPos = editor.selection.active;
        
        await editor.edit(editBuilder => {
            // Replace only the body part (after frontmatter)
            const startPos = editor.document.positionAt(frontmatterEnd);
            const endPos = editor.document.positionAt(content.length);
            editBuilder.replace(new vscode.Range(startPos, endPos), result);
        });
        
        // Restore cursor position (clamped to valid range)
        const newLine = Math.min(cursorPos.line, editor.document.lineCount - 1);
        const lineLength = editor.document.lineAt(newLine).text.length;
        const newChar = Math.min(cursorPos.character, lineLength);
        editor.selection = new vscode.Selection(newLine, newChar, newLine, newChar);
        
        notify(`Replaced ${replacementCount} variable(s)${missingCount > 0 ? `, ${missingCount} not found` : ''}`);
    } catch (error) {
        notify('Failed to replace variables', 'error');
        console.error('Replace in document error:', error);
    }
}

/**
 * Replace all variables in document and filename
 */
export async function replaceInDocumentAndFilename(): Promise<void> {
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
        
        // Calculate document replacements first (but don't apply yet)
        const frontmatterEnd = findFrontmatterEnd(content);
        const bodyPart = content.slice(frontmatterEnd);
        const docResult = replaceVariables(bodyPart, frontmatter, settings);
        
        // Calculate filename replacements
        const uri = editor.document.uri;
        const path = require('path');
        const currentName = path.basename(uri.fsPath, path.extname(uri.fsPath));
        const filenameResult = replaceVariables(currentName, frontmatter, settings);
        
        let filenameReplaced = false;
        let newFilename = '';
        
        // Check if there's anything to do
        const hasDocChanges = docResult.replacementCount > 0 || docResult.missingCount > 0;
        const hasFilenameChanges = filenameResult.replacementCount > 0 && filenameResult.result !== currentName;
        
        if (!hasDocChanges && !hasFilenameChanges) {
            notify('No variables found', 'info');
            return;
        }
        
        // RENAME FIRST (for atomicity - if it fails, we abort before modifying document)
        if (hasFilenameChanges) {
            const { sanitizeFilename } = require('../utils/fileOperations');
            const sanitizedName = sanitizeFilename(filenameResult.result);
            
            if (sanitizedName) {
                const ext = path.extname(uri.fsPath);
                const dirPath = path.dirname(uri.fsPath);
                const newPath = path.join(dirPath, sanitizedName + ext);
                const newUri = vscode.Uri.file(newPath);
                
                // Check if file already exists
                try {
                    await vscode.workspace.fs.stat(newUri);
                    notify(`Cannot rename: file "${sanitizedName}${ext}" already exists`, 'error');
                    return; // Abort entire operation
                } catch {
                    // Good, file doesn't exist
                    try {
                        await vscode.workspace.fs.rename(uri, newUri);
                        filenameReplaced = true;
                        newFilename = sanitizedName;
                    } catch (err) {
                        notify('Failed to rename file', 'error');
                        console.error('Rename error:', err);
                        return; // Abort entire operation
                    }
                }
            }
        }
        
        // THEN MODIFY DOCUMENT (only after successful rename or if no rename needed)
        if (hasDocChanges) {
            const cursorPos = editor.selection.active;
            
            await editor.edit(editBuilder => {
                const startPos = editor.document.positionAt(frontmatterEnd);
                const endPos = editor.document.positionAt(content.length);
                editBuilder.replace(new vscode.Range(startPos, endPos), docResult.result);
            });
            
            // Restore cursor
            const newLine = Math.min(cursorPos.line, editor.document.lineCount - 1);
            const lineLength = editor.document.lineAt(newLine).text.length;
            const newChar = Math.min(cursorPos.character, lineLength);
            editor.selection = new vscode.Selection(newLine, newChar, newLine, newChar);
        }
        
        // Build notification message
        let msg = '';
        if (docResult.replacementCount > 0) {
            msg += `Replaced ${docResult.replacementCount} in document`;
        }
        if (filenameReplaced) {
            msg += msg ? ', ' : '';
            msg += `renamed to: ${newFilename}`;
        }
        if (docResult.missingCount > 0) {
            msg += ` (${docResult.missingCount} not found)`;
        }
        
        if (msg) {
            notify(msg);
        }
    } catch (error) {
        notify('Failed to replace variables', 'error');
        console.error('Replace in document and filename error:', error);
    }
}
