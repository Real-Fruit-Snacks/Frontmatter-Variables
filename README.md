# YAML Variable Templater - Obsidian Plugin

Replace `{{variables}}` in your notes with values from YAML frontmatter properties **on demand** via commands, hotkeys, or ribbon button.

Perfect for pentesting workflows, CTF notes, project templates, or any situation where you reuse note structures with different values.

## Installation

### From Obsidian Community Plugins (Recommended)

1. Open Obsidian Settings
2. Go to **Community Plugins** and disable Safe Mode if prompted
3. Click **Browse** and search for "YAML Variable Templater"
4. Click **Install**, then **Enable**

### Manual Installation

1. Navigate to your Obsidian vault's plugin folder:
   ```
   <your-vault>/.obsidian/plugins/
   ```

2. Create a new folder called `yaml-variable-templater`

3. Download the latest release and copy these files into that folder:
   - `manifest.json`
   - `main.js`
   - `styles.css`

4. Restart Obsidian (or reload plugins)

5. Go to **Settings → Community Plugins** and enable "YAML Variable Templater"

## Quick Start

### 1. Set up your note with frontmatter

```markdown
---
IPAddress: 10.10.10.1
hostname: target
username: admin
ports: 22,80,443
---

# Enumeration

nmap -A -p- {{IPAddress}}
gobuster dir -u http://{{IPAddress}} -w /usr/share/wordlists/dirb/common.txt
ssh {{username}}@{{hostname}}
```

### 2. Fill in values

**Right-click** on any `{{variable}}` to set its value directly

**Or** edit the YAML frontmatter manually

### 3. Replace variables

**Ribbon Button:** Click the replace icon in the left sidebar

**Command Palette (Ctrl/Cmd + P):** Search for "YAML Variable"

**Hotkeys:** Assign your own in Settings → Hotkeys

## Commands

| Command | Description |
|---------|-------------|
| **Replace variables in selection** | Permanently replaces `{{vars}}` in selected text (or current line if no selection) |
| **Replace all variables in document** | Replaces all `{{vars}}` in the entire note body |
| **Replace all variables in document and filename** | Replaces `{{vars}}` in both note content and filename at once |
| **Copy current line with variables replaced** | Copies the current line to clipboard with values filled in |
| **Copy selection with variables replaced** | Copies selection to clipboard with values filled in |
| **Copy entire document with variables replaced** | Copies whole note body to clipboard with values filled in |
| **Rename file with variables replaced** | Renames the note file, replacing `{{vars}}` in the filename |
| **List all variables in document** | Opens a modal showing all variables grouped by status with inline editing and batch save |

## Features

### Right-Click to Set Values

Right-click on any `{{variable}}` in your note to quickly set or edit its value in the frontmatter:

- **Set value**: If the variable doesn't exist in frontmatter, creates it
- **Edit value**: If it exists, shows the current value for editing
- Changes are saved directly to the YAML frontmatter

This is the fastest way to fill in variables without manually editing the frontmatter block.

### List All Variables

Open the **"List all variables in document"** command to see and edit all variables at once:

- **Grouped by status** - Variables organized into three sections:
  - 🔴 **Missing Variables** - No value and no default (needs attention)
  - 🟠 **Variables with Defaults** - No value yet, but has a fallback
  - 🟢 **Set Variables** - Value exists in frontmatter
- **Summary statistics** - See counts at the top: total variables, set, with defaults, and missing
- **Status indicators** - Visual symbols show each variable's state:
  - `●` (filled) = Value is set
  - `◐` (half) = Has default value
  - `○` (empty) = Missing value
- **Inline editing** - Edit all values directly in the modal
- **Quick navigation** - Click a variable name to jump to it in the document
- **Batch save** - Save all changes at once with "Save Changes"
- **Change tracking** - Modified fields are highlighted

Perfect for reviewing which variables still need values before running replacement!

### Variable Syntax

Basic variable:
```
{{variableName}}
```

