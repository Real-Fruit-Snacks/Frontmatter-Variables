/**
 * Frontmatter Variables VSCode Extension
 * Main entry point
 */

import * as vscode from 'vscode';
import { VariableDecorationProvider } from './decorationProvider';
import { copyLineReplaced, copySelectionReplaced, copyDocumentReplaced } from './commands/copyCommands';
import { replaceInSelection, replaceInDocument, replaceInDocumentAndFilename } from './commands/replaceCommands';
import { renameFileWithVariables } from './commands/renameCommand';
import { setVariableCommand } from './commands/setVariableCommand';
import { listVariablesCommand } from './commands/listVariablesCommand';
import { watchSettings } from './utils/settings';

let decorationProvider: VariableDecorationProvider | undefined;

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Frontmatter Variables extension is now active');
    
    // Initialize decoration provider
    decorationProvider = new VariableDecorationProvider();
    
    // Register all commands
    context.subscriptions.push(
        vscode.commands.registerCommand('frontmatterVariables.copyLineReplaced', copyLineReplaced),
        vscode.commands.registerCommand('frontmatterVariables.copySelectionReplaced', copySelectionReplaced),
        vscode.commands.registerCommand('frontmatterVariables.copyDocumentReplaced', copyDocumentReplaced),
        vscode.commands.registerCommand('frontmatterVariables.replaceInSelection', replaceInSelection),
        vscode.commands.registerCommand('frontmatterVariables.replaceInDocument', replaceInDocument),
        vscode.commands.registerCommand('frontmatterVariables.replaceInDocumentAndFilename', replaceInDocumentAndFilename),
        vscode.commands.registerCommand('frontmatterVariables.renameFile', renameFileWithVariables),
        vscode.commands.registerCommand('frontmatterVariables.setVariable', setVariableCommand),
        vscode.commands.registerCommand('frontmatterVariables.listVariables', listVariablesCommand)
    );
    
    // Update decorations for active editor
    if (vscode.window.activeTextEditor) {
        decorationProvider.updateDecorations(vscode.window.activeTextEditor);
    }
    
    // Update decorations when active editor changes
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && decorationProvider) {
                decorationProvider.updateDecorations(editor);
            }
        })
    );
    
    // Update decorations when document changes (debounced)
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document === event.document && decorationProvider) {
                decorationProvider.updateDecorationsDebounced(editor);
            }
        })
    );
    
    // Watch for settings changes
    context.subscriptions.push(
        watchSettings(() => {
            if (decorationProvider) {
                decorationProvider.refreshDecorations();
                // Update all visible editors
                vscode.window.visibleTextEditors.forEach(editor => {
                    if (decorationProvider) {
                        decorationProvider.updateDecorations(editor);
                    }
                });
            }
        })
    );
    
    // Update decorations when theme changes
    context.subscriptions.push(
        vscode.window.onDidChangeActiveColorTheme(() => {
            if (decorationProvider) {
                decorationProvider.refreshDecorations();
                vscode.window.visibleTextEditors.forEach(editor => {
                    if (decorationProvider) {
                        decorationProvider.updateDecorations(editor);
                    }
                });
            }
        })
    );
}

/**
 * Extension deactivation
 */
export function deactivate() {
    if (decorationProvider) {
        decorationProvider.dispose();
        decorationProvider = undefined;
    }
}
