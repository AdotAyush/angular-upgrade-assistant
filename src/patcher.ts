// patcher.ts
// This module applies unified-diff format patches to workspace files.
// It handles patch validation, conflict detection, and safe file modifications.

import * as fs from 'fs';
import * as path from 'path';
import { logInfo, logError, logSection } from './logger';
import { Patch } from './types';

/**
 * Applies a unified-diff patch to a file.
 * 
 * @param filePath - Absolute path to the file
 * @param patch - Patch object containing diff and metadata
 * @returns Promise resolving to true on success, false on failure
 */
export async function applyPatch(filePath: string, patch: Patch): Promise<boolean> {
    logInfo(`Applying patch to: ${filePath}`);

    if (!fs.existsSync(filePath)) {
        logError(`File not found: ${filePath}`);
        return false;
    }

    try {
        // Read current file content
        const fileContent = fs.readFileSync(filePath, 'utf-8');

        // Validate that patch can be applied
        if (!validatePatch(fileContent, patch)) {
            logError('Patch validation failed - cannot apply');
            return false;
        }

        // Apply the patch
        const patchedContent = applyUnifiedDiff(fileContent, patch.diff);

        if (patchedContent === null) {
            logError('Failed to apply unified-diff');
            return false;
        }

        // Write patched content back to file
        fs.writeFileSync(filePath, patchedContent, 'utf-8');

        logInfo(`✓ Patch applied successfully to ${path.basename(filePath)}`);
        return true;

    } catch (error: any) {
        logError(`Failed to apply patch to ${filePath}`, error);
        return false;
    }
}

/**
 * Validates that a patch can be applied without conflicts.
 * 
 * @param fileContent - Current file content
 * @param patch - Patch to validate
 * @returns True if patch can be applied, false otherwise
 */
export function validatePatch(fileContent: string, patch: Patch): boolean {
    try {
        // Parse the unified diff
        const diffLines = patch.diff.split('\n');
        const fileLines = fileContent.split('\n');

        // Find hunk headers (@@ -start,count +start,count @@)
        const hunkPattern = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/;

        for (let i = 0; i < diffLines.length; i++) {
            const line = diffLines[i];
            const match = line.match(hunkPattern);

            if (match) {
                const oldStart = parseInt(match[1], 10);
                const oldCount = match[2] ? parseInt(match[2], 10) : 1;

                // Validate that the context lines match
                let hunkLine = i + 1;
                let fileLine = oldStart - 1; // Convert to 0-indexed

                while (hunkLine < diffLines.length && diffLines[hunkLine].startsWith(' ')) {
                    const contextLine = diffLines[hunkLine].substring(1);

                    if (fileLine >= fileLines.length || fileLines[fileLine] !== contextLine) {
                        logError(`Context mismatch at line ${fileLine + 1}`);
                        return false;
                    }

                    hunkLine++;
                    fileLine++;
                }
            }
        }

        return true;

    } catch (error: any) {
        logError('Patch validation error', error);
        return false;
    }
}

/**
 * Applies a unified-diff to file content.
 * 
 * @param content - Original file content
 * @param diff - Unified-diff string
 * @returns Patched content or null on failure
 */
function applyUnifiedDiff(content: string, diff: string): string | null {
    try {
        const lines = content.split('\n');
        const diffLines = diff.split('\n');

        // Parse hunks from the diff
        const hunks = parseUnifiedDiff(diffLines);

        // Apply hunks in reverse order (to preserve line numbers)
        hunks.reverse();

        for (const hunk of hunks) {
            // Apply removals and additions
            const startLine = hunk.oldStart - 1; // Convert to 0-indexed

            // Remove old lines
            if (hunk.removals.length > 0) {
                lines.splice(startLine, hunk.removals.length);
            }

            // Insert new lines
            if (hunk.additions.length > 0) {
                lines.splice(startLine, 0, ...hunk.additions);
            }
        }

        return lines.join('\n');

    } catch (error: any) {
        logError('Failed to apply unified-diff', error);
        return null;
    }
}

/**
 * Parses unified-diff format into structured hunks.
 * 
 * @param diffLines - Array of diff lines
 * @returns Array of parsed hunks
 */
