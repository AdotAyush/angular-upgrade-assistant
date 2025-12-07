// projectLocator.ts
// This module provides utilities to locate the Angular project root directory
// within a workspace, even when the workspace is opened at a monorepo root.
// It recursively searches for angular.json or package.json containing @angular/core.

import * as fs from 'fs';
import * as path from 'path';

/**
 * Recursively searches for the Angular project root directory starting from the given path.
 * 
 * Detection Strategy:
 * - Looks for angular.json (primary indicator)
 * - OR looks for package.json containing "@angular/core" in dependencies
 * 
 * Search Algorithm: Breadth-First Search (BFS)
 * - Ensures we find the shallowest Angular project first
 * - Avoids deep traversal into node_modules
 * 
 * @param startPath - The directory path to start searching from (typically workspace root)
 * @returns The absolute path to the Angular project root, or null if not found
 */
export function findAngularProjectRoot(startPath: string): string | null {
    // Validate start path exists
    if (!fs.existsSync(startPath)) {
        return null;
    }

    // Check if the start path itself is an Angular project
    if (isAngularProject(startPath)) {
        return startPath;
    }

    // BFS queue: store directories to explore
    const queue: string[] = [startPath];
    const visited = new Set<string>();

    while (queue.length > 0) {
        const currentDir = queue.shift()!;

        // Skip if already visited
        if (visited.has(currentDir)) {
            continue;
        }
        visited.add(currentDir);

        try {
            const entries = fs.readdirSync(currentDir, { withFileTypes: true });

            for (const entry of entries) {
                // Skip non-directories
                if (!entry.isDirectory()) {
                    continue;
                }

                // Skip node_modules and hidden directories
                if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
                    continue;
                }

                const fullPath = path.join(currentDir, entry.name);

                // Check if this directory is an Angular project
                if (isAngularProject(fullPath)) {
                    return fullPath;
                }

                // Add to queue for further exploration
                queue.push(fullPath);
            }
        } catch (error) {
            // Skip directories we can't read (permission issues, etc.)
            continue;
        }
    }

    // No Angular project found
    return null;
}

/**
 * Checks if a given directory is an Angular project root.
 * 
 * A directory is considered an Angular project if it contains:
 * 1. angular.json file, OR
 * 2. package.json file with "@angular/core" in dependencies or devDependencies
 * 
 * @param dirPath - Directory path to check
 * @returns true if the directory is an Angular project root, false otherwise
 */
function isAngularProject(dirPath: string): boolean {
    // Check for angular.json
    const angularJsonPath = path.join(dirPath, 'angular.json');
    if (fs.existsSync(angularJsonPath)) {
        return true;
    }

    // Check for package.json with @angular/core
    const packageJsonPath = path.join(dirPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            const dependencies = packageJson.dependencies || {};
            const devDependencies = packageJson.devDependencies || {};

            if (dependencies['@angular/core'] || devDependencies['@angular/core']) {
                return true;
            }
        } catch (error) {
            // Invalid JSON, skip this directory
            return false;
        }
    }

    return false;
}
