/*
 * YAML Variable Templater Plugin for Obsidian
 * Replaces {{variables}} with YAML frontmatter values ON DEMAND
 */

'use strict';

const { Plugin, PluginSettingTab, Setting, Notice, MarkdownView, parseYaml, stringifyYaml, Menu, Modal, Platform } = require('obsidian');
const { ViewPlugin, Decoration } = require('@codemirror/view');
const { RangeSetBuilder, StateField, StateEffect } = require('@codemirror/state');

// Notification level options
const NOTIFICATION_LEVELS = {
    'all': 'Show all notifications',
    'errors': 'Only show errors',
    'none': 'Silent (no notifications)'
};

// Available ribbon actions with icons
const RIBBON_ACTIONS = {
    'replace-selection': {
        name: 'Replace variables in selection',
        icon: 'text-cursor-input'
    },
    'replace-document': {
        name: 'Replace all variables in document',
        icon: 'file-text'
    },
    'replace-document-and-filename': {
        name: 'Replace all variables in document and filename',
        icon: 'file-pen-line'
    },
    'copy-line-replaced': {
        name: 'Copy current line with variables replaced',
        icon: 'clipboard-copy'
    },
    'copy-selection-replaced': {
        name: 'Copy selection with variables replaced',
        icon: 'clipboard-list'
    },
    'copy-document-replaced': {
        name: 'Copy entire document with variables replaced',
        icon: 'files'
    },
    'rename-file-replaced': {
        name: 'Rename file with variables replaced',
        icon: 'file-signature'
    },
    'list-variables': {
        name: 'List all variables in document',
        icon: 'list'
    }
};

// Default colors for menu items (empty = inherit/default)
const DEFAULT_ACTION_COLORS = {
    'replace-selection': '',
    'replace-document': '',
    'replace-document-and-filename': '',
    'copy-line-replaced': '',
    'copy-selection-replaced': '',
    'copy-document-replaced': '',
    'rename-file-replaced': '',
    'list-variables': ''
};

// Preset color palette for quick selection
const COLOR_PRESETS = [
    { name: 'Red', value: '#e53935' },
    { name: 'Pink', value: '#d81b60' },
    { name: 'Purple', value: '#8e24aa' },
    { name: 'Blue', value: '#1e88e5' },
    { name: 'Cyan', value: '#00acc1' },
    { name: 'Teal', value: '#00897b' },
    { name: 'Green', value: '#43a047' },
    { name: 'Lime', value: '#7cb342' },
    { name: 'Yellow', value: '#fdd835' },
    { name: 'Orange', value: '#fb8c00' },
    { name: 'Brown', value: '#6d4c41' },
    { name: 'Grey', value: '#757575' }
];

// Default colors for variable state highlighting (light/dark theme variants)
const DEFAULT_HIGHLIGHT_COLORS = {
    exists: { light: '#28a745', dark: '#4ade80' },
    missing: { light: '#dc3545', dark: '#f87171' },
    hasDefault: { light: '#e6a700', dark: '#fbbf24' }
};

// Default settings
const DEFAULT_SETTINGS = {
    openDelimiter: '{{',
    closeDelimiter: '}}',
    defaultSeparator: ':',
    missingValueText: '[MISSING]',
    supportNestedProperties: true,
    caseInsensitive: false,
    arrayJoinSeparator: ', ',
    preserveOriginalOnMissing: false,
    notificationLevel: 'all',
    showRibbonIcon: true,
    ribbonMode: 'single',  // 'single' or 'menu'
    ribbonAction: 'copy-line-replaced',
    highlightVariables: true,
    actionColors: { ...DEFAULT_ACTION_COLORS },
    highlightColors: {
        exists: '',      // empty = use default green
        missing: '',     // empty = use default red
        hasDefault: ''   // empty = use default orange/amber
    },
    // New feature toggles
    enableContextMenu: true,
    showFrontmatterOnlyVariables: true,
    closeModalOnNavigate: true,
    debugLogging: false
};

// Modal for setting variable values from context menu
class SetVariableModal extends Modal {
    constructor(app, varName, currentValue, onSubmit) {
        super(app);
        this.varName = varName;
        this.currentValue = currentValue;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        const isEdit = this.currentValue !== undefined && this.currentValue !== '';
        const title = isEdit ? `Edit value for: ${this.varName}` : `Set value for: ${this.varName}`;
        contentEl.createEl('h3', { text: title });

        const inputEl = contentEl.createEl('input', { type: 'text' });
        inputEl.value = this.currentValue || '';
        inputEl.placeholder = 'Enter value...';
        inputEl.style.width = '100%';
        inputEl.addClass('yaml-var-input');

        // Focus and select all text after modal opens
        setTimeout(() => {
            inputEl.focus();
            inputEl.select();
        }, 10);

        // Handle Enter key
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                this.close();
                this.onSubmit(inputEl.value);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.close();
            }
        });

        // Buttons
        const buttonDiv = contentEl.createEl('div', { cls: 'modal-button-container' });
        buttonDiv.style.marginTop = '1em';

        const cancelBtn = buttonDiv.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const saveBtn = buttonDiv.createEl('button', { text: 'Save', cls: 'mod-cta' });
        saveBtn.addEventListener('click', () => {
            this.close();
            this.onSubmit(inputEl.value);
        });
    }

    onClose() {
        this.contentEl.empty();
    }
}

// Modal for listing and editing all variables in the document
class ListVariablesModal extends Modal {
    constructor(app, plugin, variables, frontmatter, editor, view) {
        super(app);
        this.plugin = plugin;
        this.variables = variables;
        this.frontmatter = frontmatter;
        this.editor = editor;
        this.view = view;
        this.inputs = {}; // varName -> inputEl
        this.originalValues = {}; // Track original values for change detection
        this.addToFrontmatter = {}; // varName -> boolean (for selecting blank variables to add)
        this.checkboxes = {}; // varName -> checkboxEl (for select all/none functionality)
    }

    onOpen() {
        const { contentEl } = this;
        this.modalEl.addClass('yaml-var-list-modal');

        // Header
        const header = contentEl.createEl('div', { cls: 'yaml-var-list-header' });
        header.createEl('h2', { text: 'Document Variables' });

        // Summary stats
        const stats = this.getVariableStats();
        const statsEl = header.createEl('div', { cls: 'yaml-var-stats' });
        // Build stats using safe DOM methods
        const totalSpan = statsEl.createEl('span', { cls: 'stat-total' });
        totalSpan.textContent = `${stats.total} variables`;
        statsEl.appendText(' · ');
        const existsSpan = statsEl.createEl('span', { cls: 'stat-exists' });
        existsSpan.textContent = `${stats.exists + stats.frontmatterOnly} set`;
        if (stats.hasDefault > 0) {
            statsEl.appendText(' · ');
            const defaultSpan = statsEl.createEl('span', { cls: 'stat-default' });
            defaultSpan.textContent = `${stats.hasDefault} with defaults`;
        }
        if (stats.missing > 0) {
            statsEl.appendText(' · ');
            const missingSpan = statsEl.createEl('span', { cls: 'stat-missing' });
            missingSpan.textContent = `${stats.missing} missing`;
        }

        // Select All / Select None buttons for blank variables
        if (stats.missing > 0 || stats.hasDefault > 0) {
            const actionsEl = header.createEl('div', { cls: 'yaml-var-header-actions' });

            const selectAllBtn = actionsEl.createEl('button', { text: 'Select all', cls: 'yaml-var-select-btn' });
            selectAllBtn.addEventListener('click', () => this.selectAllBlank(true));

            const selectNoneBtn = actionsEl.createEl('button', { text: 'Select none', cls: 'yaml-var-select-btn' });
            selectNoneBtn.addEventListener('click', () => this.selectAllBlank(false));
        }

        // Scrollable container for variables
        const scrollContainer = contentEl.createEl('div', { cls: 'yaml-var-list-scroll' });
        scrollContainer.style.maxHeight = '60vh';
        scrollContainer.style.overflowY = 'auto';
        scrollContainer.style.padding = '0.5em 0';

        // Group variables by status for better organization
        const grouped = this.groupVariablesByStatus();

        // Render missing first (most important)
        if (grouped.missing.length > 0) {
            this.renderVariableGroup(scrollContainer, 'Missing Variables', grouped.missing, 'missing');
        }

        // Then variables with defaults
        if (grouped.hasDefault.length > 0) {
            this.renderVariableGroup(scrollContainer, 'Variables with Defaults', grouped.hasDefault, 'has-default');
        }

        // Variables with values and placeholders in document
        if (grouped.exists.length > 0) {
            this.renderVariableGroup(scrollContainer, 'Set Variables', grouped.exists, 'exists');
        }

        // Frontmatter-only variables (no placeholders remaining in document)
        if (grouped.frontmatterOnly.length > 0) {
            this.renderVariableGroup(scrollContainer, 'Frontmatter Only (no placeholders)', grouped.frontmatterOnly, 'frontmatter-only');
        }

        // Empty state
        if (this.variables.length === 0) {
            scrollContainer.createEl('div', {
                text: 'No variables found in this document.',
                cls: 'yaml-var-empty-state'
            });
        }

        // Footer with buttons
        const footer = contentEl.createEl('div', { cls: 'yaml-var-list-footer' });

        const buttonDiv = footer.createEl('div', { cls: 'modal-button-container' });

        const cancelBtn = buttonDiv.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const saveBtn = buttonDiv.createEl('button', { text: 'Save Changes', cls: 'mod-cta' });
        saveBtn.addEventListener('click', () => this.saveAll());
    }

    getVariableStats() {
        const stats = { total: 0, exists: 0, hasDefault: 0, missing: 0, frontmatterOnly: 0 };
        const seen = new Set();

        for (const v of this.variables) {
            if (seen.has(v.name)) continue;
            seen.add(v.name);
            stats.total++;
            if (v.status === 'exists') stats.exists++;
            else if (v.status === 'has-default') stats.hasDefault++;
            else if (v.status === 'frontmatter-only') stats.frontmatterOnly++;
            else stats.missing++;
        }
        return stats;
    }

