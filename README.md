# Angular Upgrade Assistant

A VS Code extension that automates Angular version upgrades using intelligent patch generation, TypeScript diagnostics analysis, and AI-powered code fixes.

## Features

- 🔍 **Automatic Angular Project Detection** - Works even in monorepos with nested projects
- 🤖 **AI-Powered Patch Generation** - Uses LLMs (GitHub Copilot/Gemini/OpenAI) to generate code fixes
- 📊 **TypeScript Diagnostics** - Analyzes errors using ts-morph for accurate detection
- 📚 **Smart Documentation Fetching** - Pulls changelogs from npm and GitHub
- 🔒 **Git Safety** - Creates migration branches with automatic checkpoints
- 🎨 **Interactive UI** - WebView panel for reviewing and approving patches
- 📝 **Comprehensive Logging** - Output channel with detailed migration steps

## Installation & Setup

### 1. Install Dependencies

```bash
cd /home/ayush/Documents/new-vs-code-extension/angular-upgrade-assistant
npm install
```

### 2. Compile TypeScript

```bash
npm run compile
```

This compiles all TypeScript files from `src/` to `out/` directory.

### 3. Watch Mode (Optional)

For development, run in watch mode to auto-compile on changes:

```bash
npm run watch
```

## Running the Extension

### Method 1: Debug Mode (F5)

1. Open the project in VS Code
2. Press **F5** or **Run → Start Debugging**
3. A new "Extension Development Host" window will open
4. Open an Angular project in the development host
5. Press **Ctrl+Shift+P** (Cmd+Shift+P on Mac)
6. Type and select: **"Angular Upgrade: Start Migration"**

### Method 2: Run & Debug Panel

1. Open **Run and Debug** panel (Ctrl+Shift+D)
2. Select **"Run Extension"** from the dropdown
3. Click the green play button
4. Follow steps 3-6 from Method 1

## Usage

### Basic Workflow

1. **Open an Angular Project**
   - The extension automatically detects Angular projects
   - Supports monorepos (finds nested Angular projects)

2. **Run the Migration Command**
   ```
   Ctrl+Shift+P → "Angular Upgrade: Start Migration"
   ```

3. **Migration Steps** (Automated):
   - ✅ Detects Angular project root
   - ✅ Creates Git branch: `angular-upgrade-<timestamp>`
   - ✅ Analyzes current dependencies
   - ✅ Creates safety checkpoint
   - ✅ Runs `ng update @angular/cli @angular/core`
   - ✅ Collects TypeScript diagnostics
   - ✅ Fetches migration documentation
   - ✅ Generates patches using LLM (if configured)
   - ✅ Shows interactive WebView for patch review
   - ✅ Applies approved patches
   - ✅ Verifies build success
   - ✅ Shows migration summary

4. **Review Patches**
   - Patches appear in the WebView panel
   - Each patch shows:
     - File path
     - Description of changes
     - Syntax-highlighted diff
   - Click **"Approve"** or **"Reject"** for each patch

5. **View Logs**
   - Open **Output** panel: View → Output
   - Select **"Angular Upgrade Assistant"** from dropdown
   - See detailed logs of all migration steps

## Configuration

### LLM Provider Setup

The extension supports multiple LLM providers. Configure in your VS Code settings:

#### Option 1: GitHub Copilot (Recommended)
- Install the GitHub Copilot extension
- Sign in to GitHub Copilot
- Extension will automatically detect and use Copilot

#### Option 2: Google Gemini
```json
// settings.json
{
  "angularUpgrade.llmProvider": "gemini",
  "angularUpgrade.geminiApiKey": "YOUR_API_KEY"
}
```

#### Option 3: OpenAI
```json
// settings.json
{
  "angularUpgrade.llmProvider": "openai",
  "angularUpgrade.openaiApiKey": "YOUR_API_KEY",
  "angularUpgrade.openaiModel": "gpt-4"
}
```

### Git Repository Requirement

**Highly Recommended**: Run migrations in a Git repository for safety.

If no Git repository is detected:
- Migration will proceed with a warning
- No automatic checkpoints or rollback capability
- Changes are applied directly without version control

