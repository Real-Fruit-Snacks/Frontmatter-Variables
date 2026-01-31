/**
 * Settings management utilities
 */

import * as vscode from 'vscode';
import { PluginSettings, DEFAULT_SETTINGS } from '../types';

/**
 * Get current plugin settings from VSCode configuration
 */
export function getSettings(): PluginSettings {
    const config = vscode.workspace.getConfiguration('frontmatterVariables');
    
    return {
        openDelimiter: config.get<string>('openDelimiter', DEFAULT_SETTINGS.openDelimiter),
        closeDelimiter: config.get<string>('closeDelimiter', DEFAULT_SETTINGS.closeDelimiter),
        defaultSeparator: config.get<string>('defaultSeparator', DEFAULT_SETTINGS.defaultSeparator),
        missingValueText: config.get<string>('missingValueText', DEFAULT_SETTINGS.missingValueText),
        supportNestedProperties: config.get<boolean>('supportNestedProperties', DEFAULT_SETTINGS.supportNestedProperties),
        caseInsensitive: config.get<boolean>('caseInsensitive', DEFAULT_SETTINGS.caseInsensitive),
        arrayJoinSeparator: config.get<string>('arrayJoinSeparator', DEFAULT_SETTINGS.arrayJoinSeparator),
        preserveOriginalOnMissing: config.get<boolean>('preserveOriginalOnMissing', DEFAULT_SETTINGS.preserveOriginalOnMissing),
        notificationLevel: config.get<'all' | 'errors' | 'none'>('notificationLevel', DEFAULT_SETTINGS.notificationLevel),
        highlightVariables: config.get<boolean>('highlightVariables', DEFAULT_SETTINGS.highlightVariables),
        highlightColors: {
            exists: config.get<string>('highlightColors.exists', DEFAULT_SETTINGS.highlightColors.exists),
            missing: config.get<string>('highlightColors.missing', DEFAULT_SETTINGS.highlightColors.missing),
            hasDefault: config.get<string>('highlightColors.hasDefault', DEFAULT_SETTINGS.highlightColors.hasDefault)
        }
    };
}

/**
 * Watch for settings changes and call callback
 */
export function watchSettings(callback: () => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('frontmatterVariables')) {
            callback();
        }
    });
}
