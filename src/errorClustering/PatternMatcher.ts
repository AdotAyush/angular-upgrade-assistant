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
            check: (conflict) => {
                return (conflict.message.includes('HttpModule') && conflict.message.includes('deprecated')) ||
                    (conflict.message.includes('HttpModule') && conflict.message.includes('has no exported member'));
            },
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

        // Pattern 2: RxJS Operators (switch to pipeable operators)
        this.patterns.push({
            id: 'rxjs-operators',
            name: 'RxJS Operators',
            description: 'Fixes old RxJS operator imports',
            check: (conflict) => conflict.message.includes('rxjs') && conflict.message.includes('has no exported member'),
            fix: (conflict) => {
                // Heuristic: if it's an import error for a common operator
                if (conflict.message.includes('map') || conflict.message.includes('switchMap') || conflict.message.includes('tap')) {
                    return {
                        diff: `
- import 'rxjs/add/operator/map';
+ import { map } from 'rxjs/operators';
`,
                        description: 'Update RxJS operator import',
                        filePath: conflict.filePath,
                        source: 'pattern'
                    };
                }
                return null;
            }
        });

        // Pattern 3: entryComponents removal (Angular 13+ but common legacy)
        this.patterns.push({
            id: 'entry-components',
            name: 'Remove entryComponents',
            description: 'Removes deprecated entryComponents property',
            check: (conflict) => conflict.message.includes('entryComponents') && conflict.message.includes('does not exist'),
            fix: (conflict) => {
                return {
                    diff: `
- entryComponents: [
-   MyComponent
- ],
`,
                    description: 'Remove deprecated entryComponents',
                    filePath: conflict.filePath,
                    source: 'pattern'
                };
            }
        });
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
