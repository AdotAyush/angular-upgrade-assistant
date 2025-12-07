// extension.ts
// This module is the entry point for the Angular Upgrade Assistant VS Code extension.
// It handles activation, command registration, and orchestration of the migration workflow.
//
// Responsibilities:
// - Register extension commands
// - Initialize workspace and logger on activation
// - Coordinate the migration process
// - Handle deactivation and cleanup

import * as vscode from 'vscode';
import { initializeWorkspace } from './initializeWorkspace';
import { initializeLogger, logSection, logInfo } from './logger';

/**
 * Called when the extension is activated (first time command is executed).
 * 
 * @param context - The extension context provided by VS Code
 */
export async function activate(context: vscode.ExtensionContext) {
    console.log('[Angular Upgrade Assistant] Extension is now active');

    // Initialize the logger first
    initializeLogger();
    logInfo('Angular Upgrade Assistant extension activated');

    // Load LLM configuration from settings
    const { loadLLMConfigFromSettings } = await import('./llmClient');
    loadLLMConfigFromSettings();

    // Register the main migration command
    const startCommand = vscode.commands.registerCommand('angularUpgrade.start', async () => {
        try {
            // Initialize workspace and detect Angular project
            logSection('Initializing Workspace');
            const angularRoot = await initializeWorkspace();

            if (!angularRoot) {
                vscode.window.showErrorMessage(
                    'Angular Upgrade Assistant: Cannot start - no Angular project detected.'
                );
                return;
            }

            logInfo('Workspace initialized successfully');
            logInfo(`Angular project root: ${angularRoot}`);

            // Start the upgrade process
            await startUpgradeProcess(context);

        } catch (error: any) {
            vscode.window.showErrorMessage(
                `Angular Upgrade Assistant: ${error.message}`
            );
            console.error('[Angular Upgrade Assistant] Error:', error);
        }
    });

    // Register the configuration command
    const configureCommand = vscode.commands.registerCommand('angularUpgrade.configure', async () => {
        const config = vscode.workspace.getConfiguration('angularUpgrade');
        const currentProvider = config.get('llmProvider', 'copilot');

        const provider = await vscode.window.showQuickPick(
            [
                { label: 'GitHub Copilot', value: 'copilot', description: 'Use GitHub Copilot (requires extension)' },
                { label: 'OpenAI', value: 'openai', description: 'Use OpenAI GPT (requires API key)' },
                { label: 'Google Gemini', value: 'gemini', description: 'Use Google Gemini (requires API key)' },
                { label: 'AWS Bedrock', value: 'bedrock', description: 'Use AWS Bedrock (requires AWS credentials)' },
                { label: 'None', value: 'none', description: 'Disable LLM patch generation' }
            ],
            {
                placeHolder: `Current: ${currentProvider}. Select LLM provider:`,
                title: 'Configure LLM Provider'
            }
        );

        if (provider) {
            await config.update('llmProvider', provider.value, vscode.ConfigurationTarget.Global);

            // Prompt for API key if needed
            if (provider.value === 'openai') {
                const apiKey = await vscode.window.showInputBox({
                    prompt: 'Enter your OpenAI API key',
                    password: true,
                    placeHolder: 'sk-...'
                });
                if (apiKey) {
                    await config.update('openaiApiKey', apiKey, vscode.ConfigurationTarget.Global);
                }
            } else if (provider.value === 'gemini') {
                const apiKey = await vscode.window.showInputBox({
                    prompt: 'Enter your Google Gemini API key',
                    password: true
                });
                if (apiKey) {
                    await config.update('geminiApiKey', apiKey, vscode.ConfigurationTarget.Global);
                }
            }

            vscode.window.showInformationMessage(`LLM provider set to: ${provider.label}`);
            loadLLMConfigFromSettings();
        }
    });

    context.subscriptions.push(startCommand, configureCommand);
}

/**
 * Called when the extension is deactivated.
 * Cleanup any resources here.
 */
export function deactivate() {
    console.log('[Angular Upgrade Assistant] Extension is now deactivated');
    // TODO: Cleanup resources if needed (close ts-morph projects, etc.)
}

/**
 * Main entry point for the Angular upgrade process.
 * 
 * This function orchestrates the entire migration workflow:
 * 1. Analyze current Angular version and dependencies
 * 2. Run Angular CLI update commands
 * 3. Collect TypeScript diagnostics and errors
 * 4. Generate patches using Copilot/LLM
 * 5. Apply patches to source files
 * 6. Verify changes and run tests
 * 7. Create Git commits for safe rollback
 * 
 * TODO: Implement the actual upgrade workflow
 */
