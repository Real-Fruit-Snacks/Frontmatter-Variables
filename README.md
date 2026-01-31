# Frontmatter Variables

Replace variables in your markdown notes with values from YAML frontmatter **on demand**. Perfect for pentesting workflows, CTF notes, project templates, or any situation where you reuse note structures with different values.

## ✨ Features

- **🔄 Variable Replacement** - Replace variables with YAML frontmatter values on demand
- **📋 Quick Copy** - Copy commands with variables replaced directly to clipboard
- **🎨 Syntax Highlighting** - Color-coded variables (green=exists, orange=has default, red=missing)
- **🖱️ Context Menu** - Right-click any variable to set/edit its value
- **📊 Variable List** - View all variables at once with their status
- **🔧 Flexible Configuration** - Custom delimiters, nested properties, default values
- **⌨️ Keyboard Shortcuts** - Fast access to common operations

## 🚀 Quick Start

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

### 2. Copy commands to terminal

- Press **Ctrl+Shift+C** (Cmd+Shift+C on Mac) to copy current line with variables replaced
- Paste directly into your terminal - values are already filled in!

### 3. Replace variables permanently

- Select text and press **Ctrl+Shift+R** to replace variables in selection
- Or use Command Palette: **Frontmatter Variables: Replace All in Document**

## 📖 Variable Syntax

### Basic Variable
```
{{variableName}}
```

### Variable with Default Value
```
{{port:1-1000}}
{{username:root}}
{{protocol:https}}
```

### Nested Properties (Dot Notation)
```markdown
---
target:
  ip: 10.10.10.1
  port: 8080
credentials:
  user: admin
---

curl http://{{target.ip}}:{{target.port}}
ssh {{credentials.user}}@{{target.ip}}
```

### Array Handling
```markdown
---
ports:
  - 22
  - 80
  - 443
---

Open ports: {{ports}}
# Result: Open ports: 22, 80, 443
```

## 🎮 Commands

Access via Command Palette (Ctrl/Cmd+P):

| Command | Keyboard Shortcut | Description |
|---------|-------------------|-------------|
| **Frontmatter Variables: Copy Current Line (Replaced)** | `Ctrl+Shift+C` | Copy current line to clipboard with variables replaced |
| **Frontmatter Variables: Copy Selection (Replaced)** | - | Copy selected text with variables replaced |
| **Frontmatter Variables: Copy Document (Replaced)** | - | Copy entire document with variables replaced |
| **Frontmatter Variables: Replace in Selection** | `Ctrl+Shift+R` | Permanently replace variables in selected text |
| **Frontmatter Variables: Replace All in Document** | `Ctrl+Shift+Alt+R` | Replace all variables in document |
| **Frontmatter Variables: Replace in Document and Filename** | - | Replace in document and rename file |
| **Frontmatter Variables: Rename File (Replace Variables)** | - | Rename file with variables replaced |
| **Frontmatter Variables: List All Variables** | `Ctrl+Shift+L` | View and edit all variables |
| **Frontmatter Variables: Set Variable Value** | - | Set/edit variable (context menu) |

## ⚙️ Configuration

Access via Settings (File > Preferences > Settings > Extensions > Frontmatter Variables):

### Delimiters
- **Opening Delimiter** (default: `{{`) - Characters marking variable start
- **Closing Delimiter** (default: `}}`) - Characters marking variable end  
- **Default Separator** (default: `:`) - Separator for default values

### Behavior
- **Missing Value Text** (default: `[MISSING]`) - Text when variable not found
- **Support Nested Properties** (default: on) - Enable dot notation
- **Case Insensitive** (default: off) - Match variables regardless of case
- **Array Join Separator** (default: `, `) - How to join array values
- **Preserve Original on Missing** (default: off) - Keep `{{var}}` if not found instead of replacing

### Visual
- **Highlight Variables** (default: on) - Color-code variables in editor
- **Highlight Colors** - Customize colors for each state
- **Notification Level** - Control when notifications appear

## 🎯 Use Cases

### Pentesting Workflow

Create template notes for different target types:

```markdown
---
IPAddress: 
hostname: 
---

# Recon Commands
nmap -sV -sC {{IPAddress}}
nikto -h {{IPAddress}}
gobuster dir -u http://{{IPAddress}} -w /path/to/wordlist

# Quick Shell
nc {{IPAddress}} {{port:4444}}
```

**Workflow:**
1. Duplicate template for each target
2. Fill in frontmatter values (IP address, hostname, etc.)
3. Use **Copy Current Line** command to copy commands with values filled
4. Paste directly into terminal

### CTF Notes

```markdown
---
challenge: Web Exploitation 101
flag: CTF{not_found_yet}
url: http://ctf.example.com
---

# {{challenge}}

Target: {{url}}
Flag: {{flag}}

# Commands
curl {{url}}/robots.txt
sqlmap -u "{{url}}/login" --batch
```

### Project Templates

```markdown
---
project: My New Project
author: {{author:Anonymous}}
date: {{date:TBD}}
repo: {{repo:github.com/user/repo}}
---

# {{project}}

**Author:** {{author}}
**Date:** {{date}}
**Repository:** {{repo}}
```

## 🎨 Syntax Highlighting

Variables are automatically color-coded in your editor:

- 🟢 **Green** - Variable exists in frontmatter
- 🟠 **Orange** - Variable has default value but not set
- 🔴 **Red** - Variable missing (no value, no default)

## 💡 Tips & Tricks

### Quick Command Execution
1. Write command templates in your note
2. Position cursor on command line
3. Press **Ctrl+Shift+C**
4. Paste in terminal
5. Execute!

### Bulk Updates
Use **List All Variables** command (Ctrl+Shift+L) to:
- See all variables at once
- Quickly identify missing values
- Edit multiple values in sequence
- Navigate to variable locations

### Template Management
1. Create a "templates" folder
2. Build reusable note templates
3. Use File > Duplicate when starting new notes
4. Fill in unique values via frontmatter

### Default Values Strategy
Use default values for common scenarios:
```markdown
{{port:443}}
{{protocol:https}}
{{method:GET}}
{{timeout:30}}
```

## 🔧 Troubleshooting

### Variables Not Highlighting
- Ensure "Highlight Variables" is enabled in settings
- Check that you're editing a markdown file
- Try reloading the window (Ctrl+R)

### Variables Not Replacing
- Verify spelling matches exactly (or enable case-insensitive mode)
- Check YAML frontmatter is valid (proper indentation, no syntax errors)
- Ensure variables are outside the frontmatter block

### Commands Not Working
- Make sure you have a markdown file open
- Check that cursor is in the right position
- Look for error messages in Developer Tools (Help > Toggle Developer Tools)

## 🤝 Contributing

Found a bug or have a feature request? 
- Report issues on [GitHub](https://github.com/your-username/frontmatter-variables/issues)
- Contributions welcome via Pull Requests

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Credits

- Created by Matt
- Uses [js-yaml](https://github.com/nodeca/js-yaml) for YAML parsing

---

**Happy Templating!** 🎉

If you find this extension useful, please consider:
- ⭐ Starring the [GitHub repository](https://github.com/your-username/frontmatter-variables)
- ✍️ Leaving a review on the [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=your-publisher.frontmatter-variables)
- 📢 Sharing with others who might benefit
