// llmClient.ts
// This module wraps interactions with LLM providers (GitHub Copilot, Gemini, or others).
// It sends context and receives patch suggestions or migration advice.

import * as vscode from 'vscode';
import { consolidateDocs } from './docFetcher';
import { logInfo, logError, logSection } from './logger';
import { Patch } from './types';

/**
 * Configuration for LLM provider
 */
interface LLMConfig {
    provider: 'copilot' | 'gemini' | 'openai';
    apiKey?: string;
    model?: string;
}

// Default configuration
let llmConfig: LLMConfig = {
    provider: 'copilot'
};

/**
 * Sets the LLM configuration.
 * 
 * @param config - LLM configuration object
 */
export function setLLMConfig(config: Partial<LLMConfig>): void {
    llmConfig = { ...llmConfig, ...config };
    logInfo(`LLM provider set to: ${llmConfig.provider}`);
}

/**
 * Sends a prompt to the configured LLM provider and receives a response.
 * 
 * @param prompt - The prompt to send to the LLM
 * @returns Promise resolving to the LLM response
 */
export async function queryLLM(prompt: string): Promise<string> {
    logInfo(`Querying LLM (${llmConfig.provider})...`);

    try {
        switch (llmConfig.provider) {
            case 'copilot':
                return await queryCopilot(prompt);

            case 'gemini':
                return await queryGemini(prompt);

            case 'openai':
                return await queryOpenAI(prompt);

            default:
                throw new Error(`Unsupported LLM provider: ${llmConfig.provider}`);
        }
    } catch (error: any) {
        logError('LLM query failed', error);
        throw error;
    }
}

/**
 * Queries GitHub Copilot (when available through VS Code API).
 * 
 * @param prompt - The prompt to send
 * @returns Promise resolving to Copilot's response
 */
async function queryCopilot(prompt: string): Promise<string> {
    // Note: This is a placeholder for future Copilot API integration
    // The VS Code Copilot API is not yet officially exposed for extensions
    // When available, this would use the official API

    logInfo('GitHub Copilot integration pending official API support');

    // For now, return a fallback message
    // In production, this would integrate with @vscode/copilot when available
    return 'Copilot integration requires official API support. Please use alternative LLM provider.';
}

/**
 * Queries Google Gemini API.
 * 
 * @param prompt - The prompt to send
 * @returns Promise resolving to Gemini's response
 */
async function queryGemini(prompt: string): Promise<string> {
    if (!llmConfig.apiKey) {
        throw new Error('Gemini API key not configured');
    }

    // Note: This would integrate with Google's Gemini API
    // Placeholder for actual implementation
    const apiKey = llmConfig.apiKey;
    const model = llmConfig.model || 'gemini-pro';

    logInfo(`Querying Gemini (${model})...`);

    // TODO: Implement actual Gemini API call
    // Example structure:
    // const response = await axios.post('https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent', {
    //     contents: [{ parts: [{ text: prompt }] }]
    // }, {
    //     headers: { 'Authorization': `Bearer ${apiKey}` }
    // });

    throw new Error('Gemini API integration not yet implemented');
}

/**
 * Queries OpenAI API.
 * 
 * @param prompt - The prompt to send
 * @returns Promise resolving to OpenAI's response
 */
async function queryOpenAI(prompt: string): Promise<string> {
    if (!llmConfig.apiKey) {
        throw new Error('OpenAI API key not configured');
    }

    const apiKey = llmConfig.apiKey;
    const model = llmConfig.model || 'gpt-4';

    logInfo(`Querying OpenAI (${model})...`);

    // TODO: Implement actual OpenAI API call
    // Example structure:
    // const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    //     model: model,
    //     messages: [{ role: 'user', content: prompt }]
    // }, {
    //     headers: { 'Authorization': `Bearer ${apiKey}` }
    // });

    throw new Error('OpenAI API integration not yet implemented');
}

/**
 * Requests patch suggestions from LLM based on error context.
 * 
 * @param errorContext - The error message or diagnostic
 * @param codeSnippet - The code snippet containing the issue
 * @param docs - Relevant documentation
 * @returns Promise resolving to array of Patch objects
 */
