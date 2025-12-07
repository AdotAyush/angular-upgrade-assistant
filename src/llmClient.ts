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
    provider: 'copilot' | 'gemini' | 'openai' | 'bedrock' | 'groq' | 'none';
    apiKey?: string;
    model?: string;
    bedrockRegion?: string;
    bedrockModelId?: string;
    groqApiKey?: string;
    groqModel?: string;
    enableMockMode?: boolean;
}

// Default configuration - will be loaded from VS Code settings
let llmConfig: LLMConfig = {
    provider: 'copilot',
    enableMockMode: true
};

/**
 * Loads LLM configuration from VS Code settings.
 */
export function loadLLMConfigFromSettings(): void {
    const config = vscode.workspace.getConfiguration('angularUpgrade');

    llmConfig = {
        provider: config.get('llmProvider', 'copilot') as any,
        apiKey: config.get('openaiApiKey') || config.get('geminiApiKey'),
        model: config.get('openaiModel') || config.get('geminiModel'),
        bedrockRegion: config.get('bedrockRegion', 'us-east-1'),
        bedrockModelId: config.get('bedrockModelId', 'anthropic.claude-3-5-sonnet-20241022-v2:0'),
        groqApiKey: config.get('groqApiKey'),
        groqModel: config.get('groqModel', 'llama3-70b-8192'),
        enableMockMode: config.get('enableMockMode', true)
    };

    logInfo(`LLM provider loaded from settings: ${llmConfig.provider}`);
}

/**
 * Sets the LLM configuration (programmatically).
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
        // Load config from settings if not already loaded
        if (!llmConfig.apiKey && llmConfig.provider !== 'copilot') {
            loadLLMConfigFromSettings();
        }

        switch (llmConfig.provider) {
            case 'copilot':
                return await queryCopilot(prompt);

            case 'gemini':
                return await queryGemini(prompt);

            case 'openai':
                return await queryOpenAI(prompt);

            case 'bedrock':
                return await queryBedrock(prompt);

            case 'groq':
                return await queryGroq(prompt);

            case 'none':
                logInfo('LLM provider set to none - skipping');
                throw new Error('LLM provider disabled');

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
    try {
        // Try to use VS Code's Language Model API (available in newer VS Code versions)
        // This is the official way to access Copilot and other language models

        // @ts-ignore - vscode.lm may not be in older type definitions
        if (typeof vscode.lm !== 'undefined' && vscode.lm.selectChatModels) {
            logInfo('Using VS Code Language Model API (Copilot)...');

            // @ts-ignore
            const models = await vscode.lm.selectChatModels({
                vendor: 'copilot',
                family: 'gpt-4'
            });

            if (models && models.length > 0) {
                const model = models[0];

                // @ts-ignore
                const messages = [
                    vscode.LanguageModelChatMessage.User(prompt)
                ];

                // @ts-ignore
                const response = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

                let fullResponse = '';
                for await (const chunk of response.text) {
                    fullResponse += chunk;
                }

                logInfo('Received response from Copilot');
                return fullResponse;
            }
        }

        // Fallback: Return a simple mock response for testing
        logInfo('Language Model API not available, using fallback mock response');
        return generateMockPatchResponse(prompt);

    } catch (error: any) {
        logError('Copilot query failed', error);
        // Return mock response as fallback
        return generateMockPatchResponse(prompt);
    }
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
    loadLLMConfigFromSettings();

    if (!llmConfig.apiKey) {
        throw new Error('OpenAI API key not configured. Set angularUpgrade.openaiApiKey in settings');
    }

    const apiKey = llmConfig.apiKey;
    const model = llmConfig.model || 'gpt-4';

    logInfo(`Querying OpenAI (${model})...`);

    const axios = (await import('axios')).default;

    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const result = response.data.choices[0].message.content;
        logInfo('Received response from OpenAI');
        return result;

    } catch (error: any) {
        logError('OpenAI API call failed', error);
        throw new Error(`OpenAI API error: ${error.message}`);
    }
}

/**
 * Queries AWS Bedrock API.
 * 
 * @param prompt - The prompt to send
 * @returns Promise resolving to Bedrock's response
 */
