// types.ts
// This module defines shared TypeScript interfaces and types used throughout the extension.
// These types represent core data structures like conflicts, patches, and dependency information.

/**
 * Represents a conflict detected during migration.
 */
export interface Conflict {
    filePath: string;
    lineNumber: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
}

/**
 * Represents a unified-diff format patch.
 */
export interface Patch {
    diff: string;
    description: string;
    filePath: string;
    source: 'llm' | 'auto' | 'manual';
}

/**
 * Represents information about a project dependency.
 */
export interface DependencyInfo {
    name: string;
    currentVersion: string;
    targetVersion?: string;
    type: 'dependency' | 'devDependency' | 'peerDependency';
    hasBreakingChanges?: boolean;
}

/**
 * Represents a migration step in the overall workflow.
 */
export interface MigrationStep {
    id: string;
    name: string;
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
    description: string;
    timestamp?: Date;
}

/**
 * Configuration options for the migration process.
 */
export interface MigrationConfig {
    targetAngularVersion: string;
    useLLM: boolean;
    llmProvider?: 'copilot' | 'gemini' | 'other';
    autoApplyPatches: boolean;
    createGitBranch: boolean;
}