To initialize Git:
```bash
cd /path/to/your/angular/project
git init
git add .
git commit -m "Initial commit"
```

## Development Commands

### Compile
```bash
npm run compile
```
Compiles TypeScript to JavaScript in `out/` directory.

### Watch Mode
```bash
npm run watch
```
Auto-compiles on file changes during development.

### Clean Build
```bash
rm -rf out/
npm run compile
```

### Package Extension (Optional)
```bash
npm install -g vsce
vsce package
```
Creates a `.vsix` file for distribution.

## Project Structure

```
angular-upgrade-assistant/
├── src/
│   ├── extension.ts           # Main entry point & orchestrator
│   ├── projectLocator.ts      # Angular project detection
│   ├── initializeWorkspace.ts # Workspace & ts-morph setup
│   ├── analyzer.ts            # ng update & diagnostics
│   ├── dependencyScanner.ts   # Package.json & import analysis
│   ├── docFetcher.ts          # npm/GitHub documentation
│   ├── llmClient.ts           # LLM integration
│   ├── patcher.ts             # Unified-diff patch application
│   ├── gitUtils.ts            # Git operations
│   ├── cliRunner.ts           # CLI command execution
│   ├── types.ts               # Shared TypeScript types
│   └── ui/
│       ├── webviewPanel.ts    # Interactive WebView UI
│       └── logger.ts          # Output channel logging
├── out/                       # Compiled JavaScript (generated)
├── package.json               # Extension manifest
├── tsconfig.json              # TypeScript configuration
└── README.md                  # This file
```

## Troubleshooting

### Extension Not Activating
- Ensure you're in the Extension Development Host window
- Check **Developer → Toggle Developer Tools** for errors
- Verify the extension compiled: check `out/` directory exists

### "No Angular project detected"
- Ensure your project has `angular.json` or `package.json` with `@angular/core`
- Check the Output panel for detection logs
- Try opening the Angular project folder directly (not parent folder)

### Patches Not Generating
- Verify LLM provider is configured (see Configuration section)
- Check Output panel for LLM errors
- Ensure you have an active internet connection for API calls

### Compilation Errors
```bash
# Clear and rebuild
rm -rf out/ node_modules/
npm install
npm run compile
```

### Git Errors
- Ensure you're in a Git repository
- Check that Git is installed: `git --version`
- Verify no uncommitted changes if starting migration

## Output & Logs

### Output Channel
- **View** → **Output** → Select "Angular Upgrade Assistant"
- Shows real-time migration progress
- Includes timestamps for each step
- Logs errors with stack traces

### WebView Panel
- Opens automatically when running migration
- Shows interactive progress tracker
- Displays patches for review
- Provides final summary with statistics

## Requirements

- **Node.js**: v18 or higher
- **npm**: v9 or higher
- **Angular CLI**: Installed in your project
- **Git**: Recommended for safety (optional)
- **VS Code**: v1.80.0 or higher

## Extension Settings

This extension contributes the following settings (future):

- `angularUpgrade.llmProvider`: LLM provider to use (copilot/gemini/openai)
- `angularUpgrade.autoApplyPatches`: Auto-apply patches without review
- `angularUpgrade.createGitBranch`: Create migration branch (default: true)
- `angularUpgrade.targetVersion`: Target Angular version

## Known Issues

- LLM integration requires proper API configuration
- Large projects may take time to analyze
- Some complex breaking changes may need manual fixes

## Contributing

This is a development/personal project. For issues or suggestions:

1. Check the Output panel for detailed logs
2. Review the DESIGN.md for architecture details
3. Modify source files in `src/` directory
4. Test changes with F5

## Release Notes

### 0.0.1 (Initial)

- Initial skeleton with complete implementation
- Angular project detection (monorepo support)
- ts-morph TypeScript diagnostics
- Multi-provider LLM support (Copilot/Gemini/OpenAI)
- Interactive WebView UI for patch review
- Git safety mechanisms
- npm/GitHub API documentation fetching
- Unified-diff patch application

## License

See LICENSE file for details.

---

**Tip**: Check the walkthrough.md artifact for detailed implementation documentation.
