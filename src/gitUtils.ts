// gitUtils.ts
// This module provides Git utilities for safe migration operations.
// It handles branch creation, commits, diffs, and rollbacks.

import { runGitCommand } from './cliRunner';
import { logInfo, logError, logSection } from './logger';
import { getAngularRoot } from './initializeWorkspace';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Checks if the current workspace is a Git repository.
 * 
 * @param workspacePath - Optional custom workspace path
 * @returns Promise resolving to true if Git repo exists
 */
export async function isGitRepository(workspacePath?: string): Promise<boolean> {
    const angularRoot = workspacePath || getAngularRoot();

    if (!angularRoot) {
        logError('Cannot check Git repository: Angular root not initialized');
        return false;
    }

    const gitDir = path.join(angularRoot, '.git');
    const exists = fs.existsSync(gitDir);

    if (exists) {
        logInfo('Git repository detected');
    } else {
        logInfo('No Git repository found');
    }

    return exists;
}

/**
 * Creates a new Git branch for the migration.
 * 
 * @param branchName - Name of the branch to create
 * @returns Promise resolving when branch is created
 */
export async function createMigrationBranch(branchName: string): Promise<void> {
    logSection('Creating Migration Branch');

    logInfo(`Creating branch: ${branchName}`);

    try {
        // Check if branch already exists
        try {
            runGitCommand(`git rev-parse --verify ${branchName}`);
            logInfo(`Branch ${branchName} already exists, checking out`);
            runGitCommand(`git checkout ${branchName}`);
            return;
        } catch {
            // Branch doesn't exist, create it
        }

        // Create and checkout new branch
        runGitCommand(`git checkout -b ${branchName}`);
        logInfo(`✓ Created and checked out branch: ${branchName}`);

    } catch (error: any) {
        logError(`Failed to create branch ${branchName}`, error);
        throw error;
    }
}

/**
 * Commits all current changes with a descriptive message.
 * 
 * @param message - Commit message
 * @returns Promise resolving when commit is created
 */
export async function commitChanges(message: string): Promise<void> {
    logInfo(`Committing changes: ${message}`);

    try {
        // Stage all changes
        runGitCommand('git add .');

        // Check if there are changes to commit
        const status = runGitCommand('git status --porcelain');

        if (!status.trim()) {
            logInfo('No changes to commit');
            return;
        }

        // Commit with message
        runGitCommand(`git commit -m "${message}"`);
        logInfo('✓ Changes committed successfully');

    } catch (error: any) {
        logError('Failed to commit changes', error);
        throw error;
    }
}

/**
 * Gets the diff between current state and a specific commit or branch.
 * 
 * @param target - Optional commit hash or branch name to compare against
 * @returns Promise resolving to diff output
 */
export async function getDiff(target?: string): Promise<string> {
    logInfo(`Getting diff${target ? ` against ${target}` : ''}`);

    try {
        const command = target ? `git diff ${target}` : 'git diff';
        const diff = runGitCommand(command);

        const lineCount = diff.split('\n').length;
        logInfo(`Diff contains ${lineCount} lines`);

        return diff;

    } catch (error: any) {
        logError('Failed to get diff', error);
        return '';
    }
}

/**
 * Reverts to a specific commit or branch.
 * WARNING: This performs a hard reset and will discard uncommitted changes.
 * 
 * @param commitHash - Commit hash or branch name to revert to
 * @returns Promise resolving when revert is complete
 */
export async function revertToCommit(commitHash: string): Promise<void> {
    logSection('Reverting Changes');

    logInfo(`Reverting to: ${commitHash}`);

    try {
        // Perform hard reset
        runGitCommand(`git reset --hard ${commitHash}`);
        logInfo('✓ Successfully reverted to previous state');

    } catch (error: any) {
        logError(`Failed to revert to ${commitHash}`, error);
        throw error;
    }
}

/**
 * Checks for uncommitted changes in the workspace.
 * 
 * @returns Promise resolving to true if there are uncommitted changes
 */
export async function hasUncommittedChanges(): Promise<boolean> {
    try {
        const status = runGitCommand('git status --porcelain');
        const hasChanges = status.trim().length > 0;

        if (hasChanges) {
            logInfo('Uncommitted changes detected');
        } else {
            logInfo('Working tree is clean');
        }

        return hasChanges;

    } catch (error: any) {
        logError('Failed to check Git status', error);
        return false;
    }
}

/**
 * Gets the current branch name.
 * 
 * @returns Promise resolving to current branch name
 */
export async function getCurrentBranch(): Promise<string> {
    try {
        const branch = runGitCommand('git rev-parse --abbrev-ref HEAD').trim();
        logInfo(`Current branch: ${branch}`);
        return branch;
    } catch (error: any) {
        logError('Failed to get current branch', error);
        return 'unknown';
    }
}

/**
 * Gets the hash of the current HEAD commit.
 * 
 * @returns Promise resolving to commit hash
 */
export async function getCurrentCommitHash(): Promise<string> {
    try {
        const hash = runGitCommand('git rev-parse HEAD').trim();
        logInfo(`Current commit: ${hash.substring(0, 8)}`);
        return hash;
    } catch (error: any) {
        logError('Failed to get current commit hash', error);
        return '';
    }
}

/**
 * Creates a checkpoint commit before performing risky operations.
 * 
 * @param description - Description of the checkpoint
 * @returns Promise resolving to the checkpoint commit hash
 */
export async function createCheckpoint(description: string): Promise<string> {
    logInfo(`Creating checkpoint: ${description}`);

    try {
        const hasChanges = await hasUncommittedChanges();

        if (hasChanges) {
            await commitChanges(`[CHECKPOINT] ${description}`);
        }

        const hash = await getCurrentCommitHash();
        logInfo(`✓ Checkpoint created: ${hash.substring(0, 8)}`);

        return hash;

    } catch (error: any) {
        logError('Failed to create checkpoint', error);
        throw error;
    }
}

/**
 * Gets a list of recent commits.
 * 
 * @param count - Number of commits to retrieve
 * @returns Promise resolving to array of commit info
 */
export async function getRecentCommits(count: number = 10): Promise<Array<{
    hash: string;
    message: string;
    author: string;
    date: string;
}>> {
    try {
        const format = '%H|%s|%an|%ai';
        const output = runGitCommand(`git log -${count} --format="${format}"`);

        const commits = output.trim().split('\n').map(line => {
            const [hash, message, author, date] = line.split('|');
            return { hash, message, author, date };
        });

        logInfo(`Retrieved ${commits.length} recent commits`);
        return commits;

    } catch (error: any) {
        logError('Failed to get recent commits', error);
        return [];
    }
}

/**
 * Stashes current changes for later retrieval.
 * 
 * @param message - Optional stash message
 * @returns Promise resolving when changes are stashed
 */
export async function stashChanges(message?: string): Promise<void> {
    logInfo('Stashing changes');

    try {
        const command = message
            ? `git stash save "${message}"`
            : 'git stash';

        runGitCommand(command);
        logInfo('✓ Changes stashed successfully');

    } catch (error: any) {
        logError('Failed to stash changes', error);
        throw error;
    }
}

/**
 * Applies the most recent stash.
 * 
 * @returns Promise resolving when stash is applied
 */
export async function applyStash(): Promise<void> {
    logInfo('Applying stashed changes');

    try {
        runGitCommand('git stash pop');
        logInfo('✓ Stashed changes applied successfully');

    } catch (error: any) {
        logError('Failed to apply stash', error);
        throw error;
    }
}