async function queryBedrock(prompt: string): Promise<string> {
    loadLLMConfigFromSettings();

    const region = llmConfig.bedrockRegion || 'us-east-1';
    const modelId = llmConfig.bedrockModelId || 'anthropic.claude-3-5-sonnet-20241022-v2:0';

    logInfo(`Querying AWS Bedrock (${modelId}) in region ${region}...`);

    try {
        // Dynamically import AWS SDK
        // @ts-ignore - AWS SDK is optional dependency
        const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');

        const client = new BedrockRuntimeClient({ region });

        // Prepare request based on model family
        let requestBody: any;

        if (modelId.startsWith('anthropic.claude')) {
            // Claude format
            requestBody = {
                anthropic_version: "bedrock-2023-05-31",
                max_tokens: 4096,
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ]
            };
        } else if (modelId.startsWith('meta.llama')) {
            // Llama format
            requestBody = {
                prompt: prompt,
                max_gen_len: 2048,
                temperature: 0.7
            };
        } else {
            throw new Error(`Unsupported Bedrock model: ${modelId}`);
        }

        const command = new InvokeModelCommand({
            modelId,
            contentType: 'application/json',
            body: JSON.stringify(requestBody)
        });

        const response = await client.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));

        // Extract response based on model family
        let result: string;
        if (modelId.startsWith('anthropic.claude')) {
            result = responseBody.content[0].text;
        } else if (modelId.startsWith('meta.llama')) {
            result = responseBody.generation;
        } else {
            result = JSON.stringify(responseBody);
        }

        logInfo('Received response from AWS Bedrock');
        return result;

    } catch (error: any) {
        logError('AWS Bedrock API call failed', error);

        if (error.name === 'AccessDeniedException') {
            throw new Error('AWS Bedrock access denied. Please configure AWS credentials.');
        } else if (error.code === 'MODULE_NOT_FOUND') {
            throw new Error('AWS SDK not installed. Run: npm install @aws-sdk/client-bedrock-runtime');
        }

        throw new Error(`Bedrock API error: ${error.message}`);
    }
}

/**
 * Queries Groq API.
 * 
 * @param prompt - The prompt to send
 * @returns Promise resolving to Groq's response
 */
