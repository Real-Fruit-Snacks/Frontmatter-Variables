/**
 * Notification utilities respecting user preferences
 */

import * as vscode from 'vscode';
import { getSettings } from './settings';

export type NotificationType = 'success' | 'error' | 'info';

/**
 * Show notification based on notification level setting
 */
export function notify(message: string, type: NotificationType = 'success'): void {
    const settings = getSettings();
    const level = settings.notificationLevel;
    
    // Always show errors unless completely silent
    if (type === 'error' && level !== 'none') {
        vscode.window.showErrorMessage(message);
        return;
    }
    
    // Show success/info only if level is 'all'
    if (level === 'all') {
        if (type === 'error') {
            vscode.window.showErrorMessage(message);
        } else if (type === 'info') {
            vscode.window.showInformationMessage(message);
        } else {
            vscode.window.showInformationMessage(message);
        }
    }
}
