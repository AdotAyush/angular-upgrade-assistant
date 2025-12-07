// initializeWorkspace.ts
// This module handles workspace initialization for the Angular Upgrade Assistant extension.
// Responsibilities:
// - Detects the Angular project root within the workspace (handles monorepos)
// - Initializes a ts-morph Project instance loaded with the Angular project's TypeScript configuration
// - Exports the Angular root path and ts-morph Project for use throughout the extension

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Project } from 'ts-morph';
import { findAngularProjectRoot } from './projectLocator';

/**
 * Stores the detected Angular project root path.
 * This variable is set during workspace initialization and can be imported by other modules.
 */
export let angularRoot: string | null = null;

/**
 * Stores the ts-morph Project instance for TypeScript analysis.
 * Initialized with the Angular project's tsconfig.json.
 */
export let project: Project | null = null;

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
    // Get the workspace folders from VS Code
    const workspaceFolders = vscode.workspace.workspaceFolders;

    // Check if a workspace is open
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage(
            'Angular Upgrade Assistant: No workspace folder is open. Please open a folder containing an Angular project.'
        );
        return null;
    }

    // Get the first workspace folder (primary workspace root)
    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    // Search for the Angular project root
    angularRoot = findAngularProjectRoot(workspaceRoot);

    // Handle the result
    if (angularRoot) {
        // Success: Angular project found
        const relativePath = angularRoot.replace(workspaceRoot, '').replace(/^[\/\\]/, '') || '(workspace root)';

        vscode.window.showInformationMessage(
            `Angular Upgrade Assistant: Angular project detected at "${relativePath}"`
        );

        console.log(`[Angular Upgrade Assistant] Angular project root: ${angularRoot}`);

        // Initialize ts-morph Project
        const tsconfigPath = path.join(angularRoot, 'tsconfig.json');

        if (fs.existsSync(tsconfigPath)) {
            try {
                project = new Project({
                    tsConfigFilePath: tsconfigPath
                });

                // Add source files from tsconfig
                project.addSourceFilesFromTsConfig(tsconfigPath);

                console.log(`[Angular Upgrade Assistant] ts-morph Project initialized with ${project.getSourceFiles().length} files`);
            } catch (error) {
                vscode.window.showWarningMessage(
                    `Angular Upgrade Assistant: Failed to load TypeScript configuration. ${error}`
                );
                console.error('[Angular Upgrade Assistant] ts-morph initialization failed:', error);
            }
        } else {
            vscode.window.showWarningMessage(
                'Angular Upgrade Assistant: tsconfig.json not found in Angular project root.'
            );
        }
    } else {
        // Failure: No Angular project found
        vscode.window.showWarningMessage(
            'Angular Upgrade Assistant: No Angular project found in this workspace. ' +
            'Please ensure the workspace contains a project with angular.json or package.json with @angular/core.'
        );

        console.warn('[Angular Upgrade Assistant] No Angular project detected in workspace');
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
export function getProject(): Project | null {
    return project;
}