    groupVariablesByStatus() {
        const grouped = { missing: [], hasDefault: [], exists: [], frontmatterOnly: [] };
        const seen = new Set();

        for (const v of this.variables) {
            if (seen.has(v.name)) continue;
            seen.add(v.name);

            if (v.status === 'missing') grouped.missing.push(v);
            else if (v.status === 'has-default') grouped.hasDefault.push(v);
            else if (v.status === 'frontmatter-only') grouped.frontmatterOnly.push(v);
            else grouped.exists.push(v);
        }
        return grouped;
    }

    selectAllBlank(select) {
        for (const [varName, checkbox] of Object.entries(this.checkboxes)) {
            checkbox.checked = select;
            this.addToFrontmatter[varName] = select;
            const row = checkbox.closest('.yaml-var-row');
            if (select) {
                row?.addClass('yaml-var-row-selected');
            } else {
                row?.removeClass('yaml-var-row-selected');
            }
        }
    }

    renderVariableGroup(container, title, variables, statusClass) {
        const group = container.createEl('div', { cls: 'yaml-var-group' });
        group.createEl('h4', { text: title, cls: `yaml-var-group-title yaml-var-${statusClass}` });

        for (const v of variables) {
            this.renderVariableRow(group, v, statusClass);
        }
    }

    renderVariableRow(container, variable, statusClass) {
        const row = container.createEl('div', { cls: `yaml-var-row yaml-var-row-${statusClass}` });

        // Status indicator
        const indicator = row.createEl('span', { cls: `yaml-var-indicator yaml-var-indicator-${statusClass}` });
        if (statusClass === 'exists' || statusClass === 'frontmatter-only') {
            indicator.textContent = '●';
            indicator.title = statusClass === 'frontmatter-only'
                ? 'Value set (no placeholder in document)'
                : 'Value set';
        } else if (statusClass === 'has-default') {
            indicator.textContent = '◐';
            indicator.title = 'Has default value';
        } else {
            indicator.textContent = '○';
            indicator.title = 'Missing value';
        }

        // Checkbox for selecting blank variables to add to frontmatter
        if (statusClass === 'missing' || statusClass === 'has-default') {
            const checkboxWrapper = row.createEl('span', { cls: 'yaml-var-checkbox-wrapper' });
            const checkbox = checkboxWrapper.createEl('input', { type: 'checkbox', cls: 'yaml-var-add-checkbox' });
            checkbox.title = 'Add to frontmatter (even if blank)';
            this.addToFrontmatter[variable.name] = false;
            this.checkboxes[variable.name] = checkbox;

            checkbox.addEventListener('change', () => {
                this.addToFrontmatter[variable.name] = checkbox.checked;
                if (checkbox.checked) {
                    row.addClass('yaml-var-row-selected');
                } else {
                    row.removeClass('yaml-var-row-selected');
                }
            });
        }

        // Variable name
        const nameEl = row.createEl('span', { cls: 'yaml-var-name' });
        nameEl.textContent = variable.name;

        // Default value hint (if applicable)
        if (variable.defaultValue !== undefined) {
            const defaultHint = row.createEl('span', { cls: 'yaml-var-default-hint' });
            defaultHint.textContent = `(default: ${variable.defaultValue})`;
        }

        // Input field
        const inputWrapper = row.createEl('div', { cls: 'yaml-var-input-wrapper' });
        const input = inputWrapper.createEl('input', {
            type: 'text',
            cls: 'yaml-var-list-input'
        });

        // Set current value
        const currentValue = variable.value !== undefined && variable.value !== null
            ? String(variable.value)
            : '';
        input.value = currentValue;
        input.placeholder = variable.defaultValue !== undefined
            ? `Default: ${variable.defaultValue}`
            : 'Enter value...';

        // Track original value
        this.originalValues[variable.name] = currentValue;
        this.inputs[variable.name] = input;

        // Highlight input if value changes
        input.addEventListener('input', () => {
            if (input.value !== this.originalValues[variable.name]) {
                input.addClass('yaml-var-input-changed');
            } else {
                input.removeClass('yaml-var-input-changed');
            }
        });

        // Navigate to variable on click of name (only if there's a position in the document)
        if (variable.position) {
            nameEl.style.cursor = 'pointer';
            nameEl.addEventListener('click', () => {
                // Close modal if setting enabled (default: true)
                if (this.plugin.settings.closeModalOnNavigate) {
                    this.close();
                }
                // Navigate to the first occurrence of this variable
                const pos = { line: variable.position.line, ch: variable.position.start };
                this.editor.setCursor(pos);
                this.editor.scrollIntoView({ from: pos, to: pos }, 100);
            });
        }
    }

    saveAll() {
        // Collect all changed values and selected blank variables
        const changes = {};
        let changeCount = 0;

        for (const [varName, input] of Object.entries(this.inputs)) {
            const newValue = input.value;
            const originalValue = this.originalValues[varName];

            // Check if value changed (typed something)
            const valueChanged = newValue !== originalValue;
            // Check if blank variable was selected to be added to frontmatter
            const isBlankAndSelected = newValue === '' && this.addToFrontmatter[varName] === true;

            // Save if value changed OR if blank and selected
            if (valueChanged || isBlankAndSelected) {
                changes[varName] = newValue;
                changeCount++;
            }
        }

        if (changeCount === 0) {
            this.close();
            this.plugin.notify('No changes to save', 'info');
            return;
        }

        // Apply all changes to frontmatter
        this.applyChangesToFrontmatter(changes);
        this.close();
        this.plugin.notify(`Updated ${changeCount} variable(s)`);
    }

    applyChangesToFrontmatter(changes) {
        const currentContent = this.editor.getValue();

        // Check if frontmatter structure changed while modal was open
        const currentFrontmatter = this.plugin.parseFrontmatterFromContent(currentContent);
        const originalKeys = Object.keys(this.frontmatter).sort().join(',');
        const currentKeys = Object.keys(currentFrontmatter).sort().join(',');

        // If keys changed, abort the save to prevent data corruption
        if (originalKeys !== currentKeys) {
            this.plugin.notify('Document changed while editing. Please close and reopen to refresh.', 'error');
            return; // Abort the save
        }

        const hasFrontmatter = currentContent.startsWith('---');
        let frontmatter = hasFrontmatter
            ? this.plugin.parseFrontmatterFromContent(currentContent)
            : {};

        // Apply all changes
        for (const [varName, value] of Object.entries(changes)) {
            this.plugin.setNestedValue(frontmatter, varName, value);
        }

        // Stringify and update - wrap in try/catch for safety
        let newFmContent;
        try {
            newFmContent = stringifyYaml(frontmatter);
        } catch (e) {
            this.plugin.notify('Failed to save: invalid YAML structure', 'error');
            console.error('YAML stringify error:', e);
            return;
        }

        const newFmBlock = `---\n${newFmContent}---\n`;

        if (hasFrontmatter) {
            // Recalculate frontmatter end from CURRENT content (not stale position)
            const fmEnd = this.plugin.findFrontmatterEnd(currentContent);
            const endPos = this.editor.offsetToPos(fmEnd);
            this.editor.replaceRange(newFmBlock, { line: 0, ch: 0 }, endPos);
        } else {
            this.editor.replaceRange(newFmBlock, { line: 0, ch: 0 });
        }
    }

    onClose() {
        this.contentEl.empty();
        // Clear references to allow garbage collection
        this.plugin = null;
        this.variables = null;
        this.frontmatter = null;
        this.editor = null;
        this.view = null;
        this.inputs = null;
        this.originalValues = null;
        this.addToFrontmatter = null;
        this.checkboxes = null;
    }
}

