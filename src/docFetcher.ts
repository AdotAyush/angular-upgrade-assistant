// docFetcher.ts
// This module fetches changelogs, migration guides, and documentation for dependencies.
// It can pull from npm registry, GitHub releases, or official Angular docs.

import axios from 'axios';
import { logInfo, logError, logSection } from './logger';

// Cache for API responses to avoid redundant requests
const documentationCache = new Map<string, string>();

/**
 * Fetches changelog from npm for a given package.
 * 
 * @param packageName - Name of the npm package
 * @param version - Version number
 * @returns Promise resolving to changelog text
 */
export async function fetchNpmChangelog(packageName: string, version: string): Promise<string> {
    const cacheKey = `npm:${packageName}:${version}`;

    if (documentationCache.has(cacheKey)) {
        logInfo(`Using cached npm changelog for ${packageName}@${version}`);
        return documentationCache.get(cacheKey)!;
    }

    logInfo(`Fetching npm changelog for ${packageName}@${version}`);

    try {
        // Query npm registry API
        const url = `https://registry.npmjs.org/${packageName}`;
        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'Accept': 'application/json'
            }
        });

        const packageData = response.data;

        // Extract changelog information
        let changelog = '';

        // Try to get version-specific information
        if (packageData.versions && packageData.versions[version]) {
            const versionData = packageData.versions[version];
            changelog += `# ${packageName} v${version}\n\n`;

            if (versionData.description) {
                changelog += `${versionData.description}\n\n`;
            }
        }

        // Try to get README which often contains changelog
        if (packageData.readme) {
            const readme = packageData.readme;

            // Extract changelog section if present
            const changelogMatch = readme.match(/## ?changelog[\s\S]*?(?=##|$)/i);
            if (changelogMatch) {
                changelog += changelogMatch[0];
            } else {
                // If no changelog section, include first 1000 chars of README
                changelog += readme.substring(0, 1000);
            }
        }

        documentationCache.set(cacheKey, changelog);
        logInfo(`Successfully fetched npm changelog for ${packageName}`);

        return changelog;

    } catch (error: any) {
        logError(`Failed to fetch npm changelog for ${packageName}`, error);
        return '';
    }
}

/**
 * Fetches GitHub release notes for a repository.
 * 
 * @param repo - Repository in format 'owner/repo'
 * @param version - Version/tag name
 * @returns Promise resolving to release notes
 */
export async function fetchGitHubReleases(repo: string, version: string): Promise<string> {
    const cacheKey = `github:${repo}:${version}`;

    if (documentationCache.has(cacheKey)) {
        logInfo(`Using cached GitHub release for ${repo}@${version}`);
        return documentationCache.get(cacheKey)!;
    }

    logInfo(`Fetching GitHub release for ${repo}@${version}`);

    try {
        // Normalize version tag (try with and without 'v' prefix)
        const tags = [version, `v${version}`, version.replace(/^v/, '')];

        let releaseData = null;

        for (const tag of tags) {
            try {
                const url = `https://api.github.com/repos/${repo}/releases/tags/${tag}`;
                const response = await axios.get(url, {
                    timeout: 10000,
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'Angular-Upgrade-Assistant'
                    }
                });

                releaseData = response.data;
                break;
            } catch (err) {
                // Try next tag variant
                continue;
            }
        }

        if (!releaseData) {
            logInfo(`No GitHub release found for ${repo}@${version}`);
            return '';
        }

        let releaseNotes = `# ${repo} ${releaseData.name || version}\n\n`;

        if (releaseData.body) {
            releaseNotes += releaseData.body;
        }

        documentationCache.set(cacheKey, releaseNotes);
        logInfo(`Successfully fetched GitHub release for ${repo}`);

        return releaseNotes;

    } catch (error: any) {
        logError(`Failed to fetch GitHub release for ${repo}`, error);
        return '';
    }
}

/**
 * Fetches official Angular migration guide.
 * 
 * @param fromVersion - Starting version
 * @param toVersion - Target version
 * @returns Promise resolving to migration guide text
 */