Variable with default value (used if variable doesn't exist):
```
{{variableName:defaultValue}}
```

Supported characters in variable names:
- Letters, numbers, underscores: `{{my_var123}}`
- Dots for nested properties: `{{server.ip}}`
- Hyphens: `{{ip-address}}`
- Array indices: `{{items[0]}}`

### Nested Properties

Access nested YAML structures using dot notation:

```markdown
---
target:
  ip: 10.10.10.1
  port: 8080
credentials:
  user: admin
  pass: password123
services:
  - http
  - ssh
  - ftp
---

curl http://{{target.ip}}:{{target.port}}
ssh {{credentials.user}}@{{target.ip}}
First service: {{services[0]}}
```

### Default Values

Provide fallback values for variables that might not be defined:

```markdown
---
IPAddress: 10.10.10.1
---

nmap -p {{port:1-1000}} {{IPAddress}}
ssh {{username:root}}@{{IPAddress}}
curl {{protocol:https}}://{{IPAddress}}:{{webport:443}}/api
```

- `{{port:1-1000}}` → Uses `1-1000` since `port` isn't defined
- `{{username:root}}` → Uses `root` since `username` isn't defined
- `{{IPAddress}}` → Uses `10.10.10.1` from frontmatter

Default values can contain any characters including `:`, `/`, spaces, etc.

### Variables in Filenames

Include `{{variables}}` in your note's filename and replace them with frontmatter values:

```markdown
---
hostname: target-server
IPAddress: 10.10.10.1
---
```

If your note is named `{{hostname}} - {{IPAddress}}.md`, running "Rename file with variables replaced" will rename it to `target-server - 10.10.10.1.md`.

Invalid filename characters (`/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`) are automatically replaced with dashes.

### Array Handling

Arrays are automatically joined when replaced:

```markdown
---
ports:
  - 22
  - 80
  - 443
tags:
  - web
  - linux
---

Open ports: {{ports}}
# Result: Open ports: 22, 80, 443
```

Configure the separator in settings (default: `, `). Use `\n` for newlines.

### Syntax Highlighting

When enabled, variables are color-coded in the editor:

| Color | Meaning |
|-------|---------|
| 🟢 Green | Variable exists in frontmatter |
| 🟠 Orange | Variable missing but has a default value |
| 🔴 Red | Variable missing with no default |

Highlighting works in:
- Normal text
- Callouts and blockquotes
- Code blocks (though variables shouldn't typically be there)

## Ribbon Button

The ribbon button (left sidebar) can be configured in two modes:

### Single Action Mode
Click executes one configured action (e.g., "Copy current line with variables replaced").

### Menu Mode
Click shows a dropdown menu with all available actions. Each menu item:
- Shows an icon for quick identification
- Can be color-coded in settings for visual organization

## Settings

### Delimiters

| Setting | Default | Description |
|---------|---------|-------------|
| Opening delimiter | `{{` | Characters that mark the start of a variable |
| Closing delimiter | `}}` | Characters that mark the end of a variable |
| Default value separator | `:` | Separator between variable name and default value |

**Examples of custom delimiters:**
- `<%` and `%>` for ERB-style
- `${` and `}` for shell-style
- `[[` and `]]` for wiki-style

### Behavior

| Setting | Default | Description |
|---------|---------|-------------|
| Missing value text | `[MISSING]` | Text shown when a variable isn't found |
| Support nested properties | On | Enable dot notation (e.g., `{{server.ip}}`) |
| Case-insensitive matching | Off | Match `{{ipaddress}}` to `IPAddress` |
| Array join separator | `, ` | How to join array values |
| Preserve original on missing | Off | Keep `{{var}}` instead of replacing with missing text |
| Notification level | All | Control toast notifications (all / errors only / silent) |
| Highlight variables | On | Color-code variables in the editor |

### Ribbon Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Show ribbon icon | On | Show/hide the sidebar button |
| Ribbon click behavior | Single action | Choose between single action or menu |
| Ribbon button action | Copy current line | Action for single-click mode |
| Menu item colors | Default | Customize colors for each menu action |

## Recommended Hotkeys

For a fast workflow, set these in **Settings → Hotkeys**:

| Hotkey | Command | Use Case |
|--------|---------|----------|
| `Ctrl/Cmd + Shift + C` | Copy current line with variables replaced | Quick copy commands to terminal |
| `Ctrl/Cmd + Shift + R` | Replace variables in selection | Permanently fill in values |
| `Ctrl/Cmd + Shift + A` | Replace all variables in document | Fill entire note at once |
| `Ctrl/Cmd + Shift + L` | List all variables in document | Review and edit all variables at once |

## Pro Tips

### Pentesting Workflow

1. Create a template note with common commands:
   ```markdown
   ---
   IPAddress:
   hostname:
   username: root
   ---

   # Recon
   nmap -sC -sV {{IPAddress}}
   gobuster dir -u http://{{IPAddress}} -w /path/to/wordlist.txt

   # Initial Access
   ssh {{username}}@{{hostname}}
   ```

2. Duplicate the template for each target
3. Fill in the frontmatter values
4. Use **"Copy current line with variables replaced"** to copy commands ready to paste

### Template Notes

Use with default values to create flexible templates:

```markdown
---
project: My Project
author: {{author:Anonymous}}
date: {{date:TBD}}
status: {{status:Draft}}
---

# {{project}}

Author: {{author}}
Date: {{date}}
Status: {{status}}
```

### Batch Processing

Use **"Replace all variables in document and filename"** to:
1. Fill in all variables in the note body
2. Rename the file based on frontmatter values

All in one action.

## Troubleshooting

### Variables not highlighting
- Ensure "Highlight variables" is enabled in settings
- Restart Obsidian after changing highlight settings
- Check that variables are outside the frontmatter block

### Variables not replacing
- Check spelling matches exactly (or enable case-insensitive matching)
- Ensure frontmatter is valid YAML (proper indentation, no tabs)
- For nested properties, ensure "Support nested properties" is enabled

### Filename rename fails
- Check for invalid characters in the resulting filename
- Ensure a file with the target name doesn't already exist
- Variable values containing path separators are sanitized

## Known Issues

- **Highlight setting changes require restart**: After enabling or disabling variable highlighting, you need to restart Obsidian for the change to take full effect.
- **Live Preview mode**: Variable highlighting works best in Source mode; some callout styles in Live Preview may occasionally override colors.

## Mobile Compatibility

This plugin works on both desktop and mobile versions of Obsidian:

| Feature | Desktop | Mobile |
|---------|---------|--------|
| Variable replacement in document | ✅ | ✅ |
| Variable replacement in selection | ✅ | ✅ |
| Copy line with variables replaced | ✅ | ✅ |
| Copy selection with variables replaced | ✅ | ✅ |
| Copy document with variables replaced | ✅ | ✅ |
| Rename file with variables | ✅ | ✅ |
| List all variables modal | ✅ | ✅ |
| Context menu (set variable) | ✅ | ✅ (long-press) |
| Syntax highlighting | ✅ | ✅ |
| Settings UI | ✅ | ✅ |

**Note:** On mobile, the right-click context menu is accessed via long-press on the variable.

## Changelog

### v1.1.1
- **Mobile compatibility improvements** - Copy commands now work on mobile using a fallback clipboard method
- **Atomicity fix** - File renaming now happens before document changes to prevent partial state on errors
- **Stability improvements**:
  - Added bounds checking for array indices (max 1000) to prevent memory issues
  - Fixed race condition in list variables modal when document changes externally
  - Added settings validation to handle corrupted settings gracefully
  - Improved plugin cleanup on unload
- **API updates** - Replaced deprecated Obsidian APIs with current alternatives
- **Bug fixes**:
  - Fixed inconsistent error notifications across commands
  - Added circular reference protection in frontmatter parsing
  - Improved modal memory management

### v1.1.0
- **New: List all variables modal** - View all variables in document grouped by status
  - Missing, with defaults, and set variables shown in separate sections
  - Edit all values inline with batch save
  - Click variable names to navigate to their location
  - Summary statistics show variable counts
- Improved context menu position detection using cursor position as primary method
- Fixed off-by-one boundary check in variable detection

### v1.0.0
- Initial release
- Variable replacement in selection, document, and filenames
- Copy commands with variable replacement
- Right-click context menu to set/edit variable values
- Syntax highlighting with theme support
- Nested property support
- Default values
- Configurable delimiters
- Ribbon button with single action and menu modes
- Menu item color customization
