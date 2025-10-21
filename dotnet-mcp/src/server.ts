#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { spawn } from 'child_process';
import path from 'path';
import { stat } from 'fs/promises';

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  workingDirectory: string;
}

interface StoredCommandOutput {
  commandArgs: string[];
  formattedText: string;
  raw: CommandResult;
  capturedAt: string;
}

type ToolHandler = (
  args: Record<string, unknown>
) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

const APPROX_CHARS_PER_TOKEN = 4;
const DETAIL_TOKEN_BUDGET = 1200;
const TRUNCATION_MARKER = '\n[...output truncated...]\n';

const SUCCESS_STDOUT_PREVIEW_TOKENS = 220;
const SUCCESS_STDERR_PREVIEW_TOKENS = 120;
const FAILURE_STDOUT_PREVIEW_TOKENS = 480;
const FAILURE_STDERR_PREVIEW_TOKENS = 480;

const WORKING_DIRECTORY_SCHEMA = {
  working_directory: {
    type: 'string',
    description:
      'Directory to run the dotnet command in (defaults to the server launch directory)',
  },
};

class DotnetServer {
  private server: Server;
  private toolHandlers: Map<string, ToolHandler>;
  private tools: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }>;
  private lastResult: StoredCommandOutput | null;

  constructor() {
    this.server = new Server({
      name: 'dotnet-mcp',
      version: '1.0.0',
      capabilities: {
        tools: {},
      },
    });

    this.toolHandlers = new Map();
    this.tools = [];
    this.lastResult = null;

    this.registerTools();
    this.setupHandlers();
  }

  private registerTools(): void {
    this.registerTool(
      'dotnet_restore',
      'Restore NuGet packages for a project or solution.',
      {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description:
              'Path to a project or solution to restore (optional when working_directory contains the project).',
          },
          runtime: {
            type: 'string',
            description: 'Target runtime to restore packages for.',
          },
          configfile: {
            type: 'string',
            description: 'Custom NuGet config file.',
          },
          force: {
            type: 'boolean',
            description: 'Force all dependencies to be resolved even if the last restore was successful.',
            default: false,
          },
          no_cache: {
            type: 'boolean',
            description: 'Disables restoring from the packages cache on disk.',
            default: false,
          },
          interactive: {
            type: 'boolean',
            description: 'Allows the command to stop and wait for user input or action.',
            default: false,
          },
          verbosity: {
            type: 'string',
            description: 'Sets the MSBuild verbosity level.',
            enum: ['quiet', 'minimal', 'normal', 'detailed', 'diagnostic'],
          },
          ...WORKING_DIRECTORY_SCHEMA,
        },
        additionalProperties: false,
      },
      (args) => this.handleRestore(args)
    );

    this.registerTool(
      'dotnet_build',
      'Build a project or solution using dotnet build.',
      {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Path to a project or solution file.',
          },
          configuration: {
            type: 'string',
            description: 'Build configuration (e.g. Debug or Release).',
          },
          framework: {
            type: 'string',
            description: 'Target framework to build for.',
          },
          runtime: {
            type: 'string',
            description: 'Target runtime identifier (RID).',
          },
          output: {
            type: 'string',
            description: 'Output directory for build artifacts.',
          },
          no_restore: {
            type: 'boolean',
            description: 'Skip restoring the project before building.',
            default: false,
          },
          verbosity: {
            type: 'string',
            description: 'Sets the MSBuild verbosity level.',
            enum: ['quiet', 'minimal', 'normal', 'detailed', 'diagnostic'],
          },
          ...WORKING_DIRECTORY_SCHEMA,
        },
        additionalProperties: false,
      },
      (args) => this.handleBuild(args)
    );

    this.registerTool(
      'dotnet_test',
      'Run tests for a project or solution.',
      {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Project or solution file to test.',
          },
          configuration: {
            type: 'string',
            description: 'Build configuration to use.',
          },
          framework: {
            type: 'string',
            description: 'Specify a target framework.',
          },
          logger: {
            type: 'string',
            description: 'Logger to use for test results.',
          },
          filter: {
            type: 'string',
            description: 'Run tests that match the given expression.',
          },
          no_build: {
            type: 'boolean',
            description: 'Skip building the project prior to running.',
            default: false,
          },
          no_restore: {
            type: 'boolean',
            description: 'Skip restoring project-to-project references and packages.',
            default: false,
          },
          settings: {
            type: 'string',
            description: 'Path to a runsettings file.',
          },
          collect: {
            type: 'string',
            description: 'Collect diagnostic data with the specified data collector.',
          },
          ...WORKING_DIRECTORY_SCHEMA,
        },
        additionalProperties: false,
      },
      (args) => this.handleTest(args)
    );

    this.registerTool(
      'dotnet_run',
      'Run a project using dotnet run.',
      {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Project file path to run.',
          },
          configuration: {
            type: 'string',
            description: 'Build configuration (e.g. Debug or Release).',
          },
          framework: {
            type: 'string',
            description: 'Target framework to run.',
          },
          runtime: {
            type: 'string',
            description: 'Runtime identifier.',
          },
          launch_profile: {
            type: 'string',
            description: 'Launch profile name to use.',
          },
          no_build: {
            type: 'boolean',
            description: 'Skip building the project before running.',
            default: false,
          },
          no_restore: {
            type: 'boolean',
            description: 'Skip restoring project dependencies.',
            default: false,
          },
          additional_arguments: {
            type: 'array',
            description: 'Additional arguments to pass after `--`.',
            items: { type: 'string' },
          },
          ...WORKING_DIRECTORY_SCHEMA,
        },
        additionalProperties: false,
      },
      (args) => this.handleRun(args)
    );

    this.registerTool(
      'dotnet_new',
      'Create a new project, solution, or file from a template.',
      {
        type: 'object',
        properties: {
          template: {
            type: 'string',
            description: 'Template short name to create (e.g. console, classlib).',
          },
          name: {
            type: 'string',
            description: 'Name for the output created from the template.',
          },
          output: {
            type: 'string',
            description: 'Output directory for the new project or file.',
          },
          language: {
            type: 'string',
            description: 'Language for the generated project (if template supports it).',
          },
          framework: {
            type: 'string',
            description: 'Target framework (if template supports it).',
          },
          force: {
            type: 'boolean',
            description: 'Force content to be generated even if it would change existing files.',
            default: false,
          },
          skip_restore: {
            type: 'boolean',
            description: 'Skip running `dotnet restore` on the created project.',
            default: false,
          },
          dry_run: {
            type: 'boolean',
            description: 'Show what would be created without making any changes.',
            default: false,
          },
          no_update_check: {
            type: 'boolean',
            description: 'Skip checking for template package updates.',
            default: false,
          },
          additional_arguments: {
            type: 'array',
            description: 'Additional template-specific arguments.',
            items: { type: 'string' },
          },
          ...WORKING_DIRECTORY_SCHEMA,
        },
        required: ['template'],
        additionalProperties: false,
      },
      (args) => this.handleNew(args)
    );

    this.registerTool(
      'dotnet_add_package',
      'Add a NuGet package reference to a project.',
      {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Project file to update (optional when running inside the project directory).',
          },
          package: {
            type: 'string',
            description: 'NuGet package ID to add.',
          },
          version: {
            type: 'string',
            description: 'Package version to install.',
          },
          prerelease: {
            type: 'boolean',
            description: 'Allow prerelease packages.',
            default: false,
          },
          source: {
            type: 'string',
            description: 'NuGet package source to use.',
          },
          no_restore: {
            type: 'boolean',
            description: 'Do not perform an implicit restore.',
            default: false,
          },
          ...WORKING_DIRECTORY_SCHEMA,
        },
        required: ['package'],
        additionalProperties: false,
      },
      (args) => this.handleAddPackage(args)
    );

    this.registerTool(
      'dotnet_clean',
      'Clean build artifacts for a project or solution.',
      {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Project or solution file to clean.',
          },
          configuration: {
            type: 'string',
            description: 'Build configuration to clean.',
          },
          framework: {
            type: 'string',
            description: 'Target framework to clean.',
          },
          runtime: {
            type: 'string',
            description: 'Target runtime identifier.',
          },
          output: {
            type: 'string',
            description: 'Output directory to clean.',
          },
          ...WORKING_DIRECTORY_SCHEMA,
        },
        additionalProperties: false,
      },
      (args) => this.handleClean(args)
    );

    this.registerTool(
      'dotnet_publish',
      'Publish a project for deployment.',
      {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Project or solution file to publish.',
          },
          configuration: {
            type: 'string',
            description: 'Build configuration to use.',
          },
          framework: {
            type: 'string',
            description: 'Target framework to publish.',
          },
          runtime: {
            type: 'string',
            description: 'Runtime identifier (RID).',
          },
          output: {
            type: 'string',
            description: 'Directory to place published output.',
          },
          self_contained: {
            type: 'boolean',
            description: 'Publish the .NET runtime with the application.',
            default: false,
          },
          no_restore: {
            type: 'boolean',
            description: 'Skip restoring before publishing.',
            default: false,
          },
          verbosity: {
            type: 'string',
            description: 'Sets the MSBuild verbosity level.',
            enum: ['quiet', 'minimal', 'normal', 'detailed', 'diagnostic'],
          },
          ...WORKING_DIRECTORY_SCHEMA,
        },
        additionalProperties: false,
      },
      (args) => this.handlePublish(args)
    );

    this.registerTool(
      'dotnet_last_response',
      'Inspect and search the most recent dotnet command response captured by this server.',
      {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Substring to search for within the stored response.',
          },
          case_sensitive: {
            type: 'boolean',
            description: 'Treat the query as case-sensitive during matching.',
            default: false,
          },
          max_matches: {
            type: 'integer',
            description: 'Maximum number of matching lines to return.',
            minimum: 1,
          },
          line_numbers: {
            type: 'boolean',
            description: 'Prefix matches with their line numbers from the stored response.',
            default: false,
          },
        },
        additionalProperties: false,
      },
      (args) => this.handleLastResponse(args)
    );
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.tools,
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const handler = this.toolHandlers.get(request.params.name);

      if (!handler) {
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${request.params.name}`,
            },
          ],
          isError: true,
        };
      }

      try {
        return await handler((request.params.arguments ?? {}) as Record<string, unknown>);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Command failed: ${message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private registerTool(
    name: string,
    description: string,
    inputSchema: Record<string, unknown>,
    handler: ToolHandler
  ): void {
    this.tools.push({ name, description, inputSchema });
    this.toolHandlers.set(name, handler);
  }

  private async resolveWorkingDirectory(workingDirectory?: string): Promise<string> {
    const cwd = process.cwd();
    const resolved = workingDirectory
      ? path.isAbsolute(workingDirectory)
        ? workingDirectory
        : path.resolve(cwd, workingDirectory)
      : cwd;

    const stats = await stat(resolved).catch(() => null);
    if (!stats || !stats.isDirectory()) {
      throw new Error(`Working directory does not exist or is not a directory: ${resolved}`);
    }

    return resolved;
  }

  private async runDotnetCommand(args: string[], workingDirectory?: string): Promise<CommandResult> {
    const cwd = await this.resolveWorkingDirectory(workingDirectory);
    const start = Date.now();

    return await new Promise<CommandResult>((resolve, reject) => {
      const child = spawn('dotnet', args, {
        cwd,
        env: { ...process.env },
        shell: false,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.once('error', (error) => {
        reject(error);
      });

      child.once('close', (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code,
          durationMs: Date.now() - start,
          workingDirectory: cwd,
        });
      });
    });
  }

  private formatResult(commandArgs: string[], result: CommandResult): {
    previewText: string;
    detailedText: string;
    isError: boolean;
  } {
    const exitCodeDisplay = result.exitCode ?? 'null';
    const isSuccess = result.exitCode === 0;

    const headerLines = [
      `Command: dotnet ${commandArgs.join(' ')}`,
      `Working directory: ${result.workingDirectory}`,
      `Exit code: ${exitCodeDisplay}`,
      `Duration: ${result.durationMs}ms`,
    ];

    const previewSections: string[] = [];
    const detailedSections: string[] = [];
    let previewTruncated = false;

    const stdoutPreviewTokens = isSuccess
      ? SUCCESS_STDOUT_PREVIEW_TOKENS
      : FAILURE_STDOUT_PREVIEW_TOKENS;
    const stderrPreviewTokens = isSuccess
      ? SUCCESS_STDERR_PREVIEW_TOKENS
      : FAILURE_STDERR_PREVIEW_TOKENS;

    const stdoutPreview = this.buildStreamSection('stdout', result.stdout, {
      preferTail: true,
      tokenBudget: stdoutPreviewTokens,
    });
    if (stdoutPreview) {
      previewSections.push(stdoutPreview.text);
      previewTruncated ||= stdoutPreview.truncated;
    }

    const stdoutDetailed = this.buildStreamSection('stdout', result.stdout, {
      preferTail: false,
      tokenBudget: DETAIL_TOKEN_BUDGET,
    });
    if (stdoutDetailed) {
      detailedSections.push(stdoutDetailed.text);
    }

    const stderrPreview = this.buildStreamSection('stderr', result.stderr, {
      preferTail: true,
      tokenBudget: stderrPreviewTokens,
    });
    if (stderrPreview) {
      previewSections.push(stderrPreview.text);
      previewTruncated ||= stderrPreview.truncated;
    }

    const stderrDetailed = this.buildStreamSection('stderr', result.stderr, {
      preferTail: true,
      tokenBudget: DETAIL_TOKEN_BUDGET,
    });
    if (stderrDetailed) {
      detailedSections.push(stderrDetailed.text);
    }

    const footerMessage = previewTruncated
      ? 'Preview truncated. Run dotnet_last_response to inspect the complete command output.'
      : 'Full output stored. Run dotnet_last_response to inspect the complete command output.';

    const previewBlocks = [headerLines.join('\n')];
    if (previewSections.length > 0) {
      previewBlocks.push(...previewSections);
    }
    previewBlocks.push(footerMessage);

    const detailedBlocks = [headerLines.join('\n')];
    if (detailedSections.length > 0) {
      detailedBlocks.push(...detailedSections);
    }

    return {
      previewText: previewBlocks.join('\n\n'),
      detailedText: detailedBlocks.join('\n\n'),
      isError: result.exitCode !== 0,
    };
  }

  private buildResponse(commandArgs: string[], result: CommandResult) {
    const commandArgsCopy = [...commandArgs];
    const { previewText, detailedText, isError } = this.formatResult(commandArgsCopy, result);

    this.lastResult = {
      commandArgs: commandArgsCopy,
      formattedText: detailedText,
      raw: result,
      capturedAt: new Date().toISOString(),
    };

    return {
      content: [{ type: 'text', text: previewText }],
      isError,
    };
  }

  private buildStreamSection(
    label: 'stdout' | 'stderr',
    raw: string,
    options: { preferTail: boolean; tokenBudget: number }
  ): { text: string; truncated: boolean } | null {
    const trimmed = raw.trimEnd();
    if (trimmed.length === 0) {
      return null;
    }

    const { content, displayedTokens, totalTokens } = this.truncateStream(
      trimmed,
      options.preferTail,
      options.tokenBudget
    );
    const truncated = displayedTokens < totalTokens;
    const truncatedSuffix = truncated
      ? ` (showing ~${displayedTokens} of ~${totalTokens} tokens)`
      : '';

    return {
      text: [`--- ${label}${truncatedSuffix} ---`, content].join('\n'),
      truncated,
    };
  }

  private truncateStream(
    content: string,
    preferTail: boolean,
    tokenBudget = DETAIL_TOKEN_BUDGET
  ): { content: string; displayedTokens: number; totalTokens: number } {
    const totalTokens = this.approximateTokenCount(content);
    if (totalTokens <= tokenBudget) {
      return {
        content,
        displayedTokens: totalTokens,
        totalTokens,
      };
    }

    const maxChars = tokenBudget * APPROX_CHARS_PER_TOKEN;
    const markerLength = TRUNCATION_MARKER.length;
    let availableChars = Math.max(maxChars - markerLength, 0);
    if (availableChars <= 0) {
      const sliceLimit = Math.max(0, Math.floor(maxChars));
      const slice = preferTail ? content.slice(-sliceLimit) : content.slice(0, sliceLimit);
      const displayedTokens = this.approximateTokenCount(slice);
      return {
        content: slice,
        displayedTokens,
        totalTokens,
      };
    }

    const buildTailOnly = (chars: number): string => {
      const safeChars = Math.max(0, Math.floor(chars));
      const tail = content.slice(-safeChars);
      return `${TRUNCATION_MARKER.trimEnd()}\n${tail}`;
    };

    const buildHeadAndTail = (chars: number): string => {
      const safeChars = Math.max(0, Math.floor(chars));
      const headChars = Math.max(Math.floor(safeChars * 0.6), 0);
      const tailChars = Math.max(safeChars - headChars, 0);
      const head = content.slice(0, headChars);
      const tail = tailChars > 0 ? content.slice(-tailChars) : '';
      return `${head}${TRUNCATION_MARKER}${tail}`;
    };

    const buildContent = preferTail ? buildTailOnly : buildHeadAndTail;

    let truncated = buildContent(availableChars);
    let displayedTokens = this.approximateTokenCount(truncated);
    let safetyCounter = 0;

    while (displayedTokens > tokenBudget && availableChars > 0 && safetyCounter < 10) {
      const overshoot = displayedTokens - tokenBudget;
      const estimatedReduction = Math.max(1, overshoot * APPROX_CHARS_PER_TOKEN);
      availableChars = Math.max(0, availableChars - estimatedReduction);
      truncated = buildContent(availableChars);
      displayedTokens = this.approximateTokenCount(truncated);
      safetyCounter += 1;
    }

    return {
      content: truncated,
      displayedTokens: Math.min(displayedTokens, totalTokens),
      totalTokens,
    };
  }

  private approximateTokenCount(text: string): number {
    if (!text) {
      return 0;
    }

    return Math.ceil(text.length / APPROX_CHARS_PER_TOKEN);
  }

  private ensureString(value: unknown, fieldName: string): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value !== 'string') {
      throw new Error(`${fieldName} must be a string`);
    }

    return value;
  }

  private ensureBoolean(value: unknown, fieldName: string): boolean | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value !== 'boolean') {
      throw new Error(`${fieldName} must be a boolean`);
    }

    return value;
  }

  private ensureNumber(value: unknown, fieldName: string): number | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`${fieldName} must be a finite number`);
    }

    return value;
  }

  private ensureStringArray(value: unknown, fieldName: string): string[] | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
      throw new Error(`${fieldName} must be an array of strings`);
    }

    return value;
  }

  private async handleRestore(rawArgs: Record<string, unknown>) {
    const args = ['restore'];
    const project = this.ensureString(rawArgs.project, 'project');
    const runtime = this.ensureString(rawArgs.runtime, 'runtime');
    const configfile = this.ensureString(rawArgs.configfile, 'configfile');
    const verbosity = this.ensureString(rawArgs.verbosity, 'verbosity');
    const workingDirectory = this.ensureString(rawArgs.working_directory, 'working_directory');

    if (project) {
      args.push(project);
    }
    if (runtime) {
      args.push('--runtime', runtime);
    }
    if (configfile) {
      args.push('--configfile', configfile);
    }
    if (this.ensureBoolean(rawArgs.force, 'force')) {
      args.push('--force');
    }
    if (this.ensureBoolean(rawArgs.no_cache, 'no_cache')) {
      args.push('--no-cache');
    }
    if (this.ensureBoolean(rawArgs.interactive, 'interactive')) {
      args.push('--interactive');
    }
    if (verbosity) {
      args.push('--verbosity', verbosity);
    }

    const result = await this.runDotnetCommand(args, workingDirectory);
    return this.buildResponse(args, result);
  }

  private async handleBuild(rawArgs: Record<string, unknown>) {
    const args = ['build'];
    const project = this.ensureString(rawArgs.project, 'project');
    const configuration = this.ensureString(rawArgs.configuration, 'configuration');
    const framework = this.ensureString(rawArgs.framework, 'framework');
    const runtime = this.ensureString(rawArgs.runtime, 'runtime');
    const output = this.ensureString(rawArgs.output, 'output');
    const verbosity = this.ensureString(rawArgs.verbosity, 'verbosity');
    const workingDirectory = this.ensureString(rawArgs.working_directory, 'working_directory');

    if (project) {
      args.push(project);
    }
    if (configuration) {
      args.push('--configuration', configuration);
    }
    if (framework) {
      args.push('--framework', framework);
    }
    if (runtime) {
      args.push('--runtime', runtime);
    }
    if (output) {
      args.push('--output', output);
    }
    if (this.ensureBoolean(rawArgs.no_restore, 'no_restore')) {
      args.push('--no-restore');
    }
    if (verbosity) {
      args.push('--verbosity', verbosity);
    }

    const result = await this.runDotnetCommand(args, workingDirectory);
    return this.buildResponse(args, result);
  }

  private async handleTest(rawArgs: Record<string, unknown>) {
    const args = ['test'];
    const project = this.ensureString(rawArgs.project, 'project');
    const configuration = this.ensureString(rawArgs.configuration, 'configuration');
    const framework = this.ensureString(rawArgs.framework, 'framework');
    const logger = this.ensureString(rawArgs.logger, 'logger');
    const filter = this.ensureString(rawArgs.filter, 'filter');
    const settings = this.ensureString(rawArgs.settings, 'settings');
    const collect = this.ensureString(rawArgs.collect, 'collect');
    const workingDirectory = this.ensureString(rawArgs.working_directory, 'working_directory');

    if (project) {
      args.push(project);
    }
    if (configuration) {
      args.push('--configuration', configuration);
    }
    if (framework) {
      args.push('--framework', framework);
    }
    if (logger) {
      args.push('--logger', logger);
    }
    if (filter) {
      args.push('--filter', filter);
    }
    if (settings) {
      args.push('--settings', settings);
    }
    if (collect) {
      args.push('--collect', collect);
    }
    if (this.ensureBoolean(rawArgs.no_build, 'no_build')) {
      args.push('--no-build');
    }
    if (this.ensureBoolean(rawArgs.no_restore, 'no_restore')) {
      args.push('--no-restore');
    }

    const result = await this.runDotnetCommand(args, workingDirectory);
    return this.buildResponse(args, result);
  }

  private async handleRun(rawArgs: Record<string, unknown>) {
    const args = ['run'];
    const project = this.ensureString(rawArgs.project, 'project');
    const configuration = this.ensureString(rawArgs.configuration, 'configuration');
    const framework = this.ensureString(rawArgs.framework, 'framework');
    const runtime = this.ensureString(rawArgs.runtime, 'runtime');
    const launchProfile = this.ensureString(rawArgs.launch_profile, 'launch_profile');
    const extraArgs = this.ensureStringArray(rawArgs.additional_arguments, 'additional_arguments');
    const workingDirectory = this.ensureString(rawArgs.working_directory, 'working_directory');

    if (project) {
      args.push('--project', project);
    }
    if (configuration) {
      args.push('--configuration', configuration);
    }
    if (framework) {
      args.push('--framework', framework);
    }
    if (runtime) {
      args.push('--runtime', runtime);
    }
    if (launchProfile) {
      args.push('--launch-profile', launchProfile);
    }
    if (this.ensureBoolean(rawArgs.no_build, 'no_build')) {
      args.push('--no-build');
    }
    if (this.ensureBoolean(rawArgs.no_restore, 'no_restore')) {
      args.push('--no-restore');
    }

    if (extraArgs && extraArgs.length > 0) {
      args.push('--', ...extraArgs);
    }

    const result = await this.runDotnetCommand(args, workingDirectory);
    return this.buildResponse(args, result);
  }

  private async handleNew(rawArgs: Record<string, unknown>) {
    const template = this.ensureString(rawArgs.template, 'template');
    if (!template) {
      throw new Error('template is required');
    }

    const args = ['new', template];
    const name = this.ensureString(rawArgs.name, 'name');
    const output = this.ensureString(rawArgs.output, 'output');
    const language = this.ensureString(rawArgs.language, 'language');
    const framework = this.ensureString(rawArgs.framework, 'framework');
    const additionalArguments = this.ensureStringArray(rawArgs.additional_arguments, 'additional_arguments');
    const workingDirectory = this.ensureString(rawArgs.working_directory, 'working_directory');

    if (name) {
      args.push('--name', name);
    }
    if (output) {
      args.push('--output', output);
    }
    if (language) {
      args.push('--language', language);
    }
    if (framework) {
      args.push('--framework', framework);
    }
    if (this.ensureBoolean(rawArgs.force, 'force')) {
      args.push('--force');
    }
    if (this.ensureBoolean(rawArgs.skip_restore, 'skip_restore')) {
      args.push('--skip-restore');
    }
    if (this.ensureBoolean(rawArgs.dry_run, 'dry_run')) {
      args.push('--dry-run');
    }
    if (this.ensureBoolean(rawArgs.no_update_check, 'no_update_check')) {
      args.push('--no-update-check');
    }
    if (additionalArguments && additionalArguments.length > 0) {
      args.push(...additionalArguments);
    }

    const result = await this.runDotnetCommand(args, workingDirectory);
    return this.buildResponse(args, result);
  }

  private async handleAddPackage(rawArgs: Record<string, unknown>) {
    const packageId = this.ensureString(rawArgs.package, 'package');
    if (!packageId) {
      throw new Error('package is required');
    }

    const args = ['add'];
    const project = this.ensureString(rawArgs.project, 'project');
    const version = this.ensureString(rawArgs.version, 'version');
    const source = this.ensureString(rawArgs.source, 'source');
    const workingDirectory = this.ensureString(rawArgs.working_directory, 'working_directory');

    if (project) {
      args.push(project, 'package', packageId);
    } else {
      args.push('package', packageId);
    }

    if (version) {
      args.push('--version', version);
    }
    if (this.ensureBoolean(rawArgs.prerelease, 'prerelease')) {
      args.push('--prerelease');
    }
    if (source) {
      args.push('--source', source);
    }
    if (this.ensureBoolean(rawArgs.no_restore, 'no_restore')) {
      args.push('--no-restore');
    }

    const result = await this.runDotnetCommand(args, workingDirectory);
    return this.buildResponse(args, result);
  }

  private async handleClean(rawArgs: Record<string, unknown>) {
    const args = ['clean'];
    const project = this.ensureString(rawArgs.project, 'project');
    const configuration = this.ensureString(rawArgs.configuration, 'configuration');
    const framework = this.ensureString(rawArgs.framework, 'framework');
    const runtime = this.ensureString(rawArgs.runtime, 'runtime');
    const output = this.ensureString(rawArgs.output, 'output');
    const workingDirectory = this.ensureString(rawArgs.working_directory, 'working_directory');

    if (project) {
      args.push(project);
    }
    if (configuration) {
      args.push('--configuration', configuration);
    }
    if (framework) {
      args.push('--framework', framework);
    }
    if (runtime) {
      args.push('--runtime', runtime);
    }
    if (output) {
      args.push('--output', output);
    }

    const result = await this.runDotnetCommand(args, workingDirectory);
    return this.buildResponse(args, result);
  }

  private async handlePublish(rawArgs: Record<string, unknown>) {
    const args = ['publish'];
    const project = this.ensureString(rawArgs.project, 'project');
    const configuration = this.ensureString(rawArgs.configuration, 'configuration');
    const framework = this.ensureString(rawArgs.framework, 'framework');
    const runtime = this.ensureString(rawArgs.runtime, 'runtime');
    const output = this.ensureString(rawArgs.output, 'output');
    const verbosity = this.ensureString(rawArgs.verbosity, 'verbosity');
    const workingDirectory = this.ensureString(rawArgs.working_directory, 'working_directory');

    if (project) {
      args.push(project);
    }
    if (configuration) {
      args.push('--configuration', configuration);
    }
    if (framework) {
      args.push('--framework', framework);
    }
    if (runtime) {
      args.push('--runtime', runtime);
    }
    if (output) {
      args.push('--output', output);
    }
    if (this.ensureBoolean(rawArgs.self_contained, 'self_contained')) {
      args.push('--self-contained');
    }
    if (this.ensureBoolean(rawArgs.no_restore, 'no_restore')) {
      args.push('--no-restore');
    }
    if (verbosity) {
      args.push('--verbosity', verbosity);
    }

    const result = await this.runDotnetCommand(args, workingDirectory);
    return this.buildResponse(args, result);
  }

  private async handleLastResponse(rawArgs: Record<string, unknown>) {
    if (!this.lastResult) {
      return {
        content: [
          {
            type: 'text',
            text: 'No dotnet command responses are stored yet. Run one of the main tools first.',
          },
        ],
        isError: true,
      };
    }

    const query = this.ensureString(rawArgs.query, 'query');
    const caseSensitive = this.ensureBoolean(rawArgs.case_sensitive, 'case_sensitive') ?? false;
    const lineNumbers = this.ensureBoolean(rawArgs.line_numbers, 'line_numbers') ?? false;
    const maxMatchesRaw = this.ensureNumber(rawArgs.max_matches, 'max_matches');
    const maxMatches =
      maxMatchesRaw !== undefined ? Math.max(1, Math.floor(maxMatchesRaw)) : undefined;

    const baseText = this.lastResult.formattedText;
    let bodyText: string;
    let extraLines: string[] = [];

    if (query && query.length > 0) {
      const lines = baseText.split(/\r?\n/);
      const normalized = caseSensitive ? query : query.toLowerCase();
      const matches: string[] = [];
      let totalMatches = 0;

      for (let index = 0; index < lines.length; index += 1) {
        const sourceLine = lines[index];
        const haystack = caseSensitive ? sourceLine : sourceLine.toLowerCase();
        if (haystack.includes(normalized)) {
          totalMatches += 1;
          const displayLine = lineNumbers ? `${index + 1}: ${sourceLine}` : sourceLine;
          matches.push(displayLine);
          if (maxMatches && matches.length >= maxMatches) {
            break;
          }
        }
      }

      if (matches.length === 0) {
        bodyText = `No matches for "${query}" in the last response.`;
      } else {
        bodyText = matches.join('\n');
        extraLines.push(
          `Matches returned: ${matches.length}${
            maxMatches ? ` (max ${maxMatches}, total found ${totalMatches})` : ''
          }`
        );
        if (!maxMatches) {
          extraLines.push(`Total matches found: ${totalMatches}`);
        } else if (totalMatches > matches.length) {
          extraLines.push(`Total matches found: ${totalMatches}`);
        }
      }
    } else {
      bodyText = baseText;
    }

    const { content, displayedTokens, totalTokens } = this.truncateStream(bodyText, false);

    const headerLines = [
      `Most recent command: dotnet ${this.lastResult.commandArgs.join(' ')}`,
      `Captured at: ${this.lastResult.capturedAt}`,
      `Exit code: ${this.lastResult.raw.exitCode ?? 'null'}`,
      `Filter: ${query ? `"${query}"${caseSensitive ? ' (case-sensitive)' : ''}` : 'none'}`,
      `Tokens: showing ~${displayedTokens} of ~${totalTokens}`,
      ...extraLines,
    ];

    const text = [...headerLines, '', content].join('\n');
    return {
      content: [{ type: 'text', text }],
    };
  }

  private setupProcessHandlers(): void {
    this.server.onerror = (error) => {
      console.error('[dotnet-mcp] Server error', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run(): Promise<void> {
    this.setupProcessHandlers();
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('dotnet-mcp server listening on stdio');
  }
}

const server = new DotnetServer();
server.run().catch((error) => {
  console.error('Failed to start dotnet-mcp server:', error);
  process.exit(1);
});