class YAMLVariableTemplaterPlugin extends Plugin {
    async onload() {
        await this.loadSettings();
        this.debug('plugin loading');

        // Add ribbon icon (button in left sidebar)
        this.updateRibbonIcon();

        // Initialize highlight color effect for CM6 state management
        this.updateColorsEffect = StateEffect.define();
        this._highlightColorVersion = 0;
        this.updateHighlightStyles();

        // Watch for theme changes to update highlight colors
        this.themeObserver = new MutationObserver(() => {
            this.updateHighlightStyles();
        });
        this.themeObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        });

        // Register syntax highlighting extension
        if (this.settings.highlightVariables) {
            this.highlightExtension = this.createHighlightExtension();
            this.registerEditorExtension(this.highlightExtension);
        }
        
        // Command: Replace variables in current selection
        this.addCommand({
            id: 'replace-variables-selection',
            name: 'Replace variables in selection',
            editorCallback: (editor, view) => {
                this.replaceInSelection(editor, view);
            }
        });
        
        // Command: Replace all variables in document
        this.addCommand({
            id: 'replace-variables-document',
            name: 'Replace all variables in document',
            editorCallback: (editor, view) => {
                this.replaceInDocument(editor, view);
            }
        });

        // Command: Replace all variables in document and filename
        this.addCommand({
            id: 'replace-variables-document-and-filename',
            name: 'Replace all variables in document and filename',
            editorCallback: (editor, view) => {
                this.replaceInDocumentAndFilename(editor, view);
            }
        });

        // Command: Copy current line with variables replaced
        this.addCommand({
            id: 'copy-line-replaced',
            name: 'Copy current line with variables replaced',
            editorCallback: (editor, view) => {
                this.copyLineReplaced(editor, view);
            }
        });
        
        // Command: Copy selection with variables replaced
        this.addCommand({
            id: 'copy-selection-replaced',
            name: 'Copy selection with variables replaced',
            editorCallback: (editor, view) => {
                this.copySelectionReplaced(editor, view);
            }
        });
        
        // Command: Copy entire document with variables replaced
        this.addCommand({
            id: 'copy-document-replaced',
            name: 'Copy entire document with variables replaced',
            editorCallback: (editor, view) => {
                this.copyDocumentReplaced(editor, view);
            }
        });

        // Command: Rename file with variables replaced
        this.addCommand({
            id: 'rename-file-replaced',
            name: 'Rename file with variables replaced',
            editorCallback: (editor, view) => {
                this.renameFileWithVariables(editor, view);
            }
        });

        // Command: List all variables in document
        this.addCommand({
            id: 'list-variables',
            name: 'List all variables in document',
            editorCallback: (editor, view) => {
                this.listAllVariables(editor, view);
            }
        });

        // Add settings tab
        this.addSettingTab(new YAMLVariableTemplaterSettingTab(this.app, this));

        // Capture mouse position for context menu (needed to detect which variable was clicked)
        this.registerDomEvent(document, 'contextmenu', (evt) => {
            this.lastContextMenuEvent = { x: evt.clientX, y: evt.clientY };
            this.debug('contextmenu captured at', evt.clientX, evt.clientY);
        });

        // Register context menu for setting variable values
        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu, editor, view) => {
                this.debug('editor-menu event fired');
                this.handleEditorMenu(menu, editor, view);
            })
        );
        this.debug('context menu handler registered');
    }

    onunload() {
        this.debug('plugin unloading');

        // Clean up ribbon icon
        if (this.ribbonIcon) {
            this.ribbonIcon.remove();
            this.ribbonIcon = null;
        }

        // Clean up theme observer
        if (this.themeObserver) {
            this.themeObserver.disconnect();
            this.themeObserver = null;
        }

        // Clean up CSS custom properties
        const root = document.documentElement;
        root.style.removeProperty('--yaml-var-exists-color');
        root.style.removeProperty('--yaml-var-missing-color');
        root.style.removeProperty('--yaml-var-default-color');

        // Clear caches
        this._patternCache = null;
        this._highlightColorVersion = null;
    }
    
    async loadSettings() {
        const savedData = await this.loadData() || {};
        this.settings = Object.assign({}, DEFAULT_SETTINGS, savedData);

        // Validate critical settings types
        if (typeof this.settings.openDelimiter !== 'string' || !this.settings.openDelimiter) {
            this.settings.openDelimiter = DEFAULT_SETTINGS.openDelimiter;
        }
        if (typeof this.settings.closeDelimiter !== 'string' || !this.settings.closeDelimiter) {
            this.settings.closeDelimiter = DEFAULT_SETTINGS.closeDelimiter;
        }
        if (typeof this.settings.defaultSeparator !== 'string' || !this.settings.defaultSeparator) {
            this.settings.defaultSeparator = DEFAULT_SETTINGS.defaultSeparator;
        }
        if (typeof this.settings.highlightVariables !== 'boolean') {
            this.settings.highlightVariables = DEFAULT_SETTINGS.highlightVariables;
        }
        if (typeof this.settings.showRibbonIcon !== 'boolean') {
            this.settings.showRibbonIcon = DEFAULT_SETTINGS.showRibbonIcon;
        }
        if (typeof this.settings.supportNestedProperties !== 'boolean') {
            this.settings.supportNestedProperties = DEFAULT_SETTINGS.supportNestedProperties;
        }
        if (typeof this.settings.caseInsensitive !== 'boolean') {
            this.settings.caseInsensitive = DEFAULT_SETTINGS.caseInsensitive;
        }

        // Ensure actionColors is properly merged (not replaced)
        this.settings.actionColors = Object.assign(
            {},
            DEFAULT_ACTION_COLORS,
            savedData.actionColors || {}
        );
        // Ensure highlightColors is properly merged (not replaced)
        this.settings.highlightColors = Object.assign(
            {},
            { exists: '', missing: '', hasDefault: '' },
            savedData.highlightColors || {}
        );
    }
    
    async saveSettings() {
        await this.saveData(this.settings);
    }

    // Show notification based on notification level setting
    // type: 'success' | 'error' | 'info'
    notify(message, type = 'success') {
        const level = this.settings.notificationLevel;

        // Always show errors unless completely silent
        if (type === 'error' && level !== 'none') {
            new Notice(message);
            return;
        }

        // Show success/info only if level is 'all'
        if (level === 'all') {
            new Notice(message);
        }
    }

    // Debug logging (only outputs when debugLogging setting is enabled)
    debug(...args) {
        if (this.settings?.debugLogging) {
            console.log('YAML Templater:', ...args);
        }
    }

    // Handle right-click context menu on editor
    handleEditorMenu(menu, editor, view) {
        // Check if context menu is enabled
        if (!this.settings.enableContextMenu) return;

        // Obsidian moves the cursor to the right-click location before firing editor-menu,
        // so we use cursor position as the primary method (most reliable).
        // Mouse coordinate detection is used as a fallback/verification.
        let lineNum, ch;

        // Primary method: use cursor position (Obsidian already set it to click location)
        const cursor = editor.getCursor();
        lineNum = cursor.line;
        ch = cursor.ch;
        this.debug('using cursor position, line', lineNum, 'ch', ch);

        // Optional: try mouse coords with corrected coordinate conversion
        // This can be more accurate if Obsidian didn't move the cursor (edge cases)
        try {
            const editorView = editor.cm;
            if (this.lastContextMenuEvent && editorView && typeof editorView.posAtCoords === 'function') {
                // Convert viewport coords to editor-relative coords
                const editorRect = editorView.dom.getBoundingClientRect();
                const editorCoords = {
                    x: this.lastContextMenuEvent.x - editorRect.left,
                    y: this.lastContextMenuEvent.y - editorRect.top
                };
                const pos = editorView.posAtCoords(editorCoords);
                this.debug('mouse coords', this.lastContextMenuEvent,
                    '-> editor-relative', editorCoords, '-> pos', pos);

                if (pos !== null && editorView.state && editorView.state.doc) {
                    const cmLine = editorView.state.doc.lineAt(pos);
                    const mouseLine = cmLine.number - 1; // CM6 uses 1-based, Obsidian uses 0-based
                    const mouseCh = pos - cmLine.from;
                    this.debug('mouse position resolved to line', mouseLine, 'ch', mouseCh);

                    // Use mouse position if it differs from cursor (more accurate click detection)
                    if (mouseLine !== lineNum || mouseCh !== ch) {
                        this.debug('using mouse position instead of cursor');
                        lineNum = mouseLine;
                        ch = mouseCh;
                    }
                }
            }
        } catch (err) {
            this.debug('Error in mouse coord detection (using cursor):', err);
        }

        const line = editor.getLine(lineNum);
        if (line === undefined || line === null) {
            this.debug('no line content at line', lineNum);
            return;
        }
        this.debug('checking line', lineNum, 'ch', ch, 'content:', line);

        // Find variable at click position
        const variable = this.getVariableAtPosition(line, ch);
        this.debug('variable found:', variable);
        if (!variable) return;

        const file = view.file;
        if (!file) {
            this.debug('no file in view');
            return;
        }

        const content = editor.getValue();
        const frontmatter = this.getFrontmatter(file, content);
        const currentValue = this.getNestedValue(frontmatter, variable.name);

        this.debug('frontmatter parsed:', frontmatter);
        this.debug('looking up variable:', variable.name, '-> currentValue:', currentValue);

        // Check if there's a meaningful value (not undefined, null, or empty string)
        const hasValue = currentValue !== undefined && currentValue !== null && currentValue !== '';
        const menuTitle = hasValue
            ? `Edit "${variable.name}" (${currentValue})`
            : `Set "${variable.name}" value`;

        menu.addItem((item) => {
            item.setTitle(menuTitle)
                .setIcon('pencil')
                .onClick(() => {
                    // Convert to string, but treat null/undefined as empty
                    const valueForModal = (currentValue !== undefined && currentValue !== null)
                        ? String(currentValue)
                        : '';
                    new SetVariableModal(
                        this.app,
                        variable.name,
                        valueForModal,
                        (newValue) => this.setVariableInFrontmatter(editor, variable.name, newValue)
                    ).open();
                });
        });
    }

    // Find if cursor is inside a {{variable}} pattern
    getVariableAtPosition(line, ch) {
        const pattern = this.getVariablePattern();
        pattern.lastIndex = 0; // Reset for loop reuse
        this.debug('getVariableAtPosition - line:', JSON.stringify(line), 'ch:', ch);
        this.debug('pattern:', pattern.source, 'delimiters:', this.settings.openDelimiter, this.settings.closeDelimiter);

        let match;
        let matchCount = 0;
        while ((match = pattern.exec(line)) !== null) {
            matchCount++;
            const start = match.index;
            const end = start + match[0].length;
            this.debug('found match', matchCount, ':', match[0], 'at', start, '-', end, ', ch is', ch);
            if (ch >= start && ch < end) {
                this.debug('ch is within match bounds, returning variable:', match[1].trim());
                return {
                    name: match[1].trim(),
                    start,
                    end,
                    fullMatch: match[0]
                };
            }
        }
        this.debug('no match found at cursor position (total matches on line:', matchCount, ')');
        return null;
    }

    // Scan entire document for all variables and their status
    // Also includes frontmatter properties that don't have corresponding {{patterns}} in the document
    scanDocumentVariables(editor, file) {
        const content = editor.getValue();
        const frontmatter = this.getFrontmatter(file, content);
        const frontmatterEnd = this.findFrontmatterEnd(content);
        const bodyPart = content.slice(frontmatterEnd);

        const pattern = this.getVariablePattern();
        pattern.lastIndex = 0; // Reset for loop reuse
        const variables = [];
        const seenVarNames = new Set(); // Track variables found in document body
        let match;

        // Calculate line offset for frontmatter
        const frontmatterLines = content.slice(0, frontmatterEnd).split('\n').length - 1;

        // First, scan for {{variable}} patterns in the document body
        while ((match = pattern.exec(bodyPart)) !== null) {
            const varName = match[1].trim();
            const defaultValue = match[2];
            const value = this.getNestedValue(frontmatter, varName);

            seenVarNames.add(varName);

            // Determine status (empty strings are treated as missing)
            let status;
            if (value !== undefined && value !== null && value !== '') {
                status = 'exists';
            } else if (defaultValue !== undefined) {
                status = 'has-default';
            } else {
                status = 'missing';
            }

            // Calculate line number from offset in bodyPart
            const textBeforeMatch = bodyPart.slice(0, match.index);
            const linesBeforeMatch = textBeforeMatch.split('\n').length - 1;
            const lineNum = frontmatterLines + linesBeforeMatch;

            // Calculate character position within line
            const lastNewline = textBeforeMatch.lastIndexOf('\n');
            const charPos = lastNewline === -1 ? match.index : match.index - lastNewline - 1;

            variables.push({
                name: varName,
                status: status,
                value: value,
                defaultValue: defaultValue,
                fullMatch: match[0],
                position: {
                    line: lineNum,
                    start: charPos,
                    end: charPos + match[0].length
                }
            });
        }

        // Then, add frontmatter properties that don't have corresponding {{patterns}}
        // These are "orphan" properties - values that were filled in but no longer have placeholders
        if (this.settings.showFrontmatterOnlyVariables) {
            this.collectFrontmatterProperties(frontmatter, '', seenVarNames, variables);
        }

        return variables;
    }

    // Recursively collect frontmatter properties (handles nested objects)
    collectFrontmatterProperties(obj, prefix, seenVarNames, variables, visited = new WeakSet()) {
        if (!obj || typeof obj !== 'object') return;

        // Guard against circular references
        if (visited.has(obj)) return;
        visited.add(obj);

        for (const key of Object.keys(obj)) {
            // Skip Obsidian metadata keys
            if (key === 'position' || key === 'cssclasses' || key === 'tags' || key === 'aliases') continue;

            // Skip forbidden keys (prototype pollution protection)
            if (YAMLVariableTemplaterPlugin.FORBIDDEN_KEYS.has(key.toLowerCase())) continue;

            const fullPath = prefix ? `${prefix}.${key}` : key;
            const value = obj[key];

            // If it's an object (but not array), recurse into it
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                this.collectFrontmatterProperties(value, fullPath, seenVarNames, variables, visited);
            } else {
                // Only add if not already seen as a {{pattern}} in document
                if (!seenVarNames.has(fullPath)) {
                    variables.push({
                        name: fullPath,
                        status: 'frontmatter-only', // New status for properties without placeholders
                        value: value,
                        defaultValue: undefined,
                        fullMatch: null,
                        position: null, // No position since it's only in frontmatter
                        frontmatterOnly: true
                    });
                }
            }
        }
    }

    // List all variables in the document with a modal
    listAllVariables(editor, view) {
        const file = view.file;
        if (!file) {
            this.notify('No active file', 'error');
            return;
        }

        const content = editor.getValue();
        const frontmatter = this.getFrontmatter(file, content);
        const variables = this.scanDocumentVariables(editor, file);

        new ListVariablesModal(
            this.app,
            this,
            variables,
            frontmatter,
            editor,
            view
        ).open();
    }

    // Set a value at a nested path in an object (opposite of getNestedValue)
    setNestedValue(obj, path, value) {
        if (!this.settings.supportNestedProperties) {
            // Simple mode - direct key assignment
            if (YAMLVariableTemplaterPlugin.FORBIDDEN_KEYS.has(path.toLowerCase())) {
                return obj;
            }
            // Use findKey for case-insensitive matching
            const foundKey = this.findKey(obj, path);
            obj[foundKey || path] = value;
            return obj;
        }

        const keys = path.split('.');
        let current = obj;

        for (let i = 0; i < keys.length - 1; i++) {
            let key = keys[i];

            // Guard against prototype pollution
            if (YAMLVariableTemplaterPlugin.FORBIDDEN_KEYS.has(key.toLowerCase())) {
                return obj;
            }

            // Handle array index notation like "items[0]"
            const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
            if (arrayMatch) {
                const propName = arrayMatch[1];
                const index = parseInt(arrayMatch[2]);

                if (YAMLVariableTemplaterPlugin.FORBIDDEN_KEYS.has(propName.toLowerCase())) {
                    return obj;
                }

                // Find the actual key (case-insensitive if enabled)
                const foundPropKey = this.findKey(current, propName);
                const actualPropKey = foundPropKey || propName;

                // Ensure array exists
                if (!(actualPropKey in current) || !Array.isArray(current[actualPropKey])) {
                    current[actualPropKey] = [];
                }

                // Bounds check to prevent unbounded array creation
                if (index > YAMLVariableTemplaterPlugin.MAX_ARRAY_INDEX) {
                    console.warn(`Array index ${index} exceeds maximum allowed (${YAMLVariableTemplaterPlugin.MAX_ARRAY_INDEX})`);
                    return obj;
                }

                // Ensure array is long enough
                while (current[actualPropKey].length <= index) {
                    current[actualPropKey].push({});
                }

                // Ensure element is an object if we need to traverse deeper
                if (current[actualPropKey][index] === null || typeof current[actualPropKey][index] !== 'object') {
                    current[actualPropKey][index] = {};
                }

                current = current[actualPropKey][index];
            } else {
                // Find the actual key (case-insensitive if enabled)
                const foundKey = this.findKey(current, key);

                if (foundKey) {
                    // Key exists - use it, ensure it's an object
                    if (typeof current[foundKey] !== 'object' || current[foundKey] === null) {
                        current[foundKey] = {};
                    }
                    current = current[foundKey];
                } else {
                    // Key doesn't exist - create it
                    current[key] = {};
                    current = current[key];
                }
            }
        }

        // Handle the final key
        const finalKey = keys[keys.length - 1];

        // Guard against prototype pollution
        if (YAMLVariableTemplaterPlugin.FORBIDDEN_KEYS.has(finalKey.toLowerCase())) {
            return obj;
        }

        // Check if final key has array notation
        const finalArrayMatch = finalKey.match(/^(\w+)\[(\d+)\]$/);
        if (finalArrayMatch) {
            const propName = finalArrayMatch[1];
            const index = parseInt(finalArrayMatch[2]);

            if (YAMLVariableTemplaterPlugin.FORBIDDEN_KEYS.has(propName.toLowerCase())) {
                return obj;
            }

            // Find actual key (case-insensitive if enabled)
            const foundPropKey = this.findKey(current, propName);
            const actualPropKey = foundPropKey || propName;

            // Ensure array exists
            if (!(actualPropKey in current) || !Array.isArray(current[actualPropKey])) {
                current[actualPropKey] = [];
            }

            // Bounds check to prevent unbounded array creation
            if (index > YAMLVariableTemplaterPlugin.MAX_ARRAY_INDEX) {
                console.warn(`Array index ${index} exceeds maximum allowed (${YAMLVariableTemplaterPlugin.MAX_ARRAY_INDEX})`);
                return obj;
            }

            // Ensure array is long enough
            while (current[actualPropKey].length <= index) {
                current[actualPropKey].push(null);
            }

            current[actualPropKey][index] = value;
        } else {
            // Find actual key for case-insensitive matching
            const foundFinalKey = this.findKey(current, finalKey);
            current[foundFinalKey || finalKey] = value;
        }

        return obj;
    }

    // Update or create frontmatter with a variable value
    setVariableInFrontmatter(editor, varName, value) {
        this.debug('setVariableInFrontmatter called with varName:', varName, 'value:', value);

        const content = editor.getValue();
        const hasFrontmatter = content.startsWith('---');
        this.debug('hasFrontmatter:', hasFrontmatter);

        let frontmatter = {};
        let fmEnd = 0;

        if (hasFrontmatter) {
            fmEnd = this.findFrontmatterEnd(content);
            frontmatter = this.parseFrontmatterFromContent(content);
            this.debug('existing frontmatter parsed:', frontmatter, 'fmEnd:', fmEnd);
        }

        // Set the value (handles nested paths if enabled)
        this.setNestedValue(frontmatter, varName, value);
        this.debug('frontmatter after setNestedValue:', frontmatter);

        // Stringify the updated frontmatter
        let newFmContent;
        try {
            newFmContent = stringifyYaml(frontmatter);
        } catch (e) {
            this.notify('Failed to update frontmatter: invalid value', 'error');
            console.error('YAML stringify error:', e);
            return;
        }
        const newFmBlock = `---\n${newFmContent}---\n`;
        this.debug('newFmBlock:', newFmBlock);

        if (hasFrontmatter) {
            // Replace existing frontmatter
            const endPos = editor.offsetToPos(fmEnd);
            this.debug('replacing frontmatter, endPos:', endPos);
            editor.replaceRange(
                newFmBlock,
                { line: 0, ch: 0 },
                endPos
            );
        } else {
            // Insert new frontmatter at start
            this.debug('inserting new frontmatter');
            editor.replaceRange(newFmBlock, { line: 0, ch: 0 });
        }

        this.notify(`Set ${varName} = ${value}`);
    }

    // Update ribbon icon visibility based on settings
    updateRibbonIcon() {
        // Remove existing icon if present
        if (this.ribbonIcon) {
            this.ribbonIcon.remove();
            this.ribbonIcon = null;
        }

        // Add new icon if enabled
        if (this.settings.showRibbonIcon) {
            const actionData = RIBBON_ACTIONS[this.settings.ribbonAction];
            const tooltip = this.settings.ribbonMode === 'menu'
                ? 'YAML Variable Templater'
                : (actionData?.name || 'Replace YAML variables');

            this.ribbonIcon = this.addRibbonIcon('replace', tooltip, (evt) => {
                if (this.settings.ribbonMode === 'menu') {
                    this.showRibbonMenu(evt);
                } else {
                    this.executeRibbonAction();
                }
            });
        }
    }

    // Show menu with all available actions
    showRibbonMenu(evt) {
        const menu = new Menu();

        for (const [actionId, actionData] of Object.entries(RIBBON_ACTIONS)) {
            menu.addItem((item) => {
                item.setTitle(actionData.name)
                    .setIcon(actionData.icon)
                    .onClick(() => {
                        // Temporarily set the action and execute
                        const originalAction = this.settings.ribbonAction;
                        this.settings.ribbonAction = actionId;
                        this.executeRibbonAction();
                        this.settings.ribbonAction = originalAction;
                    });

                // Apply custom color if set
                const color = this.settings.actionColors?.[actionId];
                if (color) {
                    // Access the DOM element and apply color
                    setTimeout(() => {
                        const menuItem = item.dom;
                        if (menuItem) {
                            menuItem.style.color = color;
                            // Also color the icon
                            const icon = menuItem.querySelector('.menu-item-icon');
                            if (icon) icon.style.color = color;
                        }
                    }, 0);
                }
            });
        }

        menu.showAtMouseEvent(evt);
    }

    // Create the CodeMirror 6 extension for variable highlighting
    createHighlightExtension() {
        const plugin = this;

        // Create a StateField to track color version (for proper CM6 reactivity)
        const colorVersionField = StateField.define({
            create: () => 0,
            update: (value, tr) => {
                for (let e of tr.effects) {
                    if (e.is(plugin.updateColorsEffect)) return e.value;
                }
                return value;
            }
        });

        const decorationPlugin = ViewPlugin.fromClass(class {
            constructor(view) {
                this.decorations = this.buildDecorations(view);
            }

            update(update) {
                // Check if color effect was dispatched in any transaction
                let colorChanged = false;
                for (let tr of update.transactions) {
                    for (let effect of tr.effects) {
                        if (effect.is(plugin.updateColorsEffect)) {
                            colorChanged = true;
                            break;
                        }
                    }
                    if (colorChanged) break;
                }

                // Rebuild if document changed, viewport changed, or colors changed
                if (update.docChanged || update.viewportChanged || colorChanged) {
                    this.decorations = this.buildDecorations(update.view);
                }
            }

            buildDecorations(view) {
                if (!plugin.settings.highlightVariables) {
                    return Decoration.none;
                }

                const builder = new RangeSetBuilder();
                const content = view.state.doc.toString();

                // Find the end of frontmatter to avoid highlighting in YAML block
                const frontmatterEnd = plugin.findFrontmatterEnd(content);

                // Cache frontmatter parsing (only re-parse when frontmatter changes)
                const fmContent = content.slice(0, frontmatterEnd);
                let frontmatter;
                if (this._fmCache?.content === fmContent) {
                    frontmatter = this._fmCache.parsed;
                } else {
                    frontmatter = plugin.parseFrontmatterFromContent(content);
                    this._fmCache = { content: fmContent, parsed: frontmatter };
                }

                // Use cached pattern for performance
                const pattern = plugin.getVariablePattern();
                pattern.lastIndex = 0; // Reset for loop reuse

                // Check if dark theme
                const isDark = document.body.classList.contains('theme-dark');

                // Get colors from settings (or defaults)
                const existsColor = plugin.getHighlightColor('exists', isDark);
                const missingColor = plugin.getHighlightColor('missing', isDark);
                const defaultColor = plugin.getHighlightColor('hasDefault', isDark);

                // Define inline styles for each state (works inside callouts where CSS classes get overridden)
                const styles = {
                    exists: `color: ${existsColor}; background-color: ${plugin.hexToRgba(existsColor, 0.15)}; border-radius: 3px; padding: 0 2px;`,
                    default: `color: ${defaultColor}; background-color: ${plugin.hexToRgba(defaultColor, 0.15)}; border-radius: 3px; padding: 0 2px;`,
                    missing: `color: ${missingColor}; background-color: ${plugin.hexToRgba(missingColor, 0.15)}; border-radius: 3px; padding: 0 2px;`
                };

                let match;
                while ((match = pattern.exec(content)) !== null) {
                    const start = match.index;
                    const end = start + match[0].length;

                    // Skip if inside frontmatter
                    if (start < frontmatterEnd) continue;

                    const varName = match[1].trim();
                    const hasDefault = match[2] !== undefined;
                    const value = plugin.getNestedValue(frontmatter, varName);
                    const exists = value !== undefined && value !== null && value !== '';

                    // Determine the style based on variable status
                    let style;
                    let cssClass;
                    if (exists) {
                        style = styles.exists;
                        cssClass = 'yaml-var-exists';
                    } else if (hasDefault) {
                        style = styles.default;
                        cssClass = 'yaml-var-default';
                    } else {
                        style = styles.missing;
                        cssClass = 'yaml-var-missing';
                    }

                    // Use both inline style (for callouts) and class (for compatibility)
                    builder.add(start, end, Decoration.mark({
                        class: cssClass,
                        attributes: { style: style }
                    }));
                }

                return builder.finish();
            }
        }, {
            decorations: v => v.decorations
        });

        // Return both the StateField (for tracking color version) and the ViewPlugin
        return [colorVersionField, decorationPlugin];
    }

    // Parse frontmatter directly from content string (for highlighting)
    parseFrontmatterFromContent(content) {
        // Handle empty frontmatter: ---\n--- or ---\r\n---
        const emptyMatch = content.match(/^---\r?\n---(?:\r?\n|$)/);
        if (emptyMatch) {
            return {};
        }

        const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (match) {
            try {
                return parseYaml(match[1]) || {};
            } catch (e) {
                return {};
            }
        }
        return {};
    }

    // Get frontmatter from file or editor content
    // If editorContent is provided, parse directly for freshest data
    getFrontmatter(file, editorContent = null) {
        if (!file) return {};

        // If editor content provided, parse directly from it
        if (editorContent) {
            return this.parseFrontmatterFromContent(editorContent);
        }

        // Otherwise use metadata cache
        const cache = this.app.metadataCache.getFileCache(file);
        return cache?.frontmatter || {};
    }
    
    // Dangerous property names that could access prototype chain
    static FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

    // Maximum allowed array index to prevent unbounded array creation
    static MAX_ARRAY_INDEX = 1000;

    // Find a key in an object, optionally case-insensitive
    findKey(obj, key) {
        if (!obj || typeof obj !== 'object') return undefined;

        // Guard against prototype pollution
        if (YAMLVariableTemplaterPlugin.FORBIDDEN_KEYS.has(key.toLowerCase())) {
            return undefined;
        }

        // Try exact match first
        if (key in obj) return key;

        // If case-insensitive, search for matching key
        if (this.settings.caseInsensitive) {
            const lowerKey = key.toLowerCase();
            for (const k of Object.keys(obj)) {
                if (k.toLowerCase() === lowerKey) {
                    return k;
                }
            }
        }

        return undefined;
    }

    // Get nested property value using dot notation
    getNestedValue(obj, path) {
        if (!this.settings.supportNestedProperties) {
            // Simple mode - direct key lookup
            const foundKey = this.findKey(obj, path);
            return foundKey ? obj[foundKey] : undefined;
        }

        const keys = path.split('.');
        let value = obj;

        for (const key of keys) {
            if (value === undefined || value === null) {
                return undefined;
            }

            // Handle array index notation like "items[0]"
            const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
            if (arrayMatch) {
                const propName = arrayMatch[1];
                const foundKey = this.findKey(value, propName);
                if (!foundKey) return undefined;
                value = value[foundKey];
                if (Array.isArray(value)) {
                    value = value[parseInt(arrayMatch[2])];
                } else {
                    return undefined;
                }
            } else {
                const foundKey = this.findKey(value, key);
                if (!foundKey) return undefined;
                value = value[foundKey];
            }
        }

        return value;
    }

    // Convert hex color to rgba with alpha
    hexToRgba(hex, alpha) {
        // Validate hex format
        if (!hex || typeof hex !== 'string' || !hex.match(/^#[0-9A-Fa-f]{6}$/)) {
            // Fallback to a neutral color if invalid
            return `rgba(128, 128, 128, ${alpha})`;
        }
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // Get highlight color for a variable state, respecting user settings
    getHighlightColor(state, isDark) {
        const userColor = this.settings.highlightColors?.[state];
        this.debug(`getHighlightColor: state=${state}, userColor=${userColor}, isDark=${isDark}`);
        if (userColor) return userColor;
        const defaultColor = DEFAULT_HIGHLIGHT_COLORS[state]?.[isDark ? 'dark' : 'light'];
        this.debug(`getHighlightColor: using default=${defaultColor}`);
        return defaultColor;
    }

    // Update CSS custom properties for highlight colors (used by modal)
    // Also triggers editor re-render for inline highlighting
    updateHighlightStyles() {
        const isDark = document.body.classList.contains('theme-dark');
        const root = document.documentElement;

        const existsColor = this.getHighlightColor('exists', isDark);
        const missingColor = this.getHighlightColor('missing', isDark);
        const defaultColor = this.getHighlightColor('hasDefault', isDark);

        root.style.setProperty('--yaml-var-exists-color', existsColor);
        root.style.setProperty('--yaml-var-missing-color', missingColor);
        root.style.setProperty('--yaml-var-default-color', defaultColor);

        // Increment color version for tracking
        this._highlightColorVersion = (this._highlightColorVersion || 0) + 1;

        // Force all markdown views to update their decorations via StateEffect
        this.app.workspace.iterateAllLeaves((leaf) => {
            if (leaf.view instanceof MarkdownView) {
                const editor = leaf.view.editor;
                if (editor?.cm) {
                    // Dispatch color update effect to trigger ViewPlugin rebuild
                    editor.cm.dispatch({
                        effects: this.updateColorsEffect.of(this._highlightColorVersion)
                    });
                }
            }
        });
    }

    // Fallback pattern with safe default delimiters
    _getDefaultPattern() {
        const pattern = /\{\{\s*([\w.\[\]\-]+)\s*(?::\s*(.*?))?\s*\}\}/g;
        pattern.lastIndex = 0;
        return pattern;
    }

    // Build regex pattern based on settings (cached for performance)
    // Captures: group 1 = variable name, group 2 = optional default value (after separator)
    getVariablePattern() {
        // Validate delimiter length to prevent performance issues
        const MAX_DELIMITER_LEN = 10;

        if (this.settings.openDelimiter.length > MAX_DELIMITER_LEN ||
            this.settings.closeDelimiter.length > MAX_DELIMITER_LEN ||
            this.settings.defaultSeparator.length > MAX_DELIMITER_LEN) {
            this.debug('Delimiter too long, using defaults');
            return this._getDefaultPattern();
        }

        const cacheKey = `${this.settings.openDelimiter}|${this.settings.closeDelimiter}|${this.settings.defaultSeparator}`;

        // Return cached pattern if settings haven't changed
        if (this._patternCache?.key === cacheKey) {
            // Reset lastIndex for global regex reuse
            this._patternCache.pattern.lastIndex = 0;
            return this._patternCache.pattern;
        }

        const open = this.escapeRegex(this.settings.openDelimiter);
        const close = this.escapeRegex(this.settings.closeDelimiter);
        const sep = this.escapeRegex(this.settings.defaultSeparator);
        // Pattern: {{varName}} or {{varName:defaultValue}} (separator is configurable)
        // The .*? is non-greedy and stops at the closing delimiter
        // Supports: word chars, dots, brackets, and hyphens in variable names
        const pattern = new RegExp(`${open}\\s*([\\w.\\[\\]\\-]+)\\s*(?:${sep}\\s*(.*?))?\\s*${close}`, 'g');

        this._patternCache = { key: cacheKey, pattern };
        return pattern;
    }
    
    // Escape special regex characters
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    // Replace variables in a string
    // Supports default values with syntax: {{varName:defaultValue}}
    replaceVariables(text, frontmatter) {
        const pattern = this.getVariablePattern();
        pattern.lastIndex = 0; // Reset for loop reuse
        let replacementCount = 0;
        let missingCount = 0;

        const result = text.replace(pattern, (match, varName, defaultValue) => {
            const value = this.getNestedValue(frontmatter, varName.trim());

            // Treat empty strings as missing (don't replace with nothing)
            if (value !== undefined && value !== null && value !== '') {
                replacementCount++;
                // Handle arrays and objects
                if (Array.isArray(value)) {
                    return value.join(this.settings.arrayJoinSeparator || ', ');
                } else if (typeof value === 'object') {
                    try {
                        return JSON.stringify(value);
                    } catch (e) {
                        return '[Complex Object]';
                    }
                }
                return String(value);
            }

            // Variable not found or empty - use default value if provided
            if (defaultValue !== undefined) {
                replacementCount++;
                return defaultValue;
            }

            missingCount++;
            // Preserve original or use missing text based on setting
            return this.settings.preserveOriginalOnMissing ? match : this.settings.missingValueText;
        });

        return { result, replacementCount, missingCount };
    }
    
    // Get active editor and file
    getActiveEditorAndFile() {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) {
            // Try to give a more helpful error message
            const activeLeaf = this.app.workspace.getMostRecentLeaf();
            if (activeLeaf && activeLeaf.view) {
                const viewType = activeLeaf.view.getViewType();
                if (viewType && viewType !== 'empty') {
                    this.notify(`Cannot use on ${viewType} view - open a markdown note in Edit mode`, 'error');
                } else {
                    this.notify('Open a markdown note first', 'error');
                }
            } else {
                this.notify('Open a markdown note first', 'error');
            }
            return null;
        }

        // Check if in reading/preview mode
        const mode = view.getMode ? view.getMode() : null;
        if (mode === 'preview') {
            this.notify('Switch to Edit mode to use this command (click the edit icon or press Ctrl/Cmd+E)', 'error');
            return null;
        }

        return { editor: view.editor, file: view.file };
    }
    
    // Execute the configured ribbon action
    executeRibbonAction() {
        const active = this.getActiveEditorAndFile();
        if (!active) return;
        
        const { editor, file } = active;
        const view = { file };
        
        switch (this.settings.ribbonAction) {
            case 'replace-selection':
                this.replaceInSelection(editor, view);
                break;
            case 'replace-document':
                this.replaceInDocument(editor, view);
                break;
            case 'replace-document-and-filename':
                this.replaceInDocumentAndFilename(editor, view);
                break;
            case 'copy-line-replaced':
                this.copyLineReplaced(editor, view);
                break;
            case 'copy-selection-replaced':
                this.copySelectionReplaced(editor, view);
                break;
            case 'copy-document-replaced':
                this.copyDocumentReplaced(editor, view);
                break;
            case 'rename-file-replaced':
                this.renameFileWithVariables(null, view);
                break;
            case 'list-variables':
                this.listAllVariables(editor, view);
                break;
            default:
                this.copyLineReplaced(editor, view);
        }
    }
    
    // Replace variables in selection
    replaceInSelection(editor, view) {
        const file = view.file;
        if (!file) {
            this.notify('No active file', 'error');
            return;
        }

        const content = editor.getValue();
        const frontmatter = this.getFrontmatter(file, content);
        const selection = editor.getSelection();

        if (!selection) {
            // If no selection, replace in current line
            const cursor = editor.getCursor();
            const line = editor.getLine(cursor.line);
            const { result, replacementCount, missingCount } = this.replaceVariables(line, frontmatter);

            // Skip if nothing to replace
            if (replacementCount === 0 && missingCount === 0) {
                this.notify('No variables found in line', 'info');
                return;
            }

            editor.replaceRange(
                result,
                { line: cursor.line, ch: 0 },
                { line: cursor.line, ch: line.length }
            );
            this.notify(`Replaced ${replacementCount} variable(s)${missingCount > 0 ? `, ${missingCount} not found` : ''}`);
            return;
        }

        const { result, replacementCount, missingCount } = this.replaceVariables(selection, frontmatter);

        // Skip if nothing to replace
        if (replacementCount === 0 && missingCount === 0) {
            this.notify('No variables found in selection', 'info');
            return;
        }

        editor.replaceSelection(result);
        this.notify(`Replaced ${replacementCount} variable(s)${missingCount > 0 ? `, ${missingCount} not found` : ''}`);
    }
    
    // Replace all variables in document
    replaceInDocument(editor, view) {
        const file = view.file;
        if (!file) {
            this.notify('No active file', 'error');
            return;
        }

        const content = editor.getValue();
        const frontmatter = this.getFrontmatter(file, content);

        // Find the end of frontmatter to avoid replacing in YAML
        const frontmatterEnd = this.findFrontmatterEnd(content);
        const bodyPart = content.slice(frontmatterEnd);

        const { result, replacementCount, missingCount } = this.replaceVariables(bodyPart, frontmatter);

        // Skip if nothing to replace
        if (replacementCount === 0 && missingCount === 0) {
            this.notify('No variables found in document', 'info');
            return;
        }

        // Use transaction for atomic undo support
        const cursor = editor.getCursor();
        const scrollInfo = editor.getScrollInfo();

        // Replace only the body part (after frontmatter) for better undo
        const startPos = editor.offsetToPos(frontmatterEnd);
        const lastLine = Math.max(0, editor.lineCount() - 1);
        const lastLineContent = editor.getLine(lastLine);
        const lastCh = lastLineContent ? lastLineContent.length : 0;
        editor.replaceRange(
            result,
            { line: startPos.line, ch: startPos.ch },
            { line: lastLine, ch: lastCh }
        );

        // Restore cursor (clamped to valid range)
        const lineCount = editor.lineCount();
        const newLine = Math.min(cursor.line, Math.max(0, lineCount - 1));
        const newLineContent = editor.getLine(newLine);
        const newLineLength = newLineContent ? newLineContent.length : 0;
        editor.setCursor({ line: newLine, ch: Math.min(cursor.ch, newLineLength) });
        editor.scrollTo(scrollInfo.left, scrollInfo.top);

        this.notify(`Replaced ${replacementCount} variable(s)${missingCount > 0 ? `, ${missingCount} not found` : ''}`);
    }

    // Replace all variables in document and filename
    async replaceInDocumentAndFilename(editor, view) {
        const file = view.file;
        if (!file) {
            this.notify('No active file', 'error');
            return;
        }

        const content = editor.getValue();
        const frontmatter = this.getFrontmatter(file, content);

        // Calculate document replacements first (but don't apply yet)
        const frontmatterEnd = this.findFrontmatterEnd(content);
        const bodyPart = content.slice(frontmatterEnd);
        const docResult = this.replaceVariables(bodyPart, frontmatter);

        // Calculate filename replacements
        const currentName = file.basename;
        const filenameResult = this.replaceVariables(currentName, frontmatter);

        let filenameReplaced = false;
        let newFilename = null;

        // Check if there's anything to do
        const hasDocChanges = docResult.replacementCount > 0 || docResult.missingCount > 0;
        const hasFilenameChanges = filenameResult.replacementCount > 0 && filenameResult.result !== currentName;

        if (!hasDocChanges && !hasFilenameChanges) {
            this.notify('No variables found', 'info');
            return;
        }

        // RENAME FIRST (more likely to fail, ensures atomicity)
        // If rename fails, we abort before modifying the document
        if (hasFilenameChanges) {
            const sanitizedName = this.sanitizeFilename(filenameResult.result);

            if (sanitizedName) {
                const extension = file.extension;
                const parentPath = file.parent ? file.parent.path : '';
                const newPath = parentPath
                    ? `${parentPath}/${sanitizedName}.${extension}`
                    : `${sanitizedName}.${extension}`;

                const existingFile = this.app.vault.getAbstractFileByPath(newPath);
                if (existingFile && existingFile !== file) {
                    this.notify(`Cannot rename: file "${sanitizedName}.${extension}" already exists`, 'error');
                    return; // Abort entire operation to maintain atomicity
                } else {
                    try {
                        await this.app.fileManager.renameFile(file, newPath);
                        filenameReplaced = true;
                        newFilename = sanitizedName;
                    } catch (err) {
                        this.notify('Failed to rename file', 'error');
                        console.error('Rename error:', err);
                        return; // Abort entire operation to maintain atomicity
                    }
                }
            }
        }

        // THEN MODIFY DOCUMENT (only after successful rename or if no rename needed)
        if (hasDocChanges) {
            const cursor = editor.getCursor();
            const scrollInfo = editor.getScrollInfo();

            const startPos = editor.offsetToPos(frontmatterEnd);
            const lastLine = Math.max(0, editor.lineCount() - 1);
            const lastLineContent = editor.getLine(lastLine);
            const lastCh = lastLineContent ? lastLineContent.length : 0;
            editor.replaceRange(
                docResult.result,
                { line: startPos.line, ch: startPos.ch },
                { line: lastLine, ch: lastCh }
            );

            const lineCount = editor.lineCount();
            const newLine = Math.min(cursor.line, Math.max(0, lineCount - 1));
            const newLineContent = editor.getLine(newLine);
            const newLineLength = newLineContent ? newLineContent.length : 0;
            editor.setCursor({ line: newLine, ch: Math.min(cursor.ch, newLineLength) });
            editor.scrollTo(scrollInfo.left, scrollInfo.top);
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
            this.notify(msg);
        }
    }

    // Find the end position of frontmatter
    findFrontmatterEnd(content) {
        // Frontmatter must start with --- at the beginning of the file
        if (!content.startsWith('---')) return 0;

        // Handle empty frontmatter: ---\n--- or ---\r\n---
        const emptyMatch = content.match(/^---\r?\n---(?:\r?\n|$)/);
        if (emptyMatch) {
            return emptyMatch[0].length;
        }

        // Match complete frontmatter block: opening ---, content, closing --- on its own line
        const match = content.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
        if (!match) return 0;

        return match[0].length;
    }

    // Cross-platform clipboard helper (works on mobile and desktop)
    async copyToClipboard(text) {
        try {
            if (Platform.isMobile) {
                // Mobile fallback using execCommand
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-9999px';
                textArea.style.top = '-9999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const success = document.execCommand('copy');
                document.body.removeChild(textArea);
                if (!success) {
                    throw new Error('execCommand copy failed');
                }
                return true;
            } else {
                // Desktop: use modern clipboard API
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch (err) {
            console.error('Clipboard error:', err);
            throw err;
        }
    }

    // Copy current line with variables replaced
    async copyLineReplaced(editor, view) {
        const file = view.file;
        if (!file) {
            this.notify('No active file', 'error');
            return;
        }

        const content = editor.getValue();
        const frontmatter = this.getFrontmatter(file, content);
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);

        const { result, replacementCount } = this.replaceVariables(line, frontmatter);

        try {
            await this.copyToClipboard(result);
            this.notify(`Copied line (${replacementCount} variable(s) replaced)`);
        } catch (err) {
            this.notify('Failed to copy to clipboard', 'error');
        }
    }

    // Copy selection with variables replaced
    async copySelectionReplaced(editor, view) {
        const file = view.file;
        if (!file) {
            this.notify('No active file', 'error');
            return;
        }

        const content = editor.getValue();
        const frontmatter = this.getFrontmatter(file, content);
        const selection = editor.getSelection();

        if (!selection) {
            // Fall back to current line
            this.copyLineReplaced(editor, view);
            return;
        }

        const { result, replacementCount } = this.replaceVariables(selection, frontmatter);

        try {
            await this.copyToClipboard(result);
            this.notify(`Copied selection (${replacementCount} variable(s) replaced)`);
        } catch (err) {
            this.notify('Failed to copy to clipboard', 'error');
        }
    }

    // Copy entire document with variables replaced
    async copyDocumentReplaced(editor, view) {
        const file = view.file;
        if (!file) {
            this.notify('No active file', 'error');
            return;
        }

        const content = editor.getValue();
        const frontmatter = this.getFrontmatter(file, content);

        // Find the end of frontmatter
        const frontmatterEnd = this.findFrontmatterEnd(content);
        const bodyPart = content.slice(frontmatterEnd);

        const { result, replacementCount } = this.replaceVariables(bodyPart, frontmatter);

        try {
            await this.copyToClipboard(result);
            this.notify(`Copied document (${replacementCount} variable(s) replaced)`);
        } catch (err) {
            this.notify('Failed to copy to clipboard', 'error');
        }
    }

    // Rename file with variables replaced in the filename
    async renameFileWithVariables(editor, view) {
        const file = view.file;
        if (!file) {
            this.notify('No active file', 'error');
            return;
        }

        // Get frontmatter - use editor content if available for freshest data
        let frontmatter;
        if (editor) {
            const content = editor.getValue();
            frontmatter = this.getFrontmatter(file, content);
        } else {
            frontmatter = this.getFrontmatter(file);
        }

        // Get current filename without extension
        const currentName = file.basename;
        const extension = file.extension;
        const parentPath = file.parent ? file.parent.path : '';

        // Replace variables in the filename
        const { result: newName, replacementCount, missingCount } = this.replaceVariables(currentName, frontmatter);

        // Check if there were any variables to replace
        if (replacementCount === 0 && missingCount === 0) {
            this.notify('No variables found in filename', 'info');
            return;
        }

        // Check if the name actually changed
        if (newName === currentName) {
            this.notify('Filename unchanged after replacement', 'info');
            return;
        }

        // Sanitize the new filename - remove characters that are invalid in filenames
        const sanitizedName = this.sanitizeFilename(newName);

        if (!sanitizedName) {
            this.notify('Invalid filename after replacement', 'error');
            return;
        }

        // Build the new full path
        const newPath = parentPath
            ? `${parentPath}/${sanitizedName}.${extension}`
            : `${sanitizedName}.${extension}`;

        // Check if a file with this name already exists
        const existingFile = this.app.vault.getAbstractFileByPath(newPath);
        if (existingFile && existingFile !== file) {
            this.notify(`File already exists: ${sanitizedName}.${extension}`, 'error');
            return;
        }

        // Rename the file
        try {
            await this.app.fileManager.renameFile(file, newPath);
            this.notify(`Renamed to: ${sanitizedName}${missingCount > 0 ? ` (${missingCount} variable(s) not found)` : ''}`);
        } catch (err) {
            this.notify('Failed to rename file', 'error');
            console.error('Rename error:', err);
        }
    }

    // Sanitize filename by removing/replacing invalid characters
    sanitizeFilename(name) {
        if (!name) return null;

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
}

// Settings tab
class YAMLVariableTemplaterSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    
    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('yaml-templater-settings');
        
        containerEl.createEl('h2', { text: 'YAML Variable Templater Settings' });
        
        // Delimiter settings
        containerEl.createEl('h3', { text: 'Delimiters' });
        
        new Setting(containerEl)
            .setName('Opening delimiter')
            .setDesc('Characters that mark the start of a variable (default: {{)')
            .addText(text => text
                .setPlaceholder('{{')
                .setValue(this.plugin.settings.openDelimiter)
                .onChange(async (value) => {
                    if (!value || value.trim().length === 0) {
                        new Notice('Opening delimiter cannot be empty');
                        return;
                    }
                    if (value === this.plugin.settings.closeDelimiter) {
                        new Notice('Opening delimiter cannot be the same as closing delimiter');
                        return;
                    }
                    // Validate that delimiter creates valid regex
                    try {
                        const escaped = this.plugin.escapeRegex(value);
                        new RegExp(escaped);
                    } catch (e) {
                        new Notice('Invalid delimiter: contains problematic characters');
                        return;
                    }
                    // Check for unsafe patterns
                    if (value.length > 10) {
                        new Notice('Delimiter too long (max 10 characters)');
                        return;
                    }
                    this.plugin.settings.openDelimiter = value;
                    this.plugin._patternCache = null; // Invalidate pattern cache
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Closing delimiter')
            .setDesc('Characters that mark the end of a variable (default: }})')
            .addText(text => text
                .setPlaceholder('}}')
                .setValue(this.plugin.settings.closeDelimiter)
                .onChange(async (value) => {
                    if (!value || value.trim().length === 0) {
                        new Notice('Closing delimiter cannot be empty');
                        return;
                    }
                    if (value === this.plugin.settings.openDelimiter) {
                        new Notice('Closing delimiter cannot be the same as opening delimiter');
                        return;
                    }
                    // Validate that delimiter creates valid regex
                    try {
                        const escaped = this.plugin.escapeRegex(value);
                        new RegExp(escaped);
                    } catch (e) {
                        new Notice('Invalid delimiter: contains problematic characters');
                        return;
                    }
                    // Check for unsafe patterns
                    if (value.length > 10) {
                        new Notice('Delimiter too long (max 10 characters)');
                        return;
                    }
                    this.plugin.settings.closeDelimiter = value;
                    this.plugin._patternCache = null; // Invalidate pattern cache
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Default value separator')
            .setDesc('Character(s) that separate variable name from default value (e.g., : for {{var:default}})')
            .addText(text => text
                .setPlaceholder(':')
                .setValue(this.plugin.settings.defaultSeparator)
                .onChange(async (value) => {
                    if (!value || value.trim().length === 0) {
                        new Notice('Separator cannot be empty');
                        return;
                    }
                    // Validate that separator creates valid regex
                    try {
                        const escaped = this.plugin.escapeRegex(value);
                        new RegExp(escaped);
                    } catch (e) {
                        new Notice('Invalid separator: contains problematic characters');
                        return;
                    }
                    // Check for unsafe patterns
                    if (value.length > 10) {
                        new Notice('Separator too long (max 10 characters)');
                        return;
                    }
                    this.plugin.settings.defaultSeparator = value;
                    this.plugin._patternCache = null; // Invalidate pattern cache
                    await this.plugin.saveSettings();
                }));

        // Missing value handling
        containerEl.createEl('h3', { text: 'Behavior' });
        
        new Setting(containerEl)
            .setName('Missing value text')
            .setDesc('Text to use when a variable is not found in frontmatter')
            .addText(text => text
                .setPlaceholder('[MISSING]')
                .setValue(this.plugin.settings.missingValueText)
                .onChange(async (value) => {
                    this.plugin.settings.missingValueText = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('Support nested properties')
            .setDesc('Allow dot notation for nested properties (e.g., {{server.ip}})')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.supportNestedProperties)
                .onChange(async (value) => {
                    this.plugin.settings.supportNestedProperties = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Case-insensitive matching')
            .setDesc('Match variables regardless of case (e.g., {{ipaddress}} matches IPAddress)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.caseInsensitive)
                .onChange(async (value) => {
                    this.plugin.settings.caseInsensitive = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Array join separator')
            .setDesc('Characters used to join array values (default: ", ")')
            .addText(text => text
                .setPlaceholder(', ')
                .setValue(this.plugin.settings.arrayJoinSeparator)
                .onChange(async (value) => {
                    this.plugin.settings.arrayJoinSeparator = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Preserve original on missing')
            .setDesc('Keep {{variable}} instead of replacing with missing text when not found')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.preserveOriginalOnMissing)
                .onChange(async (value) => {
                    this.plugin.settings.preserveOriginalOnMissing = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Notification level')
            .setDesc('Control when notifications are shown')
            .addDropdown(dropdown => {
                for (const [value, label] of Object.entries(NOTIFICATION_LEVELS)) {
                    dropdown.addOption(value, label);
                }
                dropdown
                    .setValue(this.plugin.settings.notificationLevel)
                    .onChange(async (value) => {
                        this.plugin.settings.notificationLevel = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Highlight variables')
            .setDesc('Color-code variables in the editor: green (exists), orange (has default), red (missing)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.highlightVariables)
                .onChange(async (value) => {
                    this.plugin.settings.highlightVariables = value;
                    await this.plugin.saveSettings();
                    // Note: Requires Obsidian restart to fully apply/remove highlighting
                    new Notice('Restart Obsidian to apply highlighting changes');
                    this.display(); // Refresh to show/hide color settings
                }));

        // Variable highlight colors (only show if highlighting is enabled)
        if (this.plugin.settings.highlightVariables) {
            const colorSettingHelper = (name, desc, stateKey, defaultName) => {
                new Setting(containerEl)
                    .setName(name)
                    .setDesc(desc)
                    .addDropdown(dropdown => {
                        dropdown.addOption('', `Default (${defaultName})`);
                        for (const preset of COLOR_PRESETS) {
                            dropdown.addOption(preset.value, preset.name);
                        }
                        dropdown.setValue(this.plugin.settings.highlightColors?.[stateKey] || '');
                        dropdown.onChange(async (value) => {
                            if (!this.plugin.settings.highlightColors) {
                                this.plugin.settings.highlightColors = { exists: '', missing: '', hasDefault: '' };
                            }
                            this.plugin.settings.highlightColors[stateKey] = value;
                            await this.plugin.saveSettings();
                            this.plugin.updateHighlightStyles();
                        });

                        // Visual color preview
                        const updateDropdownStyle = () => {
                            const val = dropdown.getValue();
                            if (val) {
                                dropdown.selectEl.style.borderLeft = `4px solid ${val}`;
                            } else {
                                dropdown.selectEl.style.borderLeft = '';
                            }
                        };
                        updateDropdownStyle();
                        dropdown.selectEl.addEventListener('change', updateDropdownStyle);
                    });
            };

            colorSettingHelper('Existing variable color', 'Color for variables with values in frontmatter', 'exists', 'Green');
            colorSettingHelper('Missing variable color', 'Color for variables without values or defaults', 'missing', 'Red');
            colorSettingHelper('Default variable color', 'Color for variables with default values', 'hasDefault', 'Orange');
        }

        new Setting(containerEl)
            .setName('Show ribbon icon')
            .setDesc('Show a button in the left sidebar')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showRibbonIcon)
                .onChange(async (value) => {
                    this.plugin.settings.showRibbonIcon = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateRibbonIcon();
                    this.display(); // Refresh to show/hide dependent settings
                }));

        // Features section
        containerEl.createEl('h3', { text: 'Features' });

        new Setting(containerEl)
            .setName('Enable context menu')
            .setDesc('Show "Set/Edit variable" option when right-clicking on a {{variable}}')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableContextMenu)
                .onChange(async (value) => {
                    this.plugin.settings.enableContextMenu = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show frontmatter-only variables')
            .setDesc('In List Variables modal, show YAML properties that no longer have {{placeholders}} in document')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showFrontmatterOnlyVariables)
                .onChange(async (value) => {
                    this.plugin.settings.showFrontmatterOnlyVariables = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Close modal on navigate')
            .setDesc('Close the List Variables modal when clicking a variable name to navigate to it')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.closeModalOnNavigate)
                .onChange(async (value) => {
                    this.plugin.settings.closeModalOnNavigate = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Debug logging')
            .setDesc('Output debug messages to the developer console (Ctrl/Cmd + Shift + I)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.debugLogging)
                .onChange(async (value) => {
                    this.plugin.settings.debugLogging = value;
                    await this.plugin.saveSettings();
                }));

        // Only show ribbon mode settings if ribbon is enabled
        if (this.plugin.settings.showRibbonIcon) {
            new Setting(containerEl)
                .setName('Ribbon click behavior')
                .setDesc('Choose between a single action or a menu with all actions')
                .addDropdown(dropdown => dropdown
                    .addOption('single', 'Single action')
                    .addOption('menu', 'Show menu')
                    .setValue(this.plugin.settings.ribbonMode)
                    .onChange(async (value) => {
                        this.plugin.settings.ribbonMode = value;
                        await this.plugin.saveSettings();
                        this.plugin.updateRibbonIcon();
                        this.display(); // Refresh to show/hide action dropdown
                    }));

            // Only show action selector if in single action mode
            if (this.plugin.settings.ribbonMode === 'single') {
                new Setting(containerEl)
                    .setName('Ribbon button action')
                    .setDesc('What happens when you click the ribbon button')
                    .addDropdown(dropdown => {
                        for (const [value, actionData] of Object.entries(RIBBON_ACTIONS)) {
                            dropdown.addOption(value, actionData.name);
                        }
                        dropdown
                            .setValue(this.plugin.settings.ribbonAction)
                            .onChange(async (value) => {
                                this.plugin.settings.ribbonAction = value;
                                await this.plugin.saveSettings();
                                this.plugin.updateRibbonIcon();
                            });
                    });
            }

            // Show color settings if in menu mode
            if (this.plugin.settings.ribbonMode === 'menu') {
                containerEl.createEl('h4', { text: 'Menu item colors' });

                for (const [actionId, actionData] of Object.entries(RIBBON_ACTIONS)) {
                    const currentColor = this.plugin.settings.actionColors?.[actionId] || '';

                    new Setting(containerEl)
                        .setName(actionData.name)
                        .addDropdown(dropdown => {
                            // Add default option
                            dropdown.addOption('', 'Default');

                            // Add color presets
                            for (const preset of COLOR_PRESETS) {
                                dropdown.addOption(preset.value, preset.name);
                            }

                            dropdown.setValue(currentColor);
                            dropdown.onChange(async (value) => {
                                if (!this.plugin.settings.actionColors) {
                                    this.plugin.settings.actionColors = { ...DEFAULT_ACTION_COLORS };
                                }
                                this.plugin.settings.actionColors[actionId] = value;
                                await this.plugin.saveSettings();
                            });

                            // Style the dropdown to show the selected color
                            const updateDropdownStyle = () => {
                                const val = dropdown.getValue();
                                if (val) {
                                    dropdown.selectEl.style.borderLeft = `4px solid ${val}`;
                                } else {
                                    dropdown.selectEl.style.borderLeft = '';
                                }
                            };
                            updateDropdownStyle();
                            dropdown.selectEl.addEventListener('change', updateDropdownStyle);
                        });
                }
            }
        }

        // Usage info
        containerEl.createEl('h3', { text: 'Usage' });

        const usageDiv = containerEl.createEl('div', { cls: 'setting-item-description' });

        // Build usage info with safe DOM methods
        const p1 = usageDiv.createEl('p');
        p1.appendText('Variables are ');
        p1.createEl('strong', { text: 'only replaced when you trigger a command' });
        p1.appendText('.');

        const p2 = usageDiv.createEl('p');
        p2.createEl('strong', { text: 'Commands (access via Ctrl/Cmd + P):' });

        const ul = usageDiv.createEl('ul');
        const commands = [
            ['Replace variables in selection', 'replaces in selected text'],
            ['Replace all variables in document', 'replaces throughout note'],
            ['Replace all variables in document and filename', 'replaces in note and renames file'],
            ['Copy current line with variables replaced', 'copies to clipboard'],
            ['Copy selection with variables replaced', 'copies to clipboard'],
            ['Copy entire document with variables replaced', 'copies to clipboard'],
            ['Rename file with variables replaced', 'renames the note file'],
            ['List all variables in document', 'view and edit all variables']
        ];
        for (const [name, desc] of commands) {
            const li = ul.createEl('li');
            li.createEl('strong', { text: name });
            li.appendText(` - ${desc}`);
        }

        const p3 = usageDiv.createEl('p');
        p3.createEl('strong', { text: 'Tip:' });
        p3.appendText(' Assign hotkeys in Settings → Hotkeys for quick access!');

        const p4 = usageDiv.createEl('p');
        p4.createEl('strong', { text: 'Default values:' });
        p4.appendText(' Use ');
        p4.createEl('code', { text: '{{var:default}}' });
        p4.appendText(' syntax to provide fallback values when a variable is not defined.');

        const p5 = usageDiv.createEl('p');
        p5.createEl('strong', { text: 'Example:' });

        usageDiv.createEl('pre', {
            text: `---
IPAddress: 10.10.10.1
hostname: target
---

nmap -A -p {{port:1-1000}} {{IPAddress}}
ssh {{username:root}}@{{hostname}}`
        });
    }
}

module.exports = YAMLVariableTemplaterPlugin;