export async function fetchAngularMigrationGuide(fromVersion: string, toVersion: string): Promise<string> {
    const cacheKey = `angular:${fromVersion}:${toVersion}`;

    if (documentationCache.has(cacheKey)) {
        logInfo(`Using cached Angular migration guide ${fromVersion} → ${toVersion}`);
        return documentationCache.get(cacheKey)!;
    }

    logInfo(`Fetching Angular migration guide ${fromVersion} → ${toVersion}`);

    try {
        // Angular update guide URL
        const url = 'https://update.angular.io/';

        // Note: This is a simplified version. The actual Angular update guide
        // is a dynamic web application. In production, you might want to:
        // 1. Use puppeteer to scrape the dynamic content
        // 2. Use Angular's GitHub repository for CHANGELOG.md
        // 3. Use a dedicated API if available

        // For now, we'll fetch from Angular's GitHub CHANGELOG
        const changelogUrl = 'https://raw.githubusercontent.com/angular/angular/main/CHANGELOG.md';
        const response = await axios.get(changelogUrl, {
            timeout: 10000
        });

        const changelog = response.data;

        // Extract relevant sections for the version range
        const fromMajor = parseInt(fromVersion.split('.')[0], 10);
        const toMajor = parseInt(toVersion.split('.')[0], 10);

        let guide = `# Angular Migration Guide: v${fromVersion} → v${toVersion}\n\n`;

        // Extract changelog sections for relevant versions
        const versionPattern = new RegExp(`## (${toMajor}\\.\\d+\\.\\d+[^#]*?)(?=##|$)`, 'g');
        const matches = changelog.match(versionPattern);

        if (matches && matches.length > 0) {
            guide += matches.slice(0, 3).join('\n\n'); // Include up to 3 versions
        } else {
            guide += 'See https://update.angular.io/ for detailed migration instructions.\n';
        }

        documentationCache.set(cacheKey, guide);
        logInfo('Successfully fetched Angular migration guide');

        return guide;

    } catch (error: any) {
        logError('Failed to fetch Angular migration guide', error);

        // Return fallback guide
        return `# Angular Migration Guide\n\nFor detailed migration instructions, visit:\n- https://update.angular.io/\n- https://angular.io/guide/updating\n`;
    }
}

/**
 * Consolidates all documentation for a dependency upgrade.
 * Combines npm changelog, GitHub releases, and Angular-specific guides.
 * 
 * @param packageName - Name of the package being upgraded
 * @param fromVersion - Current version
 * @param toVersion - Target version
 * @returns Promise resolving to consolidated documentation
 */
export async function consolidateDocs(
    packageName: string,
    fromVersion: string,
    toVersion: string
): Promise<string> {
    logSection(`Consolidating Documentation for ${packageName}`);

    let consolidated = `# Migration Documentation: ${packageName}\n`;
    consolidated += `## Upgrading from ${fromVersion} to ${toVersion}\n\n`;

    // Fetch npm changelog
    const npmChangelog = await fetchNpmChangelog(packageName, toVersion);
    if (npmChangelog) {
        consolidated += `---\n## NPM Package Information\n\n${npmChangelog}\n\n`;
    }

    // Fetch GitHub releases if it's an Angular package
    if (packageName.startsWith('@angular/')) {
        const githubReleases = await fetchGitHubReleases('angular/angular', toVersion);
        if (githubReleases) {
            consolidated += `---\n## GitHub Release Notes\n\n${githubReleases}\n\n`;
        }

        // Fetch Angular migration guide
        const migrationGuide = await fetchAngularMigrationGuide(fromVersion, toVersion);
        if (migrationGuide) {
            consolidated += `---\n## Angular Migration Guide\n\n${migrationGuide}\n\n`;
        }
    }

    // Add footer with useful links
    consolidated += `---\n## Additional Resources\n\n`;
    consolidated += `- NPM Package: https://www.npmjs.com/package/${packageName}\n`;
    if (packageName.startsWith('@angular/')) {
        consolidated += `- Angular Update Guide: https://update.angular.io/\n`;
        consolidated += `- Angular Documentation: https://angular.io/docs\n`;
    }

    logInfo(`Consolidated documentation (${consolidated.length} characters)`);

    return consolidated;
}

/**
 * Clears the documentation cache.
 * Useful for forcing fresh fetches during development/testing.
 */
export function clearDocumentationCache(): void {
    const size = documentationCache.size;
    documentationCache.clear();
    logInfo(`Cleared documentation cache (${size} entries)`);
}