export async function generatePatchSuggestions(
    errorContext: string,
    codeSnippet: string,
    docs: string
): Promise<Patch[]> {
    logSection('Generating Patch Suggestions');

    // Construct a comprehensive prompt for the LLM
    const prompt = constructPatchPrompt(errorContext, codeSnippet, docs);

    try {
        // Query the LLM
        const response = await queryLLM(prompt);

        // Parse the response into Patch objects
        const patches = parseLLMResponse(response);

        logInfo(`Generated ${patches.length} patch suggestions`);

        return patches;

    } catch (error: any) {
        logError('Failed to generate patch suggestions', error);

        // Return empty array on failure
        return [];
    }
}

/**
 * Constructs a prompt for the LLM to generate code patches.
 * 
 * @param errorContext - The error message
 * @param codeSnippet - The problematic code
 * @param docs - Relevant documentation
 * @returns The constructed prompt
 */
function constructPatchPrompt(errorContext: string, codeSnippet: string, docs: string): string {
    return `You are an expert Angular developer helping with a migration.

## Task
Generate a unified-diff format patch to fix the following TypeScript error in an Angular project.

## Error Message
\`\`\`
${errorContext}
\`\`\`

## Current Code
\`\`\`typescript
${codeSnippet}
\`\`\`

## Migration Documentation
${docs.substring(0, 2000)} // Truncate to avoid token limits

## Instructions
1. Analyze the error in the context of the Angular migration
2. Generate a unified-diff patch that fixes the issue
3. Provide a brief explanation of the changes
4. Format your response as JSON:

\`\`\`json
{
  "patches": [
    {
      "diff": "--- a/file.ts\\n+++ b/file.ts\\n@@ -1,3 +1,3 @@\\n-old line\\n+new line",
      "description": "Brief explanation of the change",
      "filePath": "path/to/file.ts"
    }
  ]
}
\`\`\`

Generate the patch now.`;
}

/**
 * Parses LLM response to extract Patch objects.
 * 
 * @param response - The raw LLM response
 * @returns Array of Patch objects
 */
function parseLLMResponse(response: string): Patch[] {
    const patches: Patch[] = [];

    try {
        // Try to extract JSON from the response
        const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) ||
            response.match(/\{[\s\S]*"patches"[\s\S]*\}/);

        if (!jsonMatch) {
            logError('Could not find JSON in LLM response');
            return patches;
        }

        const jsonText = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(jsonText);

        if (parsed.patches && Array.isArray(parsed.patches)) {
            for (const patchData of parsed.patches) {
                patches.push({
                    diff: patchData.diff,
                    description: patchData.description || 'LLM-generated patch',
                    filePath: patchData.filePath,
                    source: 'llm'
                });
            }
        }

        logInfo(`Parsed ${patches.length} patches from LLM response`);

    } catch (error: any) {
        logError('Failed to parse LLM response as JSON', error);

        // Try to extract diff blocks directly
        const diffMatches = response.match(/```diff\n([\s\S]*?)\n```/g);
        if (diffMatches) {
            diffMatches.forEach((match, index) => {
                const diff = match.replace(/```diff\n/, '').replace(/\n```/, '');
                patches.push({
                    diff,
                    description: `LLM-generated patch ${index + 1}`,
                    filePath: 'unknown', // File path would need to be inferred
                    source: 'llm'
                });
            });
            logInfo(`Extracted ${patches.length} diff blocks from LLM response`);
        }
    }

    return patches;
}

/**
 * Asks LLM to explain a breaking change or migration step.
 * 
 * @param change - Description of the breaking change
 * @returns Promise resolving to plain-language explanation
 */
export async function explainBreakingChange(change: string): Promise<string> {
    const prompt = `You are an expert Angular developer.

Explain the following Angular breaking change or migration requirement in simple terms:

"${change}"

Provide:
1. What changed and why
2. How it affects existing code
3. How to update code to be compatible

Keep the explanation concise and practical.`;

    try {
        const explanation = await queryLLM(prompt);
        return explanation;
    } catch (error: any) {
        logError('Failed to get breaking change explanation', error);
        return `Breaking change: ${change}\n\nPlease refer to Angular documentation for details.`;
    }
}

/**
 * Checks if an LLM provider is available and configured.
 * 
 * @returns Promise resolving to true if LLM is available
 */
export async function isLLMAvailable(): Promise<boolean> {
    switch (llmConfig.provider) {
        case 'copilot':
            // Check if Copilot extension is available
            const copilotExt = vscode.extensions.getExtension('github.copilot');
            return copilotExt?.isActive ?? false;

        case 'gemini':
        case 'openai':
            // Check if API key is configured
            return !!llmConfig.apiKey;

        default:
            return false;
    }
}
