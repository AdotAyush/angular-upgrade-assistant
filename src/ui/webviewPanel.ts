// webviewPanel.ts
// This module manages the WebView panel for displaying migration progress,
// patches, logs, and interactive controls to the user.

import * as vscode from 'vscode';
import { Patch, MigrationStep } from '../types';

let currentPanel: vscode.WebviewPanel | undefined;

/**
 * Creates and shows the main migration WebView panel.
 * 
 * @param context - Extension context for resource URIs
 * @returns The created WebView panel or undefined on failure
 */
export function createMigrationPanel(context: vscode.ExtensionContext): vscode.WebviewPanel | undefined {
    // If panel already exists, reveal it
    if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.One);
        return currentPanel;
    }

    // Create new panel
    currentPanel = vscode.window.createWebviewPanel(
        'angularMigration',
        'Angular Migration Assistant',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    // Set HTML content
    currentPanel.webview.html = getWebviewContent();

    // Handle messages from webview
    currentPanel.webview.onDidReceiveMessage(
        message => {
            handleWebviewMessage(message);
        },
        undefined,
        context.subscriptions
    );

    // Handle panel disposal
    currentPanel.onDidDispose(
        () => {
            currentPanel = undefined;
        },
        undefined,
        context.subscriptions
    );

    return currentPanel;
}

/**
 * Updates the migration progress display in the WebView.
 * 
 * @param panel - The WebView panel
 * @param steps - Array of migration steps with status
 */
export function updateProgress(panel: vscode.WebviewPanel, steps: MigrationStep[]): void {
    panel.webview.postMessage({
        command: 'updateProgress',
        steps: steps
    });
}

/**
 * Displays patch suggestions in the WebView for user review.
 * 
 * @param panel - The WebView panel
 * @param patches - Array of patches to display
 */
export function showPatches(panel: vscode.WebviewPanel, patches: Patch[]): void {
    panel.webview.postMessage({
        command: 'showPatches',
        patches: patches
    });
}

/**
 * Displays a summary of the migration results.
 * 
 * @param panel - The WebView panel
 * @param summary - Summary data object
 */
export function showSummary(panel: vscode.WebviewPanel, summary: any): void {
    panel.webview.postMessage({
        command: 'showSummary',
        summary: summary
    });
}

/**
 * Handles messages received from the WebView.
 * 
 * @param message - Message object from webview
 */
function handleWebviewMessage(message: any): void {
    switch (message.command) {
        case 'approvePatch':
            handlePatchApproval(message.patchIndex, true);
            break;

        case 'rejectPatch':
            handlePatchApproval(message.patchIndex, false);
            break;

        case 'retryMigration':
            handleRetryMigration();
            break;

        case 'cancelMigration':
            handleCancelMigration();
            break;
    }
}

// Callback storage for patch approvals
let patchApprovalCallback: ((approved: boolean, patchIndex: number) => void) | undefined;

/**
 * Waits for user approval on a patch.
 * 
 * @param patchIndex - Index of the patch awaiting approval
 * @returns Promise resolving to true if approved, false if rejected
 */
export function waitForPatchApproval(patchIndex: number): Promise<boolean> {
    return new Promise((resolve) => {
        patchApprovalCallback = (approved: boolean, index: number) => {
            if (index === patchIndex) {
                resolve(approved);
                patchApprovalCallback = undefined;
            }
        };
    });
}

/**
 * Handles patch approval/rejection from user.
 */
function handlePatchApproval(patchIndex: number, approved: boolean): void {
    if (patchApprovalCallback) {
        patchApprovalCallback(approved, patchIndex);
    }
}

/**
 * Handles retry migration request.
 */
function handleRetryMigration(): void {
    vscode.commands.executeCommand('angularUpgrade.start');
}

/**
 * Handles cancel migration request.
 */
function handleCancelMigration(): void {
    if (currentPanel) {
        currentPanel.dispose();
    }
}

/**
 * Gets the HTML content for the WebView.
 * 
 * @returns HTML string for the webview
 */
function getWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Angular Migration Assistant</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        
        h1 {
            color: var(--vscode-titleBar-activeForeground);
            border-bottom: 2px solid var(--vscode-panel-border);
            padding-bottom: 10px;
        }
        
        .section {
            margin: 20px 0;
            padding: 15px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        
        .step {
            display: flex;
            align-items: center;
            padding: 10px;
            margin: 5px 0;
            border-radius: 3px;
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .step-icon {
            width: 24px;
            height: 24px;
            margin-right: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .step-pending { opacity: 0.6; }
        .step-in-progress { color: var(--vscode-terminal-ansiYellow); }
        .step-completed { color: var(--vscode-terminal-ansiGreen); }
        .step-failed { color: var(--vscode-terminal-ansiRed); }
        
        .patch {
            margin: 15px 0;
            padding: 15px;
            background-color: var(--vscode-textCodeBlock-background);
            border-left: 4px solid var(--vscode-textLink-foreground);
            border-radius: 4px;
        }
        
        .patch-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        
        .patch-diff {
            font-family: monospace;
            font-size: 0.9em;
            white-space: pre-wrap;
            overflow-x: auto;
            padding: 10px;
            background-color: var(--vscode-editor-background);
            border-radius: 3px;
            margin: 10px 0;
        }
        
        .diff-addition { color: var(--vscode-terminal-ansiGreen); }
        .diff-removal { color: var(--vscode-terminal-ansiRed); }
        .diff-context { color: var(--vscode-foreground); opacity: 0.7; }
        
        button {
            padding: 8px 16px;
            margin: 0 5px;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 14px;
        }
        
        .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .btn-primary:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .summary-stat {
            display: inline-block;
            margin: 10px 15px;
            padding: 10px;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 4px;
        }
        
        .hidden { display: none; }
    </style>
</head>
<body>
    <h1>🚀 Angular Migration Assistant</h1>
    
    <div id="progressSection" class="section">
        <h2>Migration Progress</h2>
        <div id="progressSteps"></div>
    </div>
    
    <div id="patchesSection" class="section hidden">
        <h2>Patch Review</h2>
        <p>Review and approve the following patches:</p>
        <div id="patchesList"></div>
    </div>
    
    <div id="summarySection" class="section hidden">
        <h2>Migration Summary</h2>
        <div id="summaryContent"></div>
        <div style="margin-top: 20px;">
            <button class="btn-primary" onclick="retryMigration()">Run Again</button>
            <button class="btn-secondary" onclick="close()">Close</button>
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'updateProgress':
                    updateProgressDisplay(message.steps);
                    break;
                
                case 'showPatches':
                    showPatchesDisplay(message.patches);
                    break;
                
                case 'showSummary':
                    showSummaryDisplay(message.summary);
                    break;
            }
        });
        
        function updateProgressDisplay(steps) {
            const container = document.getElementById('progressSteps');
            container.innerHTML = steps.map(step => {
                const icon = getStatusIcon(step.status);
                return \`
                    <div class="step step-\${step.status}">
                        <span class="step-icon">\${icon}</span>
                        <span><strong>\${step.name}</strong>: \${step.description}</span>
                    </div>
                \`;
            }).join('');
        }
        
        function getStatusIcon(status) {
            switch(status) {
                case 'completed': return '✓';
                case 'in-progress': return '⟳';
                case 'failed': return '✗';
                default: return '○';
            }
        }
        
        function showPatchesDisplay(patches) {
            document.getElementById('progressSection').classList.add('hidden');
            document.getElementById('patchesSection').classList.remove('hidden');
            
            const container = document.getElementById('patchesList');
            container.innerHTML = patches.map((patch, index) => {
                return \`
                    <div class="patch">
                        <div class="patch-header">
                            <strong>\${patch.filePath}</strong>
                        </div>
                        <p>\${patch.description}</p>
                        <div class="patch-diff">\${formatDiff(patch.diff)}</div>
                        <div>
                            <button class="btn-primary" onclick="approvePatch(\${index})">✓ Approve</button>
                            <button class="btn-secondary" onclick="rejectPatch(\${index})">✗ Reject</button>
                        </div>
                    </div>
                \`;
            }).join('');
        }
        
        function formatDiff(diff) {
            return diff.split('\\n').map(line => {
                if (line.startsWith('+')) {
                    return \`<span class="diff-addition">\${line}</span>\`;
                } else if (line.startsWith('-')) {
                    return \`<span class="diff-removal">\${line}</span>\`;
                } else {
                    return \`<span class="diff-context">\${line}</span>\`;
                }
            }).join('\\n');
        }
        
        function showSummaryDisplay(summary) {
            document.getElementById('patchesSection').classList.add('hidden');
            document.getElementById('summarySection').classList.remove('hidden');
            
            const container = document.getElementById('summaryContent');
            container.innerHTML = \`
                <div class="summary-stat">
                    <strong>Patches Applied:</strong> \${summary.patchesApplied || 0}
                </div>
                <div class="summary-stat">
                    <strong>Errors Fixed:</strong> \${summary.errorsFixed || 0}
                </div>
                <div class="summary-stat">
                    <strong>Remaining Issues:</strong> \${summary.remainingIssues || 0}
                </div>
                <p style="margin-top: 20px;">\${summary.message || 'Migration completed!'}</p>
            \`;
        }
        
        function approvePatch(index) {
            vscode.postMessage({ command: 'approvePatch', patchIndex: index });
        }
        
        function rejectPatch(index) {
            vscode.postMessage({ command: 'rejectPatch', patchIndex: index });
        }
        
        function retryMigration() {
            vscode.postMessage({ command: 'retryMigration' });
        }
        
        function close() {
            vscode.postMessage({ command: 'cancelMigration' });
        }
    </script>
</body>
</html>`;
}
