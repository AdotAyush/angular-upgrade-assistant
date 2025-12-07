// dependencyScanner.ts
// This module scans package.json and project imports to map all dependencies.
// It identifies which packages are used and where, providing context for upgrades.

import * as fs from 'fs';
import * as path from 'path';
import { getAngularRoot, getAngularAST } from './initializeWorkspace';
import { logInfo, logError, logSection } from './logger';
import { DependencyInfo } from './types';

/**
 * Scans package.json to extract all dependencies.
 * 
 * @param packageJsonPath - Optional custom path to package.json
 * @returns Promise resolving to array of DependencyInfo objects
 */
export async function scanPackageJson(packageJsonPath?: string): Promise<DependencyInfo[]> {
    logSection('Scanning package.json');

    const angularRoot = getAngularRoot();
    if (!angularRoot) {
        logError('Cannot scan package.json: Angular root not initialized');
        return [];
    }

    const pkgPath = packageJsonPath || path.join(angularRoot, 'package.json');

    if (!fs.existsSync(pkgPath)) {
        logError(`package.json not found at: ${pkgPath}`);
        return [];
    }

    try {
        const content = fs.readFileSync(pkgPath, 'utf-8');
        const packageJson = JSON.parse(content);

        const dependencies: DependencyInfo[] = [];

        // Extract regular dependencies
        if (packageJson.dependencies) {
            for (const [name, version] of Object.entries(packageJson.dependencies)) {
                dependencies.push({
                    name,
                    currentVersion: version as string,
                    type: 'dependency'
                });
            }
        }

        // Extract dev dependencies
        if (packageJson.devDependencies) {
            for (const [name, version] of Object.entries(packageJson.devDependencies)) {
                dependencies.push({
                    name,
                    currentVersion: version as string,
                    type: 'devDependency'
                });
            }
        }

        // Extract peer dependencies
        if (packageJson.peerDependencies) {
            for (const [name, version] of Object.entries(packageJson.peerDependencies)) {
                dependencies.push({
                    name,
                    currentVersion: version as string,
                    type: 'peerDependency'
                });
            }
        }

        logInfo(`Found ${dependencies.length} total dependencies`);
        logInfo(`- Regular dependencies: ${Object.keys(packageJson.dependencies || {}).length}`);
        logInfo(`- Dev dependencies: ${Object.keys(packageJson.devDependencies || {}).length}`);
        logInfo(`- Peer dependencies: ${Object.keys(packageJson.peerDependencies || {}).length}`);

        return dependencies;

    } catch (error: any) {
        logError('Failed to parse package.json', error);
        return [];
    }
}

/**
 * Scans TypeScript/JavaScript imports across the project.
 * Uses ts-morph to parse import declarations.
 * 
 * @param projectRoot - Optional custom project root path
 * @returns Promise resolving to Map of package name to array of files importing it
 */
export async function scanImports(projectRoot?: string): Promise<Map<string, string[]>> {
    logSection('Scanning Project Imports');

    const angularAST = getAngularAST();
    const project = angularAST?.getProject();

    if (!project) {
        logError('Cannot scan imports: ts-morph Project not initialized');
        return new Map();
    }

    const importMap = new Map<string, string[]>();
    const sourceFiles = project.getSourceFiles();

    logInfo(`Analyzing imports in ${sourceFiles.length} files...`);

    for (const sourceFile of sourceFiles) {
        const filePath = sourceFile.getFilePath();

        // Skip node_modules
        if (filePath.includes('node_modules')) {
            continue;
        }

        // Get all import declarations
        const importDeclarations = sourceFile.getImportDeclarations();

        for (const importDecl of importDeclarations) {
            const moduleSpecifier = importDecl.getModuleSpecifierValue();

            // Only track external packages (not relative imports)
            if (!moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/')) {
                // Extract package name (handle scoped packages like @angular/core)
                const packageName = moduleSpecifier.startsWith('@')
                    ? moduleSpecifier.split('/').slice(0, 2).join('/')
                    : moduleSpecifier.split('/')[0];

                if (!importMap.has(packageName)) {
                    importMap.set(packageName, []);
                }

                const files = importMap.get(packageName)!;
                if (!files.includes(filePath)) {
                    files.push(filePath);
                }
            }
        }
    }

    logInfo(`Found ${importMap.size} unique packages imported across the project`);

    // Log top imported packages
    const sorted = Array.from(importMap.entries())
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 10);

    logInfo('Top imported packages:');
    sorted.forEach(([pkg, files]) => {
        logInfo(`  ${pkg}: ${files.length} files`);
    });

    return importMap;
}

/**
 * Identifies Angular-specific dependencies that need special handling.
 * 
 * @param dependencies - Array of DependencyInfo objects
 * @returns Filtered array containing only Angular packages
 */
export function identifyAngularPackages(dependencies: DependencyInfo[]): DependencyInfo[] {
    const angularPackages = dependencies.filter(dep =>
        dep.name.startsWith('@angular/') || dep.name === 'angular'
    );

    logInfo(`Identified ${angularPackages.length} Angular packages`);

    // Flag packages that commonly have breaking changes
    const breakingChangePackages = [
        '@angular/core',
        '@angular/common',
        '@angular/router',
        '@angular/forms',
        '@angular/platform-browser'
    ];

    angularPackages.forEach(pkg => {
        if (breakingChangePackages.includes(pkg.name)) {
            pkg.hasBreakingChanges = true;
        }
    });

    return angularPackages;
}

/**
 * Gets the current Angular version from package.json.
 * 
 * @returns The current @angular/core version or null if not found
 */
export async function getCurrentAngularVersion(): Promise<string | null> {
    const dependencies = await scanPackageJson();
    const angularCore = dependencies.find(dep => dep.name === '@angular/core');

    if (angularCore) {
        // Clean version string (remove ^ or ~ prefix)
        const version = angularCore.currentVersion.replace(/^[\^~]/, '');
        logInfo(`Current Angular version: ${version}`);
        return version;
    }

    logError('Could not determine Angular version - @angular/core not found');
    return null;
}

/**
 * Analyzes dependency impact by combining package.json and import usage data.
 * Returns dependencies with usage statistics.
 * 
 * @returns Promise resolving to array of dependencies with usage counts
 */
export async function analyzeDependencyImpact(): Promise<Array<DependencyInfo & { usageCount: number }>> {
    logSection('Analyzing Dependency Impact');

    const dependencies = await scanPackageJson();
    const importMap = await scanImports();

    const analysis = dependencies.map(dep => {
        const usageCount = importMap.get(dep.name)?.length || 0;
        return {
            ...dep,
            usageCount
        };
    });

    // Sort by usage count (most used first)
    analysis.sort((a, b) => b.usageCount - a.usageCount);

    logInfo('Dependency impact analysis complete');

    // Log unused dependencies
    const unused = analysis.filter(d => d.usageCount === 0);
    if (unused.length > 0) {
        logInfo(`Found ${unused.length} unused dependencies:`);
        unused.forEach(dep => logInfo(`  - ${dep.name}`));
    }

    return analysis;
}
