/**
 * Rename file command - rename file with variables replaced
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { parseFrontmatterFromDocument } from '../frontmatterParser';
import { replaceVariables } from '../variableReplacer';
import { getSettings } from '../utils/settings';
import { notify } from '../utils/notifications';
import { sanitizeFilename } from '../utils/fileOperations';

/**
 * Rename file with variables replaced in the filename
 */
export async function renameFileWithVariables(): Promise<void> {
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
        
        // Get current filename without extension
        const uri = editor.document.uri;
        const currentName = path.basename(uri.fsPath, path.extname(uri.fsPath));
        const extension = path.extname(uri.fsPath);
        
        // Replace variables in the filename
        const { result: newName, replacementCount, missingCount } = replaceVariables(currentName, frontmatter, settings);
        
        // Check if there were any variables to replace
        if (replacementCount === 0 && missingCount === 0) {
            notify('No variables found in filename', 'info');
            return;
        }
        
        // Check if the name actually changed
        if (newName === currentName) {
            notify('Filename unchanged after replacement', 'info');
            return;
        }
        
        // Sanitize the new filename
        const sanitizedName = sanitizeFilename(newName);
        
        if (!sanitizedName) {
            notify('Invalid filename after replacement', 'error');
            return;
        }
        
        // Build the new full path
        const dirPath = path.dirname(uri.fsPath);
        const newPath = path.join(dirPath, sanitizedName + extension);
        const newUri = vscode.Uri.file(newPath);
        
        // Check if a file with this name already exists
        try {
            await vscode.workspace.fs.stat(newUri);
            notify(`File already exists: ${sanitizedName}${extension}`, 'error');
            return;
        } catch {
            // Good, file doesn't exist, we can rename
            try {
                await vscode.workspace.fs.rename(uri, newUri);
                notify(`Renamed to: ${sanitizedName}${missingCount > 0 ? ` (${missingCount} variable(s) not found)` : ''}`);
            } catch (err) {
                notify('Failed to rename file', 'error');
                console.error('Rename error:', err);
            }
        }
    } catch (error) {
        notify('Failed to rename file', 'error');
        console.error('Rename file error:', error);
    }
}
