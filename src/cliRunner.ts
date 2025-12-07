// cliRunner.ts
// This module provides utilities for executing Angular CLI and Git commands.
// All commands are executed with the correct working directory (angularRoot) to ensure
// they run in the context of the detected Angular project, not the workspace root.
// This is critical for monorepo scenarios where the workspace root differs from the Angular project root.

import { execSync } from 'child_process';
import { angularRoot } from './initializeWorkspace';
import { logInfo, logError } from './logger';

/**
 * Executes an Angular CLI command in the detected Angular project directory.
 * 
 * Example usage:
 *   runNgCommand('ng update @angular/core')
 *   runNgCommand('ng build --prod')
 * 
 * @param cmd - The Angular CLI command to execute (including 'ng' prefix)
 * @returns The stdout output as a string
 * @throws Error if the command fails or if angularRoot is not initialized
 */
export function runNgCommand(cmd: string): string {
    if (!angularRoot) {
        const error = 'Cannot run Angular CLI command: Angular project root not initialized';
        logError(error);
        throw new Error(error);
    }

    logInfo(`Executing Angular CLI command: ${cmd}`);
    logInfo(`Working directory: ${angularRoot}`);

    try {
        const output = execSync(cmd, {
            cwd: angularRoot,
            encoding: 'utf-8',
            stdio: 'pipe'
        });

        logInfo(`Command completed successfully`);
        return output;
    } catch (error: any) {
        const errorMessage = `Angular CLI command failed: ${cmd}`;
        logError(errorMessage, error);

        // Log stderr if available
        if (error.stderr) {
            logError(`stderr: ${error.stderr.toString()}`);
        }

        throw error;
    }
}

/**
 * Executes a Git command in the detected Angular project directory.
 * 
 * Example usage:
 *   runGitCommand('git status')
 *   runGitCommand('git checkout -b feature-branch')
 * 
 * @param cmd - The Git command to execute (including 'git' prefix)
 * @returns The stdout output as a string
 * @throws Error if the command fails or if angularRoot is not initialized
 */
export function runGitCommand(cmd: string): string {
    if (!angularRoot) {
        const error = 'Cannot run Git command: Angular project root not initialized';
        logError(error);
        throw new Error(error);
    }

    logInfo(`Executing Git command: ${cmd}`);
    logInfo(`Working directory: ${angularRoot}`);

    try {
        const output = execSync(cmd, {
            cwd: angularRoot,
            encoding: 'utf-8',
            stdio: 'pipe'
        });

        logInfo(`Git command completed successfully`);
        return output;
    } catch (error: any) {
        const errorMessage = `Git command failed: ${cmd}`;
        logError(errorMessage, error);

        // Log stderr if available
        if (error.stderr) {
            logError(`stderr: ${error.stderr.toString()}`);
        }

        throw error;
    }
}
