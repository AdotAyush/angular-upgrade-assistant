import { Project, SourceFile } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';
import { logInfo, logError } from '../logger';
import { Conflict } from '../types';

export class AngularAST {
    private project: Project | null = null;
    private rootPath: string;

    constructor(rootPath: string) {
        this.rootPath = rootPath;
    }

    async initialize(): Promise<boolean> {
        try {
            const tsconfigPath = path.join(this.rootPath, 'tsconfig.json');

            if (!fs.existsSync(tsconfigPath)) {
                logError(`tsconfig.json not found at ${tsconfigPath}`);
                return false;
            }

            this.project = new Project({
                tsConfigFilePath: tsconfigPath,
                skipAddingFilesFromTsConfig: false
            });

            logInfo('Angular AST initialized successfully');
            return true;
        } catch (error) {
            logError('Failed to initialize Angular AST', error as Error);
            return false;
        }
    }

    getProject(): Project | null {
        return this.project;
    }

    /**
     * Collects TypeScript diagnostics (errors) from the project.
     */
    getDiagnostics(): Conflict[] {
        if (!this.project) {
            logError('AST not initialized');
            return [];
        }

        const conflicts: Conflict[] = [];
        const sourceFiles = this.project.getSourceFiles();

        logInfo(`Analyzing ${sourceFiles.length} source files...`);

        for (const sourceFile of sourceFiles) {
            // Skip node_modules and declaration files
            if (sourceFile.getFilePath().includes('node_modules') || sourceFile.getFilePath().endsWith('.d.ts')) {
                continue;
            }

            try {
                const diagnostics = sourceFile.getPreEmitDiagnostics();

                for (const diagnostic of diagnostics) {
                    const message = diagnostic.getMessageText();
                    const messageText = typeof message === 'string' ? message : message.getMessageText();

                    let lineNumber = 1;
                    const start = diagnostic.getStart();
                    if (start !== undefined) {
                        lineNumber = sourceFile.getLineAndColumnAtPos(start).line;
                    }

                    const category = diagnostic.getCategory();
                    // 1 = Error, 0 = Warning, 2 = Message, 3 = Suggestion
                    let severity: 'error' | 'warning' | 'info' = 'info';
                    if (category === 1) severity = 'error';
                    else if (category === 0) severity = 'warning';

                    conflicts.push({
                        filePath: sourceFile.getFilePath(),
                        lineNumber,
                        message: messageText,
                        severity
                    });
                }
            } catch (error) {
                console.error(`Error analyzing file ${sourceFile.getFilePath()}:`, error);
            }
        }

        return conflicts;
    }
}
