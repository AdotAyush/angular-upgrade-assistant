// analyzer.ts
// This module is responsible for running Angular CLI commands like `ng update`
// and collecting TypeScript diagnostics after the upgrade.
// It provides the core analysis functionality for detecting migration issues.

import { runNgCommand } from './cliRunner';
import { getProject } from './initializeWorkspace';
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
 * Uses ts-morph to get semantic and syntactic diagnostics.
 * 
 * @returns Promise resolving to an array of Conflict objects
 */
export async function collectDiagnostics(): Promise<Conflict[]> {
    logSection('Collecting TypeScript Diagnostics');

    const project = getProject();

    if (!project) {
        logError('Cannot collect diagnostics: ts-morph Project not initialized');
        return [];
    }

    const conflicts: Conflict[] = [];
    const sourceFiles = project.getSourceFiles();

    logInfo(`Analyzing ${sourceFiles.length} TypeScript files...`);

    for (const sourceFile of sourceFiles) {
        // Skip node_modules files
        if (sourceFile.getFilePath().includes('node_modules')) {
            continue;
        }

        // Get semantic diagnostics (type errors)
        const semanticDiagnostics = sourceFile.getPreEmitDiagnostics();

        for (const diagnostic of semanticDiagnostics) {
            const conflict = convertDiagnosticToConflict(sourceFile.getFilePath(), diagnostic);
            if (conflict) {
                conflicts.push(conflict);
            }
        }
    }

    logInfo(`Found ${conflicts.length} diagnostic issues`);

    // Log summary by severity
    const errors = conflicts.filter(c => c.severity === 'error').length;
    const warnings = conflicts.filter(c => c.severity === 'warning').length;
    const infos = conflicts.filter(c => c.severity === 'info').length;

    logInfo(`Errors: ${errors}, Warnings: ${warnings}, Info: ${infos}`);

    return conflicts;
}

/**
 * Converts a ts-morph Diagnostic to a Conflict object.
 * 
 * @param filePath - The file path where the diagnostic occurred
 * @param diagnostic - The ts-morph diagnostic
 * @returns A Conflict object or null if diagnostic should be ignored
 */
function convertDiagnosticToConflict(filePath: string, diagnostic: any): Conflict | null {
    try {
        // Get message text
        const message = diagnostic.getMessageText();
        const messageText = typeof message === 'string' ? message : message.getMessageText();

        // Get line number using ts-morph API
        // ts-morph diagnostics have getLineNumber() method that returns 1-indexed line number
        let lineNumber = 1;

        if (diagnostic.getLineNumber) {
            lineNumber = diagnostic.getLineNumber();
        } else if (diagnostic.getStart) {
            // Fallback: calculate from start position
            const start = diagnostic.getStart();
            const sourceFile = diagnostic.getSourceFile();

            if (sourceFile && start !== undefined) {
                // Use ts-morph SourceFile's getLineAndColumnAtPos method
                const lineAndCol = sourceFile.getLineAndColumnAtPos(start);
                lineNumber = lineAndCol.line;
            }
        }

        // Map ts-morph diagnostic category to severity
        let severity: 'error' | 'warning' | 'info';
        const category = diagnostic.getCategory();

        // ts-morph uses TypeScript's DiagnosticCategory enum
        // 0 = Warning, 1 = Error, 2 = Suggestion, 3 = Message
        switch (category) {
            case 1:
                severity = 'error';
                break;
            case 0:
                severity = 'warning';
                break;
            default:
                severity = 'info';
        }

        return {
            filePath,
            lineNumber,
            message: messageText,
            severity
        };
    } catch (error: any) {
        logError('Error converting diagnostic to conflict', error);
        return null;
    }
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
