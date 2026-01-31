# Development Setup Guide - Frontmatter Variables

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

This will install:
- TypeScript compiler
- VSCode type definitions
- js-yaml library
- Webpack and build tools
- ESLint for code quality

### 2. Compile the Extension

```bash
npm run compile
```

This compiles TypeScript to JavaScript in the `dist/` folder.

### 3. Run in Development Mode

**Option A: Press F5 in VSCode**
- Opens Extension Development Host window
- Auto-reloads on code changes (with watch mode)

**Option B: Command Line**
```bash
npm run watch
# In another terminal:
code --extensionDevelopmentPath=$(pwd)
```

### 4. Test the Extension

In the Extension Development Host window:

1. Create a test markdown file:
   ```markdown
   ---
   name: Test User
   age: 25
   ---
   
   Hello {{name}}, you are {{age}} years old.
   ```

2. Test syntax highlighting:
   - `{{name}}` and `{{age}}` should be highlighted in green

3. Test copy command:
   - Put cursor on line with variables
   - Press `Ctrl+Shift+C` (or `Cmd+Shift+C` on Mac)
   - Paste - should see "Hello Test User, you are 25 years old."

4. Test all other commands via Command Palette (`Ctrl+Shift+P`)

## File Structure

```
vscode-extension/
├── src/
│   ├── extension.ts              # Main entry point
│   ├── types.ts                  # TypeScript interfaces
│   ├── variableReplacer.ts       # Core replacement logic
│   ├── frontmatterParser.ts      # YAML parsing
│   ├── decorationProvider.ts     # Syntax highlighting
│   ├── commands/
│   │   ├── copyCommands.ts       # Copy with replacement
│   │   ├── replaceCommands.ts    # In-place replacement
│   │   ├── renameCommand.ts      # File rename
│   │   ├── setVariableCommand.ts # Context menu edit
│   │   └── listVariablesCommand.ts # Variable list UI
│   └── utils/
│       ├── settings.ts           # Config management
│       ├── notifications.ts      # User messages
│       └── fileOperations.ts     # File utilities
├── dist/                         # Compiled output (generated)
├── package.json                  # Extension manifest
├── tsconfig.json                 # TypeScript config
├── webpack.config.js             # Build config
├── README.md                     # User documentation
├── CHANGELOG.md                  # Version history
├── LICENSE                       # MIT license
└── INSTALL.md                    # Installation guide
```

## Development Commands

```bash
# Install dependencies
npm install

# Compile once
npm run compile

# Watch mode (auto-recompile on save)
npm run watch

# Lint code
npm run lint

# Package for distribution
npm run package

# Create VSIX file for installation
vsce package
```

## Debugging

### VSCode Debugger

1. Open `vscode-extension` folder in VSCode
2. Press `F5` or select "Run Extension" from Run panel
3. Set breakpoints in TypeScript files
4. Debug in Extension Development Host

### Console Logging

Add debug output:
```typescript
console.log('Debug:', variable);
```

View in:
- **Developer Tools**: Help > Toggle Developer Tools > Console
- Check for errors during testing

### Common Issues

**Extension doesn't activate**
- Check activation events in `package.json`
- Should activate on `onLanguage:markdown`
- Check Developer Console for errors

**Decorations not updating**
- Check if `highlightVariables` setting is enabled
- Verify debounce timeout (300ms)
- Check if file is markdown

**Commands not found**
- Verify command IDs match in `extension.ts` and `package.json`
- Check that commands are registered in `activate()`
- Use prefix `frontmatterVariables.` for all command IDs

## Testing Checklist

Before releasing, test all features:

### Basic Functionality
- [ ] Syntax highlighting works (green/orange/red)
- [ ] Highlighting updates on edit
- [ ] Highlighting respects settings changes
- [ ] Custom delimiters work (test with `<>`, `${}`, etc.)

### Copy Commands
- [ ] Copy current line (Ctrl+Shift+C)
- [ ] Copy selection
- [ ] Copy document
- [ ] Variables replaced correctly
- [ ] Clipboard contains expected text

### Replace Commands
- [ ] Replace in selection
- [ ] Replace in document
- [ ] Replace in document and filename
- [ ] Original text changed correctly
- [ ] Cursor position preserved
- [ ] Undo works properly

