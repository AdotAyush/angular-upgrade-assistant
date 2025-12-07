// analyzer.ts
// This module is responsible for running Angular CLI commands like `ng update`
// and collecting TypeScript diagnostics after the upgrade.
// It provides the core analysis functionality for detecting migration issues.

import { runNgCommand } from './cliRunner';
import { getAngularAST } from './initializeWorkspace';
import { logInfo, logError, logSection } from './logger';
import { Conflict } from './types';

/**
 * Runs Angular CLI update command for specified packages.
 * 
 * @param packages - Array of package names to update (e.g., ['@angular/core', '@angular/cli'])
 * @param options - Additional options like '--next' for prerelease versions
 * @returns Promise resolving to the command output
 */
export async function runAngularUpdate(packages: string[], options: string[] = []): Promise<string> {
    logSection('Running Angular CLI Update');

    const packageList = packages.join(' ');
    const optionsList = options.join(' ');
    const command = `ng update ${packageList} ${optionsList}`.trim();

    logInfo(`Updating packages: ${packageList}`);
    if (optionsList) {
        logInfo(`Options: ${optionsList}`);
    }

    try {
        const output = runNgCommand(command);
        logInfo('Angular update completed successfully');
        return output;
    } catch (error: any) {
        logError('Angular update failed', error);
        throw error;
    }
}

/**
 * Collects TypeScript diagnostics from the workspace after upgrade.
 * Uses AngularAST to get semantic and syntactic diagnostics.
 * 
 * @returns Promise resolving to an array of Conflict objects
 */
export async function collectDiagnostics(): Promise<Conflict[]> {
    logSection('Collecting TypeScript Diagnostics');

    const angularAST = getAngularAST();

    if (!angularAST) {
        logError('Cannot collect diagnostics: AngularAST not initialized');
        return [];
    }

    const conflicts = angularAST.getDiagnostics();

    logInfo(`Found ${conflicts.length} diagnostic issues`);

    // Log summary by severity
    const errors = conflicts.filter(c => c.severity === 'error').length;
    const warnings = conflicts.filter(c => c.severity === 'warning').length;
    const infos = conflicts.filter(c => c.severity === 'info').length;

    logInfo(`Errors: ${errors}, Warnings: ${warnings}, Info: ${infos}`);

    return conflicts;
}

/**
 * Analyzes breaking changes between Angular versions.
 * Compares package.json versions to identify potential compatibility issues.
 * 
 * @param fromVersion - Starting Angular version (e.g., '18.0.0')
 * @param toVersion - Target Angular version (e.g., '19.0.0')
 * @returns Promise resolving to an array of breaking change descriptions
 */
export async function analyzeBreakingChanges(fromVersion: string, toVersion: string): Promise<string[]> {
    logSection('Analyzing Breaking Changes');

    logInfo(`Comparing Angular ${fromVersion} → ${toVersion}`);

    const breakingChanges: string[] = [];

    // Parse major versions
    const fromMajor = parseInt(fromVersion.split('.')[0], 10);
    const toMajor = parseInt(toVersion.split('.')[0], 10);

    if (toMajor > fromMajor) {
        breakingChanges.push(`Major version upgrade detected: v${fromMajor} → v${toMajor}`);
        logInfo(`Major version change: This may include breaking changes`);
    } else {
        logInfo(`Minor/patch version change: Breaking changes less likely`);
    }

    // Common Angular breaking changes to look for
    const knownBreakingChanges = [
        {
            fromVersion: 18,
            toVersion: 19,
            changes: [
                'Standalone components are now the default',
                'NgModules are deprecated',
                'Dependency injection changes',
                'Router configuration updates'
            ]
        },
        {
            fromVersion: 17,
            toVersion: 18,
            changes: [
                'Control flow syntax (@if, @for)',
                'Deferrable views',
                'Built-in hydration'
            ]
        }
    ];

    // Find applicable breaking changes
    for (const item of knownBreakingChanges) {
        if (fromMajor === item.fromVersion && toMajor === item.toVersion) {
            breakingChanges.push(...item.changes);
            logInfo(`Found ${item.changes.length} known breaking changes for this upgrade`);
        }
    }

    if (breakingChanges.length === 0) {
        logInfo('No known breaking changes identified');
    }

    return breakingChanges;
}

/**
 * Runs a diagnostic check on the project (compile without emitting).
 * Useful for verifying if patches have resolved issues.
 * 
 * @returns Promise resolving to true if no errors, false if errors exist
 */
export async function verifyBuild(): Promise<boolean> {
    logInfo('Verifying build...');

    const diagnostics = await collectDiagnostics();
    const errors = diagnostics.filter(d => d.severity === 'error');

    if (errors.length === 0) {
        logInfo('✓ Build verification passed - no errors');
        return true;
    } else {
        logError(`✗ Build verification failed - ${errors.length} errors remain`);
        return false;
    }
}
