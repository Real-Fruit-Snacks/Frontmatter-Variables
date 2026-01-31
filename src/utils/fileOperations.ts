/**
 * File operation utilities
 */

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Sanitize filename by removing/replacing invalid characters
 */
export function sanitizeFilename(name: string): string | null {
    if (!name) {
        return null;
    }
    
    // Remove characters that are invalid in filenames across platforms
    // Windows: \ / : * ? " < > |
    // Also remove leading/trailing spaces and dots
    let sanitized = name
        .replace(/[\\/:*?"<>|]/g, '-')  // Replace invalid chars with dash
        .replace(/\s+/g, ' ')            // Collapse multiple spaces
        .trim()                          // Remove leading/trailing spaces
        .replace(/^\.+|\.+$/g, '');      // Remove leading/trailing dots
    
    // Check for Windows reserved names
    const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
    if (WINDOWS_RESERVED.test(sanitized)) {
        sanitized = '_' + sanitized;
    }
    
    // Ensure the filename isn't empty after sanitization
    return sanitized || null;
}

/**
 * Rename file with proper error handling
 */
export async function renameFile(uri: vscode.Uri, newBasename: string): Promise<void> {
    const ext = path.extname(uri.fsPath);
    const dirPath = path.dirname(uri.fsPath);
    const newPath = path.join(dirPath, newBasename + ext);
    const newUri = vscode.Uri.file(newPath);
    
    // Check if target file already exists
    try {
        await vscode.workspace.fs.stat(newUri);
        // File exists
        throw new Error(`File already exists: ${newBasename}${ext}`);
    } catch (error: any) {
        if (error.code === 'FileNotFound') {
            // Good, file doesn't exist, we can rename
            await vscode.workspace.fs.rename(uri, newUri);
        } else {
            // Re-throw if it's not a "not found" error
            throw error;
        }
    }
}
