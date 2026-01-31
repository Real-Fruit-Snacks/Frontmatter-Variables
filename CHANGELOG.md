# Changelog

All notable changes to the Frontmatter Variables extension will be documented in this file.

## [1.0.0] - Initial Release

### Features
- ✨ Variable replacement in markdown with YAML frontmatter values
- 📋 Copy commands (line, selection, document) with variables replaced
- 🔄 Replace commands (selection, document, document+filename)
- 📝 Rename file with variables replaced
- 🎨 Real-time syntax highlighting (green/orange/red)
- 🖱️ Context menu to set/edit variable values
- 📊 List all variables command with QuickPick interface
- ⚙️ Comprehensive settings:
  - Custom delimiters (change from `{{}}` to any delimiters like `<>`)
  - Nested property support (dot notation: `{{server.ip}}`)
  - Default values (`{{var:default}}`)
  - Case-insensitive matching
  - Array handling with custom separators
  - Customizable highlight colors
  - Preserve original on missing option
- ⌨️ Keyboard shortcuts for common operations
- 🔔 Configurable notification levels

### Supported Features
- Basic variables: `{{variableName}}`
- Default values: `{{variableName:defaultValue}}`
- Nested properties: `{{server.ip}}`
- Array indices: `{{items[0]}}`
- Array values (auto-joined with configurable separator)
- Custom delimiters (e.g., `<var>`, `${var}`, `[[var]]`)
- Case-insensitive matching
- Frontmatter validation

### Technical Details
- TypeScript implementation
- VSCode Extension API v1.85+
- js-yaml for YAML parsing
- Debounced decoration updates for performance (300ms)
- Theme-aware syntax highlighting
- Cross-platform support (Windows, macOS, Linux)

### Known Limitations
- Desktop only (VSCode is desktop-only)
- Markdown files only
- Syntax highlighting may have brief delay during rapid typing (300ms debounce)

## [Unreleased]

### Planned Features for v1.1
- Status bar item showing variable count
- Code lens showing variable values inline
- Snippet integration for templates
- Multi-root workspace support
- WebView for enhanced List Variables UI
- Auto-completion for variable names
- Variable validation warnings in Problems panel

### Under Consideration
- Template gallery/marketplace
- Export with variables replaced (PDF, HTML, etc.)
- Variable rename refactoring across document
- Find/replace specifically for variables
- Batch variable updates across multiple files
- Git integration for template versioning
