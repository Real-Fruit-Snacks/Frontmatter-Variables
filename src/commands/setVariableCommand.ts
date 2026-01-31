/**
 * Set variable command - context menu to set variable value
 */

import * as vscode from 'vscode';
import { parseFrontmatterFromDocument, updateFrontmatter } from '../frontmatterParser';
import { getVariableAtPosition, getNestedValue } from '../variableReplacer';
import { getSettings } from '../utils/settings';
import { notify } from '../utils/notifications';

/**
 * Set variable value from context menu
 */
export async function setVariableCommand(): Promise<void> {
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
        const position = editor.selection.active;
        const line = editor.document.lineAt(position.line);
        
        // Find variable at cursor position
        const variable = getVariableAtPosition(line.text, position.character, settings);
        
        if (!variable) {
            notify('No variable at cursor position', 'info');
            return;
        }
        
        // Get frontmatter to check current value
        const frontmatter = parseFrontmatterFromDocument(editor.document);
        const currentValue = getNestedValue(frontmatter, variable.name, settings.caseInsensitive);
        
        // Show input box with current value pre-filled
        const newValue = await vscode.window.showInputBox({
            prompt: `Set value for: ${variable.name}`,
            value: currentValue?.toString() || '',
            placeHolder: 'Enter value...'
        });
        
        // User cancelled
        if (newValue === undefined) {
            return;
        }
        
        // Update frontmatter
        const edits = updateFrontmatter(editor.document, {
            [variable.name]: newValue
        });
        
        const workspaceEdit = new vscode.WorkspaceEdit();
        workspaceEdit.set(editor.document.uri, edits);
        await vscode.workspace.applyEdit(workspaceEdit);
        
        notify(`Set ${variable.name} = ${newValue}`);
    } catch (error) {
        notify('Failed to set variable value', 'error');
        console.error('Set variable error:', error);
    }
}