function parseUnifiedDiff(diffLines: string[]): Array<{
    oldStart: number;
    oldCount: number;
    newStart: number;
    newCount: number;
    removals: string[];
    additions: string[];
}> {
    const hunks: Array<any> = [];
    const hunkPattern = /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/;

    let currentHunk: any = null;

    for (const line of diffLines) {
        const match = line.match(hunkPattern);

        if (match) {
            // Save previous hunk if exists
            if (currentHunk) {
                hunks.push(currentHunk);
            }

            // Start new hunk
            currentHunk = {
                oldStart: parseInt(match[1], 10),
                oldCount: match[2] ? parseInt(match[2], 10) : 1,
                newStart: parseInt(match[3], 10),
                newCount: match[4] ? parseInt(match[4], 10) : 1,
                removals: [],
                additions: []
            };
        } else if (currentHunk) {
            if (line.startsWith('-') && !line.startsWith('---')) {
                currentHunk.removals.push(line.substring(1));
            } else if (line.startsWith('+') && !line.startsWith('+++')) {
                currentHunk.additions.push(line.substring(1));
            }
            // Ignore context lines (starting with space)
        }
    }

    // Save last hunk
    if (currentHunk) {
        hunks.push(currentHunk);
    }

    return hunks;
}

/**
 * Reverts a previously applied patch.
 * 
 * @param filePath - Path to the file
 * @param patch - Patch to revert
 * @returns Promise resolving to true on success
 */
export async function revertPatch(filePath: string, patch: Patch): Promise<boolean> {
    logInfo(`Reverting patch from: ${filePath}`);

    try {
        // Create a reverse patch by swapping additions and removals
        const reverseDiff = createReverseDiff(patch.diff);

        const reversePatch: Patch = {
            ...patch,
            diff: reverseDiff
        };

        return await applyPatch(filePath, reversePatch);

    } catch (error: any) {
        logError(`Failed to revert patch from ${filePath}`, error);
        return false;
    }
}

/**
 * Creates a reverse diff by swapping + and - lines.
 * 
 * @param diff - Original unified-diff
 * @returns Reversed unified-diff
 */
function createReverseDiff(diff: string): string {
    const lines = diff.split('\n');
    const reversedLines: string[] = [];

    for (const line of lines) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
            reversedLines.push('-' + line.substring(1));
        } else if (line.startsWith('-') && !line.startsWith('---')) {
            reversedLines.push('+' + line.substring(1));
        } else if (line.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/)) {
            // Swap old and new in hunk header
            reversedLines.push(line.replace(
                /^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/,
                (_, o1, o2, n1, n2) => `@@ -${n1},${n2 || '1'} +${o1},${o2 || '1'} @@`
            ));
        } else {
            reversedLines.push(line);
        }
    }

    return reversedLines.join('\n');
}

/**
 * Applies multiple patches in sequence.
 * If any patch fails, all previous patches are reverted.
 * 
 * @param patches - Array of patches with file paths
 * @returns Promise resolving when all patches are applied or reverted
 */
export async function applyPatchBatch(
    patches: Array<{ filePath: string; patch: Patch }>
): Promise<void> {
    logSection('Applying Patch Batch');

    logInfo(`Applying ${patches.length} patches...`);

    const appliedPatches: Array<{ filePath: string; patch: Patch }> = [];

    try {
        for (const item of patches) {
            const success = await applyPatch(item.filePath, item.patch);

            if (!success) {
                throw new Error(`Failed to apply patch to ${item.filePath}`);
            }

            appliedPatches.push(item);
        }

        logInfo(`✓ Successfully applied all ${patches.length} patches`);

    } catch (error: any) {
        logError('Patch batch failed - rolling back', error);

        // Rollback all applied patches
        for (const item of appliedPatches.reverse()) {
            await revertPatch(item.filePath, item.patch);
        }

        throw error;
    }
}

/**
 * Creates a simple patch from old and new content.
 * Useful for generating patches programmatically.
 * 
 * @param filePath - File path for the patch
 * @param oldContent - Original content
 * @param newContent - Modified content
 * @param description - Description of changes
 * @returns Patch object
 */
export function createPatch(
    filePath: string,
    oldContent: string,
    newContent: string,
    description: string
): Patch {
    // Simple line-by-line diff
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    let diff = `--- a/${filePath}\n+++ b/${filePath}\n`;
    diff += `@@ -1,${oldLines.length} +1,${newLines.length} @@\n`;

    const maxLines = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLines; i++) {
        if (i < oldLines.length && i < newLines.length) {
            if (oldLines[i] !== newLines[i]) {
                diff += `-${oldLines[i]}\n`;
                diff += `+${newLines[i]}\n`;
            } else {
                diff += ` ${oldLines[i]}\n`;
            }
        } else if (i < oldLines.length) {
            diff += `-${oldLines[i]}\n`;
        } else if (i < newLines.length) {
            diff += `+${newLines[i]}\n`;
        }
    }

    return {
        diff,
        description,
        filePath,
        source: 'auto'
    };
}
