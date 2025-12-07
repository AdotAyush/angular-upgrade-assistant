import { Conflict, Patch } from '../types';
import { ErrorCluster } from './ErrorClusterer';

export interface PatternFix {
    id: string;
    name: string;
    description: string;
    check: (conflict: Conflict) => boolean;
    fix: (conflict: Conflict) => Patch | null;
}

export class PatternMatcher {
    private patterns: PatternFix[] = [];

    constructor() {
        this.initializePatterns();
    }

    private initializePatterns() {
        // Pattern 1: HttpModule -> HttpClientModule
        this.patterns.push({
            id: 'http-module-deprecation',
            name: 'HttpModule Deprecation',
            description: 'Replaces deprecated HttpModule with HttpClientModule',
            check: (conflict) => conflict.message.includes('HttpModule') && conflict.message.includes('deprecated'),
            fix: (conflict) => {
                return {
                    diff: `
- import { HttpModule } from '@angular/http';
+ import { HttpClientModule } from '@angular/common/http';
`,
                    description: 'Replace HttpModule with HttpClientModule',
                    filePath: conflict.filePath,
                    source: 'pattern'
                };
            }
        });

        // Pattern 2: RxJS Operators
        this.patterns.push({
            id: 'rxjs-operators',
            name: 'RxJS Operators',
            description: 'Fixes old RxJS operator imports',
            check: (conflict) => conflict.message.includes('rxjs') && conflict.message.includes('has no exported member'),
            fix: (conflict) => {
                // This is a simplified example. Real implementation would need AST analysis to know exactly what to replace.
                // For now, we return null to indicate we can't auto-fix this with simple regex reliably without more context.
                return null;
            }
        });

        // Add more Angular-specific patterns here
    }

    /**
     * Tries to find a known fix pattern for a given error cluster.
     */
    matchPattern(cluster: ErrorCluster): PatternFix | null {
        for (const pattern of this.patterns) {
            // Check if the representative error matches the pattern
            if (pattern.check(cluster.representative)) {
                return pattern;
            }
        }
        return null;
    }

    /**
     * Generates patches for all instances in a cluster using the matched pattern.
     */
    generateFixes(cluster: ErrorCluster, pattern: PatternFix): Patch[] {
        const patches: Patch[] = [];
        for (const instance of cluster.instances) {
            const patch = pattern.fix(instance);
            if (patch) {
                patches.push(patch);
            }
        }
        return patches;
    }
}