### Variable Features
- [ ] Basic variables: `{{var}}`
- [ ] Default values: `{{var:default}}`
- [ ] Nested properties: `{{obj.prop}}`
- [ ] Array values joined correctly
- [ ] Array indices: `{{items[0]}}`
- [ ] Case-insensitive matching (when enabled)

### UI Commands
- [ ] Context menu "Set Variable" appears
- [ ] Context menu edits frontmatter correctly
- [ ] List Variables shows all variables
- [ ] List Variables allows editing
- [ ] List Variables navigates to position

### Settings
- [ ] All settings appear in UI
- [ ] Settings changes apply immediately
- [ ] Custom delimiters work
- [ ] Custom colors apply
- [ ] Notification levels respected
- [ ] Preserve original on missing works

### Edge Cases
- [ ] Empty frontmatter (`---\n---`)
- [ ] No frontmatter
- [ ] Malformed YAML (error handling)
- [ ] Very long variable names
- [ ] Special characters in values
- [ ] Windows reserved filenames (CON, PRN, etc.)
- [ ] Large files (performance)

## Packaging for Distribution

### 1. Update Version

Edit `package.json`:
```json
{
  "version": "1.0.0"
}
```

### 2. Update Changelog

Add entry to `CHANGELOG.md` for the new version.

### 3. Build Production Bundle

```bash
npm run package
```

This creates optimized bundle in `dist/`.

### 4. Create VSIX

First, install vsce if you haven't:
```bash
npm install -g @vscode/vsce
```

Then package:
```bash
vsce package
```

This creates `frontmatter-variables-1.0.0.vsix`.

### 5. Test VSIX

Install and test:
```bash
code --install-extension frontmatter-variables-1.0.0.vsix
```

Verify:
- Extension appears in Extensions list
- All commands work
- Settings accessible
- No errors in console

### 6. Publish to Marketplace

First time setup:
```bash
# Create publisher account at https://marketplace.visualstudio.com/
# Generate Personal Access Token from Azure DevOps

vsce login <publisher-name>
```

Publish:
```bash
vsce publish
```

Or publish specific version:
```bash
vsce publish 1.0.1
```

## Configuration for Publishing

### Required package.json Fields

Before publishing, ensure these are set:

```json
{
  "name": "frontmatter-variables",
  "displayName": "Frontmatter Variables",
  "description": "Replace variables in markdown with YAML frontmatter values on demand",
  "version": "1.0.0",
  "publisher": "your-publisher-id",
  "repository": {
    "type": "git",
    "url": "https://github.com/your-username/frontmatter-variables"
  },
  "icon": "images/icon.png",
  "license": "MIT"
}
```

### Create an Icon

1. Create 128x128 PNG icon
2. Save as `images/icon.png`
3. Reference in `package.json`

Recommended design:
- Simple and recognizable
- Works in light and dark themes
- Related to variables or frontmatter concept

### Update URLs

Replace placeholders in:
- `README.md` - GitHub URLs, marketplace link
- `package.json` - repository, bugs URLs
- `INSTALL.md` - Installation links

## Performance Optimization

### Decoration Updates

Already optimized with:
- 300ms debounce on text changes
- Only updates active editor
- Only processes markdown files

### Pattern Caching

Regex patterns are cached and only rebuilt when settings change.

### Future Optimizations

Could be added:
- Cache parsed frontmatter (invalidate on frontmatter edit)
- Limit decorations to visible viewport
- Worker threads for large documents

## Resources

- [VSCode Extension API](https://code.visualstudio.com/api)
- [Extension Samples](https://github.com/microsoft/vscode-extension-samples)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [js-yaml Documentation](https://github.com/nodeca/js-yaml)

## Support

- **Issues**: Report on [GitHub](https://github.com/your-username/frontmatter-variables/issues)
- **Questions**: Open a discussion on GitHub
- **Documentation**: See [README.md](README.md)

## Next Steps

1. Run `npm install`
2. Press F5 to test
3. Make any needed customizations
4. Test thoroughly
5. Package with `vsce package`
6. Publish to marketplace

Happy developing! 🚀
