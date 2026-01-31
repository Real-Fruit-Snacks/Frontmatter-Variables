# GitHub Actions Workflows

This directory contains GitHub Actions workflows for automating the build, test, and release process of the YAML Variable Templater extension.

## Workflows

### 1. CI Workflow (`ci.yml`)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

**What it does:**
- Runs on Ubuntu, Windows, and macOS
- Installs dependencies
- Lints the code
- Compiles TypeScript
- Runs tests
- Packages the extension as a `.vsix` file
- Uploads the `.vsix` as an artifact (Ubuntu only)

**Usage:**
- Automatically runs on every push and PR
- No manual action required
- Download built artifacts from the Actions tab

### 2. Release Workflow (`release.yml`)

**Triggers:**
- Push of version tags (e.g., `v1.0.0`, `v1.2.3`)
- Manual workflow dispatch with version input

**What it does:**
- Installs dependencies
- Lints and compiles the code
- Runs tests
- Packages the extension
- Creates a GitHub Release with the `.vsix` file
- Optionally publishes to VSCode Marketplace (commented out)
- Optionally publishes to Open VSX Registry (commented out)

**Usage - Automatic Release:**
```bash
# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0
```

**Usage - Manual Release:**
1. Go to the "Actions" tab in GitHub
2. Select "Release" workflow
3. Click "Run workflow"
4. Enter the version number (e.g., `1.0.0`)
5. Click "Run workflow"

## Publishing to Marketplaces

### VSCode Marketplace

To publish automatically to the VSCode Marketplace:

1. Create a Personal Access Token (PAT) at https://dev.azure.com
   - Organization: All accessible organizations
   - Scopes: Marketplace > Manage

2. Add the PAT as a repository secret:
   - Go to Settings > Secrets and variables > Actions
   - Create a new secret named `VSCE_PAT`
   - Paste your PAT as the value

3. Uncomment the "Publish to VSCode Marketplace" section in `release.yml`

### Open VSX Registry

To publish to Open VSX (for VSCodium and other editors):

1. Create an account at https://open-vsx.org
2. Generate an access token

3. Add the token as a repository secret:
   - Go to Settings > Secrets and variables > Actions
   - Create a new secret named `OVSX_PAT`
   - Paste your token as the value

4. Uncomment the "Publish to Open VSX" section in `release.yml`

## Workflow Artifacts

CI builds create artifacts that are available for 7 days:
- Extension `.vsix` file
- Can be downloaded from the Actions tab > Workflow run > Artifacts section

## Troubleshooting

### Workflow fails on lint
- Run `npm run lint` locally to see errors
- Fix linting issues and push changes

### Workflow fails on compile
- Run `npm run compile` locally to see TypeScript errors
- Fix compilation errors and push changes

### Workflow fails on tests
- Run `npm test` locally to debug
- Ensure all tests pass before pushing

### Release not created
- Verify the tag follows the pattern `v*.*.*` (e.g., `v1.0.0`)
- Check the Actions tab for error messages
- Ensure GitHub token has proper permissions

## Local Testing

Before pushing, test the workflows locally:

```bash
# Install dependencies
npm ci

# Lint
npm run lint

# Compile
npm run compile

# Test
npm test

# Package
npx @vscode/vsce package
```

## Version Bumping

To create a new release:

```bash
# Update version in package.json
npm version patch  # for 1.0.0 -> 1.0.1
npm version minor  # for 1.0.0 -> 1.1.0
npm version major  # for 1.0.0 -> 2.0.0

# Push with tags
git push && git push --tags
```

The release workflow will automatically create a GitHub release when the tag is pushed.
