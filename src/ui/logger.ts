// logger.ts
// This module handles logging migration steps to VS Code's Output Channel
// and optionally to a persistent history file for later review.
// Provides centralized logging functionality for the Angular Upgrade Assistant extension.

import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | undefined;

/**
 * Initializes the output channel for logging.
 * Should be called during extension activation.
 */
export function initializeLogger(): void {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel('Angular Upgrade Assistant');
    }
}

/**
 * Logs an informational message to the output channel.
 * 
 * @param message - The message to log
 */
export function logInfo(message: string): void {
    if (!outputChannel) {
        initializeLogger();
    }

    const timestamp = new Date().toLocaleTimeString();
    outputChannel?.appendLine(`[${timestamp}] INFO: ${message}`);
}

/**
 * Logs a warning message to the output channel.
 * 
 * @param message - The warning message to log
 */
export function logWarning(message: string): void {
    if (!outputChannel) {
        initializeLogger();
    }

    const timestamp = new Date().toLocaleTimeString();
    outputChannel?.appendLine(`[${timestamp}] WARNING: ${message}`);
}

/**
 * Logs an error message to the output channel.
 * 
 * @param message - The error message to log
 * @param error - Optional error object to include stack trace
 */
export function logError(message: string, error?: Error): void {
    if (!outputChannel) {
        initializeLogger();
    }

    const timestamp = new Date().toLocaleTimeString();
    outputChannel?.appendLine(`[${timestamp}] ERROR: ${message}`);

    if (error) {
        outputChannel?.appendLine(`  Stack: ${error.stack || error.message}`);
    }
}

/**
 * Logs a section header to the output channel.
 * Useful for separating different phases of the migration process.
 * 
 * @param title - The section title
 */
export function logSection(title: string): void {
    if (!outputChannel) {
        initializeLogger();
    }

    const separator = '='.repeat(60);
    outputChannel?.appendLine('');
    outputChannel?.appendLine(separator);
    outputChannel?.appendLine(`  ${title.toUpperCase()}`);
    outputChannel?.appendLine(separator);
    outputChannel?.appendLine('');
}

/**
 * Clears the output channel.
 */
export function clearLog(): void {
    outputChannel?.clear();
}

/**
 * Shows the output channel to the user.
 */
export function showLog(): void {
    outputChannel?.show();
}
