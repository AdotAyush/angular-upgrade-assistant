import { Conflict } from '../types';

export interface ErrorCluster {
    id: string;
    pattern: string;
    instances: Conflict[];
    representative: Conflict;
}

export class ErrorClusterer {
    /**
     * Groups similar errors into clusters based on error messages.
     * This reduces the number of LLM calls by treating similar errors as one pattern.
     */
    clusterErrors(conflicts: Conflict[]): ErrorCluster[] {
        const clusters: Map<string, ErrorCluster> = new Map();

        for (const conflict of conflicts) {
            // Create a simplified pattern key by removing variable parts like line numbers, file paths, or specific variable names
            // This is a heuristic approach
            const patternKey = this.generatePatternKey(conflict.message);

            if (!clusters.has(patternKey)) {
                clusters.set(patternKey, {
                    id: `cluster-${clusters.size + 1}`,
                    pattern: patternKey,
                    instances: [],
                    representative: conflict
                });
            }

            clusters.get(patternKey)!.instances.push(conflict);
        }

        return Array.from(clusters.values());
    }

    private generatePatternKey(message: string): string {
        // 1. Remove quoted strings (often variable names)
        let key = message.replace(/['"][^'"]*['"]/g, '<STRING>');

        // 2. Remove numbers (often line numbers or counts)
        key = key.replace(/\d+/g, '<NUM>');

        // 3. Remove file paths
        key = key.replace(/(\/[\w\-\.]+)+/g, '<PATH>');

        return key.trim();
    }
}
