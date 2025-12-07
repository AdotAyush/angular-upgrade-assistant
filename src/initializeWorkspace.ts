// initializeWorkspace.ts
// This module handles workspace initialization for the Angular Upgrade Assistant extension.
// Responsibilities:
// - Detects the Angular project root within the workspace (handles monorepos)
// - Initializes a ts-morph Project instance loaded with the Angular project's TypeScript configuration
// - Exports the Angular root path and ts-morph Project for use throughout the extension

import * as vscode from 'vscode';
import { findAngularProjectRoot } from './projectLocator';
import { AngularAST } from './ast/AngularAST';

/**
 * Stores the detected Angular project root path.
 * This variable is set during workspace initialization and can be imported by other modules.
 */
export let angularRoot: string | null = null;

/**
 * Stores the AngularAST instance.
 */
export let angularAST: AngularAST | null = null;

/**
 * Initializes the workspace by detecting the Angular project root directory
 * and loading the TypeScript project using ts-morph.
 * 
 * This function should be called during extension activation.
 * It will:
 * 1. Get the VS Code workspace root folder
 * 2. Search for the Angular project root (handles monorepos)
 * 3. Initialize ts-morph Project with the Angular project's tsconfig.json
 * 4. Store the detected path and Project instance for use throughout the extension
 * 5. Show a notification to the user with the detected path
 * 
 * @returns The detected Angular project root path, or null if not found
 */
export async function initializeWorkspace(): Promise<string | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage(
            'Angular Upgrade Assistant: No workspace folder is open.'
        );
        return null;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    angularRoot = findAngularProjectRoot(workspaceRoot);

    if (angularRoot) {
        const relativePath = angularRoot.replace(workspaceRoot, '').replace(/^[\/\\]/, '') || '(workspace root)';

        vscode.window.showInformationMessage(
            `Angular Upgrade Assistant: Angular project detected at "${relativePath}"`
        );

        console.log(`[Angular Upgrade Assistant] Angular project root: ${angularRoot} `);

        // Initialize AngularAST
        angularAST = new AngularAST(angularRoot);
        const success = await angularAST.initialize();

        if (!success) {
            vscode.window.showWarningMessage(
                'Angular Upgrade Assistant: Failed to initialize TypeScript analysis.'
            );
        }
    } else {
        vscode.window.showWarningMessage(
            'Angular Upgrade Assistant: No Angular project found.'
        );
    }

    return angularRoot;
}

/**
 * Gets the current Angular project root path.
 * 
 * @returns The Angular project root path, or null if not available
 */
export function getAngularRoot(): string | null {
    return angularRoot;
}

/**
 * Gets the ts-morph Project instance.
 * 
 * @returns The ts-morph Project instance, or null if not initialized
 */
export function getAngularAST(): AngularAST | null {
    return angularAST;
}