async function queryGroq(prompt: string): Promise<string> {
    loadLLMConfigFromSettings();

    if (!llmConfig.groqApiKey) {
        throw new Error('Groq API key not configured. Set angularUpgrade.groqApiKey in settings');
    }

    const apiKey = llmConfig.groqApiKey;
    const model = llmConfig.groqModel || 'llama3-70b-8192';

    logInfo(`Querying Groq (${model})...`);

    const axios = (await import('axios')).default;

    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const result = response.data.choices[0].message.content;
        logInfo('Received response from Groq');
        return result;

    } catch (error: any) {
        logError('Groq API call failed', error);
        throw new Error(`Groq API error: ${error.message}`);
    }
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
    // Load settings first
    loadLLMConfigFromSettings();

    switch (llmConfig.provider) {
        case 'copilot':
            // Check if Copilot extension is installed (don't require it to be active)
            const copilotExt = vscode.extensions.getExtension('github.copilot') ||
                vscode.extensions.getExtension('github.copilot-chat');

            // Also check for Language Model API availability
            // @ts-ignore
            const hasLMAPI = typeof vscode.lm !== 'undefined';

            if (copilotExt || hasLMAPI) {
                logInfo('✓ LLM available: Copilot extension found or Language Model API available');
                return true;
            }

            // Check if mock mode is enabled
            if (llmConfig.enableMockMode) {
                logInfo('⚠ Copilot not found - enabling fallback mock mode for testing');
                vscode.window.showWarningMessage(
                    'GitHub Copilot not detected. Using mock mode for demonstration. Configure a real LLM provider in settings for actual patch generation.',
                    'Open Settings'
                ).then(selection => {
                    if (selection === 'Open Settings') {
                        vscode.commands.executeCommand('workbench.action.openSettings', 'angularUpgrade');
                    }
                });
                return true; // Allow mock responses
            }

            logError('Copilot not available and mock mode disabled');
            return false;

        case 'gemini':
            if (llmConfig.apiKey) {
                logInfo('✓ LLM available: Gemini API key configured');
                return true;
            }
            logError('Gemini API key not configured');
            vscode.window.showErrorMessage('Gemini API key not configured. Set angularUpgrade.geminiApiKey in settings.');
            return false;

        case 'openai':
            if (llmConfig.apiKey) {
                logInfo('✓ LLM available: OpenAI API key configured');
                return true;
            }
            logError('OpenAI API key not configured');
            vscode.window.showErrorMessage('OpenAI API key not configured. Set angularUpgrade.openaiApiKey in settings.');
            return false;

        case 'bedrock':
            // For Bedrock, we check if AWS SDK is available
            try {
                // @ts-ignore - AWS SDK is optional dependency
                await import('@aws-sdk/client-bedrock-runtime');
                logInfo('✓ LLM available: AWS Bedrock SDK found');
                return true;
            } catch {
                logError('AWS Bedrock SDK not installed');
                vscode.window.showErrorMessage(
                    'AWS Bedrock SDK not installed. Run: npm install @aws-sdk/client-bedrock-runtime',
                    'Install Now'
                ).then(selection => {
                    if (selection === 'Install Now') {
                        vscode.window.showInformationMessage('Please run: npm install @aws-sdk/client-bedrock-runtime in your terminal');
                    }
                });
                return false;
            }

        case 'groq':
            if (llmConfig.groqApiKey) {
                logInfo('✓ LLM available: Groq API key configured');
                return true;
            }
            logError('Groq API key not configured');
            vscode.window.showErrorMessage('Groq API key not configured. Set angularUpgrade.groqApiKey in settings.');
            return false;

        case 'none':
            logInfo('LLM provider set to none - skipping patch generation');
            return false;

        default:
            return false;
    }
}

/**
 * Generates a mock patch response for testing when LLM is not available.
 * This allows the extension to run and demonstrate functionality.
 * Shows a warning to the user that mock mode is active.
 */
function generateMockPatchResponse(prompt: string): string {
    logInfo('⚠ Generating mock LLM response for demonstration purposes');

    // Show warning message to user
    vscode.window.showWarningMessage(
        '⚠️ MOCK MODE: Generating demonstration patches only. Configure a real LLM provider (Copilot/OpenAI/Gemini/Bedrock) for actual code fixes.',
        'Configure Now'
    ).then(selection => {
        if (selection === 'Configure Now') {
            vscode.commands.executeCommand('angularUpgrade.configure');
        }
    });

    // Extract error context if present
    const errorMatch = prompt.match(/## Error Message[\s\S]*?```\n([\s\S]*?)```/);
    const error = errorMatch ? errorMatch[1].trim() : 'Unknown error';

    // Return a simple mock JSON response
    const mockResponse = {
        patches: [
            {
                diff: `--- a/example.ts
+++ b/example.ts
@@ -1,3 +1,3 @@
 // ⚠️ MOCK PATCH - This is a demonstration only
-// Configure a real LLM provider for actual fixes
+// Real patches require Copilot, OpenAI, Gemini, or Bedrock`,
                description: `⚠️ MOCK: Would address "${error.substring(0, 80)}..." - This is a demonstration. Configure angularUpgrade.llmProvider in settings for real patches.`,
                filePath: 'unknown'
            }
        ]
    };

    return `\`\`\`json
${JSON.stringify(mockResponse, null, 2)}
\`\`\``;
}
