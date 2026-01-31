# Icon Instructions

## Current Icon

The [`icon.svg`](icon.svg) file is an SVG version of the extension icon. It shows:
- Blue document background
- White document with frontmatter lines at top
- Three variables with curly braces in different colors:
  - 🟢 Green (exists in frontmatter)
  - 🟠 Orange (has default value)
  - 🔴 Red (missing value)
- Arrow suggesting transformation/replacement

## Convert SVG to PNG

VSCode Marketplace requires a PNG icon (128x128 pixels). Convert the SVG:

### Option 1: Using Online Tool

1. Go to: https://cloudconvert.com/svg-to-png
2. Upload [`icon.svg`](icon.svg)
3. Set dimensions to **128x128**
4. Download as `icon.png`
5. Save in this folder

### Option 2: Using Inkscape (Free Software)

1. Download Inkscape: https://inkscape.org/
2. Open `icon.svg` in Inkscape
3. File > Export PNG Image
4. Set width and height to 128 pixels
5. Export as `icon.png`

### Option 3: Using ImageMagick (Command Line)

```bash
# Install ImageMagick first
# Windows: https://imagemagick.org/script/download.php#windows

convert -background none -resize 128x128 icon.svg icon.png
```

### Option 4: Using GIMP (Free Software)

1. Download GIMP: https://www.gimp.org/
2. Open `icon.svg`
3. Image > Scale Image > 128x128
4. File > Export As > `icon.png`
5. Use PNG export settings

### Option 5: Using Node.js (If you have sharp)

```bash
npm install -g sharp-cli
sharp -i icon.svg -o icon.png --width 128 --height 128
```

## Design Notes

The current icon design:
- **Professional**: Clean, simple design
- **Recognizable**: Document with variables concept is clear
- **Theme Compatible**: Works in both light and dark VSCode themes
- **Meaningful Colors**: Uses the same green/orange/red as syntax highlighting

## Custom Icon Ideas

If you want to create your own icon:

### Requirements
- **Size**: 128x128 pixels (PNG format)
- **Style**: Simple, recognizable at small sizes
- **Colors**: Should work in light and dark themes
- **Concept**: Related to variables, frontmatter, templates, or YAML

### Design Suggestions

**Option 1: YAML Document**
- Document icon with `---` frontmatter lines
- Variable braces `{{  }}` prominently displayed
- Use brand colors

**Option 2: Variable Symbol**
- Large `{{  }}` curly braces
- With "FM" or "YAML" text inside
- Gradient or solid background

**Option 3: Replacement Arrow**
- `{{var}}` on left
- Arrow in middle
- `value` on right
- Shows the transformation

**Option 4: Abstract**
- Letter "F" for Frontmatter
- Stylized as a variable placeholder
- Minimalist design

## Current Status

- ✅ SVG icon created
- ⏳ PNG conversion needed (do before publishing)
- ⏳ Update `package.json` icon path if needed

## After Creating icon.png

The [`package.json`](../package.json) already references it:

```json
{
  "icon": "images/icon.png"
}
```

Just place your `icon.png` file in this folder and rebuild:

```bash
npm run package
vsce package
```

The icon will appear in:
- VSCode Extensions marketplace
- Extensions view sidebar
- Extension details page
- Search results

## Icon Preview

To preview how it looks:
1. Create the PNG version
2. Package the extension: `vsce package`
3. Install locally: `code --install-extension frontmatter-variables-1.0.0.vsix`
4. Check Extensions view (`Ctrl+Shift+X`)

Your extension icon will appear next to "Frontmatter Variables" in the list!
