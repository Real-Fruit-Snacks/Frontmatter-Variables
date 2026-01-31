/**
 * List variables command - show all variables in a QuickPick
 */

import * as vscode from 'vscode';
import { parseFrontmatterFromDocument, findFrontmatterEnd, updateFrontmatter } from '../frontmatterParser';
import { scanDocumentVariables } from '../variableReplacer';
import { getSettings } from '../utils/settings';
import { notify } from '../utils/notifications';
import { Variable } from '../types';

interface VariableQuickPickItem extends vscode.QuickPickItem {
    variable: Variable;
}

/**
 * List all variables in document with QuickPick interface
 */
export async function listVariablesCommand(): Promise<void> {
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
        const frontmatterEnd = findFrontmatterEnd(content);
        
        // Scan for all variables
        const variables = scanDocumentVariables(content, frontmatter, frontmatterEnd, settings);
        
        if (variables.length === 0) {
            notify('No variables found in document', 'info');
            return;
        }
        
        // Create QuickPick items grouped by status
        const items: VariableQuickPickItem[] = [];
        
        // Group variables
        const missing = variables.filter(v => v.status === 'missing');
        const hasDefault = variables.filter(v => v.status === 'has-default');
        const exists = variables.filter(v => v.status === 'exists');
        
        // Add missing variables first (most important)
        if (missing.length > 0) {
            items.push({
                label: '🔴 Missing Variables',
                kind: vscode.QuickPickItemKind.Separator,
                variable: missing[0]
            } as any);
            
            for (const v of missing) {
                items.push({
                    label: `$(circle-outline) ${v.name}`,
                    description: '[MISSING]',
                    detail: v.defaultValue ? `Default: ${v.defaultValue}` : 'No default value',
                    variable: v
                });
            }
        }
        
        // Variables with defaults
        if (hasDefault.length > 0) {
            items.push({
                label: '🟠 Variables with Defaults',
                kind: vscode.QuickPickItemKind.Separator,
                variable: hasDefault[0]
            } as any);
            
            for (const v of hasDefault) {
                items.push({
                    label: `$(circle-slash) ${v.name}`,
                    description: v.value?.toString() || '[not set]',
                    detail: `Default: ${v.defaultValue}`,
                    variable: v
                });
            }
        }
        
        // Variables with values
        if (exists.length > 0) {
            items.push({
                label: '🟢 Set Variables',
                kind: vscode.QuickPickItemKind.Separator,
                variable: exists[0]
            } as any);
            
            for (const v of exists) {
                items.push({
                    label: `$(circle-filled) ${v.name}`,
                    description: v.value?.toString() || '',
                    detail: 'Click to edit',
                    variable: v
                });
            }
        }
        
        // Show QuickPick
        const quickPick = vscode.window.createQuickPick<VariableQuickPickItem>();
        quickPick.title = 'Document Variables';
        quickPick.placeholder = 'Select a variable to edit or navigate';
        quickPick.items = items;
        quickPick.canSelectMany = false;
        
        quickPick.onDidAccept(async () => {
            const selected = quickPick.selectedItems[0];
            if (selected && selected.variable) {
                quickPick.hide();
                await editVariable(editor, selected.variable);
            }
        });
        
        quickPick.onDidHide(() => quickPick.dispose());
        quickPick.show();
    } catch (error) {
        notify('Failed to list variables', 'error');
        console.error('List variables error:', error);
    }
}

/**
 * Edit a variable's value
 */
async function editVariable(editor: vscode.TextEditor, variable: Variable): Promise<void> {
    try {
        const newValue = await vscode.window.showInputBox({
            prompt: `Edit value for: ${variable.name}`,
            value: variable.value?.toString() || '',
            placeHolder: variable.defaultValue ? `Default: ${variable.defaultValue}` : 'Enter value...'
        });
        
        if (newValue === undefined) {
            return; // User cancelled
        }
        
        // Update frontmatter
        const edits = updateFrontmatter(editor.document, {
            [variable.name]: newValue
        });
        
        const workspaceEdit = new vscode.WorkspaceEdit();
        workspaceEdit.set(editor.document.uri, edits);
        await vscode.workspace.applyEdit(workspaceEdit);
        
        notify(`Updated ${variable.name} = ${newValue}`);
        
        // Optionally navigate to the variable
        if (variable.position) {
            const position = new vscode.Position(variable.position.line, variable.position.start);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
        }
    } catch (error) {
        notify('Failed to edit variable', 'error');
        console.error('Edit variable error:', error);
    }
}