async function startUpgradeProcess(context: vscode.ExtensionContext): Promise<void> {
    const { isGitRepository, createMigrationBranch, createCheckpoint } = await import('./gitUtils');
    const { getCurrentAngularVersion, scanPackageJson, identifyAngularPackages } = await import('./dependencyScanner');
    const { runAngularUpdate, collectDiagnostics, verifyBuild } = await import('./analyzer');
    const { consolidateDocs } = await import('./docFetcher');
    const { generatePatchSuggestions, isLLMAvailable } = await import('./llmClient');
    const { applyPatch } = await import('./patcher');
    const { createMigrationPanel, updateProgress, showPatches, showSummary, waitForPatchApproval } = await import('./ui/webviewPanel');
    const { logInfo, logError, logSection, showLog } = await import('./logger');
    const { ErrorClusterer } = await import('./errorClustering/ErrorClusterer');
    const { PatternMatcher } = await import('./errorClustering/PatternMatcher');
    // const { MigrationStep } = await import('./types'); // MigrationStep type is used inline as plain object

    logSection('Starting Angular Upgrade Process');
    showLog(); // Show output channel to user

    // Track migration steps for UI
    const steps: any[] = [];

    // Create WebView panel
    const panel = createMigrationPanel(context);
    if (!panel) {
        vscode.window.showErrorMessage('Failed to create migration panel');
        return;
    }

    try {
        // Step 1: Check Git repository
        steps.push({
            id: 'git-check',
            name: 'Git Repository Check',
            status: 'in-progress',
            description: 'Checking for Git repository...'
        });
        updateProgress(panel, steps);

        const isGit = await isGitRepository();
        if (isGit) {
            await createMigrationBranch('angular-upgrade-' + Date.now());
            steps[steps.length - 1].status = 'completed';
            steps[steps.length - 1].description = 'Git branch created for migration';
        } else {
            steps[steps.length - 1].status = 'completed';
            steps[steps.length - 1].description = 'Proceeding without Git (not recommended)';
            vscode.window.showWarningMessage('No Git repository detected. Migration will proceed without version control safety.');
        }
        updateProgress(panel, steps);

        // Step 2: Analyze current state
        steps.push({
            id: 'analyze',
            name: 'Project Analysis',
            status: 'in-progress',
            description: 'Analyzing Angular project...'
        });
        updateProgress(panel, steps);

        const currentVersion = await getCurrentAngularVersion();
        const dependencies = await scanPackageJson();
        const angularPackages = identifyAngularPackages(dependencies);

        logInfo(`Current Angular version: ${currentVersion || 'Unknown'}`);
        logInfo(`Found ${angularPackages.length} Angular packages`);

        steps[steps.length - 1].status = 'completed';
        steps[steps.length - 1].description = `Analyzed ${dependencies.length} dependencies`;
        updateProgress(panel, steps);

        // Step 3: Create checkpoint
        if (isGit) {
            steps.push({
                id: 'checkpoint',
                name: 'Create Checkpoint',
                status: 'in-progress',
                description: 'Creating Git checkpoint...'
            });
            updateProgress(panel, steps);

            await createCheckpoint('Before Angular upgrade');

            steps[steps.length - 1].status = 'completed';
            steps[steps.length - 1].description = 'Checkpoint created';
            updateProgress(panel, steps);
        }

        // Step 4: Run Angular update
        steps.push({
            id: 'ng-update',
            name: 'Angular CLI Update',
            status: 'in-progress',
            description: 'Running ng update...'
        });
        updateProgress(panel, steps);

        // Get packages to update from settings (configurable)
        const config = vscode.workspace.getConfiguration('angularUpgrade');
        const packagesToUpdate = config.get<string[]>('packagesToUpdate', ['@angular/cli', '@angular/core']);

        logInfo(`Packages to update: ${packagesToUpdate.join(', ')}`);

        try {
            await runAngularUpdate(packagesToUpdate, ['--force']);
            steps[steps.length - 1].status = 'completed';
            steps[steps.length - 1].description = `Updated: ${packagesToUpdate.join(', ')}`;
        } catch (error: any) {
            steps[steps.length - 1].status = 'completed';
            steps[steps.length - 1].description = 'Update completed with warnings';
        }
        updateProgress(panel, steps);

        // Step 5: Collect diagnostics
        steps.push({
            id: 'diagnostics',
            name: 'Collect Diagnostics',
            status: 'in-progress',
            description: 'Analyzing TypeScript errors...'
        });
        updateProgress(panel, steps);

        const conflicts = await collectDiagnostics();
        const errors = conflicts.filter(c => c.severity === 'error');

        steps[steps.length - 1].status = 'completed';
        steps[steps.length - 1].description = `Found ${errors.length} errors`;
        updateProgress(panel, steps);

        if (errors.length === 0) {
            showSummary(panel, {
                patchesApplied: 0,
                errorsFixed: 0,
                remainingIssues: 0,
                message: '✓ Migration completed successfully with no errors!'
            });
            return;
        }

        // Step 6: Cluster Errors (Tier 1 Preparation)
        steps.push({
            id: 'clustering',
            name: 'Cluster Errors',
            status: 'in-progress',
            description: 'Grouping similar errors...'
        });
        updateProgress(panel, steps);

        const clusterer = new ErrorClusterer();
        const clusters = clusterer.clusterErrors(errors);

        logInfo(`Grouped ${errors.length} errors into ${clusters.length} clusters`);

        steps[steps.length - 1].status = 'completed';
        steps[steps.length - 1].description = `Grouped into ${clusters.length} patterns`;
        updateProgress(panel, steps);

        // Step 7: Apply Tier 1 Fixes (Pattern Matching)
        steps.push({
            id: 'tier1-fixes',
            name: 'Apply Pattern Fixes (Tier 1)',
            status: 'in-progress',
            description: 'Applying known pattern fixes...'
        });
        updateProgress(panel, steps);

        const patternMatcher = new PatternMatcher();
        let tier1PatchesApplied = 0;
        const remainingClusters = [];

        for (const cluster of clusters) {
            const pattern = patternMatcher.matchPattern(cluster);

            if (pattern) {
                logInfo(`Cluster ${cluster.id} matches pattern: ${pattern.name}`);
                const patches = patternMatcher.generateFixes(cluster, pattern);

                if (patches.length > 0) {
                    // Show patches to user for approval (batch approval for patterns)
                    showPatches(panel, patches);
                    const approved = await waitForPatchApproval(0);

                    if (approved) {
                        for (const patch of patches) {
                            const success = await applyPatch(patch.filePath, patch);
                            if (success) tier1PatchesApplied++;
                        }
                    }
                }
            } else {
                remainingClusters.push(cluster);
            }
        }

        steps[steps.length - 1].status = 'completed';
        steps[steps.length - 1].description = `Applied ${tier1PatchesApplied} pattern fixes`;
        updateProgress(panel, steps);

        // Step 8: Apply Tier 2 Fixes (LLM)
        if (remainingClusters.length > 0) {
            steps.push({
                id: 'tier2-fixes',
                name: 'Apply LLM Fixes (Tier 2)',
                status: 'in-progress',
                description: 'Generating AI fixes for complex errors...'
            });
            updateProgress(panel, steps);

            const llmAvailable = await isLLMAvailable();
            if (!llmAvailable) {
                vscode.window.showWarningMessage('LLM not available. Skipping Tier 2 fixes.');
            } else {
                let tier2PatchesApplied = 0;
                const maxPatchesPerRun = config.get<number>('maxPatchesPerRun', 10);
                let patchesGenerated = 0;

                for (const cluster of remainingClusters) {
                    if (patchesGenerated >= maxPatchesPerRun) break;

                    // Use the representative error for LLM context
                    const error = cluster.representative;
                    const docs = await consolidateDocs('@angular/core', currentVersion || '18.0.0', '19.0.0');
                    const codeSnippet = `// Error at ${error.filePath}:${error.lineNumber}\n// Message: ${error.message}`;

                    const patches = await generatePatchSuggestions(error.message, codeSnippet, docs);

                    if (patches.length > 0) {
                        // Apply to all instances in cluster if possible, or just the representative
                        // For now, let's just apply to the representative to be safe
                        showPatches(panel, patches);
                        const approved = await waitForPatchApproval(0);

                        if (approved && patches[0].filePath !== 'unknown') {
                            const success = await applyPatch(patches[0].filePath, patches[0]);
                            if (success) {
                                tier2PatchesApplied++;
                                patchesGenerated++;
                            }
                        }
                    }
                }

                steps[steps.length - 1].description = `Applied ${tier2PatchesApplied} AI fixes`;
            }
            steps[steps.length - 1].status = 'completed';
            updateProgress(panel, steps);
        }

        // Step 9: Verify Build
        steps.push({
            id: 'verify',
            name: 'Verify Build',
            status: 'in-progress',
            description: 'Verifying changes...'
        });
        updateProgress(panel, steps);

        const buildSuccess = await verifyBuild();
        const remainingErrors = await collectDiagnostics();
        const remainingErrorCount = remainingErrors.filter(c => c.severity === 'error').length;

        steps[steps.length - 1].status = buildSuccess ? 'completed' : 'failed';
        steps[steps.length - 1].description = buildSuccess ? 'Build successful' : `${remainingErrorCount} errors remain`;
        updateProgress(panel, steps);

        // Show final summary
        showSummary(panel, {
            patchesApplied: tier1PatchesApplied + (steps.find(s => s.id === 'tier2-fixes')?.description.match(/(\d+)/)?.[1] || 0),
            errorsFixed: errors.length - remainingErrorCount,
            remainingIssues: remainingErrorCount,
            message: buildSuccess
                ? '✓ Migration completed successfully!'
                : `Migration completed. ${remainingErrorCount} errors require manual fixes.`
        });

    } catch (error: any) {
        logError('Migration process failed', error);
        vscode.window.showErrorMessage(`Migration failed: ${error.message}`);

        showSummary(panel, {
            patchesApplied: 0,
            errorsFixed: 0,
            remainingIssues: 0,
            message: `✗ Migration failed: ${error.message}`
        });
    }
}
